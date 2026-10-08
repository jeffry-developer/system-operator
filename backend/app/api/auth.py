from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from datetime import datetime, timedelta
from uuid import UUID
from app.core.config import settings
from app.core.database import get_supabase, get_supabase_service
from app.services.supabase_service import supabase_service
from app.models.schemas import Token, TokenData, UsuarioCreate, Usuario, LoginRequest
from supabase import Client


router = APIRouter()
security = HTTPBearer()


def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UUID:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token inválido")
        return UUID(user_id)
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")


@router.post("/register", response_model=Token)
async def register(usuario: UsuarioCreate):
    """Registra un nuevo usuario"""
    supabase = get_supabase()
    supabase_admin = get_supabase_service()

    # Verificar si ya existe en nuestra tabla (usando service client para bypassar RLS)
    existing = supabase_admin.table("usuarios").select("id").eq("email", usuario.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    # Contraseña temporal basada en el email
    temp_password = usuario.email.split("@")[0] + "Temp123!"

    # Registrar con sign_up (no requiere service key / admin)
    try:
        auth_response = supabase.auth.sign_up({
            "email": usuario.email,
            "password": temp_password,
            "options": {
                "data": {"nombre": usuario.nombre}
            }
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en Supabase Auth: {str(e)}")

    if not auth_response.user:
        raise HTTPException(status_code=400, detail="Error creando usuario en Supabase Auth")

    user_id = UUID(auth_response.user.id)

    # Auto-confirmar email para que el usuario pueda hacer login inmediatamente
    try:
        supabase_admin.auth.admin.update_user_by_id(str(user_id), {"email_confirm": True})
    except Exception:
        pass  # Si falla, el usuario deberá confirmar por email

    # Insertar en tabla usuarios usando service client (bypasea RLS)
    try:
        supabase_admin.table("usuarios").insert({
            "id": str(user_id),
            "email": usuario.email,
            "nombre": usuario.nombre
        }).execute()
    except Exception:
        # Si ya existe por algún edge case, continuar
        pass

    # Generar JWT propio
    access_token = create_access_token(data={"sub": str(user_id)})
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login", response_model=Token)
async def login(credentials: LoginRequest):
    """Inicia sesión"""
    supabase = get_supabase()

    try:
        auth_response = supabase.auth.sign_in_with_password({
            "email": credentials.email,
            "password": credentials.password
        })
    except Exception as e:
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")

    if not auth_response.user:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    access_token = create_access_token(data={"sub": auth_response.user.id})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=Usuario)
async def get_me(current_user: UUID = Depends(get_current_user)):
    """Obtiene info del usuario actual"""
    usuario = supabase_service.get_usuario(current_user)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return usuario