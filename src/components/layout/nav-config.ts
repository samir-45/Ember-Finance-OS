import {
  ArrowLeftRight,
  BarChart3,
  LayoutDashboard,
  PieChart,
  Repeat2,
  Settings,
  Sparkles,
  Target,
  Wallet,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/allocations', label: 'Allocations & giving', icon: Target },
  { to: '/subscriptions', label: 'Bills & subscriptions', icon: Repeat2 },
  { to: '/budgets', label: 'Budgets', icon: BarChart3 },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/reports', label: 'Reports', icon: PieChart },
  { to: '/coach', label: 'Ember Coach', icon: Sparkles },
  { to: '/settings', label: 'Settings', icon: Settings },
];
