'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { useTheme } from 'next-themes';
import { LogOut, Sun, Moon, ExternalLink } from 'lucide-react';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command';
import { NAV_ITEMS } from '@/lib/nav-items';
import { logout } from '../store/slices/authSlice';

const MONITORING_LINKS = [
  { label: 'Open Grafana', url: 'http://localhost:3200' },
  { label: 'Open Prometheus', url: 'http://localhost:9090' },
  { label: 'Open Jaeger', url: 'http://localhost:16686' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const dispatch = useDispatch();
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const runCommand = useCallback((action: () => void) => {
    setOpen(false);
    action();
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Command Palette" description="Jump to any page or run a quick action">
      <CommandInput placeholder="Search pages and actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {NAV_ITEMS.map((item) => (
            <CommandItem key={item.href} value={item.label} onSelect={() => runCommand(() => router.push(item.href))}>
              <item.icon />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem value="toggle theme" onSelect={() => runCommand(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? <Sun /> : <Moon />}
            <span>Toggle theme</span>
          </CommandItem>
          <CommandItem value="sign out logout" onSelect={() => runCommand(() => { dispatch(logout()); router.replace('/login'); })}>
            <LogOut />
            <span>Sign out</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Monitoring">
          {MONITORING_LINKS.map((link) => (
            <CommandItem key={link.url} value={link.label} onSelect={() => runCommand(() => window.open(link.url, '_blank'))}>
              <ExternalLink />
              <span>{link.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
