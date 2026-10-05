import csv, sys
from collections import defaultdict
def lines(name):
    rows = list(csv.DictReader(open(f"ocr/{name}.tsv"), delimiter="\t", quoting=csv.QUOTE_NONE))
    g = defaultdict(list)
    for r in rows:
        if r["level"] != "5" or not r["text"].strip(): continue
        if float(r["conf"]) < 20: continue
        g[(r["block_num"], r["par_num"], r["line_num"])].append(r)
    out = []
    for k, ws in g.items():
        x = min(int(w["left"]) for w in ws); y = min(int(w["top"]) for w in ws)
        x2 = max(int(w["left"])+int(w["width"]) for w in ws); y2 = max(int(w["top"])+int(w["height"]) for w in ws)
        out.append((y, x, x2, y2, " ".join(w["text"] for w in ws), ws))
    return sorted(out)
if __name__ == "__main__":
    for y,x,x2,y2,t,_ in lines(sys.argv[1]):
        print(f"{y:5d} {x:5d}-{x2:5d}  {t}")
