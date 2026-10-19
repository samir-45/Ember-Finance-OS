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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // 1. Prevent browser extensions (e.g. Urban VPN, Bitwarden, form-fillers) from polluting DOM with bis_skin_checked
                  var origSetAttr = Element.prototype.setAttribute;
                  Element.prototype.setAttribute = function(name, val) {
                    if (name === 'bis_skin_checked') return;
                    return origSetAttr.apply(this, arguments);
                  };

                  try {
                    Object.defineProperty(Element.prototype, 'bis_skin_checked', {
                      get: function() { return undefined; },
                      set: function() {},
                      configurable: true
                    });
                  } catch(e) {}

                  // 2. Intercept and isolate runtime errors originating from third-party browser extensions
                  // (e.g. chrome-extension://... executors/200.js reading 'M_ID') so they don't trigger Next.js dev overlays
                  window.addEventListener('error', function(event) {
                    var fn = (event && event.filename) || '';
                    var msg = (event && event.message) || '';
                    var stack = (event && event.error && event.error.stack) || '';
                    if (
                      fn.indexOf('chrome-extension://') !== -1 ||
                      fn.indexOf('moz-extension://') !== -1 ||
                      stack.indexOf('chrome-extension://') !== -1 ||
                      stack.indexOf('moz-extension://') !== -1 ||
                      msg.indexOf('M_ID') !== -1 ||
                      msg.indexOf('bis_skin_checked') !== -1
                    ) {
                      event.stopImmediatePropagation();
                      event.preventDefault();
                      return true;
                    }
                  }, true);

                  window.addEventListener('unhandledrejection', function(event) {
                    var reasonStr = (event && event.reason && (event.reason.stack || event.reason.message || String(event.reason))) || '';
                    if (
                      reasonStr.indexOf('chrome-extension://') !== -1 ||
                      reasonStr.indexOf('moz-extension://') !== -1 ||
                      reasonStr.indexOf('M_ID') !== -1
                    ) {
                      event.stopImmediatePropagation();
                      event.preventDefault();
                    }
                  }, true);
                } catch(err) {}
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <div className="ember-atmosphere" suppressHydrationWarning>
          <FlameAtmosphere />
          <AppShell>{children}</AppShell>
        </div>
      </body>
    </html>
  );
}
