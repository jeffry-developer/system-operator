from fastapi import APIRouter, Depends, HTTPException
import asyncio
import random
import re
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


TEMAS_SALUDOS_RAPIDOS = (
    "algo gracioso que pasó durante el día",
    "una canción que se quedó dando vueltas en la cabeza",
    "una película o serie que sorprendió",
    "un antojo sencillo a estas horas",
    "un recuerdo divertido de la infancia",
    "una curiosidad aprendida recientemente",
    "una foto antigua encontrada por casualidad",
    "un sueño extraño que todavía se recuerda",
    "una costumbre pequeña que alegra el día",
    "el sonido de la lluvia o del viento afuera",
    "una conversación que dejó pensando",
    "algo inesperado que salió bien hoy",
    "un talento que gustaría aprender",
    "la canción ideal para cerrar el día",
    "una comida sencilla que trae buenos recuerdos",
    "una decisión pequeña que mejoró el día",
    "un dato curioso que cuesta creer",
    "una palabra o expresión que causa gracia",
    "el mejor momento de la semana hasta ahora",
    "algo cotidiano que resultó más divertido de lo esperado",
    "una historia familiar que siempre hace sonreír",
    "un objeto guardado por su valor sentimental",
    "una afición que despierta curiosidad",
    "un olor que trae un recuerdo inmediato",
    "una pregunta curiosa que apareció de repente",
    "algo nuevo que se probó por primera vez",
    "un pequeño logro reciente",
    "una tradición que resulta especial",
    "una casualidad difícil de olvidar",
    "algo que gustaría volver a hacer como principiante",
    "un momento vergonzoso que ahora causa risa",
    "una noticia buena que alegró el día",
)

PATRON_TEMATICA_REPETITIVA = re.compile(
    r"\b(?:descans\w*|relaj\w*|respir\w*|tensi[oó]n|mimos?|cuidad\w*|bienestar|"
    r"protecci[oó]n|seren\w*|tranquil\w*|masaj\w*|rostro|hombros?|cuello|cuerpo|"
    r"mente|alivio|pausa)\b",
    re.IGNORECASE,
)


def _seleccionar_temas_saludos(cantidad: int) -> List[str]:
    """Elige temas distintos sin relacionarlos con la categoría del perfil."""
    if cantidad <= len(TEMAS_SALUDOS_RAPIDOS):
        return random.sample(TEMAS_SALUDOS_RAPIDOS, cantidad)

    temas = list(TEMAS_SALUDOS_RAPIDOS)
    random.shuffle(temas)
    temas.extend(
        f"pregunta cotidiana inesperada número {numero}"
        for numero in range(1, cantidad - len(temas) + 1)
    )
    return temas


def _extraer_bloques_saludos(contenido: str) -> List[str]:
    patron_bloque = re.compile(r"(?:^|\n\n)(?=\d+\.\s+)", re.MULTILINE)
    return [bloque.strip() for bloque in patron_bloque.split(contenido) if bloque.strip()]


def _validar_saludos_generados(
    contenido: str,
    nombres: List[str],
    temas: List[str],
) -> List[str]:
    """Comprueba cantidad, encabezados, párrafos y ausencia del patrón repetitivo."""
    errores = []
    bloques = _extraer_bloques_saludos(contenido)

    if len(bloques) != len(nombres):
        errores.append(f"se generaron {len(bloques)} saludos y se esperaban {len(nombres)}")
        return errores

    for indice, (bloque, nombre, tema) in enumerate(zip(bloques, nombres, temas), start=1):
        lineas = bloque.splitlines()
        titulo = lineas[0].strip() if lineas else ""
        titulo_esperado = f"{indice}. {nombre} ({tema})"
        if titulo.casefold() != titulo_esperado.casefold():
            errores.append(f"el saludo {indice} no usó el encabezado exacto requerido")

        cuerpo = "\n".join(lineas[1:]).strip()
        parrafos = [p.strip() for p in re.split(r"\n\s*\n+", cuerpo) if p.strip()]
        if len(parrafos) != 3:
            errores.append(f"el saludo {indice} no tiene exactamente 3 párrafos")

        coincidencias = sorted({m.group(0).lower() for m in PATRON_TEMATICA_REPETITIVA.finditer(cuerpo)})
        if coincidencias:
            errores.append(
                f"el saludo {indice} volvió a la temática repetitiva: {', '.join(coincidencias)}"
            )

    return errores


def _crear_saludos_fallback(nombres: List[str], temas: List[str]) -> str:
    """Crea saludos válidos localmente si la IA falla o ignora las reglas."""
    introducciones = (
        "A estas horas se me ocurrió {tema} y quise pasar a saludarte.",
        "Hola, justo ahora recordé {tema} y sentí curiosidad por saber qué opinas.",
        "A estas horas pensé por casualidad en {tema}. Fue suficiente para querer escribirte.",
        "Entre una cosa y otra apareció el tema de {tema}, así que aproveché para mandarte un saludo.",
        "Qué curioso: a estas horas terminé pensando en {tema}. Me pareció una buena forma de iniciar una charla.",
        "Hoy hubo un momento que me hizo pensar en {tema}. Por eso vine a preguntarte cómo va todo.",
        "Hace un rato recordé {tema} y quise saber qué dirías tú.",
        "Pasaba por aquí y surgió una pregunta sobre {tema}. Me dio curiosidad leer tu respuesta.",
    )
    desarrollos = (
        "Es uno de esos asuntos cotidianos que cambia mucho según la historia de cada persona. Seguro tienes una respuesta propia.",
        "Puede parecer algo sencillo, pero suele traer anécdotas interesantes. Cada quien lo vive de una manera distinta.",
        "Me gusta cuando una idea común termina abriendo una charla inesperada. Siempre aparece algún detalle que uno no imaginaba.",
        "Hay preguntas pequeñas que dicen mucho sobre una persona. Esta me pareció especialmente buena para este momento.",
        "Pensé que sería interesante mirar ese asunto desde otro punto de vista. Las respuestas suelen ser muy diferentes.",
        "Es una de esas cosas que pueden cambiar el ánimo de un día entero. Por eso vale la pena detenerse a recordarla.",
        "Cada persona guarda una anécdota distinta sobre algo así. Esa variedad es justamente lo que lo hace interesante.",
        "No hace falta una gran historia para tener algo bueno que contar. Los detalles cotidianos suelen ser los mejores.",
    )
    cierres = (
        "Espero que todo marche bien por allá. Si sigues despierto, ¿qué es lo primero que se te ocurre sobre {tema}?",
        "Me dará gusto saber de ti a estas horas. Dime, ¿qué experiencia recuerdas relacionada con {tema}?",
        "Te mando un saludo especial para este momento. ¿Qué respuesta darías si te preguntaran por {tema}?",
        "Quería dejarte esta pregunta antes de irme: ¿qué opinión tienes acerca de {tema}?",
        "Ojalá tu día haya tenido algo bueno. Cuéntame, ¿qué historia te trae el tema de {tema}?",
        "Espero que estés teniendo un buen momento. ¿Qué detalle elegirías al hablar de {tema}?",
        "Será interesante leer tu respuesta cuando puedas. ¿Qué recuerdo relacionas de inmediato con {tema}?",
        "Aquí queda mi pregunta de esta hora: ¿qué me contarías tú acerca de {tema}?",
    )

    bloques = []
    for indice, (nombre, tema) in enumerate(zip(nombres, temas), start=1):
        variante = (indice - 1) % len(introducciones)
        bloques.append(
            f"{indice}. {nombre} ({tema})\n\n"
            f"{introducciones[variante].format(tema=tema)}\n\n"
            f"{desarrollos[variante]}\n\n"
            f"{cierres[variante].format(tema=tema)}"
        )

    return "\n\n".join(bloques)


def _generar_saludos_validados(
    system_prompt: str,
    prompt: str,
    nombres: List[str],
    temas: List[str],
) -> str:
    """Usa IA cuando cumple; en cualquier otro caso entrega el fallback local."""
    try:
        contenido = ai_service._llamar_ia(system_prompt, prompt)
        contenido = ai_service._sanitizar_texto(contenido.strip())
        errores = _validar_saludos_generados(contenido, nombres, temas)
        if not errores:
            return contenido
    except Exception:
        pass

    return _crear_saludos_fallback(nombres, temas)


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
    """Genera saludos nocturnos variados para los perfiles y dos extras de cuido."""
    perfiles = supabase_service.get_perfiles_by_usuario(current_user)
    if not perfiles:
        raise HTTPException(status_code=400, detail="Crea al menos un perfil para generar los saludos.")

    n = len(perfiles)
    nombres_perfiles = [p["nombre_perfil"] for p in perfiles]
    nombres_salida = nombres_perfiles + ["Perfil Extra 1 (Cuido)", "Perfil Extra 2 (Cuido)"]
    temas_asignados = _seleccionar_temas_saludos(n + 2)
    asignaciones = "\n".join(
        f"{i}. {nombre} — TEMA EXCLUSIVO: {tema}"
        for i, (nombre, tema) in enumerate(zip(nombres_salida, temas_asignados), start=1)
    )
    encabezados_requeridos = "\n".join(
        f"{i}. {nombre} ({tema})"
        for i, (nombre, tema) in enumerate(zip(nombres_salida, temas_asignados), start=1)
    )
    
    system_prompt = ai_service._construir_system_prompt("Asistente experto en redacción de saludos de contacto para perfiles de chat.")
    
    prompt = f"""Genera un DOCUMENTO COMPLETO Y UNIFICADO con exactamente {n + 2} saludos que sirvan tanto de noche como de madrugada: uno para cada perfil registrado y dos perfiles extras de cuido al final.

PERFILES Y TEMA DIFERENTE ASIGNADO A CADA SALUDO:
{asignaciones}

REGLAS OBLIGATORIAS:
1. INDEPENDENCIA DEL PERFIL (MUY IMPORTANTE): La categoría, personalidad o nombre del perfil NO decide el tema. Usa únicamente el TEMA EXCLUSIVO asignado arriba. La palabra "Cuido" solo identifica esos dos perfiles extras; NO significa que debas hablar de mimo, cuidado, bienestar, protección, masajes, descanso, tensión corporal, relajación ni tratamientos faciales.
2. VARIEDAD REAL (MUY IMPORTANTE): Desarrolla el tema exclusivo de cada fila y no lo mezcles con el de otra. No conviertas todos los temas en reflexiones sobre relajarse, respirar, descansar la mente o cuidar el cuerpo. No repitas escenas, preguntas, comienzos ni frases entre saludos.
3. HORARIO NOCHE Y MADRUGADA: El horario es solo el contexto, no el tema. Cada saludo debe funcionar igual de bien de noche o de madrugada. Puedes usar expresiones como "a estas horas" o "si sigues despierto", pero no afirmes que la otra persona está por dormir.
4. LENGUAJE SENCILLO: Usa palabras comunes y oraciones cortas. Evita palabras rebuscadas, frases demasiado poéticas y explicaciones difíciles.
5. FORMATO EXACTO REQUERIDO:
Cada saludo debe constar obligatoriamente de:
- El encabezado exacto indicado abajo. No cambies ninguna palabra, no resumas el tema y no reemplaces el nombre de los perfiles extra.
- Párrafo 1: Saludo cercano que introduce de forma natural el tema exclusivo.
- Párrafo 2: Anécdota, pensamiento o detalle cotidiano sobre ese mismo tema.
- Párrafo 3: Cierre cálido y una pregunta abierta relacionada con ese tema. La pregunta debe ser distinta en cada saludo.
- Tres párrafos por saludo y doble salto de línea entre saludos.
- No escribas etiquetas como "Tema:", "Párrafo:" o "Pregunta:".

ENCABEZADOS LITERALES Y OBLIGATORIOS:
{encabezados_requeridos}

VOCABULARIO PROHIBIDO EN TODA LA RESPUESTA:
No uses ninguna variante de descanso, relajación, respiración, tensión, mimo, cuidado, bienestar, protección, serenidad, tranquilidad, masaje, rostro, hombros, cuello, cuerpo, mente, alivio o pausa.

Antes de responder, verifica que los {n + 2} enfoques sean diferentes entre sí y que incluso los dos perfiles de cuido hablen de sus temas asignados, no de cuido. Genera TODOS los {n + 2} saludos respetando esta estructura exacta."""

    try:
        try:
            contenido = await asyncio.wait_for(
                asyncio.to_thread(
                    _generar_saludos_validados,
                    system_prompt,
                    prompt,
                    nombres_salida,
                    temas_asignados,
                ),
                timeout=90.0,
            )
        except asyncio.TimeoutError:
            contenido = _crear_saludos_fallback(nombres_salida, temas_asignados)
        
        # Parsear los bloques individuales para visualización flexible
        partes = _extraer_bloques_saludos(contenido)
        
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


@router.post("/{perfil_id}/generar-carta")
@router.post("/{perfil_id}/generar-historia", include_in_schema=False)
async def generar_historia(perfil_id: UUID, request: HistoriaRequest, current_user: UUID = Depends(get_current_user)):
    """Genera una carta opcional bajo demanda."""
    perfil = supabase_service.get_perfil(perfil_id, current_user)
    if not perfil:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")

    try:
        contexto_carta = f"""{perfil["prompt_personalidad"]}

Escribe una carta completa de tipo '{request.tipo}' sobre: {request.tema}.
{'Dirigida a la pagadora: ' + request.pagadora if request.pagadora else 'Carta general sin pagadora específica.'}
Mantén un estilo epistolar, íntimo y adaptado a la personalidad del perfil. Sin placeholders."""
        
        contenido = await asyncio.wait_for(
            asyncio.to_thread(ai_service.generar_carta_extensa, contexto_carta, request.tipo, 6),
            timeout=120.0
        )
        
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
        raise HTTPException(status_code=500, detail=f"Error al generar la carta: {str(e)}")


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


@router.get("/{perfil_id}/cartas-guardadas")
@router.get("/{perfil_id}/historias", include_in_schema=False)
async def get_historias(perfil_id: UUID, current_user: UUID = Depends(get_current_user)):
    """Obtiene todas las cartas guardadas de un perfil."""
    perfil = supabase_service.get_perfil(perfil_id, current_user)
    if not perfil:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    
    return supabase_service.get_historias_by_perfil(perfil_id)


@router.delete("/{perfil_id}/cartas-guardadas/{historia_id}")
@router.delete("/{perfil_id}/historias/{historia_id}", include_in_schema=False)
async def delete_historia(perfil_id: UUID, historia_id: UUID, current_user: UUID = Depends(get_current_user)):
    """Elimina una carta guardada."""
    perfil = supabase_service.get_perfil(perfil_id, current_user)
    if not perfil:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    
    success = supabase_service.delete_historia(historia_id, perfil_id)
    if not success:
        raise HTTPException(status_code=404, detail="Carta no encontrada")
    return {"message": "Carta eliminada"}


@router.post("/{perfil_id}/cartas-guardadas")
@router.post("/{perfil_id}/historias", include_in_schema=False)
async def save_historia(perfil_id: UUID, request: dict, current_user: UUID = Depends(get_current_user)):
    """Guarda una carta personalizada."""
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
            raise HTTPException(status_code=500, detail="Error al guardar la carta")
        return resultado
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar la carta: {str(e)}")
