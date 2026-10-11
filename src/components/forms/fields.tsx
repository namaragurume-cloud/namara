import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

type FieldProps = {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  as?: "div" | "fieldset";
};

/** ラベル・必須表示・エラー表示をまとめたフォーム項目 */
export function Field({ id, label, required, error, hint, children, as = "div" }: FieldProps) {
  const labelContent = (
    <>
      {label}
      <span className={required ? "badge-required" : "badge-optional"}>{required ? "必須" : "任意"}</span>
    </>
  );
  const after = (
    <>
      {hint && (
        <p id={`${id}-hint`} className="mt-2 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-brand">
          <CircleAlert size={15} aria-hidden="true" />
          {error}
        </p>
      )}
    </>
  );

  if (as === "fieldset") {
    return (
      <fieldset aria-describedby={error ? `${id}-error` : undefined}>
        <legend className="field-label">{labelContent}</legend>
        {children}
        {after}
      </fieldset>
    );
  }
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {labelContent}
      </label>
      {children}
      {after}
    </div>
  );
}

/** aria 属性をまとめて返す */
export function aria(id: string, error?: string, hasHint?: boolean) {
  const describedBy = [error && `${id}-error`, hasHint && `${id}-hint`].filter(Boolean).join(" ");
  return {
    id,
    name: id,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": describedBy || undefined,
  };
}

/** Bot 対策のハニーポット（人には見えない） */
export function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Website
        <input type="text" name="website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}

export function Checkbox({
  name,
  value,
  error,
  children,
  defaultChecked,
}: {
  name: string;
  value?: string;
  error?: string;
  children: ReactNode;
  defaultChecked?: boolean;
}) {
  return (
    <label className="group flex min-h-11 cursor-pointer items-start gap-3 text-[15px] leading-relaxed">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        aria-invalid={error ? true : undefined}
        className="mt-1 size-5 shrink-0 cursor-pointer accent-brand"
      />
      <span>{children}</span>
    </label>
  );
}
