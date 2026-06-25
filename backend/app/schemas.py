from pydantic import BaseModel, EmailStr, Field, ConfigDict, AliasChoices, field_validator
from typing import List, Optional, Any, Dict
from datetime import datetime
import json

# --- AUTH SCHEMAS ---
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters.")
    privacy_consent: bool = Field(False, description="Consent to Data Privacy Act of 2012.")

class UserResponse(BaseModel):
    id: int
    email: str
    role: str
    category: Optional[str] = None
    is_verified_for_enrollment: bool
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    is_email_verified: bool = False
    privacy_consent: bool = False
    privacy_consent_at: Optional[datetime] = None
    verification_code: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class UserCategorySelect(BaseModel):
    category: str = Field(..., description="Must be one of: New, Transferee, Returnee, Continuing")

class EmailVerificationRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")

class EmailVerificationResponse(BaseModel):
    message: str
    email: str

class ResendVerificationRequest(BaseModel):
    email: EmailStr

# --- SEMESTER SCHEMAS ---
class SemesterCreate(BaseModel):
    label: str = Field(..., description="Semester Label, e.g. 'AY 2026-2027 1st Semester'")
    opens_at: datetime
    closes_at: datetime

class SemesterResponse(BaseModel):
    id: int
    label: str
    is_active: bool
    is_archived: bool
    opens_at: datetime
    closes_at: datetime

    model_config = ConfigDict(from_attributes=True)

class SemesterUpdate(BaseModel):
    label: Optional[str] = None
    opens_at: Optional[datetime] = None
    closes_at: Optional[datetime] = None
    is_active: Optional[bool] = None

# --- QUESTION CATEGORY SCHEMAS ---
class QuestionCategoryCreate(BaseModel):
    name: str
    display_order: int = 0

class QuestionCategoryResponse(BaseModel):
    id: int
    name: str
    display_order: int

    model_config = ConfigDict(from_attributes=True)

# --- QUESTION SCHEMAS ---
class QuestionCreate(BaseModel):
    category_id: int
    semester_id: Optional[int] = None
    system_key: Optional[str] = None
    question_text: str
    field_type: str  # text, number, radio, checkbox, dropdown, file, multi-select, table
    options: Optional[Any] = None  # List of strings, or table headers configuration
    conditional_parent_question_id: Optional[int] = None
    conditional_value: Optional[str] = None
    required: bool = True
    min_rows: Optional[int] = None  # Minimum rows required for table-type questions
    active: bool = True
    applicable_categories: List[str] = ["all"]  # list of strings e.g. ["New", "Continuing"]
    display_order: int = 0

class QuestionUpdate(BaseModel):
    category_id: Optional[int] = None
    semester_id: Optional[int] = None
    system_key: Optional[str] = None
    question_text: Optional[str] = None
    field_type: Optional[str] = None
    options: Optional[Any] = None
    conditional_parent_question_id: Optional[int] = None
    conditional_value: Optional[str] = None
    required: Optional[bool] = None
    min_rows: Optional[int] = None
    active: Optional[bool] = None
    applicable_categories: Optional[List[str]] = None
    display_order: Optional[int] = None
    change_note: Optional[str] = None  # Human-readable reason for this edit (stored in questions_history)

class QuestionResponse(BaseModel):
    id: int
    category_id: int
    semester_id: Optional[int] = None
    system_key: Optional[str] = None
    question_text: str
    field_type: str
    options: Optional[Any] = Field(default=None, validation_alias=AliasChoices('options', 'options_json'))
    conditional_parent_question_id: Optional[int] = None
    conditional_value: Optional[str] = None
    required: bool
    min_rows: Optional[int] = None
    active: bool
    applicable_categories: List[str] = Field(default=[], validation_alias=AliasChoices('applicable_categories', 'applicable_categories_json'))
    display_order: int

    model_config = ConfigDict(from_attributes=True)

    @field_validator('applicable_categories', mode='before')
    @classmethod
    def parse_cats(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return []
        return v or []

    @field_validator('options', mode='before')
    @classmethod
    def parse_options(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return v
        return v

# --- SUBMISSION SCHEMAS ---
class AnswerSubmit(BaseModel):
    question_id: int
    answer_text: Optional[str] = None

class DraftSave(BaseModel):
    draft_data: Dict[str, Any]  # Dictionary of raw draft values

class FinalSubmit(BaseModel):
    answers: List[AnswerSubmit]

class AnswerResponse(BaseModel):
    id: int
    question_id: int
    answer_text: Optional[str] = None
    file_path: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class SubmissionResponse(BaseModel):
    id: int
    user_id: int
    semester_id: int
    submitted_at: Optional[datetime] = None
    is_final: bool
    status: str = 'pending'
    admin_comment: Optional[str] = None
    verification_code: Optional[str] = None
    draft_data: Optional[Dict[str, Any]] = Field(default=None, validation_alias=AliasChoices('draft_data', 'draft_data_json'))
    answers: List[AnswerResponse] = []

    model_config = ConfigDict(from_attributes=True)

    @field_validator('draft_data', mode='before')
    @classmethod
    def parse_draft_data(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return {}
        return v

# --- PWD & LOG SCHEMAS ---
class PWDTaskResponse(BaseModel):
    id: int
    student_id: int
    student_email: str
    created_at: datetime
    status: str
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class PWDTaskUpdate(BaseModel):
    status: str
    notes: Optional[str] = None

class AdminLogResponse(BaseModel):
    id: int
    admin_id: int
    admin_email: str
    action: str
    details: Optional[str] = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

# --- QUESTION HISTORY (VERSIONING) ---
class QuestionHistoryResponse(BaseModel):
    id: int
    question_id: int
    question_text: str
    field_type: str
    options: Optional[Any] = Field(default=None, validation_alias=AliasChoices('options', 'options_json'))
    applicable_categories: List[str] = Field(default=[], validation_alias=AliasChoices('applicable_categories', 'applicable_categories_json'))
    required: bool
    min_rows: Optional[int] = None
    changed_by_admin_id: int
    changed_at: datetime
    change_note: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator('applicable_categories', mode='before')
    @classmethod
    def parse_cats(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return []
        return v or []

    @field_validator('options', mode='before')
    @classmethod
    def parse_options(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return v
        return v

# --- REUSE PAST ENTRY (DIFF-VIEW API) ---
class ReusePreviewRequest(BaseModel):
    source_submission_id: Optional[int] = None  # If None, uses most recent finalized submission

class ReuseAnswerItem(BaseModel):
    question_id: int
    question_text: str
    system_key: Optional[str] = None
    old_answer: Optional[Any] = None
    new_answer: Optional[Any] = None   # Same as old_answer until student edits
    changed: bool = False              # True when old != new

class ReusePreviewResponse(BaseModel):
    source_submission_id: int
    source_semester_label: str
    submitted_at: Optional[datetime] = None
    answers: List[ReuseAnswerItem]
    changed_count: int

class ReuseConfirmRequest(BaseModel):
    source_submission_id: int  # Must match the previewed submission

# --- ADMIN SUBMISSION LIST ---
class AdminSubmissionItem(BaseModel):
    id: int
    user_id: int
    semester_id: int
    is_final: bool
    is_archived: bool = False
    status: str = 'pending'
    admin_comment: Optional[str] = None
    is_senior_citizen: bool = False
    is_magna_carta_poor: bool = False
    is_underprivileged: bool = False
    is_verified: bool = False
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    verification_code: Optional[str] = None
    student_category: Optional[str] = None
    student_email: Optional[str] = None
    submitted_at: Optional[datetime] = None
    draft_data_json: Optional[str] = None
    created_date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# --- PUBLIC VERIFICATION ---
class VerificationCheckResponse(BaseModel):
    status: str  # "valid" | "invalid"
    verification_code: Optional[str] = None
    student_category: Optional[str] = None
    semester_label: Optional[str] = None
    submitted_at: Optional[datetime] = None

class SubmissionSEGUpdate(BaseModel):
    is_senior_citizen: Optional[bool] = None
    is_magna_carta_poor: Optional[bool] = None
    is_underprivileged: Optional[bool] = None

# --- SUBMISSION REVIEW (Return/Decline) ---
class SubmissionReview(BaseModel):
    status: str  # "returned" | "declined" | "verified"
    admin_comment: Optional[str] = None

# --- ANALYTICS AND CHED REPORTS ---
class SummaryReport(BaseModel):
    report_title: str
    generated_at: datetime
    data: List[Dict[str, Any]]
