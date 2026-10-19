import { useState } from "react";
import { Button } from "@workspace/ember-design-system/components/ui/button";
import { Card, CardContent } from "@workspace/ember-design-system/components/ui/card";
import { Input } from "@workspace/ember-design-system/components/ui/input";
import { useFinanceData } from "../hooks/use-finance";
import { money, paired, downloadFile } from "../lib/finance";
import { EmptyState, LoadingBlocks, MetricCard, PageHeading, ProgressLine, QueryError, SectionCard } from "../components/finance-ui";
import { ArrowDownToLine, Printer } from "lucide-react";

export default function ReportsPage() {
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [year, setYear] = useState(new Date().getFullYear());
  const [currency, setCurrency] = useState<"USD" | "BDT">("USD");
  const data = useFinanceData(month, year);
  const query = period === "month" ? data.monthlyReport : data.yearlyReport;
  const report = query.data;
  if (query.isLoading) return <><PageHeading title="Reports" description="A considered view of your progress over time." /><LoadingBlocks /></>;
  if (query.isError) return <QueryError retry={() => void query.refetch()} />;
  if (!report) return <EmptyState title="Your report will appear here" description="Choose a period to explore your income, expenses and exchange costs." />;
  const csv = [
    ["Period", report.period], ["Income USD minor", report.income.usdMinor], ["Income BDT minor", report.income.bdtMinor],
    ["Expenses USD minor", report.expenses.usdMinor], ["Expenses BDT minor", report.expenses.bdtMinor],
    ["Net USD minor", report.net.usdMinor], ["Net BDT minor", report.net.bdtMinor],
    ["Subscription USD minor", report.subscriptionTotal.usdMinor], ["Subscription BDT minor", report.subscriptionTotal.bdtMinor],
    ["Average exchange rate", report.conversionSummary.averageRate],
    ...report.topCategories.flatMap((c) => [
      [`Category: ${c.categoryName} USD minor`, c.amounts.usdMinor],
      [`Category: ${c.categoryName} BDT minor`, c.amounts.bdtMinor],
    ]),
  ].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  return <div className="space-y-6">
    <PageHeading eyebrow="A wider lens" title="Reports" description="See how your money moved, whether month by month or across a full year." action={<div className="flex gap-2"><Button variant="outline" onClick={() => window.print()} data-testid="button-print-report"><Printer />Print / PDF</Button><Button onClick={() => downloadFile(csv, `ember-report-${report.period}.csv`)} data-testid="button-download-report"><ArrowDownToLine />Download CSV</Button></div>} />
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div className="flex gap-1 rounded-lg border border-border bg-muted p-1">{(["month", "year"] as const).map((item) => <Button key={item} size="sm" variant={period === item ? "secondary" : "ghost"} className="capitalize" onClick={() => setPeriod(item)} data-testid={`button-report-${item}`}>{item} view</Button>)}</div>
      <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-1" aria-label="Report currency">{(["USD", "BDT"] as const).map((unit) => <Button key={unit} size="sm" variant={currency === unit ? "secondary" : "ghost"} onClick={() => setCurrency(unit)} data-testid={`button-report-currency-${unit.toLowerCase()}`}>{unit}</Button>)}</div>
      {period === "month" ? <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-48" aria-label="Report month" data-testid="input-report-month" /> : <Input type="number" min="2000" max="2099" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-32" aria-label="Report year" data-testid="input-report-year" />}
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Income" value={paired(report.income, currency)} tone="income" /><MetricCard label="Expenses" value={paired(report.expenses, currency)} tone="expense" /><MetricCard label="Net" value={paired(report.net, currency)} hint={`${report.changePercent >= 0 ? "+" : ""}${report.changePercent.toFixed(1)}% from previous period`} /><MetricCard label="Recurring" value={paired(report.subscriptionTotal, currency)} hint="Subscription total this period" /></div>
    <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
      <SectionCard title="Income and spending over time" action={<span className="text-xs text-muted-foreground">{report.monthlySeries.length} months</span>}>
        {report.monthlySeries.length === 0 ? <EmptyState title="A little more history will help" description="Your monthly cash flow will build as you record income and expenses." /> : <div className="space-y-5">
          <div className="flex h-56 items-end gap-2 sm:gap-4">{report.monthlySeries.map((point) => {
            const income = currency === "USD" ? point.income.usdMinor : point.income.bdtMinor;
            const expense = currency === "USD" ? point.expenses.usdMinor : point.expenses.bdtMinor;
            const max = Math.max(1, ...report.monthlySeries.flatMap((p) => currency === "USD" ? [p.income.usdMinor, p.expenses.usdMinor] : [p.income.bdtMinor, p.expenses.bdtMinor]));
            return <div key={point.month} className="flex h-full flex-1 flex-col justify-end gap-2"><div className="flex h-[85%] items-end justify-center gap-1"><div title={`Income ${money(income, currency)}`} className="w-3 rounded-t bg-chart-2 sm:w-5" style={{ height: `${Math.max(3, income / max * 100)}%` }} /><div title={`Expenses ${money(expense, currency)}`} className="w-3 rounded-t bg-primary/80 sm:w-5" style={{ height: `${Math.max(3, expense / max * 100)}%` }} /></div><span className="text-center text-[10px] text-muted-foreground">{new Date(`${point.month}-01`).toLocaleDateString("en", { month: "short" })}</span></div>;
          })}</div><div className="flex gap-5 text-xs text-muted-foreground"><span className="flex items-center gap-2"><i className="size-2 rounded-full bg-chart-2" />Income</span><span className="flex items-center gap-2"><i className="size-2 rounded-full bg-primary" />Expenses</span></div>
        </div>}
      </SectionCard>
      <SectionCard title="Spending mix">
        {report.topCategories.length === 0 ? <EmptyState title="No categories yet" description="Once you record category spending, your mix will show up here." /> : <div className="space-y-4">{report.topCategories.map((category) => <div key={category.categoryId} data-testid={`report-category-${category.categoryId}`}><div className="mb-2 flex justify-between gap-3 text-sm"><span>{category.categoryName}</span><span className="ember-number text-muted-foreground">{paired(category.amounts, currency)} · {category.percentage.toFixed(0)}%</span></div><ProgressLine value={category.percentage} /></div>)}</div>}
      </SectionCard>
    </div>
    <Card><CardContent className="grid gap-5 p-5 sm:grid-cols-3 sm:p-6"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Exchange rate average</p><p className="ember-number mt-2 text-2xl font-light">{report.conversionSummary.averageRate.toFixed(2)} <span className="text-sm text-muted-foreground">BDT / USD</span></p></div><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Exchange fees</p><p className="ember-number mt-2 text-2xl font-light">{paired(report.conversionSummary.totalFees, currency)}</p></div><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Transfers recorded</p><p className="ember-number mt-2 text-2xl font-light">{report.conversionSummary.transfersCount}</p></div></CardContent></Card>
  </div>;
}
