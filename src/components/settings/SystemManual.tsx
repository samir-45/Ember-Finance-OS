'use client';

import { useState } from 'react';
import {
  BookOpen, ChevronDown, ChevronUp, Sparkles, Shield,
  ArrowLeftRight, Repeat2, Target, BarChart3, PieChart,
  Wallet, Settings, Keyboard
} from 'lucide-react';

export function SystemManual() {
  const [openSection, setOpenSection] = useState<string | null>('philosophy');

  const toggle = (id: string) => {
    setOpenSection(prev => (prev === id ? null : id));
  };

  const sections = [
    {
      id: 'philosophy',
      title: '1. Ember Philosophy & Architecture',
      icon: Shield,
      content: (
        <div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
            <strong>Ember Finance OS</strong> is engineered specifically for remote creators, international freelancers, and software builders who earn in foreign currencies (like USD) and live/spend in local currencies (like BDT).
          </p>
          <ul style={{ paddingLeft: 18, fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li><strong>Local-First & Zero Tracking</strong>: All accounts, balances, and entries remain encrypted in your browser's local storage. No data is sent to external cloud servers.</li>
            <li><strong>Dual-Currency Parity</strong>: Automatically computes your consolidated net worth across mixed currency accounts using your reference exchange rate.</li>
            <li><strong>Deterministic Intelligence</strong>: Uses transparent mathematical rules instead of black-box heuristics to give you actionable financial nudges.</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'shortcuts',
      title: '2. Global Keyboard Shortcuts & Navigation',
      icon: Keyboard,
      content: (
        <div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
            Speed is a priority. Ember includes built-in shortcuts and responsive drawers for rapid logging.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>Quick Add Activity</span>
                <kbd style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.1)', fontSize: '0.75rem', fontWeight: 600 }}>N</kbd>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Press N anywhere to open transaction modal</p>
            </div>
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>Currency Toggle</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-accent)' }}>BDT / USD</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Toggle tab bar on Dashboard & Reports</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'modules',
      title: '3. Complete Module Guide (How to Use Each Page)',
      icon: BookOpen,
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
            <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>📊 Overview (Dashboard)</strong>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Your central command station. View net worth, 6-month cash flow trajectory, top spending categories, money health ring score (0-100), and quick account cards.
            </p>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
            <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>💳 Transactions Ledger</strong>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Filter by account, category, or type. Sort by newest, oldest, or amount. Edit or delete existing entries with instant balance updates.
            </p>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
            <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>🏦 Accounts & Wallets</strong>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Track Bank, Payoneer, PayPal, bKash, and Cash. Click <em>"Transfer / Convert"</em> to record international money movements with real-time rate and fee tracking.
            </p>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
            <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>🔁 Subscriptions</strong>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Track recurring software tools. Computes Monthly Recurring Expense (MRE) and Annual Burn (ARR). Click <em>"Record Renewal"</em> to instantly log the charge and advance the billing date.
            </p>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
            <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>🎯 Budgets & Pacing</strong>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Set monthly category spending caps. Features linear pacing algorithms that project month-end totals and calculate safe daily spend limits.
            </p>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
            <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>🏁 Goals & Sinking Funds</strong>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Target milestones for emergency funds, hardware, and travel. Calculates the required monthly pace needed to hit deadlines without financial stress.
            </p>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
            <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>📈 Reports & CSV Export</strong>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Full 50/30/20 budget framework audit, historical cash flow statements, FX conversion logs, and one-click spreadsheet export.
            </p>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
            <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>🧠 Ember Coach</strong>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Deterministic personal finance engine running 6 diagnostic algorithms: 50/30/20 checks, category spike detection, emergency runway stress tests, subscription load warnings, and fee drag checks.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'atmosphere',
      title: '4. Dynamic Backgrounds & Custom Photos',
      icon: Sparkles,
      content: (
        <div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>
            You can fully personalize the visual environment of Ember from this Settings page:
          </p>
          <ul style={{ paddingLeft: 18, fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li><strong>Curated Presets</strong>: Switch between <em>Molten Ember (TudSa.webp)</em>, <em>Tactile Roaring Fire</em>, <em>Subtle Obsidian Hearth</em>, <em>Living Plasma</em>, or <em>Cosmic Stardust</em>.</li>
            <li><strong>Custom Photo Upload</strong>: Click "Custom Photo" to select any image from your computer (.webp, .png, .jpg). It is automatically optimized and saved to your browser.</li>
            <li><strong>Fine-Tuning</strong>: Adjust the Brightness slider (50%–140%), Soft Blur (0px–20px), and toggle drifting ember sparks.</li>
            <li><strong>Reset</strong>: Click "Reset to Default" anytime to restore the radiant TudSa molten flame.</li>
          </ul>
        </div>
      ),
    },
  ];

  return (
    <div className="ember-glass" style={{ padding: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: 'rgba(255,59,31,0.15)',
            color: 'var(--color-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BookOpen size={18} />
        </span>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>
          Ember Finance OS — Complete User Guide & Manual
        </h2>
      </div>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
        Interactive documentation on system architecture, workflows, shortcuts, and financial concepts
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sections.map(s => {
          const isOpen = openSection === s.id;
          const Icon = s.icon;

          return (
            <div
              key={s.id}
              style={{
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-subtle)',
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => toggle(s.id)}
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon size={16} style={{ color: 'var(--color-accent)' }} />
                  <span>{s.title}</span>
                </div>
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {isOpen && (
                <div style={{ padding: '0 20px 20px 20px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 14 }}>
                  {s.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
