import sys
from PIL import Image
keys = sys.argv[2:]; out = sys.argv[1]
ims = [Image.open(f"/tmp/pv_{k}.png") for k in keys]
w = 760; ims = [i.resize((w, int(i.height * w / i.width))) for i in ims]
S = Image.new("RGB", (w * len(ims) + 10 * (len(ims) - 1), max(i.height for i in ims)), "white")
for n, i in enumerate(ims): S.paste(i, (n * (w + 10), 0))
S.save(out)
