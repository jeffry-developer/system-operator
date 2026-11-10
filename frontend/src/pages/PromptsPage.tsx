import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Copy, Edit2, FileCode2, ImagePlus, Loader2, Plus, Search, Trash2, X } from 'lucide-react';

import { api } from '../services/api';
import { PromptGuardado } from '../types';
import { Button } from '../components/Button';
import { Input, Label, Textarea } from '../components/Input';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { copyToClipboard } from '../utils/helpers';

type PromptForm = { nombre: string; categoria: string; contenido: string; imagenes: string[] };

const emptyForm = (): PromptForm => ({ nombre: '', categoria: '', contenido: '', imagenes: [] });
const MAX_IMAGES = 6;

function prepareImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selecciona únicamente archivos de imagen'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      reject(new Error('Cada imagen debe pesar menos de 10 MB'));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const source = new Image();
    source.onload = () => {
      const maxSide = 1400;
      const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(source.width * scale));
      canvas.height = Math.max(1, Math.round(source.height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('No se pudo procesar la imagen'));
        return;
      }
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/webp', 0.82);
      URL.revokeObjectURL(objectUrl);
      if (dataUrl.length > 2_500_000) {
        reject(new Error('La imagen sigue siendo demasiado grande después de optimizarla'));
        return;
      }
      resolve(dataUrl);
    };
    source.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer una de las imágenes'));
    };
    source.src = objectUrl;
  });
}

export function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptGuardado[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<PromptGuardado | null>(null);
  const [form, setForm] = useState<PromptForm>(emptyForm);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { success, error: showError } = useToast();

  const loadPrompts = async () => {
    setLoading(true);
    try {
      setPrompts(await api.getPrompts());
    } catch (error: any) {
      showError(error.message || 'No se pudieron cargar los prompts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPrompts(); }, []);

  const filteredPrompts = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return prompts;
    return prompts.filter((prompt) =>
      `${prompt.nombre} ${prompt.categoria} ${prompt.contenido}`.toLocaleLowerCase().includes(term)
    );
  }, [prompts, query]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setIsModalOpen(true);
  };

  const openEdit = (prompt: PromptGuardado) => {
    setEditing(prompt);
    setForm({
      nombre: prompt.nombre,
      categoria: prompt.categoria,
      contenido: prompt.contenido,
      imagenes: prompt.imagenes || [],
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const data = {
      nombre: form.nombre.trim(),
      categoria: form.categoria.trim() || 'General',
      contenido: form.contenido.trim(),
      imagenes: form.imagenes,
    };
    if (!data.nombre || !data.contenido) {
      showError('Escribe un nombre y el contenido del prompt');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const updated = await api.updatePrompt(editing.id, data);
        setPrompts((current) => current.map((prompt) => prompt.id === editing.id ? updated : prompt));
        success('Prompt actualizado');
      } else {
        const created = await api.createPrompt(data);
        setPrompts((current) => [created, ...current]);
        success('Prompt guardado');
      }
      setIsModalOpen(false);
    } catch (error: any) {
      showError(error.message || 'No se pudo guardar el prompt');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (prompt: PromptGuardado) => {
    if (!confirm(`¿Eliminar el prompt "${prompt.nombre}"?`)) return;
    try {
      await api.deletePrompt(prompt.id);
      setPrompts((current) => current.filter((item) => item.id !== prompt.id));
      success('Prompt eliminado');
    } catch (error: any) {
      showError(error.message || 'No se pudo eliminar el prompt');
    }
  };

  const handleCopy = async (content: string) => {
    try {
      await copyToClipboard(content);
      success('Prompt copiado');
    } catch {
      showError('No se pudo copiar');
    }
  };

  const handleImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    const available = MAX_IMAGES - form.imagenes.length;
    if (available <= 0) {
      showError(`Puedes agregar hasta ${MAX_IMAGES} imágenes`);
      return;
    }
    if (files.length > available) {
      showError(`Solo se agregarán ${available} imágenes para no superar el límite`);
    }

    try {
      const prepared = await Promise.all(files.slice(0, available).map(prepareImage));
      setForm((current) => ({ ...current, imagenes: [...current.imagenes, ...prepared] }));
    } catch (error: any) {
      showError(error.message || 'No se pudieron procesar las imágenes');
    }
  };

  const removeImage = (index: number) => {
    setForm((current) => ({
      ...current,
      imagenes: current.imagenes.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-gray-900 dark:text-gray-100">
            <span className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-900/40"><FileCode2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /></span>
            Biblioteca de Prompts
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Crea prompts con imágenes de referencia para cuadrículas, barridos de carta o cualquier otra tarea.</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nuevo prompt</Button>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, categoría o contenido..." className="pl-10" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary-600" /></div>
      ) : filteredPrompts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center dark:border-gray-700 dark:bg-gray-900">
          <FileCode2 className="mx-auto mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
          <h2 className="font-semibold text-gray-800 dark:text-gray-200">{query ? 'No hay resultados' : 'Aún no tienes prompts guardados'}</h2>
          {!query && <Button onClick={openCreate} variant="outline" size="sm" className="mt-4"><Plus className="mr-2 h-4 w-4" />Crear el primero</Button>}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPrompts.map((prompt) => (
            <article key={prompt.id} className="flex min-h-64 flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">{prompt.categoria}</span>
                  <h2 className="mt-2 truncate font-bold text-gray-900 dark:text-gray-100">{prompt.nombre}</h2>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(prompt)} title="Editar prompt"><Edit2 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(prompt)} title="Eliminar prompt" className="text-red-500"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/50">
                <p className="line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed text-gray-600 dark:text-gray-300">{prompt.contenido}</p>
              </div>
              {!!prompt.imagenes?.length && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {prompt.imagenes.map((image, index) => (
                    <button key={index} type="button" onClick={() => setPreviewImage(image)} className="aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800" title="Ver imagen">
                      <img src={image} alt={`Referencia ${index + 1} de ${prompt.nombre}`} className="h-full w-full object-cover transition-transform hover:scale-105" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
              <Button onClick={() => handleCopy(prompt.contenido)} className="mt-4 w-full"><Copy className="mr-2 h-4 w-4" />Copiar prompt</Button>
            </article>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? 'Editar prompt' : 'Nuevo prompt'}>
        <div className="space-y-4">
          <div><Label htmlFor="prompt-name">Nombre</Label><Input id="prompt-name" value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} placeholder="Ejemplo: Cuadrícula de nueve fotos" /></div>
          <div><Label htmlFor="prompt-category">Categoría</Label><Input id="prompt-category" value={form.categoria} onChange={(event) => setForm({ ...form, categoria: event.target.value })} placeholder="Ejemplo: Cuadrículas o Barridos de carta" /></div>
          <div><Label htmlFor="prompt-content">Contenido del prompt</Label><Textarea id="prompt-content" value={form.contenido} onChange={(event) => setForm({ ...form, contenido: event.target.value })} placeholder="Escribe aquí el prompt completo..." rows={12} /></div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <Label className="mb-0">Imágenes de referencia</Label>
              <span className="text-xs text-gray-400">{form.imagenes.length}/{MAX_IMAGES}</span>
            </div>
            <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleImages} className="hidden" />
            <Button type="button" variant="outline" onClick={() => imageInputRef.current?.click()} disabled={form.imagenes.length >= MAX_IMAGES} className="w-full">
              <ImagePlus className="mr-2 h-4 w-4" />Agregar imágenes
            </Button>
            {!!form.imagenes.length && (
              <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {form.imagenes.map((image, index) => (
                  <div key={index} className="group relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
                    <img src={image} alt={`Imagen de referencia ${index + 1}`} className="h-full w-full object-cover" />
                    <button type="button" onClick={() => removeImage(index)} className="absolute right-1.5 top-1.5 rounded-full bg-red-600 p-1 text-white shadow hover:bg-red-700" title="Quitar imagen" aria-label="Quitar imagen">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-gray-400">Hasta seis imágenes. Se optimizan automáticamente antes de guardarse.</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing ? 'Guardar cambios' : 'Crear prompt'}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!previewImage} onClose={() => setPreviewImage(null)} title="Imagen de referencia" size="xl">
        {previewImage && <img src={previewImage} alt="Imagen de referencia ampliada" className="mx-auto max-h-[70vh] max-w-full rounded-xl object-contain" />}
      </Modal>
    </div>
  );
}
