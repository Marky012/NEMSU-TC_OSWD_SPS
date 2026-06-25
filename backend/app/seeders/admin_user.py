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
    * If a user with that email is already present, the function does nothing.
    * Otherwise it creates a ``User`` with ``role='admin'`` and a bcrypt‑hashed
      password.
    * This function is deliberately lightweight and can be called on every
      application start without side‑effects.
    """
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == settings.ADMIN_INITIAL_EMAIL).first()
        if admin:
            logger.info("Admin user already exists: %s", admin.email)
            return
        # Create the admin user
        admin = User(
            email=settings.ADMIN_INITIAL_EMAIL,
            password_hash=get_password_hash(settings.ADMIN_INITIAL_PASSWORD),
            role="admin",
            category=None,
            is_verified_for_enrollment=False,
        )
        db.add(admin)
        db.commit()
        logger.info("✅ Admin user created: %s", admin.email)
    finally:
        db.close()
