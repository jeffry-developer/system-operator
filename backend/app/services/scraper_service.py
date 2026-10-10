import hashlib
import httpx
import asyncio
import random
import time
from typing import List, Dict, Optional
from playwright.sync_api import sync_playwright
from app.core.config import settings
from app.services.supabase_service import supabase_service_admin
from app.models.schemas import ImagenDescargadaCreate
from uuid import UUID


class ScraperService:
    def __init__(self):
        self.headless = settings.SCRAPER_HEADLESS
        self.timeout = settings.SCRAPER_TIMEOUT
        self.user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        ]
        self.max_concurrent_downloads = 5

    def _calcular_hash_url(self, url: str) -> str:
        """Calcula SHA256 de la URL base (sin parametros) como identificador unico"""
        from urllib.parse import urlparse
        base_url = urlparse(url)._replace(query="").geturl()
        return hashlib.sha256(base_url.encode()).hexdigest()[:64]

    def _calcular_phash(self, image_bytes: bytes) -> str:
        """Calcula hash perceptual (pHash) para detectar imagenes visualmente iguales"""
        try:
            from PIL import Image
            import imagehash
            img = Image.open(io.BytesIO(image_bytes))
            if img.mode != 'RGB':
                img = img.convert('RGB')
            phash = imagehash.phash(img)
            return str(phash)
        except Exception:
            return ""

    async def _descargar_imagen(self, url: str) -> Optional[bytes]:
        """Descarga una imagen y retorna los bytes"""
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(url, follow_redirects=True)
                if response.status_code == 200 and response.content:
                    return response.content
        except Exception:
            pass
        return None

    async def _procesar_fuente(self, fuente: str, query: str, etiqueta: str, max_imagenes: int, usuario_id: UUID) -> List[Dict]:
        """Procesa una fuente especifica en paralelo"""
        imagenes = []
        
        if fuente == "unsplash":
            imagenes = await self._scrape_unsplash(query, etiqueta, max_imagenes, usuario_id)
        elif fuente == "pexels":
            imagenes = await self._scrape_pexels(query, etiqueta, max_imagenes, usuario_id)
        elif fuente == "pixabay":
            imagenes = await self._scrape_pixabay(query, etiqueta, max_imagenes, usuario_id)
        elif fuente == "lexica":
            imagenes = await self._scrape_lexica(query, etiqueta, max_imagenes, usuario_id)
        
        return imagenes

    async def _scrape_unsplash(self, query: str, etiqueta: str, max_imagenes: int, usuario_id: UUID) -> List[Dict]:
        """Scrapea Unsplash"""
        imagenes = []
        if not getattr(settings, 'UNSPLASH_ACCESS_KEY', None):
            return imagenes
        
        etiqueta_boost = {
            "sensual": "sensual intimate couple seductive",
            "romantica": "romantic couple love tender",
            "parejas": "couple together love partners",
            "estetica": "aesthetic lifestyle",
        }
        boost = etiqueta_boost.get(etiqueta, "")
        combined_terms = query
        if boost and not any(b in query.lower() for b in boost.split()[:2]):
            combined_terms = f"{query} {boost}"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            for page in range(1, 4):
                if len(imagenes) >= max_imagenes:
                    break
                try:
                    response = await client.get(
                        "https://api.unsplash.com/search/photos",
                        params={
                            "query": combined_terms,
                            "per_page": min(30, max_imagenes - len(imagenes) + 5),
                            "page": page,
                            "orientation": "portrait"
                        },
                        headers={"Authorization": f"Client-ID {settings.UNSPLASH_ACCESS_KEY}"}
                    )
                    if response.status_code == 200:
                        data = response.json()
                        for photo in data.get("results", []):
                            if len(imagenes) >= max_imagenes:
                                break
                            url = photo["urls"]["regular"]
                            hash_img = self._calcular_hash_url(url)
                            if not supabase_service_admin.check_duplicate(usuario_id, hash_img):
                                create_data = ImagenDescargadaCreate(
                                    usuario_id=usuario_id,
                                    url_origen=url,
                                    hash_imagen=hash_img,
                                    etiqueta=etiqueta
                                )
                                resultado = supabase_service_admin.registrar_imagen(create_data)
                                if resultado:
                                    imagenes.append(resultado)
                except Exception as e:
                    print(f"Error en Unsplash page {page}: {e}")
        return imagenes

    async def _scrape_pexels(self, query: str, etiqueta: str, max_imagenes: int, usuario_id: UUID) -> List[Dict]:
        """Scrapea Pexels"""
        imagenes = []
        if not getattr(settings, 'PEXELS_API_KEY', None):
            return imagenes
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            for page in range(1, 4):
                if len(imagenes) >= max_imagenes:
                    break
                try:
                    response = await client.get(
                        "https://api.pexels.com/v1/search",
                        params={"query": query, "per_page": min(30, max_imagenes - len(imagenes) + 5), "page": page},
                        headers={"Authorization": settings.PEXELS_API_KEY}
                    )
                    if response.status_code == 200:
                        data = response.json()
                        for photo in data.get("photos", []):
                            if len(imagenes) >= max_imagenes:
                                break
                            url = photo["src"]["large2x"] or photo["src"]["large"]
                            hash_img = self._calcular_hash_url(url)
                            if not supabase_service_admin.check_duplicate(usuario_id, hash_img):
                                create_data = ImagenDescargadaCreate(
                                    usuario_id=usuario_id,
                                    url_origen=url,
                                    hash_imagen=hash_img,
                                    etiqueta=etiqueta
                                )
                                resultado = supabase_service_admin.registrar_imagen(create_data)
                                if resultado:
                                    imagenes.append(resultado)
                except Exception as e:
                    print(f"Error en Pexels page {page}: {e}")
        return imagenes

    async def _scrape_pixabay(self, query: str, etiqueta: str, max_imagenes: int, usuario_id: UUID) -> List[Dict]:
        """Scrapea Pixabay"""
        imagenes = []
        if not getattr(settings, 'PIXABAY_API_KEY', None):
            return imagenes
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            for page in range(1, 4):
                if len(imagenes) >= max_imagenes:
                    break
                try:
                    response = await client.get(
                        "https://pixabay.com/api/",
                        params={
                            "key": settings.PIXABAY_API_KEY,
                            "q": query,
                            "per_page": min(30, max_imagenes - len(imagenes) + 5),
                            "page": page,
                            "orientation": "vertical",
                            "safesearch": "true"
                        }
                    )
                    if response.status_code == 200:
                        data = response.json()
                        for photo in data.get("hits", []):
                            if len(imagenes) >= max_imagenes:
                                break
                            url = photo.get("largeImageURL") or photo.get("webformatURL")
                            if not url:
                                continue
                            hash_img = self._calcular_hash_url(url)
                            if not supabase_service_admin.check_duplicate(usuario_id, hash_img):
                                create_data = ImagenDescargadaCreate(
                                    usuario_id=usuario_id,
                                    url_origen=url,
                                    hash_imagen=hash_img,
                                    etiqueta=etiqueta
                                )
                                resultado = supabase_service_admin.registrar_imagen(create_data)
                                if resultado:
                                    imagenes.append(resultado)
                except Exception as e:
                    print(f"Error en Pixabay page {page}: {e}")
        return imagenes

    async def _scrape_lexica(self, query: str, etiqueta: str, max_imagenes: int, usuario_id: UUID) -> List[Dict]:
        """Scrapea Lexica.art"""
        imagenes = []
        etiqueta_boost = {
            "sensual": "sensual intimate couple seductive",
            "romantica": "romantic couple love tender",
            "parejas": "couple together love partners",
            "estetica": "aesthetic lifestyle",
        }
        boost = etiqueta_boost.get(etiqueta, "")
        combined_terms = query
        if boost and not any(b in query.lower() for b in boost.split()[:2]):
            combined_terms = f"{query} {boost}"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(
                    "https://lexica.art/api/v1/search",
                    params={"q": combined_terms}
                )
                if response.status_code == 200:
                    data = response.json()
                    for img in data.get("images", [])[:max_imagenes]:
                        if len(imagenes) >= max_imagenes:
                            break
                        url = img.get("src") or img.get("url")
                        if not url:
                            continue
                        hash_img = self._calcular_hash_url(url)
                        if not supabase_service_admin.check_duplicate(usuario_id, hash_img):
                            create_data = ImagenDescargadaCreate(
                                usuario_id=usuario_id,
                                url_origen=url,
                                hash_imagen=hash_img,
                                etiqueta=etiqueta
                            )
                            resultado = supabase_service_admin.registrar_imagen(create_data)
                            if resultado:
                                imagenes.append(resultado)
            except Exception as e:
                print(f"Error en Lexica: {e}")
        return imagenes

    def _scrape_pinterest_sync(self, usuario_id: UUID, query: str, max_imagenes: int, etiqueta: str) -> List[Dict]:
        """Scrapea Pinterest (sincrono con Playwright)"""
        imagenes_nuevas = []
        query_final = f"{query} {etiqueta}".strip()
        search_url = f"https://www.pinterest.com/search/pins/?q={query_final.replace(' ', '%20')}"
        
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=self.headless)
            context = browser.new_context(
                user_agent=random.choice(self.user_agents),
                viewport={"width": 1366, "height": 768}
            )
            page = context.new_page()
            
            try:
                page.goto(search_url, wait_until="networkidle", timeout=self.timeout)
                page.wait_for_selector('[data-test-id="pin"]', timeout=10000)
                
                for _ in range(3):
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    time.sleep(2)
                
                pins = page.query_selector_all('[data-test-id="pin"]')
                
                for pin in pins[:max_imagenes * 2]:
                    if len(imagenes_nuevas) >= max_imagenes:
                        break
                    try:
                        img_element = pin.query_selector('img')
                        if not img_element:
                            continue
                        src = img_element.get_attribute("src")
                        if not src or "pinimg.com" not in src:
                            continue
                        
                        original_url = src.replace("/236x/", "/originals/").replace("/474x/", "/originals/").replace("/736x/", "/originals/")
                        hash_imagen = self._calcular_hash_url(original_url)
                        
                        if not supabase_service_admin.check_duplicate(usuario_id, hash_imagen):
                            create_data = ImagenDescargadaCreate(
                                usuario_id=usuario_id,
                                url_origen=original_url,
                                hash_imagen=hash_imagen,
                                etiqueta=etiqueta
                            )
                            resultado = supabase_service_admin.registrar_imagen(create_data)
                            if resultado:
                                imagenes_nuevas.append(resultado)
                    except Exception as e:
                        print(f"Error procesando pin: {e}")
                        continue
            finally:
                browser.close()
        
        return imagenes_nuevas

    async def scrape_pinterest(self, usuario_id: UUID, query: str, max_imagenes: int = 20, etiqueta: str = "romantica") -> List[Dict]:
        """Scrapea imagenes de Pinterest con filtro anti-duplicados usando un hilo separado"""
        return await asyncio.to_thread(self._scrape_pinterest_sync, usuario_id, query, max_imagenes, etiqueta)

    async def scrape_bancos_libres(self, usuario_id: UUID, query: str = None, etiqueta: str = "romantica", max_imagenes: int = 20) -> List[Dict]:
        """Scrapea imagenes de multiples bancos de imagenes libres en paralelo"""
        
        imagenes_nuevas = []
        
        raw = (query or etiqueta).strip()
        parts = raw.split()
        if parts and parts[-1].isdigit():
            extracted_max = int(parts[-1])
            if 0 < extracted_max <= 50:
                max_imagenes = extracted_max
            raw = ' '.join(parts[:-1]).strip()
        
        search_term = raw if raw else etiqueta
        
        # Ejecutar multiples fuentes en paralelo
        fuentes = ["unsplash", "pexels", "pixabay", "lexica"]
        tareas = [
            self._procesar_fuente(fuente, search_term, etiqueta, max_imagenes, usuario_id)
            for fuente in fuentes
        ]
        
        resultados = await asyncio.gather(*tareas, return_exceptions=True)
        
        for resultado in resultados:
            if isinstance(resultado, list):
                imagenes_nuevas.extend(resultado)
                if len(imagenes_nuevas) >= max_imagenes:
                    break
            elif isinstance(resultado, Exception):
                print(f"Error en fuente: {resultado}")
        
        return imagenes_nuevas[:max_imagenes]

    async def scrape_multiples_fuentes(self, usuario_id: UUID, query: str = None, etiqueta: str = "romantica", max_imagenes: int = 20, incluir_pinterest: bool = False) -> List[Dict]:
        """Scrapea de TODAS las fuentes disponibles (APIs + Pinterest opcional)"""
        imagenes_nuevas = []
        
        # Primero APIs rapidas en paralelo
        apis_task = self.scrape_bancos_libres(usuario_id, query, etiqueta, max_imagenes)
        imagenes_apis = await apis_task
        imagenes_nuevas.extend(imagenes_apis)
        
        # Si necesitamos mas y Pinterest esta habilitado
        if incluir_pinterest and len(imagenes_nuevas) < max_imagenes:
            restantes = max_imagenes - len(imagenes_nuevas)
            imagenes_pinterest = await self.scrape_pinterest(usuario_id, query or etiqueta, restantes, etiqueta)
            imagenes_nuevas.extend(imagenes_pinterest)
        
        return imagenes_nuevas[:max_imagenes]

    async def limpiar_urls_rotas(self, usuario_id: UUID, max_check: int = 100) -> int:
        """Verifica y elimina URLs rotas de la galeria del usuario"""
        imagenes = supabase_service_admin.get_imagenes_by_usuario(usuario_id, limit=max_check)
        eliminadas = 0
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            for img in imagenes:
                try:
                    response = await client.head(img["url_origen"], follow_redirects=True)
                    if response.status_code >= 400:
                        # URL rota - eliminar de BD
                        supabase_service_admin.client.table("imagenes_descargadas").delete().eq("id", img["id"]).execute()
                        eliminadas += 1
                except Exception:
                    eliminadas += 1
                    supabase_service_admin.client.table("imagenes_descargadas").delete().eq("id", img["id"]).execute()
        
        return eliminadas


scraper_service = ScraperService()