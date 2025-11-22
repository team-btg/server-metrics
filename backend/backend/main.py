import secrets
import hashlib
import asyncio
import os 
import google.generativeai as genai 
import requests
import json
import numpy as np

from fastapi import APIRouter, FastAPI, Depends, Request, Security, status, HTTPException, Query, WebSocket, WebSocketDisconnect, Response, BackgroundTasks
from fastapi.security import APIKeyHeader, HTTPBearer, HTTPAuthorizationCredentials, OAuth2PasswordBearer, OAuth2PasswordRequestForm
from . import crud, security
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware  
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from sqlalchemy.orm import Session, joinedload, sessionmaker
from sqlalchemy.exc import IntegrityError
from sqlalchemy import desc, create_engine 
from backend.database import SessionLocal, engine, Base, get_db, initialize_database
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
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from contextlib import asynccontextmanager
from google.cloud import pubsub_v1
from fastapi.responses import RedirectResponse
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from contextlib import asynccontextmanager

load_dotenv()

FRONTEND_URL = os.getenv("FRONTEND_URL")
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
TOPIC_ID = "metrics-broadcast"

publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path(PROJECT_ID, TOPIC_ID)

# --- Security & Auth Setup ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
SMTP_SENDER_EMAIL = os.getenv("SMTP_SENDER_EMAIL")

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

# --- Right-Sizing Analysis Notification Functions ---
def generate_right_sizing_recommendation(server_id: UUID):
    """Analyzes 30 days of metrics for a server and generates a right-sizing recommendation."""
    print(f"Starting right-sizing analysis for server {server_id}...")
    db_url = os.getenv("DATABASE_URL")
    if not db_url or not genai_model:
        print("Analysis skipped: DATABASE_URL or Gemini API not configured.")
        return

    if "127.0.0.1" in db_url or "localhost" in db_url:
        db_url = db_url.replace("postgresql+pg8000", "postgresql+psycopg2")

    try:
        engine = create_engine(db_url)
        SessionLocal_BG = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal_BG()
    except Exception as e:
        print(f"Analysis failed for {server_id}: Could not create DB session: {e}")
        return

    try:
        # Fetch last 30 days of metrics
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        metrics = db.query(models.Metric.metrics).filter(
            models.Metric.server_id == server_id,
            models.Metric.timestamp >= thirty_days_ago
        ).all()

        if len(metrics) < 10:  
            print(f"Analysis skipped for {server_id}: Not enough metric data.")
            return 
        
        cpu_usage = [m[0].get('cpu_usage', 0) for m in metrics]
        mem_usage = [m[0].get('memory_usage', 0) for m in metrics]

        avg_cpu = np.mean(cpu_usage)
        p95_cpu = np.percentile(cpu_usage, 95)
        avg_mem = np.mean(mem_usage)
        p95_mem = np.percentile(mem_usage, 95)

        # AI Prompt
        prompt = f"""
        You are an expert cloud cost optimization and performance analyst.
        Analyze the following server resource utilization metrics from the last 30 days and provide a right-sizing recommendation.

        Metrics:
        - Average CPU Utilization: {avg_cpu:.2f}%
        - 95th Percentile CPU Utilization: {p95_cpu:.2f}%
        - Average Memory Utilization: {avg_mem:.2f}%
        - 95th Percentile Memory Utilization: {p95_mem:.2f}%

        Analysis Guidelines:
        - A server is a good candidate for a DOWNGRADE if its p95 CPU and p95 Memory are consistently low (e.g., < 40%).
        - A server is a candidate for an UPGRADE if its p95 CPU or p95 Memory are consistently high (e.g., > 85%), indicating it is struggling to handle peak loads.
        - Otherwise, the server is considered STABLE.

        Respond with a JSON object containing two keys:
        1. "recommendation_type": A string, either "UPGRADE", "DOWNGRADE", or "STABLE".
        2. "summary": A concise, one-paragraph summary explaining your reasoning in a way a non-expert can understand.

        Example Response:
        {{
          "recommendation_type": "DOWNGRADE",
          "summary": "This server's peak resource usage over the last month has been consistently low. The 95th percentile for both CPU and memory is well below 50%, indicating that the server is over-provisioned. Downgrading to a smaller instance size could lead to significant cost savings without impacting performance."
        }}
        """
 
        response = genai_model.generate_content(prompt)
         
        cleaned_response = response.text.strip().replace("```json", "").replace("```", "")
        rec_data = json.loads(cleaned_response)

        crud.create_recommendation(
            db=db,
            server_id=server_id,
            rec_type=rec_data["recommendation_type"],
            summary=rec_data["summary"]
        )
        print(f"Successfully generated and stored recommendation for server {server_id}.")

    except Exception as e:
        print(f"An error occurred during analysis for server {server_id}: {e}")
    finally:
        db.close()

def run_analysis_for_all_servers():
    """Job to be run by the scheduler."""
    print("Scheduler starting daily right-sizing analysis for all servers...")
    db = SessionLocal()
    try:
        servers = db.query(models.Server).all()
        for server in servers:
            generate_right_sizing_recommendation(server.id)
    finally:
        db.close()
    print("Scheduler finished daily analysis.")
 
scheduler = AsyncIOScheduler()
scheduler.add_job(run_analysis_for_all_servers, 'interval', days=1)
 
@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    scheduler.start()
    yield
    print("Shutting down...")
    scheduler.shutdown()

app = FastAPI(lifespan=lifespan)

app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

SESSION_SECRET_KEY = os.getenv("SESSION_SECRET_KEY")
if not SESSION_SECRET_KEY:
    raise ValueError("SESSION_SECRET_KEY is not set in the environment variables")
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET_KEY)
 
# Allowed origins for your frontend
origins = [
    "http://localhost:5173",  # Vite dev server
    "http://localhost:3000",  # React dev server
    "https://server-metrics-dashboard-1090247220176.us-central1.run.app",  # Deployed frontend URL
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
 
def send_email_notification(recipient_email: str, subject: str, body: str):
    if not SENDGRID_API_KEY or not SMTP_SENDER_EMAIL:
        print("WARNING: SendGrid API Key or Sender Email not configured. Skipping email notification.")
        return

    message = Mail(
        from_email=SMTP_SENDER_EMAIL,
        to_emails=recipient_email,
        subject=subject,
        plain_text_content=body
    )
    try:
        sendgrid_client = SendGridAPIClient(SENDGRID_API_KEY)
        response = sendgrid_client.send(message)
        print(f"Notification email sent to {recipient_email}, status code: {response.status_code}")
    except Exception as e:
        print(f"ERROR: Failed to send email via SendGrid to {recipient_email}: {e}")

# Webhook notification function
def send_webhook_notification(webhook_url: str, webhook_format: str, subject: str, body: str, is_firing: bool, headers: Optional[Dict[str, str]] = None):
    """Sends a notification to a webhook, formatting it based on the specified type."""
    payload = {}
    
    if webhook_format == 'teams':
        # Format for Microsoft Teams
        color = "FF0000" if is_firing else "00FF00" # Red for firing, Green for resolved
        payload = {
            "@type": "MessageCard",
            "@context": "http://schema.org/extensions",
            "themeColor": color,
            "summary": subject,
            "sections": [{
                "activityTitle": subject,
                "text": body.replace('\n', '\n\n'), # Teams prefers double newlines for paragraphs
                "markdown": True
            }]
        }
    else: # Default to Slack/Discord format
        color = 15548997 if is_firing else 3066993
        payload = {
            "embeds": [{
                "title": subject,
                "description": body,
                "color": color,
                "timestamp": datetime.utcnow().isoformat()
            }]
        }

    try: 
        response = requests.post(webhook_url, json=payload, headers=headers, timeout=5)
        response.raise_for_status()
        print(f"Webhook notification sent successfully using {webhook_format} format.")
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Failed to send webhook notification: {e}")
 
# --- Dependency to get current user ---
async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_jwt(token)
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except Exception:
        raise credentials_exception
    
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

# --- New Auth Router ---
auth_router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])

@auth_router.post("/signup", response_model=schemas.User)
def signup(user: schemas.UserCreate, db: Session = Depends(get_db)): 
    db_user = crud.get_user_by_email(db, email=user.email) 
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
     
    hashed_password = security.get_password_hash(user.password)
    
    db_user = models.User(email=user.email, hashed_password=hashed_password, provider="local", is_active=True)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@auth_router.post("/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not user.hashed_password or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    access_token = security.create_access_token(subject=user.email)
    return {"access_token": access_token, "token_type": "bearer"}
  
@auth_router.get('/google')
async def login_google(request: Request):
    redirect_uri = request.url_for('auth_google_callback')
    return await oauth.google.authorize_redirect(request, redirect_uri)

@auth_router.get('/google/callback')
async def auth_google_callback(request: Request, db: Session = Depends(get_db)):
    token = await oauth.google.authorize_access_token(request)
    user_info = token.get('userinfo')
    email = user_info.get("email")

    if not email:
        raise HTTPException(status_code=400, detail="Could not retrieve email from Google.")

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        user = models.User(email=email, provider='google')
        db.add(user)
        db.commit()

    access_token = create_access_token(subject=user.email)
    # Redirect to frontend with the token
    return RedirectResponse(url=f"{FRONTEND_URL}/login/callback?token={access_token}")
 
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
    
    email = profile.get('email')
    if not email:
        resp_email = await oauth.github.get('user/emails', token=token)
        emails = resp_email.json()
        primary_email = next((e['email'] for e in emails if e['primary']), None)
        email = primary_email

    if not email:
        raise HTTPException(status_code=400, detail="Could not retrieve email from GitHub.")

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        user = models.User(email=email, provider='github')
        db.add(user)
        db.commit()

    access_token = create_access_token(subject=user.email)
    # Redirect to frontend with the token
    return RedirectResponse(url=f"{FRONTEND_URL}/login/callback?token={access_token}")

alerts_router = APIRouter(prefix="/api/v1/alerts", tags=["alerts"], dependencies=[Depends(get_current_user)])

@alerts_router.post("/servers/{server_id}", response_model=schemas.AlertRule, status_code=status.HTTP_201_CREATED)
def create_alert_rule(
    server_id: UUID, 
    rule: schemas.AlertRuleCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
): 
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()

    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found or you do not have permission to access it."
        )
 
    existing_rule = db.query(models.AlertRule).filter(
        models.AlertRule.server_id == server_id,
        models.AlertRule.name == rule.name
    ).first()

    if existing_rule:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,  
            detail=f"An alert rule with the name '{rule.name}' already exists for this server."
        )
 
    db_rule = models.AlertRule(**rule.model_dump(), server_id=server_id)
     
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    
    return db_rule

@alerts_router.get("/servers/{server_id}", response_model=List[schemas.AlertRule])
def get_alert_rules_for_server(
    server_id: UUID, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
): 
    server = db.query(models.Server).filter(models.Server.id == server_id, models.Server.user_id == current_user.id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found or permission denied.")
    
    rules = db.query(models.AlertRule).filter(models.AlertRule.server_id == server_id).all()
    return rules

@alerts_router.get("/events/servers/{server_id}/active_count", response_model=int)
def get_active_alert_count_for_server(
    server_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
): 
    server = db.query(models.Server).filter(models.Server.id == server_id, models.Server.user_id == current_user.id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found or permission denied.")
 
    count = db.query(models.Incident).filter(
        models.Incident.server_id == server_id,
        models.Incident.resolved_at == None
    ).count()
    
    return count

@alerts_router.put("/{rule_id}", response_model=schemas.AlertRule)
def update_alert_rule(
    rule_id: int, 
    rule_update: schemas.AlertRuleUpdate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
): 
    db_rule = db.query(models.AlertRule).filter(models.AlertRule.id == rule_id).first()

    if not db_rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
 
    if db_rule.server.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to modify this rule")

    existing_rule = db.query(models.AlertRule).filter( 
        models.AlertRule.id != rule_id,
        models.AlertRule.name == rule_update.name
    ).first()

    if existing_rule:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,  
            detail=f"An alert rule with the name '{rule_update.name}' already exists for this server."
        )
     
    update_data = rule_update.model_dump(exclude_unset=True)
     
    for key, value in update_data.items():
        setattr(db_rule, key, value)
        
    db.commit()
    db.refresh(db_rule)
    return db_rule

@alerts_router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_alert_rule(
    rule_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_rule = db.query(models.AlertRule).filter(models.AlertRule.id == rule_id).first()

    if not db_rule: 
        return Response(status_code=status.HTTP_204_NO_CONTENT)
 
    if db_rule.server.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this rule")

    db.delete(db_rule)
    db.commit()
    
    return Response(status_code=status.HTTP_204_NO_CONTENT)

app.include_router(alerts_router) 
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

server_router = APIRouter(prefix="/api/v1/servers", tags=["servers"])

@server_router.get("/{server_id}/recommendations", response_model=List[schemas.Recommendation])
def get_server_recommendations(
    server_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get all recommendations for a server, most recent first."""
    server = db.query(models.Server).filter(models.Server.id == server_id).first()
    if not server or server.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Server not found or permission denied.")
    
    return db.query(models.Recommendation).filter(
        models.Recommendation.server_id == server_id
    ).order_by(desc(models.Recommendation.created_at)).limit(5).all()
 
@server_router.post("/claim", response_model=schemas.Server)
def claim_server(
    claim_request: schemas.ServerClaim, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user) # Protect this endpoint
):
    server = get_server_from_api_key(claim_request.api_key, db)
    if str(server.id) != str(claim_request.server_id):
        raise HTTPException(status_code=403, detail="API Key does not match the provided Server ID.")
    
    # Link the server to the current user
    server.user_id = current_user.id
    db.commit()
    db.refresh(server)
    
    return server

@server_router.put("/{server_id}", response_model=schemas.Server)
def update_server_settings(
    server_id: UUID,
    server_update: schemas.ServerUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()

    if not server:
        raise HTTPException(status_code=404, detail="Server not found or permission denied.")

    # Update the server object with the new data
    update_data = server_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(server, key, value)
    
    db.commit()
    db.refresh(server)
    return server

@server_router.get("/{server_id}", response_model=schemas.Server)
def get_server(
    server_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """ 
    Get server details by ID. 
    Only the server owner can access this information.
    """
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()

    if not server:
        raise HTTPException(status_code=404, detail="Server not found or permission denied.")

    return server

@server_router.get("/", response_model=List[schemas.Server])
def get_all_servers(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """
    Get all servers registered to the current user.
    """
    servers = db.query(models.Server).filter(models.Server.user_id == current_user.id).order_by(models.Server.hostname).all()
    return servers

@server_router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
def unregister_server(
    server_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Unregister a server and delete all associated data.
    Only the server owner can perform this action.
    """
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()

    if not server: 
        return Response(status_code=status.HTTP_204_NO_CONTENT)
 
    db.delete(server)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)

@server_router.get("/{server_id}/incidents", response_model=List[schemas.Incident])
def get_server_incidents(
    server_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Add permission check to ensure user owns the server
    server = db.query(models.Server).filter(models.Server.id == server_id, models.Server.user_id == current_user.id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    return crud.get_incidents_for_server(db=db, server_id=server_id)

@server_router.put("/incidents/{incident_id}/resolve", response_model=schemas.Incident)
def resolve_incident(
    incident_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Manually resolve an incident.""" 
    incident = db.query(models.Incident).options(
        joinedload(models.Incident.alert_rule).joinedload(models.AlertRule.server)
    ).filter(
        models.Incident.id == incident_id
    ).first()

    if not incident or incident.server.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Incident not found or permission denied.")

    if incident.status == 'resolved':
        return incident # Already resolved, do nothing

    incident.status = 'resolved'
    incident.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(incident)

    subject = f"ℹ️ Alert Manually Resolved: {incident.alert_rule.name}"
    body = f"The alert '{incident.alert_rule.name}' on server '{incident.alert_rule.server.hostname}' was manually marked as resolved by {current_user.email}."
    send_email_notification(current_user.email, subject, body)
    if incident.alert_rule.server.webhook_url:
        send_webhook_notification(
            incident.alert_rule.server.webhook_url, 
            incident.alert_rule.server.webhook_format, 
            subject, 
            body, 
            is_firing=False, 
            headers=incident.alert_rule.server.webhook_headers
        )

    return incident

app.include_router(server_router)

def run_incident_analysis(incident_id: UUID):
    """
    This function runs in the background to analyze an incident.
    It gathers context, asks the AI for a summary, and updates the incident record.
    """

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("FATAL ERROR in run_incident_analysis: DATABASE_URL not set.")
        return
        
    # For local development with the proxy, we need to use the correct driver
    if "127.0.0.1" in db_url or "localhost" in db_url:
        # Use psycopg2 when connecting via proxy, as pg8000 may have issues here.
        # Ensure you have 'psycopg2-binary' installed.
        db_url = db_url.replace("postgresql+pg8000", "postgresql+psycopg2")

    try:
        engine = create_engine(db_url)
        SessionLocal_BG = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal_BG()
    except Exception as e:
        print(f"FATAL ERROR creating DB session in background task: {e}")
        return
    
    try:
        incident = db.query(models.Incident).options(
            joinedload(models.Incident.server),
            joinedload(models.Incident.alert_rule)
        ).filter(models.Incident.id == incident_id).first()

        if not incident:
            print(f"ERROR: Incident {incident_id} not found for analysis.")
            return
 
        end_time = incident.triggered_at
        start_time = end_time - timedelta(minutes=5)
 
        metric_records = db.query(models.Metric).filter(
            models.Metric.server_id == incident.server_id,
            models.Metric.timestamp.between(start_time, end_time)
        ).order_by(models.Metric.timestamp.desc()).limit(10).all()
 
        log_records = db.query(models.Log).filter(
            models.Log.server_id == incident.server_id,
            models.Log.timestamp.between(start_time, end_time),
            models.Log.level.in_(['ERROR', 'CRITICAL', 'FATAL', 'WARNING'])
        ).limit(20).all()
 
        correlated_data = {
            "alert_details": {
                "name": incident.alert_rule.name,
                "condition": f"{incident.alert_rule.metric} {incident.alert_rule.operator} {incident.alert_rule.threshold}% for {incident.alert_rule.duration_minutes} mins"
            },
            "recent_metrics": [jsonable_encoder(m.metrics) for m in metric_records],
            "top_processes": [jsonable_encoder(m.processes) for m in metric_records if m.processes],
            "relevant_logs": [{"level": log.level, "message": log.message} for log in log_records]
        }
        incident.correlated_data = correlated_data # Store for auditing
 
        prompt = f"""
        You are an expert Site Reliability Engineer (SRE). An alert has been triggered. Analyze the following correlated data to determine the likely root cause and suggest a course of action.

        Alert Details:
        - Name: {correlated_data['alert_details']['name']}
        - Condition: {correlated_data['alert_details']['condition']}

        Recent Metrics (latest first):
        {json.dumps(correlated_data['recent_metrics'], indent=2)}

        Top Processes at the time (latest first):
        {json.dumps(correlated_data['top_processes'], indent=2)}

        Relevant Logs from the timeframe:
        {json.dumps(correlated_data['relevant_logs'], indent=2)}

        Based on this data, provide a brief, one-paragraph summary of the likely root cause. Then, provide a short, scannable list of recommended actions. Be concise and direct.
        """
 
        if genai_model:
            try:
                response = genai_model.generate_content(prompt)
                incident.summary = response.text
            except Exception as e:
                incident.summary = f"AI analysis failed: {e}"
        else:
            incident.summary = "AI model not configured. Manual investigation required."
 
        incident.status = "active"
        db.commit()
        print(f"AI analysis complete for incident {incident_id}.")

    except Exception as e:
        print(f"FATAL ERROR in run_incident_analysis: {e}")
        db.rollback()
    finally:
        db.close()

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
            "processes": row.processes or [],
            "metrics": row.metrics,
            "meta": row.meta or {},
        }
        for row in rows
    ]
    
    return results
 
@app.websocket("/api/v1/ws/metrics")
async def ws_metrics(websocket: WebSocket, server_id: str = Query(...), token: Optional[str] = Query(None)):
    # ... (authentication logic remains the same) ...
    await websocket.accept()

    # --- NEW PUBSUB LISTENER WITH ASYNCIO QUEUE ---
    subscriber = pubsub_v1.SubscriberClient()
    subscription_name = f"ws-metrics-sub-{secrets.token_hex(8)}"
    subscription_path = subscriber.subscription_path(PROJECT_ID, subscription_name)
    topic_path = publisher.topic_path(PROJECT_ID, "metrics-broadcast")
    filter_string = f'attributes.server_id = "{server_id}"'

    try:
        subscriber.create_subscription(
            request={
                "name": subscription_path, 
                "topic": topic_path, 
                "expiration_policy": {"ttl": "86400s"},
                "filter": filter_string,
            }
        )
    except Exception as e:
        print(f"Could not create subscription (it might already exist): {e}")

    # 1. Create a queue to bridge the Pub/Sub thread and the asyncio event loop
    queue = asyncio.Queue()

    # 2. This is a SYNCHRONOUS callback that the Pub/Sub client can call directly.
    #    Its only job is to put the message into the queue.
    def sync_callback(message: pubsub_v1.subscriber.message.Message):
        try:
            data = json.loads(message.data.decode("utf-8"))
            queue.put_nowait(data)
            message.ack()
        except Exception as e:
            print(f"Error in sync_callback: {e}")
            message.nack()

    # 3. Start listening for messages in the background, using the sync callback
    streaming_pull_future = subscriber.subscribe(subscription_path, callback=sync_callback)
    print(f"[{server_id}] Subscribed to {subscription_path} and listening...")

    # 4. This async task runs in the main event loop, waiting for data from the queue
    async def forward_to_websocket():
        while True:
            try:
                # Wait for a message to appear in the queue
                data = await queue.get()
                # Send the message over the websocket
                await websocket.send_json(data)
                queue.task_done()
            except asyncio.CancelledError:
                print(f"[{server_id}] Forwarder task cancelled.")
                break
            except Exception as e:
                print(f"[{server_id}] Error in forwarder task: {e}")
                break
    
    forwarder_task = asyncio.create_task(forward_to_websocket())

    try:
        # Keep the connection open and wait for the client to disconnect
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        print(f"[{server_id}] WebSocket disconnected.")
    finally:
        # 5. Clean up everything when the client disconnects
        print(f"[{server_id}] Cleaning up resources...")
        forwarder_task.cancel()
        streaming_pull_future.cancel()  # Stop the Pub/Sub listener
        subscriber.delete_subscription(request={"subscription": subscription_path})
        print(f"[{server_id}] Cleanup complete.")
 
@app.post("/api/v1/metrics")
async def post_metrics(
    payload: List[schemas.MetricIn],
    background_tasks: BackgroundTasks,
    server_uuid: models.Server = Depends(get_server_from_api_key),
    db: Session = Depends(get_db),
):
    accepted = 0
    for item in payload: 
        if str(item.server_id) != str(server_uuid.id):
            raise HTTPException(status_code=403, detail="server_id mismatch")
   
        metrics_json = [
            m if isinstance(m, dict) else m.model_dump() if hasattr(m, "model_dump") else m.dict()
            for m in item.metrics
        ]
 
        metrics_processes_json = [
            p if isinstance(p, dict) else p.model_dump() if hasattr(p, "model_dump") else p.dict()
            for p in (item.processes or [])
        ]
  
        db_metric = models.Metric(
            server_id=item.server_id,
            timestamp=item.timestamp,
            metrics=metrics_json, 
            processes=metrics_processes_json,
            meta=item.meta or {},
        )
        db.add(db_metric)
        accepted += 1

        # Broadcast to WS
        data_to_publish = {
            "type": "metric",
            "data": jsonable_encoder({
                "server_id": str(item.server_id),
                "timestamp": item.timestamp.isoformat(),
                "metrics": metrics_json,
                "processes": metrics_processes_json,
                "meta": item.meta or {},
            })
        }
        
        publisher.publish(
            topic_path, 
            data=json.dumps(data_to_publish).encode("utf-8"),
            server_id=str(item.server_id) # Attribute for filtering
        )

    evaluate_alerts_for_server(server_uuid.id, db, background_tasks) # Pass background_tasks

    db.commit()
    return {"accepted": accepted}

def evaluate_alerts_for_server(server_id: UUID, db: Session, background_tasks: BackgroundTasks): # Add background_tasks
    server = db.query(models.Server).filter(models.Server.id == server_id).first()
    if not server or not server.user_id:
        return  # Can't notify if there's no owner

    rules = db.query(models.AlertRule).filter(
        models.AlertRule.server_id == server_id,
        models.AlertRule.is_enabled == True
    ).all()

    for rule in rules:
        start_time = datetime.utcnow() - timedelta(minutes=rule.duration_minutes)
        
        # Get recent metrics for the rule's duration
        recent_metrics = db.query(models.Metric).filter(
            models.Metric.server_id == server_id,
            models.Metric.timestamp >= start_time
        ).order_by(desc(models.Metric.timestamp)).all()

        if len(recent_metrics) == 0:
            continue  

        # Check if the condition is consistently met
        is_violated = True
        for metric_record in recent_metrics:
            metric_value = None
            
            # --- CORRECTED LOGIC ---
            if rule.metric == 'cpu':
                metric_value = next((m.get('value') for m in metric_record.metrics if m.get('name') == 'cpu.percent'), None)
            elif rule.metric == 'memory':
                metric_value = next((m.get('value') for m in metric_record.metrics if m.get('name') == 'mem.percent'), None)
            elif rule.metric == 'disk':
                # For disk, we find the root ('/') mountpoint and get its usage percent
                disk_metrics = next((m.get('value') for m in metric_record.metrics if m.get('name') == 'disk'), None)
                if disk_metrics and isinstance(disk_metrics, list):
                    root_disk = next((d for d in disk_metrics if d.get('mountpoint') == '/'), None)
                    if root_disk:
                        metric_value = root_disk.get('percent')

            if metric_value is None:
                is_violated = False
                break
            
            if rule.operator == '>' and not (metric_value > rule.threshold):
                is_violated = False
                break
            if rule.operator == '<' and not (metric_value < rule.threshold):
                is_violated = False
                break

        # Check if an alert is already active for this rule
        active_event = db.query(models.Incident).filter(
            models.Incident.alert_rule_id == rule.id,
            models.Incident.resolved_at == None
        ).first()

        if is_violated and not active_event: 
            print(f"TRIGGERING alert for rule '{rule.name}' on server '{server.hostname}'")
              
            new_incident = crud.create_incident(db=db, server_id=server.id, alert_rule_id=rule.id)
 
            background_tasks.add_task(run_incident_analysis, new_incident.id)
 
            subject = f"🚨 Alert Firing: {rule.name} on {server.hostname}"
            body = f"The alert '{rule.name}' is now firing.\n\nCondition: {rule.metric} {rule.operator} {rule.threshold}%\nServer: {server.hostname}\n\nThis condition has been met for over {rule.duration_minutes} minutes.\n\nAn incident has been created and is being analyzed."
            send_email_notification(server.owner.email, subject, body)
            if server.webhook_url and server.webhook_format:
                send_webhook_notification(server.webhook_url, server.webhook_format, subject, body, is_firing=True, headers=server.webhook_headers)

        elif not is_violated and active_event: 
            print(f"RESOLVING alert for rule '{rule.name}' on server '{server.hostname}'")
         
            active_event.resolved_at = datetime.utcnow()

            incident_to_resolve = db.query(models.Incident).filter(
                models.Incident.alert_rule_id == rule.id,
                models.Incident.status != 'resolved'
            ).order_by(desc(models.Incident.triggered_at)).first()

            if incident_to_resolve:
                incident_to_resolve.status = 'resolved'
                incident_to_resolve.resolved_at = datetime.utcnow()

            db.commit()
         
            subject = f"✅ Alert Resolved: {rule.name} on {server.hostname}"
            body = f"The alert '{rule.name}' has been resolved.\n\nCondition: {rule.metric} {rule.operator} {rule.threshold}%\nServer: {server.hostname}\n\nThe system has returned to a normal state."
            send_email_notification(server.owner.email, subject, body)
            if server.webhook_url and server.webhook_format:
                send_webhook_notification(server.webhook_url, server.webhook_format, subject, body, is_firing=False, headers=server.webhook_headers)

# ========== LOGS ==========
@app.websocket("/api/v1/ws/logs")
async def ws_logs(websocket: WebSocket, server_id: str = Query(...), token: Optional[str] = Query(None)):
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing token")
        return

    db = SessionLocal()
    try:
        payload = decode_jwt(token)
        email: str = payload.get("sub")
        if not email:
            raise Exception("No email in token")

        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            raise Exception("User not found")

        # Verify the server belongs to the user
        server = db.query(models.Server).filter(
            models.Server.id == server_id,
            models.Server.user_id == user.id
        ).first()

        if not server:
            raise Exception("Server not found or access denied")

    except Exception as e:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason=f"Authentication failed: {e}")
        db.close()
        return

    await manager.connect(server_id, websocket)
    try:
        while True:
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        await manager.disconnect(server_id, websocket)
    finally:
        db.close()

@app.get("/api/v1/logs/{server_id}")
def recent_logs(
    server_id: UUID,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()

    if not server:
        raise HTTPException(status_code=404, detail="Server not found or permission denied.")
 
    rows = (
        db.query(models.Log)
        .filter(models.Log.server_id == server.id)
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