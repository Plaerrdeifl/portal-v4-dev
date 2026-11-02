import { a as e, n as t, o as n, s as r, t as i } from "./api-DqcqenPV.js";
import { C as a, S as o, T as s, _ as c, a as l, b as u, c as d, d as f, f as p, g as m, h, i as g, l as _, m as v, n as y, o as b, p as x, r as S, s as C, t as w, u as ee, v as T, w as E, x as D, y as O } from "./ArchivePanel-C51-BSvz.js";
import { a as k, c as A, i as j, l as M, n as N, o as P, r as F, s as te, t as ne, u as I } from "./games-DYIBHwRf.js";
//#region src/liveticker/transport.ts
var L = r(), R = "LIVETICKER_WHATSAPP", z = "liveticker-whatsapp-jobs", B = /* @__PURE__ */ new Set([
	"TEST",
	"MAIN",
	"BOTH"
]);
function V(e) {
	return String(e ?? "").trim();
}
function H(e) {
	let t = e || {};
	return {
		ready: t.ready === !0,
		state: V(t.state).toUpperCase() || "UNREACHABLE",
		enabled: typeof t.enabled == "boolean" ? t.enabled : void 0,
		error: V(t.error) || null
	};
}
function U(e) {
	let t = e || {};
	return {
		ready: t.ready === !0,
		state: V(t.state).toUpperCase() || "UNREACHABLE",
		desiredConnected: t.desiredConnected !== !1,
		error: V(t.error) || null
	};
}
function re(e) {
	let t = e || {}, n = V(t.mode).toUpperCase(), r = B.has(n) ? n : "TEST", i = Array.isArray(t.channels) ? t.channels.map((e) => {
		let t = e || {}, n = V(t.code).toUpperCase();
		return n ? {
			code: n,
			label: V(t.label) || n,
			configured: t.configured === !0,
			enabled: t.enabled === !0
		} : null;
	}).filter((e) => !!e) : [];
	return {
		ready: t.ready === !0,
		mode: r,
		deliveryApproved: typeof t.deliveryApproved == "boolean" ? t.deliveryApproved : void 0,
		channels: i
	};
}
function W(e) {
	return e instanceof Error ? e.message : V(e) || "Status nicht verfügbar";
}
async function G(e) {
	let t = [i("worker_runtime_status", { workerCode: R }), i("liveticker_wpp_runtime_status", {})];
	t.push(i("liveticker_whatsapp_routing_status", {}));
	let n = await Promise.allSettled(t), r = [], a = n[0]?.status === "fulfilled" ? H(n[0].value) : {
		ready: !1,
		state: "UNREACHABLE",
		enabled: !1,
		error: W(n[0]?.reason)
	};
	n[0]?.status === "rejected" && r.push("WA-Worker: " + W(n[0].reason));
	let o = n[1]?.status === "fulfilled" ? U(n[1].value) : {
		ready: !1,
		state: "UNREACHABLE",
		desiredConnected: !0,
		error: W(n[1]?.reason)
	};
	n[1]?.status === "rejected" && r.push("WPP: " + W(n[1].reason));
	let s = null;
	return s = n[2]?.status === "fulfilled" ? re(n[2].value) : {
		ready: !1,
		mode: "TEST",
		channels: []
	}, n[2]?.status === "rejected" && r.push("Routing: " + W(n[2].reason)), {
		ready: !!(a.ready && o.ready && s?.ready && (e !== "DEV" || s.deliveryApproved === !0)),
		wa: a,
		wpp: o,
		routing: s,
		errors: r
	};
}
async function K(e) {
	return H(await i("worker_runtime_set", {
		workerCode: R,
		enabled: !!e
	}));
}
async function q(e) {
	if (!B.has(e)) throw Error("Ungültiges WhatsApp-Ziel.");
	return re(await i("liveticker_whatsapp_routing_set", { mode: e }));
}
async function J(e) {
	return U(await i("liveticker_wpp_runtime_set", { connected: !!e }));
}
function Y(e, t) {
	let n = e?.channels.find((e) => e.code === t);
	return !!(n?.configured && n?.enabled);
}
async function ie() {
	let e = t(), n = e.channel(z);
	try {
		return await n.httpSend("wake", {}), !0;
	} catch (e) {
		return console.warn("WhatsApp-Worker konnte nicht sofort geweckt werden.", e), !1;
	} finally {
		try {
			await e.removeChannel(n);
		} catch {}
	}
}
function ae(e) {
	return e.routing ? (e.routing.mode === "BOTH" ? ["TEST", "MAIN"] : [e.routing.mode]).map((t) => e.routing?.channels.find((e) => e.code === t)?.label || t).join(" + ") : "WhatsApp-Ziel nicht verfügbar";
}
//#endregion
//#region src/components/WhatsappChannelControl.tsx
var X = e();
function Z({ environment: e, status: t, disabled: n, onChange: r, onToggle: i }) {
	let [a, o] = (0, L.useState)(t.routing?.mode || "TEST"), [s, c] = (0, L.useState)(!1), [l, u] = (0, L.useState)("");
	(0, L.useEffect)(() => o(t.routing?.mode || "TEST"), [t.routing?.mode]);
	let d = (e) => e === "BOTH" ? Y(t.routing, "TEST") && Y(t.routing, "MAIN") : Y(t.routing, e);
	async function f() {
		if (!(s || n || !d(a))) {
			c(!0), u("");
			try {
				await q(a), r(await G(e));
			} catch (e) {
				u(e instanceof Error ? e.message : "WhatsApp-Ziel konnte nicht gespeichert werden.");
			} finally {
				c(!1);
			}
		}
	}
	return /* @__PURE__ */ (0, X.jsxs)("details", {
		className: "worker-control whatsapp-channel-control",
		onToggle: (e) => i?.(e.currentTarget),
		children: [/* @__PURE__ */ (0, X.jsxs)("summary", { children: ["WhatsApp-Ziel · ", t.routing?.mode === "BOTH" ? "Beide Kanäle" : t.routing?.channels.find((e) => e.code === t.routing?.mode)?.label || "Nicht verfügbar"] }), /* @__PURE__ */ (0, X.jsxs)("div", {
			className: "worker-control-body whatsapp-channel-picker",
			children: [
				/* @__PURE__ */ (0, X.jsxs)("div", {
					className: "runtime-routing-row",
					children: [/* @__PURE__ */ (0, X.jsxs)("select", {
						"aria-label": "WhatsApp-Ziel",
						value: a,
						disabled: s || n,
						onChange: (e) => o(e.target.value),
						children: [
							/* @__PURE__ */ (0, X.jsx)("option", {
								value: "TEST",
								disabled: !d("TEST"),
								children: t.routing?.channels.find((e) => e.code === "TEST")?.label || "Testkanal"
							}),
							/* @__PURE__ */ (0, X.jsx)("option", {
								value: "MAIN",
								disabled: !d("MAIN"),
								children: t.routing?.channels.find((e) => e.code === "MAIN")?.label || "Hauptkanal"
							}),
							/* @__PURE__ */ (0, X.jsx)("option", {
								value: "BOTH",
								disabled: !d("BOTH"),
								children: "Beide Kanäle"
							})
						]
					}), /* @__PURE__ */ (0, X.jsx)("button", {
						type: "button",
						disabled: s || n || !d(a),
						onClick: () => void f(),
						children: s ? "Speichert …" : "Übernehmen"
					})]
				}),
				/* @__PURE__ */ (0, X.jsx)("p", { children: "Gilt für neue Ausgaben. Bereits angelegte Aufträge behalten ihre Ziele." }),
				l && /* @__PURE__ */ (0, X.jsx)("p", {
					role: "alert",
					children: l
				})
			]
		})]
	});
}
//#endregion
//#region src/components/WhatsappDeliveryTargets.tsx
function oe({ delivery: e }) {
	return e?.targets?.length ? /* @__PURE__ */ (0, X.jsx)("ul", {
		className: "whatsapp-target-status",
		"aria-label": "WhatsApp-Status je Ziel",
		children: e.targets.map((e) => /* @__PURE__ */ (0, X.jsxs)("li", { children: [
			/* @__PURE__ */ (0, X.jsx)("strong", { children: e.label }),
			": ",
			e.error === "DELIVERY_OUTCOME_UNKNOWN" ? "Versandergebnis unklar – vor einem erneuten Versuch Zustellung prüfen" : e.status === "SUCCEEDED" ? "Gesendet · Zustellung noch nicht bestätigt" : e.status === "FAILED" ? "Versand fehlgeschlagen" : e.status === "PROCESSING" ? "Wird gesendet" : "In Warteschlange",
			" · ",
			[
				["Sticker", e.stickerStatus],
				["Text", e.textStatus],
				["Grafik", e.imageStatus]
			].filter(([, e]) => e !== "NOT_REQUESTED").map(([e, t]) => e + ": " + (t === "SENT" ? "gesendet" : t === "FAILED" ? "fehlgeschlagen" : "wartet")).join(" · ")
		] }, e.id))
	}) : null;
}
//#endregion
//#region src/components/ActionStickerPicker.tsx
function se(e, t) {
	return !!(e && t && e.kind === t.kind && e.team === t.team);
}
function Q({ stickerId: e, name: t }) {
	let [n, r] = (0, L.useState)("");
	return (0, L.useEffect)(() => {
		let t = !1, n = "";
		return g(e).then((e) => {
			t || (n = URL.createObjectURL(e), r(n));
		}, () => {
			t || r("");
		}), () => {
			t = !0, n && URL.revokeObjectURL(n);
		};
	}, [e]), n ? /* @__PURE__ */ (0, X.jsx)("img", {
		src: n,
		alt: ""
	}) : /* @__PURE__ */ (0, X.jsx)("span", {
		className: "sticker-placeholder",
		"aria-label": t,
		children: "🖼"
	});
}
function ce({ eventId: e, opponentTeamId: t, actionId: n, action: r, penaltyTeams: i = [], mutationsAllowed: a, transportReady: o, onPendingStickerChange: s }) {
	let [c, l] = (0, L.useState)([]), [u, p] = (0, L.useState)(""), [g, v] = (0, L.useState)(""), [x, w] = (0, L.useState)(null), [ee, T] = (0, L.useState)(null), [E, D] = (0, L.useState)(!1), [O, k] = (0, L.useState)("Sticker werden geladen …"), A = (0, L.useMemo)(() => r === "SITUATION" ? null : _({
		action: r,
		penaltyTeams: i
	}), [r, i]), j = (0, L.useMemo)(() => r === "SITUATION" ? C(c, t) : y(c, {
		action: r,
		opponentTeamId: t,
		penaltyTeams: i
	}), [
		r,
		c,
		t,
		i
	]), M = (0, L.useMemo)(() => j.find((e) => e.id === u) || null, [u, j]), N = d(x), P = r === "SITUATION" || !g || se(ee, A);
	(0, L.useEffect)(() => {
		let e = !1;
		return b().then((t) => {
			e || (l(t), k("Passende Aktionssticker geladen."));
		}, (t) => {
			e || (l([]), k(t instanceof Error ? t.message : "Aktionssticker konnten nicht geladen werden."));
		}), () => {
			e = !0;
		};
	}, [e]), (0, L.useEffect)(() => {
		g || u && !j.some((e) => e.id === u) && p("");
	}, [
		g,
		u,
		j
	]), (0, L.useEffect)(() => {
		r !== "SITUATION" && g && ee && u && s && s({
			deliveryId: g,
			stickerId: u,
			actionId: n,
			context: ee
		});
	}, [
		r,
		n,
		g,
		s,
		u,
		ee
	]), (0, L.useEffect)(() => {
		if (r !== "SITUATION" || N.tone !== "success") return;
		let e = window.setTimeout(() => {
			p(""), v(""), w(null), T(null), k("");
		}, 2e3);
		return () => window.clearTimeout(e);
	}, [r, N.tone]);
	let F = (0, L.useCallback)(async () => {
		if (g) try {
			let t = await h(e), n = f(t, g);
			w(n);
			let r = d(n);
			r.tone === "success" ? k(P ? "Sticker gesendet · Aktion jetzt speichern." : "Sticker gesendet · Auswahl wurde danach geändert; er wird nicht falsch verknüpft.") : r.tone === "error" ? k(n?.error ? "Sticker fehlgeschlagen: " + n.error : "Sticker fehlgeschlagen.") : k("Sticker wird gesendet …");
		} catch (e) {
			k(e instanceof Error ? e.message : "Sticker-Status konnte nicht geladen werden.");
		}
	}, [
		P,
		g,
		e
	]);
	(0, L.useEffect)(() => {
		g && F();
	}, [g, F]), (0, L.useEffect)(() => {
		if (!g || N.terminal) return;
		let e = window.setTimeout(() => void F(), 1e3);
		return () => window.clearTimeout(e);
	}, [
		x,
		g,
		F,
		N.terminal
	]);
	async function te() {
		if (M && !E && (r === "SITUATION" || A)) {
			if (!a) {
				k("Sticker-Versand ist für diese Aktion nicht freigeschaltet.");
				return;
			}
			if (!o) {
				k("WhatsApp ist nicht vollständig bereit.");
				return;
			}
			D(!0), w(null), T(r === "SITUATION" ? null : A), k("Sticker wird sofort gesendet …");
			try {
				let t = await S({
					eventId: e,
					stickerId: M.id
				});
				v(t), ie(), k("Sticker wird gesendet …");
			} catch (e) {
				T(null), k(e instanceof Error ? e.message : "Sticker konnte nicht gesendet werden.");
			} finally {
				D(!1);
			}
		}
	}
	async function ne() {
		if (g && !E && N.retryable && a && o) {
			D(!0), k("Sticker wird erneut gesendet …");
			try {
				await m({
					eventId: e,
					deliveryId: g
				}), ie(), w((e) => e && {
					...e,
					status: "PENDING",
					stickerStatus: "PENDING",
					attemptCount: e.attemptCount + 1,
					error: null
				}), await F();
			} catch (e) {
				k(e instanceof Error ? e.message : "Der erneute Sticker-Versuch konnte nicht gestartet werden.");
			} finally {
				D(!1);
			}
		}
	}
	return !A && r !== "SITUATION" ? /* @__PURE__ */ (0, X.jsxs)("div", {
		className: "action-sticker-box",
		children: [/* @__PURE__ */ (0, X.jsx)("strong", { children: "Aktionssticker" }), /* @__PURE__ */ (0, X.jsx)("p", {
			className: "empty-note",
			children: "Für gemischte Strafen beider Teams gibt es keinen eindeutigen Aktionssticker."
		})]
	}) : /* @__PURE__ */ (0, X.jsxs)("div", {
		className: "action-sticker-box",
		children: [
			/* @__PURE__ */ (0, X.jsx)("div", {
				className: "section-title-row",
				children: /* @__PURE__ */ (0, X.jsxs)("div", { children: [/* @__PURE__ */ (0, X.jsx)("strong", { children: r === "SITUATION" ? "Situationssticker" : "Aktionssticker" }), /* @__PURE__ */ (0, X.jsx)("p", {
					className: "action-sticker-hint",
					children: r === "SITUATION" ? "Aktive Spiel-, Video- und allgemeine Sticker · immer separat ohne Liveticker-Aktion oder Text." : "Passender Sticker zur gewählten Aktion · immer separat ohne Text."
				})] })
			}),
			j.length ? /* @__PURE__ */ (0, X.jsx)("div", {
				className: "action-sticker-grid",
				children: j.map((e) => /* @__PURE__ */ (0, X.jsxs)("button", {
					className: u === e.id ? "sticker-card selected" : "sticker-card",
					type: "button",
					"aria-pressed": u === e.id,
					disabled: E || !(!g || N.terminal),
					onClick: () => {
						g || (p(e.id), k("Aktionssticker ausgewählt."));
					},
					children: [/* @__PURE__ */ (0, X.jsx)(Q, {
						stickerId: e.id,
						name: e.name
					}), /* @__PURE__ */ (0, X.jsx)("strong", { children: e.name })]
				}, e.id))
			}) : /* @__PURE__ */ (0, X.jsx)("p", {
				className: "empty-note",
				children: "Für diese Aktion ist kein passender aktiver Sticker hinterlegt."
			}),
			M && !g && /* @__PURE__ */ (0, X.jsx)("button", {
				className: "action-sticker-send",
				type: "button",
				disabled: E || !a || !o,
				onClick: () => void te(),
				children: E ? "Sticker wird gesendet …" : "Sticker sofort senden"
			}),
			g && /* @__PURE__ */ (0, X.jsxs)(X.Fragment, { children: [
				/* @__PURE__ */ (0, X.jsxs)("p", {
					className: "sticker-delivery-status",
					"data-tone": P ? N.tone : "error",
					children: [r === "SITUATION" || P ? "Sticker " + N.label : "Sticker gesendet, aber die Aktion wurde danach geändert – keine automatische Verknüpfung.", N.tone === "error" && x?.error ? " · " + x.error : ""]
				}),
				/* @__PURE__ */ (0, X.jsx)(oe, { delivery: x }),
				N.retryable && !x?.targets?.some((e) => e.error === "DELIVERY_OUTCOME_UNKNOWN") && /* @__PURE__ */ (0, X.jsx)("button", {
					className: "secondary-button action-sticker-send",
					type: "button",
					disabled: E || !a || !o,
					onClick: () => void ne(),
					children: "Erneut senden"
				})
			] }),
			/* @__PURE__ */ (0, X.jsx)("p", {
				className: "workspace-message",
				children: O
			})
		]
	});
}
//#endregion
//#region src/components/ClassicFormControls.tsx
function le(e) {
	return String(e ?? "").trim().replace(/^#/, "").trim();
}
function ue({ players: e, value: t, onChange: n, placeholder: r, numberAriaLabel: i }) {
	let a = e.find((e) => e.id === t) || null, [o, s] = (0, L.useState)(a?.number || "");
	return (0, L.useEffect)(() => {
		s(a?.number || "");
	}, [a?.id, a?.number]), /* @__PURE__ */ (0, X.jsxs)("div", {
		className: "player-entry",
		children: [/* @__PURE__ */ (0, X.jsx)("input", {
			className: "jersey-number",
			type: "text",
			inputMode: "numeric",
			autoComplete: "off",
			placeholder: "#",
			"aria-label": i,
			value: o,
			onChange: (t) => {
				let r = le(t.target.value);
				if (s(r), !r) {
					n("");
					return;
				}
				n(e.find((e) => le(e.number) === r)?.id || "");
			}
		}), /* @__PURE__ */ (0, X.jsxs)("select", {
			value: t,
			onChange: (t) => {
				let r = t.target.value;
				n(r);
				let i = e.find((e) => e.id === r);
				s(i?.number || "");
			},
			children: [/* @__PURE__ */ (0, X.jsx)("option", {
				value: "",
				children: r
			}), e.map((e) => /* @__PURE__ */ (0, X.jsxs)("option", {
				value: e.id,
				children: [e.number ? "#" + e.number + " " : "", e.name]
			}, e.id))]
		})]
	});
}
function de({ value: e, options: t, onChange: n, ariaLabel: r }) {
	return /* @__PURE__ */ (0, X.jsx)("div", {
		className: "classic-segmented",
		role: "group",
		"aria-label": r,
		children: t.map((t) => /* @__PURE__ */ (0, X.jsx)("button", {
			type: "button",
			"aria-pressed": t.value === e,
			onClick: () => n(t.value),
			children: t.label
		}, t.value))
	});
}
//#endregion
//#region src/components/ClassicEditablePreview.tsx
function fe({ generatedText: e, error: t, manualText: n, onManualTextChange: r }) {
	let [i, a] = (0, L.useState)(!1), o = n ?? e;
	async function s() {
		try {
			await navigator.clipboard.writeText(o);
		} catch {}
	}
	return /* @__PURE__ */ (0, X.jsxs)("section", {
		className: "classic-whatsapp-preview",
		"aria-label": "WhatsApp-Vorschau",
		children: [
			/* @__PURE__ */ (0, X.jsx)("div", {
				className: "classic-preview-head",
				children: /* @__PURE__ */ (0, X.jsx)("h3", { children: "WhatsApp-Vorschau" })
			}),
			t ? /* @__PURE__ */ (0, X.jsx)("p", {
				className: "form-error",
				children: t
			}) : i ? /* @__PURE__ */ (0, X.jsx)("textarea", {
				className: "classic-output-textarea",
				spellCheck: !0,
				value: o,
				onChange: (e) => r(e.target.value)
			}) : /* @__PURE__ */ (0, X.jsx)("div", {
				className: "output-preview",
				children: o
			}),
			!t && /* @__PURE__ */ (0, X.jsxs)("div", {
				className: "output-actions",
				children: [i ? /* @__PURE__ */ (0, X.jsx)("button", {
					className: "primary output-icon",
					type: "button",
					"aria-label": "Text übernehmen",
					title: "Text übernehmen",
					onClick: () => a(!1),
					children: "✓"
				}) : /* @__PURE__ */ (0, X.jsx)("button", {
					className: "secondary output-icon",
					type: "button",
					"aria-label": "Text bearbeiten",
					title: "Bearbeiten",
					onClick: () => {
						n === null && r(e), a(!0);
					},
					children: "✏️"
				}), /* @__PURE__ */ (0, X.jsx)("button", {
					className: "copy-button output-icon",
					type: "button",
					"aria-label": "Kopieren",
					title: "Kopieren",
					onClick: () => void s(),
					children: "📋"
				})]
			})
		]
	});
}
//#endregion
//#region src/liveticker/action-whatsapp.ts
var pe = 4e3;
function me(e, t, { editingId: n = null, enabled: r = !1 } = {}) {
	let i = String(t ?? "");
	return !e || n || !r || !i.trim() || i.length > pe ? e : {
		...e,
		_whatsapp: Object.freeze({
			publish: !0,
			text: i
		})
	};
}
function he(e, t) {
	let n = Array.isArray(e) ? e.slice() : [], r = String(t.id || "");
	if (!r) return n;
	let i = n.findIndex((e) => String(e?.id || "") === r);
	return i >= 0 ? n.splice(i, 1, t) : n.push(t), n;
}
function ge({ whatsappEnabled: e, transportReady: t }) {
	return !(e && t);
}
async function _e(e) {
	let t = String(e ?? "");
	if (!t.trim()) return !1;
	try {
		return await navigator.clipboard.writeText(t), !0;
	} catch {
		return !1;
	}
}
//#endregion
//#region src/liveticker/goals.ts
function ve(e, t) {
	let n = e.find((e) => e.id === t);
	return n ? {
		id: n.id,
		name: n.name,
		number: n.number,
		position: n.position
	} : null;
}
function ye(e, t) {
	if (!t) return "";
	let n = String(t.id || "").trim();
	if (n && e.some((e) => e.id === n)) return n;
	let r = String(t.name || "").trim();
	return e.find((e) => e.name === r)?.id || "";
}
function be(e, t) {
	let n = [e, ...t].filter((e) => !!e).map((e) => String(e.name || "").trim()).filter(Boolean);
	if (new Set(n).size !== n.length) throw Error("Torschütze und Assists müssen unterschiedliche Spieler sein.");
}
function xe(e) {
	let t = Number(e.minute);
	if (!Number.isInteger(t) || t < 1) throw Error("Bitte eine gültige Spielminute ab 1 eingeben.");
	be(e.player, e.assists);
	let n = String(e.outputVariantId || "").trim();
	if (!n) throw Error("Bitte eine Tor-Ausgabevariante wählen.");
	return {
		id: String(e.id || s()),
		type: "goal",
		team: e.team,
		minute: t,
		player: e.player,
		assists: e.assists.filter(Boolean).slice(0, 2),
		outputVariantId: n
	};
}
function Se(e, t) {
	let n = Array.isArray(e) ? e.slice() : [], r = String(t.id || ""), i = r ? n.findIndex((e) => String(e?.id || "") === r) : -1;
	return i >= 0 ? n.splice(i, 1, t) : n.push(t), n;
}
function Ce(e, t, n, r = "") {
	let i = String(n || "").trim();
	return i && (Array.isArray(e) ? e : []).filter((e) => {
		if (!e || typeof e != "object" || Array.isArray(e)) return !1;
		let n = e;
		return String(n.id || "") !== String(r || "") && n.type === "goal" && n.team === t && String(n.player?.name || "").trim() === i;
	}).length >= 2 ? "hattrick" : "normal";
}
var we = 5e3;
function Te({ windowMs: e = we, maxSaves: t = 20 } = {}) {
	let n = [], r = !1;
	return {
		register(i = Date.now()) {
			if (r) return !0;
			let a = Number(i) - e;
			return n = n.filter((e) => e >= a), n.push(Number(i)), n.length > t && (r = !0), r;
		},
		isOpen() {
			return r;
		},
		reset() {
			n = [], r = !1;
		}
	};
}
function Ee(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of Array.isArray(e) ? e : []) {
		if (!n || typeof n != "object" || Array.isArray(n)) continue;
		let e = String(n.id || "");
		e && t.set(e, n);
	}
	return t;
}
function De(e, t) {
	return JSON.stringify(e) === JSON.stringify(t);
}
function Oe(e) {
	if (!e || typeof e != "object" || Array.isArray(e)) return e;
	let t = { ...e };
	return delete t._whatsapp, t;
}
function ke(e) {
	return {
		minute: Math.max(1, Number(e?.minute || 1)),
		history: (Array.isArray(e?.history) ? e.history : []).map((e) => JSON.parse(JSON.stringify(Oe(e))))
	};
}
function Ae(e, t) {
	let n = Ee(t.history), r = Ee(e.history), i = [], a = [], o = [];
	for (let [e, t] of r) (!n.has(e) || !De(n.get(e), t)) && i.push(t);
	for (let [e, t] of n) r.has(e) || (a.push(e), o.push({
		id: e,
		expected: Oe(t)
	}));
	let s = {};
	return i.length && (s.upserts = i), a.length && (s.deletes = a, s.deleteGuards = o), Number(e.minute || 1) !== Number(t.minute || 1) && (s.minute = Number(e.minute || 1)), s;
}
function je(e, t) {
	let n = Ee(t.history), r = {}, i = (Array.isArray(e.upserts) ? e.upserts : []).filter((e) => {
		if (!e || typeof e != "object" || Array.isArray(e)) return !1;
		let t = String(e.id || "");
		return t && (!n.has(t) || !De(n.get(t), e));
	}), a = new Map((Array.isArray(e.deleteGuards) ? e.deleteGuards : []).filter((e) => e?.id && e.expected).map((e) => [e.id, e])), o = (Array.isArray(e.deletes) ? e.deletes : []).filter((e) => n.has(e) && a.has(e));
	return i.length && (r.upserts = i), o.length && (r.deletes = o, r.deleteGuards = o.map((e) => a.get(e)).filter((e) => !!e)), Object.prototype.hasOwnProperty.call(e, "minute") && Number(e.minute || 1) !== Number(t.minute || 1) && (r.minute = Number(e.minute || 1)), r;
}
function Me(e) {
	return Object.keys(e).length > 0;
}
function Ne(e) {
	return Array.isArray(e.upserts) && e.upserts.some((e) => {
		if (!e || typeof e != "object" || Array.isArray(e)) return !1;
		let t = e._whatsapp;
		return !(!t || typeof t != "object" || Array.isArray(t) || t.publish !== !0);
	});
}
function Pe(e) {
	let t = "plaerrdeifl.livetickerPrototype.clientId", n = e.toLowerCase() + "-";
	try {
		let e = localStorage.getItem(t);
		if (e?.startsWith(n)) return e;
		let r = n + s();
		return localStorage.setItem(t, r), r;
	} catch {
		return n + Date.now();
	}
}
async function Fe({ eventId: e, localState: t, serverState: n, clientState: r, environment: i }) {
	let a = Ae(t, r);
	if (!Me(a)) return {
		state: n,
		clientState: ke(n),
		changes: a,
		changed: !1,
		wakeWhatsapp: !1,
		rebased: !1
	};
	let o = async (t, n) => {
		let r = await I("pd_public_liveticker_sync", {
			p_event_id: e,
			p_expected_revision: n,
			p_changes: t,
			p_client_id: Pe(i)
		});
		return k(r);
	};
	try {
		let e = await o(a, n.revision);
		return {
			state: e,
			clientState: ke(e),
			changes: a,
			changed: !0,
			wakeWhatsapp: Ne(a),
			rebased: !1
		};
	} catch (t) {
		if (!(t instanceof M) || t.code !== "PT409") throw t;
		let n = await I("pd_public_liveticker_state", { p_event_id: e }), r = k(n), i = je(a, r);
		if (!Me(i)) return {
			state: r,
			clientState: ke(r),
			changes: i,
			changed: !1,
			wakeWhatsapp: !1,
			rebased: !0
		};
		let s = await o(i, r.revision);
		return {
			state: s,
			clientState: ke(s),
			changes: i,
			changed: !0,
			wakeWhatsapp: Ne(i),
			rebased: !0
		};
	}
}
//#endregion
//#region src/liveticker/history.ts
function $(e) {
	if (!e) return "";
	let t = String(e.name || "").trim(), n = String(e.number || "").trim();
	return n ? "#" + n + " " + t : t;
}
function Ie(e) {
	return !!(e && e.type === "penalty" && e.subtype === "penalty_shot");
}
function Le(e) {
	return !(!e || e.team !== "mighty" && e.team !== "opponent" || e.type !== "goal" && (!Ie(e) || e.result !== "scored"));
}
function Re(e) {
	return (Array.isArray(e) ? e : []).reduce((e, t) => {
		let n = t || {};
		return Le(n) && n.team && (e[n.team] += 1), e;
	}, {
		mighty: 0,
		opponent: 0
	});
}
function ze(e) {
	return (Array.isArray(e) ? e : []).reduce((e, t) => {
		let n = t || {};
		return n.type === "shootout" && n.result === "scored" && (n.team === "mighty" || n.team === "opponent") && (e[n.team] += 1), e;
	}, {
		mighty: 0,
		opponent: 0
	});
}
function Be(e) {
	return (Array.isArray(e) ? e : []).map((e, t) => {
		let n = e || {}, r = Number.parseInt(String(n.minute ?? ""), 10);
		return {
			event: n,
			index: t,
			minute: Number.isInteger(r) ? r : Infinity
		};
	}).sort((e, t) => e.minute - t.minute || e.index - t.index).map((e) => e.event);
}
function Ve(e) {
	if (e.type === "shootout") return "Penaltyschießen";
	let t = Number.parseInt(String(e.minute ?? ""), 10);
	return !Number.isInteger(t) || t < 1 ? "Unbekannt" : t <= 20 ? "1. Drittel" : t <= 40 ? "2. Drittel" : t <= 60 ? "3. Drittel" : "Overtime";
}
function He(e, t) {
	return e === "mighty" ? "Mighty Dogs" : t;
}
function Ue(e, t) {
	if (e.type === "goal") {
		let n = e.player?.name || "Torschütze offen";
		return String(e.minute || "") + "' 🥅 " + n + " · " + He(e.team, t);
	}
	if (Ie(e)) {
		let t = e.player?.name || "Schütze offen";
		return String(e.minute || "") + "' 🏒 Straf-Penalty · " + t + " · " + (e.result === "scored" ? "verwandelt" : "vergeben");
	}
	if (e.type === "shootout") return "🏒 " + (e.player?.name || He(e.team, t)) + " · " + (e.result === "scored" ? "verwandelt" : "vergeben");
	let n = e.penalties?.[0] || null, r = n?.player?.name || (n ? He(n.team, t) : "Strafe"), i = n?.duration ? String(n.duration) + " Min." : "";
	return String(e.minute || "") + "' 🚨 " + r + (i ? " · " + i : "");
}
function We(e, t) {
	let n = Ve(e);
	if (e.type === "goal") {
		let t = $(e.player), r = Array.isArray(e.assists) ? e.assists.filter(Boolean).slice(0, 2).map($).filter(Boolean) : [];
		return [
			n,
			t,
			r.length ? "Assists: " + r.join(" · ") : ""
		].filter(Boolean).join(" · ");
	}
	if (Ie(e)) {
		let t = e.player ? $(e.player) : "Schütze offen", r = e.goalie ? $(e.goalie) : "Goalie offen";
		return n + " · " + t + " gegen " + r + " · " + (e.result === "scored" ? "verwandelt" : "vergeben");
	}
	return e.type === "shootout" ? e.player ? $(e.player) : He(e.team, t) : [n, (Array.isArray(e.penalties) ? e.penalties : []).map((e) => [e.duration ? String(e.duration) + " min" : "", e.reason || ""].filter(Boolean).join(" ")).filter(Boolean).join(" · ")].filter(Boolean).join(" · ");
}
//#endregion
//#region src/liveticker/penalties.ts
var Ge = [
	"Halten",
	"Beinstellen",
	"Haken",
	"Stockschlag",
	"Behinderung",
	"Hoher Stock",
	"Crosscheck",
	"Bandencheck",
	"Check gegen Kopf oder Nacken",
	"Ellbogencheck",
	"Kniecheck",
	"Übertriebene Härte",
	"Unsportliches Verhalten",
	"Spielverzögerung",
	"Zu viele Spieler auf dem Eis"
], Ke = [
	"2",
	"2+2",
	"5",
	"10",
	"2+10",
	"5+10",
	"5+20",
	"20"
];
function qe(e) {
	let t = String(e || "").split("+").map((e) => Number.parseInt(e, 10));
	return !t.length || t.some((e) => !Number.isInteger(e) || e <= 0) ? {
		parts: [],
		total: 0
	} : {
		parts: t,
		total: t.reduce((e, t) => e + t, 0)
	};
}
function Je(e) {
	return qe(e).parts.some((e) => e >= 5);
}
function Ye(e) {
	return new Set(e.map((e) => e.team)).size > 1 ? "both" : e.some((e) => Je(e.duration)) ? "major" : "normal";
}
function Xe(e) {
	let t = Number(e.minute);
	if (!Number.isInteger(t) || t < 1) throw Error("Bitte eine gültige Spielminute ab 1 eingeben.");
	if (!Array.isArray(e.penalties) || !e.penalties.length) throw Error("Bitte mindestens eine Strafe erfassen.");
	for (let t of e.penalties) {
		if (t.team !== "mighty" && t.team !== "opponent") throw Error("Eine Strafe enthält kein gültiges Team.");
		if (!Ke.includes(t.duration)) throw Error("Eine Strafe enthält keine gültige Strafzeit.");
		if (!String(t.reason || "").trim()) throw Error("Eine Strafe enthält keinen Strafgrund.");
	}
	let n = String(e.outputVariantId || "").trim();
	if (!n) throw Error("Bitte eine Strafen-Ausgabevariante wählen.");
	return {
		id: String(e.id || s()),
		type: "penalty",
		minute: t,
		penalties: e.penalties,
		outputVariantId: n
	};
}
function Ze(e, t) {
	let n = Array.isArray(e) ? e.slice() : [], r = n.findIndex((e) => String(e?.id || "") === String(t.id || ""));
	return r >= 0 ? n.splice(r, 1, t) : n.push(t), n;
}
//#endregion
//#region src/liveticker/textsystem.ts
var Qe = /* @__PURE__ */ new Set([
	"minute",
	"scorer",
	"assists",
	"mighty_score",
	"opponent_score",
	"home_score",
	"away_score",
	"score",
	"opponent_name"
]), $e = /* @__PURE__ */ new Set([
	"minute",
	"player_name",
	"jersey_number",
	"player",
	"penalty_duration",
	"penalty_reason",
	"team_name",
	"opponent_name",
	"penalty_line",
	"penalties"
]), et = /* @__PURE__ */ new Set(["scorer", "assists"]), tt = /* @__PURE__ */ new Set([
	"player_name",
	"jersey_number",
	"player",
	"penalty_duration",
	"penalty_reason",
	"team_name",
	"opponent_name",
	"penalty_line"
]), nt = /* @__PURE__ */ new Set([
	"minute",
	"team_name",
	"opponent_name",
	"shooter",
	"goalie",
	"result"
]), rt = /* @__PURE__ */ new Set([
	"team_name",
	"opponent_name",
	"shooter",
	"result"
]), it = /\{\{([^{}]+)\}\}/g, at = /\{\{[a-z_]+\}\}/g;
function ot(e) {
	let t = e || {};
	if (!Array.isArray(t.variants) || !t.variants.length) throw Error("Keine Liveticker-Ausgabevarianten verfügbar.");
	return { variants: t.variants.map((e) => {
		let t = e || {}, n = String(t.id || "").trim(), r = String(t.outputType || "").trim(), i = String(t.name || "").trim(), a = String(t.template ?? "");
		if (!n || !r || !i || !a.trim()) throw Error("Eine Liveticker-Ausgabevariante ist unvollständig.");
		return {
			id: n,
			outputType: r,
			semanticKey: t.semanticKey ? String(t.semanticKey) : null,
			name: i,
			template: a,
			sortOrder: Number(t.sortOrder || 0),
			active: t.active !== !1,
			default: t.default === !0,
			revision: Number(t.revision || 0)
		};
	}) };
}
async function st() {
	return ot(await I("pd_public_liveticker_templates"));
}
function ct(e, t, n = !1) {
	return e.variants.filter((e) => e.outputType === t && (n || e.active)).slice().sort((e, t) => e.sortOrder - t.sortOrder || e.name.localeCompare(t.name, "de"));
}
function lt(e, t) {
	let n = ct(e, t);
	return n.find((e) => e.default) || n[0] || null;
}
function ut(e, t, n, r = []) {
	let i = lt(e, t);
	if (!i) throw Error("Liveticker-Ausgabevariante konnte nicht geladen werden.");
	return pt(i.template, n, new Set(Object.keys(n)), new Set(r));
}
function dt(e, t, n) {
	return ct(e, t).find((e) => e.semanticKey === n) || null;
}
function ft(e, t, n) {
	return e.variants.find((e) => e.outputType === t && e.id === n) || null;
}
function pt(e, t, n, r) {
	let i = String(e ?? "");
	if ([...i.matchAll(it)].map((e) => e[1].trim()).filter((e) => !n.has(e)).length || /\{\{|\}\}/.test(i.replace(at, ""))) throw Error("Der gespeicherte Liveticker-Ausgabetext enthält einen ungültigen Platzhalter.");
	let a = Object.fromEntries([...n].map((e) => [e, String(t[e] ?? "")]));
	return i.split("\n").filter((e) => ![...r].some((t) => e.includes("{{" + t + "}}") && !a[t])).map((e) => e.replace(at, (e) => a[e.slice(2, -2)])).join("\n");
}
function mt(e, t, n = !1) {
	return ct(e, t === "mighty" ? "goal_mighty" : "goal_opponent", n);
}
function ht(e, t) {
	return lt(e, t === "mighty" ? "goal_mighty" : "goal_opponent");
}
function gt(e, t, n) {
	return ft(e, t === "mighty" ? "goal_mighty" : "goal_opponent", n);
}
function _t(e, t) {
	return pt(e, t, Qe, et);
}
function vt(e, t = !1) {
	return ct(e, "penalty", t);
}
function yt(e) {
	return lt(e, "penalty");
}
function bt(e, t) {
	return dt(e, "penalty", t) || yt(e);
}
function xt(e, t) {
	return pt(e, t, $e, tt);
}
function St(e, t) {
	return t === "AWAY" ? {
		home: e.opponent,
		away: e.mighty
	} : {
		home: e.mighty,
		away: e.opponent
	};
}
function Ct(e, t) {
	let n = [];
	for (let r of e) if (n.push(r), String(r?.id || "") === t) break;
	return Re(n);
}
function wt(e) {
	return e && String(e.name || "").trim() ? e : null;
}
function Tt({ event: e, history: t, game: n, snapshot: r }) {
	if (e.type !== "goal" || e.team !== "mighty" && e.team !== "opponent") throw Error("Ungültige Tor-Aktion.");
	let i = String(e.outputVariantId || ""), a = gt(r, e.team, i) || ht(r, e.team);
	if (!a) throw Error("Keine Tor-Ausgabevariante verfügbar.");
	let o = Ct(t, String(e.id || "")), s = St(o, n.homeAway), c = Array.isArray(e.assists) ? e.assists.map(wt).filter((e) => !!e).slice(0, 2) : [];
	return _t(a.template, {
		minute: Number(e.minute || 1),
		scorer: $(wt(e.player)),
		assists: c.map($).join(" · "),
		mighty_score: o.mighty,
		opponent_score: o.opponent,
		home_score: s.home,
		away_score: s.away,
		score: s.home + " : " + s.away,
		opponent_name: n.opponentTeam.shortName
	});
}
function Et(e, t) {
	return e === "mighty" ? "Mighty Dogs" : t.opponentTeam.shortName;
}
function Dt(e, t) {
	let n = e.player ? " · " + $(e.player) : "";
	return Et(e.team, t) + " · " + e.duration + " min · " + e.reason + n;
}
function Ot(e, t) {
	let n = Dt(e, t);
	return Je(e.duration) ? "🚨 *" + n + "*" : n;
}
function kt({ event: e, game: t, snapshot: n }) {
	if (e.type !== "penalty" || e.subtype === "penalty_shot") throw Error("Ungültige Strafen-Aktion.");
	let r = (Array.isArray(e.penalties) ? e.penalties : []).map((e) => ({
		team: e.team,
		duration: String(e.duration || ""),
		reason: String(e.reason || ""),
		player: wt(e.player)
	})).filter((e) => (e.team === "mighty" || e.team === "opponent") && !!e.duration && !!e.reason);
	if (!r.length) throw Error("Bitte mindestens eine Strafe erfassen.");
	let i = ft(n, "penalty", String(e.outputVariantId || "")) || yt(n);
	if (!i) throw Error("Keine Strafen-Ausgabevariante verfügbar.");
	let a = r.length === 1 ? r[0] : null, o = [...new Set(r.map((e) => e.team))];
	return xt(i.template, {
		minute: Number(e.minute || 1),
		player_name: a?.player?.name || "",
		jersey_number: a?.player?.number || "",
		player: a?.player ? $(a.player) : "",
		penalty_duration: a ? a.duration + " min" : "",
		penalty_reason: a?.reason || "",
		team_name: o.map((e) => Et(e, t)).join(" + "),
		opponent_name: t.opponentTeam.shortName,
		penalty_line: a ? Ot(a, t) : "",
		penalties: r.map((e) => Ot(e, t)).join("\n")
	});
}
function At(e, t) {
	return e === "mighty" ? "Mighty Dogs" : t.opponentTeam.shortName;
}
function jt(e, t, n) {
	let r = lt(e, t);
	return String(r?.template || "").trim() || n;
}
function Mt({ event: e, game: t, snapshot: n }) {
	if (e.type !== "penalty" || e.subtype !== "penalty_shot") throw Error("Ungültige Straf-Penalty-Aktion.");
	if (e.team !== "mighty" && e.team !== "opponent") throw Error("Straf-Penalty ohne gültiges Team.");
	let r = ft(n, "penalty_shot", String(e.outputVariantId || "")) || lt(n, "penalty_shot");
	if (!r) throw Error("Keine Straf-Penalty-Ausgabevariante verfügbar.");
	let i = e.team === "mighty" ? "opponent" : "mighty", a = e.player ? $(e.player) : jt(n, "missing_shooter", "Schütze offen"), o = e.goalie ? $(e.goalie) : jt(n, "missing_goalie", "Goalie offen");
	return pt(r.template, {
		minute: Number(e.minute || 1),
		team_name: At(e.team, t),
		opponent_name: At(i, t),
		shooter: a,
		goalie: o,
		result: e.result === "scored" ? "✅ verwandelt" : "❌ vergeben"
	}, nt, /* @__PURE__ */ new Set());
}
function Nt({ event: e, game: t, snapshot: n }) {
	if (e.type !== "shootout") throw Error("Ungültige Penaltyschießen-Aktion.");
	if (e.team !== "mighty" && e.team !== "opponent") throw Error("Penaltyschießen ohne gültiges Team.");
	let r = ft(n, "shootout_attempt", String(e.outputVariantId || "")) || lt(n, "shootout_attempt");
	if (!r) throw Error("Keine Penaltyschießen-Ausgabevariante verfügbar.");
	let i = e.player ? $(e.player) : jt(n, "missing_shooter", "Schütze offen");
	return pt(r.template, {
		team_name: At(e.team, t),
		opponent_name: t.opponentTeam.shortName,
		shooter: i,
		result: e.result === "scored" ? "✅ verwandelt" : "❌ vergeben"
	}, rt, /* @__PURE__ */ new Set());
}
//#endregion
//#region src/components/GoalForm.tsx
function Pt({ game: e, state: t, textsystem: r, mutationsAllowed: i, whatsappEnabled: a, whatsappTransportReady: o, editingEvent: c = null, defaultTeam: u = "mighty", compact: d = !1, submitModeControl: f, onSaved: p, onCancelEdit: m }) {
	let h = c?.type === "goal" ? c : null, g = h ? h.team === "opponent" ? "opponent" : "mighty" : u, _ = g === "mighty" ? e.ownTeam.players : e.opponentTeam.players, v = g === "mighty" ? "goal_mighty" : "goal_opponent", [y, b] = (0, L.useState)(g), [x, S] = (0, L.useState)(h ? Math.max(1, Number(h.minute || 1)) : t.minute), [C, w] = (0, L.useState)(ye(_, h?.player)), [T, E] = (0, L.useState)(ye(_, h?.assists?.[0])), [D, O] = (0, L.useState)(ye(_, h?.assists?.[1])), [k, A] = (0, L.useState)(String(h?.outputVariantId || "")), [j, M] = (0, L.useState)(!1), [N, P] = (0, L.useState)(""), [F, te] = (0, L.useState)(null), [ne, I] = (0, L.useState)(!1), [R, z] = (0, L.useState)(null), [B, V] = (0, L.useState)(""), H = (0, L.useRef)(String(h?.id || s())), U = (0, L.useRef)(Te()), re = (0, L.useRef)(new Set(h?.outputVariantId ? [v] : [])), W = (0, L.useRef)(y), G = y === "mighty" ? e.ownTeam.players : e.opponentTeam.players, K = (0, L.useMemo)(() => mt(r, y), [r, y]), q = (0, L.useMemo)(() => ve(G, C), [G, C]), J = y === "mighty" ? "goal_mighty" : "goal_opponent", Y = (0, L.useMemo)(() => Ce(t.history, y, q?.name || "", H.current), [
		q?.name,
		t.history,
		y
	]);
	(0, L.useEffect)(() => {
		h || S(t.minute);
	}, [
		h,
		t.minute,
		e.eventId
	]), (0, L.useEffect)(() => {
		C && I(!1);
	}, [C]), (0, L.useEffect)(() => {
		W.current !== y && (W.current = y, w(""), E(""), O(""));
	}, [y]), (0, L.useEffect)(() => {
		let e = K.some((e) => e.id === k);
		if (re.current.has(J) && e) return;
		let t = dt(r, J, Y) || ht(r, y) || K[0] || null;
		A(t?.id || "");
	}, [
		J,
		Y,
		y,
		r,
		k,
		K
	]), (0, L.useEffect)(() => {
		U.current.reset(), z(null), V("");
	}, [e.eventId]);
	let ae = (0, L.useCallback)((e) => {
		z(e), e && V("");
	}, []), Z = (0, L.useMemo)(() => {
		try {
			let n = xe({
				id: H.current,
				team: y,
				minute: x,
				player: q,
				assists: [ve(G, T), ve(G, D)].filter((e) => !!e),
				outputVariantId: k
			}), i = Se(t.history, n);
			return {
				event: n,
				history: i,
				text: Tt({
					event: n,
					history: i,
					game: e,
					snapshot: r
				}),
				error: ""
			};
		} catch (e) {
			return {
				event: null,
				history: t.history,
				text: "",
				error: e instanceof Error ? e.message : "Tor konnte nicht vorbereitet werden."
			};
		}
	}, [
		T,
		D,
		e,
		x,
		G,
		q,
		C,
		t.history,
		y,
		r,
		k
	]), oe = F ?? Z.text;
	async function se(r = !1) {
		if (!i) {
			P("Schreibaktionen sind für diesen Stand nicht freigeschaltet.");
			return;
		}
		if (!Z.event || Z.error) {
			P(Z.error || "Tor konnte nicht vorbereitet werden.");
			return;
		}
		let c = !String(Z.event.player?.name || "").trim();
		if (!h && a && c && !r) {
			I(!0), P("");
			return;
		}
		if (I(!1), U.current.register()) {
			P("SYNC gestoppt · Seite neu laden");
			return;
		}
		M(!0), P("Tor wird gespeichert …");
		try {
			let r = n(), i = a && !h, c = me(Z.event, oe, {
				editingId: h ? String(h.id || "") : null,
				enabled: i
			}) || Z.event, u = he(Z.history, c), d = ge({
				whatsappEnabled: i,
				transportReady: o
			}), f = await Fe({
				eventId: e.eventId,
				localState: {
					minute: x,
					history: u
				},
				serverState: t,
				clientState: ke(t),
				environment: r.environment
			});
			p(f.state);
			let g = "", _ = R;
			if (_ && _.actionId === String(Z.event.id || "")) {
				if (ee(_.context, Z.event)) try {
					await l({
						deliveryId: _.deliveryId,
						actionId: _.actionId
					}), z(null), V(""), g = " · Sticker mit Aktion verknüpft.";
				} catch (e) {
					let t = e instanceof Error ? e.message : "Sticker-Verknüpfung fehlgeschlagen.";
					V(t), g = " · Sticker-Verknüpfung offen.";
				}
				else z(null), V("Sticker blieb unverknüpft, weil die Aktion nach dem Senden geändert wurde."), g = " · Sticker nicht verknüpft.";
			}
			f.wakeWhatsapp && ie();
			let v = d ? await _e(oe) : !1, y = (f.wakeWhatsapp ? " · WhatsApp-Text eingereiht." : d ? v ? " · Text kopiert." : " · Text kann aus der Vorschau kopiert werden." : "") + g;
			h ? (P((f.rebased ? "Tor korrigiert · zwischenzeitliche Änderungen wurden berücksichtigt." : "Tor serverseitig korrigiert.") + y), m?.()) : (te(null), H.current = s(), S(f.state.minute), w(""), E(""), O(""), P((f.rebased ? "Tor gespeichert · zwischenzeitliche Änderungen wurden berücksichtigt." : "Tor serverseitig gespeichert.") + y));
		} catch (e) {
			P(e instanceof Error ? e.message : "Tor konnte nicht gespeichert werden.");
		} finally {
			M(!1);
		}
	}
	return /* @__PURE__ */ (0, X.jsxs)("section", {
		className: d ? "workspace-card action-card compact-action-card" : "workspace-card action-card",
		children: [
			!d && /* @__PURE__ */ (0, X.jsxs)("div", {
				className: "workspace-header",
				children: [/* @__PURE__ */ (0, X.jsxs)("div", { children: [/* @__PURE__ */ (0, X.jsx)("p", {
					className: "eyebrow",
					children: h ? "Korrektur" : "Aktion"
				}), /* @__PURE__ */ (0, X.jsx)("h2", { children: h ? "Tor bearbeiten" : "Tor erfassen" })] }), /* @__PURE__ */ (0, X.jsx)("span", {
					className: i ? "write-badge enabled" : "write-badge",
					children: i ? "DEV schreiben" : "gesperrt"
				})]
			}),
			!h && /* @__PURE__ */ (0, X.jsx)(ce, {
				eventId: e.eventId,
				opponentTeamId: e.opponentTeam.id,
				actionId: H.current,
				action: y === "mighty" ? "GOAL_MIGHTY" : "GOAL_OPPONENT",
				mutationsAllowed: i,
				transportReady: o,
				onPendingStickerChange: ae
			}, H.current),
			/* @__PURE__ */ (0, X.jsxs)("div", {
				className: "goal-form-grid classic-goal-fields",
				children: [
					!d && /* @__PURE__ */ (0, X.jsxs)("label", {
						className: "field",
						children: [/* @__PURE__ */ (0, X.jsx)("span", { children: "Team" }), /* @__PURE__ */ (0, X.jsxs)("select", {
							value: y,
							onChange: (e) => b(e.target.value),
							children: [/* @__PURE__ */ (0, X.jsx)("option", {
								value: "mighty",
								children: e.ownTeam.shortName
							}), /* @__PURE__ */ (0, X.jsx)("option", {
								value: "opponent",
								children: e.opponentTeam.shortName
							})]
						})]
					}),
					!d && /* @__PURE__ */ (0, X.jsxs)("label", {
						className: "field",
						children: [/* @__PURE__ */ (0, X.jsx)("span", { children: "Spielminute" }), /* @__PURE__ */ (0, X.jsx)("input", {
							type: "number",
							min: "1",
							value: x,
							onChange: (e) => S(Number(e.target.value))
						})]
					}),
					/* @__PURE__ */ (0, X.jsxs)("label", {
						className: "field",
						children: [/* @__PURE__ */ (0, X.jsxs)("span", { children: ["Torschütze ", y === "mighty" ? e.ownTeam.shortName : e.opponentTeam.shortName] }), /* @__PURE__ */ (0, X.jsx)(ue, {
							players: G,
							value: C,
							onChange: w,
							placeholder: "Spieler wählen",
							numberAriaLabel: "Trikotnummer Torschütze"
						})]
					}),
					/* @__PURE__ */ (0, X.jsxs)("details", {
						className: "assist-details",
						children: [/* @__PURE__ */ (0, X.jsx)("summary", { children: "Assists" }), /* @__PURE__ */ (0, X.jsxs)("div", {
							className: "assist-grid",
							children: [/* @__PURE__ */ (0, X.jsxs)("label", {
								className: "field",
								children: [/* @__PURE__ */ (0, X.jsx)("span", { children: "1. Assist" }), /* @__PURE__ */ (0, X.jsx)(ue, {
									players: G,
									value: T,
									onChange: E,
									placeholder: "Kein / 1. Assist noch unbekannt",
									numberAriaLabel: "Trikotnummer Assist 1"
								})]
							}), /* @__PURE__ */ (0, X.jsxs)("label", {
								className: "field",
								children: [/* @__PURE__ */ (0, X.jsx)("span", { children: "2. Assist" }), /* @__PURE__ */ (0, X.jsx)(ue, {
									players: G,
									value: D,
									onChange: O,
									placeholder: "Kein / 2. Assist noch unbekannt",
									numberAriaLabel: "Trikotnummer Assist 2"
								})]
							})]
						})]
					}),
					/* @__PURE__ */ (0, X.jsxs)("fieldset", {
						className: "classic-fieldset",
						children: [/* @__PURE__ */ (0, X.jsx)("legend", { children: "Textvariante" }), /* @__PURE__ */ (0, X.jsx)(de, {
							ariaLabel: "Textvariante",
							value: k,
							options: K.map((e) => ({
								value: e.id,
								label: e.name
							})),
							onChange: (e) => {
								re.current.add(J), A(e);
							}
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, X.jsx)(fe, {
				generatedText: Z.text,
				error: Z.error,
				manualText: F,
				onManualTextChange: te
			}),
			/* @__PURE__ */ (0, X.jsxs)("div", {
				className: "classic-submit-block",
				children: [
					ne && /* @__PURE__ */ (0, X.jsxs)("section", {
						className: "open-scorer-warning",
						role: "alert",
						children: [
							/* @__PURE__ */ (0, X.jsx)("strong", { children: "Torschütze offen – trotzdem senden?" }),
							/* @__PURE__ */ (0, X.jsx)("span", { children: "Der Tor-Text wird ohne Spielernamen an WhatsApp gesendet." }),
							/* @__PURE__ */ (0, X.jsxs)("div", {
								className: "open-scorer-warning-actions",
								children: [/* @__PURE__ */ (0, X.jsx)("button", {
									className: "primary",
									type: "button",
									disabled: j,
									onClick: () => void se(!0),
									children: "Trotzdem senden"
								}), /* @__PURE__ */ (0, X.jsx)("button", {
									className: "secondary-button",
									type: "button",
									disabled: j,
									onClick: () => I(!1),
									children: "Abbrechen"
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, X.jsxs)("div", {
						className: "liveticker-submit-row",
						children: [f, /* @__PURE__ */ (0, X.jsx)("button", {
							className: "primary submit-compact",
							type: "button",
							"aria-label": h ? "Korrektur speichern" : "Speichern",
							title: h ? "Korrektur speichern" : "Speichern",
							disabled: !i || j || !Z.event || !!Z.error,
							onClick: () => void se(),
							children: /* @__PURE__ */ (0, X.jsx)("span", {
								"aria-hidden": "true",
								children: j ? "…" : "💾 📋"
							})
						})]
					}),
					N && /* @__PURE__ */ (0, X.jsx)("p", {
						className: "liveticker-text-delivery-status",
						children: N
					}),
					R && B && /* @__PURE__ */ (0, X.jsx)("button", {
						className: "secondary-button classic-retry-button",
						type: "button",
						disabled: j,
						onClick: () => void (async () => {
							try {
								await l({
									deliveryId: R.deliveryId,
									actionId: R.actionId
								}), z(null), V(""), P("Sticker nachträglich mit der Toraktion verknüpft.");
							} catch (e) {
								V(e instanceof Error ? e.message : "Sticker-Verknüpfung fehlgeschlagen.");
							}
						})(),
						children: "Sticker-Verknüpfung erneut versuchen"
					}),
					h && /* @__PURE__ */ (0, X.jsx)("button", {
						className: "secondary-button classic-cancel-button",
						type: "button",
						disabled: j,
						onClick: m,
						children: "Abbrechen"
					}),
					B && /* @__PURE__ */ (0, X.jsx)("p", {
						className: "form-error",
						children: B
					})
				]
			})
		]
	});
}
//#endregion
//#region src/components/PenaltyForm.tsx
function Ft() {
	return {
		key: s(),
		team: "mighty",
		duration: "2",
		reason: Ge[0],
		playerId: ""
	};
}
function It(e, t) {
	let n = t.team === "opponent" ? "opponent" : "mighty", r = n === "mighty" ? e.ownTeam.players : e.opponentTeam.players;
	return {
		key: s(),
		team: n,
		duration: String(t.duration || "2"),
		reason: String(t.reason || Ge[0]),
		playerId: ye(r, t.player)
	};
}
function Lt({ game: e, state: t, textsystem: r, mutationsAllowed: i, whatsappEnabled: a, whatsappTransportReady: o, editingEvent: c = null, compact: u = !1, submitModeControl: d, onSaved: f, onCancelEdit: p }) {
	let m = c?.type === "penalty" && c.subtype !== "penalty_shot" ? c : null, h = m?.penalties?.length ? m.penalties.map((t) => It(e, t)) : [Ft()], [g, _] = (0, L.useState)(m ? Math.max(1, Number(m.minute || 1)) : t.minute), [v, y] = (0, L.useState)(h), [b, x] = (0, L.useState)(String(m?.outputVariantId || "")), [S, C] = (0, L.useState)(!!m?.outputVariantId), [w, T] = (0, L.useState)(!1), [E, D] = (0, L.useState)(""), [O, k] = (0, L.useState)(null), [A, j] = (0, L.useState)(null), [M, N] = (0, L.useState)(""), P = (0, L.useRef)(String(m?.id || s())), F = (0, L.useRef)(Te());
	(0, L.useEffect)(() => {
		m || _(t.minute);
	}, [
		m,
		t.minute,
		e.eventId
	]), (0, L.useEffect)(() => {
		F.current.reset(), j(null), N("");
	}, [e.eventId]);
	let te = (0, L.useCallback)((e) => {
		j(e), e && N("");
	}, []), ne = (0, L.useMemo)(() => v.map((t) => {
		let n = t.team === "mighty" ? e.ownTeam.players : e.opponentTeam.players;
		return {
			team: t.team,
			duration: t.duration,
			reason: t.reason,
			player: ve(n, t.playerId)
		};
	}), [e, v]), I = (0, L.useMemo)(() => vt(r), [r]), R = (0, L.useMemo)(() => Ye(ne), [ne]);
	(0, L.useEffect)(() => {
		let e = I.some((e) => e.id === b);
		if (S && e) return;
		let t = bt(r, R);
		x(t?.id || I[0]?.id || "");
	}, [
		R,
		r,
		b,
		S,
		I
	]);
	let z = (0, L.useMemo)(() => t.history.some((e) => String(e?.id || "") === P.current), [t.history]), B = (0, L.useMemo)(() => {
		try {
			let n = Xe({
				id: P.current,
				minute: g,
				penalties: ne,
				outputVariantId: b
			});
			return {
				event: n,
				history: Ze(t.history, n),
				text: kt({
					event: n,
					game: e,
					snapshot: r
				}),
				error: ""
			};
		} catch (e) {
			return {
				event: null,
				history: t.history,
				text: "",
				error: e instanceof Error ? e.message : "Strafe konnte nicht vorbereitet werden."
			};
		}
	}, [
		e,
		g,
		ne,
		t.history,
		r,
		b
	]);
	function V(e, t) {
		y((n) => n.map((n) => n.key === e ? t.team && t.team !== n.team ? {
			...n,
			...t,
			playerId: ""
		} : {
			...n,
			...t
		} : n));
	}
	function H() {
		if (m) {
			p?.();
			return;
		}
		P.current = s(), y([Ft()]), _(t.minute), C(!1), j(null), N(""), D("Neue Strafaktion vorbereitet.");
	}
	let U = O ?? B.text;
	async function re() {
		if (!i) {
			D("Schreibaktionen sind für diesen Stand nicht freigeschaltet.");
			return;
		}
		if (!B.event || B.error) {
			D(B.error || "Strafe konnte nicht vorbereitet werden.");
			return;
		}
		if (F.current.register()) {
			D("SYNC gestoppt · Seite neu laden");
			return;
		}
		T(!0), D("Strafe wird gespeichert …");
		try {
			let r = n(), i = m || z ? String(B.event.id || "") : null, s = a && !i, c = me(B.event, U, {
				editingId: i,
				enabled: s
			}) || B.event, u = he(B.history, c), d = ge({
				whatsappEnabled: s,
				transportReady: o
			}), p = await Fe({
				eventId: e.eventId,
				localState: {
					minute: g,
					history: u
				},
				serverState: t,
				clientState: ke(t),
				environment: r.environment
			});
			f(p.state), _(p.state.minute);
			let h = "", v = A;
			if (v && v.actionId === String(B.event.id || "")) {
				if (ee(v.context, B.event)) try {
					await l({
						deliveryId: v.deliveryId,
						actionId: v.actionId
					}), j(null), N(""), h = " · Sticker mit Aktion verknüpft.";
				} catch (e) {
					let t = e instanceof Error ? e.message : "Sticker-Verknüpfung fehlgeschlagen.";
					N(t), h = " · Sticker-Verknüpfung offen.";
				}
				else j(null), N("Sticker blieb unverknüpft, weil die Strafen nach dem Senden geändert wurden."), h = " · Sticker nicht verknüpft.";
			}
			p.wakeWhatsapp && ie();
			let y = d ? await _e(U) : !1, b = (p.wakeWhatsapp ? " · WhatsApp-Text eingereiht." : d ? y ? " · Text kopiert." : " · Text kann aus der Vorschau kopiert werden." : "") + h;
			k(null), D((p.rebased ? m || z ? "Strafe korrigiert · zwischenzeitliche Änderungen wurden berücksichtigt." : "Strafe gespeichert · zwischenzeitliche Änderungen wurden berücksichtigt." : m || z ? "Strafe serverseitig korrigiert · weitere Strafzeilen können ergänzt werden." : "Strafe serverseitig gespeichert · weitere Strafzeilen können ergänzt werden.") + b);
		} catch (e) {
			D(e instanceof Error ? e.message : "Strafe konnte nicht gespeichert werden.");
		} finally {
			T(!1);
		}
	}
	return /* @__PURE__ */ (0, X.jsxs)("section", {
		className: u ? "workspace-card action-card compact-action-card" : "workspace-card action-card",
		children: [
			!u && /* @__PURE__ */ (0, X.jsxs)("div", {
				className: "workspace-header",
				children: [/* @__PURE__ */ (0, X.jsxs)("div", { children: [/* @__PURE__ */ (0, X.jsx)("p", {
					className: "eyebrow",
					children: m ? "Korrektur" : "Aktion"
				}), /* @__PURE__ */ (0, X.jsx)("h2", { children: m ? "Strafe bearbeiten" : "Strafe erfassen" })] }), /* @__PURE__ */ (0, X.jsx)("span", {
					className: i ? "write-badge enabled" : "write-badge",
					children: i ? "DEV schreiben" : "gesperrt"
				})]
			}),
			!m && !z && /* @__PURE__ */ (0, X.jsx)(ce, {
				eventId: e.eventId,
				opponentTeamId: e.opponentTeam.id,
				actionId: P.current,
				action: "PENALTY",
				penaltyTeams: ne.map((e) => e.team),
				mutationsAllowed: i,
				transportReady: o,
				onPendingStickerChange: te
			}, P.current),
			!u && /* @__PURE__ */ (0, X.jsxs)("label", {
				className: "field",
				children: [/* @__PURE__ */ (0, X.jsx)("span", { children: "Spielminute" }), /* @__PURE__ */ (0, X.jsx)("input", {
					type: "number",
					min: "1",
					value: g,
					onChange: (e) => _(Number(e.target.value))
				})]
			}),
			/* @__PURE__ */ (0, X.jsx)("div", {
				className: "penalty-rows classic-penalty-list",
				children: v.map((t) => {
					let n = t.team === "mighty" ? e.ownTeam.players : e.opponentTeam.players;
					return /* @__PURE__ */ (0, X.jsxs)("article", {
						className: "penalty-edit-row classic-penalty-row",
						children: [/* @__PURE__ */ (0, X.jsxs)("div", {
							className: "penalty-row-head",
							children: [/* @__PURE__ */ (0, X.jsx)("strong", { children: "Strafe" }), /* @__PURE__ */ (0, X.jsxs)("div", {
								className: "penalty-row-actions",
								children: [/* @__PURE__ */ (0, X.jsx)("button", {
									className: "add-penalty",
									type: "button",
									onClick: () => y((e) => [...e, Ft()]),
									children: "Hinzufügen"
								}), /* @__PURE__ */ (0, X.jsx)("button", {
									className: "remove-penalty",
									type: "button",
									disabled: v.length === 1,
									onClick: () => y((e) => e.filter((e) => e.key !== t.key)),
									children: "Entfernen"
								})]
							})]
						}), /* @__PURE__ */ (0, X.jsxs)("div", {
							className: "penalty-grid",
							children: [
								/* @__PURE__ */ (0, X.jsxs)("label", {
									className: "field",
									children: [/* @__PURE__ */ (0, X.jsx)("span", { children: "Team" }), /* @__PURE__ */ (0, X.jsxs)("select", {
										value: t.team,
										onChange: (e) => V(t.key, { team: e.target.value }),
										children: [/* @__PURE__ */ (0, X.jsx)("option", {
											value: "mighty",
											children: e.ownTeam.shortName
										}), /* @__PURE__ */ (0, X.jsx)("option", {
											value: "opponent",
											children: e.opponentTeam.shortName
										})]
									})]
								}),
								/* @__PURE__ */ (0, X.jsxs)("label", {
									className: "field",
									children: [/* @__PURE__ */ (0, X.jsx)("span", { children: "Strafzeit" }), /* @__PURE__ */ (0, X.jsx)("select", {
										value: t.duration,
										onChange: (e) => V(t.key, { duration: e.target.value }),
										children: Ke.map((e) => /* @__PURE__ */ (0, X.jsxs)("option", {
											value: e,
											children: [e, " Min."]
										}, e))
									})]
								}),
								/* @__PURE__ */ (0, X.jsxs)("label", {
									className: "field wide",
									children: [/* @__PURE__ */ (0, X.jsx)("span", { children: "Spieler" }), /* @__PURE__ */ (0, X.jsx)(ue, {
										players: n,
										value: t.playerId,
										onChange: (e) => V(t.key, { playerId: e }),
										placeholder: "Spieler noch unbekannt",
										numberAriaLabel: "Trikotnummer"
									})]
								}),
								/* @__PURE__ */ (0, X.jsxs)("label", {
									className: "field wide",
									children: [/* @__PURE__ */ (0, X.jsx)("span", { children: "Strafgrund" }), /* @__PURE__ */ (0, X.jsx)("select", {
										value: t.reason,
										onChange: (e) => V(t.key, { reason: e.target.value }),
										children: Ge.map((e) => /* @__PURE__ */ (0, X.jsx)("option", {
											value: e,
											children: e
										}, e))
									})]
								})
							]
						})]
					}, t.key);
				})
			}),
			/* @__PURE__ */ (0, X.jsxs)("fieldset", {
				className: "classic-fieldset",
				children: [/* @__PURE__ */ (0, X.jsx)("legend", { children: "Textvariante" }), /* @__PURE__ */ (0, X.jsx)(de, {
					ariaLabel: "Textvariante",
					value: b,
					options: I.map((e) => ({
						value: e.id,
						label: e.name
					})),
					onChange: (e) => {
						x(e), C(!0);
					}
				})]
			}),
			/* @__PURE__ */ (0, X.jsx)(fe, {
				generatedText: B.text,
				error: B.error,
				manualText: O,
				onManualTextChange: k
			}),
			/* @__PURE__ */ (0, X.jsxs)("div", {
				className: "classic-submit-block",
				children: [
					/* @__PURE__ */ (0, X.jsxs)("div", {
						className: "liveticker-submit-row",
						children: [d, /* @__PURE__ */ (0, X.jsx)("button", {
							className: "primary submit-compact",
							type: "button",
							"aria-label": m ? "Korrektur speichern" : "Speichern",
							title: m ? "Korrektur speichern" : "Speichern",
							disabled: !i || w || !B.event || !!B.error,
							onClick: () => void re(),
							children: /* @__PURE__ */ (0, X.jsx)("span", {
								"aria-hidden": "true",
								children: w ? "…" : "💾 📋"
							})
						})]
					}),
					E && /* @__PURE__ */ (0, X.jsx)("p", {
						className: "liveticker-text-delivery-status",
						children: E
					}),
					A && M && /* @__PURE__ */ (0, X.jsx)("button", {
						className: "secondary-button classic-retry-button",
						type: "button",
						disabled: w,
						onClick: () => void (async () => {
							try {
								await l({
									deliveryId: A.deliveryId,
									actionId: A.actionId
								}), j(null), N(""), D("Sticker nachträglich mit der Strafaktion verknüpft.");
							} catch (e) {
								N(e instanceof Error ? e.message : "Sticker-Verknüpfung fehlgeschlagen.");
							}
						})(),
						children: "Sticker-Verknüpfung erneut versuchen"
					}),
					!u && /* @__PURE__ */ (0, X.jsx)("button", {
						className: "secondary-button",
						type: "button",
						disabled: w,
						onClick: H,
						children: m ? "Bearbeiten abbrechen" : "Neue Strafaktion"
					}),
					m && u && /* @__PURE__ */ (0, X.jsx)("button", {
						className: "secondary-button classic-cancel-button",
						type: "button",
						disabled: w,
						onClick: p,
						children: "Abbrechen"
					}),
					M && /* @__PURE__ */ (0, X.jsx)("p", {
						className: "form-error",
						children: M
					})
				]
			})
		]
	});
}
//#endregion
//#region src/liveticker/situations.ts
function Rt(e) {
	return e === "mighty" ? "opponent" : "mighty";
}
function zt(e) {
	return e.filter((e) => e.position === "Tor" || e.position === "GOALIE").map((e) => e.position === "GOALIE" ? {
		...e,
		position: "Tor"
	} : e);
}
function Bt({ id: e, minute: t, team: n, player: r, goalie: i, result: a, outputVariantId: o }) {
	let c = Number(t);
	if (!Number.isInteger(c) || c < 1) throw Error("Bitte eine gültige Spielminute ab 1 eingeben.");
	if (!["scored", "missed"].includes(a)) throw Error("Ungültiges Straf-Penalty-Ergebnis.");
	if (!String(o || "").trim()) throw Error("Bitte eine Straf-Penalty-Ausgabevariante wählen.");
	let l = Rt(n);
	return {
		id: String(e || s()),
		type: "penalty",
		subtype: "penalty_shot",
		minute: c,
		team: n,
		player: r,
		goalie: i,
		result: a,
		outputVariantId: o,
		penalties: [{
			team: l,
			duration: "Penalty",
			reason: "Straf-Penalty",
			player: null
		}]
	};
}
function Vt({ id: e, team: t, player: n, result: r, outputVariantId: i }) {
	if (!["scored", "missed"].includes(r)) throw Error("Ungültiges Penaltyschießen-Ergebnis.");
	if (!String(i || "").trim()) throw Error("Bitte eine Penaltyschießen-Ausgabevariante wählen.");
	return {
		id: String(e || s()),
		type: "shootout",
		team: t,
		player: n,
		result: r,
		outputVariantId: i
	};
}
function Ht(e, t) {
	let n = Array.isArray(e) ? e.slice() : [], r = String(t.id || ""), i = r ? n.findIndex((e) => String(e?.id || "") === r) : -1;
	return i >= 0 ? n.splice(i, 1, t) : n.push(t), n;
}
//#endregion
//#region src/components/SituationForm.tsx
function Ut({ game: e, state: t, textsystem: r, mutationsAllowed: i, whatsappEnabled: a, whatsappTransportReady: o, editingEvent: c = null, compact: l = !1, submitModeControl: u, defaultKind: d = "penalty_shot", allowStickerOnly: f = !1, onSaved: p, onCancelEdit: m }) {
	let h = c && (c.type === "shootout" || Ie(c)) ? c : null, g = h ? h.type === "shootout" ? "shootout" : "penalty_shot" : d, _ = h?.team === "opponent" ? "opponent" : "mighty", v = _ === "mighty" ? e.ownTeam.players : e.opponentTeam.players, y = zt(Rt(_) === "mighty" ? e.ownTeam.players : e.opponentTeam.players), [b, x] = (0, L.useState)(g), [S, C] = (0, L.useState)(!!h || !f), [w, ee] = (0, L.useState)(_), [T, E] = (0, L.useState)(h && g === "penalty_shot" ? Math.max(1, Number(h.minute || 1)) : t.minute), [D, O] = (0, L.useState)(ye(v, h?.player)), [k, A] = (0, L.useState)(g === "penalty_shot" ? ye(y, h?.goalie) : ""), [j, M] = (0, L.useState)(h?.result === "scored" ? "scored" : h?.result === "missed" || g === "penalty_shot" ? "missed" : "scored"), [N, P] = (0, L.useState)(String(h?.outputVariantId || "")), [F, te] = (0, L.useState)(!1), [ne, I] = (0, L.useState)(""), [R, z] = (0, L.useState)(null), B = (0, L.useRef)(String(h?.id || s())), V = (0, L.useRef)(Te()), H = (0, L.useRef)(b), U = (0, L.useRef)(w), re = w === "mighty" ? e.ownTeam.players : e.opponentTeam.players, W = Rt(w), G = zt(W === "mighty" ? e.ownTeam.players : e.opponentTeam.players), K = b === "penalty_shot" ? "penalty_shot" : "shootout_attempt", q = (0, L.useMemo)(() => ct(r, K), [K, r]);
	(0, L.useEffect)(() => {
		h || E(t.minute);
	}, [
		h,
		t.minute,
		e.eventId
	]), (0, L.useEffect)(() => {
		let e = q.some((e) => e.id === N);
		if (h && e) return;
		let t = lt(r, K);
		P(t?.id || q[0]?.id || "");
	}, [
		h,
		K,
		r,
		N,
		q
	]), (0, L.useEffect)(() => {
		H.current !== b && (H.current = b, O(""), A(""), M(b === "penalty_shot" ? "missed" : "scored"), P(lt(r, K)?.id || q[0]?.id || ""));
	}, [
		b,
		K,
		r,
		q
	]), (0, L.useEffect)(() => {
		U.current !== w && (U.current = w, O(""), A(""));
	}, [w]), (0, L.useEffect)(() => {
		V.current.reset();
	}, [e.eventId]);
	let J = (0, L.useMemo)(() => {
		try {
			let n = ve(re, D), i = b === "penalty_shot" ? Bt({
				id: B.current,
				minute: T,
				team: w,
				player: n,
				goalie: ve(G, k),
				result: j,
				outputVariantId: N
			}) : Vt({
				id: B.current,
				team: w,
				player: n,
				result: j,
				outputVariantId: N
			});
			return {
				event: i,
				history: Ht(t.history, i),
				text: b === "penalty_shot" ? Mt({
					event: i,
					game: e,
					snapshot: r
				}) : Nt({
					event: i,
					game: e,
					snapshot: r
				}),
				error: ""
			};
		} catch (e) {
			return {
				event: null,
				history: t.history,
				text: "",
				error: e instanceof Error ? e.message : "Spielsituation konnte nicht vorbereitet werden."
			};
		}
	}, [
		re,
		e,
		k,
		G,
		b,
		T,
		D,
		j,
		t.history,
		w,
		r,
		N
	]), Y = R ?? J.text;
	async function ae() {
		if (!i) {
			I("Schreibaktionen sind für diesen Stand nicht freigeschaltet.");
			return;
		}
		if (!J.event || J.error) {
			I(J.error || "Spielsituation konnte nicht vorbereitet werden.");
			return;
		}
		if (V.current.register()) {
			I("SYNC gestoppt · Seite neu laden");
			return;
		}
		te(!0), I("Spielsituation wird gespeichert …");
		try {
			let r = n(), i = a && !h, c = me(J.event, Y, {
				editingId: h ? String(h.id || "") : null,
				enabled: i
			}) || J.event, l = he(J.history, c), u = ge({
				whatsappEnabled: i,
				transportReady: o
			}), d = await Fe({
				eventId: e.eventId,
				localState: {
					minute: b === "penalty_shot" ? T : t.minute,
					history: l
				},
				serverState: t,
				clientState: ke(t),
				environment: r.environment
			});
			p(d.state), d.wakeWhatsapp && ie();
			let f = u ? await _e(Y) : !1, g = d.wakeWhatsapp ? " · WhatsApp-Text eingereiht." : u ? f ? " · Text kopiert." : " · Text kann aus der Vorschau kopiert werden." : "";
			h ? (I((d.rebased ? "Spielsituation korrigiert · zwischenzeitliche Änderungen wurden berücksichtigt." : "Spielsituation serverseitig korrigiert.") + g), m?.()) : (z(null), B.current = s(), O(""), A(""), E(d.state.minute), I((d.rebased ? "Spielsituation gespeichert · zwischenzeitliche Änderungen wurden berücksichtigt." : "Spielsituation serverseitig gespeichert.") + g));
		} catch (e) {
			I(e instanceof Error ? e.message : "Spielsituation konnte nicht gespeichert werden.");
		} finally {
			te(!1);
		}
	}
	return /* @__PURE__ */ (0, X.jsxs)("section", {
		className: l ? "workspace-card action-card compact-action-card" : "workspace-card action-card",
		children: [
			!l && /* @__PURE__ */ (0, X.jsxs)("div", {
				className: "workspace-header",
				children: [/* @__PURE__ */ (0, X.jsxs)("div", { children: [/* @__PURE__ */ (0, X.jsx)("p", {
					className: "eyebrow",
					children: h ? "Korrektur" : "Spielsituation"
				}), /* @__PURE__ */ (0, X.jsx)("h2", { children: h ? b === "penalty_shot" ? "Straf-Penalty bearbeiten" : "Penaltyschießen bearbeiten" : b === "penalty_shot" ? "Straf-Penalty" : "Penaltyschießen" })] }), /* @__PURE__ */ (0, X.jsx)("span", {
					className: i ? "write-badge enabled" : "write-badge",
					children: i ? "DEV schreiben" : "gesperrt"
				})]
			}),
			!h && f && /* @__PURE__ */ (0, X.jsx)(ce, {
				eventId: e.eventId,
				opponentTeamId: e.opponentTeam.id,
				actionId: "",
				action: "SITUATION",
				mutationsAllowed: i,
				transportReady: o
			}),
			f && !h && /* @__PURE__ */ (0, X.jsxs)("fieldset", {
				className: "classic-fieldset",
				children: [/* @__PURE__ */ (0, X.jsx)("legend", { children: "Situation" }), /* @__PURE__ */ (0, X.jsx)("div", {
					className: "classic-segmented",
					children: /* @__PURE__ */ (0, X.jsx)("button", {
						type: "button",
						"aria-pressed": S,
						onClick: () => {
							C((e) => !e), x("penalty_shot");
						},
						children: "🏒 Straf-Penalty"
					})
				})]
			}),
			S && /* @__PURE__ */ (0, X.jsxs)(X.Fragment, { children: [
				/* @__PURE__ */ (0, X.jsxs)("div", {
					className: "goal-form-grid classic-situation-fields",
					children: [
						!l && /* @__PURE__ */ (0, X.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, X.jsx)("span", { children: "Situation" }), /* @__PURE__ */ (0, X.jsxs)("select", {
								value: b,
								onChange: (e) => x(e.target.value),
								children: [/* @__PURE__ */ (0, X.jsx)("option", {
									value: "penalty_shot",
									children: "Straf-Penalty"
								}), /* @__PURE__ */ (0, X.jsx)("option", {
									value: "shootout",
									children: "Penaltyschießen"
								})]
							})]
						}),
						/* @__PURE__ */ (0, X.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, X.jsx)("span", { children: b === "penalty_shot" ? "Angreifendes Team" : "Mannschaft" }), /* @__PURE__ */ (0, X.jsxs)("select", {
								value: w,
								onChange: (e) => ee(e.target.value),
								children: [/* @__PURE__ */ (0, X.jsx)("option", {
									value: "mighty",
									children: e.ownTeam.shortName
								}), /* @__PURE__ */ (0, X.jsx)("option", {
									value: "opponent",
									children: e.opponentTeam.shortName
								})]
							})]
						}),
						b === "penalty_shot" && !l && /* @__PURE__ */ (0, X.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, X.jsx)("span", { children: "Spielminute" }), /* @__PURE__ */ (0, X.jsx)("input", {
								type: "number",
								min: "1",
								value: T,
								onChange: (e) => E(Number(e.target.value))
							})]
						}),
						/* @__PURE__ */ (0, X.jsxs)("label", {
							className: "field wide",
							children: [/* @__PURE__ */ (0, X.jsx)("span", { children: b === "penalty_shot" ? "Schütze " + (w === "mighty" ? e.ownTeam.shortName : e.opponentTeam.shortName) : "Schütze" }), /* @__PURE__ */ (0, X.jsx)(ue, {
								players: re,
								value: D,
								onChange: O,
								placeholder: "Schütze noch unbekannt",
								numberAriaLabel: b === "penalty_shot" ? "Trikotnummer Straf-Penalty Schütze" : "Trikotnummer Penaltyschütze"
							})]
						}),
						b === "penalty_shot" && /* @__PURE__ */ (0, X.jsxs)("label", {
							className: "field wide",
							children: [/* @__PURE__ */ (0, X.jsxs)("span", { children: ["Goalie ", W === "mighty" ? e.ownTeam.shortName : e.opponentTeam.shortName] }), /* @__PURE__ */ (0, X.jsx)(ue, {
								players: G,
								value: k,
								onChange: A,
								placeholder: "Goalie noch unbekannt",
								numberAriaLabel: "Trikotnummer verteidigender Goalie"
							})]
						}),
						/* @__PURE__ */ (0, X.jsxs)("fieldset", {
							className: "classic-fieldset wide",
							children: [/* @__PURE__ */ (0, X.jsx)("legend", { children: "Ergebnis" }), /* @__PURE__ */ (0, X.jsx)(de, {
								ariaLabel: "Ergebnis",
								value: j,
								options: [{
									value: "scored",
									label: "✅ Verwandelt"
								}, {
									value: "missed",
									label: "❌ Vergeben"
								}],
								onChange: (e) => M(e)
							})]
						}),
						/* @__PURE__ */ (0, X.jsxs)("fieldset", {
							className: "classic-fieldset wide",
							children: [/* @__PURE__ */ (0, X.jsx)("legend", { children: "Textvariante" }), /* @__PURE__ */ (0, X.jsx)(de, {
								ariaLabel: "Textvariante",
								value: N,
								options: q.map((e) => ({
									value: e.id,
									label: e.name
								})),
								onChange: P
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, X.jsx)(fe, {
					generatedText: J.text,
					error: J.error,
					manualText: R,
					onManualTextChange: z
				}),
				/* @__PURE__ */ (0, X.jsxs)("div", {
					className: "classic-submit-block",
					children: [
						/* @__PURE__ */ (0, X.jsxs)("div", {
							className: "liveticker-submit-row",
							children: [u, /* @__PURE__ */ (0, X.jsx)("button", {
								className: "primary submit-compact",
								type: "button",
								"aria-label": h ? "Korrektur speichern" : "Speichern",
								title: h ? "Korrektur speichern" : "Speichern",
								disabled: !i || F || !J.event || !!J.error,
								onClick: () => void ae(),
								children: /* @__PURE__ */ (0, X.jsx)("span", {
									"aria-hidden": "true",
									children: F ? "…" : "💾 📋"
								})
							})]
						}),
						ne && /* @__PURE__ */ (0, X.jsx)("p", {
							className: "liveticker-text-delivery-status",
							children: ne
						}),
						h && /* @__PURE__ */ (0, X.jsx)("button", {
							className: "secondary-button classic-cancel-button",
							type: "button",
							disabled: F,
							onClick: m,
							children: "Abbrechen"
						})
					]
				})
			] })
		]
	});
}
//#endregion
//#region src/liveticker/minute.ts
var Wt = Object.freeze({
	P1: Object.freeze({
		key: "P1",
		label: "1. Drittel",
		order: 1
	}),
	P2: Object.freeze({
		key: "P2",
		label: "2. Drittel",
		order: 2
	}),
	P3: Object.freeze({
		key: "P3",
		label: "3. Drittel",
		order: 3
	}),
	OT: Object.freeze({
		key: "OT",
		label: "Overtime",
		order: 4
	})
});
function Gt(e) {
	let t = Number.parseInt(String(e ?? ""), 10);
	if (!Number.isInteger(t) || t < 1) throw Error("Bitte eine gültige Spielminute ab 1 eingeben.");
	return t;
}
function Kt(e) {
	let t = Gt(e);
	return t <= 20 ? Wt.P1 : t <= 40 ? Wt.P2 : t <= 60 ? Wt.P3 : Wt.OT;
}
function qt(e, t) {
	let n = Gt(e), r = Number.parseInt(String(t), 10);
	if (!Number.isInteger(r)) throw Error("Ungültige Minutenänderung.");
	return Math.max(1, n + r);
}
//#endregion
//#region src/components/MinuteControl.tsx
function Jt({ minute: e, disabled: t, saving: n, onCommit: r }) {
	let [i, a] = (0, L.useState)(String(e)), [o, s] = (0, L.useState)("");
	(0, L.useEffect)(() => {
		a(String(e)), s("");
	}, [e]);
	let c = (0, L.useMemo)(() => {
		try {
			return Kt(i);
		} catch {
			return Kt(e);
		}
	}, [i, e]);
	async function l(t) {
		try {
			let n = Gt(t);
			if (a(String(n)), s(""), n === e) return;
			await r(n);
		} catch (t) {
			a(String(e)), s(t instanceof Error ? t.message : "Spielminute konnte nicht gespeichert werden.");
		}
	}
	async function u(t) {
		try {
			let n = qt(i || e, t);
			if (a(String(n)), s(""), n === e) return;
			await r(n);
		} catch (t) {
			a(String(e)), s(t instanceof Error ? t.message : "Spielminute konnte nicht gespeichert werden.");
		}
	}
	return /* @__PURE__ */ (0, X.jsxs)("section", {
		className: "minute-card",
		children: [
			/* @__PURE__ */ (0, X.jsxs)("div", {
				className: "minute-heading",
				children: [/* @__PURE__ */ (0, X.jsxs)("div", { children: [/* @__PURE__ */ (0, X.jsx)("p", {
					className: "eyebrow",
					children: "Spielzeit"
				}), /* @__PURE__ */ (0, X.jsx)("h2", { children: "Spielminute" })] }), /* @__PURE__ */ (0, X.jsx)("strong", {
					className: "segment-badge",
					children: c.label
				})]
			}),
			/* @__PURE__ */ (0, X.jsxs)("div", {
				className: "minute-control",
				children: [
					/* @__PURE__ */ (0, X.jsx)("button", {
						className: "minute-button",
						type: "button",
						"aria-label": "Eine Minute zurück",
						disabled: t || n,
						onClick: () => void u(-1),
						children: "−"
					}),
					/* @__PURE__ */ (0, X.jsx)("input", {
						className: "minute-input",
						type: "number",
						inputMode: "numeric",
						min: "1",
						step: "1",
						value: i,
						disabled: t || n,
						"aria-label": "Spielminute",
						onChange: (e) => a(e.target.value),
						onBlur: () => void l(i),
						onKeyDown: (t) => {
							t.key === "Enter" && t.currentTarget.blur(), t.key === "Escape" && (a(String(e)), s(""), t.currentTarget.blur());
						}
					}),
					/* @__PURE__ */ (0, X.jsx)("button", {
						className: "minute-button",
						type: "button",
						"aria-label": "Eine Minute weiter",
						disabled: t || n,
						onClick: () => void u(1),
						children: "+"
					})
				]
			}),
			/* @__PURE__ */ (0, X.jsx)("p", {
				className: "minute-help",
				children: n ? "Minute wird serverseitig gespeichert …" : t ? "Spielzeit ist in diesem Zustand schreibgeschützt." : "Änderungen werden revision-sicher im zentralen Spielstand gespeichert."
			}),
			o && /* @__PURE__ */ (0, X.jsx)("p", {
				className: "form-error",
				children: o
			})
		]
	});
}
//#endregion
//#region src/liveticker/finalization-server.ts
var Yt = [
	"NOT_REQUESTED",
	"RENDERING",
	"FINALIZE_PENDING",
	"RETRYABLE_ERROR",
	"GRAPHIC_FAILED",
	"REQUIRES_REVIEW",
	"COMPLETED"
];
function Xt(e) {
	let t = e || {}, n = String(t.status ?? "").toUpperCase();
	if (!Yt.includes(n)) throw Error("Unbekannter serverseitiger FINAL-Status.");
	if (typeof t.eventId != "string" || !t.eventId) throw Error("FINAL-Status ohne Spielbezug.");
	let r = (e) => typeof t[e] == "string" && t[e] ? String(t[e]) : null;
	return {
		eventId: t.eventId,
		finalizationId: r("finalizationId"),
		jobId: r("jobId"),
		status: n,
		graphicStatus: r("graphicStatus"),
		errorCode: r("errorCode"),
		completedAt: r("completedAt")
	};
}
function Zt(e) {
	return e === "RENDERING" || e === "FINALIZE_PENDING" || e === "RETRYABLE_ERROR";
}
function Qt(e) {
	return e === "GRAPHIC_FAILED" || e === "REQUIRES_REVIEW";
}
function $t(e) {
	switch (e.status) {
		case "NOT_REQUESTED": return "FINAL wurde noch nicht angefordert.";
		case "RENDERING": return "FINAL angefordert · Grafik und Publishing laufen serverseitig.";
		case "FINALIZE_PENDING": return "POST und STORY sind fertig · Spielabschluss läuft.";
		case "RETRYABLE_ERROR": return "Grafik fertig · Server wiederholt den Abschluss automatisch.";
		case "GRAPHIC_FAILED": return "FINAL-Grafik fehlgeschlagen · Spiel bleibt aktiv. Erneut erstellen möglich.";
		case "REQUIRES_REVIEW": return "FINAL benötigt eine bewusste Korrektur (" + (e.errorCode || "Spielstand verändert") + "). Neue FINAL-Anforderung erforderlich.";
		case "COMPLETED": return "Spiel serverseitig abgeschlossen und archiviert.";
	}
}
async function en(e) {
	return Xt(await i("liveticker_finalization_status", { eventId: e }));
}
async function tn({ eventId: e, expectedRevision: t, retry: n = !1 }) {
	if (!Number.isSafeInteger(t) || t < 0) throw Error("Ungültige Spielrevision für FINAL.");
	return Xt(await i("liveticker_finalization_start", {
		eventId: e,
		expectedRevision: t,
		retry: n,
		clientRequestId: crypto.randomUUID()
	}));
}
//#endregion
//#region src/components/GraphicsPanel.tsx
function nn(e) {
	return JSON.stringify([
		e.downloadUrl,
		e.sha256,
		e.bytes
	]);
}
function rn(e, t) {
	return e + ":" + t;
}
function an() {
	return typeof File == "function" && typeof navigator.share == "function" && typeof navigator.canShare == "function";
}
function on(e) {
	return e.downloadUrl ? (window.location.assign(e.downloadUrl), "downloaded") : "invalid";
}
function sn({ eventId: e, mutationsAllowed: t, gameCompleted: n, gameRevision: r, summaryTextForKind: i, onServerFinalized: s, activeKind: l, compact: d = !1 }) {
	let [g, _] = (0, L.useState)({ jobs: [] }), [y, b] = (0, L.useState)(null), [S, C] = (0, L.useState)(() => l || "PERIOD_1"), [w, ee] = (0, L.useState)(!0), [k, A] = (0, L.useState)(""), [j, M] = (0, L.useState)(""), [N, P] = (0, L.useState)("Grafikstatus wird geladen …"), [F, te] = (0, L.useState)(""), [ne, I] = (0, L.useState)(0), [R, z] = (0, L.useState)(0), [B, V] = (0, L.useState)({}), H = (0, L.useRef)(/* @__PURE__ */ new Map()), U = (0, L.useRef)(/* @__PURE__ */ new Map()), re = (0, L.useRef)(""), W = (0, L.useRef)(s);
	(0, L.useEffect)(() => {
		W.current = s;
	}, [s]), (0, L.useEffect)(() => {
		b(null), re.current = "";
	}, [e]), (0, L.useEffect)(() => {
		C(l || "PERIOD_1"), V({});
	}, [e, l]), (0, L.useEffect)(() => {
		l && C(l);
	}, [l]);
	let G = (0, L.useCallback)(async () => {
		if (e) try {
			let t = await a(e), n = null;
			try {
				n = await h(e), te("");
			} catch (e) {
				te(e instanceof Error ? e.message : "WhatsApp-Status konnte nicht geladen werden.");
			}
			_(t);
			let r = await en(e);
			b(r), r.status === "COMPLETED" && r.finalizationId && re.current !== r.finalizationId && (re.current = r.finalizationId, Promise.resolve(W.current?.()).catch(() => {
				P("Spiel abgeschlossen, aber die Spielansicht konnte nicht neu geladen werden.");
			}));
			let i = !1, s = {};
			for (let r of c) {
				let a = o(t, r), c = rn(e, r), l = U.current.get(c) || null;
				if (a?.status === "SUCCEEDED" && a.jobId) {
					if (!l || l.jobId !== a.jobId) {
						let t = v(e, a.jobId);
						t ? (l = {
							eventId: e,
							jobId: a.jobId,
							deliveryId: t
						}, U.current.set(c, l), i = !0) : l && (U.current.delete(c), l = null, i = !0);
					}
				} else l && (U.current.delete(c), l = null, i = !0);
				if (l && l.jobId === a?.jobId && n) {
					let e = f(n, l.deliveryId);
					e && (s[r] = e);
				}
			}
			i && z((e) => e + 1), n && V(s), P($t(r));
		} catch (e) {
			P(e instanceof Error ? e.message : "Grafikstatus konnte nicht geladen werden.");
		} finally {
			ee(!1);
		}
	}, [e]);
	(0, L.useEffect)(() => {
		ee(!0), G();
	}, [G]);
	let K = (0, L.useMemo)(() => o(g, S), [S, g]), q = (0, L.useMemo)(() => K?.status === "SUCCEEDED" && K.result?.artifacts || [], [K]), J = (0, L.useMemo)(() => q.find((e) => e.kind === "POST") || null, [q]), Y = g.jobs.some((e) => O(e)), ae = U.current.get(rn(e, S)) || null, Z = B[S] || null, se = !(!ae || Z && p(Z.status)), Q = c.some((t) => {
		if (!U.current.get(rn(e, t))) return !1;
		let n = B[t];
		return !n || !p(n.status);
	});
	(0, L.useEffect)(() => {
		if (!Y && !Q && !Zt(y?.status)) return;
		let e = window.setTimeout(() => void G(), Q ? 1e3 : 2500);
		return () => window.clearTimeout(e);
	}, [
		Y,
		Q,
		y?.status,
		G,
		g,
		B
	]), (0, L.useEffect)(() => {
		if (q.length) for (let e of q) {
			let t = nn(e);
			if (H.current.has(t)) continue;
			let n = {
				prepared: null,
				pending: !0,
				failed: !1
			};
			H.current.set(t, n), I((e) => e + 1), E(e).then((e) => {
				n.prepared = e, n.pending = !1, I((e) => e + 1);
			}, () => {
				n.pending = !1, n.failed = !0, I((e) => e + 1);
			});
		}
	}, [q]);
	async function ce(i) {
		if (!t || n) {
			P("Grafik-Erstellung ist für dieses Spiel nicht freigeschaltet.");
			return;
		}
		if (!(k || O(o(g, i))) && (i !== "FINAL" || !Zt(y?.status) && window.confirm(Qt(y?.status) ? "FINAL nach Fehler erneut anfordern? Eine neue Grafik wird erstellt und das Spiel nach Erfolg abgeschlossen." : "Spiel wirklich beenden? Nach erfolgreicher POST- und STORY-Grafik wird es automatisch abgeschlossen und archiviert."))) {
			C(i), A(i), P(D(i) + " · Flyer wird angelegt …");
			try {
				if (i === "FINAL") {
					let t = await tn({
						eventId: e,
						expectedRevision: r,
						retry: Qt(y?.status)
					});
					b(t);
				} else await T(e, i);
				P(D(i) + " · Flyer wird erstellt …"), await G();
			} catch (e) {
				P(e instanceof Error ? e.message : "Grafik konnte nicht angelegt werden.");
			} finally {
				A("");
			}
		}
	}
	async function le(n) {
		if (!t) {
			P("WhatsApp-Versand ist in diesem Stand nicht freigeschaltet.");
			return;
		}
		let r = o(g, n);
		if (r?.status !== "SUCCEEDED") return;
		let a = r.result?.artifacts.find((e) => e.kind === "POST") || null;
		if (!a) {
			P("POST-Flyer fehlt – WhatsApp wird nicht gesendet.");
			return;
		}
		let s = U.current.get(rn(e, n)), c = B[n];
		if (!s || c && p(c.status)) {
			M(n), P(D(n) + " · POST + Text werden an WhatsApp übergeben …");
			try {
				if (s?.jobId === r.jobId && c?.status === "FAILED") {
					await m({
						eventId: e,
						deliveryId: s.deliveryId
					}), ie(), P("Bestehender WhatsApp-Auftrag wird mit denselben Zielen erneut versucht."), await G();
					return;
				}
				let t = await x({
					eventId: e,
					graphicJobId: r.jobId,
					kind: n,
					artifact: a,
					message: i(n)
				});
				ie(), U.current.set(rn(e, n), {
					eventId: e,
					jobId: r.jobId,
					deliveryId: t
				}), z((e) => e + 1), V((e) => ({
					...e,
					[n]: {
						id: t,
						status: "QUEUED",
						stickerStatus: "NOT_REQUESTED",
						textStatus: "PENDING",
						attemptCount: 0,
						linkedActionId: null,
						error: null
					}
				})), await G();
			} catch (e) {
				P(e instanceof Error ? e.message : "WhatsApp-Versand konnte nicht angelegt werden.");
			} finally {
				M("");
			}
		}
	}
	function ue(e) {
		let t = H.current.get(nn(e))?.prepared;
		try {
			if (t && typeof File == "function" && typeof navigator.share == "function" && typeof navigator.canShare == "function") {
				let n = new File([t.blob], t.filename, { type: "image/png" });
				if (navigator.canShare({ files: [n] })) {
					navigator.share({
						files: [n],
						title: D(S) + " · " + (e.kind === "POST" ? "Post" : "Story")
					}).catch((t) => {
						t?.name !== "AbortError" && on(e);
					});
					return;
				}
			}
		} catch (t) {
			if (t?.name === "AbortError") return;
			on(e);
			return;
		}
		on(e);
	}
	let de = Z?.status === "SUCCEEDED" ? "✅ POST + Text erfolgreich an WhatsApp gesendet." : Z?.status === "FAILED" ? "WhatsApp-Versand fehlgeschlagen." : ae ? "POST + Text werden an WhatsApp gesendet …" : "";
	return /* @__PURE__ */ (0, X.jsxs)("section", {
		className: d ? "classic-graphics-panel" : "workspace-card",
		children: [
			!d && /* @__PURE__ */ (0, X.jsx)("div", {
				className: "workspace-header compact",
				children: /* @__PURE__ */ (0, X.jsxs)("div", { children: [/* @__PURE__ */ (0, X.jsx)("p", {
					className: "eyebrow",
					children: "Grafikausgabe"
				}), /* @__PURE__ */ (0, X.jsx)("h2", { children: "Flyer" })] })
			}),
			!d && /* @__PURE__ */ (0, X.jsx)("div", {
				className: "graphic-kind-tabs",
				children: c.map((e) => {
					let t = o(g, e), n = t?.status === "SUCCEEDED" ? "✓" : O(t) ? "…" : t?.status === "FAILED" ? "!" : "—";
					return /* @__PURE__ */ (0, X.jsxs)("button", {
						className: e === S ? "graphic-kind-tab active" : "graphic-kind-tab",
						type: "button",
						onClick: () => C(e),
						children: [
							D(e),
							" ",
							n
						]
					}, e);
				})
			}),
			/* @__PURE__ */ (0, X.jsxs)("div", {
				className: "graphic-result",
				children: [
					d ? /* @__PURE__ */ (0, X.jsx)("p", {
						className: "graphic-status",
						"data-state": K?.status === "SUCCEEDED" ? "success" : K?.status === "FAILED" ? "error" : O(K) ? "active" : "idle",
						children: u(K)
					}) : /* @__PURE__ */ (0, X.jsxs)("div", {
						className: "graphic-result-head",
						children: [/* @__PURE__ */ (0, X.jsxs)("div", { children: [/* @__PURE__ */ (0, X.jsx)("strong", { children: D(S) }), /* @__PURE__ */ (0, X.jsx)("span", { children: u(K) })] }), /* @__PURE__ */ (0, X.jsx)("button", {
							className: "secondary-button compact-button",
							type: "button",
							disabled: w,
							onClick: () => void G(),
							children: "Aktualisieren"
						})]
					}),
					S === "FINAL" && y && y.status !== "NOT_REQUESTED" && /* @__PURE__ */ (0, X.jsx)("p", {
						className: "graphic-status",
						"data-state": y.status === "COMPLETED" ? "success" : Qt(y.status) ? "error" : "active",
						children: $t(y)
					}),
					K?.status === "SUCCEEDED" && q.length > 0 && /* @__PURE__ */ (0, X.jsx)("div", {
						className: "graphic-artifact-grid",
						children: q.map((e) => {
							let t = H.current.get(nn(e)), n = an() && !!t?.pending && !t?.prepared && !t?.failed;
							return /* @__PURE__ */ (0, X.jsx)("button", {
								className: "graphic-artifact-button",
								type: "button",
								disabled: n,
								onClick: () => ue(e),
								children: n ? (e.kind === "POST" ? "Post" : "Story") + " wird vorbereitet …" : e.kind === "POST" ? "Post teilen" : "Story teilen"
							}, e.kind + e.downloadUrl);
						})
					}),
					K?.status === "SUCCEEDED" && !q.length && /* @__PURE__ */ (0, X.jsx)("p", {
						className: "empty-note",
						children: "Flyer ist fertig, aber es wurden keine sicheren Post-/Story-Links geliefert."
					}),
					K?.status === "SUCCEEDED" && /* @__PURE__ */ (0, X.jsxs)("div", {
						className: "whatsapp-summary-actions",
						children: [
							/* @__PURE__ */ (0, X.jsx)("button", {
								type: "button",
								disabled: !t || !J || j === S || se || !!Z?.targets?.some((e) => e.error === "DELIVERY_OUTCOME_UNKNOWN"),
								onClick: () => void le(S),
								children: j === S || se ? "📲 Wird an WhatsApp gesendet …" : Z?.status === "SUCCEEDED" ? "📲 Erneut an WhatsApp senden" : Z?.status === "FAILED" ? "📲 WhatsApp erneut versuchen" : "📲 An WhatsApp senden"
							}),
							/* @__PURE__ */ (0, X.jsx)(oe, { delivery: Z }),
							de && /* @__PURE__ */ (0, X.jsxs)("p", {
								className: "whatsapp-delivery-note",
								"data-state": Z?.status === "SUCCEEDED" ? "success" : Z?.status === "FAILED" ? "error" : "active",
								children: [de, Z?.status === "FAILED" && Z.error ? " " + Z.error : ""]
							})
						]
					}),
					/* @__PURE__ */ (0, X.jsx)("div", {
						className: "graphic-actions",
						children: K?.status === "SUCCEEDED" ? /* @__PURE__ */ (0, X.jsx)("button", {
							className: "secondary-button",
							type: "button",
							disabled: !t || n || !!k || S === "FINAL" && Zt(y?.status),
							onClick: () => void ce(S),
							children: "Neu erstellen"
						}) : /* @__PURE__ */ (0, X.jsx)("button", {
							type: "button",
							disabled: !t || n || !!k || O(K) || S === "FINAL" && Zt(y?.status),
							onClick: () => void ce(S),
							children: k === S || O(K) ? "Flyer wird erstellt …" : K?.status === "FAILED" ? "Erneut erstellen" : "🖼️ Flyer erstellen"
						})
					})
				]
			}),
			(!d || w || K?.status === "FAILED") && /* @__PURE__ */ (0, X.jsx)("p", {
				className: "workspace-message",
				"data-loading": w ? "true" : "false",
				children: N
			}),
			F && /* @__PURE__ */ (0, X.jsxs)("p", {
				className: "whatsapp-delivery-note",
				"data-state": "error",
				children: ["WhatsApp-Status: ", F]
			}),
			!d && /* @__PURE__ */ (0, X.jsx)("p", {
				className: "graphic-safety-note",
				children: "WhatsApp gilt erst nach bestätigtem Delivery-Status als erfolgreich."
			})
		]
	});
}
//#endregion
//#region src/components/TextDeliveryMode.tsx
function cn({ transport: e, manualCopyMode: t, onManualCopyModeChange: n, compact: r = !1 }) {
	let i = e.ready && !t, a = e.ready ? i ? "Neue Aktionen senden ihren Text automatisch über WhatsApp." : "Neue Aktionen werden gespeichert und nur kopiert." : "WhatsApp ist nicht vollständig bereit. Neue Aktionen fallen auf Kopieren zurück.";
	return r ? /* @__PURE__ */ (0, X.jsxs)("div", {
		className: "liveticker-text-mode",
		role: "group",
		"aria-label": "Textausgabe",
		title: a,
		children: [
			/* @__PURE__ */ (0, X.jsx)("button", {
				type: "button",
				"aria-pressed": i,
				disabled: !e.ready,
				onClick: () => n(!1),
				children: "📲 WhatsApp"
			}),
			/* @__PURE__ */ (0, X.jsx)("button", {
				type: "button",
				"aria-pressed": !i,
				onClick: () => n(!0),
				children: "📋 Nur kopieren"
			}),
			e.errors.length > 0 && /* @__PURE__ */ (0, X.jsx)("span", {
				className: "visually-hidden",
				role: "status",
				children: e.errors.join(" · ")
			})
		]
	}) : /* @__PURE__ */ (0, X.jsxs)("section", {
		className: "text-delivery-card",
		children: [
			/* @__PURE__ */ (0, X.jsxs)("div", {
				className: "text-delivery-heading",
				children: [/* @__PURE__ */ (0, X.jsxs)("div", { children: [/* @__PURE__ */ (0, X.jsx)("p", {
					className: "eyebrow",
					children: "Textausgabe"
				}), /* @__PURE__ */ (0, X.jsx)("h2", { children: "Neue Aktionen" })] }), /* @__PURE__ */ (0, X.jsx)("span", {
					className: e.ready ? "write-badge enabled" : "write-badge",
					children: e.ready ? "Transport bereit" : "Transport nicht bereit"
				})]
			}),
			/* @__PURE__ */ (0, X.jsxs)("div", {
				className: "text-delivery-toggle",
				role: "group",
				"aria-label": "Textausgabe",
				children: [/* @__PURE__ */ (0, X.jsx)("button", {
					type: "button",
					"aria-pressed": i,
					disabled: !e.ready,
					onClick: () => n(!1),
					children: "📲 WhatsApp"
				}), /* @__PURE__ */ (0, X.jsx)("button", {
					type: "button",
					"aria-pressed": !i,
					onClick: () => n(!0),
					children: "📋 Nur kopieren"
				})]
			}),
			/* @__PURE__ */ (0, X.jsx)("p", {
				className: "text-delivery-status",
				children: a
			}),
			e.errors.length > 0 && /* @__PURE__ */ (0, X.jsx)("p", {
				className: "form-error",
				children: e.errors.join(" · ")
			})
		]
	});
}
//#endregion
//#region src/liveticker/summary.ts
var ln = {
	P1: 1,
	P2: 2,
	P3: 3,
	OT: 4
};
function un(e) {
	if (e.type === "shootout") return 5;
	let t = Number.parseInt(String(e.minute ?? ""), 10);
	return !Number.isInteger(t) || t < 1 ? 99 : t <= 20 ? 1 : t <= 40 ? 2 : t <= 60 ? 3 : 4;
}
function dn(e, t, n) {
	let r = lt(e, t);
	return String(r?.template || "").trim() || n;
}
function fn(e, t) {
	return e === "mighty" ? "Mighty Dogs" : t.opponentTeam.shortName;
}
function pn(e, t, n, r, i = null) {
	let a = i ? ln[i] : null;
	return Be(e).filter((e) => Le(e) && e.team === t && (a === null || un(e) <= a)).map((e) => {
		let t = Ie(e) ? "🏒 Straf-Penalty · " + (e.player ? $(e.player) : dn(r, "missing_shooter", "Schütze offen")) : e.player ? $(e.player) : dn(r, "missing_goal_scorer", "Torschütze offen");
		return ut(r, "goal_summary_line", {
			minute: Number(e.minute || 1),
			scorer: t
		});
	});
}
function mn({ history: e, segmentKey: t, game: n, snapshot: r }) {
	let i = ln[t];
	if (!i) throw Error("Für diesen Abschnitt gibt es keine Drittelzusammenfassung.");
	let a = Be(e).reduce((e, t) => (Le(t) && t.team && un(t) <= i && (e[t.team] += 1), e), {
		mighty: 0,
		opponent: 0
	}), o = pn(e, "mighty", n, r, t), s = pn(e, "opponent", n, r, t), c = St(a, n.homeAway);
	return ut(r, "period_summary", {
		period_label: t === "OT" ? "Overtime" : t === "P1" ? "1. Drittel" : t === "P2" ? "2. Drittel" : "3. Drittel",
		score_line: c.home + ":" + c.away,
		own_goals: (o.length ? o : [dn(r, "no_goals", "Keine Tore")]).join("\n"),
		opponent_goals: (s.length ? s : [dn(r, "no_goals", "Keine Tore")]).join("\n"),
		opponent_name: n.opponentTeam.shortName
	});
}
function hn(e, t, n, r) {
	let i = [];
	for (let n of Be(e)) if (n.type === "penalty") {
		if (Ie(n)) {
			(n.team === "mighty" ? "opponent" : "mighty") === t && i.push(ut(r, "penalty_shot_summary_line", {
				minute: Number(n.minute || 1),
				shooter: n.player ? $(n.player) : dn(r, "missing_shooter", "Schütze offen"),
				goalie: n.goalie ? $(n.goalie) : dn(r, "missing_goalie", "Goalie offen"),
				result: n.result === "scored" ? "verwandelt" : "vergeben"
			}));
			continue;
		}
		for (let e of Array.isArray(n.penalties) ? n.penalties : []) {
			if (e.team !== t) continue;
			let a = e.player ? $(e.player) : "ohne Spieler", o = String(e.duration || ""), s = String(e.reason || ""), c = ut(r, "penalty_summary_line", {
				minute: Number(n.minute || 1),
				player: a,
				penalty_duration: o + " min",
				penalty_reason: s
			});
			i.push(Je(o) ? "🚨 *" + c + "*" : c);
		}
	}
	return i.length ? i : [dn(r, "no_penalties", "Keine Strafen")];
}
function gn(e, t, n) {
	let r = Be(e).filter((e) => e.type === "shootout");
	if (!r.length) return "";
	let i = ze(e), a = r.map((e) => {
		if (e.team !== "mighty" && e.team !== "opponent") throw Error("Penaltyschießen ohne gültiges Team.");
		return ut(n, "shootout_summary_line", {
			team_name: fn(e.team, t),
			shooter: e.player ? $(e.player) : dn(n, "missing_shooter", "Schütze offen"),
			result: e.result === "scored" ? "verwandelt" : "vergeben"
		});
	});
	return ut(n, "shootout_summary", {
		mighty_score: i.mighty,
		opponent_score: i.opponent,
		opponent_name: t.opponentTeam.shortName,
		shootout_attempts: a.join("\n")
	});
}
function _n(e) {
	let t = Re(e);
	if (Be(e).filter((e) => e.type === "shootout").length) {
		let n = ze(e);
		return n.mighty === n.opponent ? {
			...t,
			suffix: "Penaltyschießen läuft"
		} : {
			mighty: t.mighty + +(n.mighty > n.opponent),
			opponent: t.opponent + +(n.opponent > n.mighty),
			suffix: "n. P."
		};
	}
	return Be(e).some((e) => Le(e) && Number(e.minute) > 60) ? {
		...t,
		suffix: "n. V."
	} : {
		...t,
		suffix: ""
	};
}
function vn({ history: e, game: t, snapshot: n }) {
	let r = _n(e), i = St(r, t.homeAway), a = r.suffix ? " " + r.suffix : "", o = t.homeAway === "AWAY" ? t.opponentTeam.shortName + " " + i.home + ":" + i.away + " Mighty Dogs" + a : "Mighty Dogs " + i.home + ":" + i.away + " " + t.opponentTeam.shortName + a, s = pn(e, "mighty", t, n), c = pn(e, "opponent", t, n);
	return ut(n, "final_summary", {
		score_line: o,
		own_goals: (s.length ? s : [dn(n, "no_goals", "Keine Tore")]).join("\n"),
		opponent_goals: (c.length ? c : [dn(n, "no_goals", "Keine Tore")]).join("\n"),
		own_penalties: hn(e, "mighty", t, n).join("\n"),
		opponent_penalties: hn(e, "opponent", t, n).join("\n"),
		shootout_summary: gn(e, t, n),
		opponent_name: t.opponentTeam.shortName
	}, ["shootout_summary"]);
}
function yn({ kind: e, history: t, game: n, snapshot: r }) {
	return e === "PERIOD_1" ? mn({
		history: t,
		segmentKey: "P1",
		game: n,
		snapshot: r
	}) : e === "PERIOD_2" ? mn({
		history: t,
		segmentKey: "P2",
		game: n,
		snapshot: r
	}) : vn({
		history: t,
		game: n,
		snapshot: r
	});
}
//#endregion
//#region src/components/GameWorkspace.tsx
function bn({ history: e, opponentShortName: t, mutationsAllowed: n, deletingId: r, editingId: i, onEdit: a, onDelete: o }) {
	let [s, c] = (0, L.useState)(!1), l = (0, L.useMemo)(() => Be(e).reverse(), [e]), u = s ? l : l.slice(0, 5);
	return l.length ? /* @__PURE__ */ (0, X.jsxs)(X.Fragment, { children: [/* @__PURE__ */ (0, X.jsx)("div", {
		className: "history-list",
		children: u.map((e, s) => {
			let c = e, l = c.type === "penalty" && !Ie(c) && Array.isArray(c.penalties) && c.penalties.some((e) => Je(String(e.duration || "")));
			return /* @__PURE__ */ (0, X.jsxs)("details", {
				className: l ? "history-item major" : "history-item",
				children: [/* @__PURE__ */ (0, X.jsxs)("summary", { children: [/* @__PURE__ */ (0, X.jsx)("span", { children: Ue(c, t) }), /* @__PURE__ */ (0, X.jsx)("span", {
					className: "history-chevron",
					"aria-hidden": "true",
					children: "⌄"
				})] }), /* @__PURE__ */ (0, X.jsxs)("div", {
					className: "history-detail-body",
					children: [/* @__PURE__ */ (0, X.jsx)("p", { children: We(e, t) }), /* @__PURE__ */ (0, X.jsxs)("div", {
						className: "inline-actions",
						children: [/* @__PURE__ */ (0, X.jsx)("button", {
							className: "secondary-button compact-button",
							type: "button",
							disabled: !n || i === String(e.id || ""),
							onClick: () => a(e),
							children: i === String(e.id || "") ? "Wird bearbeitet" : "Bearbeiten"
						}), /* @__PURE__ */ (0, X.jsx)("button", {
							className: "danger-button compact-button",
							type: "button",
							disabled: !n || r === String(e.id || ""),
							onClick: () => void o(e),
							children: r === String(e.id || "") ? "Wird zurückgenommen …" : "Zurücknehmen"
						})]
					})]
				})]
			}, String(e.id || s));
		})
	}), l.length > 5 && /* @__PURE__ */ (0, X.jsx)("button", {
		className: "history-toggle",
		type: "button",
		onClick: () => c((e) => !e),
		children: s ? "Weniger anzeigen ▴" : "Alle Ereignisse anzeigen ▾"
	})] }) : /* @__PURE__ */ (0, X.jsx)("p", {
		className: "empty-note",
		children: "Noch keine Aktion erfasst."
	});
}
function xn({ mutationsAllowed: e }) {
	let t = n().environment, [r, i] = (0, L.useState)([]), [s, c] = (0, L.useState)(""), [l, u] = (0, L.useState)(null), [d, f] = (0, L.useState)(null), [p, m] = (0, L.useState)(!0), [h, g] = (0, L.useState)("Spiele werden geladen …"), [_, v] = (0, L.useState)(""), [y, b] = (0, L.useState)(null), [x, S] = (0, L.useState)(!1), [C, ee] = (0, L.useState)(!1), [T, E] = (0, L.useState)(!1), [D, k] = (0, L.useState)("GOAL_MIGHTY"), [M, I] = (0, L.useState)(""), [R, z] = (0, L.useState)(""), [B, V] = (0, L.useState)("PERIOD_1"), [H, U] = (0, L.useState)(!1), [re, W] = (0, L.useState)({
		PERIOD_1: "—",
		PERIOD_2: "—",
		FINAL: "—"
	}), [q, Y] = (0, L.useState)({
		ready: !1,
		wa: {
			ready: !1,
			state: "UNREACHABLE"
		},
		wpp: {
			ready: !1,
			state: "UNREACHABLE",
			desiredConnected: !0,
			error: null
		},
		routing: null,
		errors: []
	}), ie = (0, L.useRef)(Te()), [oe, se] = (0, L.useState)(null);
	(0, L.useEffect)(() => {
		let e = !1;
		return st().then((t) => {
			e || (f(t), se(null));
		}).catch((t) => {
			e || se(t instanceof Error ? t.message : "Textbausteine konnten nicht geladen werden.");
		}), () => {
			e = !0;
		};
	}, []), (0, L.useEffect)(() => {
		let e = !1;
		return (async () => {
			try {
				let t = await N();
				if (e) return;
				if (!t.length) {
					i([]), u(null), g("Keine Spiele im Spielplan verfügbar."), m(!1);
					return;
				}
				let n = te(), r = t.find((e) => e.eventId === n) || t[0];
				i(t), c(r.eventId), P(r.eventId);
				let a = await F(r.eventId);
				if (e) return;
				u(a), g("Zentraler Liveticker-State geladen."), m(!1);
			} catch (t) {
				if (e) return;
				g(t instanceof Error ? t.message : "Spiele konnten nicht geladen werden."), m(!1);
			}
		})(), () => {
			e = !0;
		};
	}, []), (0, L.useEffect)(() => {
		let e = !1, n = 0, r = async () => {
			let i = await G(t);
			e || (Y(i), n = window.setTimeout(r, 5e3));
		};
		return r(), () => {
			e = !0, n && window.clearTimeout(n);
		};
	}, [t]), (0, L.useEffect)(() => {
		if (!s) return;
		let e = !1, t = 0, n = async () => {
			try {
				let r = await en(s);
				if (e) return;
				if (r.status === "COMPLETED") {
					let t = await F(s);
					if (e) return;
					u((e) => e?.eventId === s && !e.completedAt ? t : e);
					return;
				}
				Zt(r.status) && (t = window.setTimeout(n, 5e3));
			} catch {
				e || (t = window.setTimeout(n, 1e4));
			}
		};
		return n(), () => {
			e = !0, t && window.clearTimeout(t);
		};
	}, [s]);
	let Q = (0, L.useMemo)(() => r.find((e) => e.eventId === s) || null, [r, s]);
	(0, L.useEffect)(() => {
		if (!s) return;
		let e = !1, t = 0, n = async () => {
			try {
				let t = await a(s);
				if (e) return;
				let n = {};
				for (let e of [
					"PERIOD_1",
					"PERIOD_2",
					"FINAL"
				]) {
					let r = o(t, e);
					n[e] = r?.status === "SUCCEEDED" ? "✓" : O(r) ? "…" : r?.status === "FAILED" ? "!" : "—";
				}
				W(n);
			} catch {
				e || W({
					PERIOD_1: "—",
					PERIOD_2: "—",
					FINAL: "—"
				});
			} finally {
				e || (t = window.setTimeout(n, 5e3));
			}
		};
		return n(), () => {
			e = !0, t && window.clearTimeout(t);
		};
	}, [s]);
	let ce = (0, L.useMemo)(() => Re(l?.history || []), [l?.history]), le = (0, L.useMemo)(() => ze(l?.history || []), [l?.history]), ue = (0, L.useMemo)(() => (l?.history || []).some((e) => e?.type === "shootout"), [l?.history]), de = (0, L.useMemo)(() => Kt(l?.minute || 1), [l?.minute]);
	function fe(e) {
		b(e), e.type === "goal" ? k(e.team === "opponent" ? "GOAL_OPPONENT" : "GOAL_MIGHTY") : e.type === "penalty" && !Ie(e) ? k("PENALTY") : e.type === "shootout" ? k("SHOOTOUT") : k("SITUATION");
	}
	async function pe(t) {
		if (!l || !Q || !t.id) return;
		if (!e || l.completedAt) {
			g("Schreibaktionen sind für diesen Stand nicht freigeschaltet.");
			return;
		}
		let r = Ue(t, Q.opponentTeam.shortName);
		if (!window.confirm("Aktion „" + r + "“ wirklich zurücknehmen?")) return;
		if (ie.current.register()) {
			g("SYNC gestoppt · Seite neu laden");
			return;
		}
		let i = String(t.id);
		v(i), g("Aktion wird zurückgenommen …");
		try {
			let e = n(), t = l.history.filter((e) => String(e?.id || "") !== i), r = await Fe({
				eventId: Q.eventId,
				localState: {
					minute: l.minute,
					history: t
				},
				serverState: l,
				clientState: ke(l),
				environment: e.environment
			});
			u(r.state), String(y?.id || "") === i && b(null), g(r.rebased ? "Aktion zurückgenommen · zwischenzeitliche Änderungen wurden berücksichtigt." : "Aktion serverseitig zurückgenommen.");
		} catch (e) {
			g(e instanceof Error ? e.message : "Aktion konnte nicht zurückgenommen werden.");
		} finally {
			v("");
		}
	}
	async function me(t) {
		if (l && Q) {
			if (!e || l.completedAt) {
				g("Schreibaktionen sind für diesen Stand nicht freigeschaltet.");
				return;
			}
			if (ie.current.register()) {
				g("SYNC gestoppt · Seite neu laden");
				return;
			}
			S(!0), g("Spielminute wird gespeichert …");
			try {
				let e = n(), r = await Fe({
					eventId: Q.eventId,
					localState: {
						minute: t,
						history: l.history
					},
					serverState: l,
					clientState: ke(l),
					environment: e.environment
				});
				u(r.state), g(r.rebased ? "Spielminute gespeichert · zwischenzeitliche Änderungen wurden berücksichtigt." : "Spielminute serverseitig gespeichert.");
			} catch (e) {
				throw g(e instanceof Error ? e.message : "Spielminute konnte nicht gespeichert werden."), e;
			} finally {
				S(!1);
			}
		}
	}
	async function he() {
		if (l && Q && !C && j() && window.confirm("Testspiel „" + Q.displayTitle + "“ wirklich als neuen Testlauf starten? Aktionen, Spielminute und aktuelle Versand-/Grafikstatus werden zurückgesetzt.")) {
			ee(!0), g("Testspiel wird zurückgesetzt …");
			try {
				let e = await A({
					eventId: Q.eventId,
					expectedRevision: l.revision
				});
				u(e), b(null), k("GOAL_MIGHTY"), U(!1), W({
					PERIOD_1: "—",
					PERIOD_2: "—",
					FINAL: "—"
				}), ie.current.reset(), g("Neuer Testlauf gestartet.");
			} catch (e) {
				g(e instanceof Error ? e.message : "Testspiel konnte nicht zurückgesetzt werden.");
			} finally {
				ee(!1);
			}
		}
	}
	function ge(e) {
		if (l && Q) {
			if (e === "FINAL" && l.minute < 60) {
				g("Der Endstand kann erst ab Minute 60 erstellt werden.");
				return;
			}
			V(e), U(!0);
		}
	}
	async function _e() {
		if (!Q) return;
		let e = await F(Q.eventId);
		u(e), g(e.completedAt ? "Spiel serverseitig abgeschlossen und archiviert." : "FINAL wird noch serverseitig verarbeitet.");
	}
	function ve(e) {
		e.open && e.parentElement?.querySelectorAll("details.worker-control").forEach((t) => {
			t !== e && (t.open = !1);
		});
	}
	async function ye() {
		if (!M) {
			I("wa"), z("");
			try {
				await K(!q.wa.enabled), Y(await G(t));
			} catch (e) {
				z(e instanceof Error ? e.message : "WhatsApp-Worker konnte nicht geändert werden.");
			} finally {
				I("");
			}
		}
	}
	async function be() {
		if (!(M || t !== "PROD")) {
			I("wpp"), z("");
			try {
				await J(q.wpp.desiredConnected === !1), Y(await G(t));
			} catch (e) {
				z(e instanceof Error ? e.message : "WPP konnte nicht geändert werden.");
			} finally {
				I("");
			}
		}
	}
	async function xe(e) {
		c(e), P(e), m(!0), g("Spielstand wird geladen …"), b(null), k("GOAL_MIGHTY"), U(!1), ie.current.reset();
		try {
			let t = await F(e);
			u(t), g("Zentraler Liveticker-State geladen.");
		} catch (e) {
			u(null), g(e instanceof Error ? e.message : "Spielstand konnte nicht geladen werden.");
		} finally {
			m(!1);
		}
	}
	return /* @__PURE__ */ (0, X.jsxs)("div", {
		className: "classic-ticker-stack",
		children: [
			/* @__PURE__ */ (0, X.jsxs)("section", {
				className: "card classic-score-card",
				"aria-label": "Aktueller Spielstand",
				children: [
					/* @__PURE__ */ (0, X.jsxs)("div", {
						className: "classic-system-strip status-bar-tools",
						"aria-label": "Systemstatus",
						children: [
							/* @__PURE__ */ (0, X.jsxs)("details", {
								className: "worker-control",
								onToggle: (e) => ve(e.currentTarget),
								children: [/* @__PURE__ */ (0, X.jsx)("summary", {
									title: "Nur der " + t + "-WhatsApp-Worker",
									children: /* @__PURE__ */ (0, X.jsxs)("span", {
										className: "worker-indicator",
										children: [
											/* @__PURE__ */ (0, X.jsx)("span", {
												className: q.wa.ready ? "worker-dot active" : q.wa.enabled ? "worker-dot starting" : "worker-dot",
												children: "●"
											}),
											/* @__PURE__ */ (0, X.jsxs)("span", { children: ["WA ", t] }),
											/* @__PURE__ */ (0, X.jsx)("strong", { children: q.wa.ready ? "AKTIV" : q.wa.enabled ? "STARTET …" : "AUS" })
										]
									})
								}), /* @__PURE__ */ (0, X.jsx)("div", {
									className: "worker-control-body",
									children: /* @__PURE__ */ (0, X.jsx)("button", {
										type: "button",
										disabled: !!M,
										onClick: () => void ye(),
										children: M === "wa" ? "Speichert …" : q.wa.enabled ? "Ausschalten" : "Einschalten"
									})
								})]
							}),
							/* @__PURE__ */ (0, X.jsxs)("details", {
								className: "worker-control",
								onToggle: (e) => ve(e.currentTarget),
								children: [/* @__PURE__ */ (0, X.jsx)("summary", {
									title: "Globale WhatsApp-Verbindung für DEV und PROD",
									children: /* @__PURE__ */ (0, X.jsxs)("span", {
										className: "worker-indicator",
										children: [
											/* @__PURE__ */ (0, X.jsx)("span", {
												className: q.wpp.ready ? "worker-dot active" : q.wpp.state === "CONNECTING" ? "worker-dot starting" : "worker-dot",
												children: "●"
											}),
											/* @__PURE__ */ (0, X.jsx)("span", { children: "WPP GLOBAL" }),
											/* @__PURE__ */ (0, X.jsx)("strong", { children: q.wpp.ready ? "VERBUNDEN" : q.wpp.state })
										]
									})
								}), /* @__PURE__ */ (0, X.jsx)("div", {
									className: "worker-control-body",
									children: /* @__PURE__ */ (0, X.jsx)("button", {
										type: "button",
										disabled: !!M || t !== "PROD",
										onClick: () => void be(),
										children: t === "PROD" ? M === "wpp" ? "Speichert …" : q.wpp.desiredConnected === !1 ? "Verbinden" : "Trennen" : "Steuerung nur in PROD"
									})
								})]
							}),
							/* @__PURE__ */ (0, X.jsx)(Z, {
								environment: t,
								status: q,
								disabled: !e,
								onToggle: ve,
								onChange: Y
							})
						]
					}),
					/* @__PURE__ */ (0, X.jsxs)("p", {
						className: "classic-target-summary",
						children: [
							"Neue WhatsApp-Ausgaben: ",
							/* @__PURE__ */ (0, X.jsx)("strong", { children: ae(q) }),
							t === "DEV" && q.routing?.deliveryApproved !== !0 ? " · Versand noch nicht freigegeben" : ""
						]
					}),
					R && /* @__PURE__ */ (0, X.jsx)("p", {
						className: "classic-runtime-message",
						children: R
					}),
					/* @__PURE__ */ (0, X.jsxs)("div", {
						className: "classic-segment-bar",
						children: [/* @__PURE__ */ (0, X.jsx)("strong", { children: de.label }), ue && /* @__PURE__ */ (0, X.jsxs)("span", { children: [
							"Penaltyschießen · ",
							le.mighty,
							":",
							le.opponent
						] })]
					}),
					/* @__PURE__ */ (0, X.jsxs)("label", {
						className: "classic-game-field",
						children: [
							/* @__PURE__ */ (0, X.jsx)("span", { children: "Spiel" }),
							/* @__PURE__ */ (0, X.jsx)("select", {
								value: s,
								disabled: p || !r.length,
								onChange: (e) => void xe(e.target.value),
								children: r.map((e) => /* @__PURE__ */ (0, X.jsx)("option", {
									value: e.eventId,
									children: ne(e)
								}, e.eventId))
							}),
							/* @__PURE__ */ (0, X.jsx)("small", {
								"data-state": p ? "pending" : h && h !== "Zentraler Liveticker-State geladen." ? "error" : "success",
								children: p ? "Lädt …" : h && h !== "Zentraler Liveticker-State geladen." ? h : "Synchronisiert"
							})
						]
					}),
					/* @__PURE__ */ (0, X.jsxs)("div", {
						className: "classic-live-row",
						children: [/* @__PURE__ */ (0, X.jsxs)("div", {
							className: "classic-score-field",
							children: [/* @__PURE__ */ (0, X.jsx)("span", {
								className: "classic-control-label",
								children: "Spielstand"
							}), /* @__PURE__ */ (0, X.jsxs)("div", {
								className: "classic-scoreboard",
								children: [
									/* @__PURE__ */ (0, X.jsxs)("div", { children: [/* @__PURE__ */ (0, X.jsx)("span", { children: "Heim" }), /* @__PURE__ */ (0, X.jsx)("strong", { children: Q ? Q.homeAway === "HOME" ? ce.mighty : ce.opponent : 0 })] }),
									/* @__PURE__ */ (0, X.jsx)("b", { children: ":" }),
									/* @__PURE__ */ (0, X.jsxs)("div", { children: [/* @__PURE__ */ (0, X.jsx)("span", { children: "Gast" }), /* @__PURE__ */ (0, X.jsx)("strong", { children: Q ? Q.homeAway === "HOME" ? ce.opponent : ce.mighty : 0 })] })
								]
							})]
						}), l && /* @__PURE__ */ (0, X.jsxs)("div", {
							className: "classic-minute-field",
							children: [/* @__PURE__ */ (0, X.jsx)("span", {
								className: "classic-control-label",
								children: "Spielminute"
							}), /* @__PURE__ */ (0, X.jsx)(Jt, {
								minute: l.minute,
								disabled: !e || !!l.completedAt,
								saving: x,
								onCommit: me
							})]
						})]
					}),
					/* @__PURE__ */ (0, X.jsx)("div", {
						className: "classic-output-strip",
						"aria-label": "Drittel- und Endausgaben",
						children: [
							"PERIOD_1",
							"PERIOD_2",
							"FINAL"
						].map((e) => {
							let t = re[e];
							return /* @__PURE__ */ (0, X.jsxs)("button", {
								className: t === "✓" ? "ready" : t === "…" ? "active" : "",
								type: "button",
								disabled: !Q || !l || e === "FINAL" && l.minute < 60,
								onClick: () => ge(e),
								children: [
									e === "PERIOD_1" ? "1. Drittel" : e === "PERIOD_2" ? "2. Drittel" : "Spiel beenden",
									" ",
									t
								]
							}, e);
						})
					}),
					H && Q && l && d && /* @__PURE__ */ (0, X.jsxs)("section", {
						className: "classic-output-drawer",
						children: [/* @__PURE__ */ (0, X.jsxs)("div", {
							className: "classic-drawer-head",
							children: [/* @__PURE__ */ (0, X.jsx)("strong", { children: B === "PERIOD_1" ? "1. Drittel · Ausgabe" : B === "PERIOD_2" ? "2. Drittel · Ausgabe" : "Endstand · Ausgabe" }), /* @__PURE__ */ (0, X.jsx)("button", {
								type: "button",
								onClick: () => U(!1),
								children: "Schließen"
							})]
						}), /* @__PURE__ */ (0, X.jsx)(sn, {
							eventId: Q.eventId,
							mutationsAllowed: e,
							gameCompleted: !!l.completedAt,
							gameRevision: l.revision,
							activeKind: B,
							compact: !0,
							summaryTextForKind: (e) => yn({
								kind: e,
								history: l.history,
								game: Q,
								snapshot: d
							}),
							onServerFinalized: _e
						})]
					}),
					(p || h && h !== "Zentraler Liveticker-State geladen.") && /* @__PURE__ */ (0, X.jsx)("p", {
						className: "classic-load-message",
						"data-loading": p ? "true" : "false",
						children: h
					})
				]
			}),
			Q && l && !d && /* @__PURE__ */ (0, X.jsx)("p", {
				className: "classic-load-message",
				role: oe ? "alert" : "status",
				children: oe ? `Aktionen gesperrt: ${oe}. Bitte den Spieltag neu laden.` : "Textbausteine werden geladen. Aktionen sind bis dahin gesperrt."
			}),
			Q && l && d && /* @__PURE__ */ (0, X.jsxs)("section", {
				className: "card classic-composer",
				children: [
					/* @__PURE__ */ (0, X.jsx)("div", {
						className: "classic-composer-title",
						children: /* @__PURE__ */ (0, X.jsx)("h2", { children: "Aktion" })
					}),
					y && /* @__PURE__ */ (0, X.jsxs)("section", {
						className: "editing-banner",
						children: [/* @__PURE__ */ (0, X.jsxs)("div", { children: [/* @__PURE__ */ (0, X.jsx)("strong", { children: "Aktion wird bearbeitet" }), /* @__PURE__ */ (0, X.jsx)("span", { children: Ue(y, Q.opponentTeam.shortName) })] }), /* @__PURE__ */ (0, X.jsx)("button", {
							className: "secondary-button",
							type: "button",
							onClick: () => b(null),
							children: "Abbrechen"
						})]
					}),
					/* @__PURE__ */ (0, X.jsxs)("div", {
						className: l.minute >= 60 ? "classic-action-grid shootout-available" : "classic-action-grid",
						role: "group",
						"aria-label": "Aktion auswählen",
						children: [
							/* @__PURE__ */ (0, X.jsxs)("button", {
								type: "button",
								"aria-pressed": D === "GOAL_MIGHTY",
								onClick: () => {
									b(null), k("GOAL_MIGHTY");
								},
								children: [/* @__PURE__ */ (0, X.jsx)("span", {
									"aria-hidden": "true",
									children: "🥅"
								}), /* @__PURE__ */ (0, X.jsx)("span", { children: "Tor Dogs" })]
							}),
							/* @__PURE__ */ (0, X.jsxs)("button", {
								type: "button",
								"aria-pressed": D === "PENALTY",
								onClick: () => {
									b(null), k("PENALTY");
								},
								children: [/* @__PURE__ */ (0, X.jsx)("span", {
									"aria-hidden": "true",
									children: "🚨"
								}), /* @__PURE__ */ (0, X.jsx)("span", { children: "Strafe" })]
							}),
							/* @__PURE__ */ (0, X.jsxs)("button", {
								type: "button",
								"aria-pressed": D === "GOAL_OPPONENT",
								onClick: () => {
									b(null), k("GOAL_OPPONENT");
								},
								children: [/* @__PURE__ */ (0, X.jsx)("span", {
									"aria-hidden": "true",
									children: "🥅"
								}), /* @__PURE__ */ (0, X.jsx)("span", { children: "Tor Gegner" })]
							}),
							/* @__PURE__ */ (0, X.jsxs)("button", {
								type: "button",
								"aria-pressed": D === "SITUATION",
								onClick: () => {
									b(null), k("SITUATION");
								},
								children: [/* @__PURE__ */ (0, X.jsx)("span", {
									"aria-hidden": "true",
									children: "💬"
								}), /* @__PURE__ */ (0, X.jsx)("span", { children: "Situation" })]
							}),
							l.minute >= 60 && /* @__PURE__ */ (0, X.jsxs)("button", {
								className: "classic-shootout-action",
								type: "button",
								"aria-pressed": D === "SHOOTOUT",
								onClick: () => {
									b(null), k("SHOOTOUT");
								},
								children: [/* @__PURE__ */ (0, X.jsx)("span", {
									"aria-hidden": "true",
									children: "🏒"
								}), /* @__PURE__ */ (0, X.jsx)("span", { children: "Penaltyschießen" })]
							})
						]
					}),
					D === "GOAL_MIGHTY" && /* @__PURE__ */ (0, X.jsx)(Pt, {
						game: Q,
						state: l,
						textsystem: d,
						mutationsAllowed: e && !l.completedAt,
						whatsappEnabled: q.ready && !T,
						whatsappTransportReady: q.ready,
						editingEvent: y,
						defaultTeam: "mighty",
						compact: !0,
						submitModeControl: /* @__PURE__ */ (0, X.jsx)(cn, {
							transport: q,
							manualCopyMode: T,
							onManualCopyModeChange: E,
							compact: !0
						}),
						onSaved: u,
						onCancelEdit: () => b(null)
					}, (y ? "edit-" : "new-") + "goal-mighty-" + Q.eventId + "-" + String(y?.id || "")),
					D === "GOAL_OPPONENT" && /* @__PURE__ */ (0, X.jsx)(Pt, {
						game: Q,
						state: l,
						textsystem: d,
						mutationsAllowed: e && !l.completedAt,
						whatsappEnabled: q.ready && !T,
						whatsappTransportReady: q.ready,
						editingEvent: y,
						defaultTeam: "opponent",
						compact: !0,
						submitModeControl: /* @__PURE__ */ (0, X.jsx)(cn, {
							transport: q,
							manualCopyMode: T,
							onManualCopyModeChange: E,
							compact: !0
						}),
						onSaved: u,
						onCancelEdit: () => b(null)
					}, (y ? "edit-" : "new-") + "goal-opponent-" + Q.eventId + "-" + String(y?.id || "")),
					D === "PENALTY" && /* @__PURE__ */ (0, X.jsx)(Lt, {
						game: Q,
						state: l,
						textsystem: d,
						mutationsAllowed: e && !l.completedAt,
						whatsappEnabled: q.ready && !T,
						whatsappTransportReady: q.ready,
						editingEvent: y,
						compact: !0,
						submitModeControl: /* @__PURE__ */ (0, X.jsx)(cn, {
							transport: q,
							manualCopyMode: T,
							onManualCopyModeChange: E,
							compact: !0
						}),
						onSaved: u,
						onCancelEdit: () => b(null)
					}, (y ? "edit-" : "new-") + "penalty-" + Q.eventId + "-" + String(y?.id || "")),
					D === "SITUATION" && /* @__PURE__ */ (0, X.jsx)(Ut, {
						game: Q,
						state: l,
						textsystem: d,
						mutationsAllowed: e && !l.completedAt,
						whatsappEnabled: q.ready && !T,
						whatsappTransportReady: q.ready,
						editingEvent: y,
						compact: !0,
						defaultKind: "penalty_shot",
						allowStickerOnly: !0,
						submitModeControl: /* @__PURE__ */ (0, X.jsx)(cn, {
							transport: q,
							manualCopyMode: T,
							onManualCopyModeChange: E,
							compact: !0
						}),
						onSaved: u,
						onCancelEdit: () => b(null)
					}, (y ? "edit-" : "new-") + "situation-" + Q.eventId + "-" + String(y?.id || "")),
					D === "SHOOTOUT" && /* @__PURE__ */ (0, X.jsx)(Ut, {
						game: Q,
						state: l,
						textsystem: d,
						mutationsAllowed: e && !l.completedAt,
						whatsappEnabled: q.ready && !T,
						whatsappTransportReady: q.ready,
						editingEvent: y,
						compact: !0,
						defaultKind: "shootout",
						submitModeControl: /* @__PURE__ */ (0, X.jsx)(cn, {
							transport: q,
							manualCopyMode: T,
							onManualCopyModeChange: E,
							compact: !0
						}),
						onSaved: u,
						onCancelEdit: () => b(null)
					}, (y ? "edit-" : "new-") + "shootout-" + Q.eventId + "-" + String(y?.id || ""))
				]
			}),
			Q && /* @__PURE__ */ (0, X.jsxs)("section", {
				className: "card classic-history",
				children: [/* @__PURE__ */ (0, X.jsx)("h2", { children: "Letzte Ereignisse" }), /* @__PURE__ */ (0, X.jsx)(bn, {
					history: l?.history || [],
					opponentShortName: Q.opponentTeam.shortName,
					mutationsAllowed: e && !l?.completedAt,
					deletingId: _,
					editingId: String(y?.id || ""),
					onEdit: fe,
					onDelete: pe
				})]
			}),
			j() && Q && l && /* @__PURE__ */ (0, X.jsx)("div", {
				className: "classic-footer-actions",
				children: /* @__PURE__ */ (0, X.jsx)("button", {
					className: "secondary-button danger-button",
					type: "button",
					disabled: C,
					onClick: () => void he(),
					children: C ? "Testspiel wird zurückgesetzt …" : "Testspiel zurücksetzen"
				})
			}),
			/* @__PURE__ */ (0, X.jsxs)("details", {
				className: "classic-secondary-drawer",
				children: [/* @__PURE__ */ (0, X.jsx)("summary", { children: "Archiv" }), /* @__PURE__ */ (0, X.jsx)(w, {})]
			})
		]
	});
}
//#endregion
export { xn as GameWorkspace };
