'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Bell, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';

const NOTIF_BASE = '/v1/notifications';

const fetcher = (url: string) => api.get(url);

const CONDITION_LABELS: Record<string, string> = {
  error_rate_above: 'Error Rate Above %',
  latency_above: 'Latency P95 Above ms',
  cache_hit_below: 'Cache Hit Below %',
  edge_down: 'Edge Node Down',
};

export default function AlertsPage() {
  const { data: rulesData } = useSWR(`${NOTIF_BASE}/alerts/rules`, fetcher, { refreshInterval: 10000 });
  const { data: alertHistory } = useSWR(`${NOTIF_BASE}/alerts/history`, fetcher, { refreshInterval: 30000 });
  const { data: notifHistory } = useSWR(`${NOTIF_BASE}/history`, fetcher, { refreshInterval: 30000 });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', condition: 'error_rate_above', threshold: 5, window: 5, channels: { email: true, webhook: false, slack: false } });
  const [ruleToDelete, setRuleToDelete] = useState<any>(null);

  const rules: any[] = Array.isArray((rulesData as any)?.data) ? (rulesData as any).data : [];
  const aHistory: any[] = Array.isArray((alertHistory as any)?.data) ? (alertHistory as any).data : [];
  const nHistory: any[] = Array.isArray((notifHistory as any)?.data) ? (notifHistory as any).data : [];

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`${NOTIF_BASE}/alerts/rules`, form);
      setIsModalOpen(false);
      mutate(`${NOTIF_BASE}/alerts/rules`);
      toast.success(`Rule "${form.name}" created`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create rule');
    }
  };

  const handleToggleRule = async (id: string, enabled: boolean) => {
    await api.patch(`${NOTIF_BASE}/alerts/rules/${id}`, { enabled: !enabled });
    mutate(`${NOTIF_BASE}/alerts/rules`);
  };

  const confirmDeleteRule = async () => {
    if (!ruleToDelete) return;
    try {
      await api.delete(`${NOTIF_BASE}/alerts/rules/${ruleToDelete.id}`);
      mutate(`${NOTIF_BASE}/alerts/rules`);
      toast.success(`Rule "${ruleToDelete.name}" deleted`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete rule');
    } finally {
      setRuleToDelete(null);
    }
  };

  const handleTestNotification = async () => {
    try {
      await api.post(`${NOTIF_BASE}/test`);
      toast.success('Test notification triggered!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send test notification');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Alerts &amp; Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage alert rules and view notification history</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTestNotification}>
            <Bell className="size-4" /> Test Notification
          </Button>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="size-4" /> Add Rule
          </Button>
        </div>
      </div>

      <Card className="gap-0 py-0">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold">Alert Rules</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Threshold</TableHead>
              <TableHead>Window</TableHead>
              <TableHead>Channels</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule: any) => (
              <TableRow key={rule.id}>
                <TableCell className="font-medium">{rule.name}</TableCell>
                <TableCell><code className="text-xs">{rule.condition}</code></TableCell>
                <TableCell>{rule.threshold}</TableCell>
                <TableCell>{rule.window}m</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {rule.channels.email && <Badge variant="outline" className="border-blue-500/30 text-blue-500">Email</Badge>}
                    {rule.channels.webhook && <Badge variant="outline" className="border-purple-500/30 text-purple-500">Webhook</Badge>}
                    {rule.channels.slack && <Badge variant="outline" className="border-amber-500/30 text-amber-500">Slack</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => handleToggleRule(rule.id, rule.enabled)}
                    className={cn('text-xs font-semibold', rule.enabled ? 'text-emerald-500' : 'text-muted-foreground')}
                  >
                    {rule.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="icon-sm" onClick={() => setRuleToDelete(rule)}>
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rules.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No rules configured.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Card className="gap-0 py-0">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold">Alert History</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Rule</TableHead>
              <TableHead>Value / Threshold</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Channels Notified</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aHistory.map((hist: any, i: number) => (
              <TableRow key={i}>
                <TableCell className="text-xs text-muted-foreground">{new Date(hist.timestamp).toLocaleString()}</TableCell>
                <TableCell className="text-xs">{hist.ruleName}</TableCell>
                <TableCell className="text-xs">{hist.value} / {hist.threshold}</TableCell>
                <TableCell>
                  <span className={cn('text-xs font-semibold', hist.status === 'triggered' ? 'text-red-500' : 'text-emerald-500')}>
                    {hist.status?.toUpperCase() || 'UNKNOWN'}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{hist.channels?.join(', ')}</TableCell>
              </TableRow>
            ))}
            {aHistory.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No alert history.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Card className="gap-0 py-0">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold">Notification Delivery Log</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Message Preview</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nHistory.map((notif: any, i: number) => (
              <TableRow key={i}>
                <TableCell className="text-xs text-muted-foreground">{new Date(notif.timestamp).toLocaleString()}</TableCell>
                <TableCell className="text-xs">{notif.channels?.join(', ') || 'N/A'}</TableCell>
                <TableCell className="text-xs">-</TableCell>
                <TableCell>
                  <span className={cn('text-xs font-semibold', notif.status === 'success' ? 'text-emerald-500' : 'text-red-500')}>{notif.status}</span>
                </TableCell>
                <TableCell className="max-w-[300px] truncate text-xs text-muted-foreground">{notif.error || 'Dispatched via configured channels'}</TableCell>
              </TableRow>
            ))}
            {nHistory.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No notifications sent yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Add Rule Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Alert Rule</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateRule} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rule-name">Name</Label>
              <Input id="rule-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Condition</Label>
              <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONDITION_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rule-threshold">Threshold</Label>
                <Input id="rule-threshold" type="number" required value={form.threshold} onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rule-window">Window (mins)</Label>
                <Input id="rule-window" type="number" required value={form.window} onChange={(e) => setForm({ ...form, window: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Channels</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={form.channels.email} onChange={(e) => setForm({ ...form, channels: { ...form.channels, email: e.target.checked } })} /> Email
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={form.channels.webhook} onChange={(e) => setForm({ ...form, channels: { ...form.channels, webhook: e.target.checked } })} /> Webhook
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={form.channels.slack} onChange={(e) => setForm({ ...form, channels: { ...form.channels, slack: e.target.checked } })} /> Slack
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit">Create Rule</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Rule Confirmation */}
      <AlertDialog open={!!ruleToDelete} onOpenChange={(open) => !open && setRuleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete rule &ldquo;{ruleToDelete?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>This alert rule will stop triggering notifications immediately. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDeleteRule}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
