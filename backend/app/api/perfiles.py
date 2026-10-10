from fastapi import APIRouter, Depends, HTTPException
import asyncio
from uuid import UUID
from typing import List
from datetime import datetime
from app.core.database import get_supabase
from app.services.supabase_service import supabase_service, supabase_service_admin
from app.services.ai_service import ai_service
from app.models.schemas import (
    PerfilCreate, PerfilUpdate, Perfil, MessageRequest, MessageResponse, 
    TipoMensaje, CartasPagadoraRequest, HistoriaRequest,
    CartaPagadora, HistoriaGuardadaCreate, HistoriaGuardada
)
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
        # Usar el nombre "Cuido (Bienestar protector y mimo)" para el formato
        texto_cuido = mensajes_cuido.get("saludo", "")
        # Asegurar que tenga el formato correcto con el nombre Cuido
        if texto_cuido and not texto_cuido.startswith("1. Cuido"):
            # La IA ya debería generar el formato, pero si no, lo forzamos
            pass
        resultados.append({
            "nombre": "Cuido (Bienestar protector y mimo)",
            "texto": texto_cuido
        })
    except Exception as e:
        resultados.append({
            "nombre": "Cuido (Bienestar protector y mimo)",
            "texto": f"Error al generar: {str(e)}"
        })
        
    return resultados


@router.post("/{perfil_id}/generar-plan-trabajo")
async def generar_plan_trabajo(perfil_id: UUID, current_user: UUID = Depends(get_current_user)):
    """Genera el Plan de Trabajo completo para un perfil"""
    perfil = supabase_service.get_perfil(perfil_id, current_user)
    if not perfil:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")

    try:
        # Generar todos los tipos del plan de trabajo
        tipos_plan = [
            TipoMensaje.ICEBREAKER,
            TipoMensaje.CARTA_ROMPEHIELOS,
            TipoMensaje.CARTA_BARRIDO,
            TipoMensaje.INSISTENCIA,
            TipoMensaje.SALUDO_PLAN_TRABAJO,
        ]
        
        mensajes = await asyncio.wait_for(
            asyncio.to_thread(ai_service.generar_mensajes, perfil["prompt_personalidad"], tipos_plan),
            timeout=120.0
        )
        
        # Guardar en base de datos
        supabase_service_admin.save_mensajes(mensajes, perfil_id)
        
        # Formatear respuesta como documento único
        nombre_perfil = perfil["nombre_perfil"]
        plan_completo = f"""-----------------------------(ICEBREAKERS)---------------------------------
{mensajes.get("icebreaker", "")}

--------------------------(Carta de Rompehielos)---------------------------
{mensajes.get("carta_rompehielos", "")}

-----------------------------(Cartas de Barrido)------------------------------
{mensajes.get("carta_barrido", "")}

--------------------------(Mensajes de insistencia)-------------------------
{mensajes.get("insistencia", "")}

---------------------------------(Saludo)----------------------------------
{mensajes.get("saludo_plan_trabajo", "")}"""
        
        return {"perfil_id": str(perfil_id), "plan_trabajo": plan_completo, "mensajes": mensajes}
        
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="La IA tardó demasiado. Intenta de nuevo.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar plan de trabajo: {str(e)}")


@router.post("/{perfil_id}/generar-new-feed")
async def generar_new_feed(perfil_id: UUID, current_user: UUID = Depends(get_current_user)):
    """Genera el New Feed completo para un perfil"""
    perfil = supabase_service.get_perfil(perfil_id, current_user)
    if not perfil:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")

    try:
        # Generar todos los tipos del new feed
        tipos_feed = [
            TipoMensaje.RESPUESTAS_RAPIDAS,
            TipoMensaje.INSISTENCIA_NEW_FEED,
            TipoMensaje.SALUDO_NEW_FEED,
            TipoMensaje.POSTS,
        ]
        
        mensajes = await asyncio.wait_for(
            asyncio.to_thread(ai_service.generar_mensajes, perfil["prompt_personalidad"], tipos_feed),
            timeout=120.0
        )
        
        # Scraping de imágenes para los posts
        from app.services.scraper_service import scraper_service
        query = perfil.get("categoria_feed", "aesthetic")
        if query == "estilo_de_vida": query = "lifestyle"
        if query == "general": query = "aesthetic"
        
        imagenes = await scraper_service.scrape_bancos_libres(
            usuario_id=current_user,
            query=query,
            etiqueta=query,
            max_imagenes=3
        )
        
        if imagenes and "posts" in mensajes:
            urls = "\n\n📸 [Imágenes recomendadas guardadas en tu Galería]:\n"
            for i, img in enumerate(imagenes):
                urls += f"Post {i+1}: {img['url_origen']}\n"
            mensajes["posts"] += urls
        
        # Guardar en base de datos
        supabase_service_admin.save_mensajes(mensajes, perfil_id)
        
        # Formatear respuesta como documento único
        feed_completo = f"""------------------------(Respuestas Rapidas)---------------------------
{mensajes.get("respuestas_rapidas", "")}

------------------------(Mensajes de insistencia)------------------------
{mensajes.get("insistencia_new_feed", "")}

-------------------------(Saludo)-------------------------------
{mensajes.get("saludo_new_feed", "")}

--------------------------(Posts)-------------------------------
{mensajes.get("posts", "")}"""
        
        return {"perfil_id": str(perfil_id), "new_feed": feed_completo, "mensajes": mensajes}
        
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="La IA tardó demasiado. Intenta de nuevo.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar new feed: {str(e)}")


@router.post("/{perfil_id}/generar-cartas-pagadora")
async def generar_cartas_pagadora(perfil_id: UUID, request: CartasPagadoraRequest, current_user: UUID = Depends(get_current_user)):
    """Genera cartas para una pagadora específica con continuidad"""
    perfil = supabase_service.get_perfil(perfil_id, current_user)
    if not perfil:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")

    # Obtener marcador actual
    marcador = supabase_service.get_carta_pagadora(perfil_id, request.pagadora)
    numero_inicial = marcador["ultima_carta_numero"] if marcador else 0
    tipo_anterior = marcador["ultima_carta_tipo"] if marcador else request.tipo
    notas = marcador["notas"] if marcador else ""

    try:
        # Construir prompt con contexto de continuidad
        prompt_contexto = f"""{perfil["prompt_personalidad"]}

CONTEXTO DE CONTINUIDAD PARA PAGADORA '{request.pagadora}':
- Última carta enviada: #{numero_inicial}
- Tipo anterior: {tipo_anterior}
- Notas/contexto: {notas}
- Instrucciones adicionales: {request.instrucciones or 'Ninguna'}

Genera {request.cantidad} cartas NUEVAS continuando desde la #{numero_inicial + 1}.
Tipo solicitado: {request.tipo} (romantica, sensual, sexual, personalizada, historia).
Cada carta: 2 párrafos exactamente. Numeradas consecutivamente. Separadas por '---'."""
        
        mensajes = await asyncio.wait_for(
            asyncio.to_thread(ai_service.generar_mensajes, prompt_contexto, [TipoMensaje.CARTA_ROMANTICA]),
            timeout=120.0
        )
        
        contenido = mensajes.get("carta_romantica", "")
        
        # Actualizar marcador
        nuevo_numero = numero_inicial + request.cantidad
        supabase_service.upsert_carta_pagadora(
            perfil_id=perfil_id,
            nombre_pagadora=request.pagadora,
            ultima_carta_numero=nuevo_numero,
            ultima_carta_tipo=request.tipo,
            notas=f"{notas}\nGeneradas {request.cantidad} cartas tipo {request.tipo} el {datetime.utcnow().isoformat()}"
        )
        
        # Guardar en mensajes_generados para historial
        supabase_service_admin.save_mensajes({
            f"cartas_pagadora_{request.pagadora}": contenido
        }, perfil_id)
        
        return {
            "perfil_id": str(perfil_id),
            "pagadora": request.pagadora,
            "cartas_generadas": request.cantidad,
            "numero_inicial": numero_inicial + 1,
            "numero_final": nuevo_numero,
            "contenido": contenido
        }
        
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="La IA tardó demasiado. Intenta de nuevo.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar cartas: {str(e)}")


@router.post("/{perfil_id}/generar-historia")
async def generar_historia(perfil_id: UUID, request: HistoriaRequest, current_user: UUID = Depends(get_current_user)):
    """Genera una historia opcional bajo demanda (romántica, sensual, sexual, personalizada)"""
    perfil = supabase_service.get_perfil(perfil_id, current_user)
    if not perfil:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")

    try:
        prompt_historia = f"""{perfil["prompt_personalidad"]}

Genera una historia completa de tipo '{request.tipo}' sobre: {request.tema}.
{'Para la pagadora: ' + request.pagadora if request.pagadora else 'Historia genérica sin pagadora específica.'}
Estilo: narrativo, inmersivo, adaptado a la personalidad del perfil.
Longitud: 4-6 párrafos. Sin placeholders."""
        
        # Usar CARTA_ROMANTICA como base pero adaptado para historia larga
        mensajes = await asyncio.wait_for(
            asyncio.to_thread(ai_service.generar_mensajes, prompt_historia, [TipoMensaje.CARTA_ROMANTICA]),
            timeout=120.0
        )
        
        contenido = mensajes.get("carta_romantica", "")
        
        # Guardar en historias_guardadas
        historia_data = HistoriaGuardadaCreate(
            perfil_id=perfil_id,
            titulo=f"{request.tipo.capitalize()}: {request.tema[:50]}",
            tipo=request.tipo,
            contenido=contenido,
            pagadora_asociada=request.pagadora
        )
        supabase_service.save_historia(historia_data)
        
        return {
            "perfil_id": str(perfil_id),
            "tipo": request.tipo,
            "tema": request.tema,
            "pagadora": request.pagadora,
            "contenido": contenido
        }
        
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="La IA tardó demasiado. Intenta de nuevo.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar historia: {str(e)}")


@router.get("/{perfil_id}/pagadoras")
async def get_pagadoras(perfil_id: UUID, current_user: UUID = Depends(get_current_user)):
    """Obtiene todos los marcadores de pagadoras de un perfil"""
    perfil = supabase_service.get_perfil(perfil_id, current_user)
    if not perfil:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    
    return supabase_service.get_cartas_pagadoras_by_perfil(perfil_id)


@router.get("/{perfil_id}/historias")
async def get_historias(perfil_id: UUID, current_user: UUID = Depends(get_current_user)):
    """Obtiene todas las historias guardadas de un perfil"""
    perfil = supabase_service.get_perfil(perfil_id, current_user)
    if not perfil:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    
    return supabase_service.get_historias_by_perfil(perfil_id)


@router.delete("/{perfil_id}/historias/{historia_id}")
async def delete_historia(perfil_id: UUID, historia_id: UUID, current_user: UUID = Depends(get_current_user)):
    """Elimina una historia guardada"""
    perfil = supabase_service.get_perfil(perfil_id, current_user)
    if not perfil:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    
    success = supabase_service.delete_historia(historia_id, perfil_id)
    if not success:
        raise HTTPException(status_code=404, detail="Historia no encontrada")
    return {"message": "Historia eliminada"}