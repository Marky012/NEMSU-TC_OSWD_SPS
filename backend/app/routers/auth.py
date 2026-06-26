import hashlib
import logging
import random
from datetime import timedelta, datetime, timezone
from typing import Dict, Any
import threading
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.utils import security
from app.dependencies import get_current_user
from app.rate_limiter import limiter
from app.config import settings
from app.utils.email import send_registration_verification_email, send_password_reset_email, generate_password_reset_token

logger = logging.getLogger(__name__)

class LoginJSON(BaseModel):
    email: EmailStr
    password: str

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

def generate_verification_code() -> str:
    """Generate a random 6-digit verification code."""
    return f"{random.randint(100000, 999999)}"

def hash_verification_code(code: str) -> str:
    """Hash a 6-digit verification code using SHA-256."""
    return hashlib.sha256(code.encode()).hexdigest()

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_student(user_data: schemas.UserRegister, db: Session = Depends(get_db)):
    """Registers a new student account. Sends 6-digit email verification code."""
    existing_user = db.query(models.User).filter(models.User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email is already registered."
        )

    code = generate_verification_code()
    code_hash = hash_verification_code(code)
    expires_at = datetime.utcnow() + timedelta(minutes=15)

    if not user_data.privacy_consent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must agree to the Data Privacy Policy to create an account."
        )

    new_user = models.User(
        email=user_data.email,
        first_name=user_data.first_name,
        password_hash=security.get_password_hash(user_data.password),
        role="student",
        category=None,
        is_verified_for_enrollment=False,
        is_email_verified=False,
        email_verification_code_hash=code_hash,
        email_verification_code_expires_at=expires_at,
        privacy_consent=True,
        privacy_consent_at=datetime.now(timezone.utc)
    )
    # Auto-verify admin users (seeded or created directly)
    if new_user.role == "admin":
        new_user.is_email_verified = True
        new_user.email_verification_code_hash = None
        new_user.email_verification_code_expires_at = None

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    threading.Thread(
        target=send_registration_verification_email,
        args=(user_data.email, code),
        daemon=True
    ).start()

    return {
        "id": new_user.id, "email": new_user.email, "first_name": new_user.first_name, "role": new_user.role,
        "category": new_user.category, "is_verified_for_enrollment": new_user.is_verified_for_enrollment,
        "verified_by": new_user.verified_by, "verified_at": new_user.verified_at,
        "is_email_verified": new_user.is_email_verified,
        "privacy_consent": new_user.privacy_consent, "privacy_consent_at": new_user.privacy_consent_at,
        "created_at": new_user.created_at.isoformat() if new_user.created_at else None,
        "verification_code": code if not settings.SMTP_HOST else None,
    }

@router.post("/login", response_model=schemas.TokenResponse)
@limiter.limit(settings.LOGIN_RATE_LIMIT)
def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Logs in an existing user and returns an access token."""
    # Find user by email
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_email_verified and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address first. Check your inbox for a 6-digit verification code."
        )
        
    # Generate access token
    access_token_expires = timedelta(minutes=security.settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.email, "role": user.role},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/login-json", response_model=schemas.TokenResponse)
@limiter.limit(settings.LOGIN_RATE_LIMIT)
def login_json(
    request: Request,
    data: LoginJSON,
    db: Session = Depends(get_db)
):
    """Logs in using JSON body instead of form data. Returns token + user."""
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user or not security.verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not user.is_email_verified and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address first. Check your inbox for a 6-digit verification code."
        )

    access_token_expires = timedelta(minutes=security.settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.email, "role": user.role},
        expires_delta=access_token_expires
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/profile")
def read_current_user_profile(current_user: models.User = Depends(get_current_user)):
    """Retrieves the authenticated user's profile details."""
    return current_user

@router.post("/category")
def set_student_category(
    data: schemas.UserCategorySelect,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Sets the student category (New, Transferee, Returnee, Continuing).
       Can be changed only if the student has no existing submissions (draft or final)."""
    valid_categories = ["New", "Transferee", "Returnee", "Continuing"]
    if data.category not in valid_categories:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid student category. Must be one of: {valid_categories}"
        )

    if current_user.category is not None and current_user.role == "student":
        existing_submission = db.query(models.Submission).filter(
            models.Submission.user_id == current_user.id
        ).first()
        if existing_submission:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category cannot be changed after you have started or submitted the profiling form."
            )

    current_user.category = data.category
    db.commit()
    db.refresh(current_user)

    new_log = models.AdminLog(
        admin_id=current_user.id,
        action="set_category",
        details=f"Student {current_user.email} selected category: {data.category}"
    )
    db.add(new_log)
    db.commit()

    return current_user

@router.post("/verify-email", response_model=schemas.EmailVerificationResponse)
def verify_email(data: schemas.EmailVerificationRequest, db: Session = Depends(get_db)):
    """Verifies a user's email using the 6-digit code sent at registration."""
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.is_email_verified:
        return {"message": "Email is already verified.", "email": user.email}

    if not user.email_verification_code_hash or not user.email_verification_code_expires_at:
        raise HTTPException(status_code=400, detail="No verification code found. Request a new one.")

    if datetime.utcnow() > user.email_verification_code_expires_at:
        raise HTTPException(status_code=400, detail="Verification code has expired. Request a new one.")

    input_hash = hash_verification_code(data.code)
    if input_hash != user.email_verification_code_hash:
        raise HTTPException(status_code=400, detail="Invalid verification code.")

    user.is_email_verified = True
    user.email_verification_code_hash = None
    user.email_verification_code_expires_at = None
    db.commit()

    return {"message": "Email verified successfully. You can now log in.", "email": user.email}

@router.post("/resend-verification")
def resend_verification(data: schemas.ResendVerificationRequest, db: Session = Depends(get_db)):
    """Resends a new 6-digit verification code to the user's email."""
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.is_email_verified:
        return {"message": "Email is already verified.", "email": user.email}

    code = generate_verification_code()
    code_hash = hash_verification_code(code)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

    user.email_verification_code_hash = code_hash
    user.email_verification_code_expires_at = expires_at
    db.commit()

    threading.Thread(
        target=send_registration_verification_email,
        args=(user.email, code),
        daemon=True
    ).start()

    return {
        "message": "A new 6-digit verification code has been sent to your email.",
        "email": user.email,
        "verification_code": code if not settings.SMTP_HOST else None,
    }

@router.post("/forgot-password", response_model=schemas.ForgotPasswordResponse)
def forgot_password(
    data: schemas.ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """Sends a password reset link to the user's email."""
    user = db.query(models.User).filter(models.User.email == data.email).first()
    # Always return success to avoid email enumeration
    if not user:
        return {"message": "If an account with that email exists, a password reset link has been sent."}

    token = generate_password_reset_token()
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    user.password_reset_token_hash = token_hash
    user.password_reset_token_expires_at = expires_at
    db.commit()

    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"

    threading.Thread(
        target=send_password_reset_email,
        args=(user.email, reset_url),
        daemon=True
    ).start()

    return {"message": "If an account with that email exists, a password reset link has been sent."}


@router.post("/reset-password", response_model=schemas.ResetPasswordResponse)
def reset_password(
    data: schemas.ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    """Resets the user's password using a valid reset token."""
    token_hash = hashlib.sha256(data.token.encode()).hexdigest()
    user = db.query(models.User).filter(
        models.User.password_reset_token_hash == token_hash,
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token.",
        )

    if not user.password_reset_token_expires_at or datetime.now(timezone.utc) > user.password_reset_token_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired. Please request a new one.",
        )

    user.password_hash = security.get_password_hash(data.password)
    user.password_reset_token_hash = None
    user.password_reset_token_expires_at = None
    db.commit()

    return {"message": "Password has been reset successfully. You can now log in with your new password."}


@router.post("/privacy-consent")
def accept_privacy_consent(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Records the user's acceptance of the Data Privacy Policy."""
    current_user.privacy_consent = True
    current_user.privacy_consent_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(current_user)
    return current_user
