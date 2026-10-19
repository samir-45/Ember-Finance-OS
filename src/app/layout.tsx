import type { Metadata } from 'next';
import './globals.css';
import { FlameAtmosphere } from '@/components/background/FlameAtmosphere';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'Ember — Personal Finance OS',
  description: 'Calm, private, multi-currency personal finance OS for international freelancers and builders.',
  icons: {
    icon: '/TudSa.webp',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <div className="ember-atmosphere">
          <FlameAtmosphere />
          <AppShell>{children}</AppShell>
        </div>
      </body>
    </html>
  );
}
