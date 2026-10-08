
import { useState, useEffect } from 'react';
import { Copy, Loader2, Sparkles, MessageSquare, FileText, RotateCcw, Heart, Zap, Layout, MessageCircle } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { Perfil, TipoMensaje, TIPO_MENSAJE_LABELS, TIPO_MENSAJE_ICONS } from '../types';
import { Button } from '../components/Button';
import { copyToClipboard } from '../utils/helpers';

// Plan de trabajo: SOLO icebreakers, carta rompehielos, cartas barrido, insistencia, saludo
const PLAN_TRABAJO: TipoMensaje[] = ['icebreaker', 'carta_rompehielos', 'carta_barrido', 'insistencia', 'saludo'];

export function PlanDeTrabajoPage() {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [selectedPerfilId, setSelectedPerfilId] = useState<string>('');
  const [mensajes, setMensajes] = useState<Record<TipoMensaje, string>>({} as Record<TipoMensaje, string>);
  const [loading, setLoading] = useState(false);
  const [generatingTypes, setGeneratingTypes] = useState<Set<string>>(new Set());
  const { success, error: showError } = useToast();

  useEffect(() => {
    api.getPerfiles().then((data) => {
      setPerfiles(data);
      if (data.length > 0) setSelectedPerfilId(data[0].id);
    }).catch(() => showError('Error al cargar perfiles'));
  }, []);

  useEffect(() => {
    if (!selectedPerfilId) return;
    setLoading(true);
    api.getUltimosMensajes(selectedPerfilId).then(setMensajes).catch(() => showError('Error al cargar')).finally(() => setLoading(false));
  }, [selectedPerfilId]);

  const handleGenerate = async (tipos: TipoMensaje[], groupId: string) => {
    if (!selectedPerfilId) return;
    setGeneratingTypes(prev => new Set(prev).add(groupId));
    try {
      const result = await api.generarMensajes(selectedPerfilId, tipos);
      setMensajes(prev => ({ ...prev, ...result.mensajes }));
      success('Plan de trabajo generado');
    } catch { showError('Error al generar'); }
    finally { setGeneratingTypes(prev => { const n = new Set(prev); n.delete(groupId); return n; }); }
  };

  const handleCopy = async (text: string) => {
    try { await copyToClipboard(text); success('Copiado'); } catch { showError('Error al copiar'); }
  };

  if (perfiles.length === 0) return (
    <div className="card p-12 text-center">
      <Sparkles className="w-16 h-16 text-primary-400 mx-auto mb-6 animate-pulse" />
      <h3 className="text-2xl font-bold text-gray-900 mb-2">Sin perfiles</h3>
      <p className="text-gray-500">Crea un perfil primero.</p>
    </div>
  );

  const isGeneratingAll = generatingTypes.has('plan');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg"><FileText className="w-5 h-5 text-blue-600" /></div>
            Plan de Trabajo
          </h1>
          <p className="text-gray-500">Icebreakers, cartas y mensajes de contacto por perfil.</p>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Perfil Activo</label>
            <select value={selectedPerfilId} onChange={(e) => setSelectedPerfilId(e.target.value)} className="input max-w-xs" disabled={loading}>
              {perfiles.map((p) => <option key={p.id} value={p.id}>{p.nombre_perfil}</option>)}
            </select>
          </div>
          <Button onClick={() => handleGenerate(PLAN_TRABAJO, 'plan')} disabled={isGeneratingAll} className="bg-blue-600 hover:bg-blue-700">
            {isGeneratingAll ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
            Renovar Todo
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {PLAN_TRABAJO.map((tipo) => (
          <MensajeItem
            key={tipo}
            tipo={tipo}
            contenido={mensajes[tipo]}
            loading={loading || isGeneratingAll || generatingTypes.has(tipo)}
            onGenerate={() => handleGenerate([tipo], tipo)}
            onCopy={handleCopy}
          />
        ))}
      </div>
    </div>
  );
}

function MensajeItem({ tipo, contenido, loading, onGenerate, onCopy }: {
  tipo: TipoMensaje; contenido: string; loading: boolean; onGenerate: () => void; onCopy: (t: string) => void;
}) {
  const IconMap: Record<string, any> = { MessageCircle, Sparkles, FileText, RotateCcw, Heart, Zap, Layout, MessageSquare };
  const Icon = IconMap[TIPO_MENSAJE_ICONS[tipo]] || MessageSquare;
  return (
    <div className="group bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
      <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white shadow-sm border border-gray-100 flex items-center justify-center">
            <Icon className="w-4 h-4 text-gray-700" />
          </div>
          <span className="font-semibold text-gray-800">{TIPO_MENSAJE_LABELS[tipo]}</span>
        </div>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {contenido && (
            <Button variant="ghost" size="sm" onClick={() => onCopy(contenido)} className="h-8">
              <Copy className="w-4 h-4 mr-2" />Copiar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onGenerate} disabled={loading} className="h-8">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
          </Button>
        </div>
      </div>
      <div className="p-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
            <div className="h-3 bg-gray-100 rounded animate-pulse w-full" />
            <div className="h-3 bg-gray-100 rounded animate-pulse w-5/6" />
          </div>
        ) : contenido ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{contenido}</p>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="text-sm text-gray-400 mb-3">Sin contenido generado</p>
            <Button variant="outline" size="sm" onClick={onGenerate} className="text-xs">
              <Sparkles className="w-3 h-3 mr-2 text-primary-500" />Generar ahora
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

