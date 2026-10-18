import type { Currency, MoneyPair } from "@workspace/api-client-react";

export function money(minor: number, currency: Currency | string = "USD") {
  return new Intl.NumberFormat(currency === "BDT" ? "en-BD" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(minor / 100);
}

export function paired(pair?: MoneyPair, currency: "USD" | "BDT" = "USD") {
  return money(currency === "USD" ? pair?.usdMinor ?? 0 : pair?.bdtMinor ?? 0, currency);
}

export function toMinor(value: string | number) {
  return Math.round(Number(value) * 100);
}

export function dateLabel(value?: string) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

export function downloadFile(content: string, filename: string, type = "text/csv") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
