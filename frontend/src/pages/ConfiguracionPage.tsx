import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Button } from '../components/Button';
import { Input, Label } from '../components/Input';
import { User, Shield, Key } from 'lucide-react';

export function ConfiguracionPage() {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  
  // States para actualización de perfil
  const [nombre, setNombre] = useState(user?.nombre || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // States para contraseña
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    try {
      // Por el momento simularemos la actualización ya que no hay endpoint de update-user creado
      // En un caso real: await api.updateUser({ nombre });
      await new Promise((resolve) => setTimeout(resolve, 800));
      success('Perfil actualizado correctamente (simulado)');
    } catch (err) {
      showError('Error al actualizar el perfil');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingPassword(true);
    try {
      // Simulado también
      await new Promise((resolve) => setTimeout(resolve, 800));
      success('Contraseña actualizada correctamente (simulada)');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      showError('Error al actualizar la contraseña');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-600">Administra los ajustes de tu cuenta y preferencias del sistema</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Sidebar/Tabs (Visual) */}
        <div className="space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium">
            <User className="w-5 h-5" />
            Perfil de Usuario
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-lg text-sm font-medium">
            <Shield className="w-5 h-5" />
            Seguridad
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-lg text-sm font-medium">
            <Key className="w-5 h-5" />
            Claves de API (IA)
          </button>
        </div>

        {/* Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Tarjeta Perfil */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Información Personal</h2>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-gray-50 text-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">El correo electrónico no se puede cambiar.</p>
              </div>
              
              <div>
                <Label htmlFor="nombre">Nombre Completo</Label>
                <Input
                  id="nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Tu nombre"
                  required
                />
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={isUpdatingProfile || nombre === user?.nombre}>
                  {isUpdatingProfile ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </div>
            </form>
          </div>

          {/* Tarjeta Seguridad */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Cambiar Contraseña</h2>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <Label htmlFor="currentPassword">Contraseña Actual</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="newPassword">Nueva Contraseña</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={isUpdatingPassword || !currentPassword || !newPassword}>
                  {isUpdatingPassword ? 'Actualizando...' : 'Actualizar Contraseña'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
