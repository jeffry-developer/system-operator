import { useState, useEffect, useRef } from "react";
import {
  Copy, Loader2, Sparkles, RotateCcw,
  Heart, Plus, Trash2, Eye, BookOpen, UserPlus,
  Save, Bookmark, Edit2, Flag, Check, ChevronRight,
  Flame, FileText, ArrowRight, ChevronLeft, Sliders,
  CheckCircle2, ArrowUpRight, Compass, LocateFixed
} from "lucide-react";
import { api } from "../services/api";
import { useToast } from "../components/Toast";
import { Perfil, HistoriaGuardada, CartaPagadora, CartaGuardada } from "../types";
import { Button } from "../components/Button";
import { Input, Label, Textarea } from "../components/Input";
import { Modal } from "../components/Modal";
import { copyToClipboard, cn } from "../utils/helpers";

const TIPO_CARTA_OPTIONS = [
  { value: "romantica", label: "Romántica", desc: "Seductora, genera deseo e intimidad", icon: Heart, color: "text-rose-500 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800" },
  { value: "sexual", label: "Sexual", desc: "Explícita, apasionada, directa", icon: Flame, color: "text-red-500 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800" },
];

const TIPO_HISTORIA_OPTIONS = [
  { value: "romantica", label: "Romántica", color: "bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800" },
  { value: "sensual", label: "Sensual", color: "bg-pink-100 dark:bg-pink-950/50 text-pink-800 dark:text-pink-300 border-pink-200 dark:border-pink-800" },
  { value: "sexual", label: "Sexual", color: "bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800" },
  { value: "personalizada", label: "Personalizada", color: "bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800" },
];

const COLORES = [
  { bg: "bg-rose-500", border: "border-rose-400 dark:border-rose-600", text: "text-rose-600 dark:text-rose-400", light: "bg-rose-50 dark:bg-rose-950/50", glow: "ring-rose-400" },
  { bg: "bg-blue-500", border: "border-blue-400 dark:border-blue-600", text: "text-blue-600 dark:text-blue-400", light: "bg-blue-50 dark:bg-blue-950/50", glow: "ring-blue-400" },
  { bg: "bg-emerald-500", border: "border-emerald-400 dark:border-emerald-600", text: "text-emerald-600 dark:text-emerald-400", light: "bg-emerald-50 dark:bg-emerald-950/50", glow: "ring-emerald-400" },
  { bg: "bg-amber-500", border: "border-amber-400 dark:border-amber-600", text: "text-amber-600 dark:text-amber-400", light: "bg-amber-50 dark:bg-amber-950/50", glow: "ring-amber-400" },
  { bg: "bg-purple-500", border: "border-purple-400 dark:border-purple-600", text: "text-purple-600 dark:text-purple-400", light: "bg-purple-50 dark:bg-purple-950/50", glow: "ring-purple-400" },
  { bg: "bg-pink-500", border: "border-pink-400 dark:border-pink-600", text: "text-pink-600 dark:text-pink-400", light: "bg-pink-50 dark:bg-pink-950/50", glow: "ring-pink-400" },
  { bg: "bg-indigo-500", border: "border-indigo-400 dark:border-indigo-600", text: "text-indigo-600 dark:text-indigo-400", light: "bg-indigo-50 dark:bg-indigo-950/50", glow: "ring-indigo-400" },
  { bg: "bg-orange-500", border: "border-orange-400 dark:border-orange-600", text: "text-orange-600 dark:text-orange-400", light: "bg-orange-50 dark:bg-orange-950/50", glow: "ring-orange-400" },
];

export function PagadorasYHistoriasPage() {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [selectedPerfilId, setSelectedPerfilId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"cartas" | "historias" | "pagadoras" | "estudio_lector">("cartas");
  const [loading, setLoading] = useState(false);
  const { success, error: showError } = useToast();

  // === CARTAS ===
  const [cartaContenido, setCartaContenido] = useState("");
  const [cartaTipo, setCartaTipo] = useState<"romantica" | "sexual">("romantica");
  const [cartaPagadora, setCartaPagadora] = useState("");
  const [cartaParrafos, setCartaParrafos] = useState<number>(20); // Por defecto 20 párrafos
  const [generandoCarta, setGenerandoCarta] = useState(false);
  const [cartasGeneradasHistorial, setCartasGeneradasHistorial] = useState<string[]>([]);
  const [cartasGuardadas, setCartasGuardadas] = useState<CartaGuardada[]>([]);
  const [showSaveCartaModal, setShowSaveCartaModal] = useState(false);
  const [saveCartaTitulo, setSaveCartaTitulo] = useState("");
  const [saveCartaPagadora, setSaveCartaPagadora] = useState("");
  const [currentCartaGenId, setCurrentCartaGenId] = useState<string>("");
  const [estudioDocId, setEstudioDocId] = useState<string>("default");

  // === PAGADORAS ===
  const [pagadoras, setPagadoras] = useState<string[]>([]);
  const [showPagadoraModal, setShowPagadoraModal] = useState(false);
  const [newPagadoraName, setNewPagadoraName] = useState("");
  const [pagadorasMarcadores, setPagadorasMarcadores] = useState<CartaPagadora[]>([]);

  // === HISTORIAS & ESTUDIO ===
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
  const [modoEdicionTexto, setModoEdicionTexto] = useState(false);

  // === MARCADORES DE PAGADORAS POR HISTORIA ===
  // Estructura: { [pagadoraName]: paragraphIndex (0-indexed) }
  const [posicionesPagadoras, setPosicionesPagadoras] = useState<Record<string, number>>({});
  const [highlightedParagraph, setHighlightedParagraph] = useState<number | null>(null);
  const [draggingPagadora, setDraggingPagadora] = useState<string | null>(null);

  const paragraphRefs = useRef<Record<number, HTMLDivElement | null>>({});

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
  }, [selectedPerfilId]);

  // Cargar marcadores específicos para el documento actual (carta o historia)
  useEffect(() => {
    if (!selectedPerfilId) return;
    const key = `posiciones_pagadoras_${selectedPerfilId}_${estudioDocId}`;
    const storedPos = localStorage.getItem(key);
    if (storedPos) {
      try {
        setPosicionesPagadoras(JSON.parse(storedPos));
      } catch {
        setPosicionesPagadoras({});
      }
    } else {
      setPosicionesPagadoras({});
    }
  }, [selectedPerfilId, estudioDocId]);

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
      if (data.length > 0 && !editorContent) {
        // Cargar primera historia por defecto en el estudio si no hay contenido
        setEditingHistoria(data[0]);
        setEstudioDocId("historia_" + data[0].id);
        setEditorTitulo(data[0].titulo);
        setEditorContent(data[0].contenido);
        setEditorTipo(data[0].tipo as any);
        setEditorPagadoraAsociada(data[0].pagadora_asociada || "");
      }
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

  // === GENERAR CARTA (CON 20 PÁRRAFOS POR DEFECTO O CONFIGURABLE) ===
  const handleGenerarCarta = async () => {
    if (!selectedPerfilId) return;
    setGenerandoCarta(true);
    try {
      const historial = cartasGeneradasHistorial.slice(-3).join("\n---ANTERIOR---\n");
      const res = await api.generarCartasPagadora(selectedPerfilId, {
        pagadora: cartaPagadora || "general",
        tipo: cartaTipo,
        cantidad: 1,
        parrafos: cartaParrafos,
        instrucciones: historial ? "EVITA REPETIR ESTAS CARTAS ANTERIORES:\n" + historial : "",
      });
      const newId = "gen_carta_" + Date.now();
      setCurrentCartaGenId(newId);
      setCartaContenido(res.contenido);
      const nuevas = [...cartasGeneradasHistorial, res.contenido].slice(-10);
      setCartasGeneradasHistorial(nuevas);
      localStorage.setItem("cartas_gen_historial_" + selectedPerfilId, JSON.stringify(nuevas));
      success(`Carta de ${cartaParrafos} párrafos generada`);
    } catch (e: any) {
      showError(e.response?.data?.detail || "Error al generar carta");
    } finally {
      setGenerandoCarta(false);
    }
  };

  // === GUARDAR CARTA PARA REUTILIZAR ===
  const openSaveCartaModal = () => {
    if (!cartaContenido) return;
    setSaveCartaTitulo(`Carta ${cartaTipo === "romantica" ? "Romántica" : "Sexual"} (${cartaParrafos} párrafos) - ${new Date().toLocaleDateString()}`);
    setSaveCartaPagadora(cartaPagadora || "");
    setShowSaveCartaModal(true);
  };

  const handleSaveCarta = () => {
    if (!saveCartaTitulo.trim()) {
      showError("Ingresa un título para guardar la carta");
      return;
    }
    const nuevaId = "carta_" + Date.now();
    const nueva: CartaGuardada = {
      id: nuevaId,
      perfil_id: selectedPerfilId,
      titulo: saveCartaTitulo.trim(),
      tipo: cartaTipo,
      contenido: cartaContenido,
      pagadora: saveCartaPagadora || undefined,
      fecha_creacion: new Date().toISOString(),
    };
    if (selectedPerfilId && currentCartaGenId && estudioDocId === currentCartaGenId) {
      const oldKey = `posiciones_pagadoras_${selectedPerfilId}_${currentCartaGenId}`;
      const savedPos = localStorage.getItem(oldKey);
      if (savedPos) {
        localStorage.setItem(`posiciones_pagadoras_${selectedPerfilId}_carta_${nuevaId}`, savedPos);
      }
    }
    const actualizadas = [nueva, ...cartasGuardadas];
    saveCartasGuardadasToStorage(actualizadas);
    setShowSaveCartaModal(false);
    success("¡Carta guardada en tu banco reutilizable!");
  };

  const handleDeleteCartaGuardada = (id: string) => {
    const actualizadas = cartasGuardadas.filter((c) => c.id !== id);
    saveCartasGuardadasToStorage(actualizadas);
    success("Carta eliminada");
  };

  const handleCargarCartaEnEstudio = (carta: CartaGuardada) => {
    setEditingHistoria(null);
    setEstudioDocId("carta_" + carta.id);
    setEditorTitulo(carta.titulo);
    setEditorContent(carta.contenido);
    setEditorTipo(carta.tipo === "sexual" ? "sexual" : "romantica");
    setEditorPagadoraAsociada(carta.pagadora || "");
    setActiveTab("estudio_lector");
    success("Carta cargada en el Estudio como historia interactiva");
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
        parrafos: 1,
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
      const nuevasPos = { ...posicionesPagadoras };
      delete nuevasPos[nombre];
      setPosicionesPagadoras(nuevasPos);
      if (selectedPerfilId) {
        localStorage.setItem(`posiciones_pagadoras_${selectedPerfilId}_${estudioDocId}`, JSON.stringify(nuevasPos));
      }
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
    setEstudioDocId("nueva_historia_" + Date.now());
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
      setEditingHistoria(null);
      setEstudioDocId("ai_historia_" + Date.now());
      setEditorContent(res.contenido);
      setActiveTab("estudio_lector");
      success("Historia generada con éxito");
    } catch (e: any) {
      showError(e.response?.data?.detail || "Error al generar historia con IA");
    } finally {
      setGeneratingAI(false);
    }
  };

  const openAbrirEnEstudio = (h: HistoriaGuardada) => {
    setEditingHistoria(h);
    setEstudioDocId("historia_" + h.id);
    setEditorContent(h.contenido);
    setEditorTitulo(h.titulo);
    setEditorTipo(h.tipo as any);
    setEditorPagadoraAsociada(h.pagadora_asociada || "");
    setActiveTab("estudio_lector");
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

  // Párrafos del contenido de la historia
  const parrafos = editorContent
    ? editorContent.split(/\n\s*\n/).filter((p) => p.trim().length > 0)
    : [];

  // Actualizar posición del marcador de una pagadora para el documento actual
  const updatePagadoraPosition = (pagadora: string, pIdx: number) => {
    const targetIdx = Math.max(0, Math.min(parrafos.length - 1, pIdx));
    const updated = {
      ...posicionesPagadoras,
      [pagadora]: targetIdx,
    };
    setPosicionesPagadoras(updated);
    if (selectedPerfilId) {
      localStorage.setItem(`posiciones_pagadoras_${selectedPerfilId}_${estudioDocId}`, JSON.stringify(updated));
    }
    scrollToParagraph(targetIdx);
  };

  // Reiniciar todos los marcadores al párrafo 1 para el documento actual
  const resetMarcadores = () => {
    setPosicionesPagadoras({});
    if (selectedPerfilId) {
      localStorage.removeItem(`posiciones_pagadoras_${selectedPerfilId}_${estudioDocId}`);
    }
    success("Marcadores reiniciados al párrafo 1 para este texto");
  };

  const scrollToParagraph = (idx: number) => {
    setHighlightedParagraph(idx);
    const el = paragraphRefs.current[idx];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setTimeout(() => {
      setHighlightedParagraph(null);
    }, 2500);
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
      {/* Header Unificado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
            <div className="p-2 bg-gradient-to-tr from-purple-600 to-rose-600 rounded-xl text-white shadow-sm">
              <BookOpen className="w-5 h-5" />
            </div>
            Estudio (Cartas & Historias)
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Generador de cartas de 20 párrafos, historias y seguimiento de pagadoras en tiempo real
          </p>
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

      {/* Tabs Principales */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 dark:border-gray-800 overflow-x-auto">
          {[
            { id: "cartas", label: "Cartas", emoji: "💌", desc: "Generador (20 párrafos) & Guardadas", count: cartasGuardadas.length },
            { id: "estudio_lector", label: "Estudio & Marcadores", emoji: "🎯", desc: "Seguimiento visual de pagadoras", activeBadge: parrafos.length > 0 ? `${parrafos.length} párr.` : undefined },
            { id: "historias", label: "Historias Guardadas", emoji: "📚", desc: "Biblioteca de narrativas", count: historias.length },
            { id: "pagadoras", label: "Pagadoras", emoji: "👥", desc: "Gestión de clientas", count: pagadoras.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex-1 min-w-max py-4 px-6 text-sm font-medium transition-all border-b-2 flex flex-col items-center gap-1",
                activeTab === tab.id
                  ? "border-purple-600 dark:border-purple-400 text-purple-600 dark:text-purple-400 bg-purple-50/60 dark:bg-purple-950/40"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              )}
            >
              <div className="flex items-center gap-2">
                <span>{tab.emoji}</span>
                <span className="font-bold">{tab.label}</span>
                {typeof tab.count === "number" && tab.count > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-semibold">
                    {tab.count}
                  </span>
                )}
                {tab.activeBadge && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-semibold">
                    {tab.activeBadge}
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500">{tab.desc}</span>
            </button>
          ))}
        </div>

        {/* ============================================================ */}
        {/* TAB 1: GENERADOR DE CARTAS (20 PÁRRAFOS POR DEFECTO + BANCO) */}
        {/* ============================================================ */}
        {activeTab === "cartas" && (
          <div className="p-6 space-y-8">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Panel de Generación */}
              <div className="bg-gradient-to-br from-rose-50/60 to-purple-50/60 dark:from-rose-950/20 dark:to-purple-950/20 p-6 rounded-2xl border border-rose-100/80 dark:border-rose-900/40 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-rose-500" />
                    Generar Carta Extensa (Romántica o Sexual)
                  </h2>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                    Defecto: 20 párrafos
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Selector de Tipo */}
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

                  {/* Selector de Pagadora */}
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

                {/* SELECTOR DE LONGITUD DE PÁRRAFOS (DEFECTO 20) */}
                <div className="bg-white dark:bg-gray-900/80 p-4 rounded-xl border border-rose-100 dark:border-rose-900/40">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-rose-500" />
                      Longitud de la carta: <span className="text-purple-600 dark:text-purple-400 font-extrabold text-sm">{cartaParrafos} párrafos</span>
                    </Label>
                    <span className="text-xs text-gray-400">
                      (Mínimo 3, por defecto 20, máximo 40)
                    </span>
                  </div>

                  {/* Botones rápidos de párrafos */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {[10, 15, 20, 25, 30].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setCartaParrafos(num)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                          cartaParrafos === num
                            ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                            : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                        )}
                      >
                        {num} párrafos {num === 20 && "(por defecto)"}
                      </button>
                    ))}
                  </div>

                  <input
                    type="range"
                    min={3}
                    max={35}
                    step={1}
                    value={cartaParrafos}
                    onChange={(e) => setCartaParrafos(parseInt(e.target.value, 10))}
                    className="w-full accent-purple-600 dark:accent-purple-400 cursor-pointer h-2 bg-gray-200 dark:bg-gray-700 rounded-lg"
                  />
                </div>

                <Button
                  onClick={handleGenerarCarta}
                  disabled={generandoCarta}
                  className="w-full bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-700 hover:to-purple-700 text-white py-3.5 text-base shadow-sm font-semibold"
                >
                  {generandoCarta ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Generando carta profunda de {cartaParrafos} párrafos con IA...
                    </>
                  ) : (
                    <>
                      <Heart className="w-5 h-5 mr-2" />
                      Generar Carta {cartaTipo === "romantica" ? "Romántica" : "Sexual"} ({cartaParrafos} Párrafos)
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
                      <span className="font-bold text-gray-900 dark:text-gray-100">
                        Carta Generada
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 font-semibold capitalize">
                        {cartaTipo}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={openSaveCartaModal}
                        className="bg-purple-600 hover:bg-purple-700 text-white text-xs"
                      >
                        <Save className="w-3.5 h-3.5 mr-1.5" />
                        Guardar para Reutilizar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const docId = currentCartaGenId || ("gen_carta_" + Date.now());
                          setEstudioDocId(docId);
                          setEditingHistoria(null);
                          setEditorTitulo(`Carta ${cartaTipo === "romantica" ? "Romántica" : "Sexual"} (${cartaParrafos} párrafos)`);
                          setEditorContent(cartaContenido);
                          setEditorTipo(cartaTipo === "sexual" ? "sexual" : "romantica");
                          setEditorPagadoraAsociada(cartaPagadora || "");
                          setActiveTab("estudio_lector");
                        }}
                        className="text-xs text-purple-600 dark:text-purple-400"
                      >
                        <Compass className="w-3.5 h-3.5 mr-1" />
                        Abrir en Estudio & Marcadores
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleCopy(cartaContenido)} className="text-xs">
                        <Copy className="w-3.5 h-3.5 mr-1" />
                        Copiar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerarCarta}
                        disabled={generandoCarta}
                        title="Generar nueva variación"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
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

              {/* BANCO DE CARTAS REUTILIZABLES */}
              <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <Bookmark className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      Banco de Cartas Guardadas (Reutilizables)
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Tus cartas guardadas listas para reutilizar, copiar o cargar en el visor de historias
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
                      Genera una carta de 20 párrafos arriba y haz clic en "Guardar para Reutilizar".
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {cartasGuardadas.map((c) => {
                      const isSexual = c.tipo === "sexual";
                      return (
                        <div
                          key={c.id}
                          className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-100 dark:border-gray-800 hover:border-purple-300 dark:hover:border-purple-800 shadow-xs transition-all flex flex-col justify-between"
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
                            <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm mb-2">{c.titulo}</h4>
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
                              onClick={() => handleCargarCartaEnEstudio(c)}
                              className="flex-1 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30"
                            >
                              <Compass className="w-3.5 h-3.5 mr-1" /> Ver en Estudio
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
        {/* TAB 2: ESTUDIO Y MARCADORES VISUALES DE PAGADORAS (REDiseño MODERNO) */}
        {/* ============================================================ */}
        {activeTab === "estudio_lector" && (
          <div className="p-6 space-y-6 max-w-5xl mx-auto">
            {/* Header del Estudio y Selector de Historia */}
            <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-gray-100 text-base">
                    {editorTitulo || "Historia en Estudio"}
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {parrafos.length} {parrafos.length === 1 ? "párrafo estructurado" : "párrafos estructurados"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModoEdicionTexto(!modoEdicionTexto)}
                  className="text-xs"
                >
                  <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                  {modoEdicionTexto ? "Ver Lector de Párrafos" : "Editar Texto"}
                </Button>
                <Button
                  onClick={saveHistoria}
                  disabled={savingHistoria}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold"
                >
                  {savingHistoria ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                  Guardar Historia
                </Button>
              </div>
            </div>

            {/* MODO EDICIÓN LIBRE DE TEXTO */}
            {modoEdicionTexto && (
              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="titulo_historia">Título de la Historia</Label>
                    <Input
                      id="titulo_historia"
                      value={editorTitulo}
                      onChange={(e) => setEditorTitulo(e.target.value)}
                      placeholder="Título de la historia..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="tipo_historia">Tipo</Label>
                    <select
                      id="tipo_historia"
                      value={editorTipo}
                      onChange={(e) => setEditorTipo(e.target.value as any)}
                      className="input"
                    >
                      {TIPO_HISTORIA_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <Label>Contenido (separa cada párrafo con doble enter)</Label>
                  <Textarea
                    value={editorContent}
                    onChange={(e) => setEditorContent(e.target.value)}
                    rows={16}
                    placeholder="Escribe o pega aquí la historia..."
                    className="font-mono text-xs leading-relaxed"
                  />
                </div>
              </div>
            )}

            {/* PANEL DE CONTROL SUPERIOR DE PAGADORAS (HUD / TRACKER VISUAL) */}
            <div className="sticky top-2 z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-2xl p-4 border border-purple-200 dark:border-purple-800/80 shadow-md space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                    Seguimiento de Pagadoras en la Historia
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-semibold">
                    {pagadoras.length} {pagadoras.length === 1 ? "pagadora" : "pagadoras"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {pagadoras.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={resetMarcadores}
                      className="text-xs text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400"
                      title="Reiniciar todos los marcadores al párrafo 1 en esta carta"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reiniciar Marcadores
                    </Button>
                  )}
                  {pagadoras.length === 0 && (
                    <Button size="sm" variant="outline" onClick={openPagadoraModal} className="text-xs">
                      <UserPlus className="w-3.5 h-3.5 mr-1" /> Crear Pagadora
                    </Button>
                  )}
                </div>
              </div>

              {pagadoras.length === 0 ? (
                <div className="text-center py-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    No tienes pagadoras creadas. Haz clic en "+ Crear Pagadora" para asignar marcadores a esta historia.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pagadoras.map((pag) => {
                    const color = getColorForPagadora(pag);
                    const currentPIdx = posicionesPagadoras[pag] ?? 0;
                    const maxP = Math.max(0, parrafos.length - 1);
                    const pct = parrafos.length > 1 ? Math.round((currentPIdx / maxP) * 100) : 100;

                    return (
                      <div
                        key={pag}
                        className={cn(
                          "p-3 rounded-xl border transition-all shadow-xs flex flex-col justify-between gap-2",
                          color.light,
                          color.border
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-xs",
                                color.bg
                              )}
                            >
                              {pag.charAt(0).toUpperCase()}
                            </span>
                            <div>
                              <h4 className="font-bold text-gray-900 dark:text-gray-100 text-xs">{pag}</h4>
                              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                Va en párrafo #{currentPIdx + 1} de {parrafos.length || 1}
                              </span>
                            </div>
                          </div>

                          <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-gray-900 border", color.border, color.text)}>
                            {pct}%
                          </span>
                        </div>

                        {/* Controles intuitivos de navegación rápida de pagadora */}
                        <div className="flex items-center gap-1.5 pt-1 border-t border-gray-200/60 dark:border-gray-700/60">
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-7 w-7 text-xs shrink-0"
                            onClick={() => updatePagadoraPosition(pag, currentPIdx - 1)}
                            disabled={currentPIdx <= 0}
                            title="Retroceder al párrafo anterior"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </Button>

                          {/* Selector directo de párrafo */}
                          <select
                            value={currentPIdx}
                            onChange={(e) => updatePagadoraPosition(pag, parseInt(e.target.value, 10))}
                            className="input h-7 py-0 px-2 text-xs text-center font-semibold flex-1"
                          >
                            {parrafos.map((_, i) => (
                              <option key={i} value={i}>
                                Párrafo {i + 1}
                              </option>
                            ))}
                          </select>

                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-7 w-7 text-xs shrink-0"
                            onClick={() => updatePagadoraPosition(pag, currentPIdx + 1)}
                            disabled={currentPIdx >= maxP}
                            title="Avanzar al siguiente párrafo"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 shrink-0"
                            onClick={() => scrollToParagraph(currentPIdx)}
                            title="Localizar en el texto"
                          >
                            <LocateFixed className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* VISOR DE LA HISTORIA DIVIDIDO EN TARJETAS DE PÁRRAFOS CLARAS Y MODERNAS */}
            <div className="space-y-4">
              {parrafos.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                  <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <h3 className="font-bold text-gray-800 dark:text-gray-200">No hay contenido en esta historia</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">
                    Haz clic en "Editar Texto" arriba o genera una historia con IA.
                  </p>
                  <Button onClick={openNewHistoria} className="bg-purple-600 hover:bg-purple-700 text-white text-xs">
                    <Sparkles className="w-4 h-4 mr-2" /> Generar Historia con IA
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {parrafos.map((p, idx) => {
                    const pagadorasAqui = pagadoras.filter(
                      (pag) => (posicionesPagadoras[pag] ?? 0) === idx
                    );
                    const isHighlighted = highlightedParagraph === idx;

                    return (
                      <div
                        key={idx}
                        ref={(el) => (paragraphRefs.current[idx] = el)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggingPagadora) {
                            updatePagadoraPosition(draggingPagadora, idx);
                            setDraggingPagadora(null);
                          }
                        }}
                        className={cn(
                          "p-5 rounded-2xl border transition-all duration-300 relative group bg-white dark:bg-gray-900 shadow-xs",
                          pagadorasAqui.length > 0
                            ? "border-purple-300 dark:border-purple-700 bg-purple-50/30 dark:bg-purple-950/20"
                            : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700",
                          isHighlighted && "ring-4 ring-purple-400 dark:ring-purple-600 shadow-lg scale-[1.01]"
                        )}
                      >
                        {/* Header del Párrafo */}
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                              Párrafo #{idx + 1} de {parrafos.length}
                            </span>
                            <span className="text-[11px] text-gray-400">
                              ({Math.round(((idx + 1) / parrafos.length) * 100)}% de avance)
                            </span>
                          </div>

                          {/* INSIGNIAS MODERNAS DE PAGADORAS SITUADAS EN ESTE PÁRRAFO */}
                          <div className="flex flex-wrap items-center gap-2">
                            {pagadorasAqui.map((pag) => {
                              const color = getColorForPagadora(pag);
                              return (
                                <span
                                  key={pag}
                                  className={cn(
                                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white shadow-xs animate-fadeIn",
                                    color.bg
                                  )}
                                >
                                  <Flag className="w-3 h-3" />
                                  {pag} va aquí
                                </span>
                              );
                            })}

                            {/* Botón rápido para situar a cualquier pagadora en este párrafo */}
                            {pagadoras.length > 0 && (
                              <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                <span className="text-[10px] text-gray-400 mr-1">Situar:</span>
                                {pagadoras.map((pag) => {
                                  const estaAqui = (posicionesPagadoras[pag] ?? 0) === idx;
                                  if (estaAqui) return null;
                                  const color = getColorForPagadora(pag);
                                  return (
                                    <button
                                      key={pag}
                                      onClick={() => updatePagadoraPosition(pag, idx)}
                                      className={cn(
                                        "text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all",
                                        color.light,
                                        color.border,
                                        color.text,
                                        "hover:scale-105"
                                      )}
                                      title={`Mover a ${pag} a este párrafo`}
                                    >
                                      + {pag}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Texto del Párrafo */}
                        <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed font-sans">
                          {p}
                        </p>

                        {/* Footer del Párrafo con acción de copiar párrafo individual */}
                        <div className="mt-3 pt-2 flex items-center justify-between text-xs text-gray-400">
                          <button
                            onClick={() => handleCopy(p)}
                            className="flex items-center gap-1 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                          >
                            <Copy className="w-3 h-3" /> Copiar este párrafo
                          </button>
                          <span className="text-[10px]">
                            {pagadorasAqui.length > 0 ? `Marcador activo para ${pagadorasAqui.join(", ")}` : "Sin marcadores"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: BIBLIOTECA DE HISTORIAS GUARDADAS */}
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
                  Selecciona cualquier historia para abrirla en el Estudio y manipular los marcadores de tus pagadoras
                </p>
              </div>
              <Button
                onClick={openNewHistoria}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Nueva Historia con IA
              </Button>
            </div>

            {historias.length === 0 ? (
              <div className="text-center py-16 bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                <BookOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="font-bold text-gray-800 dark:text-gray-200">No hay historias guardadas</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 mt-1">
                  Genera una historia con IA o carga una carta para llevar el control con marcadores.
                </p>
                <Button onClick={openNewHistoria} className="bg-purple-600 hover:bg-purple-700 text-white text-xs">
                  <Sparkles className="w-4 h-4 mr-2" /> Crear primera historia
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {historias.map((h) => (
                  <div
                    key={h.id}
                    className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <span
                          className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border",
                            h.tipo === "romantica" && "bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800",
                            h.tipo === "sensual" && "bg-pink-100 dark:bg-pink-950/40 text-pink-800 dark:text-pink-300 border-pink-200 dark:border-pink-800",
                            h.tipo === "sexual" && "bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800",
                            h.tipo === "personalizada" && "bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                          )}
                        >
                          {h.tipo}
                        </span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openAbrirEnEstudio(h)} title="Abrir en Estudio">
                            <Compass className="w-4 h-4 text-purple-600 dark:text-purple-400" />
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

                      <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1.5 line-clamp-1">{h.titulo}</h3>
                      {h.pagadora_asociada && (
                        <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold mb-2 flex items-center gap-1">
                          <UserPlus className="w-3.5 h-3.5" /> Pagadora: {h.pagadora_asociada}
                        </p>
                      )}
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-4 leading-relaxed mb-4">
                        {h.contenido}
                      </p>
                    </div>

                    <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAbrirEnEstudio(h)}
                        className="flex-1 text-xs text-purple-600 dark:text-purple-400"
                      >
                        <Compass className="w-3.5 h-3.5 mr-1" /> Abrir en Estudio
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
              <Button onClick={openPagadoraModal} className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs">
                <Plus className="w-4 h-4 mr-2" /> Nueva Pagadora
              </Button>
            </div>

            {pagadoras.length === 0 ? (
              <div className="text-center py-16 bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                <UserPlus className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="font-bold text-gray-800 dark:text-gray-200">No hay pagadoras registradas</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 mt-1">
                  Agrega a tus clientas para asociarles cartas e historias con marcadores visuales.
                </p>
                <Button onClick={openPagadoraModal} className="bg-purple-600 hover:bg-purple-700 text-white text-xs">
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
                              <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                                <Flag className="w-3 h-3" /> Párrafo #{posP + 1} en Estudio
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

      {/* MODAL: GUARDAR CARTA PARA REUTILIZAR */}
      <Modal
        isOpen={showSaveCartaModal}
        onClose={() => setShowSaveCartaModal(false)}
        title="Guardar Carta para Reutilizar"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Esta carta se guardará en tu banco permanente de cartas reutilizables. Podrás copiarla o abrirla en el estudio cuando la necesites.
          </p>

          <div>
            <Label htmlFor="carta_save_titulo">Título / Identificador *</Label>
            <Input
              id="carta_save_titulo"
              value={saveCartaTitulo}
              onChange={(e) => setSaveCartaTitulo(e.target.value)}
              placeholder="Ej: Carta romántica profunda de 20 párrafos..."
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
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" onClick={() => setShowSaveCartaModal(false)} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleSaveCarta} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold">
              Guardar Carta
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: NUEVA PAGADORA */}
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
            <Button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold">
              Crear Pagadora
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: VER HISTORIA COMPLETA */}
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

      {/* MODAL: GENERAR HISTORIA CON IA */}
      <Modal
        isOpen={showAIGenerator}
        onClose={() => setShowAIGenerator(false)}
        title="Generar Historia con IA"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            La IA generará una narrativa completa estructurada en párrafos. Podrás verla en el Estudio y manipular los marcadores de tus pagadoras.
          </p>

          <div>
            <Label>Tipo de historia</Label>
            <select
              value={editorTipo}
              onChange={(e) => setEditorTipo(e.target.value as any)}
              className="input"
            >
              {TIPO_HISTORIA_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="ai_tema">Tema o Título *</Label>
            <Input
              id="ai_tema"
              value={editorTitulo}
              onChange={(e) => setEditorTitulo(e.target.value)}
              placeholder="Ej: Noche lluviosa a solas / Fantasía compartida..."
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
                <option key={p} value={p}>{p}</option>
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
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
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