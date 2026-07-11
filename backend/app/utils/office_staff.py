from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app import models

def distribute_unassigned_submissions(db: Session):
    """Assign unassigned submissions from the active semester to active staff slots."""
    active_slots = db.query(models.OfficeStaffSlot).filter(
        models.OfficeStaffSlot.is_active == True
    ).order_by(models.OfficeStaffSlot.slot_number).all()

    if not active_slots:
        return

    active_sem = db.query(models.Semester).filter(models.Semester.is_active == True).first()
    if not active_sem:
        return

    slot_order = [s.slot_number for s in active_slots]
    unassigned = db.query(models.Submission).filter(
        models.Submission.assigned_staff_slot == None,
        models.Submission.semester_id == active_sem.id,
        models.Submission.is_final == True,
    ).all()

    for i, sub in enumerate(unassigned):
        sub.assigned_staff_slot = slot_order[i % len(slot_order)]

    db.commit()


def redistribute_pending_submissions(db: Session):
    """Redistribute all pending (unreviewed) submissions across all active staff slots.
    This ensures fair workload distribution when a new staff member becomes active
    after other staff have already been active for some time."""
    active_slots = db.query(models.OfficeStaffSlot).filter(
        models.OfficeStaffSlot.is_active == True
    ).order_by(models.OfficeStaffSlot.slot_number).all()

    if not active_slots:
        return

    active_sem = db.query(models.Semester).filter(models.Semester.is_active == True).first()
    if not active_sem:
        return

    slot_order = [s.slot_number for s in active_slots]
    pending = db.query(models.Submission).filter(
        models.Submission.status == "pending",
        models.Submission.semester_id == active_sem.id,
        models.Submission.is_final == True,
    ).order_by(models.Submission.assigned_staff_slot, models.Submission.id).all()

    if not pending:
        return

    for i, sub in enumerate(pending):
        sub.assigned_staff_slot = slot_order[i % len(slot_order)]

    db.commit()
