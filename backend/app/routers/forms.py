import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.dependencies import get_current_user, RoleChecker

router = APIRouter(prefix="/api/forms", tags=["Dynamic Forms"])

@router.get("/semesters", response_model=List[schemas.SemesterResponse])
def list_semesters(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns all semesters (authenticated users)."""
    return db.query(models.Semester).order_by(models.Semester.opens_at.desc()).all()

@router.get("/semesters/active", response_model=Optional[schemas.SemesterResponse])
def get_active_semester(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns the currently active semester."""
    return db.query(models.Semester).filter(models.Semester.is_active == True).first()

@router.get("/categories", response_model=List[schemas.QuestionCategoryResponse])
def get_categories(db: Session = Depends(get_db)):
    """Retrieves all question categories ordered by display order."""
    return db.query(models.QuestionCategory).order_by(models.QuestionCategory.display_order).all()

@router.get("/questions", response_model=List[schemas.QuestionResponse])
def get_questions(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves active questions filtered for the logged-in student's category.
    If the logged-in user is an Admin, retrieves all questions (active and inactive).
    """
    if current_user.role in ["admin", "analytics_viewer", "verification_officer"]:
        # Admin gets all questions in order to edit/view them
        questions = db.query(models.Question).order_by(models.Question.category_id, models.Question.display_order).all()
        return [schemas.QuestionResponse.model_validate(q) for q in questions]
        
    # Student flow
    if current_user.category is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student category must be selected before retrieving profiling questions."
        )
        
    # Get active questions
    all_active = db.query(models.Question).filter(models.Question.active == True).order_by(models.Question.display_order).all()
    
    # Filter questions applicable to student category
    filtered_questions = []
    for q in all_active:
        try:
            cats = json.loads(q.applicable_categories_json)
        except Exception:
            cats = ["all"]
            
        if "all" in cats or current_user.category in cats:
            filtered_questions.append(schemas.QuestionResponse.model_validate(q))
            
    return filtered_questions

# --- ADMIN WRITE ENDPOINTS (RESTRICTED TO ADMIN) ---

@router.post("/categories", response_model=schemas.QuestionCategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    cat_data: schemas.QuestionCategoryCreate,
    admin_user: models.User = Depends(RoleChecker(allowed_roles=["admin"])),
    db: Session = Depends(get_db)
):
    """Creates a new question category."""
    # Check duplicate
    exists = db.query(models.QuestionCategory).filter(models.QuestionCategory.name == cat_data.name).first()
    if exists:
        raise HTTPException(status_code=400, detail="Category name already exists.")
        
    new_cat = models.QuestionCategory(
        name=cat_data.name,
        display_order=cat_data.display_order
    )
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)
    
    # Log action
    new_log = models.AdminLog(
        admin_id=admin_user.id,
        action="create_category",
        details=f"Created category: {new_cat.name}"
    )
    db.add(new_log)
    db.commit()
    
    return new_cat

@router.post("/questions", response_model=schemas.QuestionResponse, status_code=status.HTTP_201_CREATED)
def create_question(
    q_data: schemas.QuestionCreate,
    admin_user: models.User = Depends(RoleChecker(allowed_roles=["admin"])),
    db: Session = Depends(get_db)
):
    """Creates a new question in a category."""
    # Validate category exists
    cat = db.query(models.QuestionCategory).filter(models.QuestionCategory.id == q_data.category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found.")
        
    # Validate system key uniqueness
    if q_data.system_key:
        exists = db.query(models.Question).filter(models.Question.system_key == q_data.system_key).first()
        if exists:
            raise HTTPException(status_code=400, detail=f"System key '{q_data.system_key}' already exists.")
            
    # Serialize JSON fields
    options_json = json.dumps(q_data.options) if q_data.options is not None else None
    cats_json = json.dumps(q_data.applicable_categories)
    
    new_q = models.Question(
        category_id=q_data.category_id,
        system_key=q_data.system_key,
        question_text=q_data.question_text,
        field_type=q_data.field_type,
        options_json=options_json,
        conditional_parent_question_id=q_data.conditional_parent_question_id,
        conditional_value=q_data.conditional_value,
        required=q_data.required,
        min_rows=q_data.min_rows,
        active=q_data.active,
        applicable_categories_json=cats_json,
        display_order=q_data.display_order
    )
    db.add(new_q)
    db.commit()
    db.refresh(new_q)
    
    # Log action
    new_log = models.AdminLog(
        admin_id=admin_user.id,
        action="create_question",
        details=f"Created question: '{new_q.question_text[:50]}' with ID {new_q.id}"
    )
    db.add(new_log)
    db.commit()
    
    return schemas.QuestionResponse.model_validate(new_q)

@router.put("/questions/{id}", response_model=schemas.QuestionResponse)
def update_question(
    id: int,
    q_data: schemas.QuestionUpdate,
    admin_user: models.User = Depends(RoleChecker(allowed_roles=["admin"])),
    db: Session = Depends(get_db)
):
    """Updates an existing question. Snapshots the old state into questions_history before modifying,
    so past semester answers remain readable even if question text/options change."""
    db_question = db.query(models.Question).filter(models.Question.id == id).first()
    if not db_question:
        raise HTTPException(status_code=404, detail="Question not found.")
        
    # Block altering system keys to prevent analytics breaks
    if db_question.system_key and q_data.system_key and q_data.system_key != db_question.system_key:
         raise HTTPException(status_code=400, detail="Cannot alter the system key of system-required questions.")

    # --- Snapshot current state into questions_history BEFORE any changes ---
    history_entry = models.QuestionHistory(
        question_id=db_question.id,
        question_text=db_question.question_text,
        field_type=db_question.field_type,
        options_json=db_question.options_json,
        applicable_categories_json=db_question.applicable_categories_json,
        required=db_question.required,
        min_rows=db_question.min_rows,
        changed_by_admin_id=admin_user.id,
        changed_at=datetime.now(timezone.utc),
        change_note=q_data.change_note,
    )
    db.add(history_entry)
         
    # Update fields
    if q_data.category_id is not None:
        db_question.category_id = q_data.category_id
    if q_data.question_text is not None:
        db_question.question_text = q_data.question_text
    if q_data.field_type is not None:
        db_question.field_type = q_data.field_type
    if q_data.options is not None:
        db_question.options_json = json.dumps(q_data.options)
    if q_data.conditional_parent_question_id is not None:
        db_question.conditional_parent_question_id = q_data.conditional_parent_question_id
    if q_data.conditional_value is not None:
        db_question.conditional_value = q_data.conditional_value
    if q_data.required is not None:
        db_question.required = q_data.required
    if q_data.min_rows is not None:
        db_question.min_rows = q_data.min_rows
    if q_data.active is not None:
        db_question.active = q_data.active
    if q_data.applicable_categories is not None:
        db_question.applicable_categories_json = json.dumps(q_data.applicable_categories)
    if q_data.display_order is not None:
        db_question.display_order = q_data.display_order
        
    db.commit()
    db.refresh(db_question)
    
    # Log action
    new_log = models.AdminLog(
        admin_id=admin_user.id,
        action="update_question",
        details=f"Updated question: '{db_question.question_text[:50]}' with ID {db_question.id}"
    )
    db.add(new_log)
    db.commit()
    
    return schemas.QuestionResponse.model_validate(db_question)

@router.delete("/questions/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(
    id: int,
    admin_user: models.User = Depends(RoleChecker(allowed_roles=["admin"])),
    db: Session = Depends(get_db)
):
    """Deletes a question. Blocks deletion if it is a system-required question."""
    db_question = db.query(models.Question).filter(models.Question.id == id).first()
    if not db_question:
        raise HTTPException(status_code=404, detail="Question not found.")
        
    # Prevent deletion of questions linked to CHED Analytics
    if db_question.system_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete system-required questions. You can toggle 'active=False' instead to disable them."
        )
        
    db.delete(db_question)
    db.commit()
    
    # Log action
    new_log = models.AdminLog(
        admin_id=admin_user.id,
        action="delete_question",
        details=f"Deleted question: '{db_question.question_text[:50]}' with ID {db_question.id}"
    )
    db.add(new_log)
    db.commit()
    
    return None

@router.post("/questions/reorder", status_code=status.HTTP_200_OK)
def reorder_questions(
    reorder_list: List[Dict[str, int]],  # [{"question_id": 12, "display_order": 1}, ...]
    admin_user: models.User = Depends(RoleChecker(allowed_roles=["admin"])),
    db: Session = Depends(get_db)
):
    """Bulk updates display order of multiple questions."""
    for item in reorder_list:
        q_id = item.get("question_id")
        order = item.get("display_order")
        if q_id is not None and order is not None:
            db.query(models.Question).filter(models.Question.id == q_id).update({"display_order": order})
            
    db.commit()
    
    # Log action
    new_log = models.AdminLog(
        admin_id=admin_user.id,
        action="reorder_questions",
        details=f"Reordered {len(reorder_list)} questions"
    )
    db.add(new_log)
    db.commit()
    
    return {"message": "Questions reordered successfully."}


@router.get("/questions/{id}/history", response_model=List[schemas.QuestionHistoryResponse])
def get_question_history(
    id: int,
    admin_user: models.User = Depends(RoleChecker(allowed_roles=["admin", "analytics_viewer"])),
    db: Session = Depends(get_db)
):
    """
    Returns the full edit history for a single question, ordered newest-first.
    Each entry is a snapshot of the question state *before* an admin made a change.
    This allows admins to see exactly what was asked in past semesters.
    """
    db_question = db.query(models.Question).filter(models.Question.id == id).first()
    if not db_question:
        raise HTTPException(status_code=404, detail="Question not found.")

    history = (
        db.query(models.QuestionHistory)
        .filter(models.QuestionHistory.question_id == id)
        .order_by(models.QuestionHistory.changed_at.desc())
        .all()
    )
    return [schemas.QuestionHistoryResponse.model_validate(h) for h in history]
