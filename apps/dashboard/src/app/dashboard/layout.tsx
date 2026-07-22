'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

const NAV_ITEMS = [
  { label: 'Overview', href: '/dashboard', icon: '◈', section: 'main' },
  { label: 'Storage', href: '/dashboard/storage', icon: '🗄️', section: 'main' },
  { label: 'CDN', href: '/dashboard/cdn', icon: '🌐', section: 'main' },
  { label: 'API Keys', href: '/dashboard/api-keys', icon: '🔑', section: 'main' },
  { label: 'Analytics', href: '/dashboard/analytics', icon: '📊', section: 'observe' },
  { label: 'Live Events', href: '/dashboard/events', icon: '⚡', section: 'observe', badge: 'Live' },
  { label: 'Alerts', href: '/dashboard/alerts', icon: '🔔', section: 'observe' },
  { label: 'Edge Servers', href: '/dashboard/edges', icon: '⚡', section: 'observe' },
  { label: 'Logs', href: '/dashboard/logs', icon: '📋', section: 'observe' },
  { label: 'Monitoring', href: '/dashboard/monitoring', icon: '📈', section: 'system', badge: 'Grafana' },
  { label: 'Settings', href: '/dashboard/settings', icon: '⚙️', section: 'system' },
];

function NavItem({ item, active }: { item: typeof NAV_ITEMS[0]; active: boolean }) {
  return (
    <Link href={item.href} className={`nav-item ${active ? 'active' : ''}`}>
      <span style={{ fontSize: 15 }}>{item.icon}</span>
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.badge && <span className="nav-badge">{item.badge}</span>}
    </Link>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.replace('/login');
      return;
    }
    // Decode JWT to get user info (no verification needed on client)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUser({ email: payload.email, role: payload.role });
    } catch {
      router.replace('/login');
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    router.replace('/login');
  };

  const mainSections = NAV_ITEMS.filter(i => i.section === 'main');
  const observeSection = NAV_ITEMS.filter(i => i.section === 'observe');
  const systemSection = NAV_ITEMS.filter(i => i.section === 'system');

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">⚡</div>
          <span className="sidebar-logo-text">EdgeSphere</span>
          <span className="sidebar-logo-badge">v1.0</span>
        </div>

        <nav className="sidebar-nav">
          <span className="nav-section-label">Platform</span>
          {mainSections.map(item => (
            <NavItem key={item.href} item={item} active={pathname === item.href} />
          ))}

          <span className="nav-section-label">Observability</span>
          {observeSection.map(item => (
            <NavItem key={item.href} item={item} active={pathname === item.href} />
          ))}

          <span className="nav-section-label">System</span>
          {systemSection.map(item => (
            <NavItem key={item.href} item={item} active={pathname === item.href} />
          ))}
        </nav>

        <div className="sidebar-footer">
          {/* Service Status */}
          <div style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 10
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 8 }}>
              Services
            </div>
            {[
              { name: 'Gateway', status: 'online' },
              { name: 'Storage', status: 'online' },
              { name: 'Edge A', status: 'online' },
              { name: 'Edge B', status: 'online' },
            ].map(svc => (
              <div key={svc.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{svc.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span className={`status-dot ${svc.status} pulse`} />
                  <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 500 }}>{svc.status}</span>
                </div>
              </div>
            ))}
          </div>

          {/* User Card */}
          <div className="user-card">
            <div className="user-avatar">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="user-info">
              <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email || 'Loading...'}
              </div>
              <div className="user-role">{user?.role || 'user'}</div>
            </div>
            <button
              onClick={handleLogout}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: '4px' }}
              title="Logout"
            >
              ↩
            </button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="main-content">
        <header className="topbar">
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {pathname.split('/').filter(Boolean).map((p, i, arr) => (
                <span key={p}>
                  {i > 0 && <span style={{ margin: '0 6px' }}>›</span>}
                  <span style={{ color: i === arr.length - 1 ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: i === arr.length - 1 ? 600 : 400 }}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* Topbar actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a
              href="http://localhost:3200"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              📈 Grafana
            </a>
            <a
              href="http://localhost:16686"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              🔍 Jaeger
            </a>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--green)', boxShadow: '0 0 8px var(--green)'
            }} title="All systems operational" />
            <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 500 }}>Operational</span>
          </div>
        </header>

        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}
