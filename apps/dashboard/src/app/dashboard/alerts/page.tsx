'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';

const NOTIF_BASE = process.env.NEXT_PUBLIC_API_URL + '/notifications';

const fetcher = (url: string) => {
  const token = localStorage.getItem('access_token');
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json());
};

export default function AlertsPage() {
  const { data: rulesData } = useSWR(`${NOTIF_BASE}/alerts/rules`, fetcher, { refreshInterval: 10000 });
  const { data: alertHistory } = useSWR(`${NOTIF_BASE}/alerts/history`, fetcher, { refreshInterval: 30000 });
  const { data: notifHistory } = useSWR(`${NOTIF_BASE}/history`, fetcher, { refreshInterval: 30000 });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', condition: 'error_rate_above', threshold: 5, window: 5, channels: { email: true, webhook: false, slack: false } });

  const rules = rulesData?.data || [];
  const aHistory = alertHistory?.data || [];
  const nHistory = notifHistory?.data || [];

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('access_token');
    await fetch(`${NOTIF_BASE}/alerts/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form)
    });
    setIsModalOpen(false);
    mutate(`${NOTIF_BASE}/alerts/rules`);
  };

  const handleToggleRule = async (id: string, enabled: boolean) => {
    const token = localStorage.getItem('access_token');
    await fetch(`${NOTIF_BASE}/alerts/rules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ enabled: !enabled })
    });
    mutate(`${NOTIF_BASE}/alerts/rules`);
  };

  const handleDeleteRule = async (id: string) => {
    const token = localStorage.getItem('access_token');
    await fetch(`${NOTIF_BASE}/alerts/rules/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    mutate(`${NOTIF_BASE}/alerts/rules`);
  };

  const handleTestNotification = async () => {
    const token = localStorage.getItem('access_token');
    await fetch(`${NOTIF_BASE}/test`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    alert('Test notification triggered!');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>Alerts & Notifications</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage alert rules and view notification history</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={handleTestNotification}>
            🔔 Test Notification
          </button>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            + Add Rule
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Alert Rules</h3>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Condition</th>
              <th>Threshold</th>
              <th>Window</th>
              <th>Channels</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule: any) => (
              <tr key={rule.id}>
                <td>{rule.name}</td>
                <td><code style={{ fontSize: 12 }}>{rule.condition}</code></td>
                <td>{rule.threshold}</td>
                <td>{rule.window}m</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {rule.channels.email && <span className="badge" style={{ background: 'var(--blue)20', color: 'var(--blue)' }}>Email</span>}
                    {rule.channels.webhook && <span className="badge" style={{ background: 'var(--purple)20', color: 'var(--purple)' }}>Webhook</span>}
                    {rule.channels.slack && <span className="badge" style={{ background: 'var(--yellow)20', color: 'var(--yellow)' }}>Slack</span>}
                  </div>
                </td>
                <td>
                  <button 
                    onClick={() => handleToggleRule(rule.id, rule.enabled)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: rule.enabled ? 'var(--green)' : 'var(--text-muted)' }}
                  >
                    {rule.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </td>
                <td>
                  <button onClick={() => handleDeleteRule(rule.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer' }}>Delete</button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20 }}>No rules configured.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Alert History</h3>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Rule</th>
              <th>Value / Threshold</th>
              <th>Status</th>
              <th>Channels Notified</th>
            </tr>
          </thead>
          <tbody>
            {aHistory.map((hist: any, i: number) => (
              <tr key={i}>
                <td>{new Date(hist.timestamp).toLocaleString()}</td>
                <td>{hist.ruleName}</td>
                <td>{hist.value} / {hist.threshold}</td>
                <td>
                  <span style={{ color: hist.status === 'triggered' ? 'var(--red)' : 'var(--green)' }}>
                    {hist.status.toUpperCase()}
                  </span>
                </td>
                <td>{hist.channels?.join(', ')}</td>
              </tr>
            ))}
            {aHistory.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20 }}>No alert history.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Notification Delivery Log</h3>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Channel</th>
              <th>Recipient</th>
              <th>Status</th>
              <th>Message Preview</th>
            </tr>
          </thead>
          <tbody>
            {nHistory.map((notif: any, i: number) => (
              <tr key={i}>
                <td>{new Date(notif.timestamp).toLocaleString()}</td>
                <td>{notif.channel}</td>
                <td>{notif.recipient}</td>
                <td style={{ color: notif.status === 'success' ? 'var(--green)' : 'var(--red)' }}>{notif.status}</td>
                <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{notif.message}</td>
              </tr>
            ))}
            {nHistory.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20 }}>No notifications sent yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: 400, padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>Add Alert Rule</h3>
            <form onSubmit={handleCreateRule} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>Name</label>
                <input required className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>Condition</label>
                <select className="input" value={form.condition} onChange={e => setForm({...form, condition: e.target.value})} style={{ width: '100%' }}>
                  <option value="error_rate_above">Error Rate Above %</option>
                  <option value="latency_above">Latency P95 Above ms</option>
                  <option value="cache_hit_below">Cache Hit Below %</option>
                  <option value="edge_down">Edge Node Down</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>Threshold</label>
                  <input type="number" required className="input" value={form.threshold} onChange={e => setForm({...form, threshold: Number(e.target.value)})} style={{ width: '100%' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>Window (mins)</label>
                  <input type="number" required className="input" value={form.window} onChange={e => setForm({...form, window: Number(e.target.value)})} style={{ width: '100%' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>Channels</label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <label><input type="checkbox" checked={form.channels.email} onChange={e => setForm({...form, channels: {...form.channels, email: e.target.checked}})} /> Email</label>
                  <label><input type="checkbox" checked={form.channels.webhook} onChange={e => setForm({...form, channels: {...form.channels, webhook: e.target.checked}})} /> Webhook</label>
                  <label><input type="checkbox" checked={form.channels.slack} onChange={e => setForm({...form, channels: {...form.channels, slack: e.target.checked}})} /> Slack</label>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Rule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
