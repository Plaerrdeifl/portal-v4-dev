import { a as e, s as t, t as n } from "./api-DqcqenPV.js";
import { o as r } from "./games-DYIBHwRf.js";
//#region src/components/SpieltageAdmin.tsx
var i = t(), a = e(), o = {
	eventDate: "",
	eventTime: "",
	homeAway: "HOME",
	opponentName: "",
	venue: "",
	matchdayNumber: ""
};
function s(e) {
	return {
		eventDate: e.eventDate,
		eventTime: (e.eventTime || "").slice(0, 5),
		homeAway: e.homeAway,
		opponentName: e.opponentName,
		venue: e.venue || "",
		matchdayNumber: e.matchdayNumber == null ? "" : String(e.matchdayNumber)
	};
}
function c(e) {
	let t = Number(e.eventDate.slice(0, 4));
	return Number(e.eventDate.slice(5, 7)) >= 7 ? String(t) + "/" + String(t + 1) : String(t - 1) + "/" + String(t);
}
function l(e) {
	return e instanceof Error ? e.message : "Spieltage konnten nicht verarbeitet werden.";
}
function u({ mutationsAllowed: e, onOpenGame: t }) {
	let [u, d] = (0, i.useState)([]), [f, p] = (0, i.useState)(!0), [m, h] = (0, i.useState)(!1), [g, _] = (0, i.useState)(null), [v, y] = (0, i.useState)(null), [b, x] = (0, i.useState)(null), [S, C] = (0, i.useState)(o), [w, T] = (0, i.useState)("all");
	async function E() {
		p(!0), _(null);
		try {
			let e = await n("liveticker_spieltage_list");
			d(Array.isArray(e.games) ? e.games : []);
		} catch (e) {
			_(l(e));
		} finally {
			p(!1);
		}
	}
	(0, i.useEffect)(() => {
		E();
	}, []);
	let D = (0, i.useMemo)(() => Array.from(new Set(u.map(c))).sort(), [u]), O = (0, i.useMemo)(() => u.filter((e) => w === "all" || c(e) === w), [u, w]);
	async function k(t) {
		if (t.preventDefault(), e && !m) {
			h(!0), _(null), y(null);
			try {
				let e = {
					eventDate: S.eventDate,
					eventTime: S.eventTime || null,
					homeAway: S.homeAway,
					opponentName: S.opponentName.trim(),
					venue: S.venue.trim() || null,
					matchdayNumber: S.matchdayNumber || null
				};
				b && b !== "new" && (e.id = b.id, e.expectedRevision = b.revision);
				let t = await n("liveticker_spieltage_save", e);
				d(t.games), x(null), y("Spieltag gespeichert.");
			} catch (e) {
				_(l(e));
			} finally {
				h(!1);
			}
		}
	}
	async function A(t) {
		if (!e || m) return;
		let r = t.gameStatus === "SCHEDULED" ? "CANCELLED" : "SCHEDULED";
		if (window.confirm(r === "CANCELLED" ? "Spiel wirklich absagen? Spiel-ID und Historie bleiben erhalten." : "Spiel wieder freigeben?")) {
			h(!0), _(null), y(null);
			try {
				let e = await n("liveticker_spieltage_status", {
					id: t.id,
					expectedRevision: t.revision,
					gameStatus: r
				});
				d(e.games), y(r === "CANCELLED" ? "Spiel abgesagt." : "Spiel wieder freigegeben.");
			} catch (e) {
				_(l(e));
			} finally {
				h(!1);
			}
		}
	}
	function j(e) {
		r(e.id), t();
	}
	return /* @__PURE__ */ (0, a.jsxs)("section", {
		className: "workspace-card spieltage-management",
		"aria-labelledby": "spieltage-title",
		children: [
			/* @__PURE__ */ (0, a.jsx)("header", {
				className: "workspace-header",
				children: /* @__PURE__ */ (0, a.jsxs)("div", { children: [
					/* @__PURE__ */ (0, a.jsx)("p", {
						className: "eyebrow",
						children: "Liveticker-Verwaltung"
					}),
					/* @__PURE__ */ (0, a.jsx)("h2", {
						id: "spieltage-title",
						children: "Spieltage"
					}),
					/* @__PURE__ */ (0, a.jsx)("p", { children: "Spiele direkt im Liveticker verwalten. Bestehende Spiel-IDs bleiben erhalten." })
				] })
			}),
			e ? null : /* @__PURE__ */ (0, a.jsx)("p", {
				role: "status",
				children: "Änderungen sind im aktuellen Plattformmodus gesperrt."
			}),
			v ? /* @__PURE__ */ (0, a.jsx)("p", {
				role: "status",
				className: "spieltage-notice",
				children: v
			}) : null,
			g ? /* @__PURE__ */ (0, a.jsx)("p", {
				role: "alert",
				className: "spieltage-error",
				children: g
			}) : null,
			/* @__PURE__ */ (0, a.jsxs)("div", {
				className: "spieltage-toolbar",
				children: [
					/* @__PURE__ */ (0, a.jsxs)("label", { children: ["Saison", /* @__PURE__ */ (0, a.jsxs)("select", {
						value: w,
						onChange: (e) => T(e.currentTarget.value),
						children: [/* @__PURE__ */ (0, a.jsx)("option", {
							value: "all",
							children: "Alle Spielzeiten"
						}), D.map((e) => /* @__PURE__ */ (0, a.jsx)("option", {
							value: e,
							children: e
						}, e))]
					})] }),
					/* @__PURE__ */ (0, a.jsx)("button", {
						type: "button",
						disabled: !e || m,
						onClick: () => {
							x("new"), C(o), _(null), y(null);
						},
						children: "+ Spieltag anlegen"
					}),
					/* @__PURE__ */ (0, a.jsx)("button", {
						type: "button",
						disabled: m || f,
						onClick: () => void E(),
						children: "Aktualisieren"
					})
				]
			}),
			b ? /* @__PURE__ */ (0, a.jsxs)("form", {
				className: "spieltage-editor",
				onSubmit: k,
				children: [
					/* @__PURE__ */ (0, a.jsx)("h3", { children: b === "new" ? "Neues Spiel" : "Spiel bearbeiten" }),
					/* @__PURE__ */ (0, a.jsxs)("div", {
						className: "spieltage-fields",
						children: [
							/* @__PURE__ */ (0, a.jsxs)("label", { children: ["Spieltag Nr. (optional)", /* @__PURE__ */ (0, a.jsx)("input", {
								type: "number",
								min: "1",
								max: "100",
								value: S.matchdayNumber,
								disabled: m,
								onChange: (e) => C({
									...S,
									matchdayNumber: e.currentTarget.value
								})
							})] }),
							/* @__PURE__ */ (0, a.jsxs)("label", { children: ["Datum", /* @__PURE__ */ (0, a.jsx)("input", {
								type: "date",
								required: !0,
								value: S.eventDate,
								disabled: m,
								onChange: (e) => C({
									...S,
									eventDate: e.currentTarget.value
								})
							})] }),
							/* @__PURE__ */ (0, a.jsxs)("label", { children: ["Uhrzeit", /* @__PURE__ */ (0, a.jsx)("input", {
								type: "time",
								value: S.eventTime,
								disabled: m,
								onChange: (e) => C({
									...S,
									eventTime: e.currentTarget.value
								})
							})] }),
							/* @__PURE__ */ (0, a.jsxs)("label", { children: ["Heim/Auswärts", /* @__PURE__ */ (0, a.jsxs)("select", {
								value: S.homeAway,
								disabled: m,
								onChange: (e) => C({
									...S,
									homeAway: e.currentTarget.value
								}),
								children: [/* @__PURE__ */ (0, a.jsx)("option", {
									value: "HOME",
									children: "Heimspiel"
								}), /* @__PURE__ */ (0, a.jsx)("option", {
									value: "AWAY",
									children: "Auswärtsspiel"
								})]
							})] }),
							/* @__PURE__ */ (0, a.jsxs)("label", { children: ["Gegner", /* @__PURE__ */ (0, a.jsx)("input", {
								required: !0,
								maxLength: 140,
								value: S.opponentName,
								disabled: m,
								onChange: (e) => C({
									...S,
									opponentName: e.currentTarget.value
								})
							})] }),
							/* @__PURE__ */ (0, a.jsxs)("label", { children: ["Spielort", /* @__PURE__ */ (0, a.jsx)("input", {
								maxLength: 240,
								value: S.venue,
								disabled: m,
								onChange: (e) => C({
									...S,
									venue: e.currentTarget.value
								})
							})] })
						]
					}),
					/* @__PURE__ */ (0, a.jsxs)("div", {
						className: "spieltage-actions",
						children: [/* @__PURE__ */ (0, a.jsx)("button", {
							type: "submit",
							disabled: !e || m,
							children: m ? "Speichern …" : "Speichern"
						}), /* @__PURE__ */ (0, a.jsx)("button", {
							type: "button",
							disabled: m,
							onClick: () => {
								x(null), _(null);
							},
							children: "Abbrechen"
						})]
					})
				]
			}) : null,
			f ? /* @__PURE__ */ (0, a.jsx)("p", {
				role: "status",
				children: "Spieltage werden geladen …"
			}) : null,
			!f && O.length === 0 ? /* @__PURE__ */ (0, a.jsx)("p", { children: "Keine Spiele für diese Auswahl vorhanden." }) : null,
			/* @__PURE__ */ (0, a.jsx)("div", {
				className: "spieltage-list",
				children: O.map((t) => /* @__PURE__ */ (0, a.jsxs)("article", {
					className: "spieltage-item",
					children: [/* @__PURE__ */ (0, a.jsxs)("div", {
						className: "spieltage-item__details",
						children: [
							/* @__PURE__ */ (0, a.jsxs)("strong", { children: [t.matchdayNumber ? "Spieltag " + t.matchdayNumber + " · " : "", t.opponentName] }),
							/* @__PURE__ */ (0, a.jsxs)("span", { children: [
								t.eventDate.split("-").reverse().join("."),
								t.eventTime ? " · " + t.eventTime.slice(0, 5) : "",
								" · ",
								t.homeAway === "HOME" ? "Heimspiel" : "Auswärtsspiel"
							] }),
							t.venue ? /* @__PURE__ */ (0, a.jsx)("span", { children: t.venue }) : null,
							t.gameStatus === "CANCELLED" ? /* @__PURE__ */ (0, a.jsx)("span", {
								className: "spieltage-status",
								children: "Abgesagt"
							}) : null,
							t.hasTrip ? /* @__PURE__ */ (0, a.jsx)("span", { children: "Fanbusfahrt verknüpft" }) : null,
							t.hasFinal ? /* @__PURE__ */ (0, a.jsx)("span", { children: "Abgeschlossen · geschützt" }) : null
						]
					}), /* @__PURE__ */ (0, a.jsxs)("div", {
						className: "spieltage-actions",
						children: [
							t.gameStatus === "SCHEDULED" && !t.hasFinal ? /* @__PURE__ */ (0, a.jsx)("button", {
								type: "button",
								onClick: () => j(t),
								children: "Im Liveticker öffnen"
							}) : null,
							/* @__PURE__ */ (0, a.jsx)("button", {
								type: "button",
								disabled: !e || m || t.hasFinal,
								onClick: () => {
									x(t), C(s(t)), _(null), y(null);
								},
								children: "Bearbeiten"
							}),
							/* @__PURE__ */ (0, a.jsx)("button", {
								type: "button",
								disabled: !e || m || t.hasFinal || t.gameStatus === "SCHEDULED" && t.hasTrip,
								onClick: () => void A(t),
								children: t.gameStatus === "CANCELLED" ? "Wieder freigeben" : "Absagen"
							})
						]
					})]
				}, t.id))
			})
		]
	});
}
//#endregion
export { u as SpieltageAdmin };
