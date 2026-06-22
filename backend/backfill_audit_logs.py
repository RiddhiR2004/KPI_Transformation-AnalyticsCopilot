import sys
import os
from pathlib import Path

# Add current directory to python path
sys.path.append(str(Path(__file__).resolve().parent))

from app.database import SessionLocal, AuditLog, Engagement, ClientProfile
from sqlalchemy import select

def backfill():
    print("Starting audit logs backfill...")
    with SessionLocal() as session:
        # Find logs where client_id is None
        stmt = select(AuditLog).where(AuditLog.client_id == None)
        logs = session.scalars(stmt).all()
        print(f"Found {len(logs)} audit logs with null client_id.")
        
        updated_count = 0
        for log in logs:
            updated = False
            # Resolve from engagement_id if present
            if log.engagement_id is not None:
                eng = session.get(Engagement, log.engagement_id)
                if eng and eng.client_profile_id is not None:
                    log.client_id = eng.client_profile_id
                    updated = True
                    print(f"Log ID {log.id}: Resolved client_id={log.client_id} from engagement_id={log.engagement_id}")
            
            # Resolve from client_name if not resolved yet
            if not updated and log.client_name:
                # Find client profile by name
                client = session.scalars(
                    select(ClientProfile).where(ClientProfile.client_name == log.client_name)
                ).first()
                if client:
                    log.client_id = client.id
                    updated = True
                    print(f"Log ID {log.id}: Resolved client_id={log.client_id} from client_name='{log.client_name}'")
                    
            if updated:
                updated_count += 1
                
        if updated_count > 0:
            session.commit()
            print(f"Successfully updated and committed {updated_count} audit log records.")
        else:
            print("No records required updating.")

if __name__ == "__main__":
    backfill()
