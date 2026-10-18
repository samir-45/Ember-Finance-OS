import {
  getGetCoachInsightsQueryKey,
  getGetFinanceDashboardQueryKey,
  getGetMonthlyReportQueryKey,
  getGetSettingsQueryKey,
  getGetYearlyReportQueryKey,
  getListAccountsQueryKey,
  getListBudgetsQueryKey,
  getListCategoriesQueryKey,
  getListGoalsQueryKey,
  getListSubscriptionsQueryKey,
  getListTransactionsQueryKey,
  getListTransfersQueryKey,
  useBulkUpdateTransactions,
  useCreateAccount,
  useCreateCategory,
  useCreateCoachReview,
  useCreateGoal,
  useCreateSubscription,
  useCreateTransaction,
  useCreateTransfer,
  useDeleteAccount,
  useDeleteCategory,
  useDeleteGoal,
  useDeleteSubscription,
  useDeleteTransaction,
  useDeleteUserData,
  useExportTransactions,
  useExportUserData,
  useGetCoachInsights,
  useGetFinanceDashboard,
  useGetHealth,
  useGetMonthlyReport,
  useGetSettings,
  useGetYearlyReport,
  useImportTransactions,
  useListAccounts,
  useListBudgets,
  useListCategories,
  useListGoals,
  useListSubscriptions,
  useListTransactions,
  useListTransfers,
  useParseQuickEntry,
  useUpdateAccount,
  useUpdateCategory,
  useUpdateGoal,
  useUpdateSettings,
  useUpdateSubscription,
  useUpdateTransaction,
  useUpsertBudget,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function useFinanceData(month = new Date().toISOString().slice(0, 7), year = new Date().getFullYear()) {
  const dashboard = useGetFinanceDashboard();
  const transactions = useListTransactions();
  const accounts = useListAccounts();
  const categories = useListCategories();
  const transfers = useListTransfers();
  const subscriptions = useListSubscriptions();
  const budgets = useListBudgets({ month });
  const goals = useListGoals();
  const settings = useGetSettings();
  const insights = useGetCoachInsights();
  const monthlyReport = useGetMonthlyReport({ month });
  const yearlyReport = useGetYearlyReport({ year });
  const health = useGetHealth();
  const exportTransactions = useExportTransactions({ query: { enabled: false, queryKey: ["/api/transactions/export"] } });
  const exportUserData = useExportUserData({ query: { enabled: false, queryKey: ["/api/data/export"] } });
  return { dashboard, transactions, accounts, categories, transfers, subscriptions, budgets, goals, settings, insights, monthlyReport, yearlyReport, health, exportTransactions, exportUserData };
}

export function useFinanceActions() {
  const client = useQueryClient();
  const refreshAll = () => {
    void client.invalidateQueries({ queryKey: getGetFinanceDashboardQueryKey() });
    void client.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
    void client.invalidateQueries({ queryKey: getListAccountsQueryKey() });
    void client.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
    void client.invalidateQueries({ queryKey: getListTransfersQueryKey() });
    void client.invalidateQueries({ queryKey: getListSubscriptionsQueryKey() });
    void client.invalidateQueries({ queryKey: getListBudgetsQueryKey() });
    void client.invalidateQueries({ queryKey: getListGoalsQueryKey() });
    void client.invalidateQueries({ queryKey: getGetCoachInsightsQueryKey() });
    void client.invalidateQueries({ queryKey: getGetMonthlyReportQueryKey() });
    void client.invalidateQueries({ queryKey: getGetYearlyReportQueryKey() });
    void client.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
  };
  const mutation = { onSuccess: refreshAll };
  return {
    createTransaction: useCreateTransaction({ mutation }),
    updateTransaction: useUpdateTransaction({ mutation }),
    deleteTransaction: useDeleteTransaction({ mutation }),
    bulkUpdateTransactions: useBulkUpdateTransactions({ mutation }),
    importTransactions: useImportTransactions({ mutation }),
    createAccount: useCreateAccount({ mutation }),
    updateAccount: useUpdateAccount({ mutation }),
    deleteAccount: useDeleteAccount({ mutation }),
    createCategory: useCreateCategory({ mutation }),
    updateCategory: useUpdateCategory({ mutation }),
    deleteCategory: useDeleteCategory({ mutation }),
    createTransfer: useCreateTransfer({ mutation }),
    createSubscription: useCreateSubscription({ mutation }),
    updateSubscription: useUpdateSubscription({ mutation }),
    deleteSubscription: useDeleteSubscription({ mutation }),
    upsertBudget: useUpsertBudget({ mutation }),
    createGoal: useCreateGoal({ mutation }),
    updateGoal: useUpdateGoal({ mutation }),
    deleteGoal: useDeleteGoal({ mutation }),
    updateSettings: useUpdateSettings({ mutation }),
    deleteUserData: useDeleteUserData({ mutation }),
    createCoachReview: useCreateCoachReview({ mutation }),
    parseQuickEntry: useParseQuickEntry(),
  };
}
