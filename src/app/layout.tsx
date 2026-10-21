import { FlameAtmosphere } from '@/components/background/FlameAtmosphere';
import { OwnerWorkspace } from '@/components/layout/OwnerWorkspace';
import type { Metadata } from 'next';
import { Honk } from 'next/font/google';
import './globals.css';

const honk = Honk({ weight: '400', subsets: ['latin'], display: 'swap', variable: '--font-honk' });

export const metadata: Metadata = {
  title: 'Ember — Personal Finance',
  description: 'Your USD earnings, local spending, giving, and savings in one workspace.',
  icons: { icon: '/TudSa.webp' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={honk.variable}>
      <body>
        <div className="ember-atmosphere">
          <FlameAtmosphere />
          <OwnerWorkspace>{children}</OwnerWorkspace>
        </div>
      </body>
    </html>
  );
}
