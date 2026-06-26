import os
import re
import json
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.dependencies import get_current_user
from app.utils.email import send_verification_email
from app.utils.pdf import generate_verification_pdf
from app.config import settings

router = APIRouter(prefix="/api/students", tags=["Student Profiling"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_active_semester(db: Session) -> models.Semester:
    """Helper to fetch the active semester or raise 404."""
    active_sem = db.query(models.Semester).filter(models.Semester.is_active == True).first()
    if not active_sem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="There is currently no active semester for student profiling."
        )
    now = datetime.now(timezone.utc)
    if now < active_sem.opens_at or now > active_sem.closes_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"The active semester profiling window is closed. (Open: {active_sem.opens_at} to {active_sem.closes_at})"
        )
    return active_sem


def parse_semester_details(label: str):
    """Parses year and semester digit from semester label (e.g. 'AY 2026-2027 1st Semester')."""
    year_match = re.search(r"(\d{4})", label)
    year = year_match.group(1) if year_match else str(datetime.now(timezone.utc).year)
    sem = "1"
    if "2nd" in label.lower() or "second" in label.lower():
        sem = "2"
    elif "summer" in label.lower():
        sem = "S"
    return year, sem


def is_basic_phone(answers_map: dict, applicable_questions: list) -> bool:
    """Returns True when the student selected 'Basic phone (call and text only)'."""
    cellphone_q = next(
        (q for q in applicable_questions if q.system_key == "cellphone_type"), None
    )
    if not cellphone_q:
        return False
    cellphone_ans = answers_map.get(cellphone_q.id, "")
    # Exact match against CSV option value (not substring — avoids false positives)
    return cellphone_ans == "Basic phone (call and text only)"


def resolve_visible_questions(
    applicable_questions: list,
    answers_map: dict,
) -> set:
    """
    Returns the set of question IDs that are currently VISIBLE given the submitted
    answers.  Respects conditional_parent / conditional_value chains and the Basic
    Phone survey-termination rule.
    """
    # Cache visibility decisions (memoised DFS)
    visibility_cache: dict[int, bool] = {}

    def is_visible(q: models.Question) -> bool:
        if q.id in visibility_cache:
            return visibility_cache[q.id]

        # If no conditional parent → always visible
        if not q.conditional_parent_question_id:
            visibility_cache[q.id] = True
            return True

        # Parent must exist and be visible
        parent = next(
            (pq for pq in applicable_questions if pq.id == q.conditional_parent_question_id),
            None,
        )
        if parent is None or not is_visible(parent):
            visibility_cache[q.id] = False
            return False

        parent_answer = answers_map.get(parent.id)
        if parent_answer is None:
            visibility_cache[q.id] = False
            return False

        # Multi-select / checkbox parents: check membership
        if parent.field_type in ("checkbox", "multi_select", "multi-select"):
            try:
                parent_list = json.loads(parent_answer)
                result = q.conditional_value in parent_list
            except Exception:
                result = q.conditional_value == parent_answer
        else:
            result = q.conditional_value == parent_answer

        visibility_cache[q.id] = result
        return result

    basic_phone = is_basic_phone(answers_map, applicable_questions)

    visible_ids: set[int] = set()
    for q in applicable_questions:
        if not is_visible(q):
            continue
        # Basic phone gate: hide ALL digital-tech questions except cellphone_type itself
        if basic_phone and q.system_key not in (
            "cellphone_type",
            "primary_mode_of_residence",
        ):
            # Only hide category 7 (Internet & Digital Technology) questions
            # Category IDs are not reliable here so we key off system_key exclusions
            # The seeder puts digital tech in category 7; check field is conditional
            # on cellphone_type=Smartphone at the DB level too — redundant safety net.
            if q.conditional_parent_question_id is not None:
                parent = next(
                    (pq for pq in applicable_questions if pq.id == q.conditional_parent_question_id),
                    None,
                )
                if parent and parent.system_key == "cellphone_type":
                    continue  # skip — basic phone user
        visible_ids.add(q.id)

    return visible_ids


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/active-submission", response_model=Optional[schemas.SubmissionResponse])
def get_current_submission(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Gets the active draft or final submission of the logged-in student for the current active semester."""
    active_sem = get_active_semester(db)
    submission = db.query(models.Submission).filter(
        models.Submission.user_id == current_user.id,
        models.Submission.semester_id == active_sem.id,
    ).first()
    if not submission:
        return None
    return schemas.SubmissionResponse.model_validate(submission)


@router.post("/draft", response_model=schemas.SubmissionResponse)
def save_profile_draft(
    draft: schemas.DraftSave,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Saves student form progress as a draft."""
    active_sem = get_active_semester(db)

    existing_submission = db.query(models.Submission).filter(
        models.Submission.user_id == current_user.id,
        models.Submission.semester_id == active_sem.id,
    ).first()

    if existing_submission and existing_submission.is_final and existing_submission.status != "returned":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your submission for this semester has already been finalized and locked.",
        )

    draft_json = json.dumps(draft.draft_data)

    if existing_submission:
        existing_submission.draft_data_json = draft_json
        db.commit()
        db.refresh(existing_submission)
        return schemas.SubmissionResponse.model_validate(existing_submission)
    else:
        new_submission = models.Submission(
            user_id=current_user.id,
            semester_id=active_sem.id,
            submitted_at=None,
            draft_data_json=draft_json,
            is_final=False,
            verification_code=None,
        )
        db.add(new_submission)
        db.commit()
        db.refresh(new_submission)
        return schemas.SubmissionResponse.model_validate(new_submission)


@router.post("/submit", response_model=schemas.SubmissionResponse)
def finalize_submission(
    submit_data: schemas.FinalSubmit,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Validates dynamic fields, applies cross-field validation, locks the submission,
    saves answers, generates a verification code, and sends the verification receipt email.
    """
    active_sem = get_active_semester(db)

    if current_user.category is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student profiling category (New/Transferee/Returnee/Continuing) must be selected first.",
        )

    # Check if already submitted
    existing_sub = db.query(models.Submission).filter(
        models.Submission.user_id == current_user.id,
        models.Submission.semester_id == active_sem.id,
    ).first()

    if existing_sub and existing_sub.is_final and existing_sub.status != "returned":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already submitted your profiling details for this semester.",
        )

    # --- Get all active questions applicable to this student's category ---
    all_questions = db.query(models.Question).filter(models.Question.active == True).all()
    applicable_questions: list[models.Question] = []
    for q in all_questions:
        cats = json.loads(q.applicable_categories_json) if q.applicable_categories_json else ["all"]
        if "all" in cats or current_user.category in cats:
            applicable_questions.append(q)

    # Index submitted answers by question_id
    answers_map: dict[int, str] = {ans.question_id: ans.answer_text for ans in submit_data.answers}

    # --- Resolve which questions are actually visible ---
    visible_ids = resolve_visible_questions(applicable_questions, answers_map)

    # --- 1. Validate all required visible fields are answered ---
    missing_fields = []
    for q in applicable_questions:
        if q.id not in visible_ids:
            continue
        if q.required:
            ans_val = answers_map.get(q.id)
            if ans_val is None or str(ans_val).strip() == "":
                # File fields: skip if a file was already uploaded (path stored separately)
                if q.field_type == "file":
                    continue
                missing_fields.append(q.question_text)
                continue
            # multi_select/checkbox: empty array [] should fail required check
            if q.field_type in ("checkbox", "multi_select"):
                try:
                    parsed = json.loads(ans_val) if isinstance(ans_val, str) else ans_val
                    if isinstance(parsed, list) and len(parsed) == 0:
                        missing_fields.append(q.question_text)
                except (json.JSONDecodeError, TypeError):
                    pass

    if missing_fields:
        if len(missing_fields) == 1:
            detail = f"Required field missing: '{missing_fields[0]}'"
        else:
            field_list = "', '".join(missing_fields)
            detail = f"Required fields missing: '{field_list}'"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
        )

    # --- 1b. Validate min_rows for table-type questions ---
    for q in applicable_questions:
        if q.id not in visible_ids:
            continue
        if q.field_type == "table" and q.min_rows and q.min_rows > 0:
            ans_val = answers_map.get(q.id)
            if ans_val:
                try:
                    rows = json.loads(ans_val) if isinstance(ans_val, str) else ans_val
                    if isinstance(rows, list) and len(rows) < q.min_rows:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"'{q.question_text}' requires at least {q.min_rows} row(s). Please add more entries.",
                        )
                except (json.JSONDecodeError, TypeError):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"'{q.question_text}' has an invalid format.",
                    )

    # --- 2a. Emergency contact name must contain at least one letter ---
    ec_name_q = next(
        (q for q in applicable_questions if q.system_key == "emergency_contact_name"), None
    )
    if ec_name_q:
        ec_name_val = (answers_map.get(ec_name_q.id) or "").strip()
        if ec_name_val and not any(c.isalpha() for c in ec_name_val):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Emergency Contact Name must contain at least one letter.",
            )

    # --- 2b. Cross-field validation: emergency_contact_number != active_contact_number ---
    active_contact_q = next(
        (q for q in applicable_questions if q.system_key == "active_contact_number"), None
    )
    emergency_contact_q = next(
        (q for q in applicable_questions if q.system_key == "emergency_contact_number"), None
    )
    if active_contact_q and emergency_contact_q:
        active_val     = (answers_map.get(active_contact_q.id) or "").strip()
        emergency_val  = (answers_map.get(emergency_contact_q.id) or "").strip()
        if active_val and emergency_val and active_val == emergency_val:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Emergency number must differ from your contact number.",
            )

    # --- 3. Get or create submission record ---
    if not existing_sub:
        existing_sub = models.Submission(
            user_id=current_user.id,
            semester_id=active_sem.id,
            is_final=False,
        )
        db.add(existing_sub)
        db.flush()

    # Clear any previous answers to overwrite cleanly
    db.query(models.Answer).filter(models.Answer.submission_id == existing_sub.id).delete()

    # --- 4. Save answers for visible questions only ---
    summary_for_email: list[dict] = []
    pwd_wants_card = False

    for q in applicable_questions:
        if q.id not in visible_ids:
            continue

        ans_val = answers_map.get(q.id)
        # Auto-uppercase free-text field types for consistent formatting
        if ans_val and q.field_type in ("text", "textarea", "table", "number"):
            ans_val = ans_val.upper()
        db_answer = models.Answer(
            submission_id=existing_sub.id,
            question_id=q.id,
            answer_text=ans_val,
            file_path=ans_val if q.field_type == "file" else None,
        )
        db.add(db_answer)

        # Build email summary (skip file and table fields for clean reading)
        if q.field_type not in ("file", "table") and ans_val:
            summary_for_email.append({"question": q.question_text, "answer": ans_val})

        # Check PWD follow-up trigger (merged 3-option field)
        if (
            q.system_key == "pwd_card_status"
            and ans_val
            and "would like to have one" in ans_val.lower()
        ):
            pwd_wants_card = True

    # --- 5. Generate verification code ---
    year, sem_num = parse_semester_details(active_sem.label)
    if existing_sub.verification_code:
        verification_code = existing_sub.verification_code
    else:
        # Use submission ID as suffix — guaranteed unique, no race condition
        verification_code = f"OSWD-TG-{year}-{sem_num}-{existing_sub.id:05d}"

    # --- 6. Populate draft_data_json with final answers for admin views ---
    existing_sub.draft_data_json = json.dumps(answers_map)
    existing_sub.submitted_at = datetime.now(timezone.utc)
    existing_sub.is_final = True
    existing_sub.status = "pending"
    existing_sub.admin_comment = None
    existing_sub.verification_code = verification_code
    db.commit()
    db.refresh(existing_sub)

    # --- 7. Create internal PWD assistance task if needed ---
    if pwd_wants_card:
        task_exists = db.query(models.PWDAssistanceTask).filter(
            models.PWDAssistanceTask.student_id == current_user.id,
            models.PWDAssistanceTask.status == "pending",
        ).first()
        if not task_exists:
            new_task = models.PWDAssistanceTask(
                student_id=current_user.id,
                status="pending",
                notes=(
                    "Student completed OSWD profile and indicated they do not have a "
                    "PWD card but would like to obtain one."
                ),
            )
            db.add(new_task)
            db.commit()

    # --- 8. Send verification receipt email ---
    try:
        send_verification_email(
            email=current_user.email,
            category=current_user.category,
            verification_code=verification_code,
            summary_data=summary_for_email,
        )
    except Exception as e:
        # Email sending failed after retries, fallback to PDF generation
        print(f"[WARN] Failed to send verification email to {current_user.email}: {e}. Generating PDF fallback.")
        try:
            pdf_path = generate_verification_pdf(
                email=current_user.email,
                category=current_user.category,
                verification_code=verification_code,
                summary_data=summary_for_email
            )
            existing_sub.receipt_pdf_path = pdf_path
            db.commit()
            db.refresh(existing_sub)
        except Exception as pdf_e:
            print(f"[ERROR] PDF generation fallback also failed for {current_user.email}: {pdf_e}")

    # Audit log
    new_log = models.AdminLog(
        admin_id=current_user.id,
        action="submit_profile",
        details=f"Student {current_user.email} submitted final profiling. Code: {verification_code}",
    )
    db.add(new_log)
    db.commit()

    return schemas.SubmissionResponse.model_validate(existing_sub)


@router.post("/upload", response_model=Dict[str, str])
def upload_file(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
):
    """
    Uploads a file (PDF, JPG, PNG) up to 10MB.
    Renames it securely to: StudentEmail_DocumentType_Timestamp.ext
    """
    MAX_SIZE = 10 * 1024 * 1024  # 10 MB
    
    # Early size check (FastAPI 0.73+)
    if getattr(file, "size", 0) and getattr(file, "size") > MAX_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds the 10MB limit.",
        )

    header = file.file.read(2048)
    file.file.seek(0, os.SEEK_END)
    actual_size = file.file.tell()
    file.file.seek(0)
    
    if actual_size > MAX_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds the 10MB limit.",
        )

    is_valid_magic = False
    if header.startswith(b"%PDF-"):
        is_valid_magic = True
    elif header.startswith(b"\xff\xd8\xff"):
        is_valid_magic = True
    elif header.startswith(b"\x89PNG\r\n\x1a\n"):
        is_valid_magic = True
        
    if not is_valid_magic:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format detected via magic bytes. Only genuine PDF, JPG, and PNG are allowed.",
        )

    ext = os.path.splitext(file.filename)[1].lower()
    allowed_exts = [".pdf", ".jpg", ".jpeg", ".png"]
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file extension. Allowed: {allowed_exts}",
        )

    allowed_mimes = ["application/pdf", "image/jpeg", "image/png"]
    if file.content_type not in allowed_mimes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid document MIME type.",
        )

    upload_dir = getattr(settings, "UPLOAD_DIR", "uploads")
    os.makedirs(upload_dir, exist_ok=True)

    safe_email = re.sub(r"[^a-zA-Z0-9_]", "_", current_user.email)
    timestamp = int(datetime.now(timezone.utc).timestamp())
    filename = f"{safe_email}_doc_{timestamp}{ext}"
    file_path = os.path.join(upload_dir, filename)

    import shutil
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    return {"file_path": file_path}


@router.get("/history", response_model=List[schemas.SubmissionResponse])
def get_submission_history(
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves all past finalized submissions (read-only) for the logged-in student."""
    submissions = (
        db.query(models.Submission)
        .filter(
            models.Submission.user_id == current_user.id,
            models.Submission.is_final == True,
            models.Submission.is_archived == False,
        )
        .order_by(models.Submission.submitted_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [schemas.SubmissionResponse.model_validate(s) for s in submissions]


@router.get("/history-detailed")
def get_submission_history_detailed(
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns past finalized submissions enriched with semester label.
    Used by the frontend semester-picker so continuing students can choose
    which past semester to copy from in the 'Reuse Past Entry' flow.
    """
    submissions = (
        db.query(models.Submission)
        .filter(
            models.Submission.user_id == current_user.id,
            models.Submission.is_final == True,
            models.Submission.is_archived == False,
        )
        .order_by(models.Submission.submitted_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    result = []
    for sub in submissions:
        sem = db.query(models.Semester).filter(models.Semester.id == sub.semester_id).first()
        result.append({
            "submission_id":   sub.id,
            "semester_label":  sem.label if sem else "Unknown Semester",
            "submitted_at":    sub.submitted_at.isoformat() if sub.submitted_at else None,
            "verification_code": sub.verification_code,
        })
    return result


# ---------------------------------------------------------------------------
# Reuse Past Entry — 2-step flow with diff preview
# ---------------------------------------------------------------------------

@router.post("/reuse-preview", response_model=schemas.ReusePreviewResponse)
def reuse_preview(
    request: schemas.ReusePreviewRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Step 1 of the 'Reuse Past Entry' flow.

    Returns the answers from a previous semester alongside their question texts so
    the frontend can render a diff/comparison table before the student confirms.
    The student can optionally specify which past semester to copy from via
    `source_submission_id`; if omitted, the most recent finalized submission is used.

    This endpoint does NOT write anything to the database.
    """
    if current_user.category != "Continuing":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only Continuing students can reuse answers from a previous semester.",
        )

    active_sem = get_active_semester(db)

    # Find the source past submission
    if request.source_submission_id:
        past_sub = db.query(models.Submission).filter(
            models.Submission.id == request.source_submission_id,
            models.Submission.user_id == current_user.id,
            models.Submission.is_final == True,
            models.Submission.semester_id != active_sem.id,
        ).first()
        if not past_sub:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Specified past submission not found or does not belong to you.",
            )
    else:
        past_sub = (
            db.query(models.Submission)
            .filter(
                models.Submission.user_id == current_user.id,
                models.Submission.is_final == True,
                models.Submission.semester_id != active_sem.id,
            )
            .order_by(models.Submission.submitted_at.desc())
            .first()
        )
        if not past_sub:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No previous finalized submission was found to copy from.",
            )

    sem = db.query(models.Semester).filter(models.Semester.id == past_sub.semester_id).first()
    sem_label = sem.label if sem else "Unknown Semester"

    # Load past answers and their question texts
    past_answers = (
        db.query(models.Answer)
        .filter(models.Answer.submission_id == past_sub.id)
        .all()
    )

    # Also check if there's a current draft for comparison
    current_draft_sub = db.query(models.Submission).filter(
        models.Submission.user_id == current_user.id,
        models.Submission.semester_id == active_sem.id,
        models.Submission.is_final == False,
    ).first()
    current_draft_data: dict[int, Any] = {}
    if current_draft_sub and current_draft_sub.draft_data_json:
        try:
            raw = json.loads(current_draft_sub.draft_data_json)
            current_draft_data = {int(k): v for k, v in raw.items()}
        except Exception:
            pass

    answer_items: list[schemas.ReuseAnswerItem] = []
    changed_count = 0

    for ans in past_answers:
        q = db.query(models.Question).filter(models.Question.id == ans.question_id).first()
        if not q:
            continue

        # Try to parse JSON-encoded values (e.g. multi-select arrays, table rows)
        try:
            old_answer = json.loads(ans.answer_text) if ans.answer_text else None
        except Exception:
            old_answer = ans.answer_text

        # Compare against current draft if one exists
        new_answer = current_draft_data.get(q.id, old_answer)
        changed = (old_answer != new_answer)
        if changed:
            changed_count += 1

        answer_items.append(
            schemas.ReuseAnswerItem(
                question_id=q.id,
                question_text=q.question_text,
                system_key=q.system_key,
                old_answer=old_answer,
                new_answer=new_answer,
                changed=changed,
            )
        )

    return schemas.ReusePreviewResponse(
        source_submission_id=past_sub.id,
        source_semester_label=sem_label,
        submitted_at=past_sub.submitted_at,
        answers=answer_items,
        changed_count=changed_count,
    )


@router.post("/reuse-confirm", response_model=schemas.SubmissionResponse)
def reuse_confirm(
    request: schemas.ReuseConfirmRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Step 2 of the 'Reuse Past Entry' flow.

    After the student has reviewed the diff from reuse-preview and confirmed,
    this endpoint writes the past answers as the new draft for the active semester.
    File upload answers are intentionally excluded — the student must re-upload
    current-semester documents.
    """
    if current_user.category != "Continuing":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only Continuing students can reuse answers from a previous semester.",
        )

    active_sem = get_active_semester(db)

    # Verify the student hasn't already finalised this semester
    existing_sub = db.query(models.Submission).filter(
        models.Submission.user_id == current_user.id,
        models.Submission.semester_id == active_sem.id,
    ).first()

    if existing_sub and existing_sub.is_final and existing_sub.status != "returned":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already finalized your submission for this semester.",
        )

    # Validate source submission belongs to this student
    past_sub = db.query(models.Submission).filter(
        models.Submission.id == request.source_submission_id,
        models.Submission.user_id == current_user.id,
        models.Submission.is_final == True,
        models.Submission.semester_id != active_sem.id,
    ).first()

    if not past_sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The specified past submission was not found or does not belong to you.",
        )

    # Build draft dict from past answers (exclude file-upload fields to force re-upload)
    past_answers = (
        db.query(models.Answer)
        .filter(models.Answer.submission_id == past_sub.id)
        .all()
    )

    draft_dict: dict[str, Any] = {}
    for ans in past_answers:
        q = db.query(models.Question).filter(models.Question.id == ans.question_id).first()
        if not q:
            continue
        if q.field_type == "file":
            # Skip — student must re-upload current semester documents
            continue
        try:
            draft_dict[str(ans.question_id)] = json.loads(ans.answer_text)
        except Exception:
            draft_dict[str(ans.question_id)] = ans.answer_text

    draft_json = json.dumps(draft_dict)

    if existing_sub:
        existing_sub.draft_data_json = draft_json
        db.commit()
        db.refresh(existing_sub)
        return schemas.SubmissionResponse.model_validate(existing_sub)
    else:
        new_draft = models.Submission(
            user_id=current_user.id,
            semester_id=active_sem.id,
            draft_data_json=draft_json,
            is_final=False,
        )
        db.add(new_draft)
        db.commit()
        db.refresh(new_draft)
        return schemas.SubmissionResponse.model_validate(new_draft)


@router.post("/reuse-previous", response_model=schemas.SubmissionResponse, deprecated=True)
def reuse_previous_submission(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    [DEPRECATED] Blindly copies the most recent past submission into the current draft.
    Use POST /reuse-preview + POST /reuse-confirm instead for a safe diff-view flow.
    This endpoint is kept for backward-compatibility only.
    """
    if current_user.category != "Continuing":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only Continuing students can reuse answers from a previous semester.",
        )

    active_sem = get_active_semester(db)

    existing_sub = db.query(models.Submission).filter(
        models.Submission.user_id == current_user.id,
        models.Submission.semester_id == active_sem.id,
    ).first()

    if existing_sub and existing_sub.is_final and existing_sub.status != "returned":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already finalized your submission for this semester.",
        )

    past_sub = (
        db.query(models.Submission)
        .filter(
            models.Submission.user_id == current_user.id,
            models.Submission.is_final == True,
            models.Submission.semester_id != active_sem.id,
        )
        .order_by(models.Submission.submitted_at.desc())
        .first()
    )

    if not past_sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No previous finalized submission was found to clone answers from.",
        )

    past_answers = db.query(models.Answer).filter(models.Answer.submission_id == past_sub.id).all()

    draft_dict: dict[str, Any] = {}
    for ans in past_answers:
        q = db.query(models.Question).filter(models.Question.id == ans.question_id).first()
        if q and q.field_type == "file":
            continue
        try:
            draft_dict[str(ans.question_id)] = json.loads(ans.answer_text)
        except Exception:
            draft_dict[str(ans.question_id)] = ans.answer_text

    draft_json = json.dumps(draft_dict)

    if existing_sub:
        existing_sub.draft_data_json = draft_json
        db.commit()
        db.refresh(existing_sub)
        return schemas.SubmissionResponse.model_validate(existing_sub)
    else:
        new_draft = models.Submission(
            user_id=current_user.id,
            semester_id=active_sem.id,
            draft_data_json=draft_json,
            is_final=False,
        )
        db.add(new_draft)
        db.commit()
        db.refresh(new_draft)
        return schemas.SubmissionResponse.model_validate(new_draft)



