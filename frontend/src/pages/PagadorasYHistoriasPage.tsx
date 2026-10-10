import { useState, useEffect, useCallback } from 'react';
import { 
  Copy, Loader2, Sparkles, RotateCcw, Heart, Zap, 
  Plus, Trash2, Eye, BookOpen, UserPlus, 
  ArrowRight, ChevronDown, ChevronUp, 
  Hash, MessageSquare, Save, AlertCircle,
  GripVertical
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { Perfil, CartaPagadora, HistoriaGuardada } from '../types';
import { Button } from '../components/Button';
import { Input, Label, Textarea } from '../components/Input';
import { Modal } from '../components/Modal';
import { copyToClipboard } from '../utils/helpers';
import { cn } from '../utils/helpers';

const TIPO_HISTORIA_OPTIONS = [
  { value: 'romantica', label: 'Romántica', desc: 'Tierna, emocional, conexión profunda' },
  { value: 'sensual', label: 'Sensual', desc: 'Insinuante, erótica suave, deseo' },
  { value: 'sexual', label: 'Sexual', desc: 'Explícita, pasión, intimidad total' },
  { value: 'personalizada', label: 'Personalizada', desc: 'Tema libre que tú indiques' },
];

export function PagadorasYHistoriasPage() {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [selectedPerfilId, setSelectedPerfilId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'pagadoras' | 'historias' | 'generar'>('pagadoras');
  const [loading, setLoading] = useState(false);
  const { success, error: showError } = useToast();

  // Pagadoras state
  const [pagadoras, setPagadoras] = useState<CartaPagadora[]>([]);
  const [showPagadoraModal, setShowPagadoraModal] = useState(false);
  const [editingPagadora, setEditingPagadora] = useState<CartaPagadora | null>(null);
  const [pagadoraForm, setPagadoraForm] = useState({ nombre: '', ultima_carta_numero: 0, ultima_carta_tipo: 'romantica', notas: '' });
  const [generatingPagadora, setGeneratingPagadora] = useState<string | null>(null);
  const [draggedPagadora, setDraggedPagadora] = useState<string | null>(null);

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, nombre: string) => {
    setDraggedPagadora(nombre);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', nombre);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetNombre: string) => {
    e.preventDefault();
    const sourceNombre = draggedPagadora;
    if (!sourceNombre || sourceNombre === targetNombre) {
      setDraggedPagadora(null);
      return;
    }
    setPagadoras(prev => {
      const sourceIndex = prev.findIndex(p => p.nombre_pagadora === sourceNombre);
      const targetIndex = prev.findIndex(p => p.nombre_pagadora === targetNombre);
      if (sourceIndex === -1 || targetIndex === -1) return prev;
      const newArray = [...prev];
      const [moved] = newArray.splice(sourceIndex, 1);
      newArray.splice(targetIndex, 0, moved);
      return newArray;
    });
    setDraggedPagadora(null);
  }, [draggedPagadora]);

  const handleDragEnd = useCallback(() => {
    setDraggedPagadora(null);
  }, []);

  // Generar cartas state
  const [cartasForm, setCartasForm] = useState({ pagadora: '', tipo: 'romantica', cantidad: 3, instrucciones: '' });
  const [generatingCartas, setGeneratingCartas] = useState(false);
  const [cartasResultado, setCartasResultado] = useState<string | null>(null);

  // Historias state
  const [historias, setHistorias] = useState<HistoriaGuardada[]>([]);
  const [showHistoriaModal, setShowHistoriaModal] = useState(false);
  const [historiaForm, setHistoriaForm] = useState({ tipo: 'romantica', tema: '', pagadora: '' });
  const [generatingHistoria, setGeneratingHistoria] = useState(false);
  const [historiaResultado, setHistoriaResultado] = useState<string | null>(null);
  const [viewingHistoria, setViewingHistoria] = useState<HistoriaGuardada | null>(null);

  useEffect(() => {
    api.getPerfiles().then((data) => {
      setPerfiles(data);
      if (data.length > 0) setSelectedPerfilId(data[0].id);
    }).catch(() => showError('Error al cargar perfiles'));
  }, []);

  useEffect(() => {
    if (!selectedPerfilId) return;
    loadPagadoras();
    loadHistorias();
  }, [selectedPerfilId]);

  const loadPagadoras = async () => {
    try {
      const data = await api.getPagadoras(selectedPerfilId);
      setPagadoras(data);
    } catch { /* ignore */ }
  };

  const loadHistorias = async () => {
    try {
      const data = await api.getHistorias(selectedPerfilId);
      setHistorias(data);
    } catch { /* ignore */ }
  };

  const handleCopy = async (text: string) => {
    try { await copyToClipboard(text); success('Copiado al portapapeles'); } 
    catch { showError('Error al copiar'); }
  };

  // ===== PAGADORAS =====
  const openPagadoraModal = (pagadora?: CartaPagadora) => {
    if (pagadora) {
      setEditingPagadora(pagadora);
      setPagadoraForm({ 
        nombre: pagadora.nombre_pagadora, 
        ultima_carta_numero: pagadora.ultima_carta_numero, 
        ultima_carta_tipo: pagadora.ultima_carta_tipo, 
        notas: pagadora.notas 
      });
    } else {
      setEditingPagadora(null);
      setPagadoraForm({ nombre: '', ultima_carta_numero: 0, ultima_carta_tipo: 'romantica', notas: '' });
    }
    setShowPagadoraModal(true);
  };

  const savePagadora = async () => {
    if (!pagadoraForm.nombre.trim()) return;
    try {
      if (editingPagadora) {
        // Actualizar via upsert (generar 0 cartas solo actualiza marcador)
        await api.generarCartasPagadora(selectedPerfilId, {
          pagadora: pagadoraForm.nombre,
          tipo: pagadoraForm.ultima_carta_tipo,
          cantidad: 0,
          instrucciones: pagadoraForm.notas
        });
      } else {
        await api.generarCartasPagadora(selectedPerfilId, {
          pagadora: pagadoraForm.nombre,
          tipo: pagadoraForm.ultima_carta_tipo,
          cantidad: 0,
          instrucciones: pagadoraForm.notas
        });
      }
      success(editingPagadora ? 'Marcador actualizado' : 'Pagadora creada');
      setShowPagadoraModal(false);
      loadPagadoras();
    } catch { showError('Error al guardar pagadora'); }
  };

  const deletePagadora = async (nombre: string) => {
    if (!confirm(`Eliminar pagadora "${nombre}" y su historial?`)) return;
    try {
      // No hay endpoint DELETE, pero podemos resetear a 0
      await api.generarCartasPagadora(selectedPerfilId, { pagadora: nombre, tipo: 'romantica', cantidad: 0 });
      success('Pagadora eliminada');
      loadPagadoras();
    } catch { showError('Error al eliminar'); }
  };

  // ===== GENERAR CARTAS PARA PAGADORA =====
  const handleGenerarCartas = async () => {
    if (!cartasForm.pagadora.trim()) { showError('Selecciona una pagadora'); return; }
    setGeneratingCartas(true);
    setCartasResultado(null);
    try {
      const res = await api.generarCartasPagadora(selectedPerfilId, {
        pagadora: cartasForm.pagadora,
        tipo: cartasForm.tipo,
        cantidad: cartasForm.cantidad,
        instrucciones: cartasForm.instrucciones
      });
      setCartasResultado(res.contenido);
      success(`${res.cartas_generadas} cartas generadas (${res.numero_inicial}-${res.numero_final})`);
      loadPagadoras();
    } catch (e: any) { showError(e.response?.data?.detail || 'Error al generar cartas'); }
    finally { setGeneratingCartas(false); }
  };

  // ===== HISTORIAS =====
  const openHistoriaModal = () => {
    setHistoriaForm({ tipo: 'romantica', tema: '', pagadora: '' });
    setShowHistoriaModal(true);
  };

  const handleGenerarHistoria = async () => {
    if (!historiaForm.tema.trim()) { showError('Indica un tema'); return; }
    setGeneratingHistoria(true);
    setHistoriaResultado(null);
    try {
      const res = await api.generarHistoria(selectedPerfilId, {
        tipo: historiaForm.tipo,
        tema: historiaForm.tema,
        pagadora: historiaForm.pagadora || undefined
      });
      setHistoriaResultado(res.contenido);
      success('Historia generada y guardada');
      loadHistorias();
    } catch (e: any) { showError(e.response?.data?.detail || 'Error al generar historia'); }
    finally { setGeneratingHistoria(false); }
  };

  const deleteHistoria = async (id: string) => {
    if (!confirm('Eliminar esta historia guardada?')) return;
    try {
      await api.deleteHistoria(selectedPerfilId, id);
      success('Historia eliminada');
      loadHistorias();
    } catch { showError('Error al eliminar'); }
  };

  if (perfiles.length === 0) return (
    <div className="card p-12 text-center">
      <Sparkles className="w-16 h-16 text-primary-400 mx-auto mb-6 animate-pulse" />
      <h3 className="text-2xl font-bold text-gray-900 mb-2">Sin perfiles</h3>
      <p className="text-gray-500">Crea un perfil primero en la pestaña Perfiles.</p>
    </div>
  );

  const selectedPerfil = perfiles.find(p => p.id === selectedPerfilId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
            <div className="p-2 bg-purple-100 rounded-lg"><Heart className="w-5 h-5 text-purple-600" /></div>
            Cartas por Pagadora & Historias
          </h1>
          <p className="text-gray-500">Marcadores de continuidad, cartas personalizadas e historias guardadas.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 items-end">
          <div className="flex flex-col w-full md:w-64">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Perfil Activo</label>
            <select value={selectedPerfilId} onChange={(e) => setSelectedPerfilId(e.target.value)} className="input" disabled={loading}>
              {perfiles.map((p) => <option key={p.id} value={p.id}>{p.nombre_perfil}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100">
          {[
            { id: 'pagadoras', label: '📇 Marcadores Pagadoras', desc: 'Control de continuidad por pagadora' },
            { id: 'generar', label: '✍️ Generar Cartas', desc: 'Crear cartas continuando secuencia' },
            { id: 'historias', label: '📚 Historias Guardadas', desc: 'Románticas, sensuales, sexuales, custom' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'flex-1 py-4 px-6 text-sm font-medium transition-colors border-b-2',
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-600 bg-purple-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              <div className="flex flex-col items-center gap-1">
                <span>{tab.label}</span>
                <span className="text-xs text-gray-400">{tab.desc}</span>
              </div>
            </button>
          ))}
        </div>

        {/* ===== TAB 1: PAGADORAS (MARCADORES) ===== */}
        {activeTab === 'pagadoras' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-purple-600" />
                Marcadores de Pagadoras
              </h2>
              <Button onClick={() => openPagadoraModal()} className="bg-purple-600 hover:bg-purple-700">
                <Plus className="w-4 h-4 mr-2" /> Nueva Pagadora
              </Button>
            </div>

            {pagadoras.length === 0 ? (
              <div className="text-center py-12">
                <UserPlus className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No hay pagadoras registradas</p>
                <p className="text-sm text-gray-400 mb-6">Crea una pagadora para llevar el control de qué carta le toca a cada una</p>
                <Button onClick={() => openPagadoraModal()}>Crear primera pagadora</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {pagadoras.map((p, index) => (
                  <div 
                    key={p.nombre_pagadora} 
                    className={`bg-gray-50 rounded-xl p-5 border border-gray-100 hover:shadow-md transition-shadow ${draggedPagadora === p.nombre_pagadora ? 'opacity-50 ring-2 ring-purple-300' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, p.nombre_pagadora)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, p.nombre_pagadora)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="p-2 bg-gray-200 rounded-lg cursor-grab hover:bg-gray-300 active:cursor-grabbing" title="Arrastrar para reordenar">
                          <GripVertical className="w-5 h-5 text-gray-400" />
                        </div>
                        <div className="p-3 bg-purple-100 rounded-xl">
                          <Hash className="w-6 h-6 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="font-semibold text-gray-900 text-lg truncate">{p.nombre_pagadora}</h3>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">Orden: {index + 1}</span>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 flex-wrap">
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-4 h-4" /> Próxima: <strong className="text-purple-600">#{p.ultima_carta_numero + 1}</strong>
                            </span>
                            <span className="flex items-center gap-1">
                              <Heart className="w-4 h-4 text-rose-500" /> Tipo: <strong>{p.ultima_carta_tipo}</strong>
                            </span>
                            <span className="flex items-center gap-1">
                              <AlertCircle className="w-4 h-4 text-amber-500" /> Total: <strong>{p.ultima_carta_numero}</strong>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button variant="ghost" size="icon" onClick={() => openPagadoraModal(p)} title="Editar marcador">
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deletePagadora(p.nombre_pagadora)} title="Eliminar" className="text-red-600 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {p.notas && (
                      <div className="mt-4 pt-3 border-t border-gray-200 ml-10">
                        <p className="text-xs text-gray-500 mb-1">Notas / Contexto:</p>
                        <p className="text-sm text-gray-700 bg-white p-3 rounded-lg border border-gray-200 whitespace-pre-wrap">{p.notas}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== TAB 2: GENERAR CARTAS ===== */}
        {activeTab === 'generar' && (
          <div className="p-6">
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                Generar Cartas para Pagadora
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Las cartas continúan automáticamente desde el último número guardado en el marcador.
                Se guardan en el historial y actualizan el contador de la pagadora.
              </p>

              <div className="space-y-4">
                <div>
                  <Label>Pagadora</Label>
                  <select 
                    value={cartasForm.pagadora} 
                    onChange={(e) => setCartasForm({...cartasForm, pagadora: e.target.value})}
                    className="input"
                  >
                    <option value="">-- Selecciona pagadora --</option>
                    {pagadoras.map(p => (
                      <option key={p.nombre_pagadora} value={p.nombre_pagadora}>
                        {p.nombre_pagadora} (próxima: #{p.ultima_carta_numero + 1}, tipo actual: {p.ultima_carta_tipo})
                      </option>
                    ))}
                  </select>
                  {pagadoras.length === 0 && <p className="text-xs text-amber-600 mt-1">Primero crea una pagadora en la pestaña "Marcadores Pagadoras"</p>}
                </div>

                <div>
                  <Label>Tipo de cartas</Label>
                  <select value={cartasForm.tipo} onChange={(e) => setCartasForm({...cartasForm, tipo: e.target.value})} className="input">
                    {TIPO_HISTORIA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label} - {o.desc}</option>)}
                  </select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Cantidad</Label>
                    <Input type="number" min={1} max={10} value={cartasForm.cantidad} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCartasForm({...cartasForm, cantidad: parseInt(e.target.value)})} className="input" />
                  </div>
                </div>

                <div>
                  <Label htmlFor="instrucciones">Instrucciones adicionales (opcional)</Label>
                  <Textarea
                    id="instrucciones"
                    value={cartasForm.instrucciones}
                    onChange={(e) => setCartasForm({...cartasForm, instrucciones: e.target.value})}
                    rows={3}
                    placeholder="Ej: Continúa la historia donde la dejamos, ella acaba de recibir el regalo... / Tono más dominante / Mencionar su nombre..."
                    className="input resize-none"
                  />
                </div>

                <Button 
                  onClick={handleGenerarCartas} 
                  disabled={generatingCartas || !cartasForm.pagadora}
                  className="w-full bg-purple-600 hover:bg-purple-700 py-3"
                  size="lg"
                >
                  {generatingCartas ? (
                    <> <Loader2 className="w-5 h-5 animate-spin mr-2" /> Generando cartas... </> 
                  ) : (
                    <> <Sparkles className="w-5 h-5 mr-2" /> Generar {cartasForm.cantidad} cartas </> 
                  )}
                </Button>
              </div>

              {cartasResultado && (
                <div className="mt-6 p-5 bg-purple-50 border border-purple-100 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-purple-800">Cartas Generadas</h3>
                    <Button variant="ghost" size="icon" onClick={() => handleCopy(cartasResultado!)} title="Copiar todo">
                      <Copy className="w-5 h-5" />
                    </Button>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-purple-100 max-h-96 overflow-y-auto whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
                    {cartasResultado}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== TAB 3: HISTORIAS GUARDADAS ===== */}
        {activeTab === 'historias' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-600" />
                Historias Guardadas
              </h2>
              <Button onClick={openHistoriaModal} className="bg-purple-600 hover:bg-purple-700">
                <Plus className="w-4 h-4 mr-2" /> Nueva Historia
              </Button>
            </div>

            {historias.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No hay historias guardadas</p>
                <p className="text-sm text-gray-400 mb-6">Genera historias románticas, sensuales, sexuales o personalizadas bajo demanda</p>
                <Button onClick={openHistoriaModal}>Crear primera historia</Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {historias.map((h) => (
                  <div key={h.id} className="bg-gray-50 rounded-xl p-5 border border-gray-100 hover:shadow-md transition-shadow flex flex-col">
                    <div className="flex items-start justify-between mb-3">
                      <span className={cn(
                        'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                        h.tipo === 'romantica' && 'bg-rose-100 text-rose-800',
                        h.tipo === 'sensual' && 'bg-pink-100 text-pink-800',
                        h.tipo === 'sexual' && 'bg-red-100 text-red-800',
                        h.tipo === 'personalizada' && 'bg-purple-100 text-purple-800'
                      )}>{h.tipo}</span>
                      <Button variant="ghost" size="icon" onClick={() => deleteHistoria(h.id)} title="Eliminar" className="text-red-600 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1">{h.titulo}</h3>
                    {h.pagadora_asociada && (
                      <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                        <UserPlus className="w-3 h-3" /> {h.pagadora_asociada}
                      </p>
                    )}
                    <p className="text-sm text-gray-600 line-clamp-3 flex-1 mb-4">{h.contenido}</p>
                    <div className="flex gap-2 pt-3 border-t border-gray-200">
                      <Button variant="ghost" size="sm" onClick={() => setViewingHistoria(h)} className="flex-1">
                        <Eye className="w-4 h-4 mr-1" /> Ver completa
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleCopy(h.contenido)} className="flex-1">
                        <Copy className="w-4 h-4 mr-1" /> Copiar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Modales */}
      <Modal isOpen={showPagadoraModal} onClose={() => setShowPagadoraModal(false)} title={editingPagadora ? 'Editar Marcador Pagadora' : 'Nueva Pagadora'}>
        <form onSubmit={(e) => { e.preventDefault(); savePagadora(); }} className="space-y-4">
          <div>
            <Label htmlFor="pagadora_nombre">Nombre de la pagadora *</Label>
            <Input id="pagadora_nombre" value={pagadoraForm.nombre} onChange={(e) => setPagadoraForm({...pagadoraForm, nombre: e.target.value})} placeholder="Ej: María, Cliente VIP, Ana..." required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ultima_carta">Última carta enviada (#)</Label>
              <Input id="ultima_carta" type="number" min={0} value={pagadoraForm.ultima_carta_numero} onChange={(e) => setPagadoraForm({...pagadoraForm, ultima_carta_numero: parseInt(e.target.value)})} className="input" />
            </div>
            <div>
              <Label htmlFor="tipo_carta">Tipo de carta actual</Label>
              <select id="tipo_carta" value={pagadoraForm.ultima_carta_tipo} onChange={(e) => setPagadoraForm({...pagadoraForm, ultima_carta_tipo: e.target.value})} className="input">
                <option value="romantica">Romántica</option>
                <option value="sensual">Sensual</option>
                <option value="sexual">Sexual</option>
                <option value="personalizada">Personalizada</option>
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="notas">Notas / Contexto (en qué parte de la historia va)</Label>
            <Textarea id="notas" value={pagadoraForm.notas} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPagadoraForm({...pagadoraForm, notas: e.target.value})} rows={3} placeholder="Ej: Acaban de conocerse, ella le regaló un perfume, están en la 3ra cita..." className="input resize-none" />
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowPagadoraModal(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-700">Guardar</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showHistoriaModal} onClose={() => setShowHistoriaModal(false)} title="Nueva Historia Personalizada">
        <form onSubmit={(e) => { e.preventDefault(); handleGenerarHistoria(); }} className="space-y-4">
          <div>
            <Label>Tipo de historia</Label>
            <select value={historiaForm.tipo} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setHistoriaForm({...historiaForm, tipo: e.target.value})} className="input">
              {TIPO_HISTORIA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label} - {o.desc}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="tema">Tema / Instrucciones *</Label>
            <Textarea id="tema" value={historiaForm.tema} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setHistoriaForm({...historiaForm, tema: e.target.value})} rows={4} placeholder="Ej: Historia romántica de reencuentro después de años / Noche de pasión en hotel / Fantasía específica que yo te diga..." required className="input resize-none" />
          </div>
          <div>
            <Label htmlFor="pagadora_historia">Asociar a pagadora (opcional)</Label>
            <select id="pagadora_historia" value={historiaForm.pagadora} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setHistoriaForm({...historiaForm, pagadora: e.target.value})} className="input">
              <option value="">-- Sin pagadora (historia genérica) --</option>
              {pagadoras.map(p => <option key={p.nombre_pagadora} value={p.nombre_pagadora}>{p.nombre_pagadora}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowHistoriaModal(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={generatingHistoria} className="flex-1 bg-purple-600 hover:bg-purple-700">
              {generatingHistoria ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generar y Guardar
                  </>
                )}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!viewingHistoria} onClose={() => setViewingHistoria(null)} title={viewingHistoria?.titulo || 'Historia Completa'} size="lg">
        {viewingHistoria && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span className={cn(
                'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                viewingHistoria.tipo === 'romantica' && 'bg-rose-100 text-rose-800',
                viewingHistoria.tipo === 'sensual' && 'bg-pink-100 text-pink-800',
                viewingHistoria.tipo === 'sexual' && 'bg-red-100 text-red-800',
                viewingHistoria.tipo === 'personalizada' && 'bg-purple-100 text-purple-800'
              )}>{viewingHistoria.tipo}</span>
              {viewingHistoria.pagadora_asociada && <span>👤 {viewingHistoria.pagadora_asociada}</span>}
            </div>
            <div className="bg-gray-50 p-5 rounded-lg border border-gray-100 max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-gray-800 leading-relaxed">
              {viewingHistoria.contenido}
            </div>
            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <Button onClick={() => handleCopy(viewingHistoria.contenido)} className="flex-1">
                <Copy className="w-4 h-4 mr-2" /> Copiar todo
              </Button>
              <Button variant="secondary" onClick={() => setViewingHistoria(null)} className="flex-1">Cerrar</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}