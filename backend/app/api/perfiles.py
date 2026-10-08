from fastapi import APIRouter, Depends, HTTPException
import asyncio
from uuid import UUID
from typing import List
from app.core.database import get_supabase
from app.services.supabase_service import supabase_service, supabase_service_admin
from app.services.ai_service import ai_service
from app.models.schemas import PerfilCreate, PerfilUpdate, Perfil, MessageRequest, MessageResponse, TipoMensaje
from app.api.auth import get_current_user


router = APIRouter()


@router.post("", response_model=Perfil)
async def create_perfil(perfil: PerfilCreate, current_user: UUID = Depends(get_current_user)):
    """Crea un nuevo perfil para el usuario actual"""
    return supabase_service.create_perfil(perfil, current_user)


@router.get("", response_model=List[Perfil])
async def get_perfiles(current_user: UUID = Depends(get_current_user)):
    """Obtiene todos los perfiles del usuario actual"""
    return supabase_service.get_perfiles_by_usuario(current_user)


@router.get("/{perfil_id}", response_model=Perfil)
async def get_perfil(perfil_id: UUID, current_user: UUID = Depends(get_current_user)):
    """Obtiene un perfil específico"""
    perfil = supabase_service.get_perfil(perfil_id, current_user)
    if not perfil:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    return perfil


@router.put("/{perfil_id}", response_model=Perfil)
async def update_perfil(perfil_id: UUID, updates: PerfilUpdate, current_user: UUID = Depends(get_current_user)):
    """Actualiza un perfil"""
    perfil = supabase_service.update_perfil(perfil_id, current_user, updates)
    if not perfil:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    return perfil


@router.delete("/{perfil_id}")
async def delete_perfil(perfil_id: UUID, current_user: UUID = Depends(get_current_user)):
    """Elimina un perfil"""
    success = supabase_service.delete_perfil(perfil_id, current_user)
    if not success:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    return {"message": "Perfil eliminado"}


@router.post("/{perfil_id}/generar-mensajes", response_model=MessageResponse)
async def generar_mensajes(perfil_id: UUID, request: MessageRequest, current_user: UUID = Depends(get_current_user)):
    """Genera mensajes para un perfil usando IA"""
    
    # Verificar que el perfil pertenece al usuario
    perfil = supabase_service.get_perfil(perfil_id, current_user)
    if not perfil:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    
    # Generar mensajes con IA en un hilo separado para no bloquear el servidor
    try:
        mensajes = await asyncio.wait_for(
            asyncio.to_thread(ai_service.generar_mensajes, perfil["prompt_personalidad"], request.tipos),
            timeout=120.0  # 2 minutos máximo
        )
        
        # Auto-Scraping para Posts (Opcion 1)
        if "posts" in request.tipos and "posts" in mensajes:
            from app.services.scraper_service import scraper_service
            query = perfil.get("categoria_feed", "aesthetic")
            # Limpiar query (ej: 'estilo_de_vida' -> 'lifestyle')
            if query == "estilo_de_vida": query = "lifestyle"
            if query == "general": query = "aesthetic"
            
            imagenes = await scraper_service.scrape_bancos_libres(
                usuario_id=current_user,
                query=query,
                etiqueta=query,
                max_imagenes=3
            )
            
            if imagenes:
                urls = "\n\n📸 [Imágenes recomendadas guardadas en tu Galería]:\n"
                for i, img in enumerate(imagenes):
                    urls += f"Post {i+1}: {img['url_origen']}\n"
                mensajes["posts"] += urls
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="La IA tardó demasiado. Intenta de nuevo.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar mensajes: {str(e)}")
    
    # Guardar en base de datos
    supabase_service_admin.save_mensajes(mensajes, perfil_id)
    
    return {"perfil_id": perfil_id, "mensajes": mensajes}


@router.get("/{perfil_id}/mensajes")
async def get_mensajes(perfil_id: UUID, current_user: UUID = Depends(get_current_user)):
    """Obtiene el historial de mensajes de un perfil"""
    perfil = supabase_service.get_perfil(perfil_id, current_user)
    if not perfil:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    
    return supabase_service.get_mensajes_by_perfil(perfil_id)


@router.get("/{perfil_id}/ultimos-mensajes")
async def get_ultimos_mensajes(perfil_id: UUID, current_user: UUID = Depends(get_current_user)):
    """Obtiene los últimos mensajes generados de cada tipo"""
    perfil = supabase_service.get_perfil(perfil_id, current_user)
    if not perfil:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    
    return supabase_service.get_ultimos_mensajes_by_perfil(perfil_id)


@router.post("/generar-saludos-rapidos")
async def generar_saludos_rapidos(current_user: UUID = Depends(get_current_user)):
    """Genera saludos rápidos para todos los perfiles + Cuido"""
    perfiles = supabase_service.get_perfiles_by_usuario(current_user)
    
    resultados = []
    
    # Generar para cada perfil
    for perfil in perfiles:
        try:
            mensajes = await asyncio.wait_for(
                asyncio.to_thread(ai_service.generar_mensajes, perfil["prompt_personalidad"], [TipoMensaje.SALUDO]),
                timeout=30.0
            )
            resultados.append({
                "nombre": perfil["nombre_perfil"],
                "texto": mensajes.get("saludo", "")
            })
        except Exception as e:
            resultados.append({
                "nombre": perfil["nombre_perfil"],
                "texto": f"Error al generar: {str(e)}"
            })
            
    # Generar para Cuido (Extra)
    try:
        cuido_prompt = "Perfil Extra: Cuido, mimo y bienestar protector. Muy enfocado en el bienestar físico y mental, cariñoso, protector, empático."
        mensajes_cuido = await asyncio.wait_for(
            asyncio.to_thread(ai_service.generar_mensajes, cuido_prompt, [TipoMensaje.SALUDO]),
            timeout=30.0
        )
        resultados.append({
            "nombre": "Perfil Extra (Cuido)",
            "texto": mensajes_cuido.get("saludo", "")
        })
    except Exception as e:
        resultados.append({
            "nombre": "Perfil Extra (Cuido)",
            "texto": f"Error al generar: {str(e)}"
        })
        
    return resultados