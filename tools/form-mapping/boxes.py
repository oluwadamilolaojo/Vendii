import cv2, numpy as np
def detect(name, min_w=18, min_h=16):
    img = cv2.imread(f"png/{name}.png", cv2.IMREAD_GRAYSCALE)
    th = cv2.adaptiveThreshold(img, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 25, 12)
    H, W = img.shape
    hk = cv2.getStructuringElement(cv2.MORPH_RECT, (max(30, W // 60), 1))
    vk = cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(22, H // 110)))
    hl = cv2.morphologyEx(th, cv2.MORPH_OPEN, hk)
    vl = cv2.morphologyEx(th, cv2.MORPH_OPEN, vk)
    grid = cv2.dilate(cv2.bitwise_or(hl, vl), np.ones((3, 3), np.uint8))
    cnts, hier = cv2.findContours(grid, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    rects = []
    for c in cnts:
        x, y, w, h = cv2.boundingRect(c)
        if w < min_w or h < min_h or w > W * 0.97: continue
        area = cv2.contourArea(c)
        if area < 0.8 * w * h: continue  # keep rectangular shapes only
        rects.append((x, y, w, h))
    # dedupe near-identical rects (outer/inner edge of the same stroke)
    out = []
    for r in sorted(rects, key=lambda r: r[2] * r[3]):
        if any(abs(r[0]-o[0]) < 8 and abs(r[1]-o[1]) < 8 and abs(r[2]-o[2]) < 12 and abs(r[3]-o[3]) < 12 for o in out): continue
        out.append(r)
    return out, (W, H)
if __name__ == "__main__":
    import sys
    name = sys.argv[1]
    rs, (W, H) = detect(name)
    im = cv2.imread(f"png/{name}.png")
    for i, (x, y, w, h) in enumerate(rs):
        cv2.rectangle(im, (x, y), (x+w, y+h), (0, 0, 255) if w*h < 6000 else (255, 0, 0), 3)
    s = float(sys.argv[2]) if len(sys.argv) > 2 else .5
    cv2.imwrite("/tmp/boxes.png", cv2.resize(im, None, fx=s, fy=s))
    print(len(rs), "rects")
