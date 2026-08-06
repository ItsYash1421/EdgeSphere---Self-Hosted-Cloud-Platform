'use client';

import { ReactNode, useEffect, useState, Fragment } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { useSelector, useDispatch } from 'react-redux';
import { Zap, Menu, LogOut, Command as CommandIcon } from 'lucide-react';
import { RootState } from '../../store';
import { logout } from '../../store/slices/authSlice';
import { ThemeToggle } from '../../components/ThemeToggle';
import { RealtimeIndicator } from '../../components/RealtimeIndicator';
import { CommandPalette } from '../../components/CommandPalette';
import api from '../../lib/api';
import { NAV_ITEMS, type NavItem } from '../../lib/nav-items';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

const SECTIONS = ['Platform', 'Observability', 'System'] as const;

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-sidebar-primary/10 text-sidebar-primary'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && (
        <Badge variant="outline" className="h-4 border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-500">
          {item.badge}
        </Badge>
      )}
    </Link>
  );
}

function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
      {SECTIONS.map((section) => (
        <div key={section}>
          <div className="px-2.5 pb-1.5 text-[10px] font-semibold tracking-wider text-sidebar-foreground/40 uppercase">
            {section}
          </div>
          <div className="flex flex-col gap-0.5">
            {NAV_ITEMS.filter((i) => i.section === section).map((item) => (
              <NavLink key={item.href} item={item} active={pathname === item.href} onClick={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function SidebarLogo() {
  return (
    <div className="flex items-center gap-2.5 border-b border-sidebar-border px-4 py-4">
      <div className="flex size-8 items-center justify-center rounded-md bg-gradient-to-br from-brand to-orange-600 shadow-[var(--shadow-brand)]">
        <Zap className="size-4 fill-white text-white" />
      </div>
      <span className="text-base font-bold tracking-tight text-sidebar-foreground">EdgeSphere</span>
      <Badge variant="outline" className="ml-auto h-5 px-1.5 text-[10px] text-sidebar-foreground/60">v1.0</Badge>
    </div>
  );
}

function ServiceHealthCard({ healthData }: { healthData: any }) {
  const services = [
    { name: 'API Gateway', up: healthData ? healthData.status !== 'unhealthy' : undefined },
    { name: 'Storage', up: healthData ? healthData.services?.['storage-service']?.status === 'up' : undefined },
    { name: 'Analytics', up: healthData ? healthData.services?.['analytics-service']?.status === 'up' : undefined },
  ];
  return (
    <div className="mb-3 rounded-lg border border-sidebar-border bg-sidebar-accent/50 p-3">
      <div className="mb-2 text-[10px] font-semibold tracking-wider text-sidebar-foreground/40 uppercase">
        Service Health
      </div>
      <div className="flex flex-col gap-1.5">
        {services.map((svc) => (
          <div key={svc.name} className="flex items-center justify-between">
            <span className="text-xs text-sidebar-foreground/70">{svc.name}</span>
            <div className="flex items-center gap-1.5">
              <span className={cn('size-1.5 rounded-full', svc.up ? 'bg-emerald-500' : svc.up === false ? 'bg-red-500' : 'bg-muted-foreground')} />
              <span className={cn('text-[11px] font-medium', svc.up ? 'text-emerald-500' : svc.up === false ? 'text-red-500' : 'text-muted-foreground')}>
                {svc.up === undefined ? 'Checking…' : svc.up ? 'Healthy' : 'Down'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UserMenu({ user, onLogout }: { user: { email: string; role: string } | null; onLogout: () => void }) {
  const initial = user?.email?.[0]?.toUpperCase() || 'U';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2.5 rounded-md p-2 text-left transition-colors hover:bg-sidebar-accent">
          <Avatar size="sm">
            <AvatarFallback className="bg-gradient-to-br from-brand to-purple-500 font-semibold text-white">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-sidebar-foreground">{user?.email || 'User'}</div>
            <div className="text-[11px] text-sidebar-foreground/50 capitalize">{user?.role || 'user'} role</div>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onLogout}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  const [mounted, setMounted] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: healthData } = useSWR(
    isAuthenticated ? '/health' : null,
    (url: string) => api.get<any>(url),
    { refreshInterval: 15000, shouldRetryOnError: false }
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isAuthenticated) {
      router.replace('/login');
    }
  }, [mounted, isAuthenticated, router]);

  const handleLogout = () => {
    dispatch(logout());
    router.replace('/login');
  };

  if (!mounted || !isAuthenticated) {
    return <div className="h-screen bg-background" />;
  }

  const crumbs = pathname.split('/').filter(Boolean);
  const currentPage = NAV_ITEMS.find((i) => i.href === pathname);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <SidebarLogo />
        <SidebarNav pathname={pathname} />
        <div className="border-t border-sidebar-border p-3">
          <ServiceHealthCard healthData={healthData} />
          <UserMenu user={user} onLogout={handleLogout} />
        </div>
      </aside>

      <div className="flex flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-sm supports-backdrop-filter:bg-background/60 sm:px-6">
          {/* Mobile sidebar */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="size-5" />
                <span className="sr-only">Open navigation</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SheetDescription className="sr-only">EdgeSphere navigation menu</SheetDescription>
              <SidebarLogo />
              <SidebarNav pathname={pathname} onNavigate={() => setSheetOpen(false)} />
              <div className="border-t border-sidebar-border p-3">
                <ServiceHealthCard healthData={healthData} />
                <UserMenu user={user} onLogout={handleLogout} />
              </div>
            </SheetContent>
          </Sheet>

          <Breadcrumb className="hidden sm:block">
            <BreadcrumbList>
              <BreadcrumbItem>
                {crumbs.length > 1 ? (
                  <BreadcrumbLink asChild><Link href="/dashboard">Dashboard</Link></BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>Dashboard</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {crumbs.slice(1).map((c) => (
                <Fragment key={c}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="capitalize">{c.replace(/-/g, ' ')}</BreadcrumbPage>
                  </BreadcrumbItem>
                </Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>

          <span className="text-sm font-semibold sm:hidden">{currentPage?.label || 'Dashboard'}</span>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              size="sm"
              className="hidden text-xs text-muted-foreground sm:inline-flex"
              onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            >
              <CommandIcon className="size-3.5" />
              Search
              <kbd className="ml-1 rounded border border-border bg-muted px-1 font-mono text-[10px]">⌘K</kbd>
            </Button>
            <ThemeToggle />
            <RealtimeIndicator />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      <CommandPalette />
    </div>
  );
}
