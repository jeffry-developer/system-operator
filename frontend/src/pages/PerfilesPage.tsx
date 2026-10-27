import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Copy, Loader2, Sparkles, RotateCcw as RefreshIcon, MessageCircle, Moon, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { Input, Label, Textarea } from '../components/Input';
import { Perfil } from '../types';
import { cn, copyToClipboard } from '../utils/helpers';

export function PerfilesPage() {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingPerfil, setEditingPerfil] = useState<Perfil | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renovandoSaludos, setRenovandoSaludos] = useState(false);
  const [saludosDocumento, setSaludosDocumento] = useState<string>('');
  const [saludosIndividuales, setSaludosIndividuales] = useState<{ nombre: string; texto: string; completo?: string }[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showIndividuales, setShowIndividuales] = useState(false);

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
    const storedDoc = localStorage.getItem('saludos_documento_unificado');
    if (storedDoc) setSaludosDocumento(storedDoc);
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
      success('Perfil creado con éxito');
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

  const handleCopyText = async (text: string, index?: number) => {
    try {
      await copyToClipboard(text);
      if (typeof index === 'number') {
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
      } else {
        setCopiedAll(true);
        setTimeout(() => setCopiedAll(false), 2000);
      }
      success('Copiado al portapapeles');
    } catch {
      showError('Error al copiar');
    }
  };

  const handleRenovarSaludos = async () => {
    setRenovandoSaludos(true);
    try {
      const data = await api.generarSaludosRapidos();
      if (data && typeof data === 'object') {
        if ('documento_completo' in data) {
          setSaludosDocumento(data.documento_completo);
          setSaludosIndividuales(data.saludos || []);
          localStorage.setItem('saludos_documento_unificado', data.documento_completo);
        } else if (Array.isArray(data)) {
          // Si vino array antiguo
          const doc = data.map((s: any, i: number) => `${i + 1}. ${s.nombre}\n\n${s.texto}`).join('\n\n');
          setSaludosDocumento(doc);
          setSaludosIndividuales(data);
          localStorage.setItem('saludos_documento_unificado', doc);
        }
      }
      success('Saludos unificados generados para noche y madrugada');
    } catch (err: any) {
      showError(err.response?.data?.detail || 'Error al renovar los saludos generales');
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
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Perfiles</h1>
          <p className="text-gray-600 dark:text-gray-400">Gestiona los perfiles y genera sus saludos de contacto</p>
        </div>
        <Button onClick={openCreateModal} className="bg-primary-600 hover:bg-primary-700 text-white shadow-sm">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Perfil
        </Button>
      </div>

      {/* RECUADRO ÚNICO DE SALUDOS (NOCHE Y MADRUGADA) */}
      <div className="bg-gradient-to-br from-purple-50/70 via-white to-pink-50/70 dark:from-purple-950/20 dark:via-gray-900 dark:to-pink-950/20 p-6 rounded-2xl border border-purple-100 dark:border-purple-900/50 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-purple-100 dark:border-purple-900/40">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-600 text-white">
                <Moon className="w-4 h-4" />
              </span>
              Saludos Generales (Noche y Madrugada)
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Un solo recuadro con todos los perfiles + 2 extras de cuido. Adaptados para noche o madrugada.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saludosDocumento && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyText(saludosDocumento)}
                className="text-xs font-semibold"
              >
                {copiedAll ? <Check className="w-4 h-4 mr-1 text-green-500" /> : <Copy className="w-4 h-4 mr-1" />}
                {copiedAll ? '¡Copiado Todo!' : 'Copiar Todo'}
              </Button>
            )}
            <Button
              onClick={handleRenovarSaludos}
              disabled={renovandoSaludos || perfiles.length === 0}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs"
            >
              {renovandoSaludos ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  Generando...
                </>
              ) : (
                <>
                  <RefreshIcon className="w-4 h-4 mr-1.5" />
                  Renovar Saludos
                </>
              )}
            </Button>
          </div>
        </div>

        {perfiles.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic py-4 text-center">
            Crea al menos un perfil para generar los saludos unificados nocturnos y de madrugada.
          </p>
        ) : !saludosDocumento ? (
          <div className="text-center py-8">
            <MessageCircle className="w-12 h-12 text-purple-300 dark:text-purple-700 mx-auto mb-2 opacity-50" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Haz clic en "Renovar Saludos" para generar el documento único de saludos para todos tus perfiles + 2 extras de cuido.
            </p>
            <Button
              onClick={handleRenovarSaludos}
              disabled={renovandoSaludos}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Sparkles className="w-4 h-4 mr-2" /> Generar Saludos Ahora
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* El Recuadro Único Unificado */}
            <div className="relative group bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm max-h-[60vh] overflow-y-auto">
              <div className="absolute top-3 right-3 opacity-80 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyText(saludosDocumento)}
                  className="bg-gray-100 dark:bg-gray-800 text-xs shadow-xs"
                  title="Copiar todo el recuadro"
                >
                  {copiedAll ? <Check className="w-3.5 h-3.5 mr-1 text-green-500" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {copiedAll ? '¡Copiado!' : 'Copiar Todo'}
                </Button>
              </div>

              <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed font-sans pr-16 space-y-4">
                {saludosDocumento}
              </div>
            </div>

            {/* Alternar vista de copia individual rápida si se desea */}
            {saludosIndividuales.length > 0 && (
              <div className="pt-2">
                <button
                  onClick={() => setShowIndividuales(!showIndividuales)}
                  className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                >
                  {showIndividuales ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {showIndividuales ? 'Ocultar saludos separados' : 'Ver y copiar cada saludo por separado'}
                </button>

                {showIndividuales && (
                  <div className="grid gap-3 sm:grid-cols-2 mt-3 pt-3 border-t border-purple-100 dark:border-purple-900/40">
                    {saludosIndividuales.map((saludo, idx) => (
                      <div
                        key={idx}
                        className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-between"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-bold text-gray-900 dark:text-gray-100 text-xs line-clamp-1">
                            {saludo.nombre}
                          </h4>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopyText(saludo.completo || `${saludo.nombre}\n\n${saludo.texto}`, idx)}
                            className="h-7 w-7 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 shrink-0"
                            title="Copiar este saludo"
                          >
                            {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3 leading-relaxed">
                          {saludo.texto}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grid de Perfiles */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Perfiles Activos</h2>
        {perfiles.length === 0 ? (
          <div className="card p-12 text-center bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
            <Sparkles className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">No hay perfiles</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">Crea tu primer perfil para empezar a generar mensajes</p>
            <Button onClick={openCreateModal} className="bg-primary-600 hover:bg-primary-700 text-white">
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
      </div>

      {/* Modal Crear / Editar Perfil */}
      <Modal
        isOpen={!!editingPerfil || isCreateModalOpen}
        onClose={resetForm}
        title={editingPerfil ? 'Editar Perfil' : 'Nuevo Perfil'}
      >
        <form onSubmit={editingPerfil ? handleUpdate : handleCreate} className="space-y-4">
          <div>
            <Label htmlFor="nombre_perfil">Nombre del perfil *</Label>
            <Input
              id="nombre_perfil"
              value={formData.nombre_perfil}
              onChange={(e) => setFormData({ ...formData, nombre_perfil: e.target.value })}
              placeholder="Ej: Sofía, Valentina, Mateo..."
              required
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="categoria_feed">Categoría del Feed</Label>
            <select
              id="categoria_feed"
              value={formData.categoria_feed}
              onChange={(e) => setFormData({ ...formData, categoria_feed: e.target.value })}
              className="input"
            >
              <option value="general">General / Aesthetic</option>
              <option value="estilo_de_vida">Estilo de vida</option>
              <option value="tecnologia">Tecnología</option>
              <option value="deportes">Deportes</option>
              <option value="entretenimiento">Entretenimiento</option>
            </select>
          </div>

          <div>
            <Label htmlFor="prompt_personalidad">Información del perfil (Contexto para la IA) *</Label>
            <textarea
              id="prompt_personalidad"
              value={formData.prompt_personalidad}
              onChange={(e) => setFormData({ ...formData, prompt_personalidad: e.target.value })}
              rows={6}
              className="input resize-none"
              placeholder="Describe el tono, estilo, hábitos, vocabulario, etc. Este contexto se usará para adaptar la voz de los mensajes."
              required
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Sé específico: formalidad, dulzura o picardía, temas de agrado...
            </p>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            <Button type="button" variant="secondary" onClick={resetForm} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={creating} className="flex-1 bg-primary-600 hover:bg-primary-700 text-white">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : editingPerfil ? 'Guardar Cambios' : 'Crear Perfil'}
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
    <div className="card p-5 hover:shadow-md transition-shadow bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate text-base">{perfil.nombre_perfil}</h3>
          <span
            className={cn(
              'badge mt-1 text-xs font-semibold',
              perfil.activo
                ? 'bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            )}
          >
            {perfil.activo ? 'Activo' : 'Inactivo'}
          </span>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <Button variant="ghost" size="icon" onClick={() => onEdit(perfil)} title="Editar">
            <Edit className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(perfil.id)} disabled={deleting} title="Eliminar">
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-red-600" />}
          </Button>
        </div>
      </div>

      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
          Categoría Feed
        </p>
        <span className="text-xs text-primary-700 dark:text-primary-300 font-medium bg-primary-50 dark:bg-primary-950/40 px-2.5 py-1 rounded-md border border-primary-100 dark:border-primary-900/40">
          {perfil.categoria_feed}
        </span>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
          Contexto IA
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3 leading-relaxed">
          {perfil.prompt_personalidad}
        </p>
      </div>
    </div>
  );
}
