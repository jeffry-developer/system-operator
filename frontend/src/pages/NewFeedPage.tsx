
import { useState, useEffect } from 'react';
import { Copy, Loader2, Sparkles, RotateCcw, Layout, Download, MessageCircle, Zap, MessageSquare } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { Perfil, TipoMensaje } from '../types';
import { Button } from '../components/Button';
import { copyToClipboard } from '../utils/helpers';

const NEW_FEED_TIPOS: TipoMensaje[] = ['posts', 'respuestas_rapidas', 'insistencia', 'saludo'];

const FEED_META: Record<string, { label: string; color: string; bg: string; border: string; Icon: any }> = {
  posts: { label: 'Ideas de Posts', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100', Icon: Layout },
  respuestas_rapidas: { label: 'Respuestas Rapidas', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', Icon: Zap },
  insistencia: { label: 'Mensajes de Insistencia', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', Icon: MessageCircle },
  saludo: { label: 'Saludo', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100', Icon: MessageSquare },
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

  const handleDownloadImage = async (url: string, idx: number) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const dlUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = `post-imagen-${idx + 1}.jpg`;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(dlUrl); document.body.removeChild(a);
    } catch { showError('Error al descargar'); }
  };

  const parseImages = (text: string) => {
    const re = /(https?:\/\/[^\s]+(?:\.jpg|\.jpeg|\.png|\.gif|\.webp|unsplash\.com|pinimg\.com)[^\s]*)/gi;
    return text?.match(re) || [];
  };

  const cleanText = (text: string) => {
    const re = /(https?:\/\/[^\s]+(?:\.jpg|\.jpeg|\.png|\.gif|\.webp|unsplash\.com|pinimg\.com)[^\s]*)/gi;
    return text?.replace(re, '').replace(/Post \d+:\s*/g, '').replace(/\[Imagenes.*?\]/g, '').trim() || '';
  };

  if (perfiles.length === 0) return (
    <div className="card p-12 text-center">
      <Sparkles className="w-16 h-16 text-primary-400 mx-auto mb-6 animate-pulse" />
      <h3 className="text-2xl font-bold text-gray-900 mb-2">Sin perfiles</h3>
      <p className="text-gray-500">Crea un perfil primero.</p>
    </div>
  );

  const isGeneratingAll = generatingTypes.has('feed_all');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
            <div className="p-2 bg-purple-100 rounded-lg"><Layout className="w-5 h-5 text-purple-600" /></div>
            New Feed
          </h1>
          <p className="text-gray-500">Posts, respuestas, insistencia y saludos por perfil.</p>
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
            Renovar Feed
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {NEW_FEED_TIPOS.map((tipo) => {
          const meta = FEED_META[tipo];
          const { Icon } = meta;
          const contenido = mensajes[tipo] || '';
          const isLoading = loading || isGeneratingAll || generatingTypes.has(tipo);
          const imageUrls = tipo === 'posts' ? parseImages(contenido) : [];
          const textoDisplay = tipo === 'posts' ? cleanText(contenido) : contenido;

          return (
            <div key={tipo} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className={`p-4 border-b ${meta.bg} ${meta.border} flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${meta.color}`} />
                  <span className="font-semibold text-gray-800">{meta.label}</span>
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
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-full" />
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-5/6" />
                  </div>
                ) : textoDisplay ? (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{textoDisplay}</p>
                    {imageUrls.length > 0 && (
                      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
                        {imageUrls.map((url, i) => (
                          <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                            <img src={url} alt={`Post ${i + 1}`} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                              <span className="text-white text-xs font-semibold">Post {i + 1}</span>
                              <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => handleDownloadImage(url, i)}>
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-8 text-center">
                    <Icon className={`w-10 h-10 ${meta.color} opacity-20 mb-3`} />
                    <p className="text-gray-400 mb-4">Sin contenido generado</p>
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

