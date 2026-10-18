import { useState } from "react";
import { Button } from "@workspace/ember-design-system/components/ui/button";
import { Card, CardContent } from "@workspace/ember-design-system/components/ui/card";
import { Input } from "@workspace/ember-design-system/components/ui/input";
import { Switch } from "@workspace/ember-design-system/components/ui/switch";
import { useFinanceActions, useFinanceData } from "../hooks/use-finance";
import { dateLabel } from "../lib/finance";
import { EmptyState, LoadingBlocks, PageHeading, QueryError, SectionCard } from "../components/finance-ui";
import { Sparkles } from "lucide-react";
import { toast } from "@workspace/ember-design-system/hooks/use-toast";

export default function CoachPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const data = useFinanceData(month);
  const actions = useFinanceActions();
  const insights = data.insights.data ?? data.dashboard.data?.coachInsights ?? [];
  const settings = data.settings.data;
  if (data.insights.isLoading || data.settings.isLoading) return <><PageHeading title="Ember Coach" description="Helpful reflection, grounded in your own patterns." /><LoadingBlocks rows={3} /></>;
  if (data.insights.isError) return <QueryError retry={() => void data.insights.refetch()} />;
  return <div className="space-y-6">
    <PageHeading eyebrow="A thoughtful companion" title="Ember Coach" description="Rules-based observations and optional monthly reflection. Insights stay grounded in the numbers you choose to share." action={<div className="flex flex-wrap items-center gap-3"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" aria-label="Review month" data-testid="input-coach-month" /><Button onClick={() => actions.createCoachReview.mutate({ data: { month } }, { onSuccess: () => toast({ title: "Monthly reflection is ready" }), onError: () => toast({ title: "Review unavailable", description: "Check your coach privacy settings and try again." }) })} disabled={actions.createCoachReview.isPending || settings?.aiCoachEnabled === false} data-testid="button-generate-review"><Sparkles />{actions.createCoachReview.isPending ? "Reflecting…" : "Create monthly review"}</Button></div>} />
    <Card className="border-primary/15 bg-primary/[0.035]"><CardContent className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6"><div><p className="font-medium">Your coach, your choice</p><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Turn on monthly AI reflection only when it feels useful. Controls for AI and detail sharing are in Privacy settings.</p></div><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{settings?.aiCoachEnabled ? "AI review on" : "AI review off"}</span><Switch checked={settings?.aiCoachEnabled ?? false} onCheckedChange={(checked) => actions.updateSettings.mutate({ data: { aiCoachEnabled: checked } })} aria-label="Enable AI coach" data-testid="switch-coach-ai" /></div></CardContent></Card>
    <SectionCard title="Your observations" action={<span className="text-xs text-muted-foreground">{insights.length} insights</span>}>
      {insights.length === 0 ? <EmptyState title="Room for a first observation" description="As your financial picture takes shape, Ember will surface helpful patterns here—never judgment." /> :
        <div className="grid gap-3 md:grid-cols-2">{insights.map((insight) => <Card key={insight.id} className="bg-white/[0.025]" data-testid={`coach-insight-${insight.id}`}><CardContent className="p-5"><div className="mb-4 flex items-center justify-between gap-3"><span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider ${insight.kind === "warning" ? "border-primary/25 bg-primary/10 text-primary" : insight.kind === "win" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-white/10 text-muted-foreground"}`}>{insight.kind}</span><span className="text-xs text-muted-foreground">{insight.source === "ai" ? "Monthly reflection" : "Pattern insight"} · {dateLabel(insight.createdAt)}</span></div><h3 className="font-medium">{insight.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{insight.body}</p></CardContent></Card>)}</div>}
    </SectionCard>
    <SectionCard title="A note on privacy"><p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">Ember uses rules-based insights for everyday observations. Monthly AI reviews are optional and use only the details permitted in your privacy settings. Your API key is never exposed in the browser.</p></SectionCard>
  </div>;
}
