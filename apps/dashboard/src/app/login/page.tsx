'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../../store/slices/authSlice';
import api from '@/lib/api';
import { Zap, Globe, Database, Shield, Activity, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const FEATURES = [
  { icon: Globe, title: 'Global CDN', desc: 'Edge servers with high-performance caching' },
  { icon: Database, title: 'Object Storage', desc: 'S3-compatible with fine-grained access' },
  { icon: Shield, title: 'API Gateway', desc: 'Secure JWT auth, rate limiting & routing' },
  { icon: Activity, title: 'Real-time Analytics', desc: 'Deep observability and metrics' },
];

const STACK = ['NestJS', 'Go', 'Redis', 'MinIO', 'Kafka', 'Prometheus'];

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
    <div className="relative flex min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-52 -left-24 size-[600px] rounded-full bg-[radial-gradient(circle,var(--brand-glow)_0%,transparent_70%)]" />
        <div className="absolute -right-24 -bottom-36 size-[500px] rounded-full bg-[radial-gradient(circle,rgba(0,161,201,0.08)_0%,transparent_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] bg-[size:40px_40px] opacity-30" />
      </div>

      <div className="relative z-10 flex min-h-screen w-full">
        <div className="hidden flex-1 flex-col justify-center border-r border-border bg-[linear-gradient(135deg,var(--bg-elevated)_0%,transparent_60%)] p-16 lg:flex">
          <div className="flex size-12 items-center justify-center rounded-md bg-gradient-to-br from-brand to-brand-dark shadow-[var(--shadow-brand)]">
            <Zap className="size-7 fill-white text-white" />
          </div>
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-foreground">EdgeSphere</h1>
          <p className="mt-2 mb-10 text-[15px] text-muted-foreground">Enterprise-grade cloud infrastructure.</p>

          <div className="mb-10 flex flex-col gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-4">
                <f.icon className="mt-0.5 size-[18px] shrink-0 text-brand" />
                <div>
                  <div className="text-sm font-semibold text-foreground">{f.title}</div>
                  <div className="text-[13px] text-muted-foreground">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {STACK.map((t) => (
              <span
                key={t}
                className="rounded-md border border-border bg-[var(--bg-overlay)] px-2.5 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="flex w-full flex-shrink-0 items-center justify-center bg-card p-6 sm:p-10 lg:w-[500px]">
          <div className="w-full max-w-[400px]">
            <div className="mb-8">
              <Zap className="mb-4 size-7 text-brand" />
              <h2 className="mb-2 text-2xl font-bold tracking-tight text-foreground">
                {mode === 'login' ? 'Sign in to EdgeSphere' : 'Create an account'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {mode === 'login'
                  ? 'Access your unified cloud management console.'
                  : 'Start building globally distributed applications.'}
              </p>
            </div>

            {error && (
              <div className="mb-6 flex items-center gap-2.5 rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-[13px] font-medium text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mb-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={mode === 'register' ? 8 : 1}
                />
              </div>

              <Button type="submit" size="lg" disabled={loading} className={cn('mt-2 h-11 justify-center')}>
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {mode === 'login' ? 'Authenticating...' : 'Creating account...'}
                  </>
                ) : (
                  <>
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="relative my-6 text-center text-[11px] font-semibold tracking-wider text-muted-foreground">
              <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
              <span className="relative bg-card px-3">OR</span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-11 w-full"
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            >
              {mode === 'login' ? 'Create a new account' : 'Sign in to an existing account'}
            </Button>

            {mode === 'login' && (
              <p className="mt-6 text-center text-xs text-muted-foreground">
                Demo access: <code className="rounded bg-muted px-1 py-0.5 font-mono">admin@edgesphere.local</code> /{' '}
                <code className="rounded bg-muted px-1 py-0.5 font-mono">admin123</code>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
