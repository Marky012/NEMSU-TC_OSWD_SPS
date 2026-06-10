<!-- SVG icons sourced from Flaticon (https://www.flaticon.com). Download your preferred icons and
     save them to ./docs/icons/. You only need ONE version of each icon (the dark/black version).
     GitHub automatically shows/hides images based on the #gh-dark-mode-only and #gh-light-mode-only
     URL fragments appended to the image src. No white copies needed. -->

<div align="center">

<h1>OSWD Student Profiling System</h1>
<p><strong>Office of Student Welfare and Development</strong><br>North Eastern Mindanao State University — Tagbina Campus</p>

![Python](https://img.shields.io/badge/Python-3.13+-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat-square&logo=fastapi&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)
![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen?style=flat-square)

<p>A production-ready backend API for digitizing and managing student welfare profiling at NEMSU-TC. Built with FastAPI, it handles secure student data collection, PDF report generation, and CHED-compliant metrics aggregation — replacing the university's manual paper-based OSWD forms.</p>

<!-- Replace ./docs/screenshot.png with your actual screenshot path -->
<p align="center">
  <img src="./docs/screenshot.png" alt="App Screenshot" width="80%" />
</p>

</div>

---

## <img src="./docs/icons/features.svg#gh-light-mode-only" width="20" height="20" /><img src="./docs/icons/features-white.svg#gh-dark-mode-only" width="20" height="20" /> Features

- **JWT Authentication** — Secure OAuth2 Password Flow with Bcrypt hashing and role-based access control
- **Student Profiling Forms** — Digitized version of the university's 43-question OSWD paper forms with parent-child conditional rendering
- **PDF Report Generation** — Automated student profile PDF exports powered by ReportLab
- **CHED Metrics Aggregation** — Built-in analytics endpoints for CHED compliance reporting
- **PWD Document Uploads** — Secure file storage with magic-byte validation for PWD card photocopies
- **Automated Database Seeding** — First-run seeding of semesters, admin accounts, question categories, and all 43 form questions
- **Automated Daily Backups** — Background scheduler retains SQLite backups for 30 days
- **Mock SMTP Mode** — When no SMTP host is configured, email outputs are printed to server logs for easy local testing
- **Dual Database Support** — SQLite for local development, PostgreSQL-switchable for production

---

## <img src="./docs/icons/stack.svg#gh-light-mode-only" width="20" height="20" /><img src="./docs/icons/stack-white.svg#gh-dark-mode-only" width="20" height="20" /> Tech Stack

| Category | Technology | Purpose |
|---|---|---|
| Framework | FastAPI (Python 3.13+) | Core API framework with async support |
| ORM | SQLAlchemy | Database modeling and query abstraction |
| Database | SQLite / PostgreSQL | Local dev default; switchable for production |
| Authentication | OAuth2 + JWT + Bcrypt | Secure token-based auth with hashed passwords |
| PDF Generation | ReportLab | Student profile PDF report generation |
| Validation | Pydantic | Request/response schema validation |
| Testing | Pytest + FastAPI TestClient | End-to-end integration test suite |
| Server | Uvicorn / Gunicorn | ASGI server for development and production |
| Reverse Proxy | Nginx | Production routing and HTTPS termination |

---

## <img src="./docs/icons/structure.svg#gh-light-mode-only" width="20" height="20" /><img src="./docs/icons/structure-white.svg#gh-dark-mode-only" width="20" height="20" /> Project Structure

```
backend/
├── app/
│   ├── main.py                # App configuration, startup, CORS, and background scheduler
│   ├── config.py              # Configuration manager using Pydantic Settings
│   ├── database.py            # SQLAlchemy engine & session factory
│   ├── models.py              # SQLAlchemy database models
│   ├── schemas.py             # Pydantic request & response schemas
│   ├── dependencies.py        # Authentication & role-checking injectables
│   ├── routers/               # Route endpoints grouped by concern (Auth, Forms, Students, Admin, Reports)
│   ├── utils/                 # Security logic (hash/JWT) & SMTP client (mock + real options)
│   └── seeders/               # Database seeders (categories, initial admin, 43 form questions)
├── uploads/                   # Secure storage for PWD card photocopies
├── backups/                   # Automated daily SQLite backups (retained for 30 days)
├── run.py                     # Hot-reloading development server launcher
├── requirements.txt           # Python dependencies
├── test_main.py               # Automated end-to-end integration tests
└── .env                       # Environment variables configuration
```

---

## <img src="./docs/icons/setup.svg#gh-light-mode-only" width="20" height="20" /><img src="./docs/icons/setup-white.svg#gh-dark-mode-only" width="20" height="20" /> Getting Started

### Prerequisites

- Python 3.9+ (Python 3.13 recommended)
- `venv` virtual environment tool

### 1. Clone the Repository

```bash
git clone https://github.com/Marky012/NEMSU-TC_OSWD_SPS.git
cd NEMSU-TC_OSWD_SPS/backend
```

### 2. Create and Activate a Virtual Environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux / macOS
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

```bash
# Windows PowerShell
copy .env.example .env

# Linux / macOS / Git Bash
cp .env.example .env
```

Open `.env` and verify the following settings:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Defaults to `sqlite:///./oswd_sps.db`. For PostgreSQL: `postgresql://username:password@localhost:5432/db_name` |
| `SECRET_KEY` | A secure random string used to sign JWT tokens. Keep this private. |
| `SMTP_HOST` | Your SMTP host (e.g. `smtp.gmail.com` or Mailtrap). If left empty, the app runs in mock mode and prints emails to server logs. |
| `ADMIN_INITIAL_EMAIL` | Default Super Admin email created on first run |
| `ADMIN_INITIAL_PASSWORD` | Default Super Admin password created on first run |

### 5. Run the Development Server

```bash
python run.py
```

The application will launch on **`http://127.0.0.1:8000`**.

> **Note:** On first run, the database is automatically created and seeded with the default semester, Super Admin account, 5 question categories, and all 43 OSWD form questions.

---

## <img src="./docs/icons/credentials.svg#gh-light-mode-only" width="20" height="20" /><img src="./docs/icons/credentials-white.svg#gh-dark-mode-only" width="20" height="20" /> Default Credentials

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@nemsu.edu.ph` | `admin12345` |

> ⚠️ **Warning:** Change the default Super Admin credentials immediately before deploying to any public or production environment. Update `ADMIN_INITIAL_EMAIL` and `ADMIN_INITIAL_PASSWORD` in your `.env` file.

---

## <img src="./docs/icons/api.svg#gh-light-mode-only" width="20" height="20" /><img src="./docs/icons/api-white.svg#gh-dark-mode-only" width="20" height="20" /> API Documentation

Once the server is running, the interactive API documentation is available at:

| Interface | URL |
|---|---|
| Swagger UI | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) |
| ReDoc | [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc) |

Use the **Authorize** lock button in Swagger UI to authenticate as Super Admin or a student and test all endpoints directly in the browser.

---

## <img src="./docs/icons/tests.svg#gh-light-mode-only" width="20" height="20" /><img src="./docs/icons/tests-white.svg#gh-dark-mode-only" width="20" height="20" /> Running Tests

Run the full test suite with:

```bash
pytest -v
```

The tests cover routing integrity, request validation rules, authentication flows, data input handling, and CHED metrics aggregations. All tests must pass before any production deployment.

---

## <img src="./docs/icons/deployment.svg#gh-light-mode-only" width="20" height="20" /><img src="./docs/icons/deployment-white.svg#gh-dark-mode-only" width="20" height="20" /> Production Deployment

The following guide covers deploying this backend on a university Linux server (Ubuntu/Debian).

### 1. Configure PostgreSQL

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib libpq-dev python3-dev
sudo -u postgres psql
```

```sql
CREATE DATABASE oswd_sps_db;
CREATE USER oswd_user WITH PASSWORD 'securepassword';
GRANT ALL PRIVILEGES ON DATABASE oswd_sps_db TO oswd_user;
\q
```

Then update `DATABASE_URL` in `.env`:

```
DATABASE_URL=postgresql://oswd_user:securepassword@localhost:5432/oswd_sps_db
```

### 2. Configure Systemd Service

Create the service file:

```bash
sudo nano /etc/systemd/system/oswd_backend.service
```

Paste the following (replace paths and user as appropriate):

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
sudo systemctl status oswd_backend
```

### 3. Configure Nginx Reverse Proxy

```bash
sudo apt install nginx
sudo nano /etc/nginx/sites-available/oswd_sps
```

```nginx
server {
    listen 80;
    server_name oswd-sps.nemsu.edu.ph;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        alias /home/ubuntu/NEMSU-TC_OSWD_SPS/backend/uploads/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/oswd_sps /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. Enable HTTPS with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d oswd-sps.nemsu.edu.ph
```

### 5. Schedule PostgreSQL Backups

```bash
crontab -e
```

Add the following line to run a full backup daily at midnight:

```bash
0 0 * * * pg_dump -U oswd_user -d oswd_sps_db -F c -b -v -f /home/ubuntu/backups/oswd_sps_backup_$(date +\%Y\%m\%d).dump
```

> **Note:** SQLite backups are handled automatically by the app's background scheduler. The crontab above is only needed when using PostgreSQL in production.

---

## <img src="./docs/icons/contributing.svg#gh-light-mode-only" width="20" height="20" /><img src="./docs/icons/contributing-white.svg#gh-dark-mode-only" width="20" height="20" /> Contributing

Contributions, bug reports, and feature suggestions are welcome. Please open an issue or submit a pull request through the [GitHub repository](https://github.com/Marky012/NEMSU-TC_OSWD_SPS).

---

## <img src="./docs/icons/license.svg#gh-light-mode-only" width="20" height="20" /><img src="./docs/icons/license-white.svg#gh-dark-mode-only" width="20" height="20" /> License

This project is licensed under the [MIT License](./LICENSE).

---

<div align="center">
  <sub>Built with ❤️ for the Office of Student Welfare and Development — NEMSU Tagbina Campus</sub>
</div>