'use client';

import React, { useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { toast } from 'sonner';
import {
  Database, Zap, Globe, Gauge, Trash2, AlertTriangle, CheckCircle2, Copy, Loader2, Image as ImageIcon,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';

const fetcher = (url: string): Promise<any> => api.get<any>(url);

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const CACHE_STATS_PATH = '/v1/cache/stats';
const CACHE_HISTORY_PATH = '/v1/cache/history';
const CACHE_RATIO_PATH = '/v1/analytics/cache/ratio?window=1440';

export default function CDNPage() {
  const { data: cacheStats } = useSWR<{ totalKeys: number; memoryUsed: string }>(CACHE_STATS_PATH, fetcher, { refreshInterval: 15000 });
  const { data: cacheRatio } = useSWR<{ hitRatio: number; hits: number; misses: number; cachedBytes: number }>(CACHE_RATIO_PATH, fetcher, { refreshInterval: 15000 });
  const { data: purgeHistory } = useSWR<any[]>(CACHE_HISTORY_PATH, fetcher, { refreshInterval: 10000 });

  const [purgeType, setPurgeType] = useState('file');
  const [bucket, setBucket] = useState('');
  const [key, setKey] = useState('');
  const [purging, setPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<any>(null);
  const [purgeError, setPurgeError] = useState('');
  const [confirmPurgeAll, setConfirmPurgeAll] = useState(false);

  const [demoBucket, setDemoBucket] = useState('my-bucket');
  const [demoKey, setDemoKey] = useState('image.jpg');
  const [demoW, setDemoW] = useState('400');
  const [demoFmt, setDemoFmt] = useState('webp');
  const [demoQ, setDemoQ] = useState('80');
  const [previewFailed, setPreviewFailed] = useState(false);

  const executePurge = async () => {
    setPurging(true);
    setPurgeError('');
    try {
      let result;
      if (purgeType === 'all') {
        result = await api.delete<any>('/v1/cache/purge/all');
      } else if (purgeType === 'bucket') {
        result = await api.post<any>('/v1/cache/purge/bucket', { bucket });
      } else if (purgeType === 'prefix') {
        result = await api.post<any>('/v1/cache/purge/prefix', { bucket, prefix: key });
      } else {
        result = await api.post<any>('/v1/cache/purge', { bucket, key });
      }
      setPurgeResult(result);
      await mutate(CACHE_HISTORY_PATH);
      await mutate(CACHE_STATS_PATH);
      toast.success(`Cache purged — ${result.keysDeleted ?? 0} keys deleted`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Purge failed';
      setPurgeError(msg);
      toast.error(msg);
    } finally {
      setPurging(false);
    }
  };

  const handlePurgeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (purgeType === 'all') {
      setConfirmPurgeAll(true);
      return;
    }
    executePurge();
  };

  const getUrl = () => {
    const params = new URLSearchParams();
    if (demoW) params.append('w', demoW);
    if (demoFmt) params.append('fmt', demoFmt);
    if (demoQ) params.append('q', demoQ);
    const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL || 'http://localhost:8080';
    return `${cdnUrl}/cdn/${demoBucket}/${demoKey}?${params.toString()}`;
  };

  const previewUrl = getUrl();
  useEffect(() => setPreviewFailed(false), [previewUrl]);

  const overviewStats = [
    { label: 'Total Cached Keys', value: cacheStats ? cacheStats.totalKeys.toLocaleString() : '—', icon: Database, color: 'var(--brand)', bg: 'var(--brand-glow)' },
    { label: 'Cache Hit Ratio', value: cacheRatio ? `${(cacheRatio.hitRatio * 100).toFixed(1)}%` : '—', icon: Zap, color: 'var(--green)', bg: 'var(--green-bg)' },
    { label: 'Cache Memory Used', value: cacheStats ? cacheStats.memoryUsed : '—', icon: Gauge, color: 'var(--yellow)', bg: 'var(--yellow-bg)' },
    { label: 'Bandwidth Served', value: cacheRatio ? formatBytes(cacheRatio.cachedBytes) : '—', icon: Globe, color: 'var(--brand)', bg: 'var(--brand-glow)' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">CDN Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage edge caching, image optimization, and distribution.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {overviewStats.map((stat) => (
          <Card key={stat.label} className="gap-3 py-5">
            <CardContent className="px-5">
              <div className="mb-3 flex size-9 items-center justify-center rounded-md" style={{ background: stat.bg, color: stat.color }}>
                <stat.icon className="size-[18px]" />
              </div>
              <div className="text-xs font-medium text-muted-foreground">{stat.label}</div>
              <div className="mt-1 text-2xl font-bold tracking-tight text-foreground">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Purge Controls */}
        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Cache Purge Controls</CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <form onSubmit={handlePurgeSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Purge Type</Label>
                <Select value={purgeType} onValueChange={setPurgeType}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="file">File (Exact Key)</SelectItem>
                    <SelectItem value="bucket">Entire Bucket</SelectItem>
                    <SelectItem value="prefix">Prefix Path</SelectItem>
                    <SelectItem value="all">Purge All (Warning)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {purgeType !== 'all' && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="purge-bucket">Bucket Name</Label>
                  <Input id="purge-bucket" placeholder="e.g. assets-prod" value={bucket} onChange={(e) => setBucket(e.target.value)} required />
                </div>
              )}

              {(purgeType === 'file' || purgeType === 'prefix') && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="purge-key">Key / Path</Label>
                  <Input id="purge-key" placeholder="e.g. images/hero.png" value={key} onChange={(e) => setKey(e.target.value)} required />
                </div>
              )}

              {purgeType === 'all' && (
                <div className="flex items-start gap-2.5 rounded-md bg-destructive/10 px-3.5 py-3 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>Warning: Purging all cache will clear L1 and L2 caches globally. This may cause a temporary spike in origin traffic.</span>
                </div>
              )}

              {purgeError && (
                <div className="rounded-md bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">{purgeError}</div>
              )}

              <Button type="submit" variant="destructive" disabled={purging}>
                {purging ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                {purging ? 'Purging...' : 'Purge Cache'}
              </Button>
            </form>

            {purgeResult && (
              <div className="mt-4 rounded-md border border-border bg-muted/40 px-3.5 py-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                  <CheckCircle2 className="size-3.5" /> Purge Successful
                </div>
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <div>Keys deleted: <span className="text-foreground">{purgeResult.keysDeleted}</span></div>
                  {purgeResult.regions && <div>Regions affected: <span className="text-foreground">{purgeResult.regions.join(', ')}</span></div>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Image Optimization Demo */}
        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Image Optimization Demo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 px-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Bucket</Label>
                <Input value={demoBucket} onChange={(e) => setDemoBucket(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Key</Label>
                <Input value={demoKey} onChange={(e) => setDemoKey(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Width</Label>
                <Input type="number" value={demoW} onChange={(e) => setDemoW(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Quality</Label>
                <Input type="number" value={demoQ} onChange={(e) => setDemoQ(e.target.value)} />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label>Format</Label>
                <Select value={demoFmt} onValueChange={setDemoFmt}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="webp">WebP</SelectItem>
                    <SelectItem value="avif">AVIF</SelectItem>
                    <SelectItem value="jpeg">JPEG</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md border border-border bg-muted/40 px-3.5 py-3">
              <div className="mb-2 text-xs text-muted-foreground">Generated URL</div>
              <code className="block text-[11px] break-all text-foreground">{previewUrl}</code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => { navigator.clipboard.writeText(previewUrl); toast.success('URL copied to clipboard'); }}
              >
                <Copy className="size-3.5" /> Copy URL
              </Button>
            </div>

            <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-border bg-muted/40">
              {previewFailed ? (
                <ImageIcon className="size-8 text-muted-foreground" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="CDN preview"
                  className="max-h-40 w-full object-contain"
                  onError={() => setPreviewFailed(true)}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History Table */}
      <Card className="gap-0 py-0">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Purge History</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Keys Deleted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(purgeHistory || []).map((row: any) => (
              <TableRow key={row.purgeId}>
                <TableCell className="text-xs">{new Date(row.timestamp).toLocaleString()}</TableCell>
                <TableCell><Badge variant="outline">{row.type}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{row.bucket || row.prefix || 'Global'}{row.key ? `/${row.key}` : ''}</TableCell>
                <TableCell className="text-xs">{row.keysDeleted}</TableCell>
              </TableRow>
            ))}
            {(!purgeHistory || purgeHistory.length === 0) && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No purges yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog open={confirmPurgeAll} onOpenChange={setConfirmPurgeAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-destructive" /> Purge all cache?</AlertDialogTitle>
            <AlertDialogDescription>
              This clears L1 and L2 caches globally across every edge server. Origin traffic may spike temporarily while the cache repopulates. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { setConfirmPurgeAll(false); executePurge(); }}>
              Purge Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
