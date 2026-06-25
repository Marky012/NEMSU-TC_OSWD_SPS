import json
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.dependencies import RoleChecker, get_current_user

router = APIRouter(prefix="/api/admin", tags=["Admin Module"])

# Helper function to write audit logs
def log_admin_action(db: Session, admin_id: int, action: str, details: str):
    log = models.AdminLog(
        admin_id=admin_id,
        action=action,
        details=details,
        timestamp=datetime.now(timezone.utc)
    )
    db.add(log)
    db.commit()

# --- BULK VERIFICATION ---
@router.post("/verify-bulk", status_code=status.HTTP_200_OK)
def verify_students_bulk(
    user_ids: List[int],
    current_admin: models.User = Depends(RoleChecker(allowed_roles=["admin", "verification_officer"])),
    db: Session = Depends(get_db)
):
    """Marks multiple students as verified for enrollment and updates submission status."""
    students = db.query(models.User).filter(
        models.User.id.in_(user_ids),
        models.User.role == "student"
    ).all()
    
    if not students:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No student accounts found matching the provided IDs."
        )
        
    for student in students:
        student.is_verified_for_enrollment = True
        student.verified_by = current_admin.email
        student.verified_at = datetime.now(timezone.utc)
        # Also mark all finalized, non-declined submissions as verified
        db.query(models.Submission).filter(
            models.Submission.user_id == student.id,
            models.Submission.is_final == True,
            models.Submission.status != "declined",
        ).update({"status": "verified"})
        
    db.commit()
    
    log_admin_action(
        db, 
        current_admin.id, 
        "bulk_verification", 
        f"Verified student accounts: {', '.join([s.email for s in students])}"
    )
    
    return {
        "message": f"Successfully verified {len(students)} students for enrollment.",
        "verified_emails": [s.email for s in students]
    }

# --- PWD ASSISTANCE TASK TRACKING ---
@router.get("/pwd-tasks", response_model=List[schemas.PWDTaskResponse])
def get_pwd_assistance_tasks(
    status_filter: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_admin: models.User = Depends(RoleChecker(allowed_roles=["admin", "verification_officer", "analytics_viewer"])),
    db: Session = Depends(get_db)
):
    """Retrieves all pending or ongoing PWD card follow-up tasks."""
    query = db.query(models.PWDAssistanceTask)
    if status_filter:
        query = query.filter(models.PWDAssistanceTask.status == status_filter)
        
    tasks = query.order_by(models.PWDAssistanceTask.created_at.desc()).offset(skip).limit(limit).all()
    
    # Map to schema manually to load student email
    response_tasks = []
    for t in tasks:
        student = db.query(models.User).filter(models.User.id == t.student_id).first()
        response_tasks.append(
            schemas.PWDTaskResponse(
                id=t.id,
                student_id=t.student_id,
                student_email=student.email if student else "Unknown",
                created_at=t.created_at,
                status=t.status,
                notes=t.notes
            )
        )
    return response_tasks

@router.put("/pwd-tasks/{id}", response_model=schemas.PWDTaskResponse)
def update_pwd_assistance_task(
    id: int,
    task_data: schemas.PWDTaskUpdate,
    current_admin: models.User = Depends(RoleChecker(allowed_roles=["admin", "verification_officer"])),
    db: Session = Depends(get_db)
):
    """Updates the status and notes of a PWD card follow-up task."""
    task = db.query(models.PWDAssistanceTask).filter(models.PWDAssistanceTask.id == id).first()
    if not task:
        raise HTTPException(status_code=404, detail="PWD task not found.")
        
    if task_data.status:
        task.status = task_data.status
    if task_data.notes is not None:
        task.notes = task_data.notes
        
    db.commit()
    db.refresh(task)
    
    student = db.query(models.User).filter(models.User.id == task.student_id).first()
    student_email = student.email if student else "Unknown"
    
    log_admin_action(
        db,
        current_admin.id,
        "update_pwd_task",
        f"Updated PWD Task ID {id} for student {student_email} to status '{task.status}'"
    )
    
    return schemas.PWDTaskResponse(
        id=task.id,
        student_id=task.student_id,
        student_email=student_email,
        created_at=task.created_at,
        status=task.status,
        notes=task.notes
    )

# --- SEMESTER MANAGEMENT ---
@router.get("/semesters", response_model=List[schemas.SemesterResponse])
def get_semesters(
    skip: int = 0,
    limit: int = 100,
    current_admin: models.User = Depends(RoleChecker(allowed_roles=["admin", "verification_officer", "analytics_viewer"])),
    db: Session = Depends(get_db)
):
    """Retrieves all academic semesters in the system."""
    return db.query(models.Semester).order_by(models.Semester.opens_at.desc()).offset(skip).limit(limit).all()

@router.post("/semesters", response_model=schemas.SemesterResponse, status_code=status.HTTP_201_CREATED)
def create_semester(
    sem_data: schemas.SemesterCreate,
    clone_questions: bool = False,
    current_admin: models.User = Depends(RoleChecker(allowed_roles=["admin"])),
    db: Session = Depends(get_db)
):
    """Creates a new semester and optionally clones active questions from the previous active semester."""
    # Check duplicate
    exists = db.query(models.Semester).filter(models.Semester.label == sem_data.label).first()
    if exists:
        raise HTTPException(status_code=400, detail="A semester with this label already exists.")
        
    new_sem = models.Semester(
        label=sem_data.label,
        is_active=False,  # Defaults to inactive; must be explicitly activated
        opens_at=sem_data.opens_at,
        closes_at=sem_data.closes_at
    )
    db.add(new_sem)
    db.flush()  # Gets the new semester ID
    
    cloned_count = 0
    if clone_questions:
        # Find the most recently active or created semester prior to this one
        prev_sem = db.query(models.Semester).filter(
            models.Semester.id != new_sem.id
        ).order_by(models.Semester.is_active.desc(), models.Semester.closes_at.desc()).first()
        
        if prev_sem:
            # Get all questions from the previous semester
            prev_questions = db.query(models.Question).filter(
                models.Question.semester_id == prev_sem.id
            ).all()
            
            # Map old_question_id -> new_cloned_question_id for conditional parenting repair
            old_to_new_map = {}
            cloned_questions = []
            
            # 1st Pass: Clone questions without setting conditional parent columns
            for old_q in prev_questions:
                cloned_q = models.Question(
                    category_id=old_q.category_id,
                    semester_id=new_sem.id,
                    system_key=old_q.system_key,
                    question_text=old_q.question_text,
                    field_type=old_q.field_type,
                    options_json=old_q.options_json,
                    conditional_parent_question_id=None,
                    conditional_value=None,
                    required=old_q.required,
                    active=old_q.active,
                    applicable_categories_json=old_q.applicable_categories_json,
                    display_order=old_q.display_order
                )
                db.add(cloned_q)
                db.flush()
                
                old_to_new_map[old_q.id] = cloned_q.id
                cloned_questions.append((old_q, cloned_q))
                cloned_count += 1
                
            # 2nd Pass: Repair parent-child conditional logic mapping
            for old_q, cloned_q in cloned_questions:
                if old_q.conditional_parent_question_id:
                    new_parent_id = old_to_new_map.get(old_q.conditional_parent_question_id)
                    if new_parent_id:
                        cloned_q.conditional_parent_question_id = new_parent_id
                        cloned_q.conditional_value = old_q.conditional_value
                        
            db.flush()

    db.commit()
    db.refresh(new_sem)
    
    details_str = f"Created semester '{new_sem.label}'"
    if clone_questions and cloned_count > 0:
        details_str += f" and cloned {cloned_count} questions."
        
    log_admin_action(db, current_admin.id, "create_semester", details_str)
    
    return new_sem

@router.post("/semesters/{id}/activate", response_model=schemas.SemesterResponse)
def activate_semester(
    id: int,
    current_admin: models.User = Depends(RoleChecker(allowed_roles=["admin"])),
    db: Session = Depends(get_db)
):
    """Activates a specific semester and deactivates all others (ensures only 1 semester is active)."""
    target_sem = db.query(models.Semester).filter(models.Semester.id == id).first()
    if not target_sem:
        raise HTTPException(status_code=404, detail="Semester not found.")
        
    # Deactivate all semesters
    db.query(models.Semester).update({"is_active": False})
    
    # Activate target semester
    target_sem.is_active = True
    db.commit()
    db.refresh(target_sem)
    
    log_admin_action(db, current_admin.id, "activate_semester", f"Activated semester: '{target_sem.label}'")
    
    return target_sem

# --- AUDIT LOGS ---
# --- LIST ALL SUBMISSIONS (for admin StudentList) ---
@router.get("/submissions", response_model=List[schemas.AdminSubmissionItem])
def list_all_submissions(
    skip: int = 0,
    limit: int = 100,
    current_admin: models.User = Depends(RoleChecker(allowed_roles=["admin", "verification_officer", "analytics_viewer"])),
    db: Session = Depends(get_db)
):
    """Returns all finalized submissions with student info for admin review."""
    subs = (
        db.query(models.Submission)
        .filter(models.Submission.is_final == True)
        .order_by(models.Submission.submitted_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    result = []
    for sub in subs:
        student = db.query(models.User).filter(models.User.id == sub.user_id).first()
        result.append(schemas.AdminSubmissionItem(
            id=sub.id,
            user_id=sub.user_id,
            semester_id=sub.semester_id,
            is_final=sub.is_final,
            is_archived=sub.is_archived,
            status=sub.status,
            admin_comment=sub.admin_comment,
            is_senior_citizen=sub.is_senior_citizen,
            is_magna_carta_poor=sub.is_magna_carta_poor,
            is_underprivileged=sub.is_underprivileged,
            is_verified=student.is_verified_for_enrollment if student else False,
            verified_by=student.verified_by if student else None,
            verified_at=student.verified_at if student else None,
            verification_code=sub.verification_code,
            student_category=student.category if student else None,
            student_email=student.email if student else None,
            submitted_at=sub.submitted_at,
            draft_data_json=sub.draft_data_json,
            created_date=sub.submitted_at,
        ))
    return result

# --- UPDATE SEMESTER ---
@router.put("/semesters/{id}", response_model=schemas.SemesterResponse)
def update_semester(
    id: int,
    sem_data: schemas.SemesterUpdate,
    current_admin: models.User = Depends(RoleChecker(allowed_roles=["admin"])),
    db: Session = Depends(get_db)
):
    """Updates semester details."""
    sem = db.query(models.Semester).filter(models.Semester.id == id).first()
    if not sem:
        raise HTTPException(status_code=404, detail="Semester not found.")
    if sem_data.label is not None:
        sem.label = sem_data.label
    if sem_data.opens_at is not None:
        sem.opens_at = sem_data.opens_at
    if sem_data.closes_at is not None:
        sem.closes_at = sem_data.closes_at
    if sem_data.is_active is not None:
        sem.is_active = sem_data.is_active
    db.commit()
    db.refresh(sem)
    log_admin_action(db, current_admin.id, "update_semester", f"Updated semester: '{sem.label}'")
    return sem

# --- ARCHIVE SEMESTER ---
@router.post("/semesters/{id}/archive", response_model=schemas.SemesterResponse)
def archive_semester(
    id: int,
    current_admin: models.User = Depends(RoleChecker(allowed_roles=["admin"])),
    db: Session = Depends(get_db)
):
    """Archives a semester: marks it and all its finalized submissions as archived, and deactivates it."""
    target_sem = db.query(models.Semester).filter(models.Semester.id == id).first()
    if not target_sem:
        raise HTTPException(status_code=404, detail="Semester not found.")
    if target_sem.is_archived:
        raise HTTPException(status_code=400, detail="Semester is already archived.")

    # Mark all finalized submissions under this semester as archived
    db.query(models.Submission).filter(
        models.Submission.semester_id == target_sem.id,
        models.Submission.is_final == True,
    ).update({"is_archived": True})

    # Deactivate and archive the semester
    target_sem.is_active = False
    target_sem.is_archived = True
    db.commit()
    db.refresh(target_sem)

    log_admin_action(
        db, current_admin.id, "archive_semester",
        f"Archived semester: '{target_sem.label}' with all its finalized submissions."
    )

    return target_sem

# --- UPDATE SUBMISSION SEG VALUES ---
@router.patch("/submissions/{id}/seg", response_model=schemas.AdminSubmissionItem)
def update_submission_seg(
    id: int,
    seg_data: schemas.SubmissionSEGUpdate,
    current_admin: models.User = Depends(RoleChecker(allowed_roles=["admin"])),
    db: Session = Depends(get_db)
):
    """Updates admin-only SEG flags (Senior Citizen, Magna Carta Poor, Underprivileged) for a submission."""
    sub = db.query(models.Submission).filter(models.Submission.id == id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found.")
    
    if seg_data.is_senior_citizen is not None:
        sub.is_senior_citizen = seg_data.is_senior_citizen
    if seg_data.is_magna_carta_poor is not None:
        sub.is_magna_carta_poor = seg_data.is_magna_carta_poor
    if seg_data.is_underprivileged is not None:
        sub.is_underprivileged = seg_data.is_underprivileged
    
    db.commit()
    db.refresh(sub)
    
    student = db.query(models.User).filter(models.User.id == sub.user_id).first()
    
    log_admin_action(
        db, current_admin.id, "update_submission_seg",
        f"Updated SEG flags for submission #{sub.id} (senior={sub.is_senior_citizen}, magna={sub.is_magna_carta_poor}, underpriv={sub.is_underprivileged})"
    )
    
    return schemas.AdminSubmissionItem(
        id=sub.id,
        user_id=sub.user_id,
        semester_id=sub.semester_id,
        is_final=sub.is_final,
        is_archived=sub.is_archived,
        is_senior_citizen=sub.is_senior_citizen,
        is_magna_carta_poor=sub.is_magna_carta_poor,
        is_underprivileged=sub.is_underprivileged,
        is_verified=student.is_verified_for_enrollment if student else False,
        verified_by=student.verified_by if student else None,
        verified_at=student.verified_at if student else None,
        verification_code=sub.verification_code,
        student_category=student.category if student else None,
        student_email=student.email if student else None,
        submitted_at=sub.submitted_at,
        draft_data_json=sub.draft_data_json,
        created_date=sub.submitted_at,
    )


# --- SUBMISSION REVIEW (Return / Decline / Single Verify) ---
@router.post("/submissions/{id}/review", response_model=schemas.AdminSubmissionItem)
def review_submission(
    id: int,
    review_data: schemas.SubmissionReview,
    current_admin: models.User = Depends(RoleChecker(allowed_roles=["admin", "verification_officer"])),
    db: Session = Depends(get_db),
):
    """Review a submission: verify, return (with comment), or decline (with comment)."""
    sub = db.query(models.Submission).filter(models.Submission.id == id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found.")

    if review_data.status not in ("verified", "returned", "declined"):
        raise HTTPException(status_code=400, detail="Invalid status. Use: verified, returned, or declined.")

    # Prevent re-review of terminal states
    if sub.status == "verified":
        raise HTTPException(status_code=400, detail="Submission is already verified.")
    if sub.status == "declined":
        raise HTTPException(status_code=400, detail="Submission is already declined and cannot be changed.")

    # Require admin_comment for return/decline
    if review_data.status in ("returned", "declined") and not review_data.admin_comment:
        raise HTTPException(status_code=400, detail="Admin comment is required when returning or declining a submission.")

    sub.status = review_data.status
    if review_data.admin_comment is not None:
        sub.admin_comment = review_data.admin_comment

    # If verifying, also mark the user-level flag
    if review_data.status == "verified":
        user = db.query(models.User).filter(models.User.id == sub.user_id).first()
        if user:
            user.is_verified_for_enrollment = True
            user.verified_by = current_admin.email
            user.verified_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(sub)

    student = db.query(models.User).filter(models.User.id == sub.user_id).first()

    log_admin_action(
        db, current_admin.id, f"submission_{review_data.status}",
        f"Submission #{sub.id} ({student.email if student else '?'}) set to '{review_data.status}'. Comment: {review_data.admin_comment or 'N/A'}"
    )

    return schemas.AdminSubmissionItem(
        id=sub.id,
        user_id=sub.user_id,
        semester_id=sub.semester_id,
        is_final=sub.is_final,
        is_archived=sub.is_archived,
        status=sub.status,
        admin_comment=sub.admin_comment,
        is_senior_citizen=sub.is_senior_citizen,
        is_magna_carta_poor=sub.is_magna_carta_poor,
        is_underprivileged=sub.is_underprivileged,
        is_verified=student.is_verified_for_enrollment if student else False,
        verified_by=student.verified_by if student else None,
        verified_at=student.verified_at if student else None,
        verification_code=sub.verification_code,
        student_category=student.category if student else None,
        student_email=student.email if student else None,
        submitted_at=sub.submitted_at,
        draft_data_json=sub.draft_data_json,
        created_date=sub.submitted_at,
    )


# --- AUDIT LOGS ---
@router.get("/logs", response_model=List[schemas.AdminLogResponse])
def get_admin_logs(
    skip: int = 0,
    limit: int = 100,
    current_admin: models.User = Depends(RoleChecker(allowed_roles=["admin"])),
    db: Session = Depends(get_db)
):
    """Retrieves all administrative system action logs."""
    logs = db.query(models.AdminLog).order_by(models.AdminLog.timestamp.desc()).offset(skip).limit(limit).all()
    
    response_logs = []
    for l in logs:
        admin_user = db.query(models.User).filter(models.User.id == l.admin_id).first()
        response_logs.append(
            schemas.AdminLogResponse(
                id=l.id,
                admin_id=l.admin_id,
                admin_email=admin_user.email if admin_user else "System/Unknown",
                action=l.action,
                details=l.details,
                timestamp=l.timestamp
            )
        )
    return response_logs
