import { useEffect, useRef, type ReactNode } from "react";
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Redirect, Route, Router as WouterRouter, Switch, useLocation } from "wouter";
import { queryClient } from "./lib/query-client";
import { AppShell } from "./components/app-shell";
import HomePage from "./pages/home";
import DashboardPage from "./pages/dashboard";
import TransactionsPage from "./pages/transactions";
import { AccountsPage, ManagementPage } from "./pages/collections";
import ReportsPage from "./pages/reports";
import CoachPage from "./pages/coach";
import SettingsPage from "./pages/settings";
import NotFoundPage from "./pages/not-found";
import { LoadingBlocks } from "./components/finance-ui";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

if (!clerkPubKey) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");

const emberAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(var(--primary))",
    colorForeground: "hsl(var(--foreground))",
    colorMutedForeground: "hsl(var(--muted-foreground))",
    colorBackground: "hsl(var(--card))",
    colorInput: "hsl(var(--background))",
    colorInputForeground: "hsl(var(--foreground))",
    colorDanger: "hsl(var(--destructive))",
    colorNeutral: "hsl(var(--border))",
    fontFamily: "Geist, Inter, sans-serif",
    borderRadius: "var(--radius)",
  },
  elements: {
    rootBox: "flex w-full justify-center",
    cardBox: "w-full max-w-md overflow-hidden rounded-xl border border-border bg-card",
    card: "!border-0 !bg-transparent !shadow-none",
    footer: "!border-0 !bg-transparent !shadow-none",
    headerTitle: "font-medium text-foreground",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "font-medium text-foreground",
    formFieldLabel: "font-medium text-foreground",
    footerActionLink: "font-medium text-primary",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground",
    identityPreviewEditButton: "text-primary",
    formFieldSuccessText: "text-chart-2",
    alertText: "text-foreground",
    logoBox: "mb-2",
    logoImage: "h-8 w-auto",
    socialButtonsBlockButton: "border border-border bg-muted/30 text-foreground",
    formButtonPrimary: "font-medium",
    formFieldInput: "border-border bg-background text-foreground",
    footerAction: "border-0",
    dividerLine: "bg-border",
    alert: "border border-border bg-card",
    otpCodeFieldInput: "border-border bg-background text-foreground",
    formFieldRow: "gap-2",
    main: "text-foreground",
  },
};

function SignInPage() {
  return <main className="ember-atmosphere dark flex min-h-[100dvh] items-center justify-center px-4 py-10"><div className="relative z-10 w-full max-w-md"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div></main>;
}

function SignUpPage() {
  return <main className="ember-atmosphere dark flex min-h-[100dvh] items-center justify-center px-4 py-10"><div className="relative z-10 w-full max-w-md"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div></main>;
}

function HomeRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <main className="ember-atmosphere dark flex min-h-[100dvh] items-center justify-center px-6"><div className="w-full max-w-3xl"><LoadingBlocks rows={2} /></div></main>;
  return isSignedIn ? <Redirect to="/dashboard" /> : <HomePage />;
}

function PrivateView({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div className="ember-atmosphere dark min-h-[100dvh] px-6 py-12"><div className="mx-auto max-w-6xl"><LoadingBlocks rows={4} /></div></div>;
  if (!isSignedIn) return <Redirect to="/" />;
  return <AppShell>{children}</AppShell>;
}

function ClerkCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const prevUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const id = user?.id ?? null;
      if (prevUserId.current !== undefined && prevUserId.current !== id) client.clear();
      prevUserId.current = id;
    });
    return unsubscribe;
  }, [addListener, client]);
  return null;
}

function Routes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={emberAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn: { start: { title: "Welcome back to Ember", subtitle: "Your money, in clearer focus." } },
      signUp: { start: { title: "Create your private space", subtitle: "A thoughtful home for your money." } },
    }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}>
      <ClerkCacheInvalidator />
      <Switch>
        <Route path="/" component={HomeRoute} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/dashboard"><PrivateView><DashboardPage /></PrivateView></Route>
        <Route path="/transactions"><PrivateView><TransactionsPage /></PrivateView></Route>
        <Route path="/accounts"><PrivateView><AccountsPage /></PrivateView></Route>
        <Route path="/subscriptions"><PrivateView><ManagementPage kind="subscriptions" /></PrivateView></Route>
        <Route path="/budgets"><PrivateView><ManagementPage kind="budgets" /></PrivateView></Route>
        <Route path="/goals"><PrivateView><ManagementPage kind="goals" /></PrivateView></Route>
        <Route path="/reports"><PrivateView><ReportsPage /></PrivateView></Route>
        <Route path="/coach"><PrivateView><CoachPage /></PrivateView></Route>
        <Route path="/settings"><PrivateView><SettingsPage /></PrivateView></Route>
        <Route component={NotFoundPage} />
      </Switch>
    </QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  return <WouterRouter base={basePath}><Routes /></WouterRouter>;
}

export default App;
