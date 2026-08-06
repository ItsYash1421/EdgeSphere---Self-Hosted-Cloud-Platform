import {
  LayoutDashboard, Database, Globe, Key, BarChart3, Radio, Bell,
  Server, ScrollText, Activity, Settings, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  section: 'Platform' | 'Observability' | 'System';
  badge?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard, section: 'Platform' },
  { label: 'Storage', href: '/dashboard/storage', icon: Database, section: 'Platform' },
  { label: 'CDN', href: '/dashboard/cdn', icon: Globe, section: 'Platform' },
  { label: 'API Keys', href: '/dashboard/api-keys', icon: Key, section: 'Platform' },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, section: 'Observability' },
  { label: 'Live Events', href: '/dashboard/events', icon: Radio, section: 'Observability', badge: 'Live' },
  { label: 'Alerts', href: '/dashboard/alerts', icon: Bell, section: 'Observability' },
  { label: 'Edge Servers', href: '/dashboard/edges', icon: Server, section: 'Observability' },
  { label: 'Logs', href: '/dashboard/logs', icon: ScrollText, section: 'Observability' },
  { label: 'Monitoring', href: '/dashboard/monitoring', icon: Activity, section: 'System' },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings, section: 'System' },
];
