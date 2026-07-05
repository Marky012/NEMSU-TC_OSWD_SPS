<!-- SVG icons sourced from Flaticon (https://www.flaticon.com). Download your preferred icons and
     save them to ./docs/icons/. You only need ONE version of each icon (the dark/black version).
     GitHub automatically shows/hides images based on the #gh-dark-mode-only and #gh-light-mode-only
     URL fragments appended to the image src. No white copies needed. -->

<div align="center">

<h1>OSWD Student Profiling System</h1>
<p><strong>Office of the Student Welfare and Development</strong><br>North Eastern Mindanao State University — Tagbina Campus</p>

![Python](https://img.shields.io/badge/Python-3.13+-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19+-61DAFB?style=flat-square&logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Production-336791?style=flat-square&logo=postgresql&logoColor=white)
![Deployed on Render](https://img.shields.io/badge/Deployed_on-Render-46E3B7?style=flat-square&logo=render&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

<p>A fully deployed, production-ready full-stack web application for digitizing and managing student welfare profiling at NEMSU-TC. Built with FastAPI (backend), React + Vite (frontend), and PostgreSQL (production database) — replacing the university's manual paper-based OSWD forms.</p>

<!-- Replace ./docs/screenshot.png with your actual screenshot path -->
<p align="center">
  <img src="./docs/screenshot.png" alt="App Screenshot" width="80%" />
</p>

</div>

---

## 🚀 Live Deployment

The system is **fully deployed and live** on [Render](https://render.com):

| Service | Platform | Description |
|---|---|---|
| **Frontend** | Render Static Site | React + Vite SPA |
| **Backend API** | Render Web Service | FastAPI + Gunicorn |
| **Database** | Render PostgreSQL | Production database |

---

## <img src="./docs/icons/features.svg#gh-light-mode-only" width="20" height="20" /><img src="./docs/icons/features-white.svg#gh-dark-mode-only" width="20" height="20" /> Features

### Student-Facing
- **Secure Registration & Login** — Email verification flow with JWT-based authentication
- **Guided Profiling Form** — Multi-step digitized version of the 43-question OSWD paper form with conditional question rendering
- **Category Selection** — Supports New, Old, Transferee, Returnee, and Cross-Enrollee student classifications
- **Draft Saving** — Students can save progress and continue later
- **Address Cascade** — Region → Province → Municipality → Barangay drill-down selector
- **Form Submissions** — Final submission with unique verification code per student
- **Submission Tracking** — Students can view their submission status and admin feedback

### Admin-Facing
- **Admin Dashboard** — Real-time overview of semester statistics and submission counts
- **Student List & Search** — View, filter, search, and manage all student submissions
- **Staff View** — Read-only access level for OSWD staff
- **Audit Log** — Full trail of admin actions
- **Semester Management** — Create and manage academic semesters; enable/disable submission windows
- **Dynamic Question Editor** — Add, edit, reorder, and deactivate profiling questions without code changes
- **PDF Report Generation** — Per-student profile PDF export with ReportLab
- **CHED Compliance Reports** — Aggregated data reports matching CHED statistical requirements
- **Analytics Dashboard** — Charts and metrics for student demographic insights using Recharts
- **Admin & Role Management** — Super Admin can create, promote, and deactivate Admin and Staff accounts
- **PWD Document Uploads** — Secure file storage with magic-byte validation for PWD card photocopies
- **Submissions Toggle** — Enable/disable the profiling form for students in real-time

### System
- **JWT Authentication** — Secure OAuth2 Password Flow with Bcrypt hashing and RBAC
- **Automated Database Seeding** — First-run seeding of semesters, admin accounts, question categories, and all 43 form questions
- **Rate Limiting** — API rate limiting to prevent abuse
- **Mock SMTP Mode** — Emails are printed to server logs when no SMTP is configured (local dev)
- **Dual Database Support** — SQLite for local development, PostgreSQL for production
- **Automated Daily Backups** — Background scheduler retains SQLite backups for 30 days

---

## <img src="./docs/icons/stack.svg#gh-light-mode-only" width="20" height="20" /><img src="./docs/icons/stack-white.svg#gh-dark-mode-only" width="20" height="20" /> Tech Stack

### Backend
| Category | Technology | Purpose |
|---|---|---|
| Framework | FastAPI (Python 3.13+) | Core API framework with async support |
| ORM | SQLAlchemy | Database modeling and query abstraction |
| Database | SQLite / PostgreSQL | SQLite locally; PostgreSQL in production (Render) |
| Authentication | OAuth2 + JWT + Bcrypt | Secure token-based auth with hashed passwords |
| PDF Generation | ReportLab | Student profile PDF report generation |
| Validation | Pydantic | Request/response schema validation |
| Server | Uvicorn / Gunicorn | ASGI server for development and production |

### Frontend
| Category | Technology | Purpose |
|---|---|---|
| Framework | React 19 + Vite 8 | SPA framework with fast bundling |
| Routing | React Router DOM v7 | Client-side routing |
| UI Components | shadcn/ui + Base UI | Accessible, composable component library |
| Styling | Tailwind CSS v3 | Utility-first styling |
| Animations | Framer Motion | Page transitions and micro-animations |
| Charts | Recharts | Analytics dashboard visualizations |
| HTTP Client | Axios | API communication with auto token injection |
| Notifications | Sonner | Toast notification system |
| Icons | Lucide React | Consistent icon set |

---

## <img src="./docs/icons/structure.svg#gh-light-mode-only" width="20" height="20" /><img src="./docs/icons/structure-white.svg#gh-dark-mode-only" width="20" height="20" /> Project Structure

```
NEMSU-TC_OSWD_SPS/
├── backend/
│   ├── app/
│   │   ├── main.py                # App config, startup, CORS, background scheduler
│   │   ├── config.py              # Configuration manager using Pydantic Settings
│   │   ├── database.py            # SQLAlchemy engine & session factory (SQLite/PostgreSQL)
│   │   ├── models.py              # SQLAlchemy database models
│   │   ├── schemas.py             # Pydantic request & response schemas
│   │   ├── dependencies.py        # Auth & role-checking injectables
│   │   ├── rate_limiter.py        # API rate limiting middleware
│   │   ├── routers/
│   │   │   ├── auth.py            # Registration, login, email verification, profile
│   │   │   ├── forms.py           # Questions, categories, semester info
│   │   │   ├── students.py        # Draft saving, form submission, student records
│   │   │   ├── admin.py           # Admin management, submissions control, audit log
│   │   │   ├── reports.py         # PDF export, CHED reports, analytics
│   │   │   └── address.py         # Region/Province/Municipality/Barangay cascade API
│   │   ├── utils/                 # Security (hash/JWT) & SMTP client
│   │   ├── seeders/               # Database seeders (categories, admin, 43 questions)
│   │   └── data/                  # Philippine address data (JSON)
│   ├── uploads/                   # Secure storage for PWD card photocopies
│   ├── backups/                   # Automated daily SQLite backups (30-day retention)
│   ├── run.py                     # Hot-reloading development server launcher
│   ├── requirements.txt           # Python dependencies
│   ├── test_main.py               # End-to-end integration test suite
│   └── .env                       # Environment variables (not committed)
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Root component with routing and auth context
│   │   ├── main.jsx               # React entry point
│   │   ├── index.css              # Global styles and design tokens
│   │   ├── api/
│   │   │   └── apiClient.js       # Axios instance with JWT injection & 401 auto-logout
│   │   ├── components/
│   │   │   ├── ui/                # shadcn/ui & Base UI component library
│   │   │   ├── form/              # AddressCascade and other form-specific components
│   │   │   ├── AnimatedPage.jsx   # Framer Motion page transition wrapper
│   │   │   └── ConfirmDialog.jsx  # Reusable confirmation modal
│   │   ├── context/               # React context for auth state
│   │   ├── lib/                   # Utilities and constants
│   │   └── pages/
│   │       ├── Login.jsx          # Student/Admin login
│   │       ├── Register.jsx       # Student registration
│   │       ├── VerifyEmail.jsx    # Email verification
│   │       ├── ForgotPassword.jsx # Password recovery flow
│   │       ├── ResetPassword.jsx  # Password reset
│   │       ├── Home.jsx           # Student dashboard
│   │       ├── ProfileForm.jsx    # Multi-step profiling form
│   │       ├── Submissions.jsx    # Student submission tracker
│   │       └── admin/
│   │           ├── AdminDashboard.jsx   # Overview & stats
│   │           ├── StudentList.jsx      # Full student records management
│   │           ├── StaffView.jsx        # Read-only staff interface
│   │           ├── Analytics.jsx        # Charts & demographic insights
│   │           ├── CHEDReports.jsx      # CHED compliance reporting
│   │           ├── SemesterManagement.jsx # Semester & submission controls
│   │           ├── QuestionEditor.jsx   # Dynamic form question management
│   │           ├── ManageAdmins.jsx     # Admin & staff account management
│   │           └── AuditLog.jsx         # Admin action history
│   ├── public/                    # Static assets
│   ├── index.html                 # HTML entry point
│   ├── vite.config.js             # Vite build configuration
│   ├── tailwind.config.js         # Tailwind CSS configuration
│   └── package.json               # Node.js dependencies
│
├── docs/                          # Documentation assets (icons, screenshots)
├── Procfile                       # Render/Heroku process definition
└── README.md
```

---

## <img src="./docs/icons/setup.svg#gh-light-mode-only" width="20" height="20" /><img src="./docs/icons/setup-white.svg#gh-dark-mode-only" width="20" height="20" /> Getting Started (Local Development)

### Prerequisites

- **Python 3.9+** (3.13 recommended)
- **Node.js 18+** and npm
- `venv` virtual environment tool

### 1. Clone the Repository

```bash
git clone https://github.com/Marky012/NEMSU-TC_OSWD_SPS.git
cd NEMSU-TC_OSWD_SPS
```

---

### Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# Linux / macOS
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

Configure environment variables:

```bash
# Windows PowerShell
copy .env.example .env

# Linux / macOS
cp .env.example .env
```

Open `.env` and configure:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Defaults to `sqlite:///./oswd_sps.db`. For PostgreSQL: `postgresql://username:password@localhost:5432/db_name` |
| `SECRET_KEY` | A secure random string used to sign JWT tokens. Keep this private. |
| `SMTP_HOST` | Your SMTP host (e.g. `smtp.gmail.com`). If empty, emails are printed to server logs (mock mode). |
| `ADMIN_INITIAL_EMAIL` | Default Super Admin email created on first run |
| `ADMIN_INITIAL_PASSWORD` | Default Super Admin password created on first run |

Start the backend:

```bash
python run.py
```

The API will launch at **`http://127.0.0.1:8000`**.

> **Note:** On first run, the database is automatically seeded with the default semester, Super Admin account, 5 question categories, and all 43 OSWD form questions.

---

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The frontend will launch at **`http://localhost:5173`**.

> **Note:** By default, the frontend connects to `http://localhost:5000/api`. Set `VITE_API_URL` in a `.env.local` file to point to a different backend URL.

---

## <img src="./docs/icons/credentials.svg#gh-light-mode-only" width="20" height="20" /><img src="./docs/icons/credentials-white.svg#gh-dark-mode-only" width="20" height="20" /> Default Credentials

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@nemsu.edu.ph` | `admin12345` |

> ⚠️ **Warning:** Change the default Super Admin credentials immediately before deploying to any public or production environment. Update `ADMIN_INITIAL_EMAIL` and `ADMIN_INITIAL_PASSWORD` in your `.env` file.

---

## <img src="./docs/icons/api.svg#gh-light-mode-only" width="20" height="20" /><img src="./docs/icons/api-white.svg#gh-dark-mode-only" width="20" height="20" /> API Documentation

Once the backend is running, interactive API documentation is available at:

| Interface | URL |
|---|---|
| Swagger UI | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) |
| ReDoc | [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc) |

Use the **Authorize** lock button in Swagger UI to authenticate and test all endpoints directly in the browser.

---

## <img src="./docs/icons/tests.svg#gh-light-mode-only" width="20" height="20" /><img src="./docs/icons/tests-white.svg#gh-dark-mode-only" width="20" height="20" /> Running Tests

```bash
cd backend
pytest -v
```

The tests cover routing integrity, request validation, authentication flows, data handling, and CHED metrics aggregations.

---

## <img src="./docs/icons/deployment.svg#gh-light-mode-only" width="20" height="20" /><img src="./docs/icons/deployment-white.svg#gh-dark-mode-only" width="20" height="20" /> Production Deployment (Render)

This system is deployed on [Render](https://render.com) using three separate services.

### 1. PostgreSQL Database

Create a **PostgreSQL** instance on Render. Copy the **Internal Database URL** — you will need it as `DATABASE_URL` for the backend service.

### 2. Backend Web Service

Create a new **Web Service** on Render pointing to this repository:

| Setting | Value |
|---|---|
| **Root Directory** | `backend` |
| **Runtime** | Python 3 |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app` |

Set the following **Environment Variables** in the Render dashboard:

| Variable | Value |
|---|---|
| `DATABASE_URL` | PostgreSQL Internal URL from Step 1 |
| `SECRET_KEY` | A long, random, secure string |
| `ADMIN_INITIAL_EMAIL` | Your Super Admin email |
| `ADMIN_INITIAL_PASSWORD` | Your Super Admin password |
| `SMTP_HOST` | Your SMTP provider (or leave empty for mock mode) |
| `FRONTEND_URL` | The deployed frontend URL (for CORS) |

### 3. Frontend Static Site

Create a **Static Site** on Render:

| Setting | Value |
|---|---|
| **Root Directory** | `frontend` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `frontend/dist` |

Set the following **Environment Variable**:

| Variable | Value |
|---|---|
| `VITE_API_URL` | The deployed backend API URL (e.g. `https://your-backend.onrender.com/api`) |

> **Note:** On Render's free tier, the backend web service may spin down after inactivity. The first request after idle will take ~30 seconds to respond while it starts back up.

---

## <img src="./docs/icons/deployment.svg#gh-light-mode-only" width="20" height="20" /><img src="./docs/icons/deployment-white.svg#gh-dark-mode-only" width="20" height="20" /> Self-Hosted Deployment (Linux Server)

For deploying on a university Linux server (Ubuntu/Debian):

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

Update `DATABASE_URL` in `.env`:

```
DATABASE_URL=postgresql://oswd_user:securepassword@localhost:5432/oswd_sps_db
```

### 2. Configure Systemd Service

```bash
sudo nano /etc/systemd/system/oswd_backend.service
```

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

```bash
sudo systemctl daemon-reload
sudo systemctl enable oswd_backend
sudo systemctl start oswd_backend
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

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend static files
    location / {
        root /home/ubuntu/NEMSU-TC_OSWD_SPS/frontend/dist;
        try_files $uri $uri/ /index.html;
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

---

## <img src="./docs/icons/contributing.svg#gh-light-mode-only" width="20" height="20" /><img src="./docs/icons/contributing-white.svg#gh-dark-mode-only" width="20" height="20" /> Contributing

Contributions, bug reports, and feature suggestions are welcome. Please open an issue or submit a pull request through the [GitHub repository](https://github.com/Marky012/NEMSU-TC_OSWD_SPS).

---

## <img src="./docs/icons/license.svg#gh-light-mode-only" width="20" height="20" /><img src="./docs/icons/license-white.svg#gh-dark-mode-only" width="20" height="20" /> License

This project is licensed under the [MIT License](./LICENSE).

---

<div align="center">
  <sub>Built with ❤️ for the Office of the Student Welfare and Development — NEMSU Tagbina Campus</sub>
</div>