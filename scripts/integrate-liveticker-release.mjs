#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {cp,lstat,mkdir,readFile,readdir,rm} from 'node:fs/promises';
import {join,relative,resolve,sep} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const dist=resolve(root,'dist');
const hash=x=>createHash('sha256').update(x).digest('hex');
const guard=(yes,msg)=>{if(!yes)throw new Error(msg)};
guard(process.env.PORTAL_ENVIRONMENT==='DEV' &&
  process.env.SUPABASE_EXPECTED_PROJECT_REF==='tpieykhhawszlzsoflnl',
  'Liveticker darf nur in das feste DEV-Supabase-Projekt gebaut werden.');
const manifest=JSON.parse(await readFile(resolve(root,'integrations/liveticker/release.json'),'utf8'));
guard(manifest.schemaVersion===1 && manifest.environment==='DEV' &&
  manifest.sourceRepository==='Plaerrdeifl/liveticker' &&
  /^[a-f0-9]{40}$/.test(manifest.sourceCommit) &&
  /^[a-f0-9]{64}$/.test(manifest.sourcePackageLockSha256) &&
  /^[a-f0-9]{64}$/.test(manifest.artifactSha256) &&
  manifest.artifactRoot==='integrations/liveticker/release' &&
  Array.isArray(manifest.files) && manifest.files.length>0,'Liveticker-Release ohne sichere Provenienz.');
const source=resolve(root,manifest.artifactRoot);
async function list(dir,result=[]){
  for(const e of await readdir(dir,{withFileTypes:true})){
    const p=join(dir,e.name);const st=await lstat(p);
    guard(!st.isSymbolicLink(),'Liveticker-Artefakte dürfen keine Symlinks enthalten.');
    if(st.isDirectory())await list(p,result);
    else{guard(st.isFile(),'Unerwartetes Release-Artefakt.');result.push(relative(source,p).split(sep).join('/'))}
  }
  return result;
}
const actual=(await list(source)).sort();
const declared=manifest.files.map(f=>{
  const path=String(f.path||'');
  guard(/^(?:standalone|embed)\/[A-Za-z0-9_./-]+$/.test(path) &&
    !path.split('/').includes('..') && !path.split('/').includes('.') &&
    !path.includes('//'),'Unsicherer Liveticker-Artefaktpfad.');
  return path;
});
guard(new Set(declared).size===declared.length &&
  JSON.stringify(actual)===JSON.stringify([...declared].sort()),
  'Release-Dateiliste und Assets weichen voneinander ab.');
let canonical='';
for(const f of manifest.files){
  const b=await readFile(resolve(source,f.path));
  const h=hash(b);
  guard(f.bytes===b.length && f.sha256===h,'Liveticker-Hash falsch: '+f.path);
  canonical+=h+'  '+b.length+'  '+f.path+'\n';
}
guard(hash(Buffer.from(canonical))===manifest.artifactSha256,'Liveticker-Gesamthash ungültig.');
for(const f of ['standalone/index.html','standalone/manifest.webmanifest','standalone/sw.js',
  'standalone/registerSW.js','embed/module.js','embed/style.css','standalone/icons/icon-192.png']){
  guard(declared.includes(f),'Liveticker-Release unvollständig: '+f);
}
guard(declared.some(x=>/^embed\/chunks\/[^/]+\.js$/.test(x)),'Codechunks fehlen.');
const pwa=JSON.parse(await readFile(resolve(source,'standalone/manifest.webmanifest'),'utf8'));
guard(pwa.id==='/liveticker/' && pwa.scope==='/liveticker/' &&
  pwa.start_url==='/liveticker/' && pwa.icons.length>0 &&
  pwa.icons.every(x=>String(x.src).startsWith('/liveticker/icons/')),
  'Liveticker-PWA versucht fremde Pfade zu kontrollieren.');
const html=await readFile(resolve(source,'standalone/index.html'),'utf8');
const embed=await readFile(resolve(source,'embed/module.js'),'utf8');
guard(html.includes('/liveticker/runtime-config.js') &&
  html.includes('/liveticker/assets/') &&
  embed.includes('mountLiveticker') && embed.includes('cockpit_access_get'),
  'Browser-Runtime oder serverseitiger Cockpit-Zugangsvertrag fehlt.');
const runtime=resolve(dist,'cockpit/runtime-config.js');
const publicRuntime=await readFile(runtime,'utf8');
guard(publicRuntime.includes('"environment": "DEV"') &&
  publicRuntime.includes('tpieykhhawszlzsoflnl.supabase.co') &&
  !/service_role|sb_secret_/i.test(publicRuntime),'Unsichere DEV-Liveticker-Runtime.');
const output=resolve(dist,'liveticker');
guard(output.startsWith(dist+sep),'Liveticker darf dist nicht verlassen.');
await rm(output,{recursive:true,force:true}); // DEV distribution only, source is retained.
await mkdir(output,{recursive:true});
await cp(resolve(source,'standalone'),output,{recursive:true});
await cp(resolve(source,'embed'),resolve(output,'embed'),{recursive:true});
await cp(runtime,resolve(output,'runtime-config.js'));
console.log('Hashgeprüfter Liveticker DEV integriert: '+manifest.sourceCommit);
