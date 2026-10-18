import { useState } from "react";
import type { Account, Category, Goal, Subscription, Transfer } from "@workspace/api-client-react";
import { Button } from "@workspace/ember-design-system/components/ui/button";
import { Card, CardContent } from "@workspace/ember-design-system/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ember-design-system/components/ui/dialog";
import { Input } from "@workspace/ember-design-system/components/ui/input";
import { Label } from "@workspace/ember-design-system/components/ui/label";
import { ProgressLine, EmptyState, LoadingBlocks, PageHeading, QueryError, SectionCard } from "../components/finance-ui";
import { useFinanceActions, useFinanceData } from "../hooks/use-finance";
import { dateLabel, money, toMinor } from "../lib/finance";
import { ArrowLeftRight, ArrowRightLeft, CreditCard, Plus, Trash2, Pencil, Repeat2, Target, Tag } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ember-design-system/components/ui/select";
import { Textarea } from "@workspace/ember-design-system/components/ui/textarea";
import { toast } from "@workspace/ember-design-system/hooks/use-toast";

type Kind = "accounts" | "subscriptions" | "budgets" | "goals";
type FormState = Record<string, string>;
const initial = (kind: Kind): FormState => ({
  name: "", type: kind === "accounts" ? "bank" : "expense", currency: "USD", balance: "0", color: "hsl(var(--primary))",
  categoryId: "", month: new Date().toISOString().slice(0, 7), limit: "", spent: "",
  amount: "", cycle: "monthly", nextBillingDate: new Date().toISOString().slice(0, 10), active: "true", accountId: "",
  target: "", current: "0", deadline: "",
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-2"><Label>{label}</Label>{children}</div>;
}

export function AccountsPage() {
  const data = useFinanceData();
  const actions = useFinanceActions();
  const [open, setOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [edit, setEdit] = useState<Account | null>(null);
  const [form, setForm] = useState<FormState>(initial("accounts"));
  const [transfer, setTransfer] = useState({ from: "", to: "", amountOut: "", amountIn: "", rate: "", fee: "0", feeCurrency: "USD", date: new Date().toISOString().slice(0, 10) });
  const accounts = data.accounts.data ?? [];
  const transfers = data.transfers.data ?? [];
  const openAccount = (account?: Account) => { setEdit(account ?? null); setForm(account ? { ...initial("accounts"), name: account.name, type: account.type, currency: account.currency, balance: String(account.openingBalanceMinor / 100), color: account.color ?? "" } : { ...initial("accounts"), currency: accounts[0]?.currency ?? "USD" }); setOpen(true); };
  const saveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name: form.name, type: form.type, currency: form.currency as "USD" | "BDT", openingBalanceMinor: toMinor(form.balance), color: form.color };
    if (edit) actions.updateAccount.mutate({ id: edit.id, data: payload }, { onSuccess: () => { setOpen(false); toast({ title: "Account updated" }); } });
    else actions.createAccount.mutate({ data: payload }, { onSuccess: () => { setOpen(false); toast({ title: "Account added" }); } });
  };
  const saveTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    actions.createTransfer.mutate({ data: { fromAccountId: transfer.from, toAccountId: transfer.to, amountOutMinor: toMinor(transfer.amountOut), amountInMinor: toMinor(transfer.amountIn), exchangeRate: Number(transfer.rate), feeMinor: toMinor(transfer.fee), feeCurrency: transfer.feeCurrency as "USD" | "BDT", date: transfer.date } }, { onSuccess: () => { setTransferOpen(false); toast({ title: "Transfer recorded", description: "Both sides of the exchange are now in your records." }); } });
  };
  if (data.accounts.isLoading || data.transfers.isLoading) return <><PageHeading title="Accounts" description="See your balances together, across currencies." /><LoadingBlocks /></>;
  if (data.accounts.isError || data.transfers.isError) return <QueryError retry={() => { void data.accounts.refetch(); void data.transfers.refetch(); }} />;
  return <div className="space-y-7">
    <PageHeading eyebrow="The places your money lives" title="Accounts" description="Bring your USD and BDT balances into one grounded view. Record the actual amount on both sides when you exchange." action={<><Button variant="outline" onClick={() => setTransferOpen(true)} disabled={accounts.length < 2} data-testid="button-record-transfer"><ArrowLeftRight />Record transfer</Button><Button onClick={() => openAccount()} data-testid="button-add-account"><Plus />Add account</Button></>} />
    {accounts.length === 0 ? <EmptyState title="Your accounts, all in one place" description="Add your bank, wallet, or cash balance to start seeing the full picture." actionLabel="Add an account" onAction={() => openAccount()} /> :
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{accounts.map((account) => <Card key={account.id} data-testid={`account-card-${account.id}`}><CardContent className="p-5">
        <div className="mb-6 flex items-start justify-between"><div className="flex items-center gap-3"><div className="size-9 rounded-lg border border-white/10" style={{ backgroundColor: account.color || "hsl(var(--primary))" }} /><div><p className="font-medium">{account.name}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{account.type} · {account.currency}</p></div></div><div className="flex gap-1"><Button variant="ghost" size="icon" aria-label="Edit account" onClick={() => openAccount(account)} data-testid={`button-edit-account-${account.id}`}><Pencil /></Button><Button variant="ghost" size="icon" aria-label="Delete account" onClick={() => actions.deleteAccount.mutate({ id: account.id }, { onSuccess: () => toast({ title: "Account removed" }), onError: () => toast({ title: "This account is still in use", description: "Move or remove related activity before deleting it." }) })} data-testid={`button-delete-account-${account.id}`}><Trash2 /></Button></div></div>
        <p className="ember-number text-3xl font-light">{money(account.balanceMinor, account.currency)}</p><p className="mt-2 text-xs text-muted-foreground">Current balance</p>
      </CardContent></Card>)}</div>}
    <SectionCard title="Recent transfers" action={<span className="text-xs text-muted-foreground">{transfers.length} recorded</span>}>
      {transfers.length === 0 ? <EmptyState title="No exchanges recorded yet" description="Record both the amount sent and amount received, including any fee, to keep your conversion picture honest." actionLabel={accounts.length > 1 ? "Record a transfer" : undefined} onAction={accounts.length > 1 ? () => setTransferOpen(true) : undefined} /> :
        <div className="divide-y divide-white/5">{transfers.slice(0, 8).map((t: Transfer) => <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0" data-testid={`transfer-row-${t.id}`}><div><p className="text-sm font-medium">{t.fromAccountName} <span className="mx-2 text-primary">→</span> {t.toAccountName}</p><p className="mt-1 text-xs text-muted-foreground">{dateLabel(t.date)} · {money(t.feeMinor, t.feeCurrency)} fee</p></div><div className="text-right"><p className="ember-number text-sm">{money(t.amountOutMinor, t.fromCurrency)} → {money(t.amountInMinor, t.toCurrency)}</p><p className="mt-1 text-xs text-muted-foreground">Rate {t.exchangeRate.toFixed(4)}</p></div></div>)}</div>}
    </SectionCard>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{edit ? "Edit account" : "Add account"}</DialogTitle><DialogDescription>A personal account can be a bank, wallet, card, or cash balance.</DialogDescription></DialogHeader>
      <form className="grid gap-4" onSubmit={saveAccount} data-testid="form-account">
        <Field label="Account name"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Wise USD" data-testid="input-account-name" /></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Type"><Input required value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="Bank, wallet, cash…" data-testid="input-account-type" /></Field><Field label="Currency"><Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}><SelectTrigger data-testid="input-account-currency"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="BDT">BDT</SelectItem></SelectContent></Select></Field></div>
        <Field label="Opening balance"><Input required type="number" step="0.01" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} data-testid="input-account-balance" /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" data-testid="button-save-account">Save account</Button></div>
      </form>
    </DialogContent></Dialog>
    <Dialog open={transferOpen} onOpenChange={setTransferOpen}><DialogContent><DialogHeader><DialogTitle>Record a currency transfer</DialogTitle><DialogDescription>Use the amounts that actually moved, not just a quoted rate.</DialogDescription></DialogHeader>
      <form onSubmit={saveTransfer} className="grid gap-4" data-testid="form-transfer">
        <div className="grid gap-3 sm:grid-cols-2"><Field label="From account"><Select value={transfer.from} onValueChange={(v) => setTransfer({ ...transfer, from: v, feeCurrency: accounts.find((a) => a.id === v)?.currency ?? "USD" })}><SelectTrigger data-testid="input-transfer-from"><SelectValue placeholder="Choose source" /></SelectTrigger><SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} · {a.currency}</SelectItem>)}</SelectContent></Select></Field><Field label="To account"><Select value={transfer.to} onValueChange={(v) => setTransfer({ ...transfer, to: v })}><SelectTrigger data-testid="input-transfer-to"><SelectValue placeholder="Choose destination" /></SelectTrigger><SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} · {a.currency}</SelectItem>)}</SelectContent></Select></Field></div>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Amount sent"><Input required type="number" min="0.01" step="0.01" value={transfer.amountOut} onChange={(e) => setTransfer({ ...transfer, amountOut: e.target.value })} data-testid="input-transfer-out" /></Field><Field label="Amount received"><Input required type="number" min="0.01" step="0.01" value={transfer.amountIn} onChange={(e) => setTransfer({ ...transfer, amountIn: e.target.value })} data-testid="input-transfer-in" /></Field></div>
        <div className="grid gap-3 sm:grid-cols-3"><Field label="Effective rate"><Input required type="number" min="0.000001" step="0.0001" value={transfer.rate} onChange={(e) => setTransfer({ ...transfer, rate: e.target.value })} placeholder="e.g. 117.5" data-testid="input-transfer-rate" /></Field><Field label="Fee"><Input type="number" min="0" step="0.01" value={transfer.fee} onChange={(e) => setTransfer({ ...transfer, fee: e.target.value })} data-testid="input-transfer-fee" /></Field><Field label="Fee currency"><Select value={transfer.feeCurrency} onValueChange={(v) => setTransfer({ ...transfer, feeCurrency: v })}><SelectTrigger data-testid="input-transfer-fee-currency"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="BDT">BDT</SelectItem></SelectContent></Select></Field></div>
        <Field label="Date"><Input required type="date" value={transfer.date} onChange={(e) => setTransfer({ ...transfer, date: e.target.value })} data-testid="input-transfer-date" /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setTransferOpen(false)}>Cancel</Button><Button type="submit" disabled={actions.createTransfer.isPending} data-testid="button-save-transfer">Save transfer</Button></div>
      </form>
    </DialogContent></Dialog>
  </div>;
}

export function ManagementPage({ kind }: { kind: Kind }) {
  const data = useFinanceData();
  const actions = useFinanceActions();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | Subscription | Goal | null>(null);
  const [form, setForm] = useState<FormState>(initial(kind));
  const openForm = (record?: Account | Subscription | Goal) => {
    setEditing(record ?? null);
    if (!record) { setForm(initial(kind)); setOpen(true); return; }
    if (kind === "accounts") { const a = record as Account; setForm({ ...initial(kind), name: a.name, type: a.type, currency: a.currency, balance: String(a.openingBalanceMinor / 100), color: a.color ?? "" }); }
    if (kind === "subscriptions") { const s = record as Subscription; setForm({ ...initial(kind), name: s.name, amount: String(s.amountMinor / 100), currency: s.currency, cycle: s.billingCycle, nextBillingDate: s.nextBillingDate.slice(0, 10), categoryId: s.categoryId ?? "", accountId: s.accountId ?? "", active: String(s.active) }); }
    if (kind === "goals") { const g = record as Goal; setForm({ ...initial(kind), name: g.name, target: String(g.targetMinor / 100), current: String(g.currentMinor / 100), currency: g.currency, deadline: g.deadline?.slice(0, 10) ?? "" }); }
    setOpen(true);
  };
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (kind === "subscriptions") {
      const payload = { name: form.name, amountMinor: toMinor(form.amount), currency: form.currency as "USD" | "BDT", billingCycle: form.cycle as "weekly" | "monthly" | "quarterly" | "yearly", nextBillingDate: form.nextBillingDate, categoryId: form.categoryId || null, accountId: form.accountId || null, active: form.active === "true" };
      if (editing) actions.updateSubscription.mutate({ id: editing.id, data: payload }, { onSuccess: () => { setOpen(false); toast({ title: "Subscription updated" }); } });
      else actions.createSubscription.mutate({ data: payload }, { onSuccess: () => { setOpen(false); toast({ title: "Subscription added" }); } });
    }
    if (kind === "goals") {
      const payload = { name: form.name, targetMinor: toMinor(form.target), currentMinor: toMinor(form.current), currency: form.currency as "USD" | "BDT", deadline: form.deadline || null };
      if (editing) actions.updateGoal.mutate({ id: editing.id, data: payload }, { onSuccess: () => { setOpen(false); toast({ title: "Goal updated" }); } });
      else actions.createGoal.mutate({ data: payload }, { onSuccess: () => { setOpen(false); toast({ title: "Goal created" }); } });
    }
    if (kind === "budgets") {
      actions.upsertBudget.mutate({ data: { categoryId: form.categoryId, month: form.month, limitMinor: toMinor(form.limit), currency: form.currency as "USD" | "BDT" } }, { onSuccess: () => { setOpen(false); toast({ title: "Budget saved" }); } });
    }
  };
  const title = kind === "subscriptions" ? "Subscriptions" : kind === "budgets" ? "Budgets" : "Goals";
  const description = kind === "subscriptions" ? "Keep recurring costs visible, well before they renew." : kind === "budgets" ? "Gentle boundaries for the categories that matter to you." : "Make the future a little more tangible, one contribution at a time.";
  const addLabel = kind === "subscriptions" ? "Add subscription" : kind === "budgets" ? "Set a budget" : "Create a goal";
  const query = kind === "subscriptions" ? data.subscriptions : kind === "budgets" ? data.budgets : data.goals;
  const busy = query.isLoading || data.categories.isLoading;
  if (busy) return <><PageHeading title={title} description={description} /><LoadingBlocks /></>;
  if (query.isError) return <QueryError retry={() => void query.refetch()} />;
  const rows = query.data ?? [];
  return <div className="space-y-6">
    <PageHeading eyebrow="Designed around your life" title={title} description={description} action={<Button onClick={() => openForm()} data-testid={`button-add-${kind}`}><Plus />{addLabel}</Button>} />
    {kind === "budgets" && <div className="flex justify-end"><Input type="month" className="w-48" aria-label="Budget month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} data-testid="input-budget-month" /></div>}
    {rows.length === 0 ? <EmptyState title={`Nothing here yet`} description={kind === "budgets" ? "Create a monthly guide for a spending category. Budgets are created or updated per category and month." : `Add your first ${kind === "goals" ? "savings goal" : "recurring charge"} to make this space yours.`} actionLabel={addLabel} onAction={() => openForm()} /> :
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.map((row) => {
        if (kind === "subscriptions") {
          const sub = row as Subscription;
          return <Card key={sub.id} data-testid={`subscription-card-${sub.id}`}><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Repeat2 className="size-4" /></div><div className="flex gap-1"><Button variant="ghost" size="icon" aria-label={`Edit ${sub.name}`} onClick={() => openForm(sub)} data-testid={`button-edit-subscription-${sub.id}`}><Pencil /></Button><Button variant="ghost" size="icon" aria-label={`Delete ${sub.name}`} onClick={() => actions.deleteSubscription.mutate({ id: sub.id }, { onSuccess: () => toast({ title: "Subscription removed" }) })} data-testid={`button-delete-subscription-${sub.id}`}><Trash2 /></Button></div></div><p className="mt-4 font-medium">{sub.name}</p><p className="ember-number mt-1 text-xl font-light">{money(sub.amountMinor, sub.currency)} <span className="text-xs text-muted-foreground">/ {sub.billingCycle}</span></p><div className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><span>Next charge · {dateLabel(sub.nextBillingDate)}</span><Button size="sm" variant="outline" onClick={() => actions.updateSubscription.mutate({ id: sub.id, data: { active: !sub.active } })} data-testid={`button-toggle-subscription-${sub.id}`}>{sub.active ? "Active" : "Paused"}</Button></div></CardContent></Card>;
        }
        if (kind === "budgets") {
          const b = row as NonNullable<typeof data.budgets.data>[number]; const pct = b.limitMinor ? b.spentMinor / b.limitMinor * 100 : 0;
          return <Card key={b.id} data-testid={`budget-card-${b.id}`}><CardContent className="p-5"><div className="mb-4 flex items-start justify-between"><div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Tag className="size-4" /></div><Button variant="ghost" size="icon" aria-label={`Edit budget for ${b.categoryName}`} onClick={() => { setForm({ ...initial(kind), categoryId: b.categoryId, month: b.month, limit: String(b.limitMinor / 100), currency: b.currency }); setOpen(true); }} data-testid={`button-edit-budget-${b.id}`}><Pencil /></Button></div><p className="font-medium">{b.categoryName}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(`${b.month}-01`).toLocaleDateString("en", { month: "long", year: "numeric" })}</p><div className="mb-2 mt-5 flex items-center justify-between text-sm"><span className="ember-number">{money(b.spentMinor, b.currency)} spent</span><span className="text-muted-foreground">of {money(b.limitMinor, b.currency)}</span></div><ProgressLine value={pct} /><p className={`mt-2 text-xs ${pct > 100 ? "text-primary" : "text-muted-foreground"}`}>{pct > 100 ? "Over your guide" : `${Math.max(0, 100 - pct).toFixed(0)}% remaining`}</p></CardContent></Card>;
        }
        const goal = row as Goal; const pct = goal.currentMinor / Math.max(goal.targetMinor, 1) * 100;
        return <Card key={goal.id} data-testid={`goal-card-${goal.id}`}><CardContent className="p-5"><div className="flex items-start justify-between"><div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Target className="size-4" /></div><div className="flex gap-1"><Button variant="ghost" size="icon" aria-label={`Edit ${goal.name}`} onClick={() => openForm(goal)} data-testid={`button-edit-goal-${goal.id}`}><Pencil /></Button><Button variant="ghost" size="icon" aria-label={`Delete ${goal.name}`} onClick={() => actions.deleteGoal.mutate({ id: goal.id }, { onSuccess: () => toast({ title: "Goal removed" }) })} data-testid={`button-delete-goal-${goal.id}`}><Trash2 /></Button></div></div><p className="mt-4 font-medium">{goal.name}</p><p className="ember-number mt-2 text-2xl font-light">{money(goal.currentMinor, goal.currency)} <span className="text-sm text-muted-foreground">of {money(goal.targetMinor, goal.currency)}</span></p><div className="mt-4"><ProgressLine value={pct} /><p className="mt-2 text-xs text-muted-foreground">{pct.toFixed(0)}% there{goal.deadline ? ` · target ${dateLabel(goal.deadline)}` : ""}</p></div></CardContent></Card>;
      })}</div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{kind === "budgets" ? "Set a monthly budget" : editing ? `Edit ${kind === "goals" ? "goal" : "subscription"}` : addLabel}</DialogTitle><DialogDescription>Amounts are stored in the currency you choose.</DialogDescription></DialogHeader>
      <form onSubmit={save} className="grid gap-4" data-testid={`form-${kind}`}>
        {kind === "subscriptions" && <>
          <Field label="Name"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Design software" data-testid="input-subscription-name" /></Field>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Amount"><Input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} data-testid="input-subscription-amount" /></Field><Field label="Currency"><Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}><SelectTrigger data-testid="input-subscription-currency"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="BDT">BDT</SelectItem></SelectContent></Select></Field></div>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Billing cycle"><Select value={form.cycle} onValueChange={(v) => setForm({ ...form, cycle: v })}><SelectTrigger data-testid="input-subscription-cycle"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="yearly">Yearly</SelectItem></SelectContent></Select></Field><Field label="Next billing date"><Input type="date" required value={form.nextBillingDate} onChange={(e) => setForm({ ...form, nextBillingDate: e.target.value })} data-testid="input-subscription-date" /></Field></div>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Category"><Select value={form.categoryId || "none"} onValueChange={(v) => setForm({ ...form, categoryId: v === "none" ? "" : v })}><SelectTrigger data-testid="input-subscription-category"><SelectValue placeholder="No category" /></SelectTrigger><SelectContent><SelectItem value="none">No category</SelectItem>{data.categories.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Paid from"><Select value={form.accountId || "none"} onValueChange={(v) => setForm({ ...form, accountId: v === "none" ? "" : v })}><SelectTrigger data-testid="input-subscription-account"><SelectValue placeholder="No account" /></SelectTrigger><SelectContent><SelectItem value="none">No account</SelectItem>{data.accounts.data?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></Field></div>
        </>}
        {kind === "budgets" && <>
          <Field label="Category"><Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}><SelectTrigger data-testid="input-budget-category"><SelectValue placeholder="Choose expense category" /></SelectTrigger><SelectContent>{data.categories.data?.filter((c) => c.type === "expense").map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></Field>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Month"><Input type="month" required value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} data-testid="input-budget-form-month" /></Field><Field label="Limit"><Input required type="number" min="0" step="0.01" value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.value })} data-testid="input-budget-limit" /></Field></div>
          <Field label="Currency"><Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}><SelectTrigger data-testid="input-budget-currency"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="BDT">BDT</SelectItem></SelectContent></Select></Field>
        </>}
        {kind === "goals" && <>
          <Field label="What are you saving for?"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="A more spacious home" data-testid="input-goal-name" /></Field>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Target amount"><Input required type="number" min="0.01" step="0.01" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} data-testid="input-goal-target" /></Field><Field label="Already saved"><Input type="number" min="0" step="0.01" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} data-testid="input-goal-current" /></Field></div>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Currency"><Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}><SelectTrigger data-testid="input-goal-currency"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="BDT">BDT</SelectItem></SelectContent></Select></Field><Field label="Target date"><Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} data-testid="input-goal-deadline" /></Field></div>
        </>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)} data-testid={`button-cancel-${kind}`}>Cancel</Button><Button type="submit" data-testid={`button-save-${kind}`}>Save</Button></div>
      </form>
    </DialogContent></Dialog>
  </div>;
}
