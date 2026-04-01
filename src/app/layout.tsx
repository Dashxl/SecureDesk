import React from 'react';
import type { Metadata } from 'next';
import { UserProvider } from '@auth0/nextjs-auth0/client';
import './globals.css';

export const metadata: Metadata = {
  title: 'SecureDesk - Corporate AI Assistant',
  description: 'AI agent acting securely on your behalf using Auth0 Token Vault, CIBA, and FGA.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-surface-0 min-h-screen selection:bg-brand-500/30">
        <UserProvider>
          {children}
        </UserProvider>
      </body>
    </html>
  );
}
