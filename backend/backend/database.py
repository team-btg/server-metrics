import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from google.cloud.sql.connector import Connector, IPTypes
from dotenv import load_dotenv

load_dotenv()

Base = declarative_base()
 
_engine = None
_SessionLocal = None

def _create_and_configure_engine():
    """Helper to create the SQLAlchemy engine and sessionmaker based on environment."""
    global _engine, _SessionLocal
    if _engine is not None: 
        return

    DB_CONNECTION_NAME = os.getenv("DB_CONNECTION_NAME")

    if DB_CONNECTION_NAME: 
        connector = Connector()
        def getconn():
            return connector.connect(
                DB_CONNECTION_NAME, "pg8000",
                user=os.environ["DB_USER"], password=os.environ["DB_PASS"],
                db=os.environ["DB_NAME"], ip_type=IPTypes.PUBLIC
            )
        _engine = create_engine("postgresql+pg8000://", creator=getconn)
    else: 
        DATABASE_URL = os.getenv("DATABASE_URL")
        if not DATABASE_URL:
            raise ValueError("DATABASE_URL environment variable not set for local development")
        _engine = create_engine(DATABASE_URL)

    _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine) 
    Base.metadata.create_all(bind=_engine)
    print("Database engine and session factory configured and tables created.")
 
def get_db_session_for_background():
    """
    Provides a fresh DB session for background tasks.
    Ensures database engine and session factory are initialized if not already.
    """
    if _SessionLocal is None: 
        _create_and_configure_engine()
        if _SessionLocal is None:
             raise RuntimeError("Failed to initialize database session factory after attempt.")
    
    return _SessionLocal()  
 
def get_db():
    """Provides a DB session for FastAPI request-response cycle."""
    if _SessionLocal is None:
        raise RuntimeError("Database not initialized. Call initialize_database() on app startup.")
    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()
 
def initialize_database():
    _create_and_configure_engine()
 
SessionLocal = get_db_session_for_background

def get_database_engine():
    """
    Provides access to the initialized SQLAlchemy engine.
    Ensures the engine is initialized if not already.
    """
    if _engine is None:
        _create_and_configure_engine()
        if _engine is None:
            raise RuntimeError("Failed to initialize database engine after attempt.")
    return _engine
 
engine = get_database_engine