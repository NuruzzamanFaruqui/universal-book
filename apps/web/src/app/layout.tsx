import type { Metadata } from 'next';
import './globals.css';
import MessagingWidget from '@/components/MessagingWidget';

export const metadata: Metadata = {
  title: 'Universal Book',
  description: 'AI-powered social publishing platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <MessagingWidget />
      </body>
    </html>
  );
}
