'use client';

import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import useSWR, { mutate } from 'swr';
import api from '@/lib/api';
import { RootState } from '../../../store';

interface Profile {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
}

interface PlatformConfig {
  cacheTtlSeconds: number;
  maxFileSizeMb: number;
  rateLimitPerIp: number;
}

const PROFILE_PATH = '/v1/auth/me';
const CONFIG_PATH = '/config';
const fetcher = (url: string): Promise<any> => api.get<any>(url);

export default function SettingsPage() {
  const { user } = useSelector((state: RootState) => state.auth);
  const isAdmin = user?.role === 'admin';

  const { data: profile } = useSWR<Profile>(PROFILE_PATH, fetcher);
  const { data: platformConfig } = useSWR<PlatformConfig>(CONFIG_PATH, fetcher, { refreshInterval: 15000 });

  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [configForm, setConfigForm] = useState<PlatformConfig | null>(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [configError, setConfigError] = useState('');

  useEffect(() => {
    if (profile) setDisplayName(profile.displayName || '');
  }, [profile]);

  useEffect(() => {
    if (platformConfig) setConfigForm(platformConfig);
  }, [platformConfig]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.patch(PROFILE_PATH, { displayName });
      await mutate(PROFILE_PATH);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!configForm) return;
    setConfigSaving(true);
    setConfigError('');
    setConfigSaved(false);
    try {
      await api.patch(CONFIG_PATH, configForm);
      await mutate(CONFIG_PATH);
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 2000);
    } catch (err: unknown) {
      setConfigError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setConfigSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Account and platform configuration</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20 }}>
        {/* Settings Nav */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', alignSelf: 'start' }}>
          {['Profile', 'Platform Configuration'].map((item, i) => (
            <div key={item} style={{
              padding: '12px 16px', cursor: 'pointer', fontSize: 13.5,
              fontWeight: i === 0 ? 600 : 400,
              color: i === 0 ? 'var(--brand-light)' : 'var(--text-secondary)',
              background: i === 0 ? 'var(--brand-glow)' : 'transparent',
              borderLeft: i === 0 ? '3px solid var(--brand)' : '3px solid transparent',
              borderBottom: '1px solid var(--border-subtle)',
              transition: 'all 0.15s'
            }}>
              {item}
            </div>
          ))}
        </div>

        {/* Settings Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 16 }}>Profile</div>
            <div className="input-group">
              <label className="input-label">Email</label>
              <input className="input" type="email" value={profile?.email || ''} disabled />
            </div>
            <div className="input-group">
              <label className="input-label">Display Name</label>
              <input
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={profile ? 'Add a display name' : 'Loading...'}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Role</label>
              <input className="input" value={profile?.role || ''} disabled />
            </div>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !profile}>
              {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Changes'}
            </button>
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 8 }}>Platform Configuration</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 16 }}>
              {isAdmin
                ? 'These values are stored centrally and take effect immediately — no restart needed.'
                : "These values are stored centrally. Only admins can change them — you're viewing as read-only."}
            </div>
            {configError && (
              <div style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: '10px 14px', borderRadius: 8, fontSize: 12.5, marginBottom: 12 }}>
                {configError}
              </div>
            )}
            {[
              { key: 'cacheTtlSeconds' as const, label: 'Default Cache TTL', unit: 'seconds' },
              { key: 'maxFileSizeMb' as const, label: 'Max File Size', unit: 'MB' },
              { key: 'rateLimitPerIp' as const, label: 'Rate Limit (per IP)', unit: 'req/min' },
            ].map(setting => (
              <div key={setting.key} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <label className="input-label" style={{ flex: 1, margin: 0 }}>{setting.label}</label>
                <input
                  className="input"
                  style={{ width: 120 }}
                  type="number"
                  value={configForm?.[setting.key] ?? ''}
                  disabled={!isAdmin || !configForm}
                  onChange={(e) => setConfigForm(prev => prev ? { ...prev, [setting.key]: Number(e.target.value) } : prev)}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 70 }}>{setting.unit}</span>
              </div>
            ))}
            {isAdmin && (
              <button className="btn btn-primary btn-sm" onClick={handleSaveConfig} disabled={configSaving || !configForm}>
                {configSaving ? 'Applying...' : configSaved ? '✓ Applied' : 'Apply'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
