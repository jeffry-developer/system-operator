from fastapi import APIRouter, Depends, HTTPException, Query
from uuid import UUID
from typing import List, Optional
from app.services.supabase_service import supabase_service, supabase_service_admin
from app.services.scraper_service import scraper_service
from app.api.auth import get_current_user
from app.models.schemas import ImagenDescargada


router = APIRouter()


@router.get("", response_model=List[ImagenDescargada])
async def get_imagenes(
    limit: int = Query(50, ge=1, le=100),
    current_user: UUID = Depends(get_current_user)
):
    """Obtiene la galería de imágenes del usuario"""
    return supabase_service.get_imagenes_by_usuario(current_user, limit)


@router.get("/count")
async def get_imagenes_count(current_user: UUID = Depends(get_current_user)):
    """Obtiene el total de imágenes del usuario"""
    count = supabase_service.get_imagenes_count_by_usuario(current_user)
    return {"total": count}


@router.post("/scrape")
async def scrape_imagenes(
    query: str = "romantic aesthetic",
    max_imagenes: int = Query(20, ge=1, le=50),
    etiqueta: str = "romantica",
    current_user: UUID = Depends(get_current_user)
):
    """Ejecuta el scraper de Pinterest para buscar imágenes nuevas"""
    # Playwright falla en este entorno, así que enrutamos la petición
    # al scraper de bancos libres que usa HTTP puro y trae mejores resultados.
    imagenes = await scraper_service.scrape_bancos_libres(
        usuario_id=current_user,
        query=query,
        etiqueta=etiqueta,
        max_imagenes=max_imagenes
    )
    return {
        "message": f"Se encontraron {len(imagenes)} imágenes nuevas",
        "imagenes": imagenes
    }


@router.post("/scrape/bancos-libres")
async def scrape_bancos_libres(
    etiqueta: str = "romantica",
    max_imagenes: int = Query(20, ge=1, le=50),
    current_user: UUID = Depends(get_current_user)
):
    """Ejecuta el scraper de bancos de imágenes libres (Unsplash, etc.)"""
    imagenes = await scraper_service.scrape_bancos_libres(
        usuario_id=current_user,
        etiqueta=etiqueta,
        max_imagenes=max_imagenes
    )
    return {
        "message": f"Se encontraron {len(imagenes)} imágenes nuevas",
        "imagenes": imagenes
    }


@router.delete("/{imagen_id}")
async def delete_imagen(imagen_id: UUID, current_user: UUID = Depends(get_current_user)):
    """Elimina una imagen de la galería"""
    # Verificar que pertenece al usuario
    imagenes = supabase_service.get_imagenes_by_usuario(current_user, limit=1000)
    imagen = next((img for img in imagenes if img["id"] == str(imagen_id)), None)
    
    if not imagen:
        raise HTTPException(status_code=404, detail="Imagen no encontrada")
    
    supabase_service_admin.client.table("imagenes_descargadas").delete().eq("id", str(imagen_id)).execute()
    return {"message": "Imagen eliminada"}

@router.delete("")
async def delete_all_imagenes(current_user: UUID = Depends(get_current_user)):
    """Elimina todas las imágenes de la galería del usuario"""
    supabase_service_admin.client.table("imagenes_descargadas").delete().eq("usuario_id", str(current_user)).execute()
    return {"message": "Todas las imágenes han sido eliminadas"}