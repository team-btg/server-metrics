import enum
from sqlalchemy import Column, Integer, String, JSON, ForeignKey, DateTime, func, Float, Boolean, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import datetime

from .database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True) # Nullable for social logins
    provider = Column(String, nullable=True) # e.g., 'google', 'github'
    
    servers = relationship("Server", back_populates="owner")

class Server(Base):
    __tablename__ = "servers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fingerprint = Column(String, unique=True, index=True)
    pubkey = Column(String)
    hostname = Column(String)
    tags = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    metrics = relationship("Metric", back_populates="server")

    user_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="servers")
    
    api_keys = relationship("ApiKey", back_populates="server")

class AlertMetric(str, enum.Enum):
    CPU = "cpu"
    MEMORY = "memory"
    DISK = "disk"

class AlertOperator(str, enum.Enum):
    GREATER_THAN = ">"
    LESS_THAN = "<"

class AlertRule(Base):
    __tablename__ = "alert_rules"
    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id"), nullable=False)
    metric = Column(Enum(AlertMetric), nullable=False)
    operator = Column(Enum(AlertOperator), nullable=False)
    threshold = Column(Float, nullable=False)
    duration_minutes = Column(Integer, nullable=False, default=5) # e.g., must be over threshold for 5 mins
    is_enabled = Column(Boolean, default=True)
    
    server = relationship("Server")

class AlertEvent(Base):
    __tablename__ = "alert_events"
    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(Integer, ForeignKey("alert_rules.id"), nullable=False)
    triggered_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    
    rule = relationship("AlertRule")
           
class Metric(Base):
    __tablename__ = "metrics"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id"))
    timestamp = Column(DateTime(timezone=True))
    metrics = Column(JSON)  # array of {name, value}
    processes = Column(JSON)  # array of process info dicts
    meta = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    server = relationship("Server", back_populates="metrics")

class Log(Base):
    __tablename__ = "logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    server_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    level = Column(String, index=True)   # Info, Warning, Error
    source = Column(String, nullable=True)
    event_id = Column(String, nullable=True)
    message = Column(String, nullable=False)
    meta = Column(JSON, nullable=True)

class ApiKey(Base):
    __tablename__ = "api_keys"
    id = Column(Integer, primary_key=True, index=True)
    key_hash = Column(String, unique=True, index=True, nullable=False)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id"), nullable=False)
    server = relationship("Server")