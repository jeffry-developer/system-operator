from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.api.auth import get_current_user
from app.models.schemas import PromptCreate, PromptGuardado, PromptUpdate
from app.services.supabase_service import supabase_service


router = APIRouter()
MAX_PROMPT_IMAGES = 6
MAX_IMAGE_LENGTH = 2_500_000


def validate_images(images: list[str]) -> None:
    if len(images) > MAX_PROMPT_IMAGES:
        raise HTTPException(status_code=422, detail=f"Puedes guardar hasta {MAX_PROMPT_IMAGES} imágenes por prompt")
    for image in images:
        if not image.startswith(("data:image/", "https://", "http://")):
            raise HTTPException(status_code=422, detail="Una de las imágenes no tiene un formato válido")
        if len(image) > MAX_IMAGE_LENGTH:
            raise HTTPException(status_code=422, detail="Una de las imágenes es demasiado grande")


@router.get("", response_model=list[PromptGuardado])
async def list_prompts(current_user: UUID = Depends(get_current_user)):
    try:
        return supabase_service.get_prompts_by_usuario(current_user)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="La biblioteca de prompts aún no está disponible en la base de datos") from exc


@router.post("", response_model=PromptGuardado, status_code=201)
async def create_prompt(prompt: PromptCreate, current_user: UUID = Depends(get_current_user)):
    if not prompt.nombre.strip() or not prompt.contenido.strip():
        raise HTTPException(status_code=422, detail="El nombre y el contenido son obligatorios")
    validate_images(prompt.imagenes)
    try:
        created = supabase_service.create_prompt(prompt, current_user)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="No se pudo acceder al almacenamiento de prompts") from exc
    if not created:
        raise HTTPException(status_code=500, detail="No se pudo guardar el prompt")
    return created


@router.put("/{prompt_id}", response_model=PromptGuardado)
async def update_prompt(prompt_id: UUID, updates: PromptUpdate, current_user: UUID = Depends(get_current_user)):
    if updates.nombre is not None and not updates.nombre.strip():
        raise HTTPException(status_code=422, detail="El nombre no puede estar vacío")
    if updates.contenido is not None and not updates.contenido.strip():
        raise HTTPException(status_code=422, detail="El contenido no puede estar vacío")
    if updates.imagenes is not None:
        validate_images(updates.imagenes)
    try:
        updated = supabase_service.update_prompt(prompt_id, current_user, updates)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="No se pudo acceder al almacenamiento de prompts") from exc
    if not updated:
        raise HTTPException(status_code=404, detail="Prompt no encontrado")
    return updated


@router.delete("/{prompt_id}")
async def delete_prompt(prompt_id: UUID, current_user: UUID = Depends(get_current_user)):
    try:
        deleted = supabase_service.delete_prompt(prompt_id, current_user)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="No se pudo acceder al almacenamiento de prompts") from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="Prompt no encontrado")
    return {"message": "Prompt eliminado"}
