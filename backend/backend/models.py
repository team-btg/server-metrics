import enum
from sqlalchemy.ext.compiler import compiles
from sqlalchemy import Column, FunctionElement, Integer, String, JSON, ForeignKey, DateTime, Text, func, Float, Boolean, Enum, Index, UniqueConstraint
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
    is_active = Column(Boolean, default=True)
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

    user_id = Column(Integer, ForeignKey("users.id"))
    webhook_url = Column(String, nullable=True)
    webhook_format = Column(String, nullable=True) # e.g., 'slack_discord' or 'teams'
    webhook_headers = Column(JSON, nullable=True)

    owner = relationship("User", back_populates="servers") 

    api_keys = relationship("ApiKey", back_populates="server", cascade="all, delete-orphan")
    metrics = relationship("Metric", back_populates="server", cascade="all, delete-orphan")
    logs = relationship("Log", back_populates="server", cascade="all, delete-orphan")
    alert_rules = relationship("AlertRule", back_populates="server", cascade="all, delete-orphan")
    incidents = relationship("Incident", back_populates="server", cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", back_populates="server", cascade="all, delete-orphan") # Add this line

class time_bucket(FunctionElement):
    name = "time_bucket"

@compiles(time_bucket, "postgresql")
def pg_time_bucket(element, compiler, **kw):
    # The first argument is the interval, the second is the timestamp column
    return f"time_bucket('{compiler.process(element.clauses.clauses[0])}', {compiler.process(element.clauses.clauses[1])})"

class RecommendationType(str, enum.Enum):
    UPGRADE = "UPGRADE"
    DOWNGRADE = "DOWNGRADE"
    STABLE = "STABLE"

class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id"), nullable=False)
    
    recommendation_type = Column(Enum(RecommendationType), nullable=False)
    summary = Column(Text, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    server = relationship("Server", back_populates="recommendations")

class MetricBaseline(Base):
    __tablename__ = "metric_baselines"

    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id"), nullable=False)
    metric_name = Column(String, nullable=False) # e.g., "cpu.percent", "mem.percent"
     
    hour_of_day = Column(Integer, nullable=False) 
    
    mean_value = Column(Float, nullable=False)
    std_dev_value = Column(Float, nullable=False)
     
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    server = relationship("Server")

    __table_args__ = (
        UniqueConstraint('server_id', 'metric_name', 'hour_of_day', name='_server_metric_hour_uc'),
    )

class AlertMetric(str, enum.Enum):
    CPU = "cpu"
    MEMORY = "memory"
    DISK = "disk"

class AlertOperator(str, enum.Enum):
    GREATER_THAN = ">"
    LESS_THAN = "<"

class AlertRuleType(str, enum.Enum):
    THRESHOLD = "THRESHOLD"
    ANOMALY = "ANOMALY"

class AlertRule(Base):
    __tablename__ = "alert_rules"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id"), nullable=False)
    metric = Column(Enum(AlertMetric), nullable=False)
    operator = Column(Enum(AlertOperator), nullable=False)
    threshold = Column(Float, nullable=False)
    duration_minutes = Column(Integer, nullable=False, default=5) # e.g., must be over threshold for 5 mins
    is_enabled = Column(Boolean, default=True)
    
    server = relationship("Server")
    type = Column(Enum(AlertRuleType), default=AlertRuleType.THRESHOLD, nullable=False)
    
class Incident(Base):
    __tablename__ = "incidents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id"), nullable=False)
    alert_rule_id = Column(Integer, ForeignKey("alert_rules.id"), nullable=False) # Changed from UUID to Integer
    
    status = Column(String, default="investigating", index=True) # investigating, active, resolved
    triggered_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    
    summary = Column(Text, nullable=True)
    correlated_data = Column(JSON, nullable=True) # Store the raw data fed to the AI for audit

    server = relationship("Server")
    alert_rule = relationship("AlertRule")
           
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

    __table_args__ = (
        Index("idx_metrics_server_timestamp", "server_id", "timestamp"),
    )

class Log(Base):
    __tablename__ = "logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id"), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    level = Column(String, index=True)   # Info, Warning, Error
    source = Column(String, nullable=True)
    event_id = Column(String, nullable=True)
    message = Column(String, nullable=False)
    meta = Column(JSON, nullable=True)

    server = relationship("Server", back_populates="logs")

class ApiKey(Base):
    __tablename__ = "api_keys"
    id = Column(Integer, primary_key=True, index=True)
    key_hash = Column(String, unique=True, index=True, nullable=False)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id"), nullable=False)
    server = relationship("Server")

class Trace(Base):
    __tablename__ = "traces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    duration_ms = Column(Float, nullable=False) # Total duration of the trace in milliseconds
    service_name = Column(String, nullable=False) # e.g., "fastapi-app", "flask-service"
    endpoint = Column(String, nullable=True) # e.g., "/api/v1/users/{user_id}"
    status_code = Column(Integer, nullable=True) # HTTP status code for web requests
    attributes = Column(JSON, nullable=True) # JSONB for additional trace-level metadata (e.g., host, user_id, request_id)

    server = relationship("Server")
    spans = relationship("Span", back_populates="trace", cascade="all, delete-orphan", order_by="Span.start_time")

    def __repr__(self):
        return f"<Trace {self.id} on {self.server_id} - {self.endpoint} ({self.duration_ms:.2f}ms)>"

class Span(Base):
    __tablename__ = "spans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    trace_id = Column(UUID(as_uuid=True), ForeignKey("traces.id"), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("spans.id"), nullable=True) # For nested spans

    name = Column(String, nullable=False) # e.g., "GET /users", "db.query", "calculate_payroll"
    span_type = Column(String, nullable=False) # e.g., "http", "db", "function", "external", "cache"
    start_time = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    duration_ms = Column(Float, nullable=False)
    attributes = Column(JSON, nullable=True) # JSONB for span-specific metadata (e.g., actual DB query, HTTP method, URL, error message)

    trace = relationship("Trace", back_populates="spans")
    parent = relationship("Span", remote_side=[id], backref="children", uselist=False)

    def __repr__(self):
        return f"<Span {self.id} ({self.span_type}): {self.name} ({self.duration_ms:.2f}ms)>"
