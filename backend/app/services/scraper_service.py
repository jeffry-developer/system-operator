import hashlib
import httpx
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
from typing import List, Dict, Optional
import asyncio
import random
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

    def _scrape_pinterest_sync(self, usuario_id: UUID, query: str, max_imagenes: int, etiqueta: str) -> List[Dict]:
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
                
                import time
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
                        img_data = {"url": original_url, "hash": hash_imagen}
                        
                        # Note: _es_duplicado and _registrar_imagen in supabase_service_admin are sync calls!
                        # The original code awaited them, but supabase-py is sync!
                        if not supabase_service_admin.check_duplicate(usuario_id, img_data["hash"]):
                            create_data = ImagenDescargadaCreate(
                                usuario_id=usuario_id,
                                url_origen=img_data["url"],
                                hash_imagen=img_data["hash"],
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
        """Scrapea imágenes de Pinterest con filtro anti-duplicados usando un hilo separado"""
        return await asyncio.to_thread(self._scrape_pinterest_sync, usuario_id, query, max_imagenes, etiqueta)

    def _calcular_hash_url(self, url: str) -> str:
        """Calcula SHA256 de la URL base (sin parámetros) como identificador único"""
        from urllib.parse import urlparse
        base_url = urlparse(url)._replace(query="").geturl()
        return hashlib.sha256(base_url.encode()).hexdigest()[:64]


    async def scrape_bancos_libres(self, usuario_id: UUID, query: str = None, etiqueta: str = "romantica", max_imagenes: int = 20) -> List[Dict]:
        """Scrapea imágenes de bancos de imágenes libres (Unsplash, Pexels, etc.)"""
        
        imagenes_nuevas = []
        
        # Parse trailing number from query (e.g. "playa parejas sensual 5" -> terms="playa parejas sensual", max=5)
        raw = (query or etiqueta).strip()
        parts = raw.split()
        if parts and parts[-1].isdigit():
            extracted_max = int(parts[-1])
            if 0 < extracted_max <= 50:
                max_imagenes = extracted_max
            raw = ' '.join(parts[:-1]).strip()
        
        search_term = raw if raw else etiqueta
        
        # Boost relevance based on etiqueta (avoid repeating words already in query)
        etiqueta_boost = {
            "sensual": "sensual intimate couple seductive",
            "romantica": "romantic couple love tender",
            "parejas": "couple together love partners",
            "estetica": "aesthetic lifestyle",
        }
        boost = etiqueta_boost.get(etiqueta, "")
        combined_terms = search_term
        if boost and not any(b in search_term.lower() for b in boost.split()[:2]):
            combined_terms = f"{search_term} {boost}"
        
        # URLs de APIs gratuitas
        apis = [
            {
                "name": "lexica",
                "url": "https://lexica.art/api/v1/search",
                "params": {"q": combined_terms},
                "headers": {}
            },
            {
                "name": "unsplash",
                "url": "https://api.unsplash.com/search/photos",
                "params": {"query": combined_terms, "per_page": 30, "page": random.randint(1, 10), "orientation": "portrait"},
                "headers": {"Authorization": f"Client-ID {settings.UNSPLASH_ACCESS_KEY}"} if hasattr(settings, 'UNSPLASH_ACCESS_KEY') else {}
            }
        ]

        
        async with httpx.AsyncClient(timeout=30.0) as client:
            for api in apis:
                if not api["headers"].get("Authorization"):
                    continue
                    
                try:
                    response = await client.get(api["url"], params=api["params"], headers=api["headers"])
                    if response.status_code == 200:
                        data = response.json()
                        if api["name"] == "unsplash":
                            results = data.get("results", [])
                        elif api["name"] == "lexica":
                            results = data.get("images", [])
                        else:
                            results = []
                            
                        for photo in results:
                            if len(imagenes_nuevas) >= max_imagenes:
                                break
                            
                            if api["name"] == "unsplash":
                                url = photo["urls"]["regular"]
                            else:
                                url = photo.get("src") or photo.get("url")
                                
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
                                    imagenes_nuevas.append(resultado)
                except Exception as e:
                    print(f"Error en {api['name']}: {e}")
                    continue
        
        return imagenes_nuevas


scraper_service = ScraperService()