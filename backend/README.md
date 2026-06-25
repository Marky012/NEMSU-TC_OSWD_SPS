# OSWD Student Profiling System - Backend API

This is the production-ready FastAPI backend for the **Office of Student Welfare and Development (OSWD) Student Profiling System** at North Eastern Mindanao State University.

## Technical Stack
- **Framework**: FastAPI (Python 3.13+)
- **ORM**: SQLAlchemy
- **Database**: SQLite (local development / default) or PostgreSQL (production switchable)
- **Authentication**: OAuth2 Password Flow with JSON Web Tokens (JWT) & Bcrypt hashing
- **Security**: CORS, CSRF configuration, file magic‑byte validations, and custom email rate-limiting
- **PDF Generation**: ReportLab
- **Testing**: Pytest & FastAPI TestClient

---

## Directory Structure
```
backend/
├── app/
│   ├── main.py                # App configuration, startup, CORS, and background scheduler
│   ├── config.py              # Configuration manager using Pydantic Settings
│   ├── database.py            # SQLAlchemy engine & session factory
│   ├── models.py              # SQLAlchemy database models
│   ├── schemas.py             # Pydantic request & response schemas
│   ├── dependencies.py        # Authentication & Role checking injectables
│   ├── routers/               # Route endpoints grouped by concern (Auth, Forms, Students, Admin, Reports)
│   ├── utils/                 # Security logic (hash/JWT) & SMTP Client (mock + real options)
│   └── seeders/               # Database seeders (Category lists, initial admin, and 43 manual paper questions)
├── uploads/                    # Folder where PWD card photocopies are stored securely
├── backups/                    # Automated daily SQLite database backups (retained for 30 days)
├── run.py                      # Hot-reloading development server launcher
├── requirements.txt            # Python dependencies
├── test_main.py                # Automated end-to-end integration tests
└── .env                        # Environmental variables configuration
```

---

## Setup & Installation

### 1. Prerequisites
- Python 3.9+ (Python 3.13 recommended)
- Virtual Environment tool (`venv`)

### 2. Initializing the Project
Clone the repository and navigate to the backend folder:
```bash
git clone https://github.com/Marky012/NEMSU-TC_OSWD_SPS.git
cd NEMSU-TC_OSWD_SPS/backend
```

### 3. Setup Virtual Environment
Create and activate a virtual environment:
```bash
# On Windows
python -m venv venv
venv\Scripts\activate

# On Linux/macOS
python3 -m venv venv
source venv/bin/activate
```

### 4. Install Dependencies
Install all required modules from `requirements.txt`:
```bash
pip install -r requirements.txt
```

### 5. Setup Environment Variables
Copy `.env.example` to `.env` and adjust the variables:
```bash
# On Windows PowerShell
copy .env.example .env

# On Linux/macOS or Git Bash
cp .env.example .env
```

Open `.env` and verify the settings:
- **`DATABASE_URL`**: Defaults to SQLite (`sqlite:///./oswd_sps.db`). To use PostgreSQL, change it to:
  `postgresql://username:password@localhost:5432/db_name`
- **`SECRET_KEY`**: A secure string used to sign JWT tokens. Keep this private.
- **`SMTP_HOST`**: Set your SMTP host (e.g. `smtp.gmail.com` or a developer sandbox like Mailtrap). **If left empty, the backend automatically runs in mock mode, printing HTML email layouts to the server logs for easy local testing.**
- **`ADMIN_INITIAL_EMAIL` / `ADMIN_INITIAL_PASSWORD`**: The default Super Admin credentials created on first run (default: `admin@nemsu.edu.ph` / `admin12345`).

---

## Running the Application

To run the development server with auto-reload:
```bash
python run.py
```
The application will launch on **`http://127.0.0.1:8000`**.

### API Documentation (Interactive Swagger UI)
Once the server is running, navigate to:
- **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

You can use the **Authorize** lock button in Swagger UI to log in as Super Admin (`admin@nemsu.edu.ph` / `admin12345`) or a student to test endpoints directly.

### Automatic Database Initialization & Seeding
The database tables are created automatically on startup. If the database is empty (e.g., first run), the startup event triggers `seed_database()` which automatically seeds:
- The default active semester (`AY 2026-2027 1st Semester`).
- The default Super Admin account.
- The 5 question categories.
- The complete set of 43 questions directly compiled from the university's OSWD paper forms (including parent-child conditional rendering definitions).

---

## Running Automated Tests

Run the test suite using `pytest` to verify routing, validation rules, authentication flows, data inputs, and CHED metrics aggregations:
```bash
pytest -v
```
All tests should pass, ensuring database integrity and endpoint stability.

---

## Production Deployment on a University Linux Server

To deploy this backend on a Linux server (e.g., Ubuntu/Debian), follow this standard workflow:

### 1. Database Configuration
Install and set up PostgreSQL, create the database, and update `DATABASE_URL` in `.env`:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib libpq-dev python3-dev
sudo -u postgres psql
# Inside postgres shell:
CREATE DATABASE oswd_sps_db;
CREATE USER oswd_user WITH PASSWORD 'securepassword';
GRANT ALL PRIVILEGES ON DATABASE oswd_sps_db TO oswd_user;
\q
```

### 2. Configure Systemd Service
Create a Systemd service file to keep the FastAPI server running persistently in the background:
```bash
sudo nano /etc/systemd/system/oswd_backend.service
```
Paste the following configuration (replace paths/user as appropriate):
```ini
[Unit]
Description=OSWD Student Profiling System API Service
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/NEMSU-TC_OSWD_SPS/backend
ExecStart=/home/ubuntu/NEMSU-TC_OSWD_SPS/backend/venv/bin/gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app -b 127.0.0.1:8000
Restart=always
EnvironmentFile=/home/ubuntu/NEMSU-TC_OSWD_SPS/backend/.env

[Install]
WantedBy=multi-user.target
```
Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable oswd_backend
sudo systemctl start oswd_backend
# Check status
sudo systemctl status oswd_backend
```

### 3. Configure Nginx Reverse Proxy
To make the API accessible securely over the web:
```bash
sudo apt install nginx
sudo nano /etc/nginx/sites-available/oswd_sps
```
Paste this block:
```nginx
server {
    listen 80;
    server_name oswd-sps.nemsu.edu.ph; # Replace with your subdomain

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Restrict direct access to document uploads folder if desired, or let Nginx serve it
    location /uploads/ {
        alias /home/ubuntu/NEMSU-TC_OSWD_SPS/backend/uploads/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```
Link the site and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/oswd_sps /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

If HTTPS is required, secure the domain with **Let's Encrypt Certbot**:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d oswd-sps.nemsu.edu.ph
```

### 4. Production Database Backups
While SQLite database backups are automatically handled by the system's background thread, when switching to **PostgreSQL**, setup a standard crontab script using `pg_dump` to schedule daily backups:
```bash
crontab -e
# Add the following line to run pg_dump daily at 00:00:
0 0 * * * pg_dump -U oswd_user -d oswd_sps_db -F c -b -v -f /home/ubuntu/backups/oswd_sps_backup_$(date +\%Y\%m\%d).dump
```
