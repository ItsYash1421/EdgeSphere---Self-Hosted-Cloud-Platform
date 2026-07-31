'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../../store/slices/authSlice';
import api from '@/lib/api';
import { Zap, Globe, Database, Shield, Activity, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useDispatch();
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
      const data = await api.post<{ accessToken: string; refreshToken: string }>(endpoint, { email, password });
      
      // Decode user info from JWT
      const payload = JSON.parse(atob(data.accessToken.split('.')[1]));
      
      dispatch(setCredentials({
        user: { email: payload.email, role: payload.role },
        accessToken: data.accessToken,
        refreshToken: data.refreshToken
      }));
      
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
            <Zap size={28} color="white" />
          </div>
          <h1 className="login-brand-name">EdgeSphere</h1>
          <p className="login-brand-tagline">Enterprise-grade cloud infrastructure.</p>

          <div className="login-features">
            {[
              { icon: Globe, title: 'Global CDN', desc: 'Edge servers with high-performance caching' },
              { icon: Database, title: 'Object Storage', desc: 'S3-compatible with fine-grained access' },
              { icon: Shield, title: 'API Gateway', desc: 'Secure JWT auth, rate limiting & routing' },
              { icon: Activity, title: 'Real-time Analytics', desc: 'Deep observability and metrics' },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="login-feature-item">
                  <span className="login-feature-icon">
                    <Icon size={18} />
                  </span>
                  <div>
                    <div className="login-feature-title">{f.title}</div>
                    <div className="login-feature-desc">{f.desc}</div>
                  </div>
                </div>
              );
            })}
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
              <div className="login-card-icon">
                <Zap size={28} className="text-brand" />
              </div>
              <h2 className="login-card-title">
                {mode === 'login' ? 'Sign in to EdgeSphere' : 'Create an account'}
              </h2>
              <p className="login-card-subtitle">
                {mode === 'login'
                  ? 'Access your unified cloud management console.'
                  : 'Start building globally distributed applications.'}
              </p>
            </div>

            {error && (
              <div className="login-error">
                <AlertCircle size={16} />
                <span>{error}</span>
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
                    <Loader2 size={16} className="spinner" />
                    {mode === 'login' ? 'Authenticating...' : 'Creating account...'}
                  </>
                ) : (
                  <>
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <div className="login-divider">
              <span>OR</span>
            </div>

            <button
              className="btn btn-secondary w-full"
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            >
              {mode === 'login' ? "Create a new account" : 'Sign in to an existing account'}
            </button>

            {mode === 'login' && (
              <p className="login-demo-hint">
                Demo access: <code>admin@edgesphere.local</code> / <code>admin123</code>
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
          background: radial-gradient(circle, var(--brand-glow) 0%, transparent 70%);
        }

        .login-glow-2 {
          position: absolute;
          bottom: -150px;
          right: -100px;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(0,161,201,0.08) 0%, transparent 70%);
        }

        .login-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(var(--border) 1px, transparent 1px),
            linear-gradient(90deg, var(--border) 1px, transparent 1px);
          background-size: 40px 40px;
          opacity: 0.3;
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
          background: linear-gradient(135deg, var(--bg-elevated) 0%, transparent 60%);
        }

        .login-brand-logo {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, var(--brand), var(--brand-dark));
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: var(--shadow-brand);
          margin-bottom: 24px;
        }

        .login-brand-name {
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -1px;
          color: var(--text-primary);
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
          gap: 20px;
          margin-bottom: 40px;
        }

        .login-feature-item {
          display: flex;
          align-items: flex-start;
          gap: 16px;
        }

        .login-feature-icon {
          color: var(--brand);
          margin-top: 2px;
          flex-shrink: 0;
        }

        .login-feature-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .login-feature-desc {
          font-size: 13px;
          color: var(--text-muted);
        }

        .login-stack-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .stack-badge {
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: var(--radius-md);
          background: var(--bg-overlay);
          color: var(--text-secondary);
          border: 1px solid var(--border);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .login-form-container {
          width: 500px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
          flex-shrink: 0;
          background: var(--bg-surface);
        }

        .login-card {
          width: 100%;
          max-width: 400px;
        }

        .login-card-header {
          margin-bottom: 32px;
        }

        .login-card-icon {
          margin-bottom: 16px;
          color: var(--brand);
        }

        .login-card-title {
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.5px;
          color: var(--text-primary);
          margin-bottom: 8px;
        }

        .login-card-subtitle {
          font-size: 14px;
          color: var(--text-secondary);
        }

        .login-error {
          background: var(--red-bg);
          border: 1px solid rgba(209, 50, 18, 0.2);
          border-radius: var(--radius-sm);
          padding: 12px 16px;
          font-size: 13px;
          color: var(--red);
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 24px;
          font-weight: 500;
        }

        .login-form { margin-bottom: 24px; }

        .login-submit {
          height: 44px;
          font-size: 14px;
          justify-content: center;
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .login-divider {
          text-align: center;
          position: relative;
          margin: 24px 0;
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 1px;
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
          background: var(--bg-surface);
          padding: 0 12px;
        }

        .login-demo-hint {
          text-align: center;
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 24px;
        }

        @media (max-width: 900px) {
          .login-brand { display: none; }
          .login-form-container { width: 100%; padding: 24px; }
        }
      `}</style>
    </div>
  );
}
