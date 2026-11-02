import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { homePathFor } from '@/config/navigation';
import type { UserRole } from '@/types/models';

export function RequireRole({ role }: { role: UserRole }) {
  const { profile } = useAuth();
  if (!profile) return null;
  if (profile.role !== role) return <Navigate to={homePathFor(profile.role)} replace />;
  return <Outlet />;
}
