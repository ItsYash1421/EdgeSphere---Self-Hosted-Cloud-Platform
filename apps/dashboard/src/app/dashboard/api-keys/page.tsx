'use client';

import { useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import {
  ColumnDef, flexRender, getCoreRowModel, getSortedRowModel, SortingState, useReactTable,
} from '@tanstack/react-table';
import { Key, Plus, Info, CheckCircle2, Copy, Check, Loader2, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

interface PaginatedApiKeys {
  data: ApiKey[];
  total: number;
  page: number;
  pageSize: number;
}

const KEYS_PATH = '/v1/auth/api-keys';
const fetcher = (url: string): Promise<PaginatedApiKeys> => api.get<PaginatedApiKeys>(url);

function formatDate(d: string | null) {
  if (!d) return 'Never';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function relativeTime(d: string | null) {
  if (!d) return 'Never used';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ApiKeysPage() {
  const { data: keysData } = useSWR<PaginatedApiKeys>(KEYS_PATH, fetcher, { refreshInterval: 15000 });
  const keys: ApiKey[] = keysData?.data || [];

  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyResult, setNewKeyResult] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKey | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  const handleCreate = async () => {
    if (!newKeyName) return;
    setCreating(true);
    setError('');
    try {
      const result = await api.post<{ key: string }>(KEYS_PATH, { name: newKeyName });
      setNewKeyResult(result.key);
      await mutate(KEYS_PATH);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create key');
    } finally {
      setCreating(false);
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    toast.success('API key copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const confirmRevoke = async () => {
    if (!keyToRevoke) return;
    try {
      await api.delete(`${KEYS_PATH}/${keyToRevoke.id}`);
      await mutate(KEYS_PATH);
      toast.success(`Revoked "${keyToRevoke.name}"`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke key');
    } finally {
      setKeyToRevoke(null);
    }
  };

  const columns = useMemo<ColumnDef<ApiKey>[]>(() => [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <button className="flex items-center gap-1.5" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Name <ArrowUpDown className="size-3" />
        </button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2 font-medium text-foreground">
          <Key className="size-3.5 text-muted-foreground" /> {row.original.name}
        </div>
      ),
    },
    {
      accessorKey: 'keyPrefix',
      header: 'Key Prefix',
      cell: ({ row }) => <code className="text-sm">{row.original.keyPrefix}••••••••</code>,
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <button className="flex items-center gap-1.5" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Created <ArrowUpDown className="size-3" />
        </button>
      ),
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
    },
    {
      accessorKey: 'lastUsedAt',
      header: 'Last Used',
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{relativeTime(row.original.lastUsedAt)}</span>,
    },
    {
      accessorKey: 'expiresAt',
      header: 'Expires',
      cell: ({ row }) => (
        row.original.expiresAt
          ? <Badge variant="outline" className="border-amber-500/30 text-amber-500">{formatDate(row.original.expiresAt)}</Badge>
          : <Badge variant="outline" className="border-emerald-500/30 text-emerald-500">Never</Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={() => setKeyToRevoke(row.original)}>
          <span className="text-destructive">Revoke</span>
        </Button>
      ),
    },
  ], []);

  const table = useReactTable({
    data: keys,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">API Keys</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage API keys for programmatic access to EdgeSphere</p>
        </div>
        <Button onClick={() => { setShowCreate(true); setNewKeyResult(null); setError(''); }}>
          <Plus className="size-4" /> New API Key
        </Button>
      </div>

      <div className="mb-6 flex items-start gap-3 rounded-md border border-blue-500/20 bg-blue-500/10 px-4 py-3.5">
        <Info className="mt-0.5 size-[18px] shrink-0 text-blue-500" />
        <div>
          <div className="mb-0.5 text-sm font-semibold text-blue-500">Keep your API keys secure</div>
          <div className="text-xs text-muted-foreground">
            API keys grant full access to your EdgeSphere resources. Never expose them in client-side code.
            Use them only in server-to-server requests via the <code className="rounded bg-muted px-1 py-0.5">Authorization: ApiKey esk_...</code> header.
          </div>
        </div>
      </div>

      <Card className="gap-0 py-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <span className="text-sm font-semibold">
            Active Keys <Badge variant="secondary" className="ml-2">{keys.length}</Badge>
          </span>
        </div>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-10">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Key className="size-8 text-muted-foreground" />
                    <div className="text-sm font-semibold text-foreground">No API keys</div>
                    <div className="text-xs text-muted-foreground">Create your first API key to access EdgeSphere programmatically</div>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Card className="mt-5 py-5">
        <CardHeader className="px-5">
          <CardTitle className="text-base">Usage Example</CardTitle>
        </CardHeader>
        <CardContent className="px-5">
          <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-4 font-mono text-[12.5px] leading-relaxed text-muted-foreground">
{`# Upload a file to your bucket
curl -X POST https://api.edgesphere.local/v1/storage/buckets/my-assets/files \\
  -H "Authorization: ApiKey esk_your_key_here" \\
  -F "file=@photo.jpg"

# Generate a presigned URL
curl https://api.edgesphere.local/v1/storage/buckets/my-assets/presign \\
  -H "Authorization: ApiKey esk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"key": "photo.jpg", "expirySeconds": 3600}'`}
          </pre>
        </CardContent>
      </Card>

      {/* Create Key Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          {!newKeyResult ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Key className="size-4" /> Create API Key</DialogTitle>
                <DialogDescription>Give your key a descriptive name to identify its use.</DialogDescription>
              </DialogHeader>

              {error && (
                <div className="rounded-md bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">{error}</div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="key-name">Key name</Label>
                <Input
                  id="key-name"
                  placeholder="e.g. Production App, CI/CD Pipeline"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  autoFocus
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={!newKeyName || creating}>
                  {creating ? <><Loader2 className="size-4 animate-spin" /> Creating...</> : 'Create Key'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="flex flex-col items-center gap-2 text-center">
                  <CheckCircle2 className="size-10 text-emerald-500" />
                  <DialogTitle>Key Created!</DialogTitle>
                  <DialogDescription>
                    Copy and save this key now. <strong className="text-foreground">You won&apos;t be able to see it again.</strong>
                  </DialogDescription>
                </div>
              </DialogHeader>

              <div className="rounded-md border border-brand bg-muted/40 px-4 py-3 font-mono text-sm break-all text-brand">
                {newKeyResult}
              </div>

              <Button className="w-full justify-center" onClick={() => copyKey(newKeyResult)}>
                {copied ? <><Check className="size-4" /> Copied!</> : <><Copy className="size-4" /> Copy to Clipboard</>}
              </Button>

              <DialogFooter>
                <Button variant="outline" className="w-full justify-center" onClick={() => setShowCreate(false)}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation */}
      <AlertDialog open={!!keyToRevoke} onOpenChange={(open) => !open && setKeyToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke &ldquo;{keyToRevoke?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>Any integrations using this key will stop working immediately. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmRevoke}>Revoke</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
