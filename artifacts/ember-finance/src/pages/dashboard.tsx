import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@workspace/ember-design-system/components/ui/button";
import { Card, CardContent } from "@workspace/ember-design-system/components/ui/card";
import { useFinanceData } from "../hooks/use-finance";
import { money, paired, dateLabel } from "../lib/finance";
import { EmptyState, LoadingBlocks, MetricCard, PageHeading, ProgressLine, QueryError, SectionCard, StatusBadge } from "../components/finance-ui";
import { ArrowRight, ArrowUpRight, Sparkles } from "lucide-react";

export default function DashboardPage() {
  const { dashboard: query } = useFinanceData();
  const [, setLocation] = useLocation();
  const [currency, setCurrency] = useState<"USD" | "BDT">("USD");
  const dashboard = query.data;
  useEffect(() => {
    if (dashboard?.selectedCurrency === "USD" || dashboard?.selectedCurrency === "BDT") {
      setCurrency(dashboard.selectedCurrency);
    }
  }, [dashboard?.selectedCurrency]);
  if (query.isLoading) return <><PageHeading title="Good to see you" description="Your personal finance space is getting ready." /><LoadingBlocks /></>;
  if (query.isError || !dashboard) return <QueryError retry={() => void query.refetch()} />;
  const value = (pair: typeof dashboard.netWorth) => paired(pair, currency);
  const chartMax = Math.max(1, ...dashboard.cashFlow.map((p) => Math.max(p.income[currency === "USD" ? "usdMinor" : "bdtMinor"], p.expenses[currency === "USD" ? "usdMinor" : "bdtMinor"])));
  return <div className="space-y-6">
    <PageHeading eyebrow={new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(`${dashboard.selectedMonth}-01`))} title="Your money, in focus" description="A calm overview of what came in, what went out, and what you’re building." action={
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted p-1" aria-label="Display currency">
        {(["USD", "BDT"] as const).map((unit) => <Button key={unit} variant={currency === unit ? "secondary" : "ghost"} size="sm" onClick={() => setCurrency(unit)} data-testid={`button-currency-${unit.toLowerCase()}`}>{unit}</Button>)}
      </div>
    } />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Net worth" value={value(dashboard.netWorth)} hint={`Across ${dashboard.accounts.length} accounts`} />
      <MetricCard label="Income this month" value={value(dashboard.incomeThisMonth)} tone="income" hint="Earned across your work" />
      <MetricCard label="Spent this month" value={value(dashboard.expensesThisMonth)} tone="expense" hint={`Savings rate ${dashboard.savingsRatePercent.toFixed(0)}%`} />
      <MetricCard label="Runway" value={`${dashboard.runwayMonths.toFixed(1)} months`} hint={`Financial health · ${dashboard.healthScore}/100`} />
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
      <SectionCard title="Your cash flow" action={<span className="text-xs text-muted-foreground">Last 6 months</span>}>
        {dashboard.cashFlow.length === 0 ? <EmptyState title="Your story starts here" description="When you add income and expenses, your monthly rhythm will appear here." actionLabel="Add your first transaction" onAction={() => setLocation("/transactions")} /> :
        <div className="space-y-4">
          <div className="flex h-48 items-end gap-3 sm:gap-5" role="img" aria-label="Income and expense cash flow chart">
            {dashboard.cashFlow.slice(-6).map((point) => {
              const income = point.income[currency === "USD" ? "usdMinor" : "bdtMinor"];
              const expense = point.expenses[currency === "USD" ? "usdMinor" : "bdtMinor"];
              const month = new Date(`${point.month}-01`).toLocaleDateString("en", { month: "short" });
              return <div key={point.month} className="flex h-full flex-1 flex-col justify-end gap-2">
                <div className="flex h-[82%] items-end justify-center gap-1.5">
                  <div className="w-3 rounded-t-sm bg-chart-2 transition-all sm:w-5" style={{ height: `${Math.max(3, income / chartMax * 100)}%` }} title={`${month} income ${money(income, currency)}`} />
                  <div className="w-3 rounded-t-sm bg-primary/80 transition-all sm:w-5" style={{ height: `${Math.max(3, expense / chartMax * 100)}%` }} title={`${month} spending ${money(expense, currency)}`} />
                </div><span className="text-center text-[11px] text-muted-foreground">{month}</span>
              </div>;
            })}
          </div>
          <div className="flex gap-5 border-t border-border/50 pt-3 text-xs text-muted-foreground"><span className="flex items-center gap-2"><i className="size-2 rounded-full bg-chart-2" />Income</span><span className="flex items-center gap-2"><i className="size-2 rounded-full bg-primary" />Expenses</span></div>
        </div>}
      </SectionCard>
      <SectionCard title="A note from Ember" action={<Sparkles className="size-4 text-primary" />}>
        {dashboard.coachInsights.length === 0 ? <EmptyState title="Space to reflect" description="Your patterns and useful nudges will find a home here." actionLabel="Visit your coach" onAction={() => setLocation("/coach")} /> :
          <div className="space-y-3">{dashboard.coachInsights.slice(0, 3).map((insight) => <div key={insight.id} className="rounded-lg border border-border/50 bg-card/50 p-4" data-testid={`insight-${insight.id}`}>
            <div className="mb-2 flex items-center justify-between gap-2"><span className="text-xs uppercase tracking-wider text-primary">{insight.kind}</span><span className="text-[11px] text-muted-foreground">{dateLabel(insight.createdAt)}</span></div>
            <p className="text-sm font-medium">{insight.title}</p><p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{insight.body}</p>
          </div>)}
            <Link href="/coach" className="inline-flex items-center gap-2 text-sm text-foreground hover:text-primary" data-testid="link-coach">Explore all insights <ArrowRight className="size-4" /></Link>
          </div>}
      </SectionCard>
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
      <SectionCard title="Where it went" action={<span className="text-xs text-muted-foreground">This month</span>}>
        {dashboard.categorySpending.length === 0 ? <EmptyState title="No spending patterns yet" description="Categories will come into view as you add expenses." /> :
          <div className="space-y-4">{dashboard.categorySpending.map((item) => <button key={item.categoryId} type="button" className="group w-full text-left" onClick={() => setLocation(`/transactions?categoryId=${item.categoryId}`)} data-testid={`button-category-${item.categoryId}`}>
            <div className="mb-2 flex items-center justify-between gap-3"><span className="truncate text-sm">{item.categoryName}</span><span className="ember-number text-sm text-muted-foreground">{money(item.amounts[currency === "USD" ? "usdMinor" : "bdtMinor"], currency)} <span className="ml-1 text-xs">· {item.percentage.toFixed(0)}%</span></span></div>
            <ProgressLine value={item.percentage} className="group-hover:[&>div]:brightness-125" />
          </button>)}</div>}
      </SectionCard>
      <SectionCard title="Recent activity" action={<Link href="/transactions" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" data-testid="link-all-transactions">All activity <ArrowRight className="size-3" /></Link>}>
        {dashboard.recentTransactions.length === 0 ? <EmptyState title="A fresh start" description="Your latest income and spending will show here." actionLabel="Add activity" onAction={() => setLocation("/transactions")} /> :
          <div className="divide-y divide-white/5">{dashboard.recentTransactions.slice(0, 6).map((tx) => <div key={tx.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0" data-testid={`transaction-${tx.id}`}>
            <div className="min-w-0"><div className="truncate text-sm font-medium">{tx.merchant || tx.note || tx.categoryName || "Transaction"}</div><div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><span>{tx.categoryName || tx.accountName}</span><span>·</span><span>{dateLabel(tx.date)}</span><StatusBadge status={tx.status} /></div></div>
            <div className={`ember-number whitespace-nowrap text-sm ${tx.type === "income" ? "text-chart-2" : "text-foreground"}`}>{tx.type === "income" ? "+" : "−"}{money(tx.amountMinor, tx.currency)}</div>
          </div>)}</div>}
      </SectionCard>
    </div>

    <div className="grid gap-4 lg:grid-cols-3">
      <SectionCard title="Across your accounts" action={<Link href="/accounts" className="text-xs text-muted-foreground hover:text-foreground" data-testid="link-accounts">Manage</Link>}>
        {dashboard.accounts.length === 0 ? <EmptyState title="Add your first account" description="Bring your USD and BDT balances into one clear picture." actionLabel="Set up account" onAction={() => setLocation("/accounts")} /> : <div className="space-y-3">{dashboard.accounts.slice(0, 4).map((account) => <div key={account.id} className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-3"><span className="size-2 rounded-full bg-primary" style={{ backgroundColor: account.color }} /><div className="min-w-0"><p className="truncate text-sm">{account.name}</p><p className="text-xs text-muted-foreground">{account.type}</p></div></div><p className="ember-number text-sm">{money(account.balanceMinor, account.currency)}</p></div>)}</div>}
      </SectionCard>
      <SectionCard title="Coming up" action={<Link href="/subscriptions" className="text-xs text-muted-foreground hover:text-foreground" data-testid="link-subscriptions">Subscriptions</Link>}>
        {dashboard.subscriptions.filter((item) => item.active).length === 0 ? <EmptyState title="Nothing on the calendar" description="Recurring charges will appear here before they arrive." /> : <div className="space-y-3">{dashboard.subscriptions.filter((item) => item.active).slice(0, 4).map((sub) => <div key={sub.id} className="flex items-center justify-between gap-2"><div><p className="text-sm">{sub.name}</p><p className="mt-1 text-xs text-muted-foreground">{dateLabel(sub.nextBillingDate)}</p></div><p className="ember-number text-sm">{money(sub.amountMinor, sub.currency)}</p></div>)}</div>}
      </SectionCard>
      <SectionCard title="Goals in motion" action={<Link href="/goals" className="text-xs text-muted-foreground hover:text-foreground" data-testid="link-goals">See goals</Link>}>
        {dashboard.goals.length === 0 ? <EmptyState title="Make room for a goal" description="Choose something that matters and start moving toward it." actionLabel="Create a goal" onAction={() => setLocation("/goals")} /> : <div className="space-y-4">{dashboard.goals.slice(0, 3).map((goal) => <div key={goal.id}><div className="mb-2 flex items-center justify-between gap-2"><p className="truncate text-sm">{goal.name}</p><span className="text-xs text-muted-foreground">{Math.round(goal.currentMinor / Math.max(goal.targetMinor, 1) * 100)}%</span></div><ProgressLine value={goal.currentMinor / Math.max(goal.targetMinor, 1) * 100} /><p className="mt-2 text-xs text-muted-foreground">{money(goal.currentMinor, goal.currency)} of {money(goal.targetMinor, goal.currency)}</p></div>)}</div>}
      </SectionCard>
    </div>

    <Card className="border-primary/15 bg-primary/[0.04]">
      <CardContent className="flex flex-col justify-between gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
        <div><p className="text-xs uppercase tracking-[0.16em] text-primary">Currency clarity</p><p className="mt-2 text-sm text-foreground">USD income, BDT life. Your current reference rate is <strong className="ember-number">{dashboard.conversionRate.toFixed(2)} BDT / USD</strong>.</p><p className="mt-1 text-xs text-muted-foreground">Your actual transfers and exchange fees are tracked separately.</p></div>
        <Link href="/accounts" className="inline-flex shrink-0 items-center gap-2 text-sm text-foreground hover:text-primary" data-testid="link-currency-transfers">Review transfers <ArrowUpRight className="size-4" /></Link>
      </CardContent>
    </Card>
  </div>;
}
