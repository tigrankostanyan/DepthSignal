import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MyScreener — Institutional L2 Order Book Screener',
  description:
    'Precision is the visual language. Intelligence, made visible. Real-time multi-exchange order book screener and liquidity wall alerts.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.png', type: 'image/png' },
    ],
    apple: '/brand/myscreener-icon-128.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} dark`} suppressHydrationWarning>
      <body className="bg-primary text-main antialiased font-sans">
        {children}
      </body>
    </html>
  );
}