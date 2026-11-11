from google import genai
from google.genai import types as genai_types
from groq import Groq
from app.core.config import settings
from app.models.schemas import TipoMensaje
from typing import Dict, List
import re


TERMINOS_PROHIBIDOS = (
    ("compañía", re.compile(r"\bcompa(?:ñ|n)(?:ía|ia|ías|ias|ero|era|eros|eras)\b", re.IGNORECASE)),
    ("compartir", re.compile(r"\bcompart\w*\b", re.IGNORECASE)),
    ("juntos", re.compile(r"\bjunt[oa]s?\b", re.IGNORECASE)),
    ("conocerse", re.compile(r"\bconoc\w*\b", re.IGNORECASE)),
    ("verse", re.compile(r"\b(?:vernos|verme|verte|verse|verlos|verlas)\b", re.IGNORECASE)),
    ("encuentros", re.compile(r"\b(?:encontrarnos|encontrarme|encontrarte|encontrarse|encuentro|encuentros)\b", re.IGNORECASE)),
    ("citas", re.compile(r"\bcitas?\b", re.IGNORECASE)),
    ("quedadas", re.compile(r"\b(?:quedar|quedarnos|quedada|quedadas)\b", re.IGNORECASE)),
    ("viajes", re.compile(r"\bviaj\w*\b", re.IGNORECASE)),
    ("desplazarse", re.compile(r"\bdesplaz\w*\b", re.IGNORECASE)),
    ("en persona", re.compile(r"\ben\s+persona\b", re.IGNORECASE)),
    ("presencial", re.compile(r"\bpresencial(?:es)?\b", re.IGNORECASE)),
    ("con calma", re.compile(r"\bcon\s+calma\b", re.IGNORECASE)),
    ("frontera", re.compile(r"\bfronteras?\b", re.IGNORECASE)),
    ("la magia de", re.compile(r"\bla\s+magia\s+de\b", re.IGNORECASE)),
    ("en un mundo donde", re.compile(r"\ben\s+un\s+mundo\s+donde\b", re.IGNORECASE)),
    ("la vida nos enseña", re.compile(r"\bla\s+vida\s+nos\s+ense(?:ña|na)\b", re.IGNORECASE)),
    ("conexión genuina", re.compile(r"\bconexi(?:ó|o)n\s+genuina\b", re.IGNORECASE)),
    ("me hizo reflexionar", re.compile(r"\bme\s+hizo\s+reflexionar\b", re.IGNORECASE)),
    (
        "alguna vez te has preguntado",
        re.compile(r"\balguna\s+vez\s+te\s+has\s+preguntado\b", re.IGNORECASE),
    ),
    ("qué opinas al respecto", re.compile(r"\bqu(?:é|e)\s+opinas\s+al\s+respecto\b", re.IGNORECASE)),
)


class AIService:
    def __init__(self):
        self.provider = settings.AI_PROVIDER.lower()

        if self.provider == "gemini" and settings.GEMINI_API_KEY:
            self.gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
            self.gemini_model_name = "gemini-3.8-flash"
        elif self.provider == "groq" and settings.GROQ_API_KEY:
            self.groq_client = Groq(api_key=settings.GROQ_API_KEY)
        else:
            raise ValueError(f"No API key configured for provider: {self.provider}")

    def generar_mensajes(self, prompt_personalidad: str, tipos: List[TipoMensaje], ultimos_mensajes: Dict[str, str] = None) -> Dict[str, str]:
        """Genera mensajes basados en el prompt de personalidad del perfil"""

        system_prompt = self._construir_system_prompt(prompt_personalidad)

        mensajes = {}
        for tipo in tipos:
            prompt = self._construir_prompt_tipo(tipo, prompt_personalidad)
            
            # Añadir historial previo para evitar repetición
            if ultimos_mensajes and tipo.value in ultimos_mensajes:
                anterior = ultimos_mensajes[tipo.value][:500]  # máx 500 chars del anterior
                prompt = f"IMPORTANTE: El siguiente contenido fue generado anteriormente. NO lo repitas ni uses las mismas frases o ideas:\n---\n{anterior}\n---\n\n{prompt}"
            
            contenido = self._llamar_ia(system_prompt, prompt)
            if tipo in {
                TipoMensaje.SALUDO,
                TipoMensaje.ICEBREAKER,
                TipoMensaje.CARTA_BARRIDO,
                TipoMensaje.INSISTENCIA,
                TipoMensaje.CARTA_ROMPEHIELOS,
                TipoMensaje.RESPUESTAS_RAPIDAS,
                TipoMensaje.POSTS,
                TipoMensaje.SALUDO_PLAN_TRABAJO,
                TipoMensaje.SALUDO_NEW_FEED,
                TipoMensaje.INSISTENCIA_NEW_FEED,
            }:
                contenido = self._quitar_numeros_y_vinetas(contenido)
            mensajes[tipo.value] = self._sanitizar_texto(contenido.strip())

        return mensajes

    @staticmethod
    def _quitar_numeros_y_vinetas(contenido: str) -> str:
        """Elimina prefijos de lista que el proveedor haya agregado por error."""
        lineas = contenido.replace("\r\n", "\n").replace("\r", "\n").split("\n")
        limpias = [
            re.sub(r"^\s*(?:(?:\d{1,2}\s*[.)-])|[-*•])\s+", "", linea)
            for linea in lineas
        ]
        return "\n".join(limpias)

    def generar_carta_extensa(self, contexto: str, tipo: str, num_parrafos: int) -> str:
        """Genera una sola carta con una cantidad exacta de párrafos sin numeración."""
        min_palabras_por_parrafo = 45 if tipo == "sexual" else 35
        estilo = (
            "explícita, táctil, ardiente, erótica, intensa y directa"
            if tipo == "sexual"
            else "seductora, profunda, apasionada, íntima, poética y magnética"
        )
        system_prompt = self._construir_system_prompt(contexto)
        prompt = f"""Escribe UNA SOLA carta de tipo '{tipo}'.

REQUISITOS DE SALIDA OBLIGATORIOS:
- Escribe EXACTAMENTE {num_parrafos} párrafos completos, sustanciosos y conectados entre sí.
- Cada párrafo debe tener COMO MÍNIMO {min_palabras_por_parrafo} palabras y desarrollar entre 3 y 5 oraciones. No escribas párrafos breves de una sola línea.
- Separa cada párrafo únicamente con una línea en blanco.
- Devuelve solamente el cuerpo de la carta.
- NO numeres los párrafos y NO uses títulos, encabezados, listas, viñetas, etiquetas ni separadores.
- NO escribas expresiones como "Párrafo 1", "Carta 1" o similares.
- Mantén un único hilo narrativo de principio a fin.
- El estilo debe ser {estilo}.
- No uses placeholders como [nombre].

Antes de responder, cuenta internamente los párrafos y confirma que sean exactamente {num_parrafos}. No muestres esa cuenta."""

        contenido = self._llamar_ia(system_prompt, prompt)
        parrafos = self._extraer_parrafos_carta(contenido)
        parrafos_cortos = [
            parrafo for parrafo in parrafos
            if len(parrafo.split()) < min_palabras_por_parrafo
        ]

        if len(parrafos) != num_parrafos or parrafos_cortos:
            borrador = "\n\n".join(parrafos)
            correccion = f"""Reescribe el siguiente borrador como UNA SOLA carta con EXACTAMENTE {num_parrafos} párrafos.

Cada párrafo debe contener COMO MÍNIMO {min_palabras_por_parrafo} palabras, desarrollar entre 3 y 5 oraciones y estar separado por una línea en blanco. Amplía cualquier párrafo corto con sensaciones, contexto y continuidad; no uses frases de relleno. Devuelve únicamente el cuerpo final, sin números, títulos, viñetas, etiquetas, conteos ni separadores. Conserva el tono {estilo} y el hilo narrativo.

BORRADOR:
{borrador}"""
            contenido = self._llamar_ia(system_prompt, correccion)
            parrafos = self._extraer_parrafos_carta(contenido)
            parrafos_cortos = [
                parrafo for parrafo in parrafos
                if len(parrafo.split()) < min_palabras_por_parrafo
            ]

        if len(parrafos) != num_parrafos or parrafos_cortos:
            problemas = []
            if len(parrafos) != num_parrafos:
                problemas.append(f"generó {len(parrafos)} párrafos en lugar de {num_parrafos}")
            if parrafos_cortos:
                problemas.append(
                    f"{len(parrafos_cortos)} párrafos quedaron por debajo de {min_palabras_por_parrafo} palabras"
                )
            raise ValueError(
                f"La IA no cumplió el formato requerido: {'; '.join(problemas)}. Intenta generar la carta nuevamente."
            )

        return "\n\n".join(parrafos)

    def _extraer_parrafos_carta(self, texto: str) -> List[str]:
        if not texto:
            return []

        limpio = texto.replace("```text", "").replace("```", "").strip()
        bloques = re.split(r"\n\s*\n+", limpio)

        if len(bloques) == 1:
            bloques_numerados = re.split(
                r"(?m)^\s*(?:p[áa]rrafo\s*)?(?:#\s*)?\d{1,3}\s*[.):-]\s*",
                limpio,
            )
            bloques_numerados = [bloque for bloque in bloques_numerados if bloque.strip()]
            if len(bloques_numerados) > 1:
                bloques = bloques_numerados

        parrafos = []
        for bloque in bloques:
            bloque = re.sub(
                r"^\s*carta\s+(?:rom[áa]ntica|sexual|sensual)\s*:?\s*",
                "",
                bloque.strip(),
                flags=re.IGNORECASE,
            )
            parrafo = re.sub(
                r"^\s*(?:(?:p[áa]rrafo|carta)\s*)?(?:#\s*)?\d{1,3}\s*[.):-]\s*",
                "",
                bloque,
                flags=re.IGNORECASE,
            )
            parrafo = re.sub(r"^\s*[-*•]\s+", "", parrafo)
            parrafo = " ".join(linea.strip() for linea in parrafo.splitlines() if linea.strip())
            if parrafo and not re.fullmatch(r"carta\s+(?:rom[áa]ntica|sexual|sensual)", parrafo, re.IGNORECASE):
                parrafos.append(parrafo)

        return parrafos

    def _sanitizar_texto(self, texto: str) -> str:
        if not texto:
            return ""
        import re
        
        # 1. Reemplazar frases prohibidas estrictamente
        res = texto
        res = re.sub(r'(?i)\bsin\s+prisas?\b', 'con tranquilidad', res)
        res = re.sub(r'(?i)\ba\s*veces\b', 'de vez en cuando', res)
        res = re.sub(r'(?i)\bpoco\s+a\s+poco\b', 'a su tiempo', res)
        
        # 2. Limpiar formatos "Etiqueta: texto" típicos de IA
        lineas = res.split('\n')
        lineas_limpias = []
        patron_etiqueta = re.compile(
            r'^(?:Tema(?:\s+de\s+hoy)?|Reflexi[oó]n|Pregunta|Texto|Mensaje|Idea|Consejo|Contexto|Nota|Etiqueta|T[ií]tulo|Respuesta|Opci[oó]n|Icebreaker|Post\s*\d*)\s*:\s*',
            re.IGNORECASE
        )
        for linea in lineas:
            # Si una línea empieza con numeración/emoji y luego etiqueta (ej: "1. 🤝 Pregunta: ...")
            linea_sub = re.sub(
                r'^(\d+\.\s*(?:[^\w\s]\s*)?)(?:Tema(?:\s+de\s+hoy)?|Reflexi[oó]n|Pregunta|Texto|Mensaje|Idea|Consejo|Contexto|Nota|Etiqueta|T[ií]tulo|Respuesta|Opci[oó]n|Icebreaker)\s*:\s*',
                r'\1',
                linea,
                flags=re.IGNORECASE
            )
            # Limpiar etiqueta al inicio de la línea
            linea_sub = patron_etiqueta.sub('', linea_sub)
            lineas_limpias.append(linea_sub)
            
        res = '\n'.join(lineas_limpias)
        # Doble verificación final
        res = re.sub(r'(?i)\bsin\s+prisas?\b', 'con tranquilidad', res)
        return res

    def _construir_system_prompt(self, prompt_personalidad: str) -> str:
        return f"""Escribes mensajes de texto en primera persona para perfiles de citas/redes sociales.

VOZ DEL PERFIL (es la referencia principal para que el resultado parezca escrito por esta persona):
{prompt_personalidad}

REGLAS GENERALES Y ESTRICTAS (OBLIGATORIAS):
- Escribe desde la voz del perfil, no desde la voz de un asistente. Imita su nivel de formalidad, ritmo, vocabulario, humor, dulzura o picardía sin decir que estás imitando nada.
- El resultado debe poder enviarse tal como está. No expliques el mensaje, no introduzcas el tema y no agregues comentarios sobre cómo fue escrito.
- LENGUAJE MUY SENCILLO: usa palabras comunes, frases cortas y mensajes fáciles de entender a la primera. Debe entenderlos cualquier mujer adulta, sin importar su edad o nivel de estudios.
- Escribe como en un chat real: una idea concreta, una reacción u opinión personal y una pregunta que nazca de lo anterior. No redactes ensayos, reflexiones solemnes ni frases motivacionales.
- Evita palabras rebuscadas, lenguaje técnico, metáforas difíciles y frases demasiado poéticas o abstractas.
- PROHIBIDO usar fórmulas típicas y vacías como "la magia de", "en un mundo donde", "la vida nos enseña", "los pequeños detalles marcan la diferencia", "conexión genuina", "me hizo reflexionar", "¿alguna vez te has preguntado...?" o "¿qué opinas al respecto?".
- No encadenes varias frases con la misma estructura, no hagas enumeraciones de adjetivos y no cierres todos los mensajes con la misma clase de pregunta.
- NUNCA propongas ni insinúes encuentros reales, verse, conocerse en persona, salir, viajar, quedar o hacer planes presenciales.
- PROHIBIDO usar cualquier forma de estas palabras o ideas: "compañía", "compañero", "compañera", "compartir", "juntos", "juntas", "conocer", "conocerte", "conocerse", "verse", "vernos", "verme", "verte", "encontrarse", "encontrarnos", "viajar", "viaje", "desplazarse", "quedar", "quedada", "cita", "salir juntos", "en persona" y "presencial".
- Tampoco uses estas frases: "a veces", "aveces", "sin prisa", "sin prisas", "poco a poco", "con calma" y "frontera".
- REEMPLAZA OBLIGATORIAMENTE "a veces" por "de vez en cuando" en cualquier contexto.
- NO uses placeholders como [nombre], [Nombre], {{nombre}} o similares. Genera el contenido directo.
- No inventes anécdotas, datos biográficos ni experiencias que no estén en la voz del perfil. Puedes expresar gustos u opiniones cotidianas sin presentarlos como hechos biográficos.
- El mensaje debe poder enviarse a una destinataria nueva sin asumir confianza previa, recuerdos en común ni información que ella no haya contado.
- FORMATO PROHIBIDO: NUNCA uses el formato "Etiqueta: texto" o "Concepto: descripcion" o "Titulo: contenido". Escribe el contenido de forma directa y natural, como un mensaje real de chat. INCORRECTO: "Saludo: Hola, ¿como estas?". CORRECTO: "Hola, ¿como estas?".
- Sé natural, auténtico y conversacional. Cada texto debe sonar espontáneo, específico y humano, no perfecto ni publicitario.
- Evita frases genéricas, respuestas de manual y estructuras de listas con etiquetas.
- Sin emojis excesivos (maximo 1-2 si encajan naturalmente).
- En espanol neutro/latinoamericano.
- VARIEDAD: Cada vez que generes contenido, hazlo diferente a lo anterior. Si recibes instrucciones sobre contenido previo a evitar, respétalas."""

    def _construir_prompt_tipo(self, tipo: TipoMensaje, prompt_personalidad: str) -> str:
        import random
        # Temas universales rotativos para variar cada generación
        temas_saludo = ["tranquilidad nocturna y desconexión", "pequeños placeres del día a día", "reflexión y paz mental", "bienestar y autocuidado simple", "un detalle cotidiano agradable", "desconectar del ruido", "gratitud por lo simple", "momentos tranquilos"]
        temas_icebreaker = ["una costumbre curiosa", "una opinión impopular pero ligera", "música que cambia el ánimo", "comida que siempre provoca", "planes improvisados desde casa", "una habilidad que gustaría aprender", "algo gracioso del día a día", "una elección difícil pero divertida"]
        temas_barrido = ["preparar algo rico para uno mismo", "cuidarse con un baño o rutina nocturna", "leer o escuchar música tranquila", "pasear sin rumbo fijo", "cocinar lento y disfrutar el proceso", "ordenar un rincón y sentir paz", "escribir o reflexionar al final del día", "disfrutar un café o té con tranquilidad"]
        temas_insistencia = ["un recuerdo bonito que apareció hoy", "una canción que te hizo sonreír", "un pensamiento al despertar", "algo pequeño que te alegró el día", "una frase que leíste y resonó", "el olor a lluvia o café por la mañana", "ver un atardecer o amanecer", "reírte de algo tonto"]
        temas_rapidas = ["una canción imposible de sacar de la cabeza", "una comida que defendería sin pensarlo", "una película o serie que sorprendió", "una manía cotidiana graciosa", "una elección divertida entre dos opciones", "algo sencillo que mejora un día pesado", "un talento inútil pero entretenido", "una opinión ligera que da para conversar"]
        temas_posts = ["algo cotidiano que causó gracia", "una opinión personal ligera", "un gusto sencillo del día", "una pregunta espontánea", "un momento tranquilo contado sin moraleja", "música o entretenimiento", "una pequeña manía cotidiana", "una idea breve que provoca conversación"]
        
        tema_saludo = random.choice(temas_saludo)
        temas_icebreaker_elegidos = random.sample(temas_icebreaker, 4)
        tema_barrido = random.choice(temas_barrido)
        tema_insistencia = random.choice(temas_insistencia)
        temas_rapidas_elegidos = random.sample(temas_rapidas, 3)
        temas_posts_elegidos = random.sample(temas_posts, 3)
        
        prompts = {
            TipoMensaje.SALUDO: f"Genera UN SOLO saludo directo y natural (NO 4, solo 1) para SALUDOS GENERALES. ESTRUCTURA:\n\n¡Hola! [Párrafo 1: escena/contexto casual universal - ej: 'Me daba una vuelta por aquí para saludarte en este rato de tranquilidad...']\n\n[Párrafo 2: reflexión universal sobre {tema_saludo} que cualquiera pueda relacionar]\n\n[Párrafo 3: cierre cálido + pregunta abierta universal tipo '¿qué tal te trata la noche?' o '¿cómo va todo por ahí?']\n\nREGLAS: Solo UN saludo. 3 párrafos coherentes. NO uses etiquetas como 'Tema:', 'Saludo:', ni números. NO pongas el nombre del perfil en el cuerpo. CONTENIDO 100% GENERAL. Estilo: cercano, conversacional. Usa 'de vez en cuando' NO 'a veces'.",

            TipoMensaje.CARTA_ROMANTICA: """Genera una serie de MINIMO 6 cartas romanticcas o sensuales cortas (de exactamente 2 parrafos cada una), numeradas del 1 al 6+. Cada carta debe ser diferente en tema y tono: algunas mas romanticcas y tiernas, otras mas sensuales e insinuantes (sin ser explicitas). Deben generar deseo, intriga y ganas de responder. Formato: cada carta separada por '---'. Ejemplo de estructura:
1. [carta romantica, 2 parrafos]
---
2. [carta sensual, 2 parrafos]
---... y asi hasta al menos 6.""",

            TipoMensaje.DINAMICA_JUEGO: """Genera 2-3 ideas de 'Dinamicas o Juegos' personalizados para enviarle a UNA CLIENTA ESPECIFICA (pagadora) con el objetivo de engancharla emocionalmente y motivarla a: (1) responder activamente, (2) enviarte regalos o propinas, o (3) pagar por posts privados de imagenes o contenido exclusivo. Cada dinamica debe sentirse como un juego divertido o un reto intimo entre los dos. Numeradas y separadas por '---'. Adaptadas al perfil.""",
        }
        # Plan de Trabajo y Publicaciones usan párrafos independientes, sin
        # numeración ni viñetas, para que cada mensaje pueda copiarse por separado.
        prompts.update({
            TipoMensaje.ICEBREAKER: f"""Escribe EXACTAMENTE 4 rompehielos independientes con la voz del perfil. Son mensajes listos para iniciar conversación con una mujer nueva, no respuestas a una charla anterior.

Usa un tema diferente en cada uno, en este orden: {', '.join(temas_icebreaker_elegidos)}.

Cada mensaje debe tener entre 18 y 45 palabras, comenzar con una observación, elección u opinión espontánea y terminar con una pregunta fácil y atractiva. La pregunta debe permitir que ella cuente algo propio; no debe parecer una encuesta ni una entrevista. Haz que los cuatro tengan aperturas, ritmos y cierres distintos.

NO empieces con “hola, ¿cómo estás?”, “cuéntame de ti” ni “¿alguna vez te has preguntado...?”. NO escribas reflexiones profundas, moralejas, halagos sobre su físico ni datos enciclopédicos. No uses emojis obligatorios, números, viñetas, títulos, etiquetas, detalles inventados ni placeholders. Separa los mensajes con una línea en blanco y devuelve solamente los 4 párrafos.""",
            TipoMensaje.CARTA_ROMPEHIELOS: "Genera UNA SOLA carta de rompehielos para el PLAN DE TRABAJO. Escribe de 2 a 3 párrafos separados por una línea en blanco sobre recibir cariño, sentirse importante y saber que alguien piensa en ti. Termina con una pregunta. El contenido debe ser universal. NO uses números, viñetas, títulos, etiquetas ni placeholders. Devuelve solamente los párrafos.",
            TipoMensaje.CARTA_BARRIDO: f"Genera EXACTAMENTE 2 cartas de barrido cortas para el PLAN DE TRABAJO, cada una como un párrafo independiente y separadas por una línea en blanco. Ambas continúan el tema {tema_barrido}: la primera cuenta la actividad y la segunda la sensación que dejó. Ambas terminan con una pregunta fácil. NO uses números, viñetas, títulos, etiquetas, detalles personales ni placeholders. Devuelve solamente los 2 párrafos.",
            TipoMensaje.INSISTENCIA: f"Genera EXACTAMENTE 2 mensajes de insistencia para el PLAN DE TRABAJO, cada uno como un párrafo independiente y separados por una línea en blanco. Continúan el mismo tema: {tema_insistencia}. No reclames por la falta de respuesta y termina cada párrafo con una pregunta sencilla. NO uses números, viñetas, títulos, etiquetas, detalles personales ni placeholders. Devuelve solamente los 2 párrafos.",
            TipoMensaje.RESPUESTAS_RAPIDAS: f"""Escribe EXACTAMENTE 3 respuestas rápidas independientes para iniciar una interacción con una mujer nueva. En realidad son mensajes de apertura listos para enviar: no respondas a una publicación, no continúes una conversación previa y no asumas que ya existe confianza.

Usa un gancho diferente en cada mensaje, en este orden: {', '.join(temas_rapidas_elegidos)}.

Cada mensaje debe tener entre 20 y 45 palabras. Abre con una opinión, elección o comentario concreto que despierte curiosidad y enlázalo con UNA pregunta original, sencilla y fácil de responder. Debe sentirse como algo que la persona del perfil realmente escribiría, no como una frase preparada para ligar. Los tres mensajes deben funcionar por separado y tener estructuras diferentes.

NO uses saludos vacíos como “hola, ¿cómo estás?”, halagos genéricos, datos enciclopédicos, acertijos, reflexiones profundas, frases motivacionales ni preguntas de entrevista. NO uses números, viñetas, títulos, etiquetas, emojis obligatorios, referencias personales inventadas ni placeholders. Separa los mensajes con una línea en blanco y devuelve solamente los 3 párrafos.""",
            TipoMensaje.POSTS: f"""Genera EXACTAMENTE 3 publicaciones con la voz real del perfil. Cada publicación debe abordar, en este orden, un ángulo distinto: {', '.join(temas_posts_elegidos)}.

El texto de cada publicación debe tener entre 2 y 4 frases cortas en primera persona. Debe sonar como un pensamiento espontáneo que esta persona decidió publicar, con una opinión o detalle concreto y sin moraleja. No redactes citas inspiradoras, consejos, discursos ni reflexiones genéricas. Varía la forma de empezar y no termines obligatoriamente las tres con una pregunta.

Después del párrafo de cada publicación escribe exactamente la etiqueta PROMPT PARA CHATGPT: y, en la línea siguiente, un prompt completo para crear una imagen vertical 4:5 relacionada con esa publicación. Cada prompt debe estar redactado completamente en español neutro; no uses palabras ni instrucciones en inglés. El prompt no debe pedir palabras, letras, logos ni marcas de agua dentro de la imagen. Si aparecen personas, deben ser adultas.

Separa cada conjunto de publicación y prompt con una línea que contenga solamente ---. NO agregues imágenes sugeridas, recomendaciones de imágenes, enlaces, números, viñetas, títulos de publicación ni otras etiquetas. No uses placeholders. Devuelve solamente los tres conjuntos.""",
            TipoMensaje.SALUDO_PLAN_TRABAJO: "Genera UN SOLO saludo cálido y directo para el PLAN DE TRABAJO. Debe expresar que has pensado en esa persona y preguntar cómo ha estado o qué cosa interesante le ha ocurrido. Contenido universal, sin detalles personales. NO uses números, viñetas, títulos, etiquetas ni placeholders. Devuelve solamente el párrafo.",
            TipoMensaje.SALUDO_NEW_FEED: "Escribe UN SOLO saludo breve con la voz del perfil. Debe sonar espontáneo y mostrar interés genuino sin exagerar la cercanía ni decir que extraña a alguien que apenas empieza a tratar. Incluye un motivo conversacional concreto y una pregunta fácil de responder. Evita 'hola, ¿cómo estás?' como mensaje completo, frases románticas prefabricadas y preguntas de entrevista. NO uses números, viñetas, títulos, etiquetas ni placeholders. Devuelve solamente el párrafo.",
            TipoMensaje.INSISTENCIA_NEW_FEED: "Escribe EXACTAMENTE 2 mensajes de seguimiento con la voz del perfil, separados por una línea en blanco. Deben retomar un mismo gancho cotidiano de forma natural, pero cada uno debe poder enviarse por separado. No reclames la falta de respuesta, no presiones y no inventes una anécdota. Incluye en cada mensaje una pregunta distinta y fácil de responder. Evita curiosidades enciclopédicas, frases profundas y fórmulas de asistente. NO uses números, viñetas, títulos, etiquetas ni placeholders. Devuelve solamente los 2 párrafos.",
        })
        return prompts.get(tipo, "Genera un mensaje apropiado y adaptado a las reglas estipuladas.")

    def _llamar_ia(self, system_prompt: str, user_prompt: str) -> str:
        contenido = self._llamar_proveedor(system_prompt, user_prompt)
        contenido = self._sanitizar_texto(contenido.strip())
        incumplimientos = self._buscar_terminos_prohibidos(contenido)

        if incumplimientos:
            lista = ", ".join(incumplimientos)
            correccion = f"""Reescribe el texto de abajo sin cambiar su estructura, cantidad de elementos ni cantidad de párrafos.

Usa palabras comunes y frases cortas que cualquier mujer adulta pueda entender a la primera.
Elimina por completo estas palabras o ideas prohibidas detectadas: {lista}.
No hables de encuentros, planes presenciales ni de estar físicamente cerca.
Devuelve solamente el texto corregido, sin explicaciones.

TEXTO:
{contenido}"""
            contenido = self._llamar_proveedor(system_prompt, correccion)
            contenido = self._sanitizar_texto(contenido.strip())
            incumplimientos = self._buscar_terminos_prohibidos(contenido)
            if incumplimientos:
                raise ValueError(
                    "La IA usó términos que no están permitidos: "
                    + ", ".join(incumplimientos)
                    + ". Intenta generar el contenido nuevamente."
                )

        return contenido

    def _llamar_proveedor(self, system_prompt: str, user_prompt: str) -> str:
        if self.provider == "gemini":
            return self._llamar_gemini(system_prompt, user_prompt)
        elif self.provider == "groq":
            return self._llamar_groq(system_prompt, user_prompt)
        return ""

    def _buscar_terminos_prohibidos(self, texto: str) -> List[str]:
        encontrados = []
        for nombre, patron in TERMINOS_PROHIBIDOS:
            if patron.search(texto):
                encontrados.append(nombre)
        return encontrados

    def _llamar_gemini(self, system_prompt: str, user_prompt: str) -> str:
        response = self.gemini_client.models.generate_content(
            model=self.gemini_model_name,
            contents=user_prompt,
            config=genai_types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.75,
                max_output_tokens=6000,
            )
        )
        return response.text if response.text else ""

    def _llamar_groq(self, system_prompt: str, user_prompt: str) -> str:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        response = self.groq_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=messages,
            temperature=0.75,
            max_tokens=6000
        )
        return response.choices[0].message.content if response.choices else ""


ai_service = AIService()
