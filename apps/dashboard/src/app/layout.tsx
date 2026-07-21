import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EdgeSphere — Cloud Platform',
  description: 'Self-hosted CDN, Object Storage, API Gateway, and Analytics Platform',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
