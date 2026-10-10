import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { AuthTokens } from '../types';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

class ApiService {
  private client: AxiosInstance;
  private tokens: AuthTokens | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
      if (this.tokens?.access_token) {
        config.headers.Authorization = `Bearer ${this.tokens.access_token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        // No redirigir si el error 401 viene del intento de login
        const isLoginRequest = error.config?.url === '/auth/login';
        
        if (error.response?.status === 401 && !isLoginRequest) {
          this.clearTokens();
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
        
        // Mejorar el mensaje de error para que UI pueda mostrarlo
        if (error.response?.data?.detail) {
          error.message = error.response.data.detail;
        }
        
        return Promise.reject(error);
      }
    );

    // Cargar tokens del localStorage al inicializar
    const stored = localStorage.getItem('auth_tokens');
    if (stored) {
      this.tokens = JSON.parse(stored);
    }
  }

  setTokens(tokens: AuthTokens) {
    this.tokens = tokens;
    localStorage.setItem('auth_tokens', JSON.stringify(tokens));
  }

  clearTokens() {
    this.tokens = null;
    localStorage.removeItem('auth_tokens');
  }

  getTokens(): AuthTokens | null {
    return this.tokens;
  }

  isAuthenticated(): boolean {
    return !!this.tokens?.access_token;
  }

  // Auth
  async register(email: string, nombre: string, password: string) {
    const response = await this.client.post('/auth/register', { email, nombre, password });
    this.setTokens(response.data);
    return response.data;
  }

  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    this.setTokens(response.data);
    return response.data;
  }

  async getMe() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  logout() {
    this.clearTokens();
  }

  // Perfiles
  async getPerfiles() {
    const response = await this.client.get('/perfiles');
    return response.data;
  }

  async getPerfil(id: string) {
    const response = await this.client.get(`/perfiles/${id}`);
    return response.data;
  }

  async createPerfil(data: { nombre_perfil: string; prompt_personalidad: string; categoria_feed?: string }) {
    const response = await this.client.post('/perfiles', data);
    return response.data;
  }

  async updatePerfil(id: string, data: Partial<{ nombre_perfil: string; prompt_personalidad: string; categoria_feed: string; activo: boolean }>) {
    const response = await this.client.put(`/perfiles/${id}`, data);
    return response.data;
  }

  async deletePerfil(id: string) {
    const response = await this.client.delete(`/perfiles/${id}`);
    return response.data;
  }

  async generarMensajes(perfilId: string, tipos: string[] = ['saludo', 'icebreaker', 'carta_barrido', 'insistencia']) {
    const response = await this.client.post(`/perfiles/${perfilId}/generar-mensajes`, { perfil_id: perfilId, tipos });
    return response.data;
  }

  async getUltimosMensajes(perfilId: string) {
    const response = await this.client.get(`/perfiles/${perfilId}/ultimos-mensajes`);
    return response.data;
  }

  async getMensajes(perfilId: string) {
    const response = await this.client.get(`/perfiles/${perfilId}/mensajes`);
    return response.data;
  }

  async generarSaludosRapidos() {
    const response = await this.client.post('/perfiles/generar-saludos-rapidos');
    return response.data;
  }

  // Plan de Trabajo & New Feed
  async generarPlanTrabajo(perfilId: string) {
    const response = await this.client.post(`/perfiles/${perfilId}/generar-plan-trabajo`);
    return response.data;
  }

  async generarNewFeed(perfilId: string) {
    const response = await this.client.post(`/perfiles/${perfilId}/generar-new-feed`);
    return response.data;
  }

  // Cartas Pagadoras
  async generarCartasPagadora(perfilId: string, data: { pagadora: string; tipo: string; cantidad: number; instrucciones?: string }) {
    const response = await this.client.post(`/perfiles/${perfilId}/generar-cartas-pagadora`, data);
    return response.data;
  }

  async getPagadoras(perfilId: string) {
    const response = await this.client.get(`/perfiles/${perfilId}/pagadoras`);
    return response.data;
  }

  // Historias
  async generarHistoria(perfilId: string, data: { tipo: string; tema: string; pagadora?: string }) {
    const response = await this.client.post(`/perfiles/${perfilId}/generar-historia`, data);
    return response.data;
  }

  async getHistorias(perfilId: string) {
    const response = await this.client.get(`/perfiles/${perfilId}/historias`);
    return response.data;
  }

  async deleteHistoria(perfilId: string, historiaId: string) {
    const response = await this.client.delete(`/perfiles/${perfilId}/historias/${historiaId}`);
    return response.data;
  }

  // Imágenes
  async getImagenes(limit = 50) {
    const response = await this.client.get('/imagenes', { params: { limit } });
    return response.data;
  }

  async getImagenesCount() {
    const response = await this.client.get('/imagenes/count');
    return response.data;
  }

  async scrapeImagenes(query: string, maxImagenes = 20, etiqueta = 'romantica') {
    const response = await this.client.post('/imagenes/scrape', null, {
      params: { query, max_imagenes: maxImagenes, etiqueta },
    });
    return response.data;
  }

  async scrapeBancosLibres(etiqueta = 'romantica', maxImagenes = 20) {
    const response = await this.client.post('/imagenes/scrape/bancos-libres', null, {
      params: { etiqueta, max_imagenes: maxImagenes },
    });
    return response.data;
  }

  async deleteImagen(id: string) {
    const response = await this.client.delete(`/imagenes/${id}`);
    return response.data;
  }

  async deleteAllImagenes() {
    const response = await this.client.delete('/imagenes');
    return response.data;
  }
}

export const api = new ApiService();