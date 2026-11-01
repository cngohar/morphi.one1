#!/usr/bin/env python3
"""Connect (Flow) door-page designs in the accepted hybrid style.
Desktop before (columns present), desktop during (board only + help
buttons), mobile during. Same tokens/minimal styling as Block/Memory."""
from PIL import Image, ImageDraw, ImageFont
import math, os

OUT = os.path.dirname(os.path.abspath(__file__))
NOTO = "/usr/share/fonts/truetype/noto/"
def font(name, size): return ImageFont.truetype(NOTO + name, size)
BLACK = "NotoSansDisplay-Black.ttf"; XBLACK = "NotoSans-Black.ttf"
XBOLD = "NotoSans-ExtraBold.ttf"; BOLD = "NotoSans-Bold.ttf"
SEMI = "NotoSans-SemiBold.ttf"; MED = "NotoSans-Medium.ttf"; REG = "NotoSans-Regular.ttf"

INK = "#1B2433"; INK2 = "#2A3648"; SLATE = "#5B6B82"; LABEL = "#68798E"
LINE = "#C9D5E2"; HAIR = "#D3DDE9"; CORAL = "#E5532D"; BLUE = "#2F6FED"
TEAL = "#009A86"; AMBER = "#F5A524"; VIOLET = "#7D61AE"; PINK = "#D94F8A"
WHITE = "#FFFFFF"; BG = "#EEF2F7"; BOARD = "#DFE9F5"; CELL = "#F4F8FC"

def blend(hexcol, bg=WHITE, t=0.55):
    h = hexcol.lstrip('#'); b = bg.lstrip('#')
    return tuple(int(int(h[i:i+2], 16)*(1-t) + int(b[i:i+2], 16)*t) for i in (0, 2, 4))

# Solution partition of the 6x6 board (each pair = one path of 6 cells)
PAIRS = [
    (CORAL, "diamond", [(0,0),(0,1),(1,1),(2,1),(2,0),(1,0)]),
    (BLUE,  "star",    [(0,2),(0,3),(0,4),(1,4),(1,3),(1,2)]),
    (TEAL,  "tri",     [(0,5),(1,5),(2,5),(2,4),(2,3),(2,2)]),
    (AMBER, "square",  [(3,0),(3,1),(3,2),(4,2),(4,1),(4,0)]),
    (VIOLET,"plus",    [(3,3),(3,4),(3,5),(4,5),(4,4),(4,3)]),
    (PINK,  "hex",     [(5,0),(5,1),(5,2),(5,3),(5,4),(5,5)]),
]
# Mid-round state for "during": pair idx -> number of cells drawn
DURING = {0: 6, 1: 6, 2: 4, 3: 3}

def symbol(d, kind, cx, cy, r, col, w=4):
    if kind == "diamond":
        d.polygon([(cx, cy-r), (cx+r, cy), (cx, cy+r), (cx-r, cy)], outline=col, width=w)
    elif kind == "star":
        pts = []
        for i in range(10):
            ang = -math.pi/2 + i*math.pi/5; rr = r if i % 2 == 0 else r*0.45
            pts.append((cx + rr*math.cos(ang), cy + rr*math.sin(ang)))
        d.polygon(pts, outline=col, width=w)
    elif kind == "tri":
        d.polygon([(cx, cy-r), (cx+r*0.9, cy+r*0.75), (cx-r*0.9, cy+r*0.75)], outline=col, width=w)
    elif kind == "square":
        d.rectangle([cx-r*0.8, cy-r*0.8, cx+r*0.8, cy+r*0.8], outline=col, width=w)
    elif kind == "plus":
        d.line([cx-r, cy, cx+r, cy], fill=col, width=w+1); d.line([cx, cy-r, cx, cy+r], fill=col, width=w+1)
    elif kind == "hex":
        pts = [(cx + r*math.cos(math.pi/6 + i*math.pi/3), cy + r*math.sin(math.pi/6 + i*math.pi/3)) for i in range(6)]
        d.polygon(pts, outline=col, width=w)

def header(d, W, title, eyebrow, sub):
    f_logo = font(BLACK, 34); x = 72
    for s, col in [("Morphi", INK), (".", CORAL), ("One", INK)]:
        d.text((x, 36), s, font=f_logo, fill=col, anchor="la"); x += d.textlength(s, font=f_logo)
    si_x = W - 72 - 62 - 18 - 122
    d.rounded_rectangle([si_x, 30, si_x+122, 80], radius=14, outline="#8FA1B5", width=2)
    d.text((si_x+61, 55), "Sign in", font=font(BOLD, 17), fill=INK, anchor="mm")
    sc = (W - 72 - 31, 55)
    d.ellipse([sc[0]-31, sc[1]-31, sc[0]+31, sc[1]+31], fill=WHITE, outline=LINE, width=2)
    f_eb = font(XBOLD, 13)
    tot = sum(d.textlength(ch, font=f_eb) + 2.8 for ch in eyebrow) - 2.8
    cx = W/2 - tot/2
    for ch in eyebrow:
        d.text((cx, 108), ch, font=f_eb, fill=LABEL, anchor="la"); cx += d.textlength(ch, font=f_eb) + 2.8
    d.text((W/2, 132), title, font=font(BLACK, 42), fill=INK, anchor="ma")
    d.text((W/2, 186), sub, font=font(REG, 16.5), fill=SLATE, anchor="ma")

def col_heading(d, x, y, s):
    f = font(XBOLD, 13); cx = x
    for ch in s:
        d.text((cx, y), ch, font=f, fill=LABEL, anchor="la"); cx += d.textlength(ch, font=f) + 2.6
    return y + 30

def step(d, x, y, num, lines, lh=27):
    d.text((x, y), num, font=font(XBOLD, 17), fill=CORAL, anchor="la")
    for i, s in enumerate(lines):
        d.text((x+30, y+i*lh), s, font=font(REG, 17), fill=INK2, anchor="la")
    return y + len(lines)*lh + 12

def score_row(d, x, y, w, label, val):
    d.text((x, y), label, font=font(REG, 16.5), fill=INK2, anchor="la")
    d.text((x+w, y), val, font=font(BOLD, 16.5), fill=INK, anchor="ra")
    d.line([x, y+32, x+w, y+32], fill=HAIR, width=1)
    return y + 44

def tip(d, x, y, w, head, body):
    d.text((x, y), head, font=font(BOLD, 16.5), fill=INK2, anchor="la")
    yy = y + 26
    for s in body:
        d.text((x, yy), s, font=font(REG, 16.5), fill=INK2, anchor="la"); yy += 25
    return yy + 10

def draw_board(d, bx, by, bw, stats, drawn):
    """drawn: dict pair_idx -> cells drawn count; None = endpoints only."""
    bh = bw + 118
    d.rounded_rectangle([bx, by, bx+bw, by+bh], radius=28, fill=BOARD)
    d.text((bx+30, by+22), "Connect", font=font(BOLD, 17), fill=INK2, anchor="la")
    r1 = "Round 1"
    d.text((bx+bw-30-d.textlength(r1, font=font(SEMI, 16)), by+23), r1, font=font(SEMI, 16), fill=SLATE, anchor="la")
    f_lab = font(BOLD, 12.5); n = len(stats)
    for i, (lab, val) in enumerate(stats):
        ccx = bx + bw*(i+0.5)/n
        wl = d.textlength(lab, font=f_lab) + 3.0*(len(lab)-1); cx = ccx - wl/2
        for ch in lab:
            d.text((cx, by+58), ch, font=f_lab, fill=LABEL, anchor="la"); cx += d.textlength(ch, font=f_lab) + 3.0
        d.text((ccx, by+82), val, font=font(XBLACK, 29), fill=INK, anchor="ma")
    gap = 8; gx = bx + 34; gy = by + 138; gw = bw - 68; cell = (gw - 5*gap)/6
    centres = {}
    for r in range(6):
        for c in range(6):
            x0, y0 = gx + c*(cell+gap), gy + r*(cell+gap)
            d.rounded_rectangle([x0, y0, x0+cell, y0+cell], radius=12, fill=CELL)
            centres[(r, c)] = (x0+cell/2, y0+cell/2)
    if drawn:
        lw = int(cell*0.34)
        for pi, cnt in drawn.items():
            col, kind, cells = PAIRS[pi]
            pts = [centres[cell_rc] for cell_rc in cells[:cnt]]
            if len(pts) > 1:
                d.line(pts, fill=blend(col, t=0.45), width=lw, joint="curve")
                for px, py in pts:
                    d.ellipse([px-lw/2, py-lw/2, px+lw/2, py+lw/2], fill=blend(col, t=0.45))
    for col, kind, cells in PAIRS:
        for cell_rc in (cells[0], cells[-1]):
            cx, cy = centres[cell_rc]; rr = cell*0.36
            d.ellipse([cx-rr, cy-rr, cx+rr, cy+rr], fill=col)
            symbol(d, kind, cx, cy, rr*0.45, WHITE, w=4)
    d.text((bx+30, by+bh-40), "Playing on this device", font=font(MED, 14.5), fill=SLATE, anchor="la")
    return bh

def help_buttons(d, cx, y):
    f = font(BOLD, 15.5)
    for i, lab in enumerate(["How to play", "Scoring & tips"]):
        w = d.textlength(lab, font=f) + 44; x0 = cx - (w*2 + 14)/2 + i*(w+14)
        d.rounded_rectangle([x0, y, x0+w, y+46], radius=12, outline="#8FA1B5", width=2, fill=WHITE)
        d.text((x0+w/2, y+23), lab, font=f, fill=INK, anchor="mm")

W, H = 1920, 1080
# ---------- Desktop BEFORE ----------
img = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(img)
header(d, W, "Connect", "PLAY THE FREE CONNECT PUZZLE ONLINE",
       "Join the matching dots, fill the grid, beat your high score.")
draw_board(d, 660, 235, 600, [("SCORE", "0"), ("PAIRS", "0 / 6"), ("FILLED", "0%")], None)
x = 110; y = col_heading(d, x, 245, "HOW TO PLAY")
y = step(d, x, y, "1", ["Drag from a dot to start its path.", "Reach the matching dot to connect."])
y = step(d, x, y, "2", ["Paths run up, down, left and right,", "and can never share a cell."])
y = step(d, x, y, "3", ["Fill every cell on the grid", "to finish the round."])
y += 16; y = col_heading(d, x, y, "SCORING")
for lab, val in [("Connect a pair", "+200"), ("Complete the grid", "+1,000"),
                 ("Time bonus, per second under par", "+10"), ("Redraw a connected pair", "-50")]:
    y = score_row(d, x, y, 400, lab, val)
x = 1410; y = col_heading(d, x, 245, "TIPS")
y = tip(d, x, y, 400, "Start at the edges.", ["Paths along the wall have", "fewer ways to go wrong."])
y = tip(d, x, y, 400, "Leave a way through.", ["Check you are not sealing", "another dot inside your path."])
y = tip(d, x, y, 400, "Fill is the finish.", ["A pair that leaves empty cells", "behind it will need redrawing."])
y += 22
d.text((x, y), "Or let Morphi deal you a surprise", font=font(MED, 16.5), fill=INK2, anchor="la")
d.line([x, y+26, x+d.textlength("Or let Morphi deal you a surprise", font=font(MED, 16.5)), y+26], fill=INK2, width=1)
d.text((W/2, H-42), "Privacy · Terms", font=font(MED, 15), fill=SLATE, anchor="ma")
img.save(os.path.join(OUT, "flow-connect-desktop-before.png"))

# ---------- Desktop DURING ----------
img = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(img)
header(d, W, "Connect", "PLAY THE FREE CONNECT PUZZLE ONLINE",
       "Join the matching dots, fill the grid, beat your high score.")
bh = draw_board(d, 640, 218, 640, [("SCORE", "400"), ("PAIRS", "2 / 6"), ("FILLED", "53%")], DURING)
help_buttons(d, W/2, 218 + bh + 20)
img.save(os.path.join(OUT, "flow-connect-desktop-during.png"))

# ---------- Mobile DURING ----------
MW, MH = 780, 1688
img = Image.new("RGB", (MW, MH), BG); d = ImageDraw.Draw(img)
f_logo = font(BLACK, 40)
x = 48
for s, col in [("Morphi", INK), (".", CORAL), ("One", INK)]:
    d.text((x, 52), s, font=f_logo, fill=col, anchor="la"); x += d.textlength(s, font=f_logo)
d.text((MW/2, 150), "Connect", font=font(BLACK, 46), fill=INK, anchor="ma")
bh = draw_board(d, 40, 230, 700, [("SCORE", "400"), ("PAIRS", "2 / 6"), ("FILLED", "53%")], DURING)
help_buttons(d, MW/2, 230 + bh + 34)
d.text((MW/2, MH-58), "Privacy · Terms", font=font(MED, 17), fill=SLATE, anchor="ma")
img.save(os.path.join(OUT, "flow-connect-mobile-during.png"))
print("renders done")
