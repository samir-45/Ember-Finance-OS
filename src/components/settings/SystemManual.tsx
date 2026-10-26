'use client';
export function SystemManual() {
  return (
    <details className="ember-glass-static settings-help">
      <summary>How Ember works</summary>
      <div className="settings-stack">
        <p>
          <strong>Where your data lives.</strong> Everything is stored in your database and saved as
          you make each change. Nothing financial is kept in the browser. Download a backup now and
          then.
        </p>
        <p>
          <strong>Income and spending.</strong> Record each payment in the currency of the account
          it touched. Moving money between your own accounts is a transfer, not spending; only its
          fee counts as an expense.
        </p>
        <p>
          <strong>Money lent out.</strong> Make an account of type “Lent out (owed to me)” for the
          person, and record lending and repayment as transfers. It counts toward your total but not
          toward money you can spend.
        </p>
        <p>
          <strong>Goals and reservations.</strong> A goal linked to an account sets aside money
          already in it. Reservations in Allocations do the same for giving and bills.
        </p>
        <p>
          <strong>Currency.</strong> Each entry keeps the exchange rate it was made with, so old
          reports don't change. Your exchange rate setting is only used for current estimates.
        </p>
        <p>
          <strong>Runway</strong> uses up to three full months of spending. Until you have a full
          month recorded, Ember says there isn't enough history yet.
        </p>
        <p>
          <strong>Shortcut:</strong> press N anywhere outside a text box to add activity.
        </p>
      </div>
    </details>
  );
}
