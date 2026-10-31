import { n as e, o as t, t as n } from "./api-DqcqenPV.js";
//#region src/liveticker/legacy-rpc.ts
var r = class extends Error {
	status;
	code;
	details;
	constructor(e, t, n = "", r = null) {
		super(e), this.name = "LivetickerRpcError", this.status = t, this.code = n, this.details = r;
	}
};
async function i(n, i = {}) {
	let a = t(), { data: o, error: s } = await e().auth.getSession(), c = o.session?.access_token;
	if (s || !c) throw new r("Anmeldung erforderlich.", 401, "AUTH_REQUIRED", s);
	let l = await fetch(a.supabaseUrl + "/rest/v1/rpc/" + n, {
		method: "POST",
		cache: "no-store",
		headers: {
			apikey: a.supabasePublishableKey,
			Authorization: "Bearer " + c,
			"Content-Type": "application/json"
		},
		body: JSON.stringify(i)
	}), u = await l.text(), d = null;
	try {
		d = u ? JSON.parse(u) : null;
	} catch {
		d = u;
	}
	if (!l.ok) {
		let e = d;
		throw new r(e?.message || e?.hint || "RPC " + n + " fehlgeschlagen.", l.status, e?.code || "", d);
	}
	return d;
}
//#endregion
//#region src/liveticker/games.ts
var a = "plaerrdeifl.livetickerPrototype.eventId";
function o(e) {
	return String(e ?? "").trim();
}
function s(e) {
	return o(e) || null;
}
function c(e) {
	let t = e || {};
	return {
		id: o(t.id),
		name: o(t.name),
		number: s(t.number),
		position: s(t.position)
	};
}
function l(e) {
	let t = e || {};
	return {
		id: s(t.id),
		name: o(t.name),
		shortName: o(t.shortName || t.short_name || t.name),
		teamCode: s(t.teamCode || t.team_code),
		logoAssetPath: s(t.logoAssetPath || t.logo_asset_path),
		logoUrl: s(t.logoUrl || t.logo_url),
		homeClub: t.homeClub === !0 || t.home_club === !0,
		players: Array.isArray(t.players) ? t.players.map(c) : []
	};
}
function u(e) {
	let t = e || {}, n = o(t.homeAway || t.home_away).toUpperCase();
	if (!o(t.eventId || t.event_id)) throw Error("Spiel ohne eventId erhalten.");
	if (n !== "HOME" && n !== "AWAY") throw Error("Spiel ohne gültiges homeAway erhalten.");
	return {
		eventId: o(t.eventId || t.event_id),
		eventDate: o(t.eventDate || t.event_date),
		eventTime: s(t.eventTime || t.event_time),
		venue: s(t.venue),
		homeAway: n,
		displayTitle: o(t.displayTitle || t.display_title),
		ownTeam: l(t.ownTeam || t.own_team),
		opponentTeam: l(t.opponentTeam || t.opponent_team)
	};
}
function d(e) {
	let t = e || {};
	return {
		eventId: o(t.eventId || t.event_id),
		revision: Number(t.revision || 0),
		minute: Math.max(1, Number(t.minute || 1)),
		history: Array.isArray(t.history) ? t.history : [],
		completedAt: s(t.completedAt || t.completed_at)
	};
}
async function f() {
	let e = await i("pd_public_liveticker_games");
	return Array.isArray(e?.games) ? e.games.map(u) : [];
}
async function p(e) {
	return d(await i("pd_public_liveticker_state", { p_event_id: e }));
}
function m(e) {
	localStorage.setItem(a, e);
}
function h() {
	return localStorage.getItem(a) || "";
}
function g(e) {
	let t = /* @__PURE__ */ new Date(e.eventDate + "T12:00:00"), n = Number.isNaN(t.getTime()) ? e.eventDate : new Intl.DateTimeFormat("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "2-digit"
	}).format(t), r = String(e.eventTime || "").slice(0, 5);
	return n + (r ? " · " + r : "") + " · " + e.displayTitle;
}
function _({ environment: e = t().environment, hostname: n = globalThis.location?.hostname || "" } = {}) {
	let r = n.trim().toLowerCase();
	return e === "DEV" && ([
		"localhost",
		"127.0.0.1",
		"::1",
		"acer01"
	].includes(r) || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(r));
}
async function v({ eventId: e, expectedRevision: t }) {
	if (!_()) throw Error("Testspiel-Reset ist nur in der lokalen DEV-Entwicklung erlaubt.");
	return await n("liveticker_game_reset", {
		eventId: e,
		expectedRevision: t
	}), p(e);
}
//#endregion
export { d as a, v as c, _ as i, r as l, f as n, m as o, p as r, h as s, g as t, i as u };
