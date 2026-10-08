from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from uuid import UUID
import enum


class TipoMensaje(str, enum.Enum):
    SALUDO = "saludo"
    ICEBREAKER = "icebreaker"
    CARTA_BARRIDO = "carta_barrido"
    INSISTENCIA = "insistencia"
    CARTA_ROMPEHIELOS = "carta_rompehielos"
    RESPUESTAS_RAPIDAS = "respuestas_rapidas"
    POSTS = "posts"
    CARTA_ROMANTICA = "carta_romantica"
    DINAMICA_JUEGO = "dinamica_juego"


class UsuarioBase(BaseModel):
    email: EmailStr
    nombre: str


class UsuarioCreate(UsuarioBase):
    pass


class Usuario(UsuarioBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PerfilBase(BaseModel):
    nombre_perfil: str
    prompt_personalidad: str
    categoria_feed: str = "general"
    activo: bool = True


class PerfilCreate(PerfilBase):
    pass


class PerfilUpdate(BaseModel):
    nombre_perfil: Optional[str] = None
    prompt_personalidad: Optional[str] = None
    categoria_feed: Optional[str] = None
    activo: Optional[bool] = None


class Perfil(PerfilBase):
    id: UUID
    usuario_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MensajeGeneradoBase(BaseModel):
    tipo_mensaje: TipoMensaje
    contenido: str


class MensajeGeneradoCreate(MensajeGeneradoBase):
    perfil_id: UUID


class MensajeGenerado(MensajeGeneradoBase):
    id: UUID
    perfil_id: UUID
    fecha_creacion: datetime

    class Config:
        from_attributes = True


class ImagenDescargadaBase(BaseModel):
    url_origen: str
    hash_imagen: str
    etiqueta: str = "romantica"


class ImagenDescargadaCreate(ImagenDescargadaBase):
    usuario_id: UUID


class ImagenDescargada(ImagenDescargadaBase):
    id: UUID
    usuario_id: UUID
    fecha_registro: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[UUID] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class MessageRequest(BaseModel):
    perfil_id: UUID
    tipos: List[TipoMensaje] = [
        TipoMensaje.SALUDO,
        TipoMensaje.ICEBREAKER,
        TipoMensaje.CARTA_BARRIDO,
        TipoMensaje.INSISTENCIA
    ]


class MessageResponse(BaseModel):
    perfil_id: UUID
    mensajes: dict