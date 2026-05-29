import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** Requires authentication. Redirects to /login if not logged in. */
export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/** Requires ADMIN role. Redirects to /scan if not admin. */
export function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'ADMIN') return <Navigate to="/scan" replace />;
  return children;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-outline-variant border-t-secondary rounded-full animate-spin" />
        <p className="text-body-md text-on-surface-variant">Loading...</p>
      </div>
    </div>
  );
}
