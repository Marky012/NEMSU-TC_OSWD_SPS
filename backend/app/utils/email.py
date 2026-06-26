import smtplib
import logging
import time
import secrets
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional
from app.config import settings

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from app.database import SessionLocal
from app import models

def generate_registration_verification_email_html(email: str, code: str) -> str:
    """Generates a styled HTML email for the 6-digit registration verification code."""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Verify Your Email - NEMSU OSWD</title>
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #f7fafc; margin: 0; padding: 20px;">
        <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="background-color: #1a365d; padding: 20px; text-align: center; color: #ffffff;">
                <h2 style="margin: 0; font-size: 18px; letter-spacing: 1px;">NORTH EASTERN MINDANAO STATE UNIVERSITY</h2>
                <p style="margin: 5px 0 0 0; font-size: 13px; opacity: 0.9;">Office of Student Welfare and Development</p>
            </div>
            <div style="padding: 24px; text-align: center;">
                <h3 style="color: #2d3748; margin-top: 0;">Verify Your Email Address</h3>
                <p style="color: #4a5568; line-height: 1.5;">Thank you for creating an OSWD Student Profiling account. Use the 6-digit code below to verify your email address.</p>
                <div style="background-color: #ebf8ff; border: 1px solid #bee3f8; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <span style="font-size: 12px; text-transform: uppercase; color: #2b6cb0; font-weight: bold; display: block; margin-bottom: 8px;">Verification Code</span>
                    <strong style="font-size: 32px; color: #2b6cb0; letter-spacing: 6px;">{code}</strong>
                </div>
                <p style="color: #718096; font-size: 13px; line-height: 1.5;">This code will expire in <strong>15 minutes</strong>. If you did not create this account, please ignore this email.</p>
                <div style="border-top: 1px solid #edf2f7; padding-top: 15px; margin-top: 20px; font-size: 12px; color: #a0aec0;">
                    <p style="margin: 0;">This is an automated message from NEMSU OSWD. Do not reply to this email.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    """

def send_registration_verification_email(email: str, code: str) -> bool:
    """
    Sends the 6-digit verification code email for new account registration.
    Falls back to console mock logging when SMTP_HOST is empty.
    """
    if not check_email_rate_limit(email):
        logger.warning(f"Registration verification blocked: Rate limit exceeded for {email}")
        raise ValueError("Rate limit exceeded. Please try again later.")

    html_content = generate_registration_verification_email_html(email, code)

    if not settings.SMTP_HOST:
        logger.info(f"=== [MOCK EMAIL] Registration Verification ===")
        logger.info(f"To: {email}")
        logger.info(f"Subject: Verify Your Email - NEMSU OSWD")
        logger.info(f"Verification Code: {code}")
        logger.info(f"=== [END OF MOCK EMAIL] ===")
        return True

    max_retries = settings.EMAIL_MAX_RETRIES
    retry_delay = settings.EMAIL_RETRY_DELAY_SECONDS

    for attempt in range(max_retries):
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"Verify Your Email - NEMSU OSWD Student Profiling"
            msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
            msg["To"] = email
            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    server.starttls()
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL, [email], msg.as_string())

            logger.info(f"Registration verification email sent to {email}")
            return True
        except Exception as e:
            logger.warning(f"Failed to send verification email to {email} (attempt {attempt + 1}/{max_retries}): {str(e)}")
            if attempt < max_retries - 1:
                sleep_time = retry_delay * (2 ** attempt)
                logger.info(f"Retrying in {sleep_time} seconds...")
                time.sleep(sleep_time)
            else:
                logger.error(f"Failed to send verification email to {email} after {max_retries} attempts.")
                raise e

def generate_password_reset_email_html(email: str, reset_url: str) -> str:
    """Generates a styled HTML email for password reset."""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Reset Your Password - NEMSU OSWD</title>
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #f7fafc; margin: 0; padding: 20px;">
        <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="background-color: #1a365d; padding: 20px; text-align: center; color: #ffffff;">
                <h2 style="margin: 0; font-size: 18px; letter-spacing: 1px;">NORTH EASTERN MINDANAO STATE UNIVERSITY</h2>
                <p style="margin: 5px 0 0 0; font-size: 13px; opacity: 0.9;">Office of Student Welfare and Development</p>
            </div>
            <div style="padding: 24px; text-align: center;">
                <h3 style="color: #2d3748; margin-top: 0;">Reset Your Password</h3>
                <p style="color: #4a5568; line-height: 1.5;">We received a request to reset the password for your OSWD Student Profiling account.</p>
                <a href="{reset_url}" style="display: inline-block; background-color: #1a365d; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-size: 16px; font-weight: bold; margin: 20px 0;">Reset Password</a>
                <p style="color: #718096; font-size: 13px; line-height: 1.5;">This link will expire in <strong>1 hour</strong>. If you did not request a password reset, please ignore this email.</p>
                <p style="color: #718096; font-size: 12px; line-height: 1.5;">Or copy and paste this URL into your browser:<br><span style="color: #2b6cb0;">{reset_url}</span></p>
                <div style="border-top: 1px solid #edf2f7; padding-top: 15px; margin-top: 20px; font-size: 12px; color: #a0aec0;">
                    <p style="margin: 0;">This is an automated message from NEMSU OSWD. Do not reply to this email.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    """

def generate_password_reset_token() -> str:
    """Generate a secure random token for password reset."""
    return secrets.token_urlsafe(48)

def send_password_reset_email(email: str, reset_url: str) -> bool:
    """
    Sends password reset email with a magic link.
    Falls back to console mock logging when SMTP_HOST is empty.
    """
    if not check_email_rate_limit(email):
        logger.warning(f"Password reset blocked: Rate limit exceeded for {email}")
        raise ValueError("Rate limit exceeded. Please try again later.")

    html_content = generate_password_reset_email_html(email, reset_url)

    if not settings.SMTP_HOST:
        logger.info(f"=== [MOCK EMAIL] Password Reset ===")
        logger.info(f"To: {email}")
        logger.info(f"Subject: Reset Your Password - NEMSU OSWD")
        logger.info(f"Reset URL: {reset_url}")
        logger.info(f"=== [END OF MOCK EMAIL] ===")
        return True

    max_retries = settings.EMAIL_MAX_RETRIES
    retry_delay = settings.EMAIL_RETRY_DELAY_SECONDS

    for attempt in range(max_retries):
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "Reset Your Password - NEMSU OSWD Student Profiling"
            msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
            msg["To"] = email
            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    server.starttls()
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL, [email], msg.as_string())

            logger.info(f"Password reset email sent to {email}")
            return True
        except Exception as e:
            logger.warning(f"Failed to send password reset email to {email} (attempt {attempt + 1}/{max_retries}): {str(e)}")
            if attempt < max_retries - 1:
                sleep_time = retry_delay * (2 ** attempt)
                logger.info(f"Retrying in {sleep_time} seconds...")
                time.sleep(sleep_time)
            else:
                logger.error(f"Failed to send password reset email to {email} after {max_retries} attempts.")
                raise e

def check_email_rate_limit(email: str) -> bool:
    """
    Checks if the email is within the rate limit (max 5 emails per hour).
    Returns True if allowed, False if rate limit is exceeded.
    """
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        one_hour_ago = now - timedelta(hours=1)
        
        db.query(models.EmailRateLimit).filter(
            models.EmailRateLimit.email == email,
            models.EmailRateLimit.sent_at < one_hour_ago
        ).delete()
        db.commit()
        
        count = db.query(models.EmailRateLimit).filter(
            models.EmailRateLimit.email == email,
            models.EmailRateLimit.sent_at >= one_hour_ago
        ).count()
        
        if count >= 5:
            return False
            
        new_limit = models.EmailRateLimit(email=email, sent_at=now)
        db.add(new_limit)
        db.commit()
        return True
    finally:
        db.close()

def generate_verification_email_html(email: str, category: str, verification_code: str, summary_data: List[Dict[str, str]]) -> str:
    """Generates a styled HTML email displaying the submission summary and verification code."""
    
    # Generate table rows for the dynamic answers summary
    table_rows_html = ""
    for item in summary_data:
        question = item.get("question", "N/A")
        answer = item.get("answer", "N/A")
        table_rows_html += f"""
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #4a5568;">{question}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #2d3748;">{answer}</td>
        </tr>
        """
        
    html_template = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>NEMSU OSWD Enrollment Verification</title>
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #f7fafc; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="background-color: #1a365d; padding: 20px; text-align: center; color: #ffffff;">
                <h2 style="margin: 0; font-size: 20px; letter-spacing: 1px;">NORTH EASTERN MINDANAO STATE UNIVERSITY</h2>
                <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Office of Student Welfare and Development</p>
            </div>
            
            <div style="padding: 24px;">
                <h3 style="color: #2d3748; margin-top: 0;">Pre-Enrollment Profiling Completed</h3>
                <p style="color: #4a5568; line-height: 1.5;">Dear Student,</p>
                <p style="color: #4a5568; line-height: 1.5;">
                    Your OSWD Student Profile for the current semester has been successfully submitted and verified. 
                    Please present your email and the unique verification code below to the **Registrar's Office** to proceed with your enrollment.
                </p>
                
                <!-- Verification Code Banner -->
                <div style="background-color: #ebf8ff; border: 1px solid #bee3f8; border-radius: 6px; padding: 15px; text-align: center; margin: 20px 0;">
                    <span style="font-size: 12px; text-transform: uppercase; color: #2b6cb0; font-weight: bold; display: block; margin-bottom: 4px;">Unique Verification Code</span>
                    <strong style="font-size: 22px; color: #2b6cb0; letter-spacing: 1px;">{verification_code}</strong>
                </div>
                
                <h4 style="color: #2d3748; margin-bottom: 10px; border-bottom: 2px solid #edf2f7; padding-bottom: 5px;">Submission Details</h4>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
                    <tbody>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #4a5568; width: 40%;">Student Email</td>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #2d3748;">{email}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #4a5568;">Student Category</td>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #2d3748;">{category}</td>
                        </tr>
                        {table_rows_html}
                    </tbody>
                </table>
                
                <div style="border-top: 1px solid #edf2f7; padding-top: 15px; font-size: 12px; color: #a0aec0; text-align: center;">
                    <p style="margin: 0;">This is an automated verification email from OSWD. Do not reply to this message.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    return html_template

def send_verification_email(email: str, category: str, verification_code: str, summary_data: List[Dict[str, str]]) -> bool:
    """
    Sends the profile verification email containing the unique reference code and submission details.
    
    If SMTP_HOST configuration is not set, this mocks the operation by logging 
    the completed email template directly to the console.
    """
    # 1. Enforce rate limiting
    if not check_email_rate_limit(email):
        logger.warning(f"Email sending blocked: Rate limit exceeded for {email}")
        raise ValueError("Rate limit exceeded. You can only send up to 5 verification emails per hour.")
        
    html_content = generate_verification_email_html(email, category, verification_code, summary_data)
    
    # 2. Check if SMTP configuration is provided
    if not settings.SMTP_HOST:
        # Development Console Mock mode
        logger.info(f"=== [MOCK EMAIL SEND] ===")
        logger.info(f"To: {email}")
        logger.info(f"Subject: NEMSU OSWD Profile Verification - Code: {verification_code}")
        logger.info(f"Category: {category}")
        logger.info(f"Content Summary (text snippet):\n" + "\n".join([f" - {item['question']}: {item['answer']}" for item in summary_data[:5]]))
        logger.info(f"=== [END OF MOCK EMAIL] ===")
        return True
        
    
    max_retries = settings.EMAIL_MAX_RETRIES
    retry_delay = settings.EMAIL_RETRY_DELAY_SECONDS
    
    for attempt in range(max_retries):
        try:
            # Standard SMTP message composition
            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"NEMSU OSWD Enrollment Verification - Code: {verification_code}"
            msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
            msg["To"] = email
            
            # Attach HTML content
            msg.attach(MIMEText(html_content, "html"))
            
            # Connect to SMTP server
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    server.starttls()  # Secure connection via TLS
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL, [email], msg.as_string())
                
            logger.info(f"Verification email successfully sent to {email}")
            return True
        except Exception as e:
            logger.warning(f"Failed to send email to {email} (attempt {attempt + 1}/{max_retries}): {str(e)}")
            if attempt < max_retries - 1:
                sleep_time = retry_delay * (2 ** attempt)
                logger.info(f"Retrying in {sleep_time} seconds...")
                time.sleep(sleep_time)
            else:
                logger.error(f"Failed to send email to {email} after {max_retries} attempts.")
                raise e
