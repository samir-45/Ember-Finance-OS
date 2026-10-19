import { NextResponse } from 'next/server';

interface ParseRequest {
  text: string;
  accounts?: Array<{ id: string; name: string; currency: string }>;
  categories?: Array<{ id: string; name: string; type: string }>;
}

export async function POST(req: Request) {
  try {
    const body: ParseRequest = await req.json();
    const { text, accounts = [], categories = [] } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text prompt is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    let parsedResult = null;

    // Try Gemini AI if API key is present
    if (apiKey && apiKey.length > 10 && !apiKey.startsWith('AIzaSyCPr0')) {
      try {
        const prompt = `You are a financial transaction parser. Parse this text into a JSON object: "${text}".
Available accounts: ${JSON.stringify(accounts.map(a => ({ id: a.id, name: a.name, currency: a.currency })))}
Available categories: ${JSON.stringify(categories.map(c => ({ id: c.id, name: c.name, type: c.type })))}

Return ONLY a valid JSON object with these keys:
- merchant: string (e.g. "Upwork", "Groceries", "Uber", "Figma")
- amount: number (e.g. 1200, 850)
- currency: "BDT" or "USD"
- type: "expense" or "income"
- accountId: string (matching id of best account, or empty string)
- categoryId: string (matching id of best category, or empty string)
- note: string (original text or extra detail)`;

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
          const aiData = await res.json();
          const rawText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            parsedResult = JSON.parse(rawText);
          }
        }
      } catch (err) {
        console.warn('Gemini AI parse failed, falling back to heuristic regex engine:', err);
      }
    }

    // Heuristic Fallback Engine (runs locally when offline or API key is not configured)
    if (!parsedResult) {
      parsedResult = fallbackHeuristicParse(text, accounts, categories);
    }

    return NextResponse.json({ success: true, data: parsedResult });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to parse' }, { status: 500 });
  }
}

function fallbackHeuristicParse(
  rawText: string,
  accounts: Array<{ id: string; name: string; currency: string }>,
  categories: Array<{ id: string; name: string; type: string }>
) {
  const text = rawText.toLowerCase().trim();

  // Detect Type
  let type: 'income' | 'expense' = 'expense';
  if (
    text.includes('income') ||
    text.includes('salary') ||
    text.includes('payment from') ||
    text.includes('client payment') ||
    text.includes('earned') ||
    text.includes('deposit') ||
    text.includes('received')
  ) {
    type = 'income';
  }

  // Detect Currency
  let currency: 'USD' | 'BDT' = 'BDT';
  if (text.includes('usd') || text.includes('$') || text.includes('dollar')) {
    currency = 'USD';
  } else if (text.includes('bdt') || text.includes('taka') || text.includes('৳')) {
    currency = 'BDT';
  }

  // Detect Amount
  const amountMatch = text.match(/(?:[$৳]|usd|bdt)?\s*(\d+(?:[.,]\d{1,2})?)/i);
  let amount = 0;
  if (amountMatch && amountMatch[1]) {
    amount = parseFloat(amountMatch[1].replace(',', ''));
  }

  // Detect Account
  let matchedAccountId = '';
  for (const acc of accounts) {
    if (text.includes(acc.name.toLowerCase())) {
      matchedAccountId = acc.id;
      currency = acc.currency as 'USD' | 'BDT';
      break;
    }
  }
  if (!matchedAccountId && accounts.length > 0) {
    // Pick first account matching currency
    const sameCurr = accounts.find(a => a.currency === currency);
    matchedAccountId = sameCurr ? sameCurr.id : accounts[0].id;
  }

  // Detect Category
  let matchedCategoryId = '';
  for (const cat of categories) {
    if (text.includes(cat.name.toLowerCase())) {
      matchedCategoryId = cat.id;
      type = cat.type as 'income' | 'expense';
      break;
    }
  }
  if (!matchedCategoryId) {
    // Smart keywords
    if (text.includes('grocer') || text.includes('food') || text.includes('dinner') || text.includes('restaurant') || text.includes('lunch') || text.includes('coffee')) {
      const foodCat = categories.find(c => c.name.toLowerCase().includes('food') || c.name.toLowerCase().includes('dining'));
      if (foodCat) matchedCategoryId = foodCat.id;
    } else if (text.includes('client') || text.includes('freelance') || text.includes('upwork') || text.includes('invoice')) {
      const incCat = categories.find(c => c.name.toLowerCase().includes('freelance') || c.name.toLowerCase().includes('client') || c.type === 'income');
      if (incCat) matchedCategoryId = incCat.id;
    } else if (text.includes('uber') || text.includes('ride') || text.includes('bus') || text.includes('flight')) {
      const transCat = categories.find(c => c.name.toLowerCase().includes('transport'));
      if (transCat) matchedCategoryId = transCat.id;
    } else if (text.includes('aws') || text.includes('figma') || text.includes('github') || text.includes('chatgpt') || text.includes('hosting')) {
      const sdtCat = categories.find(c => c.name.toLowerCase().includes('saas') || c.name.toLowerCase().includes('software'));
      if (sdtCat) matchedCategoryId = sdtCat.id;
    }
  }

  // Detect Merchant Name
  const cleanTokens = rawText
    .replace(/(?:[$৳]|usd|bdt)?\s*\d+(?:[.,]\d{1,2})?/gi, '')
    .replace(/\b(usd|bdt|taka|dollars?|payment|received|deposit|for|in|from|via|using|at|on)\b/gi, '')
    .trim()
    .split(/\s+/);
  
  const merchant = cleanTokens.length > 0 && cleanTokens[0]
    ? cleanTokens.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : (type === 'income' ? 'Client Payment' : 'General Expense');

  return {
    merchant: merchant || (type === 'income' ? 'Client Payment' : 'Living Expense'),
    amount: amount || 0,
    currency,
    type,
    accountId: matchedAccountId,
    categoryId: matchedCategoryId,
    note: rawText,
  };
}
