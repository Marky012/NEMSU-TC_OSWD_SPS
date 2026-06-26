from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, func
from sqlalchemy import text as sa_text
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="student", nullable=False)  # student, admin, analytics_viewer, verification_officer
    category = Column(String, nullable=True)  # New, Transferee, Returnee, Continuing
    is_verified_for_enrollment = Column(Boolean, default=False, nullable=False)
    verified_by = Column(String, nullable=True)
    verified_at = Column(DateTime, nullable=True)
    is_email_verified = Column(Boolean, default=False, nullable=False)
    email_verification_code_hash = Column(String, nullable=True)
    email_verification_code_expires_at = Column(DateTime, nullable=True)
    privacy_consent = Column(Boolean, default=False, nullable=False)
    privacy_consent_at = Column(DateTime, nullable=True)
    password_reset_token_hash = Column(String, nullable=True)
    password_reset_token_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    
    # Relationships
    submissions = relationship("Submission", back_populates="user", cascade="all, delete-orphan")
    pwd_tasks = relationship("PWDAssistanceTask", back_populates="student", cascade="all, delete-orphan")
    admin_logs = relationship("AdminLog", back_populates="admin", cascade="all, delete")

class Semester(Base):
    __tablename__ = "semesters"
    
    id = Column(Integer, primary_key=True, index=True)
    label = Column(String, nullable=False, unique=True)  # e.g., "AY 2026-2027 1st Semester"
    is_active = Column(Boolean, default=False, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    opens_at = Column(DateTime(timezone=True), nullable=False)
    closes_at = Column(DateTime(timezone=True), nullable=False)
    
    # Relationships
    submissions = relationship("Submission", back_populates="semester", cascade="all, delete-orphan")

class QuestionCategory(Base):
    __tablename__ = "question_categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)  # e.g., "Personal Information", "IP", "Solo Parent & PWD", "Internet & Digital Tech"
    display_order = Column(Integer, default=0, nullable=False)
    
    # Relationships
    questions = relationship("Question", back_populates="category", order_by="Question.display_order", cascade="all, delete-orphan")

class Question(Base):
    __tablename__ = "questions"
    
    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("question_categories.id"), nullable=False, index=True)
    semester_id = Column(Integer, ForeignKey("semesters.id"), nullable=True, index=True)  # Versioning support
    system_key = Column(String, nullable=True)  # e.g., 'program', 'gender', 'is_pwd', 'pwd_disability_type', 'indigenous_peoples_none' (Removed unique=True so we can clone across semesters)
    question_text = Column(Text, nullable=False)
    field_type = Column(String, nullable=False)  # canonical: text, number, radio, checkbox, dropdown, file, multi-select, table, textarea, date, datetime; also used: select, boolean, multi_select
    options_json = Column(Text, nullable=True)  # JSON string of options (choices array or table headers)
    conditional_parent_question_id = Column(Integer, ForeignKey("questions.id"), nullable=True, index=True)
    conditional_value = Column(String, nullable=True)  # value of parent that triggers this question
    required = Column(Boolean, default=True, nullable=False)
    min_rows = Column(Integer, nullable=True)  # Minimum rows required for table-type questions (e.g., sports/arts participation)
    active = Column(Boolean, default=True, nullable=False)
    applicable_categories_json = Column(Text, nullable=False)  # JSON list e.g. ["New", "Transferee", "Returnee", "Continuing"] or ["all"]
    display_order = Column(Integer, default=0, nullable=False)
    
    # Relationships
    category = relationship("QuestionCategory", back_populates="questions")
    semester = relationship("Semester")
    answers = relationship("Answer", back_populates="question", cascade="all, delete-orphan")

    
    # Self-referencing conditional parent
    conditional_parent = relationship("Question", remote_side=[id], backref="conditional_children")

class Submission(Base):
    __tablename__ = "submissions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    semester_id = Column(Integer, ForeignKey("semesters.id"), nullable=False, index=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)  # NULL represents draft status
    draft_data_json = Column(Text, nullable=True)  # JSON string representing unsubmitted draft answers
    is_final = Column(Boolean, default=False, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    status = Column(String, default='pending', server_default=sa_text("'pending'"), nullable=False)  # pending, returned, declined, verified
    admin_comment = Column(Text, nullable=True)
    is_senior_citizen = Column(Boolean, default=False, nullable=False)
    is_magna_carta_poor = Column(Boolean, default=False, nullable=False)
    is_underprivileged = Column(Boolean, default=False, nullable=False)
    verification_code = Column(String, unique=True, nullable=True, index=True)  # e.g., OSWD-2026-1-1002
    receipt_pdf_path = Column(String, nullable=True)

    # Relationships
    user = relationship("User", back_populates="submissions")
    semester = relationship("Semester", back_populates="submissions")
    answers = relationship("Answer", back_populates="submission", cascade="all, delete-orphan")

class Answer(Base):
    __tablename__ = "answers"
    
    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False, index=True)
    answer_text = Column(Text, nullable=True)  # Simple text, selected option, or serialized JSON list/dict
    file_path = Column(String, nullable=True)  # File path if field_type is 'file'
    
    # Relationships
    submission = relationship("Submission", back_populates="answers")
    question = relationship("Question", back_populates="answers")

class PWDAssistanceTask(Base):
    __tablename__ = "pwd_assistance_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    status = Column(String, default="pending", nullable=False)  # pending, in_progress, completed
    notes = Column(Text, nullable=True)
    
    # Relationships
    student = relationship("User", back_populates="pwd_tasks")

class AdminLog(Base):
    __tablename__ = "admin_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    action = Column(String, nullable=False)  # e.g. "edit_question", "verify_student", "export_reports"
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    
    # Relationships
    admin = relationship("User", back_populates="admin_logs")


class QuestionHistory(Base):
    """
    Immutable audit snapshot of a Question's state taken immediately before any edit.
    Ensures that past semester Answers remain interpretable even after the question
    text, options, or field type is later changed by an admin.
    """
    __tablename__ = "questions_history"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False, index=True)

    # --- Snapshot fields (copy of Question columns at the moment of edit) ---
    question_text = Column(Text, nullable=False)
    field_type = Column(String, nullable=False)
    options_json = Column(Text, nullable=True)
    applicable_categories_json = Column(Text, nullable=False)
    required = Column(Boolean, nullable=False)
    min_rows = Column(Integer, nullable=True)

    # --- Audit metadata ---
    changed_by_admin_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    changed_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    change_note = Column(Text, nullable=True)  # Optional human-readable reason for the edit

    # --- Relationships ---
    question = relationship("Question", foreign_keys=[question_id])
    changed_by = relationship("User", foreign_keys=[changed_by_admin_id])

class EmailRateLimit(Base):
    __tablename__ = "email_rate_limits"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True, nullable=False)
    sent_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)

