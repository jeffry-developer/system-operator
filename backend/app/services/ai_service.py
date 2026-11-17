from google import genai
from google.genai import types as genai_types
from groq import Groq
from app.core.config import settings
from app.models.schemas import TipoMensaje
from typing import Dict, List
import re
import unicodedata
import json
from difflib import SequenceMatcher
from concurrent.futures import ThreadPoolExecutor, as_completed


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
    ("esta mañana", re.compile(r"\b(?:esta|por\s+la|en\s+la)\s+ma(?:ñ|n)ana\b", re.IGNORECASE)),
    ("esta tarde", re.compile(r"\b(?:esta|por\s+la|en\s+la)\s+tarde\b", re.IGNORECASE)),
    ("buenos días", re.compile(r"\bbuenos\s+d(?:í|i)as\b", re.IGNORECASE)),
    ("empezar el día", re.compile(r"\b(?:empezar|comenzar|iniciar|arrancar)\s+(?:bien\s+)?el\s+d(?:í|i)a\b", re.IGNORECASE)),
    ("al despertar", re.compile(r"\bal\s+despertar\b", re.IGNORECASE)),
    ("amanecer", re.compile(r"\bamanec(?:er|iendo|ió|io)\b", re.IGNORECASE)),
    ("salió el sol", re.compile(r"\b(?:sali(?:ó|o)|sale|disfrutar|aprovechar)\s+(?:del?\s+)?sol\b", re.IGNORECASE)),
    (
        "alguna vez te has preguntado",
        re.compile(r"\balguna\s+vez\s+te\s+has\s+preguntado\b", re.IGNORECASE),
    ),
    ("qué opinas al respecto", re.compile(r"\bqu(?:é|e)\s+opinas\s+al\s+respecto\b", re.IGNORECASE)),
)


# Este contenido debe poder usarse desde cualquier perfil. El perfil elegido en
# la interfaz determina dónde se guarda el historial, no aporta datos al texto.
TIPOS_CONTENIDO_GENERAL = {
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
}


class AIService:
    def __init__(self):
        self.provider = settings.AI_PROVIDER.lower()
        self.gemini_client = None
        self.groq_client = None
        self.gemini_model_name = "gemini-3.8-flash"

        if settings.GEMINI_API_KEY:
            self.gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
        if settings.GROQ_API_KEY:
            self.groq_client = Groq(api_key=settings.GROQ_API_KEY)

        if self.provider == "gemini" and not self.gemini_client:
            raise ValueError("No API key configured for provider: gemini")
        if self.provider == "groq" and not self.groq_client:
            raise ValueError(f"No API key configured for provider: {self.provider}")

    def generar_mensajes(self, prompt_personalidad: str, tipos: List[TipoMensaje], ultimos_mensajes: Dict[str, str] = None) -> Dict[str, str]:
        """Genera en paralelo contenido humano, reutilizable y sin datos privados."""
        if len(tipos) > 1 and all(tipo in TIPOS_CONTENIDO_GENERAL for tipo in tipos):
            return self._generar_lote_general(tipos, prompt_personalidad)

        def generar_tipo(tipo: TipoMensaje) -> tuple[str, str]:
            es_contenido_general = tipo in TIPOS_CONTENIDO_GENERAL
            system_prompt = self._construir_system_prompt(
                "" if es_contenido_general else prompt_personalidad,
                contenido_general=es_contenido_general,
            )
            prompt = self._construir_prompt_tipo(
                tipo,
                "" if es_contenido_general else prompt_personalidad,
            )
            
            # El historial de versiones antiguas puede contener datos del
            # perfil. Nunca se incorpora al contenido general reutilizable.
            if not es_contenido_general and ultimos_mensajes and tipo.value in ultimos_mensajes:
                anterior = ultimos_mensajes[tipo.value][:500]  # máx 500 chars del anterior
                prompt = f"IMPORTANTE: El siguiente contenido fue generado anteriormente. NO lo repitas ni uses las mismas frases o ideas:\n---\n{anterior}\n---\n\n{prompt}"
            
            contenido = self._llamar_ia(system_prompt, prompt)
            if tipo == TipoMensaje.ICEBREAKER:
                contenido = self._asegurar_emoji_en_rompehielos(contenido)
            if tipo == TipoMensaje.RESPUESTAS_RAPIDAS:
                contenido = self._asegurar_respuestas_rapidas_distintas(contenido, system_prompt)
            if tipo in {TipoMensaje.INSISTENCIA, TipoMensaje.INSISTENCIA_NEW_FEED}:
                contenido = self._asegurar_dos_insistencias(contenido, system_prompt)
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
            if es_contenido_general and self._contiene_datos_del_perfil(contenido, prompt_personalidad):
                raise ValueError("El contenido incluyó información específica del perfil y fue descartado")
            return tipo.value, self._sanitizar_texto(contenido.strip())

        mensajes = {}
        max_workers = 1
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futuros = {executor.submit(generar_tipo, tipo): tipo for tipo in tipos}
            for futuro in as_completed(futuros):
                clave, contenido = futuro.result()
                mensajes[clave] = contenido
        return mensajes

    def _generar_lote_general(self, tipos: List[TipoMensaje], prompt_personalidad: str) -> Dict[str, str]:
        """Genera todos los bloques solicitados con una sola llamada al proveedor."""
        system_prompt = self._construir_system_prompt("", contenido_general=True)
        instrucciones = []
        for tipo in tipos:
            instrucciones.append(f"CLAVE {tipo.value}:\n{self._construir_prompt_tipo(tipo, '')}")
        claves = [tipo.value for tipo in tipos]
        instrucciones_texto = "\n\n".join(instrucciones)
        prompt = f"""Genera todos los bloques solicitados en UNA SOLA respuesta.

Devuelve exclusivamente un objeto JSON válido con estas claves exactas: {json.dumps(claves, ensure_ascii=False)}.
Cada valor debe ser un string. Representa las separaciones entre párrafos dentro del string con \\n\\n. No uses bloques de código, comentarios ni texto fuera del JSON.

INSTRUCCIONES POR CLAVE:
{instrucciones_texto}"""

        ultimo_error = None
        for intento in range(1):
            try:
                bruto = self._llamar_proveedor_json(system_prompt, prompt, claves).strip()
                bruto = re.sub(r"^```(?:json)?\s*|\s*```$", "", bruto, flags=re.IGNORECASE)
                inicio, fin = bruto.find("{"), bruto.rfind("}")
                if inicio < 0 or fin < inicio:
                    raise ValueError("La IA no devolvió el JSON esperado")
                datos = json.loads(bruto[inicio:fin + 1])
                mensajes = {}
                for tipo in tipos:
                    contenido = datos.get(tipo.value)
                    if not isinstance(contenido, str) or not contenido.strip():
                        raise ValueError(f"Falta el bloque {tipo.value}")
                    contenido = self._sanitizar_texto(self._quitar_numeros_y_vinetas(contenido.strip()))
                    contenido = self._neutralizar_referencias_horarias(contenido)
                    if self._contiene_datos_del_perfil(contenido, prompt_personalidad):
                        contenido = self._fallback_general(tipo)
                    if tipo == TipoMensaje.ICEBREAKER:
                        contenido = self._asegurar_emoji_en_rompehielos(contenido)
                    if tipo == TipoMensaje.RESPUESTAS_RAPIDAS:
                        contenido = self._asegurar_respuestas_rapidas_distintas(contenido, system_prompt)
                    if tipo in {TipoMensaje.INSISTENCIA, TipoMensaje.INSISTENCIA_NEW_FEED}:
                        contenido = self._asegurar_dos_insistencias(contenido, system_prompt)
                    mensajes[tipo.value] = contenido
                return mensajes
            except Exception as exc:
                ultimo_error = exc
        # La disponibilidad del proveedor nunca debe detener el turno completo.
        return {tipo.value: self._fallback_general(tipo) for tipo in tipos}

    def _llamar_proveedor_json(self, system_prompt: str, user_prompt: str, claves: List[str]) -> str:
        """Usa JSON estructurado en Gemini y una respuesta JSON normal en Groq."""
        schema = {
            "type": "object",
            "properties": {clave: {"type": "string"} for clave in claves},
            "required": claves,
        }
        if self.provider == "groq":
            response = self.groq_client.chat.completions.create(
                model="openai/gpt-oss-20b",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.75,
                max_tokens=4500,
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "contenido_modulo",
                        "strict": True,
                        "schema": schema,
                    },
                },
            )
            return response.choices[0].message.content if response.choices else ""
        if self.provider != "gemini":
            return self._llamar_proveedor(system_prompt, user_prompt)
        try:
            response = self.gemini_client.models.generate_content(
                model=self.gemini_model_name,
                contents=user_prompt,
                config=genai_types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.8,
                    max_output_tokens=6000,
                    response_mime_type="application/json",
                    response_schema=schema,
                ),
            )
            return response.text if response.text else ""
        except Exception:
            if self.groq_client:
                return self._llamar_groq(system_prompt, user_prompt)
            raise

    @staticmethod
    def _neutralizar_referencias_horarias(contenido: str) -> str:
        reemplazos = (
            (r"\b(?:esta|por\s+la|en\s+la)\s+ma(?:ñ|n)ana\b", "hace un rato"),
            (r"\b(?:esta|por\s+la|en\s+la)\s+tarde\b", "hace un rato"),
            (r"\bbuenos\s+d(?:í|i)as\b", "hola"),
            (r"\b(?:empezar|comenzar|iniciar|arrancar)\s+(?:bien\s+)?el\s+d(?:í|i)a\b", "cambiar el ánimo"),
            (r"\bal\s+despertar\b", "en un momento cualquiera"),
            (r"\bamanec(?:er|iendo|ió|io)\b", "momento"),
            (r"\b(?:sali(?:ó|o)|sale|disfrutar|aprovechar)\s+(?:del?\s+)?sol\b", "cambió el ambiente"),
        )
        for patron, reemplazo in reemplazos:
            contenido = re.sub(patron, reemplazo, contenido, flags=re.IGNORECASE)
        return contenido

    @staticmethod
    def _fallback_general(tipo: TipoMensaje) -> str:
        respaldos = {
            TipoMensaje.ICEBREAKER: "🎵 Se me quedó una canción rondando la cabeza y terminé pensando en cómo cambia el ánimo sin pedir permiso. ¿Cuál tienes repitiéndose últimamente?\n\n🍝 Elegir qué comer parece sencillo hasta que aparecen demasiadas opciones. ¿Qué plato siempre consigue convencerte?\n\n🎬 Hay historias que empiezan lentas y terminan atrapando por completo. ¿Qué película o serie te sorprendió así?\n\n😄 Hoy recordé uno de esos pequeños despistes que terminan dando risa. ¿Cuál ha sido el tuyo últimamente?",
            TipoMensaje.CARTA_ROMPEHIELOS: "Hace un rato pensé que las mejores conversaciones suelen empezar por una pregunta sencilla y una respuesta inesperada. Me gusta descubrir cómo alguien ve esas pequeñas cosas que casi nunca se preguntan, porque ahí aparece lo más interesante. Si pudieras conservar un solo momento agradable de los últimos días, ¿cuál elegirías?",
            TipoMensaje.CARTA_BARRIDO: "Hace un rato puse música mientras ordenaba unas cosas y una canción terminó cambiando por completo el ambiente. Me gusta cuando algo tan sencillo rompe la rutina y deja una sensación distinta. ¿Qué canción consigue hacer eso contigo casi de inmediato?\n\nElegir algo rico para comer puede convertirse en una discusión divertida cuando todas las opciones parecen buenas. Yo termino cambiando de idea más de una vez antes de decidir. ¿Cuál es ese plato que siempre gana cuando no quieres pensarlo demasiado?",
            TipoMensaje.INSISTENCIA: "Hace un rato apareció una canción que no escuchaba desde hace tiempo y terminó quedándose en mi cabeza. ¿Cuál es esa canción que últimamente no puedes dejar de repetir?\n\nSiguiendo con la música, hay letras que parecen expresar justo lo que uno no sabía cómo decir. ¿Hay alguna que sientas especialmente cercana?",
            TipoMensaje.RESPUESTAS_RAPIDAS: "Hoy vi un pequeño despiste que terminó haciendo reír a todos alrededor. ¿Qué situación inesperada te ha causado gracia últimamente?\n\nSe me quedó una canción pegada sin saber siquiera toda la letra. ¿Cuál aparece en tu cabeza sin pedir permiso?\n\nCuando una serie está muy buena, ¿prefieres verla completa o guardar capítulos para que dure más?",
            TipoMensaje.SALUDO_PLAN_TRABAJO: "Creo que una buena conversación puede revelar química desde el primer mensaje, así que decidí dar el primer paso sin darle tantas vueltas. ¿Tú también crees que esa chispa puede aparecer desde una pregunta sencilla?",
            TipoMensaje.SALUDO_NEW_FEED: "Hace un rato recordé una escena graciosa y pensé en cómo esas pequeñas cosas cambian el ánimo. Me dio curiosidad saber de ti: ¿qué detalle inesperado consiguió sacarte una sonrisa últimamente?",
            TipoMensaje.INSISTENCIA_NEW_FEED: "Hace un rato apareció una canción que no escuchaba desde hace tiempo y terminó quedándose en mi cabeza. ¿Cuál es esa canción que últimamente no puedes dejar de repetir?\n\nSiguiendo con la música, hay letras que parecen expresar justo lo que uno no sabía cómo decir. ¿Hay alguna que sientas especialmente cercana?",
            TipoMensaje.POSTS: "Me gusta cuando una canción aparece sin buscarla y cambia por completo el ambiente. ¿Cuál pondrías ahora mismo?\nPROMPT PARA CHATGPT:\nFotografía vertical 4:5 de una escena cotidiana escuchando música en un espacio vivido, iluminación nocturna cálida, encuadre espontáneo, detalles imperfectos, sin texto ni marcas de agua.\n\n---\n\nElegir algo rico parece fácil hasta que todas las opciones provocan. ¿Qué escogerías sin pensarlo?\nPROMPT PARA CHATGPT:\nFotografía vertical 4:5 de una preparación casera sencilla en una cocina real y ligeramente desordenada, luz cálida, encuadre natural, sin texto ni marcas de agua.\n\n---\n\nUna buena historia puede hacer que uno pierda la noción del tiempo. ¿Qué película o serie logró atraparte así?\nPROMPT PARA CHATGPT:\nFotografía vertical 4:5 de un rincón cotidiano preparado para ver una película, ambiente nocturno acogedor, composición espontánea y realista, sin texto ni marcas de agua.",
        }
        return respaldos.get(tipo, "Hace un rato pensé en esas pequeñas cosas que vuelven una conversación interesante. ¿Qué detalle inesperado llamó tu atención últimamente?")

    @staticmethod
    def _contiene_datos_del_perfil(contenido: str, prompt_personalidad: str) -> bool:
        """Detecta localmente términos distintivos del perfil en texto general."""
        if not contenido or not prompt_personalidad:
            return False

        def normalizar(texto: str) -> List[str]:
            texto = unicodedata.normalize("NFKD", texto.casefold())
            texto = "".join(char for char in texto if not unicodedata.combining(char))
            return re.findall(r"[a-z0-9]+", texto)

        # Palabras de instrucciones o conversación que no representan datos
        # biográficos. Todo término distintivo restante queda bloqueado.
        comunes = {
            "adulta", "adulto", "alegre", "amable", "amor", "apasionado", "autentico",
            "carta", "cercana", "cercano", "chat", "conversacion", "conversar", "creativo",
            "detalle", "divertida", "divertido", "dulce", "emocional", "escribe", "espanol",
            "estilo", "formal", "frase", "gusta", "gustos", "hablar", "humano", "interes",
            "interesante", "latino", "latinoamericano", "lenguaje", "mensaje", "mujer", "natural",
            "neutral", "parrafo", "perfil", "persona", "personalidad", "pregunta", "respuesta",
            "romantico", "sencillo", "sensual", "situacion", "texto", "tono", "palabras",
            "siempre", "tambien", "tiene", "desde", "cuando", "donde", "porque", "puede",
            "quiere", "hacer", "forma", "cosas", "sobre", "entre", "mucho", "poco",
        }
        terminos_perfil = {
            palabra for palabra in normalizar(prompt_personalidad)
            if len(palabra) >= 5 and palabra not in comunes
        }
        terminos_salida = set(normalizar(contenido))
        coincidencias = terminos_perfil & terminos_salida

        nombres_ignorados = {"perfil", "escribe", "persona", "hombre", "mujer", "tono", "estilo"}
        posibles_nombres = {
            normalizar(token)[0]
            for token in re.findall(r"\b[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]{3,}\b", prompt_personalidad)
            if normalizar(token) and normalizar(token)[0] not in nombres_ignorados
        }
        # Un nombre propio nunca puede aparecer. Para vocabulario común se
        # exigen dos coincidencias, evitando falsos positivos por una palabra.
        return bool(posibles_nombres & terminos_salida) or len(coincidencias) >= 2

    def _asegurar_dos_insistencias(self, contenido: str, system_prompt: str) -> str:
        """Garantiza dos insistencias consecutivas, independientes y sin etiquetas."""
        def extraer(texto: str) -> List[str]:
            limpio = self._quitar_numeros_y_vinetas(texto)
            return [
                " ".join(bloque.split())
                for bloque in re.split(r"\n\s*\n+", limpio.strip())
                if bloque.strip()
            ]

        def es_valido(parrafos: List[str]) -> bool:
            if len(parrafos) != 2 or any(len(parrafo.split()) < 12 for parrafo in parrafos):
                return False
            normalizados = [re.sub(r"[^a-záéíóúüñ0-9 ]", "", p.casefold()) for p in parrafos]
            if SequenceMatcher(None, normalizados[0], normalizados[1]).ratio() >= 0.58:
                return False

            palabras_vacias = {
                "a", "algo", "al", "con", "como", "cuando", "de", "del", "el", "ella",
                "en", "esa", "ese", "esta", "este", "fue", "ha", "hoy", "la", "las", "le",
                "lo", "los", "me", "mi", "muy", "o", "para", "pero", "por", "que", "qué",
                "se", "sin", "su", "te", "tu", "tú", "un", "una", "y", "ya", "yo",
            }
            temas = []
            for texto in normalizados:
                temas.append({
                    palabra for palabra in texto.split()
                    if len(palabra) >= 5 and palabra not in palabras_vacias
                })
            # Debe existir un hilo temático común, pero las primeras frases no
            # pueden ser la misma introducción con otra pregunta al final.
            if not (temas[0] & temas[1]):
                return False
            primeras_frases = [re.split(r"[.!?]", texto, maxsplit=1)[0] for texto in normalizados]
            return SequenceMatcher(None, primeras_frases[0], primeras_frases[1]).ratio() < 0.5

        parrafos = extraer(contenido)
        if es_valido(parrafos):
            return "\n\n".join(parrafos)

        return (
            "Hoy escuché una canción que llevaba tiempo sin aparecer y terminó cambiándome el ánimo por completo. ¿Cuál es esa canción que últimamente se te queda dando vueltas en la cabeza?\n\n"
            "Y pensando en música, me gusta cuando una letra parece decir justo lo que uno no sabía cómo explicar. ¿Hay alguna canción cuya letra sientas especialmente cercana a ti?"
        )

    def _asegurar_respuestas_rapidas_distintas(self, contenido: str, system_prompt: str) -> str:
        """Exige tres aperturas diferentes y corrige repeticiones del proveedor."""
        def extraer(texto: str) -> List[str]:
            return [
                " ".join(bloque.split())
                for bloque in re.split(r"\n\s*\n+", texto.strip())
                if bloque.strip()
            ]

        def es_valido(respuestas: List[str]) -> bool:
            if len(respuestas) != 3:
                return False
            normalizadas = [re.sub(r"[^a-záéíóúüñ0-9 ]", "", r.casefold()) for r in respuestas]
            aperturas = {" ".join(r.split()[:7]) for r in normalizadas}
            if len(aperturas) != 3 or any("?" not in respuesta for respuesta in respuestas):
                return False
            return all(
                SequenceMatcher(None, normalizadas[i], normalizadas[j]).ratio() < 0.48
                for i in range(3)
                for j in range(i + 1, 3)
            )

        respuestas = extraer(contenido)
        if es_valido(respuestas):
            return "\n\n".join(respuestas)

        return "\n\n".join((
            "Hoy vi a alguien intentar abrir una puerta empujando cuando decía ‘hale’ y me dio risa porque todos hemos pasado por algo así. ¿Qué despiste reciente te hizo reír de ti misma?",
            "Se me quedó una canción pegada sin saber siquiera toda la letra, pero ya logró cambiarme el ánimo. ¿Cuál es esa canción que últimamente aparece en tu cabeza sin pedir permiso?",
            "Tengo una discusión ligera pendiente: cuando una serie está muy buena, ¿prefieres verla completa de una vez o guardar capítulos para que dure más? Yo siempre digo que esperaré y termino fallando.",
        ))

    @staticmethod
    def _asegurar_emoji_en_rompehielos(contenido: str) -> str:
        """Garantiza un emoji inicial incluso si el proveedor omite la regla."""
        emojis = ("💭", "🎵", "🍜", "😄")
        bloques = [bloque.strip() for bloque in re.split(r"\n\s*\n+", contenido) if bloque.strip()]
        resultado = []
        patron_emoji = re.compile(r"^[\U0001F300-\U0001FAFF\u2600-\u27BF]")
        for indice, bloque in enumerate(bloques):
            if not patron_emoji.match(bloque):
                bloque = f"{emojis[indice % len(emojis)]} {bloque}"
            resultado.append(bloque)
        return "\n\n".join(resultado)

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

    def _construir_system_prompt(self, prompt_personalidad: str, contenido_general: bool = False) -> str:
        if contenido_general:
            contexto = """CONTENIDO GENERAL REUTILIZABLE:
- Este texto NO pertenece a un perfil específico y debe servir sin cambios para cualquier perfil.
- Ignora por completo nombres, datos, gustos, profesión, edad, ubicación, categoría y personalidad del perfil seleccionado.
- Usa una voz humana neutra, cercana y adulta. Puede contar una microescena cotidiana plausible en primera persona (algo que pensó, vio, escuchó, cocinó o le causó gracia), sin inventar datos biográficos sensibles ni grandes acontecimientos.
- Lo específico debe estar en una escena cotidiana creíble. Incluye una reacción personal imperfecta y una pregunta nacida de esa escena para que no suene a plantilla."""
            regla_voz = "- Escribe con una voz humana neutra y natural que pueda usar cualquier perfil."
        else:
            contexto = f"""VOZ DEL PERFIL (es la referencia principal para que el resultado parezca escrito por esta persona):
{prompt_personalidad}"""
            regla_voz = "- Escribe desde la voz del perfil, no desde la voz de un asistente. Imita su nivel de formalidad, ritmo, vocabulario, humor, dulzura o picardía sin decir que estás imitando nada."

        return f"""Escribes mensajes de texto en primera persona para perfiles de citas/redes sociales.

{contexto}

REGLAS GENERALES Y ESTRICTAS (OBLIGATORIAS):
{regla_voz}
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
- No asumas hechos, recuerdos concretos ni información que la destinataria no haya contado. Cuando el tipo sea seguimiento o insistencia, transmite cercanía sin inventar una historia en común.
- HORARIO NEUTRO OBLIGATORIO: todo mensaje debe poder enviarse indistintamente de noche o madrugada. No digas ni insinúes "esta mañana", "esta tarde", "buenos días", "empezar el día", "al despertar", "amanecer", "salió el sol", "disfruta el sol", "café de la mañana" ni actividades ligadas a una hora específica. Puedes usar "hoy", "ahora", "hace un rato", "en este momento" o "a estas horas".
- No incluyas nombres, edad, profesión, ciudad, país, apariencia, gustos especializados, historia personal ni otros datos concretos del perfil o de la destinataria. Usa únicamente anécdotas y situaciones cotidianas plausibles que podrían ocurrirle a cualquier persona.
- IGNORA por completo cualquier dato del perfil aunque aparezca en instrucciones anteriores, historial o contexto. No menciones trabajo, estudios, familiares, hijos, mascotas, vehículos, viajes, nacionalidad, ubicación, rasgos físicos, aficiones especializadas ni experiencias biográficas.
- Las microanécdotas solo pueden usar acciones universales y de bajo riesgo, como escuchar una canción, elegir qué comer, ordenar algo, ver una escena graciosa, recordar una película o equivocarse en una tarea sencilla. No conviertas la anécdota en información estable sobre quien escribe.
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
        temas_icebreaker = ["una costumbre curiosa", "una opinión impopular pero ligera", "música que cambia el ánimo", "comida que siempre provoca", "un plan improvisado desde casa", "una habilidad que gustaría aprender", "algo gracioso del día a día", "una elección difícil pero divertida", "una foto antigua que apareció sin buscarla", "un olor que trae un recuerdo", "una conversación escuchada por casualidad", "un pequeño error que terminó dando risa"]
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
            TipoMensaje.ICEBREAKER: f"""Escribe EXACTAMENTE 4 rompehielos independientes con voz humana, cercana y neutral. Son nuevos acercamientos para iniciar conversación con una mujer; no son respuestas a una charla anterior.

Usa un tema diferente en cada uno, en este orden: {', '.join(temas_icebreaker_elegidos)}.

Cada mensaje debe ser corto (entre 25 y 45 palabras), comenzar OBLIGATORIAMENTE con un único emoji relacionado con su tema y continuar con una observación cotidiana, una reacción personal honesta y una pregunta fácil y atractiva. La pregunta debe permitir que ella cuente algo propio; no debe parecer una encuesta ni una entrevista. Haz que los cuatro tengan emojis, aperturas, ritmos y cierres distintos.

NO empieces con “hola, ¿cómo estás?”, “cuéntame de ti” ni “¿alguna vez te has preguntado...?”. NO escribas reflexiones profundas, moralejas, halagos sobre su físico ni datos enciclopédicos. No uses números, viñetas, títulos, etiquetas ni placeholders. Separa los mensajes con una línea en blanco y devuelve solamente los 4 párrafos.""",
            TipoMensaje.CARTA_ROMPEHIELOS: "Genera UNA SOLA carta de rompehielos (Carta de IB) para el PLAN DE TRABAJO, con voz humana, cercana y neutral, de aproximadamente 350 caracteres (entre 300 y 400, contando espacios). Es una presentación informal basada en una situación cotidiana universal: debe revelar una manera de pensar, despertar interés y abrir la posibilidad de conversar. Termina con una pregunta natural. No uses información específica del perfil ni de la destinataria. No debe sonar solemne, romántica prefabricada ni escrita por una IA. NO uses números, viñetas, títulos, etiquetas ni placeholders. Devuelve solamente la carta en un párrafo.",
            TipoMensaje.CARTA_BARRIDO: f"Genera EXACTAMENTE 2 cartas de barrido independientes para personas que tienen cartas activas, con voz humana, cercana y neutral. Cada carta debe rondar los 350 caracteres (entre 300 y 400, contando espacios), ocupar un solo párrafo y separarse de la otra con una línea en blanco. Usa dos escenas cotidianas universales diferentes relacionadas con {tema_barrido}; deben llamar la atención, mostrar interés real y terminar con una pregunta que busque respuesta. No uses datos específicos del perfil o la destinataria, no reclames ni presiones. NO uses números, viñetas, títulos, etiquetas ni placeholders. Devuelve solamente las 2 cartas.",
            TipoMensaje.INSISTENCIA: f"Genera EXACTAMENTE 2 mensajes de insistencia CONSECUTIVOS para el PLAN DE TRABAJO, con voz humana, cercana y neutral. Cada insistencia ocupa un solo párrafo breve y ambos párrafos deben estar separados únicamente por una línea en blanco. Los dos continúan un mismo hilo cotidiano y universal sobre {tema_insistencia}, pero el segundo debe avanzar hacia un detalle u opinión nueva sin repetir la introducción, la escena ni la pregunta del primero. Muestra interés, no reclames la falta de respuesta y termina con una pregunta sencilla. No uses datos específicos del perfil ni de la destinataria. NO uses números, viñetas, títulos, etiquetas, introducciones ni placeholders. Devuelve solamente los 2 párrafos.",
            TipoMensaje.RESPUESTAS_RAPIDAS: f"""Escribe EXACTAMENTE 3 respuestas rápidas generales e independientes para el módulo NEW FEED. Deben servir para reaccionar de forma natural a una publicación o comentario y abrir una conversación, sin asumir que ya existe confianza.

Usa un gancho diferente en cada mensaje, en este orden: {', '.join(temas_rapidas_elegidos)}.

Cada mensaje debe tener entre 20 y 45 palabras. Reacciona con una opinión o comentario concreto y enlázalo con UNA pregunta sencilla que invite a responder. Debe sentirse escrito en el momento por una persona real, no como una frase preparada para ligar. Los tres mensajes deben tener estructuras distintas.

VARIEDAD OBLIGATORIA: cada respuesta debe usar un tema, escena, apertura, vocabulario y tipo de pregunta completamente diferentes. Está prohibido reutilizar el mismo objeto, comida, bebida, actividad o situación en dos mensajes. No empieces dos respuestas con las mismas palabras.

NO uses saludos vacíos como “hola, ¿cómo estás?”, halagos genéricos, datos enciclopédicos, acertijos, reflexiones profundas, frases motivacionales ni preguntas de entrevista. No declares sentimientos intensos ni confianza que todavía no existe. NO uses números, viñetas, títulos, etiquetas ni placeholders. Separa los mensajes con una línea en blanco y devuelve solamente los 3 párrafos.""",
            TipoMensaje.POSTS: f"""Prepara EXACTAMENTE 3 propuestas de fotografía para el NEW FEED del perfil. Cada propuesta debe abordar, en este orden, un ángulo distinto: {', '.join(temas_posts_elegidos)}.

Para cada propuesta escribe primero un pie de foto breve, en primera persona y con voz humana neutral. Debe mostrar una actividad o situación cotidiana universal, sonar espontáneo y terminar OBLIGATORIAMENTE con una pregunta natural que anime a responder. Los tres pies deben tener temas, aperturas y preguntas diferentes. No incluyas información específica del perfil y no redactes citas inspiradoras, consejos, discursos ni reflexiones vacías.

Después de cada pie escribe exactamente la etiqueta PROMPT PARA CHATGPT: y, en la línea siguiente, un prompt completo para crear una fotografía vertical 4:5 relacionada. La escena debe parecer una foto personal, auténtica y difícil de encontrar en Google: incluye una acción cotidiana concreta, entorno vivido, encuadre natural, iluminación realista y pequeños detalles imperfectos. Evita imágenes de banco, poses publicitarias, composiciones genéricas y rasgos biográficos específicos. Redacta todo en español neutro y no pidas palabras, letras, logos ni marcas de agua. Si aparecen personas, deben ser adultas.

Separa cada conjunto de publicación y prompt con una línea que contenga solamente ---. NO agregues imágenes sugeridas, recomendaciones de imágenes, enlaces, números, viñetas, títulos de publicación ni otras etiquetas. No uses placeholders. Devuelve solamente los tres conjuntos.""",
            TipoMensaje.SALUDO_PLAN_TRABAJO: "Genera UN SOLO saludo humano, seguro y neutral para el PLAN DE TRABAJO. Inspírate en esta intención sin copiarla literalmente: creer que la química puede aparecer desde el primer mensaje, atreverse a dar el primer paso y preguntar si ella cree que podría existir esa química. No uses información específica del perfil ni de la destinataria y no suenes como una frase preparada. Debe funcionar de noche o madrugada y terminar con UNA pregunta. NO uses números, viñetas, títulos, etiquetas ni placeholders. Devuelve solamente el párrafo.",
            TipoMensaje.SALUDO_NEW_FEED: "Escribe EXACTAMENTE 1 saludo humano y neutral para NEW FEED. Debe partir de una anécdota o situación cotidiana que podría ocurrirle a cualquiera, incluir una reacción u opinión personal, invitar a conversar y terminar con UNA pregunta fácil de responder. No uses información específica del perfil ni de la destinataria. Debe funcionar de noche o madrugada. Evita 'hola, ¿cómo estás?' como mensaje completo, frases románticas prefabricadas y preguntas de entrevista. NO uses números, viñetas, títulos, etiquetas ni placeholders. Devuelve solamente el párrafo.",
            TipoMensaje.INSISTENCIA_NEW_FEED: "Escribe EXACTAMENTE 2 insistencias CONSECUTIVAS, humanas y neutrales, para contactos con los que se pueda retomar la conversación. Cada una debe ocupar un solo párrafo breve y ambos párrafos deben estar separados únicamente por una línea en blanco. Mantén el mismo hilo cotidiano universal en las dos, pero haz que la segunda avance con un detalle, opinión o ángulo nuevo; no repitas la apertura, la escena ni la pregunta del primer párrafo. Muestra interés real y deja una vía fácil para continuar hablando. No reclames la falta de respuesta, no presiones y no uses información específica del perfil o del contacto. Deben funcionar de noche o madrugada. NO uses números, viñetas, títulos, etiquetas, introducciones ni placeholders. Devuelve solamente los 2 párrafos.",
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
            model="openai/gpt-oss-20b",
            messages=messages,
            temperature=0.75,
            max_tokens=4000
        )
        return response.choices[0].message.content if response.choices else ""


ai_service = AIService()
