import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/AppShell';
import LoginPage from './pages/LoginPage';
import SecretsPage from './pages/SecretsPage';
import SecretDetailPage from './pages/SecretDetailPage';
import PoliciesPage from './pages/PoliciesPage';
import IdentitiesPage from './pages/IdentitiesPage';
import AuditPage from './pages/AuditPage';

function Shell({ children }) {
  return <AppShell>{children}</AppShell>;
}

function RootRedirect() {
  const { status } = useAuth();
  if (status === 'checking') return null;
  return <Navigate to={status === 'authed' ? '/secrets' : '/login'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/secrets"
          element={
            <ProtectedRoute>
              <Shell>
                <SecretsPage />
              </Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/secrets/:id"
          element={
            <ProtectedRoute>
              <Shell>
                <SecretDetailPage />
              </Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/policies"
          element={
            <ProtectedRoute requireRole="admin">
              <Shell>
                <PoliciesPage />
              </Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/identities"
          element={
            <ProtectedRoute requireRole="admin">
              <Shell>
                <IdentitiesPage />
              </Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit"
          element={
            <ProtectedRoute requireRole="admin">
              <Shell>
                <AuditPage />
              </Shell>
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </AuthProvider>
  );
}
