import secrets
import hashlib
import asyncio
import os
import google.generativeai as genai 

from fastapi import APIRouter, OAuth2PasswordBearer, OAuth2PasswordRequestForm, FastAPI, Depends, Request, Security, status, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.security import APIKeyHeader, HTTPBearer, HTTPAuthorizationCredentials
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import desc 
from backend.database import SessionLocal, engine, Base
from backend import models, schemas 
from backend.security import create_access_token, verify_access_token, decode_jwt
from uuid import UUID
from typing import List, Optional, Any, Dict
from .websocket_manager import ConnectionManager 
from datetime import datetime, timedelta 
from pydantic import BaseModel
from dotenv import load_dotenv
from passlib.context import CryptContext
from authlib.integrations.starlette_client import OAuth

load_dotenv()

Base.metadata.create_all(bind=engine)

# --- Security & Auth Setup ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")

oauth = OAuth()
oauth.register(
    name='google',
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'}
)

oauth.register(
    name='github',
    client_id=GITHUB_CLIENT_ID,
    client_secret=GITHUB_CLIENT_SECRET,
    access_token_url='https://github.com/login/oauth/access_token',
    access_token_params=None,
    authorize_url='https://github.com/login/oauth/authorize',
    authorize_params=None,
    api_base_url='https://api.github.com/',
    client_kwargs={'scope': 'user:email'},
)

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

app = FastAPI()

# Allowed origins for your frontend
origins = [
    "http://localhost:5173",  # Vite dev server
    "http://localhost:3000",  # React dev server
    # Add any other frontend URLs if needed
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Allows specified origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

auth_scheme = HTTPBearer(auto_error=True)
manager = ConnectionManager()

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        
# --- Dependency to get current user ---
async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    # ... (logic to decode JWT and fetch user from DB) ...
    # This will be the core of your session management
    pass

# --- New Auth Router ---
auth_router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])

@auth_router.post("/register")
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # ... (logic to check if user exists, hash password, save to DB) ...
    pass

@auth_router.post("/login")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # ... (logic to verify user/password, create and return JWT) ...
    pass

@auth_router.get('/google')
async def login_google(request: Request):
    redirect_uri = request.url_for('auth_google_callback')
    return await oauth.google.authorize_redirect(request, redirect_uri)

@auth_router.get('/google/callback')
async def auth_google_callback(request: Request, db: Session = Depends(get_db)):
    token = await oauth.google.authorize_access_token(request)
    user_info = token.get('userinfo')
    # ... (logic to find or create user from user_info, create JWT, and return it) ...
    # You would likely redirect the user to the frontend with the token in a query param
    pass

@auth_router.get('/google/callback')
async def auth_google_callback(request: Request, db: Session = Depends(get_db)):
    # ... your existing google callback logic
    pass

# New GitHub Endpoints
@auth_router.get('/github')
async def login_github(request: Request):
    redirect_uri = request.url_for('auth_github_callback')
    return await oauth.github.authorize_redirect(request, redirect_uri)

@auth_router.get('/github/callback')
async def auth_github_callback(request: Request, db: Session = Depends(get_db)):
    token = await oauth.github.authorize_access_token(request)
    resp = await oauth.github.get('user', token=token)
    profile = resp.json()
    
    # GitHub can have a null email if it's private. We might need to make a second request.
    email = profile.get('email')
    if not email:
        resp_email = await oauth.github.get('user/emails', token=token)
        emails = resp_email.json()
        primary_email = next((e['email'] for e in emails if e['primary']), None)
        email = primary_email

    if not email:
        raise HTTPException(status_code=400, detail="Could not retrieve email from GitHub.")

    # --- Find or Create User Logic (same as Google, just different provider name) ---
    # user = db.query(models.User).filter(models.User.email == email).first()
    # if not user:
    #     user = models.User(email=email, provider='github')
    #     db.add(user)
    #     db.commit()
    #
    # # Create and return JWT
    # access_token = create_access_token(data={"sub": user.email})
    # return {"access_token": access_token, "token_type": "bearer"}
    # For now, we'll just return the profile to show it works
    return {"message": "GitHub login successful", "email": email}

app.include_router(auth_router)
  
def get_server_from_api_key(key: str = Security(api_key_header), db: Session = Depends(get_db)):
    if not key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="API Key is missing")
    
    key_hash = hashlib.sha256(key.encode()).hexdigest()
    api_key_entry = db.query(models.ApiKey).filter(models.ApiKey.key_hash == key_hash).first()

    if not api_key_entry:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API Key")
    
    return api_key_entry.server

# Configure the Gemini API
try:
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("Warning: GOOGLE_API_KEY is not set. Chat functionality will be disabled.")
        genai_model = None
    else:
        genai.configure(api_key=api_key)
        genai_model = genai.GenerativeModel('models/gemini-2.5-flash')
except Exception as e:
    print(f"Error configuring Gemini API: {e}")
    genai_model = None

class ChatRequest(BaseModel):
    question: str
    metrics: Dict[str, Any]

@app.post("/api/v1/chat/diagnose", tags=["chat"])
async def diagnose_with_chat(request: ChatRequest):
    if not genai_model:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI Chat Service is not configured or available.",
        )

    # Construct the prompt for Gemini
    prompt = f"""
    You are an expert server administrator and performance analyst. Your goal is to help a user understand their server's health and diagnose problems based on the data provided.

    Here is a JSON object with the latest performance metrics from the user's server:
    {request.metrics}

    The user has asked the following question:
    "{request.question}"

    Analyze the provided metrics to answer the user's question. Provide a clear, concise explanation and suggest actionable steps if a problem is detected. Format your response in Markdown.
    If the metrics look healthy, say so.
    """

    try:
        response = genai_model.generate_content(prompt)
        return {"response": response.text}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while communicating with the AI service: {e}",
        )

@app.post("/api/v1/agent/register", response_model=schemas.ServerWithApiKey, status_code=status.HTTP_201_CREATED)
def agent_register(server_create: schemas.ServerCreate, db: Session = Depends(get_db)):
    new_server = models.Server(hostname=server_create.hostname, tags=server_create.tags)
    db.add(new_server)
    db.commit()
    db.refresh(new_server)

    api_key_plain = secrets.token_hex(32)
    api_key_hash = hashlib.sha256(api_key_plain.encode()).hexdigest()
    
    new_api_key = models.ApiKey(key_hash=api_key_hash, server_id=new_server.id)
    db.add(new_api_key)
    db.commit()

    return {"id": new_server.id, "hostname": new_server.hostname, "api_key": api_key_plain}

@app.post("/api/v1/servers/claim", response_model=schemas.Server)
def claim_server(claim_request: schemas.ServerClaim, db: Session = Depends(get_db)):
    server = get_server_from_api_key(claim_request.api_key, db)
    if str(server.id) != str(claim_request.server_id):
        raise HTTPException(status_code=403, detail="API Key does not match the provided Server ID.")
    return server
  
@app.get("/api/v1/servers", response_model=List[schemas.Server])
def get_all_servers(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    servers = db.query(models.Server).filter(models.Server.user_id == current_user.id).order_by(models.Server.hostname).all()
    return servers

# ========== METRICS ==========
@app.get("/api/v1/metrics/history")
def historical_metrics(
    server_id: str = Query(...),
    period: str = Query("1h", description="Time period, e.g., 15m, 1h, 6h, 24h"),
    db: Session = Depends(get_db)
):
    try:
        server_uuid = UUID(server_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid server_id")

    period_map = {
        "15m": timedelta(minutes=15),
        "1h": timedelta(hours=1),
        "6h": timedelta(hours=6),
        "24h": timedelta(hours=24),
    }

    delta = period_map.get(period)
    if not delta:
        raise HTTPException(status_code=400, detail="Invalid period specified")

    start_time = datetime.utcnow() - delta

    rows = (
        db.query(models.Metric)
        .filter(models.Metric.server_id == server_uuid, models.Metric.timestamp >= start_time)
        .order_by(models.Metric.timestamp)
        .all()
    )

    results = [
        {
            "server_id": str(row.server_id),
            "timestamp": row.timestamp.isoformat(),
            "metrics": row.metrics,
            "meta": row.meta or {},
        }
        for row in rows
    ]
    
    return results

@app.get("/api/v1/metrics/recent")
def recent_metrics(
    server_id: str = Query(...),
    limit: int = Query(300, ge=1, le=2000),
    db: Session = Depends(get_db)
):
    try:
        server_uuid = UUID(server_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid server_id")

    # Query the metrics table for this server_id
    rows = (
        db.query(models.Metric)
          .filter(models.Metric.server_id == server_uuid)
          .order_by(desc(models.Metric.timestamp))
          .limit(limit)
          .all()
    )

    # Reverse so oldest -> newest
    rows = list(reversed(rows))

    # Convert to JSON-serializable format
    results = []
    for row in rows:
        results.append({
            "server_id": str(row.server_id),
            "timestamp": row.timestamp.isoformat(),
            "metrics": row.metrics,  # [{"name": "cpu.percent", "value": 20}, ...]
            "meta": row.meta or {},
        })
 
    return results


@app.websocket("/api/v1/ws/metrics")
async def ws_metrics(websocket: WebSocket, server_id: str = Query(...), token: Optional[str] = Query(None)):
    require_token = False
    if token:
        try:
            claims = decode_jwt(token)
            sub = claims.get("sub")
            if not sub or sub != server_id:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
        except Exception:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    elif require_token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(server_id, websocket)
    try:
        # Keep the connection alive indefinitely
        while True:
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        await manager.disconnect(server_id, websocket)


@app.post("/api/v1/metrics")
async def post_metrics(
    payload: List[schemas.MetricIn],
    server_uuid: models.Server = Depends(get_server_from_api_key),
    db: Session = Depends(get_db),
):
    accepted = 0
    for item in payload: 
        if str(item.server_id) != str(server_uuid.id):
            raise HTTPException(status_code=403, detail="server_id mismatch")

        # JSON-serializable metrics
        metrics_json = [
            m if isinstance(m, dict) else m.model_dump() if hasattr(m, "model_dump") else m.dict()
            for m in item.metrics
        ]

        db_metric = models.Metric(
            server_id=item.server_id,
            timestamp=item.timestamp,
            metrics=metrics_json,
            meta=item.meta or {},
        )
        db.add(db_metric)
        accepted += 1

        # Broadcast to WS
        data = jsonable_encoder({
            "server_id": str(item.server_id),
            "timestamp": item.timestamp.isoformat(),
            "metrics": metrics_json,
            "meta": item.meta or {},
        })
        # print(f"[DEBUG] Broadcasting to {server_uuid}: {data}")
        await manager.broadcast(str(item.server_id), {"type": "metric", "data": data})

    db.commit()
    return {"accepted": accepted}

# ========== LOGS ==========
@app.websocket("/api/v1/ws/logs")
async def ws_logs(websocket: WebSocket, server_id: str = Query(...), token: Optional[str] = Query(None)):
    await manager.connect(server_id, websocket)
    try:
        # Keep the connection alive indefinitely
        while True:
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        await manager.disconnect(server_id, websocket)

@app.get("/api/v1/logs/recent")
def recent_logs(
    server_id: str = Query(...),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    try:
        server_uuid = UUID(server_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid server_id")

    rows = (
        db.query(models.Log)
        .filter(models.Log.server_id == server_uuid)
        .order_by(desc(models.Log.timestamp))
        .limit(limit)
        .all()
    )

    rows = list(reversed(rows))
    return [
        {
            "id": r.id,
            "time": r.timestamp.isoformat(),
            "level": r.level,
            "source": r.source,
            "event_id": r.event_id,
            "message": r.message,
            "meta": r.meta or {}
        }
        for r in rows
    ]

@app.post("/api/v1/logs")
async def post_logs(
    payload: List[schemas.LogIn],  # define in schemas
    server_uuid: models.Log = Depends(get_server_from_api_key),
    db: Session = Depends(get_db),
):
    accepted = 0
    for item in payload:
        if str(item.server_id) != str(server_uuid.id):
            raise HTTPException(status_code=403, detail="server_id mismatch")

        log_row = models.Log(
            server_id=item.server_id,
            timestamp=item.timestamp,
            level=item.level,
            source=item.source,
            event_id=item.event_id,
            message=item.message,
            meta=item.meta or {},
        )
        db.add(log_row)
        accepted += 1

        # Broadcast to WS
        data = jsonable_encoder({
            "time": item.timestamp.isoformat(),
            "level": item.level,
            "source": item.source,
            "event_id": item.event_id,
            "message": item.message,
            "meta": item.meta or {}
        })
        await manager.broadcast(str(item.server_id), {"type": "logs", "data": [data]})

    db.commit()
    return {"accepted": accepted}