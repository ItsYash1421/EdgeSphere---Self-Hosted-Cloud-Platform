'use client';

export default function SettingsPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Account, platform configuration, and notifications</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20 }}>
        {/* Settings Nav */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', alignSelf: 'start' }}>
          {['Profile', 'Security', 'Notifications', 'Storage Limits', 'Billing', 'Danger Zone'].map((item, i) => (
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
              <input className="input" type="email" defaultValue="admin@edgesphere.local" />
            </div>
            <div className="input-group">
              <label className="input-label">Display Name</label>
              <input className="input" defaultValue="Yash Kumar Meena" />
            </div>
            <button className="btn btn-primary">Save Changes</button>
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 16 }}>Platform Configuration</div>
            {[
              { label: 'Default Cache TTL', value: '3600', unit: 'seconds' },
              { label: 'Max File Size', value: '5120', unit: 'MB' },
              { label: 'Rate Limit (per user)', value: '1000', unit: 'req/min' },
            ].map(setting => (
              <div key={setting.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <label className="input-label" style={{ flex: 1, margin: 0 }}>{setting.label}</label>
                <input className="input" style={{ width: 120 }} defaultValue={setting.value} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 60 }}>{setting.unit}</span>
              </div>
            ))}
            <button className="btn btn-primary btn-sm">Apply</button>
          </div>
        </div>
      </div>
    </div>
  );
}
