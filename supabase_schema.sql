-- ============================================================================
-- ESQUEMA SUPABASE MULTI-USUARIO CON RLS (ROW LEVEL SECURITY)
-- ============================================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLA: usuarios
-- ============================================================================
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TABLA: perfiles (DINÁMICOS - Modificables en cualquier momento)
-- ============================================================================
CREATE TABLE perfiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE NOT NULL,
    nombre_perfil VARCHAR(100) NOT NULL,
    prompt_personalidad TEXT NOT NULL,
    categoria_feed VARCHAR(50) DEFAULT 'general',
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TABLA: mensajes_generados
-- ============================================================================
CREATE TABLE mensajes_generados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    perfil_id UUID REFERENCES perfiles(id) ON DELETE CASCADE NOT NULL,
    tipo_mensaje VARCHAR(50) NOT NULL CHECK (tipo_mensaje IN ('saludo', 'icebreaker', 'carta_barrido', 'insistencia')),
    contenido TEXT NOT NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TABLA: imagenes_descargadas (CONTROL ANTI-REPETICIÓN)
-- ============================================================================
CREATE TABLE imagenes_descargadas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE NOT NULL,
    url_origen TEXT NOT NULL,
    hash_imagen VARCHAR(64) NOT NULL,
    etiqueta VARCHAR(50) DEFAULT 'romantica',
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(usuario_id, hash_imagen)
);

-- ============================================================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================================================
CREATE INDEX idx_perfiles_usuario_id ON perfiles(usuario_id);
CREATE INDEX idx_mensajes_perfil_id ON mensajes_generados(perfil_id);
CREATE INDEX idx_imagenes_usuario_id ON imagenes_descargadas(usuario_id);
CREATE INDEX idx_imagenes_hash ON imagenes_descargadas(hash_imagen);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - AISLAMIENTO DE DATOS POR USUARIO
-- ============================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes_generados ENABLE ROW LEVEL SECURITY;
ALTER TABLE imagenes_descargadas ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLÍTICAS RLS: usuarios
-- ============================================================================
-- Cada usuario solo ve su propio registro
CREATE POLICY "usuarios_select_own" ON usuarios
    FOR SELECT USING (auth.uid() = id);

-- Los usuarios pueden actualizar su propio perfil
CREATE POLICY "usuarios_update_own" ON usuarios
    FOR UPDATE USING (auth.uid() = id);

-- ============================================================================
-- POLÍTICAS RLS: perfiles
-- ============================================================================
-- Usuario ve solo sus perfiles
CREATE POLICY "perfiles_select_own" ON perfiles
    FOR SELECT USING (auth.uid() = usuario_id);

-- Usuario inserta sus propios perfiles
CREATE POLICY "perfiles_insert_own" ON perfiles
    FOR INSERT WITH CHECK (auth.uid() = usuario_id);

-- Usuario actualiza sus propios perfiles
CREATE POLICY "perfiles_update_own" ON perfiles
    FOR UPDATE USING (auth.uid() = usuario_id);

-- Usuario elimina sus propios perfiles
CREATE POLICY "perfiles_delete_own" ON perfiles
    FOR DELETE USING (auth.uid() = usuario_id);

-- ============================================================================
-- POLÍTICAS RLS: mensajes_generados
-- ============================================================================
-- Usuario ve mensajes de sus perfiles
CREATE POLICY "mensajes_select_own" ON mensajes_generados
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM perfiles p 
            WHERE p.id = mensajes_generados.perfil_id 
            AND p.usuario_id = auth.uid()
        )
    );

-- Sistema (service role) inserta mensajes generados
CREATE POLICY "mensajes_insert_service" ON mensajes_generados
    FOR INSERT WITH CHECK (true);

-- ============================================================================
-- POLÍTICAS RLS: imagenes_descargadas
-- ============================================================================
-- Usuario ve solo sus imágenes descargadas
CREATE POLICY "imagenes_select_own" ON imagenes_descargadas
    FOR SELECT USING (auth.uid() = usuario_id);

-- Usuario/Sistema inserta nuevas imágenes (verifica duplicados por hash)
CREATE POLICY "imagenes_insert_own" ON imagenes_descargadas
    FOR INSERT WITH CHECK (auth.uid() = usuario_id);

-- ============================================================================
-- FUNCIONES AUXILIARES
-- ============================================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_perfiles_updated_at BEFORE UPDATE ON perfiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCIÓN RPC: Verificar duplicado de imagen (para uso en API)
-- ============================================================================
CREATE OR REPLACE FUNCTION check_image_duplicate(
    p_usuario_id UUID,
    p_hash_imagen VARCHAR(64)
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM imagenes_descargadas 
        WHERE usuario_id = p_usuario_id 
        AND hash_imagen = p_hash_imagen
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCIÓN RPC: Registrar imagen nueva (para uso en API)
-- ============================================================================
CREATE OR REPLACE FUNCTION registrar_imagen_nueva(
    p_usuario_id UUID,
    p_url_origen TEXT,
    p_hash_imagen VARCHAR(64),
    p_etiqueta VARCHAR(50) DEFAULT 'romantica'
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO imagenes_descargadas (usuario_id, url_origen, hash_imagen, etiqueta)
    VALUES (p_usuario_id, p_url_origen, p_hash_imagen, p_etiqueta)
    ON CONFLICT (usuario_id, hash_imagen) DO NOTHING
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- DATOS DE EJEMPLO (OPCIONAL - Para testing)
-- ============================================================================
-- INSERT INTO usuarios (email, nombre) VALUES 
--     ('tu_email@ejemplo.com', 'Tú'),
--     ('hermano_email@ejemplo.com', 'Tu Hermano');