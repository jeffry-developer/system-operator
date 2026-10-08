import { useState, useEffect } from 'react';
import { Loader2, Image, Download, Trash2, Search, RefreshCw, Plus, X } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { ImagenDescargada } from '../types';
import { Button } from '../components/Button';
import { Input, Label } from '../components/Input';
import { Modal } from '../components/Modal';
import { cn } from '../utils/helpers';

export function ImagenesPage() {
  const [imagenes, setImagenes] = useState<ImagenDescargada[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showScrapeModal, setShowScrapeModal] = useState(false);
  const [scrapeQuery, setScrapeQuery] = useState('romantic aesthetic');
  const [scrapeEtiqueta, setScrapeEtiqueta] = useState('romantica');
  const [scrapeMax, setScrapeMax] = useState(20);
  const { success, error: showError } = useToast();

  const fetchImagenes = async () => {
    try {
      const data = await api.getImagenes(100);
      setImagenes(data);
    } catch (err) {
      showError('Error al cargar imágenes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImagenes();
  }, []);

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    setScraping(true);
    try {
      const result = await api.scrapeImagenes(scrapeQuery, scrapeMax, scrapeEtiqueta);
      success(`${result.imagenes.length} imágenes nuevas añadidas`);
      setShowScrapeModal(false);
      fetchImagenes();
    } catch (err) {
      showError('Error en el scraper');
    } finally {
      setScraping(false);
    }
  };

  const handleScrapeBancos = async () => {
    setScraping(true);
    try {
      const result = await api.scrapeBancosLibres(scrapeEtiqueta, scrapeMax);
      success(`${result.imagenes.length} imágenes nuevas de bancos libres`);
      fetchImagenes();
    } catch (err) {
      showError('Error en el scraper de bancos libres');
    } finally {
      setScraping(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await api.deleteImagen(id);
      setImagenes(imagenes.filter((img) => img.id !== id));
      success('Imagen eliminada');
    } catch (err) {
      showError('Error al eliminar imagen');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm("¿Estás seguro de que deseas eliminar todas las imágenes de tu galería? Esta acción no se puede deshacer.")) return;
    
    try {
      await api.deleteAllImagenes();
      setImagenes([]);
      success('Todas las imágenes han sido eliminadas');
    } catch (err) {
      showError('Error al eliminar las imágenes');
    }
  };

  const handleDownload = async (url: string, id: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `imagen-${id}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch {
      showError('Error al descargar');
    }
  };

  const handleDownloadAll = async () => {
    try {
      success(`Iniciando descarga de ${imagenes.length} imágenes...`);
      for (const img of imagenes) {
        await handleDownload(img.url_origen, img.id);
        // Pequeño delay para no bloquear el navegador y permitir que se registren las descargas
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      success('Descarga del lote finalizada');
    } catch {
      showError('Hubo un error al intentar descargar el lote');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Imágenes</h1>
          <p className="text-gray-600">Galería de imágenes sin duplicados por usuario</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="danger" onClick={handleDeleteAll} disabled={imagenes.length === 0 || scraping}>
            <Trash2 className="w-4 h-4 mr-2" />
            Limpiar Galería
          </Button>
          <Button variant="outline" onClick={handleDownloadAll} disabled={imagenes.length === 0 || scraping}>
            <Download className="w-4 h-4 mr-2" />
            Descargar Lote
          </Button>
          <Button variant="outline" onClick={handleScrapeBancos} disabled={scraping}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Bancos Libres
          </Button>
          <Button onClick={() => setShowScrapeModal(true)} disabled={scraping}>
            <Plus className="w-4 h-4 mr-2" />
            Scraper Pinterest
          </Button>
        </div>
      </div>

      {imagenes.length === 0 ? (
        <div className="card p-12 text-center">
          <Image className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay imágenes</h3>
          <p className="text-gray-600 mb-6">Usa el scraper para descargar imágenes nuevas</p>
          <Button onClick={() => setShowScrapeModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Buscar en Pinterest
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {imagenes.map((imagen) => (
            <ImagenCard
              key={imagen.id}
              imagen={imagen}
              onDelete={handleDelete}
              onDownload={handleDownload}
              deleting={deletingId === imagen.id}
            />
          ))}
        </div>
      )}

      <Modal isOpen={showScrapeModal} onClose={() => setShowScrapeModal(false)} title="Buscar en Pinterest">
        <form onSubmit={handleScrape} className="space-y-4">
          <div>
            <Label htmlFor="scrapeQuery">Término de búsqueda</Label>
            <Input
              id="scrapeQuery"
              value={scrapeQuery}
              onChange={(e) => setScrapeQuery(e.target.value)}
              placeholder="romantic aesthetic, couple goals, etc."
            />
          </div>

          <div>
            <Label htmlFor="scrapeEtiqueta">Etiqueta</Label>
            <select
              id="scrapeEtiqueta"
              value={scrapeEtiqueta}
              onChange={(e) => setScrapeEtiqueta(e.target.value)}
              className="input"
            >
              <option value="romantica">Románticas</option>
              <option value="sensual">Sensuales</option>
              <option value="estetica">Estéticas</option>
              <option value="parejas">Parejas</option>
            </select>
          </div>

          <div>
            <Label htmlFor="scrapeMax">Máximo de imágenes</Label>
            <Input
              id="scrapeMax"
              type="number"
              min="1"
              max="50"
              value={scrapeMax}
              onChange={(e) => setScrapeMax(Number(e.target.value))}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowScrapeModal(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={scraping} className="flex-1">
              {scraping ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar y Descargar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ImagenCard({ imagen, onDelete, onDownload, deleting }: { imagen: ImagenDescargada; onDelete: (id: string) => void; onDownload: (url: string, id: string) => void; deleting: boolean }) {
  return (
    <div className="relative group card overflow-hidden bg-gray-50">
      <div className="aspect-[3/4] relative overflow-hidden">
        <img
          src={imagen.url_origen}
          alt={`Imagen ${imagen.etiqueta}`}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.nextElementSibling?.classList.remove('hidden');
          }}
        />
        <div className="hidden absolute inset-0 bg-gray-100 flex items-center justify-center">
          <Image className="w-8 h-8 text-gray-400" />
        </div>
      </div>

      <div className="p-2 space-y-2">
        <div className="flex items-center justify-between">
          <span className={cn('badge text-xs', imagen.etiqueta === 'sensual' ? 'bg-pink-100 text-pink-800' : 'bg-primary-100 text-primary-800')}>
            {imagen.etiqueta}
          </span>
        </div>

        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="flex-1"
            onClick={() => onDownload(imagen.url_origen, imagen.id)}
            title="Descargar"
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="flex-1"
            onClick={() => onDelete(imagen.id)}
            disabled={deleting}
            title="Eliminar"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-red-600" />}
          </Button>
        </div>
      </div>
    </div>
  );
}