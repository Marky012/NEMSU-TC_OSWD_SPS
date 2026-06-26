"""
OSWD_SPS Question Seeder
========================
Source of Truth: oswd_field_inventory-2.csv (root of repo)

Rules:
  - EXCLUDED: password_hash (handled by auth system)
  - EXCLUDED: age (derived field — computed from birthdate at runtime)
  - EXCLUDED: ui_basic_phone_termination (UI-only display element, no DB row)
  - participation_in_sports_arts → field_type="table",
      options_json=["Event Participated","Skills Competed (Specify)","Year","Award (if any)"]
  - applicable_categories mapping:
      CSV "all"                    → ["all"]
      CSV "new,transferee,returnee" → ["New", "Transferee", "Returnee"]
      CSV "continuing"             → ["Continuing"]
      CSV "new,transferee"         → ["New", "Transferee"]
      CSV "returnee"               → ["Returnee"]
      CSV "transferee"             → ["Transferee"]
"""

import json
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.database import SessionLocal, Base, engine
from app import models
from app.utils.security import get_password_hash
from app.config import settings

def seed_database(db: Session):
    # -----------------------------------------------------------------------
    # 1. Seed Default Admin
    # -----------------------------------------------------------------------
    admin_email = settings.ADMIN_INITIAL_EMAIL
    admin_exists = db.query(models.User).filter(models.User.email == admin_email).first()
    if not admin_exists:
        admin_user = models.User(
            email=admin_email,
            password_hash=get_password_hash(settings.ADMIN_INITIAL_PASSWORD),
            role="admin",
            category=None,
            is_verified_for_enrollment=True,
            is_email_verified=True
        )
        db.add(admin_user)
        db.commit()
        print(f"  [+] Seeded Admin User: {admin_email}")

    # -----------------------------------------------------------------------
    # 2. Seed Default Active Semester
    # -----------------------------------------------------------------------
    semester_label = "AY 2026-2027 1st Semester"
    sem_exists = db.query(models.Semester).filter(models.Semester.label == semester_label).first()
    if not sem_exists:
        active_semester = models.Semester(
            label="AY 2026-2027 1st Semester",
            is_active=True,
            opens_at=datetime.now(timezone.utc) - timedelta(days=5),
            closes_at=datetime.now(timezone.utc) + timedelta(days=60)
        )
        db.add(active_semester)
        db.commit()
        print(f"  [+] Seeded Active Semester: {semester_label}")
    else:
        active_semester = sem_exists

    # -----------------------------------------------------------------------
    # 3. Seed Question Categories
    # -----------------------------------------------------------------------
    categories_data = [
        {"id": 2, "name": "Personal Information",       "display_order": 1},
        {"id": 4, "name": "Indigenous Peoples (IP)",    "display_order": 2},
        {"id": 5, "name": "Solo Parent & PWD",          "display_order": 3},
        {"id": 6, "name": "Sports & Arts (New/Trans/Ret)", "display_order": 4},
        {"id": 7, "name": "Internet & Digital Technology", "display_order": 5},
    ]

    for cat in categories_data:
        exists = db.query(models.QuestionCategory).filter(models.QuestionCategory.id == cat["id"]).first()
        if not exists:
            db.add(models.QuestionCategory(
                id=cat["id"],
                name=cat["name"],
                display_order=cat["display_order"]
            ))
    db.commit()
    print("  [+] Seeded Question Categories.")

    # -----------------------------------------------------------------------
    # Skip if questions already seeded to avoid duplicates
    # -----------------------------------------------------------------------
    if db.query(models.Question).first() is not None:
        count = db.query(models.Question).count()
        print(f"  [!] Questions already seeded ({count} rows). Skipping question seed.")
        return

    # -----------------------------------------------------------------------
    # 4. Question Seed Data (aligned 1:1 with oswd_field_inventory-2.csv)
    # -----------------------------------------------------------------------
    # Shorthand helpers
    ALL   = ["all"]
    NTR   = ["New", "Transferee", "Returnee"]   # new,transferee,returnee
    CONT  = ["Continuing"]                       # continuing
    NT    = ["New", "Transferee"]               # new,transferee
    RET   = ["Returnee"]                        # returnee
    TRANS = ["Transferee"]                      # transferee

    # Each entry:
    #   temp_id          - local reference key for parent-child wiring
    #   category_id      - maps to QuestionCategory.id
    #   system_key       - machine-readable field_name from CSV
    #   question_text    - display_label from CSV (human-readable label)
    #   field_type       - CSV data_type mapped to DB types:
    #                       text, email, number, date, datetime, boolean → boolean/radio
    #                       select → select/radio, multi_select → checkbox
    #                       textarea, file, table, display_only
    #   options          - list of choices (None for free-text fields)
    #   required         - True / False / "conditional" (stored as bool; conditionals are False)
    #   applicable_cats  - student category filter list
    #   display_order    - sequential order across the whole form
    #   parent_temp_id   - (optional) temp_id of the conditional parent question
    #   conditional_val  - value of parent that makes this question visible

    questions_to_seed = [

        # ===================================================================
        # CATEGORY 2: PERSONAL INFORMATION (base44 aligned)
        # ===================================================================

        # surname
        {
            "temp_id":        "surname",
            "category_id":    2,
            "system_key":     "surname",
            "question_text":  "Last Name",
            "field_type":     "text",
            "options":        None,
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  1,
        },

        # first_name
        {
            "temp_id":        "first_name",
            "category_id":    2,
            "system_key":     "first_name",
            "question_text":  "First Name",
            "field_type":     "text",
            "options":        None,
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  2,
        },

        # middle_name
        {
            "temp_id":        "middle_name",
            "category_id":    2,
            "system_key":     "middle_name",
            "question_text":  "Middle Name",
            "field_type":     "text",
            "options":        None,
            "required":       False,
            "applicable_cats": ALL,
            "display_order":  3,
        },

        # birthdate
        {
            "temp_id":        "birthdate",
            "category_id":    2,
            "system_key":     "birthdate",
            "question_text":  "Date of Birth",
            "field_type":     "date",
            "options":        None,
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  4,
        },

        # active_contact_number
        {
            "temp_id":        "active_contact_number",
            "category_id":    2,
            "system_key":     "active_contact_number",
            "question_text":  "Active Contact Number",
            "field_type":     "text",
            "options":        None,
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  5,
        },

        # emergency_contact_name
        {
            "temp_id":        "emergency_contact_name",
            "category_id":    2,
            "system_key":     "emergency_contact_name",
            "question_text":  "Emergency Contact Name",
            "field_type":     "text",
            "options":        None,
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  6,
        },

        # emergency_contact_number
        {
            "temp_id":        "emergency_contact_number",
            "category_id":    2,
            "system_key":     "emergency_contact_number",
            "question_text":  "Emergency Contact Number",
            "field_type":     "text",
            "options":        None,
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  7,
        },

        # religion
        {
            "temp_id":        "religion",
            "category_id":    2,
            "system_key":     "religion",
            "question_text":  "Religion",
            "field_type":     "text",
            "options":        None,
            "required":       False,
            "applicable_cats": ALL,
            "display_order":  8,
        },

        # gender — radio per base44
        {
            "temp_id":        "gender",
            "category_id":    2,
            "system_key":     "gender",
            "question_text":  "Gender",
            "field_type":     "radio",
            "options":        ["Female", "Male", "LGBT"],
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  9,
        },

        # marital_status
        {
            "temp_id":        "marital_status",
            "category_id":    2,
            "system_key":     "marital_status",
            "question_text":  "Marital Status",
            "field_type":     "select",
            "options":        ["Single", "Widow", "Single Parent", "Widower", "Married", "Annulled/Separated"],
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  10,
        },

        # present_home_address
        {
            "temp_id":        "present_home_address",
            "category_id":    2,
            "system_key":     "present_home_address",
            "question_text":  "Purok / Sitio / Street",
            "field_type":     "textarea",
            "options":        None,
            "required":       False,
            "applicable_cats": ALL,
            "display_order":  11,
        },

        # house_ownership — radio per base44
        {
            "temp_id":        "house_ownership",
            "category_id":    2,
            "system_key":     "house_ownership",
            "question_text":  "Does your family own a house?",
            "field_type":     "radio",
            "options":        ["Yes", "No", "Nakipuyu lang"],
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  12,
        },

        # barangay_name
        {
            "temp_id":        "barangay_name",
            "category_id":    2,
            "system_key":     "barangay_name",
            "question_text":  "Barangay",
            "field_type":     "text",
            "options":        None,
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  13,
        },

        # municipality
        {
            "temp_id":        "municipality",
            "category_id":    2,
            "system_key":     "municipality",
            "question_text":  "Municipality/City",
            "field_type":     "text",
            "options":        None,
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  14,
        },

        # region
        {
            "temp_id":        "region",
            "category_id":    2,
            "system_key":     "region",
            "question_text":  "Region",
            "field_type":     "text",
            "options":        None,
            "required":       False,
            "applicable_cats": ALL,
            "display_order":  15,
        },

        # estimated_household_income
        {
            "temp_id":        "estimated_household_income",
            "category_id":    2,
            "system_key":     "estimated_household_income",
            "question_text":  "Estimated Household Income per Month (PHP)",
            "field_type":     "number",
            "options":        None,
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  16,
        },

        # number_of_siblings
        {
            "temp_id":        "number_of_siblings",
            "category_id":    2,
            "system_key":     "number_of_siblings",
            "question_text":  "Number of Siblings (excluding self)",
            "field_type":     "number",
            "options":        None,
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  17,
        },

        # birth_order — NEW field for base44
        {
            "temp_id":        "birth_order",
            "category_id":    2,
            "system_key":     "birth_order",
            "question_text":  "Birth Order (e.g., 1st, 2nd, 3rd)",
            "field_type":     "text",
            "options":        None,
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  18,
        },

        # program — text per base44 (was select)
        {
            "temp_id":        "program",
            "category_id":    2,
            "system_key":     "program",
            "question_text":  "Program/Course",
            "field_type":     "select",
            "options":        ["Bachelor of Secondary Education", "Bachelor of Science in Business Administration major in Human Resource Management", "Bachelor of Science in Accountancy", "Bachelor of Science in Business Administration major in Financial Management", "Bachelor of Elementary Education", "Bachelor of Science in Computer Science", "Bachelor of Arts in Tourism", "Bachelor of Science in Hospitality Management", "Other"],
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  19,
        },

        # year_level
        {
            "temp_id":        "year_level",
            "category_id":    2,
            "system_key":     "year_level",
            "question_text":  "Year Level",
            "field_type":     "select",
            "options":        ["1st Year", "2nd Year", "3rd Year", "4th Year"],
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  20,
        },

        # ===================================================================
        # CATEGORY 4: INDIGENOUS PEOPLES (IP)
        # ===================================================================

        # indigenous_peoples_none — radio: "Yes" / "I do not belong to IP"
        {
            "temp_id":        "indigenous_peoples_none",
            "category_id":    4,
            "system_key":     "indigenous_peoples_none",
            "question_text":  "Do you belong to an Indigenous Peoples (IP) group?",
            "field_type":     "radio",
            "options":        ["Yes", "I do not belong to IP"],
            "required":       False,
            "applicable_cats": ALL,
            "display_order":  30,
        },

        # indigenous_peoples_group — shown when "Yes" selected above
        {
            "temp_id":        "indigenous_peoples_group",
            "category_id":    4,
            "system_key":     "indigenous_peoples_group",
            "question_text":  "Select your IP group",
            "field_type":     "select",
            "options":        ["BLAAN", "MAMANWA", "MANGYAN", "SUBANEN", "BUKIDNON", "MANDAYA", "MANOBO", "T'BOLI", "Others"],
            "required":       False,
            "applicable_cats": ALL,
            "display_order":  31,
            "parent_temp_id":  "indigenous_peoples_none",
            "conditional_val": "Yes",
        },

        # indigenous_peoples_other_specify — shown when "Others" selected in group
        {
            "temp_id":        "indigenous_peoples_other_specify",
            "category_id":    4,
            "system_key":     "indigenous_peoples_other_specify",
            "question_text":  "If Others — please specify IP group",
            "field_type":     "text",
            "options":        None,
            "required":       False,
            "applicable_cats": ALL,
            "display_order":  32,
            "parent_temp_id":  "indigenous_peoples_group",
            "conditional_val": "Others",
        },

        # ===================================================================
        # CATEGORY 5: SOLO PARENT & PWD
        # ===================================================================

        # is_solo_parent_currently_studying
        {
            "temp_id":        "is_solo_parent_currently_studying",
            "category_id":    5,
            "system_key":     "is_solo_parent_currently_studying",
            "question_text":  "Are you a solo parent currently studying?",
            "field_type":     "radio",
            "options":        ["Yes", "No"],
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  33,
        },

        # is_child_of_solo_parent
        {
            "temp_id":        "is_child_of_solo_parent",
            "category_id":    5,
            "system_key":     "is_child_of_solo_parent",
            "question_text":  "Are you a son/daughter of a solo parent?",
            "field_type":     "radio",
            "options":        ["Yes", "No"],
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  34,
        },

        # is_pwd — gateway question that triggers PWD sub-section
        {
            "temp_id":        "is_pwd",
            "category_id":    5,
            "system_key":     "is_pwd",
            "question_text":  "Are you a Person with Disability (PWD)?",
            "field_type":     "radio",
            "options":        ["Yes", "No"],
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  35,
        },

        # pwd_card_status — shown when is_pwd = "Yes"
        {
            "temp_id":        "pwd_card_status",
            "category_id":    5,
            "system_key":     "pwd_card_status",
            "question_text":  "Do you have a PWD card?",
            "field_type":     "radio",
            "options":        ["Yes", "No, but would like to have one"],
            "required":       False,
            "applicable_cats": ALL,
            "display_order":  36,
            "parent_temp_id":  "is_pwd",
            "conditional_val": "Yes",
        },

        # pwd_disability_type — multi-select checkboxes; shown when is_pwd = "Yes"
        {
            "temp_id":        "pwd_disability_type",
            "category_id":    5,
            "system_key":     "pwd_disability_type",
            "question_text":  "Disability Type (select all that apply)",
            "field_type":     "multi_select",
            "options":        [
                "Apparent Physical",
                "Deaf/Hard of Hearing",
                "Visual",
                "Learning Disability",
                "Mental/Psychosocial",
                "Speech/Language",
                "Non-apparent Cancer",
                "Non-apparent Rare Disease",
                "Intellectual Disability",
            ],
            "required":       False,
            "applicable_cats": ALL,
            "display_order":  37,
            "parent_temp_id":  "is_pwd",
            "conditional_val": "Yes",
        },

        # ===================================================================
        # CATEGORY 6: SPORTS & ARTS (NEW / TRANSFEREE / RETURNEE ONLY)
        # ===================================================================

        # participation_in_sports_arts — TABLE field
        # options_json stores the column headers exactly as specified in action item 1
        {
            "temp_id":        "participation_in_sports_arts",
            "category_id":    6,
            "system_key":     "participation_in_sports_arts",
            "question_text":  "Sports / Literary / Dance / Music / Visual Arts Participation",
            "field_type":     "table",
            "options":        ["Event Participated", "Skills Competed (specify)", "Year", "Award (if any)"],
            "required":       False,
            "min_rows":       1,
            "applicable_cats": NTR,
            "display_order":  38,
        },

        # ===================================================================
        # CATEGORY 7: INTERNET & DIGITAL TECHNOLOGY
        # ===================================================================

        # primary_mode_of_residence
        {
            "temp_id":        "primary_mode_of_residence",
            "category_id":    7,
            "system_key":     "primary_mode_of_residence",
            "question_text":  "Primary Mode of Residence",
            "field_type":     "radio",
            "options":        [
                "Campus Dormitory",
                "Off-Campus Apartment",
                "Commuter with family",
                "Commuter with relatives",
            ],
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  40,
        },

        # cellphone_type — GATEWAY: Basic phone terminates digital survey
        {
            "temp_id":        "cellphone_type",
            "category_id":    7,
            "system_key":     "cellphone_type",
            "question_text":  "Type of Cellphone",
            "field_type":     "radio",
            "options":        ["Smartphone", "Basic Phone"],
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  41,
        },

        # --- All below conditional on cellphone_type = "Smartphone" ---

        # gadgets_owned
        {
            "temp_id":        "gadgets_owned",
            "category_id":    7,
            "system_key":     "gadgets_owned",
            "question_text":  "Gadgets Owned",
            "field_type":     "multi_select",
            "options":        ["Smartphone", "Laptop", "Tablet"],
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  42,
            "parent_temp_id":  "cellphone_type",
            "conditional_val": "Smartphone",
        },

        # cellphone_operating_system
        {
            "temp_id":        "cellphone_operating_system",
            "category_id":    7,
            "system_key":     "cellphone_operating_system",
            "question_text":  "Operating System",
            "field_type":     "radio",
            "options":        ["iOS", "Android"],
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  43,
            "parent_temp_id":  "cellphone_type",
            "conditional_val": "Smartphone",
        },

        # weekly_internet_expense
        {
            "temp_id":        "weekly_internet_expense",
            "category_id":    7,
            "system_key":     "weekly_internet_expense",
            "question_text":  "Average Weekly Load Cost for Internet",
            "field_type":     "radio",
            "options":        [
                "Php 10-50",
                "Php 51-100",
                "Php 101-150",
                "More than Php 150",
            ],
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  44,
            "parent_temp_id":  "cellphone_type",
            "conditional_val": "Smartphone",
        },

        # internet_load_frequency
        {
            "temp_id":        "internet_load_frequency",
            "category_id":    7,
            "system_key":     "internet_load_frequency",
            "question_text":  "How often do you buy load?",
            "field_type":     "radio",
            "options":        [
                "Daily",
                "Once a week",
                "Twice a week",
                "Thrice a week",
                "Only when needed",
            ],
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  45,
            "parent_temp_id":  "cellphone_type",
            "conditional_val": "Smartphone",
        },

        # mobile_data_has_cap
        {
            "temp_id":        "mobile_data_has_cap",
            "category_id":    7,
            "system_key":     "mobile_data_has_cap",
            "question_text":  "Do you have a data cap?",
            "field_type":     "radio",
            "options":        [
                "Yes and often run out",
                "Yes but enough",
                "Unlimited",
            ],
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  46,
            "parent_temp_id":  "cellphone_type",
            "conditional_val": "Smartphone",
        },

        # internet_access_method
        {
            "temp_id":        "internet_access_method",
            "category_id":    7,
            "system_key":     "internet_access_method",
            "question_text":  "How do you access the internet?",
            "field_type":     "multi_select",
            "options":        [
                "High-speed broadband",
                "DSL",
                "Satellite",
                "Piso Wifi",
                "Subscription",
                "Mobile data",
                "No access",
            ],
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  47,
            "parent_temp_id":  "cellphone_type",
            "conditional_val": "Smartphone",
        },

        # internet_speed_rating
        {
            "temp_id":        "internet_speed_rating",
            "category_id":    7,
            "system_key":     "internet_speed_rating",
            "question_text":  "Internet Reliability Rating",
            "field_type":     "radio",
            "options":        [
                "Excellent",
                "Good",
                "Fair",
                "Poor",
                "Very Poor",
            ],
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  48,
            "parent_temp_id":  "cellphone_type",
            "conditional_val": "Smartphone",
        },

        # satisfied_mobile_network
        {
            "temp_id":        "satisfied_mobile_network",
            "category_id":    7,
            "system_key":     "satisfied_mobile_network",
            "question_text":  "Satisfied Mobile Network",
            "field_type":     "multi_select",
            "options":        ["TNT", "Globe", "DITO", "Smart", "TM", "GOMO", "Smart Bro"],
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  49,
            "parent_temp_id":  "cellphone_type",
            "conditional_val": "Smartphone",
        },

        # assignment_incomplete_due_to_internet
        {
            "temp_id":        "assignment_incomplete_due_to_internet",
            "category_id":    7,
            "system_key":     "assignment_incomplete_due_to_internet",
            "question_text":  "Have you ever been unable to complete an assignment due to poor internet?",
            "field_type":     "radio",
            "options":        ["Frequently", "Occasionally", "Rarely", "Never"],
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  50,
            "parent_temp_id":  "cellphone_type",
            "conditional_val": "Smartphone",
        },

        # campus_wifi_used
        {
            "temp_id":        "campus_wifi_used",
            "category_id":    7,
            "system_key":     "campus_wifi_used",
            "question_text":  "Which campus Wi-Fi do you use?",
            "field_type":     "multi_select",
            "options":        [
                "NEMSU Free Wifi",
                "BSBA Piso Wifi",
                "Mobile data instead",
            ],
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  51,
            "parent_temp_id":  "cellphone_type",
            "conditional_val": "Smartphone",
        },

        # campus_strong_wifi_locations — CHECKBOX
        {
            "temp_id":        "campus_strong_wifi_locations",
            "category_id":    7,
            "system_key":     "campus_strong_wifi_locations",
            "question_text":  "Where inside campus do you experience strong internet?",
            "field_type":     "multi_select",
            "options":        [
                "Classrooms Agriculture",
                "Education old building",
                "BSBA building",
                "Library",
                "Canteen",
                "NEMSU ground",
                "Gymnasium",
                "Everywhere fine",
                "Hostel",
                "New Academic Building",
                "Computer Laboratories",
            ],
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  52,
            "parent_temp_id":  "cellphone_type",
            "conditional_val": "Smartphone",
        },

        # is_smartphone_essential
        {
            "temp_id":        "is_smartphone_essential",
            "category_id":    7,
            "system_key":     "is_smartphone_essential",
            "question_text":  "Is smartphone essential for your academic life?",
            "field_type":     "radio",
            "options":        ["Yes", "No"],
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  53,
            "parent_temp_id":  "cellphone_type",
            "conditional_val": "Smartphone",
        },

        # university_tech_recommendations — CHECKBOX
        {
            "temp_id":        "university_tech_recommendations",
            "category_id":    7,
            "system_key":     "university_tech_recommendations",
            "question_text":  "University investment recommendations",
            "field_type":     "multi_select",
            "options":        [
                "Expand Wi-Fi coverage",
                "Quiet study spaces with outlets",
                "Laptop/tablet loaner program",
                "Subsidized hotspots",
                "Mobile-friendly website",
            ],
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  54,
            "parent_temp_id":  "cellphone_type",
            "conditional_val": "Smartphone",
        },

        # willing_smartphone_loan
        {
            "temp_id":        "willing_smartphone_loan",
            "category_id":    7,
            "system_key":     "willing_smartphone_loan",
            "question_text":  "Willing to avail smartphone loan program?",
            "field_type":     "radio",
            "options":        ["Yes", "No"],
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  55,
            "parent_temp_id":  "cellphone_type",
            "conditional_val": "Smartphone",
        },

        # preferred_learning_modality
        {
            "temp_id":        "preferred_learning_modality",
            "category_id":    7,
            "system_key":     "preferred_learning_modality",
            "question_text":  "Preferred Learning Modality",
            "field_type":     "radio",
            "options":        [
                "100% On-site",
                "75% On-site / 25% Online",
                "50% On-site / 50% Online",
                "25% On-site / 75% Online",
            ],
            "required":       True,
            "applicable_cats": ALL,
            "display_order":  56,
            "parent_temp_id":  "cellphone_type",
            "conditional_val": "Smartphone",
        },

    ]

    # -----------------------------------------------------------------------
    # 5. Insert questions (two-pass: first without conditional links)
    # -----------------------------------------------------------------------
    temp_id_map: dict[str, int] = {}

    for q_info in questions_to_seed:
        db_question = models.Question(
            category_id=q_info["category_id"],
            semester_id=active_semester.id,
            system_key=q_info["system_key"],
            question_text=q_info["question_text"],
            field_type=q_info["field_type"],
            options_json=json.dumps(q_info["options"]) if q_info["options"] is not None else None,
            conditional_parent_question_id=None,
            conditional_value=None,
            required=bool(q_info["required"]),
            min_rows=q_info.get("min_rows"),
            active=True,
            applicable_categories_json=json.dumps(q_info["applicable_cats"]),
            display_order=q_info["display_order"],
        )
        db.add(db_question)
        db.flush()
        temp_id_map[q_info["temp_id"]] = db_question.id

    # Second pass: wire up conditional parent → child relationships
    for q_info in questions_to_seed:
        parent_key = q_info.get("parent_temp_id")
        if parent_key:
            parent_db_id = temp_id_map.get(parent_key)
            child_db_id  = temp_id_map.get(q_info["temp_id"])
            if parent_db_id and child_db_id:
                child_q = db.query(models.Question).filter(models.Question.id == child_db_id).first()
                if child_q:
                    child_q.conditional_parent_question_id = parent_db_id
                    child_q.conditional_value = q_info["conditional_val"]

    db.commit()

    # -----------------------------------------------------------------------
    # 6. Sanity Check
    # -----------------------------------------------------------------------
    actual_count = db.query(models.Question).count()
    seeded_now   = len(questions_to_seed)

    print(f"\n  [OK] Seeded {seeded_now} form questions.")
    print(f"     DB total: {actual_count} | Expected ~{seeded_now}")

    if actual_count < seeded_now - 5:
        print(f"  [WARN] Question count ({actual_count}) is below expected range ({seeded_now - 5} – {seeded_now + 5}).")
        print(f"      Double-check that no CSV fields were accidentally skipped.")
    else:
        print(f"  [OK] Sanity check PASSED — count within expected range.")

    # Verify participation_in_sports_arts has correct options
    sports_q = db.query(models.Question).filter(
        models.Question.system_key == "participation_in_sports_arts"
    ).first()
    if sports_q:
        expected_cols = ["Event Participated", "Skills Competed (specify)", "Year", "Award (if any)"]
        actual_cols   = json.loads(sports_q.options_json) if sports_q.options_json else []
        if actual_cols == expected_cols:
            print("  [OK] participation_in_sports_arts table columns: OK")
        else:
            print(f"  [WARN] participation_in_sports_arts columns mismatch!")
            print(f"      Expected: {expected_cols}")
            print(f"      Got:      {actual_cols}")

    # Verify ui_basic_phone_termination is NOT seeded
    ui_q = db.query(models.Question).filter(
        models.Question.system_key == "ui_basic_phone_termination"
    ).first()
    if ui_q is None:
        print("  [OK] ui_basic_phone_termination correctly excluded (UI-only).")
    else:
        print("  [FAIL] ui_basic_phone_termination was accidentally seeded — please remove it!")

    # Verify password_hash and age are NOT seeded
    for excl_key in ["password_hash", "age"]:
        excl_q = db.query(models.Question).filter(models.Question.system_key == excl_key).first()
        if excl_q is None:
            print(f"  [OK] '{excl_key}' correctly excluded.")
        else:
            print(f"  [FAIL] '{excl_key}' was accidentally seeded — please remove it!")

    print("\n  Database seeding completed successfully.\n")

    # -----------------------------------------------------------------------
    # 7. Update existing questions' options to match seed data (for non-empty DB)
    # -----------------------------------------------------------------------
    for q_info in questions_to_seed:
        if q_info["options"] is None:
            continue
        existing_q = db.query(models.Question).filter(
            models.Question.system_key == q_info["system_key"]
        ).first()
        if existing_q:
            seeded_opts = json.dumps(q_info["options"])
            if existing_q.options_json != seeded_opts:
                existing_q.options_json = seeded_opts
                if q_info.get("question_text"):
                    existing_q.question_text = q_info["question_text"]
                if q_info.get("required") is not None:
                    existing_q.required = bool(q_info["required"])
                print(f"  [Update] '{q_info['system_key']}' options/text updated from seed.")
    db.commit()


if __name__ == "__main__":
    print("\n=== OSWD_SPS Database Seeder ===\n")
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        seed_database(session)
    finally:
        session.close()
