#!/usr/bin/env python3
import binascii, hashlib, json, subprocess, struct, tempfile, zlib
from pathlib import Path

REPO_ROOT=Path(__file__).resolve().parents[2]
RENDER=Path(__file__).with_name('render_v1.py')
OUR=str(REPO_ROOT/'assets/liveticker/teams/mighty-dogs-schweinfurt.png')
OPP=str(REPO_ROOT/'assets/liveticker/teams/black-dragons-erfurt.svg')
TEMPLATE_ROOT=REPO_ROOT/'assets/liveticker/templates'

def dims(p):
    b=p.read_bytes()[:24]
    return struct.unpack('>II',b[16:24])

def write_rgb_png(path,width,height,color=(180,30,40)):
    def chunk(kind,data):
        return struct.pack('>I',len(data))+kind+data+struct.pack('>I',binascii.crc32(kind+data)&0xffffffff)
    row=b'\x00'+bytes(color)*width
    path.write_bytes(
        b'\x89PNG\r\n\x1a\n'
        +chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,2,0,0,0))
        +chunk(b'IDAT',zlib.compress(row*height,9))
        +chunk(b'IEND',b'')
    )

def template_snapshot():
    snapshot={}
    for fmt in ('post','story'):
        svg=(TEMPLATE_ROOT/f'LT_{fmt}.svg').read_text(encoding='utf-8')
        snapshot[fmt]={'svgText':svg,'sha256':hashlib.sha256(svg.encode('utf-8')).hexdigest()}
    return snapshot

def run(state,kind):
    with tempfile.TemporaryDirectory(prefix='liveticker-renderer-test-') as td:
        d=Path(td); s=d/'state.json'; o=d/'out'
        payload=state|{'kind':kind,'graphicTemplates':template_snapshot()}
        s.write_text(json.dumps(payload,ensure_ascii=False),encoding='utf-8')
        subprocess.run(['python3',str(RENDER),str(s),'--out',str(o)],check=True,stdout=subprocess.DEVNULL)
        m=json.loads((o/'manifest.json').read_text())
        assert len(m)==2
        assert {x['format'] for x in m}=={'POST','STORY'}
        assert all(x['kind']==kind for x in m)
        for x in m:
            assert Path(x['png']).is_file() and Path(x['png']).stat().st_size>1000
            assert dims(Path(x['png'])) == ((1254,1254) if x['format']=='POST' else (941,1672))
        return m

base={'competitionLabel':'TEST','seriesInfo':'','homeAway':'HOME','ourTeam':{'logoPath':OUR},'opponentTeam':{'logoPath':OPP}}
otm=base|{'history':[
 {'id':'b','type':'goal','team':'mighty','minute':24,'player':{'id':'28','number':'28','name':'Renars Dzerods Alksnis'}},
 {'id':'d','type':'goal','team':'mighty','minute':69,'minuteDisplay':'60+9','player':{'id':'28','number':'28','name':'Renars Dzerods Alksnis'}},
 {'id':'c','type':'goal','team':'opponent','minute':39,'player':{'number':'11','name':'Jesper Satzky'}},
 {'id':'a','type':'goal','team':'mighty','minute':8,'player':{'id':'28','number':'28','name':'Renars Dzerods Alksnis'}}
]}
m={kind:run(otm,kind) for kind in ('PERIOD_1','PERIOD_2','FINAL')}
fin=m['FINAL']
assert all(x['score']=='3:1' and x['suffix']=='n.V.' for x in fin)
assert all(x['goalLines']==['#28 Alksnis | 8, 24, 60+9'] for x in fin)
p1=m['PERIOD_1']
assert all(x['score']=='1:0' and x['goalLines']==['#28 Alksnis | 8'] for x in p1)
p2=m['PERIOD_2']
assert all(x['score']=='2:1' and x['goalLines']==['#28 Alksnis | 8, 24'] for x in p2)

corrected=base|{'history':[
 {'id':'g12','type':'goal','team':'mighty','minute':12,'player':{'number':'91','name':'Georg Pinsack'}},
 {'id':'g15','type':'goal','team':'mighty','minute':15,'player':{'number':'19','name':'Kristers Donins'}},
 {'id':'g19','type':'goal','team':'mighty','minute':19,'player':{'number':'69','name':'Lukas Krumpe'}},
 {'id':'g06','type':'goal','team':'mighty','minute':6,'player':{'number':'2','name':'Lucas Kleider'}}
]}
p1=run(corrected,'PERIOD_1')
expected=['#2 Kleider | 6','#91 Pinsack | 12','#19 Donins | 15','#69 Krumpe | 19']
assert all(x['score']=='4:0' and x['goalLines']==expected for x in p1)

shoot=base|{'history':[
 {'id':'a','type':'goal','team':'mighty','minute':11,'player':{'number':'70','name':'Josef Dana'}},
 {'id':'b','type':'goal','team':'opponent','minute':33,'player':{'number':'11','name':'Jesper Satzky'}},
 {'id':'s1','type':'shootout','team':'mighty','player':{'number':'41','name':'Tomas Cermak'},'result':'scored'},
 {'id':'s2','type':'shootout','team':'opponent','player':{'number':'22','name':'Enzo Herrschaft'},'result':'missed'}
]}
fin=run(shoot,'FINAL')
assert all(x['score']=='2:1' and x['suffix']=='n.P.' for x in fin)
assert all(x['goalLines']==['#70 Dana | 11'] for x in fin)

with tempfile.TemporaryDirectory(prefix='liveticker-renderer-wide-logo-') as td:
    wide_logo=Path(td)/'wide-892x500.png'
    write_rgb_png(wide_logo,892,500)
    wide=base|{'opponentTeam':{'logoPath':str(wide_logo)},'history':[]}
    rendered=run(wide,'FINAL')
    assert {x['format'] for x in rendered}=={'POST','STORY'}
print('LIVETICKER_RENDER_V1_TEST_OK')
