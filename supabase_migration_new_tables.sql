-- ============================================================================
-- MIGRACIÓN: NUEVAS TABLAS PARA PAGADORAS E HISTORIAS
-- Ejecutar en Supabase > SQL Editor
-- ============================================================================

-- ============================================================================
-- TABLAS NUEVAS
-- ============================================================================

-- TABLA: cartas_pagadoras (MARCADORES DE PAGADORAS)
CREATE TABLE IF NOT EXISTS cartas_pagadoras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    perfil_id UUID REFERENCES perfiles(id) ON DELETE CASCADE NOT NULL,
    nombre_pagadora VARCHAR(100) NOT NULL,
    ultima_carta_numero INTEGER DEFAULT 0,
    ultima_carta_tipo VARCHAR(50) DEFAULT 'romantica',
    notas TEXT DEFAULT '',
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(perfil_id, nombre_pagadora)
);

-- TABLA: historias_guardadas (HISTORIAS OPCIONALES PARA REUTILIZAR)
CREATE TABLE IF NOT EXISTS historias_guardadas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    perfil_id UUID REFERENCES perfiles(id) ON DELETE CASCADE NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    tipo VARCHAR(50) NOT NULL, -- romantica, sensual, sexual, personalizada
    contenido TEXT NOT NULL,
    pagadora_asociada VARCHAR(100),
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ÍNDICES NUEVOS
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_cartas_pagadoras_perfil_id ON cartas_pagadoras(perfil_id);
CREATE INDEX IF NOT EXISTS idx_historias_perfil_id ON historias_guardadas(perfil_id);

-- ============================================================================
-- RLS PARA TABLAS NUEVAS
-- ============================================================================
ALTER TABLE cartas_pagadoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE historias_guardadas ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS: cartas_pagadoras
CREATE POLICY "cartas_pagadoras_select_own" ON cartas_pagadoras
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM perfiles p 
            WHERE p.id = cartas_pagadoras.perfil_id 
            AND p.usuario_id = auth.uid()
        )
    );

CREATE POLICY "cartas_pagadoras_insert_own" ON cartas_pagadoras
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM perfiles p 
            WHERE p.id = cartas_pagadoras.perfil_id 
            AND p.usuario_id = auth.uid()
        )
    );

CREATE POLICY "cartas_pagadoras_update_own" ON cartas_pagadoras
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM perfiles p 
            WHERE p.id = cartas_pagadoras.perfil_id 
            AND p.usuario_id = auth.uid()
        )
    );

-- POLÍTICAS: historias_guardadas
CREATE POLICY "historias_select_own" ON historias_guardadas
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM perfiles p 
            WHERE p.id = historias_guardadas.perfil_id 
            AND p.usuario_id = auth.uid()
        )
    );

CREATE POLICY "historias_insert_own" ON historias_guardadas
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM perfiles p 
            WHERE p.id = historias_guardadas.perfil_id 
            AND p.usuario_id = auth.uid()
        )
    );

CREATE POLICY "historias_update_own" ON historias_guardadas
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM perfiles p 
            WHERE p.id = historias_guardadas.perfil_id 
            AND p.usuario_id = auth.uid()
        )
    );

CREATE POLICY "historias_delete_own" ON historias_guardadas
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM perfiles p 
            WHERE p.id = historias_guardadas.perfil_id 
            AND p.usuario_id = auth.uid()
        )
    );

-- ============================================================================
-- TRIGGER PARA updated_at EN cartas_pagadoras
-- (usa la función update_updated_at_column() que ya debería existir)
-- ============================================================================
CREATE TRIGGER update_cartas_pagadoras_fecha BEFORE UPDATE ON cartas_pagadoras
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VERIFICACIÓN: La función update_updated_at_column() debe existir.
-- Si NO existe (error al crear trigger), descomenta y ejecuta lo siguiente:
-- ============================================================================
-- CREATE OR REPLACE FUNCTION update_updated_at_column()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     NEW.updated_at = NOW();
--     RETURN NEW;
-- END;
-- $$ language 'plpgsql';