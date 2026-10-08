# System Operator - Backend API

API REST en FastAPI para el sistema multi-usuario de perfiles dinámicos, generación de mensajes con IA y scraping de imágenes anti-duplicados.

## Stack
- **FastAPI** - Framework web moderno y rápido
- **Supabase** - PostgreSQL + Auth + Realtime
- **Google Gemini / Groq** - Generación de texto con IA
- **Playwright + BeautifulSoup** - Scraping de imágenes
- **Pydantic** - Validación de datos

## Estructura
```
backend/
├── app/
│   ├── api/           # Endpoints REST
│   │   ├── auth.py    # Login/Register
│   │   ├── perfiles.py # CRUD perfiles + generación mensajes
│   │   └── imagenes.py # Galería + Scraper
│   ├── core/          # Configuración y DB
│   ├── models/        # Modelos Pydantic
│   └── services/      # Lógica de negocio
│       ├── ai_service.py      # Integración Gemini/Groq
│       ├── supabase_service.py # Operaciones BD
│       └── scraper_service.py  # Scraping anti-duplicados
├── requirements.txt
├── .env.example
└── main.py
```

## Instalación

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
playwright install chromium
cp .env.example .env
# Editar .env con tus credenciales
```

## Variables de entorno (.env)

| Variable | Descripción |
|----------|-------------|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_KEY` | Anon key de Supabase |
| `SUPABASE_SERVICE_KEY` | Service role key (para admin) |
| `AI_PROVIDER` | `gemini` o `groq` |
| `GEMINI_API_KEY` | API key de Google AI Studio |
| `GROQ_API_KEY` | API key de Groq Cloud |
| `SECRET_KEY` | Clave secreta para JWT |
| `UNSPLASH_ACCESS_KEY` | (Opcional) Para bancos libres |

## Ejecutar

```bash
# Desarrollo
uvicorn app.main:app --reload --port 8000

# Producción
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Endpoints Principales

### Auth
- `POST /api/v1/auth/register` - Registrar usuario
- `POST /api/v1/auth/login` - Iniciar sesión
- `GET /api/v1/auth/me` - Usuario actual

### Perfiles
- `POST /api/v1/perfiles` - Crear perfil
- `GET /api/v1/perfiles` - Listar perfiles
- `GET /api/v1/perfiles/{id}` - Obtener perfil
- `PUT /api/v1/perfiles/{id}` - Actualizar perfil
- `DELETE /api/v1/perfiles/{id}` - Eliminar perfil
- `POST /api/v1/perfiles/{id}/generar-mensajes` - Generar mensajes con IA
- `GET /api/v1/perfiles/{id}/ultimos-mensajes` - Últimos mensajes por tipo

### Imágenes
- `GET /api/v1/imagenes` - Galería del usuario
- `POST /api/v1/imagenes/scrape` - Scraper Pinterest
- `POST /api/v1/imagenes/scrape/bancos-libres` - Scraper Unsplash/Pexels
- `DELETE /api/v1/imagenes/{id}` - Eliminar imagen

## Base de Datos

Ejecutar `supabase_schema.sql` en el SQL Editor de Supabase para crear:
- Tablas: usuarios, perfiles, mensajes_generados, imagenes_descargadas
- RLS (Row Level Security) para aislamiento multi-usuario
- Funciones RPC para anti-duplicados

## Despliegue en Render.com

1. Conectar repo GitHub
2. Build Command: `pip install -r requirements.txt && playwright install chromium`
3. Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Agregar variables de entorno en Render Dashboard