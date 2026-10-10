from google import genai
from google.genai import types as genai_types
from groq import Groq
from app.core.config import settings
from app.models.schemas import TipoMensaje
from typing import Dict, List


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

    def generar_mensajes(self, prompt_personalidad: str, tipos: List[TipoMensaje]) -> Dict[str, str]:
        """Genera mensajes basados en el prompt de personalidad del perfil"""

        system_prompt = self._construir_system_prompt(prompt_personalidad)

        mensajes = {}
        for tipo in tipos:
            prompt = self._construir_prompt_tipo(tipo, prompt_personalidad)
            contenido = self._llamar_ia(system_prompt, prompt)
            mensajes[tipo.value] = contenido.strip()

        return mensajes

    def _construir_system_prompt(self, prompt_personalidad: str) -> str:
        return f"""Eres un asistente especializado en generar mensajes de texto para perfiles de citas/redes sociales.

PERSONALIDAD DEL PERFIL:
{prompt_personalidad}

REGLAS GENERALES Y ESTRICTAS (OBLIGATORIAS):
- NUNCA propongas ni hables de encontrarse, verse en persona, salir juntos, citas fisicas, viajes, desplazamientos o quedadas.
- PROHIBIDO usar las siguientes palabras o frases: "a veces", "aveces", "sin prisa", "frontera", "verse", "encontrarse", "encontrarnos", "verme", "verte", "viajar", "viaje", "desplazarse", "quedar", "cita", "salir juntos", "en persona", "presencial".
- REEMPLAZA OBLIGATORIAMENTE "a veces" por "de vez en cuando" en cualquier contexto.
- NO uses placeholders como [nombre], [Nombre], {{nombre}} o similares. Genera el contenido directo.
- Se natural, autentico y conversacional.
- Adapta el tono exactamente a la personalidad descrita.
- Evita frases genericas o roboticas.
- Longitud: 1-3 parrafos segun el tipo.
- Sin emojis excesivos (maximo 1-2 si encajan).
- En espanol neutro/latinoamericano.
- Nunca generes contenido automatico sin que el usuario te lo pida."""

    def _construir_prompt_tipo(self, tipo: TipoMensaje, prompt_personalidad: str) -> str:
        prompts = {
            TipoMensaje.SALUDO: "Genera 4 opciones de saludos numeradas (1, 2, 3, 4) para SALUDOS GENERALES. CADA OPCIÓN DEBE TENER ESTA ESTRUCTURA EXACTA:\n\n1. [Nombre del perfil] (Descripción breve de la perspectiva/temática)\n    Tema de hoy: [Tema específico del día, coherente con la perspectiva]\n\n¡Hola! Me daba una vuelta por aquí para saludarte en este rato de tranquilidad. [Párrafo 1: establece el contexto/escena]. [Párrafo 2: desarrolla el tema con reflexión personal, fluye naturalmente del anterior]. [Párrafo 3 opcional: cierre cálido]. Termina con pregunta abierta tipo '¿qué tal te trata la noche?' o '¿qué te ayuda a disfrutar más de este silencio?'.\n\n---\n\n2. [Nombre del perfil] (Otra perspectiva del MISMO TEMA GENERAL)\n    Tema de hoy: [Otro ángulo del mismo tema central]\n\n[Saludo con 2-3 párrafos que FLUYEN COHERENTEMENTE entre sí como UN SOLO MENSAJE NATURAL, no ideas sueltas. Cada párrafo conecta con el anterior. Estilo casual, cercano].\n\n---\n\n3. y 4. Igual estructura. LAS 4 OPCIONES COMPARTEN EL MISMO TEMA CENTRAL (ej: tranquilidad nocturna / desconexión / silencio / bienestar). DENTRO DE CADA OPCIÓN, LOS PÁRRAFOS DEBEN SER COHERENTES Y FLUIR COMO UNA CONVERSACIÓN REAL. NO uses placeholders. NO pongas iniciales tras el nombre (solo 'Antonio', no 'Antonio D'). Estilo: cercano, natural, como si escribieras a alguien a quien aprecias.",

            TipoMensaje.ICEBREAKER: "Genera EXACTAMENTE 4 icebreakers numerados (1-4) para el PLAN DE TRABAJO. CADA UNO DEBE COMENZAR OBLIGATORIAMENTE CON UN ICONO/EMOJI DIFERENTE al principio (ej: 🤝, 🛡️, 🎯, ⚖️). Formato: '1. 🤝 [Texto reflexivo o sobre habitos con pregunta final]'. Las 4 opciones deben relacionarse tematicamente entre si (misma historia/contexto). No uses placeholders.",

            TipoMensaje.CARTA_ROMPEHIELOS: "Genera UNA SOLA 'Carta de Rompehielos' para el PLAN DE TRABAJO. Reflexion profunda/romantica sobre la vida: la necesidad de compania natural, sentirnos amados, tener a alguien que nos cuide. Extension: 2-3 parrafos. Termina OBLIGATORIAMENTE con pregunta tipo '¿opinas lo mismo?' o similar. No uses placeholders.",

            TipoMensaje.CARTA_BARRIDO: "Genera 2 'Cartas de Barrido' numeradas (1-2) para el PLAN DE TRABAJO. Son historias personales cortas de tu vida diaria (ej: cocinar, cuidar de ti, rutinas). LAS DOS DEBEN ESTAR FUERTEMENTE RELACIONADAS entre si, compartiendo el mismo contexto o historia continua. Ejemplo: Carta 1 cocinando para ti -> Carta 2 cocinando para pareja. Terminan con pregunta personal. No uses placeholders.",

            TipoMensaje.INSISTENCIA: "Genera 2 mensajes de insistencia numerados (1-2) para el PLAN DE TRABAJO. Coherentes entre si, mismo hilo tematico. Comparten una anecdota personal o curiosidad (ej: visita de hijos, familia). SIN reclamar que no han respondido. Terminan con pregunta. No uses placeholders.",

            TipoMensaje.RESPUESTAS_RAPIDAS: "Genera 3 respuestas rapidas numeradas (1-3) para el NEW FEED. Temas interesantes/fascinantes (historia humanidad, tecnologia, evolucion, ciencia). ESTRICTO: Las 3 respuestas deben estar RELACIONADAS LOGICAMENTE entre si como si fueran parte de una misma conversacion continua. Cada una con pregunta para enganchar. No uses placeholders.",

            TipoMensaje.POSTS: "Genera EXACTAMENTE 3 posts numerados (1-3) para el NEW FEED. Adaptados COMPLETAMENTE a la personalidad del perfil (categoria_feed + prompt_personalidad). Variados y atractivos. CADA POST DEBE INCLUIR AL FINAL: '📸 [Imagen sugerida: descripcion detallada de la imagen ideal para este post]'. No uses placeholders.",

            TipoMensaje.CARTA_ROMANTICA: """Genera una serie de MINIMO 6 cartas romanticcas o sensuales cortas (de exactamente 2 parrafos cada una), numeradas del 1 al 6+. Cada carta debe ser diferente en tema y tono: algunas mas romanticcas y tiernas, otras mas sensuales e insinuantes (sin ser explicitas). Deben generar deseo, intriga y ganas de responder. Formato: cada carta separada por '---'. Ejemplo de estructura:
1. [carta romantica, 2 parrafos]
---
2. [carta sensual, 2 parrafos]
---... y asi hasta al menos 6.""",

            TipoMensaje.DINAMICA_JUEGO: """Genera 2-3 ideas de 'Dinamicas o Juegos' personalizados para enviarle a UNA CLIENTA ESPECIFICA (pagadora) con el objetivo de engancharla emocionalmente y motivarla a: (1) responder activamente, (2) enviarte regalos o propinas, o (3) pagar por posts privados de imagenes o contenido exclusivo. Cada dinamica debe sentirse como un juego divertido o un reto intimo entre los dos. Numeradas y separadas por '---'. Adaptadas al perfil.""",

            TipoMensaje.SALUDO_PLAN_TRABAJO: "Genera 1 saludo para el PLAN DE TRABAJO (seccion final). Estilo: 'Oye me sente un rato en el sofa a ver una pelicula y empece a pensar en ti... me gustaria saber como has estado, la verdad es que me has hecho muchisima falta y sobre todo me hace falta saber de ti, cuentame que ha sido de tu vida, algo interesante que te haya pasado que me quieras contar'. Calido, directo, pregunta abierta. No uses placeholders.",

            TipoMensaje.SALUDO_NEW_FEED: "Genera 1 saludo para el NEW FEED (seccion final). Estilo: 'Hola como estas, tengo rato pensando en ti la verdad, ultimamente tengo la necesidad de saber mucho acerca de tu vida'. Calido, necesidad genuina de saber de la persona. No uses placeholders.",

            TipoMensaje.INSISTENCIA_NEW_FEED: "Genera 2 mensajes de insistencia numerados (1-2) para el NEW FEED. Anecdotas/curiosidades tecnicas o mecanicas (coches, motos, electrodomesticos, como funcionan las cosas por dentro). Coherentes entre si, mismo hilo tematico. Preguntas como '¿No te ha pasado que te llama la atencion como funciona X por dentro?'. No uses placeholders.",
        }
        return prompts.get(tipo, "Genera un mensaje apropiado y adaptado a las reglas estipuladas.")

    def _llamar_ia(self, system_prompt: str, user_prompt: str) -> str:
        if self.provider == "gemini":
            return self._llamar_gemini(system_prompt, user_prompt)
        elif self.provider == "groq":
            return self._llamar_groq(system_prompt, user_prompt)
        return ""

    def _llamar_gemini(self, system_prompt: str, user_prompt: str) -> str:
        response = self.gemini_client.models.generate_content(
            model=self.gemini_model_name,
            contents=user_prompt,
            config=genai_types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.8,
                max_output_tokens=2000,
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
            temperature=0.8,
            max_tokens=2000
        )
        return response.choices[0].message.content if response.choices else ""


ai_service = AIService()