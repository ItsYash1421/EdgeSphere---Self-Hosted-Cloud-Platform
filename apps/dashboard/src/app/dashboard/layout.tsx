'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { logout } from '../../store/slices/authSlice';
import { ThemeToggle } from '../../components/ThemeToggle';
import { RealtimeIndicator } from '../../components/RealtimeIndicator';
import {
  LayoutDashboard, Database, Globe, Key, BarChart3, Radio, Bell,
  Server, ScrollText, Activity, Settings, LogOut, Zap, User, Menu, X
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard, section: 'main' },
  { label: 'Storage', href: '/dashboard/storage', icon: Database, section: 'main' },
  { label: 'CDN', href: '/dashboard/cdn', icon: Globe, section: 'main' },
  { label: 'API Keys', href: '/dashboard/api-keys', icon: Key, section: 'main' },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, section: 'observe' },
  { label: 'Live Events', href: '/dashboard/events', icon: Radio, section: 'observe', badge: 'Live' },
  { label: 'Alerts', href: '/dashboard/alerts', icon: Bell, section: 'observe' },
  { label: 'Edge Servers', href: '/dashboard/edges', icon: Server, section: 'observe' },
  { label: 'Logs', href: '/dashboard/logs', icon: ScrollText, section: 'observe' },
  { label: 'Monitoring', href: '/dashboard/monitoring', icon: Activity, section: 'system' },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings, section: 'system' },
];

function NavItem({ item, active, onClick }: { item: typeof NAV_ITEMS[0]; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      <Icon size={16} className="nav-item-icon" />
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.badge && <span className="nav-badge">{item.badge}</span>}
    </Link>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isAuthenticated) {
      router.replace('/login');
    }
  }, [mounted, isAuthenticated, router]);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (window.innerWidth <= 900 && sidebarOpen) {
        const sidebar = document.getElementById('sidebar');
        const menuBtn = document.getElementById('menu-btn');
        if (sidebar && !sidebar.contains(e.target as Node) && menuBtn && !menuBtn.contains(e.target as Node)) {
          setSidebarOpen(false);
        }
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [sidebarOpen]);

  const handleLogout = () => {
    dispatch(logout());
    router.replace('/login');
  };

  if (!mounted || !isAuthenticated) {
    return <div style={{ height: '100vh', background: 'var(--bg-base)' }} />;
  }

  const mainSections = NAV_ITEMS.filter(i => i.section === 'main');
  const observeSection = NAV_ITEMS.filter(i => i.section === 'observe');
  const systemSection = NAV_ITEMS.filter(i => i.section === 'system');

  return (
    <div className="app-layout">
      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div 
          className="modal-overlay" 
          style={{ zIndex: 90 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside id="sidebar" className={`sidebar ${sidebarOpen ? 'mobile-open' : 'mobile-hidden'}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Zap size={20} color="white" />
          </div>
          <span className="sidebar-logo-text">EdgeSphere</span>
          <span className="sidebar-logo-badge">v1.0</span>
          
          <button 
            className="btn-icon" 
            style={{ marginLeft: 'auto', display: 'var(--mobile-only, none)' }}
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <span className="nav-section-label">Platform</span>
          {mainSections.map(item => (
            <NavItem key={item.href} item={item} active={pathname === item.href} onClick={() => setSidebarOpen(false)} />
          ))}

          <span className="nav-section-label">Observability</span>
          {observeSection.map(item => (
            <NavItem key={item.href} item={item} active={pathname === item.href} onClick={() => setSidebarOpen(false)} />
          ))}

          <span className="nav-section-label">System</span>
          {systemSection.map(item => (
            <NavItem key={item.href} item={item} active={pathname === item.href} onClick={() => setSidebarOpen(false)} />
          ))}
        </nav>

        <div className="sidebar-footer">
          {/* Service Status */}
          <div style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', padding: '12px', marginBottom: 16
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 12 }}>
              Service Health
            </div>
            {[
              { name: 'API Gateway', status: 'Healthy' },
              { name: 'Storage', status: 'Healthy' },
              { name: 'Analytics', status: 'Healthy' },
            ].map(svc => (
              <div key={svc.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{svc.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="status-dot online pulse" />
                  <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>{svc.status}</span>
                </div>
              </div>
            ))}
          </div>

          {/* User Card */}
          <div className="user-card" title={user?.email || 'User'}>
            <div className="user-avatar">
              <User size={16} />
            </div>
            <div className="user-info">
              <div className="user-name">
                {user?.email || 'User'}
              </div>
              <div className="user-role">{user?.role || 'admin'} role</div>
            </div>
            <button
              onClick={handleLogout}
              className="btn-icon"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="main-content">
        <header className="topbar">
          <button 
            id="menu-btn"
            className="btn-icon" 
            style={{ 
              display: typeof window !== 'undefined' && window.innerWidth <= 900 ? 'block' : 'none',
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' 
            }}
            onClick={(e) => {
              e.stopPropagation();
              setSidebarOpen(true);
            }}
          >
            <Menu size={20} />
          </button>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {pathname.split('/').filter(Boolean).map((p, i, arr) => (
                <span key={p}>
                  {i > 0 && <span style={{ margin: '0 8px' }}>/</span>}
                  <span style={{ color: i === arr.length - 1 ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: i === arr.length - 1 ? 600 : 400 }}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* Topbar actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <ThemeToggle />
            <RealtimeIndicator />
          </div>
        </header>

        <main className="page-content">
          {children}
        </main>
      </div>
      <style jsx global>{`
        @media (min-width: 901px) {
          #menu-btn { display: none !important; }
        }
        @media (max-width: 900px) {
          #menu-btn { display: block !important; }
          .page-content { padding: 16px; }
        }
      `}</style>
    </div>
  );
}
