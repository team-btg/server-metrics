from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from datetime import datetime
from uuid import UUID  

class ServerRegister(BaseModel):
    pubkey: str
    fingerprint: str
    hostname: str
    tags: Dict[str, str]

class ServerOut(BaseModel):
    server_id: UUID
    token: str

class MetricSample(BaseModel):
    name: str
    value: float
 
class MetricIn(BaseModel):
    server_id: UUID
    timestamp: datetime
    metrics: List[Dict[str, Any]] 
    meta: Optional[Dict[str, Any]] = None

class LogIn(BaseModel):
    server_id: UUID
    timestamp: datetime
    level: str
    source: Optional[str] = None
    event_id: Optional[str] = None
    message: str
    meta: Optional[Dict] = None
