"use client";

import { useId } from "react";

/**
 * The Vendii mark: a solid circle with a compass needle cut out of it.
 * Gold on light backgrounds, white on blue. The cut-out shows whatever is behind it.
 */
export function LogoMark({ size = 24, color }: { size?: number; color: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <mask id={`vm-${id}`}>
          <rect width="32" height="32" fill="#fff" />
          {/* The needle: a long diamond pointing north-east, with a small hub left solid. */}
          <path d="M16 3.6 L19.1 16 L16 28.4 L12.9 16 Z" fill="#000" transform="rotate(38 16 16)" />
          <circle cx="16" cy="16" r="1.7" fill="#fff" />
        </mask>
      </defs>
      <circle cx="16" cy="16" r="15.5" fill={color} mask={`url(#vm-${id})`} />
    </svg>
  );
}

export function Logo({ height = 24, onDark = false, word = true }: { height?: number; onDark?: boolean; word?: boolean }) {
  return (
    <span className={onDark ? "logo on-dark" : "logo"} role={word ? undefined : "img"} aria-label={word ? undefined : "Vendii"}>
      <LogoMark size={height} color={onDark ? "#FFFFFF" : "#C59F56"} />
      {word && <span className="logo-word" style={{ fontSize: Math.round(height * 0.8) }}>Vendii</span>}
    </span>
  );
}
