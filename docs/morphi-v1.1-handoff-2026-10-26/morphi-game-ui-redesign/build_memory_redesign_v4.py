#!/usr/bin/env python3
"""Memory in-play V4 — the owner's clarified shell rules (2026-10-26):
- Game name in the PAGE HEADER ROW (wordmark left, name centre,
  account/sound right) — not on the puzzle box.
- HUD stats in their own place: a strip directly above the board
  inside the stage (not in the header, not in the bottom section).
- Help buttons in a DEDICATED BOTTOM SECTION below the puzzle box,
  with Your high score at its right — nothing of theirs inside the box.
- Background: procedurally scattered items of THIS puzzle only —
  Memory cards at seeded random positions, blended faint into the
  background (homepage-scatter treatment), never mixed with other
  games' pieces or generic shapes. A card is a card: it uses the
  theme's own card shape and back motif.
Theme: same generated seed as V3 (20261026) for continuity.
"""
import sys
sys.path.insert(0, "/home/hatch/workspace/your_files/morphi-game-ui-redesign")
from theme_generator import generate_theme, SplitMix64
from build_memory_redesign_v3 import draw_symbol, card_path, hx, mix, font, BLACK, XBLACK, BOLD, MED
from PIL import Image, ImageDraw

W, H = 1920, 923
INK = "#1B2433"; SLATE = "#5A667B"; LABEL = "#68798E"; CORAL = "#E5532D"
SEED = 20261026
t = generate_theme(SEED)
radius_f, bw, gap, fill_mode = t["style_params"]
if t["container"] == "squircle": radius_f = 0.30

img = Image.new("RGB", (W, H), hx(t["page_bg"]))
d = ImageDraw.Draw(img)

# ---- background: this puzzle's own cards, seeded scatter, blended ----
srng = SplitMix64(SEED ^ 0xBAC6)
fill_tone = mix(t["backdrop_color"], t["page_bg"], 0.35)
edge_tone = mix(t["backdrop_color"], INK, 0.06)
motif_tone = mix(t["backdrop_color"], INK, 0.09)
placed = []
tries = 0
while len(placed) < 15 and tries < 300:
    tries += 1
    s = int(srng.range(92, 158))
    x0 = int(srng.range(-30, W - 60)); y0 = int(srng.range(98, 690))  # never into the bottom section
    cx, cy = x0 + s / 2, y0 + s / 2
    if any(abs(cx - px) < (s + ps) * 0.62 and abs(cy - py) < (s + ps) * 0.62 for px, py, ps in placed):
        continue  # minimum spacing, like the homepage scatter rules
    placed.append((cx, cy, s))
    card_path(d, x0, y0, s, t["container"], int(s * radius_f), fill_tone, edge_tone, 2)
    draw_symbol(d, t["symbol_families"][0], cx, cy, s * 0.15, motif_tone, fill_mode="outline")

# ---- header row: wordmark | GAME NAME | account, sound ----
f_logo = font(BLACK, 34); x = 64
for s_, col in [("Morphi", INK), (".", CORAL), ("One", INK)]:
    d.text((x, 30), s_, font=f_logo, fill=col, anchor="la"); x += d.textlength(s_, font=f_logo)
d.text((W / 2, 28), "Memory", font=font(BLACK, 33), fill=INK, anchor="ma")
pw_ = 168
d.rounded_rectangle([W - 64 - 62 - 16 - pw_, 22, W - 64 - 62 - 16, 74], radius=26, outline="#7A889E", width=2, fill=(255, 255, 255))
d.text((W - 64 - 62 - 16 - pw_ / 2, 48), "Your account", font=font(BOLD, 16.5), fill=INK, anchor="mm")
sc = (W - 64 - 31, 48)
d.ellipse([sc[0] - 31, sc[1] - 31, sc[0] + 31, sc[1] + 31], fill=(255, 255, 255), outline="#C9D5E2", width=2)
d.polygon([(sc[0] - 12, sc[1] - 4), (sc[0] - 5, sc[1] - 4), (sc[0] + 2, sc[1] - 11), (sc[0] + 2, sc[1] + 11), (sc[0] - 5, sc[1] + 4), (sc[0] - 12, sc[1] + 4)], fill=INK)
for r in (9, 14):
    d.arc([sc[0] + 2, sc[1] - r, sc[0] + 2 + r * 1.4, sc[1] + r], start=-55, end=55, fill=INK, width=3)

# ---- puzzle box: HUD strip, then board. Nothing else. ----
PW, PT, PB = 860, 100, 772
PX = (W - PW) // 2
panel_line = mix(t["panel_bg"], INK, 0.18)
d.rounded_rectangle([PX, PT, PX + PW, PB], radius=34, fill=hx(t["panel_bg"]), outline=panel_line, width=2)
stats = [("ROUND", "1"), ("SCORE", "5,905"), ("TIME", "00:47"), ("PAIRS", "2 / 6"), ("MISMATCHES", "3")]
f_lab, f_val = font(BOLD, 11.5), font(XBLACK, 26)
inner0, inner1 = PX + 30, PX + PW - 30
for i, (lab, val) in enumerate(stats):
    ccx = inner0 + (inner1 - inner0) * (i + 0.5) / 5
    wl = d.textlength(lab, font=f_lab) + 2.6 * (len(lab) - 1)
    cx = ccx - wl / 2
    for ch in lab:
        d.text((cx, PT + 16), ch, font=f_lab, fill=LABEL, anchor="la"); cx += d.textlength(ch, font=f_lab) + 2.6
    d.text((ccx, PT + 38), val, font=f_val, fill=INK, anchor="ma")
d.line([PX + 30, PT + 84, PX + PW - 30, PT + 84], fill=mix(t["panel_bg"], INK, 0.10), width=2)

cols = [c["hex"] for c in t["symbol_colors"]]
fams = t["symbol_families"]
pairs = [(fams[i], cols[i % len(cols)]) for i in range(6)]
grid = [(0, "M"), (3, "."), (1, "M"), (4, "C"), (5, "."), (0, "M"),
        (2, "."), (1, "M"), (2, "C"), (5, "."), (3, "."), (4, ".")]
CS = 176
GW = 4 * CS + 3 * gap
GX, GY = PX + (PW - GW) // 2, PT + 100
radius = int(CS * radius_f)
for idx, (pid, state) in enumerate(grid):
    r, c = divmod(idx, 4)
    x0, y0 = GX + c * (CS + gap), GY + r * (CS + gap)
    fam, col = pairs[pid]
    if state == ".":
        card_path(d, x0, y0, CS, t["container"], radius, hx(t["card_back"]), hx(t["card_back_edge"]), bw)
        draw_symbol(d, fams[0], x0 + CS / 2, y0 + CS / 2, 26, mix(t["card_back"], "#FFFFFF", 0.55), fill_mode="outline")
    else:
        face = mix(col, "#FFFFFF", 0.86) if state == "M" else (255, 255, 255)
        card_path(d, x0, y0, CS, t["container"], radius, face, hx(col), bw + 1)
        draw_symbol(d, fam, x0 + CS / 2, y0 + CS / 2, 40, hx(col), fill_mode="solid", face_col=face)

# ---- dedicated bottom section (below the box, on the page) ----
BY = 796
def pill(text, x0):
    f = font(BOLD, 15.5); w = d.textlength(text, font=f) + 42
    d.rounded_rectangle([x0, BY, x0 + w, BY + 48], radius=24, fill=(255, 255, 255), outline="#7A889E", width=2)
    d.text((x0 + w / 2, BY + 24), text, font=f, fill=INK, anchor="mm")
    return x0 + w + 12
nx = pill("How to play", PX); pill("Scoring & tips", nx)
hs_lab = "YOUR HIGH SCORE"
f_hl, f_hv = font(BOLD, 11.5), font(XBLACK, 24)
vw = d.textlength("7,850", font=f_hv); right = PX + PW
d.text((right - vw, BY + 14), "7,850", font=f_hv, fill=INK, anchor="la")
lw = d.textlength(hs_lab, font=f_hl) + 2.6 * (len(hs_lab) - 1); cx = right - lw
for ch in hs_lab:
    d.text((cx, BY + 2), ch, font=f_hl, fill=LABEL, anchor="la"); cx += d.textlength(ch, font=f_hl) + 2.6

img.save("/home/hatch/workspace/your_files/morphi-game-ui-redesign/memory-game-ui-redesign-v4-shell.png")
print("v4 saved | panel", PW, "x", PB - PT, "| grid", GW, "x", 3 * CS + 2 * gap, "| theme", t["recipe"], t["container"], t["style"])
