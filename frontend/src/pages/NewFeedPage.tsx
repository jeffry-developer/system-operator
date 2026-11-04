
import { useState, useEffect } from 'react';
import { Copy, Loader2, Sparkles, RotateCcw, Layout, MessageCircle, Zap, MessageSquare } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { Perfil, TipoMensaje } from '../types';
import { Button } from '../components/Button';
import { copyToClipboard } from '../utils/helpers';

const NEW_FEED_TIPOS: TipoMensaje[] = ['posts', 'respuestas_rapidas', 'insistencia', 'saludo'];

const FEED_META: Record<string, { label: string; color: string; bg: string; border: string; Icon: any }> = {
  posts: { label: 'Publicaciones y prompts', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-100 dark:border-purple-900/40', Icon: Layout },
  respuestas_rapidas: { label: 'Respuestas Rápidas', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-100 dark:border-blue-900/40', Icon: Zap },
  insistencia: { label: 'Mensajes de Insistencia', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-100 dark:border-amber-900/40', Icon: MessageCircle },
  saludo: { label: 'Saludo', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-100 dark:border-green-900/40', Icon: MessageSquare },
};

export function NewFeedPage() {
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
    api.getUltimosMensajes(selectedPerfilId).then(setMensajes).catch(console.error).finally(() => setLoading(false));
  }, [selectedPerfilId]);

  const handleGenerate = async (tipos: TipoMensaje[], groupId: string) => {
    if (!selectedPerfilId) return;
    setGeneratingTypes(prev => new Set(prev).add(groupId));
    try {
      const result = await api.generarMensajes(selectedPerfilId, tipos);
      setMensajes(prev => ({ ...prev, ...result.mensajes }));
      success('Generado exitosamente');
    } catch { showError('Error al generar'); }
    finally { setGeneratingTypes(prev => { const n = new Set(prev); n.delete(groupId); return n; }); }
  };

  const handleCopy = async (text: string) => {
    try { await copyToClipboard(text); success('Copiado'); } catch { showError('Error al copiar'); }
  };

  if (perfiles.length === 0) return (
    <div className="card p-12 text-center">
      <Sparkles className="w-16 h-16 text-primary-400 mx-auto mb-6 animate-pulse" />
      <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Sin perfiles</h3>
      <p className="text-gray-500 dark:text-gray-400">Crea un perfil primero.</p>
    </div>
  );

  const isGeneratingAll = generatingTypes.has('feed_all');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg"><Layout className="w-5 h-5 text-purple-600 dark:text-purple-400" /></div>
            Publicaciones
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Publicaciones, respuestas y saludos para cada perfil.</p>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Perfil Activo</label>
            <select value={selectedPerfilId} onChange={(e) => setSelectedPerfilId(e.target.value)} className="input max-w-xs" disabled={loading}>
              {perfiles.map((p) => <option key={p.id} value={p.id}>{p.nombre_perfil}</option>)}
            </select>
          </div>
          <Button onClick={() => handleGenerate(NEW_FEED_TIPOS, 'feed_all')} disabled={isGeneratingAll} className="bg-purple-600 hover:bg-purple-700">
            {isGeneratingAll ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
            Generar todo de nuevo
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {NEW_FEED_TIPOS.map((tipo) => {
          const meta = FEED_META[tipo];
          const { Icon } = meta;
          const contenido = mensajes[tipo] || '';
          const isLoading = loading || isGeneratingAll || generatingTypes.has(tipo);
          const textoDisplay = contenido;

          return (
            <div key={tipo} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
              <div className={`p-4 border-b ${meta.bg} ${meta.border} flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${meta.color}`} />
                  <span className="font-semibold text-gray-800 dark:text-gray-100">{meta.label}</span>
                </div>
                <div className="flex gap-2">
                  {contenido && (
                    <Button variant="ghost" size="sm" onClick={() => handleCopy(textoDisplay)} className="h-8">
                      <Copy className="w-4 h-4 mr-2" />Copiar
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => handleGenerate([tipo], tipo)} disabled={isLoading} className="h-8">
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="p-5">
                {isLoading ? (
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-3/4" />
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-full" />
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-5/6" />
                  </div>
                ) : textoDisplay ? (
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{textoDisplay}</p>
                ) : (
                  <div className="flex flex-col items-center py-8 text-center">
                    <Icon className={`w-10 h-10 ${meta.color} opacity-20 mb-3`} />
                    <p className="text-gray-400 dark:text-gray-500 mb-4">Sin contenido generado</p>
                    <Button variant="outline" size="sm" onClick={() => handleGenerate([tipo], tipo)} disabled={isLoading}>
                      <Sparkles className="w-3 h-3 mr-2" />Generar ahora
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

