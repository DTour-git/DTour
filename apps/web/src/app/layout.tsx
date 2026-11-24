import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { OPEN_GRAPH, SITE_URL } from '@/lib/seo';
import './globals.css';

// Source Serif 4, self-hosted (see fonts/README.md): the build no longer
// downloads it from Google Fonts, which failed builds at random.
const sourceSerif4 = localFont({
  src: [
    { path: './fonts/source-serif-4-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/source-serif-4-latin-400-italic.woff2', weight: '400', style: 'italic' },
    { path: './fonts/source-serif-4-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/source-serif-4-latin-600-italic.woff2', weight: '600', style: 'italic' },
  ],
  variable: '--font-serif',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'DTour — The campus, all in one place.', template: '%s · DTour' },
  description: 'News, boards, notes, societies, teams and the Lounge — for DTU students.',
  openGraph: OPEN_GRAPH,
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = { themeColor: '#f3f2f2', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sourceSerif4.variable}>
      <body>{children}</body>
    </html>
  );
}
