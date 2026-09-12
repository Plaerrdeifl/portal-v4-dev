#!/usr/bin/env python3
from __future__ import annotations
import argparse, base64, hashlib, json, mimetypes, os, re, struct, subprocess
from collections import OrderedDict
from pathlib import Path
import xml.etree.ElementTree as ET

SVG_NS='http://www.w3.org/2000/svg'
ET.register_namespace('', SVG_NS)
RENDERER='lscr.io/linuxserver/inkscape:1.4.2-r8-ls94@sha256:4d651665d4e3471a8d59d970e9841d50369baf1c4daa6df206f31caf163c4b22'
ROOT=Path('/srv/docker/liveticker')
FONT_DIR=Path('/srv/docker/m340/fonts')
TEMPLATES={
 ('PERIOD_1','POST'):ROOT/'templates/period-post.svg',
 ('PERIOD_1','STORY'):ROOT/'templates/period-story.svg',
 ('PERIOD_2','POST'):ROOT/'templates/period-post.svg',
 ('PERIOD_2','STORY'):ROOT/'templates/period-story.svg',
 ('FINAL','POST'):ROOT/'templates/final-post.svg',
 ('FINAL','STORY'):ROOT/'templates/final-story.svg',
}
EXPECTED={'POST':(1254,1254),'STORY':(941,1672)}
BACKGROUND={'POST':ROOT/'assets/backgrounds/post-background.jpg','STORY':ROOT/'assets/backgrounds/story-background.jpg'}
LOGO_HEIGHT={'POST':200.0,'STORY':200.0}
LOGO_TRIMMER=Path(__file__).with_name('trim_logo.py')
OUR={'mighty','our','mighty_dogs','home_club'}
OPP={'opponent','away','guest','other'}

def q(tag): return f'{{{SVG_NS}}}{tag}'
def find(root,id_):
    for e in root.iter():
        if e.get('id')==id_: return e
    return None

def set_text(root,id_,value):
    e=find(root,id_)
    if e is None: raise RuntimeError(f'missing id: {id_}')
    text='' if value is None else str(value)
    tspans=[child for child in list(e) if child.tag==q('tspan')]
    if tspans:
        e.text=None
        tspans[0].text=text
        for child in tspans[1:]: child.text=''
    else:
        e.text=text

def hide(root,id_):
    e=find(root,id_)
    if e is not None: e.set('display','none')

def data_uri(path:Path):
    mime,_=mimetypes.guess_type(str(path)); mime=mime or 'application/octet-stream'
    return f'data:{mime};base64,'+base64.b64encode(path.read_bytes()).decode('ascii')

def inject_background(root,fmt):
    g=find(root,'background_image')
    if g is None: raise RuntimeError('missing background_image group')
    placeholder=find(root,'background_placeholder')
    for child in list(g):
        href=child.get('href') or child.get('{http://www.w3.org/1999/xlink}href') or ''
        if child.tag==q('image') and str(href).startswith('data:image/'):
            if placeholder is not None: placeholder.set('display','none')
            return True
    path=BACKGROUND[fmt]
    if not path.is_file(): return False
    for child in list(g): g.remove(child)
    w,h=EXPECTED[fmt]
    img=ET.Element(q('image'),{'x':'0','y':'0','width':str(w),'height':str(h),'preserveAspectRatio':'xMidYMid slice','href':data_uri(path)})
    g.append(img)
    if placeholder is not None: placeholder.set('display','none')
    return True

def transform_point(value,x,y):
    value=str(value or '').strip()
    if not value: return x,y
    m=re.fullmatch(r'translate\(\s*([-+0-9.eE]+)(?:[ ,]+([-+0-9.eE]+))?\s*\)',value)
    if m:
        return x+float(m.group(1)),y+float(m.group(2) or 0)
    m=re.fullmatch(r'matrix\(\s*([-+0-9.eE]+)[ ,]+([-+0-9.eE]+)[ ,]+([-+0-9.eE]+)[ ,]+([-+0-9.eE]+)[ ,]+([-+0-9.eE]+)[ ,]+([-+0-9.eE]+)\s*\)',value)
    if m:
        a,b,c,d,e,f=map(float,m.groups())
        return a*x+c*y+e,b*x+d*y+f
    raise RuntimeError(f'unsupported logo transform: {value}')

def logo_anchor(root,id_):
    g=find(root,id_)
    if g is None: raise RuntimeError(f'missing logo group: {id_}')
    anchor=next((child for child in list(g) if child.tag==q('image')),None)
    if anchor is None: raise RuntimeError(f'missing logo anchor image: {id_}')
    try:
        x=float(anchor.get('x','0')); y=float(anchor.get('y','0'))
        w=float(anchor.get('width','0')); h=float(anchor.get('height','0'))
    except ValueError as exc:
        raise RuntimeError(f'invalid logo anchor geometry: {id_}') from exc
    if w<=0 or h<=0: raise RuntimeError(f'invalid logo anchor geometry: {id_}')
    cx,cy=transform_point(g.get('transform'),x+w/2,y+h/2)
    g.attrib.pop('transform',None)
    for child in list(g): g.remove(child)
    return g,cx,cy

def inject_logo(root,id_,path:Path):
    if not path.is_file(): raise RuntimeError(f'missing normalized logo: {path}')
    src_w,src_h=png_dims(path)
    if src_w<=0 or src_h<=0: raise RuntimeError(f'invalid normalized logo: {path}')
    g,cx,cy=logo_anchor(root,id_)
    h=LOGO_HEIGHT[CURRENT_FORMAT]
    w=h*src_w/src_h
    x=cx-w/2; y=cy-h/2
    img=ET.Element(q('image'),{
        'x':f'{x:.6f}','y':f'{y:.6f}','width':f'{w:.6f}','height':f'{h:.6f}',
        'preserveAspectRatio':'xMidYMid meet','href':data_uri(path)
    })
    g.append(img)

def normalize_logo_assets(state,outdir):
    home=Path(state['ourTeam']['logoPath']).resolve()
    away=Path(state['opponentTeam']['logoPath']).resolve()
    if not home.is_file() or not away.is_file(): raise RuntimeError('logo source missing')
    if not LOGO_TRIMMER.is_file(): raise RuntimeError('logo trimmer missing')
    target=outdir/'normalized-logos'; target.mkdir(parents=True,exist_ok=True)
    home_out=target/'home.png'; away_out=target/'away.png'
    cmd=[
        'docker','run','--rm','--network','none','--cap-drop=ALL','--security-opt=no-new-privileges',
        '--pids-limit=128','--user',f'{os.getuid()}:{os.getgid()}','-e','HOME=/tmp',
        '-v',f'{home}:/input/home:ro','-v',f'{away}:/input/away:ro',
        '-v',f'{target}:/out','-v',f'{LOGO_TRIMMER}:/trim_logo.py:ro',
        '--entrypoint','python3',RENDERER,'/trim_logo.py','/input/home','/out/home.png','/input/away','/out/away.png'
    ]
    r=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=90)
    if r.returncode: raise RuntimeError(f'logo normalization failed: {r.stderr[-800:]}')
    if not home_out.is_file() or not away_out.is_file(): raise RuntimeError('logo normalization output missing')
    state['ourTeam']['logoPath']=str(home_out)
    state['opponentTeam']['logoPath']=str(away_out)

def score_scope(history,kind):
    max_min={'PERIOD_1':20,'PERIOD_2':40,'FINAL':None}[kind]
    our=opp=0
    for ev in history:
        if ev.get('type')!='goal': continue
        try: minute=int(ev.get('minute',0))
        except: continue
        if max_min is not None and minute>max_min: continue
        team=str(ev.get('team','')).lower()
        if team in OUR: our+=1
        elif team in OPP: opp+=1
    suffix=''
    if kind=='FINAL':
        shoot=[e for e in history if e.get('type')=='shootout']
        if shoot:
            so_our=sum(1 for e in shoot if str(e.get('team','')).lower() in OUR and e.get('result')=='scored')
            so_opp=sum(1 for e in shoot if str(e.get('team','')).lower() in OPP and e.get('result')=='scored')
            if so_our!=so_opp:
                if so_our>so_opp: our+=1
                else: opp+=1
                suffix='n.P.'
        elif any(e.get('type')=='goal' and int(e.get('minute',0) or 0)>60 for e in history): suffix='n.V.'
    return our,opp,suffix

def minute_label(ev):
    if ev.get('minuteDisplay'): return str(ev['minuteDisplay'])
    try: m=int(ev.get('minute',0))
    except: return '?'
    if m<=60: return str(m)
    return f'60+{m-60}'

def short_player_name(player):
    if not isinstance(player,dict): return 'Spieler'
    explicit=str(player.get('displayName') or '').strip()
    if explicit: return explicit
    full=str(player.get('name') or '').strip()
    return full.split()[-1] if full else 'Spieler'

def minute_sort_value(ev):
    try: return int(ev.get('minute',0))
    except: return 10**9

def goal_lines(history,kind):
    max_min={'PERIOD_1':20,'PERIOD_2':40,'FINAL':None}[kind]
    grouped=OrderedDict()
    for ev in sorted(history,key=minute_sort_value):
        if ev.get('type')!='goal' or str(ev.get('team','')).lower() not in OUR: continue
        try: minute=int(ev.get('minute',0))
        except: continue
        if max_min is not None and minute>max_min: continue
        p=ev.get('player') or {}
        number=str(p.get('number') or '').strip(); name=short_player_name(p)
        key=str(p.get('id') or f'{number}|{name}')
        if key not in grouped: grouped[key]={'number':number,'name':name,'mins':[]}
        grouped[key]['mins'].append(minute_label(ev))
    out=[]
    for d in grouped.values():
        who=f"#{d['number']} {d['name']}" if d['number'] else d['name']
        out.append(f"{who} | {', '.join(d['mins'])}")
    return out

def apply_lines(root,lines):
    for i in range(1,11): set_text(root,f'our_goals_line_{i}',lines[i-1] if i<=len(lines) else '')

def apply_goal_block(root,lines,fmt):
    set_text(root,'our_goals_heading','UNSERE TORE' if lines else '')
    apply_lines(root,lines)
    if fmt=='STORY' and lines: center_goal_block(root,lines)

def numeric_y(element):
    if element is None: return None
    for node in (element,*list(element.iter())[1:]):
        raw=str(node.get('y') or '').strip()
        if not raw: continue
        try: return float(raw.split()[0].split(',')[0])
        except ValueError: continue
    return None

def shift_y(element,delta):
    if element is None or abs(delta)<0.000001: return
    for node in element.iter():
        raw=str(node.get('y') or '').strip()
        if not raw: continue
        parts=re.split(r'([,\s]+)',raw)
        changed=False
        for i in range(0,len(parts),2):
            if not parts[i]: continue
            try:
                parts[i]=f'{float(parts[i])+delta:.6f}'.rstrip('0').rstrip('.')
                changed=True
            except ValueError:
                pass
        if changed: node.set('y',''.join(parts))

def center_goal_block(root,lines):
    heading=find(root,'our_goals_heading'); final_anchor=find(root,'our_goals_line_10')
    top=numeric_y(heading); bottom=numeric_y(final_anchor)
    if top is None or bottom is None or bottom<=top: return
    used=min(len(lines),10)
    last=top if used==0 else numeric_y(find(root,f'our_goals_line_{used}'))
    if last is None or last<top or last>bottom: return
    delta=((top+bottom)/2)-((top+last)/2)
    shift_y(heading,delta)
    for i in range(1,used+1): shift_y(find(root,f'our_goals_line_{i}'),delta)

def png_dims(path:Path):
    b=path.read_bytes()[:24]
    if not b.startswith(b'\x89PNG\r\n\x1a\n'): raise RuntimeError('not png')
    return struct.unpack('>II',b[16:24])

def snapshot_template_tree(state,fmt):
    templates=state.get('graphicTemplates')
    key='post' if fmt=='POST' else 'story'
    template=templates.get(key) if isinstance(templates,dict) else None
    if not isinstance(template,dict): raise RuntimeError(f'missing template snapshot: {fmt}')
    svg_text=template.get('svgText'); sha256=str(template.get('sha256') or '').lower()
    if not isinstance(svg_text,str): raise RuntimeError(f'invalid template snapshot: {fmt}')
    data=svg_text.encode('utf-8')
    if len(data)<200 or len(data)>1048576: raise RuntimeError(f'invalid template size: {fmt}')
    if hashlib.sha256(data).hexdigest()!=sha256: raise RuntimeError(f'template checksum mismatch: {fmt}')
    return ET.ElementTree(ET.fromstring(svg_text))

def visual_sides(state,our,opp):
    home_away=str(state.get('homeAway') or '').upper()
    if home_away=='HOME':
        return our,opp,state['ourTeam'],state['opponentTeam']
    if home_away=='AWAY':
        return opp,our,state['opponentTeam'],state['ourTeam']
    raise RuntimeError('invalid homeAway')

def render_one(state,kind,fmt,outdir):
    global CURRENT_FORMAT
    CURRENT_FORMAT=fmt
    tree=snapshot_template_tree(state,fmt); root=tree.getroot()
    background_applied=inject_background(root,fmt)
    our,opp,suffix=score_scope(state['history'],kind)
    set_text(root,'headline','ENDERGEBNIS' if kind=='FINAL' else 'ZWISCHENSTAND')
    set_text(root,'period_label','' if kind=='FINAL' else ('1. DRITTEL' if kind=='PERIOD_1' else '2. DRITTEL'))
    set_text(root,'result_suffix',suffix if kind=='FINAL' else '')
    home_score,away_score,home_team,away_team=visual_sides(state,our,opp)
    set_text(root,'home_score',home_score); set_text(root,'away_score',away_score)
    lines=goal_lines(state['history'],kind); apply_goal_block(root,lines,fmt)
    inject_logo(root,'logo_home',Path(home_team['logoPath'])); inject_logo(root,'logo_away',Path(away_team['logoPath']))
    stem=f"{kind.lower()}-{fmt.lower()}"; svg=outdir/f'{stem}.svg'; png=outdir/f'{stem}.png'
    tree.write(svg,encoding='utf-8',xml_declaration=True)
    cmd=['docker','run','--rm','--network','none','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=256','--user',f'{os.getuid()}:{os.getgid()}','-e','HOME=/tmp','-v',f'{outdir}:/work','-v',f'{FONT_DIR}:/usr/share/fonts/truetype/plaerrdeifl:ro','--entrypoint','inkscape',RENDERER,f'/work/{svg.name}','--export-type=png',f'--export-filename=/work/{png.name}']
    r=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=180)
    if r.returncode: raise RuntimeError(f'inkscape failed {stem}: {r.stderr[-1000:]}')
    if png_dims(png)!=EXPECTED[fmt]: raise RuntimeError(f'bad dimensions {stem}: {png_dims(png)}')
    return {'kind':kind,'format':fmt,'svg':str(svg),'png':str(png),'score':f'{home_score}:{away_score}','suffix':suffix,'goalLines':lines,'bytes':png.stat().st_size,'backgroundApplied':background_applied}

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('state'); ap.add_argument('--out',required=True); args=ap.parse_args()
    state=json.loads(Path(args.state).read_text(encoding='utf-8'))
    out=Path(args.out); out.mkdir(parents=True,exist_ok=True)
    normalize_logo_assets(state,out)
    kind=str(state.get('kind') or '').upper()
    if kind not in ('PERIOD_1','PERIOD_2','FINAL'): raise RuntimeError('invalid graphic kind')
    results=[]
    for fmt in ('POST','STORY'): results.append(render_one(state,kind,fmt,out))
    (out/'manifest.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(results,ensure_ascii=False,indent=2))
if __name__=='__main__': main()
