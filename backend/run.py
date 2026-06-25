import uvicorn
from app.seeders.admin_user import create_admin_if_missing
from app.database import Base, engine

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    # Ensure the default admin account exists before the server starts
    create_admin_if_missing()
    print("Starting OSWD Student Profiling System API server on http://127.0.0.1:8000...")
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_excludes=["*.db", "backups/*", "__pycache__/*", "*.pyc"]
    )
