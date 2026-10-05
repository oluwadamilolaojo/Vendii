import sys
from collections import defaultdict
from boxes import detect
name=sys.argv[1]; xmax=int(sys.argv[2]) if len(sys.argv)>2 else 5000
rs,_=detect(name)
rows=defaultdict(list)
for b in rs:
    if b[0] < xmax: rows[b[1]//12].append(b)
for k in sorted(rows):
    bs=sorted(rows[k]); small=[b for b in bs if b[2]<100]; big=[b for b in bs if b[2]>=100]
    print(f"y~{bs[0][1]:5d} h{bs[0][3]:3d}  cells={len(small):2d} x{small[0][0] if small else '-'}..{(small[-1][0]+small[-1][2]) if small else '-'}  big={[(b[0],b[1],b[2],b[3]) for b in big][:4]}")
