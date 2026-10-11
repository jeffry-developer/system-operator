import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Copy, Loader2, Sparkles, RotateCcw, Heart, Zap, 
  Plus, Trash2, Eye, BookOpen, UserPlus, 
  ChevronDown, ChevronUp, Hash, MessageSquare, 
  Save, AlertCircle, Bookmark, BookmarkCheck,
  Edit2, Flag, Scissors, ArrowRight, Minus
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { Perfil, HistoriaGuardada, CartaPagadora } from '../types';
import { Button } from '../components/Button';
import { Input, Label, Textarea } from '../components/Input';
import { Modal } from '../components/Modal';
import { copyToClipboard } from '../utils/helpers';
import { cn } from '../utils/helpers';

const TIPO_HISTORIA_OPTIONS = [
  { value: 'romantica', label: 'Romántica', desc: 'Tierna, emocional, conexión profunda', color: 'bg-rose-100 text-rose-800' },
  { value: 'sensual', label: 'Sensual', desc: 'Insinuante, erótica suave, deseo', color: 'bg-pink-100 text-pink-800' },
  { value: 'sexual', label: 'Sexual', desc: 'Explícita, pasión, intimidad total', color: 'bg-red-100 text-red-800' },
  { value: 'personalizada', label: 'Personalizada', desc: 'Tema libre que tú indiques', color: 'bg-purple-100 text-purple-800' },
];

interface MarcadorHistoria {
  id: string;
  pagadora: string;
  posicion: number; // índice de carácter en el texto
  nota: string;
  color: string;
}

export function PagadorasYHistoriasPage() {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [selectedPerfilId, setSelectedPerfilId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'pagadoras' | 'historias' | 'editor'>('pagadoras');
  const [loading, setLoading] = useState(false);
  const { success, error: showError } = useToast();

  // Pagadoras simples - solo nombre
  const [pagadoras, setPagadoras] = useState<string[]>([]);
  const [showPagadoraModal, setShowPagadoraModal] = useState(false);
  const [newPagadoraName, setNewPagadoraName] = useState('');

  // Historias con editor visual
  const [historias, setHistorias] = useState<HistoriaGuardada[]>([]);
  const [editingHistoria, setEditingHistoria] = useState<HistoriaGuardada | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [editorTipo, setEditorTipo] = useState<'romantica' | 'sensual' | 'sexual' | 'personalizada'>('romantica');
  const [editorTitulo, setEditorTitulo] = useState('');
  const [editorPagadoraAsociada, setEditorPagadoraAsociada] = useState<string>('');
  const [marcadores, setMarcadores] = useState<MarcadorHistoria[]>([]);
  const [nextMarcadorId, setNextMarcadorId] = useState(1);

  const getNextMarcadorId = () => {
    let id = 0;
    setNextMarcadorId(prev => { id = prev; return prev + 1; });
    return id;
  };
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [generatingHistoria, setGeneratingHistoria] = useState(false);
  const [viewingHistoria, setViewingHistoria] = useState<HistoriaGuardada | null>(null);

  // Colores para marcadores por pagadora
  const coloresMarcadores = [
    'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 
    'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-orange-500'
  ];
  const pagadoraColors = new Map<string, string>();

  const getColorForPagadora = (pagadora: string) => {
    if (!pagadoraColors.has(pagadora)) {
      const color = coloresMarcadores[pagadoraColors.size % coloresMarcadores.length];
      pagadoraColors.set(pagadora, color);
    }
    return pagadoraColors.get(pagadora)!;
  };

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
      setPagadoras(data.map((p: CartaPagadora) => p.nombre_pagadora));
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

  // ===== PAGADORAS - Solo nombre =====
  const openPagadoraModal = () => {
    setNewPagadoraName('');
    setShowPagadoraModal(true);
  };

  const createPagadora = async () => {
    if (!newPagadoraName.trim()) return;
    if (pagadoras.includes(newPagadoraName.trim())) {
      showError('Esa pagadora ya existe');
      return;
    }
    try {
      // Crear marcador inicial vía API (cantidad 0)
      await api.generarCartasPagadora(selectedPerfilId, {
        pagadora: newPagadoraName.trim(),
        tipo: 'romantica',
        cantidad: 0,
        instrucciones: ''
      });
      success(`Pagadora "${newPagadoraName}" creada`);
      setShowPagadoraModal(false);
      loadPagadoras();
    } catch { showError('Error al crear pagadora'); }
  };

  const deletePagadora = async (nombre: string) => {
    if (!confirm(`Eliminar pagadora "${nombre}" y sus marcadores en todas las historias?`)) return;
    try {
      await api.generarCartasPagadora(selectedPerfilId, { pagadora: nombre, tipo: 'romantica', cantidad: 0 });
      // Limpiar marcadores de esta pagadora en historias locales
      setMarcadores(prev => prev.filter(m => m.pagadora !== nombre));
      success('Pagadora eliminada');
      loadPagadoras();
      loadHistorias();
    } catch { showError('Error al eliminar'); }
  };

  // ===== EDITOR DE HISTORIAS CON MARCADORES VISUALES =====
  const openNewHistoria = () => {
    setEditingHistoria(null);
    setEditorContent('');
    setEditorTitulo('');
    setEditorTipo('romantica');
    setEditorPagadoraAsociada('');
    setMarcadores([]);
    setNextMarcadorId(1);
    setShowEditor(true);
    setActiveTab('editor');
  };

  const openEditHistoria = (h: HistoriaGuardada) => {
    setEditingHistoria(h);
    setEditorContent(h.contenido);
    setEditorTitulo(h.titulo);
    setEditorTipo(h.tipo as any);
    setEditorPagadoraAsociada(h.pagadora_asociada || '');
    // Reconstruir marcadores desde notas guardadas o empezar limpio
    setMarcadores([]);
    setNextMarcadorId(1);
    setShowEditor(true);
    setActiveTab('editor');
  };

  // Insertar marcador en posición actual del cursor
  const insertMarcador = (pagadora: string, nota: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const posicion = textarea.selectionStart;
    const color = getColorForPagadora(pagadora);
    
    const nuevoMarcador: MarcadorHistoria = {
      id: `m${getNextMarcadorId()}`,
      pagadora,
      posicion,
      nota: nota || `Punto para ${pagadora}`,
      color
    };
    
    setMarcadores(prev => [...prev, nuevoMarcador].sort((a, b) => a.posicion - b.posicion));
    
    // Insertar marcador visual en el texto
    const marca = ` ⟪${pagadora}: ${nota || 'marcador'}⟫ `;
    const antes = editorContent.substring(0, posicion);
    const despues = editorContent.substring(posicion);
    setEditorContent(antes + marca + despues);
    
    // Ajustar posiciones de marcadores posteriores
    setMarcadores(prev => prev.map(m => 
      m.id === nuevoMarcador.id ? m : 
      m.posicion >= posicion ? { ...m, posicion: m.posicion + marca.length } : m
    ));
  };

  const removeMarcador = (id: string) => {
    const marcador = marcadores.find(m => m.id === id);
    if (!marcador) return;
    
    // Quitar del texto
    const marca = ` ⟪${marcador.pagadora}: ${marcador.nota || 'marcador'}⟫ `;
    const pos = editorContent.indexOf(marca);
    if (pos >= 0) {
      const nuevoTexto = editorContent.substring(0, pos) + editorContent.substring(pos + marca.length);
      setEditorContent(nuevoTexto);
      
      // Ajustar posiciones
      setMarcadores(prev => prev
        .filter(m => m.id !== id)
        .map(m => m.posicion > pos ? { ...m, posicion: m.posicion - marca.length } : m)
      );
    } else {
      setMarcadores(prev => prev.filter(m => m.id !== id));
    }
  };

  const saveHistoria = async () => {
    if (!editorTitulo.trim() || !editorContent.trim()) {
      showError('Título y contenido son requeridos');
      return;
    }
    try {
      if (editingHistoria) {
        // Actualizar: borrar y recrear
        await api.deleteHistoria(selectedPerfilId, editingHistoria.id);
      }
      const res = await api.generarHistoria(selectedPerfilId, {
        tipo: editorTipo,
        tema: editorTitulo,
        pagadora: editorPagadoraAsociada || undefined
      });
      // Sobrescribir con nuestro contenido editado
      const historiaData = {
        perfil_id: selectedPerfilId,
        titulo: editorTitulo,
        tipo: editorTipo,
        contenido: editorContent,
        pagadora_asociada: editorPagadoraAsociada || undefined
      };
      await api.saveHistoria(historiaData as any);
      
      success(editingHistoria ? 'Historia actualizada' : 'Historia guardada');
      setShowEditor(false);
      loadHistorias();
    } catch (e: any) { showError(e.response?.data?.detail || 'Error al guardar'); }
  };

  const deleteHistoria = async (id: string) => {
    if (!confirm('Eliminar esta historia?')) return;
    try {
      await api.deleteHistoria(selectedPerfilId, id);
      success('Historia eliminada');
      loadHistorias();
    } catch { showError('Error al eliminar'); }
  };

  // Manejar click en marcador inline para editar
  const [editingInlineMarcador, setEditingInlineMarcador] = useState<MarcadorHistoria | null>(null);
  const [inlineNota, setInlineNota] = useState('');

  const handleMarcadorClick = (m: MarcadorHistoria) => {
    setEditingInlineMarcador(m);
    setInlineNota(m.nota);
  };

  const saveInlineNota = () => {
    if (!editingInlineMarcador) return;
    setMarcadores(prev => prev.map(m => 
      m.id === editingInlineMarcador.id ? { ...m, nota: inlineNota } : m
    ));
    // Actualizar en el texto
    const oldMarca = ` ⟪${editingInlineMarcador.pagadora}: ${editingInlineMarcador.nota || 'marcador'}⟫ `;
    const newMarca = ` ⟪${editingInlineMarcador.pagadora}: ${inlineNota || 'marcador'}⟫ `;
    setEditorContent(prev => prev.replace(oldMarca, newMarca));
    setEditingInlineMarcador(null);
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
            <div className="p-2 bg-purple-100 rounded-lg"><BookOpen className="w-5 h-5 text-purple-600" /></div>
            Pagadoras e Historias
          </h1>
          <p className="text-gray-500">Pagadoras simples + Editor de historias con marcadores visuales por pagadora</p>
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
            { id: 'pagadoras', label: '👥 Pagadoras', desc: 'Solo nombre - simples' },
            { id: 'historias', label: '📚 Mis Historias', desc: 'Ver, editar, eliminar' },
            { id: 'editor', label: '✍️ Editor', desc: 'Escribir + marcadores visuales' },
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

        {/* ===== TAB 1: PAGADORAS SIMPLES ===== */}
        {activeTab === 'pagadoras' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-purple-600" />
                Pagadoras (Solo Nombre)
              </h2>
              <Button onClick={openPagadoraModal} className="bg-purple-600 hover:bg-purple-700">
                <Plus className="w-4 h-4 mr-2" /> Nueva Pagadora
              </Button>
            </div>

            {pagadoras.length === 0 ? (
              <div className="text-center py-12">
                <UserPlus className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No hay pagadoras</p>
                <p className="text-sm text-gray-400 mb-6">Crea pagadoras solo con su nombre. Luego úsalas en el editor para marcar puntos en las historias.</p>
                <Button onClick={openPagadoraModal}>Crear primera pagadora</Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pagadoras.map((nombre) => {
                  const color = getColorForPagadora(nombre);
                  return (
                    <div key={nombre} className="bg-gray-50 rounded-xl p-5 border border-gray-100 hover:shadow-md transition-shadow flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                          <Hash className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{nombre}</h3>
                          <p className="text-xs text-gray-500">Usada en marcadores de historias</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => deletePagadora(nombre)} title="Eliminar" className="text-red-600 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== TAB 2: LISTA HISTORIAS ===== */}
        {activeTab === 'historias' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-600" />
                Historias Guardadas
              </h2>
              <Button onClick={openNewHistoria} className="bg-purple-600 hover:bg-purple-700">
                <Plus className="w-4 h-4 mr-2" /> Nueva Historia
              </Button>
            </div>

            {historias.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No hay historias guardadas</p>
                <Button onClick={openNewHistoria}>Crear primera historia</Button>
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
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditHistoria(h)} title="Editar en editor">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteHistoria(h.id)} title="Eliminar" className="text-red-600 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
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
                        <Eye className="w-4 h-4 mr-1" /> Ver
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

        {/* ===== TAB 3: EDITOR VISUAL CON MARCADORES ===== */}
        {activeTab === 'editor' && (
          <div className="p-6">
            <div className="max-w-4xl mx-auto">
              {/* Toolbar superior */}
              <div className="mb-4 flex flex-wrap items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-medium text-gray-500">Tipo:</Label>
                  <select value={editorTipo} onChange={(e) => setEditorTipo(e.target as any)} className="input w-auto px-3 py-1 text-sm">
                    {TIPO_HISTORIA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="w-px h-6 bg-gray-200 mx-2" />
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-medium text-gray-500">Pagadora asociada:</Label>
                  <select value={editorPagadoraAsociada} onChange={(e) => setEditorPagadoraAsociada(e.target.value)} className="input w-auto px-3 py-1 text-sm">
                    <option value="">-- Ninguna --</option>
                    {pagadoras.map((p: string) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="w-px h-6 bg-gray-200 mx-2" />
                <div className="flex-1" />
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">Click en texto → Insertar marcador</span>
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded">Marcadores: {marcadores.length}</span>
                </div>
                <Button variant="secondary" onClick={() => { setShowEditor(false); setActiveTab('historias'); }} className="ml-2">
                  <ChevronUp className="w-4 h-4 mr-1" /> Volver
                </Button>
                <Button onClick={saveHistoria} disabled={generatingHistoria} className="bg-purple-600 hover:bg-purple-700">
                  {generatingHistoria ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  {editingHistoria ? 'Actualizar' : 'Guardar Historia'}
                </Button>
              </div>

              {/* Título */}
              <Input
                value={editorTitulo}
                onChange={(e) => setEditorTitulo(e.target.value)}
                placeholder="Título de la historia (ej: Noche de reencuentro en París)"
                className="mb-4 text-lg font-medium"
              />

              {/* Área de texto con marcadores inline */}
              <div className="relative">
                <Textarea
                  ref={textareaRef}
                  value={editorContent}
                  onChange={(e) => setEditorContent(e.target.value)}
                  rows={25}
                  placeholder="Escribe tu historia aquí... Click en cualquier posición y usa los botones de abajo para insertar marcadores de pagadoras."
                  className="font-mono text-sm leading-relaxed bg-white border-gray-200 focus:border-purple-400 focus:ring-purple-400"
                />
                
                {/* Marcadores visuales overlay */}
                {marcadores.length > 0 && (
                  <div className="absolute bottom-2 right-2 bg-white/95 backdrop-blur rounded-lg p-2 border border-gray-200 shadow-lg max-h-40 overflow-y-auto">
                    <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                      <Flag className="w-3 h-3" /> Marcadores en esta historia
                    </p>
                    <div className="space-y-1 max-w-xs">
                      {marcadores.map((m) => (
                        <div key={m.id} className="flex items-center gap-2 p-1.5 bg-gray-50 rounded text-xs hover:bg-gray-100 cursor-pointer" onClick={() => handleMarcadorClick(m)}>
                          <span className={`w-2 h-2 rounded-full ${m.color}`} />
                          <span className="font-medium text-gray-800 truncate max-w-[120px]">{m.pagadora}</span>
                          <span className="text-gray-500 truncate max-w-[100px]">{m.nota}</span>
                          <button onClick={(e) => { e.stopPropagation(); removeMarcador(m.id); }} className="text-red-500 hover:text-red-700 p-0.5" title="Eliminar">
                            <Minus className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Panel de inserción de marcadores */}
              {pagadoras.length > 0 && (
                <div className="mt-4 p-4 bg-purple-50 border border-purple-100 rounded-xl">
                  <p className="text-sm font-medium text-purple-800 mb-3 flex items-center gap-2">
                    <Bookmark className="w-4 h-4" /> Insertar marcador en posición del cursor
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {pagadoras.map((p) => {
                      const color = getColorForPagadora(p);
                      return (
                        <Button
                          key={p}
                          variant="outline"
                          size="sm"
                          onClick={() => insertMarcador(p, '')}
                          className={`border-2 ${color.replace('500', '200')} text-gray-700 hover:bg-white`}
                          style={{ borderColor: color }}
                        >
                          <BookmarkCheck className={`w-3 h-3 mr-1 ${color}`} />
                          {p}
                        </Button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-purple-600 mt-2">
                    Haz click en el texto donde quieras el marcador, luego pulsa el botón de la pagadora.
                    Podrás editar la nota del marcador clickando en la lista de la derecha.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals (outside tabs) */}
      {/* Modal Nueva Pagadora */}
      <Modal isOpen={showPagadoraModal} onClose={() => setShowPagadoraModal(false)} title="Nueva Pagadora" size="sm">
        <form onSubmit={(e) => { e.preventDefault(); createPagadora(); }} className="space-y-4">
          <div>
            <Label htmlFor="pagadora_nombre">Nombre de la pagadora *</Label>
            <Input id="pagadora_nombre" value={newPagadoraName} onChange={(e) => setNewPagadoraName(e.target.value)} placeholder="Ej: María, Cliente VIP, Ana..." required autoFocus />
          </div>
          <p className="text-xs text-gray-500">Solo nombre. Los marcadores se agregan visualmente en el editor de historias.</p>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowPagadoraModal(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-700">Crear</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Ver Historia Completa */}
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
            <div className="bg-gray-50 p-5 rounded-lg border border-gray-100 max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-gray-800 leading-relaxed font-mono text-sm">
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