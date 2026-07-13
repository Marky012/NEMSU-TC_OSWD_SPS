import io
import csv
import json
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Tuple
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload, selectinload
from app.database import get_db
from app import models, schemas
from app.dependencies import RoleChecker

router = APIRouter(prefix="/api/admin", tags=["Data Import"])


def get_system_key_map(db: Session, semester_id: int) -> Dict[str, int]:
    """Build a dict mapping system_key -> question_id for the given semester."""
    questions = db.query(models.Question).filter(
        models.Question.semester_id == semester_id,
        models.Question.system_key.isnot(None)
    ).all()
    return {q.system_key: q.id for q in questions}


def get_answer_from_submission(
    submission: models.Submission,
    system_key_map: Dict[str, int],
    system_key: str
) -> Optional[str]:
    """Extract an answer value from a submission by system_key.
    Checks answers table first, then falls back to draft_data_json.
    """
    qid = system_key_map.get(system_key)
    if not qid:
        return None
    for ans in submission.answers:
        if ans.question_id == qid:
            return ans.answer_text
    if submission.draft_data_json:
        try:
            data = json.loads(submission.draft_data_json)
            val = data.get(str(qid))
            if val is not None:
                return str(val) if not isinstance(val, str) else val
        except (json.JSONDecodeError, TypeError):
            pass
    return None


def build_submission_lookup(
    db: Session,
    semester_id: int,
    system_key_map: Dict[str, int],
    year_levels: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Build a list of active submissions with their identifying fields for matching.
    Optionally filter by year_levels — only submissions whose year_level answer
    is in the provided list will be included.
    """
    subs = db.query(models.Submission).options(
        joinedload(models.Submission.user),
        selectinload(models.Submission.answers).joinedload(models.Answer.question)
    ).filter(
        models.Submission.semester_id == semester_id,
        models.Submission.is_final == True,
        models.Submission.is_archived == False,
    ).all()

    lookup = []
    for sub in subs:
        student = sub.user
        if not student:
            continue
        year_level = get_answer_from_submission(sub, system_key_map, "year_level")
        if year_levels and year_level not in year_levels:
            continue
        lookup.append({
            "submission": sub,
            "email": (student.email or "").strip().lower(),
            "verification_code": (sub.verification_code or "").strip(),
            "surname": (get_answer_from_submission(sub, system_key_map, "surname") or "").strip().upper(),
            "first_name": (get_answer_from_submission(sub, system_key_map, "first_name") or "").strip().upper(),
            "program": (get_answer_from_submission(sub, system_key_map, "program") or "").strip().upper(),
            "birthdate": (get_answer_from_submission(sub, system_key_map, "birthdate") or "").strip(),
            "year_level": (year_level or "").strip(),
        })
    return lookup


def match_csv_row(
    row: Dict[str, str],
    lookup: List[Dict[str, Any]]
) -> Optional[models.Submission]:
    """Match a CSV row to an existing submission using multi-field strategy."""
    csv_vc = (row.get("verification_code", "") or "").strip()
    csv_email = (row.get("email", "") or "").strip().lower()
    csv_surname = (row.get("surname", "") or "").strip().upper()
    csv_first_name = (row.get("first_name", "") or "").strip().upper()
    csv_program = (row.get("program", "") or "").strip().upper()
    csv_birthdate = (row.get("birthdate", "") or "").strip()

    if csv_vc:
        for entry in lookup:
            if entry["verification_code"] == csv_vc:
                return entry["submission"]

    if csv_email:
        for entry in lookup:
            if entry["email"] == csv_email:
                return entry["submission"]

    if csv_surname and csv_first_name and csv_program and csv_birthdate:
        for entry in lookup:
            if (entry["surname"] == csv_surname
                    and entry["first_name"] == csv_first_name
                    and entry["program"] == csv_program
                    and entry["birthdate"] == csv_birthdate):
                return entry["submission"]

    return None


def parse_csv_file(content: str) -> Tuple[List[str], List[Dict[str, str]]]:
    """Parse CSV content and return (headers, rows as dicts)."""
    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file is empty or has no headers.")
    headers = reader.fieldnames
    rows = []
    for r in reader:
        rows.append({k.strip(): (v or "").strip() for k, v in r.items()})
    return headers, rows


def parse_year_levels_param(year_levels: Optional[str]) -> Optional[List[str]]:
    """Parse comma-separated year_levels query param into a list, or None."""
    if not year_levels or not year_levels.strip():
        return None
    parts = [yl.strip() for yl in year_levels.split(",") if yl.strip()]
    return parts if parts else None


def get_targeted_submissions(
    db: Session,
    semester_id: int,
    system_key_map: Dict[str, int],
    year_levels: Optional[List[str]] = None,
) -> List[models.Submission]:
    """Get active submissions filtered by year_levels (for archiving)."""
    query = db.query(models.Submission).options(
        joinedload(models.Submission.user),
        selectinload(models.Submission.answers).joinedload(models.Answer.question)
    ).filter(
        models.Submission.semester_id == semester_id,
        models.Submission.is_final == True,
        models.Submission.is_archived == False,
    )
    subs = query.all()
    if not year_levels:
        return subs
    return [
        sub for sub in subs
        if get_answer_from_submission(sub, system_key_map, "year_level") in year_levels
    ]


REQUIRED_CSV_COLS = [
    "verification_code", "email", "surname", "first_name",
    "program", "birthdate"
]

IDENTIFYING_COLS = [
    "verification_code", "email", "surname", "first_name",
    "middle_name", "program", "year_level", "birthdate", "gender"
]

METADATA_COLS = ["category", "status", "assigned_staff_slot", "submitted_at", "is_senior_citizen", "is_magna_carta_poor", "is_underprivileged"]


def build_export_columns(db: Session, semester_id: int) -> List[str]:
    """Build dynamic export columns: identifying + all system_keys + metadata."""
    questions = db.query(models.Question).filter(
        models.Question.semester_id == semester_id,
        models.Question.system_key.isnot(None),
    ).order_by(models.Question.display_order).all()
    system_key_cols = [q.system_key for q in questions]
    existing = set(IDENTIFYING_COLS)
    extra = [sk for sk in system_key_cols if sk not in existing]
    return IDENTIFYING_COLS + extra + METADATA_COLS


def build_csv_header_map(semester_id: int, db: Session) -> Dict[str, int]:
    """Build {csv_column_name: question_id} for ALL system_key questions."""
    questions = db.query(models.Question).filter(
        models.Question.semester_id == semester_id,
        models.Question.system_key.isnot(None),
    ).all()
    return {q.system_key: q.id for q in questions}


def write_cleaned_data(
    db: Session,
    submission: models.Submission,
    csv_row: Dict[str, str],
    header_to_qid: Dict[str, int],
):
    """Write back ALL cleaned values from a CSV row to a submission.
    The imported CSV is the source of truth — it fully replaces existing data.
    "N/A" values from export are treated as empty (no write).
    """
    def clean(val):
        """Strip and treat N/A / n/a as empty."""
        v = (val or "").strip()
        return "" if v.upper() == "N/A" else v

    csv_category = clean(csv_row.get("category", ""))
    if csv_category and submission.user and submission.user.category != csv_category:
        submission.user.category = csv_category

    csv_status = clean(csv_row.get("status", ""))
    if csv_status and submission.status != csv_status:
        submission.status = csv_status

    csv_slot = clean(csv_row.get("assigned_staff_slot", ""))
    if csv_slot:
        try:
            new_slot = int(csv_slot)
            if submission.assigned_staff_slot != new_slot:
                submission.assigned_staff_slot = new_slot
        except ValueError:
            pass
    elif "assigned_staff_slot" in csv_row:
        submission.assigned_staff_slot = None

    # SEG flags
    csv_senior = clean(csv_row.get("is_senior_citizen", "")).lower()
    if csv_senior in ("yes", "true", "1"):
        submission.is_senior_citizen = True
    elif csv_senior in ("no", "false", "0"):
        submission.is_senior_citizen = False

    csv_magna = clean(csv_row.get("is_magna_carta_poor", "")).lower()
    if csv_magna in ("yes", "true", "1"):
        submission.is_magna_carta_poor = True
    elif csv_magna in ("no", "false", "0"):
        submission.is_magna_carta_poor = False

    csv_under = clean(csv_row.get("is_underprivileged", "")).lower()
    if csv_under in ("yes", "true", "1"):
        submission.is_underprivileged = True
    elif csv_under in ("no", "false", "0"):
        submission.is_underprivileged = False

    if not submission.draft_data_json:
        return
    try:
        draft = json.loads(submission.draft_data_json)
    except (json.JSONDecodeError, TypeError):
        return

    changed = False
    for header, qid in header_to_qid.items():
        csv_val = clean(csv_row.get(header, ""))
        if not csv_val:
            continue
        str_qid = str(qid)
        if draft.get(str_qid) != csv_val:
            draft[str_qid] = csv_val
            changed = True
        existing = db.query(models.Answer).filter(
            models.Answer.submission_id == submission.id,
            models.Answer.question_id == qid,
        ).first()
        if existing:
            if existing.answer_text != csv_val:
                existing.answer_text = csv_val
        else:
            ans = models.Answer(
                submission_id=submission.id,
                question_id=qid,
                answer_text=csv_val,
            )
            db.add(ans)

    if changed:
        submission.draft_data_json = json.dumps(draft)


@router.get("/export-csv")
def export_data_csv(
    year_levels: Optional[str] = Query(None, description="Comma-separated year levels to export"),
    category: Optional[str] = Query(None, description="Comma-separated categories to export"),
    current_admin: models.User = Depends(RoleChecker(allowed_roles=["admin"])),
    db: Session = Depends(get_db)
):
    """Export current active-semester submissions as CSV with identifying fields.
    Optionally filter by year_levels and/or category.
    """
    active_sem = db.query(models.Semester).filter(models.Semester.is_active == True).first()
    if not active_sem:
        raise HTTPException(status_code=400, detail="No active semester configured.")

    system_key_map = get_system_key_map(db, active_sem.id)
    export_cols = build_export_columns(db, active_sem.id)

    yl_filter = parse_year_levels_param(year_levels)
    cat_filter = parse_year_levels_param(category)  # reuse same parser for comma-separated list

    subs = db.query(models.Submission).options(
        joinedload(models.Submission.user),
        selectinload(models.Submission.answers).joinedload(models.Answer.question)
    ).filter(
        models.Submission.semester_id == active_sem.id,
        models.Submission.is_final == True,
        models.Submission.is_archived == False,
    ).order_by(models.Submission.submitted_at.desc().nullslast()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(export_cols)

    for sub in subs:
        student = sub.user
        if not student:
            continue
        # Filter by year level if specified
        if yl_filter:
            yl = get_answer_from_submission(sub, system_key_map, "year_level") or ""
            if yl not in yl_filter:
                continue
        # Filter by category if specified
        if cat_filter:
            cat = (student.category or "").strip()
            if cat not in cat_filter:
                continue
        row = []
        for col in export_cols:
            if col == "verification_code":
                row.append(sub.verification_code or "N/A")
            elif col == "email":
                row.append(student.email or "N/A")
            elif col == "category":
                row.append(student.category or "N/A")
            elif col == "status":
                row.append(sub.status or "N/A")
            elif col == "assigned_staff_slot":
                row.append(str(sub.assigned_staff_slot) if sub.assigned_staff_slot else "N/A")
            elif col == "submitted_at":
                row.append(sub.submitted_at.strftime("%Y-%m-%d %H:%M:%S") if sub.submitted_at else "N/A")
            elif col == "is_senior_citizen":
                row.append("Yes" if sub.is_senior_citizen else "No")
            elif col == "is_magna_carta_poor":
                row.append("Yes" if sub.is_magna_carta_poor else "No")
            elif col == "is_underprivileged":
                row.append("Yes" if sub.is_underprivileged else "No")
            else:
                row.append(get_answer_from_submission(sub, system_key_map, col) or "N/A")
        writer.writerow(row)

    output.seek(0)

    filter_parts = []
    if yl_filter:
        filter_parts.append(f"year_levels={','.join(yl_filter)}")
    if cat_filter:
        filter_parts.append(f"category={','.join(cat_filter)}")
    filter_str = f" [{', '.join(filter_parts)}]" if filter_parts else ""

    log = models.AdminLog(
        admin_id=current_admin.id,
        action="export_csv",
        details=f"Exported {len(subs)} submissions as CSV for semester '{active_sem.label}'{filter_str}",
        timestamp=datetime.now(timezone.utc)
    )
    db.add(log)
    db.commit()

    filename = f"OSWD_SPS_Export_{active_sem.label.replace(' ', '_')}_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/import/preview")
def preview_import(
    file: UploadFile = File(...),
    year_levels: Optional[str] = Query(None, description="Comma-separated year levels to target, e.g. '1st Year,2nd Year'"),
    current_admin: models.User = Depends(RoleChecker(allowed_roles=["admin"])),
    db: Session = Depends(get_db)
):
    """Preview an import CSV: match rows and return stats without making changes.
    If year_levels is provided, only submissions for those year levels are targeted.
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    active_sem = db.query(models.Semester).filter(models.Semester.is_active == True).first()
    if not active_sem:
        raise HTTPException(status_code=400, detail="No active semester configured.")

    content = file.file.read().decode("utf-8-sig")
    headers, csv_rows = parse_csv_file(content)

    missing = [c for c in REQUIRED_CSV_COLS if c not in headers]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns: {', '.join(missing)}"
        )

    yl_filter = parse_year_levels_param(year_levels)
    system_key_map = get_system_key_map(db, active_sem.id)
    lookup = build_submission_lookup(db, active_sem.id, system_key_map, year_levels=yl_filter)

    not_found_examples = []
    matched_ids = set()
    not_found_count = 0

    for row in csv_rows:
        matched = match_csv_row(row, lookup)
        if matched:
            matched_ids.add(matched.id)
        else:
            not_found_count += 1
            if len(not_found_examples) < 5:
                example = row.get("email", "") or f"{row.get('surname', '')}, {row.get('first_name', '')}"
                not_found_examples.append(example)

    total_active = len(lookup)
    unique_kept = len(matched_ids)
    will_archive = max(0, total_active - unique_kept)

    return schemas.ImportPreview(
        total_csv_rows=len(csv_rows),
        will_keep=unique_kept,
        will_archive=will_archive,
        not_found=not_found_count,
        sample_not_found=not_found_examples,
        year_levels_targeted=yl_filter or [],
    )


@router.post("/import/execute", response_model=schemas.ImportResult)
def execute_import(
    file: UploadFile = File(...),
    year_levels: Optional[str] = Query(None, description="Comma-separated year levels to target"),
    current_admin: models.User = Depends(RoleChecker(allowed_roles=["admin"])),
    db: Session = Depends(get_db)
):
    """Execute an import: archive targeted submissions, then unarchive those in the CSV.
    If year_levels is provided, only submissions for those year levels are archived/replaced.
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    active_sem = db.query(models.Semester).filter(models.Semester.is_active == True).first()
    if not active_sem:
        raise HTTPException(status_code=400, detail="No active semester configured.")

    content = file.file.read().decode("utf-8-sig")
    headers, csv_rows = parse_csv_file(content)

    missing = [c for c in REQUIRED_CSV_COLS if c not in headers]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns: {', '.join(missing)}"
        )

    yl_filter = parse_year_levels_param(year_levels)
    system_key_map = get_system_key_map(db, active_sem.id)
    header_to_qid = build_csv_header_map(active_sem.id, db)
    lookup = build_submission_lookup(db, active_sem.id, system_key_map, year_levels=yl_filter)

    matched_ids = set()
    not_found_count = 0

    for row in csv_rows:
        sub = match_csv_row(row, lookup)
        if sub:
            matched_ids.add(sub.id)
            write_cleaned_data(db, sub, row, header_to_qid)
        else:
            not_found_count += 1

    db.flush()

    # Get the IDs of submissions targeted for archiving (filtered by year level)
    targeted_subs = get_targeted_submissions(db, active_sem.id, system_key_map, yl_filter)
    targeted_ids = {sub.id for sub in targeted_subs}

    # Archive only targeted submissions
    total_archived = 0
    if targeted_ids:
        total_archived = db.query(models.Submission).filter(
            models.Submission.id.in_(list(targeted_ids)),
        ).update({"is_archived": True}, synchronize_session="fetch")

    # Unarchive only the matched ones
    matched_id_list = list(matched_ids)
    if matched_id_list:
        db.query(models.Submission).filter(
            models.Submission.id.in_(matched_id_list),
        ).update({"is_archived": False}, synchronize_session="fetch")

    unique_kept = len(matched_id_list)
    import_log = models.ImportLog(
        semester_id=active_sem.id,
        filename=file.filename or "unknown.csv",
        total_rows=len(csv_rows),
        kept=unique_kept,
        archived=max(0, total_archived - unique_kept),
        not_found=not_found_count,
        imported_by=current_admin.id,
    )
    db.add(import_log)
    db.commit()
    db.refresh(import_log)

    yl_label = ", ".join(yl_filter) if yl_filter else "all year levels"
    log = models.AdminLog(
        admin_id=current_admin.id,
        action="import_csv",
        details=f"Imported CSV '{file.filename}' ({yl_label}): {unique_kept} kept, {max(0, total_archived - unique_kept)} archived, {not_found_count} not found",
        timestamp=datetime.now(timezone.utc)
    )
    db.add(log)
    db.commit()

    return schemas.ImportResult(
        import_id=import_log.id,
        total_csv_rows=import_log.total_rows,
        kept=import_log.kept,
        archived=import_log.archived,
        not_found=import_log.not_found,
        imported_at=import_log.imported_at,
        year_levels_targeted=yl_filter or [],
    )


@router.get("/import/archived")
def list_archived_submissions(
    year_levels: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    current_admin: models.User = Depends(RoleChecker(allowed_roles=["admin"])),
    db: Session = Depends(get_db)
):
    """List archived submissions for the active semester, optionally filtered by year level."""
    active_sem = db.query(models.Semester).filter(models.Semester.is_active == True).first()
    if not active_sem:
        raise HTTPException(status_code=400, detail="No active semester configured.")

    system_key_map = get_system_key_map(db, active_sem.id)
    yl_filter = parse_year_levels_param(year_levels)

    subs = db.query(models.Submission).options(
        joinedload(models.Submission.user),
        selectinload(models.Submission.answers).joinedload(models.Answer.question)
    ).filter(
        models.Submission.semester_id == active_sem.id,
        models.Submission.is_final == True,
        models.Submission.is_archived == True,
    ).all()

    # Filter by year level if requested
    items = []
    for sub in subs:
        student = sub.user
        if not student:
            continue
        year_level = get_answer_from_submission(sub, system_key_map, "year_level") or ""
        if yl_filter and year_level not in yl_filter:
            continue
        items.append(schemas.ArchivedSubmissionItem(
            id=sub.id,
            user_id=sub.user_id,
            student_name=student.first_name or student.email.split("@")[0] if student.email else "Student",
            student_email=student.email or "",
            student_category=student.category,
            year_level=year_level,
            status=sub.status or "pending",
            verification_code=sub.verification_code or "",
            submitted_at=sub.submitted_at,
        ))

    total = len(items)
    start = (page - 1) * page_size
    paginated = items[start:start + page_size]

    return {
        "items": paginated,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/import/history", response_model=List[schemas.ImportLogItem])
def get_import_history(
    current_admin: models.User = Depends(RoleChecker(allowed_roles=["admin"])),
    db: Session = Depends(get_db)
):
    """List all past data imports."""
    logs = db.query(models.ImportLog).order_by(models.ImportLog.imported_at.desc()).limit(50).all()
    result = []
    for log in logs:
        sem = db.query(models.Semester).filter(models.Semester.id == log.semester_id).first()
        importer = db.query(models.User).filter(models.User.id == log.imported_by).first()
        result.append(schemas.ImportLogItem(
            id=log.id,
            semester_label=sem.label if sem else "Unknown",
            filename=log.filename,
            total_rows=log.total_rows,
            kept=log.kept,
            archived=log.archived,
            not_found=log.not_found,
            imported_at=log.imported_at,
            imported_by_name=importer.first_name if importer else None,
        ))
    return result


@router.get("/import/history/{import_id}", response_model=schemas.ImportLogItem)
def get_import_detail(
    import_id: int,
    current_admin: models.User = Depends(RoleChecker(allowed_roles=["admin"])),
    db: Session = Depends(get_db)
):
    """Get details of a specific import."""
    log = db.query(models.ImportLog).filter(models.ImportLog.id == import_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Import log not found.")
    sem = db.query(models.Semester).filter(models.Semester.id == log.semester_id).first()
    importer = db.query(models.User).filter(models.User.id == log.imported_by).first()
    return schemas.ImportLogItem(
        id=log.id,
        semester_label=sem.label if sem else "Unknown",
        filename=log.filename,
        total_rows=log.total_rows,
        kept=log.kept,
        archived=log.archived,
        not_found=log.not_found,
        imported_at=log.imported_at,
        imported_by_name=importer.first_name if importer else None,
    )
