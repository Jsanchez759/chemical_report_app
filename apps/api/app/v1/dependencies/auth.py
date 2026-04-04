from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.core.security import decode_token
from app.models import User
from app.services import get_db

logger = get_logger(__name__)


async def get_current_user(
    authorization: str = Header(...),
    db: Session = Depends(get_db)
) -> User:
    """Extract and verify current user from authorization header."""
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid auth scheme")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid auth header")
    
    # Decode token
    payload = decode_token(token)
    if not payload:
        logger.warning("invalid_token_attempt")
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    # Get user from database
    user = db.query(User).filter(User.id == payload.get("user_id")).first()
    if not user:
        logger.warning("user_not_found", user_id=payload.get("user_id"))
        raise HTTPException(status_code=401, detail="User not found")
    
    return user
