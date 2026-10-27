import { useState, useEffect, useRef } from "react";
import {
  Copy, Loader2, Sparkles, RotateCcw,
  Heart, Plus, Trash2, Eye, BookOpen, UserPlus,
  Save, Bookmark, Edit2, Flag, Check, ChevronRight,
  Flame, FileText, ArrowRight, Share2, CornerDownRight
} from "lucide-react";
import { api } from "../services/api";
import { useToast } from "../components/Toast";
import { Perfil, HistoriaGuardada, CartaPagadora, CartaGuardada } from "../types";
import { Button } from "../components/Button";
import { Input, Label, Textarea } from "../components/Input";
import { Modal } from "../components/Modal";
import { copyToClipboard, cn } from "../utils/helpers";

const TIPO_CARTA_OPTIONS = [
  { value: "romantica", label: "Romántica", desc: "Seductora, genera deseo e intimidad", icon: Heart, color: "text-rose-500 bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800" },
  { value: "sexual", label: "Sexual", desc: "Explícita, apasionada, directa", icon: Flame, color: "text-red-500 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800" },
];

const TIPO_HISTORIA_OPTIONS = [
  { value: "romantica", label: "Romántica", color: "bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300" },
  { value: "sensual", label: "Sensual", color: "bg-pink-100 dark:bg-pink-900/40 text-pink-800 dark:text-pink-300" },
  { value: "sexual", label: "Sexual", color: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300" },
  { value: "personalizada", label: "Personalizada", color: "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300" },
];

const COLORES = [
  { bg: "bg-rose-500", border: "border-rose-500", text: "text-rose-500", light: "bg-rose-50 dark:bg-rose-950/50" },
  { bg: "bg-blue-500", border: "border-blue-500", text: "text-blue-500", light: "bg-blue-50 dark:bg-blue-950/50" },
  { bg: "bg-emerald-500", border: "border-emerald-500", text: "text-emerald-500", light: "bg-emerald-50 dark:bg-emerald-950/50" },
  { bg: "bg-amber-500", border: "border-amber-500", text: "text-amber-500", light: "bg-amber-50 dark:bg-amber-950/50" },
  { bg: "bg-purple-500", border: "border-purple-500", text: "text-purple-500", light: "bg-purple-50 dark:bg-purple-950/50" },
  { bg: "bg-pink-500", border: "border-pink-500", text: "text-pink-500", light: "bg-pink-50 dark:bg-pink-950/50" },
  { bg: "bg-indigo-500", border: "border-indigo-500", text: "text-indigo-500", light: "bg-indigo-50 dark:bg-indigo-950/50" },
  { bg: "bg-orange-500", border: "border-orange-500", text: "text-orange-500", light: "bg-orange-50 dark:bg-orange-950/50" },
];

export function PagadorasYHistoriasPage() {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [selectedPerfilId, setSelectedPerfilId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"cartas" | "historias" | "pagadoras" | "editor">("cartas");
  const [loading, setLoading] = useState(false);
  const { success, error: showError } = useToast();

  // === CARTAS ===
  const [cartaContenido, setCartaContenido] = useState("");
  const [cartaTipo, setCartaTipo] = useState<"romantica" | "sexual">("romantica");
  const [cartaPagadora, setCartaPagadora] = useState("");
  const [generandoCarta, setGenerandoCarta] = useState(false);
  const [cartasGeneradasHistorial, setCartasGeneradasHistorial] = useState<string[]>([]);
  const [cartasGuardadas, setCartasGuardadas] = useState<CartaGuardada[]>([]);
  const [showSaveCartaModal, setShowSaveCartaModal] = useState(false);
  const [saveCartaTitulo, setSaveCartaTitulo] = useState("");
  const [saveCartaPagadora, setSaveCartaPagadora] = useState("");

  // === PAGADORAS ===
  const [pagadoras, setPagadoras] = useState<string[]>([]);
  const [showPagadoraModal, setShowPagadoraModal] = useState(false);
  const [newPagadoraName, setNewPagadoraName] = useState("");
  const [pagadorasMarcadores, setPagadorasMarcadores] = useState<CartaPagadora[]>([]);

  // === HISTORIAS ===
  const [historias, setHistorias] = useState<HistoriaGuardada[]>([]);
  const [editingHistoria, setEditingHistoria] = useState<HistoriaGuardada | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [editorTipo, setEditorTipo] = useState<"romantica" | "sensual" | "sexual" | "personalizada">("romantica");
  const [editorTitulo, setEditorTitulo] = useState("");
  const [editorPagadoraAsociada, setEditorPagadoraAsociada] = useState<string>("");
  const [savingHistoria, setSavingHistoria] = useState(false);
  const [viewingHistoria, setViewingHistoria] = useState<HistoriaGuardada | null>(null);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);

  // === MARCADORES VISUALES ARRASTRABLES (DRAG & DROP) ===
  // Mapeo de posiciones visuales de cada pagadora en la historia: { [pagadoraName]: paragraphIndex }
  const [posicionesPagadoras, setPosicionesPagadoras] = useState<Record<string, number>>({});
  const [draggingPagadora, setDraggingPagadora] = useState<string | null>(null);

  // Helper para asignar colores persistentes a cada pagadora
  const getColorForPagadora = (nombre: string) => {
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) {
      hash = (hash << 5) - hash + nombre.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % COLORES.length;
    return COLORES[idx];
  };

  useEffect(() => {
    api.getPerfiles().then((data) => {
      setPerfiles(data);
      if (data.length > 0) setSelectedPerfilId(data[0].id);
    }).catch(() => showError("Error al cargar perfiles"));
  }, []);

  useEffect(() => {
    if (!selectedPerfilId) return;
    loadPagadoras();
    loadHistorias();
    loadCartasGuardadas();

    const storedHistorial = localStorage.getItem("cartas_gen_historial_" + selectedPerfilId);
    if (storedHistorial) setCartasGeneradasHistorial(JSON.parse(storedHistorial));

    const storedPos = localStorage.getItem("posiciones_pagadoras_" + selectedPerfilId);
    if (storedPos) setPosicionesPagadoras(JSON.parse(storedPos));
  }, [selectedPerfilId]);

  const loadPagadoras = async () => {
    try {
      const data = await api.getPagadoras(selectedPerfilId);
      setPagadorasMarcadores(data);
      setPagadoras(data.map((p: CartaPagadora) => p.nombre_pagadora));
    } catch { }
  };

  const loadHistorias = async () => {
    try {
      const data = await api.getHistorias(selectedPerfilId);
      setHistorias(data);
    } catch { }
  };

  const loadCartasGuardadas = () => {
    try {
      const key = `cartas_guardadas_${selectedPerfilId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        setCartasGuardadas(JSON.parse(stored));
      } else {
        setCartasGuardadas([]);
      }
    } catch { }
  };

  const saveCartasGuardadasToStorage = (cartas: CartaGuardada[]) => {
    setCartasGuardadas(cartas);
    localStorage.setItem(`cartas_guardadas_${selectedPerfilId}`, JSON.stringify(cartas));
  };

  const handleCopy = async (text: string) => {
    try {
      await copyToClipboard(text);
      success("Copiado al portapapeles");
    } catch {
      showError("Error al copiar");
    }
  };

  // === GENERAR CARTA ===
  const handleGenerarCarta = async () => {
    if (!selectedPerfilId) return;
    setGenerandoCarta(true);
    try {
      const historial = cartasGeneradasHistorial.slice(-3).join("\n---ANTERIOR---\n");
      const res = await api.generarCartasPagadora(selectedPerfilId, {
        pagadora: cartaPagadora || "general",
        tipo: cartaTipo,
        cantidad: 6,
        instrucciones: historial ? "EVITA REPETIR ESTAS CARTAS ANTERIORES:\n" + historial : "",
      });
      setCartaContenido(res.contenido);
      const nuevas = [...cartasGeneradasHistorial, res.contenido].slice(-10);
      setCartasGeneradasHistorial(nuevas);
      localStorage.setItem("cartas_gen_historial_" + selectedPerfilId, JSON.stringify(nuevas));
      success("Cartas generadas exitosamente");
    } catch (e: any) {
      showError(e.response?.data?.detail || "Error al generar cartas");
    } finally {
      setGenerandoCarta(false);
    }
  };

  // === GUARDAR CARTA PARA REUTILIZAR ===
  const openSaveCartaModal = () => {
    if (!cartaContenido) return;
    setSaveCartaTitulo(`Carta ${cartaTipo === "romantica" ? "Romántica" : "Sexual"} - ${new Date().toLocaleDateString()}`);
    setSaveCartaPagadora(cartaPagadora || "");
    setShowSaveCartaModal(true);
  };

  const handleSaveCarta = () => {
    if (!saveCartaTitulo.trim()) {
      showError("Ingresa un título para guardar la carta");
      return;
    }
    const nueva: CartaGuardada = {
      id: "carta_" + Date.now(),
      perfil_id: selectedPerfilId,
      titulo: saveCartaTitulo.trim(),
      tipo: cartaTipo,
      contenido: cartaContenido,
      pagadora: saveCartaPagadora || undefined,
      fecha_creacion: new Date().toISOString(),
    };
    const actualizadas = [nueva, ...cartasGuardadas];
    saveCartasGuardadasToStorage(actualizadas);
    setShowSaveCartaModal(false);
    success("¡Carta guardada en tu banco de cartas reutilizables!");
  };

  const handleDeleteCartaGuardada = (id: string) => {
    const actualizadas = cartasGuardadas.filter((c) => c.id !== id);
    saveCartasGuardadasToStorage(actualizadas);
    success("Carta eliminada");
  };

  const handleCargarCartaEnEditor = (carta: CartaGuardada) => {
    setEditorTitulo(carta.titulo);
    setEditorContent(carta.contenido);
    setEditorTipo(carta.tipo === "sexual" ? "sexual" : "romantica");
    setEditorPagadoraAsociada(carta.pagadora || "");
    setActiveTab("editor");
    success("Carta cargada en el Editor");
  };

  // === PAGADORAS ===
  const openPagadoraModal = () => {
    setNewPagadoraName("");
    setShowPagadoraModal(true);
  };

  const createPagadora = async () => {
    if (!newPagadoraName.trim()) return;
    const nombre = newPagadoraName.trim();
    if (pagadoras.some((p) => p.toLowerCase() === nombre.toLowerCase())) {
      showError("Esa pagadora ya existe");
      return;
    }
    try {
      await api.generarCartasPagadora(selectedPerfilId, {
        pagadora: nombre,
        tipo: "romantica",
        cantidad: 0,
        instrucciones: "",
      });
      success(`Pagadora "${nombre}" creada`);
      setShowPagadoraModal(false);
      loadPagadoras();
    } catch {
      showError("Error al crear pagadora");
    }
  };

  const deletePagadora = async (nombre: string) => {
    if (!confirm(`¿Eliminar la pagadora "${nombre}"?`)) return;
    try {
      await api.generarCartasPagadora(selectedPerfilId, {
        pagadora: nombre,
        tipo: "romantica",
        cantidad: 0,
      });
      // Limpiar posición
      const nuevasPos = { ...posicionesPagadoras };
      delete nuevasPos[nombre];
      setPosicionesPagadoras(nuevasPos);
      localStorage.setItem("posiciones_pagadoras_" + selectedPerfilId, JSON.stringify(nuevasPos));
      success(`Pagadora "${nombre}" eliminada`);
      loadPagadoras();
      loadHistorias();
    } catch {
      showError("Error al eliminar pagadora");
    }
  };

  // === HISTORIAS ===
  const openNewHistoria = () => {
    setEditingHistoria(null);
    setEditorTitulo("");
    setEditorTipo("romantica");
    setEditorPagadoraAsociada("");
    setShowAIGenerator(true);
  };

  const handleAIGenerateHistoria = async () => {
    if (!editorTitulo.trim()) {
      showError("Ingresa un título o tema");
      return;
    }
    setGeneratingAI(true);
    try {
      const res = await api.generarHistoria(selectedPerfilId, {
        tipo: editorTipo,
        tema: editorTitulo,
        pagadora: editorPagadoraAsociada || undefined,
      });
      setShowAIGenerator(false);
      setEditorContent(res.contenido);
      setActiveTab("editor");
      success("Historia generada con éxito");
    } catch (e: any) {
      showError(e.response?.data?.detail || "Error al generar historia con IA");
    } finally {
      setGeneratingAI(false);
    }
  };

  const openEditHistoria = (h: HistoriaGuardada) => {
    setEditingHistoria(h);
    setEditorContent(h.contenido);
    setEditorTitulo(h.titulo);
    setEditorTipo(h.tipo as any);
    setEditorPagadoraAsociada(h.pagadora_asociada || "");
    setActiveTab("editor");
  };

  const saveHistoria = async () => {
    if (!editorTitulo.trim() || !editorContent.trim()) {
      showError("Título y contenido son requeridos");
      return;
    }
    setSavingHistoria(true);
    try {
      if (editingHistoria) {
        await api.deleteHistoria(selectedPerfilId, editingHistoria.id);
      }
      await api.saveHistoria({
        perfil_id: selectedPerfilId,
        titulo: editorTitulo,
        tipo: editorTipo,
        contenido: editorContent,
        pagadora_asociada: editorPagadoraAsociada || undefined,
      });
      success(editingHistoria ? "Historia actualizada" : "Historia guardada");
      setActiveTab("historias");
      loadHistorias();
    } catch (e: any) {
      showError(e.response?.data?.detail || "Error al guardar historia");
    } finally {
      setSavingHistoria(false);
    }
  };

  const deleteHistoria = async (id: string) => {
    if (!confirm("¿Eliminar esta historia?")) return;
    try {
      await api.deleteHistoria(selectedPerfilId, id);
      success("Historia eliminada");
      loadHistorias();
    } catch {
      showError("Error al eliminar historia");
    }
  };

  // Dividir el contenido del editor en párrafos limpios para los marcadores visuales
  const parrafos = editorContent
    ? editorContent.split(/\n\s*\n/).filter((p) => p.trim().length > 0)
    : [];

  // Mover posición visual de pagadora al arrastrar o hacer click
  const updatePagadoraPosition = (pagadora: string, pIdx: number) => {
    const updated = {
      ...posicionesPagadoras,
      [pagadora]: Math.max(0, Math.min(parrafos.length - 1, pIdx)),
    };
    setPosicionesPagadoras(updated);
    localStorage.setItem("posiciones_pagadoras_" + selectedPerfilId, JSON.stringify(updated));
    success(`Marcador de ${pagadora} situado en el párrafo ${pIdx + 1}`);
  };

  if (perfiles.length === 0) {
    return (
      <div className="card p-12 text-center bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
        <Sparkles className="w-16 h-16 text-primary-400 mx-auto mb-6 animate-pulse" />
        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Sin perfiles activos</h3>
        <p className="text-gray-500 dark:text-gray-400">Crea un perfil primero en la sección de Perfiles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header unificado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
            <div className="p-2 bg-gradient-to-tr from-purple-500 to-rose-500 rounded-xl text-white shadow-sm">
              <BookOpen className="w-5 h-5" />
            </div>
            Estudio Unificado
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Cartas, pagadoras e historias con marcadores visuales interactivos</p>
        </div>
        <div className="flex flex-col w-full md:w-64">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Perfil Activo</label>
          <select
            value={selectedPerfilId}
            onChange={(e) => setSelectedPerfilId(e.target.value)}
            className="input"
            disabled={loading}
          >
            {perfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre_perfil}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs de Navegación Unificada */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 dark:border-gray-800 overflow-x-auto">
          {[
            { id: "cartas", label: "Cartas", emoji: "💌", desc: "Generar y Reutilizar", count: cartasGuardadas.length },
            { id: "historias", label: "Historias", emoji: "📚", desc: "Narrativas guardadas", count: historias.length },
            { id: "editor", label: "Editor & Marcador Visual", emoji: "🎯", desc: "Arrastra y sitúa pagadoras" },
            { id: "pagadoras", label: "Pagadoras", emoji: "👥", desc: "Gestión de clientas", count: pagadoras.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex-1 min-w-max py-4 px-6 text-sm font-medium transition-all border-b-2 flex flex-col items-center gap-1",
                activeTab === tab.id
                  ? "border-purple-600 dark:border-purple-400 text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/30"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              )}
            >
              <div className="flex items-center gap-2">
                <span>{tab.emoji}</span>
                <span className="font-semibold">{tab.label}</span>
                {typeof tab.count === "number" && tab.count > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                    {tab.count}
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500">{tab.desc}</span>
            </button>
          ))}
        </div>

        {/* ============================================================ */}
        {/* TAB 1: CARTAS (GENERADOR + BANCO REUTILIZABLE) */}
        {/* ============================================================ */}
        {activeTab === "cartas" && (
          <div className="p-6 space-y-8">
            {/* Panel de Generación */}
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-gradient-to-br from-rose-50/50 to-purple-50/50 dark:from-rose-950/20 dark:to-purple-950/20 p-6 rounded-2xl border border-rose-100/80 dark:border-rose-900/40">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-rose-500" />
                  Generar Cartas (Románticas o Sexuales)
                </h2>

                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">
                      Tipo de carta
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {TIPO_CARTA_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        const isSelected = cartaTipo === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => setCartaTipo(opt.value as any)}
                            className={cn(
                              "p-3.5 rounded-xl border-2 text-left transition-all flex flex-col justify-between",
                              isSelected
                                ? "border-rose-500 bg-white dark:bg-gray-900 shadow-sm"
                                : "border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/60 hover:border-gray-300 dark:hover:border-gray-700"
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Icon className={cn("w-4 h-4", isSelected ? "text-rose-500" : "text-gray-400")} />
                              <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{opt.label}</span>
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{opt.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">
                      Pagadora Asociada (opcional)
                    </label>
                    <select
                      value={cartaPagadora}
                      onChange={(e) => setCartaPagadora(e.target.value)}
                      className="input h-[62px]"
                    >
                      <option value="">-- General (Cualquier clienta) --</option>
                      {pagadoras.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <Button
                  onClick={handleGenerarCarta}
                  disabled={generandoCarta}
                  className="w-full bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white py-3.5 text-base shadow-sm font-medium"
                >
                  {generandoCarta ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Generando cartas únicas con IA...
                    </>
                  ) : (
                    <>
                      <Heart className="w-5 h-5 mr-2" />
                      Generar Cartas {cartaTipo === "romantica" ? "Románticas" : "Sexuales"}
                    </>
                  )}
                </Button>
              </div>

              {/* Resultado Generado con opción de Guardar para Reutilizar */}
              {cartaContenido && (
                <div className="bg-white dark:bg-gray-900 border-2 border-rose-200 dark:border-rose-900/60 rounded-2xl overflow-hidden shadow-sm">
                  <div className="flex flex-wrap items-center justify-between p-4 bg-rose-50/50 dark:bg-rose-950/30 border-b border-rose-100 dark:border-rose-900/40 gap-3">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-rose-500 text-white">
                        <Heart className="w-4 h-4" />
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        Cartas Recién Generadas
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 font-medium capitalize">
                        {cartaTipo}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={openSaveCartaModal}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        <Save className="w-4 h-4 mr-1.5" />
                        Guardar para Reutilizar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleCopy(cartaContenido)}>
                        <Copy className="w-4 h-4 mr-1.5" />
                        Copiar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerarCarta}
                        disabled={generandoCarta}
                        title="Generar nueva variación"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="p-6 max-h-[50vh] overflow-y-auto">
                    <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed font-sans">
                      {cartaContenido}
                    </p>
                  </div>
                </div>
              )}

              {/* Banco de Cartas Guardadas Reutilizables */}
              <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <Bookmark className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      Banco de Cartas Guardadas (Reutilizables)
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Tus cartas guardadas listas para copiar o enviar a cualquier pagadora
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-3 py-1 rounded-full border border-purple-200 dark:border-purple-800">
                    {cartasGuardadas.length} {cartasGuardadas.length === 1 ? "carta" : "cartas"}
                  </span>
                </div>

                {cartasGuardadas.length === 0 ? (
                  <div className="text-center py-10 bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                    <Heart className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Aún no tienes cartas guardadas</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Genera cartas arriba y haz clic en "Guardar para Reutilizar" para guardarlas en este banco.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {cartasGuardadas.map((c) => {
                      const isSexual = c.tipo === "sexual";
                      return (
                        <div
                          key={c.id}
                          className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-100 dark:border-gray-800 hover:border-purple-200 dark:hover:border-purple-800/60 shadow-sm transition-all flex flex-col justify-between group"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <span
                                className={cn(
                                  "px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider",
                                  isSexual
                                    ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                                    : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                                )}
                              >
                                {c.tipo}
                              </span>
                              {c.pagadora && (
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                  <UserPlus className="w-3 h-3 text-purple-500" /> {c.pagadora}
                                </span>
                              )}
                            </div>
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-2">{c.titulo}</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-4 leading-relaxed mb-4">
                              {c.contenido}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopy(c.contenido)}
                              className="flex-1 text-xs"
                            >
                              <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCargarCartaEnEditor(c)}
                              className="flex-1 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30"
                            >
                              <Edit2 className="w-3.5 h-3.5 mr-1" /> Usar en Editor
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteCartaGuardada(c.id)}
                              className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: HISTORIAS GUARDADAS */}
        {/* ============================================================ */}
        {activeTab === "historias" && (
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  Historias Guardadas
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Historias completas para enviar progresivamente a tus pagadoras
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={openNewHistoria}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" /> Nueva Historia
                </Button>
              </div>
            </div>

            {historias.length === 0 ? (
              <div className="text-center py-16 bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                <BookOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">No hay historias guardadas</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 mt-1">
                  Genera una historia con IA o escribe una para asociarle pagadoras y marcadores.
                </p>
                <Button onClick={openNewHistoria} className="bg-purple-600 hover:bg-purple-700">
                  <Sparkles className="w-4 h-4 mr-2" /> Crear primera historia
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {historias.map((h) => (
                  <div
                    key={h.id}
                    className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-100 dark:border-gray-800 hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <span
                          className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider",
                            h.tipo === "romantica" && "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
                            h.tipo === "sensual" && "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
                            h.tipo === "sexual" && "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
                            h.tipo === "personalizada" && "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                          )}
                        >
                          {h.tipo}
                        </span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditHistoria(h)} title="Editar en Estudio">
                            <Edit2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteHistoria(h.id)}
                            className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1.5 line-clamp-1">{h.titulo}</h3>
                      {h.pagadora_asociada && (
                        <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-2 flex items-center gap-1">
                          <UserPlus className="w-3.5 h-3.5" /> Pagadora: {h.pagadora_asociada}
                        </p>
                      )}
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-4 leading-relaxed mb-4">
                        {h.contenido}
                      </p>
                    </div>

                    <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <Button variant="outline" size="sm" onClick={() => openEditHistoria(h)} className="flex-1 text-xs">
                        <Flag className="w-3.5 h-3.5 mr-1 text-purple-600" /> Ver Marcadores
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setViewingHistoria(h)} className="text-xs">
                        <Eye className="w-3.5 h-3.5 mr-1" /> Leer
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleCopy(h.contenido)} className="text-xs">
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: EDITOR CON MARCADOR VISUAL ARRASTRABLE (DRAG & DROP) */}
        {/* ============================================================ */}
        {activeTab === "editor" && (
          <div className="p-6 max-w-5xl mx-auto space-y-6">
            {/* Header del Editor */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50/80 dark:bg-gray-800/80 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div>
                  <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Tipo de historia</Label>
                  <select
                    value={editorTipo}
                    onChange={(e) => setEditorTipo(e.target.value as any)}
                    className="input h-9 py-1 px-3 text-xs w-auto mt-0.5"
                  >
                    {TIPO_HISTORIA_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Pagadora Principal</Label>
                  <select
                    value={editorPagadoraAsociada}
                    onChange={(e) => setEditorPagadoraAsociada(e.target.value)}
                    className="input h-9 py-1 px-3 text-xs w-auto mt-0.5"
                  >
                    <option value="">-- General / Todas --</option>
                    {pagadoras.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setActiveTab("historias")}>
                  Volver a lista
                </Button>
                <Button
                  onClick={saveHistoria}
                  disabled={savingHistoria}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {savingHistoria ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {editingHistoria ? "Actualizar Historia" : "Guardar Historia"}
                </Button>
              </div>
            </div>

            <Input
              value={editorTitulo}
              onChange={(e) => setEditorTitulo(e.target.value)}
              placeholder="Título de la historia (Ej: Una noche inolvidable en la ciudad...)"
              className="text-lg font-semibold"
            />

            {/* SECCIÓN INTERACTIVA DE MARCADOR VISUAL ARRASTRABLE */}
            <div className="bg-gradient-to-br from-purple-50/60 to-indigo-50/60 dark:from-purple-950/20 dark:to-indigo-950/20 rounded-2xl p-5 border border-purple-100 dark:border-purple-900/50 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Flag className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    Línea de Tiempo Visual: ¿En qué parte de la historia va cada pagadora?
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Arrastra el marcador de cada pagadora o usa los botones para situarla exactamente donde va
                  </p>
                </div>

                {pagadoras.length === 0 && (
                  <Button size="sm" variant="outline" onClick={openPagadoraModal} className="text-xs">
                    <UserPlus className="w-3.5 h-3.5 mr-1" /> Crear Pagadora
                  </Button>
                )}
              </div>

              {/* BARRA DE PROGRESO INTERACTIVA */}
              {parrafos.length > 0 && pagadoras.length > 0 && (
                <div className="space-y-3 bg-white dark:bg-gray-900 p-4 rounded-xl border border-purple-100/80 dark:border-purple-900/40">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Inicio (Párrafo 1)</span>
                    <span className="font-semibold text-purple-600 dark:text-purple-400">
                      Progreso de Lectura ({parrafos.length} {parrafos.length === 1 ? "párrafo" : "párrafos"})
                    </span>
                    <span>Final (Párrafo {parrafos.length})</span>
                  </div>

                  {/* Pistas / Sliders para cada pagadora */}
                  <div className="space-y-3 pt-2">
                    {pagadoras.map((pag) => {
                      const color = getColorForPagadora(pag);
                      const currentPIdx = posicionesPagadoras[pag] ?? 0;
                      const pct = parrafos.length > 1 ? (currentPIdx / (parrafos.length - 1)) * 100 : 100;

                      return (
                        <div key={pag} className="flex flex-col gap-1.5 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm",
                                  color.bg
                                )}
                              >
                                {pag.charAt(0).toUpperCase()}
                              </span>
                              <span className="font-bold text-gray-800 dark:text-gray-200">{pag}</span>
                            </div>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                              📍 Párrafo {currentPIdx + 1} de {parrafos.length} ({Math.round(pct)}%)
                            </span>
                          </div>

                          {/* Control deslizante / arrastrable visual */}
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min={0}
                              max={Math.max(0, parrafos.length - 1)}
                              step={1}
                              value={currentPIdx}
                              onChange={(e) => updatePagadoraPosition(pag, parseInt(e.target.value, 10))}
                              className="w-full accent-purple-600 dark:accent-purple-400 cursor-pointer h-2 bg-gray-200 dark:bg-gray-700 rounded-lg"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Botones rápidos de pagadoras para insertar o saltar */}
              {pagadoras.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Marcadores disponibles:
                  </span>
                  {pagadoras.map((p) => {
                    const color = getColorForPagadora(p);
                    const pos = posicionesPagadoras[p] ?? 0;
                    return (
                      <div
                        key={p}
                        draggable
                        onDragStart={() => setDraggingPagadora(p)}
                        onDragEnd={() => setDraggingPagadora(null)}
                        className={cn(
                          "cursor-grab active:cursor-grabbing px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-medium transition-all shadow-sm select-none",
                          color.light,
                          color.border
                        )}
                        title="Arrastra este marcador sobre cualquier párrafo"
                      >
                        <span className={cn("w-2.5 h-2.5 rounded-full", color.bg)} />
                        <span className="font-semibold text-gray-800 dark:text-gray-200">{p}</span>
                        <span className="text-[10px] text-gray-400">P{pos + 1}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* VISTA DUAL: PÁRRAFOS VISUALES CON DROP TARGETS + TEXTAREA */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Columna Izquierda: Vista interactiva de bloques donde se ve y se arrastra a las pagadoras */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Fragmentos de la Historia (Arrastra aquí las pagadoras)
                  </Label>
                  <span className="text-xs text-gray-400">
                    {parrafos.length} {parrafos.length === 1 ? "bloque" : "bloques"}
                  </span>
                </div>

                {parrafos.length === 0 ? (
                  <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                    <FileText className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Escribe tu historia en el editor de la derecha (separa párrafos con enter).
                      Aquí verás los bloques interactivos para ubicar a tus pagadoras.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                    {parrafos.map((p, idx) => {
                      // Pagadoras que están en este párrafo
                      const pagadorasAqui = pagadoras.filter(
                        (pag) => (posicionesPagadoras[pag] ?? 0) === idx
                      );

                      return (
                        <div
                          key={idx}
                          onDragOver={(e) => {
                            e.preventDefault();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (draggingPagadora) {
                              updatePagadoraPosition(draggingPagadora, idx);
                              setDraggingPagadora(null);
                            }
                          }}
                          onClick={() => {
                            // Si se hace click y hay una pagadora seleccionada, moverla aquí
                            if (editorPagadoraAsociada) {
                              updatePagadoraPosition(editorPagadoraAsociada, idx);
                            }
                          }}
                          className={cn(
                            "p-4 rounded-xl border transition-all text-xs leading-relaxed relative group cursor-pointer",
                            pagadorasAqui.length > 0
                              ? "bg-purple-50/70 dark:bg-purple-950/30 border-purple-300 dark:border-purple-800 shadow-sm"
                              : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-[10px]">
                              Párrafo #{idx + 1}
                            </span>

                            {/* Insignias de pagadoras que están en este párrafo */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              {pagadorasAqui.map((pag) => {
                                const color = getColorForPagadora(pag);
                                return (
                                  <span
                                    key={pag}
                                    className={cn(
                                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold text-white shadow-xs",
                                      color.bg
                                    )}
                                  >
                                    <Flag className="w-2.5 h-2.5" />
                                    {pag} está aquí
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                          <p className="text-gray-700 dark:text-gray-300 line-clamp-3">{p}</p>

                          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] text-gray-400">
                              Haz clic o suelta aquí para marcar posición
                            </span>
                            <div className="flex gap-1">
                              {pagadoras.map((pag) => (
                                <button
                                  key={pag}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updatePagadoraPosition(pag, idx);
                                  }}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-gray-600 dark:text-gray-300 font-medium"
                                >
                                  Mover {pag}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Columna Derecha: Textarea editable */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Contenido editable de la Historia
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(editorContent)}
                    className="text-xs h-7"
                  >
                    <Copy className="w-3 h-3 mr-1" /> Copiar todo
                  </Button>
                </div>

                <Textarea
                  value={editorContent}
                  onChange={(e) => setEditorContent(e.target.value)}
                  rows={20}
                  placeholder="Escribe o pega tu historia aquí... Separa párrafos con doble enter para generar bloques visuales con marcadores."
                  className="font-mono text-xs leading-relaxed bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:border-purple-500 rounded-xl"
                />
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: GESTIÓN DE PAGADORAS */}
        {/* ============================================================ */}
        {activeTab === "pagadoras" && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  Lista de Pagadoras
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Clientas a las que les envías cartas y llevas seguimiento de historias
                </p>
              </div>
              <Button onClick={openPagadoraModal} className="bg-purple-600 hover:bg-purple-700 text-white">
                <Plus className="w-4 h-4 mr-2" /> Nueva Pagadora
              </Button>
            </div>

            {pagadoras.length === 0 ? (
              <div className="text-center py-16 bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                <UserPlus className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">No hay pagadoras registradas</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 mt-1">
                  Agrega a tus clientas para asociarles cartas e historias con marcadores visuales.
                </p>
                <Button onClick={openPagadoraModal} className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="w-4 h-4 mr-2" /> Agregar primera pagadora
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pagadoras.map((nombre) => {
                  const color = getColorForPagadora(nombre);
                  const marcador = pagadorasMarcadores.find((m) => m.nombre_pagadora === nombre);
                  const posP = posicionesPagadoras[nombre];

                  return (
                    <div
                      key={nombre}
                      className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 hover:shadow-md transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-sm",
                            color.bg
                          )}
                        >
                          {nombre.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base">{nombre}</h3>
                          <div className="flex flex-col gap-0.5 mt-1">
                            {typeof posP === "number" && (
                              <span className="text-xs font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1">
                                <Flag className="w-3 h-3" /> Párrafo #{posP + 1} de la historia
                              </span>
                            )}
                            {marcador && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                Última carta #{marcador.ultima_carta_numero}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deletePagadora(nombre)}
                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* MODAL: GUARDAR CARTA PARA REUTILIZAR */}
      {/* ============================================================ */}
      <Modal
        isOpen={showSaveCartaModal}
        onClose={() => setShowSaveCartaModal(false)}
        title="Guardar Carta para Reutilizar"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Esta carta se guardará en tu banco de cartas. Podrás copiarla, reutilizarla o cargarla en el editor de historias cuando la necesites.
          </p>

          <div>
            <Label htmlFor="carta_save_titulo">Título / Identificador *</Label>
            <Input
              id="carta_save_titulo"
              value={saveCartaTitulo}
              onChange={(e) => setSaveCartaTitulo(e.target.value)}
              placeholder="Ej: Carta romántica para cuando se ausenta..."
              required
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="carta_save_pagadora">Asignar a pagadora (opcional)</Label>
            <select
              id="carta_save_pagadora"
              value={saveCartaPagadora}
              onChange={(e) => setSaveCartaPagadora(e.target.value)}
              className="input"
            >
              <option value="">-- General (Cualquier clienta) --</option>
              {pagadoras.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" onClick={() => setShowSaveCartaModal(false)} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleSaveCarta} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white">
              Guardar Carta
            </Button>
          </div>
        </div>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL: NUEVA PAGADORA */}
      {/* ============================================================ */}
      <Modal isOpen={showPagadoraModal} onClose={() => setShowPagadoraModal(false)} title="Nueva Pagadora" size="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createPagadora();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="pagadora_nombre">Nombre de la pagadora *</Label>
            <Input
              id="pagadora_nombre"
              value={newPagadoraName}
              onChange={(e) => setNewPagadoraName(e.target.value)}
              placeholder="Ej: Laura, Andrea, Clienta VIP..."
              required
              autoFocus
            />
          </div>
          <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            <Button type="button" variant="secondary" onClick={() => setShowPagadoraModal(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-700 text-white">
              Crear Pagadora
            </Button>
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL: VER HISTORIA COMPLETA */}
      {/* ============================================================ */}
      <Modal
        isOpen={!!viewingHistoria}
        onClose={() => setViewingHistoria(null)}
        title={viewingHistoria?.titulo || "Historia Completa"}
        size="lg"
      >
        {viewingHistoria && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed text-sm font-sans">
              {viewingHistoria.contenido}
            </div>
            <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <Button onClick={() => handleCopy(viewingHistoria.contenido)} className="flex-1">
                <Copy className="w-4 h-4 mr-2" /> Copiar todo
              </Button>
              <Button variant="secondary" onClick={() => setViewingHistoria(null)} className="flex-1">
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ============================================================ */}
      {/* MODAL: GENERAR HISTORIA CON IA */}
      {/* ============================================================ */}
      <Modal
        isOpen={showAIGenerator}
        onClose={() => setShowAIGenerator(false)}
        title="Generar Historia con IA"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            La IA generará una narrativa completa estructurada en párrafos. Luego podrás verla en el Estudio y arrastrar marcadores de pagadoras.
          </p>

          <div>
            <Label>Tipo de historia</Label>
            <select
              value={editorTipo}
              onChange={(e) => setEditorTipo(e.target.value as any)}
              className="input"
            >
              {TIPO_HISTORIA_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="ai_tema">Tema o Título *</Label>
            <Input
              id="ai_tema"
              value={editorTitulo}
              onChange={(e) => setEditorTitulo(e.target.value)}
              placeholder="Ej: Encuentro a solas / Fantasía compartida / Tarde de lluvia..."
              required
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="ai_pagadora">Asociar a pagadora (opcional)</Label>
            <select
              id="ai_pagadora"
              value={editorPagadoraAsociada}
              onChange={(e) => setEditorPagadoraAsociada(e.target.value)}
              className="input"
            >
              <option value="">-- Sin pagadora (General) --</option>
              {pagadoras.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" onClick={() => setShowAIGenerator(false)} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={handleAIGenerateHistoria}
              disabled={generatingAI || !editorTitulo.trim()}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
            >
              {generatingAI ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Generando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generar con IA
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}