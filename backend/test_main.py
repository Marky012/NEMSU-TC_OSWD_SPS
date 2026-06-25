import pytest
import json
from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal
from app.models import User, Submission, Answer, Semester, Question
from app.seeders.seed_questions import seed_database

# Initialize test client
client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    # Force rebuild database tables for clean test context
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    # Run seeders
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield

def test_health_endpoint():
    """Verify that the health check is active."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "online"

def test_auth_and_category_flow():
    """Verify registration, login, and student category selection."""
    # 1. Register a student
    reg_payload = {
        "email": "student1@nemsu.edu.ph",
        "password": "studentpassword"
    }
    response = client.post("/api/auth/register", json=reg_payload)
    assert response.status_code == 201
    assert response.json()["email"] == "student1@nemsu.edu.ph"
    assert response.json()["role"] == "student"
    assert response.json()["category"] is None
    
    # 2. Login student
    login_data = {
        "username": "student1@nemsu.edu.ph",
        "password": "studentpassword"
    }
    response = client.post("/api/auth/login", data=login_data)
    assert response.status_code == 200
    token_data = response.json()
    assert "access_token" in token_data
    token = token_data["access_token"]
    
    # 3. Access student profile (authenticated)
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/auth/profile", headers=headers)
    assert response.status_code == 200
    assert response.json()["email"] == "student1@nemsu.edu.ph"
    
    # 4. Set category as New
    cat_payload = {"category": "New"}
    response = client.post("/api/auth/category", json=cat_payload, headers=headers)
    assert response.status_code == 200
    assert response.json()["category"] == "New"

def test_admin_auth_and_protections():
    """Verify standard admin credentials and endpoint role checks."""
    # 1. Admin login with seeded credentials
    admin_login = {
        "username": "admin@nemsu.edu.ph",
        "password": "admin12345"
    }
    response = client.post("/api/auth/login", data=admin_login)
    assert response.status_code == 200
    admin_token = response.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # 2. Try fetching admin audit logs (should succeed)
    response = client.get("/api/admin/logs", headers=admin_headers)
    assert response.status_code == 200
    
    # 3. Create a normal student token
    student_login = {
        "username": "student1@nemsu.edu.ph",
        "password": "studentpassword"
    }
    response = client.post("/api/auth/login", data=student_login)
    student_token = response.json()["access_token"]
    student_headers = {"Authorization": f"Bearer {student_token}"}
    
    # 4. Try fetching admin audit logs as student (should fail with 403)
    response = client.get("/api/admin/logs", headers=student_headers)
    assert response.status_code == 403

def test_dynamic_form_fetching():
    """Verify that forms router retrieves category-specific dynamic questions."""
    # Log in student
    student_login = {
        "username": "student1@nemsu.edu.ph",
        "password": "studentpassword"
    }
    token = client.post("/api/auth/login", data=student_login).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get questions
    response = client.get("/api/forms/questions", headers=headers)
    assert response.status_code == 200
    questions = response.json()
    assert len(questions) > 0
    
    # Spot-check program dropdown question is present
    program_q = next((q for q in questions if q["system_key"] == "program"), None)
    assert program_q is not None
    assert program_q["field_type"] == "select"
    assert "BSED" in program_q["options"]

def test_student_draft_and_final_submit():
    """Simulates dynamic form rendering, draft saving, and final submissions."""
    # 1. Login student
    student_login = {
        "username": "student1@nemsu.edu.ph",
        "password": "studentpassword"
    }
    token = client.post("/api/auth/login", data=student_login).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Get questions to map dynamic database question IDs
    questions = client.get("/api/forms/questions", headers=headers).json()
    q_map = {q["system_key"]: q["id"] for q in questions if q["system_key"] is not None}
    
    # 3. Save draft progress
    draft_data = {
        "draft_data": {
            str(q_map["program"]): "BSCS",
            str(q_map["religion"]): "Catholic",
            str(q_map["active_contact_number"]): "09123456789"
        }
    }
    response = client.post("/api/students/draft", json=draft_data, headers=headers)
    assert response.status_code == 200
    assert response.json()["is_final"] is False
    assert response.json()["draft_data"][str(q_map["program"])] == "BSCS"
    
    # Verify active-submission route shows draft
    response = client.get("/api/students/active-submission", headers=headers)
    assert response.status_code == 200
    assert response.json()["is_final"] is False
    
    # 4. Final Submission - Assemble complete answers for all required questions
    answers_payload = []
    
    # Fill in Personal Information
    answers_payload.append({"question_id": q_map["surname"], "answer_text": "Santos"})
    answers_payload.append({"question_id": q_map["first_name"], "answer_text": "Maria"})
    answers_payload.append({"question_id": q_map["program"], "answer_text": "BSCS"})
    answers_payload.append({"question_id": q_map["year_level"], "answer_text": "1st Year"})
    answers_payload.append({"question_id": q_map["birthdate"], "answer_text": "2005-12-15"})
    answers_payload.append({"question_id": q_map["active_contact_number"], "answer_text": "09171234567"})
    answers_payload.append({"question_id": q_map["emergency_contact_name"], "answer_text": "Maria Santos"})
    answers_payload.append({"question_id": q_map["emergency_contact_number"], "answer_text": "09187654321"})
    answers_payload.append({"question_id": q_map["religion"], "answer_text": "Catholic"})
    answers_payload.append({"question_id": q_map["gender"], "answer_text": "Female"})
    answers_payload.append({"question_id": q_map["marital_status"], "answer_text": "Single"})
    answers_payload.append({"question_id": q_map["present_home_address"], "answer_text": "Purok 1, Brgy. Diatagon"})
    answers_payload.append({"question_id": q_map["house_ownership"], "answer_text": "Yes"})
    answers_payload.append({"question_id": q_map["barangay_name"], "answer_text": "Diatagon"})
    answers_payload.append({"question_id": q_map["municipality"], "answer_text": "Lianga"})
    answers_payload.append({"question_id": q_map["region"], "answer_text": "Caraga"})
    answers_payload.append({"question_id": q_map["estimated_household_income"], "answer_text": "12500"})
    answers_payload.append({"question_id": q_map["number_of_siblings"], "answer_text": "4"})
    answers_payload.append({"question_id": q_map["birth_order"], "answer_text": "1st"})
    
    # Fill in IP
    answers_payload.append({"question_id": q_map["indigenous_peoples_none"], "answer_text": "I do not belong to IP"})
    
    # Fill in Solo Parent & PWD
    answers_payload.append({"question_id": q_map["is_solo_parent_currently_studying"], "answer_text": "No"})
    answers_payload.append({"question_id": q_map["is_child_of_solo_parent"], "answer_text": "No"})
    
    # Trigger PWD Card Follow-Up task check
    answers_payload.append({"question_id": q_map["is_pwd"], "answer_text": "Yes"})
    answers_payload.append({"question_id": q_map["pwd_card_status"], "answer_text": "No, but would like to have one"})
    
    # Fill in Internet Tech
    answers_payload.append({"question_id": q_map["primary_mode_of_residence"], "answer_text": "Commuter with family"})
    answers_payload.append({"question_id": q_map["cellphone_type"], "answer_text": "Basic Phone"})  # Shortcut submission
    answers_payload.append({"question_id": q_map["preferred_learning_modality"], "answer_text": "100% On-site"})

    # Submit finalized profiling details
    submit_payload = {"answers": answers_payload}
    response = client.post("/api/students/submit", json=submit_payload, headers=headers)
    
    assert response.status_code == 200
    result = response.json()
    assert result["is_final"] is True
    assert result["verification_code"] is not None
    assert "OSWD-" in result["verification_code"]
    
    # Double-check sub duplication lock is enforced
    response2 = client.post("/api/students/submit", json=submit_payload, headers=headers)
    assert response2.status_code == 400

def test_admin_workflows_and_verification():
    """Verify bulk student verifications and PWD follow-up tasks."""
    # 1. Login admin
    admin_login = {
        "username": "admin@nemsu.edu.ph",
        "password": "admin12345"
    }
    admin_token = client.post("/api/auth/login", data=admin_login).json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # 2. Check the student PWD card follow-up task triggered during previous test submission
    response = client.get("/api/admin/pwd-tasks", headers=admin_headers)
    assert response.status_code == 200
    tasks = response.json()
    assert len(tasks) > 0
    task_id = tasks[0]["id"]
    assert tasks[0]["student_email"] == "student1@nemsu.edu.ph"
    assert tasks[0]["status"] == "pending"
    
    # Update PWD task status to in_progress
    task_payload = {"status": "in_progress", "notes": "Staff following up with DSWD local office."}
    response = client.put(f"/api/admin/pwd-tasks/{task_id}", json=task_payload, headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"
    
    # 3. Get Student User ID
    student_user = client.get("/api/auth/profile", headers={"Authorization": f"Bearer {client.post('/api/auth/login', data={'username':'student1@nemsu.edu.ph','password':'studentpassword'}).json()['access_token']}"}).json()
    student_id = student_user["id"]
    assert student_user["is_verified_for_enrollment"] is False
    
    # Bulk Verify student
    verify_payload = [student_id]
    response = client.post("/api/admin/verify-bulk", json=verify_payload, headers=admin_headers)
    assert response.status_code == 200
    assert "student1@nemsu.edu.ph" in response.json()["verified_emails"]

def test_analytics_and_ched_reports():
    """Verify metrics calculation, PDF/CSV generation, and general spreadsheet exports."""
    # 1. Login admin
    admin_login = {
        "username": "admin@nemsu.edu.ph",
        "password": "admin12345"
    }
    admin_token = client.post("/api/auth/login", data=admin_login).json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # 2. Verify dashboard analytics
    response = client.get("/api/reports/dashboard-stats", headers=admin_headers)
    assert response.status_code == 200
    stats = response.json()
    assert stats["summary"]["total_submissions"] == 1
    assert stats["charts"]["programs"]["BSCS"] == 1
    
    # 3. Verify CHED Report JSON endpoints
    for i in [1, 2, 3, 4, 5]:
        response = client.get(f"/api/reports/ched-report/{i}", headers=admin_headers)
        assert response.status_code == 200
        report = response.json()
        assert "report_title" in report
        assert len(report["data"]) > 0
        
    # 4. Verify CSV Export
    response = client.get("/api/reports/ched-report/1/export-csv", headers=admin_headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"
    assert "attachment; filename=" in response.headers["content-disposition"]
    csv_data = response.text
    assert "BSCS" in csv_data
    
    # 5. Verify PDF Export (ReportLab generation)
    response = client.get("/api/reports/ched-report/1/export-pdf", headers=admin_headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "attachment; filename=" in response.headers["content-disposition"]
    pdf_bytes = response.content
    assert len(pdf_bytes) > 1000  # Confirms PDF binary has content
    
    # 6. Verify flat-file General CSV Export of all profiling answers
    response = client.get("/api/reports/submissions/export-csv", headers=admin_headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"
    csv_data_flat = response.text
    assert "student1@nemsu.edu.ph" in csv_data_flat
    assert "BSCS" in csv_data_flat
    assert "Diatagon" in csv_data_flat
    
    # 7. Verify new CHED template CSV exports match frontend table formats
    response = client.get("/api/reports/ched-consolidated/export-csv", headers=admin_headers)
    assert response.status_code == 200
    assert "Male" in response.text
    assert "Female" in response.text
    assert "Grand Total" in response.text
    
    response = client.get("/api/reports/ched-program/export-csv", headers=admin_headers)
    assert response.status_code == 200
    assert "Degree Program" in response.text
    assert "BSCS" in response.text
    assert "Grand Total" in response.text
    
    response = client.get("/api/reports/ched-sex-year/export-csv", headers=admin_headers)
    assert response.status_code == 200
    assert "Degree Program" in response.text
    assert "BSCS" in response.text
    assert "Total" in response.text
