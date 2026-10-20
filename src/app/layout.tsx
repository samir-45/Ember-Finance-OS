import { FlameAtmosphere } from '@/components/background/FlameAtmosphere';
import { AppShell } from '@/components/layout/AppShell';
import { Workspace } from '@/components/layout/Workspace';
import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Ember — Personal Finance',
  description: 'Your USD earnings, local spending, giving, and savings in one workspace.',
  icons: { icon: '/TudSa.webp' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="ember-atmosphere">
          <FlameAtmosphere />
          <Workspace>
            <AppShell>{children}</AppShell>
          </Workspace>
        </div>
      </body>
    </html>
  );
}
