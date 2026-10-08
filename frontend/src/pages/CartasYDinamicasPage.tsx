import { useState, useEffect } from 'react';
import { Copy, Loader2, Sparkles, RotateCcw, Heart, Zap } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { Perfil, TipoMensaje } from '../types';
import { Button } from '../components/Button';
import { copyToClipboard } from '../utils/helpers';

const TIPOS_CARTAS: TipoMensaje[] = ['carta_romantica', 'dinamica_juego'];

const LABELS: Record<string, { label: string; desc: string; color: string; bg: string; Icon: any }> = {
  carta_romantica: {
    label: 'Carta Romántica',
    desc: 'Seductora, elegante, genera deseo e intriga.',
    color: 'text-rose-600',
    bg: 'bg-rose-50 border-rose-100',
    Icon: Heart,
  },
  dinamica_juego: {
    label: 'Dinámica / Juego',
    desc: 'Engancha, motiva a interactuar y a enviar regalos.',
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-100',
    Icon: Zap,
  },
};

export function CartasYDinamicasPage() {
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
      success('Contenido generado ✨');
    } catch { showError('Error al generar'); }
    finally { setGeneratingTypes(prev => { const next = new Set(prev); next.delete(groupId); return next; }); }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
            <div className="p-2 bg-rose-100 rounded-lg"><Heart className="w-5 h-5 text-rose-600" /></div>
            Cartas y Dinámicas
          </h1>
          <p className="text-gray-500">Cartas románticas y dinámicas de juego para enganchar.</p>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Perfil Activo</label>
            <select value={selectedPerfilId} onChange={(e) => setSelectedPerfilId(e.target.value)} className="input max-w-xs" disabled={loading}>
              {perfiles.map((p) => <option key={p.id} value={p.id}>{p.nombre_perfil}</option>)}
            </select>
          </div>
          <Button onClick={() => handleGenerate(TIPOS_CARTAS, 'all')} disabled={generatingTypes.has('all')} className="bg-rose-600 hover:bg-rose-700">
            {generatingTypes.has('all') ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
            Renovar Todo
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {TIPOS_CARTAS.map((tipo) => {
          const meta = LABELS[tipo];
          const { Icon } = meta;
          const contenido = mensajes[tipo] || '';
          const isLoading = loading || generatingTypes.has('all') || generatingTypes.has(tipo);
          return (
            <div key={tipo} className={`bg-white rounded-2xl border shadow-sm overflow-hidden`}>
              <div className={`p-4 border-b ${meta.bg} flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 bg-white rounded-lg shadow-sm`}>
                    <Icon className={`w-5 h-5 ${meta.color}`} />
                  </div>
                  <div>
                    <span className="font-semibold text-gray-800 block">{meta.label}</span>
                    <span className="text-xs text-gray-500">{meta.desc}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {contenido && <Button variant="ghost" size="sm" onClick={() => handleCopy(contenido)} className="h-8"><Copy className="w-4 h-4 mr-2" />Copiar</Button>}
                  <Button variant="outline" size="sm" onClick={() => handleGenerate([tipo], tipo)} disabled={isLoading} className="h-8">
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="p-5">
                {isLoading ? (
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
                    <div className="h-4 bg-gray-100 rounded animate-pulse w-full" />
                    <div className="h-4 bg-gray-100 rounded animate-pulse w-5/6" />
                    <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
                  </div>
                ) : contenido ? (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{contenido}</p>
                ) : (
                  <div className="flex flex-col items-center py-8 text-center">
                    <Icon className={`w-12 h-12 ${meta.color} opacity-20 mb-4`} />
                    <p className="text-gray-400 mb-4">Aún no hay contenido generado</p>
                    <Button variant="outline" onClick={() => handleGenerate([tipo], tipo)} disabled={isLoading}>
                      <Sparkles className="w-4 h-4 mr-2" />Generar ahora
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
