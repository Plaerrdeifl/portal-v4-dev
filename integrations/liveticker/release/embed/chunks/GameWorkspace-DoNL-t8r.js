import { a as e, n as t, o as n, s as r, t as i } from "./api-DqcqenPV.js";
import { C as a, E as o, S as s, T as c, _ as l, a as u, b as d, c as f, d as p, f as m, g as h, h as g, i as _, l as v, m as y, n as b, o as x, p as S, r as C, s as w, t as T, u as E, v as D, w as O, x as k, y as A } from "./ArchivePanel-DUdVa-sY.js";
import { a as j, c as M, i as N, l as P, n as F, o as I, r as ee, s as te, t as L, u as R } from "./games-DYIBHwRf.js";
//#region src/liveticker/transport.ts
var z = r(), B = "LIVETICKER_WHATSAPP", V = "liveticker-whatsapp-jobs", H = /* @__PURE__ */ new Set([
	"TEST",
	"MAIN",
	"BOTH"
]);
function U(e) {
	return String(e ?? "").trim();
}
function ne(e) {
	let t = e || {};
	return {
		ready: t.ready === !0,
		state: U(t.state).toUpperCase() || "UNREACHABLE",
		enabled: typeof t.enabled == "boolean" ? t.enabled : void 0,
		error: U(t.error) || null
	};
}
function re(e) {
	let t = e || {};
	return {
		ready: t.ready === !0,
		state: U(t.state).toUpperCase() || "UNREACHABLE",
		desiredConnected: t.desiredConnected !== !1,
		error: U(t.error) || null
	};
}
function W(e) {
	let t = e || {}, n = U(t.mode).toUpperCase(), r = H.has(n) ? n : "TEST", i = Array.isArray(t.channels) ? t.channels.map((e) => {
		let t = e || {}, n = U(t.code).toUpperCase();
		return n ? {
			code: n,
			label: U(t.label) || n,
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
function G(e) {
	return e instanceof Error ? e.message : U(e) || "Status nicht verfügbar";
}
async function K(e) {
	let t = [i("worker_runtime_status", { workerCode: B }), i("liveticker_wpp_runtime_status", {})];
	t.push(i("liveticker_whatsapp_routing_status", {}));
	let n = await Promise.allSettled(t), r = [], a = n[0]?.status === "fulfilled" ? ne(n[0].value) : {
		ready: !1,
		state: "UNREACHABLE",
		enabled: !1,
		error: G(n[0]?.reason)
	};
	n[0]?.status === "rejected" && r.push("WA-Worker: " + G(n[0].reason));
	let o = n[1]?.status === "fulfilled" ? re(n[1].value) : {
		ready: !1,
		state: "UNREACHABLE",
		desiredConnected: !0,
		error: G(n[1]?.reason)
	};
	n[1]?.status === "rejected" && r.push("WPP: " + G(n[1].reason));
	let s = null;
	return s = n[2]?.status === "fulfilled" ? W(n[2].value) : {
		ready: !1,
		mode: "TEST",
		channels: []
	}, n[2]?.status === "rejected" && r.push("Routing: " + G(n[2].reason)), {
		ready: !!(a.ready && o.ready && s?.ready && (e !== "DEV" || s.deliveryApproved === !0)),
		wa: a,
		wpp: o,
		routing: s,
		errors: r
	};
}
async function q(e) {
	return ne(await i("worker_runtime_set", {
		workerCode: B,
		enabled: !!e
	}));
}
async function J(e) {
	if (!H.has(e)) throw Error("Ungültiges WhatsApp-Ziel.");
	return W(await i("liveticker_whatsapp_routing_set", { mode: e }));
}
async function ie(e) {
	return re(await i("liveticker_wpp_runtime_set", { connected: !!e }));
}
function Y(e, t) {
	let n = e?.channels.find((e) => e.code === t);
	return !!(n?.configured && n?.enabled);
}
async function ae() {
	let e = t(), n = e.channel(V);
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
function X(e) {
	return e.routing ? (e.routing.mode === "BOTH" ? ["TEST", "MAIN"] : [e.routing.mode]).map((t) => e.routing?.channels.find((e) => e.code === t)?.label || t).join(" + ") : "WhatsApp-Ziel nicht verfügbar";
}
//#endregion
//#region src/components/WhatsappChannelControl.tsx
var Z = e();
function oe({ environment: e, status: t, disabled: n, onChange: r, onToggle: i }) {
	let [a, o] = (0, z.useState)(t.routing?.mode || "TEST"), [s, c] = (0, z.useState)(!1), [l, u] = (0, z.useState)("");
	(0, z.useEffect)(() => o(t.routing?.mode || "TEST"), [t.routing?.mode]);
	let d = (e) => e === "BOTH" ? Y(t.routing, "TEST") && Y(t.routing, "MAIN") : Y(t.routing, e);
	async function f() {
		if (!(s || n || !d(a))) {
			c(!0), u("");
			try {
				await J(a), r(await K(e));
			} catch (e) {
				u(e instanceof Error ? e.message : "WhatsApp-Ziel konnte nicht gespeichert werden.");
			} finally {
				c(!1);
			}
		}
	}
	return /* @__PURE__ */ (0, Z.jsxs)("details", {
		className: "worker-control whatsapp-channel-control",
		onToggle: (e) => i?.(e.currentTarget),
		children: [/* @__PURE__ */ (0, Z.jsxs)("summary", { children: ["WhatsApp-Ziel · ", t.routing?.mode === "BOTH" ? "Beide Kanäle" : t.routing?.channels.find((e) => e.code === t.routing?.mode)?.label || "Nicht verfügbar"] }), /* @__PURE__ */ (0, Z.jsxs)("div", {
			className: "worker-control-body whatsapp-channel-picker",
			children: [
				/* @__PURE__ */ (0, Z.jsxs)("div", {
					className: "runtime-routing-row",
					children: [/* @__PURE__ */ (0, Z.jsxs)("select", {
						"aria-label": "WhatsApp-Ziel",
						value: a,
						disabled: s || n,
						onChange: (e) => o(e.target.value),
						children: [
							/* @__PURE__ */ (0, Z.jsx)("option", {
								value: "TEST",
								disabled: !d("TEST"),
								children: t.routing?.channels.find((e) => e.code === "TEST")?.label || "Testkanal"
							}),
							/* @__PURE__ */ (0, Z.jsx)("option", {
								value: "MAIN",
								disabled: !d("MAIN"),
								children: t.routing?.channels.find((e) => e.code === "MAIN")?.label || "Hauptkanal"
							}),
							/* @__PURE__ */ (0, Z.jsx)("option", {
								value: "BOTH",
								disabled: !d("BOTH"),
								children: "Beide Kanäle"
							})
						]
					}), /* @__PURE__ */ (0, Z.jsx)("button", {
						type: "button",
						disabled: s || n || !d(a),
						onClick: () => void f(),
						children: s ? "Speichert …" : "Übernehmen"
					})]
				}),
				/* @__PURE__ */ (0, Z.jsx)("p", { children: "Gilt für neue Ausgaben. Bereits angelegte Aufträge behalten ihre Ziele." }),
				l && /* @__PURE__ */ (0, Z.jsx)("p", {
					role: "alert",
					children: l
				})
			]
		})]
	});
}
//#endregion
//#region src/components/WhatsappDeliveryTargets.tsx
function se({ delivery: e }) {
	return e?.targets?.length ? /* @__PURE__ */ (0, Z.jsx)("ul", {
		className: "whatsapp-target-status",
		"aria-label": "WhatsApp-Status je Ziel",
		children: e.targets.map((e) => /* @__PURE__ */ (0, Z.jsxs)("li", { children: [
			/* @__PURE__ */ (0, Z.jsx)("strong", { children: e.label }),
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
function Q(e, t) {
	return !!(e && t && e.kind === t.kind && e.team === t.team);
}
function ce({ stickerId: e, name: t }) {
	let [n, r] = (0, z.useState)("");
	return (0, z.useEffect)(() => {
		let t = !1, n = "";
		return _(e).then((e) => {
			t || (n = URL.createObjectURL(e), r(n));
		}, () => {
			t || r("");
		}), () => {
			t = !0, n && URL.revokeObjectURL(n);
		};
	}, [e]), n ? /* @__PURE__ */ (0, Z.jsx)("img", {
		src: n,
		alt: ""
	}) : /* @__PURE__ */ (0, Z.jsx)("span", {
		className: "sticker-placeholder",
		"aria-label": t,
		children: "🖼"
	});
}
function le({ eventId: e, opponentTeamId: t, actionId: n, action: r, penaltyTeams: i = [], mutationsAllowed: a, transportReady: o, onPendingStickerChange: s }) {
	let [c, l] = (0, z.useState)([]), [u, d] = (0, z.useState)(""), [m, _] = (0, z.useState)(""), [y, S] = (0, z.useState)(null), [T, E] = (0, z.useState)(null), [D, O] = (0, z.useState)(!1), [k, A] = (0, z.useState)("Sticker werden geladen …"), j = (0, z.useMemo)(() => r === "SITUATION" ? null : v({
		action: r,
		penaltyTeams: i
	}), [r, i]), M = (0, z.useMemo)(() => r === "SITUATION" ? w(c, t) : b(c, {
		action: r,
		opponentTeamId: t,
		penaltyTeams: i
	}), [
		r,
		c,
		t,
		i
	]), N = (0, z.useMemo)(() => M.find((e) => e.id === u) || null, [u, M]), P = f(y), F = r === "SITUATION" || !m || Q(T, j);
	(0, z.useEffect)(() => {
		let e = !1;
		return x().then((t) => {
			e || (l(t), A("Passende Aktionssticker geladen."));
		}, (t) => {
			e || (l([]), A(t instanceof Error ? t.message : "Aktionssticker konnten nicht geladen werden."));
		}), () => {
			e = !0;
		};
	}, [e]), (0, z.useEffect)(() => {
		m || u && !M.some((e) => e.id === u) && d("");
	}, [
		m,
		u,
		M
	]), (0, z.useEffect)(() => {
		r !== "SITUATION" && m && T && u && s && s({
			deliveryId: m,
			stickerId: u,
			actionId: n,
			context: T
		});
	}, [
		r,
		n,
		m,
		s,
		u,
		T
	]), (0, z.useEffect)(() => {
		if (r !== "SITUATION" || P.tone !== "success") return;
		let e = window.setTimeout(() => {
			d(""), _(""), S(null), E(null), A("");
		}, 2e3);
		return () => window.clearTimeout(e);
	}, [r, P.tone]);
	let I = (0, z.useCallback)(async () => {
		if (m) try {
			let t = await g(e), n = p(t, m);
			S(n);
			let r = f(n);
			r.tone === "success" ? A(F ? "Sticker gesendet · Aktion jetzt speichern." : "Sticker gesendet · Auswahl wurde danach geändert; er wird nicht falsch verknüpft.") : r.tone === "error" ? A(n?.error ? "Sticker fehlgeschlagen: " + n.error : "Sticker fehlgeschlagen.") : A("Sticker wird gesendet …");
		} catch (e) {
			A(e instanceof Error ? e.message : "Sticker-Status konnte nicht geladen werden.");
		}
	}, [
		F,
		m,
		e
	]);
	(0, z.useEffect)(() => {
		m && I();
	}, [m, I]), (0, z.useEffect)(() => {
		if (!m || P.terminal) return;
		let e = window.setTimeout(() => void I(), 1e3);
		return () => window.clearTimeout(e);
	}, [
		y,
		m,
		I,
		P.terminal
	]);
	async function ee() {
		if (N && !D && (r === "SITUATION" || j)) {
			if (!a) {
				A("Sticker-Versand ist für diese Aktion nicht freigeschaltet.");
				return;
			}
			if (!o) {
				A("WhatsApp ist nicht vollständig bereit.");
				return;
			}
			O(!0), S(null), E(r === "SITUATION" ? null : j), A("Sticker wird sofort gesendet …");
			try {
				let t = await C({
					eventId: e,
					stickerId: N.id
				});
				_(t), ae(), A("Sticker wird gesendet …");
			} catch (e) {
				E(null), A(e instanceof Error ? e.message : "Sticker konnte nicht gesendet werden.");
			} finally {
				O(!1);
			}
		}
	}
	async function te() {
		if (m && !D && P.retryable && a && o) {
			O(!0), A("Sticker wird erneut gesendet …");
			try {
				await h({
					eventId: e,
					deliveryId: m
				}), ae(), S((e) => e && {
					...e,
					status: "PENDING",
					stickerStatus: "PENDING",
					attemptCount: e.attemptCount + 1,
					error: null
				}), await I();
			} catch (e) {
				A(e instanceof Error ? e.message : "Der erneute Sticker-Versuch konnte nicht gestartet werden.");
			} finally {
				O(!1);
			}
		}
	}
	return !j && r !== "SITUATION" ? /* @__PURE__ */ (0, Z.jsxs)("div", {
		className: "action-sticker-box",
		children: [/* @__PURE__ */ (0, Z.jsx)("strong", { children: "Aktionssticker" }), /* @__PURE__ */ (0, Z.jsx)("p", {
			className: "empty-note",
			children: "Für gemischte Strafen beider Teams gibt es keinen eindeutigen Aktionssticker."
		})]
	}) : /* @__PURE__ */ (0, Z.jsxs)("div", {
		className: "action-sticker-box",
		children: [
			/* @__PURE__ */ (0, Z.jsx)("div", {
				className: "section-title-row",
				children: /* @__PURE__ */ (0, Z.jsxs)("div", { children: [/* @__PURE__ */ (0, Z.jsx)("strong", { children: r === "SITUATION" ? "Situationssticker" : "Aktionssticker" }), /* @__PURE__ */ (0, Z.jsx)("p", {
					className: "action-sticker-hint",
					children: r === "SITUATION" ? "Aktive Spiel-, Video- und allgemeine Sticker · immer separat ohne Liveticker-Aktion oder Text." : "Passender Sticker zur gewählten Aktion · immer separat ohne Text."
				})] })
			}),
			M.length ? /* @__PURE__ */ (0, Z.jsx)("div", {
				className: "action-sticker-grid",
				children: M.map((e) => /* @__PURE__ */ (0, Z.jsxs)("button", {
					className: u === e.id ? "sticker-card selected" : "sticker-card",
					type: "button",
					"aria-pressed": u === e.id,
					disabled: D || !(!m || P.terminal),
					onClick: () => {
						m || (d(e.id), A("Aktionssticker ausgewählt."));
					},
					children: [/* @__PURE__ */ (0, Z.jsx)(ce, {
						stickerId: e.id,
						name: e.name
					}), /* @__PURE__ */ (0, Z.jsx)("strong", { children: e.name })]
				}, e.id))
			}) : /* @__PURE__ */ (0, Z.jsx)("p", {
				className: "empty-note",
				children: "Für diese Aktion ist kein passender aktiver Sticker hinterlegt."
			}),
			N && !m && /* @__PURE__ */ (0, Z.jsx)("button", {
				className: "action-sticker-send",
				type: "button",
				disabled: D || !a || !o,
				onClick: () => void ee(),
				children: D ? "Sticker wird gesendet …" : "Sticker sofort senden"
			}),
			m && /* @__PURE__ */ (0, Z.jsxs)(Z.Fragment, { children: [
				/* @__PURE__ */ (0, Z.jsxs)("p", {
					className: "sticker-delivery-status",
					"data-tone": F ? P.tone : "error",
					children: [r === "SITUATION" || F ? "Sticker " + P.label : "Sticker gesendet, aber die Aktion wurde danach geändert – keine automatische Verknüpfung.", P.tone === "error" && y?.error ? " · " + y.error : ""]
				}),
				/* @__PURE__ */ (0, Z.jsx)(se, { delivery: y }),
				P.retryable && !y?.targets?.some((e) => e.error === "DELIVERY_OUTCOME_UNKNOWN") && /* @__PURE__ */ (0, Z.jsx)("button", {
					className: "secondary-button action-sticker-send",
					type: "button",
					disabled: D || !a || !o,
					onClick: () => void te(),
					children: "Erneut senden"
				})
			] }),
			/* @__PURE__ */ (0, Z.jsx)("p", {
				className: "workspace-message",
				children: k
			})
		]
	});
}
//#endregion
//#region src/components/ClassicFormControls.tsx
function ue(e) {
	return String(e ?? "").trim().replace(/^#/, "").trim();
}
function de({ players: e, value: t, onChange: n, placeholder: r, numberAriaLabel: i }) {
	let a = e.find((e) => e.id === t) || null, [o, s] = (0, z.useState)(a?.number || "");
	return (0, z.useEffect)(() => {
		s(a?.number || "");
	}, [a?.id, a?.number]), /* @__PURE__ */ (0, Z.jsxs)("div", {
		className: "player-entry",
		children: [/* @__PURE__ */ (0, Z.jsx)("input", {
			className: "jersey-number",
			type: "text",
			inputMode: "numeric",
			autoComplete: "off",
			placeholder: "#",
			"aria-label": i,
			value: o,
			onChange: (t) => {
				let r = ue(t.target.value);
				if (s(r), !r) {
					n("");
					return;
				}
				n(e.find((e) => ue(e.number) === r)?.id || "");
			}
		}), /* @__PURE__ */ (0, Z.jsxs)("select", {
			value: t,
			onChange: (t) => {
				let r = t.target.value;
				n(r);
				let i = e.find((e) => e.id === r);
				s(i?.number || "");
			},
			children: [/* @__PURE__ */ (0, Z.jsx)("option", {
				value: "",
				children: r
			}), e.map((e) => /* @__PURE__ */ (0, Z.jsxs)("option", {
				value: e.id,
				children: [e.number ? "#" + e.number + " " : "", e.name]
			}, e.id))]
		})]
	});
}
function fe({ value: e, options: t, onChange: n, ariaLabel: r }) {
	return /* @__PURE__ */ (0, Z.jsx)("div", {
		className: "classic-segmented",
		role: "group",
		"aria-label": r,
		children: t.map((t) => /* @__PURE__ */ (0, Z.jsx)("button", {
			type: "button",
			"aria-pressed": t.value === e,
			onClick: () => n(t.value),
			children: t.label
		}, t.value))
	});
}
//#endregion
//#region src/components/ClassicEditablePreview.tsx
function pe({ generatedText: e, error: t, manualText: n, onManualTextChange: r }) {
	let [i, a] = (0, z.useState)(!1), o = n ?? e;
	async function s() {
		try {
			await navigator.clipboard.writeText(o);
		} catch {}
	}
	return /* @__PURE__ */ (0, Z.jsxs)("section", {
		className: "classic-whatsapp-preview",
		"aria-label": "WhatsApp-Vorschau",
		children: [
			/* @__PURE__ */ (0, Z.jsx)("div", {
				className: "classic-preview-head",
				children: /* @__PURE__ */ (0, Z.jsx)("h3", { children: "WhatsApp-Vorschau" })
			}),
			t ? /* @__PURE__ */ (0, Z.jsx)("p", {
				className: "form-error",
				children: t
			}) : i ? /* @__PURE__ */ (0, Z.jsx)("textarea", {
				className: "classic-output-textarea",
				spellCheck: !0,
				value: o,
				onChange: (e) => r(e.target.value)
			}) : /* @__PURE__ */ (0, Z.jsx)("div", {
				className: "output-preview",
				children: o
			}),
			!t && /* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "output-actions",
				children: [i ? /* @__PURE__ */ (0, Z.jsx)("button", {
					className: "primary output-icon",
					type: "button",
					"aria-label": "Text übernehmen",
					title: "Text übernehmen",
					onClick: () => a(!1),
					children: "✓"
				}) : /* @__PURE__ */ (0, Z.jsx)("button", {
					className: "secondary output-icon",
					type: "button",
					"aria-label": "Text bearbeiten",
					title: "Bearbeiten",
					onClick: () => {
						n === null && r(e), a(!0);
					},
					children: "✏️"
				}), /* @__PURE__ */ (0, Z.jsx)("button", {
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
var me = 4e3;
function he(e, t, { editingId: n = null, enabled: r = !1 } = {}) {
	let i = String(t ?? "");
	return !e || n || !r || !i.trim() || i.length > me ? e : {
		...e,
		_whatsapp: Object.freeze({
			publish: !0,
			text: i
		})
	};
}
function ge(e, t) {
	let n = Array.isArray(e) ? e.slice() : [], r = String(t.id || "");
	if (!r) return n;
	let i = n.findIndex((e) => String(e?.id || "") === r);
	return i >= 0 ? n.splice(i, 1, t) : n.push(t), n;
}
function _e({ whatsappEnabled: e, transportReady: t }) {
	return !(e && t);
}
async function ve(e) {
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
function ye(e, t) {
	let n = e.find((e) => e.id === t);
	return n ? {
		id: n.id,
		name: n.name,
		number: n.number,
		position: n.position
	} : null;
}
function be(e, t) {
	if (!t) return "";
	let n = String(t.id || "").trim();
	if (n && e.some((e) => e.id === n)) return n;
	let r = String(t.name || "").trim();
	return e.find((e) => e.name === r)?.id || "";
}
function xe(e, t) {
	let n = [e, ...t].filter((e) => !!e).map((e) => String(e.name || "").trim()).filter(Boolean);
	if (new Set(n).size !== n.length) throw Error("Torschütze und Assists müssen unterschiedliche Spieler sein.");
}
function Se(e) {
	let t = Number(e.minute);
	if (!Number.isInteger(t) || t < 1) throw Error("Bitte eine gültige Spielminute ab 1 eingeben.");
	xe(e.player, e.assists);
	let n = String(e.outputVariantId || "").trim();
	if (!n) throw Error("Bitte eine Tor-Ausgabevariante wählen.");
	return {
		id: String(e.id || o()),
		type: "goal",
		team: e.team,
		minute: t,
		player: e.player,
		assists: e.assists.filter(Boolean).slice(0, 2),
		outputVariantId: n
	};
}
function Ce(e, t) {
	let n = Array.isArray(e) ? e.slice() : [], r = String(t.id || ""), i = r ? n.findIndex((e) => String(e?.id || "") === r) : -1;
	return i >= 0 ? n.splice(i, 1, t) : n.push(t), n;
}
function we(e, t, n, r = "") {
	let i = String(n || "").trim();
	return i && (Array.isArray(e) ? e : []).filter((e) => {
		if (!e || typeof e != "object" || Array.isArray(e)) return !1;
		let n = e;
		return String(n.id || "") !== String(r || "") && n.type === "goal" && n.team === t && String(n.player?.name || "").trim() === i;
	}).length >= 2 ? "hattrick" : "normal";
}
var Te = 5e3;
function Ee({ windowMs: e = Te, maxSaves: t = 20 } = {}) {
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
function De(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of Array.isArray(e) ? e : []) {
		if (!n || typeof n != "object" || Array.isArray(n)) continue;
		let e = String(n.id || "");
		e && t.set(e, n);
	}
	return t;
}
function Oe(e, t) {
	return JSON.stringify(e) === JSON.stringify(t);
}
function ke(e) {
	if (!e || typeof e != "object" || Array.isArray(e)) return e;
	let t = { ...e };
	return delete t._whatsapp, t;
}
function Ae(e) {
	return {
		minute: Math.max(1, Number(e?.minute || 1)),
		history: (Array.isArray(e?.history) ? e.history : []).map((e) => JSON.parse(JSON.stringify(ke(e))))
	};
}
function je(e, t) {
	let n = De(t.history), r = De(e.history), i = [], a = [], o = [];
	for (let [e, t] of r) (!n.has(e) || !Oe(n.get(e), t)) && i.push(t);
	for (let [e, t] of n) r.has(e) || (a.push(e), o.push({
		id: e,
		expected: ke(t)
	}));
	let s = {};
	return i.length && (s.upserts = i), a.length && (s.deletes = a, s.deleteGuards = o), Number(e.minute || 1) !== Number(t.minute || 1) && (s.minute = Number(e.minute || 1)), s;
}
function Me(e, t) {
	let n = De(t.history), r = {}, i = (Array.isArray(e.upserts) ? e.upserts : []).filter((e) => {
		if (!e || typeof e != "object" || Array.isArray(e)) return !1;
		let t = String(e.id || "");
		return t && (!n.has(t) || !Oe(n.get(t), e));
	}), a = new Map((Array.isArray(e.deleteGuards) ? e.deleteGuards : []).filter((e) => e?.id && e.expected).map((e) => [e.id, e])), o = (Array.isArray(e.deletes) ? e.deletes : []).filter((e) => n.has(e) && a.has(e));
	return i.length && (r.upserts = i), o.length && (r.deletes = o, r.deleteGuards = o.map((e) => a.get(e)).filter((e) => !!e)), Object.prototype.hasOwnProperty.call(e, "minute") && Number(e.minute || 1) !== Number(t.minute || 1) && (r.minute = Number(e.minute || 1)), r;
}
function Ne(e) {
	return Object.keys(e).length > 0;
}
function Pe(e) {
	return Array.isArray(e.upserts) && e.upserts.some((e) => {
		if (!e || typeof e != "object" || Array.isArray(e)) return !1;
		let t = e._whatsapp;
		return !(!t || typeof t != "object" || Array.isArray(t) || t.publish !== !0);
	});
}
function Fe(e) {
	let t = "plaerrdeifl.livetickerPrototype.clientId", n = e.toLowerCase() + "-";
	try {
		let e = localStorage.getItem(t);
		if (e?.startsWith(n)) return e;
		let r = n + o();
		return localStorage.setItem(t, r), r;
	} catch {
		return n + Date.now();
	}
}
async function Ie({ eventId: e, localState: t, serverState: n, clientState: r, environment: i }) {
	let a = je(t, r);
	if (!Ne(a)) return {
		state: n,
		clientState: Ae(n),
		changes: a,
		changed: !1,
		wakeWhatsapp: !1,
		rebased: !1
	};
	let o = async (t, n) => {
		let r = await R("pd_public_liveticker_sync", {
			p_event_id: e,
			p_expected_revision: n,
			p_changes: t,
			p_client_id: Fe(i)
		});
		return j(r);
	};
	try {
		let e = await o(a, n.revision);
		return {
			state: e,
			clientState: Ae(e),
			changes: a,
			changed: !0,
			wakeWhatsapp: Pe(a),
			rebased: !1
		};
	} catch (t) {
		if (!(t instanceof P) || t.code !== "PT409") throw t;
		let n = await R("pd_public_liveticker_state", { p_event_id: e }), r = j(n), i = Me(a, r);
		if (!Ne(i)) return {
			state: r,
			clientState: Ae(r),
			changes: i,
			changed: !1,
			wakeWhatsapp: !1,
			rebased: !0
		};
		let s = await o(i, r.revision);
		return {
			state: s,
			clientState: Ae(s),
			changes: i,
			changed: !0,
			wakeWhatsapp: Pe(i),
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
function Le(e) {
	return !!(e && e.type === "penalty" && e.subtype === "penalty_shot");
}
function Re(e) {
	return !(!e || e.team !== "mighty" && e.team !== "opponent" || e.type !== "goal" && (!Le(e) || e.result !== "scored"));
}
function ze(e) {
	return (Array.isArray(e) ? e : []).reduce((e, t) => {
		let n = t || {};
		return Re(n) && n.team && (e[n.team] += 1), e;
	}, {
		mighty: 0,
		opponent: 0
	});
}
function Be(e) {
	return (Array.isArray(e) ? e : []).reduce((e, t) => {
		let n = t || {};
		return n.type === "shootout" && n.result === "scored" && (n.team === "mighty" || n.team === "opponent") && (e[n.team] += 1), e;
	}, {
		mighty: 0,
		opponent: 0
	});
}
function Ve(e) {
	return (Array.isArray(e) ? e : []).map((e, t) => {
		let n = e || {}, r = Number.parseInt(String(n.minute ?? ""), 10);
		return {
			event: n,
			index: t,
			minute: Number.isInteger(r) ? r : Infinity
		};
	}).sort((e, t) => e.minute - t.minute || e.index - t.index).map((e) => e.event);
}
function He(e) {
	if (e.type === "shootout") return "Penaltyschießen";
	let t = Number.parseInt(String(e.minute ?? ""), 10);
	return !Number.isInteger(t) || t < 1 ? "Unbekannt" : t <= 20 ? "1. Drittel" : t <= 40 ? "2. Drittel" : t <= 60 ? "3. Drittel" : "Overtime";
}
function Ue(e, t) {
	return e === "mighty" ? "Mighty Dogs" : t;
}
function We(e, t) {
	if (e.type === "goal") {
		let n = e.player?.name || "Torschütze offen";
		return String(e.minute || "") + "' 🥅 " + n + " · " + Ue(e.team, t);
	}
	if (Le(e)) {
		let t = e.player?.name || "Schütze offen";
		return String(e.minute || "") + "' 🏒 Straf-Penalty · " + t + " · " + (e.result === "scored" ? "verwandelt" : "vergeben");
	}
	if (e.type === "shootout") return "🏒 " + (e.player?.name || Ue(e.team, t)) + " · " + (e.result === "scored" ? "verwandelt" : "vergeben");
	let n = e.penalties?.[0] || null, r = n?.player?.name || (n ? Ue(n.team, t) : "Strafe"), i = n?.duration ? String(n.duration) + " Min." : "";
	return String(e.minute || "") + "' 🚨 " + r + (i ? " · " + i : "");
}
function Ge(e, t) {
	let n = He(e);
	if (e.type === "goal") {
		let t = $(e.player), r = Array.isArray(e.assists) ? e.assists.filter(Boolean).slice(0, 2).map($).filter(Boolean) : [];
		return [
			n,
			t,
			r.length ? "Assists: " + r.join(" · ") : ""
		].filter(Boolean).join(" · ");
	}
	if (Le(e)) {
		let t = e.player ? $(e.player) : "Schütze offen", r = e.goalie ? $(e.goalie) : "Goalie offen";
		return n + " · " + t + " gegen " + r + " · " + (e.result === "scored" ? "verwandelt" : "vergeben");
	}
	return e.type === "shootout" ? e.player ? $(e.player) : Ue(e.team, t) : [n, (Array.isArray(e.penalties) ? e.penalties : []).map((e) => [e.duration ? String(e.duration) + " min" : "", e.reason || ""].filter(Boolean).join(" ")).filter(Boolean).join(" · ")].filter(Boolean).join(" · ");
}
//#endregion
//#region src/liveticker/penalties.ts
var Ke = [
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
], qe = [
	"2",
	"2+2",
	"5",
	"10",
	"2+10",
	"5+10",
	"5+20",
	"20"
];
function Je(e) {
	let t = String(e || "").split("+").map((e) => Number.parseInt(e, 10));
	return !t.length || t.some((e) => !Number.isInteger(e) || e <= 0) ? {
		parts: [],
		total: 0
	} : {
		parts: t,
		total: t.reduce((e, t) => e + t, 0)
	};
}
function Ye(e) {
	return Je(e).parts.some((e) => e >= 5);
}
function Xe(e) {
	return new Set(e.map((e) => e.team)).size > 1 ? "both" : e.some((e) => Ye(e.duration)) ? "major" : "normal";
}
function Ze(e) {
	let t = Number(e.minute);
	if (!Number.isInteger(t) || t < 1) throw Error("Bitte eine gültige Spielminute ab 1 eingeben.");
	if (!Array.isArray(e.penalties) || !e.penalties.length) throw Error("Bitte mindestens eine Strafe erfassen.");
	for (let t of e.penalties) {
		if (t.team !== "mighty" && t.team !== "opponent") throw Error("Eine Strafe enthält kein gültiges Team.");
		if (!qe.includes(t.duration)) throw Error("Eine Strafe enthält keine gültige Strafzeit.");
		if (!String(t.reason || "").trim()) throw Error("Eine Strafe enthält keinen Strafgrund.");
	}
	let n = String(e.outputVariantId || "").trim();
	if (!n) throw Error("Bitte eine Strafen-Ausgabevariante wählen.");
	return {
		id: String(e.id || o()),
		type: "penalty",
		minute: t,
		penalties: e.penalties,
		outputVariantId: n
	};
}
function Qe(e, t) {
	let n = Array.isArray(e) ? e.slice() : [], r = n.findIndex((e) => String(e?.id || "") === String(t.id || ""));
	return r >= 0 ? n.splice(r, 1, t) : n.push(t), n;
}
//#endregion
//#region src/liveticker/textsystem.ts
var $e = /* @__PURE__ */ new Set([
	"minute",
	"scorer",
	"assists",
	"mighty_score",
	"opponent_score",
	"home_score",
	"away_score",
	"score",
	"opponent_name"
]), et = /* @__PURE__ */ new Set([
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
]), tt = /* @__PURE__ */ new Set(["scorer", "assists"]), nt = /* @__PURE__ */ new Set([
	"player_name",
	"jersey_number",
	"player",
	"penalty_duration",
	"penalty_reason",
	"team_name",
	"opponent_name",
	"penalty_line"
]), rt = /* @__PURE__ */ new Set([
	"minute",
	"team_name",
	"opponent_name",
	"shooter",
	"goalie",
	"result"
]), it = /* @__PURE__ */ new Set([
	"team_name",
	"opponent_name",
	"shooter",
	"result"
]), at = /\{\{([^{}]+)\}\}/g, ot = /\{\{[a-z_]+\}\}/g;
function st(e) {
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
async function ct() {
	return st(await R("pd_public_liveticker_templates"));
}
function lt(e, t, n = !1) {
	return e.variants.filter((e) => e.outputType === t && (n || e.active)).slice().sort((e, t) => e.sortOrder - t.sortOrder || e.name.localeCompare(t.name, "de"));
}
function ut(e, t) {
	let n = lt(e, t);
	return n.find((e) => e.default) || n[0] || null;
}
function dt(e, t, n, r = []) {
	let i = ut(e, t);
	if (!i) throw Error("Liveticker-Ausgabevariante konnte nicht geladen werden.");
	return mt(i.template, n, new Set(Object.keys(n)), new Set(r));
}
function ft(e, t, n) {
	return lt(e, t).find((e) => e.semanticKey === n) || null;
}
function pt(e, t, n) {
	return e.variants.find((e) => e.outputType === t && e.id === n) || null;
}
function mt(e, t, n, r) {
	let i = String(e ?? "");
	if ([...i.matchAll(at)].map((e) => e[1].trim()).filter((e) => !n.has(e)).length || /\{\{|\}\}/.test(i.replace(ot, ""))) throw Error("Der gespeicherte Liveticker-Ausgabetext enthält einen ungültigen Platzhalter.");
	let a = Object.fromEntries([...n].map((e) => [e, String(t[e] ?? "")]));
	return i.split("\n").filter((e) => ![...r].some((t) => e.includes("{{" + t + "}}") && !a[t])).map((e) => e.replace(ot, (e) => a[e.slice(2, -2)])).join("\n");
}
function ht(e, t, n = !1) {
	return lt(e, t === "mighty" ? "goal_mighty" : "goal_opponent", n);
}
function gt(e, t) {
	return ut(e, t === "mighty" ? "goal_mighty" : "goal_opponent");
}
function _t(e, t, n) {
	return pt(e, t === "mighty" ? "goal_mighty" : "goal_opponent", n);
}
function vt(e, t) {
	return mt(e, t, $e, tt);
}
function yt(e, t = !1) {
	return lt(e, "penalty", t);
}
function bt(e) {
	return ut(e, "penalty");
}
function xt(e, t) {
	return ft(e, "penalty", t) || bt(e);
}
function St(e, t) {
	return mt(e, t, et, nt);
}
function Ct(e, t) {
	return t === "AWAY" ? {
		home: e.opponent,
		away: e.mighty
	} : {
		home: e.mighty,
		away: e.opponent
	};
}
function wt(e, t) {
	let n = [];
	for (let r of e) if (n.push(r), String(r?.id || "") === t) break;
	return ze(n);
}
function Tt(e) {
	return e && String(e.name || "").trim() ? e : null;
}
function Et({ event: e, history: t, game: n, snapshot: r }) {
	if (e.type !== "goal" || e.team !== "mighty" && e.team !== "opponent") throw Error("Ungültige Tor-Aktion.");
	let i = String(e.outputVariantId || ""), a = _t(r, e.team, i) || gt(r, e.team);
	if (!a) throw Error("Keine Tor-Ausgabevariante verfügbar.");
	let o = wt(t, String(e.id || "")), s = Ct(o, n.homeAway), c = Array.isArray(e.assists) ? e.assists.map(Tt).filter((e) => !!e).slice(0, 2) : [];
	return vt(a.template, {
		minute: Number(e.minute || 1),
		scorer: $(Tt(e.player)),
		assists: c.map($).join(" · "),
		mighty_score: o.mighty,
		opponent_score: o.opponent,
		home_score: s.home,
		away_score: s.away,
		score: s.home + " : " + s.away,
		opponent_name: n.opponentTeam.shortName
	});
}
function Dt(e, t) {
	return e === "mighty" ? "Mighty Dogs" : t.opponentTeam.shortName;
}
function Ot(e, t) {
	let n = e.player ? " · " + $(e.player) : "";
	return Dt(e.team, t) + " · " + e.duration + " min · " + e.reason + n;
}
function kt(e, t) {
	let n = Ot(e, t);
	return Ye(e.duration) ? "🚨 *" + n + "*" : n;
}
function At({ event: e, game: t, snapshot: n }) {
	if (e.type !== "penalty" || e.subtype === "penalty_shot") throw Error("Ungültige Strafen-Aktion.");
	let r = (Array.isArray(e.penalties) ? e.penalties : []).map((e) => ({
		team: e.team,
		duration: String(e.duration || ""),
		reason: String(e.reason || ""),
		player: Tt(e.player)
	})).filter((e) => (e.team === "mighty" || e.team === "opponent") && !!e.duration && !!e.reason);
	if (!r.length) throw Error("Bitte mindestens eine Strafe erfassen.");
	let i = pt(n, "penalty", String(e.outputVariantId || "")) || bt(n);
	if (!i) throw Error("Keine Strafen-Ausgabevariante verfügbar.");
	let a = r.length === 1 ? r[0] : null, o = [...new Set(r.map((e) => e.team))];
	return St(i.template, {
		minute: Number(e.minute || 1),
		player_name: a?.player?.name || "",
		jersey_number: a?.player?.number || "",
		player: a?.player ? $(a.player) : "",
		penalty_duration: a ? a.duration + " min" : "",
		penalty_reason: a?.reason || "",
		team_name: o.map((e) => Dt(e, t)).join(" + "),
		opponent_name: t.opponentTeam.shortName,
		penalty_line: a ? kt(a, t) : "",
		penalties: r.map((e) => kt(e, t)).join("\n")
	});
}
function jt(e, t) {
	return e === "mighty" ? "Mighty Dogs" : t.opponentTeam.shortName;
}
function Mt(e, t, n) {
	let r = ut(e, t);
	return String(r?.template || "").trim() || n;
}
function Nt({ event: e, game: t, snapshot: n }) {
	if (e.type !== "penalty" || e.subtype !== "penalty_shot") throw Error("Ungültige Straf-Penalty-Aktion.");
	if (e.team !== "mighty" && e.team !== "opponent") throw Error("Straf-Penalty ohne gültiges Team.");
	let r = pt(n, "penalty_shot", String(e.outputVariantId || "")) || ut(n, "penalty_shot");
	if (!r) throw Error("Keine Straf-Penalty-Ausgabevariante verfügbar.");
	let i = e.team === "mighty" ? "opponent" : "mighty", a = e.player ? $(e.player) : Mt(n, "missing_shooter", "Schütze offen"), o = e.goalie ? $(e.goalie) : Mt(n, "missing_goalie", "Goalie offen");
	return mt(r.template, {
		minute: Number(e.minute || 1),
		team_name: jt(e.team, t),
		opponent_name: jt(i, t),
		shooter: a,
		goalie: o,
		result: e.result === "scored" ? "✅ verwandelt" : "❌ vergeben"
	}, rt, /* @__PURE__ */ new Set());
}
function Pt({ event: e, game: t, snapshot: n }) {
	if (e.type !== "shootout") throw Error("Ungültige Penaltyschießen-Aktion.");
	if (e.team !== "mighty" && e.team !== "opponent") throw Error("Penaltyschießen ohne gültiges Team.");
	let r = pt(n, "shootout_attempt", String(e.outputVariantId || "")) || ut(n, "shootout_attempt");
	if (!r) throw Error("Keine Penaltyschießen-Ausgabevariante verfügbar.");
	let i = e.player ? $(e.player) : Mt(n, "missing_shooter", "Schütze offen");
	return mt(r.template, {
		team_name: jt(e.team, t),
		opponent_name: t.opponentTeam.shortName,
		shooter: i,
		result: e.result === "scored" ? "✅ verwandelt" : "❌ vergeben"
	}, it, /* @__PURE__ */ new Set());
}
//#endregion
//#region src/components/GoalForm.tsx
function Ft({ game: e, state: t, textsystem: r, mutationsAllowed: i, whatsappEnabled: a, whatsappTransportReady: s, editingEvent: c = null, defaultTeam: l = "mighty", compact: d = !1, submitModeControl: f, onSaved: p, onCancelEdit: m }) {
	let h = c?.type === "goal" ? c : null, g = h ? h.team === "opponent" ? "opponent" : "mighty" : l, _ = g === "mighty" ? e.ownTeam.players : e.opponentTeam.players, v = g === "mighty" ? "goal_mighty" : "goal_opponent", [y, b] = (0, z.useState)(g), [x, S] = (0, z.useState)(h ? Math.max(1, Number(h.minute || 1)) : t.minute), [C, w] = (0, z.useState)(be(_, h?.player)), [T, D] = (0, z.useState)(be(_, h?.assists?.[0])), [O, k] = (0, z.useState)(be(_, h?.assists?.[1])), [A, j] = (0, z.useState)(String(h?.outputVariantId || "")), [M, N] = (0, z.useState)(!1), [P, F] = (0, z.useState)(""), [I, ee] = (0, z.useState)(null), [te, L] = (0, z.useState)(!1), [R, B] = (0, z.useState)(null), [V, H] = (0, z.useState)(""), U = (0, z.useRef)(String(h?.id || o())), ne = (0, z.useRef)(Ee()), re = (0, z.useRef)(new Set(h?.outputVariantId ? [v] : [])), W = (0, z.useRef)(y), G = y === "mighty" ? e.ownTeam.players : e.opponentTeam.players, K = (0, z.useMemo)(() => ht(r, y), [r, y]), q = (0, z.useMemo)(() => ye(G, C), [G, C]), J = y === "mighty" ? "goal_mighty" : "goal_opponent", ie = (0, z.useMemo)(() => we(t.history, y, q?.name || "", U.current), [
		q?.name,
		t.history,
		y
	]);
	(0, z.useEffect)(() => {
		h || S(t.minute);
	}, [
		h,
		t.minute,
		e.eventId
	]), (0, z.useEffect)(() => {
		C && L(!1);
	}, [C]), (0, z.useEffect)(() => {
		W.current !== y && (W.current = y, w(""), D(""), k(""));
	}, [y]), (0, z.useEffect)(() => {
		let e = K.some((e) => e.id === A);
		if (re.current.has(J) && e) return;
		let t = ft(r, J, ie) || gt(r, y) || K[0] || null;
		j(t?.id || "");
	}, [
		J,
		ie,
		y,
		r,
		A,
		K
	]), (0, z.useEffect)(() => {
		ne.current.reset(), B(null), H("");
	}, [e.eventId]);
	let Y = (0, z.useCallback)((e) => {
		B(e), e && H("");
	}, []), X = (0, z.useMemo)(() => {
		try {
			let n = Se({
				id: U.current,
				team: y,
				minute: x,
				player: q,
				assists: [ye(G, T), ye(G, O)].filter((e) => !!e),
				outputVariantId: A
			}), i = Ce(t.history, n);
			return {
				event: n,
				history: i,
				text: Et({
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
		O,
		e,
		x,
		G,
		q,
		C,
		t.history,
		y,
		r,
		A
	]), oe = I ?? X.text;
	async function se(r = !1) {
		if (!i) {
			F("Schreibaktionen sind für diesen Stand nicht freigeschaltet.");
			return;
		}
		if (!X.event || X.error) {
			F(X.error || "Tor konnte nicht vorbereitet werden.");
			return;
		}
		let c = !String(X.event.player?.name || "").trim();
		if (!h && a && c && !r) {
			L(!0), F("");
			return;
		}
		if (L(!1), ne.current.register()) {
			F("SYNC gestoppt · Seite neu laden");
			return;
		}
		N(!0), F("Tor wird gespeichert …");
		try {
			let r = n(), i = a && !h, c = he(X.event, oe, {
				editingId: h ? String(h.id || "") : null,
				enabled: i
			}) || X.event, l = ge(X.history, c), d = _e({
				whatsappEnabled: i,
				transportReady: s
			}), f = await Ie({
				eventId: e.eventId,
				localState: {
					minute: x,
					history: l
				},
				serverState: t,
				clientState: Ae(t),
				environment: r.environment
			});
			p(f.state);
			let g = "", _ = R;
			if (_ && _.actionId === String(X.event.id || "")) {
				if (E(_.context, X.event)) try {
					await u({
						deliveryId: _.deliveryId,
						actionId: _.actionId
					}), B(null), H(""), g = " · Sticker mit Aktion verknüpft.";
				} catch (e) {
					let t = e instanceof Error ? e.message : "Sticker-Verknüpfung fehlgeschlagen.";
					H(t), g = " · Sticker-Verknüpfung offen.";
				}
				else B(null), H("Sticker blieb unverknüpft, weil die Aktion nach dem Senden geändert wurde."), g = " · Sticker nicht verknüpft.";
			}
			f.wakeWhatsapp && ae();
			let v = d ? await ve(oe) : !1, y = (f.wakeWhatsapp ? " · WhatsApp-Text eingereiht." : d ? v ? " · Text kopiert." : " · Text kann aus der Vorschau kopiert werden." : "") + g;
			h ? (F((f.rebased ? "Tor korrigiert · zwischenzeitliche Änderungen wurden berücksichtigt." : "Tor serverseitig korrigiert.") + y), m?.()) : (ee(null), U.current = o(), S(f.state.minute), w(""), D(""), k(""), F((f.rebased ? "Tor gespeichert · zwischenzeitliche Änderungen wurden berücksichtigt." : "Tor serverseitig gespeichert.") + y));
		} catch (e) {
			F(e instanceof Error ? e.message : "Tor konnte nicht gespeichert werden.");
		} finally {
			N(!1);
		}
	}
	return /* @__PURE__ */ (0, Z.jsxs)("section", {
		className: d ? "workspace-card action-card compact-action-card" : "workspace-card action-card",
		children: [
			!d && /* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "workspace-header",
				children: [/* @__PURE__ */ (0, Z.jsxs)("div", { children: [/* @__PURE__ */ (0, Z.jsx)("p", {
					className: "eyebrow",
					children: h ? "Korrektur" : "Aktion"
				}), /* @__PURE__ */ (0, Z.jsx)("h2", { children: h ? "Tor bearbeiten" : "Tor erfassen" })] }), /* @__PURE__ */ (0, Z.jsx)("span", {
					className: i ? "write-badge enabled" : "write-badge",
					children: i ? "DEV schreiben" : "gesperrt"
				})]
			}),
			!h && /* @__PURE__ */ (0, Z.jsx)(le, {
				eventId: e.eventId,
				opponentTeamId: e.opponentTeam.id,
				actionId: U.current,
				action: y === "mighty" ? "GOAL_MIGHTY" : "GOAL_OPPONENT",
				mutationsAllowed: i,
				transportReady: s,
				onPendingStickerChange: Y
			}, U.current),
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "goal-form-grid classic-goal-fields",
				children: [
					!d && /* @__PURE__ */ (0, Z.jsxs)("label", {
						className: "field",
						children: [/* @__PURE__ */ (0, Z.jsx)("span", { children: "Team" }), /* @__PURE__ */ (0, Z.jsxs)("select", {
							value: y,
							onChange: (e) => b(e.target.value),
							children: [/* @__PURE__ */ (0, Z.jsx)("option", {
								value: "mighty",
								children: e.ownTeam.shortName
							}), /* @__PURE__ */ (0, Z.jsx)("option", {
								value: "opponent",
								children: e.opponentTeam.shortName
							})]
						})]
					}),
					!d && /* @__PURE__ */ (0, Z.jsxs)("label", {
						className: "field",
						children: [/* @__PURE__ */ (0, Z.jsx)("span", { children: "Spielminute" }), /* @__PURE__ */ (0, Z.jsx)("input", {
							type: "number",
							min: "1",
							value: x,
							onChange: (e) => S(Number(e.target.value))
						})]
					}),
					/* @__PURE__ */ (0, Z.jsxs)("label", {
						className: "field",
						children: [/* @__PURE__ */ (0, Z.jsxs)("span", { children: ["Torschütze ", y === "mighty" ? e.ownTeam.shortName : e.opponentTeam.shortName] }), /* @__PURE__ */ (0, Z.jsx)(de, {
							players: G,
							value: C,
							onChange: w,
							placeholder: "Spieler wählen",
							numberAriaLabel: "Trikotnummer Torschütze"
						})]
					}),
					/* @__PURE__ */ (0, Z.jsxs)("details", {
						className: "assist-details",
						children: [/* @__PURE__ */ (0, Z.jsx)("summary", { children: "Assists" }), /* @__PURE__ */ (0, Z.jsxs)("div", {
							className: "assist-grid",
							children: [/* @__PURE__ */ (0, Z.jsxs)("label", {
								className: "field",
								children: [/* @__PURE__ */ (0, Z.jsx)("span", { children: "1. Assist" }), /* @__PURE__ */ (0, Z.jsx)(de, {
									players: G,
									value: T,
									onChange: D,
									placeholder: "Kein / 1. Assist noch unbekannt",
									numberAriaLabel: "Trikotnummer Assist 1"
								})]
							}), /* @__PURE__ */ (0, Z.jsxs)("label", {
								className: "field",
								children: [/* @__PURE__ */ (0, Z.jsx)("span", { children: "2. Assist" }), /* @__PURE__ */ (0, Z.jsx)(de, {
									players: G,
									value: O,
									onChange: k,
									placeholder: "Kein / 2. Assist noch unbekannt",
									numberAriaLabel: "Trikotnummer Assist 2"
								})]
							})]
						})]
					}),
					/* @__PURE__ */ (0, Z.jsxs)("fieldset", {
						className: "classic-fieldset",
						children: [/* @__PURE__ */ (0, Z.jsx)("legend", { children: "Textvariante" }), /* @__PURE__ */ (0, Z.jsx)(fe, {
							ariaLabel: "Textvariante",
							value: A,
							options: K.map((e) => ({
								value: e.id,
								label: e.name
							})),
							onChange: (e) => {
								re.current.add(J), j(e);
							}
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, Z.jsx)(pe, {
				generatedText: X.text,
				error: X.error,
				manualText: I,
				onManualTextChange: ee
			}),
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "classic-submit-block",
				children: [
					te && /* @__PURE__ */ (0, Z.jsxs)("section", {
						className: "open-scorer-warning",
						role: "alert",
						children: [
							/* @__PURE__ */ (0, Z.jsx)("strong", { children: "Torschütze offen – trotzdem senden?" }),
							/* @__PURE__ */ (0, Z.jsx)("span", { children: "Der Tor-Text wird ohne Spielernamen an WhatsApp gesendet." }),
							/* @__PURE__ */ (0, Z.jsxs)("div", {
								className: "open-scorer-warning-actions",
								children: [/* @__PURE__ */ (0, Z.jsx)("button", {
									className: "primary",
									type: "button",
									disabled: M,
									onClick: () => void se(!0),
									children: "Trotzdem senden"
								}), /* @__PURE__ */ (0, Z.jsx)("button", {
									className: "secondary-button",
									type: "button",
									disabled: M,
									onClick: () => L(!1),
									children: "Abbrechen"
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, Z.jsxs)("div", {
						className: "liveticker-submit-row",
						children: [f, /* @__PURE__ */ (0, Z.jsx)("button", {
							className: "primary submit-compact",
							type: "button",
							"aria-label": h ? "Korrektur speichern" : "Speichern",
							title: h ? "Korrektur speichern" : "Speichern",
							disabled: !i || M || !X.event || !!X.error,
							onClick: () => void se(),
							children: /* @__PURE__ */ (0, Z.jsx)("span", {
								"aria-hidden": "true",
								children: M ? "…" : "💾 📋"
							})
						})]
					}),
					P && /* @__PURE__ */ (0, Z.jsx)("p", {
						className: "liveticker-text-delivery-status",
						children: P
					}),
					R && V && /* @__PURE__ */ (0, Z.jsx)("button", {
						className: "secondary-button classic-retry-button",
						type: "button",
						disabled: M,
						onClick: () => void (async () => {
							try {
								await u({
									deliveryId: R.deliveryId,
									actionId: R.actionId
								}), B(null), H(""), F("Sticker nachträglich mit der Toraktion verknüpft.");
							} catch (e) {
								H(e instanceof Error ? e.message : "Sticker-Verknüpfung fehlgeschlagen.");
							}
						})(),
						children: "Sticker-Verknüpfung erneut versuchen"
					}),
					h && /* @__PURE__ */ (0, Z.jsx)("button", {
						className: "secondary-button classic-cancel-button",
						type: "button",
						disabled: M,
						onClick: m,
						children: "Abbrechen"
					}),
					V && /* @__PURE__ */ (0, Z.jsx)("p", {
						className: "form-error",
						children: V
					})
				]
			})
		]
	});
}
//#endregion
//#region src/components/PenaltyForm.tsx
function It() {
	return {
		key: o(),
		team: "mighty",
		duration: "2",
		reason: Ke[0],
		playerId: ""
	};
}
function Lt(e, t) {
	let n = t.team === "opponent" ? "opponent" : "mighty", r = n === "mighty" ? e.ownTeam.players : e.opponentTeam.players;
	return {
		key: o(),
		team: n,
		duration: String(t.duration || "2"),
		reason: String(t.reason || Ke[0]),
		playerId: be(r, t.player)
	};
}
function Rt({ game: e, state: t, textsystem: r, mutationsAllowed: i, whatsappEnabled: a, whatsappTransportReady: s, editingEvent: c = null, compact: l = !1, submitModeControl: d, onSaved: f, onCancelEdit: p }) {
	let m = c?.type === "penalty" && c.subtype !== "penalty_shot" ? c : null, h = m?.penalties?.length ? m.penalties.map((t) => Lt(e, t)) : [It()], [g, _] = (0, z.useState)(m ? Math.max(1, Number(m.minute || 1)) : t.minute), [v, y] = (0, z.useState)(h), [b, x] = (0, z.useState)(String(m?.outputVariantId || "")), [S, C] = (0, z.useState)(!!m?.outputVariantId), [w, T] = (0, z.useState)(!1), [D, O] = (0, z.useState)(""), [k, A] = (0, z.useState)(null), [j, M] = (0, z.useState)(null), [N, P] = (0, z.useState)(""), F = (0, z.useRef)(String(m?.id || o())), I = (0, z.useRef)(Ee());
	(0, z.useEffect)(() => {
		m || _(t.minute);
	}, [
		m,
		t.minute,
		e.eventId
	]), (0, z.useEffect)(() => {
		I.current.reset(), M(null), P("");
	}, [e.eventId]);
	let ee = (0, z.useCallback)((e) => {
		M(e), e && P("");
	}, []), te = (0, z.useMemo)(() => v.map((t) => {
		let n = t.team === "mighty" ? e.ownTeam.players : e.opponentTeam.players;
		return {
			team: t.team,
			duration: t.duration,
			reason: t.reason,
			player: ye(n, t.playerId)
		};
	}), [e, v]), L = (0, z.useMemo)(() => yt(r), [r]), R = (0, z.useMemo)(() => Xe(te), [te]);
	(0, z.useEffect)(() => {
		let e = L.some((e) => e.id === b);
		if (S && e) return;
		let t = xt(r, R);
		x(t?.id || L[0]?.id || "");
	}, [
		R,
		r,
		b,
		S,
		L
	]);
	let B = (0, z.useMemo)(() => t.history.some((e) => String(e?.id || "") === F.current), [t.history]), V = (0, z.useMemo)(() => {
		try {
			let n = Ze({
				id: F.current,
				minute: g,
				penalties: te,
				outputVariantId: b
			});
			return {
				event: n,
				history: Qe(t.history, n),
				text: At({
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
		te,
		t.history,
		r,
		b
	]);
	function H(e, t) {
		y((n) => n.map((n) => n.key === e ? t.team && t.team !== n.team ? {
			...n,
			...t,
			playerId: ""
		} : {
			...n,
			...t
		} : n));
	}
	function U() {
		if (m) {
			p?.();
			return;
		}
		F.current = o(), y([It()]), _(t.minute), C(!1), M(null), P(""), O("Neue Strafaktion vorbereitet.");
	}
	let ne = k ?? V.text;
	async function re() {
		if (!i) {
			O("Schreibaktionen sind für diesen Stand nicht freigeschaltet.");
			return;
		}
		if (!V.event || V.error) {
			O(V.error || "Strafe konnte nicht vorbereitet werden.");
			return;
		}
		if (I.current.register()) {
			O("SYNC gestoppt · Seite neu laden");
			return;
		}
		T(!0), O("Strafe wird gespeichert …");
		try {
			let r = n(), i = m || B ? String(V.event.id || "") : null, o = a && !i, c = he(V.event, ne, {
				editingId: i,
				enabled: o
			}) || V.event, l = ge(V.history, c), d = _e({
				whatsappEnabled: o,
				transportReady: s
			}), p = await Ie({
				eventId: e.eventId,
				localState: {
					minute: g,
					history: l
				},
				serverState: t,
				clientState: Ae(t),
				environment: r.environment
			});
			f(p.state), _(p.state.minute);
			let h = "", v = j;
			if (v && v.actionId === String(V.event.id || "")) {
				if (E(v.context, V.event)) try {
					await u({
						deliveryId: v.deliveryId,
						actionId: v.actionId
					}), M(null), P(""), h = " · Sticker mit Aktion verknüpft.";
				} catch (e) {
					let t = e instanceof Error ? e.message : "Sticker-Verknüpfung fehlgeschlagen.";
					P(t), h = " · Sticker-Verknüpfung offen.";
				}
				else M(null), P("Sticker blieb unverknüpft, weil die Strafen nach dem Senden geändert wurden."), h = " · Sticker nicht verknüpft.";
			}
			p.wakeWhatsapp && ae();
			let y = d ? await ve(ne) : !1, b = (p.wakeWhatsapp ? " · WhatsApp-Text eingereiht." : d ? y ? " · Text kopiert." : " · Text kann aus der Vorschau kopiert werden." : "") + h;
			A(null), O((p.rebased ? m || B ? "Strafe korrigiert · zwischenzeitliche Änderungen wurden berücksichtigt." : "Strafe gespeichert · zwischenzeitliche Änderungen wurden berücksichtigt." : m || B ? "Strafe serverseitig korrigiert · weitere Strafzeilen können ergänzt werden." : "Strafe serverseitig gespeichert · weitere Strafzeilen können ergänzt werden.") + b);
		} catch (e) {
			O(e instanceof Error ? e.message : "Strafe konnte nicht gespeichert werden.");
		} finally {
			T(!1);
		}
	}
	return /* @__PURE__ */ (0, Z.jsxs)("section", {
		className: l ? "workspace-card action-card compact-action-card" : "workspace-card action-card",
		children: [
			!l && /* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "workspace-header",
				children: [/* @__PURE__ */ (0, Z.jsxs)("div", { children: [/* @__PURE__ */ (0, Z.jsx)("p", {
					className: "eyebrow",
					children: m ? "Korrektur" : "Aktion"
				}), /* @__PURE__ */ (0, Z.jsx)("h2", { children: m ? "Strafe bearbeiten" : "Strafe erfassen" })] }), /* @__PURE__ */ (0, Z.jsx)("span", {
					className: i ? "write-badge enabled" : "write-badge",
					children: i ? "DEV schreiben" : "gesperrt"
				})]
			}),
			!m && !B && /* @__PURE__ */ (0, Z.jsx)(le, {
				eventId: e.eventId,
				opponentTeamId: e.opponentTeam.id,
				actionId: F.current,
				action: "PENALTY",
				penaltyTeams: te.map((e) => e.team),
				mutationsAllowed: i,
				transportReady: s,
				onPendingStickerChange: ee
			}, F.current),
			!l && /* @__PURE__ */ (0, Z.jsxs)("label", {
				className: "field",
				children: [/* @__PURE__ */ (0, Z.jsx)("span", { children: "Spielminute" }), /* @__PURE__ */ (0, Z.jsx)("input", {
					type: "number",
					min: "1",
					value: g,
					onChange: (e) => _(Number(e.target.value))
				})]
			}),
			/* @__PURE__ */ (0, Z.jsx)("div", {
				className: "penalty-rows classic-penalty-list",
				children: v.map((t) => {
					let n = t.team === "mighty" ? e.ownTeam.players : e.opponentTeam.players;
					return /* @__PURE__ */ (0, Z.jsxs)("article", {
						className: "penalty-edit-row classic-penalty-row",
						children: [/* @__PURE__ */ (0, Z.jsxs)("div", {
							className: "penalty-row-head",
							children: [/* @__PURE__ */ (0, Z.jsx)("strong", { children: "Strafe" }), /* @__PURE__ */ (0, Z.jsxs)("div", {
								className: "penalty-row-actions",
								children: [/* @__PURE__ */ (0, Z.jsx)("button", {
									className: "add-penalty",
									type: "button",
									onClick: () => y((e) => [...e, It()]),
									children: "Hinzufügen"
								}), /* @__PURE__ */ (0, Z.jsx)("button", {
									className: "remove-penalty",
									type: "button",
									disabled: v.length === 1,
									onClick: () => y((e) => e.filter((e) => e.key !== t.key)),
									children: "Entfernen"
								})]
							})]
						}), /* @__PURE__ */ (0, Z.jsxs)("div", {
							className: "penalty-grid",
							children: [
								/* @__PURE__ */ (0, Z.jsxs)("label", {
									className: "field",
									children: [/* @__PURE__ */ (0, Z.jsx)("span", { children: "Team" }), /* @__PURE__ */ (0, Z.jsxs)("select", {
										value: t.team,
										onChange: (e) => H(t.key, { team: e.target.value }),
										children: [/* @__PURE__ */ (0, Z.jsx)("option", {
											value: "mighty",
											children: e.ownTeam.shortName
										}), /* @__PURE__ */ (0, Z.jsx)("option", {
											value: "opponent",
											children: e.opponentTeam.shortName
										})]
									})]
								}),
								/* @__PURE__ */ (0, Z.jsxs)("label", {
									className: "field",
									children: [/* @__PURE__ */ (0, Z.jsx)("span", { children: "Strafzeit" }), /* @__PURE__ */ (0, Z.jsx)("select", {
										value: t.duration,
										onChange: (e) => H(t.key, { duration: e.target.value }),
										children: qe.map((e) => /* @__PURE__ */ (0, Z.jsxs)("option", {
											value: e,
											children: [e, " Min."]
										}, e))
									})]
								}),
								/* @__PURE__ */ (0, Z.jsxs)("label", {
									className: "field wide",
									children: [/* @__PURE__ */ (0, Z.jsx)("span", { children: "Spieler" }), /* @__PURE__ */ (0, Z.jsx)(de, {
										players: n,
										value: t.playerId,
										onChange: (e) => H(t.key, { playerId: e }),
										placeholder: "Spieler noch unbekannt",
										numberAriaLabel: "Trikotnummer"
									})]
								}),
								/* @__PURE__ */ (0, Z.jsxs)("label", {
									className: "field wide",
									children: [/* @__PURE__ */ (0, Z.jsx)("span", { children: "Strafgrund" }), /* @__PURE__ */ (0, Z.jsx)("select", {
										value: t.reason,
										onChange: (e) => H(t.key, { reason: e.target.value }),
										children: Ke.map((e) => /* @__PURE__ */ (0, Z.jsx)("option", {
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
			/* @__PURE__ */ (0, Z.jsxs)("fieldset", {
				className: "classic-fieldset",
				children: [/* @__PURE__ */ (0, Z.jsx)("legend", { children: "Textvariante" }), /* @__PURE__ */ (0, Z.jsx)(fe, {
					ariaLabel: "Textvariante",
					value: b,
					options: L.map((e) => ({
						value: e.id,
						label: e.name
					})),
					onChange: (e) => {
						x(e), C(!0);
					}
				})]
			}),
			/* @__PURE__ */ (0, Z.jsx)(pe, {
				generatedText: V.text,
				error: V.error,
				manualText: k,
				onManualTextChange: A
			}),
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "classic-submit-block",
				children: [
					/* @__PURE__ */ (0, Z.jsxs)("div", {
						className: "liveticker-submit-row",
						children: [d, /* @__PURE__ */ (0, Z.jsx)("button", {
							className: "primary submit-compact",
							type: "button",
							"aria-label": m ? "Korrektur speichern" : "Speichern",
							title: m ? "Korrektur speichern" : "Speichern",
							disabled: !i || w || !V.event || !!V.error,
							onClick: () => void re(),
							children: /* @__PURE__ */ (0, Z.jsx)("span", {
								"aria-hidden": "true",
								children: w ? "…" : "💾 📋"
							})
						})]
					}),
					D && /* @__PURE__ */ (0, Z.jsx)("p", {
						className: "liveticker-text-delivery-status",
						children: D
					}),
					j && N && /* @__PURE__ */ (0, Z.jsx)("button", {
						className: "secondary-button classic-retry-button",
						type: "button",
						disabled: w,
						onClick: () => void (async () => {
							try {
								await u({
									deliveryId: j.deliveryId,
									actionId: j.actionId
								}), M(null), P(""), O("Sticker nachträglich mit der Strafaktion verknüpft.");
							} catch (e) {
								P(e instanceof Error ? e.message : "Sticker-Verknüpfung fehlgeschlagen.");
							}
						})(),
						children: "Sticker-Verknüpfung erneut versuchen"
					}),
					!l && /* @__PURE__ */ (0, Z.jsx)("button", {
						className: "secondary-button",
						type: "button",
						disabled: w,
						onClick: U,
						children: m ? "Bearbeiten abbrechen" : "Neue Strafaktion"
					}),
					m && l && /* @__PURE__ */ (0, Z.jsx)("button", {
						className: "secondary-button classic-cancel-button",
						type: "button",
						disabled: w,
						onClick: p,
						children: "Abbrechen"
					}),
					N && /* @__PURE__ */ (0, Z.jsx)("p", {
						className: "form-error",
						children: N
					})
				]
			})
		]
	});
}
//#endregion
//#region src/liveticker/situations.ts
function zt(e) {
	return e === "mighty" ? "opponent" : "mighty";
}
function Bt(e) {
	return e.filter((e) => e.position === "Tor" || e.position === "GOALIE").map((e) => e.position === "GOALIE" ? {
		...e,
		position: "Tor"
	} : e);
}
function Vt({ id: e, minute: t, team: n, player: r, goalie: i, result: a, outputVariantId: s }) {
	let c = Number(t);
	if (!Number.isInteger(c) || c < 1) throw Error("Bitte eine gültige Spielminute ab 1 eingeben.");
	if (!["scored", "missed"].includes(a)) throw Error("Ungültiges Straf-Penalty-Ergebnis.");
	if (!String(s || "").trim()) throw Error("Bitte eine Straf-Penalty-Ausgabevariante wählen.");
	let l = zt(n);
	return {
		id: String(e || o()),
		type: "penalty",
		subtype: "penalty_shot",
		minute: c,
		team: n,
		player: r,
		goalie: i,
		result: a,
		outputVariantId: s,
		penalties: [{
			team: l,
			duration: "Penalty",
			reason: "Straf-Penalty",
			player: null
		}]
	};
}
function Ht({ id: e, team: t, player: n, result: r, outputVariantId: i }) {
	if (!["scored", "missed"].includes(r)) throw Error("Ungültiges Penaltyschießen-Ergebnis.");
	if (!String(i || "").trim()) throw Error("Bitte eine Penaltyschießen-Ausgabevariante wählen.");
	return {
		id: String(e || o()),
		type: "shootout",
		team: t,
		player: n,
		result: r,
		outputVariantId: i
	};
}
function Ut(e, t) {
	let n = Array.isArray(e) ? e.slice() : [], r = String(t.id || ""), i = r ? n.findIndex((e) => String(e?.id || "") === r) : -1;
	return i >= 0 ? n.splice(i, 1, t) : n.push(t), n;
}
//#endregion
//#region src/components/SituationForm.tsx
function Wt({ game: e, state: t, textsystem: r, mutationsAllowed: i, whatsappEnabled: a, whatsappTransportReady: s, editingEvent: c = null, compact: l = !1, submitModeControl: u, defaultKind: d = "penalty_shot", allowStickerOnly: f = !1, onSaved: p, onCancelEdit: m }) {
	let h = c && (c.type === "shootout" || Le(c)) ? c : null, g = h ? h.type === "shootout" ? "shootout" : "penalty_shot" : d, _ = h?.team === "opponent" ? "opponent" : "mighty", v = _ === "mighty" ? e.ownTeam.players : e.opponentTeam.players, y = Bt(zt(_) === "mighty" ? e.ownTeam.players : e.opponentTeam.players), [b, x] = (0, z.useState)(g), [S, C] = (0, z.useState)(!!h || !f), [w, T] = (0, z.useState)(_), [E, D] = (0, z.useState)(h && g === "penalty_shot" ? Math.max(1, Number(h.minute || 1)) : t.minute), [O, k] = (0, z.useState)(be(v, h?.player)), [A, j] = (0, z.useState)(g === "penalty_shot" ? be(y, h?.goalie) : ""), [M, N] = (0, z.useState)(h?.result === "scored" ? "scored" : h?.result === "missed" || g === "penalty_shot" ? "missed" : "scored"), [P, F] = (0, z.useState)(String(h?.outputVariantId || "")), [I, ee] = (0, z.useState)(!1), [te, L] = (0, z.useState)(""), [R, B] = (0, z.useState)(null), V = (0, z.useRef)(String(h?.id || o())), H = (0, z.useRef)(Ee()), U = (0, z.useRef)(b), ne = (0, z.useRef)(w), re = w === "mighty" ? e.ownTeam.players : e.opponentTeam.players, W = zt(w), G = Bt(W === "mighty" ? e.ownTeam.players : e.opponentTeam.players), K = b === "penalty_shot" ? "penalty_shot" : "shootout_attempt", q = (0, z.useMemo)(() => lt(r, K), [K, r]);
	(0, z.useEffect)(() => {
		h || D(t.minute);
	}, [
		h,
		t.minute,
		e.eventId
	]), (0, z.useEffect)(() => {
		let e = q.some((e) => e.id === P);
		if (h && e) return;
		let t = ut(r, K);
		F(t?.id || q[0]?.id || "");
	}, [
		h,
		K,
		r,
		P,
		q
	]), (0, z.useEffect)(() => {
		U.current !== b && (U.current = b, k(""), j(""), N(b === "penalty_shot" ? "missed" : "scored"), F(ut(r, K)?.id || q[0]?.id || ""));
	}, [
		b,
		K,
		r,
		q
	]), (0, z.useEffect)(() => {
		ne.current !== w && (ne.current = w, k(""), j(""));
	}, [w]), (0, z.useEffect)(() => {
		H.current.reset();
	}, [e.eventId]);
	let J = (0, z.useMemo)(() => {
		try {
			let n = ye(re, O), i = b === "penalty_shot" ? Vt({
				id: V.current,
				minute: E,
				team: w,
				player: n,
				goalie: ye(G, A),
				result: M,
				outputVariantId: P
			}) : Ht({
				id: V.current,
				team: w,
				player: n,
				result: M,
				outputVariantId: P
			});
			return {
				event: i,
				history: Ut(t.history, i),
				text: b === "penalty_shot" ? Nt({
					event: i,
					game: e,
					snapshot: r
				}) : Pt({
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
		A,
		G,
		b,
		E,
		O,
		M,
		t.history,
		w,
		r,
		P
	]), ie = R ?? J.text;
	async function Y() {
		if (!i) {
			L("Schreibaktionen sind für diesen Stand nicht freigeschaltet.");
			return;
		}
		if (!J.event || J.error) {
			L(J.error || "Spielsituation konnte nicht vorbereitet werden.");
			return;
		}
		if (H.current.register()) {
			L("SYNC gestoppt · Seite neu laden");
			return;
		}
		ee(!0), L("Spielsituation wird gespeichert …");
		try {
			let r = n(), i = a && !h, c = he(J.event, ie, {
				editingId: h ? String(h.id || "") : null,
				enabled: i
			}) || J.event, l = ge(J.history, c), u = _e({
				whatsappEnabled: i,
				transportReady: s
			}), d = await Ie({
				eventId: e.eventId,
				localState: {
					minute: b === "penalty_shot" ? E : t.minute,
					history: l
				},
				serverState: t,
				clientState: Ae(t),
				environment: r.environment
			});
			p(d.state), d.wakeWhatsapp && ae();
			let f = u ? await ve(ie) : !1, g = d.wakeWhatsapp ? " · WhatsApp-Text eingereiht." : u ? f ? " · Text kopiert." : " · Text kann aus der Vorschau kopiert werden." : "";
			h ? (L((d.rebased ? "Spielsituation korrigiert · zwischenzeitliche Änderungen wurden berücksichtigt." : "Spielsituation serverseitig korrigiert.") + g), m?.()) : (B(null), V.current = o(), k(""), j(""), D(d.state.minute), L((d.rebased ? "Spielsituation gespeichert · zwischenzeitliche Änderungen wurden berücksichtigt." : "Spielsituation serverseitig gespeichert.") + g));
		} catch (e) {
			L(e instanceof Error ? e.message : "Spielsituation konnte nicht gespeichert werden.");
		} finally {
			ee(!1);
		}
	}
	return /* @__PURE__ */ (0, Z.jsxs)("section", {
		className: l ? "workspace-card action-card compact-action-card" : "workspace-card action-card",
		children: [
			!l && /* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "workspace-header",
				children: [/* @__PURE__ */ (0, Z.jsxs)("div", { children: [/* @__PURE__ */ (0, Z.jsx)("p", {
					className: "eyebrow",
					children: h ? "Korrektur" : "Spielsituation"
				}), /* @__PURE__ */ (0, Z.jsx)("h2", { children: h ? b === "penalty_shot" ? "Straf-Penalty bearbeiten" : "Penaltyschießen bearbeiten" : b === "penalty_shot" ? "Straf-Penalty" : "Penaltyschießen" })] }), /* @__PURE__ */ (0, Z.jsx)("span", {
					className: i ? "write-badge enabled" : "write-badge",
					children: i ? "DEV schreiben" : "gesperrt"
				})]
			}),
			!h && f && /* @__PURE__ */ (0, Z.jsx)(le, {
				eventId: e.eventId,
				opponentTeamId: e.opponentTeam.id,
				actionId: "",
				action: "SITUATION",
				mutationsAllowed: i,
				transportReady: s
			}),
			f && !h && /* @__PURE__ */ (0, Z.jsxs)("fieldset", {
				className: "classic-fieldset",
				children: [/* @__PURE__ */ (0, Z.jsx)("legend", { children: "Situation" }), /* @__PURE__ */ (0, Z.jsx)("div", {
					className: "classic-segmented",
					children: /* @__PURE__ */ (0, Z.jsx)("button", {
						type: "button",
						"aria-pressed": S,
						onClick: () => {
							C((e) => !e), x("penalty_shot");
						},
						children: "🏒 Straf-Penalty"
					})
				})]
			}),
			S && /* @__PURE__ */ (0, Z.jsxs)(Z.Fragment, { children: [
				/* @__PURE__ */ (0, Z.jsxs)("div", {
					className: "goal-form-grid classic-situation-fields",
					children: [
						!l && /* @__PURE__ */ (0, Z.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, Z.jsx)("span", { children: "Situation" }), /* @__PURE__ */ (0, Z.jsxs)("select", {
								value: b,
								onChange: (e) => x(e.target.value),
								children: [/* @__PURE__ */ (0, Z.jsx)("option", {
									value: "penalty_shot",
									children: "Straf-Penalty"
								}), /* @__PURE__ */ (0, Z.jsx)("option", {
									value: "shootout",
									children: "Penaltyschießen"
								})]
							})]
						}),
						/* @__PURE__ */ (0, Z.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, Z.jsx)("span", { children: b === "penalty_shot" ? "Angreifendes Team" : "Mannschaft" }), /* @__PURE__ */ (0, Z.jsxs)("select", {
								value: w,
								onChange: (e) => T(e.target.value),
								children: [/* @__PURE__ */ (0, Z.jsx)("option", {
									value: "mighty",
									children: e.ownTeam.shortName
								}), /* @__PURE__ */ (0, Z.jsx)("option", {
									value: "opponent",
									children: e.opponentTeam.shortName
								})]
							})]
						}),
						b === "penalty_shot" && !l && /* @__PURE__ */ (0, Z.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, Z.jsx)("span", { children: "Spielminute" }), /* @__PURE__ */ (0, Z.jsx)("input", {
								type: "number",
								min: "1",
								value: E,
								onChange: (e) => D(Number(e.target.value))
							})]
						}),
						/* @__PURE__ */ (0, Z.jsxs)("label", {
							className: "field wide",
							children: [/* @__PURE__ */ (0, Z.jsx)("span", { children: b === "penalty_shot" ? "Schütze " + (w === "mighty" ? e.ownTeam.shortName : e.opponentTeam.shortName) : "Schütze" }), /* @__PURE__ */ (0, Z.jsx)(de, {
								players: re,
								value: O,
								onChange: k,
								placeholder: "Schütze noch unbekannt",
								numberAriaLabel: b === "penalty_shot" ? "Trikotnummer Straf-Penalty Schütze" : "Trikotnummer Penaltyschütze"
							})]
						}),
						b === "penalty_shot" && /* @__PURE__ */ (0, Z.jsxs)("label", {
							className: "field wide",
							children: [/* @__PURE__ */ (0, Z.jsxs)("span", { children: ["Goalie ", W === "mighty" ? e.ownTeam.shortName : e.opponentTeam.shortName] }), /* @__PURE__ */ (0, Z.jsx)(de, {
								players: G,
								value: A,
								onChange: j,
								placeholder: "Goalie noch unbekannt",
								numberAriaLabel: "Trikotnummer verteidigender Goalie"
							})]
						}),
						/* @__PURE__ */ (0, Z.jsxs)("fieldset", {
							className: "classic-fieldset wide",
							children: [/* @__PURE__ */ (0, Z.jsx)("legend", { children: "Ergebnis" }), /* @__PURE__ */ (0, Z.jsx)(fe, {
								ariaLabel: "Ergebnis",
								value: M,
								options: [{
									value: "scored",
									label: "✅ Verwandelt"
								}, {
									value: "missed",
									label: "❌ Vergeben"
								}],
								onChange: (e) => N(e)
							})]
						}),
						/* @__PURE__ */ (0, Z.jsxs)("fieldset", {
							className: "classic-fieldset wide",
							children: [/* @__PURE__ */ (0, Z.jsx)("legend", { children: "Textvariante" }), /* @__PURE__ */ (0, Z.jsx)(fe, {
								ariaLabel: "Textvariante",
								value: P,
								options: q.map((e) => ({
									value: e.id,
									label: e.name
								})),
								onChange: F
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, Z.jsx)(pe, {
					generatedText: J.text,
					error: J.error,
					manualText: R,
					onManualTextChange: B
				}),
				/* @__PURE__ */ (0, Z.jsxs)("div", {
					className: "classic-submit-block",
					children: [
						/* @__PURE__ */ (0, Z.jsxs)("div", {
							className: "liveticker-submit-row",
							children: [u, /* @__PURE__ */ (0, Z.jsx)("button", {
								className: "primary submit-compact",
								type: "button",
								"aria-label": h ? "Korrektur speichern" : "Speichern",
								title: h ? "Korrektur speichern" : "Speichern",
								disabled: !i || I || !J.event || !!J.error,
								onClick: () => void Y(),
								children: /* @__PURE__ */ (0, Z.jsx)("span", {
									"aria-hidden": "true",
									children: I ? "…" : "💾 📋"
								})
							})]
						}),
						te && /* @__PURE__ */ (0, Z.jsx)("p", {
							className: "liveticker-text-delivery-status",
							children: te
						}),
						h && /* @__PURE__ */ (0, Z.jsx)("button", {
							className: "secondary-button classic-cancel-button",
							type: "button",
							disabled: I,
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
var Gt = Object.freeze({
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
function Kt(e) {
	let t = Number.parseInt(String(e ?? ""), 10);
	if (!Number.isInteger(t) || t < 1) throw Error("Bitte eine gültige Spielminute ab 1 eingeben.");
	return t;
}
function qt(e) {
	let t = Kt(e);
	return t <= 20 ? Gt.P1 : t <= 40 ? Gt.P2 : t <= 60 ? Gt.P3 : Gt.OT;
}
function Jt(e, t) {
	let n = Kt(e), r = Number.parseInt(String(t), 10);
	if (!Number.isInteger(r)) throw Error("Ungültige Minutenänderung.");
	return Math.max(1, n + r);
}
//#endregion
//#region src/components/MinuteControl.tsx
function Yt({ minute: e, disabled: t, saving: n, onCommit: r }) {
	let [i, a] = (0, z.useState)(String(e)), [o, s] = (0, z.useState)("");
	(0, z.useEffect)(() => {
		a(String(e)), s("");
	}, [e]);
	let c = (0, z.useMemo)(() => {
		try {
			return qt(i);
		} catch {
			return qt(e);
		}
	}, [i, e]);
	async function l(t) {
		try {
			let n = Kt(t);
			if (a(String(n)), s(""), n === e) return;
			await r(n);
		} catch (t) {
			a(String(e)), s(t instanceof Error ? t.message : "Spielminute konnte nicht gespeichert werden.");
		}
	}
	async function u(t) {
		try {
			let n = Jt(i || e, t);
			if (a(String(n)), s(""), n === e) return;
			await r(n);
		} catch (t) {
			a(String(e)), s(t instanceof Error ? t.message : "Spielminute konnte nicht gespeichert werden.");
		}
	}
	return /* @__PURE__ */ (0, Z.jsxs)("section", {
		className: "minute-card",
		children: [
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "minute-heading",
				children: [/* @__PURE__ */ (0, Z.jsxs)("div", { children: [/* @__PURE__ */ (0, Z.jsx)("p", {
					className: "eyebrow",
					children: "Spielzeit"
				}), /* @__PURE__ */ (0, Z.jsx)("h2", { children: "Spielminute" })] }), /* @__PURE__ */ (0, Z.jsx)("strong", {
					className: "segment-badge",
					children: c.label
				})]
			}),
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "minute-control",
				children: [
					/* @__PURE__ */ (0, Z.jsx)("button", {
						className: "minute-button",
						type: "button",
						"aria-label": "Eine Minute zurück",
						disabled: t || n,
						onClick: () => void u(-1),
						children: "−"
					}),
					/* @__PURE__ */ (0, Z.jsx)("input", {
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
					/* @__PURE__ */ (0, Z.jsx)("button", {
						className: "minute-button",
						type: "button",
						"aria-label": "Eine Minute weiter",
						disabled: t || n,
						onClick: () => void u(1),
						children: "+"
					})
				]
			}),
			/* @__PURE__ */ (0, Z.jsx)("p", {
				className: "minute-help",
				children: n ? "Minute wird serverseitig gespeichert …" : t ? "Spielzeit ist in diesem Zustand schreibgeschützt." : "Änderungen werden revision-sicher im zentralen Spielstand gespeichert."
			}),
			o && /* @__PURE__ */ (0, Z.jsx)("p", {
				className: "form-error",
				children: o
			})
		]
	});
}
//#endregion
//#region src/components/GraphicsPanel.tsx
function Xt(e) {
	return JSON.stringify([
		e.downloadUrl,
		e.sha256,
		e.bytes
	]);
}
function Zt(e, t) {
	return e + ":" + t;
}
function Qt() {
	return typeof File == "function" && typeof navigator.share == "function" && typeof navigator.canShare == "function";
}
function $t(e) {
	return e.downloadUrl ? (window.location.assign(e.downloadUrl), "downloaded") : "invalid";
}
function en({ eventId: e, mutationsAllowed: t, gameCompleted: n, summaryTextForKind: r, onFinalGraphicReady: i, activeKind: o, compact: u = !1 }) {
	let [f, _] = (0, z.useState)({ jobs: [] }), [v, b] = (0, z.useState)(() => o || "PERIOD_1"), [x, C] = (0, z.useState)(!0), [w, T] = (0, z.useState)(""), [E, j] = (0, z.useState)(""), [M, N] = (0, z.useState)("Grafikstatus wird geladen …"), [P, F] = (0, z.useState)(""), [I, ee] = (0, z.useState)(0), [te, L] = (0, z.useState)(0), [R, B] = (0, z.useState)({}), V = (0, z.useRef)(/* @__PURE__ */ new Map()), H = (0, z.useRef)(/* @__PURE__ */ new Map()), U = (0, z.useRef)(null), ne = (0, z.useRef)(/* @__PURE__ */ new Set()), re = (0, z.useRef)(i);
	(0, z.useEffect)(() => {
		re.current = i;
	}, [i]), (0, z.useEffect)(() => {
		b(o || "PERIOD_1"), B({});
	}, [e, o]), (0, z.useEffect)(() => {
		o && b(o);
	}, [o]);
	let W = (0, z.useCallback)(async () => {
		if (e) try {
			let t = await O(e), n = null;
			try {
				n = await g(e), F("");
			} catch (e) {
				F(e instanceof Error ? e.message : "WhatsApp-Status konnte nicht geladen werden.");
			}
			_(t);
			let r = !1, i = {};
			for (let o of l) {
				let s = a(t, o), c = Zt(e, o), l = H.current.get(c) || null;
				if (s?.status === "SUCCEEDED" && s.jobId) {
					if (!l || l.jobId !== s.jobId) {
						let t = y(e, s.jobId);
						t ? (l = {
							eventId: e,
							jobId: s.jobId,
							deliveryId: t
						}, H.current.set(c, l), r = !0) : l && (H.current.delete(c), l = null, r = !0);
					}
				} else l && (H.current.delete(c), l = null, r = !0);
				if (l && l.jobId === s?.jobId && n) {
					let e = p(n, l.deliveryId);
					e && (i[o] = e);
				}
			}
			r && L((e) => e + 1), n && B(i);
			let o = U.current, s = o?.eventId === e ? o.jobId : "", c = a(t, "FINAL"), u = A(s, c);
			u === "failed" ? (U.current = null, N("Endergebnis · Flyer-Erstellung fehlgeschlagen; Spiel bleibt aktiv.")) : u === "ready" && s && !ne.current.has(s) ? (ne.current.add(s), U.current = null, N("Endergebnis · Flyer fertig; Spiel wird abgeschlossen …"), Promise.resolve(re.current?.(s)).catch((e) => {
				N(e instanceof Error ? e.message : "FINAL-Flyer ist fertig, aber das Spiel konnte nicht abgeschlossen werden.");
			})) : N("Grafikstatus aktualisiert.");
		} catch (e) {
			N(e instanceof Error ? e.message : "Grafikstatus konnte nicht geladen werden.");
		} finally {
			C(!1);
		}
	}, [e]);
	(0, z.useEffect)(() => {
		C(!0), W();
	}, [W]);
	let G = (0, z.useMemo)(() => a(f, v), [v, f]), K = (0, z.useMemo)(() => G?.status === "SUCCEEDED" && G.result?.artifacts || [], [G]), q = (0, z.useMemo)(() => K.find((e) => e.kind === "POST") || null, [K]), J = f.jobs.some((e) => d(e)), ie = H.current.get(Zt(e, v)) || null, Y = R[v] || null, X = !(!ie || Y && m(Y.status)), oe = l.some((t) => {
		if (!H.current.get(Zt(e, t))) return !1;
		let n = R[t];
		return !n || !m(n.status);
	});
	(0, z.useEffect)(() => {
		if (!J && !oe) return;
		let e = window.setTimeout(() => void W(), oe ? 1e3 : 2500);
		return () => window.clearTimeout(e);
	}, [
		J,
		oe,
		W,
		f,
		R
	]), (0, z.useEffect)(() => {
		if (K.length) for (let e of K) {
			let t = Xt(e);
			if (V.current.has(t)) continue;
			let n = {
				prepared: null,
				pending: !0,
				failed: !1
			};
			V.current.set(t, n), ee((e) => e + 1), c(e).then((e) => {
				n.prepared = e, n.pending = !1, ee((e) => e + 1);
			}, () => {
				n.pending = !1, n.failed = !0, ee((e) => e + 1);
			});
		}
	}, [K]);
	async function Q(r) {
		if (!t || n) {
			N("Grafik-Erstellung ist für dieses Spiel nicht freigeschaltet.");
			return;
		}
		if (!(w || d(a(f, r)))) {
			b(r), T(r), N(s(r) + " · Flyer wird angelegt …");
			try {
				let t = await D(e, r);
				r === "FINAL" && (U.current = {
					eventId: e,
					jobId: t
				}), N(s(r) + " · Flyer wird erstellt …"), await W();
			} catch (e) {
				N(e instanceof Error ? e.message : "Grafik konnte nicht angelegt werden.");
			} finally {
				T("");
			}
		}
	}
	async function ce(n) {
		if (!t) {
			N("WhatsApp-Versand ist in diesem Stand nicht freigeschaltet.");
			return;
		}
		let i = a(f, n);
		if (i?.status !== "SUCCEEDED") return;
		let o = i.result?.artifacts.find((e) => e.kind === "POST") || null;
		if (!o) {
			N("POST-Flyer fehlt – WhatsApp wird nicht gesendet.");
			return;
		}
		let c = H.current.get(Zt(e, n)), l = R[n];
		if (!c || l && m(l.status)) {
			j(n), N(s(n) + " · POST + Text werden an WhatsApp übergeben …");
			try {
				if (c?.jobId === i.jobId && l?.status === "FAILED") {
					await h({
						eventId: e,
						deliveryId: c.deliveryId
					}), ae(), N("Bestehender WhatsApp-Auftrag wird mit denselben Zielen erneut versucht."), await W();
					return;
				}
				let t = await S({
					eventId: e,
					graphicJobId: i.jobId,
					kind: n,
					artifact: o,
					message: r(n)
				});
				ae(), H.current.set(Zt(e, n), {
					eventId: e,
					jobId: i.jobId,
					deliveryId: t
				}), L((e) => e + 1), B((e) => ({
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
				})), await W();
			} catch (e) {
				N(e instanceof Error ? e.message : "WhatsApp-Versand konnte nicht angelegt werden.");
			} finally {
				j("");
			}
		}
	}
	function le(e) {
		let t = V.current.get(Xt(e))?.prepared;
		try {
			if (t && typeof File == "function" && typeof navigator.share == "function" && typeof navigator.canShare == "function") {
				let n = new File([t.blob], t.filename, { type: "image/png" });
				if (navigator.canShare({ files: [n] })) {
					navigator.share({
						files: [n],
						title: s(v) + " · " + (e.kind === "POST" ? "Post" : "Story")
					}).catch((t) => {
						t?.name !== "AbortError" && $t(e);
					});
					return;
				}
			}
		} catch (t) {
			if (t?.name === "AbortError") return;
			$t(e);
			return;
		}
		$t(e);
	}
	let ue = Y?.status === "SUCCEEDED" ? "✅ POST + Text erfolgreich an WhatsApp gesendet." : Y?.status === "FAILED" ? "WhatsApp-Versand fehlgeschlagen." : ie ? "POST + Text werden an WhatsApp gesendet …" : "";
	return /* @__PURE__ */ (0, Z.jsxs)("section", {
		className: u ? "classic-graphics-panel" : "workspace-card",
		children: [
			!u && /* @__PURE__ */ (0, Z.jsx)("div", {
				className: "workspace-header compact",
				children: /* @__PURE__ */ (0, Z.jsxs)("div", { children: [/* @__PURE__ */ (0, Z.jsx)("p", {
					className: "eyebrow",
					children: "Grafikausgabe"
				}), /* @__PURE__ */ (0, Z.jsx)("h2", { children: "Flyer" })] })
			}),
			!u && /* @__PURE__ */ (0, Z.jsx)("div", {
				className: "graphic-kind-tabs",
				children: l.map((e) => {
					let t = a(f, e), n = t?.status === "SUCCEEDED" ? "✓" : d(t) ? "…" : t?.status === "FAILED" ? "!" : "—";
					return /* @__PURE__ */ (0, Z.jsxs)("button", {
						className: e === v ? "graphic-kind-tab active" : "graphic-kind-tab",
						type: "button",
						onClick: () => b(e),
						children: [
							s(e),
							" ",
							n
						]
					}, e);
				})
			}),
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "graphic-result",
				children: [
					u ? /* @__PURE__ */ (0, Z.jsx)("p", {
						className: "graphic-status",
						"data-state": G?.status === "SUCCEEDED" ? "success" : G?.status === "FAILED" ? "error" : d(G) ? "active" : "idle",
						children: k(G)
					}) : /* @__PURE__ */ (0, Z.jsxs)("div", {
						className: "graphic-result-head",
						children: [/* @__PURE__ */ (0, Z.jsxs)("div", { children: [/* @__PURE__ */ (0, Z.jsx)("strong", { children: s(v) }), /* @__PURE__ */ (0, Z.jsx)("span", { children: k(G) })] }), /* @__PURE__ */ (0, Z.jsx)("button", {
							className: "secondary-button compact-button",
							type: "button",
							disabled: x,
							onClick: () => void W(),
							children: "Aktualisieren"
						})]
					}),
					G?.status === "SUCCEEDED" && K.length > 0 && /* @__PURE__ */ (0, Z.jsx)("div", {
						className: "graphic-artifact-grid",
						children: K.map((e) => {
							let t = V.current.get(Xt(e)), n = Qt() && !!t?.pending && !t?.prepared && !t?.failed;
							return /* @__PURE__ */ (0, Z.jsx)("button", {
								className: "graphic-artifact-button",
								type: "button",
								disabled: n,
								onClick: () => le(e),
								children: n ? (e.kind === "POST" ? "Post" : "Story") + " wird vorbereitet …" : e.kind === "POST" ? "Post teilen" : "Story teilen"
							}, e.kind + e.downloadUrl);
						})
					}),
					G?.status === "SUCCEEDED" && !K.length && /* @__PURE__ */ (0, Z.jsx)("p", {
						className: "empty-note",
						children: "Flyer ist fertig, aber es wurden keine sicheren Post-/Story-Links geliefert."
					}),
					G?.status === "SUCCEEDED" && /* @__PURE__ */ (0, Z.jsxs)("div", {
						className: "whatsapp-summary-actions",
						children: [
							/* @__PURE__ */ (0, Z.jsx)("button", {
								type: "button",
								disabled: !t || !q || E === v || X || !!Y?.targets?.some((e) => e.error === "DELIVERY_OUTCOME_UNKNOWN"),
								onClick: () => void ce(v),
								children: E === v || X ? "📲 Wird an WhatsApp gesendet …" : Y?.status === "SUCCEEDED" ? "📲 Erneut an WhatsApp senden" : Y?.status === "FAILED" ? "📲 WhatsApp erneut versuchen" : "📲 An WhatsApp senden"
							}),
							/* @__PURE__ */ (0, Z.jsx)(se, { delivery: Y }),
							ue && /* @__PURE__ */ (0, Z.jsxs)("p", {
								className: "whatsapp-delivery-note",
								"data-state": Y?.status === "SUCCEEDED" ? "success" : Y?.status === "FAILED" ? "error" : "active",
								children: [ue, Y?.status === "FAILED" && Y.error ? " " + Y.error : ""]
							})
						]
					}),
					/* @__PURE__ */ (0, Z.jsx)("div", {
						className: "graphic-actions",
						children: G?.status === "SUCCEEDED" ? /* @__PURE__ */ (0, Z.jsx)("button", {
							className: "secondary-button",
							type: "button",
							disabled: !t || n || !!w,
							onClick: () => void Q(v),
							children: "Neu erstellen"
						}) : /* @__PURE__ */ (0, Z.jsx)("button", {
							type: "button",
							disabled: !t || n || !!w || d(G),
							onClick: () => void Q(v),
							children: w === v || d(G) ? "Flyer wird erstellt …" : G?.status === "FAILED" ? "Erneut erstellen" : "🖼️ Flyer erstellen"
						})
					})
				]
			}),
			(!u || x || G?.status === "FAILED") && /* @__PURE__ */ (0, Z.jsx)("p", {
				className: "workspace-message",
				"data-loading": x ? "true" : "false",
				children: M
			}),
			P && /* @__PURE__ */ (0, Z.jsxs)("p", {
				className: "whatsapp-delivery-note",
				"data-state": "error",
				children: ["WhatsApp-Status: ", P]
			}),
			!u && /* @__PURE__ */ (0, Z.jsx)("p", {
				className: "graphic-safety-note",
				children: "WhatsApp gilt erst nach bestätigtem Delivery-Status als erfolgreich."
			})
		]
	});
}
//#endregion
//#region src/components/TextDeliveryMode.tsx
function tn({ transport: e, manualCopyMode: t, onManualCopyModeChange: n, compact: r = !1 }) {
	let i = e.ready && !t, a = e.ready ? i ? "Neue Aktionen senden ihren Text automatisch über WhatsApp." : "Neue Aktionen werden gespeichert und nur kopiert." : "WhatsApp ist nicht vollständig bereit. Neue Aktionen fallen auf Kopieren zurück.";
	return r ? /* @__PURE__ */ (0, Z.jsxs)("div", {
		className: "liveticker-text-mode",
		role: "group",
		"aria-label": "Textausgabe",
		title: a,
		children: [
			/* @__PURE__ */ (0, Z.jsx)("button", {
				type: "button",
				"aria-pressed": i,
				disabled: !e.ready,
				onClick: () => n(!1),
				children: "📲 WhatsApp"
			}),
			/* @__PURE__ */ (0, Z.jsx)("button", {
				type: "button",
				"aria-pressed": !i,
				onClick: () => n(!0),
				children: "📋 Nur kopieren"
			}),
			e.errors.length > 0 && /* @__PURE__ */ (0, Z.jsx)("span", {
				className: "visually-hidden",
				role: "status",
				children: e.errors.join(" · ")
			})
		]
	}) : /* @__PURE__ */ (0, Z.jsxs)("section", {
		className: "text-delivery-card",
		children: [
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "text-delivery-heading",
				children: [/* @__PURE__ */ (0, Z.jsxs)("div", { children: [/* @__PURE__ */ (0, Z.jsx)("p", {
					className: "eyebrow",
					children: "Textausgabe"
				}), /* @__PURE__ */ (0, Z.jsx)("h2", { children: "Neue Aktionen" })] }), /* @__PURE__ */ (0, Z.jsx)("span", {
					className: e.ready ? "write-badge enabled" : "write-badge",
					children: e.ready ? "Transport bereit" : "Transport nicht bereit"
				})]
			}),
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "text-delivery-toggle",
				role: "group",
				"aria-label": "Textausgabe",
				children: [/* @__PURE__ */ (0, Z.jsx)("button", {
					type: "button",
					"aria-pressed": i,
					disabled: !e.ready,
					onClick: () => n(!1),
					children: "📲 WhatsApp"
				}), /* @__PURE__ */ (0, Z.jsx)("button", {
					type: "button",
					"aria-pressed": !i,
					onClick: () => n(!0),
					children: "📋 Nur kopieren"
				})]
			}),
			/* @__PURE__ */ (0, Z.jsx)("p", {
				className: "text-delivery-status",
				children: a
			}),
			e.errors.length > 0 && /* @__PURE__ */ (0, Z.jsx)("p", {
				className: "form-error",
				children: e.errors.join(" · ")
			})
		]
	});
}
//#endregion
//#region src/liveticker/finalization.ts
async function nn({ eventId: e, serverState: t, environment: n }) {
	if (t.completedAt) return {
		state: t,
		rebased: !1
	};
	let r = async (t) => {
		let r = await R("pd_public_liveticker_complete", {
			p_event_id: e,
			p_expected_revision: t,
			p_client_id: Fe(n)
		});
		return j(r);
	};
	try {
		return {
			state: await r(t.revision),
			rebased: !1
		};
	} catch (t) {
		if (!(t instanceof P) || t.code !== "PT409") throw t;
		let n = await R("pd_public_liveticker_state", { p_event_id: e }), i = j(n);
		return i.completedAt ? {
			state: i,
			rebased: !0
		} : {
			state: await r(i.revision),
			rebased: !0
		};
	}
}
//#endregion
//#region src/liveticker/summary.ts
var rn = {
	P1: 1,
	P2: 2,
	P3: 3,
	OT: 4
};
function an(e) {
	if (e.type === "shootout") return 5;
	let t = Number.parseInt(String(e.minute ?? ""), 10);
	return !Number.isInteger(t) || t < 1 ? 99 : t <= 20 ? 1 : t <= 40 ? 2 : t <= 60 ? 3 : 4;
}
function on(e, t, n) {
	let r = ut(e, t);
	return String(r?.template || "").trim() || n;
}
function sn(e, t) {
	return e === "mighty" ? "Mighty Dogs" : t.opponentTeam.shortName;
}
function cn(e, t, n, r, i = null) {
	let a = i ? rn[i] : null;
	return Ve(e).filter((e) => Re(e) && e.team === t && (a === null || an(e) <= a)).map((e) => {
		let t = Le(e) ? "🏒 Straf-Penalty · " + (e.player ? $(e.player) : on(r, "missing_shooter", "Schütze offen")) : e.player ? $(e.player) : on(r, "missing_goal_scorer", "Torschütze offen");
		return dt(r, "goal_summary_line", {
			minute: Number(e.minute || 1),
			scorer: t
		});
	});
}
function ln({ history: e, segmentKey: t, game: n, snapshot: r }) {
	let i = rn[t];
	if (!i) throw Error("Für diesen Abschnitt gibt es keine Drittelzusammenfassung.");
	let a = Ve(e).reduce((e, t) => (Re(t) && t.team && an(t) <= i && (e[t.team] += 1), e), {
		mighty: 0,
		opponent: 0
	}), o = cn(e, "mighty", n, r, t), s = cn(e, "opponent", n, r, t), c = Ct(a, n.homeAway);
	return dt(r, "period_summary", {
		period_label: t === "OT" ? "Overtime" : t === "P1" ? "1. Drittel" : t === "P2" ? "2. Drittel" : "3. Drittel",
		score_line: c.home + ":" + c.away,
		own_goals: (o.length ? o : [on(r, "no_goals", "Keine Tore")]).join("\n"),
		opponent_goals: (s.length ? s : [on(r, "no_goals", "Keine Tore")]).join("\n"),
		opponent_name: n.opponentTeam.shortName
	});
}
function un(e, t, n, r) {
	let i = [];
	for (let n of Ve(e)) if (n.type === "penalty") {
		if (Le(n)) {
			(n.team === "mighty" ? "opponent" : "mighty") === t && i.push(dt(r, "penalty_shot_summary_line", {
				minute: Number(n.minute || 1),
				shooter: n.player ? $(n.player) : on(r, "missing_shooter", "Schütze offen"),
				goalie: n.goalie ? $(n.goalie) : on(r, "missing_goalie", "Goalie offen"),
				result: n.result === "scored" ? "verwandelt" : "vergeben"
			}));
			continue;
		}
		for (let e of Array.isArray(n.penalties) ? n.penalties : []) {
			if (e.team !== t) continue;
			let a = e.player ? $(e.player) : "ohne Spieler", o = String(e.duration || ""), s = String(e.reason || ""), c = dt(r, "penalty_summary_line", {
				minute: Number(n.minute || 1),
				player: a,
				penalty_duration: o + " min",
				penalty_reason: s
			});
			i.push(Ye(o) ? "🚨 *" + c + "*" : c);
		}
	}
	return i.length ? i : [on(r, "no_penalties", "Keine Strafen")];
}
function dn(e, t, n) {
	let r = Ve(e).filter((e) => e.type === "shootout");
	if (!r.length) return "";
	let i = Be(e), a = r.map((e) => {
		if (e.team !== "mighty" && e.team !== "opponent") throw Error("Penaltyschießen ohne gültiges Team.");
		return dt(n, "shootout_summary_line", {
			team_name: sn(e.team, t),
			shooter: e.player ? $(e.player) : on(n, "missing_shooter", "Schütze offen"),
			result: e.result === "scored" ? "verwandelt" : "vergeben"
		});
	});
	return dt(n, "shootout_summary", {
		mighty_score: i.mighty,
		opponent_score: i.opponent,
		opponent_name: t.opponentTeam.shortName,
		shootout_attempts: a.join("\n")
	});
}
function fn(e) {
	let t = ze(e);
	if (Ve(e).filter((e) => e.type === "shootout").length) {
		let n = Be(e);
		return n.mighty === n.opponent ? {
			...t,
			suffix: "Penaltyschießen läuft"
		} : {
			mighty: t.mighty + +(n.mighty > n.opponent),
			opponent: t.opponent + +(n.opponent > n.mighty),
			suffix: "n. P."
		};
	}
	return Ve(e).some((e) => Re(e) && Number(e.minute) > 60) ? {
		...t,
		suffix: "n. V."
	} : {
		...t,
		suffix: ""
	};
}
function pn({ history: e, game: t, snapshot: n }) {
	let r = fn(e), i = Ct(r, t.homeAway), a = r.suffix ? " " + r.suffix : "", o = t.homeAway === "AWAY" ? t.opponentTeam.shortName + " " + i.home + ":" + i.away + " Mighty Dogs" + a : "Mighty Dogs " + i.home + ":" + i.away + " " + t.opponentTeam.shortName + a, s = cn(e, "mighty", t, n), c = cn(e, "opponent", t, n);
	return dt(n, "final_summary", {
		score_line: o,
		own_goals: (s.length ? s : [on(n, "no_goals", "Keine Tore")]).join("\n"),
		opponent_goals: (c.length ? c : [on(n, "no_goals", "Keine Tore")]).join("\n"),
		own_penalties: un(e, "mighty", t, n).join("\n"),
		opponent_penalties: un(e, "opponent", t, n).join("\n"),
		shootout_summary: dn(e, t, n),
		opponent_name: t.opponentTeam.shortName
	}, ["shootout_summary"]);
}
function mn({ kind: e, history: t, game: n, snapshot: r }) {
	return e === "PERIOD_1" ? ln({
		history: t,
		segmentKey: "P1",
		game: n,
		snapshot: r
	}) : e === "PERIOD_2" ? ln({
		history: t,
		segmentKey: "P2",
		game: n,
		snapshot: r
	}) : pn({
		history: t,
		game: n,
		snapshot: r
	});
}
//#endregion
//#region src/components/GameWorkspace.tsx
function hn({ history: e, opponentShortName: t, mutationsAllowed: n, deletingId: r, editingId: i, onEdit: a, onDelete: o }) {
	let [s, c] = (0, z.useState)(!1), l = (0, z.useMemo)(() => Ve(e).reverse(), [e]), u = s ? l : l.slice(0, 5);
	return l.length ? /* @__PURE__ */ (0, Z.jsxs)(Z.Fragment, { children: [/* @__PURE__ */ (0, Z.jsx)("div", {
		className: "history-list",
		children: u.map((e, s) => {
			let c = e, l = c.type === "penalty" && !Le(c) && Array.isArray(c.penalties) && c.penalties.some((e) => Ye(String(e.duration || "")));
			return /* @__PURE__ */ (0, Z.jsxs)("details", {
				className: l ? "history-item major" : "history-item",
				children: [/* @__PURE__ */ (0, Z.jsxs)("summary", { children: [/* @__PURE__ */ (0, Z.jsx)("span", { children: We(c, t) }), /* @__PURE__ */ (0, Z.jsx)("span", {
					className: "history-chevron",
					"aria-hidden": "true",
					children: "⌄"
				})] }), /* @__PURE__ */ (0, Z.jsxs)("div", {
					className: "history-detail-body",
					children: [/* @__PURE__ */ (0, Z.jsx)("p", { children: Ge(e, t) }), /* @__PURE__ */ (0, Z.jsxs)("div", {
						className: "inline-actions",
						children: [/* @__PURE__ */ (0, Z.jsx)("button", {
							className: "secondary-button compact-button",
							type: "button",
							disabled: !n || i === String(e.id || ""),
							onClick: () => a(e),
							children: i === String(e.id || "") ? "Wird bearbeitet" : "Bearbeiten"
						}), /* @__PURE__ */ (0, Z.jsx)("button", {
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
	}), l.length > 5 && /* @__PURE__ */ (0, Z.jsx)("button", {
		className: "history-toggle",
		type: "button",
		onClick: () => c((e) => !e),
		children: s ? "Weniger anzeigen ▴" : "Alle Ereignisse anzeigen ▾"
	})] }) : /* @__PURE__ */ (0, Z.jsx)("p", {
		className: "empty-note",
		children: "Noch keine Aktion erfasst."
	});
}
function gn({ mutationsAllowed: e }) {
	let t = n().environment, [r, i] = (0, z.useState)([]), [o, s] = (0, z.useState)(""), [c, l] = (0, z.useState)(null), [u, f] = (0, z.useState)(null), [p, m] = (0, z.useState)(!0), [h, g] = (0, z.useState)("Spiele werden geladen …"), [_, v] = (0, z.useState)(""), [y, b] = (0, z.useState)(null), [x, S] = (0, z.useState)(!1), [C, w] = (0, z.useState)(!1), [E, D] = (0, z.useState)(!1), [k, A] = (0, z.useState)(!1), [j, P] = (0, z.useState)("GOAL_MIGHTY"), [R, B] = (0, z.useState)(""), [V, H] = (0, z.useState)(""), [U, ne] = (0, z.useState)("PERIOD_1"), [re, W] = (0, z.useState)(!1), [G, J] = (0, z.useState)({
		PERIOD_1: "—",
		PERIOD_2: "—",
		FINAL: "—"
	}), [Y, ae] = (0, z.useState)({
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
	}), se = (0, z.useRef)(Ee());
	(0, z.useEffect)(() => {
		let e = !1;
		return (async () => {
			try {
				let [t, n] = await Promise.all([F(), ct()]);
				if (e) return;
				if (f(n), !t.length) {
					i([]), l(null), g("Keine Spiele im zentralen Kalender verfügbar."), m(!1);
					return;
				}
				let r = te(), a = t.find((e) => e.eventId === r) || t[0];
				i(t), s(a.eventId), I(a.eventId);
				let o = await ee(a.eventId);
				if (e) return;
				l(o), g("Zentraler Liveticker-State geladen."), m(!1);
			} catch (t) {
				if (e) return;
				g(t instanceof Error ? t.message : "Spiele konnten nicht geladen werden."), m(!1);
			}
		})(), () => {
			e = !0;
		};
	}, []), (0, z.useEffect)(() => {
		let e = !1, n = 0, r = async () => {
			let i = await K(t);
			e || (ae(i), n = window.setTimeout(r, 5e3));
		};
		return r(), () => {
			e = !0, n && window.clearTimeout(n);
		};
	}, [t]);
	let Q = (0, z.useMemo)(() => r.find((e) => e.eventId === o) || null, [r, o]);
	(0, z.useEffect)(() => {
		if (!o) return;
		let e = !1, t = 0, n = async () => {
			try {
				let t = await O(o);
				if (e) return;
				let n = {};
				for (let e of [
					"PERIOD_1",
					"PERIOD_2",
					"FINAL"
				]) {
					let r = a(t, e);
					n[e] = r?.status === "SUCCEEDED" ? "✓" : d(r) ? "…" : r?.status === "FAILED" ? "!" : "—";
				}
				J(n);
			} catch {
				e || J({
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
	}, [o]);
	let ce = (0, z.useMemo)(() => ze(c?.history || []), [c?.history]), le = (0, z.useMemo)(() => Be(c?.history || []), [c?.history]), ue = (0, z.useMemo)(() => (c?.history || []).some((e) => e?.type === "shootout"), [c?.history]), de = (0, z.useMemo)(() => qt(c?.minute || 1), [c?.minute]);
	function fe(e) {
		b(e), e.type === "goal" ? P(e.team === "opponent" ? "GOAL_OPPONENT" : "GOAL_MIGHTY") : e.type === "penalty" && !Le(e) ? P("PENALTY") : e.type === "shootout" ? P("SHOOTOUT") : P("SITUATION");
	}
	async function pe(t) {
		if (!c || !Q || !t.id) return;
		if (!e || c.completedAt) {
			g("Schreibaktionen sind für diesen Stand nicht freigeschaltet.");
			return;
		}
		let r = We(t, Q.opponentTeam.shortName);
		if (!window.confirm("Aktion „" + r + "“ wirklich zurücknehmen?")) return;
		if (se.current.register()) {
			g("SYNC gestoppt · Seite neu laden");
			return;
		}
		let i = String(t.id);
		v(i), g("Aktion wird zurückgenommen …");
		try {
			let e = n(), t = c.history.filter((e) => String(e?.id || "") !== i), r = await Ie({
				eventId: Q.eventId,
				localState: {
					minute: c.minute,
					history: t
				},
				serverState: c,
				clientState: Ae(c),
				environment: e.environment
			});
			l(r.state), String(y?.id || "") === i && b(null), g(r.rebased ? "Aktion zurückgenommen · zwischenzeitliche Änderungen wurden berücksichtigt." : "Aktion serverseitig zurückgenommen.");
		} catch (e) {
			g(e instanceof Error ? e.message : "Aktion konnte nicht zurückgenommen werden.");
		} finally {
			v("");
		}
	}
	async function me(t) {
		if (c && Q) {
			if (!e || c.completedAt) {
				g("Schreibaktionen sind für diesen Stand nicht freigeschaltet.");
				return;
			}
			if (se.current.register()) {
				g("SYNC gestoppt · Seite neu laden");
				return;
			}
			S(!0), g("Spielminute wird gespeichert …");
			try {
				let e = n(), r = await Ie({
					eventId: Q.eventId,
					localState: {
						minute: t,
						history: c.history
					},
					serverState: c,
					clientState: Ae(c),
					environment: e.environment
				});
				l(r.state), g(r.rebased ? "Spielminute gespeichert · zwischenzeitliche Änderungen wurden berücksichtigt." : "Spielminute serverseitig gespeichert.");
			} catch (e) {
				throw g(e instanceof Error ? e.message : "Spielminute konnte nicht gespeichert werden."), e;
			} finally {
				S(!1);
			}
		}
	}
	async function he() {
		if (c && Q && !C && N() && window.confirm("Testspiel „" + Q.displayTitle + "“ wirklich als neuen Testlauf starten? Aktionen, Spielminute und aktuelle Versand-/Grafikstatus werden zurückgesetzt.")) {
			w(!0), g("Testspiel wird zurückgesetzt …");
			try {
				let e = await M({
					eventId: Q.eventId,
					expectedRevision: c.revision
				});
				l(e), b(null), P("GOAL_MIGHTY"), W(!1), J({
					PERIOD_1: "—",
					PERIOD_2: "—",
					FINAL: "—"
				}), se.current.reset(), g("Neuer Testlauf gestartet.");
			} catch (e) {
				g(e instanceof Error ? e.message : "Testspiel konnte nicht zurückgesetzt werden.");
			} finally {
				w(!1);
			}
		}
	}
	function ge(e) {
		if (c && Q) {
			if (e === "FINAL") {
				if (c.minute < 60) {
					g("Der Endstand kann erst ab Minute 60 erstellt werden.");
					return;
				}
				if (!c.completedAt && !window.confirm("Spiel wirklich beenden? Der Endstand-Flyer wird jetzt vorbereitet. Nach erfolgreicher Erstellung wird das Spiel abgeschlossen und archiviert.")) return;
			}
			ne(e), W(!0);
		}
	}
	async function _e() {
		if (c && Q && !(!e || c.completedAt || E)) {
			D(!0), g("FINAL-Flyer fertig · Spiel wird abgeschlossen und archiviert …");
			try {
				let e = n(), t = await nn({
					eventId: Q.eventId,
					serverState: c,
					environment: e.environment
				});
				l(t.state), g(t.rebased ? "Spiel abgeschlossen · zwischenzeitlicher Serverstand wurde berücksichtigt." : "Spiel abgeschlossen und archiviert.");
			} catch (e) {
				throw g(e instanceof Error ? e.message : "FINAL-Flyer ist fertig, aber das Spiel konnte nicht abgeschlossen werden."), e;
			} finally {
				D(!1);
			}
		}
	}
	function ve(e) {
		e.open && e.parentElement?.querySelectorAll("details.worker-control").forEach((t) => {
			t !== e && (t.open = !1);
		});
	}
	async function ye() {
		if (!R) {
			B("wa"), H("");
			try {
				await q(!Y.wa.enabled), ae(await K(t));
			} catch (e) {
				H(e instanceof Error ? e.message : "WhatsApp-Worker konnte nicht geändert werden.");
			} finally {
				B("");
			}
		}
	}
	async function be() {
		if (!(R || t !== "PROD")) {
			B("wpp"), H("");
			try {
				await ie(Y.wpp.desiredConnected === !1), ae(await K(t));
			} catch (e) {
				H(e instanceof Error ? e.message : "WPP konnte nicht geändert werden.");
			} finally {
				B("");
			}
		}
	}
	async function xe(e) {
		s(e), I(e), m(!0), g("Spielstand wird geladen …"), b(null), P("GOAL_MIGHTY"), W(!1), se.current.reset();
		try {
			let t = await ee(e);
			l(t), g("Zentraler Liveticker-State geladen.");
		} catch (e) {
			l(null), g(e instanceof Error ? e.message : "Spielstand konnte nicht geladen werden.");
		} finally {
			m(!1);
		}
	}
	return /* @__PURE__ */ (0, Z.jsxs)("div", {
		className: "classic-ticker-stack",
		children: [
			/* @__PURE__ */ (0, Z.jsxs)("section", {
				className: "card classic-score-card",
				"aria-label": "Aktueller Spielstand",
				children: [
					/* @__PURE__ */ (0, Z.jsxs)("div", {
						className: "classic-system-strip status-bar-tools",
						"aria-label": "Systemstatus",
						children: [
							/* @__PURE__ */ (0, Z.jsxs)("details", {
								className: "worker-control",
								onToggle: (e) => ve(e.currentTarget),
								children: [/* @__PURE__ */ (0, Z.jsx)("summary", {
									title: "Nur der " + t + "-WhatsApp-Worker",
									children: /* @__PURE__ */ (0, Z.jsxs)("span", {
										className: "worker-indicator",
										children: [
											/* @__PURE__ */ (0, Z.jsx)("span", {
												className: Y.wa.ready ? "worker-dot active" : Y.wa.enabled ? "worker-dot starting" : "worker-dot",
												children: "●"
											}),
											/* @__PURE__ */ (0, Z.jsxs)("span", { children: ["WA ", t] }),
											/* @__PURE__ */ (0, Z.jsx)("strong", { children: Y.wa.ready ? "AKTIV" : Y.wa.enabled ? "STARTET …" : "AUS" })
										]
									})
								}), /* @__PURE__ */ (0, Z.jsx)("div", {
									className: "worker-control-body",
									children: /* @__PURE__ */ (0, Z.jsx)("button", {
										type: "button",
										disabled: !!R,
										onClick: () => void ye(),
										children: R === "wa" ? "Speichert …" : Y.wa.enabled ? "Ausschalten" : "Einschalten"
									})
								})]
							}),
							/* @__PURE__ */ (0, Z.jsxs)("details", {
								className: "worker-control",
								onToggle: (e) => ve(e.currentTarget),
								children: [/* @__PURE__ */ (0, Z.jsx)("summary", {
									title: "Globale WhatsApp-Verbindung für DEV und PROD",
									children: /* @__PURE__ */ (0, Z.jsxs)("span", {
										className: "worker-indicator",
										children: [
											/* @__PURE__ */ (0, Z.jsx)("span", {
												className: Y.wpp.ready ? "worker-dot active" : Y.wpp.state === "CONNECTING" ? "worker-dot starting" : "worker-dot",
												children: "●"
											}),
											/* @__PURE__ */ (0, Z.jsx)("span", { children: "WPP GLOBAL" }),
											/* @__PURE__ */ (0, Z.jsx)("strong", { children: Y.wpp.ready ? "VERBUNDEN" : Y.wpp.state })
										]
									})
								}), /* @__PURE__ */ (0, Z.jsx)("div", {
									className: "worker-control-body",
									children: /* @__PURE__ */ (0, Z.jsx)("button", {
										type: "button",
										disabled: !!R || t !== "PROD",
										onClick: () => void be(),
										children: t === "PROD" ? R === "wpp" ? "Speichert …" : Y.wpp.desiredConnected === !1 ? "Verbinden" : "Trennen" : "Steuerung nur in PROD"
									})
								})]
							}),
							/* @__PURE__ */ (0, Z.jsx)(oe, {
								environment: t,
								status: Y,
								disabled: !e,
								onToggle: ve,
								onChange: ae
							})
						]
					}),
					/* @__PURE__ */ (0, Z.jsxs)("p", {
						className: "classic-target-summary",
						children: [
							"Neue WhatsApp-Ausgaben: ",
							/* @__PURE__ */ (0, Z.jsx)("strong", { children: X(Y) }),
							t === "DEV" && Y.routing?.deliveryApproved !== !0 ? " · Versand noch nicht freigegeben" : ""
						]
					}),
					V && /* @__PURE__ */ (0, Z.jsx)("p", {
						className: "classic-runtime-message",
						children: V
					}),
					/* @__PURE__ */ (0, Z.jsxs)("div", {
						className: "classic-segment-bar",
						children: [/* @__PURE__ */ (0, Z.jsx)("strong", { children: de.label }), ue && /* @__PURE__ */ (0, Z.jsxs)("span", { children: [
							"Penaltyschießen · ",
							le.mighty,
							":",
							le.opponent
						] })]
					}),
					/* @__PURE__ */ (0, Z.jsxs)("label", {
						className: "classic-game-field",
						children: [
							/* @__PURE__ */ (0, Z.jsx)("span", { children: "Spiel" }),
							/* @__PURE__ */ (0, Z.jsx)("select", {
								value: o,
								disabled: p || !r.length,
								onChange: (e) => void xe(e.target.value),
								children: r.map((e) => /* @__PURE__ */ (0, Z.jsx)("option", {
									value: e.eventId,
									children: L(e)
								}, e.eventId))
							}),
							/* @__PURE__ */ (0, Z.jsx)("small", {
								"data-state": p ? "pending" : h && h !== "Zentraler Liveticker-State geladen." ? "error" : "success",
								children: p ? "Lädt …" : h && h !== "Zentraler Liveticker-State geladen." ? h : "Synchronisiert"
							})
						]
					}),
					/* @__PURE__ */ (0, Z.jsxs)("div", {
						className: "classic-live-row",
						children: [/* @__PURE__ */ (0, Z.jsxs)("div", {
							className: "classic-score-field",
							children: [/* @__PURE__ */ (0, Z.jsx)("span", {
								className: "classic-control-label",
								children: "Spielstand"
							}), /* @__PURE__ */ (0, Z.jsxs)("div", {
								className: "classic-scoreboard",
								children: [
									/* @__PURE__ */ (0, Z.jsxs)("div", { children: [/* @__PURE__ */ (0, Z.jsx)("span", { children: "Heim" }), /* @__PURE__ */ (0, Z.jsx)("strong", { children: Q ? Q.homeAway === "HOME" ? ce.mighty : ce.opponent : 0 })] }),
									/* @__PURE__ */ (0, Z.jsx)("b", { children: ":" }),
									/* @__PURE__ */ (0, Z.jsxs)("div", { children: [/* @__PURE__ */ (0, Z.jsx)("span", { children: "Gast" }), /* @__PURE__ */ (0, Z.jsx)("strong", { children: Q ? Q.homeAway === "HOME" ? ce.opponent : ce.mighty : 0 })] })
								]
							})]
						}), c && /* @__PURE__ */ (0, Z.jsxs)("div", {
							className: "classic-minute-field",
							children: [/* @__PURE__ */ (0, Z.jsx)("span", {
								className: "classic-control-label",
								children: "Spielminute"
							}), /* @__PURE__ */ (0, Z.jsx)(Yt, {
								minute: c.minute,
								disabled: !e || !!c.completedAt,
								saving: x,
								onCommit: me
							})]
						})]
					}),
					/* @__PURE__ */ (0, Z.jsx)("div", {
						className: "classic-output-strip",
						"aria-label": "Drittel- und Endausgaben",
						children: [
							"PERIOD_1",
							"PERIOD_2",
							"FINAL"
						].map((e) => {
							let t = G[e];
							return /* @__PURE__ */ (0, Z.jsxs)("button", {
								className: t === "✓" ? "ready" : t === "…" ? "active" : "",
								type: "button",
								disabled: !Q || !c || e === "FINAL" && c.minute < 60,
								onClick: () => ge(e),
								children: [
									e === "PERIOD_1" ? "1. Drittel" : e === "PERIOD_2" ? "2. Drittel" : "Spiel beenden",
									" ",
									t
								]
							}, e);
						})
					}),
					re && Q && c && u && /* @__PURE__ */ (0, Z.jsxs)("section", {
						className: "classic-output-drawer",
						children: [/* @__PURE__ */ (0, Z.jsxs)("div", {
							className: "classic-drawer-head",
							children: [/* @__PURE__ */ (0, Z.jsx)("strong", { children: U === "PERIOD_1" ? "1. Drittel · Ausgabe" : U === "PERIOD_2" ? "2. Drittel · Ausgabe" : "Endstand · Ausgabe" }), /* @__PURE__ */ (0, Z.jsx)("button", {
								type: "button",
								onClick: () => W(!1),
								children: "Schließen"
							})]
						}), /* @__PURE__ */ (0, Z.jsx)(en, {
							eventId: Q.eventId,
							mutationsAllowed: e && !E,
							gameCompleted: !!c.completedAt,
							activeKind: U,
							compact: !0,
							summaryTextForKind: (e) => mn({
								kind: e,
								history: c.history,
								game: Q,
								snapshot: u
							}),
							onFinalGraphicReady: _e
						})]
					}),
					(p || h && h !== "Zentraler Liveticker-State geladen.") && /* @__PURE__ */ (0, Z.jsx)("p", {
						className: "classic-load-message",
						"data-loading": p ? "true" : "false",
						children: h
					})
				]
			}),
			Q && c && u && /* @__PURE__ */ (0, Z.jsxs)("section", {
				className: "card classic-composer",
				children: [
					/* @__PURE__ */ (0, Z.jsx)("div", {
						className: "classic-composer-title",
						children: /* @__PURE__ */ (0, Z.jsx)("h2", { children: "Aktion" })
					}),
					y && /* @__PURE__ */ (0, Z.jsxs)("section", {
						className: "editing-banner",
						children: [/* @__PURE__ */ (0, Z.jsxs)("div", { children: [/* @__PURE__ */ (0, Z.jsx)("strong", { children: "Aktion wird bearbeitet" }), /* @__PURE__ */ (0, Z.jsx)("span", { children: We(y, Q.opponentTeam.shortName) })] }), /* @__PURE__ */ (0, Z.jsx)("button", {
							className: "secondary-button",
							type: "button",
							onClick: () => b(null),
							children: "Abbrechen"
						})]
					}),
					/* @__PURE__ */ (0, Z.jsxs)("div", {
						className: c.minute >= 60 ? "classic-action-grid shootout-available" : "classic-action-grid",
						role: "group",
						"aria-label": "Aktion auswählen",
						children: [
							/* @__PURE__ */ (0, Z.jsxs)("button", {
								type: "button",
								"aria-pressed": j === "GOAL_MIGHTY",
								onClick: () => {
									b(null), P("GOAL_MIGHTY");
								},
								children: [/* @__PURE__ */ (0, Z.jsx)("span", {
									"aria-hidden": "true",
									children: "🥅"
								}), /* @__PURE__ */ (0, Z.jsx)("span", { children: "Tor Dogs" })]
							}),
							/* @__PURE__ */ (0, Z.jsxs)("button", {
								type: "button",
								"aria-pressed": j === "PENALTY",
								onClick: () => {
									b(null), P("PENALTY");
								},
								children: [/* @__PURE__ */ (0, Z.jsx)("span", {
									"aria-hidden": "true",
									children: "🚨"
								}), /* @__PURE__ */ (0, Z.jsx)("span", { children: "Strafe" })]
							}),
							/* @__PURE__ */ (0, Z.jsxs)("button", {
								type: "button",
								"aria-pressed": j === "GOAL_OPPONENT",
								onClick: () => {
									b(null), P("GOAL_OPPONENT");
								},
								children: [/* @__PURE__ */ (0, Z.jsx)("span", {
									"aria-hidden": "true",
									children: "🥅"
								}), /* @__PURE__ */ (0, Z.jsx)("span", { children: "Tor Gegner" })]
							}),
							/* @__PURE__ */ (0, Z.jsxs)("button", {
								type: "button",
								"aria-pressed": j === "SITUATION",
								onClick: () => {
									b(null), P("SITUATION");
								},
								children: [/* @__PURE__ */ (0, Z.jsx)("span", {
									"aria-hidden": "true",
									children: "💬"
								}), /* @__PURE__ */ (0, Z.jsx)("span", { children: "Situation" })]
							}),
							c.minute >= 60 && /* @__PURE__ */ (0, Z.jsxs)("button", {
								className: "classic-shootout-action",
								type: "button",
								"aria-pressed": j === "SHOOTOUT",
								onClick: () => {
									b(null), P("SHOOTOUT");
								},
								children: [/* @__PURE__ */ (0, Z.jsx)("span", {
									"aria-hidden": "true",
									children: "🏒"
								}), /* @__PURE__ */ (0, Z.jsx)("span", { children: "Penaltyschießen" })]
							})
						]
					}),
					j === "GOAL_MIGHTY" && /* @__PURE__ */ (0, Z.jsx)(Ft, {
						game: Q,
						state: c,
						textsystem: u,
						mutationsAllowed: e && !c.completedAt,
						whatsappEnabled: Y.ready && !k,
						whatsappTransportReady: Y.ready,
						editingEvent: y,
						defaultTeam: "mighty",
						compact: !0,
						submitModeControl: /* @__PURE__ */ (0, Z.jsx)(tn, {
							transport: Y,
							manualCopyMode: k,
							onManualCopyModeChange: A,
							compact: !0
						}),
						onSaved: l,
						onCancelEdit: () => b(null)
					}, (y ? "edit-" : "new-") + "goal-mighty-" + Q.eventId + "-" + String(y?.id || "")),
					j === "GOAL_OPPONENT" && /* @__PURE__ */ (0, Z.jsx)(Ft, {
						game: Q,
						state: c,
						textsystem: u,
						mutationsAllowed: e && !c.completedAt,
						whatsappEnabled: Y.ready && !k,
						whatsappTransportReady: Y.ready,
						editingEvent: y,
						defaultTeam: "opponent",
						compact: !0,
						submitModeControl: /* @__PURE__ */ (0, Z.jsx)(tn, {
							transport: Y,
							manualCopyMode: k,
							onManualCopyModeChange: A,
							compact: !0
						}),
						onSaved: l,
						onCancelEdit: () => b(null)
					}, (y ? "edit-" : "new-") + "goal-opponent-" + Q.eventId + "-" + String(y?.id || "")),
					j === "PENALTY" && /* @__PURE__ */ (0, Z.jsx)(Rt, {
						game: Q,
						state: c,
						textsystem: u,
						mutationsAllowed: e && !c.completedAt,
						whatsappEnabled: Y.ready && !k,
						whatsappTransportReady: Y.ready,
						editingEvent: y,
						compact: !0,
						submitModeControl: /* @__PURE__ */ (0, Z.jsx)(tn, {
							transport: Y,
							manualCopyMode: k,
							onManualCopyModeChange: A,
							compact: !0
						}),
						onSaved: l,
						onCancelEdit: () => b(null)
					}, (y ? "edit-" : "new-") + "penalty-" + Q.eventId + "-" + String(y?.id || "")),
					j === "SITUATION" && /* @__PURE__ */ (0, Z.jsx)(Wt, {
						game: Q,
						state: c,
						textsystem: u,
						mutationsAllowed: e && !c.completedAt,
						whatsappEnabled: Y.ready && !k,
						whatsappTransportReady: Y.ready,
						editingEvent: y,
						compact: !0,
						defaultKind: "penalty_shot",
						allowStickerOnly: !0,
						submitModeControl: /* @__PURE__ */ (0, Z.jsx)(tn, {
							transport: Y,
							manualCopyMode: k,
							onManualCopyModeChange: A,
							compact: !0
						}),
						onSaved: l,
						onCancelEdit: () => b(null)
					}, (y ? "edit-" : "new-") + "situation-" + Q.eventId + "-" + String(y?.id || "")),
					j === "SHOOTOUT" && /* @__PURE__ */ (0, Z.jsx)(Wt, {
						game: Q,
						state: c,
						textsystem: u,
						mutationsAllowed: e && !c.completedAt,
						whatsappEnabled: Y.ready && !k,
						whatsappTransportReady: Y.ready,
						editingEvent: y,
						compact: !0,
						defaultKind: "shootout",
						submitModeControl: /* @__PURE__ */ (0, Z.jsx)(tn, {
							transport: Y,
							manualCopyMode: k,
							onManualCopyModeChange: A,
							compact: !0
						}),
						onSaved: l,
						onCancelEdit: () => b(null)
					}, (y ? "edit-" : "new-") + "shootout-" + Q.eventId + "-" + String(y?.id || ""))
				]
			}),
			Q && /* @__PURE__ */ (0, Z.jsxs)("section", {
				className: "card classic-history",
				children: [/* @__PURE__ */ (0, Z.jsx)("h2", { children: "Letzte Ereignisse" }), /* @__PURE__ */ (0, Z.jsx)(hn, {
					history: c?.history || [],
					opponentShortName: Q.opponentTeam.shortName,
					mutationsAllowed: e && !c?.completedAt,
					deletingId: _,
					editingId: String(y?.id || ""),
					onEdit: fe,
					onDelete: pe
				})]
			}),
			N() && Q && c && /* @__PURE__ */ (0, Z.jsx)("div", {
				className: "classic-footer-actions",
				children: /* @__PURE__ */ (0, Z.jsx)("button", {
					className: "secondary-button danger-button",
					type: "button",
					disabled: C,
					onClick: () => void he(),
					children: C ? "Testspiel wird zurückgesetzt …" : "Testspiel zurücksetzen"
				})
			}),
			/* @__PURE__ */ (0, Z.jsxs)("details", {
				className: "classic-secondary-drawer",
				children: [/* @__PURE__ */ (0, Z.jsx)("summary", { children: "Archiv" }), /* @__PURE__ */ (0, Z.jsx)(T, {})]
			})
		]
	});
}
//#endregion
export { gn as GameWorkspace };
