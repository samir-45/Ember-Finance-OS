import type { ReactNode } from "react";
import { Button } from "@workspace/ember-design-system/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ember-design-system/components/ui/card";
import { Skeleton } from "@workspace/ember-design-system/components/ui/skeleton";
import { Badge } from "@workspace/ember-design-system/components/ui/badge";
import { Progress } from "@workspace/ember-design-system/components/ui/progress";
import { Link } from "wouter";
import { AlertCircle, ArrowDownLeft, ArrowUpRight, Flame, Plus, RefreshCw } from "lucide-react";

export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
    <div>
      {eyebrow && <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>}
      <h1 className="text-3xl font-medium tracking-tight text-foreground sm:text-4xl">{title}</h1>
      {description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>}
    </div>
    {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
  </div>;
}

export function MetricCard({ label, value, hint, tone = "neutral" }: { label: string; value: string; hint?: string; tone?: "neutral" | "income" | "expense" }) {
  return <Card className="min-w-0">
    <CardContent className="p-5 sm:p-6">
      <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
      <p className={`ember-number mt-4 truncate text-2xl font-light tracking-tight sm:text-3xl ${tone === "income" ? "text-chart-2" : tone === "expense" ? "text-primary" : "text-foreground"}`} data-testid={`metric-${label.toLowerCase().replaceAll(" ", "-")}`}>{value}</p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </CardContent>
  </Card>;
}

export function SectionCard({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <Card className={className}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 px-5 pb-4 pt-5 sm:px-6">
      <CardTitle className="text-base font-medium">{title}</CardTitle>{action}
    </CardHeader>
    <CardContent className="px-5 pb-5 sm:px-6">{children}</CardContent>
  </Card>;
}

export function LoadingBlocks({ rows = 4 }: { rows?: number }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading your finance workspace">
    {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
  </div>;
}

export function QueryError({ retry }: { retry: () => void }) {
  return <Card className="border-destructive/30">
    <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
      <AlertCircle className="size-8 text-primary" aria-hidden="true" />
      <h2 className="text-lg font-medium">We couldn’t load this view</h2>
      <p className="max-w-md text-sm text-muted-foreground">Your finance data is private and stays yours. Check your connection, then try again.</p>
      <Button variant="outline" onClick={retry} data-testid="button-retry"><RefreshCw />Try again</Button>
    </CardContent>
  </Card>;
}

export function EmptyState({ title, description, actionLabel, onAction }: { title: string; description: string; actionLabel?: string; onAction?: () => void }) {
  return <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-12 text-center" data-testid="empty-state">
    <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Flame className="size-5" /></div>
    <h3 className="font-medium">{title}</h3><p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
    {actionLabel && onAction && <Button className="mt-5" onClick={onAction} data-testid="button-empty-action"><Plus />{actionLabel}</Button>}
  </div>;
}

export function StatusBadge({ status }: { status: string }) {
  const classes = status === "done" ? "border-chart-2/30 bg-chart-2/10 text-chart-2" : status === "pending" ? "border-primary/20 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground";
  return <Badge variant="outline" className={classes}>{status}</Badge>;
}

export function MoneyDirection({ type }: { type: string }) {
  const income = type === "income";
  return <span className={`inline-flex items-center gap-1 text-xs ${income ? "text-chart-2" : "text-primary"}`}>{income ? <ArrowDownLeft className="size-3" /> : <ArrowUpRight className="size-3" />}{type}</span>;
}

export function ProgressLine({ value, className = "" }: { value: number; className?: string }) {
  return <Progress value={Math.min(100, Math.max(0, value))} className={`h-1.5 bg-muted [&>div]:bg-primary ${className}`} />;
}

export function QuickLink({ href, children, testId }: { href: string; children: ReactNode; testId: string }) {
  return <Link href={href} className="text-sm text-muted-foreground transition-colors hover:text-foreground" data-testid={testId}>{children}</Link>;
}
