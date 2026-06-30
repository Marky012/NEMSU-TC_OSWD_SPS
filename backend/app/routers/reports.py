import io
import csv
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.dependencies import DownloadRoleChecker, RoleChecker
from sqlalchemy.orm import joinedload, selectinload

# ReportLab PDF modules
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

router = APIRouter(prefix="/api/reports", tags=["Analytics & Reports"])

# --- HELPERS FOR DATA RETRIEVAL ---

def get_submission_data_map(db: Session, submission: models.Submission) -> Dict[str, str]:
    """Retrieves answers for a submission and maps them as {system_key: answer_text} or {question_id: answer_text}."""
    data = {}
    for ans in submission.answers:
        q = ans.question
        if q:
            key = q.system_key if q.system_key else str(q.id)
            data[key] = ans.answer_text
    return data

def get_filtered_submissions(db: Session, program: Optional[str] = None, year_level: Optional[str] = None, 
                             category: Optional[str] = None, ip_group: Optional[str] = None, 
                             pwd_status: Optional[str] = None, solo_parent: Optional[str] = None,
                             internet_access: Optional[str] = None, start_date: Optional[str] = None,
                             end_date: Optional[str] = None,
                             semester_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """Fetches and filters finalized submissions based on standard search parameters."""
    query = db.query(models.Submission).options(
        joinedload(models.Submission.user),
        selectinload(models.Submission.answers).joinedload(models.Answer.question)
    ).filter(models.Submission.is_final == True)
    
    # Filter by semester if provided
    if semester_id:
        query = query.filter(models.Submission.semester_id == semester_id)
    
    # Filter by date range if provided
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(models.Submission.submitted_at >= start_dt)
        except ValueError:
            pass
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            # Include entire end day
            end_dt = end_dt.replace(hour=23, minute=59, second=59)
            query = query.filter(models.Submission.submitted_at <= end_dt)
        except ValueError:
            pass
            
    submissions = query.all()
    filtered = []
    
    for sub in submissions:
        student = sub.user
        if not student:
            continue
            
        # Category Filter (DB level check on user)
        if category and student.category != category:
            continue
            
        answers_map = get_submission_data_map(db, sub)
        
        # Program Filter
        if program and answers_map.get("program") != program:
            continue
            
        # Year Level Filter
        if year_level and answers_map.get("year_level") != year_level:
            continue
            
        # PWD Status Filter
        if pwd_status:
            is_pwd = answers_map.get("is_pwd", "")
            wants_pwd = (pwd_status.upper() == "YES")
            if (is_pwd == "Yes") != wants_pwd:
                continue

        # Solo Parent Filter
        if solo_parent:
            is_solo = answers_map.get("is_solo_parent_currently_studying") == "Yes" or answers_map.get("is_child_of_solo_parent") == "Yes"
            wants_solo = (solo_parent.upper() == "YES")
            if is_solo != wants_solo:
                continue

        # IP Group Filter
        if ip_group:
            is_ip = answers_map.get("indigenous_peoples_none", "")
            if is_ip != "Yes":
                continue
            ip_ans = answers_map.get("indigenous_peoples_group", "")
            if not ip_ans:
                continue
            if ip_group != ip_ans:
                continue

        # Internet Access Filter
        if internet_access and answers_map.get("internet_access_method") != internet_access:
            continue
            
        filtered.append({
            "submission": sub,
            "student": student,
            "answers": answers_map
        })
        
    return filtered


# --- ANALYTICS DASHBOARD STATS ---

@router.get("/dashboard-stats")
def get_dashboard_statistics(
    program: Optional[str] = Query(None),
    year_level: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    ip_group: Optional[str] = Query(None),
    pwd_status: Optional[str] = Query(None),
    solo_parent: Optional[str] = Query(None),
    internet_access: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_admin: models.User = Depends(RoleChecker(allowed_roles=["admin", "verification_officer", "analytics_viewer"])),
    db: Session = Depends(get_db)
):
    """Retrieves aggregated statistics for rendering interactive Chart.js graphs on the admin dashboard."""
    records = get_filtered_submissions(
        db, program, year_level, category, ip_group, pwd_status, solo_parent, internet_access, start_date, end_date
    )
    
    total_submissions = len(records)
    total_drafts = db.query(models.Submission).filter(models.Submission.is_final == False).count()
    total_users = db.query(models.User).filter(models.User.role == "student").count()
    total_verified = db.query(models.User).filter(models.User.role == "student", models.User.is_verified_for_enrollment == True).count()
    pending_pwd_tasks = db.query(models.PWDAssistanceTask).filter(models.PWDAssistanceTask.status == "pending").count()
    
    # Category Distribution (merge Continuing + Returnee into Returning)
    category_map = {"New": "New", "Transferee": "Transferee", "Returnee": "Returning", "Continuing": "Returning"}
    category_counts = {"New": 0, "Transferee": 0, "Returning": 0}
    # Program Distribution
    program_counts = {}
    # Preferred Learning Modalities
    modality_counts = {}
    # Internet Reliability
    reliability_counts = {}
    
    for r in records:
        cat = r["student"].category
        merged = category_map.get(cat)
        if merged:
            category_counts[merged] += 1
            
        prog = r["answers"].get("program", "Not Specified")
        program_counts[prog] = program_counts.get(prog, 0) + 1
        
        mod = r["answers"].get("preferred_learning_modality", "Not Specified")
        # Shorten text for clean chart labels
        short_mod = mod.split(" (")[0] if " (" in mod else mod
        modality_counts[short_mod] = modality_counts.get(short_mod, 0) + 1
        
        rel = r["answers"].get("internet_speed_rating", "Not Specified")
        reliability_counts[rel] = reliability_counts.get(rel, 0) + 1
        
    return {
        "summary": {
            "total_submissions": total_submissions,
            "total_drafts": total_drafts,
            "total_registered_students": total_users,
            "total_verified_students": total_verified,
            "pending_pwd_tasks": pending_pwd_tasks
        },
        "charts": {
            "categories": category_counts,
            "programs": program_counts,
            "modalities": modality_counts,
            "internet_reliability": reliability_counts
        }
    }


# --- PRE-BUILT CHED REPORT ENGINE ---

def generate_ched_dataset(db: Session, report_num: int) -> Dict[str, Any]:
    """Generates the data structure (headers and rows) for the 5 pre-built CHED Reports."""
    records = get_filtered_submissions(db)
    
    if report_num == 1:
        # REPORT 1: Student counts per program/year level
        # Setup grid structure
        programs = ["Bachelor of Secondary Education", "Bachelor of Science in Business Administration major in Human Resource Management", "Bachelor of Science in Accountancy", "Bachelor of Science in Business Administration major in Financial Management", "Bachelor of Elementary Education", "Bachelor of Science in Computer Science", "Bachelor of Arts in Tourism", "Bachelor of Science in Hospitality Management", "Other"]
        years = ["1st Year", "2nd Year", "3rd Year", "4th Year", "Unspecified"]
        
        grid = {p: {y: 0 for y in years} for p in programs}
        
        for r in records:
            p = r["answers"].get("program", "Other")
            if p not in grid:
                p = "Other"
            y = r["answers"].get("year_level", "Unspecified")
            if y not in grid[p]:
                y = "Unspecified"
            grid[p][y] += 1
            
        rows = []
        for p in programs:
            row_sum = sum(grid[p].values())
            rows.append({
                "Program": p,
                "1st Year": grid[p]["1st Year"],
                "2nd Year": grid[p]["2nd Year"],
                "3rd Year": grid[p]["3rd Year"],
                "4th Year": grid[p]["4th Year"],
                "Unspecified/Other": grid[p]["Unspecified"],
                "Total Students": row_sum
            })
            
        return {
            "title": "CHED Report 1: Student Counts per Program and Year Level",
            "headers": ["Program", "1st Year", "2nd Year", "3rd Year", "4th Year", "Unspecified/Other", "Total Students"],
            "rows": rows
        }
        
    elif report_num == 2:
        # REPORT 2: PWD Summary (counts per disability type)
        disabilities = [
            "Apparent Physical",
            "Deaf/Hard of Hearing",
            "Visual",
            "Learning Disability",
            "Mental/Psychosocial",
            "Speech/Language",
            "Non-apparent Cancer",
            "Non-apparent Rare Disease",
            "Intellectual Disability"
        ]
        counts = {d: 0 for d in disabilities}
        counts["Other/Unspecified PWD"] = 0
        total_pwd = 0
        
        for r in records:
            if r["answers"].get("is_pwd") == "Yes":
                total_pwd += 1
                type_ans = r["answers"].get("pwd_disability_type")
                if not type_ans:
                    counts["Other/Unspecified PWD"] += 1
                    continue
                    
                # pwd_disability_type is multi-select (JSON string), check matches
                import json
                try:
                    type_list = json.loads(type_ans) if isinstance(type_ans, str) else type_ans
                except (json.JSONDecodeError, TypeError):
                    type_list = [type_ans] if type_ans else []
                matched = False
                for d in disabilities:
                    if d in type_list:
                        counts[d] += 1
                        matched = True
                if not matched:
                    counts["Other/Unspecified PWD"] += 1
                    
        rows = [{"Disability Type": k, "Student Count": v} for k, v in counts.items()]
        rows.append({"Disability Type": "TOTAL UNIQUE PWD STUDENTS", "Student Count": total_pwd})
        
        return {
            "title": "CHED Report 2: Persons with Disabilities (PWD) Summary",
            "headers": ["Disability Type", "Student Count"],
            "rows": rows
        }
        
    elif report_num == 3:
        # REPORT 3: IP Summary (counts per IP group)
        ip_groups = ["BLAAN", "MAMANWA", "MANGYAN", "SUBANEN", "BUKIDNON", "MANDAYA", "MANOBO", "T’BOLI"]
        counts = {ip: 0 for ip in ip_groups}
        counts["Specifialized/Others IP"] = 0
        counts["Non-IP Students"] = 0
        
        for r in records:
            is_ip = r["answers"].get("indigenous_peoples_none", "")
            if is_ip != "Yes":
                counts["Non-IP Students"] += 1
                continue
                
            ip_ans = r["answers"].get("indigenous_peoples_group", "")
            if not ip_ans or ip_ans == "Others":
                counts["Specifialized/Others IP"] += 1
                continue
                
            matched = False
            for ip in ip_groups:
                if ip_ans == ip:
                    counts[ip] += 1
                    matched = True
            if not matched:
                counts["Specifialized/Others IP"] += 1
                
        rows = [{"Indigenous Group (IP)": k, "Student Count": v} for k, v in counts.items()]
        
        return {
            "title": "CHED Report 3: Indigenous Peoples (IP) Student Counts",
            "headers": ["Indigenous Group (IP)", "Student Count"],
            "rows": rows
        }
        
    elif report_num == 4:
        # REPORT 4: Internet & Device Access Summary
        total = len(records)
        if total == 0:
            return {
                "title": "CHED Report 4: Internet & Digital Technology Access Summary",
                "headers": ["Technology Indicator Metric", "Value / Count", "Percentage"],
                "rows": [{"Technology Indicator Metric": "No Submissions Found", "Value / Count": 0, "Percentage": "0.0%"}]
            }
            
        smartphones = 0
        basic_phones = 0
        laptops = 0
        tablets = 0
        no_internet_at_home = 0
        load_tier_10_50 = 0
        load_tier_51_100 = 0
        load_tier_101_150 = 0
        load_tier_over_150 = 0
        
        for r in records:
            cell = r["answers"].get("cellphone_type", "")
            if cell == "Smartphone":
                smartphones += 1
            elif cell == "Basic Phone":
                basic_phones += 1
                
            gadget = r["answers"].get("gadgets_owned", "")
            if "laptop" in gadget.lower() or gadget == "Both smartphone and laptop":
                laptops += 1
            if "tablet" in gadget.lower():
                tablets += 1
                
            net_access = r["answers"].get("internet_access_method", "")
            if "no access" in net_access.lower():
                no_internet_at_home += 1
                
            load = r["answers"].get("weekly_internet_expense", "")
            if load == "Php 10-50":
                load_tier_10_50 += 1
            elif load == "Php 51-100":
                load_tier_51_100 += 1
            elif load == "Php 101-150":
                load_tier_101_150 += 1
            elif load in ("More than Php 150",):
                load_tier_over_150 += 1
                
        rows = [
            {"Technology Indicator Metric": "Total Profiling Submissions", "Value / Count": total, "Percentage": "100.0%"},
            {"Technology Indicator Metric": "Primary Cellphone: Smartphone Users", "Value / Count": smartphones, "Percentage": f"{smartphones/total*100:.1f}%"},
            {"Technology Indicator Metric": "Primary Cellphone: Basic Phone Users", "Value / Count": basic_phones, "Percentage": f"{basic_phones/total*100:.1f}%"},
            {"Technology Indicator Metric": "Secondary Device: Laptop Owners", "Value / Count": laptops, "Percentage": f"{laptops/total*100:.1f}%"},
            {"Technology Indicator Metric": "Secondary Device: Tablet Owners", "Value / Count": tablets, "Percentage": f"{tablets/total*100:.1f}%"},
            {"Technology Indicator Metric": "Access: No Internet Access at Primary Residence", "Value / Count": no_internet_at_home, "Percentage": f"{no_internet_at_home/total*100:.1f}%"},
            {"Technology Indicator Metric": "Weekly Mobile Load Expense: Php 10 - 50", "Value / Count": load_tier_10_50, "Percentage": f"{load_tier_10_50/total*100:.1f}%"},
            {"Technology Indicator Metric": "Weekly Mobile Load Expense: Php 51 - 100", "Value / Count": load_tier_51_100, "Percentage": f"{load_tier_51_100/total*100:.1f}%"},
            {"Technology Indicator Metric": "Weekly Mobile Load Expense: Php 101 - 150", "Value / Count": load_tier_101_150, "Percentage": f"{load_tier_101_150/total*100:.1f}%"},
            {"Technology Indicator Metric": "Weekly Mobile Load Expense: > Php 150", "Value / Count": load_tier_over_150, "Percentage": f"{load_tier_over_150/total*100:.1f}%"}
        ]
        
        return {
            "title": "CHED Report 4: Internet & Digital Technology Access Summary",
            "headers": ["Technology Indicator Metric", "Value / Count", "Percentage"],
            "rows": rows
        }
        
    elif report_num == 5:
        # REPORT 5: Solo Parent Summary
        solo_parents = 0
        children_of_solo = 0
        total_records = len(records)
        
        for r in records:
            if r["answers"].get("is_solo_parent_currently_studying") == "Yes":
                solo_parents += 1
            if r["answers"].get("is_child_of_solo_parent") == "Yes":
                children_of_solo += 1
                
        rows = [
            {"Student Solo Parent Indicator": "Solo Parent Currently Studying", "Student Count": solo_parents, "Percentage of Total": f"{solo_parents/total_records*100:.1f}%" if total_records > 0 else "0.0%"},
            {"Student Solo Parent Indicator": "Son / Daughter of a Solo Parent", "Student Count": children_of_solo, "Percentage of Total": f"{children_of_solo/total_records*100:.1f}%" if total_records > 0 else "0.0%"},
            {"Student Solo Parent Indicator": "Total Semester Submissions Checked", "Student Count": total_records, "Percentage of Total": "100.0%"}
        ]
        
        return {
            "title": "CHED Report 5: Solo Parents & Children of Solo Parents Statistics",
            "headers": ["Student Solo Parent Indicator", "Student Count", "Percentage of Total"],
            "rows": rows
        }
        
    else:
        raise HTTPException(status_code=400, detail="Invalid pre-built CHED report number (1-5).")


# --- JSON FETCH ENDPOINT ---

@router.get("/ched-report/{report_num}", response_model=schemas.SummaryReport)
def get_ched_report_data(
    report_num: int,
    current_admin: models.User = Depends(RoleChecker(allowed_roles=["admin", "verification_officer", "analytics_viewer"])),
    db: Session = Depends(get_db)
):
    """Retrieves dataset for a specific pre-built CHED report in JSON format."""
    data_res = generate_ched_dataset(db, report_num)
    return schemas.SummaryReport(
        report_title=data_res["title"],
        generated_at=datetime.now(timezone.utc),
        data=data_res["rows"]
    )


# --- EXPORT TO CSV ENDPOINT ---

@router.get("/ched-report/{report_num}/export-csv")
def export_ched_report_csv(
    report_num: int,
    current_admin: models.User = Depends(RoleChecker(allowed_roles=["admin", "verification_officer", "analytics_viewer"])),
    db: Session = Depends(get_db)
):
    """Exports a specific pre-built CHED report as a streaming CSV file download."""
    data_res = generate_ched_dataset(db, report_num)
    headers = data_res["headers"]
    rows = data_res["rows"]
    
    # Create an in-memory text buffer
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write Title & Metadata
    writer.writerow([data_res["title"].upper()])
    writer.writerow(["Generated At:", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")])
    writer.writerow([])
    
    # Write Table Headers
    writer.writerow(headers)
    
    # Write Rows
    for r in rows:
        row_vals = [r.get(h, "") for h in headers]
        writer.writerow(row_vals)
        
    output.seek(0)
    
    # Log action
    log = models.AdminLog(
        admin_id=current_admin.id,
        action="export_report_csv",
        details=f"Exported CHED Report {report_num} as CSV",
        timestamp=datetime.now(timezone.utc)
    )
    db.add(log)
    db.commit()
    
    filename = f"OSWD_CHED_Report_{report_num}_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# --- CHED TEMPLATE CSV EXPORTS (Match Frontend Preview Tables) ---

@router.get("/ched-consolidated/export-csv")
def export_ched_consolidated_csv(
    semester_id: Optional[int] = Query(None, description="Filter by semester ID"),
    current_admin: models.User = Depends(DownloadRoleChecker(allowed_roles=["admin", "verification_officer", "analytics_viewer"])),
    db: Session = Depends(get_db)
):
    """Exports the CHEDRO Consolidated table as CSV matching the frontend preview."""
    records = get_filtered_submissions(db, semester_id=semester_id)

    sex_counts = {"Male": 0, "Female": 0}
    year_counts = {"1st": 0, "2nd": 0, "3rd": 0, "4th": 0, "5th": 0, "6th": 0}
    disability_types = {}
    ip_total = 0
    solo_parent_total = 0
    child_of_solo_parent = 0
    senior_citizen = 0
    magna_carta_poor = 0
    underprivileged = 0

    disabilities = [
        "Apparent Physical", "Deaf/Hard of Hearing", "Intellectual Disability",
        "Learning Disability", "Mental/Psychosocial", "Visual",
        "Speech/Language", "Non-apparent Cancer", "Non-apparent Rare Disease"
    ]

    for r in records:
        sex = r["answers"].get("gender", "")
        if sex == "Male":
            sex_counts["Male"] += 1
        elif sex == "Female":
            sex_counts["Female"] += 1

        year = r["answers"].get("year_level", "")
        year = year.split(" ")[0] if year else ""
        if year in year_counts:
            year_counts[year] += 1

        if r["answers"].get("is_pwd") == "Yes":
            type_ans = r["answers"].get("pwd_disability_type")
            if type_ans:
                try:
                    type_list = json.loads(type_ans) if isinstance(type_ans, str) else type_ans
                except (json.JSONDecodeError, TypeError):
                    type_list = [type_ans] if type_ans else []
                for d in type_list:
                    disability_types[d] = disability_types.get(d, 0) + 1

        if r["answers"].get("indigenous_peoples_none") == "Yes":
            ip_total += 1
        if r["answers"].get("is_solo_parent_currently_studying") == "Yes":
            solo_parent_total += 1
        if r["answers"].get("is_child_of_solo_parent") == "Yes":
            child_of_solo_parent += 1
        if r["submission"].is_senior_citizen:
            senior_citizen += 1
        if r["submission"].is_magna_carta_poor:
            magna_carta_poor += 1
        if r["submission"].is_underprivileged:
            underprivileged += 1

    pwd_total = sum(disability_types.get(d, 0) for d in disabilities)
    total_students = len(records)

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["Sex", "", "Year Level", "", "", "", "", "", "PWD Distribution", "", "", "", "", "", "", "", "", "", "IP", "Solo Parent", "Dep. of Solo Parent", "Senior Citizen", "Magna Carta Poor", "Underprivileged", "Grand Total"])
    writer.writerow([
        "Male", "Female",
        "1st", "2nd", "3rd", "4th", "5th", "6th",
        "Apparent Physical Disability", "Deaf/Hard of Hearing Disability", "Intellectual Disability",
        "Learning Disability", "Mental/Psychosocial Disability", "Visual Disability",
        "Speech and Language Impairment", "Non-apparent Cancer", "Non-apparent Rare Disease", "Total",
        "", "", "", "", "", "", ""
    ])
    writer.writerow([
        sex_counts["Male"], sex_counts["Female"],
        year_counts["1st"], year_counts["2nd"], year_counts["3rd"], year_counts["4th"], year_counts["5th"], year_counts["6th"],
        disability_types.get("Apparent Physical", 0),
        disability_types.get("Deaf/Hard of Hearing", 0),
        disability_types.get("Intellectual Disability", 0),
        disability_types.get("Learning Disability", 0),
        disability_types.get("Mental/Psychosocial", 0),
        disability_types.get("Visual", 0),
        disability_types.get("Speech/Language", 0),
        disability_types.get("Non-apparent Cancer", 0),
        disability_types.get("Non-apparent Rare Disease", 0),
        pwd_total,
        ip_total,
        solo_parent_total,
        child_of_solo_parent,
        senior_citizen, magna_carta_poor, underprivileged,
        total_students
    ])

    output.seek(0)

    log = models.AdminLog(
        admin_id=current_admin.id,
        action="export_report_csv",
        details="Exported CHED Consolidated CSV",
        timestamp=datetime.now(timezone.utc)
    )
    db.add(log)
    db.commit()

    filename = f"OSWD_CHED_Consolidated_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/ched-program/export-csv")
def export_ched_program_csv(
    semester_id: Optional[int] = Query(None, description="Filter by semester ID"),
    current_admin: models.User = Depends(DownloadRoleChecker(allowed_roles=["admin", "verification_officer", "analytics_viewer"])),
    db: Session = Depends(get_db)
):
    """Exports the By Program (SEGs) table as CSV matching the frontend preview."""
    records = get_filtered_submissions(db, semester_id=semester_id)

    programs = {}
    for r in records:
        prog = r["answers"].get("program", "Unspecified")
        if prog not in programs:
            programs[prog] = {
                "disability_types": {},
                "ip_groups": set(),
                "ip_total": 0,
                "solo_parent": 0,
                "child_of_solo": 0,
                "senior_citizen": 0,
                "magna_carta_poor": 0,
                "underprivileged": 0,
                "total": 0,
            }
        p = programs[prog]
        p["total"] += 1

        if r["answers"].get("is_pwd") == "Yes":
            type_ans = r["answers"].get("pwd_disability_type")
            if type_ans:
                try:
                    type_list = json.loads(type_ans) if isinstance(type_ans, str) else type_ans
                except (json.JSONDecodeError, TypeError):
                    type_list = [type_ans] if type_ans else []
                for d in type_list:
                    p["disability_types"][d] = p["disability_types"].get(d, 0) + 1

        if r["answers"].get("indigenous_peoples_none") == "Yes":
            p["ip_total"] += 1
            group = r["answers"].get("indigenous_peoples_group", "")
            if group:
                p["ip_groups"].add(group)
        if r["answers"].get("is_solo_parent_currently_studying") == "Yes":
            p["solo_parent"] += 1
        if r["answers"].get("is_child_of_solo_parent") == "Yes":
            p["child_of_solo"] += 1
        if r["submission"].is_senior_citizen:
            p["senior_citizen"] += 1
        if r["submission"].is_magna_carta_poor:
            p["magna_carta_poor"] += 1
        if r["submission"].is_underprivileged:
            p["underprivileged"] += 1

    output = io.StringIO()
    writer = csv.writer(output)

    headers = [
        "Degree Program",
        "Apparent Physical Disability", "Deaf/Hard of Hearing Disability",
        "Intellectual Disability", "Learning Disability", "Mental/Psychosocial Disability",
        "Visual Disability", "Speech and Language Impairment",
        "Non-apparent Cancer", "Non-apparent Rare Disease",
        "PWD Total", "IP (Ethnolinguistic)", "IP Total",
        "Solo Parent", "Dep. of Solo", "Senior Citizen",
        "Magna Carta Poor", "Underprivileged", "Grand Total"
    ]
    writer.writerow(headers)

    for prog in sorted(programs.keys()):
        p = programs[prog]
        pwd_total = sum(
            p["disability_types"].get(d, 0) for d in [
                "Apparent Physical", "Deaf/Hard of Hearing", "Intellectual Disability",
                "Learning Disability", "Mental/Psychosocial", "Visual",
                "Speech/Language", "Non-apparent Cancer", "Non-apparent Rare Disease"
            ]
        )
        ip_groups_str = ", ".join(sorted(p["ip_groups"])) if p["ip_groups"] else "-"
        writer.writerow([
            prog,
            p["disability_types"].get("Apparent Physical", 0),
            p["disability_types"].get("Deaf/Hard of Hearing", 0),
            p["disability_types"].get("Intellectual Disability", 0),
            p["disability_types"].get("Learning Disability", 0),
            p["disability_types"].get("Mental/Psychosocial", 0),
            p["disability_types"].get("Visual", 0),
            p["disability_types"].get("Speech/Language", 0),
            p["disability_types"].get("Non-apparent Cancer", 0),
            p["disability_types"].get("Non-apparent Rare Disease", 0),
            pwd_total,
            ip_groups_str,
            p["ip_total"],
            p["solo_parent"],
            p["child_of_solo"],
            p["senior_citizen"],
            p["magna_carta_poor"],
            p["underprivileged"],
            p["total"],
        ])

    output.seek(0)

    log = models.AdminLog(
        admin_id=current_admin.id,
        action="export_report_csv",
        details="Exported CHED By Program CSV",
        timestamp=datetime.now(timezone.utc)
    )
    db.add(log)
    db.commit()

    filename = f"OSWD_CHED_ByProgram_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/ched-sex-year/export-csv")
def export_ched_sex_year_csv(
    semester_id: Optional[int] = Query(None, description="Filter by semester ID"),
    current_admin: models.User = Depends(DownloadRoleChecker(allowed_roles=["admin", "verification_officer", "analytics_viewer"])),
    db: Session = Depends(get_db)
):
    """Exports the By Sex & Year Level table as CSV matching the frontend preview."""
    records = get_filtered_submissions(db, semester_id=semester_id)

    programs = {}
    for r in records:
        prog = r["answers"].get("program", "Unspecified")
        if prog not in programs:
            programs[prog] = {"Male": 0, "Female": 0, "years": {"1st": 0, "2nd": 0, "3rd": 0, "4th": 0, "5th": 0, "6th": 0}}
        p = programs[prog]

        sex = r["answers"].get("gender", "")
        if sex == "Male":
            p["Male"] += 1
        elif sex == "Female":
            p["Female"] += 1

        year = r["answers"].get("year_level", "")
        year = year.split(" ")[0] if year else ""
        if year in p["years"]:
            p["years"][year] += 1

    output = io.StringIO()
    writer = csv.writer(output)

    headers = [
        "Degree Program",
        "Male", "Female", "Total",
        "1st", "2nd", "3rd", "4th", "5th", "6th", "Total"
    ]
    writer.writerow(headers)

    for prog in sorted(programs.keys()):
        p = programs[prog]
        total = p["Male"] + p["Female"]
        writer.writerow([
            prog,
            p["Male"], p["Female"], total,
            p["years"]["1st"], p["years"]["2nd"], p["years"]["3rd"],
            p["years"]["4th"], p["years"]["5th"], p["years"]["6th"],
            total,
        ])

    output.seek(0)

    log = models.AdminLog(
        admin_id=current_admin.id,
        action="export_report_csv",
        details="Exported CHED By Sex & Year Level CSV",
        timestamp=datetime.now(timezone.utc)
    )
    db.add(log)
    db.commit()

    filename = f"OSWD_CHED_SexYear_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# --- EXPORT TO PDF ENDPOINT (REPORTLAB) ---

@router.get("/ched-report/{report_num}/export-pdf")
def export_ched_report_pdf(
    report_num: int,
    current_admin: models.User = Depends(RoleChecker(allowed_roles=["admin", "verification_officer", "analytics_viewer"])),
    db: Session = Depends(get_db)
):
    """Generates and downloads a print-ready PDF for the specified CHED report."""
    data_res = generate_ched_dataset(db, report_num)
    title = data_res["title"]
    headers = data_res["headers"]
    rows = data_res["rows"]
    
    # Create in-memory bytes buffer
    buffer = io.BytesIO()
    
    # Setup document geometry
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )
    
    story = []
    styles = getSampleStyleSheet()
    
    # Setup custom styles
    title_style = ParagraphStyle(
        name="NemsuTitle",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        alignment=1, # Center
        spaceAfter=3,
        textColor=colors.HexColor("#1a365d")
    )
    subtitle_style = ParagraphStyle(
        name="NemsuSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        alignment=1, # Center
        spaceAfter=15,
        textColor=colors.HexColor("#4a5568")
    )
    report_title_style = ParagraphStyle(
        name="ReportTitle",
        parent=styles["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=11,
        alignment=0, # Left
        spaceAfter=10,
        textColor=colors.HexColor("#2d3748")
    )
    cell_style = ParagraphStyle(
        name="TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10
    )
    header_style = ParagraphStyle(
        name="TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.white
    )
    
    # Page Header Elements (NEMSU Branding)
    story.append(Paragraph("NORTH EASTERN MINDANAO STATE UNIVERSITY", title_style))
    story.append(Paragraph("Office of the Student Welfare and Development  ·  Student Profiling System", subtitle_style))
    story.append(Paragraph(title.upper(), report_title_style))
    story.append(Spacer(1, 5))
    
    # Convert headers & rows to Table-compliant Flowables
    table_data = []
    
    # Add header row
    header_flowable = [Paragraph(h, header_style) for h in headers]
    table_data.append(header_flowable)
    
    # Add data rows
    for r in rows:
        row_flowable = []
        for h in headers:
            val = str(r.get(h, ""))
            # If value is numeric and is a total key row, bold it
            if "TOTAL" in str(r.values()) or "Total" in str(r.values()):
                bold_style = ParagraphStyle(
                    name="TableCellBold",
                    parent=cell_style,
                    fontName="Helvetica-Bold"
                )
                row_flowable.append(Paragraph(val, bold_style))
            else:
                row_flowable.append(Paragraph(val, cell_style))
        table_data.append(row_flowable)
        
    # Table Width settings: dynamically size based on columns
    num_cols = len(headers)
    usable_width = 612 - 80 # Letter width is 612, margins 40+40
    col_width = usable_width / num_cols
    
    report_table = Table(table_data, colWidths=[col_width] * num_cols)
    
    # Apply styling grid to ReportLab Table
    t_style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1a365d")), # Dark navy headers
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e0")), # Thin border lines
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
    ])
    
    # Highlight final summary rows if present
    for i, r in enumerate(rows):
        first_val = str(list(r.values())[0])
        if "TOTAL" in first_val or "Total" in first_val:
            # Highlight summary row with light blue background
            t_style.add('BACKGROUND', (0, i+1), (-1, i+1), colors.HexColor("#ebf8ff"))
            t_style.add('LINEABOVE', (0, i+1), (-1, i+1), 1, colors.HexColor("#1a365d"))
            
    report_table.setStyle(t_style)
    story.append(report_table)
    
    # Footer timestamp
    story.append(Spacer(1, 15))
    footer_text = f"Report generated by Admin {current_admin.email} on {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}."
    footer_style = ParagraphStyle(
        name="Footer",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=7,
        textColor=colors.HexColor("#718096")
    )
    story.append(Paragraph(footer_text, footer_style))
    
    # Build document
    doc.build(story)
    
    # Reset buffer pointer
    buffer.seek(0)
    
    # Log action
    log = models.AdminLog(
        admin_id=current_admin.id,
        action="export_report_pdf",
        details=f"Exported CHED Report {report_num} as PDF",
        timestamp=datetime.now(timezone.utc)
    )
    db.add(log)
    db.commit()
    
    filename = f"OSWD_CHED_Report_{report_num}_{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# --- GENERAL EXPORT SUBMISSIONS TO CSV ---

@router.get("/submissions/export-csv")
def export_all_submissions_csv(
    program: Optional[str] = Query(None),
    year_level: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    ip_group: Optional[str] = Query(None),
    pwd_status: Optional[str] = Query(None),
    solo_parent: Optional[str] = Query(None),
    internet_access: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_admin: models.User = Depends(RoleChecker(allowed_roles=["admin", "verification_officer"])),
    db: Session = Depends(get_db)
):
    """
    Exports a flat, spreadsheet-friendly CSV table containing 
    every dynamic profiling answer for all matching student submissions.
    """
    records = get_filtered_submissions(
        db, program, year_level, category, ip_group, pwd_status, solo_parent, internet_access, start_date, end_date
    )
    
    # Gather active questions to map header fields
    active_sem = db.query(models.Semester).filter(models.Semester.is_active == True).first()
    questions_query = db.query(models.Question)
    if active_sem:
        questions_query = questions_query.filter(models.Question.semester_id == active_sem.id)
    questions = questions_query.order_by(models.Question.display_order).all()
    
    # Compile CSV Headers
    headers = [
        "Student ID", "Email", "Category", "Verification Code", 
        "Enrollment Verification Status", "Submitted At"
    ]
    # Add dynamic question texts as columns
    for q in questions:
        headers.append(q.question_text)
        
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    
    for r in records:
        sub = r["submission"]
        student = r["student"]
        answers = r["answers"]
        
        row = [
            student.id,
            student.email,
            student.category,
            sub.verification_code,
            "VERIFIED" if student.is_verified_for_enrollment else "PENDING OSWD VERIFICATION",
            sub.submitted_at.strftime("%Y-%m-%d %H:%M:%S") if sub.submitted_at else "Draft"
        ]
        
        for q in questions:
            key = q.system_key if q.system_key else str(q.id)
            val = answers.get(key, "")
            row.append(val)
            
        writer.writerow(row)
        
    output.seek(0)
    
    # Log action
    log = models.AdminLog(
        admin_id=current_admin.id,
        action="export_all_submissions_csv",
        details=f"Exported flat CSV of {len(records)} submissions",
        timestamp=datetime.now(timezone.utc)
    )
    db.add(log)
    db.commit()
    
    filename = f"OSWD_Submissions_Export_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
