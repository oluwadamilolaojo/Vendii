"use client";

import { useId, type HTMLAttributes } from "react";

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  type?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  autoComplete?: string;
}

export function TextField({ label, value, onChange, placeholder, hint, error, type = "text", inputMode, maxLength, autoComplete }: TextFieldProps) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id} className={error ? "input invalid" : "input"} value={value} type={type}
        onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode}
        maxLength={maxLength} autoComplete={autoComplete} aria-invalid={!!error}
        aria-describedby={error || hint ? `${id}-note` : undefined}
      />
      {error ? <div id={`${id}-note`} className="field-error">{error}</div> : hint ? <div id={`${id}-note`} className="hint">{hint}</div> : null}
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  error?: string;
}

export function SelectField({ label, value, onChange, options, placeholder, error }: SelectFieldProps) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} className={error ? "input invalid" : "input"} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}

export function Check({ checked, onToggle, children }: { checked: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} className="check" onClick={onToggle}>
      <span className="box">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M3.2 8.4l3 3 6.6-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <span className="txt">{children}</span>
    </button>
  );
}
