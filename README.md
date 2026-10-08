# System Operator - Proyecto Completo

Aplicación web 100% gratuita, multi-usuario, para gestión de perfiles dinámicos con generación de mensajes por IA y scraping de imágenes anti-duplicados.

## 🎯 Objetivo

Sistema accesible desde cualquier navegador con credenciales individuales (tú y tu hermano), que permite:
- Crear/editar/eliminar perfiles dinámicamente
- Asociar prompts de personalidad a cada perfil
- Generar mensajes automáticos con IA (Gemini/Groq)
- Scraping de imágenes (Pinterest/bancos libres) con control anti-duplicados por usuario
- Feeds y planes de trabajo personalizados por perfil

## 🏗️ Arquitectura

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Backend       │────▶│   Supabase      │
│   React + TS    │     │   FastAPI       │     │   PostgreSQL    │
│   Tailwind      │     │   Python        │     │   + Auth        │
│   Vercel        │     │   Render.com    │     │   (Gratis)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │
                        ┌───────┴───────┐
                        ▼               ▼
                   ┌─────────┐    ┌──────────┐
                   │ Gemini  │    │  Playwright│
                   │ / Groq  │    │  BeautifulSoup
                   └─────────┘    └──────────┘
```

## 📁 Estructura del Proyecto

```
system-operator/
├── supabase_schema.sql          # Esquema BD + RLS
├── docker-compose.yml           # Desarrollo local
├── plan-trabajo.txt             # Plan original
├── backend/                     # API FastAPI
│   ├── app/
│   │   ├── api/                 # Endpoints REST
│   │   ├── core/                # Config + DB
│   │   ├── models/              # Modelos Pydantic
│   │   └── services/            # Lógica negocio
│   ├── requirements.txt
│   ├── Dockerfile
│   └── README.md
└── frontend/                    # Web React
    ├── src/
    │   ├── components/          # UI reutilizable
    │   ├── pages/               # Páginas
    │   ├── context/             # Auth Context
    │   ├── services/            # API client
    │   ├── types/               # Types TS
    │   └── utils/               # Helpers
    ├── package.json
    ├── Dockerfile / Dockerfile.dev
    └── README.md
```

## 🚀 Inicio Rápido (Docker)

```bash
# 1. Clonar y entrar
cd system-operator

# 2. Configurar variables de entorno
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Editar backend/.env con tus credenciales

# 3. Ejecutar esquema SQL en Supabase
# Copiar contenido de supabase_schema.sql al SQL Editor de Supabase

# 4. Levantar todo
docker-compose up --build

# 5. Acceder
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000/docs
```

## 🔧 Variables de Entorno (Backend)

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `SUPABASE_URL` | ✅ | URL proyecto Supabase |
| `SUPABASE_KEY` | ✅ | Anon key |
| `SUPABASE_SERVICE_KEY` | ✅ | Service role key |
| `AI_PROVIDER` | ✅ | `gemini` o `groq` |
| `GEMINI_API_KEY` | Si provider=gemini | Google AI Studio |
| `GROQ_API_KEY` | Si provider=groq | Groq Cloud |
| `SECRET_KEY` | ✅ | Clave JWT (32+ chars) |
| `UNSPLASH_ACCESS_KEY` | No | Para bancos libres |

## 🗄️ Base de Datos (Supabase)

Ejecutar `supabase_schema.sql` en el **SQL Editor** de Supabase. Crea:

- **usuarios** - Cuentas individuales (auth + profile)
- **perfiles** - Perfiles dinámicos por usuario (prompt, categoría feed)
- **mensajes_generados** - Historial por perfil y tipo
- **imagenes_descargadas** - Control anti-duplicados (hash único por usuario)

**RLS (Row Level Security)**: Aísla datos entre usuarios automáticamente.

## 🌐 Despliegue Producción

### Backend → Render.com
1. Conectar repo GitHub
2. Build: `pip install -r requirements.txt && playwright install chromium`
3. Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Env vars: Agregar todas las del `.env`

### Frontend → Vercel
1. Conectar repo GitHub
2. Framework: Vite
3. Build: `npm run build`
4. Output: `dist`
5. Env: `VITE_API_URL=https://tu-api.render.com/api/v1`

### Supabase
- Ya configurado en la nube (gratis hasta 500MB)

## 📡 API Endpoints

### Auth
```
POST /api/v1/auth/register    # Registrar
POST /api/v1/auth/login       # Login
GET  /api/v1/auth/me          # Usuario actual
```

### Perfiles
```
GET    /api/v1/perfiles                    # Listar
POST   /api/v1/perfiles                    # Crear
GET    /api/v1/perfiles/{id}               # Obtener
PUT    /api/v1/perfiles/{id}               # Actualizar
DELETE /api/v1/perfiles/{id}               # Eliminar
POST   /api/v1/perfiles/{id}/generar-mensajes  # Generar con IA
GET    /api/v1/perfiles/{id}/ultimos-mensajes  # Últimos por tipo
```

### Imágenes
```
GET  /api/v1/imagenes                    # Galería
POST /api/v1/imagenes/scrape             # Scraper Pinterest
POST /api/v1/imagenes/scrape/bancos-libres  # Bancos libres (Unsplash)
DELETE /api/v1/imagenes/{id}             # Eliminar
```

## 💻 Desarrollo Local (Sin Docker)

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
cp .env.example .env
# Editar .env
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
# http://localhost:3000
```

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest tests/

# Frontend lint
cd frontend
npm run lint
```

## 📋 Próximos Pasos (Roadmap)

- [ ] Módulo 3: Feeds RSS + Plan de trabajo diario por IA
- [ ] Notificaciones push / email
- [ ] Exportar mensajes (CSV, JSON)
- [ ] Modo oscuro
- [ ] PWA (instalable)
- [ ] Tests E2E (Playwright)
- [ ] CI/CD GitHub Actions

## 🤝 Contribuir

1. Fork del repo
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Add: nueva funcionalidad'`)
4. Push (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 📄 Licencia

MIT License - Libre para uso personal y comercial.

---

**Desarrollado con ❤️ para automatizar y simplificar la gestión de perfiles y contenido.**