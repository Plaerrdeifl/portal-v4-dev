#!/usr/bin/env python3
import json, subprocess, struct, tempfile
from pathlib import Path

BASE=Path('/srv/docker/liveticker')
RENDER=BASE/'worker/render_v1.py'
OUR=str(BASE/'assets/teams/mighty-dogs-schweinfurt.png')
OPP=str(BASE/'assets/teams/black-dragons-erfurt.svg')

def dims(p):
    b=p.read_bytes()[:24]
    return struct.unpack('>II',b[16:24])

def run(state):
    with tempfile.TemporaryDirectory(dir=str(BASE/'work')) as td:
        d=Path(td); s=d/'state.json'; o=d/'out'
        s.write_text(json.dumps(state,ensure_ascii=False),encoding='utf-8')
        subprocess.run(['python3',str(RENDER),str(s),'--out',str(o)],check=True,stdout=subprocess.DEVNULL)
        m=json.loads((o/'manifest.json').read_text())
        assert len(m)==6
        for x in m:
            assert Path(x['png']).is_file() and Path(x['png']).stat().st_size>1000
            assert dims(Path(x['png'])) == ((1254,1254) if x['format']=='POST' else (941,1672))
        return m

base={'competitionLabel':'TEST','seriesInfo':'','ourTeam':{'logoPath':OUR},'opponentTeam':{'logoPath':OPP}}
otm=base|{'history':[
 {'id':'b','type':'goal','team':'mighty','minute':24,'player':{'id':'28','number':'28','name':'Renars Dzerods Alksnis'}},
 {'id':'d','type':'goal','team':'mighty','minute':69,'minuteDisplay':'60+9','player':{'id':'28','number':'28','name':'Renars Dzerods Alksnis'}},
 {'id':'c','type':'goal','team':'opponent','minute':39,'player':{'number':'11','name':'Jesper Satzky'}},
 {'id':'a','type':'goal','team':'mighty','minute':8,'player':{'id':'28','number':'28','name':'Renars Dzerods Alksnis'}}
]}
m=run(otm)
fin=[x for x in m if x['kind']=='FINAL']
assert all(x['score']=='3:1' and x['suffix']=='n.V.' for x in fin)
assert all(x['goalLines']==['#28 Alksnis | 8, 24, 60+9'] for x in fin)
p1=[x for x in m if x['kind']=='PERIOD_1']
assert all(x['score']=='1:0' and x['goalLines']==['#28 Alksnis | 8'] for x in p1)
p2=[x for x in m if x['kind']=='PERIOD_2']
assert all(x['score']=='2:1' and x['goalLines']==['#28 Alksnis | 8, 24'] for x in p2)

corrected=base|{'history':[
 {'id':'g12','type':'goal','team':'mighty','minute':12,'player':{'number':'91','name':'Georg Pinsack'}},
 {'id':'g15','type':'goal','team':'mighty','minute':15,'player':{'number':'19','name':'Kristers Donins'}},
 {'id':'g19','type':'goal','team':'mighty','minute':19,'player':{'number':'69','name':'Lukas Krumpe'}},
 {'id':'g06','type':'goal','team':'mighty','minute':6,'player':{'number':'2','name':'Lucas Kleider'}}
]}
m=run(corrected)
p1=[x for x in m if x['kind']=='PERIOD_1']
expected=['#2 Kleider | 6','#91 Pinsack | 12','#19 Donins | 15','#69 Krumpe | 19']
assert all(x['score']=='4:0' and x['goalLines']==expected for x in p1)

shoot=base|{'history':[
 {'id':'a','type':'goal','team':'mighty','minute':11,'player':{'number':'70','name':'Josef Dana'}},
 {'id':'b','type':'goal','team':'opponent','minute':33,'player':{'number':'11','name':'Jesper Satzky'}},
 {'id':'s1','type':'shootout','team':'mighty','player':{'number':'41','name':'Tomas Cermak'},'result':'scored'},
 {'id':'s2','type':'shootout','team':'opponent','player':{'number':'22','name':'Enzo Herrschaft'},'result':'missed'}
]}
m=run(shoot)
fin=[x for x in m if x['kind']=='FINAL']
assert all(x['score']=='2:1' and x['suffix']=='n.P.' for x in fin)
assert all(x['goalLines']==['#70 Dana | 11'] for x in fin)
print('LIVETICKER_RENDER_V1_TEST_OK')
