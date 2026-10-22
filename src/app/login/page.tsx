import { OwnerLogin } from '@/components/auth/OwnerLogin';
import { authConfigured } from '@/lib/server/auth';
import { passkeyConfig } from '@/lib/server/passkeys';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Sign in · Ember',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <OwnerLogin configured={authConfigured()} passkeysEnabled={passkeyConfig() !== null} />;
}
