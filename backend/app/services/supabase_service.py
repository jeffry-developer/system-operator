from app.core.database import get_supabase, get_supabase_service
from app.models.schemas import (
    UsuarioCreate, Usuario, PerfilCreate, Perfil, PerfilUpdate,
    MensajeGeneradoCreate, MensajeGenerado, ImagenDescargadaCreate, ImagenDescargada,
    TipoMensaje
)
from uuid import UUID
from typing import List, Optional, Dict
from datetime import datetime


class SupabaseService:
    def __init__(self, use_service_role: bool = False):
        self.client = get_supabase_service() if use_service_role else get_supabase()

    # =========================================================================
    # USUARIOS
    # =========================================================================
    def get_usuario(self, user_id: UUID) -> Optional[Dict]:
        try:
            response = self.client.table("usuarios").select("*").eq("id", str(user_id)).single().execute()
            return response.data if response.data else None
        except Exception:
            return None

    def get_usuario_by_email(self, email: str) -> Optional[Dict]:
        try:
            response = self.client.table("usuarios").select("*").eq("email", email).single().execute()
            return response.data if response.data else None
        except Exception:
            return None

    # =========================================================================
    # PERFILES
    # =========================================================================
    def create_perfil(self, perfil: PerfilCreate, usuario_id: UUID) -> Dict:
        data = perfil.model_dump()
        data["usuario_id"] = str(usuario_id)
        response = self.client.table("perfiles").insert(data).execute()
        return response.data[0] if response.data else None

    def get_perfiles_by_usuario(self, usuario_id: UUID) -> List[Dict]:
        response = self.client.table("perfiles").select("*").eq("usuario_id", str(usuario_id)).order("created_at").execute()
        return response.data or []

    def get_perfil(self, perfil_id: UUID, usuario_id: UUID) -> Optional[Dict]:
        try:
            response = self.client.table("perfiles").select("*").eq("id", str(perfil_id)).eq("usuario_id", str(usuario_id)).single().execute()
            return response.data if response.data else None
        except Exception:
            return None

    def update_perfil(self, perfil_id: UUID, usuario_id: UUID, updates: PerfilUpdate) -> Optional[Dict]:
        data = updates.model_dump(exclude_unset=True)
        data["updated_at"] = datetime.utcnow().isoformat()
        response = self.client.table("perfiles").update(data).eq("id", str(perfil_id)).eq("usuario_id", str(usuario_id)).execute()
        return response.data[0] if response.data else None

    def delete_perfil(self, perfil_id: UUID, usuario_id: UUID) -> bool:
        response = self.client.table("perfiles").delete().eq("id", str(perfil_id)).eq("usuario_id", str(usuario_id)).execute()
        return len(response.data) > 0

    # =========================================================================
    # MENSAJES GENERADOS
    # =========================================================================
    def save_mensajes(self, mensajes: Dict[str, str], perfil_id: UUID) -> List[Dict]:
        records = []
        for tipo, contenido in mensajes.items():
            tipo_str = tipo.value if hasattr(tipo, "value") else str(tipo)
            records.append({
                "perfil_id": str(perfil_id),
                "tipo_mensaje": tipo_str,
                "contenido": contenido
            })
        
        if records:
            response = self.client.table("mensajes_generados").insert(records).execute()
            return response.data or []
        return []

    def get_mensajes_by_perfil(self, perfil_id: UUID) -> List[Dict]:
        response = self.client.table("mensajes_generados").select("*").eq("perfil_id", str(perfil_id)).order("fecha_creacion", desc=True).execute()
        return response.data or []

    def get_ultimos_mensajes_by_perfil(self, perfil_id: UUID) -> Dict[str, str]:
        response = self.client.table("mensajes_generados").select("tipo_mensaje, contenido").eq("perfil_id", str(perfil_id)).order("fecha_creacion", desc=True).limit(50).execute()
        mensajes = {}
        for msg in response.data or []:
            if msg["tipo_mensaje"] not in mensajes:
                mensajes[msg["tipo_mensaje"]] = msg["contenido"]
        return mensajes

    # =========================================================================
    # IMÁGENES DESCARGADAS (ANTI-DUPLICADOS)
    # =========================================================================
    def check_duplicate(self, usuario_id: UUID, hash_imagen: str) -> bool:
        response = self.client.rpc("check_image_duplicate", {
            "p_usuario_id": str(usuario_id),
            "p_hash_imagen": hash_imagen
        }).execute()
        return response.data if response.data else False

    def registrar_imagen(self, imagen: ImagenDescargadaCreate) -> Optional[Dict]:
        data = imagen.model_dump()
        response = self.client.rpc("registrar_imagen_nueva", {
            "p_usuario_id": str(data["usuario_id"]),
            "p_url_origen": data["url_origen"],
            "p_hash_imagen": data["hash_imagen"],
            "p_etiqueta": data.get("etiqueta", "romantica")
        }).execute()
        
        if response.data:
            return {"id": response.data, **data}
        return None

    def get_imagenes_by_usuario(self, usuario_id: UUID, limit: int = 50) -> List[Dict]:
        response = self.client.table("imagenes_descargadas").select("*").eq("usuario_id", str(usuario_id)).order("fecha_registro", desc=True).limit(limit).execute()
        return response.data or []

    def get_imagenes_count_by_usuario(self, usuario_id: UUID) -> int:
        response = self.client.table("imagenes_descargadas").select("id", count="exact").eq("usuario_id", str(usuario_id)).execute()
        return response.count if response.count else 0


# Usar service role por defecto para bypasear RLS en todas las operaciones del backend
supabase_service = SupabaseService(use_service_role=True)
supabase_service_admin = SupabaseService(use_service_role=True)