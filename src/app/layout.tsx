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
                  // 1. Immediately clean up bis_skin_checked injected by browser extensions (Urban VPN, form fillers, etc.)
                  function stripBis() {
                    var nodes = document.querySelectorAll('[bis_skin_checked]');
                    for (var i = 0; i < nodes.length; i++) {
                      nodes[i].removeAttribute('bis_skin_checked');
                    }
                  }
                  stripBis();

                  // 2. Active MutationObserver to immediately strip bis_skin_checked whenever an extension mutates a node
                  var observer = new MutationObserver(function(mutations) {
                    for (var i = 0; i < mutations.length; i++) {
                      var m = mutations[i];
                      if (m.type === 'attributes' && m.attributeName === 'bis_skin_checked') {
                        m.target.removeAttribute('bis_skin_checked');
                      } else if (m.type === 'childList') {
                        for (var j = 0; j < m.addedNodes.length; j++) {
                          var node = m.addedNodes[j];
                          if (node.nodeType === 1) {
                            if (node.hasAttribute('bis_skin_checked')) {
                              node.removeAttribute('bis_skin_checked');
                            }
                            var subNodes = node.querySelectorAll ? node.querySelectorAll('[bis_skin_checked]') : [];
                            for (var k = 0; k < subNodes.length; k++) {
                              subNodes[k].removeAttribute('bis_skin_checked');
                            }
                          }
                        }
                      }
                    }
                  });

                  if (document.documentElement) {
                    observer.observe(document.documentElement, {
                      attributes: true,
                      subtree: true,
                      childList: true,
                      attributeFilter: ['bis_skin_checked'],
                    });
                  }

                  // 3. Filter console.error so extension-induced bis_skin_checked warnings don't clutter the terminal/dev overlay
                  var origConsoleError = console.error;
                  console.error = function() {
                    var fullMsg = '';
                    for (var i = 0; i < arguments.length; i++) {
                      try {
                        fullMsg += ' ' + (typeof arguments[i] === 'object' ? JSON.stringify(arguments[i]) : String(arguments[i]));
                      } catch(e) {
                        fullMsg += ' ' + String(arguments[i]);
                      }
                    }
                    if (fullMsg.indexOf('bis_skin_checked') !== -1) {
                      return;
                    }
                    return origConsoleError.apply(console, arguments);
                  };

                  // 4. Intercept and isolate runtime errors originating from third-party browser extensions
                  // (e.g. chrome-extension://... executors/200.js reading 'M_ID')
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
