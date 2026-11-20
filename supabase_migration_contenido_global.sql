-- Registro global y anónimo para evitar contenido repetido entre usuarios.
-- Solo guarda hashes SHA-256; nunca guarda el texto ni identifica al usuario.
CREATE TABLE IF NOT EXISTS contenido_generado_global (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo_mensaje VARCHAR(50) NOT NULL,
    contenido_hash CHAR(64) NOT NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT contenido_global_tipo_hash_key UNIQUE (tipo_mensaje, contenido_hash)
);

CREATE INDEX IF NOT EXISTS idx_contenido_global_fecha
    ON contenido_generado_global(fecha_creacion);

ALTER TABLE contenido_generado_global ENABLE ROW LEVEL SECURITY;

-- No se crean políticas para clientes. El backend usa service_role, que
-- omite RLS, y ningún usuario puede leer las huellas de otros usuarios.
