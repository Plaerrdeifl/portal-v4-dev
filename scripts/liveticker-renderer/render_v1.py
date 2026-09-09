#!/usr/bin/env python3
from __future__ import annotations
import argparse, base64, hashlib, json, mimetypes, os, struct, subprocess
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
    e.text='' if value is None else str(value)

def hide(root,id_):
    e=find(root,id_)
    if e is not None: e.set('display','none')

def data_uri(path:Path):
    mime,_=mimetypes.guess_type(str(path)); mime=mime or 'application/octet-stream'
    return f'data:{mime};base64,'+base64.b64encode(path.read_bytes()).decode('ascii')

def inject_background(root,fmt):
    path=BACKGROUND[fmt]
    if not path.is_file(): return False
    g=find(root,'background_image')
    if g is None: raise RuntimeError('missing background_image group')
    for child in list(g): g.remove(child)
    w,h=EXPECTED[fmt]
    img=ET.Element(q('image'),{'x':'0','y':'0','width':str(w),'height':str(h),'preserveAspectRatio':'xMidYMid slice','href':data_uri(path)})
    g.append(img)
    placeholder=find(root,'background_placeholder')
    if placeholder is not None: placeholder.set('display','none')
    return True

def inject_logo(root,id_,path:Path):
    g=find(root,id_)
    if g is None: raise RuntimeError(f'missing logo group: {id_}')
    for child in list(g): g.remove(child)
    box={('POST','logo_home'):(118,430,230,230),('POST','logo_away'):(906,430,230,230),('STORY','logo_home'):(62,430,220,220),('STORY','logo_away'):(659,430,220,220)}[(CURRENT_FORMAT,id_)]
    x,y,w,h=box
    img=ET.Element(q('image'),{'x':str(x),'y':str(y),'width':str(w),'height':str(h),'preserveAspectRatio':'xMidYMid meet','href':data_uri(path)})
    g.append(img)

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
    for i in range(1,7): set_text(root,f'our_goals_line_{i}',lines[i-1] if i<=len(lines) else '')

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
    if len(data)<200 or len(data)>524288: raise RuntimeError(f'invalid template size: {fmt}')
    if hashlib.sha256(data).hexdigest()!=sha256: raise RuntimeError(f'template checksum mismatch: {fmt}')
    return ET.ElementTree(ET.fromstring(svg_text))

def render_one(state,kind,fmt,outdir):
    global CURRENT_FORMAT
    CURRENT_FORMAT=fmt
    tree=snapshot_template_tree(state,fmt); root=tree.getroot()
    background_applied=inject_background(root,fmt)
    our,opp,suffix=score_scope(state['history'],kind)
    set_text(root,'headline','ENDERGEBNIS' if kind=='FINAL' else 'ZWISCHENSTAND')
    if kind=='FINAL':
        set_text(root,'subheadline',state.get('competitionLabel','')); set_text(root,'result_suffix',suffix); set_text(root,'series_info',state.get('seriesInfo',''))
        if not state.get('seriesInfo'): hide(root,'series_ribbon')
    else: set_text(root,'period_label','1. DRITTEL' if kind=='PERIOD_1' else '2. DRITTEL')
    set_text(root,'home_score',our); set_text(root,'away_score',opp); set_text(root,'our_goals_heading','UNSERE TORE')
    lines=goal_lines(state['history'],kind); apply_lines(root,lines)
    inject_logo(root,'logo_home',Path(state['ourTeam']['logoPath'])); inject_logo(root,'logo_away',Path(state['opponentTeam']['logoPath']))
    stem=f"{kind.lower()}-{fmt.lower()}"; svg=outdir/f'{stem}.svg'; png=outdir/f'{stem}.png'
    tree.write(svg,encoding='utf-8',xml_declaration=True)
    cmd=['docker','run','--rm','--network','none','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=256','--user',f'{os.getuid()}:{os.getgid()}','-e','HOME=/tmp','-v',f'{outdir}:/work','-v',f'{FONT_DIR}:/usr/share/fonts/truetype/plaerrdeifl:ro','--entrypoint','inkscape',RENDERER,f'/work/{svg.name}','--export-type=png',f'--export-filename=/work/{png.name}']
    r=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=180)
    if r.returncode: raise RuntimeError(f'inkscape failed {stem}: {r.stderr[-1000:]}')
    if png_dims(png)!=EXPECTED[fmt]: raise RuntimeError(f'bad dimensions {stem}: {png_dims(png)}')
    return {'kind':kind,'format':fmt,'svg':str(svg),'png':str(png),'score':f'{our}:{opp}','suffix':suffix,'goalLines':lines,'bytes':png.stat().st_size,'backgroundApplied':background_applied}

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('state'); ap.add_argument('--out',required=True); args=ap.parse_args()
    state=json.loads(Path(args.state).read_text(encoding='utf-8'))
    out=Path(args.out); out.mkdir(parents=True,exist_ok=True)
    kind=str(state.get('kind') or '').upper()
    if kind not in ('PERIOD_1','PERIOD_2','FINAL'): raise RuntimeError('invalid graphic kind')
    results=[]
    for fmt in ('POST','STORY'): results.append(render_one(state,kind,fmt,out))
    (out/'manifest.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(results,ensure_ascii=False,indent=2))
if __name__=='__main__': main()
