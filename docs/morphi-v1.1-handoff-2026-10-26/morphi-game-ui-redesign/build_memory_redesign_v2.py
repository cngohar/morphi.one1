#!/usr/bin/env python3
"""Memory in-play redesign V2 — the owner's layout idea, drawn:
- Game name on the TOP ROW of the panel, HUD sharing that row.
- Board in the middle, large.
- BOTTOM PANEL row: How to play / Scoring & tips buttons, plus the
  remaining items placed as: Round + caption under the game name,
  Your high score at the right of the bottom row.
- Account / sound stay in the page header (global chrome, corners).
Colours deliberately kept from the v1 screenshot (pale green panel,
light-green cards, orange outline, amber diamond) so this judges the
LAYOUT only, not a new palette. 1920x923, same round state as v1.
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 923
NOTO = "/usr/share/fonts/truetype/noto/"
def font(name, size): return ImageFont.truetype(NOTO + name, size)
BLACK = "NotoSansDisplay-Black.ttf"; XBLACK = "NotoSans-Black.ttf"
XBOLD = "NotoSans-ExtraBold.ttf"; BOLD = "NotoSans-Bold.ttf"
SEMI = "NotoSans-SemiBold.ttf"; MED = "NotoSans-Medium.ttf"; REG = "NotoSans-Regular.ttf"

INK = "#1B2433"; INK2 = "#2A3648"; SLATE = "#5B6B82"; LABEL = "#68798E"
LINE = "#C9D5E2"; CORAL = "#E5532D"; BG = "#EEF2F7"; WHITE = "#FFFFFF"
PANEL = "#E9F6DF"; PANEL_LINE = "#C4DCB2"; HAIR = "#D2E4C4"
CARD = "#CBE3C0"; CARD_LINE = "#E8622C"; DIAMOND = "#7A4A00"

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# ---------- page header (global chrome, unchanged) ----------
f_logo = font(BLACK, 34)
x = 64
for s, col in [("Morphi", INK), (".", CORAL), ("One", INK)]:
    d.text((x, 32), s, font=f_logo, fill=col, anchor="la"); x += d.textlength(s, font=f_logo)
pill_w = 168
d.rounded_rectangle([W - 64 - 62 - 16 - pill_w, 24, W - 64 - 62 - 16, 76], radius=26, outline="#8FA1B5", width=2, fill=WHITE)
d.text((W - 64 - 62 - 16 - pill_w / 2, 50), "Your account", font=font(BOLD, 16.5), fill=INK, anchor="mm")
sc = (W - 64 - 31, 50)
d.ellipse([sc[0] - 31, sc[1] - 31, sc[0] + 31, sc[1] + 31], fill=WHITE, outline=LINE, width=2)
d.polygon([(sc[0] - 12, sc[1] - 4), (sc[0] - 5, sc[1] - 4), (sc[0] + 2, sc[1] - 11), (sc[0] + 2, sc[1] + 11), (sc[0] - 5, sc[1] + 4), (sc[0] - 12, sc[1] + 4)], fill=INK)
for r in (9, 14):
    d.arc([sc[0] + 2, sc[1] - r, sc[0] + 2 + r * 1.4, sc[1] + r], start=-55, end=55, fill=INK, width=3)

# ---------- panel ----------
PW, PT, PB = 940, 110, 898
PX = (W - PW) // 2
PAD = 38
d.rounded_rectangle([PX, PT, PX + PW, PB], radius=34, fill=PANEL, outline=PANEL_LINE, width=2)

# ---------- TOP ROW: game name left, HUD right ----------
d.text((PX + PAD, PT + 22), "Memory", font=font(BLACK, 37), fill=INK, anchor="la")
d.text((PX + PAD + 2, PT + 70), "Round 1 · 6 pairs · Find the matching pairs", font=font(MED, 15), fill=SLATE, anchor="la")

stats = [("SCORE", "5,905"), ("TIME", "00:19"), ("PAIRS", "0 / 6"), ("MISMATCHES", "0")]
f_lab = font(BOLD, 11.5); f_val = font(XBLACK, 27)
zone_x0 = PX + 400; zone_w = PW - PAD - 400
for i, (lab, val) in enumerate(stats):
    ccx = zone_x0 + zone_w * (i + 0.5) / 4
    wl = d.textlength(lab, font=f_lab) + 2.6 * (len(lab) - 1)
    cx = ccx - wl / 2
    for ch in lab:
        d.text((cx, PT + 26), ch, font=f_lab, fill=LABEL, anchor="la")
        cx += d.textlength(ch, font=f_lab) + 2.6
    d.text((ccx, PT + 48), val, font=f_val, fill=INK, anchor="ma")
d.line([PX + PAD, PT + 106, PX + PW - PAD, PT + 106], fill=HAIR, width=2)

# ---------- board ----------
GAP = 18; CS = 176
GW = 4 * CS + 3 * GAP
GX = PX + (PW - GW) // 2
GY = PT + 124
for r in range(3):
    for c in range(4):
        x0 = GX + c * (CS + GAP); y0 = GY + r * (CS + GAP)
        d.rounded_rectangle([x0, y0, x0 + CS, y0 + CS], radius=22, fill=CARD, outline=CARD_LINE, width=3)
        cx, cy, dd = x0 + CS / 2, y0 + CS / 2, 17
        d.polygon([(cx, cy - dd), (cx + dd, cy), (cx, cy + dd), (cx - dd, cy)], outline=DIAMOND, width=4)

# ---------- BOTTOM PANEL row ----------
BY = PB - 76
d.line([PX + PAD, BY - 14, PX + PW - PAD, BY - 14], fill=HAIR, width=2)
def pill(text, x0):
    f = font(BOLD, 15.5)
    w = d.textlength(text, font=f) + 42
    d.rounded_rectangle([x0, BY, x0 + w, BY + 46], radius=23, fill=WHITE, outline="#9DB98F", width=2)
    d.text((x0 + w / 2, BY + 23), text, font=f, fill=INK, anchor="mm")
    return x0 + w + 12
nx = pill("How to play", PX + PAD)
nx = pill("Scoring & tips", nx)
# remaining item, right of bottom row: your high score
hs_lab = "YOUR HIGH SCORE"; hs_val = "7,850"
f_hl = font(BOLD, 11.5); f_hv = font(XBLACK, 24)
vw = d.textlength(hs_val, font=f_hv)
lw = d.textlength(hs_lab, font=f_hl) + 2.6 * (len(hs_lab) - 1)
right = PX + PW - PAD
d.text((right - vw, BY + 12), hs_val, font=f_hv, fill=INK, anchor="la")
cx = right - lw
for ch in hs_lab:
    d.text((cx, BY + 2), ch, font=f_hl, fill=LABEL, anchor="la")
    cx += d.textlength(ch, font=f_hl) + 2.6

img.save("/home/hatch/workspace/your_files/morphi-game-ui-redesign/memory-game-ui-redesign-v2-layout.png")
print("panel", PW, "x", PB - PT, "| grid", GW, "x", 3 * CS + 2 * GAP, "| cards", CS)
