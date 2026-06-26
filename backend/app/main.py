import os
import shutil
import threading
import time
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base, SessionLocal
from app.seeders.seed_questions import seed_database
from app.routers import auth, forms, students, admin, reports, address
import secrets
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from fastapi.responses import JSONResponse
from app.rate_limiter import limiter

class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not settings.CSRF_ENABLED:
            return await call_next(request)
            
        if request.method == "GET":
            response = await call_next(request)
            if "csrf_token" not in request.cookies:
                token = secrets.token_urlsafe(32)
                response.set_cookie(
                    "csrf_token", 
                    token, 
                    httponly=False, # Needs to be false so frontend JS can read it
                    samesite="lax",
                    secure=(settings.ENVIRONMENT == "production")
                )
            return response
            
        elif request.method in ["POST", "PUT", "DELETE", "PATCH"]:
            cookie_token = request.cookies.get("csrf_token")
            header_token = request.headers.get("X-CSRF-Token")
            
            # Allow login to bypass CSRF if it's the first request, but standard practice is 
            # to GET a CSRF token first. If it fails, they can fetch it.
            if not cookie_token or not header_token or cookie_token != header_token:
                return JSONResponse(status_code=403, content={"detail": "CSRF token missing or mismatch."})
                
        return await call_next(request)

from contextlib import asynccontextmanager

# Setup background database backup scheduler
def run_backup_scheduler():
    def backup_job():
        # Wait for the database file to be initialized on first run
        time.sleep(30)
        while True:
            try:
                os.makedirs(settings.BACKUP_DIR, exist_ok=True)
                timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
                
                # Check if we are using SQLite and backup the file
                if settings.DATABASE_URL.startswith("sqlite:///"):
                    db_file = settings.DATABASE_URL.replace("sqlite:///", "")
                    # Strip relative dots if any
                    db_file = db_file.lstrip("./")
                    
                    if os.path.exists(db_file):
                        backup_file = os.path.join(settings.BACKUP_DIR, f"oswd_sps_backup_{timestamp}.db")
                        shutil.copy2(db_file, backup_file)
                        print(f"[Background Backup] Database backup completed: {backup_file}")
                        
                        # Prune backup files older than 30 days
                        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
                        for f in os.listdir(settings.BACKUP_DIR):
                            file_path = os.path.join(settings.BACKUP_DIR, f)
                            if os.path.isfile(file_path):
                                file_mtime = datetime.fromtimestamp(os.path.getmtime(file_path), tz=timezone.utc)
                                if file_mtime < cutoff:
                                    os.remove(file_path)
                                    print(f"[Background Backup] Pruned backup older than 30 days: {file_path}")
                    else:
                        print(f"[Background Backup Warning] SQLite DB file '{db_file}' not found. Skipping.")
                else:
                    # In production environment (like PostgreSQL), database backups are handled via standard pg_dump
                    print("[Background Backup] Database is not SQLite (PostgreSQL detected). Backups should be managed via external cron/pg_dump.")
            except Exception as e:
                print(f"[Background Backup Error] Automated backup failed: {str(e)}")
                
            # Sleep 24 hours
            time.sleep(86400)

    thread = threading.Thread(target=backup_job, daemon=True)
    thread.start()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP EVENT ---
    # 1. Create all database tables
    Base.metadata.create_all(bind=engine)
    print("Database tables verified.")
    
    # 2. Apply schema migrations for existing databases (add columns if missing)
    from sqlalchemy import inspect, text
    from app.database import SessionLocal as _SessionLocal
    
    _db = _SessionLocal()
    try:
        inspector = inspect(engine)
        # Add is_archived to semesters if missing
        sem_columns = [c['name'] for c in inspector.get_columns('semesters')]
        if 'is_archived' not in sem_columns:
            _db.execute(text("ALTER TABLE semesters ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE"))
            print("[Migration] Added is_archived column to semesters table.")
        # Add status to submissions if missing
        sub_columns = [c['name'] for c in inspector.get_columns('submissions')]
        if 'status' not in sub_columns:
            _db.execute(text("ALTER TABLE submissions ADD COLUMN status VARCHAR NOT NULL DEFAULT 'pending'"))
            # Set status='verified' for submissions whose user is already verified
            _db.execute(text(
                "UPDATE submissions SET status='verified' "
                "WHERE is_final = TRUE AND user_id IN (SELECT id FROM users WHERE is_verified_for_enrollment = TRUE)"
            ))
            print("[Migration] Added status column to submissions table.")
        if 'admin_comment' not in sub_columns:
            _db.execute(text("ALTER TABLE submissions ADD COLUMN admin_comment TEXT"))
            print("[Migration] Added admin_comment column to submissions table.")
        sub_columns = [c['name'] for c in inspector.get_columns('submissions')]
        if 'is_archived' not in sub_columns:
            _db.execute(text("ALTER TABLE submissions ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE"))
            print("[Migration] Added is_archived column to submissions table.")
        # Add is_senior_citizen to submissions if missing
        if 'is_senior_citizen' not in sub_columns:
            _db.execute(text("ALTER TABLE submissions ADD COLUMN is_senior_citizen BOOLEAN NOT NULL DEFAULT FALSE"))
            print("[Migration] Added is_senior_citizen column to submissions table.")
        # Add is_magna_carta_poor to submissions if missing
        if 'is_magna_carta_poor' not in sub_columns:
            _db.execute(text("ALTER TABLE submissions ADD COLUMN is_magna_carta_poor BOOLEAN NOT NULL DEFAULT FALSE"))
            print("[Migration] Added is_magna_carta_poor column to submissions table.")
        # Add is_underprivileged to submissions if missing
        if 'is_underprivileged' not in sub_columns:
            _db.execute(text("ALTER TABLE submissions ADD COLUMN is_underprivileged BOOLEAN NOT NULL DEFAULT FALSE"))
            print("[Migration] Added is_underprivileged column to submissions table.")
        # Add receipt_pdf_path to submissions if missing
        if 'receipt_pdf_path' not in sub_columns:
            _db.execute(text("ALTER TABLE submissions ADD COLUMN receipt_pdf_path VARCHAR"))
            print("[Migration] Added receipt_pdf_path column to submissions table.")
        # Add min_rows to questions if missing
        q_columns = [c['name'] for c in inspector.get_columns('questions')]
        if 'min_rows' not in q_columns:
            _db.execute(text("ALTER TABLE questions ADD COLUMN min_rows INTEGER"))
            print("[Migration] Added min_rows column to questions table.")
        # Add min_rows to questions_history if missing
        qh_columns = [c['name'] for c in inspector.get_columns('questions_history')]
        if 'min_rows' not in qh_columns:
            _db.execute(text("ALTER TABLE questions_history ADD COLUMN min_rows INTEGER"))
            print("[Migration] Added min_rows column to questions_history table.")
        # Add email verification columns to users if missing
        user_columns = [c['name'] for c in inspector.get_columns('users')]
        if 'is_email_verified' not in user_columns:
            _db.execute(text("ALTER TABLE users ADD COLUMN is_email_verified BOOLEAN NOT NULL DEFAULT FALSE"))
            print("[Migration] Added is_email_verified column to users table.")
        if 'email_verification_code_hash' not in user_columns:
            _db.execute(text("ALTER TABLE users ADD COLUMN email_verification_code_hash VARCHAR"))
            print("[Migration] Added email_verification_code_hash column to users table.")
        if 'email_verification_code_expires_at' not in user_columns:
            _db.execute(text("ALTER TABLE users ADD COLUMN email_verification_code_expires_at TIMESTAMP"))
            print("[Migration] Added email_verification_code_expires_at column to users table.")
        if 'verified_by' not in user_columns:
            _db.execute(text("ALTER TABLE users ADD COLUMN verified_by VARCHAR"))
            print("[Migration] Added verified_by column to users table.")
        if 'verified_at' not in user_columns:
            _db.execute(text("ALTER TABLE users ADD COLUMN verified_at TIMESTAMP"))
            print("[Migration] Added verified_at column to users table.")
        if 'privacy_consent' not in user_columns:
            _db.execute(text("ALTER TABLE users ADD COLUMN privacy_consent BOOLEAN NOT NULL DEFAULT FALSE"))
            print("[Migration] Added privacy_consent column to users table.")
        if 'privacy_consent_at' not in user_columns:
            _db.execute(text("ALTER TABLE users ADD COLUMN privacy_consent_at TIMESTAMP"))
            print("[Migration] Added privacy_consent_at column to users table.")
        if 'password_reset_token_hash' not in user_columns:
            _db.execute(text("ALTER TABLE users ADD COLUMN password_reset_token_hash VARCHAR"))
            print("[Migration] Added password_reset_token_hash column to users table.")
        if 'password_reset_token_expires_at' not in user_columns:
            _db.execute(text("ALTER TABLE users ADD COLUMN password_reset_token_expires_at TIMESTAMP"))
            print("[Migration] Added password_reset_token_expires_at column to users table.")
        _db.commit()
    except Exception as e:
        print(f"[Migration] Note: {e}")
    finally:
        _db.close()
    
    # 3. Run database seeders if database is empty
    db = SessionLocal()
    try:
        seed_database(db)

        # Ensure admin user is always properly configured after seeding
        admin_user = db.query(models.User).filter(
            models.User.email == settings.ADMIN_INITIAL_EMAIL
        ).first()
        if admin_user:
            needs_update = False
            if admin_user.role != "admin":
                admin_user.role = "admin"
                needs_update = True
            if not admin_user.is_email_verified:
                admin_user.is_email_verified = True
                needs_update = True
            if needs_update:
                db.commit()
                print(f"[Startup] Admin user repaired (role=admin, verified=True): {admin_user.email}")
    finally:
        db.close()
        
    # 4. Start automated daily backup scheduler
    run_backup_scheduler()
        
    yield
    # --- SHUTDOWN EVENT ---
    pass

# --- INITIALIZE FASTAPI ---
app = FastAPI(
    title="OSWD Student Profiling System API",
    description="Backend services for North Eastern Mindanao State University OSWD Student Profiling System.",
    version="1.0.0",
    lifespan=lifespan
)

# --- CONFIGURE CORS ---
# In development, support all origins. In production, set ALLOWED_ORIGINS env to specific domains.
allow_credentials = settings.ALLOWED_ORIGINS != ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.add_middleware(CSRFMiddleware)
app.add_middleware(SlowAPIMiddleware)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- HEALTH CHECK ENDPOINT ---
@app.get("/health", status_code=status.HTTP_200_OK, tags=["System Health"])
def health_check():
    return {
        "status": "online",
        "timestamp": datetime.now(timezone.utc),
        "database": "connected"
    }

app.include_router(auth.router)
app.include_router(forms.router)
app.include_router(students.router)
app.include_router(admin.router)
app.include_router(reports.router)
app.include_router(address.router)

# --- PUBLIC VERIFICATION ALIAS (no auth required — for Registrar use) ---
from app import models, schemas
from app.database import get_db
from fastapi import Depends
from sqlalchemy.orm import Session

@app.get(
    "/api/verify/{verification_code}",
    response_model=schemas.VerificationCheckResponse,
    tags=["Public Verification"],
    summary="Registrar Verification Lookup",
    description=(
        "Public endpoint — no login required. "
        "Enter a student's OSWD verification code (e.g. OSWD-2026-1-00012) "
        "to confirm whether they have completed OSWD profiling for the current semester."
    ),
)
def public_verify(
    verification_code: str,
    db: Session = Depends(get_db),
):
    submission = db.query(models.Submission).filter(
        models.Submission.verification_code == verification_code,
        models.Submission.is_final == True,
    ).first()

    if not submission:
        return schemas.VerificationCheckResponse(
            status="invalid",
            verification_code=verification_code,
        )

    student = db.query(models.User).filter(models.User.id == submission.user_id).first()
    semester = db.query(models.Semester).filter(models.Semester.id == submission.semester_id).first()

    return schemas.VerificationCheckResponse(
        status="valid",
        verification_code=verification_code,
        student_category=student.category if student else None,
        semester_label=semester.label if semester else None,
        submitted_at=submission.submitted_at,
    )
