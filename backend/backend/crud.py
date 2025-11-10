from sqlalchemy.orm import Session
from . import models, schemas
import uuid
from datetime import datetime

def register_server(db: Session, data: schemas.ServerRegister):
    server = db.query(models.Server).filter_by(fingerprint=data.fingerprint).first()
    if not server:
        server = models.Server(
            fingerprint=data.fingerprint,
            pubkey=data.pubkey,
            hostname=data.hostname,
            tags=data.tags,
        )
        db.add(server)
        db.commit()
        db.refresh(server)
    return server

def save_metrics(db: Session, metrics: list[schemas.MetricIn]):
    objects = []
    for m in metrics:
        obj = models.Metric(
            server_id=m.server_id,
            timestamp=m.timestamp,
            metrics=[s.dict() for s in m.metrics],
            meta=m.meta or {},
        )
        objects.append(obj)
        db.add(obj)
    db.commit()
    return objects

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()
