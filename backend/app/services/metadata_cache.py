from __future__ import annotations

import logging
from typing import Any, Dict, List
from sqlalchemy import select
from app.database import SessionLocal

# Setup logger for cache details
logger = logging.getLogger("metadata_cache")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s"))
    logger.addHandler(handler)


class MetadataCache:
    def __init__(self) -> None:
        self._cache: Dict[str, List[Dict[str, Any]]] = {}

    def get(self, key: str, model: Any) -> List[Dict[str, Any]]:
        if key in self._cache:
            logger.info(f"[CACHE HIT] Returning cached data for key: '{key}'")
            return self._cache[key]
        
        logger.info(f"[CACHE MISS] Fetching from database for key: '{key}'")
        with SessionLocal() as session:
            stmt = select(model).filter_by(is_active=True).order_by(model.name)
            rows = session.scalars(stmt).all()
            data = [
                {
                    "id": r.id,
                    "name": r.name,
                    "is_active": r.is_active,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                    "updated_at": r.updated_at.isoformat() if r.updated_at else None,
                }
                for r in rows
            ]
            self._cache[key] = data
            return data

    def invalidate(self, key: str | None = None) -> None:
        if key:
            if key in self._cache:
                logger.info(f"[CACHE INVALIDATION] Invalidating cache for key: '{key}'")
                del self._cache[key]
        else:
            logger.info("[CACHE INVALIDATION] Invalidating all cache keys")
            self._cache.clear()


metadata_cache = MetadataCache()
