from pydantic import BaseModel, ConfigDict
from typing import List, Dict, Optional, Any
from datetime import datetime
from uuid import UUID  

class ServerCreate(BaseModel):
    hostname: str
    tags: Optional[List[str]] = []

class Server(BaseModel):
    id: UUID
    hostname: str
    
    model_config = ConfigDict(from_attributes=True)

class ServerWithApiKey(Server):
    api_key: str

class ServerClaim(BaseModel):
    server_id: UUID
    api_key: str

# --- Existing Schemas ---

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
