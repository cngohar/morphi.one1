#!/usr/bin/env python3
"""Block in-play screen in the LOCKED global shell (v6 rules):
GLOBAL (same as Memory v6): game name centred in the header row;
full-width bottom panel flush to the screen bottom with
'How to play' / 'Scoring & tips' (+ Your high score); clear gaps —
box never touches header or bottom panel.
PER-PUZZLE (all different from Memory): its own generated theme
(seed 777001: monochrome+accent, hue 92.7, rounded/outlined, warm
cream page); HUD = Score / Lines / Streak (Block brief); 8x8 board
with a 3-piece tray inside the box; background scatter = BLOCK
PIECES ONLY at 20% opacity (80% transparent), seeded positions,
header/bottom safe zones.
"""
import sys
sys.path.insert(0, "/home/hatch/workspace/your_files/morphi-game-ui-redesign")
from theme_generator import generate_theme, SplitMix64
from build_memory_redesign_v3 import hx, mix, font, BLACK, XBLACK, BOLD
from PIL import Image, ImageDraw

W, H = 1920, 923
INK = "#1B2433"; LABEL = "#68798E"; CORAL = "#E5532D"
SEED = 777001
ALPHA = 51  # 20% opacity = 80% transparent
t = generate_theme(SEED)
radius_f, bw, gap_theme, fill_mode = t["style_params"]
cols = [c["hex"] for c in t["symbol_colors"]]
panel_line = mix(t["panel_bg"], INK, 0.18)

img = Image.new("RGBA", (W, H), hx(t["page_bg"]) + (255,))

# ---- scatter: BLOCK PIECES only, 80% transparent, safe zones ----
SHAPES = [[(0,0),(1,0),(2,0),(2,1)], [(0,0),(0,1),(1,0),(1,1)],
          [(0,0),(0,1),(0,2),(1,1)], [(0,0),(1,0),(2,0),(3,0)],
          [(0,0),(0,1),(1,1),(2,1)], [(0,0),(1,0),(1,1),(2,1)],
          [(0,0),(0,1),(1,0)], [(0,0),(1,0),(2,0),(1,1),(1,2)]]
def rot(cells, k):
    for _ in range(k % 4):
        cells = [(y, -x) for x, y in cells]
    mx = min(x for x, y in cells); my = min(y for x, y in cells)
    return [(x - mx, y - my) for x, y in cells]

overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
od = ImageDraw.Draw(overlay)
srng = SplitMix64(SEED ^ 0xB10C5)
placed, tries = [], 0
while len(placed) < 13 and tries < 400:
    tries += 1
    cs = int(srng.range(20, 30))
    cells = rot(SHAPES[srng.next() % len(SHAPES)], srng.next() % 4)
    pw_ = (max(x for x, y in cells) + 1) * (cs + 3); ph_ = (max(y for x, y in cells) + 1) * (cs + 3)
    x0 = int(srng.range(-20, W - 100)); y0 = int(srng.range(126, 596))
    cx, cy = x0 + pw_ / 2, y0 + ph_ / 2
    if any(abs(cx - px) < (pw_ + qw) * 0.58 and abs(cy - py) < (ph_ + qh) * 0.58 for px, py, qw, qh in placed):
        continue
    placed.append((cx, cy, pw_, ph_))
    col = cols[srng.next() % len(cols)]
    fill = hx(col) + (ALPHA,); edge = tuple(int(v * 0.7) for v in hx(col)) + (ALPHA,)
    for cx_, cy_ in cells:
        X, Y = x0 + cx_ * (cs + 3), y0 + cy_ * (cs + 3)
        od.rounded_rectangle([X, Y, X + cs, Y + cs], radius=5, fill=fill, outline=edge, width=2)
img = Image.alpha_composite(img, overlay)
d = ImageDraw.Draw(img)

# ---- header row: wordmark | GAME NAME | account, sound (GLOBAL) ----
f_logo = font(BLACK, 34); x = 64
for s_, col in [("Morphi", INK), (".", CORAL), ("One", INK)]:
    d.text((x, 30), s_, font=f_logo, fill=col, anchor="la"); x += d.textlength(s_, font=f_logo)
d.text((W / 2, 28), "Block Puzzle", font=font(BLACK, 33), fill=INK, anchor="ma")
pw2 = 168
d.rounded_rectangle([W - 64 - 62 - 16 - pw2, 22, W - 64 - 62 - 16, 74], radius=26, outline="#7A889E", width=2, fill=(255, 255, 255))
d.text((W - 64 - 62 - 16 - pw2 / 2, 48), "Your account", font=font(BOLD, 16.5), fill=INK, anchor="mm")
sc = (W - 64 - 31, 48)
d.ellipse([sc[0] - 31, sc[1] - 31, sc[0] + 31, sc[1] + 31], fill=(255, 255, 255), outline="#C9D5E2", width=2)
d.polygon([(sc[0] - 12, sc[1] - 4), (sc[0] - 5, sc[1] - 4), (sc[0] + 2, sc[1] - 11), (sc[0] + 2, sc[1] + 11), (sc[0] - 5, sc[1] + 4), (sc[0] - 12, sc[1] + 4)], fill=INK)
for r in (9, 14):
    d.arc([sc[0] + 2, sc[1] - r, sc[0] + 2 + r * 1.4, sc[1] + r], start=-55, end=55, fill=INK, width=3)

# ---- puzzle box: Block's insides ----
PW, PT, PB = 860, 128, 800
PX = (W - PW) // 2
d.rounded_rectangle([PX, PT, PX + PW, PB], radius=34, fill=hx(t["panel_bg"]), outline=panel_line, width=2)
stats = [("SCORE", "1,250"), ("LINES", "4"), ("STREAK", "x3")]
f_lab, f_val = font(BOLD, 11.5), font(XBLACK, 26)
inner0, inner1 = PX + 30, PX + PW - 30
for i, (lab, val) in enumerate(stats):
    ccx = inner0 + (inner1 - inner0) * (i + 0.5) / 3
    wl = d.textlength(lab, font=f_lab) + 2.6 * (len(lab) - 1)
    cx = ccx - wl / 2
    for ch in lab:
        d.text((cx, PT + 16), ch, font=f_lab, fill=LABEL, anchor="la"); cx += d.textlength(ch, font=f_lab) + 2.6
    d.text((ccx, PT + 38), val, font=f_val, fill=INK, anchor="ma")
d.line([PX + 30, PT + 84, PX + PW - 30, PT + 84], fill=mix(t["panel_bg"], INK, 0.10), width=2)

# 8x8 board, mid-game, generated colours
CS, CG = 54, 5
BWID = 8 * CS + 7 * CG
GX, GY = PX + (PW - BWID) // 2, PT + 100
cell_r = max(6, int(CS * radius_f))
empty = mix(t["panel_bg"], "#FFFFFF", 0.38)
brng = SplitMix64(SEED ^ 0xCE11)
for r in range(8):
    for c in range(8):
        X, Y = GX + c * (CS + CG), GY + r * (CS + CG)
        if brng.f() < 0.36:
            col = cols[brng.next() % len(cols)]
            d.rounded_rectangle([X, Y, X + CS, Y + CS], radius=cell_r, fill=hx(col),
                                outline=tuple(int(v * 0.72) for v in hx(col)), width=bw)
            d.rounded_rectangle([X + 5, Y + 5, X + CS - 5, Y + 16], radius=5, fill=(255, 255, 255, 60))
        else:
            d.rounded_rectangle([X, Y, X + CS, Y + CS], radius=cell_r, fill=empty,
                                outline=mix(t["panel_bg"], INK, 0.10), width=1)

# tray: 3 pieces in slots (Block's own layout element)
TY, TH, TW = GY + BWID + 18, 76, 253
pieces = [([(0,0),(0,1),(0,2),(1,2)], cols[0]),
          ([(0,0),(0,1),(1,0),(1,1)], cols[1]),
          ([(0,0),(0,1),(0,2),(1,1)], cols[2])]
for i, (cells, col) in enumerate(pieces):
    sx = PX + 30 + i * (TW + 20)
    d.rounded_rectangle([sx, TY, sx + TW, TY + TH], radius=16, fill=mix(t["panel_bg"], "#FFFFFF", 0.45),
                        outline=mix(t["panel_bg"], INK, 0.12), width=1)
    pcs, pg = 19, 3
    pw3 = (max(x for x, y in cells) + 1) * (pcs + pg) - pg
    ph3 = (max(y for x, y in cells) + 1) * (pcs + pg) - pg
    ox, oy = sx + (TW - pw3) / 2, TY + (TH - ph3) / 2
    for cx_, cy_ in cells:
        X, Y = ox + cx_ * (pcs + pg), oy + cy_ * (pcs + pg)
        d.rounded_rectangle([X, Y, X + pcs, Y + pcs], radius=5, fill=hx(col),
                            outline=tuple(int(v * 0.72) for v in hx(col)), width=2)

# ---- BOTTOM PANEL (GLOBAL): full width, flush to bottom ----
BP_T = 848
d.rounded_rectangle([-8, BP_T, W + 8, H + 24], radius=26, fill=hx(t["panel_bg"]), outline=panel_line, width=2)
def pill(text, x0):
    f = font(BOLD, 15); w = d.textlength(text, font=f) + 40
    y0 = BP_T + 16
    d.rounded_rectangle([x0, y0, x0 + w, y0 + 44], radius=22, fill=(255, 255, 255), outline=mix(t["panel_bg"], INK, 0.35), width=2)
    d.text((x0 + w / 2, y0 + 22), text, font=f, fill=INK, anchor="mm")
    return x0 + w + 10
nx = pill("How to play", PX); pill("Scoring & tips", nx)
hs_lab = "YOUR HIGH SCORE"
f_hl, f_hv = font(BOLD, 10.5), font(XBLACK, 22)
vw = d.textlength("2,400", font=f_hv); right = PX + PW
d.text((right - vw, BP_T + 38), "2,400", font=f_hv, fill=INK, anchor="la")
lw = d.textlength(hs_lab, font=f_hl) + 2.4 * (len(hs_lab) - 1); cx = right - lw
for ch in hs_lab:
    d.text((cx, BP_T + 14), ch, font=f_hl, fill=LABEL, anchor="la"); cx += d.textlength(ch, font=f_hl) + 2.4

img.convert("RGB").save("/home/hatch/workspace/your_files/morphi-game-ui-redesign/block-game-ui-shell.png")
print("block saved | theme:", t["recipe"], "hue", round(t["base_hue"], 1), "| scatter pieces:", len(placed), "at", round(ALPHA / 255 * 100), "% opacity")
