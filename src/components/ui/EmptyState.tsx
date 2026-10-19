export function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 16px' }}>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{text}</p>
    </div>
  );
}
