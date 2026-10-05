import json, sys
from PIL import Image, ImageDraw, ImageFont
def preview(name, tpl, out, scale=.5):
    im = Image.open(f"png/{name}.png").convert("RGB"); d = ImageDraw.Draw(im)
    k = im.width / tpl["page"]["w"]
    font = ImageFont.load_default(size=22)
    P = lambda r: (r["x"]*k, r["y"]*k, (r["x"]+r["w"])*k, (r["y"]+r["h"])*k)
    for fld in tpl["fields"]:
        if fld["kind"] == "cells":
            for c in fld["cells"]: d.rectangle(P(c), outline=(0,160,0), width=3)
            d.text((fld["cells"][0]["x"]*k, fld["cells"][0]["y"]*k-20), fld["key"], fill=(0,120,0), font=font)
        else:
            d.rectangle(P(fld), outline=(0,90,255), width=3); d.text((fld["x"]*k+4, fld["y"]*k+2), fld["key"], fill=(0,60,220), font=font)
    for key in ("photo", "signature"):
        if tpl.get(key): d.rectangle(P(tpl[key]), outline=(230,0,160), width=6); d.text((tpl[key]["x"]*k+6, tpl[key]["y"]*k+6), key.upper(), fill=(230,0,160), font=font)
    for c in tpl["companies"]:
        t = c["tick"]
        if not t: continue
        x, y, s = t["x"]*k, t["y"]*k, t["s"]*k
        d.line([(x-s/2, y), (x-s/8, y+s/2.5), (x+s/2, y-s/2)], fill=(220,0,0), width=4)
    im.resize((int(im.width*scale), int(im.height*scale))).save(out)
