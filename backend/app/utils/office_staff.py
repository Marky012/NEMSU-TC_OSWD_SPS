from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app import models

def distribute_unassigned_submissions(db: Session):
    """Assign unassigned submissions to active staff slots using modulo."""
    active_slots = db.query(models.OfficeStaffSlot).filter(
        models.OfficeStaffSlot.is_active == True
    ).order_by(models.OfficeStaffSlot.slot_number).all()

    if not active_slots:
        return

    slot_order = [s.slot_number for s in active_slots]
    unassigned = db.query(models.Submission).filter(
        models.Submission.assigned_staff_slot == None
    ).all()

    for i, sub in enumerate(unassigned):
        sub.assigned_staff_slot = slot_order[i % len(slot_order)]

    db.commit()
