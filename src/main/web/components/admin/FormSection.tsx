import type { ReactNode } from "react";

export function FormSection({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`console-form-section ${className}`.trim()}>
      <div className="console-form-section-heading">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      <div className="console-form-section-body">{children}</div>
    </section>
  );
}
