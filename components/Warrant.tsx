"use client";

import { useEffect, useState, type ReactNode } from "react";
import { naira } from "@/lib/domain/fees";

function useCountUp(target: number, enabled: boolean, ms = 900): number {
  const [value, setValue] = useState(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - start) / ms, 1);
      setValue(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled, ms]);
  return value;
}

interface Props {
  label: string;
  amount: number;
  foot?: ReactNode;
  stub?: [ReactNode, ReactNode];
  countUp?: boolean;
  full?: boolean;
}

/** The dividend-warrant block. The one place the brand gold carries a number. */
export function Warrant({ label, amount, foot, stub, countUp = false, full = false }: Props) {
  const shown = useCountUp(amount, countUp);
  return (
    <div className={full ? "warrant full reveal" : "warrant"}>
      <div className="label">{label}</div>
      <span className="sum" aria-label={naira(amount)}>{naira(shown)}</span>
      {foot && <div className="foot">{foot}</div>}
      {stub && <div className="stub"><span>{stub[0]}</span><span>{stub[1]}</span></div>}
    </div>
  );
}
