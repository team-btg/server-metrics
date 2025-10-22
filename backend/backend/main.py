from fastapi import FastAPI, Depends, status, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import desc
from backend.database import SessionLocal, engine, Base
from backend import models, schemas 
from backend.security import create_access_token, verify_access_token, decode_jwt
from uuid import UUID
from typing import List, Optional
from .websocket_manager import ConnectionManager
import asyncio

Base.metadata.create_all(bind=engine)

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


@app.post("/api/v1/register", status_code=status.HTTP_200_OK)
def register_server(server: schemas.ServerRegister, db: Session = Depends(get_db)):
    # Check if server already exists
    existing = db.query(models.Server).filter_by(fingerprint=server.fingerprint).first()
    if existing:
        token = create_access_token(str(existing.id))
        return {"server_id": str(existing.id), "token": token}

    db_server = models.Server(
        fingerprint=server.fingerprint,
        pubkey=server.pubkey,
        hostname=server.hostname,
        tags=server.tags,
    )

    try:
        db.add(db_server)
        db.commit()
        db.refresh(db_server)
    except IntegrityError:
        db.rollback()
        # if another request inserted the same fingerprint at the same time
        existing = db.query(models.Server).filter_by(fingerprint=server.fingerprint).first()
        if existing:
            token = create_access_token(str(existing.id))
            return {"server_id": str(existing.id), "token": token}
        raise

    token = create_access_token(str(db_server.id))
    return {"server_id": str(db_server.id), "token": token}


def _require_server_id(creds: HTTPAuthorizationCredentials = Depends(auth_scheme)) -> UUID:
    if not creds or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid auth scheme")
    try:
        sub = verify_access_token(creds.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    try:
        return UUID(sub)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token subject")


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

    print(f"[DEBUG] Fetched {len(results)} recent metrics for server_id {server_id}")
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
    server_uuid: UUID = Depends(_require_server_id),
    db: Session = Depends(get_db),
):
    accepted = 0
    for item in payload:
        if str(item.server_id) != str(server_uuid):
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
    server_uuid: UUID = Depends(_require_server_id),
    db: Session = Depends(get_db),
):
    accepted = 0
    for item in payload:
        if str(item.server_id) != str(server_uuid):
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