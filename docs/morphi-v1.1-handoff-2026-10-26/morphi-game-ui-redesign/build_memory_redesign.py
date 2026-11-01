#!/usr/bin/env python3
"""Redesign of the Morphi Memory in-play screen, desktop 1920x923 — the
exact size of the owner's v1 screenshot, showing the exact same round
state (Score 5,905 / Time 00:19 / Pairs 0 of 6 / Mismatches 0, all cards
face down after the preview), so the two can be compared directly.

Design moves vs v1:
- Board sizes from the viewport: panel is ~79% of screen height; cards
  166px (v1: ~105px). Grid area ~2.7x the v1 screenshot.
- Title + help buttons form one row aligned to the panel edges — no
  floating buttons, no dead gap between header and board.
- Defined play area: white panel with a real border on the pale page
  (v1 was a pale panel on a pale page, washed out).
- Card backs carry the art: flat teal with a diamond motif + quiet
  corner diamonds (v1: plain pale green, thin orange outline).
- Faint scatter in the wide desktop margins only, blending into the
  background (accepted homepage rule) so the margins aren't dead.
Flat fills only, no shadows/gradients, Morphi tokens throughout.
"""
import math
from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 923
NOTO = "/usr/share/fonts/truetype/noto/"
def font(name, size): return ImageFont.truetype(NOTO + name, size)
BLACK = "NotoSansDisplay-Black.ttf"; XBOLD = "NotoSans-ExtraBold.ttf"
BOLD = "NotoSans-Bold.ttf"; SEMI = "NotoSans-SemiBold.ttf"
MED = "NotoSans-Medium.ttf"; REG = "NotoSans-Regular.ttf"

INK = "#1B2433"; INK2 = "#2A3648"; SLATE = "#5B6B82"; LABEL = "#68798E"
LINE = "#C9D5E2"; HAIR = "#E1E8F0"; CORAL = "#E5532D"
BG = "#EEF2F7"; WHITE = "#FFFFFF"
CARD = "#0E9F87"; CARD_LINE = "#0B7C6A"; CARD_LIGHT = "#45BFA9"
SCATTER = "#DEE6EF"; SCATTER2 = "#D5DFEC"

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# ---------- faint scatter in the margins only ----------
def ring(cx, cy, r, col, wdt=4):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=col, width=wdt)
def diamond(cx, cy, r, col, wdt=4):
    d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], outline=col, width=wdt)
def tri(cx, cy, r, col, wdt=4):
    pts = [(cx + r * math.cos(a), cy + r * math.sin(a)) for a in (-math.pi / 2, math.pi * 5 / 6, math.pi / 6)]
    d.polygon(pts, outline=col, width=wdt)
def star(cx, cy, r, col, wdt=4):
    pts = []
    for i in range(10):
        ang = -math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.45
        pts.append((cx + rr * math.cos(ang), cy + rr * math.sin(ang)))
    d.polygon(pts, outline=col, width=wdt)
def hexa(cx, cy, r, col, wdt=4):
    pts = [(cx + r * math.cos(math.pi / 6 + i * math.pi / 3), cy + r * math.sin(math.pi / 6 + i * math.pi / 3)) for i in range(6)]
    d.polygon(pts, outline=col, width=wdt)

ring(170, 250, 46, SCATTER); diamond(280, 470, 30, SCATTER2); tri(150, 660, 40, SCATTER)
star(300, 800, 34, SCATTER); hexa(255, 130, 26, SCATTER2)
ring(1760, 300, 52, SCATTER); tri(1660, 540, 36, SCATTER2); diamond(1785, 720, 28, SCATTER)
hexa(1655, 150, 30, SCATTER); star(1800, 860, 30, SCATTER2)

# ---------- header ----------
f_logo = font(BLACK, 34)
x = 64
for s, col in [("Morphi", INK), (".", CORAL), ("One", INK)]:
    d.text((x, 34), s, font=f_logo, fill=col, anchor="la"); x += d.textlength(s, font=f_logo)

pill_w = 168
d.rounded_rectangle([W - 64 - 62 - 16 - pill_w, 26, W - 64 - 62 - 16, 78], radius=26, outline="#8FA1B5", width=2, fill=WHITE)
d.text((W - 64 - 62 - 16 - pill_w / 2, 52), "Your account", font=font(BOLD, 16.5), fill=INK, anchor="mm")
sc = (W - 64 - 31, 52)
d.ellipse([sc[0] - 31, sc[1] - 31, sc[0] + 31, sc[1] + 31], fill=WHITE, outline=LINE, width=2)
# speaker glyph
d.polygon([(sc[0] - 12, sc[1] - 4), (sc[0] - 5, sc[1] - 4), (sc[0] + 2, sc[1] - 11), (sc[0] + 2, sc[1] + 11), (sc[0] - 5, sc[1] + 4), (sc[0] - 12, sc[1] + 4)], fill=INK)
for r in (9, 14):
    d.arc([sc[0] + 2, sc[1] - r, sc[0] + 2 + r * 1.4, sc[1] + r], start=-55, end=55, fill=INK, width=3)

# ---------- stage geometry ----------
PW = 820
PX = (W - PW) // 2
PT = 172            # panel top
PB = 900            # panel bottom -> panel height 728 (79% of 923)
PAD = 40

# ---------- title row, aligned to panel edges ----------
d.text((PX + 4, 108), "Memory", font=font(BLACK, 40), fill=INK, anchor="la")
rw = d.textlength("Memory", font=font(BLACK, 40))
f_rnd = font(XBOLD, 13)
label = "ROUND 1"
lx = PX + 4 + rw + 18
for ch in label:
    d.text((lx, 128), ch, font=f_rnd, fill=LABEL, anchor="la")
    lx += d.textlength(ch, font=f_rnd) + 2.6

def pill_right(text, right_x, y=104):
    f = font(BOLD, 16)
    w = d.textlength(text, font=f) + 44
    d.rounded_rectangle([right_x - w, y, right_x, y + 50], radius=25, fill=WHITE, outline="#A9BACD", width=2)
    d.text((right_x - w / 2, y + 25), text, font=f, fill=INK, anchor="mm")
    return right_x - w - 12

rx = pill_right("Scoring & tips", PX + PW - 4)
rx = pill_right("How to play", rx)

# ---------- panel ----------
d.rounded_rectangle([PX, PT, PX + PW, PB], radius=36, fill=WHITE, outline="#BFCFDF", width=2)

# HUD
stats = [("SCORE", "5,905"), ("TIME", "00:19"), ("PAIRS", "0 / 6"), ("MISMATCHES", "0")]
f_lab = font(BOLD, 12.5); f_val = font("NotoSans-Black.ttf", 34)
inner_w = PW - 2 * PAD
for i, (lab, val) in enumerate(stats):
    ccx = PX + PAD + inner_w * (i + 0.5) / 4
    wl = d.textlength(lab, font=f_lab) + 3.0 * (len(lab) - 1)
    cx = ccx - wl / 2
    for ch in lab:
        d.text((cx, PT + 26), ch, font=f_lab, fill=LABEL, anchor="la")
        cx += d.textlength(ch, font=f_lab) + 3.0
    d.text((ccx, PT + 50), val, font=f_val, fill=INK, anchor="ma")
d.line([PX + PAD, PT + 112, PX + PW - PAD, PT + 112], fill=HAIR, width=2)

# ---------- card grid ----------
GAP = 18
CARD_SZ = 166
GW = 4 * CARD_SZ + 3 * GAP
GX = PX + (PW - GW) // 2
GY = PT + 136
for r in range(3):
    for c in range(4):
        x0 = GX + c * (CARD_SZ + GAP); y0 = GY + r * (CARD_SZ + GAP)
        d.rounded_rectangle([x0, y0, x0 + CARD_SZ, y0 + CARD_SZ], radius=24, fill=CARD, outline=CARD_LINE, width=3)
        cx, cy = x0 + CARD_SZ / 2, y0 + CARD_SZ / 2
        # centre motif
        diamond(cx, cy, 30, WHITE, 5)
        d.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], fill=WHITE)
        # quiet corner diamonds
        for qx, qy in [(x0 + 30, y0 + 30), (x0 + CARD_SZ - 30, y0 + 30), (x0 + 30, y0 + CARD_SZ - 30), (x0 + CARD_SZ - 30, y0 + CARD_SZ - 30)]:
            diamond(qx, qy, 9, CARD_LIGHT, 3)

# footer inside panel
d.text((W / 2, PB - 38), "6 pairs · Find the matching pairs", font=font(MED, 15), fill=SLATE, anchor="ma")

img.save("/home/hatch/workspace/your_files/morphi-game-ui-redesign/memory-game-ui-redesign-desktop.png")
print("panel", PW, "x", PB - PT, "=", round(PW * (PB - PT) / (W * H) * 100), "% of viewport; grid", GW, "x", 3 * CARD_SZ + 2 * GAP)
