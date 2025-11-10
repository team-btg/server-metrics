import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from google.cloud.sql.connector import Connector, IPTypes
from dotenv import load_dotenv

load_dotenv()

Base = declarative_base()
engine = None
SessionLocal = None

def initialize_database():
    """Initializes the database engine and session factory for the FastAPI app."""
    global engine, SessionLocal
    if engine:
        return

    DB_CONNECTION_NAME = os.getenv("DB_CONNECTION_NAME")

    if DB_CONNECTION_NAME:
        # Production (Cloud Run): Use Cloud SQL Python Connector
        connector = Connector()
        def getconn():
            return connector.connect(
                DB_CONNECTION_NAME, "pg8000",
                user=os.environ["DB_USER"], password=os.environ["DB_PASS"],
                db=os.environ["DB_NAME"], ip_type=IPTypes.PUBLIC
            )
        engine = create_engine("postgresql+pg8000://", creator=getconn)
    else:
        # Development: Use the standard DATABASE_URL from .env
        DATABASE_URL = os.getenv("DATABASE_URL")
        if not DATABASE_URL:
            raise ValueError("DATABASE_URL environment variable not set for local development")
        engine = create_engine(DATABASE_URL)

    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    if not SessionLocal:
        raise RuntimeError("Database not initialized. Call initialize_database() on app startup.")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
