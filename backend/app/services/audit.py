from __future__ import annotations

from datetime import datetime
from fastapi import Request
from app.database import SessionLocal, AuditLog, ClientProfile, Engagement

def get_user_info(request: Request) -> tuple[str, str | None]:
    # Extract from headers or query parameters, defaulting to "riddhi.r" and "riddhi.r@example.com"
    user_name = request.headers.get("X-User-Name") or request.query_params.get("user_name") or "riddhi.r"
    user_email = request.headers.get("X-User-Email") or request.query_params.get("user_email") or "riddhi.r@example.com"
    return user_name, user_email


def write_audit_log(
    user_name: str,
    user_email: str | None,
    action_type: str,
    entity_type: str | None = None,
    entity_name: str | None = None,
    previous_value: str | None = None,
    new_value: str | None = None,
    client_id: int | None = None,
    engagement_id: int | None = None,
    module: str = "",
    action: str = "",
    status: str = "Success",
    db_session = None
) -> None:
    def execute(session):
        client_name = None
        engagement_name = None
        
        # If client_id is provided, resolve name
        if client_id:
            client = session.get(ClientProfile, client_id)
            if client:
                client_name = client.client_name
                
        # If engagement_id is provided, resolve names
        if engagement_id:
            eng = session.get(Engagement, engagement_id)
            if eng:
                engagement_name = eng.name
                if not client_name and eng.client_profile_id:
                    client = session.get(ClientProfile, eng.client_profile_id)
                    if client:
                        client_name = client.client_name
                        
        audit_entry = AuditLog(
            user_name=user_name,
            user_email=user_email,
            action_type=action_type,
            entity_type=entity_type,
            entity_name=entity_name,
            previous_value=previous_value,
            new_value=new_value,
            client_id=client_id,
            engagement_id=engagement_id,
            client_name=client_name,
            engagement_name=engagement_name,
            module=module,
            action=action,
            status=status,
            timestamp=datetime.now()
        )
        session.add(audit_entry)
        session.commit()

    if db_session:
        execute(db_session)
    else:
        with SessionLocal() as session:
            execute(session)


def log_audit(
    request: Request,
    action: str,
    module: str,
    entity_type: str | None = None,
    entity_name: str | None = None,
    previous_value: str | None = None,
    new_value: str | None = None,
    status: str = "Success",
    client_id: int | None = None,
    engagement_id: int | None = None,
    db_session = None
) -> None:
    user_name, user_email = get_user_info(request)
    
    # Resolve engagement context if not explicitly provided
    if not engagement_id:
        from app.database import active_engagement_id_ctx
        engagement_id = active_engagement_id_ctx.get()
        
    write_audit_log(
        user_name=user_name,
        user_email=user_email,
        action_type=action,
        entity_type=entity_type,
        entity_name=entity_name,
        previous_value=previous_value,
        new_value=new_value,
        client_id=client_id,
        engagement_id=engagement_id,
        module=module,
        action=action,
        status=status,
        db_session=db_session
    )
