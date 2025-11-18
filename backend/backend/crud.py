from sqlalchemy.orm import Session
from . import models, schemas
from sqlalchemy.orm import joinedload
from uuid import UUID
from datetime import datetime

def create_incident(db: Session, server_id: UUID, alert_rule_id: UUID) -> models.Incident:
    """Creates a new incident record in the database."""
    db_incident = models.Incident(
        server_id=server_id,
        alert_rule_id=alert_rule_id,
        status="investigating"
    )
    db.add(db_incident)
    db.commit()
    db.refresh(db_incident)
    return db_incident

def get_incidents_for_server(db: Session, server_id: UUID, limit: int = 50) -> list[models.Incident]:
    """Retrieves the most recent incidents for a given server."""
    return db.query(models.Incident).options(
        joinedload(models.Incident.alert_rule)  # Eagerly load the alert rule
    ).filter(
        models.Incident.server_id == server_id
    ).order_by(
        models.Incident.triggered_at.desc()
    ).limit(limit).all()

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
