-- Biblioteca personal de prompts. Ejecutar una vez en Supabase > SQL Editor.
CREATE TABLE IF NOT EXISTS prompts_guardados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE NOT NULL,
    nombre VARCHAR(160) NOT NULL,
    categoria VARCHAR(100) NOT NULL DEFAULT 'General',
    contenido TEXT NOT NULL,
    imagenes JSONB NOT NULL DEFAULT '[]'::jsonb,
    orden INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Compatible con instalaciones donde la tabla se creó antes de añadir imágenes.
ALTER TABLE prompts_guardados
    ADD COLUMN IF NOT EXISTS imagenes JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE prompts_guardados
    ADD COLUMN IF NOT EXISTS orden INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_prompts_guardados_usuario_id
    ON prompts_guardados(usuario_id);

ALTER TABLE prompts_guardados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prompts_select_own" ON prompts_guardados;
CREATE POLICY "prompts_select_own" ON prompts_guardados
    FOR SELECT USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "prompts_insert_own" ON prompts_guardados;
CREATE POLICY "prompts_insert_own" ON prompts_guardados
    FOR INSERT WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "prompts_update_own" ON prompts_guardados;
CREATE POLICY "prompts_update_own" ON prompts_guardados
    FOR UPDATE USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "prompts_delete_own" ON prompts_guardados;
CREATE POLICY "prompts_delete_own" ON prompts_guardados
    FOR DELETE USING (auth.uid() = usuario_id);

DROP TRIGGER IF EXISTS update_prompts_guardados_updated_at ON prompts_guardados;
CREATE TRIGGER update_prompts_guardados_updated_at BEFORE UPDATE ON prompts_guardados
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
