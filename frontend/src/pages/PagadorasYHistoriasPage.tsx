import { useState, useEffect, useRef, type DragEvent } from "react";
import {
  Copy, Loader2, Sparkles, RotateCcw,
  Heart, Plus, Trash2, Eye, BookOpen, UserPlus,
  Save, Bookmark, Edit2, Flag,
  Flame, FileText, ArrowRight,
  CheckCircle2, ArrowUp, Compass, LocateFixed, GripVertical, MousePointer2
} from "lucide-react";
import { api } from "../services/api";
import { useToast } from "../components/Toast";
import { Perfil, HistoriaGuardada, CartaPagadora, CartaGuardada } from "../types";
import { Button } from "../components/Button";
import { Input, Label, Textarea } from "../components/Input";
import { Modal } from "../components/Modal";
import { copyToClipboard, cn } from "../utils/helpers";

const TIPO_CARTA_OPTIONS = [
  { value: "romantica", label: "Romántica", desc: "Amor, deseo y conexión emocional", icon: Heart, color: "text-rose-500 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800" },
  { value: "sexual", label: "Sexual", desc: "Deseo intenso y fantasía para adultas", icon: Flame, color: "text-red-500 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800" },
];

const PROMPT_CARTA_ROMANTICA = `Genera UNA SOLA carta romántica general dirigida a una mujer adulta. Enfócate en decirle cuánto la amas, cuánto la deseas y cómo ocupa tus pensamientos. Haz que el tono sea íntimo, profundo, apasionado y natural, sin dar detalles personales concretos, nombres, lugares ni situaciones específicas.

La carta debe tener EXACTAMENTE 30 párrafos. Cada párrafo debe ser sustancioso, de una extensión aproximada de tres líneas, con varias oraciones conectadas y sin párrafos demasiado cortos. Mantén un solo hilo emocional de principio a fin y evita repetir las mismas ideas o frases.

No menciones que nunca se han visto ni expliques a quién va dirigida. No propongas encuentros ni planes presenciales. No uses palabras o ideas como “vernos”, “encontrarnos”, “cara a cara”, “disfrutar juntos”, “conocernos”, “viajar”, “tener una cita” o expresiones parecidas.

Separa cada párrafo con una línea en blanco. No numeres los párrafos, no agregues título, encabezados, etiquetas, notas ni explicaciones. Devuelve únicamente el cuerpo de la carta.`;

const PROMPT_CARTA_SEXUAL = `Genera UNA SOLA carta sexual general dirigida a una mujer adulta. Enfócate en cuánto la deseas, en la intensidad de la atracción y en las muchas cosas íntimas que imaginas hacerle. El tono debe ser ardiente, explícito, directo y apasionado, pero natural, sin nombres, lugares ni detalles personales concretos.

La carta debe tener EXACTAMENTE 30 párrafos. Cada párrafo debe ser sustancioso, de una extensión aproximada de tres líneas, con varias oraciones conectadas y sin párrafos demasiado cortos. Mantén una progresión sensual clara de principio a fin y evita repetir acciones, ideas o frases.

No menciones que nunca se han visto ni expliques a quién va dirigida. No propongas encuentros ni planes presenciales. No uses palabras o ideas como “vernos”, “encontrarnos”, “cara a cara”, “disfrutar juntos”, “conocernos”, “viajar”, “tener una cita” o expresiones parecidas.

Separa cada párrafo con una línea en blanco. No numeres los párrafos, no agregues título, encabezados, etiquetas, notas ni explicaciones. Devuelve únicamente el cuerpo de la carta.`;

const separarParrafosCarta = (contenido: string) => {
  const limpio = contenido
    .replace(/```(?:text|markdown)?/gi, "")
    .replace(/```/g, "")
    .replace(/\r\n?/g, "\n")
    .trim();

  if (!limpio) return [];

  let bloques = limpio.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);

  if (bloques.length <= 1) {
    bloques = limpio
      .split(/(?=^\s*(?:p[áa]rrafo\s*)?\d{1,2}\s*[.):-]\s+)/gim)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  if (bloques.length <= 1) {
    const lineas = limpio.split("\n").map((linea) => linea.trim()).filter(Boolean);
    if (lineas.length >= 20) bloques = lineas;
  }

  return bloques.map((bloque) =>
    bloque
      .replace(/^\s*(?:p[áa]rrafo\s*)?\d{1,2}\s*[.):-]\s*/i, "")
      .replace(/\s*\n\s*/g, " ")
      .trim()
  ).filter(Boolean);
};

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
  const [cartaParrafos, setCartaParrafos] = useState<number>(30);
  const [promptCartaRomantica, setPromptCartaRomantica] = useState(() =>
    localStorage.getItem("prompt_carta_romantica") || PROMPT_CARTA_ROMANTICA
  );
  const [promptCartaSexual, setPromptCartaSexual] = useState(() =>
    localStorage.getItem("prompt_carta_sexual") || PROMPT_CARTA_SEXUAL
  );
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
  const [editingPagadora, setEditingPagadora] = useState<CartaPagadora | null>(null);
  const [editPagadoraName, setEditPagadoraName] = useState("");
  const [updatingPagadora, setUpdatingPagadora] = useState(false);

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
  const [dragOverParagraph, setDragOverParagraph] = useState<number | null>(null);

  const paragraphRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const pagadorasPanelRef = useRef<HTMLDivElement | null>(null);

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
  }, [selectedPerfilId]);

  useEffect(() => {
    localStorage.setItem("prompt_carta_romantica", promptCartaRomantica);
  }, [promptCartaRomantica]);

  useEffect(() => {
    localStorage.setItem("prompt_carta_sexual", promptCartaSexual);
  }, [promptCartaSexual]);

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

  const parrafosCartaPegada = separarParrafosCarta(cartaContenido);

  const handlePrepararCarta = () => {
    if (!cartaContenido.trim()) {
      showError("Pega primero la carta generada");
      return;
    }

    const parrafosSeparados = separarParrafosCarta(cartaContenido);
    if (parrafosSeparados.length === 0) {
      showError("No fue posible identificar los párrafos de la carta");
      return;
    }

    const contenidoNormalizado = parrafosSeparados.join("\n\n");
    const docId = "carta_pegada_" + Date.now();
    setCartaContenido(contenidoNormalizado);
    setCartaParrafos(parrafosSeparados.length);
    setCurrentCartaGenId(docId);
    setEstudioDocId(docId);
    setEditingHistoria(null);
    setEditorTitulo(`Carta ${cartaTipo === "romantica" ? "Romántica" : "Sexual"} (${parrafosSeparados.length} párrafos)`);
    setEditorContent(contenidoNormalizado);
    setEditorTipo(cartaTipo === "sexual" ? "sexual" : "romantica");
    setEditorPagadoraAsociada("");
    setActiveTab("estudio_lector");

    if (parrafosSeparados.length === 30) {
      success("Carta separada en 30 párrafos y lista para organizar");
    } else {
      success(`Carta separada en ${parrafosSeparados.length} párrafos; el prompt solicita 30`);
    }
  };

  // === GUARDAR CARTA PARA REUTILIZAR ===
  const openSaveCartaModal = () => {
    const desdeEstudio = activeTab === "estudio_lector" && estudioDocId.startsWith("carta_");
    const contenido = desdeEstudio ? editorContent : cartaContenido;
    const tipo = desdeEstudio && editorTipo === "sexual" ? "sexual" : cartaTipo;
    const cantidadParrafos = separarParrafosCarta(contenido).length;
    if (!contenido.trim()) return;
    setCartaContenido(contenido);
    setCartaTipo(tipo);
    setCartaParrafos(cantidadParrafos);
    setSaveCartaTitulo(`Carta ${tipo === "romantica" ? "Romántica" : "Sexual"} (${cantidadParrafos} párrafos) - ${new Date().toLocaleDateString()}`);
    setSaveCartaPagadora((desdeEstudio ? editorPagadoraAsociada : "") || "");
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
    success("Carta cargada en el Estudio");
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

  const syncPagadoraLocalReferences = (oldName: string, newName: string | null) => {
    const storagePrefix = `posiciones_pagadoras_${selectedPerfilId}_`;
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(storagePrefix)) continue;

      try {
        const storedPositions = JSON.parse(localStorage.getItem(key) || "{}") as Record<string, number>;
        if (!(oldName in storedPositions)) continue;
        if (newName) storedPositions[newName] = storedPositions[oldName];
        delete storedPositions[oldName];
        localStorage.setItem(key, JSON.stringify(storedPositions));
      } catch { }
    }

    const updatedPositions = { ...posicionesPagadoras };
    if (oldName in updatedPositions) {
      if (newName) updatedPositions[newName] = updatedPositions[oldName];
      delete updatedPositions[oldName];
      setPosicionesPagadoras(updatedPositions);
    }

    const updatedCartas = cartasGuardadas.map((carta) =>
      carta.pagadora === oldName
        ? { ...carta, pagadora: newName || undefined }
        : carta
    );
    saveCartasGuardadasToStorage(updatedCartas);
    setSaveCartaPagadora((value) => value === oldName ? newName || "" : value);
    setEditorPagadoraAsociada((value) => value === oldName ? newName || "" : value);
  };

  const openEditPagadora = (pagadora: CartaPagadora) => {
    setEditingPagadora(pagadora);
    setEditPagadoraName(pagadora.nombre_pagadora);
  };

  const updatePagadora = async () => {
    if (!editingPagadora) return;
    const nuevoNombre = editPagadoraName.trim();
    if (!nuevoNombre) {
      showError("Ingresa un nombre para la pagadora");
      return;
    }
    if (
      nuevoNombre.toLowerCase() !== editingPagadora.nombre_pagadora.toLowerCase()
      && pagadoras.some((nombre) => nombre.toLowerCase() === nuevoNombre.toLowerCase())
    ) {
      showError("Esa pagadora ya existe");
      return;
    }
    if (nuevoNombre === editingPagadora.nombre_pagadora) {
      setEditingPagadora(null);
      return;
    }

    setUpdatingPagadora(true);
    try {
      await api.updatePagadora(selectedPerfilId, editingPagadora.id, nuevoNombre);
      syncPagadoraLocalReferences(editingPagadora.nombre_pagadora, nuevoNombre);
      setEditingPagadora(null);
      await Promise.all([loadPagadoras(), loadHistorias()]);
      success(`Pagadora renombrada como "${nuevoNombre}"`);
    } catch (e: any) {
      showError(e.response?.data?.detail || "Error al actualizar pagadora");
    } finally {
      setUpdatingPagadora(false);
    }
  };

  const deletePagadora = async (pagadora: CartaPagadora) => {
    const nombre = pagadora.nombre_pagadora;
    if (!confirm(`¿Eliminar la pagadora "${nombre}"? Sus cartas quedarán sin pagadora asociada.`)) return;
    try {
      await api.deletePagadora(selectedPerfilId, pagadora.id);
      syncPagadoraLocalReferences(nombre, null);
      success(`Pagadora "${nombre}" eliminada`);
      await Promise.all([loadPagadoras(), loadHistorias()]);
    } catch (e: any) {
      showError(e.response?.data?.detail || "Error al eliminar pagadora");
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
      success("Carta generada con éxito");
    } catch (e: any) {
      showError(e.response?.data?.detail || "Error al generar la carta con IA");
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
      success(editingHistoria ? "Carta actualizada" : "Carta guardada");
      loadHistorias();
    } catch (e: any) {
      showError(e.response?.data?.detail || "Error al guardar la carta");
    } finally {
      setSavingHistoria(false);
    }
  };

  const deleteHistoria = async (id: string) => {
    if (!confirm("¿Eliminar esta carta?")) return;
    try {
      await api.deleteHistoria(selectedPerfilId, id);
      success("Carta eliminada");
      loadHistorias();
    } catch {
      showError("Error al eliminar la carta");
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

  const startMarkerDrag = (event: DragEvent<HTMLElement>, pagadora: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", pagadora);
    setDraggingPagadora(pagadora);
  };

  const finishMarkerDrag = () => {
    setDraggingPagadora(null);
    setDragOverParagraph(null);
  };

  const dropMarkerAtParagraph = (event: DragEvent<HTMLElement>, paragraphIndex: number) => {
    event.preventDefault();
    const pagadora = draggingPagadora || event.dataTransfer.getData("text/plain");
    if (pagadora) updatePagadoraPosition(pagadora, paragraphIndex);
    finishMarkerDrag();
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
            Estudio de Cartas
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Prompts editables, cartas separadas por párrafos y seguimiento visual de pagadoras
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
            { id: "cartas", label: "Cartas", emoji: "💌", desc: "Prompts, pegado y guardadas", count: cartasGuardadas.length },
            { id: "estudio_lector", label: "Estudio & Marcadores", emoji: "🎯", desc: "Seguimiento visual de pagadoras", activeBadge: parrafos.length > 0 ? `${parrafos.length} párr.` : undefined },
            { id: "historias", label: "Cartas Guardadas", emoji: "📚", desc: "Todas tus cartas guardadas", count: historias.length + cartasGuardadas.length },
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
        {/* TAB 1: PROMPTS Y PREPARACIÓN MANUAL DE CARTAS */}
        {/* ============================================================ */}
        {activeTab === "cartas" && (
          <div className="p-6 space-y-8">
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="overflow-hidden rounded-3xl border border-purple-100 bg-gradient-to-br from-white via-rose-50/40 to-purple-50/70 shadow-sm dark:border-purple-900/50 dark:from-gray-900 dark:via-rose-950/10 dark:to-purple-950/20">
                <div className="border-b border-purple-100 px-6 py-5 dark:border-purple-900/40">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                        <Sparkles className="h-3.5 w-3.5" /> Flujo manual · 30 párrafos
                      </div>
                      <h2 className="text-xl font-black text-gray-950 dark:text-white">Prepara y organiza tus cartas</h2>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Copia un prompt, genera la carta donde prefieras y pégala aquí para separarla automáticamente.
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-1 rounded-2xl border border-white/80 bg-white/80 p-1.5 text-[11px] font-bold text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-900/80 dark:text-gray-400">
                      <span className="rounded-xl bg-rose-50 px-3 py-2 text-center text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">1 · Copia</span>
                      <span className="rounded-xl px-3 py-2 text-center">2 · Pega</span>
                      <span className="rounded-xl px-3 py-2 text-center">3 · Organiza</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-7 p-6">
                  <section aria-labelledby="prompts-cartas-title">
                    <div className="mb-3 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-purple-500">Paso 1</p>
                        <h3 id="prompts-cartas-title" className="text-base font-bold text-gray-900 dark:text-gray-100">Elige, edita y copia el prompt</h3>
                      </div>
                      <span className="text-xs text-gray-400">Tus cambios se guardan automáticamente</span>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      {TIPO_CARTA_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        const isRomantica = opt.value === "romantica";
                        const isSelected = cartaTipo === opt.value;
                        const promptValue = isRomantica ? promptCartaRomantica : promptCartaSexual;
                        const setPromptValue = isRomantica ? setPromptCartaRomantica : setPromptCartaSexual;
                        const defaultPrompt = isRomantica ? PROMPT_CARTA_ROMANTICA : PROMPT_CARTA_SEXUAL;

                        return (
                          <article
                            key={opt.value}
                            className={cn(
                              "rounded-2xl border-2 bg-white p-4 transition-all dark:bg-gray-900",
                              isSelected
                                ? isRomantica
                                  ? "border-rose-400 shadow-md shadow-rose-100/60 dark:border-rose-700 dark:shadow-none"
                                  : "border-red-400 shadow-md shadow-red-100/60 dark:border-red-700 dark:shadow-none"
                                : "border-gray-100 dark:border-gray-800"
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => setCartaTipo(opt.value as "romantica" | "sexual")}
                              className="mb-3 flex w-full items-center justify-between text-left"
                            >
                              <span className="flex items-center gap-3">
                                <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", opt.color)}>
                                  <Icon className="h-5 w-5" />
                                </span>
                                <span>
                                  <span className="block text-sm font-black text-gray-900 dark:text-gray-100">Carta {opt.label}</span>
                                  <span className="block text-xs text-gray-500 dark:text-gray-400">{opt.desc}</span>
                                </span>
                              </span>
                              {isSelected && <CheckCircle2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
                            </button>

                            <Textarea
                              value={promptValue}
                              onFocus={() => setCartaTipo(opt.value as "romantica" | "sexual")}
                              onChange={(e) => setPromptValue(e.target.value)}
                              rows={12}
                              aria-label={`Prompt para carta ${opt.label.toLowerCase()}`}
                              className="resize-y font-mono text-xs leading-relaxed"
                            />

                            <div className="mt-3 flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  setCartaTipo(opt.value as "romantica" | "sexual");
                                  handleCopy(promptValue);
                                }}
                                className={cn(
                                  "flex-1 text-xs font-bold text-white",
                                  isRomantica ? "bg-rose-600 hover:bg-rose-700" : "bg-red-600 hover:bg-red-700"
                                )}
                              >
                                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar prompt {opt.label.toLowerCase()}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => setPromptValue(defaultPrompt)}
                                title="Restaurar prompt original"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-purple-200 bg-white p-5 shadow-sm dark:border-purple-800 dark:bg-gray-900" aria-labelledby="pegar-carta-title">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-purple-500">Paso 2</p>
                        <h3 id="pegar-carta-title" className="text-base font-bold text-gray-900 dark:text-gray-100">Pega aquí la carta terminada</h3>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Detectamos los saltos dobles, la numeración y otros formatos comunes.</p>
                      </div>
                      <span className={cn(
                        "rounded-full border px-3 py-1 text-xs font-black",
                        parrafosCartaPegada.length === 30
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : cartaContenido
                            ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                            : "border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                      )}>
                        {parrafosCartaPegada.length || 0} / 30 párrafos detectados
                      </span>
                    </div>

                    <Textarea
                      value={cartaContenido}
                      onChange={(e) => setCartaContenido(e.target.value)}
                      rows={14}
                      placeholder="Pega aquí los 30 párrafos generados..."
                      className="resize-y text-sm leading-relaxed"
                    />

                    <div className="mt-4">
                      <Button
                        type="button"
                        onClick={handlePrepararCarta}
                        disabled={!cartaContenido.trim()}
                        className="h-11 w-full bg-gradient-to-r from-purple-600 to-rose-600 font-bold text-white shadow-sm hover:from-purple-700 hover:to-rose-700"
                      >
                        Separar párrafos y abrir marcadores
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>

                    {cartaContenido && (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {parrafosCartaPegada.length === 30
                            ? "La carta está lista: al continuar podrás copiar cada párrafo y mover las pagadoras."
                            : "Puedes continuar aunque no sean 30; revisa el resultado en el estudio."}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleCopy(cartaContenido)} className="text-xs">
                            <Copy className="mr-1 h-3.5 w-3.5" /> Copiar carta
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setCartaContenido("")} className="text-xs text-red-600 dark:text-red-400">
                            <Trash2 className="mr-1 h-3.5 w-3.5" /> Limpiar
                          </Button>
                        </div>
                      </div>
                    )}
                  </section>
                </div>
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
                    {editorTitulo || "Carta en Estudio"}
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {parrafos.length} {parrafos.length === 1 ? "párrafo estructurado" : "párrafos estructurados"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {estudioDocId.startsWith("carta_") && editorContent.trim() && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openSaveCartaModal}
                    className="text-xs text-rose-600 dark:text-rose-400"
                  >
                    <Bookmark className="w-3.5 h-3.5 mr-1.5" />
                    Guardar en banco
                  </Button>
                )}
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
                  Guardar Carta
                </Button>
              </div>
            </div>

            {/* MODO EDICIÓN LIBRE DE TEXTO */}
            {modoEdicionTexto && (
              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="titulo_historia">Título de la Carta</Label>
                    <Input
                      id="titulo_historia"
                      value={editorTitulo}
                      onChange={(e) => setEditorTitulo(e.target.value)}
                      placeholder="Título de la carta..."
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
                    placeholder="Escribe o pega aquí la carta..."
                    className="font-mono text-xs leading-relaxed"
                  />
                </div>
              </div>
            )}

            {/* PANEL DE CONTROL SUPERIOR DE PAGADORAS (HUD / TRACKER VISUAL) */}
            <div ref={pagadorasPanelRef} className="sticky top-2 z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-2xl p-4 border border-purple-200 dark:border-purple-800/80 shadow-md space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                    Seguimiento de Pagadoras en la Carta
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-semibold">
                    {pagadoras.length} {pagadoras.length === 1 ? "pagadora" : "pagadoras"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
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
                    No tienes pagadoras creadas. Haz clic en "+ Crear Pagadora" para asignar marcadores a esta carta.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 rounded-xl border border-purple-100 bg-purple-50/70 px-3 py-2 text-xs text-purple-700 dark:border-purple-900/60 dark:bg-purple-950/30 dark:text-purple-300">
                    <MousePointer2 className="h-3.5 w-3.5 shrink-0" />
                    Arrastra el nombre de la pagadora y suéltalo al lado del párrafo que le corresponde.
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pagadoras.map((pag) => {
                    const color = getColorForPagadora(pag);
                    const currentPIdx = posicionesPagadoras[pag] ?? 0;

                    return (
                      <div
                        key={pag}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-xl border p-3 shadow-xs transition-all select-none",
                          parrafos.length > 0 && "hover:-translate-y-0.5 hover:shadow-md",
                          draggingPagadora === pag && "opacity-50 ring-2 ring-purple-400",
                          color.light,
                          color.border
                        )}
                      >
                        <button
                          type="button"
                          draggable={parrafos.length > 0}
                          onDragStart={(event) => startMarkerDrag(event, pag)}
                          onDragEnd={finishMarkerDrag}
                          disabled={parrafos.length === 0}
                          className="flex min-w-0 cursor-grab items-center gap-2 rounded-lg font-bold text-gray-900 transition-transform hover:scale-[1.02] active:cursor-grabbing disabled:cursor-not-allowed dark:text-gray-100"
                          title={`Arrastrar marcador de ${pag}`}
                        >
                          <span className="truncate text-sm">{pag}</span>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-purple-600 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900/40"
                          onClick={() => scrollToParagraph(currentPIdx)}
                          title={`Localizar a ${pag} en la carta`}
                          aria-label={`Localizar a ${pag} en la carta`}
                        >
                          <LocateFixed className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                  </div>
                </>
              )}
            </div>

            {/* VISOR DE LA HISTORIA DIVIDIDO EN TARJETAS DE PÁRRAFOS CLARAS Y MODERNAS */}
            <div className="space-y-4">
              {parrafos.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                  <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <h3 className="font-bold text-gray-800 dark:text-gray-200">No hay contenido en esta carta</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">
                    Haz clic en "Editar Texto" arriba o genera una carta con IA.
                  </p>
                  <Button onClick={openNewHistoria} className="bg-purple-600 hover:bg-purple-700 text-white text-xs">
                    <Sparkles className="w-4 h-4 mr-2" /> Generar Carta con IA
                  </Button>
                </div>
              ) : (
                <div className="relative space-y-4 pl-14 before:absolute before:bottom-6 before:left-5 before:top-6 before:w-px before:bg-gradient-to-b before:from-purple-300 before:via-purple-200 before:to-transparent dark:before:from-purple-700 dark:before:via-purple-900">
                  {parrafos.map((p, idx) => {
                    const pagadorasAqui = pagadoras.filter(
                      (pag) => (posicionesPagadoras[pag] ?? 0) === idx
                    );
                    const isHighlighted = highlightedParagraph === idx;

                    return (
                      <div
                        key={idx}
                        ref={(el) => (paragraphRefs.current[idx] = el)}
                        onDragEnter={() => setDragOverParagraph(idx)}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(event) => dropMarkerAtParagraph(event, idx)}
                        className={cn(
                          "p-5 rounded-2xl border transition-all duration-300 relative group bg-white dark:bg-gray-900 shadow-xs",
                          pagadorasAqui.length > 0
                            ? "border-purple-300 dark:border-purple-700 bg-purple-50/30 dark:bg-purple-950/20"
                            : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700",
                          isHighlighted && "ring-4 ring-purple-400 dark:ring-purple-600 shadow-lg scale-[1.01]",
                          draggingPagadora && "border-dashed border-purple-300 dark:border-purple-700",
                          dragOverParagraph === idx && "border-purple-500 bg-purple-50/70 ring-4 ring-purple-200 shadow-lg dark:border-purple-400 dark:bg-purple-950/30 dark:ring-purple-900/70"
                        )}
                      >
                        <div className="absolute -left-14 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-1">
                          {pagadorasAqui.length > 0 ? (
                            pagadorasAqui.map((pag) => {
                              const color = getColorForPagadora(pag);
                              return (
                                <button
                                  key={pag}
                                  type="button"
                                  draggable
                                  onDragStart={(event) => startMarkerDrag(event, pag)}
                                  onDragEnd={finishMarkerDrag}
                                  onClick={() => scrollToParagraph(idx)}
                                  className={cn(
                                    "group/marker relative flex h-10 w-10 cursor-grab items-center justify-center rounded-xl border-2 border-white text-xs font-black text-white shadow-lg ring-2 ring-white transition-all hover:scale-110 active:cursor-grabbing dark:border-gray-950 dark:ring-gray-950",
                                    color.bg,
                                    draggingPagadora === pag && "scale-110 opacity-40"
                                  )}
                                  title={`${pag}: párrafo ${idx + 1}. Arrastra para mover`}
                                  aria-label={`Mover marcador de ${pag} desde el párrafo ${idx + 1}`}
                                >
                                  {pag.charAt(0).toUpperCase()}
                                  <GripVertical className="absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full bg-white p-0.5 text-gray-500 shadow dark:bg-gray-800 dark:text-gray-300" />
                                  <span className="pointer-events-none absolute left-12 whitespace-nowrap rounded-lg bg-gray-950 px-2 py-1 text-[10px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover/marker:opacity-100">
                                    {pag}
                                  </span>
                                </button>
                              );
                            })
                          ) : (
                            <span
                              className={cn(
                                "h-3 w-3 rounded-full border-2 border-white bg-gray-300 shadow-sm ring-1 ring-gray-200 transition-all dark:border-gray-950 dark:bg-gray-700 dark:ring-gray-800",
                                draggingPagadora && "h-5 w-5 animate-pulse bg-purple-300 ring-4 ring-purple-100 dark:bg-purple-700 dark:ring-purple-950",
                                dragOverParagraph === idx && "h-7 w-7 bg-purple-500 ring-4 ring-purple-200 dark:bg-purple-400 dark:ring-purple-900"
                              )}
                            />
                          )}
                        </div>

                        {/* Header del Párrafo */}
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                              Párrafo #{idx + 1} de {parrafos.length}
                            </span>
                          </div>

                          {/* INSIGNIAS MODERNAS DE PAGADORAS SITUADAS EN ESTE PÁRRAFO */}
                          <div className="flex flex-wrap items-center gap-2">
                            {pagadorasAqui.map((pag) => {
                              const color = getColorForPagadora(pag);
                              return (
                                <button
                                  key={pag}
                                  type="button"
                                  draggable
                                  onDragStart={(event) => startMarkerDrag(event, pag)}
                                  onDragEnd={finishMarkerDrag}
                                  className={cn(
                                    "inline-flex cursor-grab items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white shadow-xs transition-transform hover:scale-105 active:cursor-grabbing",
                                    color.bg
                                  )}
                                  title={`Arrastrar marcador de ${pag}`}
                                >
                                  <GripVertical className="h-3 w-3" />
                                  {pag}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Texto del Párrafo */}
                        <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed font-sans">
                          {p}
                        </p>

                        {/* Footer del Párrafo con acción de copiar párrafo individual */}
                        <div className="mt-3 flex items-center pt-2 text-xs text-gray-400">
                          <button
                            onClick={() => handleCopy(p)}
                            className="flex items-center gap-1 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                          >
                            <Copy className="w-3 h-3" /> Copiar este párrafo
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {parrafos.length > 0 && pagadoras.length > 0 && (
              <button
                type="button"
                onClick={() => pagadorasPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full bg-purple-600 px-4 py-3 text-sm font-bold text-white shadow-xl transition-transform hover:-translate-y-0.5 hover:bg-purple-700"
                title="Volver a la lista de pagadoras"
              >
                <ArrowUp className="h-4 w-4" />
                Ver pagadoras
              </button>
            )}
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
                  Cartas Guardadas
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Toda tu biblioteca en un solo lugar, lista para copiar o abrir en el Estudio
                </p>
              </div>
              <Button
                onClick={openNewHistoria}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Nueva Carta con IA
              </Button>
            </div>

            {/* BANCO DE CARTAS REUTILIZABLES */}
            <section className="rounded-2xl border border-purple-100 bg-purple-50/30 p-5 dark:border-purple-900/50 dark:bg-purple-950/10">
              <div className="mb-4 flex justify-end">
                <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 bg-white dark:bg-gray-900 px-3 py-1 rounded-full border border-purple-200 dark:border-purple-800">
                  {cartasGuardadas.length + historias.length} {cartasGuardadas.length + historias.length === 1 ? "carta" : "cartas"}
                </span>
              </div>

              {cartasGuardadas.length + historias.length === 0 ? (
                <div className="text-center py-8 bg-white/70 dark:bg-gray-900/70 rounded-2xl border border-dashed border-purple-200 dark:border-purple-800">
                  <Heart className="w-10 h-10 text-purple-200 dark:text-purple-800 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Aún no tienes cartas guardadas</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Pega una carta en la pestaña Cartas y guárdala desde el Estudio.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {cartasGuardadas.map((c) => {
                    const isSexual = c.tipo === "sexual";
                    return (
                      <article
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
                            title="Eliminar carta guardada"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            {historias.length > 0 && (
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
            </section>
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
                  Clientas a las que les envías cartas y llevas seguimiento
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
                  Agrega a tus clientas para ordenar sus cartas de forma sencilla.
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

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => marcador && openEditPagadora(marcador)}
                          disabled={!marcador}
                          className="text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20"
                          title={`Editar ${nombre}`}
                          aria-label={`Editar pagadora ${nombre}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => marcador && deletePagadora(marcador)}
                          disabled={!marcador}
                          className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title={`Eliminar ${nombre}`}
                          aria-label={`Eliminar pagadora ${nombre}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
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
              placeholder="Ej: Carta romántica profunda de 30 párrafos..."
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

      {/* MODAL: EDITAR PAGADORA */}
      <Modal
        isOpen={!!editingPagadora}
        onClose={() => !updatingPagadora && setEditingPagadora(null)}
        title="Editar Pagadora"
        size="sm"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            updatePagadora();
          }}
          className="space-y-4"
        >
          <p className="text-xs text-gray-500 dark:text-gray-400">
            El nuevo nombre también se actualizará en sus cartas guardadas y marcadores del Estudio.
          </p>
          <div>
            <Label htmlFor="pagadora_edit_nombre">Nombre de la pagadora *</Label>
            <Input
              id="pagadora_edit_nombre"
              value={editPagadoraName}
              onChange={(event) => setEditPagadoraName(event.target.value)}
              placeholder="Nombre de la pagadora"
              maxLength={100}
              required
              autoFocus
            />
          </div>
          <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditingPagadora(null)}
              disabled={updatingPagadora}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={updatingPagadora || !editPagadoraName.trim()}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
            >
              {updatingPagadora ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" /> Guardar Cambios</>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: VER HISTORIA COMPLETA */}
      <Modal
        isOpen={!!viewingHistoria}
        onClose={() => setViewingHistoria(null)}
        title={viewingHistoria?.titulo || "Carta Completa"}
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
        title="Generar Carta con IA"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            La IA generará una carta completa por párrafos. Podrás verla en el Estudio y mover los nombres de tus pagadoras.
          </p>

          <div>
            <Label>Tipo de carta</Label>
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
              placeholder="Ejemplo: Carta romántica sobre una noche lluviosa..."
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
