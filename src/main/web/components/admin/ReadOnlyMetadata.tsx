export function ReadOnlyMetadata({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <dl className="admin-metadata-grid mb-0">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
