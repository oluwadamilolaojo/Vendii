"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState, type ReactNode } from "react";
import { errorMessage } from "@/lib/util";

interface Props {
  label: string;
  hint: string;
  accept: string;
  icon: ReactNode;
  filledLabel?: string | null;
  preview?: string | null;
  onFile: (file: File) => Promise<void> | void;
  maxBytes?: number;
}

export function FileDrop({ label, hint, accept, icon, filledLabel, preview, onFile, maxBytes = 10 * 1024 * 1024 }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function take(file: File | undefined) {
    if (!file) return;
    if (file.size > maxBytes) {
      setError(`That file is ${(file.size / 1048576).toFixed(1)}MB. The limit is ${Math.round(maxBytes / 1048576)}MB.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onFile(file);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field">
      <span className="label">{label}</span>
      <input ref={input} type="file" accept={accept} className="visually-hidden" tabIndex={-1}
        onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ""; }} />
      <button type="button" className="dropzone" data-filled={!!filledLabel} onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void take(e.dataTransfer.files?.[0]); }}>
        <span className="thumb">{busy ? <span className="spin" /> : preview ? <img src={preview} alt="" /> : icon}</span>
        <span>
          <span className="t1">{filledLabel ?? "Choose a file or drop it here"}</span>
          <span className="t2">{hint}</span>
        </span>
      </button>
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}
