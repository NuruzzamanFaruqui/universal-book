import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import dynamic from 'next/dynamic';

const MessagingWidget = dynamic(() => import('@/components/MessagingWidget'), { ssr: false });

export const metadata: Metadata = {
  title: 'Universal Book',
  description: 'AI-powered social publishing platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
          <MessagingWidget />
        </AuthProvider>
      </body>
    </html>
  );
}