# System Operator - Frontend

Interfaz web en React + TypeScript + Tailwind CSS para el sistema multi-usuario.

## Stack
- **React 18** + **TypeScript**
- **Vite** - Build tool ultrarrápido
- **Tailwind CSS** - Estilos utility-first
- **React Router v6** - Enrutamiento
- **Axios** - Cliente HTTP
- **Supabase JS** - Cliente auth (opcional, usando API propia)
- **Lucide React** - Iconos

## Estructura
```
frontend/
├── src/
│   ├── components/     # Componentes reutilizables (Button, Input, Modal, Toast, Layout)
│   ├── pages/          # Páginas (Login, Register, Perfiles, Mensajes, Imágenes)
│   ├── context/        # React Context (Auth)
│   ├── services/       # Servicios API (axios)
│   ├── types/          # Types TypeScript
│   ├── utils/          # Helpers
│   ├── App.tsx         # Rutas principales
│   ├── main.tsx        # Entry point
│   └── index.css       # Estilos globales + Tailwind
├── public/
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── .env.example
```

## Instalación

```bash
cd frontend
npm install
cp .env.example .env
# Editar .env si necesitas cambiar la URL de la API
```

## Desarrollo

```bash
npm run dev
# Abre en http://localhost:3000
```

## Build Producción

```bash
npm run build
# Output en dist/
```

## Preview Build

```bash
npm run preview
```

## Despliegue en Vercel

1. Conectar repo GitHub
2. Framework Preset: Vite
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Environment Variables: `VITE_API_URL=https://tu-api.render.com/api/v1`

## Páginas

| Ruta | Descripción |
|------|-------------|
| `/login` | Inicio de sesión |
| `/register` | Registro de usuario |
| `/perfiles` | CRUD perfiles + generar mensajes IA |
| `/mensajes` | Ver y regenerar mensajes por perfil |
| `/imagenes` | Galería + scraper Pinterest/bancos libres |

## Características UI

- **Responsive**: Mobile-first, sidebar colapsable en móvil
- **Tema**: Rosa/Primary personalizable en tailwind.config.js
- **Toast**: Notificaciones éxito/error/warning/info
- **Modales**: Accesibles (ESC para cerrar, focus trap)
- **Copiar al portapapeles**: Un click en cualquier mensaje
- **Lazy loading**: Imágenes en galería
- **Estados de carga**: Skeletons y spinners