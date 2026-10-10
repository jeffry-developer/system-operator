import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Copy, Loader2, Sparkles, RotateCcw as RefreshIcon, MessageCircle } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { Input, Label } from '../components/Input';
import { Perfil } from '../types';
import { cn, copyToClipboard } from '../utils/helpers';

const DEFAULT_SALUDOS = [
  {
    nombre: "Cuido (Bienestar protector y mimo)",
    texto: "1. Cuido (Bienestar protector y mimo)\n\n¡Hola! Me daba una vuelta por aquí para saludarte en este rato de tranquilidad y asegurarme de que estés bien arropado. A estas horas, cuando el cuerpo ya pide calma, sienta de maravilla hacer un paréntesis, dejar los pendientes de lado y charlar de cosas más ligeras.\n\nOjalá estés encontrando un espacio cómodo para ti. Si sigues despierto y te apetece charlar un momento, cuéntame: ¿cómo te puedo consentir o qué necesitas para estar más a gusto en este ratito?"
  }
];

export function PerfilesPage() {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingPerfil, setEditingPerfil] = useState<Perfil | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renovandoSaludos, setRenovandoSaludos] = useState(false);
  const [saludosGenerales, setSaludosGenerales] = useState<{nombre: string, texto: string}[]>(() => {
    // No cargar de localStorage para evitar datos de otros usuarios
    return DEFAULT_SALUDOS;
  });
  const [formData, setFormData] = useState({
    nombre_perfil: '',
    prompt_personalidad: '',
    categoria_feed: 'general',
  });
  const { success, error: showError } = useToast();

  const fetchPerfiles = async () => {
    try {
      const data = await api.getPerfiles();
      setPerfiles(data);
    } catch (err) {
      showError('Error al cargar perfiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerfiles();
  }, []);

  const resetForm = () => {
    setFormData({ nombre_perfil: '', prompt_personalidad: '', categoria_feed: 'general' });
    setEditingPerfil(null);
    setIsCreateModalOpen(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const nuevo = await api.createPerfil(formData);
      setPerfiles([...perfiles, nuevo]);
      success('Perfil creado');
      resetForm();
    } catch (err) {
      showError('Error al crear perfil');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPerfil) return;
    setCreating(true);
    try {
      const actualizado = await api.updatePerfil(editingPerfil.id, formData);
      setPerfiles(perfiles.map((p) => (p.id === editingPerfil.id ? actualizado : p)));
      success('Perfil actualizado');
      resetForm();
    } catch (err) {
      showError('Error al actualizar perfil');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await api.deletePerfil(id);
      setPerfiles(perfiles.filter((p) => p.id !== id));
      success('Perfil eliminado');
    } catch (err) {
      showError('Error al eliminar perfil');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await copyToClipboard(text);
      success('Copiado al portapapeles');
    } catch {
      showError('Error al copiar');
    }
  };

  const handleRenovarSaludos = async () => {
    setRenovandoSaludos(true);
    try {
      const resultados = await api.generarSaludosRapidos();
      setSaludosGenerales(resultados);
      success('Saludos generales renovados para todos los perfiles');
    } catch (err) {
      showError('Error al renovar los saludos generales');
    } finally {
      setRenovandoSaludos(false);
    }
  };

  const openCreateModal = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const openEditModal = (perfil: Perfil) => {
    setFormData({
      nombre_perfil: perfil.nombre_perfil,
      prompt_personalidad: perfil.prompt_personalidad,
      categoria_feed: perfil.categoria_feed,
    });
    setEditingPerfil(perfil);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Perfiles</h1>
          <p className="text-gray-600">Gestiona tus perfiles y genera mensajes con IA</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Perfil
        </Button>
      </div>

      <div className="card p-6 bg-primary-50/50 border-primary-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary-600" />
            Saludos Generales (Copiar Rápidamente)
          </h2>
          <Button variant="outline" size="sm" onClick={handleRenovarSaludos} disabled={renovandoSaludos || perfiles.length === 0}>
            {renovandoSaludos ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshIcon className="w-4 h-4 mr-2" />}
            Renovar Todos
          </Button>
        </div>
        
        {perfiles.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Crea perfiles primero para generar sus saludos personalizados.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {saludosGenerales.map((saludo, idx) => (
              <div key={idx} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col h-full">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-gray-900 pr-2">{saludo.nombre}</h3>
                  <Button variant="ghost" size="icon" onClick={() => handleCopy(saludo.texto)} title="Copiar saludo" className="shrink-0">
                    <Copy className="w-4 h-4 text-primary-600" />
                  </Button>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-4" title={saludo.texto}>
                    {saludo.texto}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {perfiles.length === 0 ? (
        <div className="card p-12 text-center">
          <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay perfiles</h3>
          <p className="text-gray-600 mb-6">Crea tu primer perfil para empezar a generar mensajes</p>
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-2" />
            Crear Perfil
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {perfiles.map((perfil) => (
            <PerfilCard
              key={perfil.id}
              perfil={perfil}
              onEdit={openEditModal}
              onDelete={handleDelete}
              deleting={deletingId === perfil.id}
            />
          ))}
        </div>
      )}

      <Modal isOpen={!!editingPerfil || isCreateModalOpen} onClose={resetForm} title={editingPerfil ? 'Editar Perfil' : 'Nuevo Perfil'}>
        <form onSubmit={editingPerfil ? handleUpdate : handleCreate} className="space-y-4">
          <div>
            <Label htmlFor="nombre_perfil">Nombre del perfil</Label>
            <Input
              id="nombre_perfil"
              value={formData.nombre_perfil}
              onChange={(e) => setFormData({ ...formData, nombre_perfil: e.target.value })}
              placeholder="Ej: Perfil Romántico"
              required
            />
          </div>

          <div>
            <Label htmlFor="categoria_feed">Categoría de feed</Label>
            <select
              id="categoria_feed"
              value={formData.categoria_feed}
              onChange={(e) => setFormData({ ...formData, categoria_feed: e.target.value })}
              className="input"
            >
              <option value="general">General</option>
              <option value="estilo_de_vida">Estilo de vida</option>
              <option value="tecnologia">Tecnología</option>
              <option value="deportes">Deportes</option>
              <option value="entretenimiento">Entretenimiento</option>
            </select>
          </div>

          <div>
            <Label htmlFor="prompt_personalidad">Información del perfil (Contexto para la IA)</Label>
            <textarea
              id="prompt_personalidad"
              value={formData.prompt_personalidad}
              onChange={(e) => setFormData({ ...formData, prompt_personalidad: e.target.value })}
              rows={6}
              className="input resize-none"
              placeholder="Describe la personalidad, tono, estilo, hábitos, vocabulario, etc. Este prompt se usará para generar todos los mensajes."
              required
            />
            <p className="mt-1 text-xs text-gray-500">Sé específico: tono, vocabulario, longitud típica, emojis, formalidad, temas de interés...</p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={resetForm} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={creating} className="flex-1">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : editingPerfil ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function PerfilCard({
  perfil,
  onEdit,
  onDelete,
  deleting,
}: {
  perfil: Perfil;
  onEdit: (p: Perfil) => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  return (
    <div className="card p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate text-base">{perfil.nombre_perfil}</h3>
          <span className={cn('badge mt-1 text-xs', perfil.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800')}>
            {perfil.activo ? 'Activo' : 'Inactivo'}
          </span>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <Button variant="ghost" size="icon" onClick={() => onEdit(perfil)} title="Editar">
            <Edit className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(perfil.id)} disabled={deleting} title="Eliminar">
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-red-600" />}
          </Button>
        </div>
      </div>

      <div className="mb-3">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Categoría Feed</p>
        <span className="text-sm text-primary-700 font-medium bg-primary-50 px-2 py-0.5 rounded">{perfil.categoria_feed}</span>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Contexto IA</p>
        <p className="text-sm text-gray-600 line-clamp-4">{perfil.prompt_personalidad}</p>
      </div>
    </div>
  );
}
