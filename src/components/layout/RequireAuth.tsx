import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';

export function RequireAuth() {
  const { session, profile, profileError, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingState label="Menyiapkan akun Anda..." />;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-200/70">
          <Logo />
          <ErrorState message={profileError ?? 'Profil akun tidak dapat dimuat'} />
          <Button variant="secondary" onClick={() => void signOut()} className="w-full">
            Keluar
          </Button>
        </div>
      </div>
    );
  }

  if (profile.status === 'suspended') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-200/70">
          <Logo />
          <div className="space-y-2">
            <h1 className="text-lg font-semibold text-gray-900">Akun Anda ditangguhkan</h1>
            <p className="text-sm text-gray-500">
              Akun ini sedang tidak aktif. Silakan hubungi admin AGENTPAY untuk informasi lebih lanjut.
            </p>
          </div>
          <Button variant="secondary" onClick={() => void signOut()} className="w-full">
            Keluar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
