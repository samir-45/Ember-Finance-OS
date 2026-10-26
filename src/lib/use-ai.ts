'use client';
import { useEffect, useState } from 'react';

let checked: Promise<boolean> | null = null;

/** Whether the server has AI quick entry configured; asked once per page load. */
export function useAiAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    checked ??= fetch('/api/ai/parse', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { available: false }))
      .then((body) => Boolean(body.available))
      .catch(() => false);
    let live = true;
    void checked.then((value) => {
      if (live) setAvailable(value);
    });
    return () => {
      live = false;
    };
  }, []);
  return available;
}
