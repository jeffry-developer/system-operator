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
- NUNCA propongas ni hables de encontrarse, verse en persona, salir juntos o citas físicas.
- PROHIBIDO usar las siguientes palabras o frases: "aveces", "a veces", "sin prisa", "frontera".
- Sé natural, auténtico y conversacional.
- Adapta el tono exactamente a la personalidad descrita.
- Evita frases genéricas o robóticas.
- Longitud: 1-3 párrafos según el tipo.
- Sin emojis excesivos (máximo 1-2 si encajan).
- En español neutro/latinoamericano.
- Nunca generes contenido automático sin que el usuario te lo pida."""

    def _construir_prompt_tipo(self, tipo: TipoMensaje, prompt_personalidad: str) -> str:
        prompts = {
            TipoMensaje.SALUDO: "Genera opciones de saludos iniciales o de re-contacto. Todas las opciones deben estar relacionadas a un mismo contexto o temática para que sean consistentes entre sí. Deben ser cálidos, hacer saber que has estado pensando en la persona y terminar con una pregunta. Numerados.",

            TipoMensaje.ICEBREAKER: "Genera varias opciones (1-4) de rompehielos (icebreakers). CADA OPCIÓN DEBE COMENZAR OBLIGATORIAMENTE CON UN ÍCONO/EMOJI al principio. Pueden ser pensamientos reflexivos o preguntar sobre hábitos. Las opciones deben relacionarse temáticamente entre sí. Numerados.",

            TipoMensaje.CARTA_ROMPEHIELOS: "Genera una 'Carta de Rompehielos'. Es un solo mensaje, un poco más largo, con una reflexión profunda o romántica sobre la vida (ej. la necesidad de compañía natural) y termina con una pregunta tipo '¿opinas lo mismo?'.",

            TipoMensaje.CARTA_BARRIDO: "Genera opciones (1-2) de 'Cartas de Barrido'. Son historias personales cortas de tu vida diaria (ej. cocinar, cuidar de ti). Las opciones que generes deben estar fuertemente relacionadas entre sí, compartiendo el mismo contexto o historia. Numeradas.",

            TipoMensaje.INSISTENCIA: "Genera opciones (1-2) de mensajes de insistencia. Las opciones deben ser coherentes entre sí y seguir un mismo hilo temático. Deben compartir una pequeña anécdota personal o curiosidad. Sin reclamar que no han respondido. Numeradas.",

            TipoMensaje.RESPUESTAS_RAPIDAS: "Genera opciones (1-3) de respuestas rápidas sobre temas interesantes o fascinantes. ESTRICTO: Las respuestas deben estar relacionadas lógicamente entre sí como si fueran parte de una misma conversación. Numeradas.",

            TipoMensaje.POSTS: "Genera 3 ideas de posts o nuevas publicaciones (New Feed) para redes sociales, adaptadas completamente a la personalidad del perfil. Deben ser variadas, atractivas y estar numeradas.",

            TipoMensaje.CARTA_ROMANTICA: """Genera una serie de MÍNIMO 6 cartas románticas o sensuales cortas (de exactamente 2 párrafos cada una), numeradas del 1 al 6+. Cada carta debe ser diferente en tema y tono: algunas más románticas y tiernas, otras más sensuales e insinuantes (sin ser explícitas). Deben generar deseo, intriga y ganas de responder. Formato: cada carta separada por '---'. Ejemplo de estructura:
1. [carta romántica, 2 párrafos]
---
2. [carta sensual, 2 párrafos]
---... y así hasta al menos 6.""",

            TipoMensaje.DINAMICA_JUEGO: """Genera 2-3 ideas de 'Dinámicas o Juegos' personalizados para enviarle a UNA CLIENTA ESPECÍFICA (pagadora) con el objetivo de engancharla emocionalmente y motivarla a: (1) responder activamente, (2) enviarte regalos o propinas, o (3) pagar por posts privados de imágenes o contenido exclusivo. Cada dinámica debe sentirse como un juego divertido o un reto íntimo entre los dos. Numeradas y separadas por '---'."""
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