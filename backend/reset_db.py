"""
Reset database: drops all tables and recreates them.
Run this before pilot testing to clear sample data.
After running, restart the backend — the seeder will repopulate
questions, categories, semesters, and the admin account.
"""
from app.database import engine, Base
from app import models

if __name__ == "__main__":
    confirm = input("This will DELETE ALL DATA. Are you sure? (yes/no): ")
    if confirm.lower() != "yes":
        print("Cancelled.")
        exit(0)

    print("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("Recreating all tables...")
    Base.metadata.create_all(bind=engine)
    print("Done! Restart the backend to re-seed default data (admin, questions, etc.).")
