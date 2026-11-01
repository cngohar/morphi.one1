#!/usr/bin/env python3
"""Memory on a PHONE screen (390x844 pt, drawn at 2x = 780x1688),
in the same locked global shell, same deal/theme as desktop v6
(seed 20261026, complementary/squircle/blocky).
GLOBAL, unchanged: name centred in the header row; full-width
bottom panel flush to the screen bottom with How to play /
Scoring & tips + Your high score; gaps — the box touches neither.
PHONE ADAPTATIONS (per-puzzle layout profile, not new globals):
account collapses to a person icon (the header row has no room for
the pill + name + wordmark at 390pt); the 12 cards reflow from
4 cols x 3 rows to 3 cols x 4 rows so the board uses portrait
space; scatter shrinks to the few cards that fit the phone's
margins and gaps, still Memory cards only at 20% opacity.
"""
import sys
sys.path.insert(0, "/home/hatch/workspace/your_files/morphi-game-ui-redesign")
from theme_generator import generate_theme, SplitMix64
from build_memory_redesign_v3 import draw_symbol, card_path, hx, mix, font, BLACK, XBLACK, BOLD
from PIL import Image, ImageDraw

W, H = 780, 1688  # 390x844 pt at 2x
INK = "#1B2433"; LABEL = "#68798E"; CORAL = "#E5532D"
SEED = 20261026
ALPHA = 51
t = generate_theme(SEED)
radius_f, bw, gap_theme, fill_mode = t["style_params"]
if t["container"] == "squircle": radius_f = 0.30
panel_line = mix(t["panel_bg"], INK, 0.18)

img = Image.new("RGBA", (W, H), hx(t["page_bg"]) + (255,))

# ---- scatter: Memory cards only, 20% opacity, header/bottom safe zones ----
overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
od = ImageDraw.Draw(overlay)
srng = SplitMix64(SEED ^ 0xBAC6)
fill_rgba = hx(t["card_back"]) + (ALPHA,)
edge_rgba = hx(t["card_back_edge"]) + (ALPHA,)
placed, tries = [], 0
while len(placed) < 9 and tries < 300:
    tries += 1
    s = int(srng.range(92, 128))
    x0 = int(srng.range(-28, W - 64)); y0 = int(srng.range(236, 1372))
    cx, cy = x0 + s / 2, y0 + s / 2
    if any(abs(cx - px) < (s + ps) * 0.62 and abs(cy - py) < (s + ps) * 0.62 for px, py, ps in placed):
        continue
    placed.append((cx, cy, s))
    card_path(od, x0, y0, s, t["container"], int(s * radius_f), fill_rgba, edge_rgba, 2)
    draw_symbol(od, t["symbol_families"][0], cx, cy, s * 0.15, edge_rgba, fill_mode="outline")
img = Image.alpha_composite(img, overlay)
d = ImageDraw.Draw(img)

# ---- header row: wordmark | NAME | account icon, sound ----
f_logo = font(BLACK, 33); x = 32
for s_, col in [("Morphi", INK), (".", CORAL), ("One", INK)]:
    d.text((x, 42), s_, font=f_logo, fill=col, anchor="la"); x += d.textlength(s_, font=f_logo)
d.text((W / 2, 40), "Memory", font=font(BLACK, 34), fill=INK, anchor="ma")
# sound (right) and account-as-icon (its left)
sc = (W - 32 - 28, 66)
d.ellipse([sc[0] - 28, sc[1] - 28, sc[0] + 28, sc[1] + 28], fill=(255, 255, 255), outline="#C9D5E2", width=2)
d.polygon([(sc[0] - 11, sc[1] - 4), (sc[0] - 5, sc[1] - 4), (sc[0] + 2, sc[1] - 10), (sc[0] + 2, sc[1] + 10), (sc[0] - 5, sc[1] + 4), (sc[0] - 11, sc[1] + 4)], fill=INK)
for r in (8, 13):
    d.arc([sc[0] + 2, sc[1] - r, sc[0] + 2 + r * 1.4, sc[1] + r], start=-55, end=55, fill=INK, width=3)
ac = (sc[0] - 56 - 26, 66)
d.ellipse([ac[0] - 26, ac[1] - 26, ac[0] + 26, ac[1] + 26], fill=(255, 255, 255), outline="#C9D5E2", width=2)
d.ellipse([ac[0] - 6, ac[1] - 13, ac[0] + 6, ac[1] - 1], fill=INK)
d.arc([ac[0] - 11, ac[1] + 1, ac[0] + 11, ac[1] + 23], start=200, end=340, fill=INK, width=4)

# ---- puzzle box: centred between header and bottom panel, gaps both sides ----
PW, PT, PB = 732, 300, 1420
PX = (W - PW) // 2
d.rounded_rectangle([PX, PT, PX + PW, PB], radius=44, fill=hx(t["panel_bg"]), outline=panel_line, width=2)
stats = [("ROUND", "1"), ("SCORE", "5,905"), ("TIME", "00:47"), ("PAIRS", "2 / 6"), ("MISM.", "3")]
f_lab, f_val = font(BOLD, 16), font(XBLACK, 33)
inner0, inner1 = PX + 24, PX + PW - 24
for i, (lab, val) in enumerate(stats):
    ccx = inner0 + (inner1 - inner0) * (i + 0.5) / 5
    wl = d.textlength(lab, font=f_lab) + 2.0 * (len(lab) - 1)
    cx = ccx - wl / 2
    for ch in lab:
        d.text((cx, PT + 26), ch, font=f_lab, fill=LABEL, anchor="la"); cx += d.textlength(ch, font=f_lab) + 2.0
    d.text((ccx, PT + 58), val, font=f_val, fill=INK, anchor="ma")
d.line([PX + 24, PT + 124, PX + PW - 24, PT + 124], fill=mix(t["panel_bg"], INK, 0.10), width=2)

cols = [c["hex"] for c in t["symbol_colors"]]
fams = t["symbol_families"]
pairs = [(fams[i], cols[i % len(cols)]) for i in range(6)]
grid = [(0, "M"), (3, "."), (1, "M"), (4, "C"), (5, "."), (0, "M"),
        (2, "."), (1, "M"), (2, "C"), (5, "."), (3, "."), (4, ".")]
CS, CG, COLS = 212, 24, 3
GW = COLS * CS + (COLS - 1) * CG
GX, GY = PX + (PW - GW) // 2, PT + 152
radius = int(CS * radius_f)
for idx, (pid, state) in enumerate(grid):
    r, c = divmod(idx, COLS)
    x0, y0 = GX + c * (CS + CG), GY + r * (CS + CG)
    fam, col = pairs[pid]
    if state == ".":
        card_path(d, x0, y0, CS, t["container"], radius, hx(t["card_back"]), hx(t["card_back_edge"]), bw)
        draw_symbol(d, fams[0], x0 + CS / 2, y0 + CS / 2, 32, mix(t["card_back"], "#FFFFFF", 0.55), fill_mode="outline")
    else:
        face = mix(col, "#FFFFFF", 0.86) if state == "M" else (255, 255, 255)
        card_path(d, x0, y0, CS, t["container"], radius, face, hx(col), bw + 1)
        draw_symbol(d, fam, x0 + CS / 2, y0 + CS / 2, 48, hx(col), fill_mode="solid", face_col=face)

# ---- BOTTOM PANEL (GLOBAL): full width, flush to bottom ----
BP_T = 1560
d.rounded_rectangle([-16, BP_T, W + 16, H + 48], radius=44, fill=hx(t["panel_bg"]), outline=panel_line, width=2)
def pill(text, x0):
    f = font(BOLD, 23); w = d.textlength(text, font=f) + 52
    y0 = BP_T + 28
    d.rounded_rectangle([x0, y0, x0 + w, y0 + 72], radius=36, fill=(255, 255, 255), outline=mix(t["panel_bg"], INK, 0.35), width=2)
    d.text((x0 + w / 2, y0 + 36), text, font=f, fill=INK, anchor="mm")
    return x0 + w + 14
nx = pill("How to play", 32); pill("Scoring & tips", nx)
hs_lab = "YOUR HIGH SCORE"
f_hl, f_hv = font(BOLD, 16), font(XBLACK, 34)
vw = d.textlength("7,850", font=f_hv); right = W - 32
d.text((right - vw, BP_T + 62), "7,850", font=f_hv, fill=INK, anchor="la")
lw = d.textlength(hs_lab, font=f_hl) + 2.2 * (len(hs_lab) - 1); cx = right - lw
for ch in hs_lab:
    d.text((cx, BP_T + 30), ch, font=f_hl, fill=LABEL, anchor="la"); cx += d.textlength(ch, font=f_hl) + 2.2

img.convert("RGB").save("/home/hatch/workspace/your_files/morphi-game-ui-redesign/memory-game-ui-shell-phone.png")
print("phone saved | box", PT, "-", PB, "| header gap", PT - 188, "| bottom gap", BP_T - PB, "| scatter:", len(placed))
