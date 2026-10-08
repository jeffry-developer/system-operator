import { useState, useEffect } from 'react';
import { Copy, Loader2, Sparkles, MessageSquare, FileText, RotateCcw, Heart, Zap, Layout, MessageCircle } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { Perfil, TipoMensaje, TIPO_MENSAJE_LABELS, TIPO_MENSAJE_ICONS } from '../types';
import { Button } from '../components/Button';
import { copyToClipboard } from '../utils/helpers';

const PLAN_TRABAJO: TipoMensaje[] = ['icebreaker', 'carta_rompehielos', 'carta_barrido', 'insistencia', 'saludo'];
const NEW_FEED: TipoMensaje[] = ['respuestas_rapidas', 'insistencia', 'saludo', 'posts'];

export function MensajesPage() {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [selectedPerfilId, setSelectedPerfilId] = useState<string>('');
  const [mensajes, setMensajes] = useState<Record<TipoMensaje, string>>({} as Record<TipoMensaje, string>);
  const [loading, setLoading] = useState(false);
  const [generatingTypes, setGeneratingTypes] = useState<Set<string>>(new Set());
  const { success, error: showError } = useToast();

  useEffect(() => {
    api.getPerfiles()
      .then((data) => {
        setPerfiles(data);
        if (data.length > 0 && !selectedPerfilId) {
          setSelectedPerfilId(data[0].id);
        }
      })
      .catch(() => showError('Error al cargar perfiles'));
  }, [selectedPerfilId]);

  useEffect(() => {
    if (!selectedPerfilId) return;
    setLoading(true);
    api.getUltimosMensajes(selectedPerfilId)
      .then((ultimos) => {
        setMensajes(ultimos);
      })
      .catch(() => showError('Error al cargar mensajes'))
      .finally(() => setLoading(false));
  }, [selectedPerfilId]);

  const handleGenerate = async (tipos: TipoMensaje[], groupId: string) => {
    if (!selectedPerfilId) return;
    
    setGeneratingTypes(prev => new Set(prev).add(groupId));
    try {
      const result = await api.generarMensajes(selectedPerfilId, tipos);
      setMensajes(prev => ({ ...prev, ...result.mensajes }));
      success('Contenido generado exitosamente ✨');
    } catch (err) {
      showError('Error al generar contenido');
    } finally {
      setGeneratingTypes(prev => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
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

  if (perfiles.length === 0) {
    return (
      <div className="card p-12 text-center bg-white/50 backdrop-blur-xl border border-white/20 shadow-2xl">
        <Sparkles className="w-16 h-16 text-primary-400 mx-auto mb-6 animate-pulse" />
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Aún no hay perfiles</h3>
        <p className="text-gray-500 mb-6">Crea tu primer perfil para empezar a generar magia.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Centro de Operaciones</h1>
          <p className="text-gray-500">Genera contenido hiper-personalizado con IA.</p>
        </div>
        
        <div className="flex flex-col">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Perfil Activo</label>
          <select
            value={selectedPerfilId}
            onChange={(e) => setSelectedPerfilId(e.target.value)}
            className="input max-w-xs bg-gray-50 border-gray-200 focus:bg-white transition-colors"
            disabled={loading}
          >
            {perfiles.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre_perfil}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        
        {/* COLUMNA: PLAN DE TRABAJO */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                <FileText className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Plan de Trabajo</h2>
            </div>
            <Button 
              onClick={() => handleGenerate(PLAN_TRABAJO, 'plan_completo')} 
              disabled={generatingTypes.has('plan_completo')}
              className="bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20"
            >
              {generatingTypes.has('plan_completo') ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
              Renovar Plan
            </Button>
          </div>

          <div className="space-y-4">
            {PLAN_TRABAJO.map((tipo) => (
              <MensajeItem 
                key={`plan-${tipo}`} 
                tipo={tipo} 
                contenido={mensajes[tipo]} 
                loading={loading || generatingTypes.has('plan_completo') || generatingTypes.has(tipo)} 
                onGenerate={() => handleGenerate([tipo], tipo)}
                onCopy={handleCopy} 
              />
            ))}
          </div>
        </div>

        {/* COLUMNA: NEW FEED */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                <Layout className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">New Feed</h2>
            </div>
            <Button 
              onClick={() => handleGenerate(NEW_FEED, 'feed_completo')} 
              disabled={generatingTypes.has('feed_completo')}
              className="bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-600/20"
            >
              {generatingTypes.has('feed_completo') ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
              Renovar Feed
            </Button>
          </div>

          <div className="space-y-4">
            {NEW_FEED.map((tipo) => (
              <MensajeItem 
                key={`feed-${tipo}`} 
                tipo={tipo} 
                contenido={mensajes[tipo]} 
                loading={loading || generatingTypes.has('feed_completo') || generatingTypes.has(`feed_${tipo}`)} 
                onGenerate={() => handleGenerate([tipo], `feed_${tipo}`)}
                onCopy={handleCopy} 
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

function MensajeItem({ tipo, contenido, loading, onGenerate, onCopy }: { tipo: TipoMensaje; contenido: string; loading: boolean; onGenerate: () => void; onCopy: (text: string) => void }) {
  // Mapping icons dinamically from types
  const IconMap: Record<string, any> = { MessageCircle, Sparkles, FileText, RotateCcw, Heart, Zap, Layout };
  const iconName = TIPO_MENSAJE_ICONS[tipo];
  const Icon = IconMap[iconName] || MessageSquare;

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
            <Button variant="ghost" size="sm" onClick={() => onCopy(contenido)} className="h-8 text-gray-500 hover:text-gray-900">
              <Copy className="w-4 h-4 mr-2" /> Copiar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onGenerate} disabled={loading} className="h-8">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className="p-4 bg-white">
        {loading ? (
          <div className="space-y-3">
            <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
            <div className="h-3 bg-gray-100 rounded animate-pulse w-full" />
            <div className="h-3 bg-gray-100 rounded animate-pulse w-5/6" />
          </div>
        ) : contenido ? (
          <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {contenido}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="text-sm text-gray-400 mb-3">No hay contenido generado</p>
            <Button variant="outline" size="sm" onClick={onGenerate} className="text-xs">
              <Sparkles className="w-3 h-3 mr-2 text-primary-500" /> Generar ahora
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}