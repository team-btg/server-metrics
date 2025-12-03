from pydantic import BaseModel, ConfigDict, EmailStr
from typing import List, Dict, Optional, Any
from datetime import datetime
from uuid import UUID  
import enum

from backend.models import RecommendationType

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

class AlertRuleBase(BaseModel):
    name: str
    metric: AlertMetric
    operator: AlertOperator
    threshold: float
    duration_minutes: int = 5
    is_enabled: bool = True
    type: AlertRuleType = AlertRuleType.THRESHOLD   

class AlertRuleCreate(AlertRuleBase):
    pass
 
class AlertRuleUpdate(BaseModel):
    name: Optional[str] = None
    metric: Optional[AlertMetric] = None
    operator: Optional[AlertOperator] = None
    threshold: Optional[float] = None
    duration_minutes: Optional[int] = None
    is_enabled: Optional[bool] = None
    type: Optional[AlertRuleType] = None
 
class AlertRule(AlertRuleBase):
    id: int
    server_id: UUID
    
    type: AlertRuleType
    model_config = ConfigDict(from_attributes=True)

class Incident(BaseModel):
    id: UUID
    server_id: UUID
    alert_rule_id: int
    status: str
    triggered_at: datetime
    resolved_at: Optional[datetime] = None
    summary: Optional[str] = None
    alert_rule: AlertRule

    class Config:
        from_attributes = True 

class RecommendationBase(BaseModel):
    recommendation_type: RecommendationType
    summary: str

class RecommendationCreate(RecommendationBase):
    pass    

class Recommendation(RecommendationBase):
    id: int
    server_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
        
class ServerCreate(BaseModel):
    hostname: str
    tags: Optional[List[str]] = []

class Server(BaseModel):
    id: UUID
    hostname: str 
    webhook_url: Optional[str] = None
    webhook_format: Optional[str] = None
    webhook_headers: Optional[Dict[str, str]] = None

    model_config = ConfigDict(from_attributes=True)

class ServerWithApiKey(Server):
    api_key: str

class ServerClaim(BaseModel):
    server_id: UUID
    api_key: str

class ServerUpdate(BaseModel):
    webhook_url: Optional[str] = None
    webhook_format: Optional[str] = None 
    webhook_headers: Optional[Dict[str, str]] = None

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int 
    is_active: bool
    servers: List[Server] = []
    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class ServerRegister(BaseModel):
    pubkey: str
    fingerprint: str
    hostname: str
    tags: Dict[str, str]
  
class MetricIn(BaseModel):
    server_id: UUID
    timestamp: datetime
    metrics: List[Dict[str, Any]] 
    processes: Optional[List[Dict[str, Any]]] = None
    meta: Optional[Dict[str, Any]] = None

class LogIn(BaseModel):
    server_id: UUID
    timestamp: datetime
    level: str
    source: Optional[str] = None
    event_id: Optional[str] = None
    message: str
    meta: Optional[Dict] = None

class SpanIn(BaseModel):
    id: UUID
    parent_id: Optional[UUID] = None
    name: str
    span_type: str
    start_time: datetime
    duration_ms: float
    attributes: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class TraceIn(BaseModel):
    server_id: UUID 
    timestamp: datetime
    duration_ms: float
    service_name: str
    endpoint: Optional[str] = None
    status_code: Optional[int] = None
    attributes: Optional[Dict[str, Any]] = None
    spans: List[SpanIn] = [] # Nested spans

    class Config:
        from_attributes = True
 
class SpanOut(SpanIn):
    trace_id: UUID

class TraceOut(TraceIn):
    id: UUID
    spans: List[SpanOut] = []