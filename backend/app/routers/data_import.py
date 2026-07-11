import io
import csv
import json
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Tuple
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
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
    # Check answers table (for finalized submissions)
    for ans in submission.answers:
        if ans.question_id == qid:
            return ans.answer_text
    # Fall back to draft_data_json
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
    system_key_map: Dict[str, int]
) -> List[Dict[str, Any]]:
    """Build a list of active submissions with their identifying fields for matching."""
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
        lookup.append({
            "submission": sub,
            "email": (student.email or "").strip().lower(),
            "verification_code": (sub.verification_code or "").strip(),
            "surname": (get_answer_from_submission(sub, system_key_map, "surname") or "").strip().upper(),
            "first_name": (get_answer_from_submission(sub, system_key_map, "first_name") or "").strip().upper(),
            "program": (get_answer_from_submission(sub, system_key_map, "program") or "").strip().upper(),
            "birthdate": (get_answer_from_submission(sub, system_key_map, "birthdate") or "").strip(),
        })
    return lookup


def match_csv_row(
    row: Dict[str, str],
    lookup: List[Dict[str, Any]]
) -> Optional[models.Submission]:
    """Match a CSV row to an existing submission using multi-field strategy.
    Priority:
      1. verification_code (exact)
      2. email (exact, case-insensitive)
      3. surname + first_name + program + birthdate (all 4 must match)
    """
    csv_vc = (row.get("verification_code", "") or "").strip()
    csv_email = (row.get("email", "") or "").strip().lower()
    csv_surname = (row.get("surname", "") or "").strip().upper()
    csv_first_name = (row.get("first_name", "") or "").strip().upper()
    csv_program = (row.get("program", "") or "").strip().upper()
    csv_birthdate = (row.get("birthdate", "") or "").strip()

    # 1. Match by verification_code
    if csv_vc:
        for entry in lookup:
            if entry["verification_code"] == csv_vc:
                return entry["submission"]

    # 2. Match by email
    if csv_email:
        for entry in lookup:
            if entry["email"] == csv_email:
                return entry["submission"]

    # 3. Match by composite (surname + first_name + program + birthdate)
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


REQUIRED_CSV_COLS = [
    "verification_code", "email", "surname", "first_name",
    "program", "birthdate"
]

IDENTIFYING_COLS = [
    "verification_code", "email", "surname", "first_name",
    "middle_name", "program", "year_level", "birthdate", "gender"
]

METADATA_COLS = ["category", "status", "assigned_staff_slot", "submitted_at"]


def build_export_columns(db: Session, semester_id: int) -> List[str]:
    """Build dynamic export columns: identifying + all system_keys + metadata."""
    questions = db.query(models.Question).filter(
        models.Question.semester_id == semester_id,
        models.Question.system_key.isnot(None),
    ).order_by(models.Question.display_order).all()
    system_key_cols = [q.system_key for q in questions]
    # Remove any system key already in IDENTIFYING_COLS to avoid duplicates
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
    """Write back cleaned values from a CSV row to a submission's data.
    Updates both draft_data_json and answers table.
    Only non-empty CSV values are written — empty cells preserve existing data.
    """
    if not submission.draft_data_json:
        return
    try:
        draft = json.loads(submission.draft_data_json)
    except (json.JSONDecodeError, TypeError):
        return

    changed = False
    for header, qid in header_to_qid.items():
        csv_val = csv_row.get(header, "").strip()
        if not csv_val:
            continue
        str_qid = str(qid)
        if draft.get(str_qid) != csv_val:
            draft[str_qid] = csv_val
            changed = True
        # Upsert the answer record so reports/charts see the cleaned value
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
    current_admin: models.User = Depends(RoleChecker(allowed_roles=["admin"])),
    db: Session = Depends(get_db)
):
    """Export current active-semester submissions as CSV with identifying fields."""
    active_sem = db.query(models.Semester).filter(models.Semester.is_active == True).first()
    if not active_sem:
        raise HTTPException(status_code=400, detail="No active semester configured.")

    system_key_map = get_system_key_map(db, active_sem.id)
    export_cols = build_export_columns(db, active_sem.id)

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
        row = []
        for col in export_cols:
            if col == "verification_code":
                row.append(sub.verification_code or "")
            elif col == "email":
                row.append(student.email or "")
            elif col == "category":
                row.append(student.category or "")
            elif col == "status":
                row.append(sub.status or "")
            elif col == "assigned_staff_slot":
                row.append(str(sub.assigned_staff_slot) if sub.assigned_staff_slot else "")
            elif col == "submitted_at":
                row.append(sub.submitted_at.strftime("%Y-%m-%d %H:%M:%S") if sub.submitted_at else "")
            else:
                # Everything else is a system_key — extract from submission
                row.append(get_answer_from_submission(sub, system_key_map, col) or "")
        writer.writerow(row)

    output.seek(0)

    log = models.AdminLog(
        admin_id=current_admin.id,
        action="export_csv",
        details=f"Exported {len(subs)} submissions as CSV for semester '{active_sem.label}'",
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
    current_admin: models.User = Depends(RoleChecker(allowed_roles=["admin"])),
    db: Session = Depends(get_db)
):
    """Preview an import CSV: match rows and return stats without making changes."""
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

    system_key_map = get_system_key_map(db, active_sem.id)
    lookup = build_submission_lookup(db, active_sem.id, system_key_map)

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
    )


@router.post("/import/execute", response_model=schemas.ImportResult)
def execute_import(
    file: UploadFile = File(...),
    current_admin: models.User = Depends(RoleChecker(allowed_roles=["admin"])),
    db: Session = Depends(get_db)
):
    """Execute an import: archive all current submissions, then unarchive those in the CSV."""
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

    system_key_map = get_system_key_map(db, active_sem.id)
    header_to_qid = build_csv_header_map(active_sem.id, db)
    lookup = build_submission_lookup(db, active_sem.id, system_key_map)

    matched_ids = set()
    not_found_count = 0

    for row in csv_rows:
        sub = match_csv_row(row, lookup)
        if sub:
            matched_ids.add(sub.id)
            # Write back cleaned data from CSV into this submission
            write_cleaned_data(db, sub, row, header_to_qid)
        else:
            not_found_count += 1

    # Flush data updates before archiving
    db.flush()

    # Archive ALL current active submissions
    total_archived = db.query(models.Submission).filter(
        models.Submission.semester_id == active_sem.id,
        models.Submission.is_final == True,
        models.Submission.is_archived == False,
    ).update({"is_archived": True}, synchronize_session="fetch")

    # Unarchive only the matched ones
    matched_id_list = list(matched_ids)
    if matched_id_list:
        db.query(models.Submission).filter(
            models.Submission.id.in_(matched_id_list),
        ).update({"is_archived": False}, synchronize_session="fetch")

    # Create import log
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

    log = models.AdminLog(
        admin_id=current_admin.id,
        action="import_csv",
        details=f"Imported CSV '{file.filename}': {unique_kept} kept, {max(0, total_archived - unique_kept)} archived, {not_found_count} not found",
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
    )


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
