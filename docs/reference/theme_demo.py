# Prototype of the recipe-based theme generator (OKLCH recipes + checks). Demo only, not production code.
import random, math, itertools, json, sys
def srgb_enc(c): return 12.92*c if c<=0.0031308 else 1.055*c**(1/2.4)-0.055
def oklch(L,C,h):
    while True:
        a=C*math.cos(math.radians(h)); b=C*math.sin(math.radians(h))
        l=(L+0.3963377774*a+0.2158037573*b)**3; m=(L-0.1055613458*a-0.0638541728*b)**3; s=(L-0.0894841775*a-1.2914855480*b)**3
        rgb=[4.0767416621*l-3.3077115913*m+0.2309699292*s,-1.2684380046*l+2.6097574011*m-0.3413193965*s,-0.0041960863*l-0.7034186147*m+1.7076147010*s]
        if all(-0.0005<=x<=1.0005 for x in rgb) or C<=0.002: break
        C-=0.004
    return '#'+''.join(f'{round(min(1,max(0,srgb_enc(max(0,x))))*255):02X}' for x in rgb)
def h2r(h): h=h.lstrip('#'); return [int(h[i:i+2],16)/255 for i in (0,2,4)]
def lin(c): return c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4
def lum(h): r,g,b=[lin(x) for x in h2r(h)]; return 0.2126*r+0.7152*g+0.0722*b
def cr(a,b):
    x,y=lum(a),lum(b); x,y=max(x,y),min(x,y); return (x+0.05)/(y+0.05)
M={'protan':[[0.152286,1.052583,-0.204868],[0.114503,0.786281,0.099216],[-0.003882,-0.048116,1.051998]],
   'deutan':[[0.367322,0.860646,-0.227968],[0.280085,0.672501,0.047413],[-0.011820,0.042940,0.968881]],
   'tritan':[[1.255528,-0.076749,-0.178779],[-0.078411,0.930809,0.147602],[0.004733,0.691367,0.303900]]}
def lab(rgb):
    r,g,b=rgb; X=(0.4124*r+0.3576*g+0.1805*b)/0.95047; Y=0.2126*r+0.7152*g+0.0722*b; Z=(0.0193*r+0.1192*g+0.9505*b)/1.08883
    f=lambda t: t**(1/3) if t>0.008856 else 7.787*t+16/116
    return (116*f(Y)-16,500*(f(X)-f(Y)),200*(f(Y)-f(Z)))
def sim(h,m):
    v=[lin(x) for x in h2r(h)]; return [min(1,max(0,sum(m[i][j]*v[j] for j in range(3)))) for i in range(3)]
def mind(a,b):
    v=[math.dist(lab([lin(x) for x in h2r(a)]),lab([lin(x) for x in h2r(b)]))]
    v+= [math.dist(lab(sim(a,m)),lab(sim(b,m))) for m in M.values()]
    return min(v)
RECIPES={'analogous':[0,34,68],'complementary':[0,180,40],'triadic':[0,120,240],'split':[0,150,210],'mono+accent':[0,0,180],'tetradic':[0,90,180]}
STYLES=['flat','outlined','duo','ink','soft','blocky']
GRIDS=[(3,4),(4,4),(4,3),(3,3)]
FAMS=['tri','square','hex','star5','star7','ring','cross','petal4','petal6','half','drop','leaf']
def solve_L(C,h,target):
    lo,hi=0.2,0.85
    for _ in range(24):
        mid=(lo+hi)/2
        if cr(oklch(mid,C,h),'#FFFFFF')>target: lo=mid
        else: hi=mid
    return oklch((lo+hi)/2,C,h)
REASONS={}
def try_theme(rng):
    rec=rng.choice(list(RECIPES)); base=rng.uniform(0,360); st=rng.choice(STYLES)
    targets=[3.3,5.5,9.0]; rng.shuffle(targets)
    cols=[solve_L(rng.uniform(0.13,0.19),(base+off+rng.uniform(-14,14))%360,t) for off,t in zip(RECIPES[rec],targets)]
    bg=oklch(rng.uniform(0.955,0.985),rng.uniform(0.012,0.03),base)
    back=oklch(rng.uniform(0.60,0.80),rng.uniform(0.05,0.11),(base+rng.choice([0,0,30,-30]))%360)
    if st=='ink': back=oklch(0.34,0.03,base)
    m_sym=min(cr(c,'#FFFFFF') for c in cols); m_back=cr(back,bg); m_cvd=min(mind(a,b) for a,b in itertools.combinations(cols,2))
    bad=[n for n,okk in (('symbol-contrast',m_sym>=3.15),('back-vs-bg',m_back>=1.55),('color-blind',m_cvd>=22)) if not okk]
    for n in bad: REASONS[n]=REASONS.get(n,0)+1
    return (not bad),dict(rec=rec,base=base,style=st,cols=cols,bg=bg,back=back,sym=m_sym,bk=m_back,cvd=m_cvd)
def make(seed,maxtries=8):
    rng=random.Random(seed)
    for t in range(1,maxtries+1):
        ok,th=try_theme(rng)
        if ok:
            th['tries']=t; th['seed']=seed; th['rng']=rng; th['fallback']=False; return th
    th['tries']=maxtries; th['seed']=seed; th['rng']=rng; th['fallback']=True; return th
def symbol(fam,col,outline,rot=0):
    st=f'fill="none" stroke="{col}" stroke-width="2.6" stroke-linejoin="round"' if outline else f'fill="{col}" stroke="{col}" stroke-width="1.8" stroke-linejoin="round"'
    def poly(n,r=8.6,ph=-90):
        pts=' '.join(f'{12+r*math.cos(math.radians(ph+360*i/n)):.1f},{12+r*math.sin(math.radians(ph+360*i/n)):.1f}' for i in range(n)); return f'<polygon points="{pts}" {st}/>'
    def star(k):
        pts=[]
        for i in range(2*k):
            r=9 if i%2==0 else 4.2; a=math.radians(-90+180*i/k); pts.append(f'{12+r*math.cos(a):.1f},{12+r*math.sin(a):.1f}')
        return f'<polygon points="{" ".join(pts)}" {st}/>'
    if fam=='tri': return poly(3,9.5)
    if fam=='square': return poly(4,9.2,-45)
    if fam=='hex': return poly(6,9)
    if fam=='star5': return star(5)
    if fam=='star7': return star(7)
    if fam=='ring': return f'<circle cx="12" cy="12" r="7.5" fill="none" stroke="{col}" stroke-width="4"/>'
    if fam=='cross': return f'<path d="M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6z" {st}/>'
    if fam.startswith('petal'):
        n=int(fam[-1]); cs=''.join(f'<circle cx="{12+6*math.cos(2*math.pi*i/n):.1f}" cy="{12+6*math.sin(2*math.pi*i/n):.1f}" r="4.3" fill="{col}"/>' for i in range(n)); return cs+f'<circle cx="12" cy="12" r="2.4" fill="#fff"/>'
    if fam=='half': return f'<path d="M3.5 17a8.5 8.5 0 0117 0z" {st}/>'
    if fam=='drop': return f'<path d="M12 3c4 5 6 8 6 11a6 6 0 01-12 0c0-3 2-6 6-11z" {st}/>'
    if fam=='leaf': return f'<path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15z" {st}/>'
DECOR=['none','blobs','symbols','lines','dots','waves']
def faint(base,bg):
    for L in [0.95,0.94,0.93,0.92,0.91,0.90,0.89,0.88,0.87,0.86]:
        c=oklch(L,0.04,base)
        if 1.10<=cr(c,bg)<=1.28: return c
    return oklch(0.9,0.03,base)
def decor_svg(kind,th,rng,i,fam,c):
    if kind=='blobs':
        pts=[(rng.uniform(0,70),rng.uniform(0,90),rng.uniform(60,110)),(rng.uniform(200,270),rng.uniform(250,340),rng.uniform(70,120)),(rng.uniform(-20,30),rng.uniform(200,300),rng.uniform(40,70))]
        return ''.join(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.0f}" fill="{c}"/>' for x,y,r in pts)
    if kind=='symbols':
        return f'<g transform="translate({rng.uniform(-30,10):.0f} {rng.uniform(-20,10):.0f}) rotate(12) scale(7)">{symbol(fam,c,False)}</g><g transform="translate({rng.uniform(200,235):.0f} {rng.uniform(260,290):.0f}) rotate(-15) scale(5)">{symbol(fam,c,True)}</g>'
    if kind=='lines':
        return f'<pattern id="l{i}" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="16" height="2.4" fill="{c}"/></pattern><rect width="270" height="340" fill="url(#l{i})"/>'
    if kind=='dots':
        return f'<pattern id="d{i}" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="9" cy="9" r="2.2" fill="{c}"/></pattern><rect width="270" height="340" fill="url(#d{i})"/>'
    if kind=='waves':
        return f'<path d="M0 290Q68 262 135 290T270 290V340H0Z" fill="{c}"/><path d="M0 40Q68 14 135 40T270 40V0H0Z" fill="{c}"/>'
    return ''
def panel(th,i):
    rng=th['rng']; cols_n,rows_n=rng.choice(GRIDS); st=th['style']; gap=10; W,H=230,300; x0,y0=20,26
    cw=(W-gap*(cols_n-1))/cols_n; aspect=rng.choice([1.0,1.15,1.3]); ch=min(cw*aspect,(H-gap*(rows_n-1))/rows_n)
    rx={'flat':12,'outlined':12,'duo':14,'ink':10,'soft':min(cw,ch)*0.34,'blocky':2}[st]
    back,bg,cols=th['back'],th['bg'],th['cols']
    edge=f' stroke="{cols[0]}" stroke-width="3"' if st=='outlined' else ''
    hair=oklch(0.9,0.02,th['base'])
    fams=rng.sample(FAMS,3); outl=[rng.random()<0.3 for _ in range(3)]
    kind=rng.choice(DECOR); fc=faint(th['base'],bg); dec=decor_svg(kind,th,rng,i,fams[0],fc)
    inner=f'<rect x="7" y="7" width="{cw-14:.1f}" height="{ch-14:.1f}" rx="{max(rx-5,2):.1f}" fill="{oklch(0.88,0.04,th["base"]) if st=="duo" else "none"}" opacity="0.45"/>' if st=='duo' else ''
    spots=[(0,0,0),(cols_n-1,0,1),(1,1,2),(0,rows_n-1,0)]
    ups=''
    for c,r,k in spots:
        x=x0+c*(cw+gap); y=y0+r*(ch+gap); s=min(cw,ch)*0.62
        face=f'<rect x="{x:.1f}" y="{y:.1f}" width="{cw:.1f}" height="{ch:.1f}" rx="{rx:.1f}" fill="#fff" stroke="{hair}" stroke-width="1.5"/>'
        ups+=face+f'<g transform="translate({x+cw/2-s/2:.1f} {y+ch/2-s/2:.1f}) scale({s/24:.3f})">{symbol(fams[k],cols[k],outl[k])}</g>'
    svg=(f'<svg width="270" height="340" viewBox="0 0 270 340" role="img" aria-label="Generated memory puzzle theme {i+1}" style="display:block;border-radius:24px;border:1.5px solid #E2E8F0">'
         f'<defs><pattern id="p{i}" width="{cw+gap:.1f}" height="{ch+gap:.1f}" patternUnits="userSpaceOnUse" x="{x0}" y="{y0}"><rect width="{cw:.1f}" height="{ch:.1f}" rx="{rx:.1f}" fill="{back}"{edge}/>{inner}</pattern></defs>'
         f'<rect width="270" height="340" fill="{bg}"/>{dec}<rect x="{x0}" y="{y0}" width="{cols_n*(cw+gap):.1f}" height="{rows_n*(ch+gap):.1f}" fill="url(#p{i})"/>{ups}</svg>')
    label=f'Seed {th["seed"]} · {th["rec"]} · {st} · {kind} · {cols_n}×{rows_n}'
    stats=f'symbols {th["sym"]:.1f}:1 · back {th["bk"]:.1f}:1 · color-blind Δ{th["cvd"]:.0f} · tries {th["tries"]}'
    return svg,label,stats
if __name__=='__main__':
    # pass-rate statistics
    N=2000; fb=0; first=0; tr=[]
    for s in range(N):
        th=make(10000+s); fb+=th['fallback']; first+=(th['tries']==1); tr.append(th['tries'])
    print('fail reasons (per rejected candidate):',REASONS)
    print(f'seeds={N} first-try-pass={first/N:.1%} fallback-to-preset={fb/N:.2%} avg-tries={sum(tr)/N:.2f}')
    ths=[]; sd=101
    while len(ths)<12:
        t=make(sd); sd+=101
        if not t['fallback']: ths.append(t)
    items=[panel(t,i) for i,t in enumerate(ths)]
    out=[]
    for i,(svg,lab,stats) in enumerate(items):
        col,row=i%4,i//4; x=40+310*col; y=120+420*row
        out.append(f'<div style="position:absolute;left:{x}px;top:{y}px;width:270px">{svg}<div style="margin-top:10px;font-size:14px;font-weight:800">{lab}</div><div style="margin-top:2px;font-size:12px;font-weight:600;color:#5A667B">{stats}</div></div>')
    html=f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Generated themes</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;800;900&display=swap" rel="stylesheet">
<style>body{{margin:0}}</style>
</helmet>
<div style="width:1280px;height:1400px;box-sizing:border-box;position:relative;overflow:hidden;background:#F5F8FC;color:#1B2433;font-family:'Nunito',system-ui,sans-serif">
<div style="position:absolute;left:40px;top:24px;font-weight:900;font-size:28px">Generated themes: same puzzle, 12 seeds</div>
<div style="position:absolute;left:40px;top:62px;font-weight:600;font-size:15px;color:#5A667B;max-width:1100px">Each panel comes from a seed, a curated recipe, and a style family. Every palette passed the contrast and color-blind checks (numbers under each panel). Judge the taste: boring, chaotic, or just right?</div>
{chr(10).join(out)}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":1280,"height":1400}}}}'>
class Component extends DCLogic {{
renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
'''
    open(sys.argv[1],'w').write(html); print('html bytes',len(html)); print([ (t['rec'],t['style'],t['tries'],t['fallback']) for t in ths])
