/* eslint-disable @next/next/no-img-element */
export function Logo({ height = 24, onDark = false, word = true }: { height?: number; onDark?: boolean; word?: boolean }) {
  return (
    <span className={onDark ? "logo on-dark" : "logo"}>
      <img src="/logo-mark.png" alt={word ? "" : "Dividendi"} style={{ height }} />
      {word && <span className="logo-word" style={{ fontSize: Math.round(height * 0.78) }}>Dividendi</span>}
    </span>
  );
}
