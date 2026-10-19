import { NextResponse } from 'next/server';

interface CoachPayload {
  incomeUsd: number;
  expenseUsd: number;
  savingsRate: number;
  runwayMonths: number;
  subBurdenPercent: number;
  topCategories: Array<{ name: string; amountUsd: number; percent: number }>;
}

export async function POST(req: Request) {
  try {
    const body: CoachPayload = await req.json();
    const {
      incomeUsd = 0,
      expenseUsd = 0,
      savingsRate = 0,
      runwayMonths = 0,
      subBurdenPercent = 0,
      topCategories = [],
    } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    let aiResponse = null;

    if (apiKey && apiKey.length > 10 && !apiKey.startsWith('AIzaSyCPr0')) {
      try {
        const prompt = `You are the AI Financial Coach for Ember Finance OS, advising an international freelancer/builder earning in USD and spending locally in BDT.
Here are the anonymized financial metrics for this month:
- Monthly Income: $${incomeUsd.toFixed(0)} USD
- Monthly Expense: $${expenseUsd.toFixed(0)} USD
- Net Savings Rate: ${savingsRate.toFixed(1)}% (Target: >= 20%)
- Liquid Cash Runway: ${runwayMonths.toFixed(1)} months of living expenses (Target: 3-6 months)
- SaaS & Subscription Burden: ${subBurdenPercent.toFixed(1)}% of income (Target: < 5%)
- Top Spending Categories: ${topCategories.map(c => `${c.name}: $${c.amountUsd.toFixed(0)} (${c.percent.toFixed(0)}%)`).join(', ')}

Provide a sharp, calm, executive-grade financial diagnosis. Return ONLY a valid JSON object matching this schema:
{
  "executiveSummary": "2-3 concise sentences diagnosing current momentum, savings health, and risk factors.",
  "nextFocus": {
    "title": "Short directive title of the #1 priority (e.g. Build Runway to 6 Months)",
    "explanation": "Why this specific move matters right now",
    "impact": "Expected outcome (e.g. Shields against dry freelance quarters)"
  },
  "leakages": [
    {
      "title": "Identified cost leakage or risk",
      "details": "Concrete observation",
      "urgency": "high" or "medium" or "low"
    }
  ],
  "opportunities": [
    {
      "title": "Tactical win or capital allocation opportunity",
      "strategy": "Actionable instruction"
    }
  ],
  "status": "healthy" or "warning" or "critical"
}`;

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json' },
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (raw) {
            aiResponse = JSON.parse(raw);
          }
        }
      } catch (err) {
        console.warn('Gemini AI review failed, using deterministic advisor fallback:', err);
      }
    }

    if (!aiResponse) {
      aiResponse = generateDeterministicReview({
        incomeUsd,
        expenseUsd,
        savingsRate,
        runwayMonths,
        subBurdenPercent,
        topCategories,
      });
    }

    return NextResponse.json({ success: true, data: aiResponse });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to generate review' }, { status: 500 });
  }
}

function generateDeterministicReview({
  incomeUsd,
  expenseUsd,
  savingsRate,
  runwayMonths,
  subBurdenPercent,
  topCategories,
}: CoachPayload) {
  const isHealthy = savingsRate >= 20 && runwayMonths >= 3;
  const isCritical = runwayMonths < 1.5 || (incomeUsd > 0 && expenseUsd > incomeUsd);

  const status = isCritical ? 'critical' : isHealthy ? 'healthy' : 'warning';

  let nextFocus = {
    title: 'Reinforce Liquid Emergency Reserve',
    explanation: 'Your liquid balances provide coverage for unexpected market or freelance income swings.',
    impact: 'Protects against forced currency conversions during unfavorable FX dips.',
  };

  if (runwayMonths < 3) {
    nextFocus = {
      title: 'Expand Emergency Runway to 3 Months',
      explanation: `Current coverage is ${runwayMonths.toFixed(1)} months. Building to 90 days prevents lifestyle panic during lean billing cycles.`,
      impact: 'Secures baseline operational resilience for rent, essentials, and debt obligations.',
    };
  } else if (subBurdenPercent > 5) {
    nextFocus = {
      title: 'Trim Recurring SaaS Overhead',
      explanation: `Fixed subscriptions absorb ${subBurdenPercent.toFixed(1)}% of your monthly inflow, above the 5% safe limit.`,
      impact: 'Instantly increases monthly free cash flow without altering day-to-day comfort.',
    };
  } else if (savingsRate >= 30) {
    nextFocus = {
      title: 'Direct Surplus to Sinking Milestones',
      explanation: `With a strong ${savingsRate.toFixed(0)}% savings rate, channel excess liquidity toward designated capital goals.`,
      impact: 'Turns short-term freelance surplus into compounding multi-year assets.',
    };
  }

  const leakages = [];
  if (subBurdenPercent > 5) {
    leakages.push({
      title: 'Subscription Load Elevated',
      details: `Recurring commitments represent ${subBurdenPercent.toFixed(1)}% of revenue. Audit inactive developer tools and duplicate licenses.`,
      urgency: 'high' as const,
    });
  }
  if (topCategories.length > 0 && topCategories[0].percent > 40) {
    leakages.push({
      title: `High Category Concentration: ${topCategories[0].name}`,
      details: `${topCategories[0].name} commands ${topCategories[0].percent.toFixed(0)}% of total monthly outflow ($${topCategories[0].amountUsd.toFixed(0)}).`,
      urgency: 'medium' as const,
    });
  }
  if (savingsRate < 20 && incomeUsd > 0) {
    leakages.push({
      title: 'Savings Pace Below 20% Target',
      details: `Retained capital is currently ${savingsRate.toFixed(1)}%. Target at least 20% to build predictable runway.`,
      urgency: 'high' as const,
    });
  }

  const opportunities = [];
  if (runwayMonths >= 6) {
    opportunities.push({
      title: 'Strong 6+ Month Runway Buffer',
      strategy: 'Consider allocating incremental dollar savings into yield-bearing assets or long-term growth instruments.',
    });
  } else {
    opportunities.push({
      title: 'Implement Linear Spending Pacing',
      strategy: 'Check the Budgets page to establish daily spending envelopes for discretionary categories.',
    });
  }
  opportunities.push({
    title: 'Dual-Currency Timing Advantage',
    strategy: 'Hold USD earnings in Payoneer/Wise and execute batch conversions into BDT when exchange rates favor your local purchasing power.',
  });

  const executiveSummary = isCritical
    ? `Your current burn rate exceeds sustainable parameters, providing only ${runwayMonths.toFixed(1)} months of liquidity. Immediate curtailment of discretionary expenses is recommended to protect essential reserves.`
    : isHealthy
    ? `Strong financial velocity with a ${savingsRate.toFixed(0)}% retained savings rate and ${runwayMonths.toFixed(1)} months of runway coverage. Your cross-border freelance income is comfortably outpacing monthly outgoings.`
    : `Stable but cautious operational stance: savings rate is ${savingsRate.toFixed(0)}% with ${runwayMonths.toFixed(1)} months of coverage. Focused optimization of top spending categories will elevate you to optimal 3+ month runway.`;

  return {
    executiveSummary,
    nextFocus,
    leakages,
    opportunities,
    status,
  };
}
