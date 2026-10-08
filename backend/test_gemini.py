from google import genai
from google.genai import types as genai_types
import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

client = genai.Client(api_key=api_key)
try:
    response = client.models.generate_content(
        model="gemini-3.8-flash",
        contents="Di hola en español",
        config=genai_types.GenerateContentConfig(
            system_instruction="Eres un asistente amigable.",
            temperature=0.8,
            max_output_tokens=100,
        )
    )
    print("SUCCESS:", response.text)
except Exception as e:
    import traceback
    traceback.print_exc()
