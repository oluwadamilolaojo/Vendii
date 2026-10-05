"use client";

import { useEffect, useRef, useState } from "react";

/** Ink is always dark navy on a light pad, whatever the page theme, because this goes on a legal document. */
const INK = "#14263B";

export function SignaturePad({ value, onChange }: { value: string | null; onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(!!value);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = cv.getBoundingClientRect();
    cv.width = Math.max(1, Math.round(rect.width * ratio));
    cv.height = Math.max(1, Math.round(rect.height * ratio));
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = value;
    }
    // Only on mount: redrawing on every change would fight the stroke in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div>
      <div className="sigwrap">
        <canvas
          ref={canvasRef}
          aria-label="Signature pad. Draw your signature with a mouse, trackpad or finger."
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            const ctx = e.currentTarget.getContext("2d");
            const p = point(e);
            ctx?.beginPath();
            ctx?.moveTo(p.x, p.y);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const ctx = e.currentTarget.getContext("2d");
            const p = point(e);
            ctx?.lineTo(p.x, p.y);
            ctx?.stroke();
          }}
          onPointerUp={(e) => {
            if (!drawing.current) return;
            drawing.current = false;
            setHasInk(true);
            onChange(e.currentTarget.toDataURL("image/png"));
          }}
        />
        <span className="sigline" />
        {!hasInk && <span className="sighint">Sign here with your mouse or trackpad</span>}
      </div>
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button type="button" className="btn quiet sm" disabled={!hasInk} onClick={() => {
          const cv = canvasRef.current;
          cv?.getContext("2d")?.clearRect(0, 0, cv.width, cv.height);
          setHasInk(false);
          onChange(null);
        }}>Clear signature</button>
      </div>
    </div>
  );
}
