from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger
from app.core.security import (create_access_token, decode_token,
                               get_password_hash, verify_password)
from app.models import User
from app.services import get_db, limiter
from app.v1.dependencies.auth import get_current_user
from app.v1.schemas.auth import (RefreshTokenRequest, TokenResponse, UserLogin,
                                 UserRegister, UserResponse)

logger = get_logger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse)
@limiter.limit("3/minute")
async def register(
    request: Request,
    user_data: UserRegister,
    db: Session = Depends(get_db),
):
    logger.info(
        "user_registration_started",
        username=user_data.username,
        email=user_data.email,
    )
    
    # Check if user already exists
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        logger.warning("user_already_exists", username=user_data.username)
        raise HTTPException(status_code=400, detail="Username already taken")
    
    existing_email = db.query(User).filter(User.email == user_data.email).first()
    if existing_email:
        logger.warning("email_already_exists", email=user_data.email)
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    logger.info(
        "user_registration_completed",
        user_id=new_user.id,
        username=new_user.username,
    )
    
    return new_user


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    credentials: UserLogin,
    db: Session = Depends(get_db),
):
    logger.info(
        "user_login_started",
        username=credentials.username,
    )
    
    # Find user
    user = db.query(User).filter(User.username == credentials.username).first()
    if not user:
        logger.warning("login_failed_user_not_found", username=credentials.username)
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Verify password
    if not verify_password(credentials.password, user.hashed_password):
        logger.warning("login_failed_invalid_password", username=credentials.username)
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Create tokens
    access_token = create_access_token(
        data={"user_id": user.id, "username": user.username, "type": "access"},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    
    refresh_token = create_access_token(
        data={"user_id": user.id, "username": user.username, "type": "refresh"},
        expires_delta=timedelta(days=7),
    )
    
    logger.info(
        "user_login_completed",
        user_id=user.id,
        username=user.username,
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("10/minute")
async def refresh_access_token(
    request: Request,
    refresh_data: RefreshTokenRequest,
    db: Session = Depends(get_db),
):
    logger.info("token_refresh_started")
    
    # Decode refresh token
    payload = decode_token(refresh_data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        logger.warning("token_refresh_failed_invalid_token")
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    
    # Get user
    user = db.query(User).filter(User.id == payload.get("user_id")).first()
    if not user:
        logger.warning("token_refresh_failed_user_not_found", user_id=payload.get("user_id"))
        raise HTTPException(status_code=401, detail="User not found")
    
    # Create new access token
    new_access_token = create_access_token(
        data={"user_id": user.id, "username": user.username, "type": "access"},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    
    logger.info(
        "token_refresh_completed",
        user_id=user.id,
    )
    
    return {
        "access_token": new_access_token,
        "refresh_token": refresh_data.refresh_token,
        "token_type": "bearer",
    }


@router.delete("/users/me")
@limiter.limit("2/minute")
async def delete_current_user(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logger.info(
        "user_delete_started",
        user_id=current_user.id,
        username=current_user.username,
    )

    db.delete(current_user)
    db.commit()

    logger.info(
        "user_delete_completed",
        user_id=current_user.id,
        username=current_user.username,
    )

    return {"detail": "User deleted"}
