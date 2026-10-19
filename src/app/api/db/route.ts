import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Server-side persistent storage path
const DB_DIR = path.join(process.cwd(), '.data');
const DB_FILE = path.join(DB_DIR, 'ember_vault.json');

function ensureDbExists() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

export async function GET() {
  try {
    ensureDbExists();
    if (!fs.existsSync(DB_FILE)) {
      return NextResponse.json({
        exists: false,
        message: 'No server snapshot found. Client localStorage is the primary ledger.',
        timestamp: new Date().toISOString(),
      });
    }

    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return NextResponse.json({
      exists: true,
      data,
      timestamp: data.savedAt || new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    ensureDbExists();
    const payload = await req.json();

    const snapshot = {
      ...payload,
      savedAt: new Date().toISOString(),
      version: '1.0.0',
    };

    fs.writeFileSync(DB_FILE, JSON.stringify(snapshot, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      message: 'Server vault snapshot saved successfully',
      savedAt: snapshot.savedAt,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    if (fs.existsSync(DB_FILE)) {
      fs.unlinkSync(DB_FILE);
    }
    return NextResponse.json({
      success: true,
      message: 'Server vault cleared',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
