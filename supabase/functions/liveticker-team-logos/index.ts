const BUCKET = 'liveticker-team-logos'
const MAX_BYTES = 1024 * 1024
const WORKER_TOKEN_HEADER = 'X-Liveticker-Worker-Token'
const EXPECTED_WORKER_TOKEN_SHA256: Record<string,string> = {
  'tpieykhhawszlzsoflnl.supabase.co': '8ad104a328042fe7a10854836c99f7b86ee6933c7de022516b29ab398299af16',
  'wplescvhlgctynkfwvrj.supabase.co': 'b70a4b43dbb9d1e65050fab9199b10b8f6ae67f03ba879cbec1484ee2548085d'
}
const encoder = new TextEncoder()

type Json = Record<string, unknown>

function isObject(value: unknown): value is Json {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function response(status: number, body: Json, origin = '') {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(origin ? cors(origin) : {})
    }
  })
}
function cors(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-liveticker-worker-token',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin'
  }
}
function allowedOrigin(origin: string, host: string) {
  if (host === 'tpieykhhawszlzsoflnl.supabase.co') {
    return origin === 'https://dev.plaerrdeifl.de'
      || /^http:\/\/127\.0\.0\.1(?::\d+)?$/.test(origin)
      || /^http:\/\/localhost(?::\d+)?$/.test(origin)
      || /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(?::\d+)?$/.test(origin)
  }
  return origin === 'https://portal.plaerrdeifl.de'
}
async function sha256Hex(bytes: Uint8Array | string) {
  const input = typeof bytes === 'string' ? encoder.encode(bytes) : bytes
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', input))
  return [...digest].map(value => value.toString(16).padStart(2,'0')).join('')
}
function configuredSecretKey() {
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (isObject(parsed)) {
        const value = [parsed.default, parsed.secret, parsed.service_role, ...Object.values(parsed)]
          .find(item => typeof item === 'string' && item.trim())
        if (typeof value === 'string') return value.trim()
      }
    } catch { /* invalid below */ }
    return ''
  }
  return String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim()
}
function config() {
  const supabaseUrl = String(Deno.env.get('SUPABASE_URL') || '').trim().replace(/\/+$/,'')
  const anonKey = String(Deno.env.get('SUPABASE_ANON_KEY') || '').trim()
  const serviceRoleKey = configuredSecretKey()
  try {
    const url = new URL(supabaseUrl)
    if (!EXPECTED_WORKER_TOKEN_SHA256[url.hostname] || !anonKey || !serviceRoleKey) return null
    return { supabaseUrl, host: url.hostname, anonKey, serviceRoleKey }
  } catch {
    return null
  }
}
async function workerAuthorized(request: Request, host: string) {
  const token = request.headers.get(WORKER_TOKEN_HEADER) || ''
  if (encoder.encode(token).byteLength < 32 || token.length > 2048) return false
  return await sha256Hex(token) === EXPECTED_WORKER_TOKEN_SHA256[host]
}
async function portalApi(cfg: NonNullable<ReturnType<typeof config>>, token: string, payload: Json) {
  const result = await fetch(cfg.supabaseUrl + '/rest/v1/rpc/pd_api', {
    method: 'POST',
    headers: {
      apikey: cfg.anonKey,
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_action: 'liveticker_team_logo_upload_authorize', p_payload: payload }),
    signal: AbortSignal.timeout(20_000)
  })
  const body: unknown = await result.json().catch(() => null)
  if (!result.ok || !isObject(body) || body.ok !== true || !isObject(body.data)) return null
  return body.data
}
function inspect(bytes: Uint8Array, declared: string) {
  const png = bytes.length >= 8 && [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((v,i) => bytes[i]===v)
  const jpg = bytes.length >= 3 && bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff
  const webp = bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0,4))==='RIFF'
    && String.fromCharCode(...bytes.slice(8,12))==='WEBP'
  const actual = png ? 'image/png' : jpg ? 'image/jpeg' : webp ? 'image/webp' : ''
  if (!actual || actual !== declared) return null
  const ext = actual === 'image/png' ? 'png' : actual === 'image/jpeg' ? 'jpg' : 'webp'
  return { mime: actual, ext }
}
async function storageUpload(cfg: NonNullable<ReturnType<typeof config>>, path: string, mime: string, bytes: Uint8Array) {
  const upload = await fetch(cfg.supabaseUrl + '/storage/v1/object/' + BUCKET + '/' + path, {
    method: 'POST',
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: 'Bearer ' + cfg.serviceRoleKey,
      'Content-Type': mime,
      'x-upsert': 'true'
    },
    body: bytes,
    signal: AbortSignal.timeout(30_000)
  })
  await upload.body?.cancel()
  if (!upload.ok) throw new Error('STORAGE_UPLOAD_FAILED')
}
async function activate(
  cfg: NonNullable<ReturnType<typeof config>>,
  payload: { teamId:string; actorId:string|null; expectedRevision:number|null; path:string; mime:string; sha:string; dataBase64:string }
) {
  const result = await fetch(cfg.supabaseUrl + '/rest/v1/rpc/pd_liveticker_team_logo_storage_activate', {
    method: 'POST',
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: 'Bearer ' + cfg.serviceRoleKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      p_team_id: payload.teamId,
      p_actor: payload.actorId,
      p_expected_revision: payload.expectedRevision,
      p_storage_path: payload.path,
      p_mime_type: payload.mime,
      p_sha256: payload.sha,
      p_logo_data_base64: payload.dataBase64
    }),
    signal: AbortSignal.timeout(20_000)
  })
  const body = await result.json().catch(() => null)
  if (!result.ok || !isObject(body)) throw new Error('TEAM_ACTIVATE_FAILED')
  return body
}
function uuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
function base64(bytes: Uint8Array) {
  let binary = ''
  for (let offset=0; offset<bytes.length; offset+=0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset+0x8000, bytes.length)))
  }
  return btoa(binary)
}

Deno.serve(async request => {
  const cfg = config()
  if (!cfg) return response(500,{ok:false,error:{message:'Logo-Dienst ist nicht konfiguriert.'}})

  const origin = request.headers.get('Origin') || ''
  const browserOrigin = origin && allowedOrigin(origin,cfg.host) ? origin : ''
  const internal = await workerAuthorized(request,cfg.host)

  if (request.method === 'OPTIONS') {
    if (!browserOrigin) return new Response(null,{status:403})
    return new Response(null,{status:204,headers:cors(browserOrigin)})
  }
  if (request.method !== 'POST') return response(405,{ok:false,error:{message:'Methode nicht erlaubt.'}},browserOrigin)

  let form: FormData
  try { form = await request.formData() } catch {
    return response(400,{ok:false,error:{message:'Ungültige Upload-Anfrage.'}},browserOrigin)
  }

  const teamId = String(form.get('teamId') || '')
  const file = form.get('file')
  if (!uuid(teamId) || !(file instanceof File) || file.size<1 || file.size>MAX_BYTES) {
    return response(400,{ok:false,error:{message:'Team oder Logo-Datei ist ungültig.'}},browserOrigin)
  }

  let actorId: string|null = null
  let expectedRevision: number|null = null

  if (!internal) {
    if (!browserOrigin) return response(403,{ok:false,error:{message:'Origin nicht erlaubt.'}})
    const tokenMatch = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(request.headers.get('Authorization') || '')
    const expected = Number(form.get('expectedRevision'))
    if (!tokenMatch || !Number.isInteger(expected) || expected < 1) {
      return response(401,{ok:false,error:{message:'Anmeldung oder Revision fehlt.'}},browserOrigin)
    }
    const auth = await portalApi(cfg,tokenMatch[1],{teamId,expectedRevision:expected})
    if (!auth || auth.teamId!==teamId || !uuid(String(auth.actorId || ''))) {
      return response(403,{ok:false,error:{message:'Logo darf nicht geändert werden.'}},browserOrigin)
    }
    actorId = String(auth.actorId)
    expectedRevision = Number(auth.expectedRevision)
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const meta = inspect(bytes,String(file.type || '').toLowerCase())
  if (!meta) return response(400,{ok:false,error:{message:'Logo muss ein gültiges PNG, JPG oder WebP sein.'}},browserOrigin)

  const sha = await sha256Hex(bytes)
  const path = 'teams/' + teamId + '/' + sha + '.' + meta.ext

  try {
    await storageUpload(cfg,path,meta.mime,bytes)
    const updated = await activate(cfg,{
      teamId,
      actorId,
      expectedRevision,
      path,
      mime:meta.mime,
      sha,
      dataBase64:base64(bytes)
    })
    return response(200,{ok:true,data:updated},browserOrigin)
  } catch {
    return response(409,{ok:false,error:{message:'Teamlogo konnte nicht gespeichert werden.'}},browserOrigin)
  }
})
