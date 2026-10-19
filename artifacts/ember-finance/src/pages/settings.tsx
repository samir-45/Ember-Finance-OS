import { useState } from "react";
import type { Category } from "@workspace/api-client-react";
import { Button } from "@workspace/ember-design-system/components/ui/button";
import { Card, CardContent } from "@workspace/ember-design-system/components/ui/card";
import { Input } from "@workspace/ember-design-system/components/ui/input";
import { Label } from "@workspace/ember-design-system/components/ui/label";
import { Switch } from "@workspace/ember-design-system/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ember-design-system/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ember-design-system/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@workspace/ember-design-system/components/ui/alert-dialog";
import { useFinanceActions, useFinanceData } from "../hooks/use-finance";
import { downloadFile } from "../lib/finance";
import { EmptyState, LoadingBlocks, PageHeading, QueryError, SectionCard } from "../components/finance-ui";
import { Download, LockKeyhole, Plus, Trash2 } from "lucide-react";
import { toast } from "@workspace/ember-design-system/hooks/use-toast";

export default function SettingsPage() {
  const data = useFinanceData();
  const actions = useFinanceActions();
  const settings = data.settings.data;
  const categories = data.categories.data ?? [];
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryEdit, setCategoryEdit] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryType, setCategoryType] = useState<"income" | "expense">("expense");
  const [categoryColor, setCategoryColor] = useState("hsl(var(--primary))");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  if (data.settings.isLoading || data.categories.isLoading) return <><PageHeading title="Settings" description="Make Ember feel like your personal space." /><LoadingBlocks rows={3} /></>;
  if (data.settings.isError || !settings) return <QueryError retry={() => void data.settings.refetch()} />;
  const update = (field: "aiCoachEnabled" | "shareAiDetails" | "compactMode", value: boolean) => actions.updateSettings.mutate({ data: { [field]: value } }, { onSuccess: () => toast({ title: "Privacy settings updated" }), onError: () => toast({ title: "Couldn’t save that setting", description: "Please try again." }) });
  const downloadJson = async () => {
    const result = await data.exportUserData.refetch();
    if (result.data) downloadFile(JSON.stringify(result.data, null, 2), `ember-data-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
  };
  const openCategory = (category?: Category) => {
    setCategoryEdit(category ?? null);
    setCategoryName(category?.name ?? "");
    setCategoryType(category?.type ?? "expense");
    setCategoryColor(category?.color ?? "hsl(var(--primary))");
    setCategoryOpen(true);
  };
  const saveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const value = { name: categoryName, type: categoryType, color: categoryColor, icon: categoryEdit?.icon ?? "circle", parentId: categoryEdit?.parentId ?? null };
    if (categoryEdit) actions.updateCategory.mutate({ id: categoryEdit.id, data: value }, { onSuccess: () => { setCategoryOpen(false); toast({ title: "Category updated" }); } });
    else actions.createCategory.mutate({ data: value }, { onSuccess: () => { setCategoryOpen(false); toast({ title: "Category added" }); } });
  };
  const confirmDelete = () => {
    if (deleteText !== "DELETE") return;
    actions.deleteUserData.mutate({ data: { confirm: "DELETE" } }, { onSuccess: () => { toast({ title: "Your data was deleted", description: "Your finance records and settings have been cleared." }); setDeleteOpen(false); setDeleteText(""); } });
  };
  return <div className="space-y-6">
    <PageHeading eyebrow="Private by design" title="Settings" description="The currencies you think in, the privacy you choose, and your complete data." />
    <SectionCard title="Currency preferences" action={<span className="text-xs text-muted-foreground">For display, not conversion</span>}>
      <div className="grid gap-5 md:grid-cols-2">
        <div><Label className="text-sm">Base currency</Label><p className="mt-1 text-xs text-muted-foreground">The default currency for new accounts and planning.</p><Select value={settings.baseCurrency} onValueChange={(v) => actions.updateSettings.mutate({ data: { baseCurrency: v as "USD" | "BDT" } })}><SelectTrigger className="mt-3 max-w-sm" data-testid="select-base-currency"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">US dollar · USD</SelectItem><SelectItem value="BDT">Bangladeshi taka · BDT</SelectItem></SelectContent></Select></div>
        <div><Label className="text-sm">Display currency</Label><p className="mt-1 text-xs text-muted-foreground">Choose your preferred lens across dashboards and reports.</p><Select value={settings.displayCurrency} onValueChange={(v) => actions.updateSettings.mutate({ data: { displayCurrency: v as "USD" | "BDT" | "original" } })}><SelectTrigger className="mt-3 max-w-sm" data-testid="select-display-currency"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">US dollar · USD</SelectItem><SelectItem value="BDT">Bangladeshi taka · BDT</SelectItem><SelectItem value="original">Original account currency</SelectItem></SelectContent></Select></div>
      </div>
    </SectionCard>
    <SectionCard title="Privacy & insights">
      <div className="divide-y divide-white/5">
        <div className="flex items-center justify-between gap-4 py-4 first:pt-0"><div><p className="text-sm font-medium">Ember Coach monthly review</p><p className="mt-1 text-xs text-muted-foreground">Allow an optional AI-generated monthly reflection.</p></div><Switch checked={settings.aiCoachEnabled} onCheckedChange={(v) => update("aiCoachEnabled", v)} aria-label="Enable monthly AI coach review" data-testid="switch-ai-coach" /></div>
        <div className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm font-medium">Share transaction details for review</p><p className="mt-1 text-xs text-muted-foreground">Control whether details beyond totals can inform AI reflections.</p></div><Switch checked={settings.shareAiDetails} onCheckedChange={(v) => update("shareAiDetails", v)} aria-label="Share transaction details with coach review" data-testid="switch-ai-details" /></div>
        <div className="flex items-center justify-between gap-4 py-4 last:pb-0"><div><p className="text-sm font-medium">Compact activity lists</p><p className="mt-1 text-xs text-muted-foreground">Show a little more at once when reviewing activity.</p></div><Switch checked={settings.compactMode} onCheckedChange={(v) => update("compactMode", v)} aria-label="Use compact activity lists" data-testid="switch-compact-mode" /></div>
      </div>
    </SectionCard>
    <SectionCard title="Your categories" action={<Button size="sm" onClick={() => openCategory()} data-testid="button-add-category"><Plus />Add category</Button>}>
      {categories.length === 0 ? <EmptyState title="Create your own language" description="Use categories that reflect how you work and live, from client projects to everyday costs." actionLabel="Add a category" onAction={() => openCategory()} /> :
    </SectionCard>
    <SectionCard title="Export your data" action={<Download className="size-4 text-muted-foreground" />}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-sm">A complete copy, in a portable format</p><p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">Download your settings, accounts, categories, transactions, transfers, subscriptions, budgets and goals as JSON. The export comes directly from your account.</p></div><Button variant="outline" onClick={() => void downloadJson()} disabled={data.exportUserData.isFetching} data-testid="button-export-json"><Download />{data.exportUserData.isFetching ? "Preparing…" : "Download JSON"}</Button></div>
    </SectionCard>
    <Card className="border-destructive/20"><CardContent className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6"><div><div className="flex items-center gap-2"><LockKeyhole className="size-4 text-primary" /><h2 className="font-medium">Permanently delete your data</h2></div><p className="mt-2 max-w-2xl text-sm text-muted-foreground">This removes your saved finance records. Export a copy first if you might need it later. This action cannot be undone.</p></div><Button variant="destructive" onClick={() => setDeleteOpen(true)} data-testid="button-open-delete-confirmation"><Trash2 />Delete all data</Button></CardContent></Card>
    <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}><DialogContent><DialogHeader><DialogTitle>{categoryEdit ? "Edit category" : "Create a category"}</DialogTitle><DialogDescription>Choose a name and whether it describes income or spending.</DialogDescription></DialogHeader><form className="grid gap-4" onSubmit={saveCategory} data-testid="form-category"><div className="grid gap-2"><Label htmlFor="category-name">Name</Label><Input id="category-name" required value={categoryName} onChange={(e) => setCategoryName(e.target.value)} data-testid="input-category-name" /></div><div className="grid gap-2"><Label htmlFor="category-type">Type</Label><Select value={categoryType} onValueChange={(v) => setCategoryType(v as "income" | "expense")}><SelectTrigger id="category-type" data-testid="input-category-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="income">Income</SelectItem><SelectItem value="expense">Expense</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label htmlFor="category-color">Color</Label><Input id="category-color" value={categoryColor} onChange={(e) => setCategoryColor(e.target.value)} data-testid="input-category-color" /><p className="text-xs text-muted-foreground">A CSS color like hsl(var(--primary)) or #ff6a2b.</p></div><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setCategoryOpen(false)}>Cancel</Button><Button type="submit" data-testid="button-save-category">Save category</Button></div></form></DialogContent></Dialog>
    <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete your entire finance workspace?</AlertDialogTitle><AlertDialogDescription>This permanently removes all saved accounts, categories, transactions, transfers, subscriptions, budgets and goals. Type DELETE exactly to confirm.</AlertDialogDescription></AlertDialogHeader><div className="grid gap-2"><Label htmlFor="confirm-delete">Type DELETE to continue</Label><Input id="confirm-delete" value={deleteText} onChange={(e) => setDeleteText(e.target.value)} autoComplete="off" data-testid="input-confirm-delete" /></div><AlertDialogFooter><AlertDialogCancel onClick={() => { setDeleteText(""); }} data-testid="button-cancel-delete">Keep my data</AlertDialogCancel><AlertDialogAction disabled={deleteText !== "DELETE" || actions.deleteUserData.isPending} onClick={(e) => { e.preventDefault(); confirmDelete(); }} data-testid="button-confirm-delete">Permanently delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
