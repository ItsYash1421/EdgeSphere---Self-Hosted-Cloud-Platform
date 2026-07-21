'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = mode === 'login' ? '/v1/auth/login' : '/v1/auth/register';
      const data = await api.post(endpoint, { email, password });
      localStorage.setItem('access_token', data.accessToken);
      localStorage.setItem('refresh_token', data.refreshToken);
      router.replace('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-glow-1" />
        <div className="login-glow-2" />
        <div className="login-grid" />
      </div>

      <div className="login-container">
        {/* Left: Branding */}
        <div className="login-brand">
          <div className="login-brand-logo">
            <span>⚡</span>
          </div>
          <h1 className="login-brand-name">EdgeSphere</h1>
          <p className="login-brand-tagline">Your cloud infrastructure, your rules.</p>

          <div className="login-features">
            {[
              { icon: '🌐', title: 'Global CDN', desc: 'Edge servers with Redis caching' },
              { icon: '🗄️', title: 'Object Storage', desc: 'S3-compatible with presigned URLs' },
              { icon: '⚡', title: 'API Gateway', desc: 'JWT auth + rate limiting + routing' },
              { icon: '📊', title: 'Analytics', desc: 'Real-time metrics and logs' },
            ].map((f) => (
              <div key={f.title} className="login-feature-item">
                <span className="login-feature-icon">{f.icon}</span>
                <div>
                  <div className="login-feature-title">{f.title}</div>
                  <div className="login-feature-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="login-stack-badges">
            {['NestJS', 'Go', 'Redis', 'MinIO', 'Kafka', 'Prometheus'].map((t) => (
              <span key={t} className="stack-badge">{t}</span>
            ))}
          </div>
        </div>

        {/* Right: Form */}
        <div className="login-form-container">
          <div className="login-card">
            <div className="login-card-header">
              <div className="login-card-icon">⚡</div>
              <h2 className="login-card-title">
                {mode === 'login' ? 'Welcome back' : 'Create account'}
              </h2>
              <p className="login-card-subtitle">
                {mode === 'login'
                  ? 'Sign in to your EdgeSphere dashboard'
                  : 'Start building with EdgeSphere today'}
              </p>
            </div>

            {error && (
              <div className="login-error">
                <span>⚠️</span>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form">
              <div className="input-group">
                <label className="input-label" htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  className="input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  className="input"
                  placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={mode === 'register' ? 8 : 1}
                />
              </div>

              <button
                id="submit-btn"
                type="submit"
                className={`btn btn-primary w-full login-submit ${loading ? 'loading' : ''}`}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                  </>
                ) : (
                  mode === 'login' ? '→ Sign In' : '→ Create Account'
                )}
              </button>
            </form>

            <div className="login-divider">
              <span>or</span>
            </div>

            <button
              className="btn btn-secondary w-full"
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            >
              {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign in'}
            </button>

            {mode === 'login' && (
              <p className="login-demo-hint">
                Demo: <code>admin@edgesphere.local</code> / <code>admin123</code>
              </p>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          background: var(--bg-base);
          display: flex;
          position: relative;
          overflow: hidden;
        }

        .login-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .login-glow-1 {
          position: absolute;
          top: -200px;
          left: -100px;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%);
        }

        .login-glow-2 {
          position: absolute;
          bottom: -150px;
          right: -100px;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(167, 139, 250, 0.08) 0%, transparent 70%);
        }

        .login-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 40px 40px;
        }

        .login-container {
          display: flex;
          width: 100%;
          min-height: 100vh;
          position: relative;
          z-index: 1;
        }

        .login-brand {
          flex: 1;
          padding: 60px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          border-right: 1px solid var(--border);
          background: linear-gradient(135deg, rgba(99,102,241,0.04) 0%, transparent 60%);
        }

        .login-brand-logo {
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, var(--brand), var(--brand-dark));
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          box-shadow: 0 0 40px rgba(99,102,241,0.35);
          margin-bottom: 20px;
        }

        .login-brand-name {
          font-size: 36px;
          font-weight: 800;
          letter-spacing: -1.5px;
          background: linear-gradient(135deg, #f0f2f5, var(--brand-light));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 8px;
        }

        .login-brand-tagline {
          font-size: 15px;
          color: var(--text-secondary);
          margin-bottom: 40px;
        }

        .login-features {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 32px;
        }

        .login-feature-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .login-feature-icon {
          font-size: 18px;
          margin-top: 2px;
          flex-shrink: 0;
        }

        .login-feature-title {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .login-feature-desc {
          font-size: 12.5px;
          color: var(--text-muted);
        }

        .login-stack-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .stack-badge {
          font-size: 11px;
          font-weight: 500;
          padding: 3px 10px;
          border-radius: 20px;
          background: var(--bg-elevated);
          color: var(--text-secondary);
          border: 1px solid var(--border);
        }

        .login-form-container {
          width: 480px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
          flex-shrink: 0;
        }

        .login-card {
          width: 100%;
          max-width: 400px;
        }

        .login-card-header {
          text-align: center;
          margin-bottom: 28px;
        }

        .login-card-icon {
          font-size: 28px;
          margin-bottom: 12px;
        }

        .login-card-title {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.5px;
          color: var(--text-primary);
          margin-bottom: 6px;
        }

        .login-card-subtitle {
          font-size: 13.5px;
          color: var(--text-secondary);
        }

        .login-error {
          background: var(--red-bg);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: var(--radius-sm);
          padding: 10px 14px;
          font-size: 13px;
          color: var(--red);
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        }

        .login-form { margin-bottom: 16px; }

        .login-submit {
          height: 44px;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.2px;
          justify-content: center;
          background: linear-gradient(135deg, var(--brand), var(--brand-dark));
          transition: all 0.2s;
        }

        .login-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(99,102,241,0.45);
        }

        .login-submit.loading {
          opacity: 0.8;
        }

        .spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .login-divider {
          text-align: center;
          position: relative;
          margin: 16px 0;
          color: var(--text-muted);
          font-size: 12px;
        }

        .login-divider::before {
          content: '';
          position: absolute;
          left: 0; right: 0; top: 50%;
          height: 1px;
          background: var(--border);
        }

        .login-divider span {
          position: relative;
          background: var(--bg-base);
          padding: 0 12px;
        }

        .login-demo-hint {
          text-align: center;
          font-size: 11.5px;
          color: var(--text-muted);
          margin-top: 16px;
        }

        @media (max-width: 900px) {
          .login-brand { display: none; }
          .login-form-container { width: 100%; padding: 24px; }
        }
      `}</style>
    </div>
  );
}
