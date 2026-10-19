import { useEffect, useMemo, useRef, useState } from "react";
import type { Transaction, TransactionStatus, TransactionType } from "@workspace/api-client-react";
import { getListTransactionsQueryKey, useListTransactions } from "@workspace/api-client-react";
import { Button } from "@workspace/ember-design-system/components/ui/button";
import { Input } from "@workspace/ember-design-system/components/ui/input";
import { Label } from "@workspace/ember-design-system/components/ui/label";
import { Textarea } from "@workspace/ember-design-system/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ember-design-system/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ember-design-system/components/ui/select";
import { useFinanceActions, useFinanceData } from "../hooks/use-finance";
import { money, toMinor, dateLabel, downloadFile } from "../lib/finance";
import { EmptyState, LoadingBlocks, PageHeading, QueryError, StatusBadge } from "../components/finance-ui";
import { ArrowDownToLine, FileUp, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { toast } from "@workspace/ember-design-system/hooks/use-toast";

type Draft = { accountId: string; categoryId: string; type: TransactionType; amount: string; currency: "USD" | "BDT"; date: string; note: string; merchant: string; tags: string; paymentMethod: string; status: TransactionStatus };
const blankDraft = (): Draft => ({ accountId: "", categoryId: "", type: "expense", amount: "", currency: "USD", date: new Date().toISOString().slice(0, 10), note: "", merchant: "", tags: "", paymentMethod: "Bank transfer", status: "done" });

export default function TransactionsPage() {
  const { accounts, categories, exportTransactions } = useFinanceData();
  const actions = useFinanceActions();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [tag, setTag] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(blankDraft());
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [quickText, setQuickText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const filters = useMemo(() => ({
    ...(search ? { search } : {}),
    ...(status !== "all" ? { status: status as TransactionStatus } : {}),
    ...(type !== "all" ? { type: type as TransactionType } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(accountId ? { accountId } : {}),
    ...(tag ? { tag } : {}),
    ...(paymentMethod ? { paymentMethod } : {}),
    ...(dateFrom ? { from: dateFrom } : {}),
    ...(dateTo ? { to: dateTo } : {}),
    limit: 500,
  }), [search, status, type, categoryId, accountId, tag, paymentMethod, dateFrom, dateTo]);
  const transactionsQuery = useListTransactions(filters, { query: { queryKey: getListTransactionsQueryKey(filters) } });
  const rows = transactionsQuery.data ?? [];

  useEffect(() => {
    const openQuickAdd = () => openNew();
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        (event.key === "n" || event.key === "N") &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !target?.isContentEditable &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")
      ) {
        event.preventDefault();
        openNew();
      }
    };
    window.addEventListener("ember:open-quick-add", openQuickAdd);
    window.addEventListener("keydown", handleShortcut);
    return () => {
      window.removeEventListener("ember:open-quick-add", openQuickAdd);
      window.removeEventListener("keydown", handleShortcut);
    };
  }, [accounts.data]);

  useEffect(() => {
    if (accounts.isLoading) return;
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("quickAdd") !== "1") return;
    openNew();
    searchParams.delete("quickAdd");
    const query = searchParams.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`,
    );
  }, [accounts.data, accounts.isLoading]);
  function openNew() {
    setEditing(null);
    setDraft({ ...blankDraft(), accountId: accounts.data?.[0]?.id ?? "", currency: accounts.data?.[0]?.currency ?? "USD" });
    setDialogOpen(true);
  }
  function editRow(tx: Transaction) {
    setEditing(tx);
    setDraft({ accountId: tx.accountId, categoryId: tx.categoryId ?? "", type: tx.type, amount: String(tx.amountMinor / 100), currency: tx.currency, date: tx.date.slice(0, 10), note: tx.note ?? "", merchant: tx.merchant ?? "", tags: tx.tags.join(", "), paymentMethod: tx.paymentMethod, status: tx.status });
    setDialogOpen(true);
  }
  function saveDraft(event: React.FormEvent) {
    event.preventDefault();
    const data = { accountId: draft.accountId, categoryId: draft.categoryId || null, type: draft.type, amountMinor: toMinor(draft.amount), currency: draft.currency, date: draft.date, note: draft.note || null, merchant: draft.merchant || null, tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean), paymentMethod: draft.paymentMethod, status: draft.status };
    if (!data.accountId || !data.amountMinor) { toast({ title: "Add the essentials", description: "Choose an account and enter an amount." }); return; }
    if (editing) actions.updateTransaction.mutate({ id: editing.id, data }, { onSuccess: () => { toast({ title: "Activity updated" }); setDialogOpen(false); } });
    else actions.createTransaction.mutate({ data }, { onSuccess: () => { toast({ title: "Activity added" }); setDialogOpen(false); } });
  }
  async function exportCsv() {
    const result = await exportTransactions.refetch();
    if (result.data) downloadFile(result.data, "ember-transactions.csv");
  }
  async function importCsv(file?: File) {
    if (!file) return;
    const csv = await file.text();
    const firstAccount = accounts.data?.[0]?.id;
    if (!firstAccount) { toast({ title: "Add an account before importing", description: "Imported activity needs an account." }); return; }
    actions.importTransactions.mutate({ data: { csv, accountId: firstAccount } }, { onSuccess: (result) => toast({ title: `${result.imported} transactions imported`, description: result.errors.length ? result.errors.join("; ") : `${result.skipped} rows skipped.` }) });
  }
  if (transactionsQuery.isLoading) return <><PageHeading title="Transactions" description="Every incoming and outgoing moment, in one place." /><LoadingBlocks /></>;
  if (transactionsQuery.isError) return <QueryError retry={() => void transactionsQuery.refetch()} />;
  const updateStatus = (id: string, newStatus: TransactionStatus) => actions.updateTransaction.mutate({ id, data: { status: newStatus } });
  const handleDrop = (event: React.DragEvent, newStatus: TransactionStatus) => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain"); if (id) updateStatus(id, newStatus); };
  const parseText = () => {
    if (quickText.trim().length < 2) return;
    actions.parseQuickEntry.mutate({ data: { text: quickText } }, { onSuccess: (parsed) => {
      setEditing(null);
      setDraft({ ...blankDraft(), accountId: accounts.data?.[0]?.id ?? "", categoryId: parsed.categoryId ?? "", type: parsed.type, amount: String(parsed.amountMinor / 100), currency: parsed.currency, date: parsed.date.slice(0, 10), note: parsed.note, status: "planned" });
      setDialogOpen(true);
      toast({ title: "Draft ready to review", description: `${Math.round(parsed.confidence * 100)}% confidence. Check the details before saving.` });
    }, onError: () => toast({ title: "Couldn’t parse that yet", description: "Try a shorter note with amount, currency, and what it was for." }) });
  };

  return <div className="space-y-6">
    <PageHeading eyebrow="Your money in motion" title="Transactions" description="Plan what’s coming, keep an eye on what’s pending, and see what’s already done." action={
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => fileRef.current?.click()} data-testid="button-import-csv"><FileUp />Import</Button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" aria-label="Choose transaction CSV" data-testid="input-import-csv" onChange={(e) => void importCsv(e.target.files?.[0])} />
        <Button variant="outline" onClick={() => void exportCsv()} disabled={exportTransactions.isFetching} data-testid="button-export-csv"><ArrowDownToLine />Export CSV</Button>
        <Button onClick={openNew} data-testid="button-add-transaction"><Plus />Add activity <kbd className="ml-1 rounded border border-primary-foreground/30 px-1 text-[10px]">N</kbd></Button>
      </div>
    } />

    <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
      <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search merchants, notes, categories…" className="pl-9" aria-label="Search transactions" data-testid="input-search-transactions" /></div>
      <div className="flex flex-wrap gap-2">
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-32" aria-label="Filter by status" data-testid="filter-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="planned">Planned</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="done">Done</SelectItem></SelectContent></Select>
        <Select value={type} onValueChange={setType}><SelectTrigger className="w-32" aria-label="Filter by type" data-testid="filter-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All types</SelectItem><SelectItem value="income">Income</SelectItem><SelectItem value="expense">Expenses</SelectItem><SelectItem value="transfer">Transfers</SelectItem></SelectContent></Select>
        <Select value={categoryId || "all"} onValueChange={(v) => setCategoryId(v === "all" ? "" : v)}><SelectTrigger className="w-36" aria-label="Filter by category" data-testid="filter-category"><SelectValue placeholder="Category" /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{categories.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
        <Select value={accountId || "all"} onValueChange={(v) => setAccountId(v === "all" ? "" : v)}><SelectTrigger className="w-36" aria-label="Filter by account" data-testid="filter-account"><SelectValue placeholder="Account" /></SelectTrigger><SelectContent><SelectItem value="all">All accounts</SelectItem>{accounts.data?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select>
      </div>
    </div>
    <details className="rounded-xl border border-border/50 bg-card/40 p-4">
      <summary className="cursor-pointer text-sm text-muted-foreground" data-testid="summary-more-filters">More filters · date, tag and payment method</summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Input type="date" aria-label="From date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} data-testid="filter-from-date" />
        <Input type="date" aria-label="To date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} data-testid="filter-to-date" />
        <Input placeholder="Tag" aria-label="Filter by tag" value={tag} onChange={(e) => setTag(e.target.value)} data-testid="filter-tag" />
        <Input placeholder="Payment method" aria-label="Filter by payment method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} data-testid="filter-payment-method" />
      </div>
    </details>
    <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card/50 p-4 sm:flex-row">
      <div className="flex flex-1 items-center gap-3"><Sparkles className="size-4 shrink-0 text-primary" /><Input value={quickText} onChange={(e) => setQuickText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") parseText(); }} placeholder="Try “$1,200 from client work today”" aria-label="Describe a transaction in plain language" data-testid="input-quick-parse" /></div>
      <Button variant="secondary" onClick={parseText} disabled={actions.parseQuickEntry.isPending} data-testid="button-parse-quick-entry">{actions.parseQuickEntry.isPending ? "Making sense…" : "Draft with Ember"}</Button>
    </div>
    {selected.length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3"><span className="mr-2 text-sm">{selected.length} selected</span>{(["planned", "pending", "done"] as const).map((s) => <Button key={s} size="sm" variant="outline" onClick={() => actions.bulkUpdateTransactions.mutate({ data: { ids: selected, status: s } }, { onSuccess: () => setSelected([]) })} data-testid={`button-bulk-${s}`}>Mark {s}</Button>)}<Button variant="ghost" size="sm" onClick={() => setSelected([])} data-testid="button-clear-selection">Clear</Button></div>}

    {rows.length === 0 ? <EmptyState title="Nothing matches this view" description={search || status !== "all" || categoryId ? "Try widening your filters, or add activity to create a clearer picture." : "Add a transaction or import a CSV to begin seeing your USD and BDT activity together."} actionLabel="Add activity" onAction={openNew} /> :
      <div className="grid gap-4 xl:grid-cols-3">
        {(["planned", "pending", "done"] as const).map((lane) => {
          const laneRows = rows.filter((tx) => tx.status === lane);
          return <section key={lane} className="rounded-xl border border-border/50 bg-card/40 p-3" onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, lane)} data-testid={`lane-${lane}`}>
            <div className="mb-3 flex items-center justify-between px-1"><h2 className="text-sm font-medium capitalize">{lane}</h2><span className="text-xs text-muted-foreground">{laneRows.length}</span></div>
            <div className="space-y-2">{laneRows.map((tx) => <article key={tx.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", tx.id)} className="group rounded-lg border border-border/50 bg-card/70 p-3 transition hover:border-border" data-testid={`transaction-row-${tx.id}`}>
              <div className="flex items-start gap-2"><input type="checkbox" className="mt-1 accent-primary" aria-label={`Select ${tx.merchant || tx.note || "transaction"}`} checked={selected.includes(tx.id)} onChange={(e) => setSelected((old) => e.target.checked ? [...old, tx.id] : old.filter((id) => id !== tx.id))} data-testid={`checkbox-transaction-${tx.id}`} />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => editRow(tx)} data-testid={`button-edit-transaction-${tx.id}`}><p className="truncate text-sm font-medium">{tx.merchant || tx.note || tx.categoryName || "Transaction"}</p><p className="mt-1 truncate text-xs text-muted-foreground">{tx.categoryName || tx.accountName} · {tx.paymentMethod}</p></button>
                <p className={`ember-number text-sm ${tx.type === "income" ? "text-chart-2" : "text-foreground"}`}>{tx.type === "income" ? "+" : "−"}{money(tx.amountMinor, tx.currency)}</p>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 pl-6"><div className="flex items-center gap-2"><StatusBadge status={tx.status} /><span className="text-[11px] text-muted-foreground">{dateLabel(tx.date)}</span></div><div className="flex gap-1"><Select value={tx.status} onValueChange={(v) => updateStatus(tx.id, v as TransactionStatus)}><SelectTrigger className="h-7 w-28 text-[11px]" aria-label={`Change status of ${tx.merchant || tx.note || "transaction"}`} data-testid={`select-status-${tx.id}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="planned">Planned</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="done">Done</SelectItem></SelectContent></Select><Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-primary" aria-label="Delete transaction" onClick={() => actions.deleteTransaction.mutate({ id: tx.id }, { onSuccess: () => toast({ title: "Activity deleted" }) })} data-testid={`button-delete-transaction-${tx.id}`}><Trash2 className="size-3.5" /></Button></div></div>
            </article>)}
              {laneRows.length === 0 && <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">Drop an activity here to mark it {lane}.</div>}
            </div>
          </section>;
        })}
      </div>}

    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{editing ? "Edit activity" : "Add activity"}</DialogTitle><DialogDescription>Keep the real amount in its original currency. You can refine details any time.</DialogDescription></DialogHeader>
        <form onSubmit={saveDraft} className="grid gap-4 sm:grid-cols-2" data-testid="form-transaction">
          <div className="grid gap-2"><Label htmlFor="tx-type">Type</Label><Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v as TransactionType })}><SelectTrigger id="tx-type" data-testid="input-transaction-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="income">Income</SelectItem><SelectItem value="expense">Expense</SelectItem><SelectItem value="transfer">Transfer</SelectItem></SelectContent></Select></div>
          <div className="grid gap-2"><Label htmlFor="tx-amount">Amount</Label><div className="flex gap-2"><Input id="tx-amount" type="number" min="0.01" step="0.01" required value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} placeholder="0.00" data-testid="input-transaction-amount" /><Select value={draft.currency} onValueChange={(v) => setDraft({ ...draft, currency: v as "USD" | "BDT" })}><SelectTrigger className="w-24" aria-label="Currency" data-testid="input-transaction-currency"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="BDT">BDT</SelectItem></SelectContent></Select></div></div>
          <div className="grid gap-2"><Label htmlFor="tx-account">Account</Label><Select value={draft.accountId} onValueChange={(v) => setDraft({ ...draft, accountId: v, currency: accounts.data?.find((a) => a.id === v)?.currency ?? draft.currency })}><SelectTrigger id="tx-account" data-testid="input-transaction-account"><SelectValue placeholder="Choose account" /></SelectTrigger><SelectContent>{accounts.data?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} · {a.currency}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid gap-2"><Label htmlFor="tx-category">Category</Label><Select value={draft.categoryId || "none"} onValueChange={(v) => setDraft({ ...draft, categoryId: v === "none" ? "" : v })}><SelectTrigger id="tx-category" data-testid="input-transaction-category"><SelectValue placeholder="Choose category" /></SelectTrigger><SelectContent><SelectItem value="none">Uncategorized</SelectItem>{categories.data?.filter((c) => c.type === draft.type || draft.type === "transfer").map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid gap-2"><Label htmlFor="tx-date">Date</Label><Input id="tx-date" type="date" required value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} data-testid="input-transaction-date" /></div>
          <div className="grid gap-2"><Label htmlFor="tx-status">Status</Label><Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as TransactionStatus })}><SelectTrigger id="tx-status" data-testid="input-transaction-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="planned">Planned</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="done">Done</SelectItem></SelectContent></Select></div>
          <div className="grid gap-2"><Label htmlFor="tx-merchant">Merchant or client</Label><Input id="tx-merchant" value={draft.merchant} onChange={(e) => setDraft({ ...draft, merchant: e.target.value })} placeholder="e.g. Client payment" data-testid="input-transaction-merchant" /></div>
          <div className="grid gap-2"><Label htmlFor="tx-method">Payment method</Label><Input id="tx-method" value={draft.paymentMethod} onChange={(e) => setDraft({ ...draft, paymentMethod: e.target.value })} data-testid="input-transaction-method" /></div>
          <div className="grid gap-2 sm:col-span-2"><Label htmlFor="tx-note">Note</Label><Textarea id="tx-note" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="A little context for future you" data-testid="input-transaction-note" /></div>
          <div className="grid gap-2 sm:col-span-2"><Label htmlFor="tx-tags">Tags</Label><Input id="tx-tags" value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} placeholder="separate, with commas" data-testid="input-transaction-tags" /></div>
          <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} data-testid="button-cancel-transaction">Cancel</Button><Button type="submit" disabled={actions.createTransaction.isPending || actions.updateTransaction.isPending} data-testid="button-save-transaction">{editing ? "Save changes" : "Save activity"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
    <div className="sr-only" aria-live="polite">{rows.length} matching transactions</div>
  </div>;
}
