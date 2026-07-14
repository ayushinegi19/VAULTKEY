import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AppShell.css';

const NAV_ITEMS = [
  { to: '/secrets', label: 'Secrets', adminOnly: false },
  { to: '/policies', label: 'Policies', adminOnly: true },
  { to: '/identities', label: 'Identities', adminOnly: true },
  { to: '/audit', label: 'Audit log', adminOnly: true },
];

export default function AppShell({ children }) {
  const { identity, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="shell">
      <aside className="shell-sidebar">
        <div className="shell-brand">
          <span className="shell-brand-mark" aria-hidden="true" />
          <span className="shell-brand-name">VaultKey</span>
        </div>

        <nav className="shell-nav">
          {NAV_ITEMS.filter((item) => !item.adminOnly || identity?.role === 'admin').map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `shell-nav-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="shell-sidebar-foot">
          <span className="eyebrow">Envelope encryption · RBAC · audit</span>
        </div>
      </aside>

      <div className="shell-main">
        <header className="shell-topbar">
          <div />
          <div className="shell-identity">
            <span className={`badge ${identity?.role === 'admin' ? 'badge-allow' : 'badge-neutral'}`}>
              {identity?.role}
            </span>
            <span className="shell-identity-name mono">{identity?.name}</span>
            <button type="button" className="btn btn-ghost" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>

        <main className="shell-content">{children}</main>
      </div>
    </div>
  );
}
