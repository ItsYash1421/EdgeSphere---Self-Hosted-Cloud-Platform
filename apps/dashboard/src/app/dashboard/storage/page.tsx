'use client';

import { useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import {
  ColumnDef, flexRender, getCoreRowModel, getSortedRowModel, SortingState, useReactTable,
} from '@tanstack/react-table';
import {
  Database, Plus, Upload, UploadCloud, Trash2, Link2, Download, Globe, Lock,
  Image as ImageIcon, Film, Music, FileText, FileJson, File as FileIcon,
  ArrowUpDown, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
} from '@/components/ui/pagination';

interface Bucket {
  id: string;
  name: string;
  region: string;
  isPublic: boolean;
  createdAt: string;
}

interface FileObject {
  id: string;
  key: string;
  size: number;
  contentType: string;
  etag: string;
  createdAt: string;
}

const fetcher = (url: string): Promise<any> => api.get<any>(url);

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function FileTypeIcon({ contentType }: { contentType: string }) {
  const cls = 'size-4 text-muted-foreground';
  if (contentType?.startsWith('image/')) return <ImageIcon className={cls} />;
  if (contentType?.startsWith('video/')) return <Film className={cls} />;
  if (contentType?.startsWith('audio/')) return <Music className={cls} />;
  if (contentType === 'application/json') return <FileJson className={cls} />;
  if (contentType === 'application/pdf' || contentType?.startsWith('text/')) return <FileText className={cls} />;
  return <FileIcon className={cls} />;
}

const BUCKETS_PATH = '/v1/storage/buckets';
const BUCKETS_PAGE_SIZE = 20;

export default function StoragePage() {
  const [bucketPage, setBucketPage] = useState(1);
  const { data: bucketsData } = useSWR<{ data: Bucket[]; total: number; page: number; pageSize: number }>(
    `${BUCKETS_PATH}?page=${bucketPage}&pageSize=${BUCKETS_PAGE_SIZE}`,
    fetcher,
    { refreshInterval: 15000 }
  );
  const buckets: Bucket[] = bucketsData?.data || [];
  const bucketTotalPages = bucketsData ? Math.max(1, Math.ceil(bucketsData.total / BUCKETS_PAGE_SIZE)) : 1;

  const [selectedBucketName, setSelectedBucketName] = useState<string | null>(null);
  const selectedBucket = buckets.find(b => b.name === selectedBucketName) || null;

  const filesPath = selectedBucket ? `/v1/storage/buckets/${selectedBucket.name}/files` : null;
  const { data: filesResponse } = useSWR<{ data: FileObject[]; total: number }>(filesPath, fetcher, { refreshInterval: 10000 });
  const files: FileObject[] = filesResponse?.data || [];

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [newBucketRegion, setNewBucketRegion] = useState('us-east-1');
  const [newBucketPublic, setNewBucketPublic] = useState(false);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [bucketToDelete, setBucketToDelete] = useState<Bucket | null>(null);
  const [fileToDelete, setFileToDelete] = useState<FileObject | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  const handleCreateBucket = async () => {
    if (!newBucketName) return;
    setCreating(true);
    setError('');
    try {
      await api.post(BUCKETS_PATH, { name: newBucketName, region: newBucketRegion, isPublic: newBucketPublic });
      await mutate(`${BUCKETS_PATH}?page=${bucketPage}&pageSize=${BUCKETS_PAGE_SIZE}`);
      setShowCreateModal(false);
      setNewBucketName('');
      setNewBucketPublic(false);
      toast.success(`Bucket "${newBucketName}" created`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create bucket';
      setError(msg);
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const confirmDeleteBucket = async () => {
    if (!bucketToDelete) return;
    try {
      await api.delete(`${BUCKETS_PATH}/${bucketToDelete.name}`);
      if (selectedBucketName === bucketToDelete.name) setSelectedBucketName(null);
      await mutate(`${BUCKETS_PATH}?page=${bucketPage}&pageSize=${BUCKETS_PAGE_SIZE}`);
      toast.success(`Bucket "${bucketToDelete.name}" deleted`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete bucket (is it empty?)');
    } finally {
      setBucketToDelete(null);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBucket) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('key', file.name);
      await api.upload(`/v1/storage/buckets/${selectedBucket.name}/files`, formData);
      await mutate(filesPath);
      setShowUploadZone(false);
      toast.success(`Uploaded "${file.name}"`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const confirmDeleteFile = async () => {
    if (!selectedBucket || !fileToDelete) return;
    try {
      await api.delete(`/v1/storage/buckets/${selectedBucket.name}/files/${encodeURIComponent(fileToDelete.key)}`);
      await mutate(filesPath);
      toast.success(`Deleted "${fileToDelete.key}"`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete file');
    } finally {
      setFileToDelete(null);
    }
  };

  const handleDownload = async (file: FileObject) => {
    if (!selectedBucket) return;
    try {
      const { url } = await api.post<{ url: string }>(`/v1/storage/buckets/${selectedBucket.name}/presign`, {
        key: file.key, expirySeconds: 3600, method: 'GET',
      });
      window.open(url, '_blank');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate download link');
    }
  };

  const handleCopyLink = async (file: FileObject) => {
    if (!selectedBucket) return;
    try {
      const { url } = await api.post<{ url: string }>(`/v1/storage/buckets/${selectedBucket.name}/presign`, {
        key: file.key, expirySeconds: 3600, method: 'GET',
      });
      await navigator.clipboard.writeText(url);
      toast.success('Presigned link copied to clipboard');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate link');
    }
  };

  const columns = useMemo<ColumnDef<FileObject>[]>(() => [
    {
      accessorKey: 'key',
      header: ({ column }) => (
        <button className="flex items-center gap-1.5" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Name <ArrowUpDown className="size-3" />
        </button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <FileTypeIcon contentType={row.original.contentType} />
          <code className="max-w-[280px] truncate text-xs">{row.original.key}</code>
        </div>
      ),
    },
    {
      accessorKey: 'size',
      header: ({ column }) => (
        <button className="flex items-center gap-1.5" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Size <ArrowUpDown className="size-3" />
        </button>
      ),
      cell: ({ row }) => <span className="font-mono text-xs">{formatBytes(row.original.size)}</span>,
    },
    {
      accessorKey: 'contentType',
      header: 'Type',
      cell: ({ row }) => <Badge variant="outline">{row.original.contentType}</Badge>,
    },
    {
      accessorKey: 'etag',
      header: 'ETag',
      cell: ({ row }) => <code className="text-xs text-muted-foreground">{row.original.etag?.slice(0, 8)}...</code>,
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <button className="flex items-center gap-1.5" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Uploaded <ArrowUpDown className="size-3" />
        </button>
      ),
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-1.5">
          <Button variant="outline" size="icon-sm" title="Download" onClick={() => handleDownload(row.original)}>
            <Download className="size-3.5" />
          </Button>
          <Button variant="outline" size="icon-sm" title="Copy presigned link" onClick={() => handleCopyLink(row.original)}>
            <Link2 className="size-3.5" />
          </Button>
          <Button variant="outline" size="icon-sm" title="Delete" onClick={() => setFileToDelete(row.original)}>
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [selectedBucket?.name]);

  const table = useReactTable({
    data: files,
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Object Storage</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage buckets and files — S3-compatible storage powered by MinIO</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="size-4" /> New Bucket
        </Button>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[300px_1fr]">
        {/* Bucket List */}
        <Card className="gap-0 py-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <span className="text-sm font-semibold">Buckets</span>
            <Badge variant="secondary">{bucketsData?.total ?? buckets.length}</Badge>
          </div>

          <div>
            {buckets.map(bucket => (
              <button
                key={bucket.id}
                onClick={() => setSelectedBucketName(bucket.name)}
                className={cn(
                  'flex w-full items-center gap-2.5 border-b border-border/60 px-5 py-3.5 text-left transition-colors',
                  selectedBucket?.id === bucket.id ? 'border-l-2 border-l-brand bg-brand/10' : 'border-l-2 border-l-transparent hover:bg-muted/50'
                )}
              >
                <Database className={cn('size-4 shrink-0', selectedBucket?.id === bucket.id ? 'text-brand' : 'text-muted-foreground')} />
                <div className="min-w-0 flex-1">
                  <div className={cn('truncate text-[13.5px] font-semibold', selectedBucket?.id === bucket.id ? 'text-brand' : 'text-foreground')}>
                    {bucket.name}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{bucket.region}</div>
                </div>
                <Badge variant="outline" className={bucket.isPublic ? 'border-emerald-500/30 text-emerald-500' : ''}>
                  {bucket.isPublic ? 'Public' : 'Private'}
                </Badge>
              </button>
            ))}
            {buckets.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">No buckets yet.</div>
            )}
          </div>

          {bucketTotalPages > 1 && (
            <div className="border-t border-border px-5 py-3">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationLink href="#" size="sm" onClick={(e) => { e.preventDefault(); setBucketPage((p) => Math.max(1, p - 1)); }}>
                      Prev
                    </PaginationLink>
                  </PaginationItem>
                  <PaginationItem className="px-2 text-xs text-muted-foreground">
                    {bucketPage} / {bucketTotalPages}
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink href="#" size="sm" onClick={(e) => { e.preventDefault(); setBucketPage((p) => Math.min(bucketTotalPages, p + 1)); }}>
                      Next
                    </PaginationLink>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </Card>

        {/* File Browser */}
        <div className="min-w-0">
          {selectedBucket ? (
            <>
              <Card className="mb-4 py-5">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 px-5">
                  <div>
                    <h2 className="flex items-center gap-2 text-base font-bold">
                      <Database className="size-4 text-brand" /> {selectedBucket.name}
                    </h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span>Region: {selectedBucket.region}</span>
                      <span>Created: {formatDate(selectedBucket.createdAt)}</span>
                      <Badge variant="outline" className={cn('gap-1', selectedBucket.isPublic ? 'border-emerald-500/30 text-emerald-500' : '')}>
                        {selectedBucket.isPublic ? <Globe className="size-3" /> : <Lock className="size-3" />}
                        {selectedBucket.isPublic ? 'Public' : 'Private'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setShowUploadZone((v) => !v)}>
                      <Upload className="size-3.5" /> Upload
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setBucketToDelete(selectedBucket)}>
                      <Trash2 className="size-3.5 text-destructive" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {showUploadZone && (
                <Card
                  className={cn(
                    'mb-4 cursor-pointer border-2 border-dashed py-10 text-center transition-colors',
                    dragOver ? 'border-brand bg-brand/10' : 'border-border bg-muted/30'
                  )}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); }}
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  <input id="file-input" type="file" className="hidden" onChange={handleUpload} />
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="size-7 animate-spin text-brand" />
                      <div className="text-sm text-brand">Uploading...</div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <UploadCloud className="size-8 text-muted-foreground" />
                      <div className="text-sm font-semibold text-foreground">Drop files here or click to upload</div>
                      <div className="text-xs text-muted-foreground">Max file size: 5 GB</div>
                    </div>
                  )}
                </Card>
              )}

              <Card className="gap-0 py-0">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <span className="text-sm font-semibold">
                    Files <Badge variant="secondary" className="ml-2">{files.length}</Badge>
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
                        <TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                          No files in this bucket yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            </>
          ) : (
            <Card className="py-16">
              <CardContent className="flex flex-col items-center gap-3 text-center">
                <Database className="size-10 text-muted-foreground" />
                <div className="text-base font-semibold text-foreground">Select a bucket</div>
                <div className="max-w-xs text-sm text-muted-foreground">Choose a bucket from the left panel to browse and manage files</div>
                <Button onClick={() => setShowCreateModal(true)} className="mt-2">
                  <Plus className="size-4" /> Create your first bucket
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create Bucket Dialog */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Database className="size-4" /> Create New Bucket</DialogTitle>
            <DialogDescription>Buckets are containers for your files and objects.</DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">{error}</div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bucket-name">Bucket name</Label>
            <Input
              id="bucket-name"
              placeholder="my-awesome-bucket"
              value={newBucketName}
              onChange={(e) => setNewBucketName(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ''))}
            />
            <p className="text-xs text-muted-foreground">Lowercase letters, numbers, hyphens and dots only. 3-63 characters.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bucket-region">Region</Label>
            <Select value={newBucketRegion} onValueChange={setNewBucketRegion}>
              <SelectTrigger id="bucket-region" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="us-east-1">us-east-1</SelectItem>
                <SelectItem value="eu-west-1">eu-west-1</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <label htmlFor="is-public" className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-muted/40 px-3.5 py-3">
            <input type="checkbox" id="is-public" checked={newBucketPublic} onChange={(e) => setNewBucketPublic(e.target.checked)} className="size-4" />
            <div>
              <div className="text-sm font-medium">Public bucket</div>
              <div className="text-xs text-muted-foreground">Files accessible via CDN without authentication</div>
            </div>
          </label>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreateBucket} disabled={!newBucketName || creating}>
              {creating ? <><Loader2 className="size-4 animate-spin" /> Creating...</> : 'Create Bucket'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Bucket Confirmation */}
      <AlertDialog open={!!bucketToDelete} onOpenChange={(open) => !open && setBucketToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bucket &ldquo;{bucketToDelete?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>This only works if the bucket is empty. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDeleteBucket}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete File Confirmation */}
      <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{fileToDelete?.key}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDeleteFile}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
