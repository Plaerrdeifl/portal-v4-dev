#!/usr/bin/env python3
from __future__ import annotations
import argparse, base64, hashlib, json, mimetypes, multiprocessing, os, re, struct, subprocess
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
LOGO_HEIGHT={'POST':250.0,'STORY':200.0}
STORY_LOGO_EDGE_MIN=20.0
STORY_SCORE_LOGO_GAP=20.0
STORY_LOGO_MAX_WIDTH=250.0
LOGO_TRIMMER=Path(__file__).with_name('trim_logo.py')
OUR={'mighty','our','mighty_dogs','home_club'}
OPP={'opponent','away','guest','other'}
MAX_GOAL_LINES=7

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
    if CURRENT_FORMAT=='STORY' and w>STORY_LOGO_MAX_WIDTH:
        scale=STORY_LOGO_MAX_WIDTH/w
        w=STORY_LOGO_MAX_WIDTH
        h*=scale
    x=cx-w/2; y=cy-h/2
    img=ET.Element(q('image'),{
        'id':f'{id_}_image',
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
    return out[:MAX_GOAL_LINES]

def apply_lines(root,lines):
    for i in range(1,11): set_text(root,f'our_goals_line_{i}',lines[i-1] if i<=len(lines) else '')

def apply_goal_block(root,lines,fmt):
    set_text(root,'our_goals_heading','UNSERE TORE' if lines else '')
    apply_lines(root,lines)

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

def shift_x(element,delta):
    if element is None or abs(delta)<0.000001: return
    for node in element.iter():
        raw=str(node.get('x') or '').strip()
        if not raw: continue
        parts=re.split(r'([,\s]+)',raw)
        for i in range(0,len(parts),2):
            if not parts[i]: continue
            try: parts[i]=f'{float(parts[i])+delta:.6f}'.rstrip('0').rstrip('.')
            except ValueError: pass
        node.set('x',''.join(parts))

def logo_center_x(root,id_):
    g=find(root,id_)
    if g is None: raise RuntimeError(f'missing logo group: {id_}')
    anchor=next((child for child in list(g) if child.tag==q('image')),None)
    if anchor is None: raise RuntimeError(f'missing logo anchor image: {id_}')
    x=float(anchor.get('x','0')); y=float(anchor.get('y','0'))
    w=float(anchor.get('width','0')); h=float(anchor.get('height','0'))
    cx,_=transform_point(g.get('transform'),x+w/2,y+h/2)
    return cx

def numeric_x(element):
    if element is None: return None
    for node in element.iter():
        raw=str(node.get('x') or '').strip()
        if not raw: continue
        try: return float(raw.split()[0].split(',')[0])
        except ValueError: continue
    return None

def font_size_px(element,default):
    if element is None: return default
    raw=str(element.get('font-size') or '').strip().replace('px','')
    if raw:
        try: return float(raw)
        except ValueError: pass
    style=str(element.get('style') or '')
    m=re.search(r'font-size\s*:\s*([0-9.]+)',style)
    return float(m.group(1)) if m else default

def set_font_size_px(element,value):
    if element is None: return
    px=f'{value:.4f}px'
    style=str(element.get('style') or '')
    if re.search(r'font-size\s*:',style):
        element.set('style',re.sub(r'font-size\s*:\s*[-+0-9.eE]+(?:px)?',f'font-size:{px}',style))
    else:
        element.set('font-size',px)

def estimated_text_width(element):
    if element is None: return 0.0
    text=''.join(element.itertext()).strip()
    if not text: return 0.0
    default=53.7 if CURRENT_FORMAT=='POST' else 60.5
    return len(text)*font_size_px(element,default)*0.56

def visible_goal_ids(root):
    ids=[]
    heading=find(root,'our_goals_heading')
    if heading is not None and ''.join(heading.itertext()).strip(): ids.append('our_goals_heading')
    for i in range(1,11):
        id_=f'our_goals_line_{i}'; e=find(root,id_)
        if e is not None and ''.join(e.itertext()).strip(): ids.append(id_)
    return ids

def goal_block_bounds(root,ids):
    left=[]; right=[]; top=[]; bottom=[]
    for id_ in ids:
        e=find(root,id_); x=numeric_x(e); y=numeric_y(e)
        if x is None or y is None: continue
        default=46.0 if id_=='our_goals_heading' else (53.7 if CURRENT_FORMAT=='POST' else 36.0)
        size=font_size_px(e,default)
        left.append(x); right.append(x+estimated_text_width(e))
        top.append(y-size*0.88); bottom.append(y+size*0.22)
    if not left: return None
    return min(left),min(top),max(right),max(bottom)

def shift_goal_block(root,ids,dx=0.0,dy=0.0):
    for id_ in ids:
        e=find(root,id_)
        if dx: shift_x(e,dx)
        if dy: shift_y(e,dy)

def fit_goal_font_width(root,ids,max_width):
    base={}
    for id_ in ids:
        e=find(root,id_)
        default=46.0 if id_=='our_goals_heading' else (53.7 if CURRENT_FORMAT=='POST' else 36.0)
        base[id_]=font_size_px(e,default)
    chosen=1.0
    for factor in (1.0,0.95,0.90,0.85,0.80,0.75,0.70,0.65,0.60):
        for id_,size in base.items(): set_font_size_px(find(root,id_),size*factor)
        bounds=goal_block_bounds(root,ids)
        chosen=factor
        if bounds is None or bounds[2]-bounds[0]<=max_width: break
    return chosen

def place_story_goal_block(root,ids):
    if not ids: return
    canvas_w=941.0; margin=42.0
    # First keep the block safely inside the canvas. Exact centering happens
    # after the SVG has been written and Inkscape can report real glyph bounds.
    fit_goal_font_width(root,ids,canvas_w-2*margin)

def query_svg_bounds_map(svg:Path,outdir:Path,ids):
    cmd=[
        'docker','run','--rm','--network','none','--cap-drop=ALL','--security-opt=no-new-privileges',
        '--pids-limit=128','--user',f'{os.getuid()}:{os.getgid()}','-e','HOME=/tmp',
        '-v',f'{outdir}:/work:ro','-v',f'{FONT_DIR}:/usr/share/fonts/truetype/plaerrdeifl:ro',
        '--entrypoint','inkscape',RENDERER,f'/work/{svg.name}','--query-all'
    ]
    r=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=90)
    if r.returncode: raise RuntimeError(f'inkscape query failed: {r.stderr[-800:]}')
    wanted=set(ids); bounds={}
    for raw in r.stdout.splitlines():
        parts=raw.rsplit(',',4)
        if len(parts)!=5 or parts[0] not in wanted: continue
        try:
            x,y,w,h=map(float,parts[1:])
        except ValueError:
            continue
        if w>0 and h>0: bounds[parts[0]]=(x,y,x+w,y+h)
    return bounds

def query_svg_bounds(svg:Path,outdir:Path,ids):
    bounds=list(query_svg_bounds_map(svg,outdir,ids).values())
    if not bounds: return None
    return min(v[0] for v in bounds),min(v[1] for v in bounds),max(v[2] for v in bounds),max(v[3] for v in bounds)

def ensure_score_separator_id(root):
    separator=find(root,'score_separator')
    if separator is not None: return separator
    for node in root.iter(q('text')):
        if ''.join(node.itertext()).strip()==':':
            node.set('id','score_separator')
            return node
    raise RuntimeError('missing score separator')

def align_score_and_logos_exact(root,tree,svg:Path,outdir:Path,fmt):
    separator=ensure_score_separator_id(root)
    tree.write(svg,encoding='utf-8',xml_declaration=True)
    ids=[
        'home_score','score_separator','away_score',
        'logo_home_image','logo_away_image',
    ]
    bounds=query_svg_bounds_map(svg,outdir,ids)
    if any(id_ not in bounds for id_ in ids):
        raise RuntimeError('score/logo geometry query failed')

    home=bounds['home_score']; sep=bounds['score_separator']; away=bounds['away_score']
    target_x=EXPECTED[fmt][0]/2.0
    target_y=((home[1]+home[3])/2.0+(away[1]+away[3])/2.0)/2.0
    left_gap=max(0.0,sep[0]-home[2])
    right_gap=max(0.0,away[0]-sep[2])
    desired_gap=(left_gap+right_gap)/2.0
    dx_sep=target_x-(sep[0]+sep[2])/2.0
    dy_sep=target_y-(sep[1]+sep[3])/2.0
    shift_x(separator,dx_sep)
    shift_y(separator,dy_sep)
    shifted_sep=(sep[0]+dx_sep,sep[1]+dy_sep,sep[2]+dx_sep,sep[3]+dy_sep)

    logo_home=bounds['logo_home_image']; logo_away=bounds['logo_away_image']
    canvas_w=float(EXPECTED[fmt][0])
    left_margin=logo_home[0]
    right_margin=canvas_w-logo_away[2]
    logo_dx=(right_margin-left_margin)/2.0

    if fmt!='STORY':
        # POST intentionally keeps the existing geometry unchanged.
        shift_x(find(root,'home_score'),(shifted_sep[0]-desired_gap)-home[2])
        shift_x(find(root,'away_score'),(shifted_sep[2]+desired_gap)-away[0])
        shift_x(find(root,'logo_home_image'),logo_dx)
        shift_x(find(root,'logo_away_image'),logo_dx)
        tree.write(svg,encoding='utf-8',xml_declaration=True)
        return

    # STORY: keep equal edge margins, but move both logos outward when a
    # two-digit score needs more room. Only after that compress the equal
    # score-to-colon gap as much as necessary. This preserves the centered
    # colon and equal score spacing without ever pushing a score into a logo.
    equal_edge_margin=(left_margin+right_margin)/2.0
    equal_home_right=logo_home[2]+logo_dx
    equal_away_left=logo_away[0]+logo_dx
    home_width=home[2]-home[0]
    away_width=away[2]-away[0]

    desired_home_left=shifted_sep[0]-desired_gap-home_width
    desired_away_right=shifted_sep[2]+desired_gap+away_width
    need_home=max(0.0,equal_home_right+STORY_SCORE_LOGO_GAP-desired_home_left)
    need_away=max(0.0,desired_away_right+STORY_SCORE_LOGO_GAP-equal_away_left)
    max_outward=max(0.0,equal_edge_margin-STORY_LOGO_EDGE_MIN)
    outward=min(max(need_home,need_away),max_outward)

    home_logo_dx=logo_dx-outward
    away_logo_dx=logo_dx+outward
    final_home_right=logo_home[2]+home_logo_dx
    final_away_left=logo_away[0]+away_logo_dx

    max_gap_left=shifted_sep[0]-home_width-(final_home_right+STORY_SCORE_LOGO_GAP)
    max_gap_right=(final_away_left-STORY_SCORE_LOGO_GAP)-away_width-shifted_sep[2]
    available_gap=min(max_gap_left,max_gap_right)
    if available_gap<0:
        raise RuntimeError('story score does not fit between logos')
    gap=min(desired_gap,available_gap)

    shift_x(find(root,'home_score'),(shifted_sep[0]-gap)-home[2])
    shift_x(find(root,'away_score'),(shifted_sep[2]+gap)-away[0])
    shift_x(find(root,'logo_home_image'),home_logo_dx)
    shift_x(find(root,'logo_away_image'),away_logo_dx)
    tree.write(svg,encoding='utf-8',xml_declaration=True)

def bounds_union(bounds_by_id,ids):
    values=[bounds_by_id[id_] for id_ in ids if id_ in bounds_by_id]
    if not values: return None
    return (
        min(v[0] for v in values),min(v[1] for v in values),
        max(v[2] for v in values),max(v[3] for v in values),
    )

def center_story_goal_block_exact(root,tree,svg:Path,outdir:Path,ids):
    layout_ids=[
        *ids,
        'home_score','score_separator','away_score',
        'logo_home_image','logo_away_image','footer',
    ]
    bounds_by_id=query_svg_bounds_map(svg,outdir,layout_ids)
    bounds=bounds_union(bounds_by_id,ids)
    if bounds is None: return

    required=['home_score','score_separator','away_score','logo_home_image','logo_away_image','footer']
    if any(id_ not in bounds_by_id for id_ in required):
        raise RuntimeError('story goal area geometry query failed')

    score_region_bottom=max(bounds_by_id[id_][3] for id_ in required[:-1])
    footer_top=bounds_by_id['footer'][1]
    if footer_top<=score_region_bottom:
        raise RuntimeError('story goal area invalid')
    target_y=(score_region_bottom+footer_top)/2.0

    left,top,right,bottom=bounds
    max_width=941.0-84.0
    width=right-left
    if width>max_width:
        factor=max(0.60,max_width/width)
        for id_ in ids:
            e=find(root,id_)
            default=46.0 if id_=='our_goals_heading' else 36.0
            set_font_size_px(e,font_size_px(e,default)*factor)
        tree.write(svg,encoding='utf-8',xml_declaration=True)
        goal_bounds=query_svg_bounds_map(svg,outdir,ids)
        bounds=bounds_union(goal_bounds,ids)
        if bounds is None: return
        for id_,value in goal_bounds.items():
            bounds_by_id[id_]=value
        left,top,right,bottom=bounds

    # Keep the existing horizontal scorer layout semantics: center the scorer
    # lines as one content block and the heading independently above them.
    line_ids=[id_ for id_ in ids if id_.startswith('our_goals_line_')]
    line_bounds=bounds_union(bounds_by_id,line_ids)
    heading_bounds=bounds_by_id.get('our_goals_heading')
    target_x=941.0/2.0
    if line_bounds is not None:
        ll,lt,lr,lb=line_bounds
        dx_lines=target_x-(ll+lr)/2.0
        for id_ in line_ids:
            shift_x(find(root,id_),dx_lines)
        if heading_bounds is not None:
            hl,ht,hr,hb=heading_bounds
            shift_x(find(root,'our_goals_heading'),target_x-(hl+hr)/2.0)
    else:
        shift_goal_block(root,ids,target_x-(left+right)/2.0,0.0)

    # Vertically center the complete visible "UNSERE TORE" block in the
    # actual free STORY area between the score/logo row and the homepage footer.
    shift_goal_block(root,ids,0.0,target_y-(top+bottom)/2.0)
    tree.write(svg,encoding='utf-8',xml_declaration=True)

def place_post_goal_block(root,home_away,ids):
    if not ids: return
    right_limit=1254.0-36.0
    if str(home_away or '').upper()=='AWAY':
        shift_goal_block(root,ids,560.0,0.0)
        bounds=goal_block_bounds(root,ids)
        if bounds is not None and bounds[2]>right_limit:
            line_ids=ids[1:] if len(ids)>1 else ids
            line_left=min((numeric_x(find(root,id_)) for id_ in line_ids if numeric_x(find(root,id_)) is not None),default=bounds[0])
            pull=min(bounds[2]-right_limit,max(0.0,line_left-500.0))
            if pull>0: shift_goal_block(root,ids,-pull,0.0)
    bounds=goal_block_bounds(root,ids)
    if bounds is None: return
    if bounds[2]>right_limit:
        fit_goal_font_width(root,ids,max(1.0,right_limit-bounds[0]))
        bounds=goal_block_bounds(root,ids)
    if bounds is not None and bounds[2]>right_limit:
        shift_goal_block(root,ids,-(bounds[2]-right_limit),0.0)

def place_goal_block(root,home_away):
    ids=visible_goal_ids(root)
    if not ids: return
    if CURRENT_FORMAT=='STORY':
        place_story_goal_block(root,ids)
    else:
        place_post_goal_block(root,home_away,ids)

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
    place_goal_block(root,state.get('homeAway'))
    inject_logo(root,'logo_home',Path(home_team['logoPath'])); inject_logo(root,'logo_away',Path(away_team['logoPath']))
    stem=f"{kind.lower()}-{fmt.lower()}"; svg=outdir/f'{stem}.svg'; png=outdir/f'{stem}.png'
    tree.write(svg,encoding='utf-8',xml_declaration=True)
    align_score_and_logos_exact(root,tree,svg,outdir,fmt)
    if fmt=='STORY' and lines:
        center_story_goal_block_exact(root,tree,svg,outdir,visible_goal_ids(root))
    cmd=['docker','run','--rm','--network','none','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=256','--user',f'{os.getuid()}:{os.getgid()}','-e','HOME=/tmp','-v',f'{outdir}:/work','-v',f'{FONT_DIR}:/usr/share/fonts/truetype/plaerrdeifl:ro','--entrypoint','inkscape',RENDERER,f'/work/{svg.name}','--export-type=png',f'--export-filename=/work/{png.name}']
    r=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=180)
    if r.returncode: raise RuntimeError(f'inkscape failed {stem}: {r.stderr[-1000:]}')
    if png_dims(png)!=EXPECTED[fmt]: raise RuntimeError(f'bad dimensions {stem}: {png_dims(png)}')
    return {'kind':kind,'format':fmt,'svg':str(svg),'png':str(png),'score':f'{home_score}:{away_score}','suffix':suffix,'goalLines':lines,'bytes':png.stat().st_size,'backgroundApplied':background_applied}

def render_one_process(args):
    state,kind,fmt,outdir=args
    return render_one(state,kind,fmt,Path(outdir))

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('state'); ap.add_argument('--out',required=True); args=ap.parse_args()
    state=json.loads(Path(args.state).read_text(encoding='utf-8'))
    out=Path(args.out); out.mkdir(parents=True,exist_ok=True)
    normalize_logo_assets(state,out)
    kind=str(state.get('kind') or '').upper()
    if kind not in ('PERIOD_1','PERIOD_2','FINAL'): raise RuntimeError('invalid graphic kind')
    ctx=multiprocessing.get_context('fork')
    with ctx.Pool(processes=2) as pool:
        results=pool.map(render_one_process,[
            (state,kind,'POST',str(out)),
            (state,kind,'STORY',str(out)),
        ])
    (out/'manifest.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(results,ensure_ascii=False,indent=2))
if __name__=='__main__': main()
