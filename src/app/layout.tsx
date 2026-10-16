import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'SecureMax | Self-Defending Decentralized Identity Platform',
  description: 'SIH26125 Prototype',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-[100dvh] bg-background font-sans antialiased flex flex-col">
        <div className="flex-1 flex flex-col">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
