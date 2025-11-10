import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from google.cloud.sql.connector import Connector, IPTypes
from dotenv import load_dotenv

load_dotenv()

Base = declarative_base()

# Determine the database URL at the module level based on environment
DB_CONNECTION_NAME = os.getenv("DB_CONNECTION_NAME")
DATABASE_URL = os.getenv("DATABASE_URL")

if DB_CONNECTION_NAME:
    # Production: Use Cloud SQL Python Connector
    connector = Connector()

    def getconn():
        conn = connector.connect(
            DB_CONNECTION_NAME,
            "pg8000",
            user=os.environ["DB_USER"],
            password=os.environ["DB_PASS"],
            db=os.environ["DB_NAME"],
            ip_type=IPTypes.PUBLIC
        )
        return conn

    engine = create_engine("postgresql+pg8000://", creator=getconn)
else:
    # Development: Use the local database URL
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable not set for local development")
    engine = create_engine(DATABASE_URL)

# SessionLocal can now be created safely in the global scope
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
