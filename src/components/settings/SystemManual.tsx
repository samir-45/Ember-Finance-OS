'use client';
export function SystemManual() {
  return (
    <details className="ember-glass settings-card">
      <summary>How your records work</summary>
      <div className="settings-stack" style={{ marginTop: 16 }}>
        <p>
          Enter client payments in the account currency. Reserve money for giving, bills, or savings
          in Allocations. Record actual USD debits and BDT receipts when converting. Internal
          transfers are not income or spending; their fees are expenses.
        </p>
        <p>
          Goals linked to accounts reserve existing money. Unlinked historical goal amounts are
          self-reported and do not count as funded reserves. Reconcile accounts against statements
          to check your records.
        </p>
        <p>
          Browser storage and JSON archives contain readable financial information. Server sync is
          optional and requires owner sign-in. Server saves preserve previous revisions and reject
          conflicting updates. External AI is optional and requires separate sharing consent.
        </p>
        <p>
          Reports translate posted entries using their saved reporting rate. Legacy entries without
          a historical rate use the rate present when imported; that estimate may differ from the
          bank's original quote. Current portfolio value uses your manual reference rate.
        </p>
        <p>
          Runway uses up to three complete calendar months of spending, includes transfer fees, and
          excludes giving, bill reserves, and funded purchase goals. Goals explicitly marked as
          emergency reserves remain available to runway. Without a complete expense month the app
          shows insufficient history. Budget pacing is an estimate for variable spending, not a
          prediction of fixed bill dates.
        </p>
        <p>
          Export regular backups and verify restore on another browser. Browser storage alone is not
          a durable backup. Press N outside an input to open activity entry.
        </p>
      </div>
    </details>
  );
}
