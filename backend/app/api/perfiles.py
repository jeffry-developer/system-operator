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


ENFOQUES_SALUDOS = (
    {
        "clave": "perspectiva",
        "categoria": "Nueva perspectiva y desconexión",
        "temas": (
            (
                "La ligereza de soltar las expectativas del día y dejar la mente en blanco.",
                "Hay una paz inmensa en el instante en que decides que ya no tienes que resolver nada más hasta mañana.",
                "Mirar las cosas con un poco de distancia permite que las exigencias del día se desvanezcan y que la perspectiva vuelva a sentirse liviana.",
                "¿qué haces para vaciar la cabeza de preocupaciones antes de meterte a la cama?",
            ),
            (
                "La ligereza de cruzar la línea entre la actividad y el descanso sin mirar atrás.",
                "Hay un alivio enorme en ese momento preciso en que cierras los pendientes y aceptas que por hoy ya hiciste suficiente.",
                "Cambiar de orilla por un rato ayuda a dejar el ruido donde pertenece y a recuperar una mirada mucho más fresca.",
                "¿qué te ayuda a marcar la línea final entre tus responsabilidades y tu tiempo de descanso?",
            ),
            (
                "La tranquilidad de soltar el control y dejar que el tiempo avance a su propio ritmo.",
                "Se siente muy bien dejar de planificar cada minuto y permitir que el reloj siga su camino sin exigirle nada.",
                "Tomar esa distancia de las obligaciones renueva la cabeza y hace que cualquier asunto pendiente pierda peso por unas horas.",
                "¿qué te ayuda a soltar el control cuando quieres descansar de verdad?",
            ),
        ),
    },
    {
        "clave": "bienestar",
        "categoria": "Bienestar, relax y ritmo del día",
        "temas": (
            (
                "Aflojar la mandíbula y relajar la base de la lengua para liberar tensión facial.",
                "Notar cómo la mandíbula se suelta y deja ir la rigidez acumulada produce un alivio inmediato en todo el rostro.",
                "Revisar esos puntos donde guardamos tensión sin darnos cuenta puede devolverle al cuerpo una comodidad sorprendente.",
                "¿sueles notar cuánta tensión guardas en la cara cuando el día ha sido largo?",
            ),
            (
                "Relajar la zona entre las cejas y soltar la tensión acumulada en la frente.",
                "Sentir cómo la frente se alisa y los músculos de la cara dejan de sostener el gesto del día es un alivio inmediato.",
                "Prestar atención a esas zonas pequeñas ayuda a recuperar la soltura natural y cambia por completo el ritmo del momento.",
                "¿sueles notar cuánta expresión acumulada guardas en el rostro al final de la jornada?",
            ),
            (
                "Relajar las muñecas y soltar la tensión acumulada en las manos.",
                "Abrir las manos y dejar que las muñecas pierdan la rigidez de teclear o sostener cosas se siente mejor de lo que uno imagina.",
                "Darles un respiro a esos pequeños puntos de esfuerzo devuelve una sensación agradable de soltura a todo el cuerpo.",
                "¿sueles notar cuánta tensión guardas en las manos al terminar tus tareas?",
            ),
        ),
    },
    {
        "clave": "disfrute",
        "categoria": "Actitud positiva y disfrute del presente",
        "temas": (
            (
                "El gusto por recordar una anécdota divertida o un momento que provocó una gran sonrisa.",
                "Tener la cabeza libre a estas horas para rescatar un recuerdo gracioso y volver a reírse es uno de los mejores pasatiempos.",
                "Dejar que el buen humor tome el control vuelve el momento más ligero y le quita cualquier complicación innecesaria.",
                "¿cuál es el recuerdo más divertido que te viene a la mente hoy?",
            ),
            (
                "El placer de curiosear sobre un tema fascinante o una idea extraña solo por gusto.",
                "Dejarse llevar a estas horas por una idea curiosa o un dato insólito puede ser mucho más entretenido de lo esperado.",
                "Esa curiosidad espontánea rompe la rutina y le pone una chispa muy agradable a la noche o la madrugada.",
                "¿qué tema extraño o interesante te ha dado por investigar últimamente?",
            ),
            (
                "El gusto por disfrutar un buen documental o un misterio curioso sin mirar el reloj.",
                "Meterse de lleno en una historia fascinante o en un misterio bien contado es una manera estupenda de perder la noción del tiempo.",
                "Seguir una pista por puro gusto mantiene despierta la curiosidad y convierte estas horas en un rato muy ameno.",
                "¿qué misterio o tema curioso te atrapa siempre que lo ves?",
            ),
        ),
    },
)

ENFOQUES_EXTRAS = (
    {
        "clave": "refugio",
        "nombre": "Perfil Extra 1: Mateo",
        "categoria": "Cuido, mimo y bienestar protector",
        "temas": (
            (
                "El cobijo de una almohada mullida y la certeza de estar protegido del ruido exterior.",
                "Acomodar bien la cabeza, sentir cómo el cuerpo cede al descanso y saber que nadie pedirá nada más es lo mínimo que mereces ahora.",
                "El mundo exterior puede quedarse fuera por un rato mientras te entregas a una atmósfera de refugio, suavidad y absoluta comodidad.",
                "¿qué detalle hace que tu espacio de descanso se sienta como tu lugar más seguro?",
            ),
            (
                "El calor de una cobija suave y la certeza de que el mundo exterior ya se detuvo.",
                "Acomodar el cuerpo, sentir cómo las sábanas reciben tu peso y saber que nada tiene permiso de perturbarte es lo mínimo que mereces.",
                "Esta parte de la noche puede ser un refugio privado donde las exigencias se apagan y solo queda la sensación de estar bien resguardado.",
                "¿qué textura o elemento hace que tu cama se sienta verdaderamente tuya?",
            ),
            (
                "El abrazo de una almohada fresca y la seguridad de quedar a salvo de todo ruido.",
                "Apoyar bien la cabeza, dejar que el colchón sostenga el cuerpo y saber que nadie interrumpirá este rato brinda un descanso muy merecido.",
                "Todo lo de afuera puede esperar mientras tu espacio se convierte en un pequeño refugio hecho de silencio, cobijo y dulzura.",
                "¿qué detalle convierte tu espacio de descanso en tu lugar más seguro?",
            ),
        ),
    },
    {
        "clave": "ternura",
        "nombre": "Perfil Extra 2: Liam",
        "categoria": "Cuido, mimo y bienestar protector",
        "temas": (
            (
                "Una respiración lenta, aflojar las palmas de las manos y recibir un trato tierno.",
                "Exhalar despacio, notar cómo la tensión abandona las palmas y dejarse cuidar es un regalo que hacía falta recibir hoy.",
                "Mereces que este momento esté lleno de delicadeza y apapacho, protegido de cualquier resto de prisa o cansancio.",
                "¿qué pequeño gesto de tu día te trajo más paz interior?",
            ),
            (
                "Una respiración lenta, aflojar los brazos y recibir un trato sumamente tierno.",
                "Soltar el aire, dejar que los brazos pierdan su peso y aceptar un poco de cuidado es una forma muy bonita de cerrar el ritmo del día.",
                "Toda la atención puede ponerse ahora en que respires paz y recibas la ternura que mereces, sea de noche o de madrugada.",
                "¿qué te da esa sensación inmediata de paz interior?",
            ),
            (
                "Una respiración lenta, aflojar los hombros y recibir un trato lleno de ternura.",
                "Exhalar despacio, sentir cómo los hombros dejan ir la tensión y permitirte recibir cuidado es el regalo que te debías hoy.",
                "Este rato merece estar protegido de la prisa y lleno de un trato delicado que te ayude a sentir absoluta comodidad.",
                "¿qué gesto sencillo logra que te sientas cuidado de verdad?",
            ),
        ),
    },
)

ENFOQUE_POR_NOMBRE = {
    "antonio": "perspectiva",
    "juan m": "bienestar",
    "luciano": "disfrute",
}

TEMAS_REACTIVACION = (
    ("una canción que apareció de repente", "Hoy apareció una canción que tenía olvidada y me cambió el ánimo en segundos.", "Me dio curiosidad pensar cuál será esa canción que tú nunca saltas cuando empieza a sonar.", "¿cuál pondrías ahora mismo sin pensarlo mucho?"),
    ("un olor que despertó un recuerdo", "Pasé cerca de un lugar con olor a pan recién hecho y por un momento se me olvidó todo lo demás.", "Es curioso cómo un olor sencillo puede traer una imagen completa a la cabeza y dejarte sonriendo.", "¿qué olor tiene ese efecto contigo?"),
    ("una decisión pequeña pero difícil", "Hoy tardé demasiado eligiendo algo tan simple como qué comer y terminé riéndome de mi propia indecisión.", "En medio de eso pensé que tú seguramente tendrías una respuesta más clara que la mía.", "¿qué comida eliges cuando no quieres pensarlo demasiado?"),
    ("algo gracioso visto durante el día", "Hoy vi a alguien discutir muy serio con una máquina que no aceptaba su moneda y tuve que disimular la risa.", "Esas escenas pequeñas rompen la rutina y enseguida dan ganas de contárselas a alguien.", "¿qué tontería te hizo reír últimamente?"),
    ("una foto antigua encontrada sin buscar", "Buscando otra cosa apareció una foto antigua y terminé mirándola más tiempo del que pensaba.", "Me gustó ese salto inesperado a otro momento y me acordé de preguntarte por los recuerdos que guardas.", "¿qué foto tuya siempre logra sacarte una sonrisa?"),
    ("una opinión cotidiana que divide", "Hoy salió la discusión absurda de si una película se disfruta más con comida o sin ninguna distracción.", "Defendí mi lado con demasiada seriedad y pensé que sería divertido saber de qué lado estás tú.", "¿eres de preparar algo para picar o de concentrarte por completo?"),
    ("un pequeño logro del día", "Hoy terminé una tarea que llevaba días posponiendo y sentí una satisfacción desproporcionada.", "Ese alivio me hizo pensar en esas victorias pequeñas que casi nadie celebra, aunque cambian el día.", "¿qué cosa sencilla lograste últimamente y te dejó contenta?"),
    ("una idea que apareció mientras se hacía algo rutinario", "Mientras ordenaba unas cosas se me ocurrió que las mejores conversaciones casi siempre empiezan por una tontería.", "Me acordé de ti y quise romper el silencio con algo menos automático que un simple saludo.", "¿qué pensamiento inesperado te rondó hoy por la cabeza?"),
    ("un antojo inesperado", "Hoy me dio un antojo muy específico de algo que no tenía cerca y la imaginación no ayudó nada.", "Me acordé de esas preferencias tuyas que uno descubre conversando y quise venir a preguntarte.", "¿qué antojo consigue convencerte casi siempre?"),
    ("una serie o historia que dejó una pregunta", "Una escena de una serie me dejó pensando si uno perdona más fácil una mentira o una verdad dicha demasiado tarde.", "No encontré una respuesta definitiva y pensé que tu forma de verlo podría sorprenderme.", "¿tú cuál de las dos perdonarías primero?"),
)


def _seleccionar_enfoques_saludos(nombres_perfiles: List[str]) -> List[dict]:
    """Asigna temas variados de reactivación; reserva el cuido para los extras."""
    seleccionados = []
    enfoques_por_clave = {enfoque["clave"]: enfoque for enfoque in ENFOQUES_SALUDOS}
    temas_disponibles = {
        enfoque["clave"]: random.sample(enfoque["temas"], len(enfoque["temas"]))
        for enfoque in (*ENFOQUES_SALUDOS, *ENFOQUES_EXTRAS)
    }
    usos_por_enfoque = {enfoque["clave"]: 0 for enfoque in ENFOQUES_SALUDOS}

    temas_reactivacion = random.sample(TEMAS_REACTIVACION, len(TEMAS_REACTIVACION))
    for indice, nombre in enumerate(nombres_perfiles):
        clave = ENFOQUE_POR_NOMBRE.get(nombre.strip().casefold())
        enfoque = enfoques_por_clave.get(clave) if clave else None
        if enfoque is None:
            enfoque = ENFOQUES_SALUDOS[indice % len(ENFOQUES_SALUDOS)]
        temas = temas_disponibles[enfoque["clave"]]
        uso = usos_por_enfoque[enfoque["clave"]]
        tema = temas_reactivacion[indice % len(temas_reactivacion)]
        usos_por_enfoque[enfoque["clave"]] += 1
        seleccionados.append({**enfoque, "tema": tema})

    for enfoque in ENFOQUES_EXTRAS:
        seleccionados.append({**enfoque, "tema": temas_disponibles[enfoque["clave"]][0]})

    return seleccionados


def _crear_insistencias_fallback(nombres: List[str]) -> List[dict]:
    bancos = (
        "Me quedé pensando en algo que dijiste y me dio curiosidad saber cómo terminó tu día. Cuando puedas, cuéntame qué fue lo mejor que te pasó hoy.",
        "Acabo de escuchar una canción que mejora cualquier momento y pensé en preguntarte por la tuya. ¿Cuál tienes repitiéndose últimamente?",
        "Vine a dejarte una pregunta rápida porque contigo siempre salen respuestas interesantes: si pudieras borrar una sola tarea de esta semana, ¿cuál sería?",
        "Hoy vi una escena tan absurda que me acordé de esas cosas pequeñas que uno quiere contar enseguida. ¿Qué te hizo reír de verdad estos días?",
        "Se me cruzó una duda mientras preparaba algo de comer y pensé que tú podrías resolverla: ¿eres más de repetir tu plato favorito o probar algo nuevo?",
        "No quería dejar pasar el día sin asomarme por aquí. Tengo curiosidad por saber qué te ha tenido más entretenida últimamente.",
    )
    resultados = []
    for indice, nombre in enumerate(nombres):
        inicio = (indice * 3) % len(bancos)
        textos = [bancos[(inicio + offset) % len(bancos)] for offset in range(3)]
        resultados.append({"nombre": nombre, "textos": textos})
    return resultados


def _generar_insistencias_perfiles(perfiles: List[dict]) -> List[dict]:
    nombres = [p["nombre_perfil"] for p in perfiles]
    perfiles_prompt = "\n".join(
        f"{i}. {p['nombre_perfil']} — voz: {p.get('prompt_personalidad', '')[:500]}"
        for i, p in enumerate(perfiles, start=1)
    )
    prompt = f"""Genera exactamente 3 insistencias para cada perfil de esta lista:
{perfiles_prompt}

Son mensajes para pagadoras fijas con las que se habla seguido y ya existe conexión. Cada insistencia debe ser un solo párrafo breve, cálido y natural. Retoma el contacto sin reclamar, presionar ni preguntar por qué no respondió. Usa un tema cotidiano distinto en cada texto, muestra atención real y termina con una pregunta fácil cuando encaje. Adapta suavemente la voz del perfil, pero no inventes información sobre la destinataria. Deben funcionar igual de bien de noche o de madrugada: evita referencias que solo tengan sentido antes de dormir, al despertar o en una hora concreta.

FORMATO OBLIGATORIO:
PERFIL: nombre exacto
INSISTENCIA: texto
INSISTENCIA: texto
INSISTENCIA: texto

No agregues números, introducciones ni explicaciones."""
    try:
        contenido = ai_service._llamar_proveedor(
            "Escribes mensajes de chat naturales en español latinoamericano. Evita plantillas, lenguaje de IA, frases solemnes y halagos genéricos.",
            prompt,
        ).strip()
        bloques = re.split(r"(?im)^PERFIL:\s*", contenido)[1:]
        resultados = []
        for bloque in bloques:
            lineas = [linea.strip() for linea in bloque.splitlines() if linea.strip()]
            if not lineas:
                continue
            nombre = lineas[0]
            textos = [re.sub(r"(?i)^INSISTENCIA:\s*", "", linea) for linea in lineas[1:] if re.match(r"(?i)^INSISTENCIA:", linea)]
            if len(textos) == 3:
                resultados.append({"nombre": nombre, "textos": textos})
        if len(resultados) == len(nombres):
            return resultados
    except Exception:
        pass
    return _crear_insistencias_fallback(nombres)


def _extraer_bloques_saludos(contenido: str) -> List[str]:
    patron_bloque = re.compile(r"(?:^|\n\n)(?=\d+\.\s+)", re.MULTILINE)
    return [bloque.strip() for bloque in patron_bloque.split(contenido) if bloque.strip()]


def _validar_saludos_generados(
    contenido: str,
    nombres: List[str],
    enfoques: List[dict],
) -> List[str]:
    """Comprueba el patrón: encabezado, tres párrafos y pregunta final."""
    errores = []
    bloques = _extraer_bloques_saludos(contenido)

    if len(bloques) != len(nombres):
        errores.append(f"se generaron {len(bloques)} saludos y se esperaban {len(nombres)}")
        return errores

    aperturas = set()
    for indice, (bloque, nombre, enfoque) in enumerate(zip(bloques, nombres, enfoques), start=1):
        lineas = bloque.splitlines()
        titulo = lineas[0].strip() if lineas else ""
        titulo_esperado = f"{indice}. {nombre} ({enfoque['categoria']})"
        if titulo.casefold() != titulo_esperado.casefold():
            errores.append(f"el saludo {indice} no usó el encabezado exacto requerido")

        cuerpo = "\n".join(lineas[1:]).strip()
        parrafos = [p.strip() for p in re.split(r"\n\s*\n+", cuerpo) if p.strip()]
        if len(parrafos) != 3:
            errores.append(f"el saludo {indice} no tiene exactamente 3 párrafos")
            continue
        if any(len(parrafo.split()) < 14 for parrafo in parrafos):
            errores.append(f"el saludo {indice} tiene un párrafo demasiado breve")
        if "?" not in parrafos[-1]:
            errores.append(f"el saludo {indice} no termina con una pregunta natural")

        apertura = " ".join(parrafos[0].casefold().split()[:8])
        if apertura in aperturas:
            errores.append(f"el saludo {indice} repite el mismo comienzo de otro saludo")
        aperturas.add(apertura)

    return errores


def _crear_saludos_fallback(nombres: List[str], enfoques: List[dict]) -> str:
    """Crea localmente saludos con el mismo patrón humano de los ejemplos."""
    enlaces = {
        "perspectiva": "Quise pasar a saludarte en este rato de tranquilidad para cambiar de aire y dejarte una pausa agradable.",
        "bienestar": "Qué buen momento para asomarme a saludarte y desearte una sensación de total serenidad.",
        "disfrute": "Me asomo con la mejor actitud para dejarte un saludo cargado de buena energía.",
        "refugio": "Quise dar una vuelta por aquí para estar al pendiente de ti y arroparte con mucha calma.",
        "ternura": "Me paso por aquí para acompañarte y cuidar que estés sumamente cómodo en este momento.",
    }
    puentes = {
        "perspectiva": "Esa distancia ayuda a renovar la perspectiva por completo, ya sea cerrando la jornada o transitando la madrugada.",
        "bienestar": "Cuidar el bienestar a este nivel renueva la energía, sin importar si es de noche o madrugada.",
        "disfrute": "La idea es disfrutar el presente de una forma amena, espontánea y sin complicaciones.",
        "refugio": "Ese cobijo viene bien tanto para cerrar la jornada como para atravesar despierto la madrugada.",
        "ternura": "Un trato así de delicado viene bien al cerrar el día o en lo profundo de la madrugada.",
    }
    deseos = {
        "perspectiva": "Ojalá estés disfrutando de un rincón sumamente apacible por allá.",
        "bienestar": "Espero que estés experimentando una comodidad muy agradable en este instante.",
        "disfrute": "Ojalá estés pasando un rato ligero y con una sonrisa cerca.",
        "refugio": "Deseo de corazón que estés sumergido en un confort total.",
        "ternura": "Ojalá estés sintiendo una serenidad muy bonita en este instante.",
    }
    bloques = []
    for indice, (nombre, enfoque) in enumerate(zip(nombres, enfoques), start=1):
        _, entrada, desarrollo, pregunta = enfoque["tema"]
        clave = enfoque["clave"]
        bloques.append(
            f"{indice}. {nombre} ({enfoque['categoria']})\n\n"
            f"{entrada} {enlaces[clave]}\n\n"
            f"{desarrollo} {puentes[clave]}\n\n"
            f"{deseos[clave]} Si sigues despierto y te apetece conversar, cuéntame: {pregunta}"
        )

    return "\n\n".join(bloques)


def _generar_saludos_validados(
    system_prompt: str,
    prompt: str,
    nombres: List[str],
    enfoques: List[dict],
) -> str:
    """Usa IA cuando cumple; en cualquier otro caso entrega el fallback local."""
    try:
        contenido = ai_service._llamar_proveedor(system_prompt, prompt).strip()
        contenido = contenido.replace("```text", "").replace("```", "").strip()
        errores = _validar_saludos_generados(contenido, nombres, enfoques)
        if not errores:
            return contenido
    except Exception:
        pass

    return _crear_saludos_fallback(nombres, enfoques)


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
            timeout=180.0
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
    """Genera refrescamientos variados e insistencias para cada perfil."""
    perfiles = supabase_service.get_perfiles_by_usuario(current_user)
    if not perfiles:
        raise HTTPException(status_code=400, detail="Crea al menos un perfil para generar los saludos.")

    n = len(perfiles)
    nombres_perfiles = [p["nombre_perfil"] for p in perfiles]
    enfoques_asignados = _seleccionar_enfoques_saludos(nombres_perfiles)
    nombres_salida = nombres_perfiles + [enfoque["nombre"] for enfoque in ENFOQUES_EXTRAS]
    asignaciones = "\n".join(
        f"{i}. {nombre} — ÁNGULO: {enfoque['categoria']} — TEMA: {enfoque['tema'][0]}"
        for i, (nombre, enfoque) in enumerate(zip(nombres_salida, enfoques_asignados), start=1)
    )
    encabezados_requeridos = "\n".join(
        f"{i}. {nombre} ({enfoque['categoria']})"
        for i, (nombre, enfoque) in enumerate(zip(nombres_salida, enfoques_asignados), start=1)
    )
    
    system_prompt = """Eres un redactor experto en mensajes de reactivación cercanos y humanos para chat.
Escribe en español latinoamericano natural. El resultado debe sentirse escrito por una persona atenta, no por una IA.
Respeta literalmente los encabezados y temas dados. No uses datos biográficos, personalidad ni categoría de feed de los perfiles.
No expliques tu proceso, no agregues introducciones y no uses bloques de código."""
    
    prompt = f"""Genera un DOCUMENTO COMPLETO Y UNIFICADO con exactamente {n + 2} mensajes: un refrescamiento para cada perfil registrado y dos perfiles extras de cuido al final.

Los refrescamientos se envían a pagadoras con las que se habla de vez en cuando para reactivar la conversación. No son saludos para desconocidas ni mensajes genéricos de buenas noches.
Todos deben poder enviarse indistintamente de noche o de madrugada. No supongas que ella va a dormir, acaba de despertar o está realizando una actividad propia de una hora específica.

PERFILES Y TEMA DIFERENTE ASIGNADO A CADA SALUDO:
{asignaciones}

PATRÓN HUMANO OBLIGATORIO:
1. Cada perfil conserva el ÁNGULO asignado y desarrolla solamente su TEMA puntual. No uses la personalidad, gustos, edad, profesión, ubicación ni ningún otro dato del perfil.
2. Párrafo 1: abre contando una microanécdota cotidiana plausible: algo que viste, escuchaste, pensaste, cocinaste, elegiste o que te causó gracia. Enlázala con "me acordé de ti" o con el deseo de saber cómo está ella, pero varía esa fórmula.
3. Párrafo 2: añade tu reacción u opinión de forma espontánea y muestra interés por cómo lo vive o piensa ella. Escribe como alguien que ya ha conversado con esa persona de vez en cuando.
4. Párrafo 3: acércate con calidez y termina con UNA pregunta fácil y directamente relacionada con el tema, que dé ganas de contar algo propio.
5. No centres todos los mensajes en descanso, noche, bienestar o autocuidado. Varía entre humor cotidiano, música, comida, recuerdos, decisiones pequeñas, películas, curiosidades, logros, manías y situaciones del día.
6. Usa palabras comunes, imágenes sensoriales sencillas y un tono afectuoso. Evita lenguaje publicitario, moralejas, frases motivacionales, explicaciones abstractas y preguntas de entrevista.
7. Varía los comienzos y las preguntas. No copies una misma frase entre saludos. Los perfiles extra sí deben expresar cuido, mimo, refugio, ternura y bienestar protector.

FORMATO EXACTO DE CADA SALUDO:
- Encabezado literal indicado abajo.
- Una línea en blanco.
- Exactamente 3 párrafos, separados por una línea en blanco.
- El tema asignado es solo una guía interna: NO escribas "Tema de hoy", el tema ni ninguna otra etiqueta antes de los párrafos.
- No escribas listas, viñetas ni explicaciones.

ENCABEZADOS LITERALES Y OBLIGATORIOS:
{encabezados_requeridos}

Antes de responder, verifica que estén los {n + 2} saludos completos, que debajo de cada encabezado haya únicamente tres párrafos y que cada cierre contenga una pregunta. Genera TODOS respetando la estructura exacta."""

    try:
        try:
            contenido = await asyncio.wait_for(
                asyncio.to_thread(
                    _generar_saludos_validados,
                    system_prompt,
                    prompt,
                    nombres_salida,
                    enfoques_asignados,
                ),
                timeout=90.0,
            )
        except asyncio.TimeoutError:
            contenido = _crear_saludos_fallback(nombres_salida, enfoques_asignados)

        try:
            insistencias = await asyncio.wait_for(
                asyncio.to_thread(_generar_insistencias_perfiles, perfiles),
                timeout=90.0,
            )
        except asyncio.TimeoutError:
            insistencias = _crear_insistencias_fallback(nombres_perfiles)

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
            "saludos": saludos_individuales,
            "insistencias": insistencias,
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
            timeout=180.0
        )
        
        # Guardar en base de datos
        supabase_service_admin.save_mensajes(mensajes, perfil_id)
        
        # Formatear respuesta como documento único
        nombre_perfil = perfil["nombre_perfil"]
        plan_completo = f"""PLAN DE TRABAJO

1. 4 ROMPEHIELOS

{mensajes.get("icebreaker", "")}

2. 1 CARTA DE IB

{mensajes.get("carta_rompehielos", "")}

3. 2 CARTAS DE BARRIDO

{mensajes.get("carta_barrido", "")}

4. 2 MENSAJES DE INSISTENCIA

{mensajes.get("insistencia", "")}

5. 1 SALUDO

{mensajes.get("saludo_plan_trabajo", "")}

✅ RESUMEN PLAN DE TRABAJO

4 Rompehielos
1 Carta de IB
2 Cartas de barrido
2 Mensajes de insistencia
1 Saludo"""
        
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
            TipoMensaje.POSTS,
            TipoMensaje.RESPUESTAS_RAPIDAS,
            TipoMensaje.SALUDO_NEW_FEED,
            TipoMensaje.INSISTENCIA_NEW_FEED,
        ]
        
        mensajes = await asyncio.wait_for(
            asyncio.to_thread(ai_service.generar_mensajes, perfil["prompt_personalidad"], tipos_feed, ultimos),
            timeout=180.0
        )
        
        # Guardar en base de datos
        supabase_service_admin.save_mensajes(mensajes, perfil_id)
        
        # Formatear respuesta como documento único
        feed_completo = f"""NEW FEED

1. 3 FOTOS PARA EL FEED

{mensajes.get("posts", "")}

4. RESPUESTAS RÁPIDAS (3)

{mensajes.get("respuestas_rapidas", "")}

5. SALUDO (1)

{mensajes.get("saludo_new_feed", "")}

6. INSISTENCIAS (2)

{mensajes.get("insistencia_new_feed", "")}

✅ RESUMEN DEL NEW FEED

3 fotos
✍️ 3 pies de foto con pregunta
3 respuestas rápidas
1 saludo
2 insistencias"""
        
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
