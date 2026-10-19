# 🔥 Ember — Personal Finance OS

<p align="center">
  <img src="public/TudSa.webp" alt="Ember Finance OS Backdrop" width="100%" style="border-radius: 16px; max-height: 400px; object-fit: cover;" />
</p>

<p align="center">
  <strong>A calm, private, multi-currency personal finance OS for international freelancers, remote builders, and creators.</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#dynamic-atmosphere">Atmosphere & Presets</a> •
  <a href="#license">License</a>
</p>

---

## ✨ Overview

**Ember Finance OS** is built for individuals who earn in foreign currencies (e.g. **USD** via Payoneer, PayPal, Upwork, Stripe) and live/spend in local currencies (e.g. **BDT** via local banks, bKash, cash).

Instead of complicated spreadsheets or bloated SaaS tools, Ember combines Apple visionOS-inspired glassmorphism with an ambient living ember glow, local-first privacy, and a deterministic financial rules engine.

---

## 🚀 Key Features

### 📊 1. Overview & Dashboard
- **Consolidated Net Worth & Runway**: Real-time unified portfolio value with runway estimation based on actual monthly burn rate.
- **Cash Flow Area Chart**: Interactive 6-month income vs. expense visualizer powered by Recharts.
- **Category Donut Breakdown**: Spending distribution with proportional progress indicators and drill-down links.
- **Money Health Score Ring**: Circular 0–100 gauge assessing your savings rate, budget adherence, subscription load, and emergency reserves.

### 💳 2. Multi-Currency Ledger & Transactions
- **Unified Ledger**: Track USD income, BDT living expenses, and cross-currency transfers.
- **Instant Search & Filters**: Search across merchants, notes, and categories with tabbed transaction type filtering.
- **Quick-Entry Modal**: Press <kbd>N</kbd> anywhere in the application to immediately open the activity logger.

### 🏦 3. Accounts & Wallets
- Native support for **Payoneer**, **PayPal**, **Bank accounts (e.g., DBBL)**, **Mobile wallets (e.g., bKash)**, and **Cash**.
- Live conversions based on your configured reference exchange rate.

### 🔁 4. Subscriptions & Fixed Commitments
- Track SaaS licenses (ChatGPT Plus, GitHub Copilot, Figma), streaming services, and domain renewals.
- One-click active/paused toggling and automatic monthly subscription load calculations.

### 🎯 5. Monthly Budgets & Guardrails
- Category-level spending guardrails with color-coded meters (green, warning amber at 80%, critical crimson at 100%+).
- Prevents lifestyle creep and ensures savings targets are preserved.

### 🏁 6. Financial Goals & Milestones
- Track emergency fund runways, new hardware purchases (MacBook Pro), and personal milestones.
- Quick-contribution buttons to record incremental progress toward targets.

### 🧠 7. Ember Coach (Deterministic Rules Engine)
- **50/30/20 Savings Rule**: Evaluates whether your monthly savings rate meets or exceeds the 20% benchmark.
- **Category Spike Detection**: Flags when category spending jumps more than 30% above your 3-month rolling average.
- **Emergency Runway Meter**: Checks if available liquidity covers 3 to 6 months of living expenses.
- **Fee Drag & Conversion Analysis**: Identifies exchange fees and alerts on below-average currency conversion timing.

### 📈 8. Reports & Data Portability
- Export your complete transaction ledger as clean **CSV** for tax or accounting purposes.
- Full **JSON backup & restore** to keep your records 100% private and portable.

---

## 🎨 Dynamic Atmosphere & Background Presets

Ember includes an ambient visual engine customizable right from the **Settings** page:

| Preset | Description |
| :--- | :--- |
| **Molten Ember (TudSa)** | Custom radiant fluted flame curtain (*Default*) |
| **Tactile Roaring Fire** | Living animated flames with analog film grain & velvet vignette |
| **Subtle Obsidian Hearth** | Minimal obsidian canvas with radial ember gradient mesh |
| **Living Plasma Fire** | Procedural morphing organic fire plumes |
| **Cosmic Stardust** | Deep cosmic space with drifting stellar dust |
| **Custom Photo Upload** | Upload your own high-resolution image with automatic client-side compression |

Includes real-time controls for **Brightness**, **Soft Blur**, and a toggleable **Drifting Ember Sparks** particle canvas.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/) with Turbopack
- **Runtime**: [React 19](https://react.dev/)
- **Language**: [TypeScript 5](https://www.typescriptlang.org/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Charts**: [Recharts](https://recharts.org/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Styling**: Vanilla CSS Design System with dark glassmorphism & CSS custom properties
- **Data Persistence**: Local-First Store with SSR hydration safety & 6-month sample seed generator

---

## 📁 Project Architecture

The codebase follows a modular structure without bloated single-file components:

```
d:\Projects\Ember-Finance-OS\
├── public/
│   └── TudSa.webp                         # High-res ember backdrop image
├── src/
│   ├── app/                               # Next.js App Router routes
│   │   ├── globals.css                    # VisionOS glass styling & tokens
│   │   ├── layout.tsx                     # Root layout with shell & atmosphere
│   │   ├── page.tsx                       # Redirects to /dashboard
│   │   ├── dashboard/page.tsx             # Composed modular dashboard
│   │   ├── transactions/page.tsx          # Ledger, search & quick-entry modal
│   │   ├── accounts/page.tsx              # Multi-currency balances
│   │   ├── subscriptions/page.tsx         # Recurring services & monthly burn
│   │   ├── budgets/page.tsx               # Spending limit meters
│   │   ├── goals/page.tsx                 # Targets & progress
│   │   ├── reports/page.tsx               # Historical cash flow & CSV exports
│   │   ├── coach/page.tsx                 # Deterministic financial rules engine
│   │   └── settings/page.tsx              # Backgrounds, currency, & backups
│   ├── components/
│   │   ├── background/                    # Atmosphere switcher & particle canvas
│   │   ├── dashboard/                     # Modular KPI, charts & widget cards
│   │   ├── layout/                        # AppShell, Sidebar, Header, MobileNav
│   │   ├── settings/                      # Customizer, Currency, & Data widgets
│   │   └── ui/                            # Reusable tickers & empty states
│   ├── data/
│   │   └── seed.ts                        # 6-month realistic freelancer data
│   ├── lib/
│   │   ├── background.ts                  # Atmosphere config & event emitter
│   │   ├── finance.ts                     # Conversion math, balances & CSV
│   │   ├── rules-engine.ts                # Deterministic rules evaluator
│   │   └── store.ts                       # SSR-safe local-first store
│   └── types/
│       └── index.ts                       # Strict TypeScript interfaces
├── next.config.ts                         # Next.js configuration
├── package.json                           # Dependencies & scripts
└── tsconfig.json                          # Path aliases (@/*)
```

---

## 💻 Getting Started

### Prerequisites

- **Node.js**: `v20.17.0` or `>=22.9.0` (LTS recommended)
- **npm**: `v10+` or `v11+`

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/samir-45/Ember-Finance-OS.git
   cd Ember-Finance-OS
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the local development server**:
   ```bash
   npm run dev
   ```

4. **Open in your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000) (or `http://localhost:3001` if port 3000 is occupied).

### Building for Production

To create an optimized production build with Turbopack:

```bash
npm run build
npm run start
```

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| <kbd>N</kbd> | Open **Add Activity** modal from anywhere |

---

## 🔒 Privacy & Local-First Philosophy

- **No Remote Telemetry**: Your financial figures, balances, and notes remain strictly in your browser's local storage.
- **Safe Secrets**: Environment variables (`.env`) are strictly ignored by `.gitignore` to prevent secret leaks.
- **Full Data Ownership**: Export your data at any time in standard JSON or CSV formats.

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).
