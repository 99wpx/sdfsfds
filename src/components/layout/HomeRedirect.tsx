import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { homePathFor } from '@/config/navigation';
import { LoadingState } from '@/components/ui/States';

export function HomeRedirect() {
  const { profile, loading } = useAuth();
  if (loading || !profile) return <LoadingState />;
  return <Navigate to={homePathFor(profile.role)} replace />;
}
