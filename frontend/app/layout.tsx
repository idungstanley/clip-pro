import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ViralClip AI — Local Movie Clipping',
  description: '100% free, offline AI-powered viral clip detection and editing',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-white antialiased">
        {children}
      </body>
    </html>
  );
}
