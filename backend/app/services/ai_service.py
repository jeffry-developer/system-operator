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

PERSONALIDAD DEL PERFIL (usar solo como referencia de TONO general, no para detalles específicos):
{prompt_personalidad}

REGLAS GENERALES Y ESTRICTAS (OBLIGATORIAS):
- NUNCA propongas ni hables de encontrarse, verse en persona, salir juntos, citas fisicas, viajes, desplazamientos o quedadas.
- PROHIBIDO usar las siguientes palabras o frases: "a veces", "aveces", "sin prisa", "frontera", "verse", "encontrarse", "encontrarnos", "verme", "verte", "viajar", "viaje", "desplazarse", "quedar", "cita", "salir juntos", "en persona", "presencial".
- REEMPLAZA OBLIGATORIAMENTE "a veces" por "de vez en cuando" en cualquier contexto.
- NO uses placeholders como [nombre], [Nombre], {{nombre}} o similares. Genera el contenido directo.
- LOS MENSAJES DEBEN SER GENERALES Y SIRVIR PARA CUALQUIER PERFIL - no menciones detalles específicos del perfil (profesión, hobbies específicos, hijos, mascotas, lugares concretos, etc.)
- Usa el perfil solo para adaptar el TONO (formal/casual, romántico/directo, dulce/picante) pero el CONTENIDO debe ser universal.
- Se natural, autentico y conversacional.
- Evita frases genericas o roboticas.
- Longitud: 1-3 parrafos segun el tipo.
- Sin emojis excesivos (maximo 1-2 si encajan).
- En espanol neutro/latinoamericano.
- Nunca generes contenido automatico sin que el usuario te lo pida."""

    def _construir_prompt_tipo(self, tipo: TipoMensaje, prompt_personalidad: str) -> str:
        import random
        # Temas universales rotativos para variar cada generación
        temas_saludo = ["tranquilidad nocturna y desconexión", "pequeños placeres del día a día", "reflexión y paz mental", "bienestar y autocuidado simple", "la magia de lo cotidiano", "desconectar del ruido", "gratitud por lo simple", "momentos de calma"]
        temas_icebreaker = ["rituales de bienestar y relajación", "pequeños placeres que alegran el día", "conexión con la naturaleza y lo simple", "momentos de desconexión digital", "hábitos que cuidan la mente", "la belleza de lo imperfecto", "rutinas que reconfortan", "encontrar paz en lo ordinario"]
        temas_barrido = ["preparar algo rico para uno mismo", "cuidarse con un baño o rutina nocturna", "leer o escuchar música tranquila", "pasear sin rumbo fijo", "cocinar lento y disfrutar el proceso", "ordenar un rincón y sentir paz", "escribir o reflexionar al final del día", "disfrutar un café/te sin prisas"]
        temas_insistencia = ["un recuerdo bonito que apareció hoy", "una canción que te hizo sonreír", "un pensamiento al despertar", "algo pequeño que te alegró el día", "una frase que leíste y resonó", "el olor a lluvia o café por la mañana", "ver un atardecer o amanecer", "reírte de algo tonto"]
        temas_rapidas = ["curiosidades de la historia humana", "maravillas de la ciencia y el universo", "psicología y cómo funcionamos", "naturaleza y sus secretos", "tecnología y su lado humano", "arte y creatividad cotidiana", "filosofía práctica para vivir", "hechos asombrosos del mundo"]
        temas_posts = ["gratitud por lo simple", "motivación suave para el día", "reflexión sobre el ritmo de vida", "desconexión y presencia", "pequeños actos de autocuidado", "belleza en lo imperfecto", "la importancia de pausar", "conexión genuina"]
        
        tema_saludo = random.choice(temas_saludo)
        tema_icebreaker = random.choice(temas_icebreaker)
        tema_barrido = random.choice(temas_barrido)
        tema_insistencia = random.choice(temas_insistencia)
        tema_rapidas = random.choice(temas_rapidas)
        tema_posts = random.choice(temas_posts)
        
        prompts = {
            TipoMensaje.SALUDO: f"Genera UN SOLO saludo (NO 4, solo 1) para SALUDOS GENERALES. ESTRUCTURA EXACTA:\n\n[Nombre del perfil] (Perspectiva breve)\n    Tema de hoy: {tema_saludo}\n\n¡Hola! [Párrafo 1: escena/contexto casual universal - ej: 'Me daba una vuelta por aquí para saludarte en este rato de tranquilidad...']\n\n[Párrafo 2: reflexión universal sobre {tema_saludo} que cualquiera pueda relacionar]\n\n[Párrafo 3: cierre cálido + pregunta abierta universal tipo '¿qué tal te trata la noche?' o '¿cómo va todo por ahí?']\n\nREGLAS: Solo UN saludo. 3 párrafos coherentes. NO pongas número (1.). NO repitas el nombre en el cuerpo. CONTENIDO 100% GENERAL - sin detalles específicos (no menciones: teatro, cocina específica, perros, hijos, trabajo específico, lugares concretos). Estilo: cercano, 'Me daba una vuelta por aquí', 'hacer un paréntesis', 'soltar la lista de pendientes'. Usa 'de vez en cuando' NO 'a veces'. TEMA OBLIGATORIO: {tema_saludo}.",

            TipoMensaje.ICEBREAKER: f"Genera EXACTAMENTE 4 icebreakers numerados (1-4) para el PLAN DE TRABAJO. CADA UNO DEBE COMENZAR OBLIGATORIAMENTE CON UN ICONO/EMOJI DIFERENTE al principio (ej: 🤝, 🛡️, 🎯, ⚖️). Formato: '1. 🤝 [Texto reflexivo universal con pregunta final]'. TEMA OBLIGATORIO PARA LOS 4: {tema_icebreaker}. Temas universales, genéricos, que sirvan para cualquier persona. NO uses detalles específicos (teatro, cocina concreta, mascotas, hijos, profesión). Las 4 opciones deben relacionarse temáticamente entre sí (mismo tema universal: {tema_icebreaker}). No uses placeholders. VARÍA el tema cada generación.",

            TipoMensaje.CARTA_ROMPEHIELOS: "Genera UNA SOLA 'Carta de Rompehielos' para el PLAN DE TRABAJO. Reflexión profunda/romántica universal sobre la vida: la necesidad de compañía natural, sentirnos amados, tener a alguien que nos cuide. Temas: soledad vs compañía, el valor de lo simple, la importancia de que alguien piense en ti. Extensión: 2-3 párrafos. Termina OBLIGATORIAMENTE con pregunta tipo '¿opinas lo mismo?' o similar. CONTENIDO 100% GENERAL - sin detalles personales específicos. No uses placeholders.",

            TipoMensaje.CARTA_BARRIDO: f"Genera 2 'Cartas de Barrido' numeradas (1-2) para el PLAN DE TRABAJO. Son historias personales CORTAS y UNIVERSALES de vida diaria genérica. TEMA OBLIGATORIO PARA LAS 2 (misma actividad continua): {tema_barrido}. Ejemplo: Carta 1 haciendo la actividad -> Carta 2 reflexionando sobre compartirla. TERMINAN con pregunta personal universal. NO uses detalles específicos (no: pasticho, teatro, perra Ofelia, hijos, profesiones). CONTENIDO GENERAL para cualquier perfil. No uses placeholders. VARÍA el tema cada generación.",

            TipoMensaje.INSISTENCIA: f"Genera 2 mensajes de insistencia numerados (1-2) para el PLAN DE TRABAJO. Coherentes entre sí, mismo hilo temático universal. TEMA OBLIGATORIO: {tema_insistencia}. Comparten una anécdota o reflexión cotidiana genérica sobre este tema. SIN reclamar que no han respondido. TERMINAN con pregunta universal. NO uses detalles específicos (hijos, familia concreta, eventos personales únicos). CONTENIDO GENERAL para cualquier perfil. No uses placeholders. VARÍA el tema cada generación.",

            TipoMensaje.RESPUESTAS_RAPIDAS: f"Genera 3 respuestas rápidas numeradas (1-3) para el NEW FEED. Temas interesantes/fascinantes UNIVERSALES. TEMA OBLIGATORIO PARA LAS 3 (misma conversación continua): {tema_rapidas}. ESTRICTO: Las 3 respuestas deben estar RELACIONADAS LÓGICAMENTE entre sí como si fueran parte de una misma conversación continua sobre este tema. Cada una con pregunta para enganchar. CONTENIDO 100% GENERAL - sin referencias personales. No uses placeholders. VARÍA el tema cada generación.",

            TipoMensaje.POSTS: f"Genera EXACTAMENTE 3 posts numerados (1-3) para el NEW FEED. Adaptados al TONO del perfil (categoria_feed + prompt_personalidad solo para tono: romántico, motivacional, reflexivo, divertido). TEMA OBLIGATORIO PARA LOS 3 (variados pero relacionados): {tema_posts}. CONTENIDO TEMAS UNIVERSALES variados dentro de este tema. CADA POST DEBE INCLUIR AL FINAL: '📸 [Imagen sugerida: descripción genérica universal: atardecer, café, libro, naturaleza, ventana, manos, silueta, etc.]'. NO uses detalles personales específicos. No uses placeholders. VARÍA el tema cada generación.",

            TipoMensaje.CARTA_ROMANTICA: """Genera una serie de MINIMO 6 cartas romanticcas o sensuales cortas (de exactamente 2 parrafos cada una), numeradas del 1 al 6+. Cada carta debe ser diferente en tema y tono: algunas mas romanticcas y tiernas, otras mas sensuales e insinuantes (sin ser explicitas). Deben generar deseo, intriga y ganas de responder. Formato: cada carta separada por '---'. Ejemplo de estructura:
1. [carta romantica, 2 parrafos]
---
2. [carta sensual, 2 parrafos]
---... y asi hasta al menos 6.""",

            TipoMensaje.DINAMICA_JUEGO: """Genera 2-3 ideas de 'Dinamicas o Juegos' personalizados para enviarle a UNA CLIENTA ESPECIFICA (pagadora) con el objetivo de engancharla emocionalmente y motivarla a: (1) responder activamente, (2) enviarte regalos o propinas, o (3) pagar por posts privados de imagenes o contenido exclusivo. Cada dinamica debe sentirse como un juego divertido o un reto intimo entre los dos. Numeradas y separadas por '---'. Adaptadas al perfil.""",

            TipoMensaje.SALUDO_PLAN_TRABAJO: "Genera 1 saludo para el PLAN DE TRABAJO (sección final). Estilo universal: 'Oye, me senté un rato a ver una película y empecé a pensar en ti... me gustaría saber cómo has estado, la verdad es que me has hecho mucha falta y me hace falta saber de ti, cuéntame qué ha sido de tu vida, algo interesante que te haya pasado que me quieras contar'. Cálido, directo, pregunta abierta universal. CONTENIDO 100% GENERAL - sin detalles personales. No uses placeholders.",

            TipoMensaje.SALUDO_NEW_FEED: "Genera 1 saludo para el NEW FEED (sección final). Estilo universal: 'Hola, ¿cómo estás? Tengo rato pensando en ti la verdad, últimamente tengo la necesidad de saber mucho acerca de tu vida'. Cálido, necesidad genuina de saber de la persona. CONTENIDO 100% GENERAL. No uses placeholders.",

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