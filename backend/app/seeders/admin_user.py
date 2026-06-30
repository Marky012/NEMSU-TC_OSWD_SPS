import logging
from typing import Optional

from app.config import settings
from app.database import SessionLocal
from app.models import User
from app.utils.security import get_password_hash

logger = logging.getLogger(__name__)

def create_admin_if_missing() -> None:
    """Idempotently ensure the initial admin user exists.

    * Reads ``ADMIN_INITIAL_EMAIL`` and ``ADMIN_INITIAL_PASSWORD`` from the
      Pydantic ``settings`` singleton (populated from ``.env``).
    * Removes any admin whose email does NOT match ``ADMIN_INITIAL_EMAIL``
      (handles credential changes on redeploy).
    * If a user with that email is already present with ``role='admin'``,
      the function ensures ``is_email_verified`` is ``True`` and does nothing
      else.
    * If the user exists but has the wrong role, it is repaired.
    * Otherwise it creates a ``User`` with ``role='admin'`` and a bcrypt‑hashed
      password.
    """
    db = SessionLocal()
    try:
        # Remove admins whose email does not match the configured one
        stale_admins = db.query(User).filter(
            User.role == "admin",
            User.email != settings.ADMIN_INITIAL_EMAIL
        ).all()
        for stale in stale_admins:
            db.delete(stale)
            logger.info("Removed stale admin: %s", stale.email)
        db.commit()

        admin = db.query(User).filter(User.email == settings.ADMIN_INITIAL_EMAIL).first()
        if admin:
            if admin.role != "admin" or not admin.is_email_verified:
                admin.role = "admin"
                admin.is_email_verified = True
                db.commit()
                logger.info("Admin user repaired: %s (role=%s, verified=%s)", admin.email, admin.role, admin.is_email_verified)
            else:
                logger.info("Admin user already exists: %s", admin.email)
            return
        admin = User(
            email=settings.ADMIN_INITIAL_EMAIL,
            password_hash=get_password_hash(settings.ADMIN_INITIAL_PASSWORD),
            role="admin",
            category=None,
            is_verified_for_enrollment=False,
            is_email_verified=True,
        )
        db.add(admin)
        db.commit()
        logger.info("Admin user created: %s", admin.email)
    finally:
        db.close()
