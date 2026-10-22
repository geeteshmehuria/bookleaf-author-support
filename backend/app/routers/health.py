from fastapi import APIRouter
from datetime import datetime, timezone

router = APIRouter()

@router.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": "BookLeaf API",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
