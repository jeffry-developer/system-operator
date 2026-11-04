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
    CartaPagadora, HistoriaGuardadaCreate, HistoriaGuardada, PagadoraUpdate
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
    
    # Obtener últimos mensajes para evitar repetición
    ultimos = supabase_service.get_ultimos_mensajes_by_perfil(perfil_id)
    
    # Generar mensajes con IA en un hilo separado para no bloquear el servidor
    try:
        mensajes = await asyncio.wait_for(
            asyncio.to_thread(
                ai_service.generar_mensajes,
                perfil["prompt_personalidad"],
                request.tipos,
                ultimos  # Pasar historial para evitar repetición
            ),
            timeout=120.0  # 2 minutos máximo
        )
        
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
    """Genera saludos unificados en un solo recuadro para todos los perfiles + 2 extras de cuido enfocado en noche y madrugada"""
    perfiles = supabase_service.get_perfiles_by_usuario(current_user)
    if not perfiles:
        raise HTTPException(status_code=400, detail="Crea al menos un perfil para generar los saludos.")

    n = len(perfiles)
    perfiles_desc = "\n".join([f"{i+1}. {p['nombre_perfil']}: Tono/estilo: {p.get('prompt_personalidad', '')[:160]}" for i, p in enumerate(perfiles)])
    
    system_prompt = ai_service._construir_system_prompt("Asistente experto en redacción de saludos de contacto para perfiles de chat.")
    
    prompt = f"""Genera un DOCUMENTO COMPLETO Y UNIFICADO con exactamente {n + 2} saludos nocturnos/madrugada: uno para cada perfil registrado del usuario y obligatoriamente dos perfiles extras de cuido al final.

PERFILES REGISTRADOS ({n}):
{perfiles_desc}

Y DOS PERFILES EXTRAS DE CUIDO AL FINAL (OBLIGATORIOS):
{n + 1}. Perfil Extra (Cuido, mimo y bienestar protector)
{n + 2}. Perfil Extra (Cuido, mimo y bienestar protector)

REGLAS OBLIGATORIAS:
1. HORARIO NOCHE Y MADRUGADA (OBLIGATORIO): Cada saludo debe servir tanto de noche como de madrugada. Usa frases sencillas como: "a estas horas", "si sigues despierto" o "antes de dormir".
2. NUNCA REPETIR: Cada saludo debe tratar una idea fácil y diferente (descansar la mente, soltar la tensión del cuerpo, recordar algo gracioso, respirar profundo o pensar en algo bonito). No repitas frases entre saludos.
3. LENGUAJE SENCILLO: Usa palabras comunes y oraciones cortas. Evita palabras rebuscadas, frases demasiado poéticas y explicaciones difíciles.
4. FORMATO EXACTO REQUERIDO:
Cada saludo debe constar obligatoriamente de:
- Un encabezado: [Número]. [Nombre del Perfil] ([Enfoque / Perspectiva breve])
- Párrafo 1: Escena nocturna de tranquilidad, respiro o pausa, y saludo cercano.
- Párrafo 2: Una idea sencilla sobre descansar durante la noche o la madrugada.
- Párrafo 3: Deseo de bienestar + pregunta abierta si sigue despierto a estas horas (ej: "¿qué haces cuando quieres que tu mente deje de dar tantas vueltas?", "¿te habías dado cuenta de cuánta tensión guardas a veces en el rostro?").
- Doble salto de línea entre saludos.

EJEMPLO EXACTO DE LA ESTRUCTURA Y TONO REQUERIDO:
1. Antonio (Descanso para la mente)

Hay días en los que la mente necesita dejar de pensar tanto. Quise saludarte en este rato tranquilo y saber cómo estás.

Esta noche decidí dejar los problemas para mañana y respirar un poco. Es una forma simple de descansar cuando el día fue pesado.

Espero que estés bien por allá. Si sigues despierto, dime: ¿qué haces cuando quieres dejar de pensar tanto?

2. Juan M (Soltar la tensión)

Hoy noté que tenía la frente tensa y los hombros duros. Respiré profundo y pensé que era un buen momento para saludarte.

Moví un poco los hombros y respiré varias veces. Algo tan simple puede ayudar cuando llega la noche y el cuerpo sigue tenso.

Espero que también puedas descansar. Si sigues despierto, dime: ¿notas cuando tienes la cara o los hombros tensos?

Genera TODOS los {n + 2} saludos respetando esta estructura exacta."""

    try:
        contenido = await asyncio.wait_for(
            asyncio.to_thread(ai_service._llamar_ia, system_prompt, prompt),
            timeout=90.0
        )
        contenido = ai_service._sanitizar_texto(contenido.strip())
        
        # Parsear los bloques individuales para visualización flexible
        import re
        patron_bloque = re.compile(r'(?:^|\n\n)(?=\d+\.\s+)', re.MULTILINE)
        partes = [b.strip() for b in patron_bloque.split(contenido) if b.strip()]
        
        saludos_individuales = []
        for p in partes:
            lineas = p.split('\n', 1)
            titulo = lineas[0].strip()
            cuerpo = lineas[1].strip() if len(lineas) > 1 else p
            saludos_individuales.append({
                "nombre": titulo,
                "texto": cuerpo,
                "completo": p
            })
            
        return {
            "documento_completo": contenido,
            "saludos": saludos_individuales
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar saludos unificados: {str(e)}")


@router.post("/{perfil_id}/generar-plan-trabajo")
async def generar_plan_trabajo(perfil_id: UUID, current_user: UUID = Depends(get_current_user)):
    """Genera el Plan de Trabajo completo para un perfil"""
    perfil = supabase_service.get_perfil(perfil_id, current_user)
    if not perfil:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")

    try:
        # Obtener últimos mensajes para evitar repetición
        ultimos = supabase_service.get_ultimos_mensajes_by_perfil(perfil_id)

        # Generar todos los tipos del plan de trabajo
        tipos_plan = [
            TipoMensaje.ICEBREAKER,
            TipoMensaje.CARTA_ROMPEHIELOS,
            TipoMensaje.CARTA_BARRIDO,
            TipoMensaje.INSISTENCIA,
            TipoMensaje.SALUDO_PLAN_TRABAJO,
        ]
        
        mensajes = await asyncio.wait_for(
            asyncio.to_thread(ai_service.generar_mensajes, perfil["prompt_personalidad"], tipos_plan, ultimos),
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
        # Obtener últimos mensajes para evitar repetición
        ultimos = supabase_service.get_ultimos_mensajes_by_perfil(perfil_id)

        # Generar todos los tipos del new feed
        tipos_feed = [
            TipoMensaje.RESPUESTAS_RAPIDAS,
            TipoMensaje.INSISTENCIA_NEW_FEED,
            TipoMensaje.SALUDO_NEW_FEED,
            TipoMensaje.POSTS,
        ]
        
        mensajes = await asyncio.wait_for(
            asyncio.to_thread(ai_service.generar_mensajes, perfil["prompt_personalidad"], tipos_feed, ultimos),
            timeout=120.0
        )
        
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
        num_parrafos = getattr(request, 'parrafos', 20) or 20
        if request.cantidad < 0:
            raise HTTPException(status_code=422, detail="La cantidad de cartas no puede ser negativa")
        if request.cantidad > 0 and not 3 <= num_parrafos <= 40:
            raise HTTPException(status_code=422, detail="La cantidad de párrafos debe estar entre 3 y 40")

        contexto = f"""{perfil["prompt_personalidad"]}

CONTEXTO DE CONTINUIDAD PARA PAGADORA '{request.pagadora}':
- Última carta enviada: #{numero_inicial}
- Tipo anterior: {tipo_anterior}
- Notas/contexto: {notas}
- Instrucciones adicionales: {request.instrucciones or 'Ninguna'}"""

        cartas = []
        for _ in range(request.cantidad):
            carta = await asyncio.wait_for(
                asyncio.to_thread(
                    ai_service.generar_carta_extensa,
                    contexto,
                    request.tipo,
                    num_parrafos,
                ),
                timeout=120.0,
            )
            cartas.append(carta)

        contenido = "\n\n---\n\n".join(cartas)
        
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
        
    except HTTPException:
        raise
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


@router.put("/{perfil_id}/pagadoras/{pagadora_id}")
async def update_pagadora(perfil_id: UUID, pagadora_id: UUID, request: PagadoraUpdate, current_user: UUID = Depends(get_current_user)):
    """Renombra una pagadora y mantiene sus historias asociadas."""
    perfil = supabase_service.get_perfil(perfil_id, current_user)
    if not perfil:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")

    nuevo_nombre = request.nombre_pagadora.strip()
    if not nuevo_nombre:
        raise HTTPException(status_code=422, detail="El nombre de la pagadora es obligatorio")
    if len(nuevo_nombre) > 100:
        raise HTTPException(status_code=422, detail="El nombre no puede superar 100 caracteres")

    pagadora = supabase_service.get_carta_pagadora_by_id(perfil_id, pagadora_id)
    if not pagadora:
        raise HTTPException(status_code=404, detail="Pagadora no encontrada")

    existente = supabase_service.get_carta_pagadora(perfil_id, nuevo_nombre)
    if existente and existente["id"] != str(pagadora_id):
        raise HTTPException(status_code=409, detail="Ya existe una pagadora con ese nombre")

    actualizada = supabase_service.rename_carta_pagadora(perfil_id, pagadora_id, nuevo_nombre)
    if not actualizada:
        raise HTTPException(status_code=500, detail="No se pudo actualizar la pagadora")
    return actualizada


@router.delete("/{perfil_id}/pagadoras/{pagadora_id}")
async def delete_pagadora(perfil_id: UUID, pagadora_id: UUID, current_user: UUID = Depends(get_current_user)):
    """Elimina una pagadora y desvincula sus historias."""
    perfil = supabase_service.get_perfil(perfil_id, current_user)
    if not perfil:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")

    if not supabase_service.delete_carta_pagadora(perfil_id, pagadora_id):
        raise HTTPException(status_code=404, detail="Pagadora no encontrada")
    return {"message": "Pagadora eliminada correctamente"}


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


@router.post("/{perfil_id}/historias")
async def save_historia(perfil_id: UUID, request: dict, current_user: UUID = Depends(get_current_user)):
    """Guarda o actualiza una historia personalizada"""
    perfil = supabase_service.get_perfil(perfil_id, current_user)
    if not perfil:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    
    try:
        historia_data = HistoriaGuardadaCreate(
            perfil_id=perfil_id,
            titulo=request.get("titulo", "Sin título"),
            tipo=request.get("tipo", "personalizada"),
            contenido=request.get("contenido", ""),
            pagadora_asociada=request.get("pagadora_asociada")
        )
        resultado = supabase_service.save_historia(historia_data)
        if not resultado:
            raise HTTPException(status_code=500, detail="Error al guardar historia")
        return resultado
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar historia: {str(e)}")
