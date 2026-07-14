import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, requireRole }) {
  const { identity, status } = useAuth();

  if (status === 'checking') {
    return (
      <div className="full-center">
        <span className="eyebrow">Restoring session…</span>
      </div>
    );
  }

  if (status === 'anon') {
    return <Navigate to="/login" replace />;
  }

  if (requireRole && identity?.role !== requireRole) {
    return (
      <div className="full-center">
        <div className="empty-state">
          <h3>Restricted</h3>
          <p>This page requires the &ldquo;{requireRole}&rdquo; role.</p>
        </div>
      </div>
    );
  }

  return children;
}
