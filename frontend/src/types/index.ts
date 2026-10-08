export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  created_at: string;
  updated_at: string;
}

export interface Perfil {
  id: string;
  usuario_id: string;
  nombre_perfil: string;
  prompt_personalidad: string;
  categoria_feed: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export type TipoMensaje = 'saludo' | 'icebreaker' | 'carta_barrido' | 'insistencia' | 'carta_rompehielos' | 'respuestas_rapidas' | 'posts' | 'carta_romantica' | 'dinamica_juego';

export interface MensajeGenerado {
  id: string;
  perfil_id: string;
  tipo_mensaje: TipoMensaje;
  contenido: string;
  fecha_creacion: string;
}

export interface ImagenDescargada {
  id: string;
  usuario_id: string;
  url_origen: string;
  hash_imagen: string;
  etiqueta: string;
  fecha_registro: string;
}

export interface AuthTokens {
  access_token: string;
  token_type: string;
}

export interface ApiError {
  detail: string;
}

export const TIPO_MENSAJE_LABELS: Record<TipoMensaje, string> = {
  saludo: 'Saludo',
  icebreaker: 'Icebreakers',
  carta_barrido: 'Cartas de Barrido',
  insistencia: 'Mensajes de Insistencia',
  carta_rompehielos: 'Carta de Rompehielos',
  respuestas_rapidas: 'Respuestas Rápidas',
  posts: 'Posts (New Feed)',
  carta_romantica: 'Cartas Románticas/Sexys',
  dinamica_juego: 'Dinámicas y Juegos',
};

export const TIPO_MENSAJE_ICONS: Record<TipoMensaje, string> = {
  saludo: 'MessageCircle',
  icebreaker: 'Sparkles',
  carta_barrido: 'FileText',
  insistencia: 'RotateCcw',
  carta_rompehielos: 'Heart',
  respuestas_rapidas: 'Zap',
  posts: 'Layout',
  carta_romantica: 'Heart',
  dinamica_juego: 'Sparkles',
};