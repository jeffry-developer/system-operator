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
1. HORARIO NOCHE Y MADRUGADA (OBLIGATORIO): Cada saludo debe funcionar y tener perfecto sentido TANTO si se envía de noche COMO si se envía en la madrugada. Emplea expresiones naturales como: "ya sea cerrando el día o transitando la madrugada", "a estas horas de la noche o madrugada", "si andas despierto a estas horas", "para cerrar la jornada o velar la madrugada", etc.
2. NUNCA REPETIR: Cada saludo debe abordar una perspectiva, metáfora o sensación diferente (desconexión mental, soltar la tensión del rostro o cuerpo, actitud positiva o anécdota graciosa, abrigo y protección suave, suspiro hondo y confort interior). No repitas frases entre saludos.
3. FORMATO EXACTO REQUERIDO:
Cada saludo debe constar obligatoriamente de:
- Un encabezado: [Número]. [Nombre del Perfil] ([Enfoque / Perspectiva breve])
- Párrafo 1: Escena nocturna de tranquilidad, respiro o pausa, y saludo cercano.
- Párrafo 2: Reflexión sobre la noche/madrugada que conecte con la tranquilidad y desconexión.
- Párrafo 3: Deseo de bienestar + pregunta abierta si sigue despierto a estas horas (ej: "¿qué haces cuando quieres que tu mente deje de dar tantas vueltas?", "¿te habías dado cuenta de cuánta tensión guardas a veces en el rostro?").
- Doble salto de línea entre saludos.

EJEMPLO EXACTO DE LA ESTRUCTURA Y TONO REQUERIDO:
1. Antonio (Nueva perspectiva y desconexión)

Hay días en los que la mente agradece enormemente colgar los guantes y dejar de buscarle explicaciones a todo. Quise pasar a saludarte en este rato de tranquilidad para compartir un respiro distinto.

Decidí mirar el panorama con la guardia baja, permitiendo que cualquier idea pesada se diluya por sí sola. Esa distancia mental ayuda a desconectar por completo, ya sea cerrando el día o transitando la madrugada.

Ojalá estés disfrutando de un rincón sumamente apacible por allá. Si andas despierto a estas horas, cuéntame: ¿qué haces cuando quieres que tu mente deje de dar tantas vueltas?

2. Juan M (Bienestar, relax y ritmo del día)

Soltar la tensión que acumulamos en la frente y dejar la expresión completamente neutral es un alivio inmediato. Qué buen momento para asomarme a saludarte y desearte total serenidad.

Me propuse revisar esos pequeños puntos donde el cuerpo se contrae sin que lo notemos, para devolverles la calma. Cuidar el bienestar físico a este nivel renueva la energía al instante, sin importar si es de noche o madrugada.

Espero que estés experimentando una soltura muy agradable en este instante. Si tienes un huequito libre por ahí, dime: ¿te habías dado cuenta de cuánta tensión guardas a veces en el rostro?

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
        num_parrafos = getattr(request, 'parrafos', 20) or 20
        # Construir prompt con contexto de continuidad
        prompt_contexto = f"""{perfil["prompt_personalidad"]}

CONTEXTO DE CONTINUIDAD PARA PAGADORA '{request.pagadora}':
- Última carta enviada: #{numero_inicial}
- Tipo anterior: {tipo_anterior}
- Notas/contexto: {notas}
- Instrucciones adicionales: {request.instrucciones or 'Ninguna'}

REGLAS ESTRICTAS DE GENERACIÓN DE CARTAS:
- Genera {request.cantidad} carta(s) de tipo '{request.tipo}' (romántica o sexual).
- LONGITUD OBLIGATORIA: Cada carta DEBE tener EXACTAMENTE {num_parrafos} PÁRRAFOS sustanciosos y detallados, separados entre sí por doble salto de línea.
- Si el tipo es 'romantica': seductora, profunda, apasionada, íntima, con un ritmo poético y magnético que mantenga enganchada a la lectora durante los {num_parrafos} párrafos.
- Si el tipo es 'sexual': explícita, táctil, ardiente, erótica, intensa, directa, explorando sensaciones y fantasías continuas durante los {num_parrafos} párrafos.
- NO uses placeholders como [nombre]. Escribe el texto de corrido de forma inmersiva.
- Separador entre cartas (si hay más de 1): '---'."""
        
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