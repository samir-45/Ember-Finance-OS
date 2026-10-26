'use client';
import { Check } from 'lucide-react';
import { ReactNode, useEffect, useId, useState } from 'react';

/** A titled card that groups related settings, like a section in iOS Settings. */
export function SettingsGroup({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="ember-glass-static settings-group"
      aria-labelledby={`${id}-title`}
    >
      <header className="settings-group-header">
        <h2 id={`${id}-title`}>{title}</h2>
        {description && <p>{description}</p>}
      </header>
      {children}
    </section>
  );
}

/** One setting: what it is on the left, its control on the right. */
export function SettingRow({
  title,
  description,
  htmlFor,
  children,
}: {
  title: string;
  description?: ReactNode;
  htmlFor?: string;
  children?: ReactNode;
}) {
  return (
    <div className="setting-row">
      <div className="setting-row-text">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="setting-row-title">
            {title}
          </label>
        ) : (
          <span className="setting-row-title">{title}</span>
        )}
        {description && <span className="setting-row-description">{description}</span>}
      </div>
      {children && <div className="setting-row-control">{children}</div>}
    </div>
  );
}

/** An on/off switch; it is a real checkbox, announced as a switch. */
export function Switch({
  id,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <input
      id={id}
      type="checkbox"
      role="switch"
      className="switch"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

/** Brief "Saved" confirmation next to a control. */
export function SavedHint({ show }: { show: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!show) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 1800);
    return () => clearTimeout(timer);
  }, [show]);
  return (
    <span className="saved-hint" role="status" aria-live="polite">
      {visible && (
        <>
          <Check size={14} aria-hidden="true" /> Saved
        </>
      )}
    </span>
  );
}

/**
 * A number field that saves when you leave it or press Enter, so half-typed values
 * (an empty box, "1" on the way to "15") are never saved.
 */
export function NumberSetting({
  id,
  value,
  min,
  max,
  suffix,
  onSave,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onSave: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(0);
  const errorId = useId();
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const next = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(next) || next < min || next > max) {
      setError(`Enter a number from ${min} to ${max}.`);
      return;
    }
    setError('');
    if (next === value) return;
    onSave(next);
    setSaved((n) => n + 1);
  };
  return (
    <span className="number-setting">
      <SavedHint show={saved} />
      <span className="number-setting-field">
        <input
          id={id}
          className="input"
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step="any"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
        />
        {suffix && <span className="number-setting-suffix">{suffix}</span>}
      </span>
      {error && (
        <span id={errorId} className="form-error setting-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
