import csv, re, json, subprocess
from collections import defaultdict
from boxes import detect

def page_pts(pdf):
    out = subprocess.run(["pdfinfo", pdf], capture_output=True, text=True).stdout
    m = re.search(r"Page size:\s+([\d.]+) x ([\d.]+)", out)
    return float(m.group(1)), float(m.group(2))

class Form:
    def __init__(self, name, pdf):
        self.name = name
        self.boxes, (self.W, self.H) = detect(name)
        import os
        def load(src, q):
            rows = list(csv.DictReader(open(src), delimiter="\t", quoting=csv.QUOTE_NONE))
            g = defaultdict(list)
            for r in rows:
                if r["level"] != "5" or not r["text"].strip() or float(r["conf"]) < 10: continue
                g[(r["block_num"], r["par_num"], r["line_num"])].append(
                    dict(t=r["text"], x=int(int(r["left"]) * q), y=int(int(r["top"]) * q), w=int(int(r["width"]) * q), h=int(int(r["height"]) * q)))
            return [sorted(ws, key=lambda w: w["x"]) for ws in g.values()]
        lo = load(f"ocr/{name}.tsv", 1.0)
        hi = load(f"ocr400/{name}.tsv", 0.5) if os.path.exists(f"ocr400/{name}.tsv") else []
        self.clines = hi or lo      # company names: the sharper read
        self.lines = hi + lo        # labels: whichever read caught them
        self.pw, self.ph = page_pts(pdf)
        self.k = self.pw / self.W  # px -> pt

    def find(self, pattern, nth=0, region=None):
        """Bounding box of the words matching pattern, in reading order."""
        hits = []
        for ws in self.lines:
            text, spans, pos = "", [], 0
            for w in ws:
                spans.append((len(text), len(text) + len(w["t"]), w)); text += w["t"] + " "
            text = text[:-1]
            for m in re.finditer(pattern, text, re.I):
                sel = [w for a, b, w in spans if a < m.end() and b > m.start()]
                if not sel: continue
                x = min(w["x"] for w in sel); y = min(w["y"] for w in sel)
                x2 = max(w["x"] + w["w"] for w in sel); y2 = max(w["y"] + w["h"] for w in sel)
                if region and not (region[0] <= x <= region[2] and region[1] <= y <= region[3]): continue
                hits.append((x, y, x2, y2))
        uniq = []
        for h in sorted(hits, key=lambda b: (b[1], b[0])):
            if not any(abs(h[0] - u[0]) < 14 and abs(h[1] - u[1]) < 12 for u in uniq): uniq.append(h)
        hits = sorted(uniq, key=lambda b: (round(b[1] / 15), b[0]))
        if len(hits) <= nth: raise LookupError(f"{self.name}: no match for {pattern!r}")
        return hits[nth]

    # ---------------------------------------------------------------- box geometry
    def right_of(self, lab, max_gap=260):
        x, y, x2, y2 = lab; cy = (y + y2) / 2
        c = [b for b in self.boxes if b[0] >= x2 - 12 and b[0] - x2 < max_gap and b[1] - 6 <= cy <= b[1] + b[3] + 6 and b[3] < 140]
        return min(c, key=lambda b: b[0]) if c else None

    def below(self, lab, max_gap=110, xpad=30):
        x, y, x2, y2 = lab
        c = [b for b in self.boxes if y2 - 8 <= b[1] <= y2 + max_gap and b[0] - xpad <= x <= b[0] + b[2] and b[3] < 260]
        return min(c, key=lambda b: (round((b[1] - y2) / 14), round(abs(b[0] - x) / 40), b[2] * b[3])) if c else None

    def cells_from(self, first):
        """A run of equal-height boxes starting at `first`, left to right."""
        x, y, w, h = first
        row = sorted([b for b in self.boxes if abs(b[1] - y) < 10 and abs(b[3] - h) < 10 and b[2] < 100 and b[0] >= x - 4], key=lambda b: b[0])
        out = []
        for b in row:
            if out and b[0] - (out[-1][0] + out[-1][2]) > 30: break
            if out and b[0] < out[-1][0] + out[-1][2] - 6: continue
            out.append(b)
        return out

    def containing(self, lab, min_h=0):
        x, y, x2, y2 = lab
        c = [b for b in self.boxes if b[0] - 4 <= x and b[1] - 4 <= y and b[0] + b[2] + 4 >= x2 and b[1] + b[3] + 4 >= y2 and b[3] >= min_h]
        return min(c, key=lambda b: b[2] * b[3]) if c else None

    # ---------------------------------------------------------------- output (points, top-left origin)
    def pt(self, b):
        x, y, w, h = b; k = self.k
        return {"x": round(x * k, 1), "y": round(y * k, 1), "w": round(w * k, 1), "h": round(h * k, 1)}

def text_field(key, f, box, x=None, x_end=None, pad=5):
    bx, by, bw, bh = box
    x0 = (x if x is not None else bx) + pad
    x1 = (x_end if x_end is not None else bx + bw) - pad
    return {"key": key, "kind": "text", **f.pt((x0, by, x1 - x0, bh))}

def cells_field(key, f, cells):
    return {"key": key, "kind": "cells", "cells": [f.pt(c) for c in cells]}

def resolve(f, key, spec):
    """spec: dict(label=regex, mode=auto|right|below|line|cells, nth, region, at=True for x from label, until=regex)"""
    if "box" in spec:  # explicit pixel rectangle at 200 DPI, for layouts OCR can't anchor
        if spec.get("cells"):
            x, y, w, h = spec["box"]; n = spec["cells"]; cw = w / n
            return cells_field(key, f, [(x + i * cw, y, cw, h) for i in range(n)])
        return text_field(key, f, spec["box"], pad=spec.get("pad", 5))
    region = spec.get("region")
    if spec.get("row_of"):
        r = f.find(spec["row_of"], spec.get("row_nth", 0))
        region = (r[0] - 40, r[1] - 25, r[0] + f.W * .62, r[3] + 25)
    lab = f.find(spec["label"], spec.get("nth", 0), region)
    mode = spec.get("mode", "auto")
    if mode == "line":
        x, y, x2, y2 = lab
        width = spec.get("width", 500)
        return {"key": key, "kind": "text", **f.pt((x2 + 12, y - 8, width, (y2 - y) + 16))}
    if mode == "rowbox":
        if spec.get("above"):
            row = [b for b in f.boxes if lab[1] - 90 <= b[1] + b[3] <= lab[1] + 6 and 30 < b[2] < f.W * .5 and b[3] < 120]
        else:
            row = [b for b in f.boxes if lab[3] - 6 <= b[1] <= lab[3] + 70 and 30 < b[2] < f.W * .5 and b[3] < 120]
        row = sorted([b for b in row if b[0] >= lab[0] - 60 and b[0] < lab[0] + f.W * .6], key=lambda b: b[0])
        if len(row) <= spec.get("index", 0): raise LookupError(f"{f.name}: no row box for {key}")
        return text_field(key, f, row[spec.get("index", 0)])
    box, path = None, None
    if mode in ("auto", "right", "cells"):
        box, path = f.right_of(lab), "right"
    if box is None and mode in ("auto", "below", "cells"):
        box, path = f.below(lab, spec.get("gap", 110)), "below"
    if box is None: raise LookupError(f"{f.name}: no box for {key}")
    if box[2] < 100:
        cells = f.cells_from(box)
        if spec.get("until_cells"):  # two fields sharing one row of cells
            stop = f.find(spec["until_cells"])[0]
            cells = [c for c in cells if c[0] + c[2] <= stop + 8]
        if len(cells) >= 4: return cells_field(key, f, cells[spec.get("skip_cells", 0):])
    cy = (lab[1] + lab[3]) / 2
    def on_row(b):  # the cells must sit on the label's own row (right) or directly under it (below)
        return (b[1] - 8 <= cy <= b[1] + b[3] + 8) if path == "right" else (lab[3] - 10 <= b[1] <= lab[3] + 70)
    inner = sorted([b for b in f.boxes if b != box and b[2] < 100 and b[0] >= box[0] - 4 and b[1] >= box[1] - 4
                    and b[0] + b[2] <= box[0] + box[2] + 4 and b[1] + b[3] <= box[1] + box[3] + 4 and b[3] >= 20 and on_row(b)],
                   key=lambda b: (b[1] // 15, b[0]))
    if len(inner) >= 4:
        cells = f.cells_from(inner[0])
        if len(cells) >= 4: return cells_field(key, f, cells[spec.get("skip_cells", 0):])
    if spec.get("at"):
        x_end = None
        if spec.get("until"):
            nxt = f.find(spec["until"], 0, (lab[2], lab[1] - 25, f.W, lab[3] + 25))
            x_end = nxt[0] - 10
        return text_field(key, f, box, x=max(box[0], lab[0] - 6), x_end=x_end)
    return text_field(key, f, box)

def companies(f, header=r"Name of Company|NAMES? OF COMPANY|Company Name|^Company$|CLIENTELE", tick_header=r"\bTICK\b", region=None,
              stop=None, numbered=False, tick_mode="column", tick_dx=0, header_nth=0, min_len=3, skip=(), strip_num=False, tick_pos=.5):
    """Returns [{name, tick:{x,y,s}}]. tick_mode: column (use Tick header x), left (left of name), right (after name)."""
    if region is None:
        hx, hy, hx2, hy2 = f.find(header, header_nth)
        hbox = f.containing((hx, hy, hx2, hy2))
        x1 = hbox[0] - 4 if hbox and hbox[2] < f.W * .5 else hx - 25
        x2 = (hbox[0] + hbox[2]) if hbox and hbox[2] < f.W * .5 else hx + 520
        y1 = (hbox[1] + hbox[3]) if hbox and hbox[3] < 150 else hy2 + 4
        y2 = f.H * .985
        if stop:
            try: y2 = f.find(stop, 0, (0, y1, f.W, f.H))[1] - 4
            except LookupError: pass
        region = (x1, y1, x2, y2)
    x1, y1, x2, y2 = region
    tick_x = None
    if tick_mode == "column":
        hits = []
        for i in range(8):
            try: hits.append(f.find(tick_header, i, (0, max(0, y1 - 220), f.W, y1 + 40)))
            except LookupError: break
        # the real column header is a short word on its own, nearest the first company row
        hits = [h for h in hits if h[2] - h[0] < 160] or hits
        if not hits: raise LookupError(f"{f.name}: no tick column")
        tx, ty, tx2, ty2 = max(hits, key=lambda h: h[1])
        tb = f.containing((tx, ty, tx2, ty2))
        tick_x = (tb[0] + tb[2] / 2) if tb and tb[2] < 200 else (tx + tx2) / 2
        col_w = tb[2] if tb and tb[2] < 200 else (tx2 - tx) + 10
    # words inside the region, grouped into lines
    rows = []
    for ws in f.clines:
        sel = [w for w in ws if x1 <= w["x"] and w["x"] + w["w"] <= x2 + 10 and y1 <= w["y"] and w["y"] + w["h"] <= y2]
        if not sel: continue
        t = " ".join(w["t"] for w in sel).strip(" |_.:;,")
        if len(re.sub(r"[^A-Za-z]", "", t)) < min_len: continue
        rows.append(dict(t=t, x=min(w["x"] for w in sel), y=min(w["y"] for w in sel),
                         x2=max(w["x"] + w["w"] for w in sel), y2=max(w["y"] + w["h"] for w in sel)))
    rows.sort(key=lambda r: r["y"])
    # merge continuation lines: same containing cell, or (numbered lists) lines without a leading number
    items = []
    for r in rows:
        cell = f.containing((r["x"], r["y"], r["x2"], r["y2"]))
        cell = cell if cell and cell[3] < 230 and cell[2] < f.W * .6 else None
        prev = items[-1] if items else None
        cont = False
        if prev:
            if cell and prev["cell"] == cell: cont = True
            elif numbered and not re.match(r"^\d+\s*[.)]?", r["t"]) and r["y"] - prev["y2"] < 25: cont = True
            elif not cell and not numbered and r["y"] - prev["y2"] < 12 and (r["t"][:1].islower() or r["t"].startswith("(") or re.match(r"^(PLC|LTD|LIMITED|FUND|BOND|GROUP|NIG)", r["t"], re.I)): cont = True
        if cont:
            prev["t"] += " " + r["t"]; prev["y2"] = max(prev["y2"], r["y2"]); prev["x2"] = max(prev["x2"], r["x2"])
        else:
            items.append(dict(r, cell=cell))
    out = []
    for it in items:
        name = re.sub(r"^\d+\s*[.,)|]?\s*", "", it["t"]) if (numbered or strip_num) else it["t"]
        name = re.sub(r"\s+", " ", name)
        name = re.sub(r"[\s|_\[\]{}]+$", "", name)
        name = name.strip(" |_.:;,[]{}")
        if any(re.search(s, name, re.I) for s in skip): continue
        # align with the name itself: tall cells often print the name at the bottom
        cy = (it["y"] + it["y2"]) / 2
        th = min(it["y2"] - it["y"], 60)
        rh = min(it["cell"][3], th + 18) if it["cell"] else th + 12
        s = max(14, min(30, rh * .62))
        if tick_mode == "column": s = min(s, max(12, col_w * .8))
        if tick_mode == "column": tx = tick_x
        elif tick_mode == "left": tx = it["x"] - s * .9 + tick_dx
        elif tick_mode == "leftcell":
            ref = it["cell"] or (it["x"] - 10, it["y"] - 8, it["x2"] - it["x"], it["y2"] - it["y"] + 16)
            lc = [b for b in f.boxes if b[2] < 200 and abs((b[0] + b[2]) - ref[0]) < 16 and b[1] - 12 <= cy <= b[1] + b[3] + 12]
            if lc:
                b = min(lc, key=lambda b: b[2] * b[3]); tx = b[0] + b[2] * tick_pos
                s = min(s, max(12, b[2] * (.75 if tick_pos == .5 else .38)))
            else:
                tx = ref[0] - s * .8
        elif tick_mode == "fixed": tx = tick_dx
        elif tick_mode == "cellright": tx = ((it["cell"][0] + it["cell"][2]) if it["cell"] else x2) - s * .9 + tick_dx
        else: tx = it["x2"] + s + tick_dx
        out.append({"name": name, "tick": {"x": round(tx * f.k, 1), "y": round(cy * f.k, 1), "s": round(s * f.k, 1)}})
    return out

def photo(f, label=r"Affix|PASSPORT", min_h=150):
    lab = f.find(label)
    b = f.containing(lab, min_h)
    return f.pt(b) if b else None

def signature(f, label=r"^\W*Signature|Signature ?\(s\)", nth=None, gap=110, region=None, mode="below", box=None, width=330, height=90):
    """First label match that has a box under (or beside) it. Skips mentions inside paragraphs."""
    if box: return f.pt(box)
    if mode == "inside":  # label printed inside the box: sign under the label
        lab = f.find(label, nth or 0, region)
        b = f.containing(lab)
        if b: return f.pt((b[0] + 4, lab[3] + 2, b[2] - 8, b[1] + b[3] - lab[3] - 6))
    if mode == "line":  # "Signature: ________" with no box: the space above the line, right of the label
        lab = f.find(label, nth or 0, region)
        return f.pt((lab[2] + 8, lab[3] - height + 8, width, height))
    tries = [nth] if nth is not None else range(8)
    for n in tries:
        try: lab = f.find(label, n, region)
        except LookupError: break
        b = f.below(lab, gap, xpad=40) if mode == "below" else f.right_of(lab, 400)
        if b and b[2] > 120: return f.pt(b)
    return None
