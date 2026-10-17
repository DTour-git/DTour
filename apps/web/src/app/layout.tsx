import type { Metadata, Viewport } from 'next';
import { Source_Serif_4 } from 'next/font/google';
import './globals.css';

const serif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'DTour — The campus, all in one place.', template: '%s · DTour' },
  description: 'News, boards, notes, societies, teams and the Lounge — for DTU students.',
};

export const viewport: Viewport = { themeColor: '#f3f2f2', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={serif.variable}>
      <body>{children}</body>
    </html>
  );
}
