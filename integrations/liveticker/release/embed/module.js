import { a as e, i as t, n, o as r, r as i, s as a, t as o } from "./chunks/api-CS-CXZJI.js";
//#region node_modules/scheduler/cjs/scheduler.production.js
var s = /* @__PURE__ */ a(((e) => {
	function t(e, t) {
		var n = e.length;
		e.push(t);
		a: for (; 0 < n;) {
			var r = n - 1 >>> 1, a = e[r];
			if (0 < i(a, t)) e[r] = t, e[n] = a, n = r;
			else break a;
		}
	}
	function n(e) {
		return e.length === 0 ? null : e[0];
	}
	function r(e) {
		if (e.length === 0) return null;
		var t = e[0], n = e.pop();
		if (n !== t) {
			e[0] = n;
			a: for (var r = 0, a = e.length, o = a >>> 1; r < o;) {
				var s = 2 * (r + 1) - 1, c = e[s], l = s + 1, u = e[l];
				if (0 > i(c, n)) l < a && 0 > i(u, c) ? (e[r] = u, e[l] = n, r = l) : (e[r] = c, e[s] = n, r = s);
				else if (l < a && 0 > i(u, n)) e[r] = u, e[l] = n, r = l;
				else break a;
			}
		}
		return t;
	}
	function i(e, t) {
		var n = e.sortIndex - t.sortIndex;
		return n === 0 ? e.id - t.id : n;
	}
	if (e.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
		var a = performance;
		e.unstable_now = function() {
			return a.now();
		};
	} else {
		var o = Date, s = o.now();
		e.unstable_now = function() {
			return o.now() - s;
		};
	}
	var c = [], l = [], u = 1, d = null, f = 3, p = !1, m = !1, h = !1, g = !1, _ = typeof setTimeout == "function" ? setTimeout : null, v = typeof clearTimeout == "function" ? clearTimeout : null, y = typeof setImmediate < "u" ? setImmediate : null;
	function b(e) {
		for (var i = n(l); i !== null;) {
			if (i.callback === null) r(l);
			else if (i.startTime <= e) r(l), i.sortIndex = i.expirationTime, t(c, i);
			else break;
			i = n(l);
		}
	}
	function ee(e) {
		if (h = !1, b(e), !m) {
			if (n(c) !== null) m = !0, te || (te = !0, oe());
			else {
				var t = n(l);
				t !== null && ce(ee, t.startTime - e);
			}
		}
	}
	var te = !1, ne = -1, re = 5, ie = -1;
	function ae() {
		return g ? !0 : !(e.unstable_now() - ie < re);
	}
	function x() {
		if (g = !1, te) {
			var t = e.unstable_now();
			ie = t;
			var i = !0;
			try {
				a: {
					m = !1, h && (h = !1, v(ne), ne = -1), p = !0;
					var a = f;
					try {
						b: {
							for (b(t), d = n(c); d !== null && !(d.expirationTime > t && ae());) {
								var o = d.callback;
								if (typeof o == "function") {
									d.callback = null, f = d.priorityLevel;
									var s = o(d.expirationTime <= t);
									if (t = e.unstable_now(), typeof s == "function") {
										d.callback = s, b(t), i = !0;
										break b;
									}
									d === n(c) && r(c), b(t);
								} else r(c);
								d = n(c);
							}
							if (d !== null) i = !0;
							else {
								var u = n(l);
								u !== null && ce(ee, u.startTime - t), i = !1;
							}
						}
						break a;
					} finally {
						d = null, f = a, p = !1;
					}
					i = void 0;
				}
			} finally {
				i ? oe() : te = !1;
			}
		}
	}
	var oe;
	if (typeof y == "function") oe = function() {
		y(x);
	};
	else if (typeof MessageChannel < "u") {
		var S = new MessageChannel(), se = S.port2;
		S.port1.onmessage = x, oe = function() {
			se.postMessage(null);
		};
	} else oe = function() {
		_(x, 0);
	};
	function ce(t, n) {
		ne = _(function() {
			t(e.unstable_now());
		}, n);
	}
	e.unstable_IdlePriority = 5, e.unstable_ImmediatePriority = 1, e.unstable_LowPriority = 4, e.unstable_NormalPriority = 3, e.unstable_Profiling = null, e.unstable_UserBlockingPriority = 2, e.unstable_cancelCallback = function(e) {
		e.callback = null;
	}, e.unstable_forceFrameRate = function(e) {
		0 > e || 125 < e ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : re = 0 < e ? Math.floor(1e3 / e) : 5;
	}, e.unstable_getCurrentPriorityLevel = function() {
		return f;
	}, e.unstable_next = function(e) {
		switch (f) {
			case 1:
			case 2:
			case 3:
				var t = 3;
				break;
			default: t = f;
		}
		var n = f;
		f = t;
		try {
			return e();
		} finally {
			f = n;
		}
	}, e.unstable_requestPaint = function() {
		g = !0;
	}, e.unstable_runWithPriority = function(e, t) {
		switch (e) {
			case 1:
			case 2:
			case 3:
			case 4:
			case 5: break;
			default: e = 3;
		}
		var n = f;
		f = e;
		try {
			return t();
		} finally {
			f = n;
		}
	}, e.unstable_scheduleCallback = function(r, i, a) {
		var o = e.unstable_now();
		switch (typeof a == "object" && a ? (a = a.delay, a = typeof a == "number" && 0 < a ? o + a : o) : a = o, r) {
			case 1:
				var s = -1;
				break;
			case 2:
				s = 250;
				break;
			case 5:
				s = 1073741823;
				break;
			case 4:
				s = 1e4;
				break;
			default: s = 5e3;
		}
		return s = a + s, r = {
			id: u++,
			callback: i,
			priorityLevel: r,
			startTime: a,
			expirationTime: s,
			sortIndex: -1
		}, a > o ? (r.sortIndex = a, t(l, r), n(c) === null && r === n(l) && (h ? (v(ne), ne = -1) : h = !0, ce(ee, a - o))) : (r.sortIndex = s, t(c, r), m || p || (m = !0, te || (te = !0, oe()))), r;
	}, e.unstable_shouldYield = ae, e.unstable_wrapCallback = function(e) {
		var t = f;
		return function() {
			var n = f;
			f = t;
			try {
				return e.apply(this, arguments);
			} finally {
				f = n;
			}
		};
	};
})), c = /* @__PURE__ */ a(((e) => {
	process.env.NODE_ENV !== "production" && (function() {
		function t() {
			if (ee = !1, ie) {
				var t = e.unstable_now();
				oe = t;
				var n = !0;
				try {
					a: {
						y = !1, b && (b = !1, ne(ae), ae = -1), v = !0;
						var a = _;
						try {
							b: {
								for (o(t), g = r(p); g !== null && !(g.expirationTime > t && c());) {
									var u = g.callback;
									if (typeof u == "function") {
										g.callback = null, _ = g.priorityLevel;
										var d = u(g.expirationTime <= t);
										if (t = e.unstable_now(), typeof d == "function") {
											g.callback = d, o(t), n = !0;
											break b;
										}
										g === r(p) && i(p), o(t);
									} else i(p);
									g = r(p);
								}
								if (g !== null) n = !0;
								else {
									var f = r(m);
									f !== null && l(s, f.startTime - t), n = !1;
								}
							}
							break a;
						} finally {
							g = null, _ = a, v = !1;
						}
						n = void 0;
					}
				} finally {
					n ? S() : ie = !1;
				}
			}
		}
		function n(e, t) {
			var n = e.length;
			e.push(t);
			a: for (; 0 < n;) {
				var r = n - 1 >>> 1, i = e[r];
				if (0 < a(i, t)) e[r] = t, e[n] = i, n = r;
				else break a;
			}
		}
		function r(e) {
			return e.length === 0 ? null : e[0];
		}
		function i(e) {
			if (e.length === 0) return null;
			var t = e[0], n = e.pop();
			if (n !== t) {
				e[0] = n;
				a: for (var r = 0, i = e.length, o = i >>> 1; r < o;) {
					var s = 2 * (r + 1) - 1, c = e[s], l = s + 1, u = e[l];
					if (0 > a(c, n)) l < i && 0 > a(u, c) ? (e[r] = u, e[l] = n, r = l) : (e[r] = c, e[s] = n, r = s);
					else if (l < i && 0 > a(u, n)) e[r] = u, e[l] = n, r = l;
					else break a;
				}
			}
			return t;
		}
		function a(e, t) {
			var n = e.sortIndex - t.sortIndex;
			return n === 0 ? e.id - t.id : n;
		}
		function o(e) {
			for (var t = r(m); t !== null;) {
				if (t.callback === null) i(m);
				else if (t.startTime <= e) i(m), t.sortIndex = t.expirationTime, n(p, t);
				else break;
				t = r(m);
			}
		}
		function s(e) {
			if (b = !1, o(e), !y) {
				if (r(p) !== null) y = !0, ie || (ie = !0, S());
				else {
					var t = r(m);
					t !== null && l(s, t.startTime - e);
				}
			}
		}
		function c() {
			return ee ? !0 : !(e.unstable_now() - oe < x);
		}
		function l(t, n) {
			ae = te(function() {
				t(e.unstable_now());
			}, n);
		}
		if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart == "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error()), e.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
			var u = performance;
			e.unstable_now = function() {
				return u.now();
			};
		} else {
			var d = Date, f = d.now();
			e.unstable_now = function() {
				return d.now() - f;
			};
		}
		var p = [], m = [], h = 1, g = null, _ = 3, v = !1, y = !1, b = !1, ee = !1, te = typeof setTimeout == "function" ? setTimeout : null, ne = typeof clearTimeout == "function" ? clearTimeout : null, re = typeof setImmediate < "u" ? setImmediate : null, ie = !1, ae = -1, x = 5, oe = -1;
		if (typeof re == "function") var S = function() {
			re(t);
		};
		else if (typeof MessageChannel < "u") {
			var se = new MessageChannel(), ce = se.port2;
			se.port1.onmessage = t, S = function() {
				ce.postMessage(null);
			};
		} else S = function() {
			te(t, 0);
		};
		e.unstable_IdlePriority = 5, e.unstable_ImmediatePriority = 1, e.unstable_LowPriority = 4, e.unstable_NormalPriority = 3, e.unstable_Profiling = null, e.unstable_UserBlockingPriority = 2, e.unstable_cancelCallback = function(e) {
			e.callback = null;
		}, e.unstable_forceFrameRate = function(e) {
			0 > e || 125 < e ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : x = 0 < e ? Math.floor(1e3 / e) : 5;
		}, e.unstable_getCurrentPriorityLevel = function() {
			return _;
		}, e.unstable_next = function(e) {
			switch (_) {
				case 1:
				case 2:
				case 3:
					var t = 3;
					break;
				default: t = _;
			}
			var n = _;
			_ = t;
			try {
				return e();
			} finally {
				_ = n;
			}
		}, e.unstable_requestPaint = function() {
			ee = !0;
		}, e.unstable_runWithPriority = function(e, t) {
			switch (e) {
				case 1:
				case 2:
				case 3:
				case 4:
				case 5: break;
				default: e = 3;
			}
			var n = _;
			_ = e;
			try {
				return t();
			} finally {
				_ = n;
			}
		}, e.unstable_scheduleCallback = function(t, i, a) {
			var o = e.unstable_now();
			switch (typeof a == "object" && a ? (a = a.delay, a = typeof a == "number" && 0 < a ? o + a : o) : a = o, t) {
				case 1:
					var c = -1;
					break;
				case 2:
					c = 250;
					break;
				case 5:
					c = 1073741823;
					break;
				case 4:
					c = 1e4;
					break;
				default: c = 5e3;
			}
			return c = a + c, t = {
				id: h++,
				callback: i,
				priorityLevel: t,
				startTime: a,
				expirationTime: c,
				sortIndex: -1
			}, a > o ? (t.sortIndex = a, n(m, t), r(p) === null && t === r(m) && (b ? (ne(ae), ae = -1) : b = !0, l(s, a - o))) : (t.sortIndex = c, n(p, t), y || v || (y = !0, ie || (ie = !0, S()))), t;
		}, e.unstable_shouldYield = c, e.unstable_wrapCallback = function(e) {
			var t = _;
			return function() {
				var n = _;
				_ = t;
				try {
					return e.apply(this, arguments);
				} finally {
					_ = n;
				}
			};
		}, typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop == "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
	})();
})), l = /* @__PURE__ */ a(((e, t) => {
	t.exports = process.env.NODE_ENV === "production" ? s() : c();
})), u = /* @__PURE__ */ a(((e) => {
	var t = r();
	function n(e) {
		var t = "https://react.dev/errors/" + e;
		if (1 < arguments.length) {
			t += "?args[]=" + encodeURIComponent(arguments[1]);
			for (var n = 2; n < arguments.length; n++) t += "&args[]=" + encodeURIComponent(arguments[n]);
		}
		return "Minified React error #" + e + "; visit " + t + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
	}
	function i() {}
	var a = {
		d: {
			f: i,
			r: function() {
				throw Error(n(522));
			},
			D: i,
			C: i,
			L: i,
			m: i,
			X: i,
			S: i,
			M: i
		},
		p: 0,
		findDOMNode: null
	}, o = Symbol.for("react.portal"), s = Symbol.for("react.recoverable"), c = Symbol.for("react.optimistic_key");
	function l(e, t, n) {
		var r = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
		return {
			$$typeof: o,
			key: r == null ? null : r === c ? c : "" + r,
			children: e,
			containerInfo: t,
			implementation: n
		};
	}
	var u = t.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
	function d(e, t) {
		if (e === "font") return "";
		if (typeof t == "string") return t === "use-credentials" ? t : "";
	}
	e.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = a, e.browser = function(e) {
		return {
			$$typeof: s,
			_reason: e
		};
	}, e.createPortal = function(e, t) {
		var r = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
		if (!t || t.nodeType !== 1 && t.nodeType !== 9 && t.nodeType !== 11) throw Error(n(299));
		return l(e, t, null, r);
	}, e.flushSync = function(e) {
		var t = u.T, n = a.p;
		try {
			if (u.T = null, a.p = 2, e) return e();
		} finally {
			u.T = t, a.p = n, a.d.f();
		}
	}, e.preconnect = function(e, t) {
		typeof e == "string" && (t ? (t = t.crossOrigin, t = typeof t == "string" ? t === "use-credentials" ? t : "" : void 0) : t = null, a.d.C(e, t));
	}, e.prefetchDNS = function(e) {
		typeof e == "string" && a.d.D(e);
	}, e.preinit = function(e, t) {
		if (typeof e == "string" && t && typeof t.as == "string") {
			var n = t.as, r = d(n, t.crossOrigin), i = typeof t.integrity == "string" ? t.integrity : void 0, o = typeof t.fetchPriority == "string" ? t.fetchPriority : void 0;
			n === "style" ? a.d.S(e, typeof t.precedence == "string" ? t.precedence : void 0, {
				crossOrigin: r,
				integrity: i,
				fetchPriority: o
			}) : n === "script" && a.d.X(e, {
				crossOrigin: r,
				integrity: i,
				fetchPriority: o,
				nonce: typeof t.nonce == "string" ? t.nonce : void 0
			});
		}
	}, e.preinitModule = function(e, t) {
		if (typeof e == "string") {
			if (typeof t == "object" && t) {
				if (t.as == null || t.as === "script") {
					var n = d(t.as, t.crossOrigin);
					a.d.M(e, {
						crossOrigin: n,
						integrity: typeof t.integrity == "string" ? t.integrity : void 0,
						nonce: typeof t.nonce == "string" ? t.nonce : void 0,
						fetchPriority: typeof t.fetchPriority == "string" ? t.fetchPriority : void 0
					});
				}
			} else t ?? a.d.M(e);
		}
	}, e.preload = function(e, t) {
		if (typeof e == "string" && typeof t == "object" && t && typeof t.as == "string") {
			var n = t.as, r = d(n, t.crossOrigin);
			a.d.L(e, n, {
				crossOrigin: r,
				integrity: typeof t.integrity == "string" ? t.integrity : void 0,
				nonce: typeof t.nonce == "string" ? t.nonce : void 0,
				type: typeof t.type == "string" ? t.type : void 0,
				fetchPriority: typeof t.fetchPriority == "string" ? t.fetchPriority : void 0,
				referrerPolicy: typeof t.referrerPolicy == "string" ? t.referrerPolicy : void 0,
				imageSrcSet: typeof t.imageSrcSet == "string" ? t.imageSrcSet : void 0,
				imageSizes: typeof t.imageSizes == "string" ? t.imageSizes : void 0,
				media: typeof t.media == "string" ? t.media : void 0
			});
		}
	}, e.preloadModule = function(e, t) {
		if (typeof e == "string") {
			if (t) {
				var n = d(t.as, t.crossOrigin);
				a.d.m(e, {
					as: typeof t.as == "string" && t.as !== "script" ? t.as : void 0,
					crossOrigin: n,
					integrity: typeof t.integrity == "string" ? t.integrity : void 0,
					nonce: typeof t.nonce == "string" ? t.nonce : void 0,
					fetchPriority: typeof t.fetchPriority == "string" ? t.fetchPriority : void 0
				});
			} else a.d.m(e);
		}
	}, e.requestFormReset = function(e) {
		a.d.r(e);
	}, e.unstable_batchedUpdates = function(e, t) {
		return e(t);
	}, e.useFormState = function(e, t, n) {
		return u.H.useFormState(e, t, n);
	}, e.useFormStatus = function() {
		return u.H.useHostTransitionStatus();
	}, e.version = "19.3.0";
})), d = /* @__PURE__ */ a(((e) => {
	process.env.NODE_ENV !== "production" && (function() {
		function t() {}
		function n(e) {
			return "" + e;
		}
		function i(e, t, r) {
			var i = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
			if (i == null) i = null;
			else if (i === p) i = p;
			else {
				try {
					n(i);
					var a = !1;
				} catch {
					a = !0;
				}
				a && (console.error("The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", typeof Symbol == "function" && Symbol.toStringTag && i[Symbol.toStringTag] || i.constructor.name || "Object"), n(i)), i = "" + i;
			}
			return {
				$$typeof: d,
				key: i,
				children: e,
				containerInfo: t,
				implementation: r
			};
		}
		function a(e, t) {
			if (e === "font") return "";
			if (typeof t == "string") return t === "use-credentials" ? t : "";
		}
		function o(e) {
			return e === null ? "`null`" : e === void 0 ? "`undefined`" : e === "" ? "an empty string" : "something with type \"" + typeof e + "\"";
		}
		function s(e) {
			return e === null ? "`null`" : e === void 0 ? "`undefined`" : e === "" ? "an empty string" : typeof e == "string" ? JSON.stringify(e) : typeof e == "number" ? "`" + e + "`" : "something with type \"" + typeof e + "\"";
		}
		function c() {
			var e = m.H;
			return e === null && console.error("Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem."), e;
		}
		typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart == "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
		var l = r(), u = {
			d: {
				f: t,
				r: function() {
					throw Error("Invalid form element. requestFormReset must be passed a form that was rendered by React.");
				},
				D: t,
				C: t,
				L: t,
				m: t,
				X: t,
				S: t,
				M: t
			},
			p: 0,
			findDOMNode: null
		}, d = Symbol.for("react.portal"), f = Symbol.for("react.recoverable"), p = Symbol.for("react.optimistic_key"), m = l.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
		typeof Map == "function" && Map.prototype != null && typeof Map.prototype.forEach == "function" && typeof Set == "function" && Set.prototype != null && typeof Set.prototype.clear == "function" && typeof Set.prototype.forEach == "function" || console.error("React depends on Map and Set built-in types. Make sure that you load a polyfill in older browsers. https://reactjs.org/link/react-polyfills"), e.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = u, e.browser = function(e) {
			return {
				$$typeof: f,
				_reason: e
			};
		}, e.createPortal = function(e, t) {
			var n = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
			if (!t || t.nodeType !== 1 && t.nodeType !== 9 && t.nodeType !== 11) throw Error("Target container is not a DOM element.");
			return i(e, t, null, n);
		}, e.flushSync = function(e) {
			var t = m.T, n = u.p;
			try {
				if (m.T = null, u.p = 2, e) return e();
			} finally {
				m.T = t, u.p = n, u.d.f() && console.error("flushSync was called from inside a lifecycle method. React cannot flush when React is already rendering. Consider moving this call to a scheduler task or micro task.");
			}
		}, e.preconnect = function(e, t) {
			typeof e == "string" && e ? t != null && typeof t != "object" ? console.error("ReactDOM.preconnect(): Expected the `options` argument (second) to be an object but encountered %s instead. The only supported option at this time is `crossOrigin` which accepts a string.", s(t)) : t != null && typeof t.crossOrigin != "string" && console.error("ReactDOM.preconnect(): Expected the `crossOrigin` option (second argument) to be a string but encountered %s instead. Try removing this option or passing a string value instead.", o(t.crossOrigin)) : console.error("ReactDOM.preconnect(): Expected the `href` argument (first) to be a non-empty string but encountered %s instead.", o(e)), typeof e == "string" && (t ? (t = t.crossOrigin, t = typeof t == "string" ? t === "use-credentials" ? t : "" : void 0) : t = null, u.d.C(e, t));
		}, e.prefetchDNS = function(e) {
			if (typeof e != "string" || !e) console.error("ReactDOM.prefetchDNS(): Expected the `href` argument (first) to be a non-empty string but encountered %s instead.", o(e));
			else if (1 < arguments.length) {
				var t = arguments[1];
				typeof t == "object" && t.hasOwnProperty("crossOrigin") ? console.error("ReactDOM.prefetchDNS(): Expected only one argument, `href`, but encountered %s as a second argument instead. This argument is reserved for future options and is currently disallowed. It looks like the you are attempting to set a crossOrigin property for this DNS lookup hint. Browsers do not perform DNS queries using CORS and setting this attribute on the resource hint has no effect. Try calling ReactDOM.prefetchDNS() with just a single string argument, `href`.", s(t)) : console.error("ReactDOM.prefetchDNS(): Expected only one argument, `href`, but encountered %s as a second argument instead. This argument is reserved for future options and is currently disallowed. Try calling ReactDOM.prefetchDNS() with just a single string argument, `href`.", s(t));
			}
			typeof e == "string" && u.d.D(e);
		}, e.preinit = function(e, t) {
			if (typeof e == "string" && e ? typeof t != "object" || !t ? console.error("ReactDOM.preinit(): Expected the `options` argument (second) to be an object with an `as` property describing the type of resource to be preinitialized but encountered %s instead.", s(t)) : t.as !== "style" && t.as !== "script" && console.error("ReactDOM.preinit(): Expected the `as` property in the `options` argument (second) to contain a valid value describing the type of resource to be preinitialized but encountered %s instead. Valid values for `as` are \"style\" and \"script\".", s(t.as)) : console.error("ReactDOM.preinit(): Expected the `href` argument (first) to be a non-empty string but encountered %s instead.", o(e)), typeof e == "string" && t && typeof t.as == "string") {
				var n = t.as, r = a(n, t.crossOrigin), i = typeof t.integrity == "string" ? t.integrity : void 0, c = typeof t.fetchPriority == "string" ? t.fetchPriority : void 0;
				n === "style" ? u.d.S(e, typeof t.precedence == "string" ? t.precedence : void 0, {
					crossOrigin: r,
					integrity: i,
					fetchPriority: c
				}) : n === "script" && u.d.X(e, {
					crossOrigin: r,
					integrity: i,
					fetchPriority: c,
					nonce: typeof t.nonce == "string" ? t.nonce : void 0
				});
			}
		}, e.preinitModule = function(e, t) {
			var n = "";
			if (typeof e == "string" && e || (n += " The `href` argument encountered was " + o(e) + "."), t !== void 0 && typeof t != "object" ? n += " The `options` argument encountered was " + o(t) + "." : t && "as" in t && t.as !== "script" && (n += " The `as` option encountered was " + s(t.as) + "."), n) console.error("ReactDOM.preinitModule(): Expected up to two arguments, a non-empty `href` string and, optionally, an `options` object with a valid `as` property.%s", n);
			else switch (n = t && typeof t.as == "string" ? t.as : "script", n) {
				case "script": break;
				default: n = s(n), console.error("ReactDOM.preinitModule(): Currently the only supported \"as\" type for this function is \"script\" but received \"%s\" instead. This warning was generated for `href` \"%s\". In the future other module types will be supported, aligning with the import-attributes proposal. Learn more here: (https://github.com/tc39/proposal-import-attributes)", n, e);
			}
			typeof e == "string" && (typeof t == "object" && t ? (t.as == null || t.as === "script") && (n = a(t.as, t.crossOrigin), u.d.M(e, {
				crossOrigin: n,
				integrity: typeof t.integrity == "string" ? t.integrity : void 0,
				nonce: typeof t.nonce == "string" ? t.nonce : void 0,
				fetchPriority: typeof t.fetchPriority == "string" ? t.fetchPriority : void 0
			})) : t ?? u.d.M(e));
		}, e.preload = function(e, t) {
			var n = "";
			if (typeof e == "string" && e || (n += " The `href` argument encountered was " + o(e) + "."), typeof t != "object" || !t ? n += " The `options` argument encountered was " + o(t) + "." : typeof t.as == "string" && t.as || (n += " The `as` option encountered was " + o(t.as) + "."), n && console.error("ReactDOM.preload(): Expected two arguments, a non-empty `href` string and an `options` object with an `as` property valid for a `<link rel=\"preload\" as=\"...\" />` tag.%s", n), typeof e == "string" && typeof t == "object" && t && typeof t.as == "string") {
				n = t.as;
				var r = a(n, t.crossOrigin);
				u.d.L(e, n, {
					crossOrigin: r,
					integrity: typeof t.integrity == "string" ? t.integrity : void 0,
					nonce: typeof t.nonce == "string" ? t.nonce : void 0,
					type: typeof t.type == "string" ? t.type : void 0,
					fetchPriority: typeof t.fetchPriority == "string" ? t.fetchPriority : void 0,
					referrerPolicy: typeof t.referrerPolicy == "string" ? t.referrerPolicy : void 0,
					imageSrcSet: typeof t.imageSrcSet == "string" ? t.imageSrcSet : void 0,
					imageSizes: typeof t.imageSizes == "string" ? t.imageSizes : void 0,
					media: typeof t.media == "string" ? t.media : void 0
				});
			}
		}, e.preloadModule = function(e, t) {
			var n = "";
			typeof e == "string" && e || (n += " The `href` argument encountered was " + o(e) + "."), t !== void 0 && typeof t != "object" ? n += " The `options` argument encountered was " + o(t) + "." : t && "as" in t && typeof t.as != "string" && (n += " The `as` option encountered was " + o(t.as) + "."), n && console.error("ReactDOM.preloadModule(): Expected two arguments, a non-empty `href` string and, optionally, an `options` object with an `as` property valid for a `<link rel=\"modulepreload\" as=\"...\" />` tag.%s", n), typeof e == "string" && (t ? (n = a(t.as, t.crossOrigin), u.d.m(e, {
				as: typeof t.as == "string" && t.as !== "script" ? t.as : void 0,
				crossOrigin: n,
				integrity: typeof t.integrity == "string" ? t.integrity : void 0,
				nonce: typeof t.nonce == "string" ? t.nonce : void 0,
				fetchPriority: typeof t.fetchPriority == "string" ? t.fetchPriority : void 0
			})) : u.d.m(e));
		}, e.requestFormReset = function(e) {
			u.d.r(e);
		}, e.unstable_batchedUpdates = function(e, t) {
			return e(t);
		}, e.useFormState = function(e, t, n) {
			return c().useFormState(e, t, n);
		}, e.useFormStatus = function() {
			return c().useHostTransitionStatus();
		}, e.version = "19.3.0", typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop == "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
	})();
})), f = /* @__PURE__ */ a(((e, t) => {
	function n() {
		if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE == "function") {
			if (process.env.NODE_ENV !== "production") throw Error("^_^");
			try {
				__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n);
			} catch (e) {
				console.error(e);
			}
		}
	}
	process.env.NODE_ENV === "production" ? (n(), t.exports = u()) : t.exports = d();
})), p = /* @__PURE__ */ a(((e) => {
	var t = l(), n = r(), i = f();
	function a(e) {
		var t = "https://react.dev/errors/" + e;
		if (1 < arguments.length) {
			t += "?args[]=" + encodeURIComponent(arguments[1]);
			for (var n = 2; n < arguments.length; n++) t += "&args[]=" + encodeURIComponent(arguments[n]);
		}
		return "Minified React error #" + e + "; visit " + t + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
	}
	function o(e) {
		return !(!e || e.nodeType !== 1 && e.nodeType !== 9 && e.nodeType !== 11);
	}
	function s(e) {
		for (var t = e, n = t; n && !n.alternate;) t = n, t.flags & 4098 && (e = t.return), n = t.return;
		for (; t.return;) t = t.return;
		return t.tag === 3 ? e : null;
	}
	function c(e) {
		if (e.tag === 13) {
			var t = e.memoizedState;
			if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null) return t.dehydrated;
		}
		return null;
	}
	function u(e) {
		if (e.tag === 31) {
			var t = e.memoizedState;
			if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null) return t.dehydrated;
		}
		return null;
	}
	function d(e) {
		if (s(e) !== e) throw Error(a(188));
	}
	function p(e) {
		var t = e.alternate;
		if (!t) {
			if (t = s(e), t === null) throw Error(a(188));
			return t === e ? e : null;
		}
		for (var n = e, r = t;;) {
			var i = n.return;
			if (i === null) break;
			var o = i.alternate;
			if (o === null) {
				if (r = i.return, r !== null) {
					n = r;
					continue;
				}
				break;
			}
			if (i.child === o.child) {
				for (o = i.child; o;) {
					if (o === n) return d(i), e;
					if (o === r) return d(i), t;
					o = o.sibling;
				}
				throw Error(a(188));
			}
			if (n.return !== r.return) n = i, r = o;
			else {
				for (var c = !1, l = i.child; l;) {
					if (l === n) {
						c = !0, n = i, r = o;
						break;
					}
					if (l === r) {
						c = !0, r = i, n = o;
						break;
					}
					l = l.sibling;
				}
				if (!c) {
					for (l = o.child; l;) {
						if (l === n) {
							c = !0, n = o, r = i;
							break;
						}
						if (l === r) {
							c = !0, r = o, n = i;
							break;
						}
						l = l.sibling;
					}
					if (!c) throw Error(a(189));
				}
			}
			if (n.alternate !== r) throw Error(a(190));
		}
		if (n.tag !== 3) throw Error(a(188));
		return n.stateNode.current === n ? e : t;
	}
	function m(e) {
		var t = e.tag;
		if (t === 5 || t === 26 || t === 27 || t === 6) return e;
		for (e = e.child; e !== null;) {
			if (t = m(e), t !== null) return t;
			e = e.sibling;
		}
		return null;
	}
	function h(e, t, n, r, i, a) {
		for (; e !== null;) {
			if ((e.tag === 5 || e.tag === 27 || e.tag === 6) && n(e, r, i, a) || (e.tag !== 22 || e.memoizedState === null) && (t || e.tag !== 5 && e.tag !== 27) && h(e.child, t, n, r, i, a)) return !0;
			e = e.sibling;
		}
		return !1;
	}
	function g(e) {
		for (e = e.return; e !== null;) {
			if (e.tag === 3 || e.tag === 5 || e.tag === 27) return e;
			e = e.return;
		}
		return null;
	}
	function _(e) {
		var t = !1;
		for (e = e.return; e !== null && (e.tag === 4 && (t = !0), e.tag !== 3 && e.tag !== 5 && e.tag !== 27);) e = e.return;
		return t;
	}
	function v(e) {
		var t = [null, null], n = g(e);
		return n === null || y(t, e, n.child, { foundSelf: !1 }), t;
	}
	function y(e, t, n, r) {
		for (; n !== null;) {
			if (n === t) r.foundSelf = !0;
			else if (n.tag === 5 || n.tag === 27 || n.tag === 6) {
				if (r.foundSelf) return e[1] = n, !0;
				e[0] = n;
			} else if ((n.tag !== 22 || n.memoizedState === null) && y(e, t, n.child, r)) return !0;
			n = n.sibling;
		}
		return !1;
	}
	function b(e) {
		switch (e.tag) {
			case 5:
			case 27:
			case 6: return e.stateNode;
			case 3: return e.stateNode.containerInfo;
			default: throw Error(a(559));
		}
	}
	var ee = null, te = null;
	function ne(e, t, n) {
		return e === n || e === t && (ee = e, !0);
	}
	function re(e, t, n) {
		return e === n ? (te = e, !1) : e === t && (te !== null && (ee = e), !0);
	}
	function ie(e) {
		if (e === null) return null;
		do
			e = e === null ? null : e.return;
		while (e && e.tag !== 5 && e.tag !== 27 && e.tag !== 3);
		return e || null;
	}
	function ae(e, t, n) {
		for (var r = 0, i = e; i; i = n(i)) r++;
		i = 0;
		for (var a = t; a; a = n(a)) i++;
		for (; 0 < r - i;) e = n(e), r--;
		for (; 0 < i - r;) t = n(t), i--;
		for (; r--;) {
			if (e === t || t !== null && e === t.alternate) return e;
			e = n(e), t = n(t);
		}
		return null;
	}
	var x = Object.assign, oe = Symbol.for("react.element"), S = Symbol.for("react.transitional.element"), se = Symbol.for("react.portal"), ce = Symbol.for("react.fragment"), le = Symbol.for("react.strict_mode"), ue = Symbol.for("react.profiler"), de = Symbol.for("react.consumer"), fe = Symbol.for("react.context"), pe = Symbol.for("react.forward_ref"), me = Symbol.for("react.suspense"), he = Symbol.for("react.suspense_list"), ge = Symbol.for("react.memo"), _e = Symbol.for("react.lazy"), C = Symbol.for("react.activity"), ve = Symbol.for("react.legacy_hidden"), ye = Symbol.for("react.memo_cache_sentinel"), be = Symbol.for("react.view_transition"), xe = Symbol.for("react.recoverable"), Se = Symbol.iterator;
	function Ce(e) {
		return typeof e != "object" || !e ? null : (e = Se && e[Se] || e["@@iterator"], typeof e == "function" ? e : null);
	}
	var we = Symbol.for("react.client.reference");
	function Te(e) {
		if (e == null) return null;
		if (typeof e == "function") return e.$$typeof === we ? null : e.displayName || e.name || null;
		if (typeof e == "string") return e;
		switch (e) {
			case ce: return "Fragment";
			case ue: return "Profiler";
			case le: return "StrictMode";
			case me: return "Suspense";
			case he: return "SuspenseList";
			case C: return "Activity";
			case be: return "ViewTransition";
		}
		if (typeof e == "object") switch (e.$$typeof) {
			case se: return "Portal";
			case fe: return e.displayName || "Context";
			case de: return (e._context.displayName || "Context") + ".Consumer";
			case pe:
				var t = e.render;
				return e = e.displayName, e ||= (e = t.displayName || t.name || "", e === "" ? "ForwardRef" : "ForwardRef(" + e + ")"), e;
			case ge: return t = e.displayName || null, t === null ? Te(e.type) || "Memo" : t;
			case _e:
				t = e._payload, e = e._init;
				try {
					return Te(e(t));
				} catch {}
		}
		return null;
	}
	var Ee = Array.isArray, w = n.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, De = i.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Oe = {
		pending: !1,
		data: null,
		method: null,
		action: null
	}, ke = [], Ae = -1;
	function je(e) {
		return { current: e };
	}
	function Me(e) {
		0 > Ae || (e.current = ke[Ae], ke[Ae] = null, Ae--);
	}
	function Ne(e, t) {
		Ae++, ke[Ae] = e.current, e.current = t;
	}
	var Pe = je(null), Fe = je(null), Ie = je(null), T = je(null);
	function Le(e, t) {
		switch (Ne(Ie, t), Ne(Fe, e), Ne(Pe, null), t.nodeType) {
			case 9:
			case 11:
				e = (e = t.documentElement) && (e = e.namespaceURI) ? Ep(e) : 0;
				break;
			default: if (e = t.tagName, t = t.namespaceURI) t = Ep(t), e = Dp(t, e);
			else switch (e) {
				case "svg":
					e = 1;
					break;
				case "math":
					e = 2;
					break;
				default: e = 0;
			}
		}
		Me(Pe), Ne(Pe, e);
	}
	function Re() {
		Me(Pe), Me(Fe), Me(Ie);
	}
	function ze(e) {
		var t = e.memoizedState;
		t !== null && (bh._currentValue = t.memoizedState, Ne(T, e)), t = Pe.current;
		var n = Dp(t, e.type);
		t !== n && (Ne(Fe, e), Ne(Pe, n));
	}
	function Be(e) {
		Fe.current === e && (Me(Pe), Me(Fe)), T.current === e && (Me(T), bh._currentValue = Oe);
	}
	var Ve, He;
	function Ue(e) {
		if (Ve === void 0) try {
			throw Error();
		} catch (e) {
			var t = e.stack.trim().match(/\n( *(at )?)/);
			Ve = t && t[1] || "", He = -1 < e.stack.indexOf("\n    at") ? " (<anonymous>)" : -1 < e.stack.indexOf("@") ? "@unknown:0:0" : "";
		}
		return "\n" + Ve + e + He;
	}
	var We = !1;
	function Ge(e, t) {
		if (!e || We) return "";
		We = !0;
		var n = Error.prepareStackTrace;
		Error.prepareStackTrace = void 0;
		try {
			var r = { DetermineComponentFrameRoot: function() {
				try {
					if (t) {
						var n = function() {
							throw Error();
						};
						if (Object.defineProperty(n.prototype, "props", { set: function() {
							throw Error();
						} }), typeof Reflect == "object" && Reflect.construct) {
							try {
								Reflect.construct(n, []);
							} catch (e) {
								var r = e;
							}
							Reflect.construct(e, [], n);
						} else {
							try {
								n.call();
							} catch (e) {
								r = e;
							}
							n = !1;
							try {
								var i = Object.getOwnPropertyDescriptor(e.prototype, "props");
								Object.defineProperty(e.prototype, "props", {
									configurable: !0,
									set: function() {
										throw Error();
									}
								}), n = !0, new e();
							} finally {
								n && (i === void 0 ? delete e.prototype.props : Object.defineProperty(e.prototype, "props", i));
							}
						}
					} else {
						try {
							throw Error();
						} catch (e) {
							r = e;
						}
						(n = e()) && typeof n.catch == "function" && n.catch(function() {});
					}
				} catch (e) {
					if (e && r && typeof e.stack == "string") return [e.stack, r.stack];
				}
				return [null, null];
			} };
			r.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
			var i = Object.getOwnPropertyDescriptor(r.DetermineComponentFrameRoot, "name");
			i && i.configurable && Object.defineProperty(r.DetermineComponentFrameRoot, "name", { value: "DetermineComponentFrameRoot" });
			var a = r.DetermineComponentFrameRoot(), o = a[0], s = a[1];
			if (o && s) {
				var c = o.split("\n"), l = s.split("\n");
				for (i = r = 0; r < c.length && !c[r].includes("DetermineComponentFrameRoot");) r++;
				for (; i < l.length && !l[i].includes("DetermineComponentFrameRoot");) i++;
				if (r === c.length || i === l.length) for (r = c.length - 1, i = l.length - 1; 1 <= r && 0 <= i && c[r] !== l[i];) i--;
				for (; 1 <= r && 0 <= i; r--, i--) if (c[r] !== l[i]) {
					if (r !== 1 || i !== 1) do
						if (r--, i--, 0 > i || c[r] !== l[i]) {
							var u = "\n" + c[r].replace(" at new ", " at ");
							return e.displayName && u.includes("<anonymous>") && (u = u.replace("<anonymous>", e.displayName)), u;
						}
					while (1 <= r && 0 <= i);
					break;
				}
			}
		} finally {
			We = !1, Error.prepareStackTrace = n;
		}
		return (n = e ? e.displayName || e.name : "") ? Ue(n) : "";
	}
	function Ke(e, t) {
		switch (e.tag) {
			case 26:
			case 27:
			case 5: return Ue(e.type);
			case 16: return Ue("Lazy");
			case 13: return e.child !== t && t !== null ? Ue("Suspense Fallback") : Ue("Suspense");
			case 19: return Ue("SuspenseList");
			case 0:
			case 15: return Ge(e.type, !1);
			case 11: return Ge(e.type.render, !1);
			case 1: return Ge(e.type, !0);
			case 31: return Ue("Activity");
			case 30: return Ue("ViewTransition");
			default: return "";
		}
	}
	function qe(e) {
		try {
			var t = "", n = null;
			do
				t += Ke(e, n), n = e, e = e.return;
			while (e);
			return t;
		} catch (e) {
			return "\nError generating stack: " + e.message + "\n" + e.stack;
		}
	}
	var Je = Object.prototype.hasOwnProperty, Ye = t.unstable_scheduleCallback, Xe = t.unstable_cancelCallback, Ze = t.unstable_shouldYield, Qe = t.unstable_requestPaint, $e = t.unstable_now, et = t.unstable_getCurrentPriorityLevel, tt = t.unstable_ImmediatePriority, nt = t.unstable_UserBlockingPriority, rt = t.unstable_NormalPriority, it = t.unstable_LowPriority, at = t.unstable_IdlePriority, ot = t.log, st = t.unstable_setDisableYieldValue, ct = null, lt = null;
	function ut(e) {
		if (typeof ot == "function" && st(e), lt && typeof lt.setStrictMode == "function") try {
			lt.setStrictMode(ct, e);
		} catch {}
	}
	var dt = Math.clz32 ? Math.clz32 : mt, ft = Math.log, pt = Math.LN2;
	function mt(e) {
		return e >>>= 0, e === 0 ? 32 : 31 - (ft(e) / pt | 0) | 0;
	}
	var ht = 256, gt = 262144, _t = 4194304;
	function vt(e) {
		var t = e & 42;
		if (t !== 0) return t;
		switch (e & -e) {
			case 1: return 1;
			case 2: return 2;
			case 4: return 4;
			case 8: return 8;
			case 16: return 16;
			case 32: return 32;
			case 64: return 64;
			case 128: return 128;
			case 256:
			case 512:
			case 1024:
			case 2048:
			case 4096:
			case 8192:
			case 16384:
			case 32768:
			case 65536:
			case 131072: return e & -e;
			case 262144:
			case 524288:
			case 1048576:
			case 2097152: return e & 3932160;
			case 4194304:
			case 8388608:
			case 16777216:
			case 33554432: return e & 62914560;
			case 67108864: return 67108864;
			case 134217728: return 134217728;
			case 268435456: return 268435456;
			case 536870912: return 536870912;
			case 1073741824: return 0;
			default: return e;
		}
	}
	function yt(e, t, n) {
		var r = e.pendingLanes;
		if (r === 0) return 0;
		var i = 0, a = e.suspendedLanes, o = e.pingedLanes;
		e = e.warmLanes;
		var s = r & 134217727;
		return s === 0 ? (s = r & ~a, s === 0 ? o === 0 ? n || (n = r & ~e, n !== 0 && (i = vt(n))) : i = vt(o) : i = vt(s)) : (r = s & ~a, r === 0 ? (o &= s, o === 0 ? n || (n = s & ~e, n !== 0 && (i = vt(n))) : i = vt(o)) : i = vt(r)), i === 0 ? 0 : t !== 0 && t !== i && (t & a) === 0 && (a = i & -i, n = t & -t, a >= n || a === 32 && n & 4194048) ? t : i;
	}
	function bt(e, t) {
		return (e.pendingLanes & ~(e.suspendedLanes & ~e.pingedLanes) & t) === 0;
	}
	function xt(e, t) {
		t & 8 && (t |= t & 32);
		var n = e.entangledLanes;
		if (n !== 0) for (e = e.entanglements, n &= t; 0 < n;) {
			var r = 31 - dt(n), i = 1 << r;
			t |= e[r], n &= ~i;
		}
		return t;
	}
	function St(e, t) {
		switch (e) {
			case 1:
			case 2:
			case 4:
			case 8:
			case 64: return t + 250;
			case 16:
			case 32:
			case 128:
			case 256:
			case 512:
			case 1024:
			case 2048:
			case 4096:
			case 8192:
			case 16384:
			case 32768:
			case 65536:
			case 131072:
			case 262144:
			case 524288:
			case 1048576:
			case 2097152: return t + 5e3;
			case 4194304:
			case 8388608:
			case 16777216:
			case 33554432: return -1;
			case 67108864:
			case 134217728:
			case 268435456:
			case 536870912:
			case 1073741824: return -1;
			default: return -1;
		}
	}
	function Ct() {
		var e = _t;
		return _t <<= 1, !(_t & 62914560) && (_t = 4194304), e;
	}
	function wt(e) {
		for (var t = [], n = 0; 31 > n; n++) t.push(e);
		return t;
	}
	function Tt(e, t) {
		e.pendingLanes |= t, t !== 268435456 && (e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0);
	}
	function Et(e, t, n, r, i, a) {
		var o = e.pendingLanes;
		e.pendingLanes = n, e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0, e.expiredLanes &= n, e.entangledLanes &= n, e.errorRecoveryDisabledLanes &= n, e.shellSuspendCounter = 0;
		var s = e.entanglements, c = e.expirationTimes, l = e.hiddenUpdates;
		for (n = o & ~n; 0 < n;) {
			var u = 31 - dt(n), d = 1 << u;
			s[u] = 0, c[u] = -1;
			var f = l[u];
			if (f !== null) for (l[u] = null, u = 0; u < f.length; u++) {
				var p = f[u];
				p !== null && (p.lane &= -536870913);
			}
			n &= ~d;
		}
		r !== 0 && Dt(e, r, 0), a !== 0 && i === 0 && e.tag !== 0 && (e.suspendedLanes |= a & ~(o & ~t));
	}
	function Dt(e, t, n) {
		e.pendingLanes |= t, e.suspendedLanes &= ~t;
		var r = 31 - dt(t);
		e.entangledLanes |= t, e.entanglements[r] = e.entanglements[r] | 1073741824 | n & 261930;
	}
	function Ot(e, t) {
		var n = e.entangledLanes |= t;
		for (e = e.entanglements; n;) {
			var r = 31 - dt(n), i = 1 << r;
			i & t | e[r] & t && (e[r] |= t), n &= ~i;
		}
	}
	function kt(e, t) {
		var n = t & -t;
		return n = n & 42 ? 1 : At(n), (n & (e.suspendedLanes | t)) === 0 ? n : 0;
	}
	function At(e) {
		switch (e) {
			case 2:
				e = 1;
				break;
			case 8:
				e = 4;
				break;
			case 32:
				e = 16;
				break;
			case 256:
			case 512:
			case 1024:
			case 2048:
			case 4096:
			case 8192:
			case 16384:
			case 32768:
			case 65536:
			case 131072:
			case 262144:
			case 524288:
			case 1048576:
			case 2097152:
			case 4194304:
			case 8388608:
			case 16777216:
			case 33554432:
				e = 128;
				break;
			case 268435456:
				e = 134217728;
				break;
			default: e = 0;
		}
		return e;
	}
	function jt(e) {
		return e &= -e, 2 < e ? 8 < e ? e & 134217727 ? 32 : 268435456 : 8 : 2;
	}
	function Mt() {
		var e = De.p;
		return e === 0 ? (e = window.event, e === void 0 ? 32 : Ih(e.type)) : e;
	}
	function Nt(e, t) {
		var n = De.p;
		try {
			return De.p = e, t();
		} finally {
			De.p = n;
		}
	}
	var Pt = Math.random().toString(36).slice(2), Ft = "__reactFiber$" + Pt, It = "__reactProps$" + Pt, Lt = "__reactContainer$" + Pt, Rt = "__reactEvents$" + Pt, zt = "__reactListeners$" + Pt, Bt = "__reactHandles$" + Pt, Vt = "__reactResources$" + Pt, Ht = "__reactMarker$" + Pt, Ut = "__reactLoad$" + Pt;
	function Wt(e) {
		delete e[Ft], delete e[It], delete e[zt], delete e[Bt];
	}
	function Gt(e) {
		var t;
		if (t = e[Ft]) return t;
		for (var n = e.parentNode; n;) {
			if (t = n[Lt] || n[Ft]) {
				if (n = t.alternate, t.child !== null || n !== null && n.child !== null) for (e = Dm(e); e !== null;) {
					if (n = e[Ft]) return n;
					e = Dm(e);
				}
				return t;
			}
			e = n, n = e.parentNode;
		}
		return null;
	}
	function Kt(e) {
		if (e = e[Ft] || e[Lt]) {
			var t = e.tag;
			if (t === 5 || t === 6 || t === 13 || t === 31 || t === 26 || t === 27 || t === 3) return e;
		}
		return null;
	}
	function qt(e) {
		var t = e.tag;
		if (t === 5 || t === 26 || t === 27 || t === 6) return e.stateNode;
		throw Error(a(33));
	}
	function Jt(e) {
		var t = e[Vt];
		return t ||= e[Vt] = {
			hoistableStyles: /* @__PURE__ */ new Map(),
			hoistableScripts: /* @__PURE__ */ new Map()
		}, t;
	}
	function Yt(e) {
		e[Ht] = !0;
	}
	function Xt(e) {
		e[Ut] = void 0;
	}
	var Zt = /* @__PURE__ */ new Set(), Qt = {};
	function $t(e, t) {
		en(e, t), en(e + "Capture", t);
	}
	function en(e, t) {
		for (Qt[e] = t, e = 0; e < t.length; e++) Zt.add(t[e]);
	}
	var tn = RegExp("^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"), nn = {}, rn = {};
	function an(e) {
		return Je.call(rn, e) ? !0 : Je.call(nn, e) ? !1 : tn.test(e) ? rn[e] = !0 : (nn[e] = !0, !1);
	}
	var E = !1;
	function on() {
		var e = E;
		return E = !1, e;
	}
	function sn(e, t, n) {
		if (an(t)) {
			if (n === null) e.removeAttribute(t);
			else {
				switch (typeof n) {
					case "undefined":
					case "function":
					case "symbol":
						e.removeAttribute(t);
						return;
					case "boolean":
						var r = t.toLowerCase().slice(0, 5);
						if (r !== "data-" && r !== "aria-") {
							e.removeAttribute(t);
							return;
						}
				}
				e.setAttribute(t, n);
			}
		}
	}
	function cn(e, t, n) {
		if (n === null) e.removeAttribute(t);
		else {
			switch (typeof n) {
				case "undefined":
				case "function":
				case "symbol":
				case "boolean":
					e.removeAttribute(t);
					return;
			}
			e.setAttribute(t, n);
		}
	}
	function ln(e, t, n, r) {
		if (r === null) e.removeAttribute(n);
		else {
			switch (typeof r) {
				case "undefined":
				case "function":
				case "symbol":
				case "boolean":
					e.removeAttribute(n);
					return;
			}
			e.setAttributeNS(t, n, r);
		}
	}
	function un(e) {
		switch (typeof e) {
			case "bigint":
			case "boolean":
			case "number":
			case "string":
			case "undefined": return e;
			case "object": return e;
			default: return "";
		}
	}
	function dn(e) {
		var t = e.type;
		return (e = e.nodeName) && e.toLowerCase() === "input" && (t === "checkbox" || t === "radio");
	}
	function fn(e, t, n) {
		var r = Object.getOwnPropertyDescriptor(e.constructor.prototype, t);
		if (!e.hasOwnProperty(t) && r !== void 0 && typeof r.get == "function" && typeof r.set == "function") {
			var i = r.get, a = r.set;
			return Object.defineProperty(e, t, {
				configurable: !0,
				get: function() {
					return i.call(this);
				},
				set: function(e) {
					n = "" + e, a.call(this, e);
				}
			}), Object.defineProperty(e, t, { enumerable: r.enumerable }), {
				getValue: function() {
					return n;
				},
				setValue: function(e) {
					n = "" + e;
				},
				stopTracking: function() {
					e._valueTracker = null, delete e[t];
				}
			};
		}
	}
	function pn(e) {
		if (!e._valueTracker) {
			var t = dn(e) ? "checked" : "value";
			e._valueTracker = fn(e, t, "" + e[t]);
		}
	}
	function mn(e) {
		if (!e) return !1;
		var t = e._valueTracker;
		if (!t) return !0;
		var n = t.getValue(), r = "";
		return e && (r = dn(e) ? e.checked ? "true" : "false" : e.value), e = r, e !== n && (t.setValue(e), !0);
	}
	var hn = /[\n"\\]/g;
	function gn(e) {
		return e.replace(hn, function(e) {
			return "\\" + e.charCodeAt(0).toString(16) + " ";
		});
	}
	function _n(e, t, n, r, i, a, o, s) {
		e.name = "", o != null && typeof o != "function" && typeof o != "symbol" && typeof o != "boolean" ? e.type = o : e.removeAttribute("type"), t == null ? o !== "submit" && o !== "reset" || e.removeAttribute("value") : o === "number" ? (t === 0 && e.value === "" || e.value != t) && (e.value = "" + un(t)) : e.value !== "" + un(t) && (e.value = "" + un(t)), t == null ? n == null ? r != null && e.removeAttribute("value") : yn(e, un(n)) : o === "number" && e.value == t ? yn(e, un(e.value)) : yn(e, un(t)), i == null && a != null && (e.defaultChecked = !!a), i != null && (e.checked = i && typeof i != "function" && typeof i != "symbol"), s != null && typeof s != "function" && typeof s != "symbol" && typeof s != "boolean" ? e.name = "" + un(s) : e.removeAttribute("name");
	}
	function vn(e, t, n, r, i, a, o, s) {
		if (a != null && typeof a != "function" && typeof a != "symbol" && typeof a != "boolean" && (e.type = a), t != null || n != null) {
			if (!(a !== "submit" && a !== "reset" || t != null)) {
				pn(e);
				return;
			}
			n = n == null ? "" : "" + un(n), t = t == null ? n : "" + un(t), s || t === e.value || (e.value = t), e.defaultValue = t;
		}
		r ??= i, r = typeof r != "function" && typeof r != "symbol" && !!r, e.checked = s ? e.checked : !!r, e.defaultChecked = !!r, o != null && typeof o != "function" && typeof o != "symbol" && typeof o != "boolean" && (e.name = o), pn(e);
	}
	function yn(e, t) {
		e.defaultValue !== "" + t && (e.defaultValue = "" + t);
	}
	function bn(e, t, n, r) {
		if (e = e.options, t) {
			t = {};
			for (var i = 0; i < n.length; i++) t["$" + n[i]] = !0;
			for (n = 0; n < e.length; n++) i = t.hasOwnProperty("$" + e[n].value), e[n].selected !== i && (e[n].selected = i), i && r && (e[n].defaultSelected = !0);
		} else {
			for (n = "" + un(n), t = null, i = 0; i < e.length; i++) {
				if (e[i].value === n) {
					e[i].selected = !0, r && (e[i].defaultSelected = !0);
					return;
				}
				t !== null || e[i].disabled || (t = e[i]);
			}
			t !== null && (t.selected = !0);
		}
	}
	function xn(e, t, n) {
		if (t != null && (t = "" + un(t), t !== e.value && (e.value = t), n == null)) {
			e.defaultValue !== t && (e.defaultValue = t);
			return;
		}
		e.defaultValue = n == null ? "" : "" + un(n);
	}
	function Sn(e, t, n, r) {
		if (t == null) {
			if (r != null) {
				if (n != null) throw Error(a(92));
				if (Ee(r)) {
					if (1 < r.length) throw Error(a(93));
					r = r[0];
				}
				n = r;
			}
			n ??= "", t = n;
		}
		n = un(t), e.defaultValue = n, r = e.textContent, r === n && r !== "" && r !== null && (e.value = r), pn(e);
	}
	function Cn(e, t) {
		if (t) {
			var n = e.firstChild;
			if (n && n === e.lastChild && n.nodeType === 3) {
				n.nodeValue = t;
				return;
			}
		}
		e.textContent = t;
	}
	var wn = new Set("animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(" "));
	function Tn(e, t, n) {
		var r = t.indexOf("--") === 0;
		n == null || typeof n == "boolean" || n === "" ? r ? e.setProperty(t, "") : t === "float" ? e.cssFloat = "" : e[t] = "" : r ? e.setProperty(t, n) : typeof n != "number" || n === 0 || wn.has(t) ? t === "float" ? e.cssFloat = n : e[t] = ("" + n).trim() : e[t] = n + "px";
	}
	function En(e, t, n) {
		if (t != null && typeof t != "object") throw Error(a(62));
		if (e = e.style, n != null) {
			for (var r in n) !n.hasOwnProperty(r) || t != null && t.hasOwnProperty(r) || (r.indexOf("--") === 0 ? e.setProperty(r, "") : r === "float" ? e.cssFloat = "" : e[r] = "", E = !0);
			for (var i in t) r = t[i], t.hasOwnProperty(i) && n[i] !== r && (Tn(e, i, r), E = !0);
		} else for (var o in t) t.hasOwnProperty(o) && Tn(e, o, t[o]);
	}
	function Dn(e) {
		if (e.indexOf("-") === -1) return !1;
		switch (e) {
			case "annotation-xml":
			case "color-profile":
			case "font-face":
			case "font-face-src":
			case "font-face-uri":
			case "font-face-format":
			case "font-face-name":
			case "missing-glyph": return !1;
			default: return !0;
		}
	}
	var On = /* @__PURE__ */ new Map([
		["acceptCharset", "accept-charset"],
		["htmlFor", "for"],
		["httpEquiv", "http-equiv"],
		["crossOrigin", "crossorigin"],
		["accentHeight", "accent-height"],
		["alignmentBaseline", "alignment-baseline"],
		["arabicForm", "arabic-form"],
		["baselineShift", "baseline-shift"],
		["capHeight", "cap-height"],
		["clipPath", "clip-path"],
		["clipRule", "clip-rule"],
		["colorInterpolation", "color-interpolation"],
		["colorInterpolationFilters", "color-interpolation-filters"],
		["colorProfile", "color-profile"],
		["colorRendering", "color-rendering"],
		["dominantBaseline", "dominant-baseline"],
		["enableBackground", "enable-background"],
		["fillOpacity", "fill-opacity"],
		["fillRule", "fill-rule"],
		["floodColor", "flood-color"],
		["floodOpacity", "flood-opacity"],
		["fontFamily", "font-family"],
		["fontSize", "font-size"],
		["fontSizeAdjust", "font-size-adjust"],
		["fontStretch", "font-stretch"],
		["fontStyle", "font-style"],
		["fontVariant", "font-variant"],
		["fontWeight", "font-weight"],
		["glyphName", "glyph-name"],
		["glyphOrientationHorizontal", "glyph-orientation-horizontal"],
		["glyphOrientationVertical", "glyph-orientation-vertical"],
		["horizAdvX", "horiz-adv-x"],
		["horizOriginX", "horiz-origin-x"],
		["imageRendering", "image-rendering"],
		["letterSpacing", "letter-spacing"],
		["lightingColor", "lighting-color"],
		["markerEnd", "marker-end"],
		["markerMid", "marker-mid"],
		["markerStart", "marker-start"],
		["maskType", "mask-type"],
		["overlinePosition", "overline-position"],
		["overlineThickness", "overline-thickness"],
		["paintOrder", "paint-order"],
		["panose-1", "panose-1"],
		["pointerEvents", "pointer-events"],
		["renderingIntent", "rendering-intent"],
		["shapeRendering", "shape-rendering"],
		["stopColor", "stop-color"],
		["stopOpacity", "stop-opacity"],
		["strikethroughPosition", "strikethrough-position"],
		["strikethroughThickness", "strikethrough-thickness"],
		["strokeDasharray", "stroke-dasharray"],
		["strokeDashoffset", "stroke-dashoffset"],
		["strokeLinecap", "stroke-linecap"],
		["strokeLinejoin", "stroke-linejoin"],
		["strokeMiterlimit", "stroke-miterlimit"],
		["strokeOpacity", "stroke-opacity"],
		["strokeWidth", "stroke-width"],
		["textAnchor", "text-anchor"],
		["textDecoration", "text-decoration"],
		["textRendering", "text-rendering"],
		["transformOrigin", "transform-origin"],
		["underlinePosition", "underline-position"],
		["underlineThickness", "underline-thickness"],
		["unicodeBidi", "unicode-bidi"],
		["unicodeRange", "unicode-range"],
		["unitsPerEm", "units-per-em"],
		["vAlphabetic", "v-alphabetic"],
		["vHanging", "v-hanging"],
		["vIdeographic", "v-ideographic"],
		["vMathematical", "v-mathematical"],
		["vectorEffect", "vector-effect"],
		["vertAdvY", "vert-adv-y"],
		["vertOriginX", "vert-origin-x"],
		["vertOriginY", "vert-origin-y"],
		["wordSpacing", "word-spacing"],
		["writingMode", "writing-mode"],
		["xmlnsXlink", "xmlns:xlink"],
		["xHeight", "x-height"]
	]), kn = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
	function An(e) {
		return kn.test("" + e) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : e;
	}
	function jn() {}
	var Mn = null;
	function Nn(e) {
		return e = e.target || e.srcElement || window, e.correspondingUseElement && (e = e.correspondingUseElement), e.nodeType === 3 ? e.parentNode : e;
	}
	var Pn = null, Fn = null;
	function In(e) {
		var t = Kt(e);
		if (t && (e = t.stateNode)) {
			var n = e[It] || null;
			a: switch (e = t.stateNode, t.type) {
				case "input":
					if (_n(e, n.value, n.defaultValue, n.defaultValue, n.checked, n.defaultChecked, n.type, n.name), t = n.name, n.type === "radio" && t != null) {
						for (n = e; n.parentNode;) n = n.parentNode;
						for (n = n.querySelectorAll("input[name=\"" + gn("" + t) + "\"][type=\"radio\"]"), t = 0; t < n.length; t++) {
							var r = n[t];
							if (r !== e && r.form === e.form) {
								var i = r[It] || null;
								if (!i) throw Error(a(90));
								_n(r, i.value, i.defaultValue, i.defaultValue, i.checked, i.defaultChecked, i.type, i.name);
							}
						}
						for (t = 0; t < n.length; t++) r = n[t], r.form === e.form && mn(r);
					}
					break a;
				case "textarea":
					xn(e, n.value, n.defaultValue);
					break a;
				case "select": t = n.value, t != null && bn(e, !!n.multiple, t, !1);
			}
		}
	}
	var Ln = !1;
	function Rn(e, t, n) {
		if (Ln) return e(t, n);
		Ln = !0;
		try {
			return e(t);
		} finally {
			if (Ln = !1, (Pn !== null || Fn !== null) && ($d(), Pn && (t = Pn, e = Fn, Fn = Pn = null, In(t), e))) for (t = 0; t < e.length; t++) In(e[t]);
		}
	}
	function zn(e, t) {
		var n = e.stateNode;
		if (n === null) return null;
		var r = n[It] || null;
		if (r === null) return null;
		n = r[t];
		a: switch (t) {
			case "onClick":
			case "onClickCapture":
			case "onDoubleClick":
			case "onDoubleClickCapture":
			case "onMouseDown":
			case "onMouseDownCapture":
			case "onMouseMove":
			case "onMouseMoveCapture":
			case "onMouseUp":
			case "onMouseUpCapture":
			case "onMouseEnter":
				(r = !r.disabled) || (e = e.type, r = e !== "button" && e !== "input" && e !== "select" && e !== "textarea"), e = !r;
				break a;
			default: e = !1;
		}
		if (e) return null;
		if (n && typeof n != "function") throw Error(a(231, t, typeof n));
		return n;
	}
	var Bn = typeof window < "u" && window.document !== void 0 && window.document.createElement !== void 0, Vn = !1;
	if (Bn) try {
		var Hn = {};
		Object.defineProperty(Hn, "passive", { get: function() {
			Vn = !0;
		} }), window.addEventListener("test", Hn, Hn), window.removeEventListener("test", Hn, Hn);
	} catch {
		Vn = !1;
	}
	var Un = null, Wn = null, Gn = null;
	function Kn() {
		if (Gn) return Gn;
		var e, t = Wn, n = t.length, r, i = "value" in Un ? Un.value : Un.textContent, a = i.length;
		for (e = 0; e < n && t[e] === i[e]; e++);
		var o = n - e;
		for (r = 1; r <= o && t[n - r] === i[a - r]; r++);
		return Gn = i.slice(e, 1 < r ? 1 - r : void 0);
	}
	function qn(e) {
		var t = e.keyCode;
		return "charCode" in e ? (e = e.charCode, e === 0 && t === 13 && (e = 13)) : e = t, e === 10 && (e = 13), 32 <= e || e === 13 ? e : 0;
	}
	function Jn() {
		return !0;
	}
	function Yn() {
		return !1;
	}
	function Xn(e) {
		function t(t, n, r, i, a) {
			for (var o in this._reactName = t, this._targetInst = r, this.type = n, this.nativeEvent = i, this.target = a, this.currentTarget = null, e) e.hasOwnProperty(o) && (t = e[o], this[o] = t ? t(i) : i[o]);
			return this.isDefaultPrevented = (i.defaultPrevented == null ? !1 === i.returnValue : i.defaultPrevented) ? Jn : Yn, this.isPropagationStopped = Yn, this;
		}
		return x(t.prototype, {
			preventDefault: function() {
				this.defaultPrevented = !0;
				var e = this.nativeEvent;
				e && (e.preventDefault ? e.preventDefault() : typeof e.returnValue != "unknown" && (e.returnValue = !1), this.isDefaultPrevented = Jn);
			},
			stopPropagation: function() {
				var e = this.nativeEvent;
				e && (e.stopPropagation ? e.stopPropagation() : typeof e.cancelBubble != "unknown" && (e.cancelBubble = !0), this.isPropagationStopped = Jn);
			},
			persist: function() {},
			isPersistent: Jn
		}), t;
	}
	var Zn = {
		eventPhase: 0,
		bubbles: 0,
		cancelable: 0,
		timeStamp: function(e) {
			return e.timeStamp || Date.now();
		},
		defaultPrevented: 0,
		isTrusted: 0
	}, Qn = Xn(Zn), $n = x({}, Zn, {
		view: 0,
		detail: 0
	}), er = Xn($n), tr, nr, rr, ir = x({}, $n, {
		screenX: 0,
		screenY: 0,
		clientX: 0,
		clientY: 0,
		pageX: 0,
		pageY: 0,
		ctrlKey: 0,
		shiftKey: 0,
		altKey: 0,
		metaKey: 0,
		getModifierState: hr,
		button: 0,
		buttons: 0,
		relatedTarget: function(e) {
			return e.relatedTarget === void 0 ? e.fromElement === e.srcElement ? e.toElement : e.fromElement : e.relatedTarget;
		},
		movementX: function(e) {
			return "movementX" in e ? e.movementX : (e !== rr && (rr && e.type === "mousemove" ? (tr = e.screenX - rr.screenX, nr = e.screenY - rr.screenY) : nr = tr = 0, rr = e), tr);
		},
		movementY: function(e) {
			return "movementY" in e ? e.movementY : nr;
		}
	}), ar = Xn(ir), or = Xn(x({}, ir, { dataTransfer: 0 })), sr = Xn(x({}, $n, { relatedTarget: 0 })), cr = Xn(x({}, Zn, {
		animationName: 0,
		elapsedTime: 0,
		pseudoElement: 0
	})), lr = Xn(x({}, Zn, { clipboardData: function(e) {
		return "clipboardData" in e ? e.clipboardData : window.clipboardData;
	} })), ur = Xn(x({}, Zn, { data: 0 })), dr = {
		Esc: "Escape",
		Spacebar: " ",
		Left: "ArrowLeft",
		Up: "ArrowUp",
		Right: "ArrowRight",
		Down: "ArrowDown",
		Del: "Delete",
		Win: "OS",
		Menu: "ContextMenu",
		Apps: "ContextMenu",
		Scroll: "ScrollLock",
		MozPrintableKey: "Unidentified"
	}, fr = {
		8: "Backspace",
		9: "Tab",
		12: "Clear",
		13: "Enter",
		16: "Shift",
		17: "Control",
		18: "Alt",
		19: "Pause",
		20: "CapsLock",
		27: "Escape",
		32: " ",
		33: "PageUp",
		34: "PageDown",
		35: "End",
		36: "Home",
		37: "ArrowLeft",
		38: "ArrowUp",
		39: "ArrowRight",
		40: "ArrowDown",
		45: "Insert",
		46: "Delete",
		112: "F1",
		113: "F2",
		114: "F3",
		115: "F4",
		116: "F5",
		117: "F6",
		118: "F7",
		119: "F8",
		120: "F9",
		121: "F10",
		122: "F11",
		123: "F12",
		144: "NumLock",
		145: "ScrollLock",
		224: "Meta"
	}, pr = {
		Alt: "altKey",
		Control: "ctrlKey",
		Meta: "metaKey",
		Shift: "shiftKey"
	};
	function mr(e) {
		var t = this.nativeEvent;
		return t.getModifierState ? t.getModifierState(e) : (e = pr[e]) ? !!t[e] : !1;
	}
	function hr() {
		return mr;
	}
	var gr = Xn(x({}, $n, {
		key: function(e) {
			if (e.key) {
				var t = dr[e.key] || e.key;
				if (t !== "Unidentified") return t;
			}
			return e.type === "keypress" ? (e = qn(e), e === 13 ? "Enter" : String.fromCharCode(e)) : e.type === "keydown" || e.type === "keyup" ? fr[e.keyCode] || "Unidentified" : "";
		},
		code: 0,
		location: 0,
		ctrlKey: 0,
		shiftKey: 0,
		altKey: 0,
		metaKey: 0,
		repeat: 0,
		locale: 0,
		getModifierState: hr,
		charCode: function(e) {
			return e.type === "keypress" ? qn(e) : 0;
		},
		keyCode: function(e) {
			return e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
		},
		which: function(e) {
			return e.type === "keypress" ? qn(e) : e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
		}
	})), _r = Xn(x({}, ir, {
		pointerId: 0,
		width: 0,
		height: 0,
		pressure: 0,
		tangentialPressure: 0,
		tiltX: 0,
		tiltY: 0,
		twist: 0,
		pointerType: 0,
		isPrimary: 0
	})), vr = Xn(x({}, Zn, { submitter: 0 })), yr = Xn(x({}, $n, {
		touches: 0,
		targetTouches: 0,
		changedTouches: 0,
		altKey: 0,
		metaKey: 0,
		ctrlKey: 0,
		shiftKey: 0,
		getModifierState: hr
	})), br = Xn(x({}, Zn, {
		propertyName: 0,
		elapsedTime: 0,
		pseudoElement: 0
	})), xr = Xn(x({}, ir, {
		deltaX: function(e) {
			return "deltaX" in e ? e.deltaX : "wheelDeltaX" in e ? -e.wheelDeltaX : 0;
		},
		deltaY: function(e) {
			return "deltaY" in e ? e.deltaY : "wheelDeltaY" in e ? -e.wheelDeltaY : "wheelDelta" in e ? -e.wheelDelta : 0;
		},
		deltaZ: 0,
		deltaMode: 0
	})), Sr = Xn(x({}, Zn, {
		newState: 0,
		oldState: 0,
		source: 0
	})), Cr = [
		9,
		13,
		27,
		32
	], wr = Bn && "CompositionEvent" in window, Tr = null;
	Bn && "documentMode" in document && (Tr = document.documentMode);
	var Er = Bn && "TextEvent" in window && !Tr, Dr = Bn && (!wr || Tr && 8 < Tr && 11 >= Tr), Or = " ", kr = !1;
	function Ar(e, t) {
		switch (e) {
			case "keyup": return Cr.indexOf(t.keyCode) !== -1;
			case "keydown": return t.keyCode !== 229;
			case "keypress":
			case "mousedown":
			case "focusout": return !0;
			default: return !1;
		}
	}
	function jr(e) {
		return e = e.detail, typeof e == "object" && "data" in e ? e.data : null;
	}
	var Mr = !1;
	function Nr(e, t) {
		switch (e) {
			case "compositionend": return jr(t);
			case "keypress": return t.which === 32 ? (kr = !0, Or) : null;
			case "textInput": return e = t.data, e === Or && kr ? null : e;
			default: return null;
		}
	}
	function Pr(e, t) {
		if (Mr) return e === "compositionend" || !wr && Ar(e, t) ? (e = Kn(), Gn = Wn = Un = null, Mr = !1, e) : null;
		switch (e) {
			case "paste": return null;
			case "keypress":
				if (!(t.ctrlKey || t.altKey || t.metaKey) || t.ctrlKey && t.altKey) {
					if (t.char && 1 < t.char.length) return t.char;
					if (t.which) return String.fromCharCode(t.which);
				}
				return null;
			case "compositionend": return Dr && t.locale !== "ko" ? null : t.data;
			default: return null;
		}
	}
	var Fr = {
		color: !0,
		date: !0,
		datetime: !0,
		"datetime-local": !0,
		email: !0,
		month: !0,
		number: !0,
		password: !0,
		range: !0,
		search: !0,
		tel: !0,
		text: !0,
		time: !0,
		url: !0,
		week: !0
	};
	function Ir(e) {
		var t = e && e.nodeName && e.nodeName.toLowerCase();
		return t === "input" ? !!Fr[e.type] : t === "textarea";
	}
	function Lr(e, t, n, r) {
		Pn ? Fn ? Fn.push(r) : Fn = [r] : Pn = r, t = lp(t, "onChange"), 0 < t.length && (n = new Qn("onChange", "change", null, n, r), e.push({
			event: n,
			listeners: t
		}));
	}
	var Rr = null, zr = null;
	function Br(e) {
		np(e, 0);
	}
	function Vr(e) {
		if (mn(qt(e))) return e;
	}
	function Hr(e, t) {
		if (e === "change") return t;
	}
	var Ur = !1;
	if (Bn) {
		var Wr;
		if (Bn) {
			var Gr = "oninput" in document;
			if (!Gr) {
				var Kr = document.createElement("div");
				Kr.setAttribute("oninput", "return;"), Gr = typeof Kr.oninput == "function";
			}
			Wr = Gr;
		} else Wr = !1;
		Ur = Wr && (!document.documentMode || 9 < document.documentMode);
	}
	function qr() {
		Rr && (Rr.detachEvent("onpropertychange", Jr), zr = Rr = null);
	}
	function Jr(e) {
		if (e.propertyName === "value" && Vr(zr)) {
			var t = [];
			Lr(t, zr, e, Nn(e)), Rn(Br, t);
		}
	}
	function Yr(e, t, n) {
		e === "focusin" ? (qr(), Rr = t, zr = n, Rr.attachEvent("onpropertychange", Jr)) : e === "focusout" && qr();
	}
	function Xr(e) {
		if (e === "selectionchange" || e === "keyup" || e === "keydown") return Vr(zr);
	}
	function Zr(e, t) {
		if (e === "click") return Vr(t);
	}
	function Qr(e, t) {
		if (e === "input" || e === "change") return Vr(t);
	}
	function $r(e, t) {
		return e === t && (e !== 0 || 1 / e == 1 / t) || e !== e && t !== t;
	}
	var ei = typeof Object.is == "function" ? Object.is : $r;
	function ti(e, t) {
		if (ei(e, t)) return !0;
		if (typeof e != "object" || !e || typeof t != "object" || !t) return !1;
		var n = Object.keys(e), r = Object.keys(t);
		if (n.length !== r.length) return !1;
		for (r = 0; r < n.length; r++) {
			var i = n[r];
			if (!Je.call(t, i) || !ei(e[i], t[i])) return !1;
		}
		return !0;
	}
	function ni(e) {
		if (e ||= typeof document < "u" ? document : void 0, e === void 0) return null;
		try {
			return e.activeElement || e.body;
		} catch {
			return e.body;
		}
	}
	function ri(e) {
		for (; e && e.firstChild;) e = e.firstChild;
		return e;
	}
	function ii(e, t) {
		var n = ri(e);
		e = 0;
		for (var r; n;) {
			if (n.nodeType === 3) {
				if (r = e + n.textContent.length, e <= t && r >= t) return {
					node: n,
					offset: t - e
				};
				e = r;
			}
			a: {
				for (; n;) {
					if (n.nextSibling) {
						n = n.nextSibling;
						break a;
					}
					n = n.parentNode;
				}
				n = void 0;
			}
			n = ri(n);
		}
	}
	function ai(e, t) {
		return e && t ? e === t ? !0 : e && e.nodeType === 3 ? !1 : t && t.nodeType === 3 ? ai(e, t.parentNode) : "contains" in e ? e.contains(t) : e.compareDocumentPosition ? !!(e.compareDocumentPosition(t) & 16) : !1 : !1;
	}
	function oi(e) {
		e = e != null && e.ownerDocument != null && e.ownerDocument.defaultView != null ? e.ownerDocument.defaultView : window;
		for (var t = ni(e.document); t instanceof e.HTMLIFrameElement;) {
			try {
				var n = typeof t.contentWindow.location.href == "string";
			} catch {
				n = !1;
			}
			if (n) e = t.contentWindow;
			else break;
			t = ni(e.document);
		}
		return t;
	}
	function si(e) {
		var t = e && e.nodeName && e.nodeName.toLowerCase();
		return t && (t === "input" && (e.type === "text" || e.type === "search" || e.type === "tel" || e.type === "url" || e.type === "password") || t === "textarea" || e.contentEditable === "true");
	}
	var ci = Bn && "documentMode" in document && 11 >= document.documentMode, li = null, ui = null, di = null, fi = !1;
	function pi(e, t, n) {
		var r = n.window === n ? n.document : n.nodeType === 9 ? n : n.ownerDocument;
		fi || li == null || li !== ni(r) || (r = li, "selectionStart" in r && si(r) ? r = {
			start: r.selectionStart,
			end: r.selectionEnd
		} : (r = (r.ownerDocument && r.ownerDocument.defaultView || window).getSelection(), r = {
			anchorNode: r.anchorNode,
			anchorOffset: r.anchorOffset,
			focusNode: r.focusNode,
			focusOffset: r.focusOffset
		}), di && ti(di, r) || (di = r, r = lp(ui, "onSelect"), 0 < r.length && (t = new Qn("onSelect", "select", null, t, n), e.push({
			event: t,
			listeners: r
		}), t.target = li)));
	}
	function mi(e, t) {
		var n = {};
		return n[e.toLowerCase()] = t.toLowerCase(), n["Webkit" + e] = "webkit" + t, n["Moz" + e] = "moz" + t, n;
	}
	var hi = {
		animationend: mi("Animation", "AnimationEnd"),
		animationiteration: mi("Animation", "AnimationIteration"),
		animationstart: mi("Animation", "AnimationStart"),
		transitionrun: mi("Transition", "TransitionRun"),
		transitionstart: mi("Transition", "TransitionStart"),
		transitioncancel: mi("Transition", "TransitionCancel"),
		transitionend: mi("Transition", "TransitionEnd")
	}, gi = {}, _i = {};
	Bn && (_i = document.createElement("div").style, "AnimationEvent" in window || (delete hi.animationend.animation, delete hi.animationiteration.animation, delete hi.animationstart.animation), "TransitionEvent" in window || delete hi.transitionend.transition);
	function vi(e) {
		if (gi[e]) return gi[e];
		if (!hi[e]) return e;
		var t = hi[e], n;
		for (n in t) if (t.hasOwnProperty(n) && n in _i) return gi[e] = t[n];
		return e;
	}
	var yi = vi("animationend"), bi = vi("animationiteration"), xi = vi("animationstart"), Si = vi("transitionrun"), Ci = vi("transitionstart"), wi = vi("transitioncancel"), Ti = vi("transitionend"), Ei = /* @__PURE__ */ new Map(), Di = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error fullscreenChange fullscreenError gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
	Di.push("scrollEnd");
	function Oi(e, t) {
		Ei.set(e, t), $t(t, [e]);
	}
	var ki = 0;
	function Ai(e, t) {
		if (e.name != null && e.name !== "auto") return e.name;
		if (t.autoName !== null) return t.autoName;
		e = Pd.identifierPrefix;
		var n = ki++;
		return e = "_" + e + "t_" + n.toString(32) + "_", t.autoName = e;
	}
	function ji(e) {
		if (e == null || typeof e == "string") return e;
		var t = null, n = Hd;
		if (n !== null) for (var r = 0; r < n.length; r++) {
			var i = e[n[r]];
			if (i != null) {
				if (i === "none") return "none";
				t = t == null ? i : t + (" " + i);
			}
		}
		return t ?? e.default;
	}
	function Mi(e, t) {
		return e = ji(e), t = ji(t), t == null ? e === "auto" ? null : e : t === "auto" ? null : t;
	}
	var Ni = typeof reportError == "function" ? reportError : function(e) {
		if (typeof window == "object" && typeof window.ErrorEvent == "function") {
			var t = new window.ErrorEvent("error", {
				bubbles: !0,
				cancelable: !0,
				message: typeof e == "object" && e && typeof e.message == "string" ? String(e.message) : String(e),
				error: e
			});
			if (!window.dispatchEvent(t)) return;
		} else if (typeof process == "object" && typeof process.emit == "function") {
			process.emit("uncaughtException", e);
			return;
		}
		console.error(e);
	}, Pi = [], Fi = 0, Ii = 0;
	function Li() {
		for (var e = Fi, t = Ii = Fi = 0; t < e;) {
			var n = Pi[t];
			Pi[t++] = null;
			var r = Pi[t];
			Pi[t++] = null;
			var i = Pi[t];
			Pi[t++] = null;
			var a = Pi[t];
			if (Pi[t++] = null, r !== null && i !== null) {
				var o = r.pending;
				o === null ? i.next = i : (i.next = o.next, o.next = i), r.pending = i;
			}
			a !== 0 && Vi(n, i, a);
		}
	}
	function Ri(e, t, n, r) {
		Pi[Fi++] = e, Pi[Fi++] = t, Pi[Fi++] = n, Pi[Fi++] = r, Ii |= r, e.lanes |= r, e = e.alternate, e !== null && (e.lanes |= r);
	}
	function zi(e, t, n, r) {
		return Ri(e, t, n, r), Hi(e);
	}
	function Bi(e, t) {
		return Ri(e, null, null, t), Hi(e);
	}
	function Vi(e, t, n) {
		e.lanes |= n;
		var r = e.alternate;
		r !== null && (r.lanes |= n);
		for (var i = !1, a = e.return; a !== null;) a.childLanes |= n, r = a.alternate, r !== null && (r.childLanes |= n), a.tag === 22 && (e = a.stateNode, e === null || e._visibility & 1 || (i = !0)), e = a, a = a.return;
		return e.tag === 3 ? (a = e.stateNode, i && t !== null && (i = 31 - dt(n), e = a.hiddenUpdates, r = e[i], r === null ? e[i] = [t] : r.push(t), t.lane = n | 536870912), a) : null;
	}
	function Hi(e) {
		if (50 < Ud) throw Ud = 0, Wd = null, Error(a(185));
		for (var t = e.return; t !== null;) e = t, t = e.return;
		return e.tag === 3 ? e.stateNode : null;
	}
	var Ui = {};
	function Wi(e, t, n, r) {
		this.tag = e, this.key = n, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = t, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
	}
	function Gi(e, t, n, r) {
		return new Wi(e, t, n, r);
	}
	function Ki(e) {
		return e = e.prototype, !(!e || !e.isReactComponent);
	}
	function qi(e, t) {
		var n = e.alternate;
		return n === null ? (n = Gi(e.tag, t, e.key, e.mode), n.elementType = e.elementType, n.type = e.type, n.stateNode = e.stateNode, n.alternate = e, e.alternate = n) : (n.pendingProps = t, n.type = e.type, n.flags = 0, n.subtreeFlags = 0, n.deletions = null), n.flags = e.flags & 1206910976, n.childLanes = e.childLanes, n.lanes = e.lanes, n.child = e.child, n.memoizedProps = e.memoizedProps, n.memoizedState = e.memoizedState, n.updateQueue = e.updateQueue, t = e.dependencies, n.dependencies = t === null ? null : {
			lanes: t.lanes,
			firstContext: t.firstContext
		}, n.sibling = e.sibling, n.index = e.index, n.ref = e.ref, n.refCleanup = e.refCleanup, n;
	}
	function Ji(e, t) {
		e.flags &= 1206910978;
		var n = e.alternate;
		return n === null ? (e.childLanes = 0, e.lanes = t, e.child = null, e.subtreeFlags = 0, e.memoizedProps = null, e.memoizedState = null, e.updateQueue = null, e.dependencies = null, e.stateNode = null) : (e.childLanes = n.childLanes, e.lanes = n.lanes, e.child = n.child, e.subtreeFlags = 0, e.deletions = null, e.memoizedProps = n.memoizedProps, e.memoizedState = n.memoizedState, e.updateQueue = n.updateQueue, e.type = n.type, t = n.dependencies, e.dependencies = t === null ? null : {
			lanes: t.lanes,
			firstContext: t.firstContext
		}), e;
	}
	function Yi(e, t, n, r, i, o) {
		var s = 0;
		if (r = e, typeof r == "function") Ki(r) && (s = 1);
		else if (typeof r == "string") s = oh(e, n, Pe.current) ? 26 : e === "html" || e === "head" || e === "body" ? 27 : 5;
		else a: switch (r) {
			case C: return e = Gi(31, n, t, i), e.elementType = C, e.lanes = o, e;
			case ce: return Xi(n.children, i, o, t);
			case le:
				s = 8, i |= 24;
				break;
			case ue: return e = Gi(12, n, t, i | 2), e.elementType = ue, e.lanes = o, e;
			case me: return e = Gi(13, n, t, i), e.elementType = me, e.lanes = o, e;
			case he: return e = Gi(19, n, t, i), e.elementType = he, e.lanes = o, e;
			case ve:
			case be: return e = i | 32, e = Gi(30, n, t, e), e.elementType = be, e.lanes = o, e.stateNode = {
				autoName: null,
				paired: null,
				clones: null,
				ref: null
			}, e;
			default:
				if (typeof r == "object" && r) switch (r.$$typeof) {
					case fe:
						s = 10;
						break a;
					case de:
						s = 9;
						break a;
					case pe:
						s = 11;
						break a;
					case ge:
						s = 14;
						break a;
					case _e:
						s = 16, r = null;
						break a;
				}
				s = 29, n = Error(a(130, e === null ? "null" : typeof e, "")), r = null;
		}
		return t = Gi(s, n, t, i), t.elementType = e, t.type = r, t.lanes = o, t;
	}
	function Xi(e, t, n, r) {
		return e = Gi(7, e, r, t), e.lanes = n, e;
	}
	function Zi(e, t, n) {
		return e = Gi(6, e, null, t), e.lanes = n, e;
	}
	function Qi(e) {
		var t = Gi(18, null, null, 0);
		return t.stateNode = e, t;
	}
	function $i(e, t, n) {
		return t = Gi(4, e.children === null ? [] : e.children, e.key, t), t.lanes = n, t.stateNode = {
			containerInfo: e.containerInfo,
			pendingChildren: null,
			implementation: e.implementation
		}, t;
	}
	var ea = /* @__PURE__ */ new WeakMap();
	function ta(e, t) {
		if (typeof e == "object" && e) {
			var n = ea.get(e);
			return n === void 0 ? (t = {
				value: e,
				source: t,
				stack: qe(t)
			}, ea.set(e, t), t) : n;
		}
		return {
			value: e,
			source: t,
			stack: qe(t)
		};
	}
	var na = [], ra = 0, ia = null, aa = 0, oa = [], sa = 0, ca = null, la = 1, ua = "";
	function da(e, t) {
		na[ra++] = aa, na[ra++] = ia, ia = e, aa = t;
	}
	function fa(e, t, n) {
		oa[sa++] = la, oa[sa++] = ua, oa[sa++] = ca, ca = e;
		var r = la;
		e = ua;
		var i = 32 - dt(r) - 1;
		r &= ~(1 << i), n += 1;
		var a = 32 - dt(t) + i;
		if (30 < a) {
			var o = i - i % 5;
			a = (r & (1 << o) - 1).toString(32), r >>= o, i -= o, la = 1 << 32 - dt(t) + i | n << i | r, ua = a + e;
		} else la = 1 << a | n << i | r, ua = e;
	}
	function pa(e) {
		e.return !== null && (da(e, 1), fa(e, 1, 0));
	}
	function ma(e) {
		for (; e === ia;) ia = na[--ra], na[ra] = null, aa = na[--ra], na[ra] = null;
		for (; e === ca;) ca = oa[--sa], oa[sa] = null, ua = oa[--sa], oa[sa] = null, la = oa[--sa], oa[sa] = null;
	}
	function ha(e, t) {
		oa[sa++] = la, oa[sa++] = ua, oa[sa++] = ca, la = t.id, ua = t.overflow, ca = e;
	}
	var ga = null, _a = null, D = !1, va = null, ya = !1, ba = Error(a(519));
	function xa(e) {
		throw Da(ta(Error(a(418, 1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML", "")), e)), ba;
	}
	function Sa(e) {
		var t = e.stateNode, n = e.type, r = e.memoizedProps;
		switch (t[Ft] = e, t[It] = r, n) {
			case "dialog":
				L("cancel", t), L("close", t);
				break;
			case "iframe":
			case "object":
			case "embed":
				L("load", t);
				break;
			case "video":
			case "audio":
				for (n = 0; n < ep.length; n++) L(ep[n], t);
				break;
			case "source":
				L("error", t);
				break;
			case "img":
			case "image":
			case "link":
				L("error", t), L("load", t);
				break;
			case "details":
				L("toggle", t);
				break;
			case "input":
				L("invalid", t), vn(t, r.value, r.defaultValue, r.checked, r.defaultChecked, r.type, r.name, !0);
				break;
			case "select":
				L("invalid", t);
				break;
			case "textarea": L("invalid", t), Sn(t, r.value, r.defaultValue, r.children);
		}
		n = r.children, typeof n != "string" && typeof n != "number" && typeof n != "bigint" || t.textContent === "" + n || !0 === r.suppressHydrationWarning || hp(t.textContent, n) ? (r.popover != null && (L("beforetoggle", t), L("toggle", t)), r.onScroll != null && L("scroll", t), r.onScrollEnd != null && L("scrollend", t), r.onClick != null && (t.onclick = jn), t = !0) : t = !1, t || xa(e, !0);
	}
	function Ca(e) {
		for (ga = e.return; ga;) switch (ga.tag) {
			case 5:
			case 31:
			case 13:
				ya = !1;
				return;
			case 27:
			case 3:
				ya = !0;
				return;
			default: ga = ga.return;
		}
	}
	function wa(e) {
		if (e !== ga) return !1;
		if (!D) return Ca(e), D = !0, !1;
		var t = e.tag, n;
		if ((n = t !== 3 && t !== 27) && ((n = t === 5) && (n = e.type, n = n === "form" || n === "button" || kp(e.type, e.memoizedProps)), n = !n), n && _a && xa(e), Ca(e), t === 13) {
			if (e = e.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error(a(317));
			_a = R(e);
		} else if (t === 31) {
			if (e = e.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error(a(317));
			_a = R(e);
		} else t === 27 ? (t = _a, Rp(e.type) ? (e = Em, Em = null, _a = e) : _a = t) : _a = ga ? Tm(e.stateNode.nextSibling) : null;
		return !0;
	}
	function Ta() {
		_a = ga = null, D = !1;
	}
	function Ea() {
		var e = va;
		return e !== null && (Dd === null ? Dd = e : Dd.push.apply(Dd, e), va = null), e;
	}
	function Da(e) {
		va === null ? va = [e] : va.push(e);
	}
	var Oa = je(null), ka = null, Aa = null;
	function ja(e, t, n) {
		Ne(Oa, t._currentValue), t._currentValue = n;
	}
	function Ma(e) {
		e._currentValue = Oa.current, Me(Oa);
	}
	function Na(e, t, n) {
		for (; e !== null;) {
			var r = e.alternate;
			if ((e.childLanes & t) === t ? r !== null && (r.childLanes & t) !== t && (r.childLanes |= t) : (e.childLanes |= t, r !== null && (r.childLanes |= t)), e === n) break;
			e = e.return;
		}
	}
	function Pa(e, t, n, r) {
		var i = e.child;
		for (i !== null && (i.return = e); i !== null;) {
			var o = i.dependencies;
			if (o !== null) {
				var s = i.child;
				o = o.firstContext;
				a: for (; o !== null;) {
					var c = o;
					o = i;
					for (var l = 0; l < t.length; l++) if (c.context === t[l]) {
						o.lanes |= n, c = o.alternate, c !== null && (c.lanes |= n), Na(o.return, n, e), r || (s = null);
						break a;
					}
					o = c.next;
				}
			} else if (i.tag === 18) {
				if (s = i.return, s === null) throw Error(a(341));
				s.lanes |= n, o = s.alternate, o !== null && (o.lanes |= n), Na(s, n, e), s = null;
			} else i.tag === 13 && i.memoizedState !== null && i.memoizedState.dehydrated === null ? (i.lanes |= n, s = i.alternate, s !== null && (s.lanes |= n), Na(i.return, n, e), s = i.child, s = s === null ? null : s.sibling) : s = i.child;
			if (s !== null) s.return = i;
			else for (s = i; s !== null;) {
				if (s === e) {
					s = null;
					break;
				}
				if (i = s.sibling, i !== null) {
					i.return = s.return, s = i;
					break;
				}
				s = s.return;
			}
			i = s;
		}
	}
	function Fa(e, t, n, r) {
		e = null;
		for (var i = t, o = !1; i !== null;) {
			if (!o) {
				if (i.flags & 524288) o = !0;
				else if (i.flags & 262144) break;
			}
			if (i.tag === 10) {
				var s = i.alternate;
				if (s === null) throw Error(a(387));
				if (s = s.memoizedProps, s !== null) {
					var c = i.type;
					ei(i.pendingProps.value, s.value) || (e === null ? e = [c] : e.push(c));
				}
			} else if (i === T.current) {
				if (s = i.alternate, s === null) throw Error(a(387));
				s.memoizedState.memoizedState !== i.memoizedState.memoizedState && (e === null ? e = [bh] : e.push(bh));
			}
			i = i.return;
		}
		return e !== null && Pa(t, e, n, r), t.flags |= 262144, e !== null;
	}
	function Ia(e) {
		for (e = e.firstContext; e !== null;) {
			if (!ei(e.context._currentValue, e.memoizedValue)) return !0;
			e = e.next;
		}
		return !1;
	}
	function La(e) {
		ka = e, Aa = null, e = e.dependencies, e !== null && (e.firstContext = null);
	}
	function Ra(e) {
		return Ba(ka, e);
	}
	function za(e, t) {
		return ka === null && La(e), Ba(e, t);
	}
	function Ba(e, t) {
		var n = t._currentValue;
		if (t = {
			context: t,
			memoizedValue: n,
			next: null
		}, Aa === null) {
			if (e === null) throw Error(a(308));
			Aa = t, e.dependencies = {
				lanes: 0,
				firstContext: t
			}, e.flags |= 524288;
		} else Aa = Aa.next = t;
		return n;
	}
	var Va = typeof AbortController < "u" ? AbortController : function() {
		var e = [], t = this.signal = {
			aborted: !1,
			addEventListener: function(t, n) {
				e.push(n);
			}
		};
		this.abort = function() {
			t.aborted = !0, e.forEach(function(e) {
				return e();
			});
		};
	}, Ha = t.unstable_scheduleCallback, Ua = t.unstable_NormalPriority, O = {
		$$typeof: fe,
		Consumer: null,
		Provider: null,
		_currentValue: null,
		_currentValue2: null,
		_threadCount: 0
	};
	function k() {
		return {
			controller: new Va(),
			data: /* @__PURE__ */ new Map(),
			refCount: 0
		};
	}
	function Wa(e) {
		e.refCount--, e.refCount === 0 && Ha(Ua, function() {
			e.controller.abort();
		});
	}
	function Ga(e, t) {
		if (e.pendingLanes & 4194048) {
			var n = e.transitionTypes;
			for (n === null && (n = e.transitionTypes = []), e = 0; e < t.length; e++) {
				var r = t[e];
				n.indexOf(r) === -1 && n.push(r);
			}
		}
	}
	var Ka = null;
	function qa(e) {
		var t = e.transitionTypes;
		return e.transitionTypes = null, t;
	}
	var Ja = null, Ya = 0, Xa = 0, Za = null;
	function Qa(e, t) {
		if (Ja === null) {
			var n = Ja = [];
			Ya = 0, Xa = Yf(), Za = {
				status: "pending",
				value: void 0,
				then: function(e) {
					n.push(e);
				}
			};
		}
		return Ya++, t.then($a, $a), t;
	}
	function $a() {
		if (--Ya === 0 && (Ka = null, Ja !== null)) {
			Za !== null && (Za.status = "fulfilled");
			var e = Ja;
			Ja = null, Xa = 0, Za = null;
			for (var t = 0; t < e.length; t++) (0, e[t])();
		}
	}
	function eo(e, t) {
		var n = [], r = {
			status: "pending",
			value: null,
			reason: null,
			then: function(e) {
				n.push(e);
			}
		};
		return e.then(function() {
			r.status = "fulfilled", r.value = t;
			for (var e = 0; e < n.length; e++) (0, n[e])(t);
		}, function(e) {
			for (r.status = "rejected", r.reason = e, e = 0; e < n.length; e++) (0, n[e])(void 0);
		}), r;
	}
	var to = w.S;
	w.S = function(e, t) {
		if (Ad = $e(), typeof t == "object" && t && typeof t.then == "function" && Qa(e, t), Ka !== null) for (var n = Ff; n !== null;) Ga(n, Ka), n = n.next;
		if (n = e.types, n !== null) {
			for (var r = Ff; r !== null;) Ga(r, n), r = r.next;
			if (Xa !== 0) {
				r = Ka, r === null && (r = Ka = []);
				for (var i = 0; i < n.length; i++) {
					var a = n[i];
					r.indexOf(a) === -1 && r.push(a);
				}
			}
		}
		to !== null && to(e, t);
	};
	var A = je(null);
	function no() {
		var e = A.current;
		return e === null ? md.pooledCache : e;
	}
	function ro(e, t) {
		t === null ? Ne(A, A.current) : Ne(A, t.pool);
	}
	function io() {
		var e = no();
		return e === null ? null : {
			parent: O._currentValue,
			pool: e
		};
	}
	var ao = Error(a(460)), oo = Error(a(474)), so = Error(a(542)), co = { then: function() {} };
	function lo(e) {
		return e = e.status, e === "fulfilled" || e === "rejected";
	}
	function uo(e, t, n) {
		switch (n = e[n], n === void 0 ? e.push(t) : n !== t && (t.then(jn, jn), t = n), t.status) {
			case "fulfilled": return t.value;
			case "rejected": throw e = t.reason, ho(e), e === void 0 && !("reason" in t) ? Error(a(600)) : e;
			default:
				if (typeof t.status == "string") t.then(jn, jn);
				else {
					if (e = md, e !== null && 100 < e.shellSuspendCounter) throw Error(a(482));
					e = t, e.status = "pending", e.then(function(e) {
						if (t.status === "pending") {
							var n = t;
							n.status = "fulfilled", n.value = e;
						}
					}, function(e) {
						if (t.status === "pending") {
							var n = t;
							n.status = "rejected", n.reason = e;
						}
					});
				}
				switch (t.status) {
					case "fulfilled": return t.value;
					case "rejected": throw e = t.reason, ho(e), e;
				}
				throw po = t, ao;
		}
	}
	function fo(e) {
		try {
			var t = e._init;
			return t(e._payload);
		} catch (e) {
			throw typeof e == "object" && e && typeof e.then == "function" ? (po = e, ao) : e;
		}
	}
	var po = null;
	function mo() {
		if (po === null) throw Error(a(459));
		var e = po;
		return po = null, e;
	}
	function ho(e) {
		if (e === ao || e === so) throw Error(a(483));
	}
	var go = null, _o = 0;
	function vo(e) {
		var t = _o;
		return _o += 1, go === null && (go = []), uo(go, e, t);
	}
	function yo(e, t) {
		t = t.props.ref, e.ref = t === void 0 ? null : t;
	}
	function bo(e, t) {
		throw t.$$typeof === oe ? Error(a(525)) : (e = Object.prototype.toString.call(t), Error(a(31, e === "[object Object]" ? "object with keys {" + Object.keys(t).join(", ") + "}" : e)));
	}
	function xo(e) {
		function t(t, n) {
			if (e) {
				var r = t.deletions;
				r === null ? (t.deletions = [n], t.flags |= 16) : r.push(n);
			}
		}
		function n(n, r) {
			if (!e) return null;
			for (; r !== null;) t(n, r), r = r.sibling;
			return null;
		}
		function r(e) {
			for (var t = /* @__PURE__ */ new Map(); e !== null;) e.key === null ? t.set(e.index, e) : t.set(e.key, e), e = e.sibling;
			return t;
		}
		function i(e, t) {
			return e = qi(e, t), e.index = 0, e.sibling = null, e;
		}
		function o(t, n, r) {
			return t.index = r, e ? (r = t.alternate, r === null ? (t.flags |= 134217730, n) : (r = r.index, r < n ? (t.flags |= 2, n) : r)) : (t.flags |= 1048576, n);
		}
		function s(t) {
			return e && t.alternate === null && (t.flags |= 134217730), t;
		}
		function c(e, t, n, r) {
			return t === null || t.tag !== 6 ? (t = Zi(n, e.mode, r), t.return = e, t) : (t = i(t, n), t.return = e, t);
		}
		function l(e, t, n, r) {
			var a = n.type;
			return a === ce ? (e = d(e, t, n.props.children, r, n.key), yo(e, n), e) : t !== null && (t.elementType === a || typeof a == "object" && a && a.$$typeof === _e && fo(a) === t.type) ? (t = i(t, n.props), yo(t, n), t.return = e, t) : (t = Yi(n.type, n.key, n.props, null, e.mode, r), yo(t, n), t.return = e, t);
		}
		function u(e, t, n, r) {
			return t === null || t.tag !== 4 || t.stateNode.containerInfo !== n.containerInfo || t.stateNode.implementation !== n.implementation ? (t = $i(n, e.mode, r), t.return = e, t) : (t = i(t, n.children || []), t.return = e, t);
		}
		function d(e, t, n, r, a) {
			return t === null || t.tag !== 7 ? (t = Xi(n, e.mode, r, a), t.return = e, t) : (t = i(t, n), t.return = e, t);
		}
		function f(e, t, n) {
			if (typeof t == "string" && t !== "" || typeof t == "number" || typeof t == "bigint") return t = Zi("" + t, e.mode, n), t.return = e, t;
			if (typeof t == "object" && t) {
				switch (t.$$typeof) {
					case S: return n = Yi(t.type, t.key, t.props, null, e.mode, n), yo(n, t), n.return = e, n;
					case se: return t = $i(t, e.mode, n), t.return = e, t;
					case _e: return t = fo(t), f(e, t, n);
				}
				if (Ee(t) || Ce(t)) return t = Xi(t, e.mode, n, null), t.return = e, t;
				if (typeof t.then == "function") return f(e, vo(t), n);
				if (t.$$typeof === fe) return f(e, za(e, t), n);
				bo(e, t);
			}
			return null;
		}
		function p(e, t, n, r) {
			var i = t === null ? null : t.key;
			if (typeof n == "string" && n !== "" || typeof n == "number" || typeof n == "bigint") return i === null ? c(e, t, "" + n, r) : null;
			if (typeof n == "object" && n) {
				switch (n.$$typeof) {
					case S: return n.key === i ? l(e, t, n, r) : null;
					case se: return n.key === i ? u(e, t, n, r) : null;
					case _e: return n = fo(n), p(e, t, n, r);
				}
				if (Ee(n) || Ce(n)) return i === null ? d(e, t, n, r, null) : null;
				if (typeof n.then == "function") return p(e, t, vo(n), r);
				if (n.$$typeof === fe) return p(e, t, za(e, n), r);
				bo(e, n);
			}
			return null;
		}
		function m(e, t, n, r, i) {
			if (typeof r == "string" && r !== "" || typeof r == "number" || typeof r == "bigint") return e = e.get(n) || null, c(t, e, "" + r, i);
			if (typeof r == "object" && r) {
				switch (r.$$typeof) {
					case S: return e = e.get(r.key === null ? n : r.key) || null, l(t, e, r, i);
					case se: return e = e.get(r.key === null ? n : r.key) || null, u(t, e, r, i);
					case _e: return r = fo(r), m(e, t, n, r, i);
				}
				if (Ee(r) || Ce(r)) return e = e.get(n) || null, d(t, e, r, i, null);
				if (typeof r.then == "function") return m(e, t, n, vo(r), i);
				if (r.$$typeof === fe) return m(e, t, n, za(t, r), i);
				bo(t, r);
			}
			return null;
		}
		function h(i, a, s, c) {
			for (var l = null, u = null, d = a, h = a = 0, g = null; d !== null && h < s.length; h++) {
				d.index > h ? (g = d, d = null) : g = d.sibling;
				var _ = p(i, d, s[h], c);
				if (_ === null) {
					d === null && (d = g);
					break;
				}
				e && d && _.alternate === null && t(i, d), a = o(_, a, h), u === null ? l = _ : u.sibling = _, u = _, d = g;
			}
			if (h === s.length) return n(i, d), D && da(i, h), l;
			if (d === null) {
				for (; h < s.length; h++) d = f(i, s[h], c), d !== null && (a = o(d, a, h), u === null ? l = d : u.sibling = d, u = d);
				return D && da(i, h), l;
			}
			for (d = r(d); h < s.length; h++) g = m(d, i, h, s[h], c), g !== null && (e && (_ = g.alternate, _ !== null && d.delete(_.key === null ? h : _.key)), a = o(g, a, h), u === null ? l = g : u.sibling = g, u = g);
			return e && d.forEach(function(e) {
				return t(i, e);
			}), D && da(i, h), l;
		}
		function g(i, s, c, l) {
			if (c == null) throw Error(a(151));
			for (var u = null, d = null, h = s, g = s = 0, _ = null, v = c.next(); h !== null && !v.done; g++, v = c.next()) {
				h.index > g ? (_ = h, h = null) : _ = h.sibling;
				var y = p(i, h, v.value, l);
				if (y === null) {
					h === null && (h = _);
					break;
				}
				e && h && y.alternate === null && t(i, h), s = o(y, s, g), d === null ? u = y : d.sibling = y, d = y, h = _;
			}
			if (v.done) return n(i, h), D && da(i, g), u;
			if (h === null) {
				for (; !v.done; g++, v = c.next()) v = f(i, v.value, l), v !== null && (s = o(v, s, g), d === null ? u = v : d.sibling = v, d = v);
				return D && da(i, g), u;
			}
			for (h = r(h); !v.done; g++, v = c.next()) v = m(h, i, g, v.value, l), v !== null && (e && (_ = v.alternate, _ !== null && h.delete(_.key === null ? g : _.key)), s = o(v, s, g), d === null ? u = v : d.sibling = v, d = v);
			return e && h.forEach(function(e) {
				return t(i, e);
			}), D && da(i, g), u;
		}
		function _(e, r, o, c) {
			if (typeof o == "object" && o && o.type === ce && o.key === null && o.props.ref === void 0 && (o = o.props.children), typeof o == "object" && o) {
				switch (o.$$typeof) {
					case S:
						a: {
							for (var l = o.key; r !== null;) {
								if (r.key === l) {
									if (l = o.type, l === ce) {
										if (r.tag === 7) {
											n(e, r.sibling), c = i(r, o.props.children), yo(c, o), c.return = e, e = c;
											break a;
										}
									} else if (r.elementType === l || typeof l == "object" && l && l.$$typeof === _e && fo(l) === r.type) {
										n(e, r.sibling), c = i(r, o.props), yo(c, o), c.return = e, e = c;
										break a;
									}
									n(e, r);
									break;
								}
								t(e, r), r = r.sibling;
							}
							o.type === ce ? (c = Xi(o.props.children, e.mode, c, o.key), yo(c, o), c.return = e, e = c) : (c = Yi(o.type, o.key, o.props, null, e.mode, c), yo(c, o), c.return = e, e = c);
						}
						return s(e);
					case se:
						a: {
							for (l = o.key; r !== null;) {
								if (r.key === l) {
									if (r.tag === 4 && r.stateNode.containerInfo === o.containerInfo && r.stateNode.implementation === o.implementation) {
										n(e, r.sibling), c = i(r, o.children || []), c.return = e, e = c;
										break a;
									}
									n(e, r);
									break;
								}
								t(e, r), r = r.sibling;
							}
							c = $i(o, e.mode, c), c.return = e, e = c;
						}
						return s(e);
					case _e: return o = fo(o), _(e, r, o, c);
				}
				if (Ee(o)) return h(e, r, o, c);
				if (Ce(o)) {
					if (l = Ce(o), typeof l != "function") throw Error(a(150));
					return o = l.call(o), g(e, r, o, c);
				}
				if (typeof o.then == "function") return _(e, r, vo(o), c);
				if (o.$$typeof === fe) return _(e, r, za(e, o), c);
				bo(e, o);
			}
			return typeof o == "string" && o !== "" || typeof o == "number" || typeof o == "bigint" ? (o = "" + o, r !== null && r.tag === 6 ? (n(e, r.sibling), c = i(r, o), c.return = e, e = c) : (n(e, r), c = Zi(o, e.mode, c), c.return = e, e = c), s(e)) : n(e, r);
		}
		return function(e, t, n, r) {
			try {
				_o = 0;
				var i = _(e, t, n, r);
				return go = null, i;
			} catch (t) {
				if (t === ao || t === so) throw t;
				var a = Gi(29, t, null, e.mode);
				return a.lanes = r, a.return = e, a;
			}
		};
	}
	var So = xo(!0), Co = xo(!1), wo = !1;
	function To(e) {
		e.updateQueue = {
			baseState: e.memoizedState,
			firstBaseUpdate: null,
			lastBaseUpdate: null,
			shared: {
				pending: null,
				lanes: 0,
				hiddenCallbacks: null
			},
			callbacks: null
		};
	}
	function Eo(e, t) {
		e = e.updateQueue, t.updateQueue === e && (t.updateQueue = {
			baseState: e.baseState,
			firstBaseUpdate: e.firstBaseUpdate,
			lastBaseUpdate: e.lastBaseUpdate,
			shared: e.shared,
			callbacks: null
		});
	}
	function Do(e) {
		return {
			lane: e,
			tag: 0,
			payload: null,
			callback: null,
			next: null
		};
	}
	function Oo(e, t, n) {
		var r = e.updateQueue;
		if (r === null) return null;
		if (r = r.shared, pd & 2) {
			var i = r.pending;
			return i === null ? t.next = t : (t.next = i.next, i.next = t), r.pending = t, t = Hi(e), Vi(e, null, n), t;
		}
		return Ri(e, r, t, n), Hi(e);
	}
	function ko(e, t, n) {
		if (t = t.updateQueue, t !== null && (t = t.shared, n & 4194048)) {
			var r = t.lanes;
			r &= e.pendingLanes, n |= r, t.lanes = n, Ot(e, n);
		}
	}
	function Ao(e, t) {
		var n = e.updateQueue, r = e.alternate;
		if (r !== null && (r = r.updateQueue, n === r)) {
			var i = null, a = null;
			if (n = n.firstBaseUpdate, n !== null) {
				do {
					var o = {
						lane: n.lane,
						tag: n.tag,
						payload: n.payload,
						callback: null,
						next: null
					};
					a === null ? i = a = o : a = a.next = o, n = n.next;
				} while (n !== null);
				a === null ? i = a = t : a = a.next = t;
			} else i = a = t;
			n = {
				baseState: r.baseState,
				firstBaseUpdate: i,
				lastBaseUpdate: a,
				shared: r.shared,
				callbacks: r.callbacks
			}, e.updateQueue = n;
			return;
		}
		e = n.lastBaseUpdate, e === null ? n.firstBaseUpdate = t : e.next = t, n.lastBaseUpdate = t;
	}
	var jo = !1;
	function Mo() {
		if (jo) {
			var e = Za;
			if (e !== null) throw e;
		}
	}
	function No(e, t, n, r) {
		jo = !1;
		var i = e.updateQueue;
		wo = !1;
		var a = i.firstBaseUpdate, o = i.lastBaseUpdate, s = i.shared.pending;
		if (s !== null) {
			i.shared.pending = null;
			var c = s, l = c.next;
			c.next = null, o === null ? a = l : o.next = l, o = c;
			var u = e.alternate;
			u !== null && (u = u.updateQueue, s = u.lastBaseUpdate, s !== o && (s === null ? u.firstBaseUpdate = l : s.next = l, u.lastBaseUpdate = c));
		}
		if (a !== null) {
			var d = i.baseState;
			o = 0, u = l = c = null, s = a;
			do {
				var f = s.lane & -536870913, p = f !== s.lane;
				if (p ? (P & f) === f : (r & f) === f) {
					f !== 0 && f === Xa && (jo = !0), u !== null && (u = u.next = {
						lane: 0,
						tag: s.tag,
						payload: s.payload,
						callback: null,
						next: null
					});
					a: {
						var m = e, h = s;
						f = t;
						var g = n;
						switch (h.tag) {
							case 1:
								if (m = h.payload, typeof m == "function") {
									d = m.call(g, d, f);
									break a;
								}
								d = m;
								break a;
							case 3: m.flags = m.flags & -65537 | 128;
							case 0:
								if (m = h.payload, f = typeof m == "function" ? m.call(g, d, f) : m, f == null) break a;
								d = x({}, d, f);
								break a;
							case 2: wo = !0;
						}
					}
					f = s.callback, f !== null && (e.flags |= 64, p && (e.flags |= 8192), p = i.callbacks, p === null ? i.callbacks = [f] : p.push(f));
				} else p = {
					lane: f,
					tag: s.tag,
					payload: s.payload,
					callback: s.callback,
					next: null
				}, u === null ? (l = u = p, c = d) : u = u.next = p, o |= f;
				if (s = s.next, s === null) {
					if (s = i.shared.pending, s === null) break;
					p = s, s = p.next, p.next = null, i.lastBaseUpdate = p, i.shared.pending = null;
				}
			} while (1);
			u === null && (c = d), i.baseState = c, i.firstBaseUpdate = l, i.lastBaseUpdate = u, a === null && (i.shared.lanes = 0), xd |= o, e.lanes = o, e.memoizedState = d;
		}
	}
	function Po(e, t) {
		if (typeof e != "function") throw Error(a(191, e));
		e.call(t);
	}
	function Fo(e, t) {
		var n = e.callbacks;
		if (n !== null) for (e.callbacks = null, e = 0; e < n.length; e++) Po(n[e], t);
	}
	var Io = je(null), Lo = je(0);
	function Ro(e, t) {
		e = yd, Ne(Lo, e), Ne(Io, t), yd = e | t.baseLanes;
	}
	function zo() {
		Ne(Lo, yd), Ne(Io, Io.current);
	}
	function Bo() {
		yd = Lo.current, Me(Io), Me(Lo);
	}
	var Vo = je(null), Ho = null;
	function Uo(e) {
		var t = e.alternate;
		Ne(Jo, Jo.current & 1), Ne(Vo, e), Ho === null && (t === null || Io.current !== null || t.memoizedState !== null) && (Ho = e);
	}
	function Wo(e) {
		Ne(Jo, Jo.current), Ne(Vo, e), Ho === null && (Ho = e);
	}
	function Go(e) {
		e.tag === 22 ? (Ne(Jo, Jo.current), Ne(Vo, e), Ho === null && (Ho = e)) : Ko();
	}
	function Ko() {
		Ne(Jo, Jo.current), Ne(Vo, Vo.current);
	}
	function qo(e) {
		Me(Vo), Ho === e && (Ho = null), Me(Jo);
	}
	var Jo = je(0);
	function Yo(e, t) {
		Ne(Vo, Vo.current), Ne(Jo, t);
	}
	function Xo(e) {
		Me(Jo), Me(Vo), Ho === e && (Ho = null);
	}
	function Zo(e) {
		for (var t = e; t !== null;) {
			if (t.tag === 13) {
				var n = t.memoizedState;
				if (n !== null && (n = n.dehydrated, n === null || Sm(n) || Cm(n))) return t;
			} else if (t.tag === 19 && t.memoizedProps.revealOrder !== "independent") {
				if (t.flags & 128) return t;
			} else if (t.child !== null) {
				t.child.return = t, t = t.child;
				continue;
			}
			if (t === e) break;
			for (; t.sibling === null;) {
				if (t.return === null || t.return === e) return null;
				t = t.return;
			}
			t.sibling.return = t.return, t = t.sibling;
		}
		return null;
	}
	var Qo = 0, j = null, $o = null, es = null, ts = !1, ns = !1, rs = !1, is = 0, as = 0, os = null, ss = 0;
	function cs() {
		throw Error(a(321));
	}
	function ls(e, t) {
		if (t === null) return !1;
		for (var n = 0; n < t.length && n < e.length; n++) if (!ei(e[n], t[n])) return !1;
		return !0;
	}
	function us(e, t, n, r, i, a) {
		return Qo = a, j = t, t.memoizedState = null, t.updateQueue = null, t.lanes = 0, w.H = e === null || e.memoizedState === null ? Dc : Oc, rs = !1, a = n(r, i), rs = !1, ns && (a = fs(t, n, r, i)), ds(e), a;
	}
	function ds(e) {
		w.H = Ec;
		var t = $o !== null && $o.next !== null;
		if (Qo = 0, es = $o = j = null, ts = !1, as = 0, os = null, t) throw Error(a(300));
		e === null || Gc || (e = e.dependencies, e !== null && Ia(e) && (Gc = !0));
	}
	function fs(e, t, n, r) {
		j = e;
		var i = 0;
		do {
			if (ns && (os = null), as = 0, ns = !1, 25 <= i) throw Error(a(301));
			if (i += 1, es = $o = null, e.updateQueue != null) {
				var o = e.updateQueue;
				o.lastEffect = null, o.events = null, o.stores = null, o.memoCache != null && (o.memoCache.index = 0);
			}
			w.H = kc, o = t(n, r);
		} while (ns);
		return o;
	}
	function ps() {
		var e = w.H, t = e.useState()[0];
		return t = typeof t.then == "function" ? bs(t) : t, e = e.useState()[0], ($o === null ? null : $o.memoizedState) !== e && (j.flags |= 1024), t;
	}
	function ms() {
		var e = is !== 0;
		return is = 0, e;
	}
	function hs(e, t, n) {
		t.updateQueue = e.updateQueue, t.flags &= -2053, e.lanes &= ~n;
	}
	function gs(e) {
		if (ts) {
			for (e = e.memoizedState; e !== null;) {
				var t = e.queue;
				t !== null && (t.pending = null), e = e.next;
			}
			ts = !1;
		}
		Qo = 0, es = $o = j = null, ns = !1, as = is = 0, os = null;
	}
	function _s() {
		var e = {
			memoizedState: null,
			baseState: null,
			baseQueue: null,
			queue: null,
			next: null
		};
		return es === null ? j.memoizedState = es = e : es = es.next = e, es;
	}
	function vs() {
		if ($o === null) {
			var e = j.alternate;
			e = e === null ? null : e.memoizedState;
		} else e = $o.next;
		var t = es === null ? j.memoizedState : es.next;
		if (t !== null) es = t, $o = e;
		else {
			if (e === null) throw j.alternate === null ? Error(a(467)) : Error(a(310));
			$o = e, e = {
				memoizedState: $o.memoizedState,
				baseState: $o.baseState,
				baseQueue: $o.baseQueue,
				queue: $o.queue,
				next: null
			}, es === null ? j.memoizedState = es = e : es = es.next = e;
		}
		return es;
	}
	function ys() {
		return {
			lastEffect: null,
			events: null,
			stores: null,
			memoCache: null
		};
	}
	function bs(e) {
		var t = as;
		return as += 1, os === null && (os = []), e = uo(os, e, t), t = j, (es === null ? t.memoizedState : es.next) === null && (t = t.alternate, w.H = t === null || t.memoizedState === null ? Dc : Oc), e;
	}
	function xs(e) {
		if (typeof e == "object" && e) {
			if (typeof e.then == "function") return bs(e);
			if (e.$$typeof === xe) return;
			if (e.$$typeof === fe) return Ra(e);
		}
		throw Error(a(438, String(e)));
	}
	function Ss(e) {
		var t = null, n = j.updateQueue;
		if (n !== null && (t = n.memoCache), t == null) {
			var r = j.alternate;
			r !== null && (r = r.updateQueue, r !== null && (r = r.memoCache, r != null && (t = {
				data: r.data.map(function(e) {
					return e.slice();
				}),
				index: 0
			})));
		}
		if (t ??= {
			data: [],
			index: 0
		}, n === null && (n = ys(), j.updateQueue = n), n.memoCache = t, n = t.data[t.index], n === void 0) for (n = t.data[t.index] = Array(e), r = 0; r < e; r++) n[r] = ye;
		return t.index++, n;
	}
	function Cs(e, t) {
		return typeof t == "function" ? t(e) : t;
	}
	function ws(e) {
		return Ts(vs(), $o, e);
	}
	function Ts(e, t, n) {
		var r = e.queue;
		if (r === null) throw Error(a(311));
		r.lastRenderedReducer = n;
		var i = e.baseQueue, o = r.pending;
		if (o !== null) {
			if (i !== null) {
				var s = i.next;
				i.next = o.next, o.next = s;
			}
			t.baseQueue = i = o, r.pending = null;
		}
		if (o = e.baseState, i === null) e.memoizedState = o;
		else {
			t = i.next;
			var c = s = null, l = null, u = t, d = !1;
			do {
				var f = u.lane & -536870913;
				if (f === u.lane ? (Qo & f) === f : (P & f) === f) {
					var p = u.revertLane;
					if (p === 0) l !== null && (l = l.next = {
						lane: 0,
						revertLane: 0,
						gesture: null,
						action: u.action,
						hasEagerState: u.hasEagerState,
						eagerState: u.eagerState,
						next: null
					}), f === Xa && (d = !0);
					else if ((Qo & p) === p) {
						u = u.next, p === Xa && (d = !0);
						continue;
					} else f = {
						lane: 0,
						revertLane: u.revertLane,
						gesture: null,
						action: u.action,
						hasEagerState: u.hasEagerState,
						eagerState: u.eagerState,
						next: null
					}, l === null ? (c = l = f, s = o) : l = l.next = f, j.lanes |= p, xd |= p;
					f = u.action, rs && n(o, f), o = u.hasEagerState ? u.eagerState : n(o, f);
				} else p = {
					lane: f,
					revertLane: u.revertLane,
					gesture: u.gesture,
					action: u.action,
					hasEagerState: u.hasEagerState,
					eagerState: u.eagerState,
					next: null
				}, l === null ? (c = l = p, s = o) : l = l.next = p, j.lanes |= f, xd |= f;
				u = u.next;
			} while (u !== null && u !== t);
			if (l === null ? s = o : l.next = c, !ei(o, e.memoizedState) && (Gc = !0, d && (n = Za, n !== null))) throw n;
			e.memoizedState = o, e.baseState = s, e.baseQueue = l, r.lastRenderedState = o;
		}
		return i === null && (r.lanes = 0), [e.memoizedState, r.dispatch];
	}
	function Es(e) {
		var t = vs(), n = t.queue;
		if (n === null) throw Error(a(311));
		n.lastRenderedReducer = e;
		var r = n.dispatch, i = n.pending, o = t.memoizedState;
		if (i !== null) {
			n.pending = null;
			var s = i = i.next;
			do
				o = e(o, s.action), s = s.next;
			while (s !== i);
			ei(o, t.memoizedState) || (Gc = !0), t.memoizedState = o, t.baseQueue === null && (t.baseState = o), n.lastRenderedState = o;
		}
		return [o, r];
	}
	function Ds(e, t, n) {
		var r = j, i = vs(), o = D;
		if (o) {
			if (n === void 0) throw Error(a(407));
			n = n();
		} else n = t();
		var s = !ei(($o || i).memoizedState, n);
		if (s && (i.memoizedState = n, Gc = !0), i = i.queue, Qs(As.bind(null, r, i, e), [e]), e = i.getSnapshot !== t || s || es !== null && !!(es.memoizedState.tag & 1), qs(e ? 9 : 8, { destroy: void 0 }, ks.bind(null, r, i, n, t), null), e) {
			if (r.flags |= 2048, md === null) throw Error(a(349));
			o || Qo & 127 || Os(r, t, n);
		}
		return n;
	}
	function Os(e, t, n) {
		e.flags |= 16384, e = {
			getSnapshot: t,
			value: n
		}, t = j.updateQueue, t === null ? (t = ys(), j.updateQueue = t, t.stores = [e]) : (n = t.stores, n === null ? t.stores = [e] : n.push(e));
	}
	function ks(e, t, n, r) {
		t.value = n, t.getSnapshot = r, js(t) && Ms(e);
	}
	function As(e, t, n) {
		return n(function() {
			js(t) && Ms(e);
		});
	}
	function js(e) {
		var t = e.getSnapshot;
		e = e.value;
		try {
			var n = t();
			return !ei(e, n);
		} catch {
			return !0;
		}
	}
	function Ms(e) {
		var t = Bi(e, 2);
		t !== null && Jd(t, e, 2);
	}
	function Ns(e) {
		var t = _s();
		if (typeof e == "function") {
			var n = e;
			if (e = n(), rs) {
				ut(!0);
				try {
					n();
				} finally {
					ut(!1);
				}
			}
		}
		return t.memoizedState = t.baseState = e, t.queue = {
			pending: null,
			lanes: 0,
			dispatch: null,
			lastRenderedReducer: Cs,
			lastRenderedState: e
		}, t;
	}
	function Ps(e, t, n, r) {
		return e.baseState = n, Ts(e, $o, typeof r == "function" ? r : Cs);
	}
	function Fs(e, t, n, r, i) {
		if (Cc(e)) throw Error(a(485));
		if (e = t.action, e !== null) {
			var o = {
				payload: i,
				action: e,
				next: null,
				isTransition: !0,
				status: "pending",
				value: null,
				reason: null,
				listeners: [],
				then: function(e) {
					o.listeners.push(e);
				}
			};
			w.T === null ? o.isTransition = !1 : n(!0), r(o), n = t.pending, n === null ? (o.next = t.pending = o, Is(t, o)) : (o.next = n.next, t.pending = n.next = o);
		}
	}
	function Is(e, t) {
		var n = t.action, r = t.payload, i = e.state;
		if (t.isTransition) {
			var a = w.T, o = {};
			o.types = a === null ? null : a.types, w.T = o;
			try {
				var s = n(i, r), c = w.S;
				c !== null && c(o, s), Ls(e, t, s);
			} catch (n) {
				zs(e, t, n);
			} finally {
				a !== null && o.types !== null && (a.types = o.types), w.T = a;
			}
		} else try {
			a = n(i, r), Ls(e, t, a);
		} catch (n) {
			zs(e, t, n);
		}
	}
	function Ls(e, t, n) {
		typeof n == "object" && n && typeof n.then == "function" ? n.then(function(n) {
			Rs(e, t, n);
		}, function(n) {
			return zs(e, t, n);
		}) : Rs(e, t, n);
	}
	function Rs(e, t, n) {
		t.status = "fulfilled", t.value = n, Bs(t), e.state = n, t = e.pending, t !== null && (n = t.next, n === t ? e.pending = null : (n = n.next, t.next = n, Is(e, n)));
	}
	function zs(e, t, n) {
		var r = e.pending;
		if (e.pending = null, r !== null) {
			r = r.next;
			do
				t.status = "rejected", t.reason = n, Bs(t), t = t.next;
			while (t !== r);
		}
		e.action = null;
	}
	function Bs(e) {
		e = e.listeners;
		for (var t = 0; t < e.length; t++) (0, e[t])();
	}
	function Vs(e, t) {
		return t;
	}
	function Hs(e, t) {
		if (D) {
			var n = md.formState;
			if (n !== null) {
				a: {
					var r = j;
					if (D) {
						if (_a) {
							b: {
								for (var i = _a, a = ya; i.nodeType !== 8;) {
									if (!a) {
										i = null;
										break b;
									}
									if (i = Tm(i.nextSibling), i === null) {
										i = null;
										break b;
									}
								}
								a = i.data, i = a === "F!" || a === "F" ? i : null;
							}
							if (i) {
								_a = Tm(i.nextSibling), r = i.data === "F!";
								break a;
							}
						}
						xa(r);
					}
					r = !1;
				}
				r && (t = n[0]);
			}
		}
		return n = _s(), n.memoizedState = n.baseState = t, r = {
			pending: null,
			lanes: 0,
			dispatch: null,
			lastRenderedReducer: Vs,
			lastRenderedState: t
		}, n.queue = r, n = bc.bind(null, j, r), r.dispatch = n, r = Ns(!1), a = Sc.bind(null, j, !1, r.queue), r = _s(), i = {
			state: t,
			dispatch: null,
			action: e,
			pending: null
		}, r.queue = i, n = Fs.bind(null, j, i, a, n), i.dispatch = n, r.memoizedState = e, [
			t,
			n,
			!1
		];
	}
	function Us(e) {
		return Ws(vs(), $o, e);
	}
	function Ws(e, t, n) {
		if (t = Ts(e, t, Vs)[0], e = ws(Cs)[0], typeof t == "object" && t && typeof t.then == "function") try {
			var r = bs(t);
		} catch (e) {
			throw e === ao ? so : e;
		}
		else r = t;
		t = vs();
		var i = t.queue, a = i.dispatch;
		return n !== t.memoizedState && (j.flags |= 2048, qs(9, { destroy: void 0 }, Gs.bind(null, i, n), null)), [
			r,
			a,
			e
		];
	}
	function Gs(e, t) {
		e.action = t;
	}
	function Ks(e) {
		var t = vs(), n = $o;
		if (n !== null) return Ws(t, n, e);
		vs(), t = t.memoizedState, n = vs();
		var r = n.queue.dispatch;
		return n.memoizedState = e, [
			t,
			r,
			!1
		];
	}
	function qs(e, t, n, r) {
		return e = {
			tag: e,
			create: n,
			deps: r,
			inst: t,
			next: null
		}, t = j.updateQueue, t === null && (t = ys(), j.updateQueue = t), n = t.lastEffect, n === null ? t.lastEffect = e.next = e : (r = n.next, n.next = e, e.next = r, t.lastEffect = e), e;
	}
	function Js() {
		return vs().memoizedState;
	}
	function Ys(e, t, n, r) {
		var i = _s();
		j.flags |= e, i.memoizedState = qs(1 | t, { destroy: void 0 }, n, r === void 0 ? null : r);
	}
	function Xs(e, t, n, r) {
		var i = vs();
		r = r === void 0 ? null : r;
		var a = i.memoizedState.inst;
		$o !== null && r !== null && ls(r, $o.memoizedState.deps) ? i.memoizedState = qs(t, a, n, r) : (j.flags |= e, i.memoizedState = qs(1 | t, a, n, r));
	}
	function Zs(e, t) {
		Ys(8390656, 8, e, t);
	}
	function Qs(e, t) {
		Xs(2048, 8, e, t);
	}
	function $s(e) {
		j.flags |= 4;
		var t = j.updateQueue;
		if (t === null) t = ys(), j.updateQueue = t, t.events = [e];
		else {
			var n = t.events;
			n === null ? t.events = [e] : n.push(e);
		}
	}
	function ec(e) {
		var t = vs().memoizedState;
		return $s({
			ref: t,
			nextImpl: e
		}), function() {
			if (pd & 2) throw Error(a(440));
			return t.impl.apply(void 0, arguments);
		};
	}
	function tc(e, t) {
		return Xs(4, 2, e, t);
	}
	function nc(e, t) {
		return Xs(4, 4, e, t);
	}
	function rc(e, t) {
		if (typeof t == "function") {
			e = e();
			var n = t(e);
			return function() {
				typeof n == "function" ? n() : t(null);
			};
		}
		if (t != null) return e = e(), t.current = e, function() {
			t.current = null;
		};
	}
	function ic(e, t, n) {
		n = n == null ? null : n.concat([e]), Xs(4, 4, rc.bind(null, t, e), n);
	}
	function ac() {}
	function oc(e, t) {
		var n = vs();
		t = t === void 0 ? null : t;
		var r = n.memoizedState;
		return t !== null && ls(t, r[1]) ? r[0] : (n.memoizedState = [e, t], e);
	}
	function sc(e, t) {
		var n = vs();
		t = t === void 0 ? null : t;
		var r = n.memoizedState;
		if (t !== null && ls(t, r[1])) return r[0];
		if (r = e(), rs) {
			ut(!0);
			try {
				e();
			} finally {
				ut(!1);
			}
		}
		return n.memoizedState = [r, t], r;
	}
	function cc(e, t, n) {
		return n === void 0 || Qo & 1073741824 && !(P & 261930) ? e.memoizedState = t : (e.memoizedState = n, e = Kd(), j.lanes |= e, xd |= e, n);
	}
	function lc(e, t, n, r) {
		return ei(n, t) ? n : Io.current === null ? !(Qo & 106) || Qo & 1073741824 && !(P & 261930) ? (Gc = !0, e.memoizedState = n) : (e = Kd(), j.lanes |= e, xd |= e, t) : (e = cc(e, n, r), ei(e, t) || (Gc = !0), e);
	}
	function uc(e, t, n, r, i) {
		var a = De.p;
		De.p = a !== 0 && 8 > a ? a : 8;
		var o = w.T, s = {};
		s.types = o === null ? null : o.types, w.T = s, Sc(e, !1, t, n);
		try {
			var c = i(), l = w.S;
			l !== null && l(s, c), typeof c == "object" && c && typeof c.then == "function" ? xc(e, t, eo(c, r), Gd(e)) : xc(e, t, r, Gd(e));
		} catch (n) {
			xc(e, t, {
				then: function() {},
				status: "rejected",
				reason: n
			}, Gd());
		} finally {
			De.p = a, o !== null && s.types !== null && (o.types = s.types), w.T = o;
		}
	}
	function dc() {}
	function fc(e, t, n, r) {
		if (e.tag !== 5) throw Error(a(476));
		var i = pc(e).queue;
		uc(e, i, t, Oe, n === null ? dc : function() {
			return mc(e), n(r);
		});
	}
	function pc(e) {
		var t = e.memoizedState;
		if (t !== null) return t;
		t = {
			memoizedState: Oe,
			baseState: Oe,
			baseQueue: null,
			queue: {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: Cs,
				lastRenderedState: Oe
			},
			next: null
		};
		var n = {};
		return t.next = {
			memoizedState: n,
			baseState: n,
			baseQueue: null,
			queue: {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: Cs,
				lastRenderedState: n
			},
			next: null
		}, e.memoizedState = t, e = e.alternate, e !== null && (e.memoizedState = t), t;
	}
	function mc(e) {
		var t = pc(e);
		t.next === null && (t = e.alternate.memoizedState), xc(e, t.next.queue, {}, Gd());
	}
	function hc() {
		return Ra(bh);
	}
	function gc() {
		return vs().memoizedState;
	}
	function _c() {
		return vs().memoizedState;
	}
	function vc(e) {
		for (var t = e.return; t !== null;) {
			switch (t.tag) {
				case 24:
				case 3:
					var n = Gd();
					e = Do(n);
					var r = Oo(t, e, n);
					r !== null && (Jd(r, t, n), ko(r, t, n)), t = { cache: k() }, e.payload = t;
					return;
			}
			t = t.return;
		}
	}
	function yc(e, t, n) {
		var r = Gd();
		n = {
			lane: r,
			revertLane: 0,
			gesture: null,
			action: n,
			hasEagerState: !1,
			eagerState: null,
			next: null
		}, Cc(e) ? wc(t, n) : (n = zi(e, t, n, r), n !== null && (Jd(n, e, r), Tc(n, t, r)));
	}
	function bc(e, t, n) {
		xc(e, t, n, Gd());
	}
	function xc(e, t, n, r) {
		var i = {
			lane: r,
			revertLane: 0,
			gesture: null,
			action: n,
			hasEagerState: !1,
			eagerState: null,
			next: null
		};
		if (Cc(e)) wc(t, i);
		else {
			var a = e.alternate;
			if (e.lanes === 0 && (a === null || a.lanes === 0) && (a = t.lastRenderedReducer, a !== null)) try {
				var o = t.lastRenderedState, s = a(o, n);
				if (i.hasEagerState = !0, i.eagerState = s, ei(s, o)) return Ri(e, t, i, 0), md === null && Li(), !1;
			} catch {}
			if (n = zi(e, t, i, r), n !== null) return Jd(n, e, r), Tc(n, t, r), !0;
		}
		return !1;
	}
	function Sc(e, t, n, r) {
		if (r = {
			lane: 2,
			revertLane: Yf(),
			gesture: null,
			action: r,
			hasEagerState: !1,
			eagerState: null,
			next: null
		}, Cc(e)) {
			if (t) throw Error(a(479));
		} else t = zi(e, n, r, 2), t !== null && Jd(t, e, 2);
	}
	function Cc(e) {
		var t = e.alternate;
		return e === j || t !== null && t === j;
	}
	function wc(e, t) {
		ns = ts = !0;
		var n = e.pending;
		n === null ? t.next = t : (t.next = n.next, n.next = t), e.pending = t;
	}
	function Tc(e, t, n) {
		if (n & 4194048) {
			var r = t.lanes;
			r &= e.pendingLanes, n |= r, t.lanes = n, Ot(e, n);
		}
	}
	var Ec = {
		readContext: Ra,
		use: xs,
		useCallback: cs,
		useContext: cs,
		useEffect: cs,
		useImperativeHandle: cs,
		useLayoutEffect: cs,
		useInsertionEffect: cs,
		useMemo: cs,
		useReducer: cs,
		useRef: cs,
		useState: cs,
		useDebugValue: cs,
		useDeferredValue: cs,
		useTransition: cs,
		useSyncExternalStore: cs,
		useId: cs,
		useHostTransitionStatus: cs,
		useFormState: cs,
		useActionState: cs,
		useOptimistic: cs,
		useMemoCache: cs,
		useCacheRefresh: cs,
		useEffectEvent: cs
	}, Dc = {
		readContext: Ra,
		use: xs,
		useCallback: function(e, t) {
			return _s().memoizedState = [e, t === void 0 ? null : t], e;
		},
		useContext: Ra,
		useEffect: Zs,
		useImperativeHandle: function(e, t, n) {
			n = n == null ? null : n.concat([e]), Ys(4194308, 4, rc.bind(null, t, e), n);
		},
		useLayoutEffect: function(e, t) {
			return Ys(4194308, 4, e, t);
		},
		useInsertionEffect: function(e, t) {
			Ys(4, 2, e, t);
		},
		useMemo: function(e, t) {
			var n = _s();
			t = t === void 0 ? null : t;
			var r = e();
			if (rs) {
				ut(!0);
				try {
					e();
				} finally {
					ut(!1);
				}
			}
			return n.memoizedState = [r, t], r;
		},
		useReducer: function(e, t, n) {
			var r = _s();
			if (n !== void 0) {
				var i = n(t);
				if (rs) {
					ut(!0);
					try {
						n(t);
					} finally {
						ut(!1);
					}
				}
			} else i = t;
			return r.memoizedState = r.baseState = i, e = {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: e,
				lastRenderedState: i
			}, r.queue = e, e = e.dispatch = yc.bind(null, j, e), [r.memoizedState, e];
		},
		useRef: function(e) {
			var t = _s();
			return e = { current: e }, t.memoizedState = e;
		},
		useState: function(e) {
			e = Ns(e);
			var t = e.queue, n = bc.bind(null, j, t);
			return t.dispatch = n, [e.memoizedState, n];
		},
		useDebugValue: ac,
		useDeferredValue: function(e, t) {
			return cc(_s(), e, t);
		},
		useTransition: function() {
			var e = Ns(!1);
			return e = uc.bind(null, j, e.queue, !0, !1), _s().memoizedState = e, [!1, e];
		},
		useSyncExternalStore: function(e, t, n) {
			var r = j, i = _s();
			if (D) {
				if (n === void 0) throw Error(a(407));
				n = n();
			} else {
				if (n = t(), md === null) throw Error(a(349));
				P & 127 || Os(r, t, n);
			}
			i.memoizedState = n;
			var o = {
				value: n,
				getSnapshot: t
			};
			return i.queue = o, Zs(As.bind(null, r, o, e), [e]), r.flags |= 2048, qs(9, { destroy: void 0 }, ks.bind(null, r, o, n, t), null), n;
		},
		useId: function() {
			var e = _s(), t = md.identifierPrefix;
			if (D) {
				var n = ua, r = la;
				n = (r & ~(1 << 32 - dt(r) - 1)).toString(32) + n, t = "_" + t + "R_" + n, n = is++, 0 < n && (t += "H" + n.toString(32)), t += "_";
			} else n = ss++, t = "_" + t + "r_" + n.toString(32) + "_";
			return e.memoizedState = t;
		},
		useHostTransitionStatus: hc,
		useFormState: Hs,
		useActionState: Hs,
		useOptimistic: function(e) {
			var t = _s();
			t.memoizedState = t.baseState = e;
			var n = {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: null,
				lastRenderedState: null
			};
			return t.queue = n, t = Sc.bind(null, j, !0, n), n.dispatch = t, [e, t];
		},
		useMemoCache: Ss,
		useCacheRefresh: function() {
			return _s().memoizedState = vc.bind(null, j);
		},
		useEffectEvent: function(e) {
			var t = _s(), n = { impl: e };
			return t.memoizedState = n, function() {
				if (pd & 2) throw Error(a(440));
				return n.impl.apply(void 0, arguments);
			};
		}
	}, Oc = {
		readContext: Ra,
		use: xs,
		useCallback: oc,
		useContext: Ra,
		useEffect: Qs,
		useImperativeHandle: ic,
		useInsertionEffect: tc,
		useLayoutEffect: nc,
		useMemo: sc,
		useReducer: ws,
		useRef: Js,
		useState: function() {
			return ws(Cs);
		},
		useDebugValue: ac,
		useDeferredValue: function(e, t) {
			return lc(vs(), $o.memoizedState, e, t);
		},
		useTransition: function() {
			var e = ws(Cs)[0], t = vs().memoizedState;
			return [typeof e == "boolean" ? e : bs(e), t];
		},
		useSyncExternalStore: Ds,
		useId: gc,
		useHostTransitionStatus: hc,
		useFormState: Us,
		useActionState: Us,
		useOptimistic: function(e, t) {
			return Ps(vs(), $o, e, t);
		},
		useMemoCache: Ss,
		useCacheRefresh: _c,
		useEffectEvent: ec
	}, kc = {
		readContext: Ra,
		use: xs,
		useCallback: oc,
		useContext: Ra,
		useEffect: Qs,
		useImperativeHandle: ic,
		useInsertionEffect: tc,
		useLayoutEffect: nc,
		useMemo: sc,
		useReducer: Es,
		useRef: Js,
		useState: function() {
			return Es(Cs);
		},
		useDebugValue: ac,
		useDeferredValue: function(e, t) {
			var n = vs();
			return $o === null ? cc(n, e, t) : lc(n, $o.memoizedState, e, t);
		},
		useTransition: function() {
			var e = Es(Cs)[0], t = vs().memoizedState;
			return [typeof e == "boolean" ? e : bs(e), t];
		},
		useSyncExternalStore: Ds,
		useId: gc,
		useHostTransitionStatus: hc,
		useFormState: Ks,
		useActionState: Ks,
		useOptimistic: function(e, t) {
			var n = vs();
			return $o === null ? (n.baseState = e, [e, n.queue.dispatch]) : Ps(n, $o, e, t);
		},
		useMemoCache: Ss,
		useCacheRefresh: _c,
		useEffectEvent: ec
	};
	function Ac(e, t, n, r) {
		t = e.memoizedState, n = n(r, t), n = n == null ? t : x({}, t, n), e.memoizedState = n, e.lanes === 0 && (e.updateQueue.baseState = n);
	}
	var jc = {
		enqueueSetState: function(e, t, n) {
			e = e._reactInternals;
			var r = Gd(), i = Do(r);
			i.payload = t, n != null && (i.callback = n), t = Oo(e, i, r), t !== null && (Jd(t, e, r), ko(t, e, r));
		},
		enqueueReplaceState: function(e, t, n) {
			e = e._reactInternals;
			var r = Gd(), i = Do(r);
			i.tag = 1, i.payload = t, n != null && (i.callback = n), t = Oo(e, i, r), t !== null && (Jd(t, e, r), ko(t, e, r));
		},
		enqueueForceUpdate: function(e, t) {
			e = e._reactInternals;
			var n = Gd(), r = Do(n);
			r.tag = 2, t != null && (r.callback = t), t = Oo(e, r, n), t !== null && (Jd(t, e, n), ko(t, e, n));
		}
	};
	function Mc(e, t, n, r, i, a, o) {
		return e = e.stateNode, typeof e.shouldComponentUpdate == "function" ? e.shouldComponentUpdate(r, a, o) : t.prototype && t.prototype.isPureReactComponent ? !ti(n, r) || !ti(i, a) : !0;
	}
	function Nc(e, t, n, r) {
		e = t.state, typeof t.componentWillReceiveProps == "function" && t.componentWillReceiveProps(n, r), typeof t.UNSAFE_componentWillReceiveProps == "function" && t.UNSAFE_componentWillReceiveProps(n, r), t.state !== e && jc.enqueueReplaceState(t, t.state, null);
	}
	function Pc(e, t) {
		var n = t;
		if ("ref" in t) for (var r in n = {}, t) r !== "ref" && (n[r] = t[r]);
		if (e = e.defaultProps) for (var i in n === t && (n = x({}, n)), e) n[i] === void 0 && (n[i] = e[i]);
		return n;
	}
	function Fc(e) {
		Ni(e);
	}
	function Ic(e) {
		console.error(e);
	}
	function Lc(e) {
		Ni(e);
	}
	function Rc(e, t) {
		try {
			var n = e.onUncaughtError;
			n(t.value, { componentStack: t.stack });
		} catch (e) {
			setTimeout(function() {
				throw e;
			});
		}
	}
	function zc(e, t, n) {
		try {
			var r = e.onCaughtError;
			r(n.value, {
				componentStack: n.stack,
				errorBoundary: t.tag === 1 ? t.stateNode : null
			});
		} catch (e) {
			setTimeout(function() {
				throw e;
			});
		}
	}
	function Bc(e, t, n) {
		return n = Do(n), n.tag = 3, n.payload = { element: null }, n.callback = function() {
			Rc(e, t);
		}, n;
	}
	function Vc(e) {
		return e = Do(e), e.tag = 3, e;
	}
	function Hc(e, t, n, r) {
		var i = n.type.getDerivedStateFromError;
		if (typeof i == "function") {
			var a = r.value;
			e.payload = function() {
				return i(a);
			}, e.callback = function() {
				zc(t, n, r);
			};
		}
		var o = n.stateNode;
		o !== null && typeof o.componentDidCatch == "function" && (e.callback = function() {
			zc(t, n, r), typeof i != "function" && (I === null ? I = /* @__PURE__ */ new Set([this]) : I.add(this));
			var e = r.stack;
			this.componentDidCatch(r.value, { componentStack: e === null ? "" : e });
		});
	}
	function Uc(e, t, n, r, i) {
		if (n.flags |= 32768, typeof r == "object" && r && typeof r.then == "function") {
			if (t = n.alternate, t !== null && Fa(t, n, i, !0), n = Vo.current, n !== null) {
				switch (n.tag) {
					case 31:
					case 13:
					case 19: return Ho === null ? sf() : n.alternate === null && bd === 0 && (bd = 3), n.flags &= -257, n.flags |= 65536, n.lanes = i, r === co ? n.flags |= 16384 : (t = n.updateQueue, t === null ? n.updateQueue = /* @__PURE__ */ new Set([r]) : t.add(r), kf(e, r, i)), !1;
					case 22: return n.flags |= 65536, r === co ? n.flags |= 16384 : (t = n.updateQueue, t === null ? (t = {
						transitions: null,
						markerInstances: null,
						retryQueue: /* @__PURE__ */ new Set([r])
					}, n.updateQueue = t) : (n = t.retryQueue, n === null ? t.retryQueue = /* @__PURE__ */ new Set([r]) : n.add(r)), kf(e, r, i)), !1;
				}
				throw Error(a(435, n.tag));
			}
			return kf(e, r, i), sf(), !1;
		}
		if (D) return t = Vo.current, t === null ? (r !== ba && (t = Error(a(423), { cause: r }), Da(ta(t, n))), e = e.current.alternate, e.flags |= 65536, i &= -i, e.lanes |= i, r = ta(r, n), i = Bc(e.stateNode, r, i), Ao(e, i), bd !== 4 && (bd = 2)) : (!(t.flags & 65536) && (t.flags |= 256), t.flags |= 65536, t.lanes = i, r !== ba && (e = Error(a(422), { cause: r }), Da(ta(e, n)))), !1;
		var o = Error(a(520), { cause: r });
		if (o = ta(o, n), Ed === null ? Ed = [o] : Ed.push(o), bd !== 4 && (bd = 2), t === null) return !0;
		r = ta(r, n), n = t;
		do {
			switch (n.tag) {
				case 3: return n.flags |= 65536, e = i & -i, n.lanes |= e, e = Bc(n.stateNode, r, e), Ao(n, e), !1;
				case 1:
					if (t = n.type, o = n.stateNode, !(n.flags & 128) && (typeof t.getDerivedStateFromError == "function" || o !== null && typeof o.componentDidCatch == "function" && (I === null || !I.has(o)))) return n.flags |= 65536, i &= -i, n.lanes |= i, i = Vc(i), Hc(i, e, n, r), Ao(n, i), !1;
					break;
				case 22: if (n.memoizedState !== null) return n.flags |= 65536, !1;
			}
			n = n.return;
		} while (n !== null);
		return !1;
	}
	var Wc = Error(a(461)), Gc = !1;
	function Kc(e, t, n, r) {
		t.child = e === null ? Co(t, null, n, r) : So(t, e.child, n, r);
	}
	function qc(e, t, n, r, i) {
		n = n.render;
		var a = t.ref;
		if ("ref" in r) {
			var o = {};
			for (var s in r) s !== "ref" && (o[s] = r[s]);
		} else o = r;
		return La(t), r = us(e, t, n, o, a, i), s = ms(), e !== null && !Gc ? (hs(e, t, i), xl(e, t, i)) : (D && s && pa(t), t.flags |= 1, Kc(e, t, r, i), t.child);
	}
	function Jc(e, t, n, r, i) {
		if (e === null) {
			var a = n.type;
			return typeof a == "function" && !Ki(a) && a.defaultProps === void 0 && n.compare === null ? (t.tag = 15, t.type = a, Yc(e, t, a, r, i)) : (e = Yi(n.type, null, r, t, t.mode, i), e.ref = t.ref, e.return = t, t.child = e);
		}
		if (a = e.child, !Sl(e, i)) {
			var o = a.memoizedProps;
			if (n = n.compare, n = n === null ? ti : n, n(o, r) && e.ref === t.ref) return xl(e, t, i);
		}
		return t.flags |= 1, e = qi(a, r), e.ref = t.ref, e.return = t, t.child = e;
	}
	function Yc(e, t, n, r, i) {
		if (e !== null) {
			var a = e.memoizedProps;
			if (ti(a, r) && e.ref === t.ref) {
				if (Gc = !1, t.pendingProps = r = a, Sl(e, i)) e.flags & 131072 && (Gc = !0);
				else return t.lanes = e.lanes, xl(e, t, i);
			}
		}
		return rl(e, t, n, r, i);
	}
	function Xc(e, t, n, r) {
		var i = r.children, a = e === null ? null : e.memoizedState;
		if (e === null && t.stateNode === null && (t.stateNode = {
			_visibility: 1,
			_pendingMarkers: null,
			_retryCache: null,
			_transitions: null
		}), r.mode === "hidden") {
			if (t.flags & 128) {
				if (a = a === null ? n : a.baseLanes | n, e !== null) {
					for (r = t.child = e.child, i = 0; r !== null;) i = i | r.lanes | r.childLanes, r = r.sibling;
					r = i & ~a;
				} else r = 0, t.child = null;
				return Qc(e, t, a, n, r);
			}
			if (n & 536870912) t.memoizedState = {
				baseLanes: 0,
				cachePool: null
			}, e !== null && ro(t, a === null ? null : a.cachePool), a === null ? zo() : Ro(t, a), Go(t);
			else return r = t.lanes = 536870912, Qc(e, t, a === null ? n : a.baseLanes | n, n, r);
		} else a === null ? (e !== null && ro(t, null), zo(), Ko()) : (ro(t, a.cachePool), Ro(t, a), Ko(), t.memoizedState = null);
		return Kc(e, t, i, n), t.child;
	}
	function Zc(e, t) {
		return e !== null && e.tag === 22 || t.stateNode !== null || (t.stateNode = {
			_visibility: 1,
			_pendingMarkers: null,
			_retryCache: null,
			_transitions: null
		}), t.sibling;
	}
	function Qc(e, t, n, r, i) {
		var a = no();
		return a = a === null ? null : {
			parent: O._currentValue,
			pool: a
		}, t.memoizedState = {
			baseLanes: n,
			cachePool: a
		}, e !== null && ro(t, null), zo(), Go(t), e !== null && Fa(e, t, r, !0), t.childLanes = i, null;
	}
	function $c(e, t) {
		return t = fl({
			mode: t.mode,
			children: t.children
		}, e.mode), t.ref = e.ref, e.child = t, t.return = e, t;
	}
	function el(e, t, n) {
		return So(t, e.child, null, n), e = $c(t, t.pendingProps), e.flags |= 2, qo(t), t.memoizedState = null, e;
	}
	function tl(e, t, n) {
		var r = t.pendingProps, i = !!(t.flags & 128);
		if (t.flags &= -129, e === null) {
			if (D) {
				if (r.mode === "hidden") return e = $c(t, r), t.lanes = 536870912, e.memoizedState = {
					baseLanes: 0,
					cachePool: null
				}, Zc(null, e);
				if (Wo(t), (e = _a) ? (e = xm(e, ya), e = e !== null && e.data === "&" ? e : null, e !== null && (t.memoizedState = {
					dehydrated: e,
					treeContext: ca === null ? null : {
						id: la,
						overflow: ua
					},
					retryLane: 536870912,
					hydrationErrors: null
				}, n = Qi(e), n.return = t, t.child = n, ga = t, _a = null)) : e = null, e === null) throw xa(t);
				return t.lanes = 536870912, null;
			}
			return $c(t, r);
		}
		var o = e.memoizedState;
		if (o !== null) {
			var s = o.dehydrated;
			if (Wo(t), i) {
				if (t.flags & 256) t.flags &= -257, t = el(e, t, n);
				else if (t.memoizedState !== null) t.child = e.child, t.flags |= 128, t = null;
				else throw Error(a(558));
			} else if (Gc || Fa(e, t, n, !1), i = (n & e.childLanes) !== 0, Gc || i) {
				if (Io.current === null) {
					if (r = md, r !== null && (s = kt(r, n), s !== 0 && s !== o.retryLane)) throw o.retryLane = s, Bi(e, s), Jd(r, e, s), Wc;
					sf();
				}
				t = el(e, t, n);
			} else e = o.treeContext, _a = Tm(s.nextSibling), ga = t, D = !0, va = null, ya = !1, e !== null && ha(t, e), t = $c(t, r), t.flags |= 134221824;
			return t;
		}
		return e = qi(e.child, {
			mode: r.mode,
			children: r.children
		}), e.ref = t.ref, t.child = e, e.return = t, e;
	}
	function nl(e, t) {
		var n = t.ref;
		if (n === null) e !== null && e.ref !== null && (t.flags |= 4194816);
		else {
			if (typeof n != "function" && typeof n != "object") throw Error(a(284));
			(e === null || e.ref !== n) && (t.flags |= 4194816);
		}
	}
	function rl(e, t, n, r, i) {
		return La(t), n = us(e, t, n, r, void 0, i), r = ms(), e !== null && !Gc ? (hs(e, t, i), xl(e, t, i)) : (D && r && pa(t), t.flags |= 1, Kc(e, t, n, i), t.child);
	}
	function il(e, t, n, r, i, a) {
		return La(t), t.updateQueue = null, n = fs(t, r, n, i), ds(e), r = ms(), e !== null && !Gc ? (hs(e, t, a), xl(e, t, a)) : (D && r && pa(t), t.flags |= 1, Kc(e, t, n, a), t.child);
	}
	function al(e, t, n, r, i) {
		if (La(t), t.stateNode === null) {
			var a = Ui, o = n.contextType;
			typeof o == "object" && o && (a = Ra(o)), a = new n(r, a), t.memoizedState = a.state !== null && a.state !== void 0 ? a.state : null, a.updater = jc, t.stateNode = a, a._reactInternals = t, a = t.stateNode, a.props = r, a.state = t.memoizedState, a.refs = {}, To(t), o = n.contextType, a.context = typeof o == "object" && o ? Ra(o) : Ui, a.state = t.memoizedState, o = n.getDerivedStateFromProps, typeof o == "function" && (Ac(t, n, o, r), a.state = t.memoizedState), typeof n.getDerivedStateFromProps == "function" || typeof a.getSnapshotBeforeUpdate == "function" || typeof a.UNSAFE_componentWillMount != "function" && typeof a.componentWillMount != "function" || (o = a.state, typeof a.componentWillMount == "function" && a.componentWillMount(), typeof a.UNSAFE_componentWillMount == "function" && a.UNSAFE_componentWillMount(), o !== a.state && jc.enqueueReplaceState(a, a.state, null), No(t, r, a, i), Mo(), a.state = t.memoizedState), typeof a.componentDidMount == "function" && (t.flags |= 4194308), r = !0;
		} else if (e === null) {
			a = t.stateNode;
			var s = t.memoizedProps, c = Pc(n, s);
			a.props = c;
			var l = a.context, u = n.contextType;
			o = Ui, typeof u == "object" && u && (o = Ra(u));
			var d = n.getDerivedStateFromProps;
			u = typeof d == "function" || typeof a.getSnapshotBeforeUpdate == "function", s = t.pendingProps !== s, u || typeof a.UNSAFE_componentWillReceiveProps != "function" && typeof a.componentWillReceiveProps != "function" || (s || l !== o) && Nc(t, a, r, o), wo = !1;
			var f = t.memoizedState;
			a.state = f, No(t, r, a, i), Mo(), l = t.memoizedState, s || f !== l || wo ? (typeof d == "function" && (Ac(t, n, d, r), l = t.memoizedState), (c = wo || Mc(t, n, c, r, f, l, o)) ? (u || typeof a.UNSAFE_componentWillMount != "function" && typeof a.componentWillMount != "function" || (typeof a.componentWillMount == "function" && a.componentWillMount(), typeof a.UNSAFE_componentWillMount == "function" && a.UNSAFE_componentWillMount()), typeof a.componentDidMount == "function" && (t.flags |= 4194308)) : (typeof a.componentDidMount == "function" && (t.flags |= 4194308), t.memoizedProps = r, t.memoizedState = l), a.props = r, a.state = l, a.context = o, r = c) : (typeof a.componentDidMount == "function" && (t.flags |= 4194308), r = !1);
		} else {
			a = t.stateNode, Eo(e, t), o = t.memoizedProps, u = Pc(n, o), a.props = u, d = t.pendingProps, f = a.context, l = n.contextType, c = Ui, typeof l == "object" && l && (c = Ra(l)), s = n.getDerivedStateFromProps, (l = typeof s == "function" || typeof a.getSnapshotBeforeUpdate == "function") || typeof a.UNSAFE_componentWillReceiveProps != "function" && typeof a.componentWillReceiveProps != "function" || (o !== d || f !== c) && Nc(t, a, r, c), wo = !1, f = t.memoizedState, a.state = f, No(t, r, a, i), Mo();
			var p = t.memoizedState;
			o !== d || f !== p || wo || e !== null && e.dependencies !== null && Ia(e.dependencies) ? (typeof s == "function" && (Ac(t, n, s, r), p = t.memoizedState), (u = wo || Mc(t, n, u, r, f, p, c) || e !== null && e.dependencies !== null && Ia(e.dependencies)) ? (l || typeof a.UNSAFE_componentWillUpdate != "function" && typeof a.componentWillUpdate != "function" || (typeof a.componentWillUpdate == "function" && a.componentWillUpdate(r, p, c), typeof a.UNSAFE_componentWillUpdate == "function" && a.UNSAFE_componentWillUpdate(r, p, c)), typeof a.componentDidUpdate == "function" && (t.flags |= 4), typeof a.getSnapshotBeforeUpdate == "function" && (t.flags |= 1024)) : (typeof a.componentDidUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 4), typeof a.getSnapshotBeforeUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 1024), t.memoizedProps = r, t.memoizedState = p), a.props = r, a.state = p, a.context = c, r = u) : (typeof a.componentDidUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 4), typeof a.getSnapshotBeforeUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 1024), r = !1);
		}
		return a = r, nl(e, t), r = !!(t.flags & 128), a || r ? (a = t.stateNode, n = r && typeof n.getDerivedStateFromError != "function" ? null : a.render(), t.flags |= 1, e !== null && r ? (t.child = So(t, e.child, null, i), t.child = So(t, null, n, i)) : Kc(e, t, n, i), t.memoizedState = a.state, e = t.child) : e = xl(e, t, i), e;
	}
	function ol(e, t, n, r) {
		return Ta(), t.flags |= 256, Kc(e, t, n, r), t.child;
	}
	var sl = {
		dehydrated: null,
		treeContext: null,
		retryLane: 0,
		hydrationErrors: null
	};
	function cl(e) {
		return {
			baseLanes: e,
			cachePool: io()
		};
	}
	function ll(e, t, n) {
		return e = e === null ? 0 : e.childLanes & ~n, t && (e |= wd), e;
	}
	function ul(e, t, n) {
		var r = t.pendingProps, i = !1, a = !!(t.flags & 128), o;
		if ((o = a) || (o = e !== null && e.memoizedState === null ? !1 : !!(Jo.current & 2)), o && (i = !0, t.flags &= -129), o = !!(t.flags & 32), t.flags &= -33, e === null) {
			if (D) {
				if (i ? Uo(t) : Ko(), (e = _a) ? (e = xm(e, ya), e = e !== null && e.data !== "&" ? e : null, e !== null && (t.memoizedState = {
					dehydrated: e,
					treeContext: ca === null ? null : {
						id: la,
						overflow: ua
					},
					retryLane: 536870912,
					hydrationErrors: null
				}, n = Qi(e), n.return = t, t.child = n, ga = t, _a = null)) : e = null, e === null) throw xa(t);
				return t.lanes = Cm(e) ? 32 : 536870912, null;
			}
			return a = r.children, r = r.fallback, i ? (Ko(), i = t.mode, a = fl({
				mode: "hidden",
				children: a
			}, i), r = Xi(r, i, n, null), a.return = t, r.return = t, a.sibling = r, t.child = a, r = t.child, r.memoizedState = cl(n), r.childLanes = ll(e, o, n), t.memoizedState = sl, Zc(null, r)) : (Uo(t), dl(t, a));
		}
		var s = e.memoizedState;
		if (s !== null) {
			var c = s.dehydrated;
			if (c !== null) return ml(e, t, a, o, r, c, s, n);
		}
		return i ? (Ko(), i = r.fallback, a = t.mode, s = e.child, c = s.sibling, r = qi(s, {
			mode: "hidden",
			children: r.children
		}), r.subtreeFlags = s.subtreeFlags & 1206910976, c === null ? (i = Xi(i, a, n, null), i.flags |= 2) : i = qi(c, i), i.return = t, r.return = t, r.sibling = i, t.child = r, Zc(null, r), r = t.child, i = e.child.memoizedState, i === null ? i = cl(n) : (a = i.cachePool, a === null ? a = io() : (s = O._currentValue, a = a.parent === s ? a : {
			parent: s,
			pool: s
		}), i = {
			baseLanes: i.baseLanes | n,
			cachePool: a
		}), r.memoizedState = i, r.childLanes = ll(e, o, n), t.memoizedState = sl, Zc(e.child, r)) : (Uo(t), n = e.child, e = n.sibling, n = qi(n, {
			mode: "visible",
			children: r.children
		}), n.return = t, n.sibling = null, e !== null && (o = t.deletions, o === null ? (t.deletions = [e], t.flags |= 16) : o.push(e)), t.child = n, t.memoizedState = null, n);
	}
	function dl(e, t) {
		return t = fl({
			mode: "visible",
			children: t
		}, e.mode), t.return = e, e.child = t;
	}
	function fl(e, t) {
		return e = Gi(22, e, null, t), e.lanes = 0, e;
	}
	function pl(e, t, n) {
		return So(t, e.child, null, n), e = dl(t, t.pendingProps.children), e.flags |= 2, t.memoizedState = null, e;
	}
	function ml(e, t, n, r, i, o, s, c) {
		if (n) return t.flags & 256 ? (Uo(t), t.flags &= -257, pl(e, t, c)) : t.memoizedState === null ? (Ko(), o = i.fallback, s = t.mode, i = fl({
			mode: "visible",
			children: i.children
		}, s), o = Xi(o, s, c, null), o.flags |= 2, i.return = t, o.return = t, i.sibling = o, t.child = i, So(t, e.child, null, c), i = t.child, i.memoizedState = cl(c), i.childLanes = ll(e, r, c), t.memoizedState = sl, Zc(null, i)) : (Ko(), t.child = e.child, t.flags |= 128, null);
		if (Uo(t), Cm(o)) {
			if (r = o.nextSibling && o.nextSibling.dataset, r) var l = r.dgst;
			return r = l, r !== "" && (i = Error(a(419)), i.stack = "", i.digest = r, Da({
				value: i,
				source: null,
				stack: null
			})), pl(e, t, c);
		}
		if (Gc || Fa(e, t, c, !1), r = (c & e.childLanes) !== 0, Gc || r) {
			if (Io.current !== null) return pl(e, t, c);
			if (r = md, r !== null && (i = kt(r, c), i !== 0 && i !== s.retryLane)) throw s.retryLane = i, Bi(e, i), Jd(r, e, i), Wc;
			return Sm(o) || sf(), pl(e, t, c);
		}
		return Sm(o) ? (t.flags |= 192, t.child = e.child, null) : (e = s.treeContext, _a = Tm(o.nextSibling), ga = t, D = !0, va = null, ya = !1, e !== null && ha(t, e), t = dl(t, i.children), t.flags |= 134221824, t);
	}
	function hl(e, t, n) {
		e.lanes |= t;
		var r = e.alternate;
		r !== null && (r.lanes |= t), Na(e.return, t, n);
	}
	function gl(e) {
		for (var t = null; e !== null;) {
			var n = e.alternate;
			n !== null && Zo(n) === null && (t = e), e = e.sibling;
		}
		return t;
	}
	function _l(e, t, n, r, i, a) {
		var o = e.memoizedState;
		o === null ? e.memoizedState = {
			isBackwards: t,
			rendering: null,
			renderingStartTime: 0,
			last: r,
			tail: n,
			tailMode: i,
			treeForkCount: a
		} : (o.isBackwards = t, o.rendering = null, o.renderingStartTime = 0, o.last = r, o.tail = n, o.tailMode = i, o.treeForkCount = a);
	}
	function vl(e) {
		var t = e.child;
		for (e.child = null; t !== null;) {
			var n = t.sibling;
			t.sibling = e.child, e.child = t, t = n;
		}
	}
	function yl(e, t, n) {
		var r = t.pendingProps, i = r.revealOrder, a = r.tail;
		r = r.children;
		var o = Jo.current;
		if (t.flags & 128) return Yo(t, o), null;
		var s = !!(o & 2);
		if (s ? (o = o & 1 | 2, t.flags |= 128) : o &= 1, Yo(t, o), i === "backwards" && e !== null ? (vl(e), Kc(e, t, r, n), vl(e)) : Kc(e, t, r, n), r = D ? aa : 0, !s && e !== null && e.flags & 128) a: for (e = t.child; e !== null;) {
			if (e.tag === 13) e.memoizedState !== null && hl(e, n, t);
			else if (e.tag === 19) hl(e, n, t);
			else if (e.child !== null) {
				e.child.return = e, e = e.child;
				continue;
			}
			if (e === t) break a;
			for (; e.sibling === null;) {
				if (e.return === null || e.return === t) break a;
				e = e.return;
			}
			e.sibling.return = e.return, e = e.sibling;
		}
		switch (i) {
			case "backwards":
				n = gl(t.child), n === null ? (i = t.child, t.child = null) : (i = n.sibling, n.sibling = null, vl(t)), _l(t, !0, i, null, a, r);
				break;
			case "unstable_legacy-backwards":
				for (n = null, i = t.child, t.child = null; i !== null;) {
					if (e = i.alternate, e !== null && Zo(e) === null) {
						t.child = i;
						break;
					}
					e = i.sibling, i.sibling = n, n = i, i = e;
				}
				_l(t, !0, n, null, a, r);
				break;
			case "together":
				_l(t, !1, null, null, void 0, r);
				break;
			case "independent":
				t.memoizedState = null;
				break;
			default: n = gl(t.child), n === null ? (i = t.child, t.child = null) : (i = n.sibling, n.sibling = null), _l(t, !1, i, n, a, r);
		}
		return t.child;
	}
	function bl(e, t, n) {
		var r = t.pendingProps;
		return ja(t, t.type, r.value), Kc(e, t, r.children, n), t.child;
	}
	function xl(e, t, n) {
		if (e !== null && (t.dependencies = e.dependencies), xd |= t.lanes, (n & t.childLanes) === 0) {
			if (e !== null) {
				if (Fa(e, t, n, !1), (n & t.childLanes) === 0) return null;
			} else return null;
		}
		if (e !== null && t.child !== e.child) throw Error(a(153));
		if (t.child !== null) {
			for (e = t.child, n = qi(e, e.pendingProps), t.child = n, n.return = t; e.sibling !== null;) e = e.sibling, n = n.sibling = qi(e, e.pendingProps), n.return = t;
			n.sibling = null;
		}
		return t.child;
	}
	function Sl(e, t) {
		return (e.lanes & t) !== 0 || (e = e.dependencies, !!(e !== null && Ia(e)));
	}
	function Cl(e, t, n) {
		switch (t.tag) {
			case 3:
				Le(t, t.stateNode.containerInfo), ja(t, O, e.memoizedState.cache), Ta();
				break;
			case 27:
			case 5:
				ze(t);
				break;
			case 4:
				Le(t, t.stateNode.containerInfo);
				break;
			case 10:
				ja(t, t.type, t.memoizedProps.value);
				break;
			case 31:
				if (t.memoizedState !== null) return t.flags |= 128, Wo(t), null;
				break;
			case 13:
				var r = t.memoizedState;
				if (r !== null) {
					if (r.dehydrated !== null) return Uo(t), t.flags |= 128, null;
					r = Fa(e, t, n, !1);
					var i = t.child.childLanes;
					return r || (n & i) !== 0 ? ul(e, t, n) : (Uo(t), e = xl(e, t, n), e === null ? null : e.sibling);
				}
				Uo(t);
				break;
			case 19:
				if (t.flags & 128) return yl(e, t, n);
				if (i = !!(e.flags & 128), r = (n & t.childLanes) !== 0, r ||= (Fa(e, t, n, !1), (n & t.childLanes) !== 0), i) {
					if (r) return yl(e, t, n);
					t.flags |= 128;
				}
				if (i = t.memoizedState, i !== null && (i.rendering = null, i.tail = null, i.lastEffect = null), Yo(t, Jo.current), r) break;
				return null;
			case 22: return t.lanes = 0, Xc(e, t, n, t.pendingProps);
			case 24: ja(t, O, e.memoizedState.cache);
		}
		return xl(e, t, n);
	}
	function wl(e, t, n) {
		if (e !== null) {
			if (e.memoizedProps !== t.pendingProps) Gc = !0;
			else {
				if (!Sl(e, n) && !(t.flags & 128)) return Gc = !1, Cl(e, t, n);
				Gc = !!(e.flags & 131072);
			}
		} else Gc = !1, D && t.flags & 1048576 && fa(t, aa, t.index);
		switch (t.lanes = 0, t.tag) {
			case 16:
				a: {
					var r = t.pendingProps;
					if (e = fo(t.elementType), t.type = e, typeof e == "function") Ki(e) ? (r = Pc(e, r), t.tag = 1, t = al(null, t, e, r, n)) : (t.tag = 0, t = rl(null, t, e, r, n));
					else {
						if (e != null) {
							var i = e.$$typeof;
							if (i === pe) {
								t.tag = 11, t = qc(null, t, e, r, n);
								break a;
							}
							if (i === ge) {
								t.tag = 14, t = Jc(null, t, e, r, n);
								break a;
							}
							if (i === fe) {
								t.tag = 10, t.type = e, t = bl(null, t, n);
								break a;
							}
						}
						throw t = Te(e) || e, Error(a(306, t, ""));
					}
				}
				return t;
			case 0: return rl(e, t, t.type, t.pendingProps, n);
			case 1: return r = t.type, i = Pc(r, t.pendingProps), al(e, t, r, i, n);
			case 3:
				a: {
					if (Le(t, t.stateNode.containerInfo), e === null) throw Error(a(387));
					r = t.pendingProps;
					var o = t.memoizedState;
					i = o.element, Eo(e, t), No(t, r, null, n);
					var s = t.memoizedState;
					if (r = s.cache, ja(t, O, r), r !== o.cache && Pa(t, [O], n, !0), Mo(), r = s.element, o.isDehydrated) {
						if (o = {
							element: r,
							isDehydrated: !1,
							cache: s.cache
						}, t.updateQueue.baseState = o, t.memoizedState = o, t.flags & 256) {
							t = ol(e, t, r, n);
							break a;
						}
						if (r !== i) {
							i = ta(Error(a(424)), t), Da(i), t = ol(e, t, r, n);
							break a;
						}
						switch (e = t.stateNode.containerInfo, e.nodeType) {
							case 9:
								e = e.body;
								break;
							default: e = e.nodeName === "HTML" ? e.ownerDocument.body : e;
						}
						for (_a = Tm(e.firstChild), ga = t, D = !0, va = null, ya = !0, n = Co(t, null, r, n), t.child = n; n;) n.flags = n.flags & -3 | 134221824, n = n.sibling;
					} else {
						if (Ta(), r === i) {
							t = xl(e, t, n);
							break a;
						}
						Kc(e, t, r, n);
					}
					t = t.child;
				}
				return t;
			case 26: return nl(e, t), e === null ? (n = z(t.type, null, t.pendingProps, null)) ? t.memoizedState = n : D || (t.stateNode = Op(t.type, t.pendingProps, Ie.current, t)) : t.memoizedState = z(t.type, e.memoizedProps, t.pendingProps, e.memoizedState), null;
			case 27: return ze(t), e === null && D && (r = t.stateNode = Am(t.type, t.pendingProps, Ie.current), ga = t, ya = !0, i = _a, Rp(t.type) ? (Em = i, _a = Tm(r.firstChild)) : _a = i), Kc(e, t, t.pendingProps.children, n), nl(e, t), e === null && (t.flags |= 4194304), t.child;
			case 5: return e === null && D && ((i = r = _a) && (r = ym(r, t.type, t.pendingProps, ya), r === null ? i = !1 : (t.stateNode = r, ga = t, _a = Tm(r.firstChild), ya = !1, i = !0)), i || xa(t)), ze(t), i = t.type, o = t.pendingProps, s = e === null ? null : e.memoizedProps, r = o.children, kp(i, o) ? r = null : s !== null && kp(i, s) && (t.flags |= 32), t.memoizedState !== null && (i = us(e, t, ps, null, null, n), bh._currentValue = i), nl(e, t), Kc(e, t, r, n), t.child;
			case 6: return e === null && D && ((e = n = _a) && (n = bm(n, t.pendingProps, ya), n === null ? e = !1 : (t.stateNode = n, ga = t, _a = null, e = !0)), e || xa(t)), null;
			case 13: return ul(e, t, n);
			case 4: return Le(t, t.stateNode.containerInfo), r = t.pendingProps, e === null ? t.child = So(t, null, r, n) : Kc(e, t, r, n), t.child;
			case 11: return qc(e, t, t.type, t.pendingProps, n);
			case 7: return r = t.pendingProps, nl(e, t), Kc(e, t, r, n), t.child;
			case 8: return Kc(e, t, t.pendingProps.children, n), t.child;
			case 12: return Kc(e, t, t.pendingProps.children, n), t.child;
			case 10: return bl(e, t, n);
			case 9: return i = t.type._context, r = t.pendingProps.children, La(t), i = Ra(i), r = r(i), t.flags |= 1, Kc(e, t, r, n), t.child;
			case 14: return Jc(e, t, t.type, t.pendingProps, n);
			case 15: return Yc(e, t, t.type, t.pendingProps, n);
			case 19: return yl(e, t, n);
			case 31: return tl(e, t, n);
			case 22: return Xc(e, t, n, t.pendingProps);
			case 24: return La(t), r = Ra(O), e === null ? (i = no(), i === null && (i = md, o = k(), i.pooledCache = o, o.refCount++, o !== null && (i.pooledCacheLanes |= n), i = o), t.memoizedState = {
				parent: r,
				cache: i
			}, To(t), ja(t, O, i)) : ((e.lanes & n) !== 0 && (Eo(e, t), No(t, null, null, n), Mo()), i = e.memoizedState, o = t.memoizedState, i.parent === r ? (r = o.cache, ja(t, O, r), r !== i.cache && Pa(t, [O], n, !0)) : (i = {
				parent: r,
				cache: r
			}, t.memoizedState = i, t.lanes === 0 && (t.memoizedState = t.updateQueue.baseState = i), ja(t, O, r))), Kc(e, t, t.pendingProps.children, n), t.child;
			case 30: return t.stateNode === null && (t.stateNode = {
				autoName: null,
				paired: null,
				clones: null,
				ref: null
			}), r = t.pendingProps, r.name != null && r.name !== "auto" ? t.flags |= e === null ? 18882560 : 18874368 : D && pa(t), e !== null && e.memoizedProps.name !== r.name ? t.flags |= 4194816 : nl(e, t), Kc(e, t, r.children, n), t.child;
			case 29: throw t.pendingProps;
		}
		throw Error(a(156, t.tag));
	}
	function Tl(e) {
		e.flags |= 4;
	}
	function El(e, t, n, r, i) {
		var a;
		if ((a = !!(e.mode & 32)) && (a = n === null ? sh(t, r) : sh(t, r) && (r.src !== n.src || r.srcSet !== n.srcSet)), a) {
			if (e.flags |= 16777216, (i & 335544128) === i) {
				if (e.stateNode.complete) e.flags |= 8192;
				else if (rf()) e.flags |= 8192;
				else throw po = co, oo;
			}
		} else e.flags &= -16777217;
	}
	function Dl(e, t) {
		if (t.type !== "stylesheet" || t.state.loading & 4) e.flags &= -16777217;
		else if (e.flags |= 16777216, !ch(t)) {
			if (rf()) e.flags |= 8192;
			else throw po = co, oo;
		}
	}
	function Ol(e, t) {
		t !== null && (e.flags |= 4), e.flags & 16384 && (t = e.tag === 22 ? 536870912 : Ct(), e.lanes |= t, Td |= t);
	}
	function kl(e, t) {
		if (!D) switch (e.tailMode) {
			case "visible": break;
			case "collapsed":
				for (var n = e.tail, r = null; n !== null;) n.alternate !== null && (r = n), n = n.sibling;
				r === null ? t || e.tail === null ? e.tail = null : e.tail.sibling = null : r.sibling = null;
				break;
			default:
				for (t = e.tail, n = null; t !== null;) t.alternate !== null && (n = t), t = t.sibling;
				n === null ? e.tail = null : n.sibling = null;
		}
	}
	function M(e) {
		var t = e.alternate !== null && e.alternate.child === e.child, n = 0, r = 0;
		if (t) for (var i = e.child; i !== null;) n |= i.lanes | i.childLanes, r |= i.subtreeFlags & 1206910976, r |= i.flags & 1206910976, i.return = e, i = i.sibling;
		else for (i = e.child; i !== null;) n |= i.lanes | i.childLanes, r |= i.subtreeFlags, r |= i.flags, i.return = e, i = i.sibling;
		return e.subtreeFlags |= r, e.childLanes = n, t;
	}
	function Al(e, t, n) {
		var r = t.pendingProps;
		switch (ma(t), t.tag) {
			case 16:
			case 15:
			case 0:
			case 11:
			case 7:
			case 8:
			case 12:
			case 9:
			case 14: return M(t), null;
			case 1: return M(t), null;
			case 3: return n = t.stateNode, r = null, e !== null && (r = e.memoizedState.cache), t.memoizedState.cache !== r && (t.flags |= 2048), Ma(O), Re(), n.pendingContext && (n.context = n.pendingContext, n.pendingContext = null), (e === null || e.child === null) && (wa(t) ? Tl(t) : e === null || e.memoizedState.isDehydrated && !(t.flags & 256) || (t.flags |= 1024, Ea())), M(t), null;
			case 26:
				var i = t.type, o = t.memoizedState;
				return e === null ? (Tl(t), o === null ? (M(t), El(t, i, null, r, n)) : (M(t), Dl(t, o))) : o ? o === e.memoizedState ? (M(t), t.flags &= -16777217) : (Tl(t), M(t), Dl(t, o)) : (e = e.memoizedProps, e !== r && Tl(t), M(t), El(t, i, e, r, n)), null;
			case 27:
				if (Be(t), n = Ie.current, i = t.type, e !== null && t.stateNode != null) e.memoizedProps !== r && Tl(t);
				else {
					if (!r) {
						if (t.stateNode === null) throw Error(a(166));
						return M(t), t.subtreeFlags &= -33554433, null;
					}
					e = Pe.current, wa(t) ? Sa(t, e) : (e = Am(i, r, n), t.stateNode = e, Tl(t));
				}
				return M(t), t.subtreeFlags &= -33554433, null;
			case 5:
				if (Be(t), i = t.type, e !== null && t.stateNode != null) e.memoizedProps !== r && Tl(t);
				else {
					if (!r) {
						if (t.stateNode === null) throw Error(a(166));
						return M(t), t.subtreeFlags &= -33554433, null;
					}
					if (o = Pe.current, wa(t)) Sa(t, o);
					else {
						var s = Tp(Ie.current);
						switch (o) {
							case 1:
								o = s.createElementNS("http://www.w3.org/2000/svg", i);
								break;
							case 2:
								o = s.createElementNS("http://www.w3.org/1998/Math/MathML", i);
								break;
							default: switch (i) {
								case "svg":
									o = s.createElementNS("http://www.w3.org/2000/svg", i);
									break;
								case "math":
									o = s.createElementNS("http://www.w3.org/1998/Math/MathML", i);
									break;
								case "script":
									o = s.createElement("div"), o.innerHTML = "<script><\/script>", o = o.removeChild(o.firstChild);
									break;
								case "select":
									o = typeof r.is == "string" ? s.createElement("select", { is: r.is }) : s.createElement("select"), r.multiple ? o.multiple = !0 : r.size && (o.size = r.size);
									break;
								default: o = typeof r.is == "string" ? s.createElement(i, { is: r.is }) : s.createElement(i);
							}
						}
						o[Ft] = t, o[It] = r;
						a: for (s = t.child; s !== null;) {
							if (s.tag === 5 || s.tag === 6) o.appendChild(s.stateNode);
							else if (s.tag !== 4 && s.tag !== 27 && s.child !== null) {
								s.child.return = s, s = s.child;
								continue;
							}
							if (s === t) break a;
							for (; s.sibling === null;) {
								if (s.return === null || s.return === t) break a;
								s = s.return;
							}
							s.sibling.return = s.return, s = s.sibling;
						}
						t.stateNode = o;
						a: switch (vp(o, i, r), i) {
							case "button":
							case "input":
							case "select":
							case "textarea":
								r = !!r.autoFocus;
								break a;
							case "img":
								r = !0;
								break a;
							default: r = !1;
						}
						r && Tl(t);
					}
				}
				return M(t), t.subtreeFlags &= -33554433, El(t, t.type, e === null ? null : e.memoizedProps, t.pendingProps, n), null;
			case 6:
				if (e && t.stateNode != null) e.memoizedProps !== r && Tl(t);
				else {
					if (typeof r != "string" && t.stateNode === null) throw Error(a(166));
					if (e = Ie.current, wa(t)) {
						if (e = t.stateNode, n = t.memoizedProps, r = null, i = ga, i !== null) switch (i.tag) {
							case 27:
							case 5: r = i.memoizedProps;
						}
						e[Ft] = t, e = !!(e.nodeValue === n || r !== null && !0 === r.suppressHydrationWarning || hp(e.nodeValue, n)), e || xa(t, !0);
					} else e = Tp(e).createTextNode(r), e[Ft] = t, t.stateNode = e;
				}
				return M(t), null;
			case 31:
				if (n = t.memoizedState, e === null || e.memoizedState !== null) {
					if (r = wa(t), n !== null) {
						if (e === null) {
							if (!r) throw Error(a(318));
							if (e = t.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error(a(557));
							e[Ft] = t;
						} else Ta(), !(t.flags & 128) && (t.memoizedState = null), t.flags |= 4;
						M(t), e = !1;
					} else n = Ea(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = n), e = !0;
					if (!e) return t.flags & 256 ? (qo(t), t) : (qo(t), null);
					if (t.flags & 128) throw Error(a(558));
				}
				return M(t), null;
			case 13:
				if (r = t.memoizedState, e === null || e.memoizedState !== null && e.memoizedState.dehydrated !== null) {
					if (i = wa(t), r !== null && r.dehydrated !== null) {
						if (e === null) {
							if (!i) throw Error(a(318));
							if (i = t.memoizedState, i = i === null ? null : i.dehydrated, !i) throw Error(a(317));
							i[Ft] = t;
						} else Ta(), !(t.flags & 128) && (t.memoizedState = null), t.flags |= 4;
						M(t), i = !1;
					} else i = Ea(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = i), i = !0;
					if (!i) return t.flags & 256 ? (qo(t), t) : (qo(t), null);
				}
				return qo(t), t.flags & 128 ? (t.lanes = n, t) : (n = r !== null, e = e !== null && e.memoizedState !== null, n && (r = t.child, i = null, r.alternate !== null && r.alternate.memoizedState !== null && r.alternate.memoizedState.cachePool !== null && (i = r.alternate.memoizedState.cachePool.pool), o = null, r.memoizedState !== null && r.memoizedState.cachePool !== null && (o = r.memoizedState.cachePool.pool), o !== i && (r.flags |= 2048)), n !== e && n && (t.child.flags |= 8192), Ol(t, t.updateQueue), M(t), null);
			case 4: return Re(), e === null && ap(t.stateNode.containerInfo), t.flags |= 67108864, M(t), null;
			case 10: return Ma(t.type), M(t), null;
			case 19:
				if (Xo(t), r = t.memoizedState, r === null) return M(t), null;
				if (i = !!(t.flags & 128), o = r.rendering, o === null) {
					if (i) kl(r, !1);
					else {
						if (bd !== 0 || e !== null && e.flags & 128) for (e = t.child; e !== null;) {
							if (o = Zo(e), o !== null) {
								for (t.flags |= 128, kl(r, !1), e = o.updateQueue, t.updateQueue = e, Ol(t, e), t.subtreeFlags = 0, e = n, n = t.child; n !== null;) Ji(n, e), n = n.sibling;
								return Yo(t, Jo.current & 1 | 2), D && da(t, r.treeForkCount), t.child;
							}
							e = e.sibling;
						}
						r.tail !== null && $e() > jd && (t.flags |= 128, i = !0, kl(r, !1), t.lanes = 4194304);
					}
				} else {
					if (!i) {
						if (e = Zo(o), e !== null) {
							if (t.flags |= 128, i = !0, e = e.updateQueue, t.updateQueue = e, Ol(t, e), kl(r, !0), r.tail === null && r.tailMode !== "collapsed" && r.tailMode !== "visible" && !o.alternate && !D) return M(t), null;
						} else 2 * $e() - r.renderingStartTime > jd && n !== 536870912 && (t.flags |= 128, i = !0, kl(r, !1), t.lanes = 4194304);
					}
					r.isBackwards ? (o.sibling = t.child, t.child = o) : (e = r.last, e === null ? t.child = o : e.sibling = o, r.last = o);
				}
				if (r.tail !== null) {
					e = r.tail;
					a: {
						for (n = e; n !== null;) {
							if (n.alternate !== null) {
								n = !1;
								break a;
							}
							n = n.sibling;
						}
						n = !0;
					}
					return r.rendering = e, r.tail = e.sibling, r.renderingStartTime = $e(), e.sibling = null, o = Jo.current, o = i ? o & 1 | 2 : o & 1, r.tailMode === "visible" || r.tailMode === "collapsed" || !n || D ? Yo(t, o) : (n = o, Ne(Vo, t), Ne(Jo, n), Ho === null && (Ho = t)), D && da(t, r.treeForkCount), e;
				}
				return M(t), null;
			case 22:
			case 23: return qo(t), Bo(), r = t.memoizedState !== null, e === null ? r && (t.flags |= 8192) : e.memoizedState !== null !== r && (t.flags |= 8192), r ? n & 536870912 && !(t.flags & 128) && (M(t), t.subtreeFlags & 6 && (t.flags |= 8192)) : M(t), n = t.updateQueue, n !== null && Ol(t, n.retryQueue), n = null, e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), r = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (r = t.memoizedState.cachePool.pool), r !== n && (t.flags |= 2048), e !== null && Me(A), null;
			case 24: return n = null, e !== null && (n = e.memoizedState.cache), t.memoizedState.cache !== n && (t.flags |= 2048), Ma(O), M(t), null;
			case 25: return null;
			case 30: return t.flags |= 33554432, M(t), null;
		}
		throw Error(a(156, t.tag));
	}
	function jl(e, t) {
		switch (ma(t), t.tag) {
			case 1: return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 3: return Ma(O), Re(), e = t.flags, e & 65536 && !(e & 128) ? (t.flags = e & -65537 | 128, t) : null;
			case 26:
			case 27:
			case 5: return Be(t), null;
			case 31:
				if (t.memoizedState !== null) {
					if (qo(t), t.alternate === null) throw Error(a(340));
					Ta();
				}
				return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 13:
				if (qo(t), e = t.memoizedState, e !== null && e.dehydrated !== null) {
					if (t.alternate === null) throw Error(a(340));
					Ta();
				}
				return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 19: return Xo(t), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, e = t.memoizedState, e !== null && (e.rendering = null, e.tail = null), t.flags |= 4, t) : null;
			case 4: return Re(), null;
			case 10: return Ma(t.type), null;
			case 22:
			case 23: return qo(t), Bo(), e !== null && Me(A), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 24: return Ma(O), null;
			case 25: return null;
			default: return null;
		}
	}
	function Ml(e, t) {
		switch (ma(t), t.tag) {
			case 3:
				Ma(O), Re();
				break;
			case 26:
			case 27:
			case 5:
				Be(t);
				break;
			case 4:
				Re();
				break;
			case 31:
				t.memoizedState !== null && qo(t);
				break;
			case 13:
				qo(t);
				break;
			case 19:
				Xo(t);
				break;
			case 10:
				Ma(t.type);
				break;
			case 22:
			case 23:
				qo(t), Bo(), e !== null && Me(A);
				break;
			case 24: Ma(O);
		}
	}
	function Nl(e, t) {
		try {
			var n = t.updateQueue, r = n === null ? null : n.lastEffect;
			if (r !== null) {
				var i = r.next;
				n = i;
				do {
					if ((n.tag & e) === e) {
						r = void 0;
						var a = n.create, o = n.inst;
						r = a(), o.destroy = r;
					}
					n = n.next;
				} while (n !== i);
			}
		} catch (e) {
			Of(t, t.return, e);
		}
	}
	function Pl(e, t, n) {
		try {
			var r = t.updateQueue, i = r === null ? null : r.lastEffect;
			if (i !== null) {
				var a = i.next;
				r = a;
				do {
					if ((r.tag & e) === e) {
						var o = r.inst, s = o.destroy;
						if (s !== void 0) {
							o.destroy = void 0, i = t;
							var c = n, l = s;
							try {
								l();
							} catch (e) {
								Of(i, c, e);
							}
						}
					}
					r = r.next;
				} while (r !== a);
			}
		} catch (e) {
			Of(t, t.return, e);
		}
	}
	function Fl(e) {
		var t = e.updateQueue;
		if (t !== null) {
			var n = e.stateNode;
			try {
				Fo(t, n);
			} catch (t) {
				Of(e, e.return, t);
			}
		}
	}
	function Il(e, t, n) {
		n.props = Pc(e.type, e.memoizedProps), n.state = e.memoizedState;
		try {
			n.componentWillUnmount();
		} catch (n) {
			Of(e, t, n);
		}
	}
	function Ll(e, t) {
		try {
			var n = e.ref;
			if (n !== null) {
				switch (e.tag) {
					case 26:
					case 27:
					case 5:
						var r = e.stateNode;
						break;
					case 30:
						var i = e.stateNode, a = Ai(e.memoizedProps, i);
						(i.ref === null || i.ref.name !== a) && (i.ref = Xp(a)), r = i.ref;
						break;
					case 7:
						if (e.stateNode === null) {
							var o = new Zp(e);
							h(e.child, !1, mm, o, void 0, void 0), e.stateNode = o;
						}
						r = e.stateNode;
						break;
					default: r = e.stateNode;
				}
				typeof n == "function" ? e.refCleanup = n(r) : n.current = r;
			}
		} catch (n) {
			Of(e, t, n);
		}
	}
	function Rl(e, t) {
		var n = e.ref, r = e.refCleanup;
		if (n !== null) {
			if (typeof r == "function") try {
				r();
			} catch (n) {
				Of(e, t, n);
			} finally {
				e.refCleanup = null, e = e.alternate, e != null && (e.refCleanup = null);
			}
			else if (typeof n == "function") try {
				n(null);
			} catch (n) {
				Of(e, t, n);
			}
			else n.current = null;
		}
	}
	function zl(e, t) {
		if ((e.tag === 5 || e.tag === 27 || e.tag === 6) && e.alternate === null && t !== null) for (var n = 0; n < t.length; n++) gm(e.stateNode, t[n]);
	}
	function Bl(e) {
		for (var t = e.return; t !== null && (Ul(t) && gm(e.stateNode, t.stateNode), !Hl(t));) t = t.return;
	}
	function Vl(e) {
		for (var t = e.return; t !== null && (Ul(t) && _m(e.stateNode, t.stateNode), !Hl(t));) t = t.return;
	}
	function Hl(e) {
		return e.tag === 5 || e.tag === 3 || e.tag === 27;
	}
	function Ul(e) {
		return e && e.tag === 7 && e.stateNode !== null;
	}
	function Wl(e) {
		var t = e.type, n = e.memoizedProps, r = e.stateNode;
		try {
			a: switch (t) {
				case "button":
				case "input":
				case "select":
				case "textarea":
					n.autoFocus && r.focus();
					break a;
				case "img": n.src ? r.src = n.src : n.srcSet && (r.srcset = n.srcSet);
			}
		} catch (t) {
			Of(e, e.return, t);
		}
	}
	function Gl(e, t, n) {
		try {
			var r = e.stateNode;
			bp(r, e.type, n, t), r[It] = t;
		} catch (t) {
			Of(e, e.return, t);
		}
	}
	function Kl(e) {
		return e.tag === 5 || e.tag === 3 || e.tag === 26 || e.tag === 27 && Rp(e.type) || e.tag === 4;
	}
	function ql(e) {
		a: for (;;) {
			for (; e.sibling === null;) {
				if (e.return === null || Kl(e.return)) return null;
				e = e.return;
			}
			for (e.sibling.return = e.return, e = e.sibling; e.tag !== 5 && e.tag !== 6 && e.tag !== 18;) {
				if (e.tag === 27 && Rp(e.type) || e.flags & 2 || e.child === null || e.tag === 4) continue a;
				e.child.return = e, e = e.child;
			}
			if (!(e.flags & 2)) return e.stateNode;
		}
	}
	function Jl(e, t, n, r) {
		var i = e.tag;
		if (i === 5 || i === 6) i = e.stateNode, t ? (n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n).insertBefore(i, t) : (t = n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n, t.appendChild(i), n = n._reactRootContainer, n != null || t.onclick !== null || (t.onclick = jn)), zl(e, r), E = !0;
		else if (i !== 4 && (i === 27 && (zl(e, r), r = null, Rp(e.type) && (n = e.stateNode, t = null)), e = e.child, e !== null)) for (Jl(e, t, n, r), e = e.sibling; e !== null;) Jl(e, t, n, r), e = e.sibling;
	}
	function Yl(e, t, n, r) {
		var i = e.tag;
		if (i === 5 || i === 6) i = e.stateNode, t ? n.insertBefore(i, t) : n.appendChild(i), zl(e, r), E = !0;
		else if (i !== 4 && (i === 27 && (zl(e, r), r = null, Rp(e.type) && (n = e.stateNode)), e = e.child, e !== null)) for (Yl(e, t, n, r), e = e.sibling; e !== null;) Yl(e, t, n, r), e = e.sibling;
	}
	function Xl(e) {
		var t = e.stateNode, n = e.memoizedProps;
		try {
			for (var r = e.type, i = t.attributes; i.length;) t.removeAttributeNode(i[0]);
			vp(t, r, n), t[Ft] = e, t[It] = n;
		} catch (t) {
			Of(e, e.return, t);
		}
	}
	var Zl = !1, Ql = null;
	function $l(e) {
		(e.tag === 30 || e.subtreeFlags & 33554432) && (Zl = !0);
	}
	var eu = null;
	function tu() {
		var e = eu;
		return eu = null, e;
	}
	var nu = 0;
	function ru(e, t, n, r, i) {
		return nu = 0, iu(e.child, t, n, r, i);
	}
	function iu(e, t, n, r, i) {
		for (var a = !1; e !== null;) {
			if (e.tag === 5) {
				var o = e.stateNode;
				if (r !== null) {
					var s = Wp(o);
					r.push(s), s.view && (a = !0);
				} else a || Wp(o).view && (a = !0);
				Zl = !0, Vp(o, nu === 0 ? t : t + "_" + nu, n), nu++;
			} else (e.tag !== 22 || e.memoizedState === null) && (e.tag === 30 && i || iu(e.child, t, n, r, i) && (a = !0));
			e = e.sibling;
		}
		return a;
	}
	function au(e, t) {
		for (; e !== null;) e.tag === 5 ? Hp(e.stateNode, e.memoizedProps) : (e.tag !== 22 || e.memoizedState === null) && (e.tag === 30 && t || au(e.child, t)), e = e.sibling;
	}
	function ou(e) {
		if (e.subtreeFlags & 18874368) for (e = e.child; e !== null;) {
			if ((e.tag !== 22 || e.memoizedState === null) && (ou(e), e.tag === 30 && e.flags & 18874368 && e.stateNode.paired)) {
				var t = e.memoizedProps;
				if (t.name == null || t.name === "auto") throw Error(a(544));
				var n = t.name;
				t = Mi(t.default, t.share), t !== "none" && (ru(e, n, t, null, !1) || au(e.child, !1));
			}
			e = e.sibling;
		}
	}
	function su(e, t) {
		if (e.tag === 30) {
			var n = e.stateNode, r = e.memoizedProps, i = Ai(r, n), a = Mi(r.default, n.paired ? r.share : r.enter);
			a === "none" ? ou(e) : ru(e, i, a, null, !1) ? (ou(e), n.paired || t || qd(e, r.onEnter)) : au(e.child, !1);
		} else if (e.subtreeFlags & 33554432) for (e = e.child; e !== null;) su(e, t), e = e.sibling;
		else ou(e);
	}
	function cu(e) {
		if (Ql !== null && Ql.size !== 0) {
			var t = Ql;
			if (e.subtreeFlags & 18874368) for (e = e.child; e !== null;) {
				if (e.tag !== 22 || e.memoizedState === null) {
					if (e.tag === 30 && e.flags & 18874368) {
						var n = e.memoizedProps, r = n.name;
						if (r != null && r !== "auto") {
							var i = t.get(r);
							if (i !== void 0) {
								var a = Mi(n.default, n.share);
								if (a !== "none" && (ru(e, r, a, null, !1) ? (a = e.stateNode, i.paired = a, a.paired = i, qd(e, n.onShare)) : au(e.child, !1)), t.delete(r), t.size === 0) break;
							}
						}
					}
					cu(e);
				}
				e = e.sibling;
			}
		}
	}
	function lu(e) {
		if (e.tag === 30) {
			var t = e.memoizedProps, n = Ai(t, e.stateNode), r = Ql === null ? void 0 : Ql.get(n), i = Mi(t.default, r === void 0 ? t.exit : t.share);
			i !== "none" && (ru(e, n, i, null, !1) ? r === void 0 ? qd(e, t.onExit) : (i = e.stateNode, r.paired = i, i.paired = r, Ql.delete(n), qd(e, t.onShare)) : au(e.child, !1)), Ql !== null && cu(e);
		} else if (e.subtreeFlags & 33554432) for (e = e.child; e !== null;) lu(e), e = e.sibling;
		else Ql !== null && cu(e);
	}
	function uu(e) {
		for (e = e.child; e !== null;) {
			if (e.tag === 30) {
				var t = e.memoizedProps, n = Ai(t, e.stateNode);
				t = Mi(t.default, t.update), e.flags &= -5, t !== "none" && ru(e, n, t, e.memoizedState = [], !1);
			} else e.subtreeFlags & 33554432 && uu(e);
			e = e.sibling;
		}
	}
	function du(e) {
		if (e.subtreeFlags & 18874368) for (e = e.child; e !== null;) {
			if (e.tag !== 22 || e.memoizedState === null) {
				if (e.tag === 30 && e.flags & 18874368) {
					var t = e.stateNode;
					t.paired !== null && (t.paired = null, au(e.child, !1));
				}
				du(e);
			}
			e = e.sibling;
		}
	}
	function fu(e) {
		if (e.tag === 30) e.stateNode.paired = null, au(e.child, !1), du(e);
		else if (e.subtreeFlags & 33554432) for (e = e.child; e !== null;) fu(e), e = e.sibling;
		else du(e);
	}
	function pu(e) {
		for (e = e.child; e !== null;) e.tag === 30 ? au(e.child, !1) : e.subtreeFlags & 33554432 && pu(e), e = e.sibling;
	}
	function mu(e, t, n, r, i, a, o) {
		for (var s = !1; t !== null;) {
			if (t.tag === 5) {
				var c = t.stateNode;
				if (a !== null && nu < a.length) {
					var l = a[nu], u = Wp(c);
					(l.view || u.view) && (s = !0);
					var d;
					if (d = !(e.flags & 4)) {
						if (u.clip) d = !0;
						else {
							d = l.rect;
							var f = u.rect;
							d = d.y !== f.y || d.x !== f.x || d.height !== f.height || d.width !== f.width;
						}
					}
					d && (e.flags |= 4), u.abs ? u = !l.abs : (l = l.rect, u = u.rect, u = l.height !== u.height || l.width !== u.width), u && (e.flags |= 32);
				} else e.flags |= 32;
				e.flags & 4 && Vp(c, nu === 0 ? n : n + "_" + nu, i), s && e.flags & 4 || (eu === null && (eu = []), eu.push(c, nu === 0 ? r : r + "_" + nu, t.memoizedProps)), nu++;
			} else (t.tag !== 22 || t.memoizedState === null) && (t.tag === 30 && o ? e.flags |= t.flags & 32 : mu(e, t.child, n, r, i, a, o) && (s = !0));
			t = t.sibling;
		}
		return s;
	}
	function hu(e, t) {
		for (e = e.child; e !== null;) {
			if (e.tag === 30) {
				var n = e.memoizedProps, r = e.stateNode, i = Ai(n, r), a = Mi(n.default, n.update);
				if (t) {
					r = r.clones;
					var o = r === null ? null : r.map(Gp);
				} else o = e.memoizedState, e.memoizedState = null;
				r = e;
				var s = e.child;
				nu = 0, i = mu(r, s, i, i, a, o, !1), e.flags & 4 && i && (t || qd(e, n.onUpdate));
			} else e.subtreeFlags & 33554432 && hu(e, t);
			e = e.sibling;
		}
	}
	var gu = !1, _u = !1, vu = !1, yu = !1, bu = typeof WeakSet == "function" ? WeakSet : Set, xu = null, Su = !1, Cu = !1, wu = !1, Tu = !1;
	function Eu(e, t, n) {
		if (e = e.containerInfo, Cp = kh, e = oi(e), si(e)) {
			if ("selectionStart" in e) var r = {
				start: e.selectionStart,
				end: e.selectionEnd
			};
			else a: {
				r = (r = e.ownerDocument) && r.defaultView || window;
				var i = r.getSelection && r.getSelection();
				if (i && i.rangeCount !== 0) {
					r = i.anchorNode;
					var a = i.anchorOffset, o = i.focusNode;
					i = i.focusOffset;
					try {
						r.nodeType, o.nodeType;
					} catch {
						r = null;
						break a;
					}
					var s = 0, c = -1, l = -1, u = 0, d = 0, f = e, p = null;
					b: for (;;) {
						for (var m; f !== r || a !== 0 && f.nodeType !== 3 || (c = s + a), f !== o || i !== 0 && f.nodeType !== 3 || (l = s + i), f.nodeType === 3 && (s += f.nodeValue.length), (m = f.firstChild) !== null;) p = f, f = m;
						for (;;) {
							if (f === e) break b;
							if (p === r && ++u === a && (c = s), p === o && ++d === i && (l = s), (m = f.nextSibling) !== null) break;
							f = p, p = f.parentNode;
						}
						f = m;
					}
					r = c === -1 || l === -1 ? null : {
						start: c,
						end: l
					};
				} else r = null;
			}
			r ||= {
				start: 0,
				end: 0
			};
		} else r = null;
		for (wp = {
			focusedElem: e,
			selectionRange: r
		}, kh = !1, n = (n & 335544064) === n, xu = t, t = n ? 9270 : 1024; xu !== null;) {
			if (e = xu, n && (r = e.deletions, r !== null)) for (a = 0; a < r.length; a++) n && lu(r[a]);
			if (e.alternate === null && e.flags & 2) n && $l(e), Du(n);
			else {
				if (e.tag === 22) {
					if (r = e.alternate, e.memoizedState !== null) {
						r !== null && r.memoizedState === null && n && lu(r), Du(n);
						continue;
					}
					if (r !== null && r.memoizedState !== null) {
						n && $l(e), Du(n);
						continue;
					}
				}
				r = e.child, (e.subtreeFlags & t) !== 0 && r !== null ? (r.return = e, xu = r) : (n && uu(e), Du(n));
			}
		}
		Ql = null;
	}
	function Du(e) {
		for (; xu !== null;) {
			var t = xu, n = e, r = t.alternate, i = t.flags;
			switch (t.tag) {
				case 0:
				case 11:
				case 15: break;
				case 1:
					if (i & 1024 && r !== null) {
						n = void 0, i = r.memoizedProps, r = r.memoizedState;
						var o = t.stateNode;
						try {
							var s = Pc(t.type, i);
							n = o.getSnapshotBeforeUpdate(s, r), o.__reactInternalSnapshotBeforeUpdate = n;
						} catch (e) {
							Of(t, t.return, e);
						}
					}
					break;
				case 3:
					if (i & 1024) {
						if (r = t.stateNode.containerInfo, n = r.nodeType, n === 9) vm(r);
						else if (n === 1) switch (r.nodeName) {
							case "HEAD":
							case "HTML":
							case "BODY":
								vm(r);
								break;
							default: r.textContent = "";
						}
					}
					break;
				case 5:
				case 26:
				case 27:
				case 6:
				case 4:
				case 17: break;
				case 30:
					n && r !== null && (n = Ai(r.memoizedProps, r.stateNode), i = t.memoizedProps, i = Mi(i.default, i.update), i !== "none" && ru(r, n, i, r.memoizedState = [], !0));
					break;
				default: if (i & 1024) throw Error(a(163));
			}
			if (r = t.sibling, r !== null) {
				r.return = t.return, xu = r;
				break;
			}
			xu = t.return;
		}
	}
	function Ou(e, t, n) {
		var r = n.flags;
		switch (n.tag) {
			case 0:
			case 11:
			case 15:
				Ju(e, n), r & 4 && Nl(5, n);
				break;
			case 1:
				if (Ju(e, n), r & 4) {
					if (e = n.stateNode, t === null) try {
						e.componentDidMount();
					} catch (e) {
						Of(n, n.return, e);
					}
					else {
						var i = Pc(n.type, t.memoizedProps);
						t = t.memoizedState;
						try {
							e.componentDidUpdate(i, t, e.__reactInternalSnapshotBeforeUpdate);
						} catch (e) {
							Of(n, n.return, e);
						}
					}
				}
				r & 64 && Fl(n), r & 512 && Ll(n, n.return);
				break;
			case 3:
				if (Ju(e, n), r & 64 && (e = n.updateQueue, e !== null)) {
					if (t = null, n.child !== null) switch (n.child.tag) {
						case 27:
						case 5:
							t = n.child.stateNode;
							break;
						case 1: t = n.child.stateNode;
					}
					try {
						Fo(e, t);
					} catch (e) {
						Of(n, n.return, e);
					}
				}
				break;
			case 27: t === null && r & 4 && Xl(n);
			case 26:
			case 5:
				Ju(e, n), t === null && r & 4 && Wl(n), r & 512 && Ll(n, n.return);
				break;
			case 12:
				Ju(e, n);
				break;
			case 31:
				Ju(e, n), r & 4 && Lu(e, n);
				break;
			case 13:
				Ju(e, n), r & 4 && Ru(e, n), r & 64 && (e = n.memoizedState, e !== null && (e = e.dehydrated, e !== null && (n = Mf.bind(null, n), wm(e, n))));
				break;
			case 22:
				if (r = n.memoizedState !== null || gu, !r) {
					var a = t !== null && t.memoizedState !== null || _u;
					t = gu, i = _u, gu = r, (_u = a) && !i ? (r = 2, n.subtreeFlags & 8772 && (r |= 1), Xu(e, n, r)) : Ju(e, n), gu = t, _u = i;
				}
				break;
			case 30:
				Ju(e, n), r & 512 && Ll(n, n.return);
				break;
			case 7: r & 512 && Ll(n, n.return);
			default: Ju(e, n);
		}
	}
	function ku(e, t) {
		for (e = e.child; e !== null;) Au(e, t), e = e.sibling;
	}
	function Au(e, t) {
		switch (e.tag) {
			case 5:
			case 26:
				try {
					var n = e.stateNode;
					if (t) {
						var r = n.style;
						typeof r.setProperty == "function" ? r.setProperty("display", "none", "important") : r.display = "none";
					} else {
						var i = e.stateNode, a = e.memoizedProps.style, o = a != null && a.hasOwnProperty("display") ? a.display : null;
						i.style.display = o == null || typeof o == "boolean" ? "" : ("" + o).trim();
					}
				} catch (t) {
					Of(e, e.return, t);
				}
				ju(e, t);
				break;
			case 6:
				try {
					e.stateNode.nodeValue = t ? "" : e.memoizedProps, E = !0;
				} catch (t) {
					Of(e, e.return, t);
				}
				break;
			case 18:
				try {
					var s = e.stateNode;
					t ? Bp(s, !0) : Bp(e.stateNode, !1);
				} catch (t) {
					Of(e, e.return, t);
				}
				break;
			case 22:
			case 23:
				e.memoizedState === null && ku(e, t);
				break;
			default: ku(e, t);
		}
	}
	function ju(e, t) {
		if (e.subtreeFlags & 67108864) for (e = e.child; e !== null;) {
			a: {
				var n = e, r = t;
				switch (n.tag) {
					case 4:
						Au(n, r);
						break a;
					case 22:
						n.memoizedState === null && ju(n, r);
						break a;
					default: ju(n, r);
				}
			}
			e = e.sibling;
		}
	}
	function Mu(e) {
		var t = e.alternate;
		t !== null && (e.alternate = null, Mu(t)), e.child = null, e.deletions = null, e.sibling = null, e.tag === 5 && (t = e.stateNode, t !== null && Wt(t)), e.stateNode = null, e.return = null, e.dependencies = null, e.memoizedProps = null, e.memoizedState = null, e.pendingProps = null, e.stateNode = null, e.updateQueue = null;
	}
	var Nu = null, Pu = !1;
	function Fu(e, t, n) {
		for (n = n.child; n !== null;) Iu(e, t, n), n = n.sibling;
	}
	function Iu(e, t, n) {
		if (lt && typeof lt.onCommitFiberUnmount == "function") try {
			lt.onCommitFiberUnmount(ct, n);
		} catch {}
		switch (n.tag) {
			case 26:
				_u || Rl(n, t), Fu(e, t, n), n.memoizedState ? n.memoizedState.count-- : n.stateNode && !_u && (n = n.stateNode, n.parentNode.removeChild(n));
				break;
			case 27:
				_u || Rl(n, t), Vl(n);
				var r = Nu, i = Pu;
				Rp(n.type) && (Nu = n.stateNode, Pu = !1), Fu(e, t, n), jm(n.stateNode, n.type, n.memoizedProps), Nu = r, Pu = i;
				break;
			case 5: _u || Rl(n, t), Vl(n);
			case 6:
				if (n.tag === 6 && Vl(n), r = Nu, i = Pu, Nu = null, Fu(e, t, n), Nu = r, Pu = i, Nu !== null) {
					if (Pu) try {
						(Nu.nodeType === 9 ? Nu.body : Nu.nodeName === "HTML" ? Nu.ownerDocument.body : Nu).removeChild(n.stateNode), E = !0;
					} catch (e) {
						Of(n, t, e);
					}
					else try {
						Nu.removeChild(n.stateNode), E = !0;
					} catch (e) {
						Of(n, t, e);
					}
				}
				break;
			case 18:
				Nu !== null && (Pu ? (e = Nu, zp(e.nodeType === 9 ? e.body : e.nodeName === "HTML" ? e.ownerDocument.body : e, n.stateNode), tg(e)) : zp(Nu, n.stateNode));
				break;
			case 4:
				r = Nu, i = Pu, Nu = n.stateNode.containerInfo, Pu = !0, Fu(e, t, n), Nu = r, Pu = i;
				break;
			case 0:
			case 11:
			case 14:
			case 15:
				Pl(2, n, t), _u || Pl(4, n, t), Fu(e, t, n);
				break;
			case 1:
				_u || (Rl(n, t), r = n.stateNode, typeof r.componentWillUnmount == "function" && Il(n, t, r)), Fu(e, t, n);
				break;
			case 21:
				Fu(e, t, n);
				break;
			case 22:
				_u = (r = _u) || n.memoizedState !== null, Fu(e, t, n), _u = r;
				break;
			case 30:
				Rl(n, t), Fu(e, t, n);
				break;
			case 7:
				_u || Rl(n, t), Fu(e, t, n);
				break;
			default: Fu(e, t, n);
		}
	}
	function Lu(e, t) {
		if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null))) {
			e = e.dehydrated;
			try {
				tg(e);
			} catch (e) {
				Of(t, t.return, e);
			}
		}
	}
	function Ru(e, t) {
		if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null && (e = e.dehydrated, e !== null)))) try {
			tg(e);
		} catch (e) {
			Of(t, t.return, e);
		}
	}
	function zu(e) {
		switch (e.tag) {
			case 31:
			case 13:
			case 19:
				var t = e.stateNode;
				return t === null && (t = e.stateNode = new bu()), t;
			case 22: return e = e.stateNode, t = e._retryCache, t === null && (t = e._retryCache = new bu()), t;
			default: throw Error(a(435, e.tag));
		}
	}
	function Bu(e, t) {
		var n = zu(e);
		t.forEach(function(t) {
			if (!n.has(t)) {
				n.add(t);
				var r = Nf.bind(null, e, t);
				t.then(r, r);
			}
		});
	}
	function Vu(e, t, n) {
		var r = t.deletions;
		if (r !== null) for (var i = 0; i < r.length; i++) {
			var o = r[i], s = e, c = t, l = c;
			a: for (; l !== null;) {
				switch (l.tag) {
					case 27:
						if (Rp(l.type)) {
							Nu = l.stateNode, Pu = !1;
							break a;
						}
						break;
					case 5:
						Nu = l.stateNode, Pu = !1;
						break a;
					case 3:
					case 4:
						Nu = l.stateNode.containerInfo, Pu = !0;
						break a;
				}
				l = l.return;
			}
			if (Nu === null) throw Error(a(160));
			Iu(s, c, o), Nu = null, Pu = !1, s = o.alternate, s !== null && (s.return = null), o.return = null;
		}
		if (t.subtreeFlags & 13886) for (t = t.child; t !== null;) Uu(t, e, n), t = t.sibling;
	}
	var Hu = null;
	function Uu(e, t, n) {
		var r = e.alternate, i = e.flags;
		switch (e.tag) {
			case 0:
			case 11:
			case 14:
			case 15:
				if (i & 4 && (r = e.updateQueue, r = r === null ? null : r.events, r !== null)) for (var o = 0; o < r.length; o++) {
					var s = r[o];
					s.ref.impl = s.nextImpl;
				}
				Vu(t, e, n), Wu(e), i & 4 && (Pl(3, e, e.return), Nl(3, e), Pl(5, e, e.return));
				break;
			case 1:
				Vu(t, e, n), Wu(e), i & 512 && (_u || r === null || Rl(r, r.return)), i & 64 && gu && (e = e.updateQueue, e !== null && (t = e.callbacks, t !== null && (n = e.shared.hiddenCallbacks, e.shared.hiddenCallbacks = n === null ? t : n.concat(t))));
				break;
			case 26:
				if (o = Hu, Vu(t, e, n), Wu(e), i & 512 && (_u || r === null || Rl(r, r.return)), i & 4) {
					if (i = r === null ? null : r.memoizedState, n = e.memoizedState, r === null) {
						if (n === null) {
							if (e.stateNode === null) {
								if (gu) e.stateNode = Op(e.type, e.memoizedProps, t.containerInfo, e);
								else {
									a: {
										t = e.type, n = e.memoizedProps, i = o.ownerDocument || o;
										b: switch (t) {
											case "title":
												r = i.getElementsByTagName("title")[0], (!r || r[Ht] || r[Ft] || r.namespaceURI === "http://www.w3.org/2000/svg" || r.hasAttribute("itemprop")) && (r = i.createElement(t), i.head.insertBefore(r, i.querySelector("head > title"))), vp(r, t, n), r[Ft] = e, Yt(r), t = r;
												break a;
											case "link":
												if (o = ih("link", "href", i).get(t + (n.href || ""))) {
													for (s = 0; s < o.length; s++) if (r = o[s], r.getAttribute("href") === (n.href == null || n.href === "" ? null : n.href) && r.getAttribute("rel") === (n.rel == null ? null : n.rel) && r.getAttribute("title") === (n.title == null ? null : n.title) && r.getAttribute("crossorigin") === (n.crossOrigin == null ? null : n.crossOrigin)) {
														o.splice(s, 1);
														break b;
													}
												}
												r = i.createElement(t), vp(r, t, n), i.head.appendChild(r);
												break;
											case "meta":
												if (o = ih("meta", "content", i).get(t + (n.content || ""))) {
													for (s = 0; s < o.length; s++) if (r = o[s], r.getAttribute("content") === (n.content == null ? null : "" + n.content) && r.getAttribute("name") === (n.name == null ? null : n.name) && r.getAttribute("property") === (n.property == null ? null : n.property) && r.getAttribute("http-equiv") === (n.httpEquiv == null ? null : n.httpEquiv) && r.getAttribute("charset") === (n.charSet == null ? null : n.charSet)) {
														o.splice(s, 1);
														break b;
													}
												}
												r = i.createElement(t), vp(r, t, n), i.head.appendChild(r);
												break;
											default: throw Error(a(468, t));
										}
										r[Ft] = e, Yt(r), t = r;
									}
									e.stateNode = t;
								}
							} else gu || ah(o, e.type, e.stateNode);
						} else e.stateNode = $m(o, n, e.memoizedProps);
					} else i === n ? n === null && e.stateNode !== null && Gl(e, e.memoizedProps, r.memoizedProps) : (i === null ? (t = r.stateNode, t === null || _u || t.parentNode.removeChild(t)) : i.count--, n === null ? gu || ah(o, e.type, e.stateNode) : $m(o, n, e.memoizedProps));
				}
				break;
			case 27:
				Vu(t, e, n), Wu(e), i & 512 && (_u || r === null || Rl(r, r.return)), r !== null && i & 4 && Gl(e, e.memoizedProps, r.memoizedProps);
				break;
			case 5:
				if (o = vu, vu = !1, Vu(t, e, n), vu = o, Wu(e), i & 512 && (_u || r === null || Rl(r, r.return)), e.flags & 32) {
					t = e.stateNode;
					try {
						Cn(t, ""), E = !0;
					} catch (t) {
						Of(e, e.return, t);
					}
				}
				i & 4 && e.stateNode != null && (t = e.memoizedProps, Gl(e, t, r === null ? t : r.memoizedProps)), i & 1024 && (yu = !0);
				break;
			case 6:
				if (Vu(t, e, n), Wu(e), i & 4) {
					if (e.stateNode === null) throw Error(a(162));
					t = e.memoizedProps, n = e.stateNode;
					try {
						n.nodeValue = t, E = !0;
					} catch (t) {
						Of(e, e.return, t);
					}
				}
				break;
			case 3:
				if (E = !1, rh = null, o = Hu, Hu = Fm(t.containerInfo), Vu(t, e, n), Hu = o, Wu(e), i & 4 && r !== null && r.memoizedState.isDehydrated) try {
					tg(t.containerInfo);
				} catch (t) {
					Of(e, e.return, t);
				}
				yu && (yu = !1, Gu(e)), E = !1;
				break;
			case 4:
				i = vu, vu = gu, r = on(), o = Hu, Hu = Fm(e.stateNode.containerInfo), Vu(t, e, n), Wu(e), Hu = o, E && Cu && (wu = !0), E = r, vu = i;
				break;
			case 12:
				Vu(t, e, n), Wu(e);
				break;
			case 31:
				Vu(t, e, n), Wu(e), i & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, Bu(e, t)));
				break;
			case 13:
				Vu(t, e, n), Wu(e), e.child.flags & 8192 && e.memoizedState !== null != (r !== null && r.memoizedState !== null) && (kd = $e()), i & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, Bu(e, t)));
				break;
			case 22:
				o = e.memoizedState !== null, s = r !== null && r.memoizedState !== null;
				var c = gu, l = _u, u = vu;
				gu = c || o, vu = u || o, _u = l || s, Vu(t, e, n), _u = l, vu = u, gu = c, Wu(e), i & 8192 && (t = e.stateNode, t._visibility = o ? t._visibility & -2 : t._visibility | 1, !o || r === null || s || gu || _u || (t = s || _u, n = gu, r = _u, gu = o || gu, _u = t, Yu(e, 2), gu = n, _u = r), !o && vu || ku(e, o)), i & 4 && (t = e.updateQueue, t !== null && (n = t.retryQueue, n !== null && (t.retryQueue = null, Bu(e, n))));
				break;
			case 19:
				Vu(t, e, n), Wu(e), i & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, Bu(e, t)));
				break;
			case 30:
				i & 512 && (_u || r === null || Rl(r, r.return)), i = on(), o = Cu, s = (n & 335544064) === n, c = e.memoizedProps, Cu = s && Mi(c.default, c.update) !== "none", Vu(t, e, n), Wu(e), s && r !== null && E && (e.flags |= 4), Cu = o, E = i;
				break;
			case 21: break;
			case 7: i & 512 && (_u || r === null || Rl(r, r.return)), r && r.stateNode !== null && (r.stateNode._fragmentFiber = e);
			default: Vu(t, e, n), Wu(e);
		}
	}
	function Wu(e) {
		var t = e.flags;
		if (t & 2) {
			try {
				for (var n, r = e.return; r !== null;) {
					if (Kl(r)) {
						n = r;
						break;
					}
					r = r.return;
				}
				r = null;
				for (var i = e.return; i !== null;) {
					if (Ul(i)) {
						var o = i.stateNode;
						r === null ? r = [o] : r.push(o);
					}
					if (Hl(i)) break;
					i = i.return;
				}
				var s = r;
				if (n == null) throw Error(a(160));
				switch (n.tag) {
					case 27:
						var c = n.stateNode;
						Yl(e, ql(e), c, s);
						break;
					case 5:
						var l = n.stateNode;
						n.flags & 32 && (Cn(l, ""), n.flags &= -33), Yl(e, ql(e), l, s);
						break;
					case 3:
					case 4:
						var u = n.stateNode.containerInfo;
						Jl(e, ql(e), u, s);
						break;
					default: throw Error(a(161));
				}
			} catch (t) {
				Of(e, e.return, t);
			}
			e.flags &= -3;
		}
		t & 4096 && (e.flags &= -4097);
	}
	function Gu(e) {
		if (e.subtreeFlags & 1024) for (e = e.child; e !== null;) {
			var t = e;
			Gu(t), t.tag === 5 && t.flags & 1024 && (t = t.stateNode, kh = !0, t.reset(), kh = !1), e = e.sibling;
		}
	}
	function Ku(e, t) {
		if (t.subtreeFlags & 9270) for (t = t.child; t !== null;) qu(t, e), t = t.sibling;
		else hu(t, !1);
	}
	function qu(e, t) {
		var n = e.alternate;
		if (n === null) su(e, !1);
		else switch (e.tag) {
			case 3:
				if (Tu = Su = !1, tu(), Ku(t, e), !Su && !wu) {
					if (e = eu, e !== null) for (var r = 0; r < e.length; r += 3) {
						n = e[r];
						var i = e[r + 1];
						Hp(n, e[r + 2]), n = n.ownerDocument.documentElement, n !== null && n.animate({
							opacity: [0, 0],
							pointerEvents: ["none", "none"]
						}, {
							duration: 0,
							fill: "forwards",
							pseudoElement: "::view-transition-group(" + i + ")"
						});
					}
					e = t.containerInfo, e = e.nodeType === 9 ? e.documentElement : e.ownerDocument.documentElement, e !== null && e.style.viewTransitionName === "" && (e.style.viewTransitionName = "none", e.animate({
						opacity: [0, 0],
						pointerEvents: ["none", "none"]
					}, {
						duration: 0,
						fill: "forwards",
						pseudoElement: "::view-transition-group(root)"
					}), e.animate({
						width: [0, 0],
						height: [0, 0]
					}, {
						duration: 0,
						fill: "forwards",
						pseudoElement: "::view-transition"
					})), Tu = !0;
				}
				eu = null;
				break;
			case 5:
				Ku(t, e);
				break;
			case 4:
				r = Su, Su = !1, Ku(t, e), Su && (wu = !0), Su = r;
				break;
			case 22:
				e.memoizedState === null && (n.memoizedState === null ? Ku(t, e) : su(e, !1));
				break;
			case 30:
				r = Su, i = tu(), Su = !1, Ku(t, e), Su && (e.flags |= 4);
				var a = e.memoizedProps, o = e.stateNode;
				t = Ai(a, o), o = Ai(n.memoizedProps, o);
				var s = Mi(a.default, a.update);
				s === "none" ? t = !1 : (a = n.memoizedState, n.memoizedState = null, n = e.child, nu = 0, t = mu(e, n, t, o, s, a, !0), nu !== (a === null ? 0 : a.length) && (e.flags |= 32)), e.flags & 4 && t ? (qd(e, e.memoizedProps.onUpdate), eu = i) : i !== null && (i.push.apply(i, eu), eu = i), Su = e.flags & 32 ? !0 : r;
				break;
			default: Ku(t, e);
		}
	}
	function Ju(e, t) {
		if (t.subtreeFlags & 8772) for (t = t.child; t !== null;) Ou(e, t.alternate, t), t = t.sibling;
	}
	function Yu(e, t) {
		for (e = e.child; e !== null;) {
			var n = e, r = t;
			switch (n.tag) {
				case 0:
				case 11:
				case 14:
				case 15:
					Pl(4, n, n.return), Yu(n, r);
					break;
				case 1:
					Rl(n, n.return);
					var i = n.stateNode;
					typeof i.componentWillUnmount == "function" && Il(n, n.return, i), Yu(n, r);
					break;
				case 27: r & 2 && jm(n.stateNode, n.type, n.memoizedProps);
				case 5:
					Rl(n, n.return), n.tag !== 5 && n.tag !== 27 || Vl(n), Yu(n, r);
					break;
				case 6:
					Vl(n);
					break;
				case 26:
					Rl(n, n.return), i = n.stateNode, n.memoizedState !== null || i === null || _u || i.parentNode.removeChild(i), Yu(n, r);
					break;
				case 22:
					n.memoizedState === null && Yu(n, r);
					break;
				case 30:
					Rl(n, n.return), Yu(n, r);
					break;
				case 7: Rl(n, n.return);
				default: Yu(n, r);
			}
			e = e.sibling;
		}
	}
	function Xu(e, t, n) {
		for (n = t.subtreeFlags & 8772 ? n : n & -2, t = t.child; t !== null;) {
			var r = t.alternate, i = e, a = t, o = a.flags, s = !!(n & 1);
			switch (a.tag) {
				case 0:
				case 11:
				case 15:
					Xu(i, a, n), Nl(4, a);
					break;
				case 1:
					if (Xu(i, a, n), r = a, i = r.stateNode, typeof i.componentDidMount == "function") try {
						i.componentDidMount();
					} catch (e) {
						Of(r, r.return, e);
					}
					if (r = a, i = r.updateQueue, i !== null) {
						var c = r.stateNode;
						try {
							var l = i.shared.hiddenCallbacks;
							if (l !== null) for (i.shared.hiddenCallbacks = null, i = 0; i < l.length; i++) Po(l[i], c);
						} catch (e) {
							Of(r, r.return, e);
						}
					}
					s && o & 64 && Fl(a), Ll(a, a.return);
					break;
				case 27: n & 2 && Xl(a);
				case 5:
					a.tag !== 5 && a.tag !== 27 || Bl(a), Xu(i, a, n), s && r === null && o & 4 && Wl(a), Ll(a, a.return);
					break;
				case 6:
					Bl(a);
					break;
				case 26:
					c = a.stateNode, a.memoizedState !== null || c === null || gu || ah(Fm(c.ownerDocument), a.type, c), Xu(i, a, n), s && r === null && o & 4 && Wl(a), Ll(a, a.return);
					break;
				case 12:
					Xu(i, a, n);
					break;
				case 31:
					Xu(i, a, n), s && o & 4 && Lu(i, a);
					break;
				case 13:
					Xu(i, a, n), s && o & 4 && Ru(i, a);
					break;
				case 22:
					a.memoizedState === null && Xu(i, a, n), Ll(a, a.return);
					break;
				case 30:
					Xu(i, a, n), Ll(a, a.return);
					break;
				case 7: Ll(a, a.return);
				default: Xu(i, a, n);
			}
			t = t.sibling;
		}
	}
	function Zu(e, t) {
		var n = null;
		e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), e = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (e = t.memoizedState.cachePool.pool), e !== n && (e != null && e.refCount++, n != null && Wa(n));
	}
	function Qu(e, t) {
		e = null, t.alternate !== null && (e = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== e && (t.refCount++, e != null && Wa(e));
	}
	function $u(e, t, n, r) {
		var i = (n & 335544064) === n;
		if (t.subtreeFlags & (i ? 10262 : 10256)) for (t = t.child; t !== null;) ed(e, t, n, r), t = t.sibling;
		else i && pu(t);
	}
	function ed(e, t, n, r) {
		var i = (n & 335544064) === n;
		i && t.alternate === null && t.return !== null && t.return.alternate !== null && fu(t);
		var a = t.flags;
		switch (t.tag) {
			case 0:
			case 11:
			case 15:
				$u(e, t, n, r), a & 2048 && Nl(9, t);
				break;
			case 1:
				$u(e, t, n, r);
				break;
			case 3:
				$u(e, t, n, r), i && Tu && (e = e.containerInfo, e = e.nodeType === 9 ? e.body : e.nodeName === "HTML" ? e.ownerDocument.body : e, e.style.viewTransitionName === "root" && (e.style.viewTransitionName = ""), e = e.ownerDocument.documentElement, e !== null && e.style.viewTransitionName === "none" && (e.style.viewTransitionName = "")), a & 2048 && (a = null, t.alternate !== null && (a = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== a && (t.refCount++, a != null && Wa(a)));
				break;
			case 12:
				if (a & 2048) {
					$u(e, t, n, r), a = t.stateNode;
					try {
						var o = t.memoizedProps, s = o.id, c = o.onPostCommit;
						typeof c == "function" && c(s, t.alternate === null ? "mount" : "update", a.passiveEffectDuration, -0);
					} catch (e) {
						Of(t, t.return, e);
					}
				} else $u(e, t, n, r);
				break;
			case 31:
				$u(e, t, n, r);
				break;
			case 13:
				$u(e, t, n, r);
				break;
			case 23: break;
			case 22:
				o = t.stateNode, s = t.alternate, t.memoizedState === null ? (i && s !== null && s.memoizedState !== null && fu(t), o._visibility & 2 ? $u(e, t, n, r) : (o._visibility |= 2, td(e, t, n, r, !!(t.subtreeFlags & 10256) || !1))) : (i && s !== null && s.memoizedState === null && fu(s), o._visibility & 2 ? $u(e, t, n, r) : nd(e, t)), a & 2048 && Zu(s, t);
				break;
			case 24:
				$u(e, t, n, r), a & 2048 && Qu(t.alternate, t);
				break;
			case 30:
				i && (a = t.alternate, a !== null && (au(a.child, !0), au(t.child, !0))), $u(e, t, n, r);
				break;
			default: $u(e, t, n, r);
		}
	}
	function td(e, t, n, r, i) {
		for (i &&= !!(t.subtreeFlags & 10256) || !1, t = t.child; t !== null;) {
			var a = e, o = t, s = n, c = r, l = o.flags;
			switch (o.tag) {
				case 0:
				case 11:
				case 15:
					td(a, o, s, c, i), Nl(8, o);
					break;
				case 23: break;
				case 22:
					var u = o.stateNode;
					o.memoizedState === null ? (u._visibility |= 2, td(a, o, s, c, i)) : u._visibility & 2 ? td(a, o, s, c, i) : nd(a, o), i && l & 2048 && Zu(o.alternate, o);
					break;
				case 24:
					td(a, o, s, c, i), i && l & 2048 && Qu(o.alternate, o);
					break;
				default: td(a, o, s, c, i);
			}
			t = t.sibling;
		}
	}
	function nd(e, t) {
		if (t.subtreeFlags & 10256) for (t = t.child; t !== null;) {
			var n = e, r = t, i = r.flags;
			switch (r.tag) {
				case 22:
					nd(n, r), i & 2048 && Zu(r.alternate, r);
					break;
				case 24:
					nd(n, r), i & 2048 && Qu(r.alternate, r);
					break;
				default: nd(n, r);
			}
			t = t.sibling;
		}
	}
	var rd = 8192;
	function id(e, t, n) {
		if (e.subtreeFlags & rd) for (e = e.child; e !== null;) ad(e, t, n), e = e.sibling;
	}
	function ad(e, t, n) {
		switch (e.tag) {
			case 26:
				id(e, t, n), e.flags & rd && (e.memoizedState === null ? (e = e.stateNode, (t & 335544128) === t && uh(n, e)) : dh(n, Hu, e.memoizedState, e.memoizedProps));
				break;
			case 5:
				id(e, t, n), e.flags & rd && (e = e.stateNode, (t & 335544128) === t && uh(n, e));
				break;
			case 3:
			case 4:
				var r = Hu;
				Hu = Fm(e.stateNode.containerInfo), id(e, t, n), Hu = r;
				break;
			case 22:
				e.memoizedState === null && (r = e.alternate, r !== null && r.memoizedState !== null ? (r = rd, rd = 16777216, id(e, t, n), rd = r) : id(e, t, n));
				break;
			case 30:
				if ((e.flags & rd) !== 0 && (r = e.memoizedProps.name, r != null && r !== "auto")) {
					var i = e.stateNode;
					i.paired = null, Ql === null && (Ql = /* @__PURE__ */ new Map()), Ql.set(r, i);
				}
				id(e, t, n);
				break;
			default: id(e, t, n);
		}
	}
	function od(e) {
		var t = e.alternate;
		if (t !== null && (e = t.child, e !== null)) {
			t.child = null;
			do
				t = e.sibling, e.sibling = null, e = t;
			while (e !== null);
		}
	}
	function sd(e) {
		var t = e.deletions;
		if (e.flags & 16) {
			if (t !== null) for (var n = 0; n < t.length; n++) {
				var r = t[n];
				xu = r, ud(r, e);
			}
			od(e);
		}
		if (e.subtreeFlags & 10256) for (e = e.child; e !== null;) cd(e), e = e.sibling;
	}
	function cd(e) {
		switch (e.tag) {
			case 0:
			case 11:
			case 15:
				sd(e), e.flags & 2048 && Pl(9, e, e.return);
				break;
			case 3:
				sd(e);
				break;
			case 12:
				sd(e);
				break;
			case 22:
				var t = e.stateNode;
				e.memoizedState !== null && t._visibility & 2 && (e.return === null || e.return.tag !== 13) ? (t._visibility &= -3, ld(e)) : sd(e);
				break;
			default: sd(e);
		}
	}
	function ld(e) {
		var t = e.deletions;
		if (e.flags & 16) {
			if (t !== null) for (var n = 0; n < t.length; n++) {
				var r = t[n];
				xu = r, ud(r, e);
			}
			od(e);
		}
		for (e = e.child; e !== null;) {
			switch (t = e, t.tag) {
				case 0:
				case 11:
				case 15:
					Pl(8, t, t.return), ld(t);
					break;
				case 22:
					n = t.stateNode, n._visibility & 2 && (n._visibility &= -3, ld(t));
					break;
				default: ld(t);
			}
			e = e.sibling;
		}
	}
	function ud(e, t) {
		for (; xu !== null;) {
			var n = xu;
			switch (n.tag) {
				case 0:
				case 11:
				case 15:
					Pl(8, n, t);
					break;
				case 23:
				case 22:
					if (n.memoizedState !== null && n.memoizedState.cachePool !== null) {
						var r = n.memoizedState.cachePool.pool;
						r != null && r.refCount++;
					}
					break;
				case 24: Wa(n.memoizedState.cache);
			}
			if (r = n.child, r !== null) r.return = n, xu = r;
			else a: for (n = e; xu !== null;) {
				r = xu;
				var i = r.sibling, a = r.return;
				if (Mu(r), r === n) {
					xu = null;
					break a;
				}
				if (i !== null) {
					i.return = a, xu = i;
					break a;
				}
				xu = a;
			}
		}
	}
	var dd = {
		getCacheForType: function(e) {
			var t = Ra(O), n = t.data.get(e);
			return n === void 0 && (n = e(), t.data.set(e, n)), n;
		},
		cacheSignal: function() {
			return Ra(O).controller.signal;
		}
	}, fd = typeof WeakMap == "function" ? WeakMap : Map, pd = 0, md = null, N = null, P = 0, hd = 0, F = null, gd = !1, _d = !1, vd = !1, yd = 0, bd = 0, xd = 0, Sd = 0, Cd = 0, wd = 0, Td = 0, Ed = null, Dd = null, Od = !1, kd = 0, Ad = 0, jd = Infinity, Md = null, I = null, Nd = 0, Pd = null, Fd = null, Id = 0, Ld = 0, Rd = null, zd = null, Bd = null, Vd = null, Hd = null, Ud = 0, Wd = null;
	function Gd() {
		return pd & 2 && P !== 0 ? P & -P : w.T === null ? Mt() : Yf();
	}
	function Kd() {
		if (wd === 0) {
			if (!(P & 536870912) || D) {
				var e = gt;
				gt <<= 1, !(gt & 3932160) && (gt = 262144), wd = e;
			} else wd = 536870912;
		}
		return e = Vo.current, e !== null && (e.flags |= 32), wd;
	}
	function qd(e, t) {
		if (t != null) {
			var n = e.stateNode, r = n.ref;
			r === null && (r = n.ref = Xp(Ai(e.memoizedProps, n))), Vd === null && (Vd = []), Vd.push(t.bind(null, r));
		}
	}
	function Jd(e, t, n) {
		(e === md && (hd === 2 || hd === 9) || e.cancelPendingCommit !== null) && (tf(e, 0), Qd(e, P, wd, !1)), Tt(e, n), (!(pd & 2) || e !== md) && (e === md && (!(pd & 2) && (Sd |= n), bd === 4 && Qd(e, P, wd, !1)), Vf(e));
	}
	function Yd(e, t, n) {
		if (pd & 6) throw Error(a(327));
		var r = !n && !(t & 127) && (t & e.expiredLanes) === 0 || bt(e, t), i = r ? uf(e, t) : cf(e, t, !0), o = r;
		do {
			if (i === 0) {
				_d && !r && Qd(e, t, 0, !1);
				break;
			}
			if (n = e.current.alternate, o && !Zd(n)) {
				i = cf(e, t, !1), o = !1;
				continue;
			}
			if (i === 2) {
				if (o = t, e.errorRecoveryDisabledLanes & o) var s = 0;
				else s = e.pendingLanes & -536870913, s = s === 0 ? s & 536870912 ? 536870912 : 0 : s;
				if (s !== 0) {
					t = s;
					a: {
						var c = e;
						i = Ed;
						var l = c.current.memoizedState.isDehydrated;
						if (l && (tf(c, s).flags |= 256), s = cf(c, s, !1), s !== 2 && s !== 6) {
							if (vd && !l) {
								c.errorRecoveryDisabledLanes |= o, Sd |= o, i = 4;
								break a;
							}
							o = Dd, Dd = i, o !== null && (Dd === null ? Dd = o : Dd.push.apply(Dd, o));
						}
						i = s;
					}
					if (o = !1, i !== 2) continue;
				}
			}
			if (i === 1) {
				tf(e, 0), Qd(e, t, 0, !0);
				break;
			}
			a: {
				switch (r = e, o = i, o) {
					case 0:
					case 1: throw Error(a(345));
					case 4: if ((t & 4194048) !== t && (t & 62914560) !== t) break;
					case 6:
						Qd(r, t, wd, !gd);
						break a;
					case 2:
						Dd = null;
						break;
					case 3:
					case 5: break;
					default: throw Error(a(329));
				}
				if ((t & 62914560) === t && (i = kd + 300 - $e(), 10 < i)) {
					if (Qd(r, t, wd, !gd), yt(r, 0, !0) !== 0) break a;
					Id = t, r.timeoutHandle = Mp(Xd.bind(null, r, n, Dd, Md, Od, t, wd, Sd, Td, gd, o, "Throttled", -0, 0), i);
					break a;
				}
				Xd(r, n, Dd, Md, Od, t, wd, Sd, Td, gd, o, null, -0, 0);
			}
			break;
		} while (1);
		Vf(e);
	}
	function Xd(e, t, n, r, i, a, o, s, c, l, u, d, f, p) {
		e.timeoutHandle = -1;
		var m = t.subtreeFlags, h = (a & 335544064) === a;
		if (d = null, (h || m & 8192 || (m & 16785408) == 16785408) && (d = {
			stylesheets: null,
			count: 0,
			imgCount: 0,
			imgBytes: 0,
			suspenseyImages: [],
			waitingForImages: !0,
			waitingForViewTransition: !1,
			unsuspend: jn
		}, Ql = null, ad(t, a, d), h && (m = d, h = e.containerInfo, h = (h.nodeType === 9 ? h : h.ownerDocument).__reactViewTransition, h != null && (m.count++, m.waitingForViewTransition = !0, m = hh.bind(m), h.finished.then(m, m))), m = (a & 62914560) === a ? kd - $e() : (a & 4194048) === a ? Ad - $e() : 0, m = ph(d, m), m !== null)) {
			Id = a, e.cancelPendingCommit = m(_f.bind(null, e, t, a, n, r, i, o, s, c, l, u, d, null, f, p)), Qd(e, a, o, !l);
			return;
		}
		_f(e, t, a, n, r, i, o, s, c, l, u, d);
	}
	function Zd(e) {
		for (var t = e;;) {
			var n = t.tag;
			if ((n === 0 || n === 11 || n === 15) && t.flags & 16384 && (n = t.updateQueue, n !== null && (n = n.stores, n !== null))) for (var r = 0; r < n.length; r++) {
				var i = n[r], a = i.getSnapshot;
				i = i.value;
				try {
					if (!ei(a(), i)) return !1;
				} catch {
					return !1;
				}
			}
			if (n = t.child, t.subtreeFlags & 16384 && n !== null) n.return = t, t = n;
			else {
				if (t === e) break;
				for (; t.sibling === null;) {
					if (t.return === null || t.return === e) return !0;
					t = t.return;
				}
				t.sibling.return = t.return, t = t.sibling;
			}
		}
		return !0;
	}
	function Qd(e, t, n, r) {
		t = xt(e, t), t &= ~Cd, t &= ~Sd, e.suspendedLanes |= t, e.pingedLanes &= ~t, r && (e.warmLanes |= t), r = e.expirationTimes;
		for (var i = t; 0 < i;) {
			var a = 31 - dt(i), o = 1 << a;
			r[a] = -1, i &= ~o;
		}
		n !== 0 && Dt(e, n, t);
	}
	function $d() {
		return pd & 6 ? !0 : (Hf(0, !1), !1);
	}
	function ef() {
		if (N !== null) {
			if (hd === 0) var e = N.return;
			else e = N, Aa = ka = null, gs(e), go = null, _o = 0, e = N;
			for (; e !== null;) Ml(e.alternate, e), e = e.return;
			N = null;
		}
	}
	function tf(e, t) {
		var n = e.timeoutHandle;
		return n !== -1 && (e.timeoutHandle = -1, Np(n)), n = e.cancelPendingCommit, n !== null && (e.cancelPendingCommit = null, n()), Id = 0, ef(), md = e, N = n = qi(e.current, null), P = t, hd = 0, F = null, gd = !1, _d = bt(e, t), vd = !1, Td = wd = Cd = Sd = xd = bd = 0, Dd = Ed = null, Od = !1, yd = xt(e, t), Li(), n;
	}
	function nf(e, t) {
		j = null, w.H = Ec, t === ao || t === so ? (t = mo(), hd = 3) : t === oo ? (t = mo(), hd = 4) : hd = t === Wc ? 8 : typeof t == "object" && t && typeof t.then == "function" ? 6 : 1, F = t, N === null && (bd = 1, Rc(e, ta(t, e.current)));
	}
	function rf() {
		var e = Vo.current;
		return e === null ? !0 : (P & 4194048) === P ? Ho === null : (P & 62914560) === P || P & 536870912 ? e === Ho : !1;
	}
	function af() {
		var e = w.H;
		return w.H = Ec, e === null ? Ec : e;
	}
	function of() {
		var e = w.A;
		return w.A = dd, e;
	}
	function sf() {
		bd = 4, gd || (P & 4194048) !== P && Vo.current !== null || (_d = !0), !(xd & 134217727) && !(Sd & 134217727) || md === null || Qd(md, P, wd, !1);
	}
	function cf(e, t, n) {
		var r = pd;
		pd |= 2;
		var i = af(), a = of();
		(md !== e || P !== t) && (Md = null, tf(e, t)), t = !1;
		var o = bd;
		a: do
			try {
				if (hd !== 0 && N !== null) {
					var s = N, c = F;
					switch (hd) {
						case 8:
							ef(), o = 6;
							break a;
						case 3:
						case 2:
						case 9:
						case 6:
							Vo.current === null && (t = !0);
							var l = hd;
							if (hd = 0, F = null, mf(e, s, c, l), n && _d) {
								o = 0;
								break a;
							}
							break;
						default: l = hd, hd = 0, F = null, mf(e, s, c, l);
					}
				}
				lf(), o = bd;
				break;
			} catch (t) {
				nf(e, t);
			}
		while (1);
		return t && e.shellSuspendCounter++, Aa = ka = null, pd = r, w.H = i, w.A = a, N === null && (md = null, P = 0, Li()), o;
	}
	function lf() {
		for (; N !== null;) ff(N);
	}
	function uf(e, t) {
		var n = pd;
		pd |= 2;
		var r = af(), i = of();
		md !== e || P !== t ? (Md = null, jd = $e() + 500, tf(e, t)) : _d = bt(e, t);
		a: do
			try {
				if (hd !== 0 && N !== null) {
					t = N;
					var o = F;
					b: switch (hd) {
						case 1:
							hd = 0, F = null, mf(e, t, o, 1);
							break;
						case 2:
						case 9:
							if (lo(o)) {
								hd = 0, F = null, pf(t);
								break;
							}
							t = function() {
								hd !== 2 && hd !== 9 || md !== e || (hd = 7), Vf(e);
							}, o.then(t, t);
							break a;
						case 3:
							hd = 7;
							break a;
						case 4:
							hd = 5;
							break a;
						case 7:
							lo(o) ? (hd = 0, F = null, pf(t)) : (hd = 0, F = null, mf(e, t, o, 7));
							break;
						case 5:
							var s = null;
							switch (N.tag) {
								case 26: s = N.memoizedState;
								case 5:
								case 27:
									var c = N;
									if (s ? ch(s) : c.stateNode.complete) {
										hd = 0, F = null;
										var l = c.sibling;
										if (l !== null) N = l;
										else {
											var u = c.return;
											u === null ? N = null : (N = u, hf(u));
										}
										break b;
									}
							}
							hd = 0, F = null, mf(e, t, o, 5);
							break;
						case 6:
							hd = 0, F = null, mf(e, t, o, 6);
							break;
						case 8:
							ef(), bd = 6;
							break a;
						default: throw Error(a(462));
					}
				}
				df();
				break;
			} catch (t) {
				nf(e, t);
			}
		while (1);
		return Aa = ka = null, w.H = r, w.A = i, pd = n, N === null ? (md = null, P = 0, Li(), bd) : 0;
	}
	function df() {
		for (; N !== null && !Ze();) ff(N);
	}
	function ff(e) {
		var t = wl(e.alternate, e, yd);
		e.memoizedProps = e.pendingProps, t === null ? hf(e) : N = t;
	}
	function pf(e) {
		var t = e, n = t.alternate;
		switch (t.tag) {
			case 15:
			case 0:
				t = il(n, t, t.pendingProps, t.type, void 0, P);
				break;
			case 11:
				t = il(n, t, t.pendingProps, t.type.render, t.ref, P);
				break;
			case 5:
				gs(t);
				var r = t;
				r === ga && (D ? (Ca(r), r.tag === 5 && r.stateNode != null && (_a = r.stateNode)) : (Ca(r), D = !0));
			default: Ml(n, t), t = N = Ji(t, yd), t = wl(n, t, yd);
		}
		e.memoizedProps = e.pendingProps, t === null ? hf(e) : N = t;
	}
	function mf(e, t, n, r) {
		Aa = ka = null, gs(t), go = null, _o = 0;
		var i = t.return;
		try {
			if (Uc(e, i, t, n, P)) {
				bd = 1, Rc(e, ta(n, e.current)), N = null;
				return;
			}
		} catch (t) {
			if (i !== null) throw N = i, t;
			bd = 1, Rc(e, ta(n, e.current)), N = null;
			return;
		}
		t.flags & 32768 ? (D || r === 1 ? e = !0 : _d || P & 536870912 ? e = !1 : (gd = e = !0, (r === 2 || r === 9 || r === 3 || r === 6) && (r = Vo.current, r !== null && r.tag === 13 && (r.flags |= 16384))), gf(t, e)) : hf(t);
	}
	function hf(e) {
		var t = e;
		do {
			if (t.flags & 32768) {
				gf(t, gd);
				return;
			}
			e = t.return;
			var n = Al(t.alternate, t, yd);
			if (n !== null) {
				N = n;
				return;
			}
			if (t = t.sibling, t !== null) {
				N = t;
				return;
			}
			N = t = e;
		} while (t !== null);
		bd === 0 && (bd = 5);
	}
	function gf(e, t) {
		do {
			var n = jl(e.alternate, e);
			if (n !== null) {
				n.flags &= 32767, N = n;
				return;
			}
			if (n = e.return, n !== null && (n.flags |= 32768, n.subtreeFlags = 0, n.deletions = null), !t && (e = e.sibling, e !== null)) {
				N = e;
				return;
			}
			N = e = n;
		} while (e !== null);
		bd = 6, N = null;
	}
	function _f(e, t, n, r, i, o, s, c, l, u, d, f) {
		e.cancelPendingCommit = null;
		do
			Tf();
		while (Nd !== 0);
		if (pd & 6) throw Error(a(327));
		if (t !== null) {
			if (t === e.current) throw Error(a(177));
			e === md && (N = md = null, P = 0), Fd = t, Pd = e, Id = n, Rd = i, zd = r, vf(e, t, n, s, c, l, f);
		}
	}
	function vf(e, t, n, r, i, a, o) {
		var s = t.lanes | t.childLanes;
		if (Ld = s, s |= Ii, Et(e, n, s, r, i, a), Vd = null, (n & 335544064) === n ? (Hd = qa(e), r = 10262) : (Hd = null, r = 10256), (t.subtreeFlags & r) !== 0 || (t.flags & r) !== 0 ? (e.callbackNode = null, e.callbackPriority = 0, Pf(rt, function() {
			return Ef(), null;
		})) : (e.callbackNode = null, e.callbackPriority = 0), Zl = !1, r = !!(t.flags & 13878), t.subtreeFlags & 13878 || r) {
			r = w.T, w.T = null, i = De.p, De.p = 2, a = pd, pd |= 4;
			try {
				Eu(e, t, n);
			} finally {
				pd = a, De.p = i, w.T = r;
			}
		}
		Nd = 1, Zl ? Bd = Jp(o, e.containerInfo, Hd, xf, Sf, bf, Cf, Ef, yf, null, null) : (xf(), Sf(), Cf());
	}
	function yf(e) {
		if (Nd !== 0) {
			var t = Pd.onRecoverableError;
			t(e, { componentStack: null });
		}
	}
	function bf() {
		Nd === 3 && (Nd = 0, qu(Fd, Pd), Nd = 4);
	}
	function xf() {
		if (Nd === 1) {
			Nd = 0;
			var e = Pd, t = Fd, n = Id, r = !!(t.flags & 13878);
			if (t.subtreeFlags & 13878 || r) {
				r = w.T, w.T = null;
				var i = De.p;
				De.p = 2;
				var a = pd;
				pd |= 4;
				try {
					Cu = wu = !1, Uu(t, e, n), n = wp;
					var o = oi(e.containerInfo), s = n.focusedElem, c = n.selectionRange;
					if (o !== s && s && s.ownerDocument && ai(s.ownerDocument.documentElement, s)) {
						if (c !== null && si(s)) {
							var l = c.start, u = c.end;
							if (u === void 0 && (u = l), "selectionStart" in s) s.selectionStart = l, s.selectionEnd = Math.min(u, s.value.length);
							else {
								var d = s.ownerDocument || document, f = d && d.defaultView || window;
								if (f.getSelection) {
									var p = f.getSelection(), m = s.textContent.length, h = Math.min(c.start, m), g = c.end === void 0 ? h : Math.min(c.end, m);
									!p.extend && h > g && (o = g, g = h, h = o);
									var _ = ii(s, h), v = ii(s, g);
									if (_ && v && (p.rangeCount !== 1 || p.anchorNode !== _.node || p.anchorOffset !== _.offset || p.focusNode !== v.node || p.focusOffset !== v.offset)) {
										var y = d.createRange();
										y.setStart(_.node, _.offset), p.removeAllRanges(), h > g ? (p.addRange(y), p.extend(v.node, v.offset)) : (y.setEnd(v.node, v.offset), p.addRange(y));
									}
								}
							}
						}
						for (d = [], p = s; p = p.parentNode;) p.nodeType === 1 && d.push({
							element: p,
							left: p.scrollLeft,
							top: p.scrollTop
						});
						for (typeof s.focus == "function" && s.focus(), s = 0; s < d.length; s++) {
							var b = d[s];
							b.element.scrollLeft = b.left, b.element.scrollTop = b.top;
						}
					}
					kh = !!Cp, wp = Cp = null;
				} finally {
					pd = a, De.p = i, w.T = r;
				}
			}
			e.current = t, Nd = 2;
		}
	}
	function Sf() {
		if (Nd === 2) {
			Nd = 0;
			var e = Pd, t = Fd, n = !!(t.flags & 8772);
			if (t.subtreeFlags & 8772 || n) {
				n = w.T, w.T = null;
				var r = De.p;
				De.p = 2;
				var i = pd;
				pd |= 4;
				try {
					Ou(e, t.alternate, t);
				} finally {
					pd = i, De.p = r, w.T = n;
				}
			}
			Nd = 3;
		}
	}
	function Cf() {
		if (Nd === 4 || Nd === 3) {
			Nd = 0;
			var e = Bd;
			Bd = null, Qe();
			var t = Pd, n = Fd, r = Id, i = zd, a = (r & 335544064) === r ? 10262 : 10256;
			if ((n.subtreeFlags & a) !== 0 || (n.flags & a) !== 0 ? Nd = 5 : (Nd = 0, Fd = Pd = null, wf(t, t.pendingLanes)), a = t.pendingLanes, a === 0 && (I = null), jt(r), n = n.stateNode, lt && typeof lt.onCommitFiberRoot == "function") try {
				lt.onCommitFiberRoot(ct, n, void 0, (n.current.flags & 128) == 128);
			} catch {}
			if (i !== null) {
				n = w.T, a = De.p, De.p = 2, w.T = null;
				try {
					for (var o = t.onRecoverableError, s = 0; s < i.length; s++) {
						var c = i[s];
						o(c.value, { componentStack: c.stack });
					}
				} finally {
					w.T = n, De.p = a;
				}
			}
			if (i = Vd, o = Hd, Hd = null, i !== null && (Vd = null, o === null && (o = []), e !== null)) for (c = 0; c < i.length; c++) n = (0, i[c])(o), n !== void 0 && e.finished.finally(n);
			Id & 3 && Tf(), Vf(t), a = t.pendingLanes, r & 261930 && a & 42 ? t === Wd ? Ud++ : (Ud = 0, Wd = t) : (Ud = 0, Wd = null), Hf(0, !1);
		}
	}
	function wf(e, t) {
		(e.pooledCacheLanes &= t) === 0 && (t = e.pooledCache, t != null && (e.pooledCache = null, Wa(t)));
	}
	function Tf() {
		return Bd !== null && (Bd.skipTransition(), Bd = null), xf(), Sf(), Cf(), Ef();
	}
	function Ef() {
		if (Nd !== 5) return !1;
		var e = Pd, t = Ld;
		Ld = 0;
		var n = jt(Id), r = w.T, i = De.p;
		try {
			De.p = 32 > n ? 32 : n, w.T = null, n = Rd, Rd = null;
			var o = Pd, s = Id;
			if (Nd = 0, Fd = Pd = null, Id = 0, pd & 6) throw Error(a(331));
			var c = pd;
			if (pd |= 4, cd(o.current), ed(o, o.current, s, n), pd = c, Hf(0, !1), lt && typeof lt.onPostCommitFiberRoot == "function") try {
				lt.onPostCommitFiberRoot(ct, o);
			} catch {}
			return !0;
		} finally {
			De.p = i, w.T = r, wf(e, t);
		}
	}
	function Df(e, t, n) {
		t = ta(n, t), t = Bc(e.stateNode, t, 2), e = Oo(e, t, 2), e !== null && (Tt(e, 2), Vf(e));
	}
	function Of(e, t, n) {
		if (e.tag === 3) Df(e, e, n);
		else for (; t !== null;) {
			if (t.tag === 3) {
				Df(t, e, n);
				break;
			}
			if (t.tag === 1) {
				var r = t.stateNode;
				if (typeof t.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (I === null || !I.has(r))) {
					e = ta(n, e), n = Vc(2), r = Oo(t, n, 2), r !== null && (Hc(n, r, t, e), Tt(r, 2), Vf(r));
					break;
				}
			}
			t = t.return;
		}
	}
	function kf(e, t, n) {
		var r = e.pingCache;
		if (r === null) {
			r = e.pingCache = new fd();
			var i = /* @__PURE__ */ new Set();
			r.set(t, i);
		} else i = r.get(t), i === void 0 && (i = /* @__PURE__ */ new Set(), r.set(t, i));
		i.has(n) || (vd = !0, i.add(n), e = Af.bind(null, e, t, n), t.then(e, e));
	}
	function Af(e, t, n) {
		var r = e.pingCache;
		r !== null && r.delete(t), e.pingedLanes |= e.suspendedLanes & n, e.warmLanes &= ~n, md === e && (P & n) === n && (bd === 4 || bd === 3 && (P & 62914560) === P && 300 > $e() - kd ? pd & 2 ? Cd |= n : tf(e, 0) : Cd |= n, Td === P && (Td = 0)), Vf(e);
	}
	function jf(e, t) {
		t === 0 && (t = Ct()), e = Bi(e, t), e !== null && (Tt(e, t), Vf(e));
	}
	function Mf(e) {
		var t = e.memoizedState, n = 0;
		t !== null && (n = t.retryLane), jf(e, n);
	}
	function Nf(e, t) {
		var n = 0;
		switch (e.tag) {
			case 31:
			case 13:
				var r = e.stateNode, i = e.memoizedState;
				i !== null && (n = i.retryLane);
				break;
			case 19:
				r = e.stateNode;
				break;
			case 22:
				r = e.stateNode._retryCache;
				break;
			default: throw Error(a(314));
		}
		r !== null && r.delete(t), jf(e, n);
	}
	function Pf(e, t) {
		return Ye(e, t);
	}
	var Ff = null, If = null, Lf = !1, Rf = !1, zf = !1, Bf = 0;
	function Vf(e) {
		e !== If && e.next === null && (If === null ? Ff = If = e : If = If.next = e), Rf = !0, Lf || (Lf = !0, Jf());
	}
	function Hf(e, t) {
		if (!zf && Rf) {
			zf = !0;
			do
				for (var n = !1, r = Ff; r !== null;) {
					if (!t) {
						if (e !== 0) {
							var i = r.pendingLanes;
							if (i === 0) var a = 0;
							else {
								var o = r.suspendedLanes, s = r.pingedLanes;
								a = (1 << 31 - dt(42 | e) + 1) - 1, a &= i & ~(o & ~s), a = a & 201326741 ? a & 201326741 | 1 : a ? a | 2 : 0;
							}
							a !== 0 && (n = !0, qf(r, a));
						} else a = P, a = yt(r, r === md ? a : 0, r.cancelPendingCommit !== null || r.timeoutHandle !== -1), !(a & 3) || bt(r, a) || (n = !0, qf(r, a));
					}
					r = r.next;
				}
			while (n);
			zf = !1;
		}
	}
	function Uf() {
		Wf();
	}
	function Wf() {
		Rf = Lf = !1;
		var e = 0;
		Bf !== 0 && jp() && (e = Bf);
		for (var t = $e(), n = null, r = Ff; r !== null;) {
			var i = r.next, a = Gf(r, t);
			a === 0 ? (r.next = null, n === null ? Ff = i : n.next = i, i === null && (If = n)) : (n = r, (e !== 0 || a & 3) && (Rf = !0)), r = i;
		}
		Nd !== 0 && Nd !== 5 || Hf(e, !1), Bf !== 0 && (Bf = 0);
	}
	function Gf(e, t) {
		for (var n = e.suspendedLanes, r = e.pingedLanes, i = e.expirationTimes, a = e.pendingLanes & -62914561; 0 < a;) {
			var o = 31 - dt(a), s = 1 << o, c = i[o];
			c === -1 ? ((s & n) === 0 || (s & r) !== 0) && (i[o] = St(s, t)) : c <= t && (e.expiredLanes |= s), a &= ~s;
		}
		if (t = md, n = P, n = yt(e, e === t ? n : 0, e.cancelPendingCommit !== null || e.timeoutHandle !== -1), r = e.callbackNode, n === 0 || e === t && (hd === 2 || hd === 9) || e.cancelPendingCommit !== null) return r !== null && r !== null && Xe(r), e.callbackNode = null, e.callbackPriority = 0;
		if (!(n & 3) || bt(e, n)) {
			if (t = n & -n, t === e.callbackPriority) return t;
			switch (r !== null && Xe(r), jt(n)) {
				case 2:
				case 8:
					n = nt;
					break;
				case 32:
					n = rt;
					break;
				case 268435456:
					n = at;
					break;
				default: n = rt;
			}
			return r = Kf.bind(null, e), n = Ye(n, r), e.callbackPriority = t, e.callbackNode = n, t;
		}
		return r !== null && r !== null && Xe(r), e.callbackPriority = 2, e.callbackNode = null, 2;
	}
	function Kf(e, t) {
		if (Nd !== 0 && Nd !== 5) return e.callbackNode = null, e.callbackPriority = 0, null;
		var n = e.callbackNode;
		if (Tf() && e.callbackNode !== n) return null;
		var r = P;
		return r = yt(e, e === md ? r : 0, e.cancelPendingCommit !== null || e.timeoutHandle !== -1), r === 0 ? null : (Yd(e, r, t), Gf(e, $e()), e.callbackNode != null && e.callbackNode === n ? Kf.bind(null, e) : null);
	}
	function qf(e, t) {
		if (Tf()) return null;
		Yd(e, t, !0);
	}
	function Jf() {
		Ip(function() {
			pd & 6 ? Ye(tt, Uf) : Wf();
		});
	}
	function Yf() {
		if (Bf === 0) {
			var e = Xa;
			e === 0 && (e = ht, ht <<= 1, !(ht & 261888) && (ht = 256)), Bf = e;
		}
		return Bf;
	}
	function Xf(e) {
		return e == null || typeof e == "symbol" || typeof e == "boolean" ? null : typeof e == "function" ? e : An(e);
	}
	function Zf(e, t, n, r, i) {
		if (t === "submit" && n && n.stateNode === i) {
			var a = Xf((i[It] || null).action), o = r.submitter;
			o && (t = (t = o[It] || null) ? Xf(t.formAction) : o.getAttribute("formAction"), t !== null && (a = t, o = null));
			var s = new Qn("action", "action", null, r, i);
			e.push({
				event: s,
				listeners: [{
					instance: null,
					listener: function() {
						if (r.defaultPrevented) {
							if (Bf !== 0) {
								var e = new FormData(i, o);
								fc(n, {
									pending: !0,
									data: e,
									method: i.method,
									action: a
								}, null, e);
							}
						} else typeof a == "function" && (s.preventDefault(), e = new FormData(i, o), fc(n, {
							pending: !0,
							data: e,
							method: i.method,
							action: a
						}, a, e));
					},
					currentTarget: i
				}]
			});
		}
	}
	for (var Qf = 0; Qf < Di.length; Qf++) {
		var $f = Di[Qf];
		Oi($f.toLowerCase(), "on" + ($f[0].toUpperCase() + $f.slice(1)));
	}
	Oi(yi, "onAnimationEnd"), Oi(bi, "onAnimationIteration"), Oi(xi, "onAnimationStart"), Oi("dblclick", "onDoubleClick"), Oi("focusin", "onFocus"), Oi("focusout", "onBlur"), Oi(Si, "onTransitionRun"), Oi(Ci, "onTransitionStart"), Oi(wi, "onTransitionCancel"), Oi(Ti, "onTransitionEnd"), en("onMouseEnter", ["mouseout", "mouseover"]), en("onMouseLeave", ["mouseout", "mouseover"]), en("onPointerEnter", ["pointerout", "pointerover"]), en("onPointerLeave", ["pointerout", "pointerover"]), $t("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" ")), $t("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")), $t("onBeforeInput", [
		"compositionend",
		"keypress",
		"textInput",
		"paste"
	]), $t("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" ")), $t("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" ")), $t("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
	var ep = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "), tp = new Set("beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(ep));
	function np(e, t) {
		t = !!(t & 4);
		for (var n = 0; n < e.length; n++) {
			var r = e[n], i = r.event;
			r = r.listeners;
			a: {
				var a = void 0;
				if (t) for (var o = r.length - 1; 0 <= o; o--) {
					var s = r[o], c = s.instance, l = s.currentTarget;
					if (s = s.listener, c !== a && i.isPropagationStopped()) break a;
					a = s, i.currentTarget = l;
					try {
						a(i);
					} catch (e) {
						Ni(e);
					}
					i.currentTarget = null, a = c;
				}
				else for (o = 0; o < r.length; o++) {
					if (s = r[o], c = s.instance, l = s.currentTarget, s = s.listener, c !== a && i.isPropagationStopped()) break a;
					a = s, i.currentTarget = l;
					try {
						a(i);
					} catch (e) {
						Ni(e);
					}
					i.currentTarget = null, a = c;
				}
			}
		}
	}
	function L(e, t) {
		var n = t[Rt];
		n === void 0 && (n = t[Rt] = /* @__PURE__ */ new Set());
		var r = e + "__bubble";
		n.has(r) || (op(t, e, 2, !1), n.add(r));
	}
	function rp(e, t, n) {
		var r = 0;
		t && (r |= 4), op(n, e, r, t);
	}
	var ip = "_reactListening" + Math.random().toString(36).slice(2);
	function ap(e) {
		if (!e[ip]) {
			e[ip] = !0, Zt.forEach(function(t) {
				t !== "selectionchange" && (tp.has(t) || rp(t, !1, e), rp(t, !0, e));
			});
			var t = e.nodeType === 9 ? e : e.ownerDocument;
			t === null || t[ip] || (t[ip] = !0, rp("selectionchange", !1, t));
		}
	}
	function op(e, t, n, r) {
		switch (Ih(t)) {
			case 2:
				var i = Ah;
				break;
			case 8:
				i = jh;
				break;
			default: i = Mh;
		}
		n = i.bind(null, t, n, e), i = void 0, !Vn || t !== "touchstart" && t !== "touchmove" && t !== "wheel" || (i = !0), r ? i === void 0 ? e.addEventListener(t, n, !0) : e.addEventListener(t, n, {
			capture: !0,
			passive: i
		}) : i === void 0 ? e.addEventListener(t, n, !1) : e.addEventListener(t, n, { passive: i });
	}
	function sp(e, t, n, r, i) {
		var a = r;
		if (!(t & 1) && !(t & 2) && r !== null) a: for (;;) {
			if (r === null) return;
			var o = r.tag;
			if (o === 3 || o === 4) {
				var c = r.stateNode.containerInfo;
				if (c === i) break;
				if (o === 4) for (o = r.return; o !== null;) {
					var l = o.tag;
					if ((l === 3 || l === 4) && o.stateNode.containerInfo === i) return;
					o = o.return;
				}
				for (; c !== null;) {
					if (o = Gt(c), o === null) return;
					if (l = o.tag, l === 5 || l === 6 || l === 26 || l === 27) {
						r = a = o;
						continue a;
					}
					c = c.parentNode;
				}
			}
			r = r.return;
		}
		Rn(function() {
			var r = a, i = Nn(n), o = [];
			a: {
				var c = Ei.get(e);
				if (c !== void 0) {
					var l = Qn, u = e;
					switch (e) {
						case "keypress": if (qn(n) === 0) break a;
						case "keydown":
						case "keyup":
							l = gr;
							break;
						case "focusin":
							u = "focus", l = sr;
							break;
						case "focusout":
							u = "blur", l = sr;
							break;
						case "beforeblur":
						case "afterblur":
							l = sr;
							break;
						case "click": if (n.button === 2) break a;
						case "auxclick":
						case "dblclick":
						case "mousedown":
						case "mousemove":
						case "mouseup":
						case "mouseout":
						case "mouseover":
						case "contextmenu":
							l = ar;
							break;
						case "drag":
						case "dragend":
						case "dragenter":
						case "dragexit":
						case "dragleave":
						case "dragover":
						case "dragstart":
						case "drop":
							l = or;
							break;
						case "touchcancel":
						case "touchend":
						case "touchmove":
						case "touchstart":
							l = yr;
							break;
						case yi:
						case bi:
						case xi:
							l = cr;
							break;
						case Ti:
							l = br;
							break;
						case "scroll":
						case "scrollend":
							l = er;
							break;
						case "wheel":
							l = xr;
							break;
						case "copy":
						case "cut":
						case "paste":
							l = lr;
							break;
						case "gotpointercapture":
						case "lostpointercapture":
						case "pointercancel":
						case "pointerdown":
						case "pointermove":
						case "pointerout":
						case "pointerover":
						case "pointerup":
							l = _r;
							break;
						case "submit":
							l = vr;
							break;
						case "toggle":
						case "beforetoggle": l = Sr;
					}
					var d = !!(t & 4), f = !d && (e === "scroll" || e === "scrollend"), p = d ? c === null ? null : c + "Capture" : c;
					d = [];
					for (var m = r, h; m !== null;) {
						var g = m;
						if (h = g.stateNode, g = g.tag, g !== 5 && g !== 26 && g !== 27 || h === null || p === null || (g = zn(m, p), g != null && d.push(cp(m, g, h))), f) break;
						m = m.return;
					}
					0 < d.length && (c = new l(c, u, null, n, i), o.push({
						event: c,
						listeners: d
					}));
				}
			}
			if (!(t & 7)) {
				a: {
					if (l = e === "mouseover" || e === "pointerover", c = e === "mouseout" || e === "pointerout", l && n !== Mn && (u = n.relatedTarget || n.fromElement) && (Gt(u) || u[Lt])) break a;
					(c || l) && (u = i.window === i ? i : (l = i.ownerDocument) ? l.defaultView || l.parentWindow : window, c ? (l = n.relatedTarget || n.toElement, c = r, l = l ? Gt(l) : null, l !== null && (f = s(l), d = l.tag, l !== f || d !== 5 && d !== 27 && d !== 6) && (l = null)) : (c = null, l = r), c !== l && (d = ar, g = "onMouseLeave", p = "onMouseEnter", m = "mouse", (e === "pointerout" || e === "pointerover") && (d = _r, g = "onPointerLeave", p = "onPointerEnter", m = "pointer"), f = c == null ? u : qt(c), h = l == null ? u : qt(l), u = new d(g, m + "leave", c, n, i), u.target = f, u.relatedTarget = h, g = null, Gt(i) === r && (d = new d(p, m + "enter", l, n, i), d.target = h, d.relatedTarget = f, g = d), f = g, d = c && l ? ae(c, l, up) : null, c !== null && dp(o, u, c, d, !1), l !== null && f !== null && dp(o, f, l, d, !0)));
				}
				a: {
					if (c = r ? qt(r) : window, l = c.nodeName && c.nodeName.toLowerCase(), l === "select" || l === "input" && c.type === "file") var _ = Hr;
					else if (Ir(c)) {
						if (Ur) _ = Qr;
						else {
							_ = Xr;
							var v = Yr;
						}
					} else l = c.nodeName, !l || l.toLowerCase() !== "input" || c.type !== "checkbox" && c.type !== "radio" ? r && Dn(r.elementType) && (_ = Hr) : _ = Zr;
					if (_ &&= _(e, r)) {
						Lr(o, _, n, i);
						break a;
					}
					v && v(e, c, r);
				}
				switch (v = r ? qt(r) : window, e) {
					case "focusin":
						(Ir(v) || v.contentEditable === "true") && (li = v, ui = r, di = null);
						break;
					case "focusout":
						di = ui = li = null;
						break;
					case "mousedown":
						fi = !0;
						break;
					case "contextmenu":
					case "mouseup":
					case "dragend":
						fi = !1, pi(o, n, i);
						break;
					case "selectionchange": if (ci) break;
					case "keydown":
					case "keyup": pi(o, n, i);
				}
				var y;
				if (wr) b: {
					switch (e) {
						case "compositionstart":
							var b = "onCompositionStart";
							break b;
						case "compositionend":
							b = "onCompositionEnd";
							break b;
						case "compositionupdate":
							b = "onCompositionUpdate";
							break b;
					}
					b = void 0;
				}
				else Mr ? Ar(e, n) && (b = "onCompositionEnd") : e === "keydown" && n.keyCode === 229 && (b = "onCompositionStart");
				b && (Dr && n.locale !== "ko" && (Mr || b !== "onCompositionStart" ? b === "onCompositionEnd" && Mr && (y = Kn()) : (Un = i, Wn = "value" in Un ? Un.value : Un.textContent, Mr = !0)), v = lp(r, b), 0 < v.length && (b = new ur(b, e, null, n, i), o.push({
					event: b,
					listeners: v
				}), y ? b.data = y : (y = jr(n), y !== null && (b.data = y)))), (y = Er ? Nr(e, n) : Pr(e, n)) && (b = lp(r, "onBeforeInput"), 0 < b.length && (v = new ur("onBeforeInput", "beforeinput", null, n, i), o.push({
					event: v,
					listeners: b
				}), v.data = y)), Zf(o, e, r, n, i);
			}
			np(o, t);
		});
	}
	function cp(e, t, n) {
		return {
			instance: e,
			listener: t,
			currentTarget: n
		};
	}
	function lp(e, t) {
		for (var n = t + "Capture", r = []; e !== null;) {
			var i = e, a = i.stateNode;
			if (i = i.tag, i !== 5 && i !== 26 && i !== 27 || a === null || (i = zn(e, n), i != null && r.unshift(cp(e, i, a)), i = zn(e, t), i != null && r.push(cp(e, i, a))), e.tag === 3) return r;
			e = e.return;
		}
		return [];
	}
	function up(e) {
		if (e === null) return null;
		do
			e = e.return;
		while (e && e.tag !== 5 && e.tag !== 27);
		return e || null;
	}
	function dp(e, t, n, r, i) {
		for (var a = t._reactName, o = []; n !== null && n !== r;) {
			var s = n, c = s.alternate, l = s.stateNode;
			if (s = s.tag, c !== null && c === r) break;
			s !== 5 && s !== 26 && s !== 27 || l === null || (c = l, i ? (l = zn(n, a), l != null && o.unshift(cp(n, l, c))) : i || (l = zn(n, a), l != null && o.push(cp(n, l, c)))), n = n.return;
		}
		o.length !== 0 && e.push({
			event: t,
			listeners: o
		});
	}
	var fp = /\r\n?/g, pp = /\u0000|\uFFFD/g;
	function mp(e) {
		return (typeof e == "string" ? e : "" + e).replace(fp, "\n").replace(pp, "");
	}
	function hp(e, t) {
		return t = mp(t), mp(e) === t;
	}
	function gp(e, t, n, r, i, o) {
		switch (n) {
			case "children":
				if (typeof r == "string") t === "body" || t === "textarea" && r === "" || Cn(e, r);
				else if (typeof r == "number" || typeof r == "bigint") t !== "body" && Cn(e, "" + r);
				else return;
				break;
			case "className":
				cn(e, "class", r);
				break;
			case "tabIndex":
				cn(e, "tabindex", r);
				break;
			case "dir":
			case "role":
			case "viewBox":
			case "width":
			case "height":
				cn(e, n, r);
				break;
			case "style":
				En(e, r, o);
				return;
			case "data": if (t !== "object") {
				cn(e, "data", r);
				break;
			}
			case "src":
			case "href":
				if (r === "" && (t !== "a" || n !== "href")) {
					e.removeAttribute(n);
					break;
				}
				if (r == null || typeof r == "function" || typeof r == "symbol" || typeof r == "boolean") {
					e.removeAttribute(n);
					break;
				}
				r = An(r), e.setAttribute(n, r);
				break;
			case "action":
			case "formAction":
				if (typeof r == "function") {
					e.setAttribute(n, "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')");
					break;
				}
				if (typeof o == "function" && (n === "formAction" ? (t !== "input" && gp(e, t, "name", i.name, i, null), gp(e, t, "formEncType", i.formEncType, i, null), gp(e, t, "formMethod", i.formMethod, i, null), gp(e, t, "formTarget", i.formTarget, i, null)) : (gp(e, t, "encType", i.encType, i, null), gp(e, t, "method", i.method, i, null), gp(e, t, "target", i.target, i, null))), r == null || typeof r == "symbol" || typeof r == "boolean") {
					e.removeAttribute(n);
					break;
				}
				r = An(r), e.setAttribute(n, r);
				break;
			case "onClick":
				r != null && (e.onclick = jn);
				return;
			case "onScroll":
				r != null && L("scroll", e);
				return;
			case "onScrollEnd":
				r != null && L("scrollend", e);
				return;
			case "dangerouslySetInnerHTML":
				if (r != null) {
					if (typeof r != "object" || !("__html" in r)) throw Error(a(61));
					if (n = r.__html, n != null) {
						if (i.children != null) throw Error(a(60));
						o?.__html !== n && (e.innerHTML = n);
					}
				}
				break;
			case "multiple":
				e.multiple = r && typeof r != "function" && typeof r != "symbol";
				break;
			case "muted":
				e.muted = r && typeof r != "function" && typeof r != "symbol";
				break;
			case "suppressContentEditableWarning":
			case "suppressHydrationWarning":
			case "defaultValue":
			case "defaultChecked":
			case "innerHTML":
			case "ref": break;
			case "autoFocus": break;
			case "xlinkHref":
				if (r == null || typeof r == "function" || typeof r == "boolean" || typeof r == "symbol") {
					e.removeAttribute("xlink:href");
					break;
				}
				n = An(r), e.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", n);
				break;
			case "contentEditable":
			case "spellCheck":
			case "draggable":
			case "value":
			case "autoReverse":
			case "externalResourcesRequired":
			case "focusable":
			case "preserveAlpha":
				r != null && typeof r != "function" && typeof r != "symbol" ? e.setAttribute(n, r) : e.removeAttribute(n);
				break;
			case "inert":
			case "allowFullScreen":
			case "async":
			case "autoPlay":
			case "controls":
			case "credentialless":
			case "default":
			case "defer":
			case "disabled":
			case "disablePictureInPicture":
			case "disableRemotePlayback":
			case "formNoValidate":
			case "hidden":
			case "loop":
			case "noModule":
			case "noValidate":
			case "open":
			case "playsInline":
			case "readOnly":
			case "required":
			case "reversed":
			case "scoped":
			case "seamless":
			case "itemScope":
				r && typeof r != "function" && typeof r != "symbol" ? e.setAttribute(n, "") : e.removeAttribute(n);
				break;
			case "capture":
			case "download":
				!0 === r ? e.setAttribute(n, "") : !1 !== r && r != null && typeof r != "function" && typeof r != "symbol" ? e.setAttribute(n, r) : e.removeAttribute(n);
				break;
			case "cols":
			case "rows":
			case "size":
			case "span":
				r != null && typeof r != "function" && typeof r != "symbol" && !isNaN(r) && 1 <= r ? e.setAttribute(n, r) : e.removeAttribute(n);
				break;
			case "rowSpan":
			case "start":
				r == null || typeof r == "function" || typeof r == "symbol" || isNaN(r) ? e.removeAttribute(n) : e.setAttribute(n, r);
				break;
			case "popover":
				L("beforetoggle", e), L("toggle", e), sn(e, "popover", r);
				break;
			case "xlinkActuate":
				ln(e, "http://www.w3.org/1999/xlink", "xlink:actuate", r);
				break;
			case "xlinkArcrole":
				ln(e, "http://www.w3.org/1999/xlink", "xlink:arcrole", r);
				break;
			case "xlinkRole":
				ln(e, "http://www.w3.org/1999/xlink", "xlink:role", r);
				break;
			case "xlinkShow":
				ln(e, "http://www.w3.org/1999/xlink", "xlink:show", r);
				break;
			case "xlinkTitle":
				ln(e, "http://www.w3.org/1999/xlink", "xlink:title", r);
				break;
			case "xlinkType":
				ln(e, "http://www.w3.org/1999/xlink", "xlink:type", r);
				break;
			case "xmlBase":
				ln(e, "http://www.w3.org/XML/1998/namespace", "xml:base", r);
				break;
			case "xmlLang":
				ln(e, "http://www.w3.org/XML/1998/namespace", "xml:lang", r);
				break;
			case "xmlSpace":
				ln(e, "http://www.w3.org/XML/1998/namespace", "xml:space", r);
				break;
			case "is":
				sn(e, "is", r);
				break;
			case "innerText":
			case "textContent": return;
			default: if (!(2 < n.length) || n[0] !== "o" && n[0] !== "O" || n[1] !== "n" && n[1] !== "N") n = On.get(n) || n, sn(e, n, r);
			else return;
		}
		E = !0;
	}
	function _p(e, t, n, r, i, o) {
		switch (n) {
			case "style":
				En(e, r, o);
				return;
			case "dangerouslySetInnerHTML":
				if (r != null) {
					if (typeof r != "object" || !("__html" in r)) throw Error(a(61));
					if (n = r.__html, n != null) {
						if (i.children != null) throw Error(a(60));
						o?.__html !== n && (e.innerHTML = n);
					}
				}
				break;
			case "children":
				if (typeof r == "string") Cn(e, r);
				else if (typeof r == "number" || typeof r == "bigint") Cn(e, "" + r);
				else return;
				break;
			case "onScroll":
				r != null && L("scroll", e);
				return;
			case "onScrollEnd":
				r != null && L("scrollend", e);
				return;
			case "onClick":
				r != null && (e.onclick = jn);
				return;
			case "suppressContentEditableWarning":
			case "suppressHydrationWarning":
			case "innerHTML":
			case "ref": return;
			case "innerText":
			case "textContent": return;
			default:
				if (!Qt.hasOwnProperty(n)) a: {
					if (n[0] === "o" && n[1] === "n" && (i = n.endsWith("Capture"), o = n.slice(2, i ? n.length - 7 : void 0), t = e[It] || null, t = t == null ? null : t[n], typeof t == "function" && e.removeEventListener(o, t, i), typeof r == "function")) {
						typeof t != "function" && t !== null && (n in e ? e[n] = null : e.hasAttribute(n) && e.removeAttribute(n)), e.addEventListener(o, r, i);
						break a;
					}
					E = !0, n in e ? e[n] = r : !0 === r ? e.setAttribute(n, "") : sn(e, n, r);
				}
				return;
		}
		E = !0;
	}
	function vp(e, t, n) {
		switch (t) {
			case "div":
			case "span":
			case "svg":
			case "path":
			case "a":
			case "g":
			case "p":
			case "li": break;
			case "img":
				L("error", e), L("load", e);
				var r = !1, i = !1, o;
				for (o in n) if (n.hasOwnProperty(o)) {
					var s = n[o];
					if (s != null) switch (o) {
						case "src":
							r = !0;
							break;
						case "srcSet":
							i = !0;
							break;
						case "children":
						case "dangerouslySetInnerHTML": throw Error(a(137, t));
						default: gp(e, t, o, s, n, null);
					}
				}
				i && gp(e, t, "srcSet", n.srcSet, n, null), r && gp(e, t, "src", n.src, n, null);
				return;
			case "input":
				L("invalid", e);
				var c = o = s = i = null, l = null, u = null;
				for (r in n) if (n.hasOwnProperty(r)) {
					var d = n[r];
					if (d != null) switch (r) {
						case "name":
							i = d;
							break;
						case "type":
							s = d;
							break;
						case "checked":
							l = d;
							break;
						case "defaultChecked":
							u = d;
							break;
						case "value":
							o = d;
							break;
						case "defaultValue":
							c = d;
							break;
						case "children":
						case "dangerouslySetInnerHTML":
							if (d != null) throw Error(a(137, t));
							break;
						default: gp(e, t, r, d, n, null);
					}
				}
				vn(e, o, c, l, u, s, i, !1);
				return;
			case "select":
				for (i in L("invalid", e), r = s = o = null, n) if (n.hasOwnProperty(i) && (c = n[i], c != null)) switch (i) {
					case "value":
						o = c;
						break;
					case "defaultValue":
						s = c;
						break;
					case "multiple": r = c;
					default: gp(e, t, i, c, n, null);
				}
				t = o, n = s, e.multiple = !!r, t == null ? n != null && bn(e, !!r, n, !0) : bn(e, !!r, t, !1);
				return;
			case "textarea":
				for (s in L("invalid", e), o = i = r = null, n) if (n.hasOwnProperty(s) && (c = n[s], c != null)) switch (s) {
					case "value":
						r = c;
						break;
					case "defaultValue":
						i = c;
						break;
					case "children":
						o = c;
						break;
					case "dangerouslySetInnerHTML":
						if (c != null) throw Error(a(91));
						break;
					default: gp(e, t, s, c, n, null);
				}
				Sn(e, r, i, o);
				return;
			case "option":
				for (l in n) if (n.hasOwnProperty(l) && (r = n[l], r != null)) switch (l) {
					case "selected":
						e.selected = r && typeof r != "function" && typeof r != "symbol";
						break;
					default: gp(e, t, l, r, n, null);
				}
				return;
			case "dialog":
				L("beforetoggle", e), L("toggle", e), L("cancel", e), L("close", e);
				break;
			case "iframe":
			case "object":
				L("load", e);
				break;
			case "video":
			case "audio":
				for (r = 0; r < ep.length; r++) L(ep[r], e);
				break;
			case "image":
				L("error", e), L("load", e);
				break;
			case "details":
				L("toggle", e);
				break;
			case "embed":
			case "source":
			case "link": L("error", e), L("load", e);
			case "area":
			case "base":
			case "br":
			case "col":
			case "hr":
			case "keygen":
			case "meta":
			case "param":
			case "track":
			case "wbr":
			case "menuitem":
				for (u in n) if (n.hasOwnProperty(u) && (r = n[u], r != null)) switch (u) {
					case "children":
					case "dangerouslySetInnerHTML": throw Error(a(137, t));
					default: gp(e, t, u, r, n, null);
				}
				return;
			default: if (Dn(t)) {
				for (d in n) n.hasOwnProperty(d) && (r = n[d], r !== void 0 && _p(e, t, d, r, n, void 0));
				return;
			}
		}
		for (c in n) n.hasOwnProperty(c) && (r = n[c], r != null && gp(e, t, c, r, n, null));
	}
	var yp = {};
	function bp(e, t, n, r) {
		switch (t) {
			case "div":
			case "span":
			case "svg":
			case "path":
			case "a":
			case "g":
			case "p":
			case "li": break;
			case "input":
				var i = null, o = null, s = null, c = null, l = null, u = null, d = null;
				for (m in n) {
					var f = n[m];
					if (n.hasOwnProperty(m) && f != null) switch (m) {
						case "checked": break;
						case "value": break;
						case "defaultValue": l = f;
						default: r.hasOwnProperty(m) || gp(e, t, m, null, r, f);
					}
				}
				for (var p in r) {
					var m = r[p];
					if (f = n[p], r.hasOwnProperty(p) && (m != null || f != null)) switch (p) {
						case "type":
							m !== f && (E = !0), o = m;
							break;
						case "name":
							m !== f && (E = !0), i = m;
							break;
						case "checked":
							m !== f && (E = !0), u = m;
							break;
						case "defaultChecked":
							m !== f && (E = !0), d = m;
							break;
						case "value":
							m !== f && (E = !0), s = m;
							break;
						case "defaultValue":
							m !== f && (E = !0), c = m;
							break;
						case "children":
						case "dangerouslySetInnerHTML":
							if (m != null) throw Error(a(137, t));
							break;
						default: m !== f && gp(e, t, p, m, r, f);
					}
				}
				_n(e, s, c, l, u, d, o, i);
				return;
			case "select":
				for (o in m = s = c = p = null, n) if (l = n[o], n.hasOwnProperty(o) && l != null) switch (o) {
					case "value": break;
					case "multiple": m = l;
					default: r.hasOwnProperty(o) || gp(e, t, o, null, r, l);
				}
				for (i in r) if (o = r[i], l = n[i], r.hasOwnProperty(i) && (o != null || l != null)) switch (i) {
					case "value":
						o !== l && (E = !0), p = o;
						break;
					case "defaultValue":
						o !== l && (E = !0), c = o;
						break;
					case "multiple": o !== l && (E = !0), s = o;
					default: o !== l && gp(e, t, i, o, r, l);
				}
				t = c, n = s, r = m, p == null ? !!r != !!n && (t == null ? bn(e, !!n, n ? [] : "", !1) : bn(e, !!n, t, !0)) : bn(e, !!n, p, !1);
				return;
			case "textarea":
				for (c in m = p = null, n) if (i = n[c], n.hasOwnProperty(c) && i != null && !r.hasOwnProperty(c)) switch (c) {
					case "value": break;
					case "children": break;
					default: gp(e, t, c, null, r, i);
				}
				for (s in r) if (i = r[s], o = n[s], r.hasOwnProperty(s) && (i != null || o != null)) switch (s) {
					case "value":
						i !== o && (E = !0), p = i;
						break;
					case "defaultValue":
						i !== o && (E = !0), m = i;
						break;
					case "children": break;
					case "dangerouslySetInnerHTML":
						if (i != null) throw Error(a(91));
						break;
					default: i !== o && gp(e, t, s, i, r, o);
				}
				xn(e, p, m);
				return;
			case "option":
				for (var h in n) if (p = n[h], n.hasOwnProperty(h) && p != null && !r.hasOwnProperty(h)) switch (h) {
					case "selected":
						e.selected = !1;
						break;
					default: gp(e, t, h, null, r, p);
				}
				for (l in r) if (p = r[l], m = n[l], r.hasOwnProperty(l) && p !== m && (p != null || m != null)) switch (l) {
					case "selected":
						p !== m && (E = !0), e.selected = p && typeof p != "function" && typeof p != "symbol";
						break;
					default: gp(e, t, l, p, r, m);
				}
				return;
			case "img":
			case "link":
			case "area":
			case "base":
			case "br":
			case "col":
			case "embed":
			case "hr":
			case "keygen":
			case "meta":
			case "param":
			case "source":
			case "track":
			case "wbr":
			case "menuitem":
				for (var g in n) p = n[g], n.hasOwnProperty(g) && p != null && !r.hasOwnProperty(g) && gp(e, t, g, null, r, p);
				for (u in r) if (p = r[u], m = n[u], r.hasOwnProperty(u) && p !== m && (p != null || m != null)) switch (u) {
					case "children":
					case "dangerouslySetInnerHTML":
						if (p != null) throw Error(a(137, t));
						break;
					default: gp(e, t, u, p, r, m);
				}
				return;
			default: if (Dn(t)) {
				for (var _ in n) p = n[_], n.hasOwnProperty(_) && p !== void 0 && !r.hasOwnProperty(_) && _p(e, t, _, void 0, r, p);
				for (d in r) p = r[d], m = n[d], !r.hasOwnProperty(d) || p === m || p === void 0 && m === void 0 || _p(e, t, d, p, r, m);
				return;
			}
		}
		for (var v in n) p = n[v], n.hasOwnProperty(v) && p != null && !r.hasOwnProperty(v) && gp(e, t, v, null, r, p);
		for (f in r) p = r[f], m = n[f], !r.hasOwnProperty(f) || p === m || p == null && m == null || gp(e, t, f, p, r, m);
	}
	function xp(e) {
		switch (e) {
			case "css":
			case "script":
			case "font":
			case "img":
			case "image":
			case "input":
			case "link": return !0;
			default: return !1;
		}
	}
	function Sp() {
		if (typeof performance.getEntriesByType == "function") {
			for (var e = 0, t = 0, n = performance.getEntriesByType("resource"), r = 0; r < n.length; r++) {
				var i = n[r], a = i.transferSize, o = i.initiatorType, s = i.duration;
				if (a && s && xp(o)) {
					for (o = 0, s = i.responseEnd, r += 1; r < n.length; r++) {
						var c = n[r], l = c.startTime;
						if (l > s) break;
						var u = c.transferSize, d = c.initiatorType;
						u && xp(d) && (c = c.responseEnd, o += u * (c < s ? 1 : (s - l) / (c - l)));
					}
					if (--r, t += 8 * (a + o) / (i.duration / 1e3), e++, 10 < e) break;
				}
			}
			if (0 < e) return t / e / 1e6;
		}
		return navigator.connection && (e = navigator.connection.downlink, typeof e == "number") ? e : 5;
	}
	var Cp = null, wp = null;
	function Tp(e) {
		return e.nodeType === 9 ? e : e.ownerDocument;
	}
	function Ep(e) {
		switch (e) {
			case "http://www.w3.org/2000/svg": return 1;
			case "http://www.w3.org/1998/Math/MathML": return 2;
			default: return 0;
		}
	}
	function Dp(e, t) {
		if (e === 0) switch (t) {
			case "svg": return 1;
			case "math": return 2;
			default: return 0;
		}
		return e === 1 && t === "foreignObject" ? 0 : e;
	}
	function Op(e, t, n, r) {
		return n = Tp(n).createElement(e), n[Ft] = r, n[It] = t, vp(n, e, t), Yt(n), n;
	}
	function kp(e, t) {
		return e === "textarea" || e === "noscript" || typeof t.children == "string" || typeof t.children == "number" || typeof t.children == "bigint" || typeof t.dangerouslySetInnerHTML == "object" && t.dangerouslySetInnerHTML !== null && t.dangerouslySetInnerHTML.__html != null;
	}
	var Ap = null;
	function jp() {
		var e = window.event;
		return e && e.type === "popstate" ? e !== Ap && (Ap = e, !0) : (Ap = null, !1);
	}
	var Mp = typeof setTimeout == "function" ? setTimeout : void 0, Np = typeof clearTimeout == "function" ? clearTimeout : void 0, Pp = typeof Promise == "function" ? Promise : void 0, Fp = typeof requestAnimationFrame == "function" ? requestAnimationFrame : Mp, Ip = typeof queueMicrotask == "function" ? queueMicrotask : Pp === void 0 ? Mp : function(e) {
		return Pp.resolve(null).then(e).catch(Lp);
	};
	function Lp(e) {
		setTimeout(function() {
			throw e;
		});
	}
	function Rp(e) {
		return e === "head";
	}
	function zp(e, t) {
		var n = t, r = 0;
		do {
			var i = n.nextSibling;
			if (e.removeChild(n), i && i.nodeType === 8) {
				if (n = i.data, n === "/$" || n === "/&") {
					if (r === 0) {
						e.removeChild(i), tg(t);
						return;
					}
					r--;
				} else if (n === "$" || n === "$?" || n === "$~" || n === "$!" || n === "&") r++;
				else if (n === "html") Mm(e.ownerDocument.documentElement);
				else if (n === "head") {
					n = e.ownerDocument.head, Mm(n);
					for (var a = n.firstChild; a;) {
						var o = a.nextSibling, s = a.nodeName;
						a[Ht] || s === "SCRIPT" || s === "STYLE" || s === "LINK" && a.rel.toLowerCase() === "stylesheet" || n.removeChild(a), a = o;
					}
				} else n === "body" && Mm(e.ownerDocument.body);
			}
			n = i;
		} while (n);
		tg(t);
	}
	function Bp(e, t) {
		var n = e;
		e = 0;
		do {
			var r = n.nextSibling;
			if (n.nodeType === 1 ? t ? (n._stashedDisplay = n.style.display, n.style.display = "none") : (n.style.display = n._stashedDisplay || "", n.getAttribute("style") === "" && n.removeAttribute("style")) : n.nodeType === 3 && (t ? (n._stashedText = n.nodeValue, n.nodeValue = "") : n.nodeValue = n._stashedText || ""), r && r.nodeType === 8) {
				if (n = r.data, n === "/$") {
					if (e === 0) break;
					e--;
				} else n !== "$" && n !== "$?" && n !== "$~" && n !== "$!" || e++;
			}
			n = r;
		} while (n);
	}
	function Vp(e, t, n) {
		if (t = CSS.escape(t) === t ? t : "r-" + btoa(t).replace(/=/g, ""), e.style.viewTransitionName = t, n != null && (e.style.viewTransitionClass = n), n = getComputedStyle(e), n.display === "inline") {
			if (t = e.getClientRects(), t.length === 1) var r = 1;
			else for (var i = r = 0; i < t.length; i++) {
				var a = t[i];
				0 < a.width && 0 < a.height && r++;
			}
			r === 1 && (e = e.style, e.display = t.length === 1 ? "inline-block" : "block", e.marginTop = "-" + n.paddingTop, e.marginBottom = "-" + n.paddingBottom);
		}
	}
	function Hp(e, t) {
		e = e.style, t = t.style;
		var n = t == null ? null : t.hasOwnProperty("viewTransitionName") ? t.viewTransitionName : t.hasOwnProperty("view-transition-name") ? t["view-transition-name"] : null;
		e.viewTransitionName = n == null || typeof n == "boolean" ? "" : ("" + n).trim(), n = t == null ? null : t.hasOwnProperty("viewTransitionClass") ? t.viewTransitionClass : t.hasOwnProperty("view-transition-class") ? t["view-transition-class"] : null, e.viewTransitionClass = n == null || typeof n == "boolean" ? "" : ("" + n).trim(), e.display === "inline-block" && (t == null ? e.display = e.margin = "" : (n = t.display, e.display = n == null || typeof n == "boolean" ? "" : n, n = t.margin, n == null ? (n = t.hasOwnProperty("marginTop") ? t.marginTop : t["margin-top"], e.marginTop = n == null || typeof n == "boolean" ? "" : n, t = t.hasOwnProperty("marginBottom") ? t.marginBottom : t["margin-bottom"], e.marginBottom = t == null || typeof t == "boolean" ? "" : t) : e.margin = n));
	}
	function Up(e, t, n) {
		return n = n.ownerDocument.defaultView, {
			rect: e,
			abs: t.position === "absolute" || t.position === "fixed",
			clip: t.clipPath !== "none" || t.overflow !== "visible" || t.filter !== "none" || t.mask !== "none" || t.mask !== "none" || t.borderRadius !== "0px",
			view: 0 <= e.bottom && 0 <= e.right && e.top <= n.innerHeight && e.left <= n.innerWidth
		};
	}
	function Wp(e) {
		return Up(e.getBoundingClientRect(), getComputedStyle(e), e);
	}
	function Gp(e) {
		var t = e.getBoundingClientRect();
		t = new DOMRect(t.x + 2e4, t.y + 2e4, t.width, t.height);
		var n = getComputedStyle(e);
		return Up(t, n, e);
	}
	function Kp(e) {
		return e.documentElement.clientHeight;
	}
	function qp(e) {
		this.addEventListener("load", e), this.addEventListener("error", e);
	}
	function Jp(e, t, n, r, i, a, o, s, c) {
		var l = t.nodeType === 9 ? t : t.ownerDocument;
		try {
			var u = l.startViewTransition({
				update: function() {
					var t = l.defaultView, n = t.navigation && t.navigation.transition, o = l.fonts.status;
					r();
					var s = [];
					if (o === "loaded" && (Kp(l), l.fonts.status === "loading" && s.push(l.fonts.ready)), o = s.length, e !== null) for (var c = e.suspenseyImages, u = 0, d = 0; d < c.length; d++) {
						var f = c[d];
						if (!f.complete) {
							var p = f.getBoundingClientRect();
							if (0 < p.bottom && 0 < p.right && p.top < t.innerHeight && p.left < t.innerWidth) {
								if (u += lh(f), u > fh) {
									s.length = o;
									break;
								}
								f = new Promise(qp.bind(f)), s.push(f);
							}
						}
					}
					if (0 < s.length) return t = Promise.race([Promise.all(s), new Promise(function(e) {
						return setTimeout(e, 500);
					})]).then(i, i), (n ? Promise.allSettled([n.finished, t]) : t).then(a, a);
					if (i(), n) return n.finished.then(a, a);
					a();
				},
				types: n
			});
			l.__reactViewTransition = u;
			var d = [];
			return u.ready.then(function() {
				for (var e = l.documentElement.getAnimations({ subtree: !0 }), t = 0; t < e.length; t++) {
					var n = e[t], r = n.effect, i = r.pseudoElement;
					if (i != null && i.startsWith("::view-transition")) {
						d.push(n), n = r.getKeyframes();
						for (var a = i = void 0, s = !0, c = 0; c < n.length; c++) {
							var u = n[c], f = u.width;
							if (i === void 0) i = f;
							else if (i !== f) {
								s = !1;
								break;
							}
							if (f = u.height, a === void 0) a = f;
							else if (a !== f) {
								s = !1;
								break;
							}
							delete u.width, delete u.height, u.transform === "none" && delete u.transform;
						}
						s && i !== void 0 && a !== void 0 && (r.setKeyframes(n), s = getComputedStyle(r.target, r.pseudoElement), s.width !== i || s.height !== a) && (s = n[0], s.width = i, s.height = a, s = n[n.length - 1], s.width = i, s.height = a, r.setKeyframes(n));
					}
				}
				o();
			}, function(e) {
				l.__reactViewTransition === u && (l.__reactViewTransition = null);
				try {
					if (typeof e == "object" && e) switch (e.name) {
						case "InvalidStateError": (e.message === "View transition was skipped because document visibility state is hidden." || e.message === "Skipping view transition because document visibility state has become hidden." || e.message === "Skipping view transition because viewport size changed." || e.message === "Transition was aborted because of invalid state") && (e = null);
					}
					e !== null && c(e);
				} finally {
					r(), i(), o();
				}
			}), u.finished.finally(function() {
				for (var e = 0; e < d.length; e++) d[e].cancel();
				l.__reactViewTransition === u && (l.__reactViewTransition = null), s();
			}), u;
		} catch {
			return r(), i(), o(), null;
		}
	}
	function Yp(e, t) {
		this._scope = document.documentElement, this._selector = "::view-transition-" + e + "(" + t + ")";
	}
	Yp.prototype.animate = function(e, t) {
		return t = typeof t == "number" ? { duration: t } : x({}, t), t.pseudoElement = this._selector, this._scope.animate(e, t);
	}, Yp.prototype.getAnimations = function() {
		for (var e = this._scope, t = this._selector, n = e.getAnimations({ subtree: !0 }), r = [], i = 0; i < n.length; i++) {
			var a = n[i].effect;
			a !== null && a.target === e && a.pseudoElement === t && r.push(n[i]);
		}
		return r;
	}, Yp.prototype.getComputedStyle = function() {
		return getComputedStyle(this._scope, this._selector);
	};
	function Xp(e) {
		return {
			name: e,
			group: new Yp("group", e),
			imagePair: new Yp("image-pair", e),
			old: new Yp("old", e),
			new: new Yp("new", e)
		};
	}
	function Zp(e) {
		this._fragmentFiber = e, this._observers = this._eventListeners = null;
	}
	Zp.prototype.addEventListener = function(e, t, n) {
		var r = null, i = null;
		if (!(n != null && typeof n != "boolean" && (r = n.signal || null, r !== null && r.aborted))) {
			this._eventListeners === null && (this._eventListeners = []);
			var a = this._eventListeners;
			if (nm(a, e, t, n) === -1) {
				var o = this, s = t;
				n != null && typeof n != "boolean" && !0 === n.once && (s = function(r) {
					o.removeEventListener(e, t, n), typeof t == "function" ? t.call(this, r) : t.handleEvent(r);
				}), r !== null && (i = o.removeEventListener.bind(o, e, t, n), r.addEventListener("abort", i, { once: !0 }), i = r.removeEventListener.bind(r, "abort", i)), r = em(n), a.push({
					type: e,
					listener: t,
					optionsOrUseCapture: n,
					attachedListener: s,
					cleanup: i
				}), h(this._fragmentFiber.child, !1, Qp, e, s, r);
			}
			this._eventListeners = a;
		}
	};
	function Qp(e, t, n, r) {
		return b(e).addEventListener(t, n, r), !1;
	}
	Zp.prototype.removeEventListener = function(e, t, n) {
		var r = this._eventListeners;
		if (r !== null && (t = nm(r, e, t, n), t !== -1)) {
			var i = r[t];
			n = i.attachedListener;
			var a = i.cleanup;
			i = em(i.optionsOrUseCapture), h(this._fragmentFiber.child, !1, $p, e, n, i), r.splice(t, 1), a !== null && a();
		}
	};
	function $p(e, t, n, r) {
		return b(e).removeEventListener(t, n, r), !1;
	}
	function em(e) {
		return e != null && typeof e != "boolean" && (!0 === e.once || e.signal instanceof AbortSignal) ? {
			capture: e.capture,
			passive: e.passive
		} : e;
	}
	function tm(e) {
		return e == null ? "c=0" : typeof e == "boolean" ? "c=" + (e ? "1" : "0") : "c=" + (e.capture ? "1" : "0");
	}
	function nm(e, t, n, r) {
		if (e.length === 0) return -1;
		r = tm(r);
		for (var i = 0; i < e.length; i++) {
			var a = e[i];
			if (a.type === t && a.listener === n && tm(a.optionsOrUseCapture) === r) return i;
		}
		return -1;
	}
	Zp.prototype.dispatchEvent = function(e) {
		var t = g(this._fragmentFiber);
		if (t === null) return !0;
		t = b(t);
		var n = this._eventListeners;
		if (n !== null && 0 < n.length || !e.bubbles) {
			var r = t.nodeType === 9 ? t.createComment("") : document.createTextNode("");
			if (n) for (var i = 0; i < n.length; i++) {
				var a = n[i];
				r.addEventListener(a.type, a.attachedListener, em(a.optionsOrUseCapture));
			}
			if (t.appendChild(r), e = r.dispatchEvent(e), n) for (i = 0; i < n.length; i++) a = n[i], r.removeEventListener(a.type, a.attachedListener, em(a.optionsOrUseCapture));
			return t.removeChild(r), e;
		}
		return t.dispatchEvent(e);
	}, Zp.prototype.focus = function(e) {
		h(this._fragmentFiber.child, !0, rm, e, void 0, void 0);
	};
	function rm(e, t) {
		return e.tag !== 6 && (e = b(e), Om(e, t));
	}
	Zp.prototype.focusLast = function(e) {
		var t = [];
		h(this._fragmentFiber.child, !0, im, t, void 0, void 0);
		for (var n = t.length - 1; 0 <= n && !rm(t[n], e); n--);
	};
	function im(e, t) {
		return t.push(e), !1;
	}
	Zp.prototype.blur = function() {
		var e = g(this._fragmentFiber);
		e !== null && (e = b(e), e = Tp(e).activeElement, e !== null && h(this._fragmentFiber.child, !1, am, e, void 0, void 0));
	};
	function am(e, t) {
		return e.tag !== 6 && (e = b(e), e === t || e.contains(t) ? (t.blur(), !0) : !1);
	}
	Zp.prototype.observeUsing = function(e) {
		this._observers === null && (this._observers = /* @__PURE__ */ new Set()), this._observers.add(e), h(this._fragmentFiber.child, !1, om, e, void 0, void 0);
	};
	function om(e, t) {
		return e.tag !== 6 && (e = b(e), t.observe(e), !1);
	}
	Zp.prototype.unobserveUsing = function(e) {
		var t = this._observers;
		if (t !== null && t.has(e)) {
			t.delete(e), h(this._fragmentFiber.child, !1, sm, e, void 0, void 0);
			for (var n = t = 0; n < cm.length; n++) {
				var r = cm[n];
				r.fragmentInstance === this && r.observer === e ? e.unobserve(r.instance) : cm[t++] = r;
			}
			cm.length = t;
		}
	};
	function sm(e, t) {
		return e.tag !== 6 && (e = b(e), t.unobserve(e), !1);
	}
	var cm = [], lm = !1;
	function um(e, t, n) {
		cm.push({
			fragmentInstance: e,
			observer: t,
			instance: n
		}), lm || (lm = !0, km(function() {
			lm = !1;
			var e = cm;
			cm = [];
			for (var t = 0; t < e.length; t++) {
				var n = e[t];
				n.observer.unobserve(n.instance);
			}
		}));
	}
	Zp.prototype.getClientRects = function() {
		var e = [];
		return h(this._fragmentFiber.child, !1, dm, e, void 0, void 0), e;
	};
	function dm(e, t) {
		if (e.tag === 6) {
			e = e.stateNode;
			var n = e.ownerDocument.createRange();
			n.selectNodeContents(e), t.push.apply(t, n.getClientRects());
		} else e = b(e), t.push.apply(t, e.getClientRects());
		return !1;
	}
	Zp.prototype.getRootNode = function(e) {
		var t = g(this._fragmentFiber);
		return t === null ? this : b(t).getRootNode(e);
	}, Zp.prototype.compareDocumentPosition = function(e) {
		var t = g(this._fragmentFiber);
		if (t === null) return Node.DOCUMENT_POSITION_DISCONNECTED;
		var n = [];
		h(this._fragmentFiber.child, !1, im, n, void 0, void 0);
		var r = b(t);
		if (n.length === 0) {
			if (n = r, _(this._fragmentFiber)) {
				a: {
					for (t = this._fragmentFiber.return; t !== null;) {
						if (t.tag === 4) {
							t = t.stateNode.containerInfo;
							break a;
						}
						if (t.tag === 3 || t.tag === 5 || t.tag === 27) break;
						t = t.return;
					}
					t = null;
				}
				t != null && (n = t);
			}
			t = this._fragmentFiber;
			var i = r = n.compareDocumentPosition(e);
			return n === e ? i = Node.DOCUMENT_POSITION_CONTAINS : r & Node.DOCUMENT_POSITION_CONTAINED_BY && (n = v(t)[1], n === null ? i = Node.DOCUMENT_POSITION_PRECEDING : (e = b(n).compareDocumentPosition(e), i = e === 0 || e & Node.DOCUMENT_POSITION_FOLLOWING ? Node.DOCUMENT_POSITION_FOLLOWING : Node.DOCUMENT_POSITION_PRECEDING)), i |= Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC;
		}
		t = b(n[0]), i = b(n[n.length - 1]);
		var a = _(this._fragmentFiber) ? t.parentElement : r;
		if (a == null) return Node.DOCUMENT_POSITION_DISCONNECTED;
		r = a.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_CONTAINED_BY, a = a.compareDocumentPosition(i) & Node.DOCUMENT_POSITION_CONTAINED_BY;
		var o = t.compareDocumentPosition(e), s = i.compareDocumentPosition(e), c = o & Node.DOCUMENT_POSITION_CONTAINED_BY || s & Node.DOCUMENT_POSITION_CONTAINED_BY;
		return s = r && a && o & Node.DOCUMENT_POSITION_FOLLOWING && s & Node.DOCUMENT_POSITION_PRECEDING, t = r && t === e || a && i === e || c || s ? Node.DOCUMENT_POSITION_CONTAINED_BY : !r && t === e || !a && i === e ? Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC : o, t & Node.DOCUMENT_POSITION_DISCONNECTED || t & Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC || fm(t, this._fragmentFiber, n[0], n[n.length - 1], e) ? t : Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC;
	};
	function fm(e, t, n, r, i) {
		var a = Gt(i);
		if (e & Node.DOCUMENT_POSITION_CONTAINED_BY) {
			if (n = !!a) a: {
				for (; a !== null;) {
					if (a.tag === 7 && (a === t || a.alternate === t)) {
						n = !0;
						break a;
					}
					a = a.return;
				}
				n = !1;
			}
			return n;
		}
		if (e & Node.DOCUMENT_POSITION_CONTAINS) {
			if (a === null) return a = i.ownerDocument, i === a || i === a.documentElement || i === a.body;
			a: {
				for (a = t, t = g(t); a !== null;) {
					if (!(a.tag !== 5 && a.tag !== 3 && a.tag !== 27 || a !== t && a.alternate !== t)) {
						a = !0;
						break a;
					}
					a = a.return;
				}
				a = !1;
			}
			return a;
		}
		return e & Node.DOCUMENT_POSITION_PRECEDING ? ((t = !!a) && !(t = a === n) && (t = ae(n, a, ie), t === null ? t = !1 : (h(t, !0, ne, a, n), a = ee, ee = null, t = a !== null)), t) : e & Node.DOCUMENT_POSITION_FOLLOWING ? ((t = !!a) && !(t = a === r) && (t = ae(r, a, ie), t === null ? t = !1 : (h(t, !0, re, a, r), a = ee, te = ee = null, t = a !== null)), t) : !1;
	}
	function pm(e, t) {
		var n = e.ownerDocument.createRange();
		n.selectNodeContents(e), e = n.getBoundingClientRect(), window.scrollTo(window.scrollX + e.left, t ? window.scrollY + e.top : window.scrollY + e.bottom - window.innerHeight);
	}
	Zp.prototype.scrollIntoView = function(e) {
		if (typeof e == "object") throw Error(a(566));
		var t = [];
		h(this._fragmentFiber.child, !1, im, t, void 0, void 0);
		var n = !1 !== e;
		if (t.length === 0) {
			var r = v(this._fragmentFiber);
			if (r = n ? r[1] || r[0] || g(this._fragmentFiber) : r[0] || r[1], r === null) return;
			if (r.tag === 6) {
				e = b(r), pm(e, n);
				return;
			}
			if (r = b(r), r.nodeType !== 9) {
				if (r.nodeType === 11) {
					n = "host" in r ? r.host : null, n !== null && n.scrollIntoView(e);
					return;
				}
				r.scrollIntoView(e);
			}
		}
		for (r = n ? t.length - 1 : 0; r !== (n ? -1 : t.length);) {
			var i = t[r];
			i.tag === 6 ? (i = b(i), pm(i, n)) : b(i).scrollIntoView(e), r += n ? -1 : 1;
		}
	};
	function mm(e, t) {
		return e = b(e), hm(e, t), !1;
	}
	function hm(e, t) {
		e.reactFragments ??= /* @__PURE__ */ new Set(), e.reactFragments.add(t);
	}
	function gm(e, t) {
		var n = t._eventListeners;
		if (n !== null) for (var r = 0; r < n.length; r++) {
			var i = n[r];
			e.addEventListener(i.type, i.attachedListener, em(i.optionsOrUseCapture));
		}
		e.nodeType !== 3 && (n = t._observers, n !== null && n.forEach(function(n) {
			for (var r = 0, i = 0; i < cm.length; i++) {
				var a = cm[i];
				(a.fragmentInstance !== t || a.observer !== n || a.instance !== e) && (cm[r++] = a);
			}
			cm.length = r, n.observe(e);
		}), hm(e, t));
	}
	function _m(e, t) {
		var n = t._eventListeners;
		if (n !== null) for (var r = 0; r < n.length; r++) {
			var i = n[r];
			e.removeEventListener(i.type, i.attachedListener, em(i.optionsOrUseCapture));
		}
		e.nodeType !== 3 && (n = t._observers, n !== null && n.forEach(function(n) {
			typeof n.rootMargin == "string" ? um(t, n, e) : n.unobserve(e);
		}), e.reactFragments != null && e.reactFragments.delete(t));
	}
	function vm(e) {
		var t = e.firstChild;
		for (t && t.nodeType === 10 && (t = t.nextSibling); t;) {
			var n = t;
			switch (t = t.nextSibling, n.nodeName) {
				case "HTML":
				case "HEAD":
				case "BODY":
					vm(n), Wt(n);
					continue;
				case "SCRIPT":
				case "STYLE": continue;
				case "LINK": if (n.rel.toLowerCase() === "stylesheet") continue;
			}
			e.removeChild(n);
		}
	}
	function ym(e, t, n, r) {
		for (; e.nodeType === 1;) {
			var i = n;
			if (e.nodeName.toLowerCase() !== t.toLowerCase()) {
				if (!r && (e.nodeName !== "INPUT" || e.type !== "hidden")) break;
			} else if (!r) {
				if (t === "input" && e.type === "hidden") {
					var a = i.name == null ? null : "" + i.name;
					if (i.type === "hidden" && e.getAttribute("name") === a) return e;
				} else return e;
			} else if (!e[Ht]) switch (t) {
				case "meta":
					if (!e.hasAttribute("itemprop")) break;
					return e;
				case "link":
					if (a = e.getAttribute("rel"), a === "stylesheet" && e.hasAttribute("data-precedence") || a !== i.rel || e.getAttribute("href") !== (i.href == null || i.href === "" ? null : i.href) || e.getAttribute("crossorigin") !== (i.crossOrigin == null ? null : i.crossOrigin) || e.getAttribute("title") !== (i.title == null ? null : i.title)) break;
					return e;
				case "style":
					if (e.hasAttribute("data-precedence")) break;
					return e;
				case "script":
					if (a = e.getAttribute("src"), (a !== (i.src == null ? null : i.src) || e.getAttribute("type") !== (i.type == null ? null : i.type) || e.getAttribute("crossorigin") !== (i.crossOrigin == null ? null : i.crossOrigin)) && a && e.hasAttribute("async") && !e.hasAttribute("itemprop")) break;
					return e;
				default: return e;
			}
			if (e = Tm(e.nextSibling), e === null) break;
		}
		return null;
	}
	function bm(e, t, n) {
		if (t === "") return null;
		for (; e.nodeType !== 3;) if ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") && !n || (e = Tm(e.nextSibling), e === null)) return null;
		return e;
	}
	function xm(e, t) {
		for (; e.nodeType !== 8;) if ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") && !t || (e = Tm(e.nextSibling), e === null)) return null;
		return e;
	}
	function Sm(e) {
		return e.data === "$?" || e.data === "$~";
	}
	function Cm(e) {
		return e.data === "$!" || e.data === "$?" && e.ownerDocument.readyState !== "loading";
	}
	function wm(e, t) {
		var n = e.ownerDocument;
		if (e.data === "$~") e._reactRetry = t;
		else if (e.data !== "$?" || n.readyState !== "loading") t();
		else {
			var r = function() {
				t(), n.removeEventListener("DOMContentLoaded", r);
			};
			n.addEventListener("DOMContentLoaded", r), e._reactRetry = r;
		}
	}
	function Tm(e) {
		for (; e != null; e = e.nextSibling) {
			var t = e.nodeType;
			if (t === 1 || t === 3) break;
			if (t === 8) {
				if (t = e.data, t === "$" || t === "$!" || t === "$?" || t === "$~" || t === "&" || t === "F!" || t === "F") break;
				if (t === "/$" || t === "/&") return null;
			}
		}
		return e;
	}
	var Em = null;
	function R(e) {
		e = e.nextSibling;
		for (var t = 0; e;) {
			if (e.nodeType === 8) {
				var n = e.data;
				if (n === "/$" || n === "/&") {
					if (t === 0) return Tm(e.nextSibling);
					t--;
				} else n !== "$" && n !== "$!" && n !== "$?" && n !== "$~" && n !== "&" || t++;
			}
			e = e.nextSibling;
		}
		return null;
	}
	function Dm(e) {
		e = e.previousSibling;
		for (var t = 0; e;) {
			if (e.nodeType === 8) {
				var n = e.data;
				if (n === "$" || n === "$!" || n === "$?" || n === "$~" || n === "&") {
					if (t === 0) return e;
					t--;
				} else n !== "/$" && n !== "/&" || t++;
			}
			e = e.previousSibling;
		}
		return null;
	}
	function Om(e, t) {
		function n() {
			r = !0;
		}
		if (e.ownerDocument.activeElement === e) return !0;
		var r = !1;
		try {
			e.ownerDocument.addEventListener("focus", n, !0), (e.focus || HTMLElement.prototype.focus).call(e, t);
		} finally {
			e.ownerDocument.removeEventListener("focus", n, !0);
		}
		return r;
	}
	function km(e) {
		Fp(function() {
			Fp(function(t) {
				return e(t);
			});
		});
	}
	function Am(e, t, n) {
		switch (t = Tp(n), e) {
			case "html":
				if (e = t.documentElement, !e) throw Error(a(452));
				return e;
			case "head":
				if (e = t.head, !e) throw Error(a(453));
				return e;
			case "body":
				if (e = t.body, !e) throw Error(a(454));
				return e;
			default: throw Error(a(451));
		}
	}
	function jm(e, t, n) {
		for (var r in n) {
			var i = n[r];
			n.hasOwnProperty(r) && i != null && gp(e, t, r, null, yp, i);
		}
		n.dangerouslySetInnerHTML != null && (e.textContent = ""), e.onclick === jn && (e.onclick = null), Wt(e);
	}
	function Mm(e) {
		for (var t = e.attributes; t.length;) e.removeAttributeNode(t[0]);
		Wt(e);
	}
	var Nm = /* @__PURE__ */ new Map(), Pm = /* @__PURE__ */ new Set();
	function Fm(e) {
		if (typeof e.getRootNode == "function") {
			var t = e.getRootNode();
			if (t.nodeType === 9 || t.nodeType === 11) return t;
		}
		return e.nodeType === 9 ? e : e.ownerDocument;
	}
	var Im = De.d;
	De.d = {
		f: Lm,
		r: Rm,
		D: Vm,
		C: Hm,
		L: Um,
		m: Wm,
		X: Km,
		S: Gm,
		M: qm
	};
	function Lm() {
		var e = Im.f(), t = $d();
		return e || t;
	}
	function Rm(e) {
		var t = Kt(e);
		t !== null && t.tag === 5 && t.type === "form" ? mc(t) : Im.r(e);
	}
	var zm = typeof document > "u" ? null : document;
	function Bm(e, t, n) {
		var r = zm;
		if (r && typeof t == "string" && t) {
			var i = gn(t);
			i = "link[rel=\"" + e + "\"][href=\"" + i + "\"]", typeof n == "string" && (i += "[crossorigin=\"" + n + "\"]"), Pm.has(i) || (Pm.add(i), e = {
				rel: e,
				crossOrigin: n,
				href: t
			}, r.querySelector(i) === null && (t = r.createElement("link"), vp(t, "link", e), Yt(t), r.head.appendChild(t)));
		}
	}
	function Vm(e) {
		Im.D(e), Bm("dns-prefetch", e, null);
	}
	function Hm(e, t) {
		Im.C(e, t), Bm("preconnect", e, t);
	}
	function Um(e, t, n) {
		Im.L(e, t, n);
		var r = zm;
		if (r && e && t) {
			var i = "link[rel=\"preload\"][as=\"" + gn(t) + "\"]";
			t === "image" && n && n.imageSrcSet ? (i += "[imagesrcset=\"" + gn(n.imageSrcSet) + "\"]", typeof n.imageSizes == "string" && (i += "[imagesizes=\"" + gn(n.imageSizes) + "\"]")) : i += "[href=\"" + gn(e) + "\"]";
			var a = i;
			switch (t) {
				case "style":
					a = B(e);
					break;
				case "script": a = Zm(e);
			}
			if (!(Nm.has(a) || (e = x({
				rel: "preload",
				href: t === "image" && n && n.imageSrcSet ? void 0 : e,
				as: t
			}, n), Nm.set(a, e), r.querySelector(i) !== null || t === "style" && r.querySelector(Jm(a)) || t === "script" && r.querySelector(Qm(a))))) {
				var o = r.createElement("link");
				vp(o, "link", e), t === "style" && (o[Ut] = !0, o.onload = o.onerror = function() {
					Xt(o);
				}), Yt(o), r.head.appendChild(o);
			}
		}
	}
	function Wm(e, t) {
		Im.m(e, t);
		var n = zm;
		if (n && e) {
			var r = t && typeof t.as == "string" ? t.as : "script", i = "link[rel=\"modulepreload\"][as=\"" + gn(r) + "\"][href=\"" + gn(e) + "\"]", a = i;
			switch (r) {
				case "audioworklet":
				case "paintworklet":
				case "serviceworker":
				case "sharedworker":
				case "worker":
				case "script": a = Zm(e);
			}
			if (!Nm.has(a) && (e = x({
				rel: "modulepreload",
				href: e
			}, t), Nm.set(a, e), n.querySelector(i) === null)) {
				switch (r) {
					case "audioworklet":
					case "paintworklet":
					case "serviceworker":
					case "sharedworker":
					case "worker":
					case "script": if (n.querySelector(Qm(a))) return;
				}
				r = n.createElement("link"), vp(r, "link", e), Yt(r), n.head.appendChild(r);
			}
		}
	}
	function Gm(e, t, n) {
		Im.S(e, t, n);
		var r = zm;
		if (r && e) {
			var i = Jt(r).hoistableStyles, a = B(e);
			t ||= "default";
			var o = i.get(a);
			if (!o) {
				var s = {
					loading: 0,
					preload: null
				};
				if (o = r.querySelector(Jm(a))) s.loading = 5;
				else {
					e = x({
						rel: "stylesheet",
						href: e,
						"data-precedence": t
					}, n), (n = Nm.get(a)) && th(e, n);
					var c = o = r.createElement("link");
					Yt(c), vp(c, "link", e), c._p = new Promise(function(e, t) {
						c.onload = e, c.onerror = t;
					}), c.addEventListener("load", function() {
						s.loading |= 1;
					}), c.addEventListener("error", function() {
						s.loading |= 2;
					}), s.loading |= 4, eh(o, t, r);
				}
				o = {
					type: "stylesheet",
					instance: o,
					count: 1,
					state: s
				}, i.set(a, o);
			}
		}
	}
	function Km(e, t) {
		Im.X(e, t);
		var n = zm;
		if (n && e) {
			var r = Jt(n).hoistableScripts, i = Zm(e), a = r.get(i);
			a || (a = n.querySelector(Qm(i)), a || (e = x({
				src: e,
				async: !0
			}, t), (t = Nm.get(i)) && nh(e, t), a = n.createElement("script"), Yt(a), vp(a, "link", e), n.head.appendChild(a)), a = {
				type: "script",
				instance: a,
				count: 1,
				state: null
			}, r.set(i, a));
		}
	}
	function qm(e, t) {
		Im.M(e, t);
		var n = zm;
		if (n && e) {
			var r = Jt(n).hoistableScripts, i = Zm(e), a = r.get(i);
			a || (a = n.querySelector(Qm(i)), a || (e = x({
				src: e,
				async: !0,
				type: "module"
			}, t), (t = Nm.get(i)) && nh(e, t), a = n.createElement("script"), Yt(a), vp(a, "link", e), n.head.appendChild(a)), a = {
				type: "script",
				instance: a,
				count: 1,
				state: null
			}, r.set(i, a));
		}
	}
	function z(e, t, n, r) {
		var i = (i = Ie.current) ? Fm(i) : null;
		if (!i) throw Error(a(446));
		switch (e) {
			case "meta":
			case "title": return null;
			case "style": return typeof n.precedence == "string" && typeof n.href == "string" ? (n = B(n.href), t = Jt(i).hoistableStyles, r = t.get(n), r || (r = {
				type: "style",
				instance: null,
				count: 0,
				state: null
			}, t.set(n, r)), r) : {
				type: "void",
				instance: null,
				count: 0,
				state: null
			};
			case "link":
				if (n.rel === "stylesheet" && typeof n.href == "string" && typeof n.precedence == "string") {
					e = B(n.href);
					var o = Jt(i).hoistableStyles, s = o.get(e);
					if (s || (i = i.ownerDocument || i, s = {
						type: "stylesheet",
						instance: null,
						count: 0,
						state: {
							loading: 0,
							preload: null
						}
					}, o.set(e, s), (o = i.querySelector(Jm(e))) ? o._p || (s.instance = o, s.state.loading = 5) : (o = Nm.get(e), o || (o = {
						rel: "preload",
						as: "style",
						href: n.href,
						crossOrigin: n.crossOrigin,
						integrity: n.integrity,
						media: n.media,
						hrefLang: n.hrefLang,
						referrerPolicy: n.referrerPolicy
					}, Nm.set(e, o)), Xm(i, e, o, s.state))), t && r === null) throw Error(a(528, ""));
					return s;
				}
				if (t && r !== null) throw Error(a(529, ""));
				return null;
			case "script": return t = n.async, n = n.src, typeof n == "string" && t && typeof t != "function" && typeof t != "symbol" ? (n = Zm(n), t = Jt(i).hoistableScripts, r = t.get(n), r || (r = {
				type: "script",
				instance: null,
				count: 0,
				state: null
			}, t.set(n, r)), r) : {
				type: "void",
				instance: null,
				count: 0,
				state: null
			};
			default: throw Error(a(444, e));
		}
	}
	function B(e) {
		return "href=\"" + gn(e) + "\"";
	}
	function Jm(e) {
		return "link[rel=\"stylesheet\"][" + e + "]";
	}
	function Ym(e) {
		return x({}, e, {
			"data-precedence": e.precedence,
			precedence: null
		});
	}
	function Xm(e, t, n, r) {
		if (t = e.querySelector("link[rel=\"preload\"][as=\"style\"][" + t + "]")) {
			if (!0 !== t[Ut]) {
				r.loading = 1;
				return;
			}
		} else t = e.createElement("link"), t[Ut] = !0, t.onload = t.onerror = Xt.bind(null, t), vp(t, "link", n), Yt(t), e.head.appendChild(t);
		r.preload = t, t.addEventListener("load", function() {
			return r.loading |= 1;
		}), t.addEventListener("error", function() {
			return r.loading |= 2;
		});
	}
	function Zm(e) {
		return "[src=\"" + gn(e) + "\"]";
	}
	function Qm(e) {
		return "script[async]" + e;
	}
	function $m(e, t, n) {
		if (t.count++, t.instance === null) switch (t.type) {
			case "style":
				var r = e.querySelector("style[data-href~=\"" + gn(n.href) + "\"]");
				if (r) return t.instance = r, Yt(r), r;
				var i = x({}, n, {
					"data-href": n.href,
					"data-precedence": n.precedence,
					href: null,
					precedence: null
				});
				return r = (e.ownerDocument || e).createElement("style"), Yt(r), vp(r, "style", i), eh(r, n.precedence, e), t.instance = r;
			case "stylesheet":
				i = B(n.href);
				var o = e.querySelector(Jm(i));
				if (o) return t.state.loading |= 4, t.instance = o, Yt(o), o;
				r = Ym(n), (i = Nm.get(i)) && th(r, i), o = (e.ownerDocument || e).createElement("link"), Yt(o);
				var s = o;
				return s._p = new Promise(function(e, t) {
					s.onload = e, s.onerror = t;
				}), vp(o, "link", r), t.state.loading |= 4, eh(o, n.precedence, e), t.instance = o;
			case "script": return o = Zm(n.src), (i = e.querySelector(Qm(o))) ? (t.instance = i, Yt(i), i) : (r = n, (i = Nm.get(o)) && (r = x({}, n), nh(r, i)), e = e.ownerDocument || e, i = e.createElement("script"), Yt(i), vp(i, "link", r), e.head.appendChild(i), t.instance = i);
			case "void": return null;
			default: throw Error(a(443, t.type));
		}
		else t.type === "stylesheet" && !(t.state.loading & 4) && (r = t.instance, t.state.loading |= 4, eh(r, n.precedence, e));
		return t.instance;
	}
	function eh(e, t, n) {
		for (var r = n.querySelectorAll("link[rel=\"stylesheet\"][data-precedence],style[data-precedence]"), i = r.length ? r[r.length - 1] : null, a = i, o = 0; o < r.length; o++) {
			var s = r[o];
			if (s.dataset.precedence === t) a = s;
			else if (a !== i) break;
		}
		a ? a.parentNode.insertBefore(e, a.nextSibling) : (t = n.nodeType === 9 ? n.head : n, t.insertBefore(e, t.firstChild));
	}
	function th(e, t) {
		e.crossOrigin ??= t.crossOrigin, e.referrerPolicy ??= t.referrerPolicy, e.title ??= t.title;
	}
	function nh(e, t) {
		e.crossOrigin ??= t.crossOrigin, e.referrerPolicy ??= t.referrerPolicy, e.integrity ??= t.integrity;
	}
	var rh = null;
	function ih(e, t, n) {
		if (rh === null) {
			var r = /* @__PURE__ */ new Map(), i = rh = /* @__PURE__ */ new Map();
			i.set(n, r);
		} else i = rh, r = i.get(n), r || (r = /* @__PURE__ */ new Map(), i.set(n, r));
		if (r.has(e)) return r;
		for (r.set(e, null), n = n.getElementsByTagName(e), i = 0; i < n.length; i++) {
			var a = n[i];
			if (!(a[Ht] || a[Ft] || e === "link" && a.getAttribute("rel") === "stylesheet") && a.namespaceURI !== "http://www.w3.org/2000/svg") {
				var o = a.getAttribute(t) || "";
				o = e + o;
				var s = r.get(o);
				s ? s.push(a) : r.set(o, [a]);
			}
		}
		return r;
	}
	function ah(e, t, n) {
		e = e.ownerDocument || e, e.head.insertBefore(n, t === "title" ? e.querySelector("head > title") : null);
	}
	function oh(e, t, n) {
		if (n === 1 || t.itemProp != null) return !1;
		switch (e) {
			case "meta":
			case "title": return !0;
			case "style":
				if (typeof t.precedence != "string" || typeof t.href != "string" || t.href === "") break;
				return !0;
			case "link":
				if (typeof t.rel != "string" || typeof t.href != "string" || t.href === "" || t.onLoad || t.onError) break;
				switch (t.rel) {
					case "stylesheet": return e = t.disabled, typeof t.precedence == "string" && e == null;
					default: return !0;
				}
			case "script": if (t.async && typeof t.async != "function" && typeof t.async != "symbol" && !t.onLoad && !t.onError && t.src && typeof t.src == "string") return !0;
		}
		return !1;
	}
	function sh(e, t) {
		return e === "img" && t.src != null && t.src !== "" && t.onLoad == null && t.loading !== "lazy";
	}
	function ch(e) {
		return !(e.type === "stylesheet" && !(e.state.loading & 3));
	}
	function lh(e) {
		return (e.width || 100) * (e.height || 100) * (typeof devicePixelRatio == "number" ? devicePixelRatio : 1) * .25;
	}
	function uh(e, t) {
		typeof t.decode == "function" && (e.imgCount++, t.complete || (e.imgBytes += lh(t), e.suspenseyImages.push(t)), e = gh.bind(e), t.decode().then(e, e));
	}
	function dh(e, t, n, r) {
		if (n.type === "stylesheet" && (typeof r.media != "string" || !1 !== matchMedia(r.media).matches) && !(n.state.loading & 4)) {
			if (n.instance === null) {
				var i = B(r.href), a = t.querySelector(Jm(i));
				if (a) {
					t = a._p, typeof t == "object" && t && typeof t.then == "function" && (e.count++, e = hh.bind(e), t.then(e, e)), n.state.loading |= 4, n.instance = a, Yt(a);
					return;
				}
				a = t.ownerDocument || t, r = Ym(r), (i = Nm.get(i)) && th(r, i), a = a.createElement("link"), Yt(a);
				var o = a;
				o._p = new Promise(function(e, t) {
					o.onload = e, o.onerror = t;
				}), vp(a, "link", r), n.instance = a;
			}
			e.stylesheets === null && (e.stylesheets = /* @__PURE__ */ new Map()), e.stylesheets.set(n, t), (t = n.state.preload) && !(n.state.loading & 3) && (e.count++, n = hh.bind(e), t.addEventListener("load", n), t.addEventListener("error", n));
		}
	}
	var fh = 0;
	function ph(e, t) {
		return e.stylesheets && e.count === 0 && vh(e, e.stylesheets), 0 < e.count || 0 < e.imgCount ? function(n) {
			var r = setTimeout(function() {
				if (e.stylesheets && vh(e, e.stylesheets), e.unsuspend) {
					var t = e.unsuspend;
					e.unsuspend = null, t();
				}
			}, 6e4 + t);
			0 < e.imgBytes && fh === 0 && (fh = 62500 * Sp());
			var i = setTimeout(function() {
				if (e.waitingForImages = !1, e.count === 0 && (e.stylesheets && vh(e, e.stylesheets), e.unsuspend)) {
					var t = e.unsuspend;
					e.unsuspend = null, t();
				}
			}, (e.imgBytes > fh ? 50 : 800) + t);
			return e.unsuspend = n, function() {
				e.unsuspend = null, clearTimeout(r), clearTimeout(i);
			};
		} : null;
	}
	function mh(e) {
		if (e.count === 0 && (e.imgCount === 0 || !e.waitingForImages)) {
			if (e.stylesheets) vh(e, e.stylesheets);
			else if (e.unsuspend) {
				var t = e.unsuspend;
				e.unsuspend = null, t();
			}
		}
	}
	function hh() {
		this.count--, mh(this);
	}
	function gh() {
		this.imgCount--, mh(this);
	}
	var _h = null;
	function vh(e, t) {
		e.stylesheets = null, e.unsuspend !== null && (e.count++, _h = /* @__PURE__ */ new Map(), t.forEach(yh, e), _h = null, hh.call(e));
	}
	function yh(e, t) {
		if (!(t.state.loading & 4)) {
			var n = _h.get(e);
			if (n) var r = n.get(null);
			else {
				n = /* @__PURE__ */ new Map(), _h.set(e, n);
				for (var i = e.querySelectorAll("link[data-precedence],style[data-precedence]"), a = 0; a < i.length; a++) {
					var o = i[a];
					(o.nodeName === "LINK" || o.getAttribute("media") !== "not all") && (n.set(o.dataset.precedence, o), r = o);
				}
				r && n.set(null, r);
			}
			i = t.instance, o = i.getAttribute("data-precedence"), a = n.get(o) || r, a === r && n.set(null, i), n.set(o, i), this.count++, r = hh.bind(this), i.addEventListener("load", r), i.addEventListener("error", r), a ? a.parentNode.insertBefore(i, a.nextSibling) : (e = e.nodeType === 9 ? e.head : e, e.insertBefore(i, e.firstChild)), t.state.loading |= 4;
		}
	}
	var bh = {
		$$typeof: fe,
		Provider: null,
		Consumer: null,
		_currentValue: Oe,
		_currentValue2: Oe,
		_threadCount: 0
	};
	function xh(e, t, n, r, i, a, o, s, c) {
		this.tag = 1, this.containerInfo = e, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = wt(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = wt(0), this.hiddenUpdates = wt(null), this.identifierPrefix = r, this.onUncaughtError = i, this.onCaughtError = a, this.onRecoverableError = o, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = c, this.transitionTypes = null, this.incompleteTransitions = /* @__PURE__ */ new Map();
	}
	function Sh(e, t, n, r, i, a, o, s, c, l, u, d) {
		return e = new xh(e, t, n, o, c, l, u, d, s), t = 1, !0 === a && (t |= 24), a = Gi(3, null, null, t), e.current = a, a.stateNode = e, t = k(), t.refCount++, e.pooledCache = t, t.refCount++, a.memoizedState = {
			element: r,
			isDehydrated: n,
			cache: t
		}, To(a), e;
	}
	function Ch(e) {
		return e ? (e = Ui, e) : Ui;
	}
	function wh(e, t, n, r, i, a) {
		i = Ch(i), r.context === null ? r.context = i : r.pendingContext = i, r = Do(t), r.payload = { element: n }, a = a === void 0 ? null : a, a !== null && (r.callback = a), n = Oo(e, r, t), n !== null && (Jd(n, e, t), ko(n, e, t));
	}
	function Th(e, t) {
		if (e = e.memoizedState, e !== null && e.dehydrated !== null) {
			var n = e.retryLane;
			e.retryLane = n !== 0 && n < t ? n : t;
		}
	}
	function Eh(e, t) {
		Th(e, t), (e = e.alternate) && Th(e, t);
	}
	function Dh(e) {
		if (e.tag === 13 || e.tag === 31) {
			var t = Bi(e, 67108864);
			t !== null && Jd(t, e, 67108864), Eh(e, 67108864);
		}
	}
	function Oh(e) {
		if (e.tag === 13 || e.tag === 31) {
			var t = Gd();
			t = At(t);
			var n = Bi(e, t);
			n !== null && Jd(n, e, t), Eh(e, t);
		}
	}
	var kh = !0;
	function Ah(e, t, n, r) {
		var i = w.T;
		w.T = null;
		var a = De.p;
		try {
			De.p = 2, Mh(e, t, n, r);
		} finally {
			De.p = a, w.T = i;
		}
	}
	function jh(e, t, n, r) {
		var i = w.T;
		w.T = null;
		var a = De.p;
		try {
			De.p = 8, Mh(e, t, n, r);
		} finally {
			De.p = a, w.T = i;
		}
	}
	function Mh(e, t, n, r) {
		if (kh) {
			var i = Nh(r);
			if (i === null) sp(e, t, r, Ph, n), Gh(e, r);
			else if (qh(i, e, t, n, r)) r.stopPropagation();
			else if (Gh(e, r), t & 4 && -1 < Wh.indexOf(e)) {
				for (; i !== null;) {
					var a = Kt(i);
					if (a !== null) switch (a.tag) {
						case 3:
							if (a = a.stateNode, a.current.memoizedState.isDehydrated) {
								var o = vt(a.pendingLanes);
								if (o !== 0) {
									var s = a;
									for (s.pendingLanes |= 2, s.entangledLanes |= 2; o;) {
										var c = 1 << 31 - dt(o);
										s.entanglements[1] |= c, o &= ~c;
									}
									Vf(a), !(pd & 6) && (jd = $e() + 500, Hf(0, !1));
								}
							}
							break;
						case 31:
						case 13: s = Bi(a, 2), s !== null && Jd(s, a, 2), $d(), Eh(a, 2);
					}
					if (a = Nh(r), a === null && sp(e, t, r, Ph, n), a === i) break;
					i = a;
				}
				i !== null && r.stopPropagation();
			} else sp(e, t, r, null, n);
		}
	}
	function Nh(e) {
		return e = Nn(e), Fh(e);
	}
	var Ph = null;
	function Fh(e) {
		if (Ph = null, e = Gt(e), e !== null) {
			var t = s(e);
			if (t === null) e = null;
			else {
				var n = t.tag;
				if (n === 13) {
					if (e = c(t), e !== null) return e;
					e = null;
				} else if (n === 31) {
					if (e = u(t), e !== null) return e;
					e = null;
				} else if (n === 3) {
					if (t.stateNode.current.memoizedState.isDehydrated) return t.tag === 3 ? t.stateNode.containerInfo : null;
					e = null;
				} else t !== e && (e = null);
			}
		}
		return Ph = e, null;
	}
	function Ih(e) {
		switch (e) {
			case "beforetoggle":
			case "cancel":
			case "click":
			case "close":
			case "contextmenu":
			case "copy":
			case "cut":
			case "auxclick":
			case "dblclick":
			case "dragend":
			case "dragstart":
			case "drop":
			case "focusin":
			case "focusout":
			case "input":
			case "invalid":
			case "keydown":
			case "keypress":
			case "keyup":
			case "mousedown":
			case "mouseup":
			case "paste":
			case "pause":
			case "play":
			case "pointercancel":
			case "pointerdown":
			case "pointerup":
			case "ratechange":
			case "reset":
			case "seeked":
			case "submit":
			case "toggle":
			case "touchcancel":
			case "touchend":
			case "touchstart":
			case "volumechange":
			case "change":
			case "selectionchange":
			case "textInput":
			case "compositionstart":
			case "compositionend":
			case "compositionupdate":
			case "beforeblur":
			case "afterblur":
			case "beforeinput":
			case "blur":
			case "fullscreenchange":
			case "fullscreenerror":
			case "focus":
			case "hashchange":
			case "popstate":
			case "select":
			case "selectstart": return 2;
			case "drag":
			case "dragenter":
			case "dragexit":
			case "dragleave":
			case "dragover":
			case "mousemove":
			case "mouseout":
			case "mouseover":
			case "pointermove":
			case "pointerout":
			case "pointerover":
			case "resize":
			case "scroll":
			case "touchmove":
			case "wheel":
			case "mouseenter":
			case "mouseleave":
			case "pointerenter":
			case "pointerleave": return 8;
			case "message": switch (et()) {
				case tt: return 2;
				case nt: return 8;
				case rt:
				case it: return 32;
				case at: return 268435456;
				default: return 32;
			}
			default: return 32;
		}
	}
	var Lh = !1, Rh = null, zh = null, Bh = null, Vh = /* @__PURE__ */ new Map(), Hh = /* @__PURE__ */ new Map(), Uh = [], Wh = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(" ");
	function Gh(e, t) {
		switch (e) {
			case "focusin":
			case "focusout":
				Rh = null;
				break;
			case "dragenter":
			case "dragleave":
				zh = null;
				break;
			case "mouseover":
			case "mouseout":
				Bh = null;
				break;
			case "pointerover":
			case "pointerout":
				Vh.delete(t.pointerId);
				break;
			case "gotpointercapture":
			case "lostpointercapture": Hh.delete(t.pointerId);
		}
	}
	function Kh(e, t, n, r, i, a) {
		return e === null || e.nativeEvent !== a ? (e = {
			blockedOn: t,
			domEventName: n,
			eventSystemFlags: r,
			nativeEvent: a,
			targetContainers: [i]
		}, t !== null && (t = Kt(t), t !== null && Dh(t)), e) : (e.eventSystemFlags |= r, t = e.targetContainers, i !== null && t.indexOf(i) === -1 && t.push(i), e);
	}
	function qh(e, t, n, r, i) {
		switch (t) {
			case "focusin": return Rh = Kh(Rh, e, t, n, r, i), !0;
			case "dragenter": return zh = Kh(zh, e, t, n, r, i), !0;
			case "mouseover": return Bh = Kh(Bh, e, t, n, r, i), !0;
			case "pointerover":
				var a = i.pointerId;
				return Vh.set(a, Kh(Vh.get(a) || null, e, t, n, r, i)), !0;
			case "gotpointercapture": return a = i.pointerId, Hh.set(a, Kh(Hh.get(a) || null, e, t, n, r, i)), !0;
		}
		return !1;
	}
	function Jh(e) {
		var t = Gt(e.target);
		if (t !== null) {
			var n = s(t);
			if (n !== null) {
				if (t = n.tag, t === 13) {
					if (t = c(n), t !== null) {
						e.blockedOn = t, Nt(e.priority, function() {
							Oh(n);
						});
						return;
					}
				} else if (t === 31) {
					if (t = u(n), t !== null) {
						e.blockedOn = t, Nt(e.priority, function() {
							Oh(n);
						});
						return;
					}
				} else if (t === 3 && n.stateNode.current.memoizedState.isDehydrated) {
					e.blockedOn = n.tag === 3 ? n.stateNode.containerInfo : null;
					return;
				}
			}
		}
		e.blockedOn = null;
	}
	function Yh(e) {
		if (e.blockedOn !== null) return !1;
		for (var t = e.targetContainers; 0 < t.length;) {
			var n = Nh(e.nativeEvent);
			if (n === null) {
				n = e.nativeEvent;
				var r = new n.constructor(n.type, n);
				Mn = r, n.target.dispatchEvent(r), Mn = null;
			} else return t = Kt(n), t !== null && Dh(t), e.blockedOn = n, !1;
			t.shift();
		}
		return !0;
	}
	function Xh(e, t, n) {
		Yh(e) && n.delete(t);
	}
	function Zh() {
		Lh = !1, Rh !== null && Yh(Rh) && (Rh = null), zh !== null && Yh(zh) && (zh = null), Bh !== null && Yh(Bh) && (Bh = null), Vh.forEach(Xh), Hh.forEach(Xh);
	}
	function Qh(e, n) {
		e.blockedOn === n && (e.blockedOn = null, Lh || (Lh = !0, t.unstable_scheduleCallback(t.unstable_NormalPriority, Zh)));
	}
	var $h = null;
	function eg(e) {
		$h !== e && ($h = e, t.unstable_scheduleCallback(t.unstable_NormalPriority, function() {
			$h === e && ($h = null);
			for (var t = 0; t < e.length; t += 3) {
				var n = e[t], r = e[t + 1], i = e[t + 2];
				if (typeof r != "function") {
					if (Fh(r || n) === null) continue;
					break;
				}
				var a = Kt(n);
				a !== null && (e.splice(t, 3), t -= 3, fc(a, {
					pending: !0,
					data: i,
					method: n.method,
					action: r
				}, r, i));
			}
		}));
	}
	function tg(e) {
		function t(t) {
			return Qh(t, e);
		}
		Rh !== null && Qh(Rh, e), zh !== null && Qh(zh, e), Bh !== null && Qh(Bh, e), Vh.forEach(t), Hh.forEach(t);
		for (var n = 0; n < Uh.length; n++) {
			var r = Uh[n];
			r.blockedOn === e && (r.blockedOn = null);
		}
		for (; 0 < Uh.length && (n = Uh[0], n.blockedOn === null);) Jh(n), n.blockedOn === null && Uh.shift();
		if (n = (e.ownerDocument || e).$$reactFormReplay, n != null) for (r = 0; r < n.length; r += 3) {
			var i = n[r], a = n[r + 1], o = i[It] || null;
			if (typeof a == "function") o || eg(n);
			else if (o) {
				var s = null;
				if (a && a.hasAttribute("formAction")) {
					if (i = a, o = a[It] || null) s = o.formAction;
					else if (Fh(i) !== null) continue;
				} else s = o.action;
				typeof s == "function" ? n[r + 1] = s : (n.splice(r, 3), r -= 3), eg(n);
			}
		}
	}
	function ng() {
		function e(e) {
			e.canIntercept && e.info === "react-transition" && e.intercept({
				handler: function() {
					return new Promise(function(e) {
						return i = e;
					});
				},
				focusReset: "manual",
				scroll: "manual"
			});
		}
		function t() {
			i !== null && (i(), i = null), r || setTimeout(n, 20);
		}
		function n() {
			if (!r && !navigation.transition) {
				var e = navigation.currentEntry;
				e && e.url != null && navigation.navigate(e.url, {
					state: e.getState(),
					info: "react-transition",
					history: "replace"
				});
			}
		}
		if (typeof navigation == "object") {
			var r = !1, i = null;
			return navigation.addEventListener("navigate", e), navigation.addEventListener("navigatesuccess", t), navigation.addEventListener("navigateerror", t), setTimeout(n, 100), function() {
				r = !0, navigation.removeEventListener("navigate", e), navigation.removeEventListener("navigatesuccess", t), navigation.removeEventListener("navigateerror", t), i !== null && (i(), i = null);
			};
		}
	}
	function rg(e) {
		this._internalRoot = e;
	}
	ig.prototype.render = rg.prototype.render = function(e) {
		var t = this._internalRoot;
		if (t === null) throw Error(a(409));
		var n = t.current;
		wh(n, Gd(), e, t, null, null);
	}, ig.prototype.unmount = rg.prototype.unmount = function() {
		var e = this._internalRoot;
		if (e !== null) {
			this._internalRoot = null;
			var t = e.containerInfo;
			wh(e.current, 2, null, e, null, null), $d(), t[Lt] = null;
		}
	};
	function ig(e) {
		this._internalRoot = e;
	}
	ig.prototype.unstable_scheduleHydration = function(e) {
		if (e) {
			var t = Mt();
			e = {
				blockedOn: null,
				target: e,
				priority: t
			};
			for (var n = 0; n < Uh.length && t !== 0 && t < Uh[n].priority; n++);
			Uh.splice(n, 0, e), n === 0 && Jh(e);
		}
	};
	var ag = n.version;
	if (ag !== "19.3.0") throw Error(a(527, ag, "19.3.0"));
	De.findDOMNode = function(e) {
		var t = e._reactInternals;
		if (t === void 0) throw typeof e.render == "function" ? Error(a(188)) : (e = Object.keys(e).join(","), Error(a(268, e)));
		return e = p(t), e = e === null ? null : m(e), e = e === null ? null : e.stateNode, e;
	};
	var og = {
		bundleType: 0,
		version: "19.3.0",
		rendererPackageName: "react-dom",
		currentDispatcherRef: w,
		reconcilerVersion: "19.3.0"
	};
	if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
		var V = __REACT_DEVTOOLS_GLOBAL_HOOK__;
		if (!V.isDisabled && V.supportsFiber) try {
			ct = V.inject(og), lt = V;
		} catch {}
	}
	e.createRoot = function(e, t) {
		if (!o(e)) throw Error(a(299));
		var n = !1, r = "", i = Fc, s = Ic, c = Lc;
		return t != null && (!0 === t.unstable_strictMode && (n = !0), t.identifierPrefix !== void 0 && (r = t.identifierPrefix), t.onUncaughtError !== void 0 && (i = t.onUncaughtError), t.onCaughtError !== void 0 && (s = t.onCaughtError), t.onRecoverableError !== void 0 && (c = t.onRecoverableError)), t = Sh(e, 1, !1, null, null, n, r, null, i, s, c, ng), e[Lt] = t.current, ap(e), new rg(t);
	}, e.hydrateRoot = function(e, t, n) {
		if (!o(e)) throw Error(a(299));
		var r = !1, i = "", s = Fc, c = Ic, l = Lc, u = null;
		return n != null && (!0 === n.unstable_strictMode && (r = !0), n.identifierPrefix !== void 0 && (i = n.identifierPrefix), n.onUncaughtError !== void 0 && (s = n.onUncaughtError), n.onCaughtError !== void 0 && (c = n.onCaughtError), n.onRecoverableError !== void 0 && (l = n.onRecoverableError), n.formState !== void 0 && (u = n.formState)), t = Sh(e, 1, !0, t, n ?? null, r, i, u, s, c, l, ng), t.context = Ch(null), n = t.current, r = Gd(), r = At(r), i = Do(r), i.callback = null, Oo(n, i, r), n = r, t.current.lanes = n, Tt(t, n), Vf(t), e[Lt] = t.current, ap(e), new ig(t);
	}, e.version = "19.3.0";
})), m = /* @__PURE__ */ a(((e) => {
	process.env.NODE_ENV !== "production" && (function() {
		function t(e, t) {
			for (e = e.memoizedState; e !== null && 0 < t;) e = e.next, t--;
			return e;
		}
		function n(e, t, r, i) {
			if (r >= t.length) return i;
			var a = t[r], o = qm(e) ? e.slice() : R({}, e);
			return o[a] = n(e[a], t, r + 1, i), o;
		}
		function i(e, t, n) {
			if (t.length !== n.length) console.warn("copyWithRename() expects paths of the same length");
			else {
				for (var r = 0; r < n.length - 1; r++) if (t[r] !== n[r]) {
					console.warn("copyWithRename() expects paths to be the same except for the deepest key");
					return;
				}
				return a(e, t, n, 0);
			}
		}
		function a(e, t, n, r) {
			var i = t[r], o = qm(e) ? e.slice() : R({}, e);
			return r + 1 === t.length ? (o[n[r]] = o[i], qm(o) ? o.splice(i, 1) : delete o[i]) : o[i] = a(e[i], t, n, r + 1), o;
		}
		function o(e, t, n) {
			var r = t[n], i = qm(e) ? e.slice() : R({}, e);
			return n + 1 === t.length ? (qm(i) ? i.splice(r, 1) : delete i[r], i) : (i[r] = o(e[r], t, n + 1), i);
		}
		function s() {
			return !1;
		}
		function c() {
			return null;
		}
		function u() {
			console.error("Do not call Hooks inside useEffect(...), useMemo(...), or other built-in Hooks. You can only call Hooks at the top level of your React function. For more information, see https://react.dev/link/rules-of-hooks");
		}
		function d() {
			console.error("Context can only be read while React is rendering. In classes, you can read it in the render method or getDerivedStateFromProps. In function components, you can read it directly in the function body, but not inside Hooks like useReducer() or useMemo().");
		}
		function p() {}
		function m() {}
		function h(e) {
			var t = [];
			return e.forEach(function(e) {
				t.push(e);
			}), t.sort().join(", ");
		}
		function g(e, t, n, r) {
			return new Vr(e, t, n, r);
		}
		function _(e, t) {
			e.context === Lv && (Xp(e.current, 2, t, e, null, null), du());
		}
		function v(e, t) {
			if (Rv !== null) {
				var n = t.staleFamilies;
				t = t.updatedFamilies, Hu(), Br(e.current, t, n), du();
			}
		}
		function y(e) {
			Rv = e;
		}
		function b(e) {
			return !(!e || e.nodeType !== 1 && e.nodeType !== 9 && e.nodeType !== 11);
		}
		function ee(e) {
			for (var t = e, n = t; n && !n.alternate;) t = n, t.flags & 4098 && (e = t.return), n = t.return;
			for (; t.return;) t = t.return;
			return t.tag === 3 ? e : null;
		}
		function te(e) {
			if (e.tag === 13) {
				var t = e.memoizedState;
				if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null) return t.dehydrated;
			}
			return null;
		}
		function ne(e) {
			if (e.tag === 31) {
				var t = e.memoizedState;
				if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null) return t.dehydrated;
			}
			return null;
		}
		function re(e) {
			if (ee(e) !== e) throw Error("Unable to find node on an unmounted component.");
		}
		function ie(e) {
			var t = e.alternate;
			if (!t) {
				if (t = ee(e), t === null) throw Error("Unable to find node on an unmounted component.");
				return t === e ? e : null;
			}
			for (var n = e, r = t;;) {
				var i = n.return;
				if (i === null) break;
				var a = i.alternate;
				if (a === null) {
					if (r = i.return, r !== null) {
						n = r;
						continue;
					}
					break;
				}
				if (i.child === a.child) {
					for (a = i.child; a;) {
						if (a === n) return re(i), e;
						if (a === r) return re(i), t;
						a = a.sibling;
					}
					throw Error("Unable to find node on an unmounted component.");
				}
				if (n.return !== r.return) n = i, r = a;
				else {
					for (var o = !1, s = i.child; s;) {
						if (s === n) {
							o = !0, n = i, r = a;
							break;
						}
						if (s === r) {
							o = !0, r = i, n = a;
							break;
						}
						s = s.sibling;
					}
					if (!o) {
						for (s = a.child; s;) {
							if (s === n) {
								o = !0, n = a, r = i;
								break;
							}
							if (s === r) {
								o = !0, r = a, n = i;
								break;
							}
							s = s.sibling;
						}
						if (!o) throw Error("Child was not found in either parent set. This indicates a bug in React related to the return pointer. Please file an issue.");
					}
				}
				if (n.alternate !== r) throw Error("Return fibers should always be each others' alternates. This error is likely caused by a bug in React. Please file an issue.");
			}
			if (n.tag !== 3) throw Error("Unable to find node on an unmounted component.");
			return n.stateNode.current === n ? e : t;
		}
		function ae(e) {
			var t = e.tag;
			if (t === 5 || t === 26 || t === 27 || t === 6) return e;
			for (e = e.child; e !== null;) {
				if (t = ae(e), t !== null) return t;
				e = e.sibling;
			}
			return null;
		}
		function x(e, t, n, r, i) {
			oe(e.child, !1, t, n, r, i);
		}
		function oe(e, t, n, r, i, a) {
			for (; e !== null;) {
				if ((e.tag === 5 || e.tag === 27 || e.tag === 6) && n(e, r, i, a) || (e.tag !== 22 || e.memoizedState === null) && (t || e.tag !== 5 && e.tag !== 27) && oe(e.child, t, n, r, i, a)) return !0;
				e = e.sibling;
			}
			return !1;
		}
		function S(e) {
			for (e = e.return; e !== null;) {
				if (e.tag === 3 || e.tag === 5 || e.tag === 27) return e;
				e = e.return;
			}
			return null;
		}
		function se(e) {
			var t = !1;
			for (e = e.return; e !== null && (e.tag === 4 && (t = !0), e.tag !== 3 && e.tag !== 5 && e.tag !== 27);) e = e.return;
			return t;
		}
		function ce(e) {
			var t = [null, null], n = S(e);
			return n === null || le(t, e, n.child, { foundSelf: !1 }), t;
		}
		function le(e, t, n, r) {
			for (; n !== null;) {
				if (n === t) r.foundSelf = !0;
				else if (n.tag === 5 || n.tag === 27 || n.tag === 6) {
					if (r.foundSelf) return e[1] = n, !0;
					e[0] = n;
				} else if ((n.tag !== 22 || n.memoizedState === null) && le(e, t, n.child, r)) return !0;
				n = n.sibling;
			}
			return !1;
		}
		function ue(e) {
			switch (e.tag) {
				case 5:
				case 27:
				case 6: return e.stateNode;
				case 3: return e.stateNode.containerInfo;
				default: throw Error("Expected to find a host node. This is a bug in React.");
			}
		}
		function de(e, t, n) {
			return e === n || e === t && (Tm = e, !0);
		}
		function fe(e, t, n) {
			return e === n ? (Em = e, !1) : e === t && (Em !== null && (Tm = e), !0);
		}
		function pe(e) {
			if (e === null) return null;
			do
				e = e === null ? null : e.return;
			while (e && e.tag !== 5 && e.tag !== 27 && e.tag !== 3);
			return e || null;
		}
		function me(e, t, n) {
			for (var r = 0, i = e; i; i = n(i)) r++;
			i = 0;
			for (var a = t; a; a = n(a)) i++;
			for (; 0 < r - i;) e = n(e), r--;
			for (; 0 < i - r;) t = n(t), i--;
			for (; r--;) {
				if (e === t || t !== null && e === t.alternate) return e;
				e = n(e), t = n(t);
			}
			return null;
		}
		function he(e) {
			return typeof e != "object" || !e ? null : (e = Gm && e[Gm] || e["@@iterator"], typeof e == "function" ? e : null);
		}
		function ge(e) {
			if (e == null) return null;
			if (typeof e == "function") return e.$$typeof === Km ? null : e.displayName || e.name || null;
			if (typeof e == "string") return e;
			switch (e) {
				case Am: return "Fragment";
				case Mm: return "Profiler";
				case jm: return "StrictMode";
				case Im: return "Suspense";
				case Lm: return "SuspenseList";
				case Bm: return "Activity";
				case Um: return "ViewTransition";
			}
			if (typeof e == "object") switch (typeof e.tag == "number" && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), e.$$typeof) {
				case km: return "Portal";
				case Pm: return e.displayName || "Context";
				case Nm: return (e._context.displayName || "Context") + ".Consumer";
				case Fm:
					var t = e.render;
					return e = e.displayName, e ||= (e = t.displayName || t.name || "", e === "" ? "ForwardRef" : "ForwardRef(" + e + ")"), e;
				case Rm: return t = e.displayName || null, t === null ? ge(e.type) || "Memo" : t;
				case zm:
					t = e._payload, e = e._init;
					try {
						return ge(e(t));
					} catch {}
			}
			return null;
		}
		function _e(e) {
			return typeof e.tag == "number" ? C(e) : typeof e.name == "string" ? e.name : null;
		}
		function C(e) {
			var t = e.type;
			switch (e.tag) {
				case 31: return "Activity";
				case 24: return "Cache";
				case 9: return (t._context.displayName || "Context") + ".Consumer";
				case 10: return t.displayName || "Context";
				case 18: return "DehydratedFragment";
				case 11: return e = t.render, e = e.displayName || e.name || "", t.displayName || (e === "" ? "ForwardRef" : "ForwardRef(" + e + ")");
				case 7: return "Fragment";
				case 26:
				case 27:
				case 5: return t;
				case 4: return "Portal";
				case 3: return "Root";
				case 6: return "Text";
				case 16: return ge(t);
				case 8: return t === jm ? "StrictMode" : "Mode";
				case 22:
					if (e.return !== null) return C(e.return);
					break;
				case 12: return "Profiler";
				case 21: return "Scope";
				case 13: return "Suspense";
				case 19: return "SuspenseList";
				case 25: return "TracingMarker";
				case 30: return "ViewTransition";
				case 1:
				case 0:
				case 14:
				case 15:
					if (typeof t == "function") return t.displayName || t.name || null;
					if (typeof t == "string") return t;
					break;
				case 29:
					if (t = e._debugInfo, t != null) {
						for (var n = t.length - 1; 0 <= n; n--) if (typeof t[n].name == "string") return t[n].name;
					}
					if (e.return !== null) return C(e.return);
			}
			return null;
		}
		function ve(e) {
			return { current: e };
		}
		function ye(e, t) {
			0 > Zm ? console.error("Unexpected pop.") : (t !== Xm[Zm] && console.error("Unexpected Fiber popped."), e.current = Ym[Zm], Ym[Zm] = null, Xm[Zm] = null, Zm--);
		}
		function be(e, t, n) {
			Zm++, Ym[Zm] = e.current, Xm[Zm] = n, e.current = t;
		}
		function xe(e) {
			return e === null && console.error("Expected host context to exist. This error is likely caused by a bug in React. Please file an issue."), e;
		}
		function Se(e, t) {
			be(eh, t, e), be($m, e, e), be(Qm, null, e);
			var n = t.nodeType;
			switch (n) {
				case 9:
				case 11:
					n = n === 9 ? "#document" : "#fragment", t = (t = t.documentElement) && (t = t.namespaceURI) ? Yd(t) : _T;
					break;
				default: if (n = t.tagName, t = t.namespaceURI) t = Yd(t), t = Xd(t, n);
				else switch (n) {
					case "svg":
						t = vT;
						break;
					case "math":
						t = yT;
						break;
					default: t = _T;
				}
			}
			n = n.toLowerCase(), n = sn(null, n), n = {
				context: t,
				ancestorInfo: n
			}, ye(Qm, e), be(Qm, n, e);
		}
		function Ce(e) {
			ye(Qm, e), ye($m, e), ye(eh, e);
		}
		function we() {
			return xe(Qm.current);
		}
		function Te(e) {
			var t = e.memoizedState;
			t !== null && ($T._currentValue = t.memoizedState, be(th, e, e)), t = xe(Qm.current);
			var n = e.type, r = Xd(t.context, n);
			n = sn(t.ancestorInfo, n), r = {
				context: r,
				ancestorInfo: n
			}, t !== r && (be($m, e, e), be(Qm, r, e));
		}
		function Ee(e) {
			$m.current === e && (ye(Qm, e), ye($m, e)), th.current === e && (ye(th, e), $T._currentValue = QT);
		}
		function w() {}
		function De() {
			if (nh === 0) {
				rh = console.log, ih = console.info, ah = console.warn, oh = console.error, sh = console.group, ch = console.groupCollapsed, lh = console.groupEnd;
				var e = {
					configurable: !0,
					enumerable: !0,
					value: w,
					writable: !0
				};
				Object.defineProperties(console, {
					info: e,
					log: e,
					warn: e,
					error: e,
					group: e,
					groupCollapsed: e,
					groupEnd: e
				});
			}
			nh++;
		}
		function Oe() {
			if (nh--, nh === 0) {
				var e = {
					configurable: !0,
					enumerable: !0,
					writable: !0
				};
				Object.defineProperties(console, {
					log: R({}, e, { value: rh }),
					info: R({}, e, { value: ih }),
					warn: R({}, e, { value: ah }),
					error: R({}, e, { value: oh }),
					group: R({}, e, { value: sh }),
					groupCollapsed: R({}, e, { value: ch }),
					groupEnd: R({}, e, { value: lh })
				});
			}
			0 > nh && console.error("disabledDepth fell below zero. This is a bug in React. Please file an issue.");
		}
		function ke(e) {
			var t = Error.prepareStackTrace;
			if (Error.prepareStackTrace = void 0, e = e.stack, Error.prepareStackTrace = t, e.startsWith("Error: react-stack-top-frame\n") && (e = e.slice(29)), t = e.indexOf("\n"), t !== -1 && (e = e.slice(t + 1)), t = e.indexOf("react_stack_bottom_frame"), t !== -1 && (t = e.lastIndexOf("\n", t)), t !== -1) e = e.slice(0, t);
			else return "";
			return e;
		}
		function Ae(e) {
			if (uh === void 0) try {
				throw Error();
			} catch (e) {
				var t = e.stack.trim().match(/\n( *(at )?)/);
				uh = t && t[1] || "", dh = -1 < e.stack.indexOf("\n    at") ? " (<anonymous>)" : -1 < e.stack.indexOf("@") ? "@unknown:0:0" : "";
			}
			return "\n" + uh + e + dh;
		}
		function je(e, t) {
			if (!e || fh) return "";
			var n = ph.get(e);
			if (n !== void 0) return n;
			fh = !0, n = Error.prepareStackTrace, Error.prepareStackTrace = void 0;
			var r = null;
			r = z.H, z.H = null, De();
			try {
				var i = { DetermineComponentFrameRoot: function() {
					try {
						if (t) {
							var n = function() {
								throw Error();
							};
							if (Object.defineProperty(n.prototype, "props", { set: function() {
								throw Error();
							} }), typeof Reflect == "object" && Reflect.construct) {
								try {
									Reflect.construct(n, []);
								} catch (e) {
									var r = e;
								}
								Reflect.construct(e, [], n);
							} else {
								try {
									n.call();
								} catch (e) {
									r = e;
								}
								n = !1;
								try {
									var i = Object.getOwnPropertyDescriptor(e.prototype, "props");
									Object.defineProperty(e.prototype, "props", {
										configurable: !0,
										set: function() {
											throw Error();
										}
									}), n = !0, new e();
								} finally {
									n && (i === void 0 ? delete e.prototype.props : Object.defineProperty(e.prototype, "props", i));
								}
							}
						} else {
							try {
								throw Error();
							} catch (e) {
								r = e;
							}
							(n = e()) && typeof n.catch == "function" && n.catch(function() {});
						}
					} catch (e) {
						if (e && r && typeof e.stack == "string") return [e.stack, r.stack];
					}
					return [null, null];
				} };
				i.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
				var a = Object.getOwnPropertyDescriptor(i.DetermineComponentFrameRoot, "name");
				a && a.configurable && Object.defineProperty(i.DetermineComponentFrameRoot, "name", { value: "DetermineComponentFrameRoot" });
				var o = i.DetermineComponentFrameRoot(), s = o[0], c = o[1];
				if (s && c) {
					var l = s.split("\n"), u = c.split("\n");
					for (o = a = 0; a < l.length && !l[a].includes("DetermineComponentFrameRoot");) a++;
					for (; o < u.length && !u[o].includes("DetermineComponentFrameRoot");) o++;
					if (a === l.length || o === u.length) for (a = l.length - 1, o = u.length - 1; 1 <= a && 0 <= o && l[a] !== u[o];) o--;
					for (; 1 <= a && 0 <= o; a--, o--) if (l[a] !== u[o]) {
						if (a !== 1 || o !== 1) do
							if (a--, o--, 0 > o || l[a] !== u[o]) {
								var d = "\n" + l[a].replace(" at new ", " at ");
								return e.displayName && d.includes("<anonymous>") && (d = d.replace("<anonymous>", e.displayName)), typeof e == "function" && ph.set(e, d), d;
							}
						while (1 <= a && 0 <= o);
						break;
					}
				}
			} finally {
				fh = !1, z.H = r, Oe(), Error.prepareStackTrace = n;
			}
			return l = (l = e ? e.displayName || e.name : "") ? Ae(l) : "", typeof e == "function" && ph.set(e, l), l;
		}
		function Me(e, t) {
			switch (e.tag) {
				case 26:
				case 27:
				case 5: return Ae(e.type);
				case 16: return Ae("Lazy");
				case 13: return e.child !== t && t !== null ? Ae("Suspense Fallback") : Ae("Suspense");
				case 19: return Ae("SuspenseList");
				case 0:
				case 15: return je(e.type, !1);
				case 11: return je(e.type.render, !1);
				case 1: return je(e.type, !0);
				case 31: return Ae("Activity");
				case 30: return Ae("ViewTransition");
				default: return "";
			}
		}
		function Ne(e) {
			try {
				var t = "", n = null;
				do {
					t += Me(e, n);
					var r = e._debugInfo;
					if (r) for (var i = r.length - 1; 0 <= i; i--) {
						var a = r[i];
						if (typeof a.name == "string") {
							var o = t;
							a: {
								var s = a.name, c = a.env, l = a.debugLocation;
								if (l != null) {
									var u = ke(l), d = u.lastIndexOf("\n"), f = d === -1 ? u : u.slice(d + 1);
									if (f.indexOf(s) !== -1) {
										var p = "\n" + f;
										break a;
									}
								}
								p = Ae(s + (c ? " [" + c + "]" : ""));
							}
							t = o + p;
						}
					}
					n = e, e = e.return;
				} while (e);
				return t;
			} catch (e) {
				return "\nError generating stack: " + e.message + "\n" + e.stack;
			}
		}
		function Pe(e) {
			return (e = e ? e.displayName || e.name : "") ? Ae(e) : "";
		}
		function Fe() {
			if (mh === null) return null;
			var e = mh._debugOwner;
			return e == null ? null : _e(e);
		}
		function Ie() {
			if (mh === null) return "";
			var e = mh;
			try {
				var t = "";
				switch (e.tag === 6 && (e = e.return), e.tag) {
					case 26:
					case 27:
					case 5:
						t += Ae(e.type);
						break;
					case 13:
						t += Ae("Suspense");
						break;
					case 19:
						t += Ae("SuspenseList");
						break;
					case 31:
						t += Ae("Activity");
						break;
					case 30:
						t += Ae("ViewTransition");
						break;
					case 0:
					case 15:
					case 1:
						e._debugOwner || t !== "" || (t += Pe(e.type));
						break;
					case 11: e._debugOwner || t !== "" || (t += Pe(e.type.render));
				}
				for (; e;) if (typeof e.tag == "number") {
					var n = e;
					e = n._debugOwner;
					var r = n._debugStack;
					if (e && r) {
						var i = ke(r);
						i !== "" && (t += "\n" + i);
					}
				} else if (e.debugStack != null) {
					var a = e.debugStack;
					(e = e.owner) && a && (t += "\n" + ke(a));
				} else break;
				var o = t;
			} catch (e) {
				o = "\nError generating stack: " + e.message + "\n" + e.stack;
			}
			return o;
		}
		function T(e, t, n, r, i, a, o) {
			var s = mh;
			Le(e);
			try {
				return e !== null && e._debugTask ? e._debugTask.run(t.bind(null, n, r, i, a, o)) : t(n, r, i, a, o);
			} finally {
				Le(s);
			}
			throw Error("runWithFiberInDEV should never be called in production. This is a bug in React.");
		}
		function Le(e) {
			z.getCurrentStack = e === null ? null : Ie, hh = !1, mh = e;
		}
		function Re(e) {
			return typeof Symbol == "function" && Symbol.toStringTag && e[Symbol.toStringTag] || e.constructor.name || "Object";
		}
		function ze(e) {
			try {
				return Be(e), !1;
			} catch {
				return !0;
			}
		}
		function Be(e) {
			return "" + e;
		}
		function Ve(e, t) {
			if (ze(e)) return console.error("The provided `%s` attribute is an unsupported type %s. This value must be coerced to a string before using it here.", t, Re(e)), Be(e);
		}
		function He(e, t) {
			if (ze(e)) return console.error("The provided `%s` CSS property is an unsupported type %s. This value must be coerced to a string before using it here.", t, Re(e)), Be(e);
		}
		function Ue(e) {
			if (ze(e)) return console.error("Form field values (value, checked, defaultValue, or defaultChecked props) must be strings, not %s. This value must be coerced to a string before using it here.", Re(e)), Be(e);
		}
		function We(e) {
			if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") return !1;
			var t = __REACT_DEVTOOLS_GLOBAL_HOOK__;
			if (t.isDisabled) return !0;
			if (!t.supportsFiber) return console.error("The installed version of React DevTools is too old and will not work with the current version of React. Please update React DevTools. https://react.dev/link/react-devtools"), !0;
			try {
				Ah = t.inject(e), jh = t;
			} catch (e) {
				console.error("React instrumentation encountered an error: %o.", e);
			}
			return !!t.checkDCE;
		}
		function Ge(e) {
			if (typeof Oh == "function" && kh(e), jh && typeof jh.setStrictMode == "function") try {
				jh.setStrictMode(Ah, e);
			} catch (e) {
				Mh || (Mh = !0, console.error("React instrumentation encountered an error: %o", e));
			}
		}
		function Ke(e) {
			return e >>>= 0, e === 0 ? 32 : 31 - (Fh(e) / Ih | 0) | 0;
		}
		function qe(e) {
			var t = e & 42;
			if (t !== 0) return t;
			switch (e & -e) {
				case 1: return 1;
				case 2: return 2;
				case 4: return 4;
				case 8: return 8;
				case 16: return 16;
				case 32: return 32;
				case 64: return 64;
				case 128: return 128;
				case 256:
				case 512:
				case 1024:
				case 2048:
				case 4096:
				case 8192:
				case 16384:
				case 32768:
				case 65536:
				case 131072: return e & -e;
				case 262144:
				case 524288:
				case 1048576:
				case 2097152: return e & 3932160;
				case 4194304:
				case 8388608:
				case 16777216:
				case 33554432: return e & 62914560;
				case 67108864: return 67108864;
				case 134217728: return 134217728;
				case 268435456: return 268435456;
				case 536870912: return 536870912;
				case 1073741824: return 0;
				default: return console.error("Should have found matching lanes. This is a bug in React."), e;
			}
		}
		function Je(e, t, n) {
			var r = e.pendingLanes;
			if (r === 0) return 0;
			var i = 0, a = e.suspendedLanes, o = e.pingedLanes;
			e = e.warmLanes;
			var s = r & 134217727;
			return s === 0 ? (s = r & ~a, s === 0 ? o === 0 ? n || (n = r & ~e, n !== 0 && (i = qe(n))) : i = qe(o) : i = qe(s)) : (r = s & ~a, r === 0 ? (o &= s, o === 0 ? n || (n = s & ~e, n !== 0 && (i = qe(n))) : i = qe(o)) : i = qe(r)), i === 0 ? 0 : t !== 0 && t !== i && (t & a) === 0 && (a = i & -i, n = t & -t, a >= n || a === 32 && n & 4194048) ? t : i;
		}
		function Ye(e, t) {
			return (e.pendingLanes & ~(e.suspendedLanes & ~e.pingedLanes) & t) === 0;
		}
		function Xe(e, t) {
			t & 8 && (t |= t & 32);
			var n = e.entangledLanes;
			if (n !== 0) for (e = e.entanglements, n &= t; 0 < n;) {
				var r = 31 - Ph(n), i = 1 << r;
				t |= e[r], n &= ~i;
			}
			return t;
		}
		function Ze(e, t) {
			switch (e) {
				case 1:
				case 2:
				case 4:
				case 8:
				case 64: return t + 250;
				case 16:
				case 32:
				case 128:
				case 256:
				case 512:
				case 1024:
				case 2048:
				case 4096:
				case 8192:
				case 16384:
				case 32768:
				case 65536:
				case 131072:
				case 262144:
				case 524288:
				case 1048576:
				case 2097152: return t + 5e3;
				case 4194304:
				case 8388608:
				case 16777216:
				case 33554432: return -1;
				case 67108864:
				case 134217728:
				case 268435456:
				case 536870912:
				case 1073741824: return -1;
				default: return console.error("Should have found matching lanes. This is a bug in React."), -1;
			}
		}
		function Qe() {
			var e = zh;
			return zh <<= 1, !(zh & 62914560) && (zh = 4194304), e;
		}
		function $e(e) {
			for (var t = [], n = 0; 31 > n; n++) t.push(e);
			return t;
		}
		function et(e, t) {
			e.pendingLanes |= t, t !== 268435456 && (e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0);
		}
		function tt(e, t, n, r, i, a) {
			var o = e.pendingLanes;
			e.pendingLanes = n, e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0, e.expiredLanes &= n, e.entangledLanes &= n, e.errorRecoveryDisabledLanes &= n, e.shellSuspendCounter = 0;
			var s = e.entanglements, c = e.expirationTimes, l = e.hiddenUpdates;
			for (n = o & ~n; 0 < n;) {
				var u = 31 - Ph(n), d = 1 << u;
				s[u] = 0, c[u] = -1;
				var f = l[u];
				if (f !== null) for (l[u] = null, u = 0; u < f.length; u++) {
					var p = f[u];
					p !== null && (p.lane &= -536870913);
				}
				n &= ~d;
			}
			r !== 0 && nt(e, r, 0), a !== 0 && i === 0 && e.tag !== 0 && (e.suspendedLanes |= a & ~(o & ~t));
		}
		function nt(e, t, n) {
			e.pendingLanes |= t, e.suspendedLanes &= ~t;
			var r = 31 - Ph(t);
			e.entangledLanes |= t, e.entanglements[r] = e.entanglements[r] | 1073741824 | n & 261930;
		}
		function rt(e, t) {
			var n = e.entangledLanes |= t;
			for (e = e.entanglements; n;) {
				var r = 31 - Ph(n), i = 1 << r;
				i & t | e[r] & t && (e[r] |= t), n &= ~i;
			}
		}
		function it(e, t) {
			var n = t & -t;
			return n = n & 42 ? 1 : at(n), (n & (e.suspendedLanes | t)) === 0 ? n : 0;
		}
		function at(e) {
			switch (e) {
				case 2:
					e = 1;
					break;
				case 8:
					e = 4;
					break;
				case 32:
					e = 16;
					break;
				case 256:
				case 512:
				case 1024:
				case 2048:
				case 4096:
				case 8192:
				case 16384:
				case 32768:
				case 65536:
				case 131072:
				case 262144:
				case 524288:
				case 1048576:
				case 2097152:
				case 4194304:
				case 8388608:
				case 16777216:
				case 33554432:
					e = 128;
					break;
				case 268435456:
					e = 134217728;
					break;
				default: e = 0;
			}
			return e;
		}
		function ot(e, t, n) {
			if (Nh) for (e = e.pendingUpdatersLaneMap; 0 < n;) {
				var r = 31 - Ph(n), i = 1 << r;
				e[r].add(t), n &= ~i;
			}
		}
		function st(e, t) {
			if (Nh) for (var n = e.pendingUpdatersLaneMap, r = e.memoizedUpdaters; 0 < t;) {
				var i = 31 - Ph(t);
				e = 1 << i, i = n[i], 0 < i.size && (i.forEach(function(e) {
					var t = e.alternate;
					t !== null && r.has(t) || r.add(e);
				}), i.clear()), t &= ~e;
			}
		}
		function ct(e) {
			return e &= -e, Bh !== 0 && Bh < e ? Vh !== 0 && Vh < e ? e & 134217727 ? Hh : Uh : Vh : Bh;
		}
		function lt() {
			var e = B.p;
			return e === 0 ? (e = window.event, e === void 0 ? Hh : sm(e.type)) : e;
		}
		function ut(e, t) {
			var n = B.p;
			try {
				return B.p = e, t();
			} finally {
				B.p = n;
			}
		}
		function dt(e) {
			delete e[Gh], delete e[Kh], delete e[Yh], delete e[Xh];
		}
		function ft(e) {
			var t;
			if (t = e[Gh]) return t;
			for (var n = e.parentNode; n;) {
				if (t = n[qh] || n[Gh]) {
					if (n = t.alternate, t.child !== null || n !== null && n.child !== null) for (e = lp(e); e !== null;) {
						if (n = e[Gh]) return n;
						e = lp(e);
					}
					return t;
				}
				e = n, n = e.parentNode;
			}
			return null;
		}
		function pt(e) {
			if (e = e[Gh] || e[qh]) {
				var t = e.tag;
				if (t === 5 || t === 6 || t === 13 || t === 31 || t === 26 || t === 27 || t === 3) return e;
			}
			return null;
		}
		function mt(e) {
			var t = e.tag;
			if (t === 5 || t === 26 || t === 27 || t === 6) return e.stateNode;
			throw Error("getNodeFromInstance: Invalid argument.");
		}
		function ht(e) {
			var t = e[Zh];
			return t ||= e[Zh] = {
				hoistableStyles: /* @__PURE__ */ new Map(),
				hoistableScripts: /* @__PURE__ */ new Map()
			}, t;
		}
		function gt(e) {
			e[Qh] = !0;
		}
		function _t(e) {
			e[$h] = void 0;
		}
		function vt(e, t) {
			yt(e, t), yt(e + "Capture", t);
		}
		function yt(e, t) {
			tg[e] && console.error("EventRegistry: More than one plugin attempted to publish the same registration name, `%s`.", e), tg[e] = t;
			var n = e.toLowerCase();
			for (ng[n] = e, e === "onDoubleClick" && (ng.ondblclick = e), e = 0; e < t.length; e++) eg.add(t[e]);
		}
		function bt(e, t) {
			rg[t.type] || t.onChange || t.onInput || t.readOnly || t.disabled || t.value == null || console.error(e === "select" ? "You provided a `value` prop to a form field without an `onChange` handler. This will render a read-only field. If the field should be mutable use `defaultValue`. Otherwise, set `onChange`." : "You provided a `value` prop to a form field without an `onChange` handler. This will render a read-only field. If the field should be mutable use `defaultValue`. Otherwise, set either `onChange` or `readOnly`."), t.onChange || t.readOnly || t.disabled || t.checked == null || console.error("You provided a `checked` prop to a form field without an `onChange` handler. This will render a read-only field. If the field should be mutable use `defaultChecked`. Otherwise, set either `onChange` or `readOnly`.");
		}
		function xt(e) {
			return gh.call(og, e) ? !0 : gh.call(ag, e) ? !1 : ig.test(e) ? og[e] = !0 : (ag[e] = !0, console.error("Invalid attribute name: `%s`", e), !1);
		}
		function St() {
			var e = V;
			return V = !1, e;
		}
		function Ct(e, t, n) {
			if (xt(t)) {
				if (!e.hasAttribute(t)) {
					switch (typeof n) {
						case "symbol":
						case "object": return n;
						case "function": return n;
						case "boolean": if (!1 === n) return n;
					}
					return n === void 0 ? void 0 : null;
				}
				return e = t.toLowerCase() === "nonce" ? e.nonce : e.getAttribute(t), e === "" && !0 === n || (Ve(n, t), e === "" + n ? n : e);
			}
		}
		function wt(e, t, n) {
			if (xt(t)) {
				if (n === null) e.removeAttribute(t);
				else {
					switch (typeof n) {
						case "undefined":
						case "function":
						case "symbol":
							e.removeAttribute(t);
							return;
						case "boolean":
							var r = t.toLowerCase().slice(0, 5);
							if (r !== "data-" && r !== "aria-") {
								e.removeAttribute(t);
								return;
							}
					}
					Ve(n, t), e.setAttribute(t, n);
				}
			}
		}
		function Tt(e, t, n) {
			if (n === null) e.removeAttribute(t);
			else {
				switch (typeof n) {
					case "undefined":
					case "function":
					case "symbol":
					case "boolean":
						e.removeAttribute(t);
						return;
				}
				Ve(n, t), e.setAttribute(t, n);
			}
		}
		function Et(e, t, n, r) {
			if (r === null) e.removeAttribute(n);
			else {
				switch (typeof r) {
					case "undefined":
					case "function":
					case "symbol":
					case "boolean":
						e.removeAttribute(n);
						return;
				}
				Ve(r, n), e.setAttributeNS(t, n, r);
			}
		}
		function Dt(e) {
			switch (typeof e) {
				case "bigint":
				case "boolean":
				case "number":
				case "string":
				case "undefined": return e;
				case "object": return Ue(e), e;
				default: return "";
			}
		}
		function Ot(e) {
			var t = e.type;
			return (e = e.nodeName) && e.toLowerCase() === "input" && (t === "checkbox" || t === "radio");
		}
		function kt(e, t, n) {
			var r = Object.getOwnPropertyDescriptor(e.constructor.prototype, t);
			if (!e.hasOwnProperty(t) && r !== void 0 && typeof r.get == "function" && typeof r.set == "function") {
				var i = r.get, a = r.set;
				return Object.defineProperty(e, t, {
					configurable: !0,
					get: function() {
						return i.call(this);
					},
					set: function(e) {
						Ue(e), n = "" + e, a.call(this, e);
					}
				}), Object.defineProperty(e, t, { enumerable: r.enumerable }), {
					getValue: function() {
						return n;
					},
					setValue: function(e) {
						Ue(e), n = "" + e;
					},
					stopTracking: function() {
						e._valueTracker = null, delete e[t];
					}
				};
			}
		}
		function At(e) {
			if (!e._valueTracker) {
				var t = Ot(e) ? "checked" : "value";
				e._valueTracker = kt(e, t, "" + e[t]);
			}
		}
		function jt(e) {
			if (!e) return !1;
			var t = e._valueTracker;
			if (!t) return !0;
			var n = t.getValue(), r = "";
			return e && (r = Ot(e) ? e.checked ? "true" : "false" : e.value), e = r, e !== n && (t.setValue(e), !0);
		}
		function Mt(e) {
			return e.replace(sg, function(e) {
				return "\\" + e.charCodeAt(0).toString(16) + " ";
			});
		}
		function Nt(e, t) {
			t.checked === void 0 || t.defaultChecked === void 0 || lg || (console.error("%s contains an input of type %s with both checked and defaultChecked props. Input elements must be either controlled or uncontrolled (specify either the checked prop, or the defaultChecked prop, but not both). Decide between using a controlled or uncontrolled input element and remove one of these props. More info: https://react.dev/link/controlled-components", Fe() || "A component", t.type), lg = !0), t.value === void 0 || t.defaultValue === void 0 || cg || (console.error("%s contains an input of type %s with both value and defaultValue props. Input elements must be either controlled or uncontrolled (specify either the value prop, or the defaultValue prop, but not both). Decide between using a controlled or uncontrolled input element and remove one of these props. More info: https://react.dev/link/controlled-components", Fe() || "A component", t.type), cg = !0);
		}
		function Pt(e, t, n, r, i, a, o, s) {
			e.name = "", o != null && typeof o != "function" && typeof o != "symbol" && typeof o != "boolean" ? (Ve(o, "type"), e.type = o) : e.removeAttribute("type"), t == null ? o !== "submit" && o !== "reset" || e.removeAttribute("value") : o === "number" ? (t === 0 && e.value === "" || e.value != t) && (e.value = "" + Dt(t)) : e.value !== "" + Dt(t) && (e.value = "" + Dt(t)), t == null ? n == null ? r != null && e.removeAttribute("value") : It(e, Dt(n)) : o === "number" && e.value == t ? It(e, Dt(e.value)) : It(e, Dt(t)), i == null && a != null && (e.defaultChecked = !!a), i != null && (e.checked = i && typeof i != "function" && typeof i != "symbol"), s != null && typeof s != "function" && typeof s != "symbol" && typeof s != "boolean" ? (Ve(s, "name"), e.name = "" + Dt(s)) : e.removeAttribute("name");
		}
		function Ft(e, t, n, r, i, a, o, s) {
			if (a != null && typeof a != "function" && typeof a != "symbol" && typeof a != "boolean" && (Ve(a, "type"), e.type = a), t != null || n != null) {
				if (!(a !== "submit" && a !== "reset" || t != null)) {
					At(e);
					return;
				}
				n = n == null ? "" : "" + Dt(n), t = t == null ? n : "" + Dt(t), s || t === e.value || (e.value = t), e.defaultValue = t;
			}
			r ??= i, r = typeof r != "function" && typeof r != "symbol" && !!r, e.checked = s ? e.checked : !!r, e.defaultChecked = !!r, o != null && typeof o != "function" && typeof o != "symbol" && typeof o != "boolean" && (Ve(o, "name"), e.name = o), At(e);
		}
		function It(e, t) {
			e.defaultValue !== "" + t && (e.defaultValue = "" + t);
		}
		function Lt(e, t) {
			t.value ?? (typeof t.children == "object" && t.children !== null ? Cm.Children.forEach(t.children, function(e) {
				e == null || typeof e == "string" || typeof e == "number" || typeof e == "bigint" || dg || (dg = !0, console.error("Cannot infer the option value of complex children. Pass a `value` prop or use a plain string as children to <option>."));
			}) : t.dangerouslySetInnerHTML == null || fg || (fg = !0, console.error("Pass a `value` prop if you set dangerouslyInnerHTML so React knows which value should be selected."))), t.selected == null || ug || (console.error("Use the `defaultValue` or `value` props on <select> instead of setting `selected` on <option>."), ug = !0);
		}
		function Rt() {
			var e = Fe();
			return e ? "\n\nCheck the render method of `" + e + "`." : "";
		}
		function zt(e, t, n, r) {
			if (e = e.options, t) {
				t = {};
				for (var i = 0; i < n.length; i++) t["$" + n[i]] = !0;
				for (n = 0; n < e.length; n++) i = t.hasOwnProperty("$" + e[n].value), e[n].selected !== i && (e[n].selected = i), i && r && (e[n].defaultSelected = !0);
			} else {
				for (n = "" + Dt(n), t = null, i = 0; i < e.length; i++) {
					if (e[i].value === n) {
						e[i].selected = !0, r && (e[i].defaultSelected = !0);
						return;
					}
					t !== null || e[i].disabled || (t = e[i]);
				}
				t !== null && (t.selected = !0);
			}
		}
		function Bt(e, t) {
			for (e = 0; e < mg.length; e++) {
				var n = mg[e];
				if (t[n] != null) {
					var r = qm(t[n]);
					t.multiple && !r ? console.error("The `%s` prop supplied to <select> must be an array if `multiple` is true.%s", n, Rt()) : !t.multiple && r && console.error("The `%s` prop supplied to <select> must be a scalar value if `multiple` is false.%s", n, Rt());
				}
			}
			t.value === void 0 || t.defaultValue === void 0 || pg || (console.error("Select elements must be either controlled or uncontrolled (specify either the value prop, or the defaultValue prop, but not both). Decide between using a controlled or uncontrolled select element and remove one of these props. More info: https://react.dev/link/controlled-components"), pg = !0);
		}
		function Vt(e, t) {
			t.value === void 0 || t.defaultValue === void 0 || hg || (console.error("%s contains a textarea with both value and defaultValue props. Textarea elements must be either controlled or uncontrolled (specify either the value prop, or the defaultValue prop, but not both). Decide between using a controlled or uncontrolled textarea and remove one of these props. More info: https://react.dev/link/controlled-components", Fe() || "A component"), hg = !0), t.children != null && t.value == null && console.error("Use the `defaultValue` or `value` props instead of setting children on <textarea>.");
		}
		function Ht(e, t, n) {
			if (t != null && (t = "" + Dt(t), t !== e.value && (e.value = t), n == null)) {
				e.defaultValue !== t && (e.defaultValue = t);
				return;
			}
			e.defaultValue = n == null ? "" : "" + Dt(n);
		}
		function Ut(e, t, n, r) {
			if (t == null) {
				if (r != null) {
					if (n != null) throw Error("If you supply `defaultValue` on a <textarea>, do not pass children.");
					if (qm(r)) {
						if (1 < r.length) throw Error("<textarea> can only have at most one child.");
						r = r[0];
					}
					n = r;
				}
				n ??= "", t = n;
			}
			n = Dt(t), e.defaultValue = n, r = e.textContent, r === n && r !== "" && r !== null && (e.value = r), At(e);
		}
		function Wt(e, t) {
			return e.serverProps === void 0 && e.serverTail.length === 0 && e.children.length === 1 && 3 < e.distanceFromLeaf && e.distanceFromLeaf > 15 - t ? Wt(e.children[0], t) : e;
		}
		function Gt(e) {
			return "  " + "  ".repeat(e);
		}
		function Kt(e) {
			return "+ " + "  ".repeat(e);
		}
		function qt(e) {
			return "- " + "  ".repeat(e);
		}
		function Jt(e) {
			switch (e.tag) {
				case 26:
				case 27:
				case 5: return e.type;
				case 16: return "Lazy";
				case 31: return "Activity";
				case 13: return "Suspense";
				case 19: return "SuspenseList";
				case 0:
				case 15: return e = e.type, e.displayName || e.name || null;
				case 11: return e = e.type.render, e.displayName || e.name || null;
				case 1: return e = e.type, e.displayName || e.name || null;
				default: return null;
			}
		}
		function Yt(e, t) {
			return gg.test(e) ? (e = JSON.stringify(e), e.length > t - 2 ? 8 > t ? "{\"...\"}" : "{" + e.slice(0, t - 7) + "...\"}" : "{" + e + "}") : e.length > t ? 5 > t ? "{\"...\"}" : e.slice(0, t - 3) + "..." : e;
		}
		function Xt(e, t, n) {
			var r = 120 - 2 * n;
			if (t === null) return Kt(n) + Yt(e, r) + "\n";
			if (typeof t == "string") {
				for (var i = 0; i < t.length && i < e.length && t.charCodeAt(i) === e.charCodeAt(i); i++);
				return i > r - 8 && 10 < i && (e = "..." + e.slice(i - 8), t = "..." + t.slice(i - 8)), Kt(n) + Yt(e, r) + "\n" + qt(n) + Yt(t, r) + "\n";
			}
			return Gt(n) + Yt(e, r) + "\n";
		}
		function Zt(e) {
			return Object.prototype.toString.call(e).replace(/^\[object (.*)\]$/, function(e, t) {
				return t;
			});
		}
		function Qt(e, t) {
			switch (typeof e) {
				case "string": return e = JSON.stringify(e), e.length > t ? 5 > t ? "\"...\"" : e.slice(0, t - 4) + "...\"" : e;
				case "object":
					if (e === null) return "null";
					if (qm(e)) return "[...]";
					if (e.$$typeof === Om) return (t = ge(e.type)) ? "<" + t + ">" : "<...>";
					var n = Zt(e);
					if (n === "Object") {
						for (var r in n = "", t -= 2, e) if (e.hasOwnProperty(r)) {
							var i = JSON.stringify(r);
							if (i !== "\"" + r + "\"" && (r = i), t -= r.length - 2, i = Qt(e[r], 15 > t ? t : 15), t -= i.length, 0 > t) {
								n += n === "" ? "..." : ", ...";
								break;
							}
							n += (n === "" ? "" : ",") + r + ":" + i;
						}
						return "{" + n + "}";
					}
					return n;
				case "function": return (t = e.displayName || e.name) ? "function " + t : "function";
				default: return String(e);
			}
		}
		function $t(e, t) {
			return typeof e != "string" || gg.test(e) ? "{" + Qt(e, t - 2) + "}" : e.length > t - 2 ? 5 > t ? "\"...\"" : "\"" + e.slice(0, t - 5) + "...\"" : "\"" + e + "\"";
		}
		function en(e, t, n) {
			var r = 120 - n.length - e.length, i = [], a;
			for (a in t) if (t.hasOwnProperty(a) && a !== "children") {
				var o = $t(t[a], 120 - n.length - a.length - 1);
				r -= a.length + o.length + 2, i.push(a + "=" + o);
			}
			return i.length === 0 ? n + "<" + e + ">\n" : 0 < r ? n + "<" + e + " " + i.join(" ") + ">\n" : n + "<" + e + "\n" + n + "  " + i.join("\n" + n + "  ") + "\n" + n + ">\n";
		}
		function tn(e, t, n) {
			var r = "", i = R({}, t), a;
			for (a in e) if (e.hasOwnProperty(a)) {
				delete i[a];
				var o = 120 - 2 * n - a.length - 2, s = Qt(e[a], o);
				t.hasOwnProperty(a) ? (o = Qt(t[a], o), r += Kt(n) + a + ": " + s + "\n", r += qt(n) + a + ": " + o + "\n") : r += Kt(n) + a + ": " + s + "\n";
			}
			for (var c in i) i.hasOwnProperty(c) && (e = Qt(i[c], 120 - 2 * n - c.length - 2), r += qt(n) + c + ": " + e + "\n");
			return r;
		}
		function nn(e, t, n, r) {
			var i = "", a = /* @__PURE__ */ new Map();
			for (l in n) n.hasOwnProperty(l) && a.set(l.toLowerCase(), l);
			if (a.size === 1 && a.has("children")) i += en(e, t, Gt(r));
			else {
				for (var o in t) if (t.hasOwnProperty(o) && o !== "children") {
					var s = 120 - 2 * (r + 1) - o.length - 1, c = a.get(o.toLowerCase());
					if (c !== void 0) {
						a.delete(o.toLowerCase());
						var l = t[o];
						c = n[c];
						var u = $t(l, s);
						s = $t(c, s), typeof l == "object" && l && typeof c == "object" && c && Zt(l) === "Object" && Zt(c) === "Object" && (2 < Object.keys(l).length || 2 < Object.keys(c).length || -1 < u.indexOf("...") || -1 < s.indexOf("...")) ? i += Gt(r + 1) + o + "={{\n" + tn(l, c, r + 2) + Gt(r + 1) + "}}\n" : (i += Kt(r + 1) + o + "=" + u + "\n", i += qt(r + 1) + o + "=" + s + "\n");
					} else i += Gt(r + 1) + o + "=" + $t(t[o], s) + "\n";
				}
				a.forEach(function(e) {
					if (e !== "children") {
						var t = 120 - 2 * (r + 1) - e.length - 1;
						i += qt(r + 1) + e + "=" + $t(n[e], t) + "\n";
					}
				}), i = i === "" ? Gt(r) + "<" + e + ">\n" : Gt(r) + "<" + e + "\n" + i + Gt(r) + ">\n";
			}
			return e = n.children, t = t.children, typeof e == "string" || typeof e == "number" || typeof e == "bigint" ? (a = "", (typeof t == "string" || typeof t == "number" || typeof t == "bigint") && (a = "" + t), i += Xt(a, "" + e, r + 1)) : (typeof t == "string" || typeof t == "number" || typeof t == "bigint") && (i = e == null ? i + Xt("" + t, null, r + 1) : i + Xt("" + t, void 0, r + 1)), i;
		}
		function rn(e, t) {
			var n = Jt(e);
			if (n === null) {
				for (n = "", e = e.child; e;) n += rn(e, t), e = e.sibling;
				return n;
			}
			return Gt(t) + "<" + n + ">\n";
		}
		function an(e, t) {
			var n = Wt(e, t);
			if (n !== e && (e.children.length !== 1 || e.children[0] !== n)) return Gt(t) + "...\n" + an(n, t + 1);
			n = "";
			var r = e.fiber._debugInfo;
			if (r) for (var i = 0; i < r.length; i++) {
				var a = r[i].name;
				typeof a == "string" && (n += Gt(t) + "<" + a + ">\n", t++);
			}
			if (r = "", i = e.fiber.pendingProps, e.fiber.tag === 6) r = Xt(i, e.serverProps, t), t++;
			else if (a = Jt(e.fiber), a !== null) {
				if (e.serverProps === void 0) {
					r = t;
					var o = 120 - 2 * r - a.length - 2, s = "";
					for (l in i) if (i.hasOwnProperty(l) && l !== "children") {
						var c = $t(i[l], 15);
						if (o -= l.length + c.length + 2, 0 > o) {
							s += " ...";
							break;
						}
						s += " " + l + "=" + c;
					}
					r = Gt(r) + "<" + a + s + ">\n", t++;
				} else e.serverProps === null ? (r = en(a, i, Kt(t)), t++) : typeof e.serverProps == "string" ? console.error("Should not have matched a non HostText fiber to a Text node. This is a bug in React.") : (r = nn(a, i, e.serverProps, t), t++);
			}
			var l = "";
			for (i = e.fiber.child, a = 0; i && a < e.children.length;) o = e.children[a], o.fiber === i ? (l += an(o, t), a++) : l += rn(i, t), i = i.sibling;
			for (i && 0 < e.children.length && (l += Gt(t) + "...\n"), i = e.serverTail, e.serverProps === null && t--, e = 0; e < i.length; e++) a = i[e], l = typeof a == "string" ? l + (qt(t) + Yt(a, 120 - 2 * t) + "\n") : l + en(a.type, a.props, qt(t));
			return n + r + l;
		}
		function E(e) {
			try {
				return "\n\n" + an(e, 0);
			} catch {
				return "";
			}
		}
		function on(e, t, n) {
			for (var r = t, i = null, a = 0; r;) r === e && (a = 0), i = {
				fiber: r,
				children: i === null ? [] : [i],
				serverProps: r === t ? n : r === e ? null : void 0,
				serverTail: [],
				distanceFromLeaf: a
			}, a++, r = r.return;
			return i === null ? "" : E(i).replaceAll(/^[+-]/gm, ">");
		}
		function sn(e, t) {
			var n = R({}, e || xg), r = { tag: t };
			return vg.indexOf(t) !== -1 && (n.aTagInScope = null, n.buttonTagInScope = null, n.nobrTagInScope = null), yg.indexOf(t) !== -1 && (n.pTagInButtonScope = null), _g.indexOf(t) !== -1 && t !== "address" && t !== "div" && t !== "p" && (n.listItemTagAutoclosing = null, n.dlItemTagAutoclosing = null), n.current = r, t === "form" && (n.formTag = r), t === "a" && (n.aTagInScope = r), t === "button" && (n.buttonTagInScope = r), t === "nobr" && (n.nobrTagInScope = r), t === "p" && (n.pTagInButtonScope = r), t === "li" && (n.listItemTagAutoclosing = r), (t === "dd" || t === "dt") && (n.dlItemTagAutoclosing = r), t === "#document" || t === "html" ? n.containerTagInScope = null : n.containerTagInScope ||= r, e !== null || t !== "#document" && t !== "html" && t !== "body" ? !0 === n.implicitRootScope && (n.implicitRootScope = !1) : n.implicitRootScope = !0, n;
		}
		function cn(e, t, n) {
			switch (t) {
				case "tr": return e === "th" || e === "td" || e === "style" || e === "script" || e === "template";
				case "tbody":
				case "thead":
				case "tfoot": return e === "tr" || e === "style" || e === "script" || e === "template";
				case "colgroup": return e === "col" || e === "template";
				case "table": return e === "caption" || e === "colgroup" || e === "tbody" || e === "tfoot" || e === "thead" || e === "style" || e === "script" || e === "template";
				case "head": return e === "base" || e === "basefont" || e === "bgsound" || e === "link" || e === "meta" || e === "title" || e === "noscript" || e === "noframes" || e === "style" || e === "script" || e === "template";
				case "html":
					if (n) break;
					return e === "head" || e === "body" || e === "frameset";
				case "frameset": return e === "frame";
				case "#document": if (!n) return e === "html";
			}
			switch (e) {
				case "h1":
				case "h2":
				case "h3":
				case "h4":
				case "h5":
				case "h6": return t !== "h1" && t !== "h2" && t !== "h3" && t !== "h4" && t !== "h5" && t !== "h6";
				case "rp":
				case "rt": return bg.indexOf(t) === -1;
				case "caption":
				case "col":
				case "colgroup":
				case "input": return t !== "select";
				case "frameset":
				case "frame":
				case "tbody":
				case "td":
				case "tfoot":
				case "th":
				case "thead":
				case "tr": return t == null;
				case "head": return n || t === null;
				case "html": return n && t === "#document" || t === null;
				case "body": return n && (t === "#document" || t === "html") || t === null;
			}
			return !0;
		}
		function ln(e, t) {
			switch (e) {
				case "address":
				case "article":
				case "aside":
				case "blockquote":
				case "center":
				case "details":
				case "dialog":
				case "dir":
				case "div":
				case "dl":
				case "fieldset":
				case "figcaption":
				case "figure":
				case "footer":
				case "header":
				case "hgroup":
				case "main":
				case "menu":
				case "nav":
				case "ol":
				case "p":
				case "section":
				case "summary":
				case "ul":
				case "pre":
				case "listing":
				case "table":
				case "hr":
				case "xmp":
				case "h1":
				case "h2":
				case "h3":
				case "h4":
				case "h5":
				case "h6": return t.pTagInButtonScope;
				case "form": return t.formTag || t.pTagInButtonScope;
				case "li": return t.listItemTagAutoclosing;
				case "dd":
				case "dt": return t.dlItemTagAutoclosing;
				case "button": return t.buttonTagInScope;
				case "a": return t.aTagInScope;
				case "nobr": return t.nobrTagInScope;
			}
			return null;
		}
		function un(e, t) {
			for (; e;) {
				switch (e.tag) {
					case 5:
					case 26:
					case 27: if (e.type === t) return e;
				}
				e = e.return;
			}
			return null;
		}
		function dn(e, t) {
			t ||= xg;
			var n = t.current;
			if (t = (n = cn(e, n && n.tag, t.implicitRootScope) ? null : n) ? null : ln(e, t), t = n || t, !t) return !0;
			var r = t.tag;
			if (t = String(!!n) + "|" + e + "|" + r, Sg[t]) return !1;
			Sg[t] = !0;
			var i = (t = mh) ? un(t.return, r) : null, a = t !== null && i !== null ? on(i, t, null) : "", o = "<" + e + ">";
			return n ? (n = "", r === "table" && e === "tr" && (n += " Add a <tbody>, <thead> or <tfoot> to your code to match the DOM tree generated by the browser."), console.error("In HTML, %s cannot be a child of <%s>.%s\nThis will cause a hydration error.%s", o, r, n, a)) : console.error("In HTML, %s cannot be a descendant of <%s>.\nThis will cause a hydration error.%s", o, r, a), t && (e = t.return, i === null || e === null || i === e && e._debugOwner === t._debugOwner || T(i, function() {
				console.error("<%s> cannot contain a nested %s.\nSee this log for the ancestor stack trace.", r, o);
			})), !1;
		}
		function fn(e, t, n) {
			if (n || cn("#text", t, !1)) return !0;
			if (n = "#text|" + t, Sg[n]) return !1;
			Sg[n] = !0;
			var r = (n = mh) ? un(n, t) : null;
			return n = n !== null && r !== null ? on(r, n, n.tag === 6 ? null : { children: null }) : "", /\S/.test(e) ? console.error("In HTML, text nodes cannot be a child of <%s>.\nThis will cause a hydration error.%s", t, n) : console.error("In HTML, whitespace text nodes cannot be a child of <%s>. Make sure you don't have any extra whitespace between tags on each line of your source code.\nThis will cause a hydration error.%s", t, n), !1;
		}
		function pn(e, t) {
			if (t) {
				var n = e.firstChild;
				if (n && n === e.lastChild && n.nodeType === 3) {
					n.nodeValue = t;
					return;
				}
			}
			e.textContent = t;
		}
		function mn(e) {
			return e.replace(Og, function(e, t) {
				return t.toUpperCase();
			});
		}
		function hn(e, t, n) {
			var r = t.indexOf("--") === 0;
			r || (-1 < t.indexOf("-") ? Ag.hasOwnProperty(t) && Ag[t] || (Ag[t] = !0, console.error("Unsupported style property %s. Did you mean %s?", t, mn(t.replace(Dg, "ms-")))) : Eg.test(t) ? Ag.hasOwnProperty(t) && Ag[t] || (Ag[t] = !0, console.error("Unsupported vendor-prefixed style property %s. Did you mean %s?", t, t.charAt(0).toUpperCase() + t.slice(1))) : !kg.test(n) || jg.hasOwnProperty(n) && jg[n] || (jg[n] = !0, console.error("Style property values shouldn't contain a semicolon. Try \"%s: %s\" instead.", t, n.replace(kg, ""))), typeof n == "number" && (isNaN(n) ? Mg || (Mg = !0, console.error("`NaN` is an invalid value for the `%s` css style property.", t)) : isFinite(n) || Ng || (Ng = !0, console.error("`Infinity` is an invalid value for the `%s` css style property.", t)))), n == null || typeof n == "boolean" || n === "" ? r ? e.setProperty(t, "") : t === "float" ? e.cssFloat = "" : e[t] = "" : r ? e.setProperty(t, n) : typeof n != "number" || n === 0 || Pg.has(t) ? t === "float" ? e.cssFloat = n : (He(n, t), e[t] = ("" + n).trim()) : e[t] = n + "px";
		}
		function gn(e, t, n) {
			if (t != null && typeof t != "object") throw Error("The `style` prop expects a mapping from style properties to values, not a string. For example, style={{marginRight: spacing + 'em'}} when using JSX.");
			if (t && Object.freeze(t), e = e.style, n != null) {
				if (t) {
					var r = {};
					if (n) {
						for (var i in n) if (n.hasOwnProperty(i) && !t.hasOwnProperty(i)) for (var a = Cg[i] || [i], o = 0; o < a.length; o++) r[a[o]] = i;
					}
					for (var s in t) if (t.hasOwnProperty(s) && (!n || n[s] !== t[s])) for (i = Cg[s] || [s], a = 0; a < i.length; a++) r[i[a]] = s;
					for (var c in s = {}, t) for (i = Cg[c] || [c], a = 0; a < i.length; a++) s[i[a]] = c;
					for (var l in c = {}, r) if (i = r[l], (a = s[l]) && i !== a && (o = i + "," + a, !c[o])) {
						c[o] = !0, o = console;
						var u = t[i];
						o.error.call(o, "%s a style property during rerender (%s) when a conflicting property is set (%s) can lead to styling bugs. To avoid this, don't mix shorthand and non-shorthand properties for the same value; instead, replace the shorthand with separate values.", u == null || typeof u == "boolean" || u === "" ? "Removing" : "Updating", i, a);
					}
				}
				for (var d in n) !n.hasOwnProperty(d) || t != null && t.hasOwnProperty(d) || (d.indexOf("--") === 0 ? e.setProperty(d, "") : d === "float" ? e.cssFloat = "" : e[d] = "", V = !0);
				for (var f in t) l = t[f], t.hasOwnProperty(f) && n[f] !== l && (hn(e, f, l), V = !0);
			} else for (r in t) t.hasOwnProperty(r) && hn(e, r, t[r]);
		}
		function _n(e) {
			if (e.indexOf("-") === -1) return !1;
			switch (e) {
				case "annotation-xml":
				case "color-profile":
				case "font-face":
				case "font-face-src":
				case "font-face-uri":
				case "font-face-format":
				case "font-face-name":
				case "missing-glyph": return !1;
				default: return !0;
			}
		}
		function vn(e) {
			return Lg.get(e) || e;
		}
		function yn(e, t) {
			if (gh.call(Bg, t) && Bg[t]) return !0;
			if (Hg.test(t)) {
				if (e = "aria-" + t.slice(4).toLowerCase(), e = zg.hasOwnProperty(e) ? e : null, e == null) return console.error("Invalid ARIA attribute `%s`. ARIA attributes follow the pattern aria-* and must be lowercase.", t), Bg[t] = !0;
				if (t !== e) return console.error("Invalid ARIA attribute `%s`. Did you mean `%s`?", t, e), Bg[t] = !0;
			}
			if (Vg.test(t)) {
				if (e = t.toLowerCase(), e = zg.hasOwnProperty(e) ? e : null, e == null) return Bg[t] = !0, !1;
				t !== e && (console.error("Unknown ARIA attribute `%s`. Did you mean `%s`?", t, e), Bg[t] = !0);
			}
			return !0;
		}
		function bn(e, t) {
			var n = [], r;
			for (r in t) yn(e, r) || n.push(r);
			t = n.map(function(e) {
				return "`" + e + "`";
			}).join(", "), n.length === 1 ? console.error("Invalid aria prop %s on <%s> tag. For details, see https://react.dev/link/invalid-aria-props", t, e) : 1 < n.length && console.error("Invalid aria props %s on <%s> tag. For details, see https://react.dev/link/invalid-aria-props", t, e);
		}
		function xn(e, t, n, r) {
			if (gh.call(Wg, t) && Wg[t]) return !0;
			var i = t.toLowerCase();
			if (i === "onfocusin" || i === "onfocusout") return console.error("React uses onFocus and onBlur instead of onFocusIn and onFocusOut. All React events are normalized to bubble, so onFocusIn and onFocusOut are not needed/supported by React."), Wg[t] = !0;
			if (typeof n == "function" && (e === "form" && t === "action" || e === "input" && t === "formAction" || e === "button" && t === "formAction")) return !0;
			if (r != null) {
				if (e = r.possibleRegistrationNames, r.registrationNameDependencies.hasOwnProperty(t)) return !0;
				if (r = e.hasOwnProperty(i) ? e[i] : null, r != null) return console.error("Invalid event handler property `%s`. Did you mean `%s`?", t, r), Wg[t] = !0;
				if (Gg.test(t)) return console.error("Unknown event handler property `%s`. It will be ignored.", t), Wg[t] = !0;
			} else if (Gg.test(t)) return Kg.test(t) && console.error("Invalid event handler property `%s`. React events use the camelCase naming convention, for example `onClick`.", t), Wg[t] = !0;
			if (qg.test(t) || Jg.test(t)) return !0;
			if (i === "innerhtml") return console.error("Directly setting property `innerHTML` is not permitted. For more information, lookup documentation on `dangerouslySetInnerHTML`."), Wg[t] = !0;
			if (i === "aria") return console.error("The `aria` attribute is reserved for future use in React. Pass individual `aria-` attributes instead."), Wg[t] = !0;
			if (i === "is" && n != null && typeof n != "string") return console.error("Received a `%s` for a string attribute `is`. If this is expected, cast the value to a string.", typeof n), Wg[t] = !0;
			if (typeof n == "number" && isNaN(n)) return console.error("Received NaN for the `%s` attribute. If this is expected, cast the value to a string.", t), Wg[t] = !0;
			if (Rg.hasOwnProperty(i)) {
				if (i = Rg[i], i !== t) return console.error("Invalid DOM property `%s`. Did you mean `%s`?", t, i), Wg[t] = !0;
			} else if (t !== i) return console.error("React does not recognize the `%s` prop on a DOM element. If you intentionally want it to appear in the DOM as a custom attribute, spell it as lowercase `%s` instead. If you accidentally passed it from a parent component, remove it from the DOM element.", t, i), Wg[t] = !0;
			switch (t) {
				case "dangerouslySetInnerHTML":
				case "children":
				case "style":
				case "suppressContentEditableWarning":
				case "suppressHydrationWarning":
				case "defaultValue":
				case "defaultChecked":
				case "innerHTML":
				case "ref": return !0;
				case "innerText":
				case "textContent": return !0;
			}
			switch (typeof n) {
				case "boolean": switch (t) {
					case "autoFocus":
					case "checked":
					case "multiple":
					case "muted":
					case "selected":
					case "contentEditable":
					case "spellCheck":
					case "draggable":
					case "value":
					case "autoReverse":
					case "externalResourcesRequired":
					case "focusable":
					case "preserveAlpha":
					case "allowFullScreen":
					case "async":
					case "autoPlay":
					case "controls":
					case "credentialless":
					case "default":
					case "defer":
					case "disabled":
					case "disablePictureInPicture":
					case "disableRemotePlayback":
					case "formNoValidate":
					case "hidden":
					case "loop":
					case "noModule":
					case "noValidate":
					case "open":
					case "playsInline":
					case "readOnly":
					case "required":
					case "reversed":
					case "scoped":
					case "seamless":
					case "itemScope":
					case "capture":
					case "download":
					case "inert": return !0;
					default: return i = t.toLowerCase().slice(0, 5), i === "data-" || i === "aria-" || (n ? console.error("Received `%s` for a non-boolean attribute `%s`.\n\nIf you want to write it to the DOM, pass a string instead: %s=\"%s\" or %s={value.toString()}.", n, t, t, n, t) : console.error("Received `%s` for a non-boolean attribute `%s`.\n\nIf you want to write it to the DOM, pass a string instead: %s=\"%s\" or %s={value.toString()}.\n\nIf you used to conditionally omit it with %s={condition && value}, pass %s={condition ? value : undefined} instead.", n, t, t, n, t, t, t), Wg[t] = !0);
				}
				case "function":
				case "symbol": return Wg[t] = !0, !1;
				case "string": if (n === "false" || n === "true") {
					switch (t) {
						case "checked":
						case "selected":
						case "multiple":
						case "muted":
						case "allowFullScreen":
						case "async":
						case "autoPlay":
						case "controls":
						case "credentialless":
						case "default":
						case "defer":
						case "disabled":
						case "disablePictureInPicture":
						case "disableRemotePlayback":
						case "formNoValidate":
						case "hidden":
						case "loop":
						case "noModule":
						case "noValidate":
						case "open":
						case "playsInline":
						case "readOnly":
						case "required":
						case "reversed":
						case "scoped":
						case "seamless":
						case "itemScope":
						case "inert": break;
						default: return !0;
					}
					console.error("Received the string `%s` for the boolean attribute `%s`. %s Did you mean %s={%s}?", n, t, n === "false" ? "The browser will interpret it as a truthy value." : "Although this works, it will not work as expected if you pass the string \"false\".", t, n), Wg[t] = !0;
				}
			}
			return !0;
		}
		function Sn(e, t, n) {
			var r = [], i;
			for (i in t) xn(e, i, t[i], n) || r.push(i);
			t = r.map(function(e) {
				return "`" + e + "`";
			}).join(", "), r.length === 1 ? console.error("Invalid value for prop %s on <%s> tag. Either remove it from the element, or pass a string or number value to keep it in the DOM. For details, see https://react.dev/link/attribute-behavior ", t, e) : 1 < r.length && console.error("Invalid values for props %s on <%s> tag. Either remove them from the element, or pass a string or number value to keep them in the DOM. For details, see https://react.dev/link/attribute-behavior ", t, e);
		}
		function Cn(e) {
			return Yg.test("" + e) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : e;
		}
		function wn() {}
		function Tn(e) {
			return e = e.target || e.srcElement || window, e.correspondingUseElement && (e = e.correspondingUseElement), e.nodeType === 3 ? e.parentNode : e;
		}
		function En(e) {
			var t = pt(e);
			if (t && (e = t.stateNode)) {
				var n = e[Kh] || null;
				a: switch (e = t.stateNode, t.type) {
					case "input":
						if (Pt(e, n.value, n.defaultValue, n.defaultValue, n.checked, n.defaultChecked, n.type, n.name), t = n.name, n.type === "radio" && t != null) {
							for (n = e; n.parentNode;) n = n.parentNode;
							for (Ve(t, "name"), n = n.querySelectorAll("input[name=\"" + Mt("" + t) + "\"][type=\"radio\"]"), t = 0; t < n.length; t++) {
								var r = n[t];
								if (r !== e && r.form === e.form) {
									var i = r[Kh] || null;
									if (!i) throw Error("ReactDOMInput: Mixing React and non-React radio inputs with the same `name` is not supported.");
									Pt(r, i.value, i.defaultValue, i.defaultValue, i.checked, i.defaultChecked, i.type, i.name);
								}
							}
							for (t = 0; t < n.length; t++) r = n[t], r.form === e.form && jt(r);
						}
						break a;
					case "textarea":
						Ht(e, n.value, n.defaultValue);
						break a;
					case "select": t = n.value, t != null && zt(e, !!n.multiple, t, !1);
				}
			}
		}
		function Dn(e, t, n) {
			if ($g) return e(t, n);
			$g = !0;
			try {
				return e(t);
			} finally {
				if ($g = !1, (Zg !== null || Qg !== null) && (du(), Zg && (t = Zg, e = Qg, Qg = Zg = null, En(t), e))) for (t = 0; t < e.length; t++) En(e[t]);
			}
		}
		function On(e, t) {
			var n = e.stateNode;
			if (n === null) return null;
			var r = n[Kh] || null;
			if (r === null) return null;
			n = r[t];
			a: switch (t) {
				case "onClick":
				case "onClickCapture":
				case "onDoubleClick":
				case "onDoubleClickCapture":
				case "onMouseDown":
				case "onMouseDownCapture":
				case "onMouseMove":
				case "onMouseMoveCapture":
				case "onMouseUp":
				case "onMouseUpCapture":
				case "onMouseEnter":
					(r = !r.disabled) || (e = e.type, r = e !== "button" && e !== "input" && e !== "select" && e !== "textarea"), e = !r;
					break a;
				default: e = !1;
			}
			if (e) return null;
			if (n && typeof n != "function") throw Error("Expected `" + t + "` listener to be a function, instead got a value of `" + typeof n + "` type.");
			return n;
		}
		function kn() {
			if (a_) return a_;
			var e, t = i_, n = t.length, r, i = "value" in r_ ? r_.value : r_.textContent, a = i.length;
			for (e = 0; e < n && t[e] === i[e]; e++);
			var o = n - e;
			for (r = 1; r <= o && t[n - r] === i[a - r]; r++);
			return a_ = i.slice(e, 1 < r ? 1 - r : void 0);
		}
		function An(e) {
			var t = e.keyCode;
			return "charCode" in e ? (e = e.charCode, e === 0 && t === 13 && (e = 13)) : e = t, e === 10 && (e = 13), 32 <= e || e === 13 ? e : 0;
		}
		function jn() {
			return !0;
		}
		function Mn() {
			return !1;
		}
		function Nn(e) {
			function t(t, n, r, i, a) {
				for (var o in this._reactName = t, this._targetInst = r, this.type = n, this.nativeEvent = i, this.target = a, this.currentTarget = null, e) e.hasOwnProperty(o) && (t = e[o], this[o] = t ? t(i) : i[o]);
				return this.isDefaultPrevented = (i.defaultPrevented == null ? !1 === i.returnValue : i.defaultPrevented) ? jn : Mn, this.isPropagationStopped = Mn, this;
			}
			return R(t.prototype, {
				preventDefault: function() {
					this.defaultPrevented = !0;
					var e = this.nativeEvent;
					e && (e.preventDefault ? e.preventDefault() : typeof e.returnValue != "unknown" && (e.returnValue = !1), this.isDefaultPrevented = jn);
				},
				stopPropagation: function() {
					var e = this.nativeEvent;
					e && (e.stopPropagation ? e.stopPropagation() : typeof e.cancelBubble != "unknown" && (e.cancelBubble = !0), this.isPropagationStopped = jn);
				},
				persist: function() {},
				isPersistent: jn
			}), t;
		}
		function Pn(e) {
			var t = this.nativeEvent;
			return t.getModifierState ? t.getModifierState(e) : (e = C_[e]) ? !!t[e] : !1;
		}
		function Fn() {
			return Pn;
		}
		function In(e, t) {
			switch (e) {
				case "keyup": return j_.indexOf(t.keyCode) !== -1;
				case "keydown": return t.keyCode !== M_;
				case "keypress":
				case "mousedown":
				case "focusout": return !0;
				default: return !1;
			}
		}
		function Ln(e) {
			return e = e.detail, typeof e == "object" && "data" in e ? e.data : null;
		}
		function Rn(e, t) {
			switch (e) {
				case "compositionend": return Ln(t);
				case "keypress": return t.which === L_ ? (z_ = !0, R_) : null;
				case "textInput": return e = t.data, e === R_ && z_ ? null : e;
				default: return null;
			}
		}
		function zn(e, t) {
			if (B_) return e === "compositionend" || !N_ && In(e, t) ? (e = kn(), a_ = i_ = r_ = null, B_ = !1, e) : null;
			switch (e) {
				case "paste": return null;
				case "keypress":
					if (!(t.ctrlKey || t.altKey || t.metaKey) || t.ctrlKey && t.altKey) {
						if (t.char && 1 < t.char.length) return t.char;
						if (t.which) return String.fromCharCode(t.which);
					}
					return null;
				case "compositionend": return I_ && t.locale !== "ko" ? null : t.data;
				default: return null;
			}
		}
		function Bn(e) {
			var t = e && e.nodeName && e.nodeName.toLowerCase();
			return t === "input" ? !!V_[e.type] : t === "textarea";
		}
		function Vn(e) {
			if (!e_) return !1;
			e = "on" + e;
			var t = e in document;
			return t ||= (t = document.createElement("div"), t.setAttribute(e, "return;"), typeof t[e] == "function"), t;
		}
		function Hn(e, t, n, r) {
			Zg ? Qg ? Qg.push(r) : Qg = [r] : Zg = r, t = xd(t, "onChange"), 0 < t.length && (n = new s_("onChange", "change", null, n, r), e.push({
				event: n,
				listeners: t
			}));
		}
		function Un(e) {
			hd(e, 0);
		}
		function Wn(e) {
			if (jt(mt(e))) return e;
		}
		function Gn(e, t) {
			if (e === "change") return t;
		}
		function Kn() {
			H_ && (H_.detachEvent("onpropertychange", qn), U_ = H_ = null);
		}
		function qn(e) {
			if (e.propertyName === "value" && Wn(U_)) {
				var t = [];
				Hn(t, U_, e, Tn(e)), Dn(Un, t);
			}
		}
		function Jn(e, t, n) {
			e === "focusin" ? (Kn(), H_ = t, U_ = n, H_.attachEvent("onpropertychange", qn)) : e === "focusout" && Kn();
		}
		function Yn(e) {
			if (e === "selectionchange" || e === "keyup" || e === "keydown") return Wn(U_);
		}
		function Xn(e, t) {
			if (e === "click") return Wn(t);
		}
		function Zn(e, t) {
			if (e === "input" || e === "change") return Wn(t);
		}
		function Qn(e, t) {
			return e === t && (e !== 0 || 1 / e == 1 / t) || e !== e && t !== t;
		}
		function $n(e, t) {
			if (G_(e, t)) return !0;
			if (typeof e != "object" || !e || typeof t != "object" || !t) return !1;
			var n = Object.keys(e), r = Object.keys(t);
			if (n.length !== r.length) return !1;
			for (r = 0; r < n.length; r++) {
				var i = n[r];
				if (!gh.call(t, i) || !G_(e[i], t[i])) return !1;
			}
			return !0;
		}
		function er(e) {
			if (e ||= typeof document < "u" ? document : void 0, e === void 0) return null;
			try {
				return e.activeElement || e.body;
			} catch {
				return e.body;
			}
		}
		function tr(e) {
			for (; e && e.firstChild;) e = e.firstChild;
			return e;
		}
		function nr(e, t) {
			var n = tr(e);
			e = 0;
			for (var r; n;) {
				if (n.nodeType === 3) {
					if (r = e + n.textContent.length, e <= t && r >= t) return {
						node: n,
						offset: t - e
					};
					e = r;
				}
				a: {
					for (; n;) {
						if (n.nextSibling) {
							n = n.nextSibling;
							break a;
						}
						n = n.parentNode;
					}
					n = void 0;
				}
				n = tr(n);
			}
		}
		function rr(e, t) {
			return e && t ? e === t ? !0 : e && e.nodeType === 3 ? !1 : t && t.nodeType === 3 ? rr(e, t.parentNode) : "contains" in e ? e.contains(t) : e.compareDocumentPosition ? !!(e.compareDocumentPosition(t) & 16) : !1 : !1;
		}
		function ir(e) {
			e = e != null && e.ownerDocument != null && e.ownerDocument.defaultView != null ? e.ownerDocument.defaultView : window;
			for (var t = er(e.document); t instanceof e.HTMLIFrameElement;) {
				try {
					var n = typeof t.contentWindow.location.href == "string";
				} catch {
					n = !1;
				}
				if (n) e = t.contentWindow;
				else break;
				t = er(e.document);
			}
			return t;
		}
		function ar(e) {
			var t = e && e.nodeName && e.nodeName.toLowerCase();
			return t && (t === "input" && (e.type === "text" || e.type === "search" || e.type === "tel" || e.type === "url" || e.type === "password") || t === "textarea" || e.contentEditable === "true");
		}
		function or(e, t, n) {
			var r = n.window === n ? n.document : n.nodeType === 9 ? n : n.ownerDocument;
			X_ || q_ == null || q_ !== er(r) || (r = q_, "selectionStart" in r && ar(r) ? r = {
				start: r.selectionStart,
				end: r.selectionEnd
			} : (r = (r.ownerDocument && r.ownerDocument.defaultView || window).getSelection(), r = {
				anchorNode: r.anchorNode,
				anchorOffset: r.anchorOffset,
				focusNode: r.focusNode,
				focusOffset: r.focusOffset
			}), Y_ && $n(Y_, r) || (Y_ = r, r = xd(J_, "onSelect"), 0 < r.length && (t = new s_("onSelect", "select", null, t, n), e.push({
				event: t,
				listeners: r
			}), t.target = q_)));
		}
		function sr(e, t) {
			var n = {};
			return n[e.toLowerCase()] = t.toLowerCase(), n["Webkit" + e] = "webkit" + t, n["Moz" + e] = "moz" + t, n;
		}
		function cr(e) {
			if (Q_[e]) return Q_[e];
			if (!Z_[e]) return e;
			var t = Z_[e], n;
			for (n in t) if (t.hasOwnProperty(n) && n in $_) return Q_[e] = t[n];
			return e;
		}
		function lr(e, t) {
			sv.set(e, t), vt(t, [e]);
		}
		function ur(e, t) {
			if (e.name != null && e.name !== "auto") return e.name;
			if (t.autoName !== null) return t.autoName;
			e = iw.identifierPrefix;
			var n = lv++;
			return e = "_" + e + "t_" + n.toString(32) + "_", t.autoName = e;
		}
		function dr(e) {
			if (e == null || typeof e == "string") return e;
			var t = null, n = pw;
			if (n !== null) for (var r = 0; r < n.length; r++) {
				var i = e[n[r]];
				if (i != null) {
					if (i === "none") return "none";
					t = t == null ? i : t + (" " + i);
				}
			}
			return t ?? e.default;
		}
		function fr(e, t) {
			return e = dr(e), t = dr(t), t == null ? e === "auto" ? null : e : t === "auto" ? null : t;
		}
		function pr(e) {
			for (var t = gv, n = 0; n < e.length && n < bv; n++) {
				var r = e[n];
				if (typeof r == "object" && r) {
					if (qm(r) && r.length === 2 && typeof r[0] == "string") {
						if (t !== gv && t !== yv) return _v;
						t = yv;
					} else return _v;
				} else {
					if (typeof r == "function" || typeof r == "string" && 50 < r.length || t !== gv && t !== vv || typeof r == "bigint") return _v;
					t = vv;
				}
			}
			return t;
		}
		function mr(e, t, n, r) {
			if (!ArrayBuffer.isView(e)) {
				var i = 0, a;
				for (a in e) if (gh.call(e, a) && a[0] !== "_" && (i++, gr(a, e[a], t, n, r), i >= bv)) {
					t.push([r + "\xA0\xA0".repeat(n) + "Only " + bv + " properties are shown. React will not log more properties of this object.", ""]);
					break;
				}
			}
		}
		function hr(e) {
			return "$$typeof" in e && gh.call(e, "$$typeof") ? e.$$typeof : void 0;
		}
		function gr(e, t, n, r, i) {
			switch (typeof t) {
				case "object":
					if (t === null) {
						t = "null";
						break;
					}
					if (hr(t) === Om) {
						var a = ge(t.type) || "…", o = t.key;
						t = t.props;
						var s = Object.keys(t), c = s.length;
						if (o == null && c === 0) {
							t = "<" + a + " />";
							break;
						}
						if (3 > r || c === 1 && s[0] === "children" && o == null) {
							t = "<" + a + " … />";
							break;
						}
						for (var l in n.push([i + "\xA0\xA0".repeat(r) + e, "<" + a]), o !== null && gr("key", o, n, r + 1, i), e = !1, o = 0, t) if (o++, l === "children" ? t.children != null && (!qm(t.children) || 0 < t.children.length) && (e = !0) : gh.call(t, l) && l[0] !== "_" && gr(l, t[l], n, r + 1, i), o >= bv) break;
						n.push(["", e ? ">…</" + a + ">" : "/>"]);
						return;
					}
					if (a = Object.prototype.toString.call(t), a = a.slice(8, a.length - 1), ArrayBuffer.isView(t)) {
						t = t.length, t = typeof t == "number" ? a + "(" + t + ")" : a;
						break;
					}
					if (a === "Array") {
						if (l = t.length > bv, o = pr(t), o === vv || o === gv) {
							t = JSON.stringify(l ? t.slice(0, bv).concat("…") : t);
							break;
						}
						if (o === yv) {
							for (n.push([i + "\xA0\xA0".repeat(r) + e, ""]), e = 0; e < t.length && e < bv; e++) a = t[e], gr(a[0], a[1], n, r + 1, i);
							l && gr(bv.toString(), "…", n, r + 1, i);
							return;
						}
					}
					if (a === "Promise") {
						if (t.status === "fulfilled") {
							if (a = n.length, gr(e, t.value, n, r, i), n.length > a) {
								n = n[a], n[1] = "Promise<" + (n[1] || "Object") + ">";
								return;
							}
						} else if (t.status === "rejected" && (a = n.length, gr(e, t.reason, n, r, i), n.length > a)) {
							n = n[a], n[1] = "Rejected Promise<" + n[1] + ">";
							return;
						}
						n.push(["\xA0\xA0".repeat(r) + e, "Promise"]);
						return;
					}
					a === "Object" && (l = Object.getPrototypeOf(t)) && typeof l.constructor == "function" && (a = l.constructor.name), n.push([i + "\xA0\xA0".repeat(r) + e, a === "Object" ? 3 > r ? "" : "…" : a]), 3 > r && mr(t, n, r + 1, i);
					return;
				case "function":
					t = t.name, t = t === "" || typeof t != "string" ? "() => {}" : t + "() {}";
					break;
				case "string":
					t = t === hv ? "…" : JSON.stringify(1024 <= t.length ? t.slice(0, 1023) + "…" : t);
					break;
				case "undefined":
					t = "undefined";
					break;
				case "boolean":
					t = t ? "true" : "false";
					break;
				default: t = String(t);
			}
			n.push([i + "\xA0\xA0".repeat(r) + e, t]);
		}
		function _r(e, t, n, r) {
			var i = !0, a = 0;
			for (s in e) {
				if (a > bv) {
					n.push(["Previous object has more than " + bv + " properties. React will not attempt to diff objects with too many properties.", ""]), i = !1;
					break;
				}
				s in t || (n.push([xv + "\xA0\xA0".repeat(r) + s, "…"]), i = !1), a++;
			}
			for (var o in a = 0, t) {
				if (a > bv) {
					n.push(["Next object has more than " + bv + " properties. React will not attempt to diff objects with too many properties.", ""]), i = !1;
					break;
				}
				if (o in e) {
					var s = e[o], c = t[o];
					if (s !== c) {
						if (r === 0 && o === "children") {
							i = "\xA0\xA0".repeat(r) + o, n.push([xv + i, "…"], [Sv + i, "…"]), i = !1;
							continue;
						}
						if (!(3 <= r)) {
							if (typeof s == "object" && typeof c == "object" && s !== null && c !== null && hr(s) === hr(c)) {
								if (hr(c) === Om) {
									if (s.type === c.type && s.key === c.key) {
										s = ge(c.type) || "…", i = "\xA0\xA0".repeat(r) + o, s = "<" + s + " … />", n.push([xv + i, s], [Sv + i, s]), i = !1;
										continue;
									}
								} else {
									var l = Object.prototype.toString.call(s), u = Object.prototype.toString.call(c);
									if (l === u && (u === "[object Object]" || u === "[object Array]")) {
										l = [Cv + "\xA0\xA0".repeat(r) + o, u === "[object Array]" ? "Array" : ""], n.push(l), u = n.length, _r(s, c, n, r + 1) ? u === n.length && (l[1] = "Referentially unequal but deeply equal objects. Consider memoization.") : i = !1;
										continue;
									}
								}
							} else if (typeof s == "function" && typeof c == "function" && s.name === c.name && s.length === c.length && (l = Function.prototype.toString.call(s), u = Function.prototype.toString.call(c), l === u)) {
								s = c.name === "" ? "() => {}" : c.name + "() {}", n.push([Cv + "\xA0\xA0".repeat(r) + o, s + " Referentially unequal function closure. Consider memoization."]);
								continue;
							}
						}
						gr(o, s, n, r, xv), gr(o, c, n, r, Sv), i = !1;
					}
				} else n.push([Sv + "\xA0\xA0".repeat(r) + o, "…"]), i = !1;
				a++;
			}
			return i;
		}
		function vr(e) {
			U = e & 63 ? "Blocking" : e & 64 ? "Gesture" : e & 4194176 ? "Transition" : e & 62914560 ? "Suspense" : e & 2080374784 ? "Idle" : "Other";
		}
		function yr(e, t, n, r) {
			wv && (Ov.start = t, Ov.end = n, Dv.color = "warning", Dv.tooltipText = r, Dv.properties = null, (e = e._debugTask) ? e.run(performance.measure.bind(performance, r, Ov)) : performance.measure(r, Ov), performance.clearMeasures(r));
		}
		function br(e, t, n) {
			yr(e, t, n, "Reconnect");
		}
		function xr(e, t, n, r, i) {
			var a = C(e);
			if (a !== null && wv) {
				var o = e.alternate, s = e.actualDuration;
				if (o === null || o.child !== e.child) for (var c = e.child; c !== null; c = c.sibling) s -= c.actualDuration;
				s = .5 > s ? r ? "tertiary-light" : "primary-light" : 10 > s ? r ? "tertiary" : "primary" : 100 > s ? r ? "tertiary-dark" : "primary-dark" : "error";
				var l = e.memoizedProps;
				r = e._debugTask, l !== null && o !== null && o.memoizedProps !== l ? (c = [kv], l = _r(o.memoizedProps, l, c, 0), 1 < c.length ? (l && !Ev && (o.lanes & i) === 0 && 100 < e.actualDuration ? (Ev = !0, c[0] = jv, Dv.color = "warning", Dv.tooltipText = Av) : (Dv.color = s, Dv.tooltipText = a), Dv.properties = c, Ov.start = t, Ov.end = n, e = "​" + a, r == null ? performance.measure(e, Ov) : r.run(performance.measure.bind(performance, e, Ov)), performance.clearMeasures(e)) : r == null ? console.timeStamp(a, t, n, Tv, void 0, s) : r.run(console.timeStamp.bind(console, a, t, n, Tv, void 0, s))) : r == null ? console.timeStamp(a, t, n, Tv, void 0, s) : r.run(console.timeStamp.bind(console, a, t, n, Tv, void 0, s));
			}
		}
		function Sr(e, t, n, r) {
			if (wv) {
				var i = C(e);
				if (i !== null) {
					for (var a = null, o = [], s = 0; s < r.length; s++) {
						var c = r[s];
						a == null && c.source !== null && (a = c.source._debugTask), c = c.value, o.push(["Error", typeof c == "object" && c && typeof c.message == "string" ? String(c.message) : String(c)]);
					}
					e.key !== null && gr("key", e.key, o, 0, ""), e.memoizedProps !== null && mr(e.memoizedProps, o, 0, ""), a ??= e._debugTask, e = {
						start: t,
						end: n,
						detail: { devtools: {
							color: "error",
							track: Tv,
							tooltipText: e.tag === 13 ? "Hydration failed" : "Error boundary caught an error",
							properties: o
						} }
					}, i = "​" + i, a ? a.run(performance.measure.bind(performance, i, e)) : performance.measure(i, e), performance.clearMeasures(i);
				}
			}
		}
		function Cr(e, t, n, r, i) {
			if (i !== null) {
				if (wv) {
					var a = C(e);
					if (a !== null) {
						r = [];
						for (var o = 0; o < i.length; o++) {
							var s = i[o].value;
							r.push(["Error", typeof s == "object" && s && typeof s.message == "string" ? String(s.message) : String(s)]);
						}
						e.key !== null && gr("key", e.key, r, 0, ""), e.memoizedProps !== null && mr(e.memoizedProps, r, 0, ""), t = {
							start: t,
							end: n,
							detail: { devtools: {
								color: "error",
								track: Tv,
								tooltipText: "A lifecycle or effect errored",
								properties: r
							} }
						}, e = e._debugTask, n = "​" + a, e ? e.run(performance.measure.bind(performance, n, t)) : performance.measure(n, t), performance.clearMeasures(n);
					}
				}
			} else a = C(e), a !== null && wv && (i = 1 > r ? "secondary-light" : 100 > r ? "secondary" : 500 > r ? "secondary-dark" : "error", (e = e._debugTask) ? e.run(console.timeStamp.bind(console, a, t, n, Tv, void 0, i)) : console.timeStamp(a, t, n, Tv, void 0, i));
		}
		function wr(e, t, n, r) {
			!wv || t <= e || (n = (n & 738197653) === n ? "tertiary-dark" : "primary-dark", r ? r.run(console.timeStamp.bind(console, "Prewarm", e, t, U, H, n)) : console.timeStamp("Prewarm", e, t, U, H, n));
		}
		function Tr(e, t, n, r) {
			!wv || t <= e || (n = (n & 738197653) === n ? "tertiary-dark" : "primary-dark", r ? r.run(console.timeStamp.bind(console, "Suspended", e, t, U, H, n)) : console.timeStamp("Suspended", e, t, U, H, n));
		}
		function Er(e, t, n, r) {
			!wv || t <= e || (r ? r.run(console.timeStamp.bind(console, "Errored", e, t, U, H, "error")) : console.timeStamp("Errored", e, t, U, H, "error"));
		}
		function Dr(e, t, n, r) {
			!wv || t <= e || (r ? r.run(console.timeStamp.bind(console, n, e, t, U, H, "secondary-light")) : console.timeStamp(n, e, t, U, H, "secondary-light"));
		}
		function Or(e, t, n, r, i) {
			if (wv && !(t <= e)) {
				for (var a = [], o = 0; o < n.length; o++) {
					var s = n[o].value;
					a.push(["Error", typeof s == "object" && s && typeof s.message == "string" ? String(s.message) : String(s)]);
				}
				e = {
					start: e,
					end: t,
					detail: { devtools: {
						color: "error",
						track: U,
						trackGroup: H,
						tooltipText: r ? "Remaining Effects Errored" : "Commit Errored",
						properties: a
					} }
				}, i ? i.run(performance.measure.bind(performance, "Errored", e)) : performance.measure("Errored", e), performance.clearMeasures("Errored");
			}
		}
		function kr(e, t, n, r, i) {
			n === null ? !wv || t <= e || (i ? i.run(console.timeStamp.bind(console, r ? "Commit Interrupted View Transition" : "Commit", e, t, U, H, r ? "error" : "secondary-dark")) : console.timeStamp(r ? "Commit Interrupted View Transition" : "Commit", e, t, U, H, r ? "error" : "secondary-dark")) : Or(e, t, n, !1, i);
		}
		function Ar(e, t, n) {
			!wv || t <= e || (n ? n.run(console.timeStamp.bind(console, "Animating", e, t, U, H, "secondary-dark")) : console.timeStamp("Animating", e, t, U, H, "secondary-dark"));
		}
		function jr() {
			for (var e = Fv, t = Iv = Fv = 0; t < e;) {
				var n = Pv[t];
				Pv[t++] = null;
				var r = Pv[t];
				Pv[t++] = null;
				var i = Pv[t];
				Pv[t++] = null;
				var a = Pv[t];
				if (Pv[t++] = null, r !== null && i !== null) {
					var o = r.pending;
					o === null ? i.next = i : (i.next = o.next, o.next = i), r.pending = i;
				}
				a !== 0 && Fr(n, i, a);
			}
		}
		function Mr(e, t, n, r) {
			Pv[Fv++] = e, Pv[Fv++] = t, Pv[Fv++] = n, Pv[Fv++] = r, Iv |= r, e.lanes |= r, e = e.alternate, e !== null && (e.lanes |= r);
		}
		function Nr(e, t, n, r) {
			return Mr(e, t, n, r), Ir(e);
		}
		function Pr(e, t) {
			return Mr(e, null, null, t), Ir(e);
		}
		function Fr(e, t, n) {
			e.lanes |= n;
			var r = e.alternate;
			r !== null && (r.lanes |= n);
			for (var i = !1, a = e.return; a !== null;) a.childLanes |= n, r = a.alternate, r !== null && (r.childLanes |= n), a.tag === 22 && (e = a.stateNode, e === null || e._visibility & Mv || (i = !0)), e = a, a = a.return;
			return e.tag === 3 ? (a = e.stateNode, i && t !== null && (i = 31 - Ph(n), e = a.hiddenUpdates, r = e[i], r === null ? e[i] = [t] : r.push(t), t.lane = n | 536870912), a) : null;
		}
		function Ir(e) {
			if (vw > _w) throw Cw = vw = 0, ww = yw = null, Error("Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate. React limits the number of nested updates to prevent infinite loops.");
			Cw > Sw && (Cw = 0, ww = null, console.error("Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.")), e.alternate === null && e.flags & 4098 && ed(e);
			for (var t = e, n = t.return; n !== null;) t.alternate === null && t.flags & 4098 && ed(e), t = n, n = t.return;
			return t.tag === 3 ? t.stateNode : null;
		}
		function Lr(e) {
			if (Rv === null) return e;
			var t = Rv(e);
			return t === void 0 ? e : t.current;
		}
		function Rr(e, t) {
			if (Rv === null) return !1;
			var n = Rv, r = e.elementType;
			t = t.type;
			var i = !1, a = typeof t == "object" && t ? t.$$typeof : null;
			switch (e.tag) {
				case 1:
					typeof t == "function" && (i = !0);
					break;
				case 0:
					(typeof t == "function" || a === zm) && (i = !0);
					break;
				case 11:
					(a === Fm || a === zm) && (i = !0);
					break;
				case 14:
				case 15:
					(a === Rm || a === zm) && (i = !0);
					break;
				default: return !1;
			}
			return !!(i && (e = n(r), e !== void 0 && e === n(t)));
		}
		function zr(e) {
			Rv !== null && typeof WeakSet == "function" && (zv === null && (zv = /* @__PURE__ */ new WeakSet()), zv.add(e));
		}
		function Br(e, t, n) {
			do {
				var r = e, i = r.alternate, a = r.child, o = r.sibling, s = r.tag, c = r.type, l = r.elementType, u = null;
				switch (r = null, s) {
					case 0:
					case 1:
						u = c;
						break;
					case 15:
						u = c, r = l;
						break;
					case 14:
						r = l;
						break;
					case 11: u = c.render, r = l;
				}
				if (Rv === null) throw Error("Expected resolveFamily to be set during hot reload.");
				var d = Rv;
				if (c = l = !1, u !== null && (u = d(u), u !== void 0 && (n.has(u) ? c = !0 : t.has(u) && (s === 1 ? c = !0 : l = !0))), c || r === null || (s = d(r), s !== void 0 && n.has(s) ? c = !0 : typeof r == "object" && r.$$typeof === zm && (s = r._payload, s._status === 1 && (s = d(s._result.default), s !== void 0 && n.has(s) && (c = !0)))), zv !== null && (zv.has(e) || i !== null && zv.has(i)) && (c = !0), c && (e._debugNeedsRemount = !0), (c || l) && (i = Pr(e, 2), i !== null && ou(i, e, 2)), a === null || c || Br(a, t, n), o === null) break;
				e = o;
			} while (1);
		}
		function Vr(e, t, n, r) {
			this.tag = e, this.key = n, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = t, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null, this.actualDuration = -0, this.actualStartTime = -1.1, this.treeBaseDuration = this.selfBaseDuration = -0, this._debugTask = this._debugStack = this._debugOwner = this._debugInfo = null, this._debugNeedsRemount = !1, this._debugHookTypes = null, Wv || typeof Object.preventExtensions != "function" || Object.preventExtensions(this);
		}
		function Hr(e) {
			return e = e.prototype, !(!e || !e.isReactComponent);
		}
		function Ur(e, t) {
			var n = e.alternate;
			switch (n === null ? (n = g(e.tag, t, e.key, e.mode), n.elementType = e.elementType, n.type = e.type, n.stateNode = e.stateNode, n._debugOwner = e._debugOwner, n._debugStack = e._debugStack, n._debugTask = e._debugTask, n._debugHookTypes = e._debugHookTypes, n.alternate = e, e.alternate = n) : (n.pendingProps = t, n.type = e.type, n.flags = 0, n.subtreeFlags = 0, n.deletions = null, n.actualDuration = -0, n.actualStartTime = -1.1), n.flags = e.flags & 1206910976, n.childLanes = e.childLanes, n.lanes = e.lanes, n.child = e.child, n.memoizedProps = e.memoizedProps, n.memoizedState = e.memoizedState, n.updateQueue = e.updateQueue, t = e.dependencies, n.dependencies = t === null ? null : {
				lanes: t.lanes,
				firstContext: t.firstContext,
				_debugThenableState: t._debugThenableState
			}, n.sibling = e.sibling, n.index = e.index, n.ref = e.ref, n.refCleanup = e.refCleanup, n.selfBaseDuration = e.selfBaseDuration, n.treeBaseDuration = e.treeBaseDuration, n._debugInfo = e._debugInfo, n._debugNeedsRemount = e._debugNeedsRemount, n.tag) {
				case 0:
				case 15:
				case 14:
				case 1:
				case 11: n.type = Lr(e.type);
			}
			return n;
		}
		function Wr(e, t) {
			e.flags &= 1206910978;
			var n = e.alternate;
			return n === null ? (e.childLanes = 0, e.lanes = t, e.child = null, e.subtreeFlags = 0, e.memoizedProps = null, e.memoizedState = null, e.updateQueue = null, e.dependencies = null, e.stateNode = null, e.selfBaseDuration = 0, e.treeBaseDuration = 0) : (e.childLanes = n.childLanes, e.lanes = n.lanes, e.child = n.child, e.subtreeFlags = 0, e.deletions = null, e.memoizedProps = n.memoizedProps, e.memoizedState = n.memoizedState, e.updateQueue = n.updateQueue, e.type = n.type, t = n.dependencies, e.dependencies = t === null ? null : {
				lanes: t.lanes,
				firstContext: t.firstContext,
				_debugThenableState: t._debugThenableState
			}, e.selfBaseDuration = n.selfBaseDuration, e.treeBaseDuration = n.treeBaseDuration), e;
		}
		function Gr(e, t, n, r, i, a) {
			var o = 0, s = Lr(e);
			if (typeof s == "function") Hr(s) && (o = 1);
			else if (typeof s == "string") o = we(), o = Fp(e, n, o) ? 26 : e === "html" || e === "head" || e === "body" ? 27 : 5;
			else a: switch (s) {
				case Bm: return t = g(31, n, t, i), t.elementType = Bm, t.lanes = a, t;
				case Am: return qr(n.children, i, a, t);
				case jm:
					o = 8, i |= Vv, i |= Hv;
					break;
				case Mm: return e = n, r = i, typeof e.id != "string" && console.error("Profiler must specify an \"id\" of type `string` as a prop. Received the type `%s` instead.", typeof e.id), t = g(12, e, t, r | G), t.elementType = Mm, t.lanes = a, t.stateNode = {
					effectDuration: 0,
					passiveEffectDuration: 0
				}, t;
				case Im: return t = g(13, n, t, i), t.elementType = Im, t.lanes = a, t;
				case Lm: return t = g(19, n, t, i), t.elementType = Lm, t.lanes = a, t;
				case Vm:
				case Um: return e = i | Uv, t = g(30, n, t, e), t.elementType = Um, t.lanes = a, t.stateNode = {
					autoName: null,
					paired: null,
					clones: null,
					ref: null
				}, t;
				default:
					if (typeof s == "object" && s) switch (s.$$typeof) {
						case Pm:
							o = 10;
							break a;
						case Nm:
							o = 9;
							break a;
						case Fm:
							o = 11;
							break a;
						case Rm:
							o = 14;
							break a;
						case zm:
							o = 16, s = null;
							break a;
					}
					n = "", (e === void 0 || typeof e == "object" && e && Object.keys(e).length === 0) && (n += " You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports."), e === null ? s = "null" : qm(e) ? s = "array" : e !== void 0 && e.$$typeof === Om ? (s = "<" + (ge(e.type) || "Unknown") + " />", n = " Did you accidentally export a JSX literal instead of a component?") : s = typeof e, (o = r ? _e(r) : null) && (n += "\n\nCheck the render method of `" + o + "`."), o = 29, n = Error("Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: " + (s + "." + n)), s = null;
			}
			return t = g(o, n, t, i), t.elementType = e, t.type = s, t.lanes = a, t._debugOwner = r, t;
		}
		function Kr(e, t, n) {
			return t = Gr(e.type, e.key, e.props, e._owner, t, n), t._debugOwner = e._owner, t._debugStack = e._debugStack, t._debugTask = e._debugTask, t;
		}
		function qr(e, t, n, r) {
			return e = g(7, e, r, t), e.lanes = n, e;
		}
		function Jr(e, t, n) {
			return e = g(6, e, null, t), e.lanes = n, e;
		}
		function Yr(e) {
			var t = g(18, null, null, W);
			return t.stateNode = e, t;
		}
		function Xr(e, t, n) {
			return t = g(4, e.children === null ? [] : e.children, e.key, t), t.lanes = n, t.stateNode = {
				containerInfo: e.containerInfo,
				pendingChildren: null,
				implementation: e.implementation
			}, t;
		}
		function Zr(e, t) {
			if (typeof e == "object" && e) {
				var n = Gv.get(e);
				return n === void 0 ? (t = {
					value: e,
					source: t,
					stack: Ne(t)
				}, Gv.set(e, t), t) : n;
			}
			return {
				value: e,
				source: t,
				stack: Ne(t)
			};
		}
		function Qr(e, t) {
			ii(), Kv[qv++] = Yv, Kv[qv++] = Jv, Jv = e, Yv = t;
		}
		function $r(e, t, n) {
			ii(), Xv[Zv++] = $v, Xv[Zv++] = ey, Xv[Zv++] = Qv, Qv = e;
			var r = $v;
			e = ey;
			var i = 32 - Ph(r) - 1;
			r &= ~(1 << i), n += 1;
			var a = 32 - Ph(t) + i;
			if (30 < a) {
				var o = i - i % 5;
				a = (r & (1 << o) - 1).toString(32), r >>= o, i -= o, $v = 1 << 32 - Ph(t) + i | n << i | r, ey = a + e;
			} else $v = 1 << a | n << i | r, ey = e;
		}
		function ei(e) {
			ii(), e.return !== null && (Qr(e, 1), $r(e, 1, 0));
		}
		function ti(e) {
			for (; e === Jv;) Jv = Kv[--qv], Kv[qv] = null, Yv = Kv[--qv], Kv[qv] = null;
			for (; e === Qv;) Qv = Xv[--Zv], Xv[Zv] = null, ey = Xv[--Zv], Xv[Zv] = null, $v = Xv[--Zv], Xv[Zv] = null;
		}
		function ni() {
			return ii(), Qv === null ? null : {
				id: $v,
				overflow: ey
			};
		}
		function ri(e, t) {
			ii(), Xv[Zv++] = $v, Xv[Zv++] = ey, Xv[Zv++] = Qv, $v = t.id, ey = t.overflow, Qv = e;
		}
		function ii() {
			K || console.error("Expected to be hydrating. This is a bug in React. Please file an issue.");
		}
		function ai(e, t) {
			if (e.return === null) {
				if (iy === null) iy = {
					fiber: e,
					children: [],
					serverProps: void 0,
					serverTail: [],
					distanceFromLeaf: t
				};
				else {
					if (iy.fiber !== e) throw Error("Saw multiple hydration diff roots in a pass. This is a bug in React.");
					iy.distanceFromLeaf > t && (iy.distanceFromLeaf = t);
				}
				return iy;
			}
			var n = ai(e.return, t + 1).children;
			return 0 < n.length && n[n.length - 1].fiber === e ? (n = n[n.length - 1], n.distanceFromLeaf > t && (n.distanceFromLeaf = t), n) : (t = {
				fiber: e,
				children: [],
				serverProps: void 0,
				serverTail: [],
				distanceFromLeaf: t
			}, n.push(t), t);
		}
		function oi() {
			K && console.error("We should not be hydrating here. This is a bug in React. Please file a bug.");
		}
		function si(e, t) {
			ry || (e = ai(e, 0), e.serverProps = null, t !== null && (t = op(t), e.serverTail.push(t)));
		}
		function ci(e) {
			var t = 1 < arguments.length && arguments[1] !== void 0 && arguments[1], n = "", r = iy;
			throw r !== null && (iy = null, n = E(r)), mi(Zr(Error("Hydration failed because the server rendered " + (t ? "text" : "HTML") + " didn't match the client. As a result this tree will be regenerated on the client. This can happen if a SSR-ed Client Component used:\n\n- A server/client branch `if (typeof window !== 'undefined')`.\n- Variable input such as `Date.now()` or `Math.random()` which changes each time it's called.\n- Date formatting in a user's locale which doesn't match the server.\n- External changing data without sending a snapshot of it along with the HTML.\n- Invalid HTML tag nesting.\n\nIt can also happen if the client has a browser extension installed which messes with the HTML before React loaded.\n\nhttps://react.dev/link/hydration-mismatch" + n), e)), sy;
		}
		function li(e) {
			var t = e.stateNode, n = e.type, r = e.memoizedProps;
			switch (t[Gh] = e, t[Kh] = r, wd(n, r), n) {
				case "dialog":
					F("cancel", t), F("close", t);
					break;
				case "iframe":
				case "object":
				case "embed":
					F("load", t);
					break;
				case "video":
				case "audio":
					for (n = 0; n < zw.length; n++) F(zw[n], t);
					break;
				case "source":
					F("error", t);
					break;
				case "img":
				case "image":
				case "link":
					F("error", t), F("load", t);
					break;
				case "details":
					F("toggle", t);
					break;
				case "input":
					bt("input", r), F("invalid", t), Nt(t, r), Ft(t, r.value, r.defaultValue, r.checked, r.defaultChecked, r.type, r.name, !0);
					break;
				case "option":
					Lt(t, r);
					break;
				case "select":
					bt("select", r), F("invalid", t), Bt(t, r);
					break;
				case "textarea": bt("textarea", r), F("invalid", t), Vt(t, r), Ut(t, r.value, r.defaultValue, r.children);
			}
			n = r.children, typeof n != "string" && typeof n != "number" && typeof n != "bigint" || t.textContent === "" + n || !0 === r.suppressHydrationWarning || Md(t.textContent, n) ? (r.popover != null && (F("beforetoggle", t), F("toggle", t)), r.onScroll != null && F("scroll", t), r.onScrollEnd != null && F("scrollend", t), r.onClick != null && (t.onclick = wn), t = !0) : t = !1, t || ci(e, !0);
		}
		function ui(e) {
			for (ty = e.return; ty;) switch (ty.tag) {
				case 5:
				case 31:
				case 13:
					oy = !1;
					return;
				case 27:
				case 3:
					oy = !0;
					return;
				default: ty = ty.return;
			}
		}
		function di(e) {
			if (e !== ty) return !1;
			if (!K) return ui(e), K = !0, !1;
			var t = e.tag, n;
			if ((n = t !== 3 && t !== 27) && ((n = t === 5) && (n = e.type, n = n === "form" || n === "button" || $d(e.type, e.memoizedProps)), n = !n), n && ny) {
				for (n = ny; n;) {
					var r = ai(e, 0), i = op(n);
					r.serverTail.push(i), n = i.type === "Suspense" ? cp(n) : ap(n.nextSibling);
				}
				ci(e);
			}
			if (ui(e), t === 13) {
				if (e = e.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error("Expected to have a hydrated suspense instance. This error is likely caused by a bug in React. Please file an issue.");
				ny = cp(e);
			} else if (t === 31) {
				if (e = e.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error("Expected to have a hydrated suspense instance. This error is likely caused by a bug in React. Please file an issue.");
				ny = cp(e);
			} else t === 27 ? (t = ny, df(e.type) ? (e = FT, FT = null, ny = e) : ny = t) : ny = ty ? ap(e.stateNode.nextSibling) : null;
			return !0;
		}
		function fi() {
			ny = ty = null, ry = K = !1;
		}
		function pi() {
			var e = ay;
			return e !== null && (LC === null ? LC = e : LC.push.apply(LC, e), ay = null), e;
		}
		function mi(e) {
			ay === null ? ay = [e] : ay.push(e);
		}
		function hi() {
			var e = iy;
			if (e !== null) {
				iy = null;
				for (var t = E(e); 0 < e.children.length;) e = e.children[0];
				T(e.fiber, function() {
					console.error("A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:\n\n- A server/client branch `if (typeof window !== 'undefined')`.\n- Variable input such as `Date.now()` or `Math.random()` which changes each time it's called.\n- Date formatting in a user's locale which doesn't match the server.\n- External changing data without sending a snapshot of it along with the HTML.\n- Invalid HTML tag nesting.\n\nIt can also happen if the client has a browser extension installed which messes with the HTML before React loaded.\n\n%s%s", "https://react.dev/link/hydration-mismatch", t);
				});
			}
		}
		function gi() {
			fy = dy = null, py = !1;
		}
		function _i(e, t, n) {
			be(cy, t._currentValue, e), t._currentValue = n, be(ly, t._currentRenderer, e), t._currentRenderer !== void 0 && t._currentRenderer !== null && t._currentRenderer !== uy && console.error("Detected multiple renderers concurrently rendering the same context provider. This is currently unsupported."), t._currentRenderer = uy;
		}
		function vi(e, t) {
			e._currentValue = cy.current;
			var n = ly.current;
			ye(ly, t), e._currentRenderer = n, ye(cy, t);
		}
		function yi(e, t, n) {
			for (; e !== null;) {
				var r = e.alternate;
				if ((e.childLanes & t) === t ? r !== null && (r.childLanes & t) !== t && (r.childLanes |= t) : (e.childLanes |= t, r !== null && (r.childLanes |= t)), e === n) break;
				e = e.return;
			}
			e !== n && console.error("Expected to find the propagation root when scheduling context work. This error is likely caused by a bug in React. Please file an issue.");
		}
		function bi(e, t, n, r) {
			var i = e.child;
			for (i !== null && (i.return = e); i !== null;) {
				var a = i.dependencies;
				if (a !== null) {
					var o = i.child;
					a = a.firstContext;
					a: for (; a !== null;) {
						var s = a;
						a = i;
						for (var c = 0; c < t.length; c++) if (s.context === t[c]) {
							a.lanes |= n, s = a.alternate, s !== null && (s.lanes |= n), yi(a.return, n, e), r || (o = null);
							break a;
						}
						a = s.next;
					}
				} else if (i.tag === 18) {
					if (o = i.return, o === null) throw Error("We just came from a parent so we must have had a parent. This is a bug in React.");
					o.lanes |= n, a = o.alternate, a !== null && (a.lanes |= n), yi(o, n, e), o = null;
				} else i.tag === 13 && i.memoizedState !== null && i.memoizedState.dehydrated === null ? (i.lanes |= n, o = i.alternate, o !== null && (o.lanes |= n), yi(i.return, n, e), o = i.child, o = o === null ? null : o.sibling) : o = i.child;
				if (o !== null) o.return = i;
				else for (o = i; o !== null;) {
					if (o === e) {
						o = null;
						break;
					}
					if (i = o.sibling, i !== null) {
						i.return = o.return, o = i;
						break;
					}
					o = o.return;
				}
				i = o;
			}
		}
		function xi(e, t, n, r) {
			e = null;
			for (var i = t, a = !1; i !== null;) {
				if (!a) {
					if (i.flags & 524288) a = !0;
					else if (i.flags & 262144) break;
				}
				if (i.tag === 10) {
					var o = i.alternate;
					if (o === null) throw Error("Should have a current fiber. This is a bug in React.");
					if (o = o.memoizedProps, o !== null) {
						var s = i.type;
						G_(i.pendingProps.value, o.value) || (e === null ? e = [s] : e.push(s));
					}
				} else if (i === th.current) {
					if (o = i.alternate, o === null) throw Error("Should have a current fiber. This is a bug in React.");
					o.memoizedState.memoizedState !== i.memoizedState.memoizedState && (e === null ? e = [$T] : e.push($T));
				}
				i = i.return;
			}
			return e !== null && bi(t, e, n, r), t.flags |= 262144, e !== null;
		}
		function Si(e) {
			for (e = e.firstContext; e !== null;) {
				if (!G_(e.context._currentValue, e.memoizedValue)) return !0;
				e = e.next;
			}
			return !1;
		}
		function Ci(e) {
			dy = e, fy = null, e = e.dependencies, e !== null && (e.firstContext = null);
		}
		function wi(e) {
			return py && console.error("Context can only be read while React is rendering. In classes, you can read it in the render method or getDerivedStateFromProps. In function components, you can read it directly in the function body, but not inside Hooks like useReducer() or useMemo()."), Ei(dy, e);
		}
		function Ti(e, t) {
			return dy === null && Ci(e), Ei(e, t);
		}
		function Ei(e, t) {
			var n = t._currentValue;
			if (t = {
				context: t,
				memoizedValue: n,
				next: null
			}, fy === null) {
				if (e === null) throw Error("Context can only be read while React is rendering. In classes, you can read it in the render method or getDerivedStateFromProps. In function components, you can read it directly in the function body, but not inside Hooks like useReducer() or useMemo().");
				fy = t, e.dependencies = {
					lanes: 0,
					firstContext: t,
					_debugThenableState: null
				}, e.flags |= 524288;
			} else fy = fy.next = t;
			return n;
		}
		function Di() {
			return {
				controller: new my(),
				data: /* @__PURE__ */ new Map(),
				refCount: 0
			};
		}
		function Oi(e) {
			e.controller.signal.aborted && console.warn("A cache instance was retained after it was already freed. This likely indicates a bug in React."), e.refCount++;
		}
		function ki(e) {
			e.refCount--, 0 > e.refCount && console.warn("A cache instance was released after it was already freed. This likely indicates a bug in React."), e.refCount === 0 && hy(gy, function() {
				e.controller.abort();
			});
		}
		function Ai(e, t) {
			if (e.pendingLanes & 4194048) {
				var n = e.transitionTypes;
				for (n === null && (n = e.transitionTypes = []), e = 0; e < t.length; e++) {
					var r = t[e];
					n.indexOf(r) === -1 && n.push(r);
				}
			}
		}
		function ji(e) {
			var t = e.transitionTypes;
			return e.transitionTypes = null, t;
		}
		function Mi(e, t, n) {
			e & 127 ? 0 > Ny && (Ny = yy(), Py = by(t), Iy = t, n != null && (Ly = C(n)), (fC & (rC | iC)) !== nC && (jy = !0, Fy = xy), e = nf(), t = tf(), e !== By || t !== zy ? By = -1.1 : t !== null && (Fy = xy), Ry = e, zy = t) : e & 4194048 && 0 > Wy && (Wy = yy(), Ky = by(t), qy = t, n != null && (Jy = C(n)), 0 > Uy) && (e = nf(), t = tf(), (e !== Zy || t !== Xy) && (Zy = -1.1), Yy = e, Xy = t);
		}
		function Ni(e) {
			if (0 > Ny) {
				Ny = yy(), Py = e._debugTask == null ? null : e._debugTask, (fC & (rC | iC)) !== nC && (Fy = xy);
				var t = nf(), n = tf();
				t !== By || n !== zy ? By = -1.1 : n !== null && (Fy = xy), Ry = t, zy = n;
			}
			0 > Wy && (Wy = yy(), Ky = e._debugTask == null ? null : e._debugTask, 0 > Uy) && (e = nf(), t = tf(), (e !== Zy || t !== Xy) && (Zy = -1.1), Yy = e, Xy = t);
		}
		function Pi() {
			var e = Oy;
			return Oy = 0, e;
		}
		function Fi(e) {
			var t = Oy;
			return Oy = e, t;
		}
		function Ii(e) {
			var t = Oy;
			return Oy += e, t;
		}
		function Li() {
			J = q = -1.1;
		}
		function Ri() {
			var e = q;
			return q = -1.1, e;
		}
		function zi(e) {
			0 <= e && (q = e);
		}
		function Bi() {
			var e = ky;
			return ky = -0, e;
		}
		function Vi(e) {
			0 <= e && (ky = e);
		}
		function Hi() {
			var e = Ay;
			return Ay = null, e;
		}
		function Ui() {
			var e = jy;
			return jy = !1, e;
		}
		function Wi(e) {
			Dy = yy(), 0 > e.actualStartTime && (e.actualStartTime = Dy);
		}
		function Gi(e) {
			if (0 <= Dy) {
				var t = yy() - Dy;
				e.actualDuration += t, e.selfBaseDuration = t, Dy = -1;
			}
		}
		function Ki(e) {
			if (0 <= Dy) {
				var t = yy() - Dy;
				e.actualDuration += t, Dy = -1;
			}
		}
		function qi() {
			if (0 <= Dy) {
				var e = yy(), t = e - Dy;
				Dy = -1, Oy += t, ky += t, J = e;
			}
		}
		function Ji(e) {
			Ay === null && (Ay = []), Ay.push(e), Ey === null && (Ey = []), Ey.push(e);
		}
		function Yi() {
			Dy = yy(), 0 > q && (q = Dy);
		}
		function Xi(e) {
			for (var t = e.child; t;) e.actualDuration += t.actualDuration, t = t.sibling;
		}
		function Zi(e, t) {
			if (sb === null) {
				var n = sb = [];
				cb = 0, lb = pd(), ub = {
					status: "pending",
					value: void 0,
					then: function(e) {
						n.push(e);
					}
				};
			}
			return cb++, t.then(Qi, Qi), t;
		}
		function Qi() {
			if (--cb === 0 && (-1 < Wy || (Uy = -1.1), vy = null, sb !== null)) {
				ub !== null && (ub.status = "fulfilled");
				var e = sb;
				sb = null, lb = 0, ub = null;
				for (var t = 0; t < e.length; t++) (0, e[t])();
			}
		}
		function $i(e, t) {
			var n = [], r = {
				status: "pending",
				value: null,
				reason: null,
				then: function(e) {
					n.push(e);
				}
			};
			return e.then(function() {
				r.status = "fulfilled", r.value = t;
				for (var e = 0; e < n.length; e++) (0, n[e])(t);
			}, function(e) {
				for (r.status = "rejected", r.reason = e, e = 0; e < n.length; e++) (0, n[e])(void 0);
			}), r;
		}
		function ea() {
			var e = fb.current;
			return e === null ? pC.pooledCache : e;
		}
		function ta(e, t) {
			t === null ? be(fb, fb.current, e) : be(fb, t.pool, e);
		}
		function na() {
			var e = ea();
			return e === null ? null : {
				parent: _y._currentValue,
				pool: e
			};
		}
		function ra() {
			return {
				didWarnAboutUncachedPromise: !1,
				thenables: []
			};
		}
		function ia(e) {
			return e = e.status, e === "fulfilled" || e === "rejected";
		}
		function aa(e, t, n, r) {
			z.actQueue !== null && (z.didUsePromise = !0);
			var i = e.thenables;
			if (n = i[n], n === void 0 ? i.push(t) : n !== t && (e.didWarnAboutUncachedPromise || (e.didWarnAboutUncachedPromise = !0, console.error("A component was suspended by an uncached promise. Creating promises inside a Client Component or hook is not yet supported, except via a Suspense-compatible library or framework.")), t.then(wn, wn), t = n), t._debugInfo === void 0) {
				e = performance.now(), i = t.displayName;
				var a = {
					name: typeof i == "string" ? i : "Promise",
					start: e,
					end: e,
					value: t
				};
				t._debugInfo = [{ awaited: a }], t.status !== "fulfilled" && t.status !== "rejected" && (e = function() {
					a.end = performance.now();
				}, t.then(e, e));
			}
			switch (t.status) {
				case "fulfilled": return t.value;
				case "rejected": throw r = t.reason, ca(r), r === void 0 && !("reason" in t) ? Error("A rejected Promise was passed to React without a `reason` property. React threw a generic error from where the Promise was used to assist in identifying the problematic Promise. Make sure that instrumented Promises correctly set the `reason` property when setting `status` to `'rejected'`.") : r;
				default:
					if (typeof t.status == "string") t.then(wn, wn);
					else {
						if (e = pC, e !== null && 100 < e.shellSuspendCounter) throw Error("An unknown Component is an async Client Component. Only Server Components can be async at the moment. This error is often caused by accidentally adding `'use client'` to a module that was originally written for the server.");
						e = t, e.status = "pending", e.then(function(e) {
							if (t.status === "pending") {
								var n = t;
								n.status = "fulfilled", n.value = e;
							}
						}, function(e) {
							if (t.status === "pending") {
								var n = t;
								n.status = "rejected", n.reason = e;
							}
						});
					}
					switch (t.status) {
						case "fulfilled": return t.value;
						case "rejected": throw r = t.reason, ca(r), r;
					}
					throw Yb = t, Xb = !0, Jb || r === null || r.alternate !== null || (Kb = r, qb = Error("This library called use() to suspend in a previous render but did not call use() when it finished. This indicates an incorrect use of use(). Learn more: https://react.dev/warnings/conditional-use-of-use")), Hb;
			}
		}
		function oa(e) {
			try {
				return Vb(e);
			} catch (e) {
				throw typeof e == "object" && e && typeof e.then == "function" ? (Yb = e, Xb = !0, Hb) : e;
			}
		}
		function sa() {
			if (Yb === null) throw Error("Expected a suspended thenable. This is a bug in React. Please file an issue.");
			var e = Yb;
			return Yb = null, Xb = !1, e;
		}
		function ca(e) {
			if (e === Hb || e === Wb) throw Error("Hooks are not supported inside an async component. This error is often caused by accidentally adding `'use client'` to a module that was originally written for the server.");
		}
		function la(e, t) {
			return e === t ? !0 : e.tag !== t.tag || e.type !== t.type || e.key !== t.key || e.index !== t.index || e.tag === 3 && e.stateNode !== t.stateNode || e.return === null || t.return === null ? !1 : la(e.return, t.return);
		}
		function ua(e) {
			var t = Y;
			return e != null && (Y = t === null ? e : t.concat(e)), t;
		}
		function da() {
			var e = Y;
			if (e != null) {
				for (var t = e.length - 1; 0 <= t; t--) if (e[t].name != null) {
					var n = e[t].debugTask;
					if (n != null) return n;
				}
			}
			return null;
		}
		function fa(e, t, n) {
			for (var r = Object.keys(e.props), i = 0; i < r.length; i++) {
				var a = r[i];
				if (a !== "children" && a !== "key" && a !== "ref") {
					t === null && (t = Kr(e, n.mode, 0), t._debugInfo = Y, t.return = n), T(t, function(e) {
						console.error("Invalid prop `%s` supplied to `React.Fragment`. React.Fragment can only have `key`, `ref`, and `children` props.", e);
					}, a);
					break;
				}
			}
		}
		function pa(e) {
			var t = Qb;
			return Qb += 1, Zb === null && (Zb = ra()), aa(Zb, e, t, null);
		}
		function ma(e, t) {
			t = t.props.ref, e.ref = t === void 0 ? null : t;
		}
		function ha(e, t) {
			throw t.$$typeof === Dm ? Error("A React Element from an older version of React was rendered. This is not supported. It can happen if:\n- Multiple copies of the \"react\" package is used.\n- A library pre-bundled an old copy of \"react\" or \"react/jsx-runtime\".\n- A compiler tries to \"inline\" JSX instead of using the runtime.") : (e = Object.prototype.toString.call(t), Error("Objects are not valid as a React child (found: " + (e === "[object Object]" ? "object with keys {" + Object.keys(t).join(", ") + "}" : e) + "). If you meant to render a collection of children, use an array instead."));
		}
		function ga(e, t) {
			var n = da();
			n === null ? ha(e, t) : n.run(ha.bind(null, e, t));
		}
		function _a(e, t) {
			var n = C(e) || "Component";
			nx[n] || (nx[n] = !0, t = t.displayName || t.name || "Component", e.tag === 3 ? console.error("Functions are not valid as a React child. This may happen if you return %s instead of <%s /> from render. Or maybe you meant to call this function rather than return it.\n  root.render(%s)", t, t, t) : console.error("Functions are not valid as a React child. This may happen if you return %s instead of <%s /> from render. Or maybe you meant to call this function rather than return it.\n  <%s>{%s}</%s>", t, t, n, t, n));
		}
		function D(e, t) {
			var n = da();
			n === null ? _a(e, t) : n.run(_a.bind(null, e, t));
		}
		function va(e, t) {
			var n = C(e) || "Component";
			rx[n] || (rx[n] = !0, t = String(t), e.tag === 3 ? console.error("Symbols are not valid as a React child.\n  root.render(%s)", t) : console.error("Symbols are not valid as a React child.\n  <%s>%s</%s>", n, t, n));
		}
		function ya(e, t) {
			var n = da();
			n === null ? va(e, t) : n.run(va.bind(null, e, t));
		}
		function ba(e) {
			function t(t, n) {
				if (e) {
					var r = t.deletions;
					r === null ? (t.deletions = [n], t.flags |= 16) : r.push(n);
				}
			}
			function n(n, r) {
				if (!e) return null;
				for (; r !== null;) t(n, r), r = r.sibling;
				return null;
			}
			function r(e) {
				for (var t = /* @__PURE__ */ new Map(); e !== null;) e.key === null ? t.set(e.index, e) : t.set(e.key, e), e = e.sibling;
				return t;
			}
			function i(e, t) {
				return e = Ur(e, t), e.index = 0, e.sibling = null, e;
			}
			function a(t, n, r) {
				return t.index = r, e ? (r = t.alternate, r === null ? (t.flags |= 134217730, n) : (r = r.index, r < n ? (t.flags |= 2, n) : r)) : (t.flags |= 1048576, n);
			}
			function o(t) {
				return e && t.alternate === null && (t.flags |= 134217730), t;
			}
			function s(e, t, n, r) {
				return t === null || t.tag !== 6 ? (t = Jr(n, e.mode, r), t.return = e, t._debugOwner = e, t._debugTask = e._debugTask, t._debugInfo = Y, t) : (t = i(t, n), t.return = e, t._debugInfo = Y, t);
			}
			function c(e, t, n, r) {
				var a = n.type;
				return a === Am ? (t = u(e, t, n.props.children, r, n.key), ma(t, n), fa(n, t, e), t) : t !== null && (t.elementType === a || Rr(t, n) || typeof a == "object" && a && a.$$typeof === zm && oa(a) === t.type) ? (t = i(t, n.props), ma(t, n), t.return = e, t._debugOwner = n._owner, t._debugInfo = Y, t) : (t = Kr(n, e.mode, r), ma(t, n), t.return = e, t._debugInfo = Y, t);
			}
			function l(e, t, n, r) {
				return t === null || t.tag !== 4 || t.stateNode.containerInfo !== n.containerInfo || t.stateNode.implementation !== n.implementation ? (t = Xr(n, e.mode, r), t.return = e, t._debugInfo = Y, t) : (t = i(t, n.children || []), t.return = e, t._debugInfo = Y, t);
			}
			function u(e, t, n, r, a) {
				return t === null || t.tag !== 7 ? (t = qr(n, e.mode, r, a), t.return = e, t._debugOwner = e, t._debugTask = e._debugTask, t._debugInfo = Y, t) : (t = i(t, n), t.return = e, t._debugInfo = Y, t);
			}
			function d(e, t, n) {
				if (typeof t == "string" && t !== "" || typeof t == "number" || typeof t == "bigint") return t = Jr("" + t, e.mode, n), t.return = e, t._debugOwner = e, t._debugTask = e._debugTask, t._debugInfo = Y, t;
				if (typeof t == "object" && t) {
					switch (t.$$typeof) {
						case Om: return n = Kr(t, e.mode, n), ma(n, t), n.return = e, e = ua(t._debugInfo), n._debugInfo = Y, Y = e, n;
						case km: return t = Xr(t, e.mode, n), t.return = e, t._debugInfo = Y, t;
						case zm:
							var r = ua(t._debugInfo);
							return t = oa(t), e = d(e, t, n), Y = r, e;
					}
					if (qm(t) || he(t)) return n = qr(t, e.mode, n, null), n.return = e, n._debugOwner = e, n._debugTask = e._debugTask, e = ua(t._debugInfo), n._debugInfo = Y, Y = e, n;
					if (typeof t.then == "function") return r = ua(t._debugInfo), e = d(e, pa(t), n), Y = r, e;
					if (t.$$typeof === Pm) return d(e, Ti(e, t), n);
					ga(e, t);
				}
				return typeof t == "function" && D(e, t), typeof t == "symbol" && ya(e, t), null;
			}
			function f(e, t, n, r) {
				var i = t === null ? null : t.key;
				if (typeof n == "string" && n !== "" || typeof n == "number" || typeof n == "bigint") return i === null ? s(e, t, "" + n, r) : null;
				if (typeof n == "object" && n) {
					switch (n.$$typeof) {
						case Om: return n.key === i ? (i = ua(n._debugInfo), e = c(e, t, n, r), Y = i, e) : null;
						case km: return n.key === i ? l(e, t, n, r) : null;
						case zm: return i = ua(n._debugInfo), n = oa(n), e = f(e, t, n, r), Y = i, e;
					}
					if (qm(n) || he(n)) return i === null ? (i = ua(n._debugInfo), e = u(e, t, n, r, null), Y = i, e) : null;
					if (typeof n.then == "function") return i = ua(n._debugInfo), e = f(e, t, pa(n), r), Y = i, e;
					if (n.$$typeof === Pm) return f(e, t, Ti(e, n), r);
					ga(e, n);
				}
				return typeof n == "function" && D(e, n), typeof n == "symbol" && ya(e, n), null;
			}
			function p(e, t, n, r, i) {
				if (typeof r == "string" && r !== "" || typeof r == "number" || typeof r == "bigint") return e = e.get(n) || null, s(t, e, "" + r, i);
				if (typeof r == "object" && r) {
					switch (r.$$typeof) {
						case Om: return n = e.get(r.key === null ? n : r.key) || null, e = ua(r._debugInfo), t = c(t, n, r, i), Y = e, t;
						case km: return e = e.get(r.key === null ? n : r.key) || null, l(t, e, r, i);
						case zm:
							var a = ua(r._debugInfo);
							return r = oa(r), t = p(e, t, n, r, i), Y = a, t;
					}
					if (qm(r) || he(r)) return n = e.get(n) || null, e = ua(r._debugInfo), t = u(t, n, r, i, null), Y = e, t;
					if (typeof r.then == "function") return a = ua(r._debugInfo), t = p(e, t, n, pa(r), i), Y = a, t;
					if (r.$$typeof === Pm) return p(e, t, n, Ti(t, r), i);
					ga(t, r);
				}
				return typeof r == "function" && D(t, r), typeof r == "symbol" && ya(t, r), null;
			}
			function h(e, t, n, r) {
				if (typeof n != "object" || !n) return r;
				switch (n.$$typeof) {
					case Om:
					case km:
						m(e, t, n);
						var i = n.key;
						if (typeof i != "string") break;
						if (r === null) {
							r = /* @__PURE__ */ new Set(), r.add(i);
							break;
						}
						if (!r.has(i)) {
							r.add(i);
							break;
						}
						T(t, function() {
							console.error("Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.", i);
						});
						break;
					case zm: n = oa(n), h(e, t, n, r);
				}
				return r;
			}
			function _(i, o, s, c) {
				for (var l = null, u = null, m = null, g = o, _ = o = 0, v = null; g !== null && _ < s.length; _++) {
					g.index > _ ? (v = g, g = null) : v = g.sibling;
					var y = f(i, g, s[_], c);
					if (y === null) {
						g === null && (g = v);
						break;
					}
					l = h(i, y, s[_], l), e && g && y.alternate === null && t(i, g), o = a(y, o, _), m === null ? u = y : m.sibling = y, m = y, g = v;
				}
				if (_ === s.length) return n(i, g), K && Qr(i, _), u;
				if (g === null) {
					for (; _ < s.length; _++) g = d(i, s[_], c), g !== null && (l = h(i, g, s[_], l), o = a(g, o, _), m === null ? u = g : m.sibling = g, m = g);
					return K && Qr(i, _), u;
				}
				for (g = r(g); _ < s.length; _++) v = p(g, i, _, s[_], c), v !== null && (l = h(i, v, s[_], l), e && (y = v.alternate, y !== null && g.delete(y.key === null ? _ : y.key)), o = a(v, o, _), m === null ? u = v : m.sibling = v, m = v);
				return e && g.forEach(function(e) {
					return t(i, e);
				}), K && Qr(i, _), u;
			}
			function v(i, o, s, c) {
				if (s == null) throw Error("An iterable object provided no iterator.");
				for (var l = null, u = null, m = o, g = o = 0, _ = null, v = null, y = s.next(); m !== null && !y.done; g++, y = s.next()) {
					m.index > g ? (_ = m, m = null) : _ = m.sibling;
					var b = f(i, m, y.value, c);
					if (b === null) {
						m === null && (m = _);
						break;
					}
					v = h(i, b, y.value, v), e && m && b.alternate === null && t(i, m), o = a(b, o, g), u === null ? l = b : u.sibling = b, u = b, m = _;
				}
				if (y.done) return n(i, m), K && Qr(i, g), l;
				if (m === null) {
					for (; !y.done; g++, y = s.next()) m = d(i, y.value, c), m !== null && (v = h(i, m, y.value, v), o = a(m, o, g), u === null ? l = m : u.sibling = m, u = m);
					return K && Qr(i, g), l;
				}
				for (m = r(m); !y.done; g++, y = s.next()) _ = p(m, i, g, y.value, c), _ !== null && (v = h(i, _, y.value, v), e && (y = _.alternate, y !== null && m.delete(y.key === null ? g : y.key)), o = a(_, o, g), u === null ? l = _ : u.sibling = _, u = _);
				return e && m.forEach(function(e) {
					return t(i, e);
				}), K && Qr(i, g), l;
			}
			function y(e, r, a, s) {
				if (typeof a == "object" && a && a.type === Am && a.key === null && a.props.ref === void 0 && (fa(a, null, e), a = a.props.children), typeof a == "object" && a) {
					switch (a.$$typeof) {
						case Om:
							var c = ua(a._debugInfo);
							a: {
								for (var l = a.key; r !== null;) {
									if (r.key === l) {
										if (l = a.type, l === Am) {
											if (r.tag === 7) {
												n(e, r.sibling), s = i(r, a.props.children), ma(s, a), s.return = e, s._debugOwner = a._owner, s._debugInfo = Y, fa(a, s, e), e = s;
												break a;
											}
										} else if (r.elementType === l || Rr(r, a) || typeof l == "object" && l && l.$$typeof === zm && oa(l) === r.type) {
											n(e, r.sibling), s = i(r, a.props), ma(s, a), s.return = e, s._debugOwner = a._owner, s._debugInfo = Y, e = s;
											break a;
										}
										n(e, r);
										break;
									}
									t(e, r), r = r.sibling;
								}
								a.type === Am ? (s = qr(a.props.children, e.mode, s, a.key), ma(s, a), s.return = e, s._debugOwner = e, s._debugTask = e._debugTask, s._debugInfo = Y, fa(a, s, e), e = s) : (s = Kr(a, e.mode, s), ma(s, a), s.return = e, s._debugInfo = Y, e = s);
							}
							return e = o(e), Y = c, e;
						case km:
							a: {
								for (c = a, a = c.key; r !== null;) {
									if (r.key === a) {
										if (r.tag === 4 && r.stateNode.containerInfo === c.containerInfo && r.stateNode.implementation === c.implementation) {
											n(e, r.sibling), s = i(r, c.children || []), s.return = e, e = s;
											break a;
										}
										n(e, r);
										break;
									}
									t(e, r), r = r.sibling;
								}
								s = Xr(c, e.mode, s), s.return = e, e = s;
							}
							return o(e);
						case zm: return c = ua(a._debugInfo), a = oa(a), e = y(e, r, a, s), Y = c, e;
					}
					if (qm(a)) return _(e, r, a, s);
					if (he(a)) {
						if (c = a, a = he(c), typeof a != "function") throw Error("An object is not an iterable. This error is likely caused by a bug in React. Please file an issue.");
						return l = a.call(c), l === c ? (e.tag !== 0 || Object.prototype.toString.call(e.type) !== "[object GeneratorFunction]" || Object.prototype.toString.call(l) !== "[object Generator]") && (ex || console.error("Using Iterators as children is unsupported and will likely yield unexpected results because enumerating a generator mutates it. You may convert it to an array with `Array.from()` or the `[...spread]` operator before rendering. You can also use an Iterable that can iterate multiple times over the same items."), ex = !0) : c.entries !== a || $b || (console.error("Using Maps as children is not supported. Use an array of keyed ReactElements instead."), $b = !0), v(e, r, l, s);
					}
					if (typeof a.then == "function") return c = ua(a._debugInfo), e = y(e, r, pa(a), s), Y = c, e;
					if (a.$$typeof === Pm) return y(e, r, Ti(e, a), s);
					ga(e, a);
				}
				return typeof a == "string" && a !== "" || typeof a == "number" || typeof a == "bigint" ? (c = "" + a, r !== null && r.tag === 6 ? (n(e, r.sibling), s = i(r, c), s.return = e, e = s) : (n(e, r), s = Jr(c, e.mode, s), s.return = e, s._debugOwner = e, s._debugTask = e._debugTask, s._debugInfo = Y, e = s), o(e)) : (typeof a == "function" && D(e, a), typeof a == "symbol" && ya(e, a), n(e, r));
			}
			return function(e, t, n, r) {
				var i = Y;
				Y = null;
				try {
					Qb = 0;
					var a = y(e, t, n, r);
					return Zb = null, a;
				} catch (t) {
					if (t === Hb || t === Wb) throw t;
					var o = g(29, t, null, e.mode);
					o.lanes = r, o.return = e;
					var s = o._debugInfo = Y;
					if (o._debugOwner = e._debugOwner, o._debugTask = e._debugTask, s != null) {
						for (var c = s.length - 1; 0 <= c; c--) if (typeof s[c].stack == "string") {
							o._debugOwner = s[c], o._debugTask = s[c].debugTask;
							break;
						}
					}
					return o;
				} finally {
					Y = i;
				}
			};
		}
		function xa(e, t) {
			var n = qm(e);
			return e = !n && typeof he(e) == "function", n || e ? (n = n ? "array" : "iterable", console.error("A nested %s was passed to row #%s in <SuspenseList />. Wrap it in an additional SuspenseList to configure its revealOrder: <SuspenseList revealOrder=...> ... <SuspenseList revealOrder=...>{%s}</SuspenseList> ... </SuspenseList>", n, t, n), !1) : !0;
		}
		function Sa(e) {
			e.updateQueue = {
				baseState: e.memoizedState,
				firstBaseUpdate: null,
				lastBaseUpdate: null,
				shared: {
					pending: null,
					lanes: 0,
					hiddenCallbacks: null
				},
				callbacks: null
			};
		}
		function Ca(e, t) {
			e = e.updateQueue, t.updateQueue === e && (t.updateQueue = {
				baseState: e.baseState,
				firstBaseUpdate: e.firstBaseUpdate,
				lastBaseUpdate: e.lastBaseUpdate,
				shared: e.shared,
				callbacks: null
			});
		}
		function wa(e) {
			return {
				lane: e,
				tag: ox,
				payload: null,
				callback: null,
				next: null
			};
		}
		function Ta(e, t, n) {
			var r = e.updateQueue;
			if (r === null) return null;
			if (r = r.shared, fx === r && !dx) {
				var i = C(e);
				console.error("An update (setState, replaceState, or forceUpdate) was scheduled from inside an update function. Update functions should be pure, with zero side-effects. Consider using componentDidUpdate or a callback.\n\nPlease update the following component: %s", i), dx = !0;
			}
			return (fC & rC) === nC ? (Mr(e, r, t, n), Ir(e)) : (i = r.pending, i === null ? t.next = t : (t.next = i.next, i.next = t), r.pending = t, t = Ir(e), Fr(e, null, n), t);
		}
		function Ea(e, t, n) {
			if (t = t.updateQueue, t !== null && (t = t.shared, n & 4194048)) {
				var r = t.lanes;
				r &= e.pendingLanes, n |= r, t.lanes = n, rt(e, n);
			}
		}
		function Da(e, t) {
			var n = e.updateQueue, r = e.alternate;
			if (r !== null && (r = r.updateQueue, n === r)) {
				var i = null, a = null;
				if (n = n.firstBaseUpdate, n !== null) {
					do {
						var o = {
							lane: n.lane,
							tag: n.tag,
							payload: n.payload,
							callback: null,
							next: null
						};
						a === null ? i = a = o : a = a.next = o, n = n.next;
					} while (n !== null);
					a === null ? i = a = t : a = a.next = t;
				} else i = a = t;
				n = {
					baseState: r.baseState,
					firstBaseUpdate: i,
					lastBaseUpdate: a,
					shared: r.shared,
					callbacks: r.callbacks
				}, e.updateQueue = n;
				return;
			}
			e = n.lastBaseUpdate, e === null ? n.firstBaseUpdate = t : e.next = t, n.lastBaseUpdate = t;
		}
		function Oa() {
			if (px) {
				var e = ub;
				if (e !== null) throw e;
			}
		}
		function ka(e, t, n, r) {
			px = !1;
			var i = e.updateQueue;
			ux = !1, fx = i.shared;
			var a = i.firstBaseUpdate, o = i.lastBaseUpdate, s = i.shared.pending;
			if (s !== null) {
				i.shared.pending = null;
				var c = s, l = c.next;
				c.next = null, o === null ? a = l : o.next = l, o = c;
				var u = e.alternate;
				u !== null && (u = u.updateQueue, s = u.lastBaseUpdate, s !== o && (s === null ? u.firstBaseUpdate = l : s.next = l, u.lastBaseUpdate = c));
			}
			if (a !== null) {
				var d = i.baseState;
				o = 0, u = l = c = null, s = a;
				do {
					var f = s.lane & -536870913, p = f !== s.lane;
					if (p ? ($ & f) === f : (r & f) === f) {
						f !== 0 && f === lb && (px = !0), u !== null && (u = u.next = {
							lane: 0,
							tag: s.tag,
							payload: s.payload,
							callback: null,
							next: null
						});
						a: {
							f = e;
							var m = s, h = t, g = n;
							switch (m.tag) {
								case sx:
									if (m = m.payload, typeof m == "function") {
										py = !0;
										var _ = m.call(g, d, h);
										if (f.mode & Vv) {
											Ge(!0);
											try {
												m.call(g, d, h);
											} finally {
												Ge(!1);
											}
										}
										py = !1, d = _;
										break a;
									}
									d = m;
									break a;
								case lx: f.flags = f.flags & -65537 | 128;
								case ox:
									if (_ = m.payload, typeof _ == "function") {
										if (py = !0, m = _.call(g, d, h), f.mode & Vv) {
											Ge(!0);
											try {
												_.call(g, d, h);
											} finally {
												Ge(!1);
											}
										}
										py = !1;
									} else m = _;
									if (m == null) break a;
									d = R({}, d, m);
									break a;
								case cx: ux = !0;
							}
						}
						f = s.callback, f !== null && (e.flags |= 64, p && (e.flags |= 8192), p = i.callbacks, p === null ? i.callbacks = [f] : p.push(f));
					} else p = {
						lane: f,
						tag: s.tag,
						payload: s.payload,
						callback: s.callback,
						next: null
					}, u === null ? (l = u = p, c = d) : u = u.next = p, o |= f;
					if (s = s.next, s === null) {
						if (s = i.shared.pending, s === null) break;
						p = s, s = p.next, p.next = null, i.lastBaseUpdate = p, i.shared.pending = null;
					}
				} while (1);
				u === null && (c = d), i.baseState = c, i.firstBaseUpdate = l, i.lastBaseUpdate = u, a === null && (i.shared.lanes = 0), jC |= o, e.lanes = o, e.memoizedState = d;
			}
			fx = null;
		}
		function Aa(e, t) {
			if (typeof e != "function") throw Error("Invalid argument passed as callback. Expected a function. Instead received: " + e);
			e.call(t);
		}
		function ja(e, t) {
			var n = e.shared.hiddenCallbacks;
			if (n !== null) for (e.shared.hiddenCallbacks = null, e = 0; e < n.length; e++) Aa(n[e], t);
		}
		function Ma(e, t) {
			var n = e.callbacks;
			if (n !== null) for (e.callbacks = null, e = 0; e < n.length; e++) Aa(n[e], t);
		}
		function Na(e, t) {
			var n = kC;
			be(hx, n, e), be(mx, t, e), kC = n | t.baseLanes;
		}
		function Pa(e) {
			be(hx, kC, e), be(mx, mx.current, e);
		}
		function Fa(e) {
			kC = hx.current, ye(mx, e), ye(hx, e);
		}
		function Ia(e) {
			var t = e.alternate;
			be(bx, bx.current & vx, e), be(gx, e, e), _x === null && (t === null || mx.current !== null || t.memoizedState !== null) && (_x = e);
		}
		function La(e) {
			be(bx, bx.current, e), be(gx, e, e), _x === null && (_x = e);
		}
		function Ra(e) {
			e.tag === 22 ? (be(bx, bx.current, e), be(gx, e, e), _x === null && (_x = e)) : za(e);
		}
		function za(e) {
			be(bx, bx.current, e), be(gx, gx.current, e);
		}
		function Ba(e) {
			ye(gx, e), _x === e && (_x = null), ye(bx, e);
		}
		function Va(e, t) {
			be(gx, gx.current, e), be(bx, t, e);
		}
		function Ha(e) {
			ye(bx, e), ye(gx, e), _x === e && (_x = null);
		}
		function Ua(e) {
			for (var t = e; t !== null;) {
				if (t.tag === 13) {
					var n = t.memoizedState;
					if (n !== null && (n = n.dehydrated, n === null || L(n) || rp(n))) return t;
				} else if (t.tag === 19 && t.memoizedProps.revealOrder !== "independent") {
					if (t.flags & 128) return t;
				} else if (t.child !== null) {
					t.child.return = t, t = t.child;
					continue;
				}
				if (t === e) break;
				for (; t.sibling === null;) {
					if (t.return === null || t.return === e) return null;
					t = t.return;
				}
				t.sibling.return = t.return, t = t.sibling;
			}
			return null;
		}
		function O() {
			var e = Z;
			Hx === null ? Hx = [e] : Hx.push(e);
		}
		function k() {
			var e = Z;
			if (Hx !== null && (Ux++, Hx[Ux] !== e)) {
				var t = C(X);
				if (!Dx.has(t) && (Dx.add(t), Hx !== null)) {
					for (var n = "", r = 0; r <= Ux; r++) {
						var i = Hx[r], a = r === Ux ? e : i;
						for (i = r + 1 + ". " + i; 30 > i.length;) i += " ";
						i += a + "\n", n += i;
					}
					console.error("React has detected a change in the order of Hooks called by %s. This will lead to bugs and errors if not fixed. For more information, read the Rules of Hooks: https://react.dev/link/rules-of-hooks\n\n   Previous render            Next render\n   ------------------------------------------------------\n%s   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n", t, n);
				}
			}
		}
		function Wa(e) {
			e == null || qm(e) || console.error("%s received a final argument that is not an array (instead, received `%s`). When specified, the final argument must be an array.", Z, typeof e);
		}
		function Ga() {
			var e = C(X);
			Ax.has(e) || (Ax.add(e), console.error("ReactDOM.useFormState has been renamed to React.useActionState. Please update %s to use React.useActionState.", e));
		}
		function Ka() {
			throw Error("Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem.");
		}
		function qa(e, t) {
			if (Wx) return !1;
			if (t === null) return console.error("%s received a final argument during this render, but not during the previous render. Even though the final argument is optional, its type cannot change between renders.", Z), !1;
			e.length !== t.length && console.error("The final argument passed to %s changed size between renders. The order and size of this array must remain constant.\n\nPrevious: %s\nIncoming: %s", Z, "[" + t.join(", ") + "]", "[" + e.join(", ") + "]");
			for (var n = 0; n < t.length && n < e.length; n++) if (!G_(e[n], t[n])) return !1;
			return !0;
		}
		function Ja(e, t, n, r, i, a) {
			jx = a, X = t, Hx = e === null ? null : e._debugHookTypes, Ux = -1, Wx = e !== null && e.type !== t.type, (Object.prototype.toString.call(n) === "[object AsyncFunction]" || Object.prototype.toString.call(n) === "[object AsyncGeneratorFunction]") && (a = C(X), kx.has(a) || (kx.add(a), console.error("%s is an async Client Component. Only Server Components can be async at the moment. This error is often caused by accidentally adding `'use client'` to a module that was originally written for the server.", a === null ? "An unknown Component" : "<" + a + ">"))), t.memoizedState = null, t.updateQueue = null, t.lanes = 0, z.H = e !== null && e.memoizedState !== null ? Jx : Hx === null ? Kx : qx, Ix = a = (t.mode & Vv) !== W;
			var o = Tb(n, r, i);
			if (Ix = !1, Fx && (o = Xa(t, n, r, i)), a) {
				Ge(!0);
				try {
					o = Xa(t, n, r, i);
				} finally {
					Ge(!1);
				}
			}
			return Ya(e, t), o;
		}
		function Ya(e, t) {
			t._debugHookTypes = Hx, t.dependencies === null ? zx !== null && (t.dependencies = {
				lanes: 0,
				firstContext: null,
				_debugThenableState: zx
			}) : t.dependencies._debugThenableState = zx;
			var n = zx;
			if (Kb !== null && la(Kb, t) && (n !== null || qb === null || Jb || (Jb = !0, console.error(qb)), qb = Kb = null), z.H = Gx, n = Mx !== null && Mx.next !== null, jx = 0, Hx = Z = Nx = Mx = X = null, Ux = -1, e !== null && (e.flags & 1206910976) != (t.flags & 1206910976) && console.error("Internal React error: Expected static flag was missing. Please notify the React team."), Px = !1, Rx = 0, zx = null, n) throw Error("Rendered fewer hooks than expected. This may be caused by an accidental early return statement.");
			e === null || mS || (e = e.dependencies, e !== null && Si(e) && (mS = !0)), Xb ? (Xb = !1, e = !0) : e = !1, e && (t = C(t) || "Unknown", Ox.has(t) || kx.has(t) || (Ox.add(t), console.error("`use` was called from inside a try/catch block. This is not allowed and can lead to unexpected behavior. To handle errors triggered by `use`, wrap your component in a error boundary.")));
		}
		function Xa(e, t, n, r) {
			X = e;
			var i = 0;
			do {
				if (Fx && (zx = null), Rx = 0, Fx = !1, i >= Vx) throw Error("Too many re-renders. React limits the number of renders to prevent an infinite loop.");
				if (i += 1, Wx = !1, Nx = Mx = null, e.updateQueue != null) {
					var a = e.updateQueue;
					a.lastEffect = null, a.events = null, a.stores = null, a.memoCache != null && (a.memoCache.index = 0);
				}
				Ux = -1, z.H = Yx, a = Tb(t, n, r);
			} while (Fx);
			return a;
		}
		function Za() {
			var e = z.H, t = e.useState()[0];
			return t = typeof t.then == "function" ? ro(t) : t, e = e.useState()[0], (Mx === null ? null : Mx.memoizedState) !== e && (X.flags |= 1024), t;
		}
		function Qa() {
			var e = Lx !== 0;
			return Lx = 0, e;
		}
		function $a(e, t, n) {
			t.updateQueue = e.updateQueue, t.flags = (t.mode & Hv) === W ? t.flags & -2053 : t.flags & -805308421, e.lanes &= ~n;
		}
		function eo(e) {
			if (Px) {
				for (e = e.memoizedState; e !== null;) {
					var t = e.queue;
					t !== null && (t.pending = null), e = e.next;
				}
				Px = !1;
			}
			jx = 0, Hx = Nx = Mx = X = null, Ux = -1, Z = null, Fx = !1, Rx = Lx = 0, zx = null;
		}
		function to() {
			var e = {
				memoizedState: null,
				baseState: null,
				baseQueue: null,
				queue: null,
				next: null
			};
			return Nx === null ? X.memoizedState = Nx = e : Nx = Nx.next = e, Nx;
		}
		function A() {
			if (Mx === null) {
				var e = X.alternate;
				e = e === null ? null : e.memoizedState;
			} else e = Mx.next;
			var t = Nx === null ? X.memoizedState : Nx.next;
			if (t !== null) Nx = t, Mx = e;
			else {
				if (e === null) throw X.alternate === null ? Error("Update hook called on initial render. This is likely a bug in React. Please file an issue.") : Error("Rendered more hooks than during the previous render.");
				Mx = e, e = {
					memoizedState: Mx.memoizedState,
					baseState: Mx.baseState,
					baseQueue: Mx.baseQueue,
					queue: Mx.queue,
					next: null
				}, Nx === null ? X.memoizedState = Nx = e : Nx = Nx.next = e;
			}
			return Nx;
		}
		function no() {
			return {
				lastEffect: null,
				events: null,
				stores: null,
				memoCache: null
			};
		}
		function ro(e) {
			var t = Rx;
			return Rx += 1, zx === null && (zx = ra()), e = aa(zx, e, t, X), t = X, (Nx === null ? t.memoizedState : Nx.next) === null && (t = t.alternate, z.H = t !== null && t.memoizedState !== null ? Jx : Kx), e;
		}
		function io(e) {
			if (typeof e == "object" && e) {
				if (typeof e.then == "function") return ro(e);
				if (e.$$typeof === Wm) return;
				if (e.$$typeof === Pm) return wi(e);
			}
			throw Error("An unsupported type was passed to use(): " + String(e));
		}
		function ao(e) {
			var t = null, n = X.updateQueue;
			if (n !== null && (t = n.memoCache), t == null) {
				var r = X.alternate;
				r !== null && (r = r.updateQueue, r !== null && (r = r.memoCache, r != null && (t = {
					data: r.data.map(function(e) {
						return e.slice();
					}),
					index: 0
				})));
			}
			if (t ??= {
				data: [],
				index: 0
			}, n === null && (n = no(), X.updateQueue = n), n.memoCache = t, n = t.data[t.index], n === void 0 || Wx) for (n = t.data[t.index] = Array(e), r = 0; r < e; r++) n[r] = Hm;
			else n.length !== e && console.error("Expected a constant size argument for each invocation of useMemoCache. The previous cache was allocated with size %s but size %s was requested.", n.length, e);
			return t.index++, n;
		}
		function oo(e, t) {
			return typeof t == "function" ? t(e) : t;
		}
		function so(e, t, n) {
			var r = to();
			if (n !== void 0) {
				var i = n(t);
				if (Ix) {
					Ge(!0);
					try {
						n(t);
					} finally {
						Ge(!1);
					}
				}
			} else i = t;
			return r.memoizedState = r.baseState = i, e = {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: e,
				lastRenderedState: i
			}, r.queue = e, e = e.dispatch = hs.bind(null, X, e), [r.memoizedState, e];
		}
		function co(e) {
			return lo(A(), Mx, e);
		}
		function lo(e, t, n) {
			var r = e.queue;
			if (r === null) throw Error("Should have a queue. You are likely calling Hooks conditionally, which is not allowed. (https://react.dev/link/invalid-hook-call)");
			r.lastRenderedReducer = n;
			var i = e.baseQueue, a = r.pending;
			if (a !== null) {
				if (i !== null) {
					var o = i.next;
					i.next = a.next, a.next = o;
				}
				t.baseQueue !== i && console.error("Internal error: Expected work-in-progress queue to be a clone. This is a bug in React."), t.baseQueue = i = a, r.pending = null;
			}
			if (a = e.baseState, i === null) e.memoizedState = a;
			else {
				t = i.next;
				var s = o = null, c = null, l = t, u = !1;
				do {
					var d = l.lane & -536870913;
					if (d === l.lane ? (jx & d) === d : ($ & d) === d) {
						var f = l.revertLane;
						if (f === 0) c !== null && (c = c.next = {
							lane: 0,
							revertLane: 0,
							gesture: null,
							action: l.action,
							hasEagerState: l.hasEagerState,
							eagerState: l.eagerState,
							next: null
						}), d === lb && (u = !0);
						else if ((jx & f) === f) {
							l = l.next, f === lb && (u = !0);
							continue;
						} else d = {
							lane: 0,
							revertLane: l.revertLane,
							gesture: null,
							action: l.action,
							hasEagerState: l.hasEagerState,
							eagerState: l.eagerState,
							next: null
						}, c === null ? (s = c = d, o = a) : c = c.next = d, X.lanes |= f, jC |= f;
						d = l.action, Ix && n(a, d), a = l.hasEagerState ? l.eagerState : n(a, d);
					} else f = {
						lane: d,
						revertLane: l.revertLane,
						gesture: l.gesture,
						action: l.action,
						hasEagerState: l.hasEagerState,
						eagerState: l.eagerState,
						next: null
					}, c === null ? (s = c = f, o = a) : c = c.next = f, X.lanes |= d, jC |= d;
					l = l.next;
				} while (l !== null && l !== t);
				if (c === null ? o = a : c.next = s, !G_(a, e.memoizedState) && (mS = !0, u && (n = ub, n !== null))) throw n;
				e.memoizedState = a, e.baseState = o, e.baseQueue = c, r.lastRenderedState = a;
			}
			return i === null && (r.lanes = 0), [e.memoizedState, r.dispatch];
		}
		function uo(e) {
			var t = A(), n = t.queue;
			if (n === null) throw Error("Should have a queue. You are likely calling Hooks conditionally, which is not allowed. (https://react.dev/link/invalid-hook-call)");
			n.lastRenderedReducer = e;
			var r = n.dispatch, i = n.pending, a = t.memoizedState;
			if (i !== null) {
				n.pending = null;
				var o = i = i.next;
				do
					a = e(a, o.action), o = o.next;
				while (o !== i);
				G_(a, t.memoizedState) || (mS = !0), t.memoizedState = a, t.baseQueue === null && (t.baseState = a), n.lastRenderedState = a;
			}
			return [a, r];
		}
		function fo(e, t, n) {
			var r = X, i = to();
			if (K) {
				if (n === void 0) throw Error("Missing getServerSnapshot, which is required for server-rendered content. Will revert to client rendering.");
				var a = n();
				Ex || a === n() || (console.error("The result of getServerSnapshot should be cached to avoid an infinite loop"), Ex = !0);
			} else {
				if (a = t(), Ex || (n = t(), G_(a, n) || (console.error("The result of getSnapshot should be cached to avoid an infinite loop"), Ex = !0)), pC === null) throw Error("Expected a work-in-progress root. This is a bug in React. Please file an issue.");
				$ & 127 || mo(r, t, a);
			}
			return i.memoizedState = a, n = {
				value: a,
				getSnapshot: t
			}, i.queue = n, Vo(go.bind(null, r, n, e), [e]), r.flags |= 2048, Lo(Sx | Tx, { destroy: void 0 }, ho.bind(null, r, n, a, t), null), a;
		}
		function po(e, t, n) {
			var r = X, i = A(), a = K;
			if (a) {
				if (n === void 0) throw Error("Missing getServerSnapshot, which is required for server-rendered content. Will revert to client rendering.");
				n = n();
			} else if (n = t(), !Ex) {
				var o = t();
				G_(n, o) || (console.error("The result of getSnapshot should be cached to avoid an infinite loop"), Ex = !0);
			}
			if ((o = !G_((Mx || i).memoizedState, n)) && (i.memoizedState = n, mS = !0), i = i.queue, Bo(2048, Tx, go.bind(null, r, i, e), [e]), e = i.getSnapshot !== t || o || Nx !== null && (Nx.memoizedState.tag & Sx) !== xx, Lo(e ? Sx | Tx : Tx, { destroy: void 0 }, ho.bind(null, r, i, n, t), null), e) {
				if (r.flags |= 2048, pC === null) throw Error("Expected a work-in-progress root. This is a bug in React. Please file an issue.");
				a || jx & 127 || mo(r, t, n);
			}
			return n;
		}
		function mo(e, t, n) {
			e.flags |= 16384, e = {
				getSnapshot: t,
				value: n
			}, t = X.updateQueue, t === null ? (t = no(), X.updateQueue = t, t.stores = [e]) : (n = t.stores, n === null ? t.stores = [e] : n.push(e));
		}
		function ho(e, t, n, r) {
			t.value = n, t.getSnapshot = r, _o(t) && vo(e);
		}
		function go(e, t, n) {
			return n(function() {
				_o(t) && (Mi(2, "updateSyncExternalStore()", e), vo(e));
			});
		}
		function _o(e) {
			var t = e.getSnapshot;
			e = e.value;
			try {
				var n = t();
				return !G_(e, n);
			} catch {
				return !0;
			}
		}
		function vo(e) {
			var t = Pr(e, 2);
			t !== null && ou(t, e, 2);
		}
		function yo(e) {
			var t = to();
			if (typeof e == "function") {
				var n = e;
				if (e = n(), Ix) {
					Ge(!0);
					try {
						n();
					} finally {
						Ge(!1);
					}
				}
			}
			return t.memoizedState = t.baseState = e, t.queue = {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: oo,
				lastRenderedState: e
			}, t;
		}
		function bo(e) {
			e = yo(e);
			var t = e.queue, n = gs.bind(null, X, t);
			return t.dispatch = n, [e.memoizedState, n];
		}
		function xo(e) {
			var t = to();
			t.memoizedState = t.baseState = e;
			var n = {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: null,
				lastRenderedState: null
			};
			return t.queue = n, t = vs.bind(null, X, !0, n), n.dispatch = t, [e, t];
		}
		function So(e, t) {
			return Co(A(), Mx, e, t);
		}
		function Co(e, t, n, r) {
			return e.baseState = n, lo(e, Mx, typeof r == "function" ? r : oo);
		}
		function wo(e, t) {
			var n = A();
			return Mx === null ? (n.baseState = e, [e, n.queue.dispatch]) : Co(n, Mx, e, t);
		}
		function To(e, t, n, r, i) {
			if (ys(e)) throw Error("Cannot update action state while rendering.");
			if (e = t.action, e !== null) {
				var a = {
					payload: i,
					action: e,
					next: null,
					isTransition: !0,
					status: "pending",
					value: null,
					reason: null,
					listeners: [],
					then: function(e) {
						a.listeners.push(e);
					}
				};
				z.T === null ? a.isTransition = !1 : n(!0), r(a), n = t.pending, n === null ? (a.next = t.pending = a, Eo(t, a)) : (a.next = n.next, t.pending = n.next = a);
			}
		}
		function Eo(e, t) {
			var n = t.action, r = t.payload, i = e.state;
			if (t.isTransition) {
				var a = z.T, o = {};
				o.types = a === null ? null : a.types, o._updatedFibers = /* @__PURE__ */ new Set(), z.T = o;
				try {
					var s = n(i, r), c = z.S;
					c !== null && c(o, s), Do(e, t, s);
				} catch (n) {
					ko(e, t, n);
				} finally {
					a !== null && o.types !== null && (a.types !== null && a.types !== o.types && console.error("We expected inner Transitions to have transferred the outer types set and that you cannot add to the outer Transition while inside the inner.This is a bug in React."), a.types = o.types), z.T = a, a === null && o._updatedFibers && (e = o._updatedFibers.size, o._updatedFibers.clear(), 10 < e && console.warn("Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table."));
				}
			} else try {
				o = n(i, r), Do(e, t, o);
			} catch (n) {
				ko(e, t, n);
			}
		}
		function Do(e, t, n) {
			typeof n == "object" && n && typeof n.then == "function" ? (z.asyncTransitions++, n.then(rs, rs), n.then(function(n) {
				Oo(e, t, n);
			}, function(n) {
				return ko(e, t, n);
			}), t.isTransition || console.error("An async function with useActionState was called outside of a transition. This is likely not what you intended (for example, isPending will not update correctly). Either call the returned function inside startTransition, or pass it to an `action` or `formAction` prop.")) : Oo(e, t, n);
		}
		function Oo(e, t, n) {
			t.status = "fulfilled", t.value = n, Ao(t), e.state = n, t = e.pending, t !== null && (n = t.next, n === t ? e.pending = null : (n = n.next, t.next = n, Eo(e, n)));
		}
		function ko(e, t, n) {
			var r = e.pending;
			if (e.pending = null, r !== null) {
				r = r.next;
				do
					t.status = "rejected", t.reason = n, Ao(t), t = t.next;
				while (t !== r);
			}
			e.action = null;
		}
		function Ao(e) {
			e = e.listeners;
			for (var t = 0; t < e.length; t++) (0, e[t])();
		}
		function jo(e, t) {
			return t;
		}
		function Mo(e, t) {
			if (K) {
				var n = pC.formState;
				if (n !== null) {
					a: {
						var r = X;
						if (K) {
							if (ny) {
								b: {
									for (var i = ny, a = oy; i.nodeType !== 8;) {
										if (!a) {
											i = null;
											break b;
										}
										if (i = ap(i.nextSibling), i === null) {
											i = null;
											break b;
										}
									}
									a = i.data, i = a === pT || a === mT ? i : null;
								}
								if (i) {
									ny = ap(i.nextSibling), r = i.data === pT;
									break a;
								}
							}
							ci(r);
						}
						r = !1;
					}
					r && (t = n[0]);
				}
			}
			return n = to(), n.memoizedState = n.baseState = t, r = {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: jo,
				lastRenderedState: t
			}, n.queue = r, n = gs.bind(null, X, r), r.dispatch = n, r = yo(!1), a = vs.bind(null, X, !1, r.queue), r = to(), i = {
				state: t,
				dispatch: null,
				action: e,
				pending: null
			}, r.queue = i, n = To.bind(null, X, i, a, n), i.dispatch = n, r.memoizedState = e, [
				t,
				n,
				!1
			];
		}
		function No(e) {
			return Po(A(), Mx, e);
		}
		function Po(e, t, n) {
			if (t = lo(e, t, jo)[0], e = co(oo)[0], typeof t == "object" && t && typeof t.then == "function") try {
				var r = ro(t);
			} catch (e) {
				throw e === Hb ? Wb : e;
			}
			else r = t;
			t = A();
			var i = t.queue, a = i.dispatch;
			return n !== t.memoizedState && (X.flags |= 2048, Lo(Sx | Tx, { destroy: void 0 }, Fo.bind(null, i, n), null)), [
				r,
				a,
				e
			];
		}
		function Fo(e, t) {
			e.action = t;
		}
		function Io(e) {
			var t = A(), n = Mx;
			if (n !== null) return Po(t, n, e);
			A(), t = t.memoizedState, n = A();
			var r = n.queue.dispatch;
			return n.memoizedState = e, [
				t,
				r,
				!1
			];
		}
		function Lo(e, t, n, r) {
			return e = {
				tag: e,
				create: n,
				deps: r,
				inst: t,
				next: null
			}, t = X.updateQueue, t === null && (t = no(), X.updateQueue = t), n = t.lastEffect, n === null ? t.lastEffect = e.next = e : (r = n.next, n.next = e, e.next = r, t.lastEffect = e), e;
		}
		function Ro(e) {
			var t = to();
			return e = { current: e }, t.memoizedState = e;
		}
		function zo(e, t, n, r) {
			var i = to();
			X.flags |= e, i.memoizedState = Lo(Sx | t, { destroy: void 0 }, n, r === void 0 ? null : r);
		}
		function Bo(e, t, n, r) {
			var i = A();
			r = r === void 0 ? null : r;
			var a = i.memoizedState.inst;
			Mx !== null && r !== null && qa(r, Mx.memoizedState.deps) ? i.memoizedState = Lo(t, a, n, r) : (X.flags |= e, i.memoizedState = Lo(Sx | t, a, n, r));
		}
		function Vo(e, t) {
			(X.mode & Hv) === W ? zo(8390656, Tx, e, t) : zo(545261568, Tx, e, t);
		}
		function Ho(e) {
			X.flags |= 4;
			var t = X.updateQueue;
			if (t === null) t = no(), X.updateQueue = t, t.events = [e];
			else {
				var n = t.events;
				n === null ? t.events = [e] : n.push(e);
			}
		}
		function Uo(e) {
			var t = to(), n = { impl: e };
			return t.memoizedState = n, function() {
				if ((fC & rC) !== nC) throw Error("A function wrapped in useEffectEvent can't be called during rendering.");
				return n.impl.apply(void 0, arguments);
			};
		}
		function Wo(e) {
			var t = A().memoizedState;
			return Ho({
				ref: t,
				nextImpl: e
			}), function() {
				if ((fC & rC) !== nC) throw Error("A function wrapped in useEffectEvent can't be called during rendering.");
				return t.impl.apply(void 0, arguments);
			};
		}
		function Go(e, t) {
			var n = 4194308;
			return (X.mode & Hv) !== W && (n |= 268435456), zo(n, wx, e, t);
		}
		function Ko(e, t) {
			if (typeof t == "function") {
				e = e();
				var n = t(e);
				return function() {
					typeof n == "function" ? n() : t(null);
				};
			}
			if (t != null) return t.hasOwnProperty("current") || console.error("Expected useImperativeHandle() first argument to either be a ref callback or React.createRef() object. Instead received: %s.", "an object with keys {" + Object.keys(t).join(", ") + "}"), e = e(), t.current = e, function() {
				t.current = null;
			};
		}
		function qo(e, t, n) {
			typeof t != "function" && console.error("Expected useImperativeHandle() second argument to be a function that creates a handle. Instead received: %s.", t === null ? "null" : typeof t), n = n == null ? null : n.concat([e]);
			var r = 4194308;
			(X.mode & Hv) !== W && (r |= 268435456), zo(r, wx, Ko.bind(null, t, e), n);
		}
		function Jo(e, t, n) {
			typeof t != "function" && console.error("Expected useImperativeHandle() second argument to be a function that creates a handle. Instead received: %s.", t === null ? "null" : typeof t), n = n == null ? null : n.concat([e]), Bo(4, wx, Ko.bind(null, t, e), n);
		}
		function Yo(e, t) {
			return to().memoizedState = [e, t === void 0 ? null : t], e;
		}
		function Xo(e, t) {
			var n = A();
			t = t === void 0 ? null : t;
			var r = n.memoizedState;
			return t !== null && qa(t, r[1]) ? r[0] : (n.memoizedState = [e, t], e);
		}
		function Zo(e, t) {
			var n = to();
			t = t === void 0 ? null : t;
			var r = e();
			if (Ix) {
				Ge(!0);
				try {
					e();
				} finally {
					Ge(!1);
				}
			}
			return n.memoizedState = [r, t], r;
		}
		function Qo(e, t) {
			var n = A();
			t = t === void 0 ? null : t;
			var r = n.memoizedState;
			if (t !== null && qa(t, r[1])) return r[0];
			if (r = e(), Ix) {
				Ge(!0);
				try {
					e();
				} finally {
					Ge(!1);
				}
			}
			return n.memoizedState = [r, t], r;
		}
		function j(e, t) {
			return ts(to(), e, t);
		}
		function $o(e, t) {
			return ns(A(), Mx.memoizedState, e, t);
		}
		function es(e, t) {
			var n = A();
			return Mx === null ? ts(n, e, t) : ns(n, Mx.memoizedState, e, t);
		}
		function ts(e, t, n) {
			return n === void 0 || jx & 1073741824 && !($ & 261930) ? e.memoizedState = t : (e.memoizedState = n, e = iu(), X.lanes |= e, jC |= e, n);
		}
		function ns(e, t, n, r) {
			return G_(n, t) ? n : mx.current === null ? !(jx & 106) || jx & 1073741824 && !($ & 261930) ? (mS = !0, e.memoizedState = n) : (e = iu(), X.lanes |= e, jC |= e, t) : (e = ts(e, n, r), G_(e, t) || (mS = !0), e);
		}
		function rs() {
			z.asyncTransitions--;
		}
		function is(e, t, n, r, i) {
			var a = B.p;
			B.p = a !== 0 && a < Vh ? a : Vh;
			var o = z.T, s = {};
			s.types = o === null ? null : o.types, s._updatedFibers = /* @__PURE__ */ new Set(), z.T = s, vs(e, !1, t, n);
			try {
				var c = i(), l = z.S;
				if (l !== null && l(s, c), typeof c == "object" && c && typeof c.then == "function") {
					z.asyncTransitions++, c.then(rs, rs);
					var u = $i(c, r);
					_s(e, t, u, ru(e));
				} else _s(e, t, r, ru(e));
			} catch (n) {
				_s(e, t, {
					then: function() {},
					status: "rejected",
					reason: n
				}, ru(e));
			} finally {
				B.p = a, o !== null && s.types !== null && (o.types !== null && o.types !== s.types && console.error("We expected inner Transitions to have transferred the outer types set and that you cannot add to the outer Transition while inside the inner.This is a bug in React."), o.types = s.types), z.T = o, o === null && s._updatedFibers && (e = s._updatedFibers.size, s._updatedFibers.clear(), 10 < e && console.warn("Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table."));
			}
		}
		function as(e, t, n, r) {
			if (e.tag !== 5) throw Error("Expected the form instance to be a HostComponent. This is a bug in React.");
			var i = os(e).queue;
			Ni(e), is(e, i, t, QT, n === null ? p : function() {
				return ss(e), n(r);
			});
		}
		function os(e) {
			var t = e.memoizedState;
			if (t !== null) return t;
			t = {
				memoizedState: QT,
				baseState: QT,
				baseQueue: null,
				queue: {
					pending: null,
					lanes: 0,
					dispatch: null,
					lastRenderedReducer: oo,
					lastRenderedState: QT
				},
				next: null
			};
			var n = {};
			return t.next = {
				memoizedState: n,
				baseState: n,
				baseQueue: null,
				queue: {
					pending: null,
					lanes: 0,
					dispatch: null,
					lastRenderedReducer: oo,
					lastRenderedState: n
				},
				next: null
			}, e.memoizedState = t, e = e.alternate, e !== null && (e.memoizedState = t), t;
		}
		function ss(e) {
			z.T === null && console.error("requestFormReset was called outside a transition or action. To fix, move to an action, or wrap with startTransition.");
			var t = os(e);
			t.next === null && (t = e.alternate.memoizedState), _s(e, t.next.queue, {}, ru(e));
		}
		function cs() {
			var e = yo(!1);
			return e = is.bind(null, X, e.queue, !0, !1), to().memoizedState = e, [!1, e];
		}
		function ls() {
			var e = co(oo)[0], t = A().memoizedState;
			return [typeof e == "boolean" ? e : ro(e), t];
		}
		function us() {
			var e = uo(oo)[0], t = A().memoizedState;
			return [typeof e == "boolean" ? e : ro(e), t];
		}
		function ds() {
			return wi($T);
		}
		function fs() {
			var e = to(), t = pC.identifierPrefix;
			if (K) {
				var n = ey, r = $v;
				n = (r & ~(1 << 32 - Ph(r) - 1)).toString(32) + n, t = "_" + t + "R_" + n, n = Lx++, 0 < n && (t += "H" + n.toString(32)), t += "_";
			} else n = Bx++, t = "_" + t + "r_" + n.toString(32) + "_";
			return e.memoizedState = t;
		}
		function ps() {
			return to().memoizedState = ms.bind(null, X);
		}
		function ms(e, t) {
			for (var n = e.return; n !== null;) {
				switch (n.tag) {
					case 24:
					case 3:
						var r = ru(n), i = wa(r), a = Ta(n, i, r);
						a !== null && (Mi(r, "refresh()", e), ou(a, n, r), Ea(a, n, r)), e = Di(), t != null && a !== null && console.error("The seed argument is not enabled outside experimental channels."), i.payload = { cache: e };
						return;
				}
				n = n.return;
			}
		}
		function hs(e, t, n) {
			var r = arguments;
			typeof r[3] == "function" && console.error("State updates from the useState() and useReducer() Hooks don't support the second callback argument. To execute a side effect after rendering, declare it in the component body with useEffect()."), r = ru(e);
			var i = {
				lane: r,
				revertLane: 0,
				gesture: null,
				action: n,
				hasEagerState: !1,
				eagerState: null,
				next: null
			};
			ys(e) ? bs(t, i) : (i = Nr(e, t, i, r), i !== null && (Mi(r, "dispatch()", e), ou(i, e, r), xs(i, t, r)));
		}
		function gs(e, t, n) {
			var r = arguments;
			typeof r[3] == "function" && console.error("State updates from the useState() and useReducer() Hooks don't support the second callback argument. To execute a side effect after rendering, declare it in the component body with useEffect()."), r = ru(e), _s(e, t, n, r) && Mi(r, "setState()", e);
		}
		function _s(e, t, n, r) {
			var i = {
				lane: r,
				revertLane: 0,
				gesture: null,
				action: n,
				hasEagerState: !1,
				eagerState: null,
				next: null
			};
			if (ys(e)) bs(t, i);
			else {
				var a = e.alternate;
				if (e.lanes === 0 && (a === null || a.lanes === 0) && (a = t.lastRenderedReducer, a !== null)) {
					var o = z.H;
					z.H = Zx;
					try {
						var s = t.lastRenderedState, c = a(s, n);
						if (i.hasEagerState = !0, i.eagerState = c, G_(c, s)) return Mr(e, t, i, 0), pC === null && jr(), !1;
					} catch {} finally {
						z.H = o;
					}
				}
				if (n = Nr(e, t, i, r), n !== null) return ou(n, e, r), xs(n, t, r), !0;
			}
			return !1;
		}
		function vs(e, t, n, r) {
			if (z.T === null && lb === 0 && console.error("An optimistic state update occurred outside a transition or action. To fix, move the update to an action, or wrap with startTransition."), r = {
				lane: 2,
				revertLane: pd(),
				gesture: null,
				action: r,
				hasEagerState: !1,
				eagerState: null,
				next: null
			}, ys(e)) {
				if (t) throw Error("Cannot update optimistic state while rendering.");
				console.error("Cannot call startTransition while rendering.");
			} else t = Nr(e, n, r, 2), t !== null && (Mi(2, "setOptimistic()", e), ou(t, e, 2));
		}
		function ys(e) {
			var t = e.alternate;
			return e === X || t !== null && t === X;
		}
		function bs(e, t) {
			Fx = Px = !0;
			var n = e.pending;
			n === null ? t.next = t : (t.next = n.next, n.next = t), e.pending = t;
		}
		function xs(e, t, n) {
			if (n & 4194048) {
				var r = t.lanes;
				r &= e.pendingLanes, n |= r, t.lanes = n, rt(e, n);
			}
		}
		function Ss(e) {
			if (e !== null && typeof e != "function") {
				var t = String(e);
				lS.has(t) || (lS.add(t), console.error("Expected the last optional `callback` argument to be a function. Instead received: %s.", e));
			}
		}
		function Cs(e, t, n, r) {
			var i = e.memoizedState, a = n(r, i);
			if (e.mode & Vv) {
				Ge(!0);
				try {
					a = n(r, i);
				} finally {
					Ge(!1);
				}
			}
			a === void 0 && (t = ge(t) || "Component", aS.has(t) || (aS.add(t), console.error("%s.getDerivedStateFromProps(): A valid state object (or null) must be returned. You have returned undefined.", t))), i = a == null ? i : R({}, i, a), e.memoizedState = i, e.lanes === 0 && (e.updateQueue.baseState = i);
		}
		function ws(e, t, n, r, i, a, o) {
			var s = e.stateNode;
			if (typeof s.shouldComponentUpdate == "function") {
				if (n = s.shouldComponentUpdate(r, a, o), e.mode & Vv) {
					Ge(!0);
					try {
						n = s.shouldComponentUpdate(r, a, o);
					} finally {
						Ge(!1);
					}
				}
				return n === void 0 && console.error("%s.shouldComponentUpdate(): Returned undefined instead of a boolean value. Make sure to return true or false.", ge(t) || "Component"), n;
			}
			return t.prototype && t.prototype.isPureReactComponent ? !$n(n, r) || !$n(i, a) : !0;
		}
		function Ts(e, t, n, r) {
			var i = t.state;
			typeof t.componentWillReceiveProps == "function" && t.componentWillReceiveProps(n, r), typeof t.UNSAFE_componentWillReceiveProps == "function" && t.UNSAFE_componentWillReceiveProps(n, r), t.state !== i && (e = C(e) || "Component", eS.has(e) || (eS.add(e), console.error("%s.componentWillReceiveProps(): Assigning directly to this.state is deprecated (except inside a component's constructor). Use setState instead.", e)), uS.enqueueReplaceState(t, t.state, null));
		}
		function Es(e, t) {
			var n = t;
			if ("ref" in t) for (var r in n = {}, t) r !== "ref" && (n[r] = t[r]);
			if (e = e.defaultProps) for (var i in n === t && (n = R({}, n)), e) n[i] === void 0 && (n[i] = e[i]);
			return n;
		}
		function Ds(e) {
			mv(e), console.warn("%s\n\n%s\n", dS ? "An error occurred in the <" + dS + "> component." : "An error occurred in one of your React components.", "Consider adding an error boundary to your tree to customize error handling behavior.\nVisit https://react.dev/link/error-boundaries to learn more about error boundaries.");
		}
		function Os(e) {
			var t = dS ? "The above error occurred in the <" + dS + "> component." : "The above error occurred in one of your React components.", n = "React will try to recreate this component tree from scratch using the error boundary you provided, " + ((fS || "Anonymous") + ".");
			if (typeof e == "object" && e && typeof e.environmentName == "string") {
				var r = e.environmentName;
				e = [
					"%o\n\n%s\n\n%s\n",
					e,
					t,
					n
				].slice(0), typeof e[0] == "string" ? e.splice(0, 1, eE + " " + e[0], tE, rE + r + rE, nE) : e.splice(0, 0, eE, tE, rE + r + rE, nE), e.unshift(console), r = iE.apply(console.error, e), r();
			} else console.error("%o\n\n%s\n\n%s\n", e, t, n);
		}
		function ks(e) {
			mv(e);
		}
		function As(e, t) {
			try {
				dS = t.source ? C(t.source) : null, fS = null;
				var n = t.value;
				if (z.actQueue !== null) z.thrownErrors.push(n);
				else {
					var r = e.onUncaughtError;
					r(n, { componentStack: t.stack });
				}
			} catch (e) {
				setTimeout(function() {
					throw e;
				});
			}
		}
		function js(e, t, n) {
			try {
				dS = n.source ? C(n.source) : null, fS = C(t);
				var r = e.onCaughtError;
				r(n.value, {
					componentStack: n.stack,
					errorBoundary: t.tag === 1 ? t.stateNode : null
				});
			} catch (e) {
				setTimeout(function() {
					throw e;
				});
			}
		}
		function Ms(e, t, n) {
			return n = wa(n), n.tag = lx, n.payload = { element: null }, n.callback = function() {
				T(t.source, As, e, t);
			}, n;
		}
		function Ns(e) {
			return e = wa(e), e.tag = lx, e;
		}
		function Ps(e, t, n, r) {
			var i = n.type.getDerivedStateFromError;
			if (typeof i == "function") {
				var a = r.value;
				e.payload = function() {
					return i(a);
				}, e.callback = function() {
					zr(n), T(r.source, js, t, n, r);
				};
			}
			var o = n.stateNode;
			o !== null && typeof o.componentDidCatch == "function" && (e.callback = function() {
				zr(n), T(r.source, js, t, n, r), typeof i != "function" && (KC === null ? KC = /* @__PURE__ */ new Set([this]) : KC.add(this)), Nb(this, r), typeof i == "function" || !(n.lanes & 2) && console.error("%s: Error boundaries should implement getDerivedStateFromError(). In that method, return a state update to display an error message or fallback UI.", C(n) || "Unknown");
			});
		}
		function Fs(e, t, n, r, i) {
			if (n.flags |= 32768, Nh && td(e, i), typeof r == "object" && r && typeof r.then == "function") {
				if (t = n.alternate, t !== null && xi(t, n, i, !0), K && (ry = !0), n = gx.current, n !== null) {
					switch (n.tag) {
						case 31:
						case 13:
						case 19: return _x === null ? bu() : n.alternate === null && AC === aC && (AC = cC), n.flags &= -257, n.flags |= 65536, n.lanes = i, r === Gb ? n.flags |= 16384 : (t = n.updateQueue, t === null ? n.updateQueue = /* @__PURE__ */ new Set([r]) : t.add(r), Ku(e, r, i)), !1;
						case 22: return n.flags |= 65536, r === Gb ? n.flags |= 16384 : (t = n.updateQueue, t === null ? (t = {
							transitions: null,
							markerInstances: null,
							retryQueue: /* @__PURE__ */ new Set([r])
						}, n.updateQueue = t) : (n = t.retryQueue, n === null ? t.retryQueue = /* @__PURE__ */ new Set([r]) : n.add(r)), Ku(e, r, i)), !1;
					}
					throw Error("Unexpected Suspense handler tag (" + n.tag + "). This is a bug in React.");
				}
				return Ku(e, r, i), bu(), !1;
			}
			if (K) return ry = !0, t = gx.current, t === null ? (r !== sy && mi(Zr(Error("There was an error while hydrating but React was able to recover by instead client rendering the entire root.", { cause: r }), n)), e = e.current.alternate, e.flags |= 65536, i &= -i, e.lanes |= i, r = Zr(r, n), i = Ms(e.stateNode, r, i), Da(e, i), AC !== lC && (AC = sC)) : (t.tag === 19 && console.error("SuspenseList should never catch while hydrating. This is a bug in React."), !(t.flags & 65536) && (t.flags |= 256), t.flags |= 65536, t.lanes = i, r !== sy && mi(Zr(Error("There was an error while hydrating but React was able to recover by instead client rendering from the nearest Suspense boundary.", { cause: r }), n))), !1;
			var a = Zr(Error("There was an error during concurrent rendering but React was able to recover by instead synchronously rendering the entire root.", { cause: r }), n);
			if (IC === null ? IC = [a] : IC.push(a), AC !== lC && (AC = sC), t === null) return !0;
			r = Zr(r, n), n = t;
			do {
				switch (n.tag) {
					case 3: return n.flags |= 65536, e = i & -i, n.lanes |= e, e = Ms(n.stateNode, r, e), Da(n, e), !1;
					case 1:
						if (t = n.type, a = n.stateNode, !(n.flags & 128) && (typeof t.getDerivedStateFromError == "function" || a !== null && typeof a.componentDidCatch == "function" && (KC === null || !KC.has(a)))) return n.flags |= 65536, i &= -i, n.lanes |= i, i = Ns(i), Ps(i, e, n, r), Da(n, i), !1;
						break;
					case 22: if (n.memoizedState !== null) return n.flags |= 65536, !1;
				}
				n = n.return;
			} while (n !== null);
			return !1;
		}
		function Is(e, t, n, r) {
			t.child = e === null ? ax(t, null, n, r) : ix(t, e.child, n, r);
		}
		function Ls(e, t, n, r, i) {
			n = n.render;
			var a = Lr(n);
			if (a !== n && (n = a, e !== null && (mS = !0)), a = t.ref, "ref" in r) {
				var o = {};
				for (var s in r) s !== "ref" && (o[s] = r[s]);
			} else o = r;
			return Ci(t), r = Ja(e, t, n, o, a, i), s = Qa(), e !== null && !mS ? ($a(e, t, i), dc(e, t, i)) : (K && s && ei(t), t.flags |= 1, Is(e, t, r, i), t.child);
		}
		function Rs(e, t, n, r, i) {
			if (e === null) {
				var a = n.type;
				return typeof a == "function" && !Hr(a) && a.defaultProps === void 0 && n.compare === null ? (n = Lr(a), t.tag = 15, t.type = n, Zs(t, a), zs(e, t, n, r, i)) : (e = Gr(n.type, null, r, t, t.mode, i), e.ref = t.ref, e.return = t, t.child = e);
			}
			if (a = e.child, !fc(e, i)) {
				var o = a.memoizedProps;
				if (n = n.compare, n = n === null ? $n : n, n(o, r) && e.ref === t.ref) return dc(e, t, i);
			}
			return t.flags |= 1, e = Ur(a, r), e.ref = t.ref, e.return = t, t.child = e;
		}
		function zs(e, t, n, r, i) {
			if (e !== null) {
				var a = e.memoizedProps;
				if ($n(a, r) && e.ref === t.ref && t.type === e.type) {
					if (mS = !1, t.pendingProps = r = a, fc(e, i)) e.flags & 131072 && (mS = !0);
					else return t.lanes = e.lanes, dc(e, t, i);
				}
			}
			return qs(e, t, n, r, i);
		}
		function Bs(e, t, n, r) {
			var i = r.children, a = e === null ? null : e.memoizedState;
			if (e === null && t.stateNode === null && (t.stateNode = {
				_visibility: Mv,
				_pendingMarkers: null,
				_retryCache: null,
				_transitions: null
			}), r.mode === "hidden") {
				if (t.flags & 128) {
					if (a = a === null ? n : a.baseLanes | n, e !== null) {
						for (r = t.child = e.child, i = 0; r !== null;) i = i | r.lanes | r.childLanes, r = r.sibling;
						r = i & ~a;
					} else r = 0, t.child = null;
					return Hs(e, t, a, n, r);
				}
				if (n & 536870912) t.memoizedState = {
					baseLanes: 0,
					cachePool: null
				}, e !== null && ta(t, a === null ? null : a.cachePool), a === null ? Pa(t) : Na(t, a), Ra(t);
				else return r = t.lanes = 536870912, Hs(e, t, a === null ? n : a.baseLanes | n, n, r);
			} else a === null ? (e !== null && ta(t, null), Pa(t), za(t)) : (ta(t, a.cachePool), Na(t, a), za(t), t.memoizedState = null);
			return Is(e, t, i, n), t.child;
		}
		function Vs(e, t) {
			return e !== null && e.tag === 22 || t.stateNode !== null || (t.stateNode = {
				_visibility: Mv,
				_pendingMarkers: null,
				_retryCache: null,
				_transitions: null
			}), t.sibling;
		}
		function Hs(e, t, n, r, i) {
			var a = ea();
			return a = a === null ? null : {
				parent: _y._currentValue,
				pool: a
			}, t.memoizedState = {
				baseLanes: n,
				cachePool: a
			}, e !== null && ta(t, null), Pa(t), Ra(t), e !== null && xi(e, t, r, !0), t.childLanes = i, null;
		}
		function Us(e, t) {
			var n = t.hidden;
			return n !== void 0 && console.error("<Activity> doesn't accept a hidden prop. Use mode=\"hidden\" instead.\n- <Activity %s>\n+ <Activity %s>", !0 === n ? "hidden" : !1 === n ? "hidden={false}" : "hidden={...}", n ? "mode=\"hidden\"" : "mode=\"visible\""), t = nc({
				mode: t.mode,
				children: t.children
			}, e.mode), t.ref = e.ref, e.child = t, t.return = e, t;
		}
		function Ws(e, t, n) {
			return ix(t, e.child, null, n), e = Us(t, t.pendingProps), e.flags |= 2, Ba(t), t.memoizedState = null, e;
		}
		function Gs(e, t, n) {
			var r = t.pendingProps, i = !!(t.flags & 128);
			if (t.flags &= -129, e === null) {
				if (K) {
					if (r.mode === "hidden") return e = Us(t, r), t.lanes = 536870912, e.memoizedState = {
						baseLanes: 0,
						cachePool: null
					}, Vs(null, e);
					if (La(t), (e = ny) ? (n = np(e, oy), n = n !== null && n.data === rT ? n : null, n !== null && (r = {
						dehydrated: n,
						treeContext: ni(),
						retryLane: 536870912,
						hydrationErrors: null
					}, t.memoizedState = r, r = Yr(n), r.return = t, t.child = r, ty = t, ny = null)) : n = null, n === null) throw si(t, e), ci(t);
					return t.lanes = 536870912, null;
				}
				return Us(t, r);
			}
			var a = e.memoizedState;
			if (a !== null) {
				var o = a.dehydrated;
				if (La(t), i) {
					if (t.flags & 256) t.flags &= -257, t = Ws(e, t, n);
					else if (t.memoizedState !== null) t.child = e.child, t.flags |= 128, t = null;
					else throw Error("Client rendering an Activity suspended it again. This is a bug in React.");
				} else if (oi(), n & 536870912 && yu(t), mS || xi(e, t, n, !1), i = (n & e.childLanes) !== 0, mS || i) {
					if (mx.current === null) {
						if (r = pC, r !== null && (o = it(r, n), o !== 0 && o !== a.retryLane)) throw a.retryLane = o, Pr(e, o), ou(r, e, o), pS;
						bu();
					}
					t = Ws(e, t, n);
				} else e = a.treeContext, ny = ap(o.nextSibling), ty = t, K = !0, ay = null, ry = !1, iy = null, oy = !1, e !== null && ri(t, e), t = Us(t, r), t.flags |= 134221824;
				return t;
			}
			return a = e.child, r = {
				mode: r.mode,
				children: r.children
			}, n & 536870912 && (n & e.lanes) !== 0 && yu(t), e = Ur(a, r), e.ref = t.ref, t.child = e, e.return = t, e;
		}
		function Ks(e, t) {
			var n = t.ref;
			if (n === null) e !== null && e.ref !== null && (t.flags |= 4194816);
			else {
				if (typeof n != "function" && typeof n != "object") throw Error("Expected ref to be a function, an object returned by React.createRef(), or undefined/null.");
				(e === null || e.ref !== n) && (t.flags |= 4194816);
			}
		}
		function qs(e, t, n, r, i) {
			if (n.prototype && typeof n.prototype.render == "function") {
				var a = ge(n) || "Unknown";
				hS[a] || (console.error("The <%s /> component appears to have a render method, but doesn't extend React.Component. This is likely to cause errors. Change %s to extend React.Component instead.", a, a), hS[a] = !0);
			}
			return t.mode & Vv && pb.recordLegacyContextWarning(t, null), e === null && (Zs(t, t.type), n.contextTypes && (a = ge(n) || "Unknown", _S[a] || (_S[a] = !0, console.error("%s uses the legacy contextTypes API which was removed in React 19. Use React.createContext() with React.useContext() instead. (https://react.dev/link/legacy-context)", a)))), Ci(t), n = Ja(e, t, n, r, void 0, i), r = Qa(), e !== null && !mS ? ($a(e, t, i), dc(e, t, i)) : (K && r && ei(t), t.flags |= 1, Is(e, t, n, i), t.child);
		}
		function Js(e, t, n, r, i, a) {
			return Ci(t), Ux = -1, Wx = e !== null && e.type !== t.type, t.updateQueue = null, n = Xa(t, r, n, i), Ya(e, t), r = Qa(), e !== null && !mS ? ($a(e, t, a), dc(e, t, a)) : (K && r && ei(t), t.flags |= 1, Is(e, t, n, a), t.child);
		}
		function Ys(e, t, n, r, i) {
			switch (c(t)) {
				case !1:
					var a = t.stateNode, o = new t.type(t.memoizedProps, a.context).state;
					a.updater.enqueueSetState(a, o, null);
					break;
				case !0:
					t.flags |= 128, t.flags |= 65536, a = Error("Simulated error coming from DevTools");
					var s = i & -i;
					if (t.lanes |= s, o = pC, o === null) throw Error("Expected a work-in-progress root. This is a bug in React. Please file an issue.");
					s = Ns(s), Ps(s, o, t, Zr(a, t)), Da(t, s);
			}
			if (Ci(t), t.stateNode === null) {
				if (o = Lv, a = n.contextType, "contextType" in n && a !== null && (a === void 0 || a.$$typeof !== Pm) && !cS.has(n) && (cS.add(n), s = a === void 0 ? " However, it is set to undefined. This can be caused by a typo or by mixing up named and default imports. This can also happen due to a circular dependency, so try moving the createContext() call to a separate file." : typeof a == "object" ? a.$$typeof === Nm ? " Did you accidentally pass the Context.Consumer instead?" : " However, it is set to an object with keys {" + Object.keys(a).join(", ") + "}." : " However, it is set to a " + typeof a + ".", console.error("%s defines an invalid contextType. contextType should point to the Context object returned by React.createContext().%s", ge(n) || "Component", s)), typeof a == "object" && a && (o = wi(a)), a = new n(r, o), t.mode & Vv) {
					Ge(!0);
					try {
						a = new n(r, o);
					} finally {
						Ge(!1);
					}
				}
				if (o = t.memoizedState = a.state !== null && a.state !== void 0 ? a.state : null, a.updater = uS, t.stateNode = a, a._reactInternals = t, a._reactInternalInstance = $x, typeof n.getDerivedStateFromProps == "function" && o === null && (o = ge(n) || "Component", tS.has(o) || (tS.add(o), console.error("`%s` uses `getDerivedStateFromProps` but its initial state is %s. This is not recommended. Instead, define the initial state by assigning an object to `this.state` in the constructor of `%s`. This ensures that `getDerivedStateFromProps` arguments have a consistent shape.", o, a.state === null ? "null" : "undefined", o))), typeof n.getDerivedStateFromProps == "function" || typeof a.getSnapshotBeforeUpdate == "function") {
					var l = s = o = null;
					if (typeof a.componentWillMount == "function" && !0 !== a.componentWillMount.__suppressDeprecationWarning ? o = "componentWillMount" : typeof a.UNSAFE_componentWillMount == "function" && (o = "UNSAFE_componentWillMount"), typeof a.componentWillReceiveProps == "function" && !0 !== a.componentWillReceiveProps.__suppressDeprecationWarning ? s = "componentWillReceiveProps" : typeof a.UNSAFE_componentWillReceiveProps == "function" && (s = "UNSAFE_componentWillReceiveProps"), typeof a.componentWillUpdate == "function" && !0 !== a.componentWillUpdate.__suppressDeprecationWarning ? l = "componentWillUpdate" : typeof a.UNSAFE_componentWillUpdate == "function" && (l = "UNSAFE_componentWillUpdate"), o !== null || s !== null || l !== null) {
						a = ge(n) || "Component";
						var u = typeof n.getDerivedStateFromProps == "function" ? "getDerivedStateFromProps()" : "getSnapshotBeforeUpdate()";
						rS.has(a) || (rS.add(a), console.error("Unsafe legacy lifecycles will not be called for components using new component APIs.\n\n%s uses %s but also contains the following legacy lifecycles:%s%s%s\n\nThe above lifecycles should be removed. Learn more about this warning here:\nhttps://react.dev/link/unsafe-component-lifecycles", a, u, o === null ? "" : "\n  " + o, s === null ? "" : "\n  " + s, l === null ? "" : "\n  " + l));
					}
				}
				a = t.stateNode, o = ge(n) || "Component", a.render || (n.prototype && typeof n.prototype.render == "function" ? console.error("No `render` method found on the %s instance: did you accidentally return an object from the constructor?", o) : console.error("No `render` method found on the %s instance: you may have forgotten to define `render`.", o)), !a.getInitialState || a.getInitialState.isReactClassApproved || a.state || console.error("getInitialState was defined on %s, a plain JavaScript class. This is only supported for classes created using React.createClass. Did you mean to define a state property instead?", o), a.getDefaultProps && !a.getDefaultProps.isReactClassApproved && console.error("getDefaultProps was defined on %s, a plain JavaScript class. This is only supported for classes created using React.createClass. Use a static property to define defaultProps instead.", o), a.contextType && console.error("contextType was defined as an instance property on %s. Use a static property to define contextType instead.", o), n.childContextTypes && !sS.has(n) && (sS.add(n), console.error("%s uses the legacy childContextTypes API which was removed in React 19. Use React.createContext() instead. (https://react.dev/link/legacy-context)", o)), n.contextTypes && !oS.has(n) && (oS.add(n), console.error("%s uses the legacy contextTypes API which was removed in React 19. Use React.createContext() with static contextType instead. (https://react.dev/link/legacy-context)", o)), typeof a.componentShouldUpdate == "function" && console.error("%s has a method called componentShouldUpdate(). Did you mean shouldComponentUpdate()? The name is phrased as a question because the function is expected to return a value.", o), n.prototype && n.prototype.isPureReactComponent && a.shouldComponentUpdate !== void 0 && console.error("%s has a method called shouldComponentUpdate(). shouldComponentUpdate should not be used when extending React.PureComponent. Please extend React.Component if shouldComponentUpdate is used.", ge(n) || "A pure component"), typeof a.componentDidUnmount == "function" && console.error("%s has a method called componentDidUnmount(). But there is no such lifecycle method. Did you mean componentWillUnmount()?", o), typeof a.componentDidReceiveProps == "function" && console.error("%s has a method called componentDidReceiveProps(). But there is no such lifecycle method. If you meant to update the state in response to changing props, use componentWillReceiveProps(). If you meant to fetch data or run side-effects or mutations after React has updated the UI, use componentDidUpdate().", o), typeof a.componentWillRecieveProps == "function" && console.error("%s has a method called componentWillRecieveProps(). Did you mean componentWillReceiveProps()?", o), typeof a.UNSAFE_componentWillRecieveProps == "function" && console.error("%s has a method called UNSAFE_componentWillRecieveProps(). Did you mean UNSAFE_componentWillReceiveProps()?", o), s = a.props !== r, a.props !== void 0 && s && console.error("When calling super() in `%s`, make sure to pass up the same props that your component's constructor was passed.", o), a.defaultProps && console.error("Setting defaultProps as an instance property on %s is not supported and will be ignored. Instead, define defaultProps as a static property on %s.", o, o), typeof a.getSnapshotBeforeUpdate != "function" || typeof a.componentDidUpdate == "function" || nS.has(n) || (nS.add(n), console.error("%s: getSnapshotBeforeUpdate() should be used with componentDidUpdate(). This component defines getSnapshotBeforeUpdate() only.", ge(n))), typeof a.getDerivedStateFromProps == "function" && console.error("%s: getDerivedStateFromProps() is defined as an instance method and will be ignored. Instead, declare it as a static method.", o), typeof a.getDerivedStateFromError == "function" && console.error("%s: getDerivedStateFromError() is defined as an instance method and will be ignored. Instead, declare it as a static method.", o), typeof n.getSnapshotBeforeUpdate == "function" && console.error("%s: getSnapshotBeforeUpdate() is defined as a static method and will be ignored. Instead, declare it as an instance method.", o), (s = a.state) && (typeof s != "object" || qm(s)) && console.error("%s.state: must be set to an object or null", o), typeof a.getChildContext == "function" && typeof n.childContextTypes != "object" && console.error("%s.getChildContext(): childContextTypes must be defined in order to use getChildContext().", o), a = t.stateNode, a.props = r, a.state = t.memoizedState, a.refs = {}, Sa(t), o = n.contextType, a.context = typeof o == "object" && o ? wi(o) : Lv, a.state === r && (o = ge(n) || "Component", iS.has(o) || (iS.add(o), console.error("%s: It is not recommended to assign props directly to state because updates to props won't be reflected in state. In most cases, it is better to use props directly.", o))), t.mode & Vv && pb.recordLegacyContextWarning(t, a), pb.recordUnsafeLifecycleWarnings(t, a), a.state = t.memoizedState, o = n.getDerivedStateFromProps, typeof o == "function" && (Cs(t, n, o, r), a.state = t.memoizedState), typeof n.getDerivedStateFromProps == "function" || typeof a.getSnapshotBeforeUpdate == "function" || typeof a.UNSAFE_componentWillMount != "function" && typeof a.componentWillMount != "function" || (o = a.state, typeof a.componentWillMount == "function" && a.componentWillMount(), typeof a.UNSAFE_componentWillMount == "function" && a.UNSAFE_componentWillMount(), o !== a.state && (console.error("%s.componentWillMount(): Assigning directly to this.state is deprecated (except inside a component's constructor). Use setState instead.", C(t) || "Component"), uS.enqueueReplaceState(a, a.state, null)), ka(t, r, a, i), Oa(), a.state = t.memoizedState), typeof a.componentDidMount == "function" && (t.flags |= 4194308), (t.mode & Hv) !== W && (t.flags |= 268435456), a = !0;
			} else if (e === null) {
				a = t.stateNode;
				var d = t.memoizedProps;
				s = Es(n, d), a.props = s;
				var f = a.context;
				l = n.contextType, o = Lv, typeof l == "object" && l && (o = wi(l)), u = n.getDerivedStateFromProps, l = typeof u == "function" || typeof a.getSnapshotBeforeUpdate == "function", d = t.pendingProps !== d, l || typeof a.UNSAFE_componentWillReceiveProps != "function" && typeof a.componentWillReceiveProps != "function" || (d || f !== o) && Ts(t, a, r, o), ux = !1;
				var p = t.memoizedState;
				a.state = p, ka(t, r, a, i), Oa(), f = t.memoizedState, d || p !== f || ux ? (typeof u == "function" && (Cs(t, n, u, r), f = t.memoizedState), (s = ux || ws(t, n, s, r, p, f, o)) ? (l || typeof a.UNSAFE_componentWillMount != "function" && typeof a.componentWillMount != "function" || (typeof a.componentWillMount == "function" && a.componentWillMount(), typeof a.UNSAFE_componentWillMount == "function" && a.UNSAFE_componentWillMount()), typeof a.componentDidMount == "function" && (t.flags |= 4194308), (t.mode & Hv) !== W && (t.flags |= 268435456)) : (typeof a.componentDidMount == "function" && (t.flags |= 4194308), (t.mode & Hv) !== W && (t.flags |= 268435456), t.memoizedProps = r, t.memoizedState = f), a.props = r, a.state = f, a.context = o, a = s) : (typeof a.componentDidMount == "function" && (t.flags |= 4194308), (t.mode & Hv) !== W && (t.flags |= 268435456), a = !1);
			} else {
				a = t.stateNode, Ca(e, t), o = t.memoizedProps, l = Es(n, o), a.props = l, u = t.pendingProps, p = a.context, f = n.contextType, s = Lv, typeof f == "object" && f && (s = wi(f)), d = n.getDerivedStateFromProps, (f = typeof d == "function" || typeof a.getSnapshotBeforeUpdate == "function") || typeof a.UNSAFE_componentWillReceiveProps != "function" && typeof a.componentWillReceiveProps != "function" || (o !== u || p !== s) && Ts(t, a, r, s), ux = !1, p = t.memoizedState, a.state = p, ka(t, r, a, i), Oa();
				var m = t.memoizedState;
				o !== u || p !== m || ux || e !== null && e.dependencies !== null && Si(e.dependencies) ? (typeof d == "function" && (Cs(t, n, d, r), m = t.memoizedState), (l = ux || ws(t, n, l, r, p, m, s) || e !== null && e.dependencies !== null && Si(e.dependencies)) ? (f || typeof a.UNSAFE_componentWillUpdate != "function" && typeof a.componentWillUpdate != "function" || (typeof a.componentWillUpdate == "function" && a.componentWillUpdate(r, m, s), typeof a.UNSAFE_componentWillUpdate == "function" && a.UNSAFE_componentWillUpdate(r, m, s)), typeof a.componentDidUpdate == "function" && (t.flags |= 4), typeof a.getSnapshotBeforeUpdate == "function" && (t.flags |= 1024)) : (typeof a.componentDidUpdate != "function" || o === e.memoizedProps && p === e.memoizedState || (t.flags |= 4), typeof a.getSnapshotBeforeUpdate != "function" || o === e.memoizedProps && p === e.memoizedState || (t.flags |= 1024), t.memoizedProps = r, t.memoizedState = m), a.props = r, a.state = m, a.context = s, a = l) : (typeof a.componentDidUpdate != "function" || o === e.memoizedProps && p === e.memoizedState || (t.flags |= 4), typeof a.getSnapshotBeforeUpdate != "function" || o === e.memoizedProps && p === e.memoizedState || (t.flags |= 1024), a = !1);
			}
			if (s = a, Ks(e, t), o = !!(t.flags & 128), s || o) {
				if (s = t.stateNode, Le(t), o && typeof n.getDerivedStateFromError != "function") n = null, Dy = -1;
				else if (n = Db(s), t.mode & Vv) {
					Ge(!0);
					try {
						Db(s);
					} finally {
						Ge(!1);
					}
				}
				t.flags |= 1, e !== null && o ? (t.child = ix(t, e.child, null, i), t.child = ix(t, null, n, i)) : Is(e, t, n, i), t.memoizedState = s.state, e = t.child;
			} else e = dc(e, t, i);
			return i = t.stateNode, a && i.props !== r && (yS || console.error("It looks like %s is reassigning its own `this.props` while rendering. This is not supported and can lead to confusing bugs.", C(t) || "a component"), yS = !0), e;
		}
		function Xs(e, t, n, r) {
			return fi(), t.flags |= 256, Is(e, t, n, r), t.child;
		}
		function Zs(e, t) {
			t && t.childContextTypes && console.error("childContextTypes cannot be defined on a function component.\n  %s.childContextTypes = ...", t.displayName || t.name || "Component"), typeof t.getDerivedStateFromProps == "function" && (e = ge(t) || "Unknown", vS[e] || (console.error("%s: Function components do not support getDerivedStateFromProps.", e), vS[e] = !0)), typeof t.contextType == "object" && t.contextType !== null && (t = ge(t) || "Unknown", gS[t] || (console.error("%s: Function components do not support contextType.", t), gS[t] = !0));
		}
		function Qs(e) {
			return {
				baseLanes: e,
				cachePool: na()
			};
		}
		function $s(e, t, n) {
			return e = e === null ? 0 : e.childLanes & ~n, t && (e |= PC), e;
		}
		function ec(e, t, n) {
			var r = t.pendingProps;
			s(t) && (t.flags |= 128);
			var i = !1, a = !!(t.flags & 128), o;
			if ((o = a) || (o = e !== null && e.memoizedState === null ? !1 : (bx.current & yx) !== 0), o && (i = !0, t.flags &= -129), o = !!(t.flags & 32), t.flags &= -33, e === null) {
				if (K) {
					if (i ? Ia(t) : za(t), (e = ny) ? (n = np(e, oy), n = n !== null && n.data !== rT ? n : null, n !== null && (o = {
						dehydrated: n,
						treeContext: ni(),
						retryLane: 536870912,
						hydrationErrors: null
					}, t.memoizedState = o, o = Yr(n), o.return = t, t.child = o, ty = t, ny = null)) : n = null, n === null) throw si(t, e), ci(t);
					return t.lanes = rp(n) ? 32 : 536870912, null;
				}
				return a = r.children, r = r.fallback, i ? (za(t), i = t.mode, a = nc({
					mode: "hidden",
					children: a
				}, i), r = qr(r, i, n, null), a.return = t, r.return = t, a.sibling = r, t.child = a, r = t.child, r.memoizedState = Qs(n), r.childLanes = $s(e, o, n), t.memoizedState = CS, Vs(null, r)) : (Ia(t), tc(t, a));
			}
			var c = e.memoizedState;
			if (c !== null) {
				var l = c.dehydrated;
				if (l !== null) return ic(e, t, a, o, r, l, c, n);
			}
			return i ? (za(t), i = r.fallback, a = t.mode, c = e.child, l = c.sibling, r = Ur(c, {
				mode: "hidden",
				children: r.children
			}), r.subtreeFlags = c.subtreeFlags & 1206910976, l === null ? (i = qr(i, a, n, null), i.flags |= 2) : i = Ur(l, i), i.return = t, r.return = t, r.sibling = i, t.child = r, Vs(null, r), r = t.child, i = e.child.memoizedState, i === null ? i = Qs(n) : (a = i.cachePool, a === null ? a = na() : (c = _y._currentValue, a = a.parent === c ? a : {
				parent: c,
				pool: c
			}), i = {
				baseLanes: i.baseLanes | n,
				cachePool: a
			}), r.memoizedState = i, r.childLanes = $s(e, o, n), t.memoizedState = CS, Vs(e.child, r)) : (c !== null && (n & 62914560) === n && (n & e.lanes) !== 0 && yu(t), Ia(t), n = e.child, e = n.sibling, n = Ur(n, {
				mode: "visible",
				children: r.children
			}), n.return = t, n.sibling = null, e !== null && (o = t.deletions, o === null ? (t.deletions = [e], t.flags |= 16) : o.push(e)), t.child = n, t.memoizedState = null, n);
		}
		function tc(e, t) {
			return t = nc({
				mode: "visible",
				children: t
			}, e.mode), t.return = e, e.child = t;
		}
		function nc(e, t) {
			return e = g(22, e, null, t), e.lanes = 0, e;
		}
		function rc(e, t, n) {
			return ix(t, e.child, null, n), e = tc(t, t.pendingProps.children), e.flags |= 2, t.memoizedState = null, e;
		}
		function ic(e, t, n, r, i, a, o, s) {
			if (n) {
				if (t.flags & 256) return Ia(t), t.flags &= -257, rc(e, t, s);
				if (t.memoizedState !== null) return za(t), t.child = e.child, t.flags |= 128, null;
				za(t);
				var c = i.fallback, l = t.mode, u = nc({
					mode: "visible",
					children: i.children
				}, l);
				return c = qr(c, l, s, null), c.flags |= 2, u.return = t, c.return = t, u.sibling = c, t.child = u, ix(t, e.child, null, s), c = t.child, c.memoizedState = Qs(s), c.childLanes = $s(e, r, s), t.memoizedState = CS, Vs(null, c);
			}
			if (Ia(t), oi(), s & 536870912 && yu(t), rp(a)) {
				if (r = a.nextSibling && a.nextSibling.dataset, r) {
					c = r.dgst;
					var d = r.msg;
					l = r.stck, u = r.cstck;
				}
				return a = d, o = c, i = l, r = u, c = o, l = a, u = i, i = r, c !== Cb && (r = Error(l || "The server could not finish this Suspense boundary, likely due to an error during server rendering. Switched to client rendering."), r.stack = u || "", r.digest = c, c = i === void 0 ? null : i, l = {
					value: r,
					source: null,
					stack: c
				}, typeof c == "string" && Gv.set(r, l), mi(l)), rc(e, t, s);
			}
			if (mS || xi(e, t, s, !1), r = (s & e.childLanes) !== 0, mS || r) {
				if (mx.current !== null) return rc(e, t, s);
				if (r = pC, r !== null && (c = it(r, s), c !== 0 && c !== o.retryLane)) throw o.retryLane = c, Pr(e, c), ou(r, e, c), pS;
				return L(a) || bu(), rc(e, t, s);
			}
			return L(a) ? (t.flags |= 192, t.child = e.child, null) : (e = o.treeContext, ny = ap(a.nextSibling), ty = t, K = !0, ay = null, ry = !1, iy = null, oy = !1, e !== null && ri(t, e), t = tc(t, i.children), t.flags |= 134221824, t);
		}
		function ac(e, t, n) {
			e.lanes |= t;
			var r = e.alternate;
			r !== null && (r.lanes |= t), yi(e.return, t, n);
		}
		function oc(e) {
			for (var t = null; e !== null;) {
				var n = e.alternate;
				n !== null && Ua(n) === null && (t = e), e = e.sibling;
			}
			return t;
		}
		function sc(e, t, n, r, i, a) {
			var o = e.memoizedState;
			o === null ? e.memoizedState = {
				isBackwards: t,
				rendering: null,
				renderingStartTime: 0,
				last: r,
				tail: n,
				tailMode: i,
				treeForkCount: a
			} : (o.isBackwards = t, o.rendering = null, o.renderingStartTime = 0, o.last = r, o.tail = n, o.tailMode = i, o.treeForkCount = a);
		}
		function cc(e) {
			var t = e.child;
			for (e.child = null; t !== null;) {
				var n = t.sibling;
				t.sibling = e.child, e.child = t, t = n;
			}
		}
		function lc(e, t, n) {
			var r = t.pendingProps, i = r.revealOrder, a = r.tail, o = r.children, s = bx.current;
			if (t.flags & 128) return Va(t, s), null;
			if ((r = (s & yx) !== 0) ? (s = s & vx | yx, t.flags |= 128) : s &= vx, Va(t, s), s = i ?? "null", i != null && i !== "forwards" && i !== "backwards" && i !== "unstable_legacy-backwards" && i !== "together" && i !== "independent" && !bS[s]) {
				if (bS[s] = !0, typeof i == "string") switch (i.toLowerCase()) {
					case "together":
					case "forwards":
					case "backwards":
					case "independent":
						console.error("\"%s\" is not a valid value for revealOrder on <SuspenseList />. Use lowercase \"%s\" instead.", i, i.toLowerCase());
						break;
					case "forward":
					case "backward":
						console.error("\"%s\" is not a valid value for revealOrder on <SuspenseList />. React uses the -s suffix in the spelling. Use \"%ss\" instead.", i, i.toLowerCase());
						break;
					default: console.error("\"%s\" is not a supported revealOrder on <SuspenseList />. Did you mean \"independent\", \"together\", \"forwards\" or \"backwards\"?", i);
				}
				else console.error("%s is not a supported value for revealOrder on <SuspenseList />. Did you mean \"independent\", \"together\", \"forwards\" or \"backwards\"?", i);
			}
			s = a ?? "null", xS[s] || a == null || (a !== "visible" && a !== "collapsed" && a !== "hidden" ? (xS[s] = !0, console.error("\"%s\" is not a supported value for tail on <SuspenseList />. Did you mean \"visible\", \"collapsed\" or \"hidden\"?", a)) : i != null && i !== "forwards" && i !== "backwards" && i !== "unstable_legacy-backwards" && (xS[s] = !0, console.error("<SuspenseList tail=\"%s\" /> is only valid if revealOrder is \"forwards\" (default) or \"backwards\". Did you mean to specify revealOrder=\"forwards\"?", a)));
			a: if ((i == null || i === "forwards" || i === "backwards" || i === "unstable_legacy-backwards") && o != null && !1 !== o) {
				if (qm(o)) {
					for (s = 0; s < o.length; s++) if (!xa(o[s], s)) break a;
				} else if (s = he(o), typeof s == "function") {
					if (s = s.call(o)) for (var c = s.next(), l = 0; !c.done; c = s.next()) {
						if (!xa(c.value, l)) break a;
						l++;
					}
				} else console.error("A single row was passed to a <SuspenseList revealOrder=\"%s\" />. This is not useful since it needs multiple rows. Did you mean to pass multiple children or an array?", i);
			}
			if (i === "backwards" && e !== null ? (cc(e), Is(e, t, o, n), cc(e)) : Is(e, t, o, n), K ? (ii(), o = Yv) : o = 0, !r && e !== null && e.flags & 128) a: for (e = t.child; e !== null;) {
				if (e.tag === 13) e.memoizedState !== null && ac(e, n, t);
				else if (e.tag === 19) ac(e, n, t);
				else if (e.child !== null) {
					e.child.return = e, e = e.child;
					continue;
				}
				if (e === t) break a;
				for (; e.sibling === null;) {
					if (e.return === null || e.return === t) break a;
					e = e.return;
				}
				e.sibling.return = e.return, e = e.sibling;
			}
			switch (i) {
				case "backwards":
					n = oc(t.child), n === null ? (i = t.child, t.child = null) : (i = n.sibling, n.sibling = null, cc(t)), sc(t, !0, i, null, a, o);
					break;
				case "unstable_legacy-backwards":
					for (n = null, i = t.child, t.child = null; i !== null;) {
						if (e = i.alternate, e !== null && Ua(e) === null) {
							t.child = i;
							break;
						}
						e = i.sibling, i.sibling = n, n = i, i = e;
					}
					sc(t, !0, n, null, a, o);
					break;
				case "together":
					sc(t, !1, null, null, void 0, o);
					break;
				case "independent":
					t.memoizedState = null;
					break;
				default: n = oc(t.child), n === null ? (i = t.child, t.child = null) : (i = n.sibling, n.sibling = null), sc(t, !1, i, n, a, o);
			}
			return t.child;
		}
		function uc(e, t, n) {
			var r = t.type, i = t.pendingProps, a = i.value;
			return "value" in i || wS || (wS = !0, console.error("The `value` prop is required for the `<Context.Provider>`. Did you misspell it or forget to pass it?")), _i(t, r, a), Is(e, t, i.children, n), t.child;
		}
		function dc(e, t, n) {
			if (e !== null && (t.dependencies = e.dependencies), Dy = -1, jC |= t.lanes, (n & t.childLanes) === 0) {
				if (e !== null) {
					if (xi(e, t, n, !1), (n & t.childLanes) === 0) return null;
				} else return null;
			}
			if (e !== null && t.child !== e.child) throw Error("Resuming work not yet implemented.");
			if (t.child !== null) {
				for (e = t.child, n = Ur(e, e.pendingProps), t.child = n, n.return = t; e.sibling !== null;) e = e.sibling, n = n.sibling = Ur(e, e.pendingProps), n.return = t;
				n.sibling = null;
			}
			return t.child;
		}
		function fc(e, t) {
			return (e.lanes & t) !== 0 || (e = e.dependencies, !!(e !== null && Si(e)));
		}
		function pc(e, t, n) {
			switch (t.tag) {
				case 3:
					Se(t, t.stateNode.containerInfo), _i(t, _y, e.memoizedState.cache), fi();
					break;
				case 27:
				case 5:
					Te(t);
					break;
				case 4:
					Se(t, t.stateNode.containerInfo);
					break;
				case 10:
					_i(t, t.type, t.memoizedProps.value);
					break;
				case 12:
					(n & t.childLanes) !== 0 && (t.flags |= 4), t.flags |= 2048;
					var r = t.stateNode;
					r.effectDuration = -0, r.passiveEffectDuration = -0;
					break;
				case 31:
					if (t.memoizedState !== null) return t.flags |= 128, La(t), null;
					break;
				case 13:
					if (r = t.memoizedState, r !== null) {
						if (r.dehydrated !== null) return Ia(t), t.flags |= 128, null;
						r = xi(e, t, n, !1);
						var i = t.child.childLanes;
						return r || (n & i) !== 0 ? ec(e, t, n) : (Ia(t), e = dc(e, t, n), e === null ? null : e.sibling);
					}
					Ia(t);
					break;
				case 19:
					if (t.flags & 128) return lc(e, t, n);
					if (i = !!(e.flags & 128), r = (n & t.childLanes) !== 0, r ||= (xi(e, t, n, !1), (n & t.childLanes) !== 0), i) {
						if (r) return lc(e, t, n);
						t.flags |= 128;
					}
					if (i = t.memoizedState, i !== null && (i.rendering = null, i.tail = null, i.lastEffect = null), Va(t, bx.current), r) break;
					return null;
				case 22: return t.lanes = 0, Bs(e, t, n, t.pendingProps);
				case 24: _i(t, _y, e.memoizedState.cache);
			}
			return dc(e, t, n);
		}
		function mc(e, t, n) {
			if (t._debugNeedsRemount && e !== null) {
				n = Gr(Lr(t.elementType), t.key, t.pendingProps, t._debugOwner || null, t.mode, t.lanes), n._debugStack = t._debugStack, n._debugTask = t._debugTask;
				var r = t.return;
				if (r === null) throw Error("Cannot swap the root fiber.");
				if (e.alternate = null, t.alternate = null, n.index = t.index, n.sibling = t.sibling, n.return = t.return, n.ref = t.ref, n._debugInfo = t._debugInfo, t === r.child) r.child = n;
				else {
					var i = r.child;
					if (i === null) throw Error("Expected parent to have a child.");
					for (; i.sibling !== t;) if (i = i.sibling, i === null) throw Error("Expected to find the previous sibling.");
					i.sibling = n;
				}
				return t = r.deletions, t === null ? (r.deletions = [e], r.flags |= 16) : t.push(e), n.flags |= 134217730, n;
			}
			if (e !== null) {
				if (e.memoizedProps !== t.pendingProps || t.type !== e.type) mS = !0;
				else {
					if (!fc(e, n) && !(t.flags & 128)) return mS = !1, pc(e, t, n);
					mS = !!(e.flags & 131072);
				}
			} else mS = !1, (r = K) && (ii(), r = !!(t.flags & 1048576)), r && (r = t.index, ii(), $r(t, Yv, r));
			switch (t.lanes = 0, t.tag) {
				case 16:
					a: if (r = t.pendingProps, e = oa(t.elementType), e = Lr(e), t.type = e, typeof e == "function") Hr(e) ? (r = Es(e, r), t.tag = 1, t = Ys(null, t, e, r, n)) : (t.tag = 0, Zs(t, e), t = qs(null, t, e, r, n));
					else {
						if (e != null) {
							if (i = e.$$typeof, i === Fm) {
								t.tag = 11, t = Ls(null, t, e, r, n);
								break a;
							}
							if (i === Rm) {
								t.tag = 14, t = Rs(null, t, e, r, n);
								break a;
							}
							if (i === Pm) {
								t.tag = 10, t.type = e, t = uc(null, t, n);
								break a;
							}
						}
						throw t = "", typeof e == "object" && e && e.$$typeof === zm && (t = " Did you wrap a component in React.lazy() more than once?"), n = ge(e) || e, Error("Element type is invalid. Received a promise that resolves to: " + n + ". Lazy element type must resolve to a class or function." + t);
					}
					return t;
				case 0: return qs(e, t, t.type, t.pendingProps, n);
				case 1: return r = t.type, i = Es(r, t.pendingProps), Ys(e, t, r, i, n);
				case 3:
					a: {
						if (Se(t, t.stateNode.containerInfo), e === null) throw Error("Should have a current fiber. This is a bug in React.");
						r = t.pendingProps;
						var a = t.memoizedState;
						i = a.element, Ca(e, t), ka(t, r, null, n);
						var o = t.memoizedState;
						if (r = o.cache, _i(t, _y, r), r !== a.cache && bi(t, [_y], n, !0), Oa(), r = o.element, a.isDehydrated) {
							if (a = {
								element: r,
								isDehydrated: !1,
								cache: o.cache
							}, t.updateQueue.baseState = a, t.memoizedState = a, t.flags & 256) {
								t = Xs(e, t, r, n);
								break a;
							}
							if (r !== i) {
								i = Zr(Error("This root received an early update, before anything was able hydrate. Switched the entire root to client rendering."), t), mi(i), t = Xs(e, t, r, n);
								break a;
							}
							switch (e = t.stateNode.containerInfo, e.nodeType) {
								case 9:
									e = e.body;
									break;
								default: e = e.nodeName === "HTML" ? e.ownerDocument.body : e;
							}
							for (ny = ap(e.firstChild), ty = t, K = !0, ay = null, ry = !1, iy = null, oy = !0, n = ax(t, null, r, n), t.child = n; n;) n.flags = n.flags & -3 | 134221824, n = n.sibling;
						} else {
							if (fi(), r === i) {
								t = dc(e, t, n);
								break a;
							}
							Is(e, t, r, n);
						}
						t = t.child;
					}
					return t;
				case 26: return Ks(e, t), e === null ? (n = xp(t.type, null, t.pendingProps, null)) ? t.memoizedState = n : K || (t.stateNode = Zd(t.type, t.pendingProps, xe(eh.current), t)) : t.memoizedState = xp(t.type, e.memoizedProps, t.pendingProps, e.memoizedState), null;
				case 27: return Te(t), e === null && K && (r = xe(eh.current), i = we(), r = t.stateNode = hp(t.type, t.pendingProps, r, i, !1), ry || (i = Wd(r, t.type, t.pendingProps, i), i !== null && (ai(t, 0).serverProps = i)), ty = t, oy = !0, i = ny, df(t.type) ? (FT = i, ny = ap(r.firstChild)) : ny = i), Is(e, t, t.pendingProps.children, n), Ks(e, t), e === null && (t.flags |= 4194304), t.child;
				case 5: return e === null && K && (a = we(), r = dn(t.type, a.ancestorInfo), i = ny, (o = !i) || (o = ep(i, t.type, t.pendingProps, oy), o === null ? a = !1 : (t.stateNode = o, ry || (a = Wd(o, t.type, t.pendingProps, a), a !== null && (ai(t, 0).serverProps = a)), ty = t, ny = ap(o.firstChild), oy = !1, a = !0), o = !a), o && (r && si(t, i), ci(t))), Te(t), i = t.type, a = t.pendingProps, o = e === null ? null : e.memoizedProps, r = a.children, $d(i, a) ? r = null : o !== null && $d(i, o) && (t.flags |= 32), t.memoizedState !== null && (i = Ja(e, t, Za, null, null, n), $T._currentValue = i), Ks(e, t), Is(e, t, r, n), t.child;
				case 6: return e === null && K && (n = t.pendingProps, e = we(), r = e.ancestorInfo.current, n = r == null || fn(n, r.tag, e.ancestorInfo.implicitRootScope), e = ny, (r = !e) || (r = tp(e, t.pendingProps, oy), r === null ? r = !1 : (t.stateNode = r, ty = t, ny = null, r = !0), r = !r), r && (n && si(t, e), ci(t))), null;
				case 13: return ec(e, t, n);
				case 4: return Se(t, t.stateNode.containerInfo), r = t.pendingProps, e === null ? t.child = ix(t, null, r, n) : Is(e, t, r, n), t.child;
				case 11: return Ls(e, t, t.type, t.pendingProps, n);
				case 7: return r = t.pendingProps, Ks(e, t), Is(e, t, r, n), t.child;
				case 8: return Is(e, t, t.pendingProps.children, n), t.child;
				case 12: return t.flags |= 4, t.flags |= 2048, r = t.stateNode, r.effectDuration = -0, r.passiveEffectDuration = -0, Is(e, t, t.pendingProps.children, n), t.child;
				case 10: return uc(e, t, n);
				case 9: return i = t.type._context, r = t.pendingProps.children, typeof r != "function" && console.error("A context consumer was rendered with multiple children, or a child that isn't a function. A context consumer expects a single child that is a function. If you did pass a function, make sure there is no trailing or leading whitespace around it."), Ci(t), i = wi(i), r = Tb(r, i, void 0), t.flags |= 1, Is(e, t, r, n), t.child;
				case 14: return Rs(e, t, t.type, t.pendingProps, n);
				case 15: return zs(e, t, t.type, t.pendingProps, n);
				case 19: return lc(e, t, n);
				case 31: return Gs(e, t, n);
				case 22: return Bs(e, t, n, t.pendingProps);
				case 24: return Ci(t), r = wi(_y), e === null ? (i = ea(), i === null && (i = pC, a = Di(), i.pooledCache = a, Oi(a), a !== null && (i.pooledCacheLanes |= n), i = a), t.memoizedState = {
					parent: r,
					cache: i
				}, Sa(t), _i(t, _y, i)) : ((e.lanes & n) !== 0 && (Ca(e, t), ka(t, null, null, n), Oa()), i = e.memoizedState, a = t.memoizedState, i.parent === r ? (r = a.cache, _i(t, _y, r), r !== i.cache && bi(t, [_y], n, !0)) : (i = {
					parent: r,
					cache: r
				}, t.memoizedState = i, t.lanes === 0 && (t.memoizedState = t.updateQueue.baseState = i), _i(t, _y, r))), Is(e, t, t.pendingProps.children, n), t.child;
				case 30: return t.stateNode === null && (t.stateNode = {
					autoName: null,
					paired: null,
					clones: null,
					ref: null
				}), r = t.pendingProps, r.name != null && r.name !== "auto" ? t.flags |= e === null ? 18882560 : 18874368 : K && ei(t), r.className !== void 0 && (i = typeof r.className == "string" ? JSON.stringify(r.className) : "{...}", SS[i] || (SS[i] = !0, console.error("<ViewTransition> doesn't accept a \"className\" prop. It has been renamed to \"default\".\n-   <ViewTransition className=%s>\n+   <ViewTransition default=%s>", i, i))), e !== null && e.memoizedProps.name !== r.name ? t.flags |= 4194816 : Ks(e, t), Is(e, t, r.children, n), t.child;
				case 29: throw t.pendingProps;
			}
			throw Error("Unknown unit of work tag (" + t.tag + "). This error is likely caused by a bug in React. Please file an issue.");
		}
		function hc(e) {
			e.flags |= 4;
		}
		function gc(e, t, n, r, i) {
			var a;
			if ((a = (e.mode & Uv) !== W) && (a = n === null ? Ip(t, r) : Ip(t, r) && (r.src !== n.src || r.srcSet !== n.srcSet)), a) {
				if (e.flags |= 16777216, (i & 335544128) === i) {
					if (e.stateNode.complete) e.flags |= 8192;
					else if (gu()) e.flags |= 8192;
					else throw Yb = Gb, Ub;
				}
			} else e.flags &= -16777217;
		}
		function _c(e, t) {
			if (t.type !== "stylesheet" || (t.state.loading & BT) !== IT) e.flags &= -16777217;
			else if (e.flags |= 16777216, !Lp(t)) {
				if (gu()) e.flags |= 8192;
				else throw Yb = Gb, Ub;
			}
		}
		function vc(e, t) {
			t !== null && (e.flags |= 4), e.flags & 16384 && (t = e.tag === 22 ? 536870912 : Qe(), e.lanes |= t, FC |= t);
		}
		function yc(e, t) {
			if (!K) switch (e.tailMode) {
				case "visible": break;
				case "collapsed":
					for (var n = e.tail, r = null; n !== null;) n.alternate !== null && (r = n), n = n.sibling;
					r === null ? t || e.tail === null ? e.tail = null : e.tail.sibling = null : r.sibling = null;
					break;
				default:
					for (t = e.tail, n = null; t !== null;) t.alternate !== null && (n = t), t = t.sibling;
					n === null ? e.tail = null : n.sibling = null;
			}
		}
		function bc(e) {
			var t = e.alternate !== null && e.alternate.child === e.child, n = 0, r = 0;
			if (t) {
				if ((e.mode & G) !== W) {
					for (var i = e.selfBaseDuration, a = e.child; a !== null;) n |= a.lanes | a.childLanes, r |= a.subtreeFlags & 1206910976, r |= a.flags & 1206910976, i += a.treeBaseDuration, a = a.sibling;
					e.treeBaseDuration = i;
				} else for (i = e.child; i !== null;) n |= i.lanes | i.childLanes, r |= i.subtreeFlags & 1206910976, r |= i.flags & 1206910976, i.return = e, i = i.sibling;
			} else if ((e.mode & G) !== W) {
				i = e.actualDuration, a = e.selfBaseDuration;
				for (var o = e.child; o !== null;) n |= o.lanes | o.childLanes, r |= o.subtreeFlags, r |= o.flags, i += o.actualDuration, a += o.treeBaseDuration, o = o.sibling;
				e.actualDuration = i, e.treeBaseDuration = a;
			} else for (i = e.child; i !== null;) n |= i.lanes | i.childLanes, r |= i.subtreeFlags, r |= i.flags, i.return = e, i = i.sibling;
			return e.subtreeFlags |= r, e.childLanes = n, t;
		}
		function xc(e, t, n) {
			var r = t.pendingProps;
			switch (ti(t), t.tag) {
				case 16:
				case 15:
				case 0:
				case 11:
				case 7:
				case 8:
				case 12:
				case 9:
				case 14: return bc(t), null;
				case 1: return bc(t), null;
				case 3: return n = t.stateNode, r = null, e !== null && (r = e.memoizedState.cache), t.memoizedState.cache !== r && (t.flags |= 2048), vi(_y, t), Ce(t), n.pendingContext && (n.context = n.pendingContext, n.pendingContext = null), (e === null || e.child === null) && (di(t) ? (hi(), hc(t)) : e === null || e.memoizedState.isDehydrated && !(t.flags & 256) || (t.flags |= 1024, pi())), bc(t), null;
				case 26:
					var i = t.type, a = t.memoizedState;
					return e === null ? (hc(t), a === null ? (bc(t), gc(t, i, null, r, n)) : (bc(t), _c(t, a))) : a ? a === e.memoizedState ? (bc(t), t.flags &= -16777217) : (hc(t), bc(t), _c(t, a)) : (e = e.memoizedProps, e !== r && hc(t), bc(t), gc(t, i, e, r, n)), null;
				case 27:
					if (Ee(t), n = xe(eh.current), i = t.type, e !== null && t.stateNode != null) e.memoizedProps !== r && hc(t);
					else {
						if (!r) {
							if (t.stateNode === null) throw Error("We must have new props for new mounts. This error is likely caused by a bug in React. Please file an issue.");
							return bc(t), t.subtreeFlags &= -33554433, null;
						}
						e = we(), di(t) ? li(t, e) : (e = hp(i, r, n, e, !0), t.stateNode = e, hc(t));
					}
					return bc(t), t.subtreeFlags &= -33554433, null;
				case 5:
					if (Ee(t), i = t.type, e !== null && t.stateNode != null) e.memoizedProps !== r && hc(t);
					else {
						if (!r) {
							if (t.stateNode === null) throw Error("We must have new props for new mounts. This error is likely caused by a bug in React. Please file an issue.");
							return bc(t), t.subtreeFlags &= -33554433, null;
						}
						var o = we();
						if (di(t)) li(t, o);
						else {
							switch (a = xe(eh.current), dn(i, o.ancestorInfo), o = o.context, a = Jd(a), o) {
								case vT:
									a = a.createElementNS(Ig, i);
									break;
								case yT:
									a = a.createElementNS(Fg, i);
									break;
								default: switch (i) {
									case "svg":
										a = a.createElementNS(Ig, i);
										break;
									case "math":
										a = a.createElementNS(Fg, i);
										break;
									case "script":
										a = a.createElement("div"), ST || Qd(r) || (console.error("Encountered a script tag while rendering React component. Scripts inside React components are never executed when rendering on the client. Consider using template tag instead (https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template)."), ST = !0), a.innerHTML = "<script><\/script>", a = a.removeChild(a.firstChild);
										break;
									case "select":
										a = typeof r.is == "string" ? a.createElement("select", { is: r.is }) : a.createElement("select"), r.multiple ? a.multiple = !0 : r.size && (a.size = r.size);
										break;
									default: a = typeof r.is == "string" ? a.createElement(i, { is: r.is }) : a.createElement(i), i.indexOf("-") === -1 && (i !== i.toLowerCase() && console.error("<%s /> is using incorrect casing. Use PascalCase for React components, or lowercase for HTML elements.", i), Object.prototype.toString.call(a) !== "[object HTMLUnknownElement]" || gh.call(CT, i) || (CT[i] = !0, console.error("The tag <%s> is unrecognized in this browser. If you meant to render a React component, start its name with an uppercase letter.", i)));
								}
							}
							a[Gh] = t, a[Kh] = r;
							a: for (o = t.child; o !== null;) {
								if (o.tag === 5 || o.tag === 6) a.appendChild(o.stateNode);
								else if (o.tag !== 4 && o.tag !== 27 && o.child !== null) {
									o.child.return = o, o = o.child;
									continue;
								}
								if (o === t) break a;
								for (; o.sibling === null;) {
									if (o.return === null || o.return === t) break a;
									o = o.return;
								}
								o.sibling.return = o.return, o = o.sibling;
							}
							t.stateNode = a;
							a: switch (Pd(a, i, r), i) {
								case "button":
								case "input":
								case "select":
								case "textarea":
									r = !!r.autoFocus;
									break a;
								case "img":
									r = !0;
									break a;
								default: r = !1;
							}
							r && hc(t);
						}
					}
					return bc(t), t.subtreeFlags &= -33554433, gc(t, t.type, e === null ? null : e.memoizedProps, t.pendingProps, n), null;
				case 6:
					if (e && t.stateNode != null) e.memoizedProps !== r && hc(t);
					else {
						if (typeof r != "string" && t.stateNode === null) throw Error("We must have new props for new mounts. This error is likely caused by a bug in React. Please file an issue.");
						if (e = xe(eh.current), n = we(), di(t)) {
							if (e = t.stateNode, n = t.memoizedProps, i = !ry, r = null, a = ty, a !== null) switch (a.tag) {
								case 3:
									i && (i = sp(e, n, r), i !== null && (ai(t, 0).serverProps = i));
									break;
								case 27:
								case 5: r = a.memoizedProps, i && (i = sp(e, n, r), i !== null && (ai(t, 0).serverProps = i));
							}
							e[Gh] = t, e = !!(e.nodeValue === n || r !== null && !0 === r.suppressHydrationWarning || Md(e.nodeValue, n)), e || ci(t, !0);
						} else i = n.ancestorInfo.current, i != null && fn(r, i.tag, n.ancestorInfo.implicitRootScope), e = Jd(e).createTextNode(r), e[Gh] = t, t.stateNode = e;
					}
					return bc(t), null;
				case 31:
					if (n = t.memoizedState, e === null || e.memoizedState !== null) {
						if (r = di(t), n !== null) {
							if (e === null) {
								if (!r) throw Error("A dehydrated suspense component was completed without a hydrated node. This is probably a bug in React.");
								if (e = t.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error("Expected to have a hydrated activity instance. This error is likely caused by a bug in React. Please file an issue.");
								e[Gh] = t, bc(t), (t.mode & G) !== W && n !== null && (e = t.child, e !== null && (t.treeBaseDuration -= e.treeBaseDuration));
							} else hi(), fi(), !(t.flags & 128) && (n = t.memoizedState = null), t.flags |= 4, bc(t), (t.mode & G) !== W && n !== null && (e = t.child, e !== null && (t.treeBaseDuration -= e.treeBaseDuration));
							e = !1;
						} else n = pi(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = n), e = !0;
						if (!e) return t.flags & 256 ? (Ba(t), t) : (Ba(t), null);
						if (t.flags & 128) throw Error("Client rendering an Activity suspended it again. This is a bug in React.");
					}
					return bc(t), null;
				case 13:
					if (r = t.memoizedState, e === null || e.memoizedState !== null && e.memoizedState.dehydrated !== null) {
						if (i = r, a = di(t), i !== null && i.dehydrated !== null) {
							if (e === null) {
								if (!a) throw Error("A dehydrated suspense component was completed without a hydrated node. This is probably a bug in React.");
								if (a = t.memoizedState, a = a === null ? null : a.dehydrated, !a) throw Error("Expected to have a hydrated suspense instance. This error is likely caused by a bug in React. Please file an issue.");
								a[Gh] = t, bc(t), (t.mode & G) !== W && i !== null && (i = t.child, i !== null && (t.treeBaseDuration -= i.treeBaseDuration));
							} else hi(), fi(), !(t.flags & 128) && (i = t.memoizedState = null), t.flags |= 4, bc(t), (t.mode & G) !== W && i !== null && (i = t.child, i !== null && (t.treeBaseDuration -= i.treeBaseDuration));
							i = !1;
						} else i = pi(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = i), i = !0;
						if (!i) return t.flags & 256 ? (Ba(t), t) : (Ba(t), null);
					}
					return Ba(t), t.flags & 128 ? (t.lanes = n, (t.mode & G) !== W && Xi(t), t) : (n = r !== null, e = e !== null && e.memoizedState !== null, n && (r = t.child, i = null, r.alternate !== null && r.alternate.memoizedState !== null && r.alternate.memoizedState.cachePool !== null && (i = r.alternate.memoizedState.cachePool.pool), a = null, r.memoizedState !== null && r.memoizedState.cachePool !== null && (a = r.memoizedState.cachePool.pool), a !== i && (r.flags |= 2048)), n !== e && n && (t.child.flags |= 8192), vc(t, t.updateQueue), bc(t), (t.mode & G) !== W && n && (e = t.child, e !== null && (t.treeBaseDuration -= e.treeBaseDuration)), null);
				case 4: return Ce(t), e === null && _d(t.stateNode.containerInfo), t.flags |= 67108864, bc(t), null;
				case 10: return vi(t.type, t), bc(t), null;
				case 19:
					if (Ha(t), r = t.memoizedState, r === null) return bc(t), null;
					if (i = !!(t.flags & 128), a = r.rendering, a === null) {
						if (i) yc(r, !1);
						else {
							if (AC !== aC || e !== null && e.flags & 128) for (e = t.child; e !== null;) {
								if (a = Ua(e), a !== null) {
									for (t.flags |= 128, yc(r, !1), e = a.updateQueue, t.updateQueue = e, vc(t, e), t.subtreeFlags = 0, e = n, n = t.child; n !== null;) Wr(n, e), n = n.sibling;
									return Va(t, bx.current & vx | yx), K && Qr(t, r.treeForkCount), t.child;
								}
								e = e.sibling;
							}
							r.tail !== null && xh() > HC && (t.flags |= 128, i = !0, yc(r, !1), t.lanes = 4194304);
						}
					} else {
						if (!i) {
							if (e = Ua(a), e !== null) {
								if (t.flags |= 128, i = !0, e = e.updateQueue, t.updateQueue = e, vc(t, e), yc(r, !0), r.tail === null && r.tailMode !== "collapsed" && r.tailMode !== "visible" && !a.alternate && !K) return bc(t), null;
							} else 2 * xh() - r.renderingStartTime > HC && n !== 536870912 && (t.flags |= 128, i = !0, yc(r, !1), t.lanes = 4194304);
						}
						r.isBackwards ? (a.sibling = t.child, t.child = a) : (e = r.last, e === null ? t.child = a : e.sibling = a, r.last = a);
					}
					if (r.tail !== null) {
						e = r.tail;
						a: {
							for (n = e; n !== null;) {
								if (n.alternate !== null) {
									n = !1;
									break a;
								}
								n = n.sibling;
							}
							n = !0;
						}
						return r.rendering = e, r.tail = e.sibling, r.renderingStartTime = xh(), e.sibling = null, a = bx.current, a = i ? a & vx | yx : a & vx, r.tailMode === "visible" || r.tailMode === "collapsed" || !n || K ? Va(t, a) : (n = a, be(gx, t, t), be(bx, n, t), _x === null && (_x = t)), K && Qr(t, r.treeForkCount), e;
					}
					return bc(t), null;
				case 22:
				case 23: return Ba(t), Fa(t), r = t.memoizedState !== null, e === null ? r && (t.flags |= 8192) : e.memoizedState !== null !== r && (t.flags |= 8192), r ? n & 536870912 && !(t.flags & 128) && (bc(t), t.subtreeFlags & 6 && (t.flags |= 8192)) : bc(t), n = t.updateQueue, n !== null && vc(t, n.retryQueue), n = null, e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), r = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (r = t.memoizedState.cachePool.pool), r !== n && (t.flags |= 2048), e !== null && ye(fb, t), null;
				case 24: return n = null, e !== null && (n = e.memoizedState.cache), t.memoizedState.cache !== n && (t.flags |= 2048), vi(_y, t), bc(t), null;
				case 25: return null;
				case 30: return t.flags |= 33554432, bc(t), null;
			}
			throw Error("Unknown unit of work tag (" + t.tag + "). This error is likely caused by a bug in React. Please file an issue.");
		}
		function Sc(e, t) {
			switch (ti(t), t.tag) {
				case 1: return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, (t.mode & G) !== W && Xi(t), t) : null;
				case 3: return vi(_y, t), Ce(t), e = t.flags, e & 65536 && !(e & 128) ? (t.flags = e & -65537 | 128, t) : null;
				case 26:
				case 27:
				case 5: return Ee(t), null;
				case 31:
					if (t.memoizedState !== null) {
						if (Ba(t), t.alternate === null) throw Error("Threw in newly mounted dehydrated component. This is likely a bug in React. Please file an issue.");
						fi();
					}
					return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, (t.mode & G) !== W && Xi(t), t) : null;
				case 13:
					if (Ba(t), e = t.memoizedState, e !== null && e.dehydrated !== null) {
						if (t.alternate === null) throw Error("Threw in newly mounted dehydrated component. This is likely a bug in React. Please file an issue.");
						fi();
					}
					return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, (t.mode & G) !== W && Xi(t), t) : null;
				case 19: return Ha(t), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, e = t.memoizedState, e !== null && (e.rendering = null, e.tail = null), t.flags |= 4, t) : null;
				case 4: return Ce(t), null;
				case 10: return vi(t.type, t), null;
				case 22:
				case 23: return Ba(t), Fa(t), e !== null && ye(fb, t), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, (t.mode & G) !== W && Xi(t), t) : null;
				case 24: return vi(_y, t), null;
				case 25: return null;
				default: return null;
			}
		}
		function Cc(e, t) {
			switch (ti(t), t.tag) {
				case 3:
					vi(_y, t), Ce(t);
					break;
				case 26:
				case 27:
				case 5:
					Ee(t);
					break;
				case 4:
					Ce(t);
					break;
				case 31:
					t.memoizedState !== null && Ba(t);
					break;
				case 13:
					Ba(t);
					break;
				case 19:
					Ha(t);
					break;
				case 10:
					vi(t.type, t);
					break;
				case 22:
				case 23:
					Ba(t), Fa(t), e !== null && ye(fb, t);
					break;
				case 24: vi(_y, t);
			}
		}
		function wc(e) {
			return (e.mode & G) !== W;
		}
		function Tc(e, t) {
			wc(e) ? (Yi(), Dc(t, e), qi()) : Dc(t, e);
		}
		function Ec(e, t, n) {
			wc(e) ? (Yi(), Oc(n, e, t), qi()) : Oc(n, e, t);
		}
		function Dc(e, t) {
			try {
				var n = t.updateQueue, r = n === null ? null : n.lastEffect;
				if (r !== null) {
					var i = r.next;
					n = i;
					do {
						if ((n.tag & e) === e && (r = void 0, (e & Cx) !== xx && (Tw = !0), r = T(t, Lb, n), (e & Cx) !== xx && (Tw = !1), r !== void 0 && typeof r != "function")) {
							var a = void 0;
							a = (n.tag & wx) === 0 ? (n.tag & Cx) === 0 ? "useEffect" : "useInsertionEffect" : "useLayoutEffect";
							var o = void 0;
							o = r === null ? " You returned null. If your effect does not require clean up, return undefined (or nothing)." : typeof r.then == "function" ? "\n\nIt looks like you wrote " + a + "(async () => ...) or returned a Promise. Instead, write the async function inside your effect and call it immediately:\n\n" + a + "(() => {\n  async function fetchData() {\n    // You can await here\n    const response = await MyAPI.getData(someId);\n    // ...\n  }\n  fetchData();\n}, [someId]); // Or [] if effect doesn't need props or state\n\nLearn more about data fetching with Hooks: https://react.dev/link/hooks-data-fetching" : " You returned: " + r, T(t, function(e, t) {
								console.error("%s must not return anything besides a function, which is used for clean-up.%s", e, t);
							}, a, o);
						}
						n = n.next;
					} while (n !== i);
				}
			} catch (e) {
				Gu(t, t.return, e);
			}
		}
		function Oc(e, t, n) {
			try {
				var r = t.updateQueue, i = r === null ? null : r.lastEffect;
				if (i !== null) {
					var a = i.next;
					r = a;
					do {
						if ((r.tag & e) === e) {
							var o = r.inst, s = o.destroy;
							s !== void 0 && (o.destroy = void 0, (e & Cx) !== xx && (Tw = !0), i = t, T(i, zb, i, n, s), (e & Cx) !== xx && (Tw = !1));
						}
						r = r.next;
					} while (r !== a);
				}
			} catch (e) {
				Gu(t, t.return, e);
			}
		}
		function kc(e, t) {
			wc(e) ? (Yi(), Dc(t, e), qi()) : Dc(t, e);
		}
		function Ac(e, t, n) {
			wc(e) ? (Yi(), Oc(n, e, t), qi()) : Oc(n, e, t);
		}
		function jc(e) {
			var t = e.updateQueue;
			if (t !== null) {
				var n = e.stateNode;
				e.type.defaultProps || "ref" in e.memoizedProps || yS || (n.props !== e.memoizedProps && console.error("Expected %s props to match memoized props before processing the update queue. This might either be because of a bug in React, or because a component reassigns its own `this.props`. Please file an issue.", C(e) || "instance"), n.state !== e.memoizedState && console.error("Expected %s state to match memoized state before processing the update queue. This might either be because of a bug in React, or because a component reassigns its own `this.state`. Please file an issue.", C(e) || "instance"));
				try {
					T(e, Ma, t, n);
				} catch (t) {
					Gu(e, e.return, t);
				}
			}
		}
		function Mc(e, t, n) {
			return e.getSnapshotBeforeUpdate(t, n);
		}
		function Nc(e, t) {
			var n = t.memoizedProps, r = t.memoizedState;
			t = e.stateNode, e.type.defaultProps || "ref" in e.memoizedProps || yS || (t.props !== e.memoizedProps && console.error("Expected %s props to match memoized props before getSnapshotBeforeUpdate. This might either be because of a bug in React, or because a component reassigns its own `this.props`. Please file an issue.", C(e) || "instance"), t.state !== e.memoizedState && console.error("Expected %s state to match memoized state before getSnapshotBeforeUpdate. This might either be because of a bug in React, or because a component reassigns its own `this.state`. Please file an issue.", C(e) || "instance"));
			try {
				var i = Es(e.type, n), a = T(e, Mc, t, i, r);
				n = TS, a !== void 0 || n.has(e.type) || (n.add(e.type), T(e, function() {
					console.error("%s.getSnapshotBeforeUpdate(): A snapshot value (or null) must be returned. You have returned undefined.", C(e));
				})), t.__reactInternalSnapshotBeforeUpdate = a;
			} catch (t) {
				Gu(e, e.return, t);
			}
		}
		function Pc(e, t, n) {
			n.props = Es(e.type, e.memoizedProps), n.state = e.memoizedState, wc(e) ? (Yi(), T(e, Fb, e, t, n), qi()) : T(e, Fb, e, t, n);
		}
		function Fc(e) {
			var t = e.ref;
			if (t !== null) {
				switch (e.tag) {
					case 26:
					case 27:
					case 5:
						var n = e.stateNode;
						break;
					case 30:
						n = e.stateNode;
						var r = ur(e.memoizedProps, n);
						(n.ref === null || n.ref.name !== r) && (n.ref = Nf(r)), n = n.ref;
						break;
					case 7:
						e.stateNode === null && (n = new Pf(e), x(e, Yf, n), e.stateNode = n), n = e.stateNode;
						break;
					default: n = e.stateNode;
				}
				if (typeof t == "function") {
					if (wc(e)) try {
						Yi(), e.refCleanup = t(n);
					} finally {
						qi();
					}
					else e.refCleanup = t(n);
				} else typeof t == "string" ? console.error("String refs are no longer supported.") : t.hasOwnProperty("current") || console.error("Unexpected ref object provided for %s. Use either a ref-setter function or React.createRef().", C(e)), t.current = n;
			}
		}
		function Ic(e, t) {
			try {
				T(e, Fc, e);
			} catch (n) {
				Gu(e, t, n);
			}
		}
		function Lc(e, t) {
			var n = e.ref, r = e.refCleanup;
			if (n !== null) {
				if (typeof r == "function") try {
					if (wc(e)) try {
						Yi(), T(e, r);
					} finally {
						qi(e);
					}
					else T(e, r);
				} catch (n) {
					Gu(e, t, n);
				} finally {
					e.refCleanup = null, e = e.alternate, e != null && (e.refCleanup = null);
				}
				else if (typeof n == "function") try {
					if (wc(e)) try {
						Yi(), T(e, n, null);
					} finally {
						qi(e);
					}
					else T(e, n, null);
				} catch (n) {
					Gu(e, t, n);
				}
				else n.current = null;
			}
		}
		function Rc(e, t, n, r) {
			var i = e.memoizedProps, a = i.id, o = i.onCommit;
			i = i.onRender, t = t === null ? "mount" : "update", ab && (t = "nested-update"), typeof i == "function" && i(a, t, e.actualDuration, e.treeBaseDuration, e.actualStartTime, n), typeof o == "function" && o(a, t, r, n);
		}
		function zc(e, t, n, r) {
			var i = e.memoizedProps;
			e = i.id, i = i.onPostCommit, t = t === null ? "mount" : "update", ab && (t = "nested-update"), typeof i == "function" && i(e, t, r, n);
		}
		function Bc(e, t) {
			if ((e.tag === 5 || e.tag === 27 || e.tag === 6) && e.alternate === null && t !== null) for (var n = 0; n < t.length; n++) Zf(e.stateNode, t[n]);
		}
		function Vc(e) {
			for (var t = e.return; t !== null && (Wc(t) && Zf(e.stateNode, t.stateNode), !Uc(t));) t = t.return;
		}
		function Hc(e) {
			for (var t = e.return; t !== null && (Wc(t) && Qf(e.stateNode, t.stateNode), !Uc(t));) t = t.return;
		}
		function Uc(e) {
			return e.tag === 5 || e.tag === 3 || e.tag === 27;
		}
		function Wc(e) {
			return e && e.tag === 7 && e.stateNode !== null;
		}
		function Gc(e) {
			var t = e.type, n = e.memoizedProps, r = e.stateNode;
			try {
				T(e, af, r, t, n, e);
			} catch (t) {
				Gu(e, e.return, t);
			}
		}
		function Kc(e, t, n) {
			try {
				T(e, sf, e.stateNode, e.type, n, t, e);
			} catch (t) {
				Gu(e, e.return, t);
			}
		}
		function qc(e) {
			return e.tag === 5 || e.tag === 3 || e.tag === 26 || e.tag === 27 && df(e.type) || e.tag === 4;
		}
		function Jc(e) {
			a: for (;;) {
				for (; e.sibling === null;) {
					if (e.return === null || qc(e.return)) return null;
					e = e.return;
				}
				for (e.sibling.return = e.return, e = e.sibling; e.tag !== 5 && e.tag !== 6 && e.tag !== 18;) {
					if (e.tag === 27 && df(e.type) || e.flags & 2 || e.child === null || e.tag === 4) continue a;
					e.child.return = e, e = e.child;
				}
				if (!(e.flags & 2)) return e.stateNode;
			}
		}
		function Yc(e, t, n, r) {
			var i = e.tag;
			if (i === 5 || i === 6) i = e.stateNode, t ? (uf(n), (n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n).insertBefore(i, t)) : (uf(n), t = n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n, t.appendChild(i), i = n._reactRootContainer, i != null || t.onclick !== null || (t.onclick = wn)), Bc(e, r), V = !0;
			else if (i !== 4 && (i === 27 && (Bc(e, r), r = null, df(e.type) && (n = e.stateNode, t = null)), e = e.child, e !== null)) for (Yc(e, t, n, r), e = e.sibling; e !== null;) Yc(e, t, n, r), e = e.sibling;
		}
		function Xc(e, t, n, r) {
			var i = e.tag;
			if (i === 5 || i === 6) i = e.stateNode, t ? n.insertBefore(i, t) : n.appendChild(i), Bc(e, r), V = !0;
			else if (i !== 4 && (i === 27 && (Bc(e, r), r = null, df(e.type) && (n = e.stateNode)), e = e.child, e !== null)) for (Xc(e, t, n, r), e = e.sibling; e !== null;) Xc(e, t, n, r), e = e.sibling;
		}
		function Zc(e) {
			for (var t, n = e.return; n !== null;) {
				if (qc(n)) {
					t = n;
					break;
				}
				n = n.return;
			}
			n = null;
			for (var r = e.return; r !== null;) {
				if (Wc(r)) {
					var i = r.stateNode;
					n === null ? n = [i] : n.push(i);
				}
				if (Uc(r)) break;
				r = r.return;
			}
			if (t == null) throw Error("Expected to find a host parent. This error is likely caused by a bug in React. Please file an issue.");
			switch (t.tag) {
				case 27:
					t = t.stateNode, r = Jc(e), Xc(e, r, t, n);
					break;
				case 5:
					r = t.stateNode, t.flags & 32 && (cf(r), t.flags &= -33), t = Jc(e), Xc(e, t, r, n);
					break;
				case 3:
				case 4:
					t = t.stateNode.containerInfo, r = Jc(e), Yc(e, r, t, n);
					break;
				default: throw Error("Invalid host parent fiber. This error is likely caused by a bug in React. Please file an issue.");
			}
		}
		function Qc(e) {
			var t = e.stateNode, n = e.memoizedProps;
			try {
				T(e, gp, e.type, n, t, e);
			} catch (t) {
				Gu(e, e.return, t);
			}
		}
		function $c(e) {
			(e.tag === 30 || e.subtreeFlags & 33554432) && (ES = !0);
		}
		function el() {
			var e = OS;
			return OS = null, e;
		}
		function tl(e, t, n, r, i) {
			return kS = 0, (t = nl(e.child, t, n, r, i)) && e._debugTask != null && nb === null && (nb = e._debugTask), t;
		}
		function nl(e, t, n, r, i) {
			for (var a = !1; e !== null;) {
				if (e.tag === 5) {
					var o = e.stateNode;
					if (r !== null) {
						var s = Ef(o);
						r.push(s), s.view && (a = !0);
					} else a || Ef(o).view && (a = !0);
					ES = !0, Cf(o, kS === 0 ? t : t + "_" + kS, n), kS++;
				} else (e.tag !== 22 || e.memoizedState === null) && (e.tag === 30 && i || nl(e.child, t, n, r, i) && (a = !0));
				e = e.sibling;
			}
			return a;
		}
		function rl(e, t) {
			for (; e !== null;) e.tag === 5 ? wf(e.stateNode, e.memoizedProps) : (e.tag !== 22 || e.memoizedState === null) && (e.tag === 30 && t || rl(e.child, t)), e = e.sibling;
		}
		function il(e) {
			if (e.subtreeFlags & 18874368) for (e = e.child; e !== null;) {
				if ((e.tag !== 22 || e.memoizedState === null) && (il(e), e.tag === 30 && e.flags & 18874368 && e.stateNode.paired)) {
					var t = e.memoizedProps;
					if (t.name == null || t.name === "auto") throw Error("Found a pair with an auto name. This is a bug in React.");
					var n = t.name;
					t = fr(t.default, t.share), t !== "none" && (tl(e, n, t, null, !1) || rl(e.child, !1));
				}
				e = e.sibling;
			}
		}
		function al(e, t) {
			if (e.tag === 30) {
				var n = e.stateNode, r = e.memoizedProps, i = ur(r, n), a = fr(r.default, n.paired ? r.share : r.enter);
				a === "none" ? il(e) : tl(e, i, a, null, !1) ? (il(e), n.paired || t || au(e, r.onEnter)) : rl(e.child, !1);
			} else if (e.subtreeFlags & 33554432) for (e = e.child; e !== null;) al(e, t), e = e.sibling;
			else il(e);
		}
		function ol(e) {
			if (DS !== null && DS.size !== 0) {
				var t = DS;
				if (e.subtreeFlags & 18874368) for (e = e.child; e !== null;) {
					if (e.tag !== 22 || e.memoizedState === null) {
						if (e.tag === 30 && e.flags & 18874368) {
							var n = e.memoizedProps, r = n.name;
							if (r != null && r !== "auto") {
								var i = t.get(r);
								if (i !== void 0) {
									var a = fr(n.default, n.share);
									if (a !== "none" && (tl(e, r, a, null, !1) ? (a = e.stateNode, i.paired = a, a.paired = i, au(e, n.onShare)) : rl(e.child, !1)), t.delete(r), t.size === 0) break;
								}
							}
						}
						ol(e);
					}
					e = e.sibling;
				}
			}
		}
		function sl(e) {
			if (e.tag === 30) {
				var t = e.memoizedProps, n = ur(t, e.stateNode), r = DS === null ? void 0 : DS.get(n), i = fr(t.default, r === void 0 ? t.exit : t.share);
				i !== "none" && (tl(e, n, i, null, !1) ? r === void 0 ? au(e, t.onExit) : (i = e.stateNode, r.paired = i, i.paired = r, DS.delete(n), au(e, t.onShare)) : rl(e.child, !1)), DS !== null && ol(e);
			} else if (e.subtreeFlags & 33554432) for (e = e.child; e !== null;) sl(e), e = e.sibling;
			else DS !== null && ol(e);
		}
		function cl(e) {
			for (e = e.child; e !== null;) {
				if (e.tag === 30) {
					var t = e.memoizedProps, n = ur(t, e.stateNode);
					t = fr(t.default, t.update), e.flags &= -5, t !== "none" && tl(e, n, t, e.memoizedState = [], !1);
				} else e.subtreeFlags & 33554432 && cl(e);
				e = e.sibling;
			}
		}
		function ll(e) {
			if (e.subtreeFlags & 18874368) for (e = e.child; e !== null;) {
				if (e.tag !== 22 || e.memoizedState === null) {
					if (e.tag === 30 && e.flags & 18874368) {
						var t = e.stateNode;
						t.paired !== null && (t.paired = null, rl(e.child, !1));
					}
					ll(e);
				}
				e = e.sibling;
			}
		}
		function ul(e) {
			if (e.tag === 30) e.stateNode.paired = null, rl(e.child, !1), ll(e);
			else if (e.subtreeFlags & 33554432) for (e = e.child; e !== null;) ul(e), e = e.sibling;
			else ll(e);
		}
		function dl(e) {
			for (e = e.child; e !== null;) e.tag === 30 ? rl(e.child, !1) : e.subtreeFlags & 33554432 && dl(e), e = e.sibling;
		}
		function fl(e, t, n, r, i, a, o) {
			for (var s = !1; t !== null;) {
				if (t.tag === 5) {
					var c = t.stateNode;
					if (a !== null && kS < a.length) {
						var l = a[kS], u = Ef(c);
						(l.view || u.view) && (s = !0);
						var d;
						if (d = !(e.flags & 4)) {
							if (u.clip) d = !0;
							else {
								d = l.rect;
								var f = u.rect;
								d = d.y !== f.y || d.x !== f.x || d.height !== f.height || d.width !== f.width;
							}
						}
						d && (e.flags |= 4), u.abs ? u = !l.abs : (l = l.rect, u = u.rect, u = l.height !== u.height || l.width !== u.width), u && (e.flags |= 32);
					} else e.flags |= 32;
					e.flags & 4 && Cf(c, kS === 0 ? n : n + "_" + kS, i), s && e.flags & 4 || (OS === null && (OS = []), OS.push(c, kS === 0 ? r : r + "_" + kS, t.memoizedProps)), kS++;
				} else (t.tag !== 22 || t.memoizedState === null) && (t.tag === 30 && o ? e.flags |= t.flags & 32 : fl(e, t.child, n, r, i, a, o) && (s = !0));
				t = t.sibling;
			}
			return s;
		}
		function pl(e, t) {
			for (e = e.child; e !== null;) {
				if (e.tag === 30) {
					var n = e.memoizedProps, r = e.stateNode, i = ur(n, r), a = fr(n.default, n.update);
					if (t) {
						r = r.clones;
						var o = r === null ? null : r.map(Df);
					} else o = e.memoizedState, e.memoizedState = null;
					r = e;
					var s = e.child, c = i;
					kS = 0, a = fl(r, s, c, i, a, o, !1), e.flags & 4 && a && (t || au(e, n.onUpdate));
				} else e.subtreeFlags & 33554432 && pl(e, t);
				e = e.sibling;
			}
		}
		function ml(e) {
			var t = e.memoizedProps.name;
			if (t != null && t !== "auto") {
				var n = AS.get(t);
				if (n !== void 0) {
					if (n !== e && n !== e.alternate && !jS[t]) {
						jS[t] = !0;
						var r = JSON.stringify(t);
						T(e, function() {
							console.error("There are two <ViewTransition name=%s> components with the same name mounted at the same time. This is not supported and will cause View Transitions to error. Try to use a more unique name e.g. by using a namespace prefix and adding the id of an item to the name.", r);
						}), T(n, function() {
							console.error("The existing <ViewTransition name=%s> duplicate has this stack trace.", r);
						});
					}
				} else AS.set(t, e);
			}
		}
		function hl(e) {
			var t = e.memoizedProps.name;
			if (t != null && t !== "auto") {
				var n = AS.get(t);
				n === void 0 || n !== e && n !== e.alternate || AS.delete(t);
			}
		}
		function gl(e, t) {
			return t.tag === 31 ? (t = t.memoizedState, e.memoizedState !== null && t === null) : t.tag === 13 ? (e = e.memoizedState, t = t.memoizedState, e !== null && e.dehydrated !== null && (t === null || t.dehydrated === null)) : t.tag === 3 && e.memoizedState.isDehydrated && !(t.flags & 256);
		}
		function _l(e, t, n) {
			if (e = e.containerInfo, bT = gE, e = ir(e), ar(e)) {
				if ("selectionStart" in e) var r = {
					start: e.selectionStart,
					end: e.selectionEnd
				};
				else a: {
					r = (r = e.ownerDocument) && r.defaultView || window;
					var i = r.getSelection && r.getSelection();
					if (i && i.rangeCount !== 0) {
						r = i.anchorNode;
						var a = i.anchorOffset, o = i.focusNode;
						i = i.focusOffset;
						try {
							r.nodeType, o.nodeType;
						} catch {
							r = null;
							break a;
						}
						var s = 0, c = -1, l = -1, u = 0, d = 0, f = e, p = null;
						b: for (;;) {
							for (var m; f !== r || a !== 0 && f.nodeType !== 3 || (c = s + a), f !== o || i !== 0 && f.nodeType !== 3 || (l = s + i), f.nodeType === 3 && (s += f.nodeValue.length), (m = f.firstChild) !== null;) p = f, f = m;
							for (;;) {
								if (f === e) break b;
								if (p === r && ++u === a && (c = s), p === o && ++d === i && (l = s), (m = f.nextSibling) !== null) break;
								f = p, p = f.parentNode;
							}
							f = m;
						}
						r = c === -1 || l === -1 ? null : {
							start: c,
							end: l
						};
					} else r = null;
				}
				r ||= {
					start: 0,
					end: 0
				};
			} else r = null;
			for (xT = {
				focusedElem: e,
				selectionRange: r
			}, gE = !1, n = (n & 335544064) === n, BS = t, t = n ? 9270 : 1024; BS !== null;) {
				if (e = BS, n && (r = e.deletions, r !== null)) for (a = 0; a < r.length; a++) n && sl(r[a]);
				if (e.alternate === null && e.flags & 2) n && $c(e), vl(n);
				else {
					if (e.tag === 22) {
						if (r = e.alternate, e.memoizedState !== null) {
							r !== null && r.memoizedState === null && n && sl(r), vl(n);
							continue;
						}
						if (r !== null && r.memoizedState !== null) {
							n && $c(e), vl(n);
							continue;
						}
					}
					r = e.child, (e.subtreeFlags & t) !== 0 && r !== null ? (r.return = e, BS = r) : (n && cl(e), vl(n));
				}
			}
			DS = null;
		}
		function vl(e) {
			for (; BS !== null;) {
				var t = BS, n = t, r = e, i = n.alternate, a = n.flags;
				switch (n.tag) {
					case 0:
					case 11:
					case 15: break;
					case 1:
						a & 1024 && i !== null && Nc(n, i);
						break;
					case 3:
						if (a & 1024) {
							if (r = n.stateNode.containerInfo, n = r.nodeType, n === 9) $f(r);
							else if (n === 1) switch (r.nodeName) {
								case "HEAD":
								case "HTML":
								case "BODY":
									$f(r);
									break;
								default: r.textContent = "";
							}
						}
						break;
					case 5:
					case 26:
					case 27:
					case 6:
					case 4:
					case 17: break;
					case 30:
						r && i !== null && (r = i, i = n, n = ur(r.memoizedProps, r.stateNode), i = i.memoizedProps, i = fr(i.default, i.update), i !== "none" && tl(r, n, i, r.memoizedState = [], !0));
						break;
					default: if (a & 1024) throw Error("This unit of work tag should not have side-effects. This error is likely caused by a bug in React. Please file an issue.");
				}
				if (r = t.sibling, r !== null) {
					r.return = t.return, BS = r;
					break;
				}
				BS = t.return;
			}
		}
		function yl(e, t, n) {
			var r = Ri(), i = Bi(), a = Hi(), o = Ui(), s = n.flags;
			switch (n.tag) {
				case 0:
				case 11:
				case 15:
					Fl(e, n), s & 4 && Tc(n, wx | Sx);
					break;
				case 1:
					if (Fl(e, n), s & 4) {
						if (e = n.stateNode, t === null) n.type.defaultProps || "ref" in n.memoizedProps || yS || (e.props !== n.memoizedProps && console.error("Expected %s props to match memoized props before componentDidMount. This might either be because of a bug in React, or because a component reassigns its own `this.props`. Please file an issue.", C(n) || "instance"), e.state !== n.memoizedState && console.error("Expected %s state to match memoized state before componentDidMount. This might either be because of a bug in React, or because a component reassigns its own `this.state`. Please file an issue.", C(n) || "instance")), wc(n) ? (Yi(), T(n, kb, n, e), qi()) : T(n, kb, n, e);
						else {
							var c = Es(n.type, t.memoizedProps);
							t = t.memoizedState, n.type.defaultProps || "ref" in n.memoizedProps || yS || (e.props !== n.memoizedProps && console.error("Expected %s props to match memoized props before componentDidUpdate. This might either be because of a bug in React, or because a component reassigns its own `this.props`. Please file an issue.", C(n) || "instance"), e.state !== n.memoizedState && console.error("Expected %s state to match memoized state before componentDidUpdate. This might either be because of a bug in React, or because a component reassigns its own `this.state`. Please file an issue.", C(n) || "instance")), wc(n) ? (Yi(), T(n, jb, n, e, c, t, e.__reactInternalSnapshotBeforeUpdate), qi()) : T(n, jb, n, e, c, t, e.__reactInternalSnapshotBeforeUpdate);
						}
					}
					s & 64 && jc(n), s & 512 && Ic(n, n.return);
					break;
				case 3:
					if (t = Pi(), Fl(e, n), s & 64 && (s = n.updateQueue, s !== null)) {
						if (c = null, n.child !== null) switch (n.child.tag) {
							case 27:
							case 5:
								c = n.child.stateNode;
								break;
							case 1: c = n.child.stateNode;
						}
						try {
							T(n, Ma, s, c);
						} catch (e) {
							Gu(n, n.return, e);
						}
					}
					e.effectDuration += Fi(t);
					break;
				case 27: t === null && s & 4 && Qc(n);
				case 26:
				case 5:
					if (Fl(e, n), t === null) {
						if (s & 4) Gc(n);
						else if (s & 64) {
							e = n.type, t = n.memoizedProps, c = n.stateNode;
							try {
								T(n, of, c, e, t, n);
							} catch (e) {
								Gu(n, n.return, e);
							}
						}
					}
					s & 512 && Ic(n, n.return);
					break;
				case 12:
					if (s & 4) {
						s = Pi(), Fl(e, n), e = n.stateNode, e.effectDuration += Ii(s);
						try {
							T(n, Rc, n, t, wy, e.effectDuration);
						} catch (e) {
							Gu(n, n.return, e);
						}
					} else Fl(e, n);
					break;
				case 31:
					Fl(e, n), s & 4 && El(e, n);
					break;
				case 13:
					Fl(e, n), s & 4 && Dl(e, n), s & 64 && (e = n.memoizedState, e !== null && (e = e.dehydrated, e !== null && (s = Yu.bind(null, n), ip(e, s))));
					break;
				case 22:
					if (s = n.memoizedState !== null || FS, !s) {
						var l = t !== null && t.memoizedState !== null || IS;
						t = FS, c = IS, FS = s, (IS = l) && !c ? (s = PS, n.subtreeFlags & 8772 && (s |= NS), zl(e, n, s), (n.mode & G) !== W && 0 <= q && 0 <= J && .05 < J - q && br(n, q, J)) : Fl(e, n), FS = t, IS = c;
					}
					break;
				case 30:
					s & 18874368 && ml(n), Fl(e, n), s & 512 && Ic(n, n.return);
					break;
				case 7: s & 512 && Ic(n, n.return);
				default: Fl(e, n);
			}
			(n.mode & G) !== W && 0 <= q && 0 <= J && ((jy || .05 < ky) && Cr(n, q, J, ky, Ay), n.alternate === null && n.return !== null && n.return.alternate !== null && .05 < J - q && (gl(n.return.alternate, n.return) || yr(n, q, J, "Mount"))), zi(r), Vi(i), Ay = a, jy = o;
		}
		function bl(e, t) {
			for (e = e.child; e !== null;) xl(e, t), e = e.sibling;
		}
		function xl(e, t) {
			switch (e.tag) {
				case 5:
				case 26:
					try {
						var n = e.stateNode;
						t ? T(e, _f, n) : T(e, bf, e.stateNode, e.memoizedProps);
					} catch (t) {
						Gu(e, e.return, t);
					}
					Sl(e, t);
					break;
				case 6:
					try {
						var r = e.stateNode;
						t ? T(e, vf, r) : T(e, xf, r, e.memoizedProps), V = !0;
					} catch (t) {
						Gu(e, e.return, t);
					}
					break;
				case 18:
					try {
						var i = e.stateNode;
						t ? T(e, gf, i) : T(e, yf, e.stateNode);
					} catch (t) {
						Gu(e, e.return, t);
					}
					break;
				case 22:
				case 23:
					e.memoizedState === null && bl(e, t);
					break;
				default: bl(e, t);
			}
		}
		function Sl(e, t) {
			if (e.subtreeFlags & 67108864) for (e = e.child; e !== null;) {
				a: {
					var n = e, r = t;
					switch (n.tag) {
						case 4:
							xl(n, r);
							break a;
						case 22:
							n.memoizedState === null && Sl(n, r);
							break a;
						default: Sl(n, r);
					}
				}
				e = e.sibling;
			}
		}
		function Cl(e) {
			var t = e.alternate;
			t !== null && (e.alternate = null, Cl(t)), e.child = null, e.deletions = null, e.sibling = null, e.tag === 5 && (t = e.stateNode, t !== null && dt(t)), e.stateNode = null, e._debugOwner = null, e.return = null, e.dependencies = null, e.memoizedProps = null, e.memoizedState = null, e.pendingProps = null, e.stateNode = null, e.updateQueue = null;
		}
		function wl(e, t, n) {
			for (n = n.child; n !== null;) Tl(e, t, n), n = n.sibling;
		}
		function Tl(e, t, n) {
			if (jh && typeof jh.onCommitFiberUnmount == "function") try {
				jh.onCommitFiberUnmount(Ah, n);
			} catch (e) {
				Mh || (Mh = !0, console.error("React instrumentation encountered an error: %o", e));
			}
			var r = Ri(), i = Bi(), a = Hi(), o = Ui();
			switch (n.tag) {
				case 26:
					IS || Lc(n, t), wl(e, t, n), n.memoizedState ? n.memoizedState.count-- : n.stateNode && !IS && (e = n.stateNode, e.parentNode.removeChild(e));
					break;
				case 27:
					IS || Lc(n, t), Hc(n);
					var s = qS, c = JS;
					df(n.type) && (qS = n.stateNode, JS = !1), wl(e, t, n), T(n, _p, n.stateNode, n.type, n.memoizedProps), qS = s, JS = c;
					break;
				case 5: IS || Lc(n, t), Hc(n);
				case 6:
					if (n.tag === 6 && Hc(n), s = qS, c = JS, qS = null, wl(e, t, n), qS = s, JS = c, qS !== null) {
						if (JS) try {
							T(n, pf, qS, n.stateNode), V = !0;
						} catch (e) {
							Gu(n, t, e);
						}
						else try {
							T(n, ff, qS, n.stateNode), V = !0;
						} catch (e) {
							Gu(n, t, e);
						}
					}
					break;
				case 18:
					qS !== null && (JS ? (e = qS, mf(e.nodeType === 9 ? e.body : e.nodeName === "HTML" ? e.ownerDocument.body : e, n.stateNode), _m(e)) : mf(qS, n.stateNode));
					break;
				case 4:
					s = qS, c = JS, qS = n.stateNode.containerInfo, JS = !0, wl(e, t, n), qS = s, JS = c;
					break;
				case 0:
				case 11:
				case 14:
				case 15:
					Oc(Cx, n, t), IS || Ec(n, t, wx), wl(e, t, n);
					break;
				case 1:
					IS || (Lc(n, t), s = n.stateNode, typeof s.componentWillUnmount == "function" && Pc(n, t, s)), wl(e, t, n);
					break;
				case 21:
					wl(e, t, n);
					break;
				case 22:
					IS = (s = IS) || n.memoizedState !== null, wl(e, t, n), IS = s;
					break;
				case 30:
					n.flags & 18874368 && hl(n), Lc(n, t), wl(e, t, n);
					break;
				case 7:
					IS || Lc(n, t), wl(e, t, n);
					break;
				default: wl(e, t, n);
			}
			(n.mode & G) !== W && 0 <= q && 0 <= J && (jy || .05 < ky) && Cr(n, q, J, ky, Ay), zi(r), Vi(i), Ay = a, jy = o;
		}
		function El(e, t) {
			if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null))) {
				e = e.dehydrated;
				try {
					T(t, dp, e);
				} catch (e) {
					Gu(t, t.return, e);
				}
			}
		}
		function Dl(e, t) {
			if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null && (e = e.dehydrated, e !== null)))) try {
				T(t, fp, e);
			} catch (e) {
				Gu(t, t.return, e);
			}
		}
		function Ol(e) {
			switch (e.tag) {
				case 31:
				case 13:
				case 19:
					var t = e.stateNode;
					return t === null && (t = e.stateNode = new zS()), t;
				case 22: return e = e.stateNode, t = e._retryCache, t === null && (t = e._retryCache = new zS()), t;
				default: throw Error("Unexpected Suspense handler tag (" + e.tag + "). This is a bug in React.");
			}
		}
		function kl(e, t) {
			var n = Ol(e);
			t.forEach(function(t) {
				if (!n.has(t)) {
					if (n.add(t), Nh) {
						if (VS !== null && HS !== null) td(HS, VS);
						else throw Error("Expected finished root and lanes to be set. This is a bug in React.");
					}
					var r = Xu.bind(null, e, t);
					t.then(r, r);
				}
			});
		}
		function M(e, t, n) {
			var r = t.deletions;
			if (r !== null) for (var i = 0; i < r.length; i++) {
				var a = e, o = t, s = r[i], c = Ri(), l = o;
				a: for (; l !== null;) {
					switch (l.tag) {
						case 27:
							if (df(l.type)) {
								qS = l.stateNode, JS = !1;
								break a;
							}
							break;
						case 5:
							qS = l.stateNode, JS = !1;
							break a;
						case 3:
						case 4:
							qS = l.stateNode.containerInfo, JS = !0;
							break a;
					}
					l = l.return;
				}
				if (qS === null) throw Error("Expected to find a host parent. This error is likely caused by a bug in React. Please file an issue.");
				Tl(a, o, s), qS = null, JS = !1, (s.mode & G) !== W && 0 <= q && 0 <= J && .05 < J - q && yr(s, q, J, "Unmount"), zi(c), a = s, o = a.alternate, o !== null && (o.return = null), a.return = null;
			}
			if (t.subtreeFlags & 13886) for (t = t.child; t !== null;) Al(t, e, n), t = t.sibling;
		}
		function Al(e, t, n) {
			var r = Ri(), i = Bi(), a = Hi(), o = Ui(), s = e.alternate, c = e.flags;
			switch (e.tag) {
				case 0:
				case 11:
				case 14:
				case 15:
					if (c & 4 && (s = e.updateQueue, s = s === null ? null : s.events, s !== null)) for (var l = 0; l < s.length; l++) {
						var u = s[l];
						u.ref.impl = u.nextImpl;
					}
					M(t, e, n), jl(e), c & 4 && (Oc(Cx | Sx, e, e.return), Dc(Cx | Sx, e), Ec(e, e.return, wx | Sx));
					break;
				case 1:
					M(t, e, n), jl(e), c & 512 && (IS || s === null || Lc(s, s.return)), c & 64 && FS && (t = e.updateQueue, t !== null && (n = t.callbacks, n !== null && (c = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = c === null ? n : c.concat(n))));
					break;
				case 26:
					if (l = YS, M(t, e, n), jl(e), c & 512 && (IS || s === null || Lc(s, s.return)), c & 4) {
						if (c = s === null ? null : s.memoizedState, n = e.memoizedState, s === null) {
							if (n === null) {
								if (e.stateNode === null) {
									if (FS) e.stateNode = Zd(e.type, e.memoizedProps, t.containerInfo, e);
									else {
										a: {
											t = e.type, n = e.memoizedProps, c = l.ownerDocument || l;
											b: switch (t) {
												case "title":
													s = c.getElementsByTagName("title")[0], (!s || s[Qh] || s[Gh] || s.namespaceURI === Ig || s.hasAttribute("itemprop")) && (s = c.createElement(t), c.head.insertBefore(s, c.querySelector("head > title"))), Pd(s, t, n), s[Gh] = e, gt(s), t = s;
													break a;
												case "link":
													if (l = Np("link", "href", c).get(t + (n.href || ""))) {
														for (u = 0; u < l.length; u++) if (s = l[u], s.getAttribute("href") === (n.href == null || n.href === "" ? null : n.href) && s.getAttribute("rel") === (n.rel == null ? null : n.rel) && s.getAttribute("title") === (n.title == null ? null : n.title) && s.getAttribute("crossorigin") === (n.crossOrigin == null ? null : n.crossOrigin)) {
															l.splice(u, 1);
															break b;
														}
													}
													s = c.createElement(t), Pd(s, t, n), c.head.appendChild(s);
													break;
												case "meta":
													if (l = Np("meta", "content", c).get(t + (n.content || ""))) {
														for (u = 0; u < l.length; u++) if (s = l[u], Ve(n.content, "content"), s.getAttribute("content") === (n.content == null ? null : "" + n.content) && s.getAttribute("name") === (n.name == null ? null : n.name) && s.getAttribute("property") === (n.property == null ? null : n.property) && s.getAttribute("http-equiv") === (n.httpEquiv == null ? null : n.httpEquiv) && s.getAttribute("charset") === (n.charSet == null ? null : n.charSet)) {
															l.splice(u, 1);
															break b;
														}
													}
													s = c.createElement(t), Pd(s, t, n), c.head.appendChild(s);
													break;
												default: throw Error("getNodesForType encountered a type it did not expect: \"" + t + "\". This is a bug in React.");
											}
											s[Gh] = e, gt(s), t = s;
										}
										e.stateNode = t;
									}
								} else FS || Pp(l, e.type, e.stateNode);
							} else e.stateNode = kp(l, n, e.memoizedProps);
						} else c === n ? n === null && e.stateNode !== null && Kc(e, e.memoizedProps, s.memoizedProps) : (c === null ? (t = s.stateNode, t === null || IS || t.parentNode.removeChild(t)) : c.count--, n === null ? FS || Pp(l, e.type, e.stateNode) : kp(l, n, e.memoizedProps));
					}
					break;
				case 27:
					M(t, e, n), jl(e), c & 512 && (IS || s === null || Lc(s, s.return)), s !== null && c & 4 && Kc(e, e.memoizedProps, s.memoizedProps);
					break;
				case 5:
					if (l = LS, LS = !1, M(t, e, n), LS = l, jl(e), c & 512 && (IS || s === null || Lc(s, s.return)), e.flags & 32) {
						t = e.stateNode;
						try {
							T(e, cf, t), V = !0;
						} catch (t) {
							Gu(e, e.return, t);
						}
					}
					c & 4 && e.stateNode != null && (t = e.memoizedProps, Kc(e, t, s === null ? t : s.memoizedProps)), c & 1024 && (RS = !0, e.type !== "form" && console.error("Unexpected host component type. Expected a form. This is a bug in React."));
					break;
				case 6:
					if (M(t, e, n), jl(e), c & 4) {
						if (e.stateNode === null) throw Error("This should have a text node initialized. This error is likely caused by a bug in React. Please file an issue.");
						t = e.memoizedProps, n = s === null ? t : s.memoizedProps, c = e.stateNode;
						try {
							T(e, lf, c, n, t), V = !0;
						} catch (t) {
							Gu(e, e.return, t);
						}
					}
					break;
				case 3:
					if (l = Pi(), V = !1, GT = null, u = YS, YS = yp(t.containerInfo), M(t, e, n), YS = u, jl(e), c & 4 && s !== null && s.memoizedState.isDehydrated) try {
						T(e, up, t.containerInfo);
					} catch (t) {
						Gu(e, e.return, t);
					}
					RS && (RS = !1, Ml(e)), t.effectDuration += Fi(l), V = !1;
					break;
				case 4:
					c = LS, LS = FS, s = St(), l = YS, YS = yp(e.stateNode.containerInfo), M(t, e, n), jl(e), YS = l, V && WS && (GS = !0), V = s, LS = c;
					break;
				case 12:
					c = Pi(), M(t, e, n), jl(e), e.stateNode.effectDuration += Ii(c);
					break;
				case 31:
					M(t, e, n), jl(e), c & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, kl(e, t)));
					break;
				case 13:
					M(t, e, n), jl(e), e.child.flags & 8192 && e.memoizedState !== null != (s !== null && s.memoizedState !== null) && (zC = xh()), c & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, kl(e, t)));
					break;
				case 22:
					l = e.memoizedState !== null, u = s !== null && s.memoizedState !== null;
					var d = FS, f = IS, p = LS;
					FS = d || l, LS = p || l, IS = f || u, M(t, e, n), IS = f, LS = p, FS = d, u && !l && !d && !f && (e.mode & G) !== W && 0 <= q && 0 <= J && .05 < J - q && br(e, q, J), jl(e), c & 8192 && (t = e.stateNode, t._visibility = l ? t._visibility & ~Mv : t._visibility | Mv, !l || s === null || u || FS || IS || (t = PS, n = u || IS, s = FS, u = IS, FS = l || FS, IS = n, Ll(e, t), (e.mode & G) !== W && 0 <= q && 0 <= J && .05 < J - q && yr(e, q, J, "Disconnect"), FS = s, IS = u), !l && LS || bl(e, l)), c & 4 && (t = e.updateQueue, t !== null && (n = t.retryQueue, n !== null && (t.retryQueue = null, kl(e, n))));
					break;
				case 19:
					M(t, e, n), jl(e), c & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, kl(e, t)));
					break;
				case 30:
					c & 512 && (IS || s === null || Lc(s, s.return)), c = St(), l = WS, u = (n & 335544064) === n, d = e.memoizedProps, WS = u && fr(d.default, d.update) !== "none", M(t, e, n), jl(e), u && s !== null && V && (e.flags |= 4), WS = l, V = c;
					break;
				case 21: break;
				case 7: c & 512 && (IS || s === null || Lc(s, s.return)), s && s.stateNode !== null && (s.stateNode._fragmentFiber = e);
				default: M(t, e, n), jl(e);
			}
			(e.mode & G) !== W && 0 <= q && 0 <= J && ((jy || .05 < ky) && Cr(e, q, J, ky, Ay), e.alternate === null && e.return !== null && e.return.alternate !== null && .05 < J - q && (gl(e.return.alternate, e.return) || yr(e, q, J, "Mount"))), zi(r), Vi(i), Ay = a, jy = o;
		}
		function jl(e) {
			var t = e.flags;
			if (t & 2) {
				try {
					T(e, Zc, e);
				} catch (t) {
					Gu(e, e.return, t);
				}
				e.flags &= -3;
			}
			t & 4096 && (e.flags &= -4097);
		}
		function Ml(e) {
			if (e.subtreeFlags & 1024) for (e = e.child; e !== null;) {
				var t = e;
				Ml(t), t.tag === 5 && t.flags & 1024 && (t = t.stateNode, gE = !0, t.reset(), gE = !1), e = e.sibling;
			}
		}
		function Nl(e, t) {
			if (t.subtreeFlags & 9270) for (t = t.child; t !== null;) Pl(t, e), t = t.sibling;
			else pl(t, !1);
		}
		function Pl(e, t) {
			var n = e.alternate;
			if (n === null) al(e, !1);
			else switch (e.tag) {
				case 3:
					if (KS = US = !1, el(), Nl(t, e), !US && !GS) {
						if (e = OS, e !== null) for (var r = 0; r < e.length; r += 3) {
							n = e[r];
							var i = e[r + 1];
							wf(n, e[r + 2]), n = n.ownerDocument.documentElement, n !== null && n.animate({
								opacity: [0, 0],
								pointerEvents: ["none", "none"]
							}, {
								duration: 0,
								fill: "forwards",
								pseudoElement: "::view-transition-group(" + i + ")"
							});
						}
						e = t.containerInfo, e = e.nodeType === 9 ? e.documentElement : e.ownerDocument.documentElement, e !== null && e.style.viewTransitionName === "" && (e.style.viewTransitionName = "none", e.animate({
							opacity: [0, 0],
							pointerEvents: ["none", "none"]
						}, {
							duration: 0,
							fill: "forwards",
							pseudoElement: "::view-transition-group(root)"
						}), e.animate({
							width: [0, 0],
							height: [0, 0]
						}, {
							duration: 0,
							fill: "forwards",
							pseudoElement: "::view-transition"
						})), KS = !0;
					}
					OS = null;
					break;
				case 5:
					Nl(t, e);
					break;
				case 4:
					r = US, US = !1, Nl(t, e), US && (GS = !0), US = r;
					break;
				case 22:
					e.memoizedState === null && (n.memoizedState === null ? Nl(t, e) : al(e, !1));
					break;
				case 30:
					r = US, i = el(), US = !1, Nl(t, e), US && (e.flags |= 4);
					var a = e.memoizedProps, o = e.stateNode;
					t = ur(a, o), o = ur(n.memoizedProps, o);
					var s = fr(a.default, a.update);
					s === "none" ? t = !1 : (a = n.memoizedState, n.memoizedState = null, n = e.child, kS = 0, t = fl(e, n, t, o, s, a, !0), kS !== (a === null ? 0 : a.length) && (e.flags |= 32)), e.flags & 4 && t ? (au(e, e.memoizedProps.onUpdate), OS = i) : i !== null && (i.push.apply(i, OS), OS = i), US = e.flags & 32 ? !0 : r;
					break;
				default: Nl(t, e);
			}
		}
		function Fl(e, t) {
			if (t.subtreeFlags & 8772) for (t = t.child; t !== null;) yl(e, t.alternate, t), t = t.sibling;
		}
		function Il(e, t) {
			var n = Ri(), r = Bi(), i = Hi(), a = Ui();
			switch (e.tag) {
				case 0:
				case 11:
				case 14:
				case 15:
					Ec(e, e.return, wx), Ll(e, t);
					break;
				case 1:
					Lc(e, e.return);
					var o = e.stateNode;
					typeof o.componentWillUnmount == "function" && Pc(e, e.return, o), Ll(e, t);
					break;
				case 27: (t & PS) !== MS && T(e, _p, e.stateNode, e.type, e.memoizedProps);
				case 5:
					Lc(e, e.return), e.tag !== 5 && e.tag !== 27 || Hc(e), Ll(e, t);
					break;
				case 6:
					Hc(e);
					break;
				case 26:
					Lc(e, e.return), o = e.stateNode, e.memoizedState !== null || o === null || IS || o.parentNode.removeChild(o), Ll(e, t);
					break;
				case 22:
					e.memoizedState === null && Ll(e, t);
					break;
				case 30:
					e.flags & 18874368 && hl(e), Lc(e, e.return), Ll(e, t);
					break;
				case 7: Lc(e, e.return);
				default: Ll(e, t);
			}
			(e.mode & G) !== W && 0 <= q && 0 <= J && (jy || .05 < ky) && Cr(e, q, J, ky, Ay), zi(n), Vi(r), Ay = i, jy = a;
		}
		function Ll(e, t) {
			for (e = e.child; e !== null;) Il(e, t), e = e.sibling;
		}
		function Rl(e, t, n, r) {
			var i = Ri(), a = Bi(), o = Hi(), s = Ui(), c = n.flags, l = (r & NS) !== MS;
			switch (n.tag) {
				case 0:
				case 11:
				case 15:
					zl(e, n, r), Tc(n, wx);
					break;
				case 1:
					if (zl(e, n, r), t = n.stateNode, typeof t.componentDidMount == "function" && T(n, kb, n, t), t = n.updateQueue, t !== null) {
						e = n.stateNode;
						try {
							T(n, ja, t, e);
						} catch (e) {
							Gu(n, n.return, e);
						}
					}
					l && c & 64 && jc(n), Ic(n, n.return);
					break;
				case 27: (r & PS) !== MS && Qc(n);
				case 5:
					n.tag !== 5 && n.tag !== 27 || Vc(n), zl(e, n, r), l && t === null && c & 4 && Gc(n), Ic(n, n.return);
					break;
				case 6:
					Vc(n);
					break;
				case 26:
					var u = n.stateNode;
					n.memoizedState !== null || u === null || FS || Pp(yp(u.ownerDocument), n.type, u), zl(e, n, r), l && t === null && c & 4 && Gc(n), Ic(n, n.return);
					break;
				case 12:
					if (l && c & 4) {
						c = Pi(), zl(e, n, r), l = n.stateNode, l.effectDuration += Ii(c);
						try {
							T(n, Rc, n, t, wy, l.effectDuration);
						} catch (e) {
							Gu(n, n.return, e);
						}
					} else zl(e, n, r);
					break;
				case 31:
					zl(e, n, r), l && c & 4 && El(e, n);
					break;
				case 13:
					zl(e, n, r), l && c & 4 && Dl(e, n);
					break;
				case 22:
					n.memoizedState === null && zl(e, n, r), Ic(n, n.return);
					break;
				case 30:
					zl(e, n, r), c & 18874368 && ml(n), Ic(n, n.return);
					break;
				case 7: Ic(n, n.return);
				default: zl(e, n, r);
			}
			(n.mode & G) !== W && 0 <= q && 0 <= J && (jy || .05 < ky) && Cr(n, q, J, ky, Ay), zi(i), Vi(a), Ay = o, jy = s;
		}
		function zl(e, t, n) {
			for (n = t.subtreeFlags & 8772 ? n : n & ~NS, t = t.child; t !== null;) Rl(e, t.alternate, t, n), t = t.sibling;
		}
		function Bl(e, t) {
			var n = null;
			e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), e = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (e = t.memoizedState.cachePool.pool), e !== n && (e != null && Oi(e), n != null && ki(n));
		}
		function Vl(e, t) {
			e = null, t.alternate !== null && (e = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== e && (Oi(t), e != null && ki(e));
		}
		function Hl(e, t, n, r, i) {
			var a = (n & 335544064) === n;
			if (t.subtreeFlags & (a ? 10262 : 10256) || t.actualDuration !== 0 && (t.alternate === null || t.alternate.child !== t.child)) for (t = t.child; t !== null;) a = t.sibling, Ul(e, t, n, r, a === null ? i : a.actualStartTime), t = a;
			else a && dl(t);
		}
		function Ul(e, t, n, r, i) {
			var a = Ri(), o = Bi(), s = Hi(), c = Ui(), l = Ev, u = (n & 335544064) === n;
			u && t.alternate === null && t.return !== null && t.return.alternate !== null && ul(t);
			var d = t.flags;
			switch (t.tag) {
				case 0:
				case 11:
				case 15:
					(t.mode & G) !== W && 0 < t.actualStartTime && t.flags & 1 && xr(t, t.actualStartTime, i, XS, n), Hl(e, t, n, r, i), d & 2048 && kc(t, Tx | Sx);
					break;
				case 1:
					(t.mode & G) !== W && 0 < t.actualStartTime && (t.flags & 128 ? Sr(t, t.actualStartTime, i, []) : t.flags & 1 && xr(t, t.actualStartTime, i, XS, n)), Hl(e, t, n, r, i);
					break;
				case 3:
					var f = Pi(), p = XS;
					XS = t.alternate !== null && t.alternate.memoizedState.isDehydrated && !(t.flags & 256), Hl(e, t, n, r, i), XS = p, u && KS && (n = e.containerInfo, n = n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n, n.style.viewTransitionName === "root" && (n.style.viewTransitionName = ""), n = n.ownerDocument.documentElement, n !== null && n.style.viewTransitionName === "none" && (n.style.viewTransitionName = "")), d & 2048 && (n = null, t.alternate !== null && (n = t.alternate.memoizedState.cache), r = t.memoizedState.cache, r !== n && (Oi(r), n != null && ki(n))), e.passiveEffectDuration += Fi(f);
					break;
				case 12:
					if (d & 2048) {
						d = Pi(), Hl(e, t, n, r, i), e = t.stateNode, e.passiveEffectDuration += Ii(d);
						try {
							T(t, zc, t, t.alternate, wy, e.passiveEffectDuration);
						} catch (e) {
							Gu(t, t.return, e);
						}
					} else Hl(e, t, n, r, i);
					break;
				case 31:
					d = XS, f = t.alternate === null ? null : t.alternate.memoizedState, u = t.memoizedState, f !== null && u === null ? (u = t.deletions, u !== null && 0 < u.length && u[0].tag === 18 ? (XS = !1, f = f.hydrationErrors, f !== null && Sr(t, t.actualStartTime, i, f)) : XS = !0) : XS = !1, Hl(e, t, n, r, i), XS = d;
					break;
				case 13:
					d = XS, f = t.alternate === null ? null : t.alternate.memoizedState, u = t.memoizedState, f === null || f.dehydrated === null || u !== null && u.dehydrated !== null ? XS = !1 : (u = t.deletions, u !== null && 0 < u.length && u[0].tag === 18 ? (XS = !1, f = f.hydrationErrors, f !== null && Sr(t, t.actualStartTime, i, f)) : XS = !0), Hl(e, t, n, r, i), XS = d;
					break;
				case 23: break;
				case 22:
					p = t.stateNode, f = t.alternate, t.memoizedState === null ? (u && f !== null && f.memoizedState !== null && ul(t), p._visibility & Nv ? Hl(e, t, n, r, i) : (p._visibility |= Nv, Wl(e, t, n, r, !!(t.subtreeFlags & 10256) || t.actualDuration !== 0 && (t.alternate === null || t.alternate.child !== t.child), i), (t.mode & G) === W || XS || (e = t.actualStartTime, 0 <= e && .05 < i - e && br(t, e, i), 0 <= q && 0 <= J && .05 < J - q && br(t, q, J)))) : (u && f !== null && f.memoizedState === null && ul(f), p._visibility & Nv ? Hl(e, t, n, r, i) : Kl(e, t, n, r, i)), d & 2048 && Bl(f, t);
					break;
				case 24:
					Hl(e, t, n, r, i), d & 2048 && Vl(t.alternate, t);
					break;
				case 30:
					u && (d = t.alternate, d !== null && (rl(d.child, !0), rl(t.child, !0))), Hl(e, t, n, r, i);
					break;
				default: Hl(e, t, n, r, i);
			}
			(t.mode & G) !== W && ((e = !XS && t.alternate === null && t.return !== null && t.return.alternate !== null) && (n = t.actualStartTime, 0 <= n && .05 < i - n && yr(t, n, i, "Mount")), 0 <= q && 0 <= J && ((jy || .05 < ky) && Cr(t, q, J, ky, Ay), e && .05 < J - q && yr(t, q, J, "Mount"))), zi(a), Vi(o), Ay = s, jy = c, Ev = l;
		}
		function Wl(e, t, n, r, i, a) {
			for (i &&= !!(t.subtreeFlags & 10256) || t.actualDuration !== 0 && (t.alternate === null || t.alternate.child !== t.child), t = t.child; t !== null;) {
				var o = t.sibling;
				Gl(e, t, n, r, i, o === null ? a : o.actualStartTime), t = o;
			}
		}
		function Gl(e, t, n, r, i, a) {
			var o = Ri(), s = Bi(), c = Hi(), l = Ui(), u = Ev;
			i && (t.mode & G) !== W && 0 < t.actualStartTime && t.flags & 1 && xr(t, t.actualStartTime, a, XS, n);
			var d = t.flags;
			switch (t.tag) {
				case 0:
				case 11:
				case 15:
					Wl(e, t, n, r, i, a), kc(t, Tx);
					break;
				case 23: break;
				case 22:
					var f = t.stateNode;
					t.memoizedState === null ? (f._visibility |= Nv, Wl(e, t, n, r, i, a)) : f._visibility & Nv ? Wl(e, t, n, r, i, a) : Kl(e, t, n, r, a), i && d & 2048 && Bl(t.alternate, t);
					break;
				case 24:
					Wl(e, t, n, r, i, a), i && d & 2048 && Vl(t.alternate, t);
					break;
				default: Wl(e, t, n, r, i, a);
			}
			(t.mode & G) !== W && 0 <= q && 0 <= J && (jy || .05 < ky) && Cr(t, q, J, ky, Ay), zi(o), Vi(s), Ay = c, jy = l, Ev = u;
		}
		function Kl(e, t, n, r, i) {
			if (t.subtreeFlags & 10256 || t.actualDuration !== 0 && (t.alternate === null || t.alternate.child !== t.child)) for (var a = t.child; a !== null;) {
				t = a.sibling;
				var o = e, s = n, c = r, l = t === null ? i : t.actualStartTime, u = Ev;
				(a.mode & G) !== W && 0 < a.actualStartTime && a.flags & 1 && xr(a, a.actualStartTime, l, XS, s);
				var d = a.flags;
				switch (a.tag) {
					case 22:
						Kl(o, a, s, c, l), d & 2048 && Bl(a.alternate, a);
						break;
					case 24:
						Kl(o, a, s, c, l), d & 2048 && Vl(a.alternate, a);
						break;
					default: Kl(o, a, s, c, l);
				}
				Ev = u, a = t;
			}
		}
		function ql(e, t, n) {
			if (e.subtreeFlags & ZS) for (e = e.child; e !== null;) Jl(e, t, n), e = e.sibling;
		}
		function Jl(e, t, n) {
			switch (e.tag) {
				case 26:
					ql(e, t, n), e.flags & ZS && (e.memoizedState === null ? (e = e.stateNode, (t & 335544128) === t && zp(n, e)) : Bp(n, YS, e.memoizedState, e.memoizedProps));
					break;
				case 5:
					ql(e, t, n), e.flags & ZS && (e = e.stateNode, (t & 335544128) === t && zp(n, e));
					break;
				case 3:
				case 4:
					var r = YS;
					YS = yp(e.stateNode.containerInfo), ql(e, t, n), YS = r;
					break;
				case 22:
					e.memoizedState === null && (r = e.alternate, r !== null && r.memoizedState !== null ? (r = ZS, ZS = 16777216, ql(e, t, n), ZS = r) : ql(e, t, n));
					break;
				case 30:
					if ((e.flags & ZS) !== 0 && (r = e.memoizedProps.name, r != null && r !== "auto")) {
						var i = e.stateNode;
						i.paired = null, DS === null && (DS = /* @__PURE__ */ new Map()), DS.set(r, i);
					}
					ql(e, t, n);
					break;
				default: ql(e, t, n);
			}
		}
		function Yl(e) {
			var t = e.alternate;
			if (t !== null && (e = t.child, e !== null)) {
				t.child = null;
				do
					t = e.sibling, e.sibling = null, e = t;
				while (e !== null);
			}
		}
		function Xl(e) {
			var t = e.deletions;
			if (e.flags & 16) {
				if (t !== null) for (var n = 0; n < t.length; n++) {
					var r = t[n], i = Ri();
					BS = r, eu(r, e), (r.mode & G) !== W && 0 <= q && 0 <= J && .05 < J - q && yr(r, q, J, "Unmount"), zi(i);
				}
				Yl(e);
			}
			if (e.subtreeFlags & 10256) for (e = e.child; e !== null;) Zl(e), e = e.sibling;
		}
		function Zl(e) {
			var t = Ri(), n = Bi(), r = Hi(), i = Ui();
			switch (e.tag) {
				case 0:
				case 11:
				case 15:
					Xl(e), e.flags & 2048 && Ac(e, e.return, Tx | Sx);
					break;
				case 3:
					var a = Pi();
					Xl(e), e.stateNode.passiveEffectDuration += Fi(a);
					break;
				case 12:
					a = Pi(), Xl(e), e.stateNode.passiveEffectDuration += Ii(a);
					break;
				case 22:
					a = e.stateNode, e.memoizedState !== null && a._visibility & Nv && (e.return === null || e.return.tag !== 13) ? (a._visibility &= ~Nv, Ql(e), (e.mode & G) !== W && 0 <= q && 0 <= J && .05 < J - q && yr(e, q, J, "Disconnect")) : Xl(e);
					break;
				default: Xl(e);
			}
			(e.mode & G) !== W && 0 <= q && 0 <= J && (jy || .05 < ky) && Cr(e, q, J, ky, Ay), zi(t), Vi(n), jy = i, Ay = r;
		}
		function Ql(e) {
			var t = e.deletions;
			if (e.flags & 16) {
				if (t !== null) for (var n = 0; n < t.length; n++) {
					var r = t[n], i = Ri();
					BS = r, eu(r, e), (r.mode & G) !== W && 0 <= q && 0 <= J && .05 < J - q && yr(r, q, J, "Unmount"), zi(i);
				}
				Yl(e);
			}
			for (e = e.child; e !== null;) $l(e), e = e.sibling;
		}
		function $l(e) {
			var t = Ri(), n = Bi(), r = Hi(), i = Ui();
			switch (e.tag) {
				case 0:
				case 11:
				case 15:
					Ac(e, e.return, Tx), Ql(e);
					break;
				case 22:
					var a = e.stateNode;
					a._visibility & Nv && (a._visibility &= ~Nv, Ql(e));
					break;
				default: Ql(e);
			}
			(e.mode & G) !== W && 0 <= q && 0 <= J && (jy || .05 < ky) && Cr(e, q, J, ky, Ay), zi(t), Vi(n), jy = i, Ay = r;
		}
		function eu(e, t) {
			for (; BS !== null;) {
				var n = BS, r = n, i = t, a = Ri(), o = Bi(), s = Hi(), c = Ui();
				switch (r.tag) {
					case 0:
					case 11:
					case 15:
						Ac(r, i, Tx);
						break;
					case 23:
					case 22:
						r.memoizedState !== null && r.memoizedState.cachePool !== null && (i = r.memoizedState.cachePool.pool, i != null && Oi(i));
						break;
					case 24: ki(r.memoizedState.cache);
				}
				if ((r.mode & G) !== W && 0 <= q && 0 <= J && (jy || .05 < ky) && Cr(r, q, J, ky, Ay), zi(a), Vi(o), jy = c, Ay = s, r = n.child, r !== null) r.return = n, BS = r;
				else a: for (n = e; BS !== null;) {
					if (r = BS, a = r.sibling, o = r.return, Cl(r), r === n) {
						BS = null;
						break a;
					}
					if (a !== null) {
						a.return = o, BS = a;
						break a;
					}
					BS = o;
				}
			}
		}
		function tu() {
			eC.forEach(function(e) {
				return e();
			});
		}
		function nu() {
			var e = typeof IS_REACT_ACT_ENVIRONMENT < "u" ? IS_REACT_ACT_ENVIRONMENT : void 0;
			return e || z.actQueue === null || console.error("The current testing environment is not configured to support act(...)"), e;
		}
		function ru(e) {
			if ((fC & rC) !== nC && $ !== 0) return $ & -$;
			var t = z.T;
			return t === null ? (e = lt(), e === Bh && (Kb = null), e) : (t._updatedFibers ||= /* @__PURE__ */ new Set(), t._updatedFibers.add(e), Kb !== null && lt() === Bh && (Kb = null), pd());
		}
		function iu() {
			if (PC === 0) {
				if (!($ & 536870912) || K) {
					var e = Rh;
					Rh <<= 1, !(Rh & 3932160) && (Rh = 262144), PC = e;
				} else PC = 536870912;
			}
			return e = gx.current, e !== null && (e.flags |= 32), PC;
		}
		function au(e, t) {
			if (t != null) {
				var n = e.stateNode, r = n.ref;
				r === null && (r = n.ref = Nf(ur(e.memoizedProps, n))), fw === null && (fw = []), fw.push(t.bind(null, r));
			}
		}
		function ou(e, t, n) {
			if (Tw && console.error("useInsertionEffect must not schedule updates."), bw && (xw = !0), (e === pC && (wC === gC || wC === CC) || e.cancelPendingCommit !== null) && (mu(e, 0), uu(e, $, PC, !1)), et(e, n), (fC & rC) !== nC && e === pC) {
				if (hh) switch (t.tag) {
					case 0:
					case 11:
					case 15:
						e = Q && C(Q) || "Unknown", kw.has(e) || (kw.add(e), t = C(t) || "Unknown", console.error("Cannot update a component (`%s`) while rendering a different component (`%s`). To locate the bad setState() call inside `%s`, follow the stack trace as described in https://react.dev/link/setstate-in-render", t, e, e));
						break;
					case 1: Ow ||= (console.error("Cannot update during an existing state transition (such as within `render`). Render methods should be a pure function of props and state."), !0);
				}
			} else Nh && ot(e, t, n), rd(t), e === pC && ((fC & rC) === nC && (MC |= n), AC === lC && uu(e, $, PC, !1)), id(e);
		}
		function su(e, t, n) {
			if ((fC & (rC | iC)) !== nC) throw Error("Should not already be working.");
			if ($ !== 0 && Q !== null) {
				var r = Q, i = xh();
				switch (rb) {
					case _C:
					case gC:
						var a = ib;
						wv && ((r = r._debugTask) ? r.run(console.timeStamp.bind(console, "Suspended", a, i, Tv, void 0, "primary-light")) : console.timeStamp("Suspended", a, i, Tv, void 0, "primary-light"));
						break;
					case CC:
						a = ib, wv && ((r = r._debugTask) ? r.run(console.timeStamp.bind(console, "Action", a, i, Tv, void 0, "primary-light")) : console.timeStamp("Action", a, i, Tv, void 0, "primary-light"));
						break;
					default: wv && (r = i - ib, 3 > r || console.timeStamp("Blocked", ib, i, Tv, void 0, 5 > r ? "primary-light" : 10 > r ? "primary" : 100 > r ? "primary-dark" : "error"));
				}
			}
			a = (n = !n && !(t & 127) && (t & e.expiredLanes) === 0 || Ye(e, t)) ? Cu(e, t) : xu(e, t, !0);
			var o = n;
			do {
				if (a === aC) {
					DC && !n && uu(e, t, 0, !1), t = wC, ib = yy(), rb = t;
					break;
				}
				if (r = xh(), i = e.current.alternate, o && !lu(i)) {
					vr(t), i = Cy, a = r, !wv || a <= i || (GC ? GC.run(console.timeStamp.bind(console, "Teared Render", i, a, U, H, "error")) : console.timeStamp("Teared Render", i, a, U, H, "error")), pu(t, r), a = xu(e, t, !1), o = !1;
					continue;
				}
				if (a === sC) {
					if (o = t, e.errorRecoveryDisabledLanes & o) var s = 0;
					else s = e.pendingLanes & -536870913, s = s === 0 ? s & 536870912 ? 536870912 : 0 : s;
					if (s !== 0) {
						vr(t), Er(Cy, r, t, GC), pu(t, r), t = s;
						a: {
							r = e, a = o, o = IC;
							var c = r.current.memoizedState.isDehydrated;
							if (c && (mu(r, s).flags |= 256), s = xu(r, s, !1), s !== sC && s !== uC) {
								if (OC && !c) {
									r.errorRecoveryDisabledLanes |= a, MC |= a, a = lC;
									break a;
								}
								r = LC, LC = o, r !== null && (LC === null ? LC = r : LC.push.apply(LC, r));
							}
							a = s;
						}
						if (o = !1, a !== sC) continue;
						r = xh();
					}
				}
				if (a === oC) {
					vr(t), Er(Cy, r, t, GC), pu(t, r), mu(e, 0), uu(e, t, 0, !0);
					break;
				}
				a: {
					switch (n = e, a) {
						case aC:
						case oC: throw Error("Root did not complete. This is a bug in React.");
						case lC: if ((t & 4194048) !== t && (t & 62914560) !== t) break;
						case uC:
							vr(t), wr(Cy, r, t, GC), pu(t, r), i = t, i & 127 ? Vy = r : i & 4194048 && (Qy = r), uu(n, t, PC, !EC);
							break a;
						case sC:
							LC = null;
							break;
						case cC:
						case dC: break;
						default: throw Error("Unknown root exit status.");
					}
					if (z.actQueue !== null) ju(n, i, t, LC, WC, RC, PC, MC, FC, EC, a, null, null, Cy, r);
					else {
						if ((t & 62914560) === t && (o = zC + VC - xh(), 10 < o)) {
							if (uu(n, t, PC, !EC), Je(n, 0, !0) !== 0) break a;
							ow = t, n.timeoutHandle = ET(cu.bind(null, n, i, LC, WC, RC, t, PC, MC, FC, EC, a, "Throttled", Cy, r), o);
							break a;
						}
						cu(n, i, LC, WC, RC, t, PC, MC, FC, EC, a, null, Cy, r);
					}
				}
				break;
			} while (1);
			id(e);
		}
		function cu(e, t, n, r, i, a, o, s, c, l, u, d, f, p) {
			e.timeoutHandle = OT;
			var m = t.subtreeFlags, h = (a & 335544064) === a, g = null;
			if ((h || m & 8192 || (m & 16785408) == 16785408) && (g = {
				stylesheets: null,
				count: 0,
				imgCount: 0,
				imgBytes: 0,
				suspenseyImages: [],
				waitingForImages: !0,
				waitingForViewTransition: !1,
				unsuspend: wn
			}, DS = null, Jl(t, a, g), h && (m = g, h = e.containerInfo, h = (h.nodeType === 9 ? h : h.ownerDocument).__reactViewTransition, h != null && (m.count++, m.waitingForViewTransition = !0, m = Up.bind(m), h.finished.then(m, m))), m = (a & 62914560) === a ? zC - xh() : (a & 4194048) === a ? BC - xh() : 0, m = Vp(g, m), m !== null)) {
				ow = a, e.cancelPendingCommit = m(ju.bind(null, e, t, a, n, r, i, o, s, c, l, u, g, g.waitingForViewTransition ? "Waiting for the previous Animation" : 0 < g.count ? 0 < g.imgCount ? "Suspended on CSS and Images" : "Suspended on CSS" : g.imgCount === 1 ? "Suspended on an Image" : 0 < g.imgCount ? "Suspended on Images" : null, f, p)), uu(e, a, o, !l);
				return;
			}
			ju(e, t, a, n, r, i, o, s, c, l, u, g, d, f, p);
		}
		function lu(e) {
			for (var t = e;;) {
				var n = t.tag;
				if ((n === 0 || n === 11 || n === 15) && t.flags & 16384 && (n = t.updateQueue, n !== null && (n = n.stores, n !== null))) for (var r = 0; r < n.length; r++) {
					var i = n[r], a = i.getSnapshot;
					i = i.value;
					try {
						if (!G_(a(), i)) return !1;
					} catch {
						return !1;
					}
				}
				if (n = t.child, t.subtreeFlags & 16384 && n !== null) n.return = t, t = n;
				else {
					if (t === e) break;
					for (; t.sibling === null;) {
						if (t.return === null || t.return === e) return !0;
						t = t.return;
					}
					t.sibling.return = t.return, t = t.sibling;
				}
			}
			return !0;
		}
		function uu(e, t, n, r) {
			t = Xe(e, t), t &= ~NC, t &= ~MC, e.suspendedLanes |= t, e.pingedLanes &= ~t, r && (e.warmLanes |= t), r = e.expirationTimes;
			for (var i = t; 0 < i;) {
				var a = 31 - Ph(i), o = 1 << a;
				r[a] = -1, i &= ~o;
			}
			n !== 0 && nt(e, n, t);
		}
		function du() {
			return (fC & (rC | iC)) !== nC || (ad(0, !1), !1);
		}
		function fu() {
			if (Q !== null) {
				if (wC === mC) var e = Q.return;
				else e = Q, gi(), eo(e), Zb = null, Qb = 0, e = Q;
				for (; e !== null;) Cc(e.alternate, e), e = e.return;
				Q = null;
			}
		}
		function pu(e, t) {
			e & 127 && (My = t), e & 4194048 && (Hy = t), e & 62914560 && ($y = t), e & 2080374784 && (eb = t);
		}
		function mu(e, t) {
			wv && (console.timeStamp("Blocking Track", .003, .003, "Blocking", H, "primary-light"), console.timeStamp("Transition Track", .003, .003, "Transition", H, "primary-light"), console.timeStamp("Suspense Track", .003, .003, "Suspense", H, "primary-light"), console.timeStamp("Idle Track", .003, .003, "Idle", H, "primary-light"));
			var n = Cy;
			if (Cy = yy(), $ !== 0 && 0 < n) {
				if (vr($), AC === cC || AC === lC) wr(n, Cy, t, GC);
				else {
					var r = Cy, i = GC;
					if (wv && !(r <= n)) {
						var a = (t & 738197653) === t ? "tertiary-dark" : "primary-dark", o = (t & 536870912) === t ? "Prewarm" : (t & 201326741) === t ? "Interrupted Hydration" : "Interrupted Render";
						i ? i.run(console.timeStamp.bind(console, o, n, r, U, H, a)) : console.timeStamp(o, n, r, U, H, a);
					}
				}
				pu($, Cy);
			}
			if (n = GC, GC = null, t & 127) {
				GC = Py, i = 0 <= Ny && Ny < My ? My : Ny, r = 0 <= Ry && Ry < My ? My : Ry, a = 0 <= r ? r : 0 <= i ? i : Cy, 0 <= Vy ? (vr(2), Tr(Vy, a, t, n)) : tb & 127 && (vr(2), Ar(My, a, nb)), n = i;
				var s = r, c = zy, l = 0 < By, u = Fy === xy, d = Fy === Sy;
				if (i = Cy, r = Py, a = Iy, o = Ly, wv) {
					if (U = "Blocking", 0 < n ? n > i && (n = i) : n = i, 0 < s ? s > n && (s = n) : s = n, c !== null && n > s) {
						var f = l ? "secondary-light" : "warning";
						r ? r.run(console.timeStamp.bind(console, l ? "Consecutive" : "Event: " + c, s, n, U, H, f)) : console.timeStamp(l ? "Consecutive" : "Event: " + c, s, n, U, H, f);
					}
					i > n && (s = u ? "error" : (t & 738197653) === t ? "tertiary-light" : "primary-light", u = d ? "Promise Resolved" : u ? "Cascading Update" : 5 < i - n ? "Update Blocked" : "Update", d = [], o != null && d.push(["Component name", o]), a != null && d.push(["Method name", a]), n = {
						start: n,
						end: i,
						detail: { devtools: {
							properties: d,
							track: U,
							trackGroup: H,
							color: s
						} }
					}, r ? r.run(performance.measure.bind(performance, u, n)) : performance.measure(u, n), performance.clearMeasures(u));
				}
				Ny = -1.1, Fy = 0, Ly = Iy = null, Vy = -1.1, By = Ry, Ry = -1.1, My = yy();
			}
			return t & 4194048 && (GC = Ky, i = 0 <= Uy && Uy < Hy ? Hy : Uy, n = 0 <= Wy && Wy < Hy ? Hy : Wy, r = 0 <= Yy && Yy < Hy ? Hy : Yy, a = 0 <= r ? r : 0 <= n ? n : Cy, 0 <= Qy ? (vr(256), Tr(Qy, a, t, GC)) : tb & 4194048 && (vr(256), Ar(Hy, a, nb)), d = r, s = Xy, c = 0 < Zy, l = Gy === Sy, a = Cy, r = Ky, o = qy, u = Jy, wv && (U = "Transition", 0 < n ? n > a && (n = a) : n = a, 0 < i ? i > n && (i = n) : i = n, 0 < d ? d > i && (d = i) : d = i, i > d && s !== null && (f = c ? "secondary-light" : "warning", r ? r.run(console.timeStamp.bind(console, c ? "Consecutive" : "Event: " + s, d, i, U, H, f)) : console.timeStamp(c ? "Consecutive" : "Event: " + s, d, i, U, H, f)), n > i && (r ? r.run(console.timeStamp.bind(console, "Action", i, n, U, H, "primary-dark")) : console.timeStamp("Action", i, n, U, H, "primary-dark")), a > n && (i = l ? "Promise Resolved" : 5 < a - n ? "Update Blocked" : "Update", d = [], u != null && d.push(["Component name", u]), o != null && d.push(["Method name", o]), n = {
				start: n,
				end: a,
				detail: { devtools: {
					properties: d,
					track: U,
					trackGroup: H,
					color: "primary-light"
				} }
			}, r ? r.run(performance.measure.bind(performance, i, n)) : performance.measure(i, n), performance.clearMeasures(i))), Wy = Uy = -1.1, Gy = 0, Qy = -1.1, Zy = Yy, Yy = -1.1, Hy = yy()), t & 62914560 && tb & 62914560 && (vr(4194304), Ar($y, Cy, nb)), t & 2080374784 && tb & 2080374784 && (vr(268435456), Ar(eb, Cy, nb)), n = e.timeoutHandle, n !== OT && (e.timeoutHandle = OT, DT(n)), n = e.cancelPendingCommit, n !== null && (e.cancelPendingCommit = null, n()), ow = 0, fu(), pC = e, Q = n = Ur(e.current, null), $ = t, wC = mC, TC = null, EC = !1, DC = Ye(e, t), OC = !1, AC = aC, FC = PC = NC = MC = jC = 0, LC = IC = null, RC = !1, kC = Xe(e, t), jr(), e = fv(), 1e3 < e - uv && (z.recentlyCreatedOwnerStacks = 0, uv = e), pb.discardPendingWarnings(), n;
		}
		function hu(e, t) {
			X = null, z.H = Gx, z.getCurrentStack = null, hh = !1, mh = null, t === Hb || t === Wb ? (t = sa(), wC = _C) : t === Ub ? (t = sa(), wC = vC) : wC = t === pS ? SC : typeof t == "object" && t && typeof t.then == "function" ? bC : hC, TC = t;
			var n = Q;
			n === null ? (AC = oC, As(e, Zr(t, e.current))) : n.mode & G && Gi(n);
		}
		function gu() {
			var e = gx.current;
			return e === null ? !0 : ($ & 4194048) === $ ? _x === null : ($ & 62914560) === $ || $ & 536870912 ? e === _x : !1;
		}
		function _u() {
			var e = z.H;
			return z.H = Gx, e === null ? Gx : e;
		}
		function vu() {
			var e = z.A;
			return z.A = QS, e;
		}
		function yu(e) {
			GC === null && (GC = e._debugTask == null ? null : e._debugTask);
		}
		function bu() {
			AC = lC, EC || ($ & 4194048) !== $ && gx.current !== null || (DC = !0), !(jC & 134217727) && !(MC & 134217727) || pC === null || uu(pC, $, PC, !1);
		}
		function xu(e, t, n) {
			var r = fC;
			fC |= rC;
			var i = _u(), a = vu();
			if (pC !== e || $ !== t) {
				if (Nh) {
					var o = e.memoizedUpdaters;
					0 < o.size && (td(e, $), o.clear()), st(e, t);
				}
				WC = null, mu(e, t);
			}
			t = !1, o = AC;
			a: do
				try {
					if (wC !== mC && Q !== null) {
						var s = Q, c = TC;
						switch (wC) {
							case SC:
								fu(), o = uC;
								break a;
							case _C:
							case gC:
							case CC:
							case bC:
								gx.current === null && (t = !0);
								var l = wC;
								if (wC = mC, TC = null, Ou(e, s, c, l), n && DC) {
									o = aC;
									break a;
								}
								break;
							default: l = wC, wC = mC, TC = null, Ou(e, s, c, l);
						}
					}
					Su(), o = AC;
					break;
				} catch (t) {
					hu(e, t);
				}
			while (1);
			return t && e.shellSuspendCounter++, gi(), fC = r, z.H = i, z.A = a, Q === null && (pC = null, $ = 0, jr()), o;
		}
		function Su() {
			for (; Q !== null;) Tu(Q);
		}
		function Cu(e, t) {
			var n = fC;
			fC |= rC;
			var r = _u(), i = vu();
			if (pC !== e || $ !== t) {
				if (Nh) {
					var a = e.memoizedUpdaters;
					0 < a.size && (td(e, $), a.clear()), st(e, t);
				}
				WC = null, HC = xh() + UC, mu(e, t);
			} else DC = Ye(e, t);
			a: do
				try {
					if (wC !== mC && Q !== null) b: switch (t = Q, a = TC, wC) {
						case hC:
							wC = mC, TC = null, Ou(e, t, a, hC);
							break;
						case gC:
						case CC:
							if (ia(a)) {
								wC = mC, TC = null, Eu(t);
								break;
							}
							t = function() {
								wC !== gC && wC !== CC || pC !== e || (wC = xC), id(e);
							}, a.then(t, t);
							break a;
						case _C:
							wC = xC;
							break a;
						case vC:
							wC = yC;
							break a;
						case xC:
							ia(a) ? (wC = mC, TC = null, Eu(t)) : (wC = mC, TC = null, Ou(e, t, a, xC));
							break;
						case yC:
							var o = null;
							switch (Q.tag) {
								case 26: o = Q.memoizedState;
								case 5:
								case 27:
									var s = Q;
									if (o ? Lp(o) : s.stateNode.complete) {
										wC = mC, TC = null;
										var c = s.sibling;
										if (c !== null) Q = c;
										else {
											var l = s.return;
											l === null ? Q = null : (Q = l, ku(l));
										}
										break b;
									}
									break;
								default: console.error("Unexpected type of fiber triggered a suspensey commit. This is a bug in React.");
							}
							wC = mC, TC = null, Ou(e, t, a, yC);
							break;
						case bC:
							wC = mC, TC = null, Ou(e, t, a, bC);
							break;
						case SC:
							fu(), AC = uC;
							break a;
						default: throw Error("Unexpected SuspendedReason. This is a bug in React.");
					}
					z.actQueue === null ? wu() : Su();
					break;
				} catch (t) {
					hu(e, t);
				}
			while (1);
			return gi(), z.H = r, z.A = i, fC = n, Q === null ? (pC = null, $ = 0, jr(), AC) : aC;
		}
		function wu() {
			for (; Q !== null && !yh();) Tu(Q);
		}
		function Tu(e) {
			var t = e.alternate;
			(e.mode & G) === W ? t = T(e, mc, t, e, kC) : (Wi(e), t = T(e, mc, t, e, kC), Gi(e)), e.memoizedProps = e.pendingProps, t === null ? ku(e) : Q = t;
		}
		function Eu(e) {
			var t = T(e, Du, e);
			e.memoizedProps = e.pendingProps, t === null ? ku(e) : Q = t;
		}
		function Du(e) {
			var t = e.alternate, n = (e.mode & G) !== W;
			switch (n && Wi(e), e.tag) {
				case 15:
				case 0:
					t = Js(t, e, e.pendingProps, e.type, void 0, $);
					break;
				case 11:
					t = Js(t, e, e.pendingProps, e.type.render, e.ref, $);
					break;
				case 5:
					eo(e);
					var r = e;
					r === ty && (K ? (ui(r), r.tag === 5 && r.stateNode != null && (ny = r.stateNode)) : (ui(r), K = !0));
				default: Cc(t, e), e = Q = Wr(e, kC), t = mc(t, e, kC);
			}
			return n && Gi(e), t;
		}
		function Ou(e, t, n, r) {
			gi(), eo(t), Zb = null, Qb = 0;
			var i = t.return;
			try {
				if (Fs(e, i, t, n, $)) {
					AC = oC, As(e, Zr(n, e.current)), Q = null;
					return;
				}
			} catch (t) {
				if (i !== null) throw Q = i, t;
				AC = oC, As(e, Zr(n, e.current)), Q = null;
				return;
			}
			t.flags & 32768 ? (K || r === hC ? e = !0 : DC || $ & 536870912 ? e = !1 : (EC = e = !0, (r === gC || r === CC || r === _C || r === bC) && (r = gx.current, r !== null && r.tag === 13 && (r.flags |= 16384))), Au(t, e)) : ku(t);
		}
		function ku(e) {
			var t = e;
			do {
				if (t.flags & 32768) {
					Au(t, EC);
					return;
				}
				var n = t.alternate;
				if (e = t.return, Wi(t), n = T(t, xc, n, t, kC), (t.mode & G) !== W && Ki(t), n !== null) {
					Q = n;
					return;
				}
				if (t = t.sibling, t !== null) {
					Q = t;
					return;
				}
				Q = t = e;
			} while (t !== null);
			AC === aC && (AC = dC);
		}
		function Au(e, t) {
			do {
				var n = Sc(e.alternate, e);
				if (n !== null) {
					n.flags &= 32767, Q = n;
					return;
				}
				if ((e.mode & G) !== W) {
					Ki(e), n = e.actualDuration;
					for (var r = e.child; r !== null;) n += r.actualDuration, r = r.sibling;
					e.actualDuration = n;
				}
				if (n = e.return, n !== null && (n.flags |= 32768, n.subtreeFlags = 0, n.deletions = null), !t && (e = e.sibling, e !== null)) {
					Q = e;
					return;
				}
				Q = e = n;
			} while (e !== null);
			AC = uC, Q = null;
		}
		function ju(e, t, n, r, i, a, o, s, c, l, u, d, f, p, m) {
			e.cancelPendingCommit = null;
			do
				Hu();
			while (rw !== ZC);
			if (pb.flushLegacyContextWarning(), pb.flushPendingUnsafeLifecycleWarnings(), (fC & (rC | iC)) !== nC) throw Error("Should not already be working.");
			if (vr(n), u === sC) Er(p, m, n, GC);
			else if (r !== null) {
				if (l = t !== null && t.alternate !== null && t.alternate.memoizedState.isDehydrated && !!(t.flags & 256), a = GC, wv && !(m <= p)) {
					u = [];
					for (var h = 0; h < r.length; h++) {
						var g = r[h].value;
						u.push(["Recoverable Error", typeof g == "object" && g && typeof g.message == "string" ? String(g.message) : String(g)]);
					}
					p = {
						start: p,
						end: m,
						detail: { devtools: {
							color: "primary-dark",
							track: U,
							trackGroup: H,
							tooltipText: l ? "Hydration Failed" : "Recovered after Error",
							properties: u
						} }
					}, a ? a.run(performance.measure.bind(performance, "Recovered", p)) : performance.measure("Recovered", p), performance.clearMeasures("Recovered");
				}
			} else a = GC, !wv || m <= p || (l = (n & 738197653) === n ? "tertiary-dark" : "primary-dark", u = (n & 536870912) === n ? "Prepared" : (n & 201326741) === n ? "Hydrated" : "Render", a ? a.run(console.timeStamp.bind(console, u, p, m, U, H, l)) : console.timeStamp(u, p, m, U, H, l));
			if (t !== null) {
				if (n === 0 && console.error("finishedLanes should not be empty during a commit. This is a bug in React."), t === e.current) throw Error("Cannot commit the same tree as before. This error is likely caused by a bug in React. Please file an issue.");
				e === pC && (Q = pC = null, $ = 0), aw = t, iw = e, ow = n, lw = i, uw = r, cw = m, mw = f, hw = qC, gw = null, Mu(e, t, n, o, s, c, d, f, m);
			}
		}
		function Mu(e, t, n, r, i, a, o, s, c) {
			var l = t.lanes | t.childLanes;
			if (sw = l, l |= Iv, tt(e, n, l, r, i, a), fw = null, (n & 335544064) === n ? (pw = ji(e), r = 10262) : (pw = null, r = 10256), t.actualDuration !== 0 || (t.subtreeFlags & r) !== 0 || (t.flags & r) !== 0 ? (e.callbackNode = null, e.callbackPriority = 0, nd(Th, function() {
				return TT = window.event, hw === qC && (hw = YC), Uu(), null;
			})) : (e.callbackNode = null, e.callbackPriority = 0), Ey = null, wy = yy(), s !== null && Dr(c, wy, s, GC), ES = !1, s = !!(t.flags & 13878), t.subtreeFlags & 13878 || s) {
				s = z.T, z.T = null, c = B.p, B.p = Bh, r = fC, fC |= iC;
				try {
					_l(e, t, n);
				} finally {
					fC = r, B.p = c, z.T = s;
				}
			}
			rw = QC, ES ? (tb |= n, nb = null, dw = jf(o, e.containerInfo, pw, Lu, Ru, Iu, zu, Uu, Nu, Pu, Fu.bind(null, n))) : (Lu(), Ru(), zu());
		}
		function Nu(e) {
			if (rw !== ZC) {
				var t = iw.onRecoverableError;
				t(e, Bu(null));
			}
		}
		function Pu(e) {
			Ty = yy(), kr(mw === null ? cw : wy, Ty, Ey, hw === JC, GC), mw = gw = e;
		}
		function Fu(e) {
			if ((tb & e) !== 0) {
				var t = nb;
				tb &= ~e, nb = null, e & 4194048 && !($ & 4194048) && !(ow & 4194048) && (vr(256), Ar(Hy, xh(), t)), e & 62914560 && !($ & 62914560) && !(ow & 62914560) && (vr(4194304), Ar($y, xh(), t)), e & 2080374784 && !($ & 2080374784) && !(ow & 2080374784) && (vr(268435456), Ar(eb, xh(), t));
			}
		}
		function Iu() {
			rw === ew && (rw = ZC, Pl(aw, iw), rw = tw);
		}
		function Lu() {
			if (rw === QC) {
				rw = ZC;
				var e = iw, t = aw, n = ow, r = !!(t.flags & 13878);
				if (t.subtreeFlags & 13878 || r) {
					r = z.T, z.T = null;
					var i = B.p;
					B.p = Bh;
					var a = fC;
					fC |= iC;
					try {
						VS = n, HS = e, WS = GS = !1, Li(), Al(t, e, n), HS = VS = null, n = xT;
						var o = ir(e.containerInfo), s = n.focusedElem, c = n.selectionRange;
						if (o !== s && s && s.ownerDocument && rr(s.ownerDocument.documentElement, s)) {
							if (c !== null && ar(s)) {
								var l = c.start, u = c.end;
								if (u === void 0 && (u = l), "selectionStart" in s) s.selectionStart = l, s.selectionEnd = Math.min(u, s.value.length);
								else {
									var d = s.ownerDocument || document, f = d && d.defaultView || window;
									if (f.getSelection) {
										var p = f.getSelection(), m = s.textContent.length, h = Math.min(c.start, m), g = c.end === void 0 ? h : Math.min(c.end, m);
										!p.extend && h > g && (o = g, g = h, h = o);
										var _ = nr(s, h), v = nr(s, g);
										if (_ && v && (p.rangeCount !== 1 || p.anchorNode !== _.node || p.anchorOffset !== _.offset || p.focusNode !== v.node || p.focusOffset !== v.offset)) {
											var y = d.createRange();
											y.setStart(_.node, _.offset), p.removeAllRanges(), h > g ? (p.addRange(y), p.extend(v.node, v.offset)) : (y.setEnd(v.node, v.offset), p.addRange(y));
										}
									}
								}
							}
							for (d = [], p = s; p = p.parentNode;) p.nodeType === 1 && d.push({
								element: p,
								left: p.scrollLeft,
								top: p.scrollTop
							});
							for (typeof s.focus == "function" && s.focus(), s = 0; s < d.length; s++) {
								var b = d[s];
								b.element.scrollLeft = b.left, b.element.scrollTop = b.top;
							}
						}
						gE = !!bT, xT = bT = null;
					} finally {
						fC = a, B.p = i, z.T = r;
					}
				}
				e.current = t, rw = $C;
			}
		}
		function Ru() {
			if (rw === $C) {
				rw = ZC;
				var e = gw;
				if (e !== null) {
					wy = yy();
					var t = Ty, n = wy;
					!wv || n <= t || (nb ? nb.run(console.timeStamp.bind(console, e, t, n, U, H, "secondary-light")) : console.timeStamp(e, t, n, U, H, "secondary-light"));
				}
				e = iw, t = aw, n = ow;
				var r = !!(t.flags & 8772);
				if (t.subtreeFlags & 8772 || r) {
					r = z.T, z.T = null;
					var i = B.p;
					B.p = Bh;
					var a = fC;
					fC |= iC;
					try {
						VS = n, HS = e, Li(), yl(e, t.alternate, t), HS = VS = null;
					} finally {
						fC = a, B.p = i, z.T = r;
					}
				}
				e = cw, t = mw, Ty = yy(), kr(t === null ? e : wy, Ty, Ey, hw === JC, GC), rw = ew;
			}
		}
		function zu() {
			if (rw === tw || rw === ew) {
				if (rw === tw) {
					var e = Ty;
					Ty = yy();
					var t = Ty, n = hw === JC;
					!wv || t <= e || (nb ? nb.run(console.timeStamp.bind(console, n ? "Interrupted View Transition" : "Starting Animation", e, t, U, H, n ? "error" : "secondary-light")) : console.timeStamp(n ? "Interrupted View Transition" : "Starting Animation", e, t, U, H, n ? " error" : "secondary-light")), hw !== JC && (hw = XC);
				}
				rw = ZC, e = dw, dw = null, bh(), t = iw;
				var r = aw;
				n = ow;
				var i = uw, a = (n & 335544064) === n ? 10262 : 10256;
				(a = r.actualDuration !== 0 || (r.subtreeFlags & a) !== 0 || (r.flags & a) !== 0) ? rw = nw : (rw = ZC, aw = iw = null, Vu(t, t.pendingLanes), Cw = 0, ww = null);
				var o = t.pendingLanes;
				if (o === 0 && (KC = null), a || $u(t), o = ct(n), r = r.stateNode, jh && typeof jh.onCommitFiberRoot == "function") try {
					var s = (r.current.flags & 128) == 128;
					switch (o) {
						case Bh:
							var c = Ch;
							break;
						case Vh:
							c = wh;
							break;
						case Hh:
							c = Th;
							break;
						case Uh:
							c = Dh;
							break;
						default: c = Th;
					}
					jh.onCommitFiberRoot(Ah, r, c, s);
				} catch (e) {
					Mh || (Mh = !0, console.error("React instrumentation encountered an error: %o", e));
				}
				if (Nh && t.memoizedUpdaters.clear(), tu(), i !== null) {
					s = z.T, c = B.p, B.p = Bh, z.T = null;
					try {
						var l = t.onRecoverableError;
						for (r = 0; r < i.length; r++) {
							var u = i[r], d = Bu(u.stack);
							T(u.source, l, u.value, d);
						}
					} finally {
						z.T = s, B.p = c;
					}
				}
				if (l = fw, u = pw, pw = null, l !== null && (fw = null, u === null && (u = []), e !== null)) for (d = 0; d < l.length; d++) i = (0, l[d])(u), i !== void 0 && e.finished.finally(i);
				ow & 3 && Hu(), id(t), o = t.pendingLanes, n & 261930 && o & 42 ? (ob = !0, t === yw ? vw++ : (vw = 0, yw = t)) : (vw = 0, yw = null), a || pu(n, Ty), ad(0, !1);
			}
		}
		function Bu(e) {
			return e = { componentStack: e }, Object.defineProperty(e, "digest", { get: function() {
				console.error("You are accessing \"digest\" from the errorInfo object passed to onRecoverableError. This property is no longer provided as part of errorInfo but can be accessed as a property of the Error instance itself.");
			} }), e;
		}
		function Vu(e, t) {
			(e.pooledCacheLanes &= t) === 0 && (t = e.pooledCache, t != null && (e.pooledCache = null, ki(t)));
		}
		function Hu() {
			return dw !== null && (dw.skipTransition(), Ew || (Ew = !0, console.warn("A flushSync update cancelled a View Transition because it was called while the View Transition was still preparing. To preserve the synchronous semantics, React had to skip the View Transition. If you can, try to avoid flushSync() in a scenario that's likely to interfere.")), dw = null, hw = JC), Lu(), Ru(), zu(), Uu();
		}
		function Uu() {
			if (rw !== nw) return !1;
			var e = iw, t = sw;
			sw = 0;
			var n = ct(ow), r = Hh === 0 || Hh > n ? Hh : n;
			n = z.T;
			var i = B.p;
			try {
				B.p = r, z.T = null;
				var a = lw;
				lw = null, r = iw;
				var o = ow;
				if (rw = ZC, aw = iw = null, ow = 0, (fC & (rC | iC)) !== nC) throw Error("Cannot flush passive effects while already rendering.");
				vr(o), bw = !0, xw = !1;
				var s = 0;
				if (Ey = null, s = xh(), hw === XC) Ar(Ty, s, nb);
				else {
					var c = Ty, l = s, u = hw === YC;
					!wv || l <= c || (GC ? GC.run(console.timeStamp.bind(console, u ? "Waiting for Paint" : "Waiting", c, l, U, H, "secondary-light")) : console.timeStamp(u ? "Waiting for Paint" : "Waiting", c, l, U, H, "secondary-light"));
				}
				c = fC, fC |= iC;
				var d = r.current;
				Li(), Zl(d);
				var f = r.current;
				d = cw, Li(), Ul(r, f, o, a, d), $u(r), fC = c;
				var p = xh();
				if (f = s, d = GC, Ey === null ? !wv || p <= f || (d ? d.run(console.timeStamp.bind(console, "Remaining Effects", f, p, U, H, "secondary-dark")) : console.timeStamp("Remaining Effects", f, p, U, H, "secondary-dark")) : Or(f, p, Ey, !0, d), pu(o, p), ad(0, !1), xw ? r === ww ? Cw++ : (Cw = 0, ww = r) : Cw = 0, xw = bw = !1, jh && typeof jh.onPostCommitFiberRoot == "function") try {
					jh.onPostCommitFiberRoot(Ah, r);
				} catch (e) {
					Mh || (Mh = !0, console.error("React instrumentation encountered an error: %o", e));
				}
				var m = r.current.stateNode;
				return m.effectDuration = 0, m.passiveEffectDuration = 0, !0;
			} finally {
				B.p = i, z.T = n, Vu(e, t);
			}
		}
		function Wu(e, t, n) {
			t = Zr(n, t), Ji(t), t = Ms(e.stateNode, t, 2), e = Ta(e, t, 2), e !== null && (et(e, 2), id(e));
		}
		function Gu(e, t, n) {
			if (Tw = !1, e.tag === 3) Wu(e, e, n);
			else {
				for (; t !== null;) {
					if (t.tag === 3) {
						Wu(t, e, n);
						return;
					}
					if (t.tag === 1) {
						var r = t.stateNode;
						if (typeof t.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (KC === null || !KC.has(r))) {
							e = Zr(n, e), Ji(e), n = Ns(2), r = Ta(t, n, 2), r !== null && (Ps(n, r, t, e), et(r, 2), id(r));
							return;
						}
					}
					t = t.return;
				}
				console.error("Internal React error: Attempted to capture a commit phase error inside a detached tree. This indicates a bug in React. Potential causes include deleting the same fiber more than once, committing an already-finished tree, or an inconsistent return pointer.\n\nError message:\n\n%s", n);
			}
		}
		function Ku(e, t, n) {
			var r = e.pingCache;
			if (r === null) {
				r = e.pingCache = new tC();
				var i = /* @__PURE__ */ new Set();
				r.set(t, i);
			} else i = r.get(t), i === void 0 && (i = /* @__PURE__ */ new Set(), r.set(t, i));
			i.has(n) || (OC = !0, i.add(n), r = qu.bind(null, e, t, n), Nh && td(e, n), t.then(r, r));
		}
		function qu(e, t, n) {
			var r = e.pingCache;
			r !== null && r.delete(t), e.pingedLanes |= e.suspendedLanes & n, e.warmLanes &= ~n, n & 127 ? 0 > Ny && (My = Ny = yy(), Py = by("Promise Resolved"), Fy = Sy) : n & 4194048 && 0 > Wy && (Hy = Wy = yy(), Ky = by("Promise Resolved"), Gy = Sy), nu() && z.actQueue === null && console.error("A suspended resource finished loading inside a test, but the event was not wrapped in act(...).\n\nWhen testing, code that resolves suspended data should be wrapped into act(...):\n\nact(() => {\n  /* finish loading suspended data */\n});\n/* assert on the output */\n\nThis ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act"), pC === e && ($ & n) === n && ((AC === lC || AC === cC && ($ & 62914560) === $ && xh() - zC < VC) && (fC & rC) === nC ? mu(e, 0) : NC |= n, FC === $ && (FC = 0)), id(e);
		}
		function Ju(e, t) {
			t === 0 && (t = Qe()), e = Pr(e, t), e !== null && (et(e, t), id(e));
		}
		function Yu(e) {
			var t = e.memoizedState, n = 0;
			t !== null && (n = t.retryLane), Ju(e, n);
		}
		function Xu(e, t) {
			var n = 0;
			switch (e.tag) {
				case 31:
				case 13:
					var r = e.stateNode, i = e.memoizedState;
					i !== null && (n = i.retryLane);
					break;
				case 19:
					r = e.stateNode;
					break;
				case 22:
					r = e.stateNode._retryCache;
					break;
				default: throw Error("Pinged unknown suspense boundary type. This is probably a bug in React.");
			}
			r !== null && r.delete(t), Ju(e, n);
		}
		function Zu(e, t, n) {
			if (t.subtreeFlags & 134225920) for (t = t.child; t !== null;) {
				var r = e, i = t, a = i.type === jm;
				a = n || a, i.tag === 22 ? i.memoizedState === null && (a && i.flags & 134225920 ? T(i, Qu, r, i) : i.subtreeFlags & 134217728 && T(i, Zu, r, i, a)) : i.flags & 134217728 ? a && T(i, Qu, r, i) : Zu(r, i, a), t = t.sibling;
			}
		}
		function Qu(e, t) {
			Ge(!0);
			try {
				Il(t, MS), $l(t), Rl(e, t.alternate, t, MS), Gl(e, t, 0, null, !1, 0);
			} finally {
				Ge(!1);
			}
		}
		function $u(e) {
			var t = !0;
			e.current.mode & (Vv | Hv) || (t = !1), Zu(e, e.current, t);
		}
		function ed(e) {
			if ((fC & rC) === nC) {
				var t = e.tag;
				if (t === 3 || t === 1 || t === 0 || t === 11 || t === 14 || t === 15) {
					if (t = C(e) || "ReactComponent", Dw !== null) {
						if (Dw.has(t)) return;
						Dw.add(t);
					} else Dw = /* @__PURE__ */ new Set([t]);
					T(e, function() {
						console.error("Can't perform a React state update on a component that hasn't mounted yet. This indicates that you have a side-effect in your render function that asynchronously tries to update the component. Move this work to useEffect instead.");
					});
				}
			}
		}
		function td(e, t) {
			Nh && e.memoizedUpdaters.forEach(function(n) {
				ot(e, n, t);
			});
		}
		function nd(e, t) {
			var n = z.actQueue;
			return n === null ? _h(e, t) : (n.push(t), Aw);
		}
		function rd(e) {
			nu() && z.actQueue === null && T(e, function() {
				console.error("An update to %s inside a test was not wrapped in act(...).\n\nWhen testing, code that causes React state updates should be wrapped into act(...):\n\nact(() => {\n  /* fire events that update state */\n});\n/* assert on the output */\n\nThis ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act", C(e));
			});
		}
		function id(e) {
			e !== Mw && e.next === null && (Mw === null ? jw = Mw = e : Mw = Mw.next = e), Fw = !0, z.actQueue === null ? Nw || (Nw = !0, fd()) : Pw || (Pw = !0, fd());
		}
		function ad(e, t) {
			if (!Iw && Fw) {
				Iw = !0;
				do
					for (var n = !1, r = jw; r !== null;) {
						if (!t) {
							if (e !== 0) {
								var i = r.pendingLanes;
								if (i === 0) var a = 0;
								else {
									var o = r.suspendedLanes, s = r.pingedLanes;
									a = (1 << 31 - Ph(42 | e) + 1) - 1, a &= i & ~(o & ~s), a = a & 201326741 ? a & 201326741 | 1 : a ? a | 2 : 0;
								}
								a !== 0 && (n = !0, ud(r, a));
							} else a = $, a = Je(r, r === pC ? a : 0, r.cancelPendingCommit !== null || r.timeoutHandle !== OT), !(a & 3) || Ye(r, a) || (n = !0, ud(r, a));
						}
						r = r.next;
					}
				while (n);
				Iw = !1;
			}
		}
		function od() {
			TT = window.event, sd();
		}
		function sd() {
			Fw = Pw = Nw = !1;
			var e = 0;
			Lw !== 0 && ef() && (e = Lw);
			for (var t = xh(), n = null, r = jw; r !== null;) {
				var i = r.next, a = cd(r, t);
				a === 0 ? (r.next = null, n === null ? jw = i : n.next = i, i === null && (Mw = n)) : (n = r, (e !== 0 || a & 3) && (Fw = !0)), r = i;
			}
			rw !== ZC && rw !== nw || ad(e, !1), Lw !== 0 && (Lw = 0);
		}
		function cd(e, t) {
			for (var n = e.suspendedLanes, r = e.pingedLanes, i = e.expirationTimes, a = e.pendingLanes & -62914561; 0 < a;) {
				var o = 31 - Ph(a), s = 1 << o, c = i[o];
				c === -1 ? ((s & n) === 0 || (s & r) !== 0) && (i[o] = Ze(s, t)) : c <= t && (e.expiredLanes |= s), a &= ~s;
			}
			if (t = pC, n = $, n = Je(e, e === t ? n : 0, e.cancelPendingCommit !== null || e.timeoutHandle !== OT), r = e.callbackNode, n === 0 || e === t && (wC === gC || wC === CC) || e.cancelPendingCommit !== null) return r !== null && dd(r), e.callbackNode = null, e.callbackPriority = 0;
			if (!(n & 3) || Ye(e, n)) {
				if (t = n & -n, t !== e.callbackPriority || z.actQueue !== null && r !== Rw) dd(r);
				else return t;
				switch (ct(n)) {
					case Bh:
					case Vh:
						n = wh;
						break;
					case Hh:
						n = Th;
						break;
					case Uh:
						n = Dh;
						break;
					default: n = Th;
				}
				return r = ld.bind(null, e), z.actQueue === null ? n = _h(n, r) : (z.actQueue.push(r), n = Rw), e.callbackPriority = t, e.callbackNode = n, t;
			}
			return r !== null && dd(r), e.callbackPriority = 2, e.callbackNode = null, 2;
		}
		function ld(e, t) {
			if (ob = ab = !1, TT = window.event, rw !== ZC && rw !== nw) return e.callbackNode = null, e.callbackPriority = 0, null;
			var n = e.callbackNode;
			if (hw === qC && (hw = YC), Hu() && e.callbackNode !== n) return null;
			var r = $;
			return r = Je(e, e === pC ? r : 0, e.cancelPendingCommit !== null || e.timeoutHandle !== OT), r === 0 ? null : (su(e, r, t), cd(e, xh()), e.callbackNode != null && e.callbackNode === n ? ld.bind(null, e) : null);
		}
		function ud(e, t) {
			if (Hu()) return null;
			ab = ob, ob = !1, su(e, t, !0);
		}
		function dd(e) {
			e !== Rw && e !== null && vh(e);
		}
		function fd() {
			z.actQueue !== null && z.actQueue.push(function() {
				return sd(), null;
			}), jT(function() {
				(fC & (rC | iC)) === nC ? sd() : _h(Ch, od);
			});
		}
		function pd() {
			if (Lw === 0) {
				var e = lb;
				e === 0 && (e = Lh, Lh <<= 1, !(Lh & 261888) && (Lh = 256)), Lw = e;
			}
			return Lw;
		}
		function md(e) {
			return e == null || typeof e == "symbol" || typeof e == "boolean" ? null : typeof e == "function" ? e : (Ve(e, "action"), Cn(e));
		}
		function N(e, t, n, r, i) {
			if (t === "submit" && n && n.stateNode === i) {
				var a = md((i[Kh] || null).action), o = r.submitter;
				o && (t = (t = o[Kh] || null) ? md(t.formAction) : o.getAttribute("formAction"), t !== null && (a = t, o = null));
				var s = new s_("action", "action", null, r, i);
				e.push({
					event: s,
					listeners: [{
						instance: null,
						listener: function() {
							if (r.defaultPrevented) {
								if (Lw !== 0) {
									var e = new FormData(i, o), t = {
										pending: !0,
										data: e,
										method: i.method,
										action: a
									};
									Object.freeze(t), as(n, t, null, e);
								}
							} else typeof a == "function" && (s.preventDefault(), e = new FormData(i, o), t = {
								pending: !0,
								data: e,
								method: i.method,
								action: a
							}, Object.freeze(t), as(n, t, a, e));
						},
						currentTarget: i
					}]
				});
			}
		}
		function P(e, t, n) {
			e.currentTarget = n;
			try {
				t(e);
			} catch (e) {
				mv(e);
			}
			e.currentTarget = null;
		}
		function hd(e, t) {
			t = !!(t & 4);
			for (var n = 0; n < e.length; n++) {
				var r = e[n];
				a: {
					var i = void 0, a = r.event;
					if (r = r.listeners, t) for (var o = r.length - 1; 0 <= o; o--) {
						var s = r[o], c = s.instance, l = s.currentTarget;
						if (s = s.listener, c !== i && a.isPropagationStopped()) break a;
						c === null ? P(a, s, l) : T(c, P, a, s, l), i = c;
					}
					else for (o = 0; o < r.length; o++) {
						if (s = r[o], c = s.instance, l = s.currentTarget, s = s.listener, c !== i && a.isPropagationStopped()) break a;
						c === null ? P(a, s, l) : T(c, P, a, s, l), i = c;
					}
				}
			}
		}
		function F(e, t) {
			Bw.has(e) || console.error("Did not expect a listenToNonDelegatedEvent() call for \"%s\". This is a bug in React. Please file an issue.", e);
			var n = t[Jh];
			n === void 0 && (n = t[Jh] = /* @__PURE__ */ new Set());
			var r = e + "__bubble";
			n.has(r) || (vd(t, e, 2, !1), n.add(r));
		}
		function gd(e, t, n) {
			Bw.has(e) && !t && console.error("Did not expect a listenToNativeEvent() call for \"%s\" in the bubble phase. This is a bug in React. Please file an issue.", e);
			var r = 0;
			t && (r |= 4), vd(n, e, r, t);
		}
		function _d(e) {
			if (!e[Vw]) {
				e[Vw] = !0, eg.forEach(function(t) {
					t !== "selectionchange" && (Bw.has(t) || gd(t, !1, e), gd(t, !0, e));
				});
				var t = e.nodeType === 9 ? e : e.ownerDocument;
				t === null || t[Vw] || (t[Vw] = !0, gd("selectionchange", !1, t));
			}
		}
		function vd(e, t, n, r) {
			switch (sm(t)) {
				case Bh:
					var i = nm;
					break;
				case Vh:
					i = rm;
					break;
				default: i = im;
			}
			n = i.bind(null, t, n, e), i = void 0, !t_ || t !== "touchstart" && t !== "touchmove" && t !== "wheel" || (i = !0), r ? i === void 0 ? e.addEventListener(t, n, !0) : e.addEventListener(t, n, {
				capture: !0,
				passive: i
			}) : i === void 0 ? e.addEventListener(t, n, !1) : e.addEventListener(t, n, { passive: i });
		}
		function yd(e, t, n, r, i) {
			var a = r;
			if (!(t & 1) && !(t & 2) && r !== null) a: for (;;) {
				if (r === null) return;
				var o = r.tag;
				if (o === 3 || o === 4) {
					var s = r.stateNode.containerInfo;
					if (s === i) break;
					if (o === 4) for (o = r.return; o !== null;) {
						var c = o.tag;
						if ((c === 3 || c === 4) && o.stateNode.containerInfo === i) return;
						o = o.return;
					}
					for (; s !== null;) {
						if (o = ft(s), o === null) return;
						if (c = o.tag, c === 5 || c === 6 || c === 26 || c === 27) {
							r = a = o;
							continue a;
						}
						s = s.parentNode;
					}
				}
				r = r.return;
			}
			Dn(function() {
				var r = a, i = Tn(n), o = [];
				a: {
					var s = sv.get(e);
					if (s !== void 0) {
						var c = s_, l = e;
						switch (e) {
							case "keypress": if (An(n) === 0) break a;
							case "keydown":
							case "keyup":
								c = w_;
								break;
							case "focusin":
								l = "focus", c = g_;
								break;
							case "focusout":
								l = "blur", c = g_;
								break;
							case "beforeblur":
							case "afterblur":
								c = g_;
								break;
							case "click": if (n.button === 2) break a;
							case "auxclick":
							case "dblclick":
							case "mousedown":
							case "mousemove":
							case "mouseup":
							case "mouseout":
							case "mouseover":
							case "contextmenu":
								c = m_;
								break;
							case "drag":
							case "dragend":
							case "dragenter":
							case "dragexit":
							case "dragleave":
							case "dragover":
							case "dragstart":
							case "drop":
								c = h_;
								break;
							case "touchcancel":
							case "touchend":
							case "touchmove":
							case "touchstart":
								c = D_;
								break;
							case ev:
							case tv:
							case nv:
								c = __;
								break;
							case ov:
								c = O_;
								break;
							case "scroll":
							case "scrollend":
								c = l_;
								break;
							case "wheel":
								c = k_;
								break;
							case "copy":
							case "cut":
							case "paste":
								c = v_;
								break;
							case "gotpointercapture":
							case "lostpointercapture":
							case "pointercancel":
							case "pointerdown":
							case "pointermove":
							case "pointerout":
							case "pointerover":
							case "pointerup":
								c = T_;
								break;
							case "submit":
								c = E_;
								break;
							case "toggle":
							case "beforetoggle": c = A_;
						}
						var u = !!(t & 4), d = !u && (e === "scroll" || e === "scrollend"), f = u ? s === null ? null : s + "Capture" : s;
						u = [];
						for (var p = r, m; p !== null;) {
							var h = p;
							if (m = h.stateNode, h = h.tag, h !== 5 && h !== 26 && h !== 27 || m === null || f === null || (h = On(p, f), h != null && u.push(bd(p, h, m))), d) break;
							p = p.return;
						}
						0 < u.length && (s = new c(s, l, null, n, i), o.push({
							event: s,
							listeners: u
						}));
					}
				}
				if (!(t & 7)) {
					a: {
						if (c = e === "mouseover" || e === "pointerover", s = e === "mouseout" || e === "pointerout", c && n !== Xg && (l = n.relatedTarget || n.fromElement) && (ft(l) || l[qh])) break a;
						(s || c) && (l = i.window === i ? i : (c = i.ownerDocument) ? c.defaultView || c.parentWindow : window, s ? (c = n.relatedTarget || n.toElement, s = r, c = c ? ft(c) : null, c !== null && (d = ee(c), u = c.tag, c !== d || u !== 5 && u !== 27 && u !== 6) && (c = null)) : (s = null, c = r), s !== c && (u = m_, h = "onMouseLeave", f = "onMouseEnter", p = "mouse", (e === "pointerout" || e === "pointerover") && (u = T_, h = "onPointerLeave", f = "onPointerEnter", p = "pointer"), d = s == null ? l : mt(s), m = c == null ? l : mt(c), l = new u(h, p + "leave", s, n, i), l.target = d, l.relatedTarget = m, h = null, ft(i) === r && (u = new u(f, p + "enter", c, n, i), u.target = m, u.relatedTarget = d, h = u), d = h, u = s && c ? me(s, c, Sd) : null, s !== null && Cd(o, l, s, u, !1), c !== null && d !== null && Cd(o, d, c, u, !0)));
					}
					a: {
						if (s = r ? mt(r) : window, c = s.nodeName && s.nodeName.toLowerCase(), c === "select" || c === "input" && s.type === "file") var g = Gn;
						else if (Bn(s)) {
							if (W_) g = Zn;
							else {
								g = Yn;
								var _ = Jn;
							}
						} else c = s.nodeName, !c || c.toLowerCase() !== "input" || s.type !== "checkbox" && s.type !== "radio" ? r && _n(r.elementType) && (g = Gn) : g = Xn;
						if (g &&= g(e, r)) {
							Hn(o, g, n, i);
							break a;
						}
						_ && _(e, s, r);
					}
					switch (_ = r ? mt(r) : window, e) {
						case "focusin":
							(Bn(_) || _.contentEditable === "true") && (q_ = _, J_ = r, Y_ = null);
							break;
						case "focusout":
							Y_ = J_ = q_ = null;
							break;
						case "mousedown":
							X_ = !0;
							break;
						case "contextmenu":
						case "mouseup":
						case "dragend":
							X_ = !1, or(o, n, i);
							break;
						case "selectionchange": if (K_) break;
						case "keydown":
						case "keyup": or(o, n, i);
					}
					var v;
					if (N_) b: {
						switch (e) {
							case "compositionstart":
								var y = "onCompositionStart";
								break b;
							case "compositionend":
								y = "onCompositionEnd";
								break b;
							case "compositionupdate":
								y = "onCompositionUpdate";
								break b;
						}
						y = void 0;
					}
					else B_ ? In(e, n) && (y = "onCompositionEnd") : e === "keydown" && n.keyCode === M_ && (y = "onCompositionStart");
					y && (I_ && n.locale !== "ko" && (B_ || y !== "onCompositionStart" ? y === "onCompositionEnd" && B_ && (v = kn()) : (r_ = i, i_ = "value" in r_ ? r_.value : r_.textContent, B_ = !0)), _ = xd(r, y), 0 < _.length && (y = new y_(y, e, null, n, i), o.push({
						event: y,
						listeners: _
					}), v ? y.data = v : (v = Ln(n), v !== null && (y.data = v)))), (v = F_ ? Rn(e, n) : zn(e, n)) && (y = xd(r, "onBeforeInput"), 0 < y.length && (_ = new b_("onBeforeInput", "beforeinput", null, n, i), o.push({
						event: _,
						listeners: y
					}), _.data = v)), N(o, e, r, n, i);
				}
				hd(o, t);
			});
		}
		function bd(e, t, n) {
			return {
				instance: e,
				listener: t,
				currentTarget: n
			};
		}
		function xd(e, t) {
			for (var n = t + "Capture", r = []; e !== null;) {
				var i = e, a = i.stateNode;
				if (i = i.tag, i !== 5 && i !== 26 && i !== 27 || a === null || (i = On(e, n), i != null && r.unshift(bd(e, i, a)), i = On(e, t), i != null && r.push(bd(e, i, a))), e.tag === 3) return r;
				e = e.return;
			}
			return [];
		}
		function Sd(e) {
			if (e === null) return null;
			do
				e = e.return;
			while (e && e.tag !== 5 && e.tag !== 27);
			return e || null;
		}
		function Cd(e, t, n, r, i) {
			for (var a = t._reactName, o = []; n !== null && n !== r;) {
				var s = n, c = s.alternate, l = s.stateNode;
				if (s = s.tag, c !== null && c === r) break;
				s !== 5 && s !== 26 && s !== 27 || l === null || (c = l, i ? (l = On(n, a), l != null && o.unshift(bd(n, l, c))) : i || (l = On(n, a), l != null && o.push(bd(n, l, c)))), n = n.return;
			}
			o.length !== 0 && e.push({
				event: t,
				listeners: o
			});
		}
		function wd(e, t) {
			bn(e, t), e !== "input" && e !== "textarea" && e !== "select" || t == null || t.value !== null || Ug || (Ug = !0, e === "select" && t.multiple ? console.error("`value` prop on `%s` should not be null. Consider using an empty array when `multiple` is set to `true` to clear the component or `undefined` for uncontrolled components.", e) : console.error("`value` prop on `%s` should not be null. Consider using an empty string to clear the component or `undefined` for uncontrolled components.", e));
			var n = {
				registrationNameDependencies: tg,
				possibleRegistrationNames: ng
			};
			_n(e) || typeof t.is == "string" || Sn(e, t, n), t.contentEditable && !t.suppressContentEditableWarning && t.children != null && console.error("A component is `contentEditable` and contains `children` managed by React. It is now your responsibility to guarantee that none of those nodes are unexpectedly modified or duplicated. This is probably not intentional.");
		}
		function Td(e, t, n, r) {
			t !== n && (n = jd(n), jd(t) !== n && (r[e] = t));
		}
		function Ed(e) {
			return !!(e.getAttribute("vt-share") || e.getAttribute("vt-exit") || e.getAttribute("vt-enter") || e.getAttribute("vt-update"));
		}
		function Dd(e) {
			if (!Ed(e)) return !1;
			var t = e.getAttribute("vt-name");
			return e = e.style["view-transition-name"], t ? t === e : e.startsWith("_T_");
		}
		function Od(e, t, n) {
			t.forEach(function(t) {
				t === "style" ? e.getAttribute(t) !== "" && (t = e.style, (t.length === 1 && t[0] === "view-transition-name" || t.length === 2 && t[0] === "view-transition-class" && t[1] === "view-transition-name") && Dd(e) || (n.style = Ld(e))) : n[Id(t)] = e.getAttribute(t);
			});
		}
		function kd(e, t) {
			!1 === t ? console.error("Expected `%s` listener to be a function, instead got `false`.\n\nIf you used to conditionally omit it with %s={condition && value}, pass %s={condition ? value : undefined} instead.", e, e, e) : console.error("Expected `%s` listener to be a function, instead got a value of `%s` type.", e, typeof t);
		}
		function Ad(e, t) {
			return e = e.namespaceURI === Fg || e.namespaceURI === Ig ? e.ownerDocument.createElementNS(e.namespaceURI, e.tagName) : e.ownerDocument.createElement(e.tagName), e.innerHTML = t, e.innerHTML;
		}
		function jd(e) {
			return ze(e) && (console.error("The provided HTML markup uses a value of unsupported type %s. This value must be coerced to a string before using it here.", Re(e)), Be(e)), (typeof e == "string" ? e : "" + e).replace(Xw, "\n").replace(Zw, "");
		}
		function Md(e, t) {
			return t = jd(t), jd(e) === t;
		}
		function I(e, t, n, r, i, a) {
			switch (n) {
				case "children":
					if (typeof r == "string") fn(r, t, !1), t === "body" || t === "textarea" && r === "" || pn(e, r);
					else if (typeof r == "number" || typeof r == "bigint") fn("" + r, t, !1), t !== "body" && pn(e, "" + r);
					else return;
					break;
				case "className":
					Tt(e, "class", r);
					break;
				case "tabIndex":
					Tt(e, "tabindex", r);
					break;
				case "dir":
				case "role":
				case "viewBox":
				case "width":
				case "height":
					Tt(e, n, r);
					break;
				case "style":
					gn(e, r, a);
					return;
				case "data": if (t !== "object") {
					Tt(e, "data", r);
					break;
				}
				case "src":
				case "href":
					if (r === "" && (t !== "a" || n !== "href")) {
						console.error(n === "src" ? "An empty string (\"\") was passed to the %s attribute. This may cause the browser to download the whole page again over the network. To fix this, either do not render the element at all or pass null to %s instead of an empty string." : "An empty string (\"\") was passed to the %s attribute. To fix this, either do not render the element at all or pass null to %s instead of an empty string.", n, n), e.removeAttribute(n);
						break;
					}
					if (r == null || typeof r == "function" || typeof r == "symbol" || typeof r == "boolean") {
						e.removeAttribute(n);
						break;
					}
					Ve(r, n), r = Cn(r), e.setAttribute(n, r);
					break;
				case "action":
				case "formAction":
					if (r != null && (t === "form" ? n === "formAction" ? console.error("You can only pass the formAction prop to <input> or <button>. Use the action prop on <form>.") : typeof r == "function" && (i.encType == null && i.method == null || qw || (qw = !0, console.error("Cannot specify a encType or method for a form that specifies a function as the action. React provides those automatically. They will get overridden.")), i.target == null || Kw || (Kw = !0, console.error("Cannot specify a target for a form that specifies a function as the action. The function will always be executed in the same window."))) : t === "input" || t === "button" ? n === "action" ? console.error("You can only pass the action prop to <form>. Use the formAction prop on <input> or <button>.") : t !== "input" || i.type === "submit" || i.type === "image" || Ww ? t !== "button" || i.type == null || i.type === "submit" || Ww ? typeof r == "function" && (i.name == null || Gw || (Gw = !0, console.error("Cannot specify a \"name\" prop for a button that specifies a function as a formAction. React needs it to encode which action should be invoked. It will get overridden.")), i.formEncType == null && i.formMethod == null || qw || (qw = !0, console.error("Cannot specify a formEncType or formMethod for a button that specifies a function as a formAction. React provides those automatically. They will get overridden.")), i.formTarget == null || Kw || (Kw = !0, console.error("Cannot specify a formTarget for a button that specifies a function as a formAction. The function will always be executed in the same window."))) : (Ww = !0, console.error("A button can only specify a formAction along with type=\"submit\" or no type.")) : (Ww = !0, console.error("An input can only specify a formAction along with type=\"submit\" or type=\"image\".")) : console.error(n === "action" ? "You can only pass the action prop to <form>." : "You can only pass the formAction prop to <input> or <button>.")), typeof r == "function") {
						e.setAttribute(n, "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')");
						break;
					}
					if (typeof a == "function" && (n === "formAction" ? (t !== "input" && I(e, t, "name", i.name, i, null), I(e, t, "formEncType", i.formEncType, i, null), I(e, t, "formMethod", i.formMethod, i, null), I(e, t, "formTarget", i.formTarget, i, null)) : (I(e, t, "encType", i.encType, i, null), I(e, t, "method", i.method, i, null), I(e, t, "target", i.target, i, null))), r == null || typeof r == "symbol" || typeof r == "boolean") {
						e.removeAttribute(n);
						break;
					}
					Ve(r, n), r = Cn(r), e.setAttribute(n, r);
					break;
				case "onClick":
					r != null && (typeof r != "function" && kd(n, r), e.onclick = wn);
					return;
				case "onScroll":
					r != null && (typeof r != "function" && kd(n, r), F("scroll", e));
					return;
				case "onScrollEnd":
					r != null && (typeof r != "function" && kd(n, r), F("scrollend", e));
					return;
				case "dangerouslySetInnerHTML":
					if (r != null) {
						if (typeof r != "object" || !("__html" in r)) throw Error("`props.dangerouslySetInnerHTML` must be in the form `{__html: ...}`. Please visit https://react.dev/link/dangerously-set-inner-html for more information.");
						if (n = r.__html, n != null) {
							if (i.children != null) throw Error("Can only set one of `children` or `props.dangerouslySetInnerHTML`.");
							a?.__html !== n && (e.innerHTML = n);
						}
					}
					break;
				case "multiple":
					e.multiple = r && typeof r != "function" && typeof r != "symbol";
					break;
				case "muted":
					e.muted = r && typeof r != "function" && typeof r != "symbol";
					break;
				case "suppressContentEditableWarning":
				case "suppressHydrationWarning":
				case "defaultValue":
				case "defaultChecked":
				case "innerHTML":
				case "ref": break;
				case "autoFocus": break;
				case "xlinkHref":
					if (r == null || typeof r == "function" || typeof r == "boolean" || typeof r == "symbol") {
						e.removeAttribute("xlink:href");
						break;
					}
					Ve(r, n), n = Cn(r), e.setAttributeNS(Qw, "xlink:href", n);
					break;
				case "contentEditable":
				case "spellCheck":
				case "draggable":
				case "value":
				case "autoReverse":
				case "externalResourcesRequired":
				case "focusable":
				case "preserveAlpha":
					r != null && typeof r != "function" && typeof r != "symbol" ? (Ve(r, n), e.setAttribute(n, r)) : e.removeAttribute(n);
					break;
				case "inert": r !== "" || Yw[n] || (Yw[n] = !0, console.error("Received an empty string for a boolean attribute `%s`. This will treat the attribute as if it were false. Either pass `false` to silence this warning, or pass `true` if you used an empty string in earlier versions of React to indicate this attribute is true.", n));
				case "allowFullScreen":
				case "async":
				case "autoPlay":
				case "controls":
				case "credentialless":
				case "default":
				case "defer":
				case "disabled":
				case "disablePictureInPicture":
				case "disableRemotePlayback":
				case "formNoValidate":
				case "hidden":
				case "loop":
				case "noModule":
				case "noValidate":
				case "open":
				case "playsInline":
				case "readOnly":
				case "required":
				case "reversed":
				case "scoped":
				case "seamless":
				case "itemScope":
					r && typeof r != "function" && typeof r != "symbol" ? e.setAttribute(n, "") : e.removeAttribute(n);
					break;
				case "capture":
				case "download":
					!0 === r ? e.setAttribute(n, "") : !1 !== r && r != null && typeof r != "function" && typeof r != "symbol" ? (Ve(r, n), e.setAttribute(n, r)) : e.removeAttribute(n);
					break;
				case "cols":
				case "rows":
				case "size":
				case "span":
					r != null && typeof r != "function" && typeof r != "symbol" && !isNaN(r) && 1 <= r ? (Ve(r, n), e.setAttribute(n, r)) : e.removeAttribute(n);
					break;
				case "rowSpan":
				case "start":
					r == null || typeof r == "function" || typeof r == "symbol" || isNaN(r) ? e.removeAttribute(n) : (Ve(r, n), e.setAttribute(n, r));
					break;
				case "popover":
					F("beforetoggle", e), F("toggle", e), wt(e, "popover", r);
					break;
				case "xlinkActuate":
					Et(e, Qw, "xlink:actuate", r);
					break;
				case "xlinkArcrole":
					Et(e, Qw, "xlink:arcrole", r);
					break;
				case "xlinkRole":
					Et(e, Qw, "xlink:role", r);
					break;
				case "xlinkShow":
					Et(e, Qw, "xlink:show", r);
					break;
				case "xlinkTitle":
					Et(e, Qw, "xlink:title", r);
					break;
				case "xlinkType":
					Et(e, Qw, "xlink:type", r);
					break;
				case "xmlBase":
					Et(e, $w, "xml:base", r);
					break;
				case "xmlLang":
					Et(e, $w, "xml:lang", r);
					break;
				case "xmlSpace":
					Et(e, $w, "xml:space", r);
					break;
				case "is":
					a != null && console.error("Cannot update the \"is\" prop after it has been initialized."), wt(e, "is", r);
					break;
				case "innerText":
				case "textContent": return;
				case "popoverTarget": Jw || typeof r != "object" || !r || (Jw = !0, console.error("The `popoverTarget` prop expects the ID of an Element as a string. Received %s instead.", r));
				default: if (!(2 < n.length) || n[0] !== "o" && n[0] !== "O" || n[1] !== "n" && n[1] !== "N") n = vn(n), wt(e, n, r);
				else {
					tg.hasOwnProperty(n) && r != null && typeof r != "function" && kd(n, r);
					return;
				}
			}
			V = !0;
		}
		function Nd(e, t, n, r, i, a) {
			switch (n) {
				case "style":
					gn(e, r, a);
					return;
				case "dangerouslySetInnerHTML":
					if (r != null) {
						if (typeof r != "object" || !("__html" in r)) throw Error("`props.dangerouslySetInnerHTML` must be in the form `{__html: ...}`. Please visit https://react.dev/link/dangerously-set-inner-html for more information.");
						if (n = r.__html, n != null) {
							if (i.children != null) throw Error("Can only set one of `children` or `props.dangerouslySetInnerHTML`.");
							a?.__html !== n && (e.innerHTML = n);
						}
					}
					break;
				case "children":
					if (typeof r == "string") pn(e, r);
					else if (typeof r == "number" || typeof r == "bigint") pn(e, "" + r);
					else return;
					break;
				case "onScroll":
					r != null && (typeof r != "function" && kd(n, r), F("scroll", e));
					return;
				case "onScrollEnd":
					r != null && (typeof r != "function" && kd(n, r), F("scrollend", e));
					return;
				case "onClick":
					r != null && (typeof r != "function" && kd(n, r), e.onclick = wn);
					return;
				case "suppressContentEditableWarning":
				case "suppressHydrationWarning":
				case "innerHTML":
				case "ref": return;
				case "innerText":
				case "textContent": return;
				default:
					if (tg.hasOwnProperty(n)) r != null && typeof r != "function" && kd(n, r);
					else a: {
						if (n[0] === "o" && n[1] === "n" && (i = n.endsWith("Capture"), a = n.slice(2, i ? n.length - 7 : void 0), t = e[Kh] || null, t = t == null ? null : t[n], typeof t == "function" && e.removeEventListener(a, t, i), typeof r == "function")) {
							typeof t != "function" && t !== null && (n in e ? e[n] = null : e.hasAttribute(n) && e.removeAttribute(n)), e.addEventListener(a, r, i);
							break a;
						}
						V = !0, n in e ? e[n] = r : !0 === r ? e.setAttribute(n, "") : wt(e, n, r);
					}
					return;
			}
			V = !0;
		}
		function Pd(e, t, n) {
			switch (wd(t, n), t) {
				case "div":
				case "span":
				case "svg":
				case "path":
				case "a":
				case "g":
				case "p":
				case "li": break;
				case "img":
					F("error", e), F("load", e);
					var r = !1, i = !1, a;
					for (a in n) if (n.hasOwnProperty(a)) {
						var o = n[a];
						if (o != null) switch (a) {
							case "src":
								r = !0;
								break;
							case "srcSet":
								i = !0;
								break;
							case "children":
							case "dangerouslySetInnerHTML": throw Error(t + " is a void element tag and must neither have `children` nor use `dangerouslySetInnerHTML`.");
							default: I(e, t, a, o, n, null);
						}
					}
					i && I(e, t, "srcSet", n.srcSet, n, null), r && I(e, t, "src", n.src, n, null);
					return;
				case "input":
					bt("input", n), F("invalid", e);
					var s = a = o = i = null, c = null, l = null;
					for (r in n) if (n.hasOwnProperty(r)) {
						var u = n[r];
						if (u != null) switch (r) {
							case "name":
								i = u;
								break;
							case "type":
								o = u;
								break;
							case "checked":
								c = u;
								break;
							case "defaultChecked":
								l = u;
								break;
							case "value":
								a = u;
								break;
							case "defaultValue":
								s = u;
								break;
							case "children":
							case "dangerouslySetInnerHTML":
								if (u != null) throw Error(t + " is a void element tag and must neither have `children` nor use `dangerouslySetInnerHTML`.");
								break;
							default: I(e, t, r, u, n, null);
						}
					}
					Nt(e, n), Ft(e, a, s, c, l, o, i, !1);
					return;
				case "select":
					for (i in bt("select", n), F("invalid", e), r = o = a = null, n) if (n.hasOwnProperty(i) && (s = n[i], s != null)) switch (i) {
						case "value":
							a = s;
							break;
						case "defaultValue":
							o = s;
							break;
						case "multiple": r = s;
						default: I(e, t, i, s, n, null);
					}
					Bt(e, n), t = a, n = o, e.multiple = !!r, t == null ? n != null && zt(e, !!r, n, !0) : zt(e, !!r, t, !1);
					return;
				case "textarea":
					for (o in bt("textarea", n), F("invalid", e), a = i = r = null, n) if (n.hasOwnProperty(o) && (s = n[o], s != null)) switch (o) {
						case "value":
							r = s;
							break;
						case "defaultValue":
							i = s;
							break;
						case "children":
							a = s;
							break;
						case "dangerouslySetInnerHTML":
							if (s != null) throw Error("`dangerouslySetInnerHTML` does not make sense on <textarea>.");
							break;
						default: I(e, t, o, s, n, null);
					}
					Vt(e, n), Ut(e, r, i, a);
					return;
				case "option":
					for (c in Lt(e, n), n) if (n.hasOwnProperty(c) && (r = n[c], r != null)) switch (c) {
						case "selected":
							e.selected = r && typeof r != "function" && typeof r != "symbol";
							break;
						default: I(e, t, c, r, n, null);
					}
					return;
				case "dialog":
					F("beforetoggle", e), F("toggle", e), F("cancel", e), F("close", e);
					break;
				case "iframe":
				case "object":
					F("load", e);
					break;
				case "video":
				case "audio":
					for (r = 0; r < zw.length; r++) F(zw[r], e);
					break;
				case "image":
					F("error", e), F("load", e);
					break;
				case "details":
					F("toggle", e);
					break;
				case "embed":
				case "source":
				case "link": F("error", e), F("load", e);
				case "area":
				case "base":
				case "br":
				case "col":
				case "hr":
				case "keygen":
				case "meta":
				case "param":
				case "track":
				case "wbr":
				case "menuitem":
					for (l in n) if (n.hasOwnProperty(l) && (r = n[l], r != null)) switch (l) {
						case "children":
						case "dangerouslySetInnerHTML": throw Error(t + " is a void element tag and must neither have `children` nor use `dangerouslySetInnerHTML`.");
						default: I(e, t, l, r, n, null);
					}
					return;
				default: if (_n(t)) {
					for (u in n) n.hasOwnProperty(u) && (r = n[u], r !== void 0 && Nd(e, t, u, r, n, void 0));
					return;
				}
			}
			for (s in n) n.hasOwnProperty(s) && (r = n[s], r != null && I(e, t, s, r, n, null));
		}
		function Fd(e, t, n, r) {
			switch (wd(t, r), t) {
				case "div":
				case "span":
				case "svg":
				case "path":
				case "a":
				case "g":
				case "p":
				case "li": break;
				case "input":
					var i = null, a = null, o = null, s = null, c = null, l = null, u = null;
					for (p in n) {
						var d = n[p];
						if (n.hasOwnProperty(p) && d != null) switch (p) {
							case "checked": break;
							case "value": break;
							case "defaultValue": c = d;
							default: r.hasOwnProperty(p) || I(e, t, p, null, r, d);
						}
					}
					for (var f in r) {
						var p = r[f];
						if (d = n[f], r.hasOwnProperty(f) && (p != null || d != null)) switch (f) {
							case "type":
								p !== d && (V = !0), a = p;
								break;
							case "name":
								p !== d && (V = !0), i = p;
								break;
							case "checked":
								p !== d && (V = !0), l = p;
								break;
							case "defaultChecked":
								p !== d && (V = !0), u = p;
								break;
							case "value":
								p !== d && (V = !0), o = p;
								break;
							case "defaultValue":
								p !== d && (V = !0), s = p;
								break;
							case "children":
							case "dangerouslySetInnerHTML":
								if (p != null) throw Error(t + " is a void element tag and must neither have `children` nor use `dangerouslySetInnerHTML`.");
								break;
							default: p !== d && I(e, t, f, p, r, d);
						}
					}
					t = n.type === "checkbox" || n.type === "radio" ? n.checked != null : n.value != null, r = r.type === "checkbox" || r.type === "radio" ? r.checked != null : r.value != null, t || !r || Uw || (console.error("A component is changing an uncontrolled input to be controlled. This is likely caused by the value changing from undefined to a defined value, which should not happen. Decide between using a controlled or uncontrolled input element for the lifetime of the component. More info: https://react.dev/link/controlled-components"), Uw = !0), !t || r || Hw || (console.error("A component is changing a controlled input to be uncontrolled. This is likely caused by the value changing from a defined to undefined, which should not happen. Decide between using a controlled or uncontrolled input element for the lifetime of the component. More info: https://react.dev/link/controlled-components"), Hw = !0), Pt(e, o, s, c, l, u, a, i);
					return;
				case "select":
					for (a in p = o = s = f = null, n) if (c = n[a], n.hasOwnProperty(a) && c != null) switch (a) {
						case "value": break;
						case "multiple": p = c;
						default: r.hasOwnProperty(a) || I(e, t, a, null, r, c);
					}
					for (i in r) if (a = r[i], c = n[i], r.hasOwnProperty(i) && (a != null || c != null)) switch (i) {
						case "value":
							a !== c && (V = !0), f = a;
							break;
						case "defaultValue":
							a !== c && (V = !0), s = a;
							break;
						case "multiple": a !== c && (V = !0), o = a;
						default: a !== c && I(e, t, i, a, r, c);
					}
					r = s, t = o, n = p, f == null ? !!n != !!t && (r == null ? zt(e, !!t, t ? [] : "", !1) : zt(e, !!t, r, !0)) : zt(e, !!t, f, !1);
					return;
				case "textarea":
					for (s in p = f = null, n) if (i = n[s], n.hasOwnProperty(s) && i != null && !r.hasOwnProperty(s)) switch (s) {
						case "value": break;
						case "children": break;
						default: I(e, t, s, null, r, i);
					}
					for (o in r) if (i = r[o], a = n[o], r.hasOwnProperty(o) && (i != null || a != null)) switch (o) {
						case "value":
							i !== a && (V = !0), f = i;
							break;
						case "defaultValue":
							i !== a && (V = !0), p = i;
							break;
						case "children": break;
						case "dangerouslySetInnerHTML":
							if (i != null) throw Error("`dangerouslySetInnerHTML` does not make sense on <textarea>.");
							break;
						default: i !== a && I(e, t, o, i, r, a);
					}
					Ht(e, f, p);
					return;
				case "option":
					for (var m in n) if (f = n[m], n.hasOwnProperty(m) && f != null && !r.hasOwnProperty(m)) switch (m) {
						case "selected":
							e.selected = !1;
							break;
						default: I(e, t, m, null, r, f);
					}
					for (c in r) if (f = r[c], p = n[c], r.hasOwnProperty(c) && f !== p && (f != null || p != null)) switch (c) {
						case "selected":
							f !== p && (V = !0), e.selected = f && typeof f != "function" && typeof f != "symbol";
							break;
						default: I(e, t, c, f, r, p);
					}
					return;
				case "img":
				case "link":
				case "area":
				case "base":
				case "br":
				case "col":
				case "embed":
				case "hr":
				case "keygen":
				case "meta":
				case "param":
				case "source":
				case "track":
				case "wbr":
				case "menuitem":
					for (var h in n) f = n[h], n.hasOwnProperty(h) && f != null && !r.hasOwnProperty(h) && I(e, t, h, null, r, f);
					for (l in r) if (f = r[l], p = n[l], r.hasOwnProperty(l) && f !== p && (f != null || p != null)) switch (l) {
						case "children":
						case "dangerouslySetInnerHTML":
							if (f != null) throw Error(t + " is a void element tag and must neither have `children` nor use `dangerouslySetInnerHTML`.");
							break;
						default: I(e, t, l, f, r, p);
					}
					return;
				default: if (_n(t)) {
					for (var g in n) f = n[g], n.hasOwnProperty(g) && f !== void 0 && !r.hasOwnProperty(g) && Nd(e, t, g, void 0, r, f);
					for (u in r) f = r[u], p = n[u], !r.hasOwnProperty(u) || f === p || f === void 0 && p === void 0 || Nd(e, t, u, f, r, p);
					return;
				}
			}
			for (var _ in n) f = n[_], n.hasOwnProperty(_) && f != null && !r.hasOwnProperty(_) && I(e, t, _, null, r, f);
			for (d in r) f = r[d], p = n[d], !r.hasOwnProperty(d) || f === p || f == null && p == null || I(e, t, d, f, r, p);
		}
		function Id(e) {
			switch (e) {
				case "class": return "className";
				case "for": return "htmlFor";
				default: return e;
			}
		}
		function Ld(e) {
			for (var t = {}, n = e.style, r = 0; r < n.length; r++) {
				var i = n[r];
				i === "view-transition-name" && Dd(e) || (t[i] = n.getPropertyValue(i));
			}
			return t;
		}
		function Rd(e, t, n) {
			if (t != null && typeof t != "object") console.error("The `style` prop expects a mapping from style properties to values, not a string. For example, style={{marginRight: spacing + 'em'}} when using JSX.");
			else {
				var r, i = r = "", a;
				for (a in t) if (t.hasOwnProperty(a)) {
					var o = t[a];
					o != null && typeof o != "boolean" && o !== "" && (a.indexOf("--") === 0 ? (He(o, a), r += i + a + ":" + ("" + o).trim()) : typeof o != "number" || o === 0 || Pg.has(a) ? (He(o, a), r += i + a.replace(wg, "-$1").toLowerCase().replace(Tg, "-ms-") + ":" + ("" + o).trim()) : r += i + a.replace(wg, "-$1").toLowerCase().replace(Tg, "-ms-") + ":" + o + "px", i = ";");
				}
				r ||= null, t = e.getAttribute("style"), t !== r && (r = jd(r), t = jd(t), t === r || t[t.length - 1] === ";" && Ed(e) || (n.style = Ld(e)));
			}
		}
		function zd(e, t, n, r, i, a) {
			if (i.delete(n), e = e.getAttribute(n), e === null) switch (typeof r) {
				case "undefined":
				case "function":
				case "symbol":
				case "boolean": return;
			}
			else if (r != null) switch (typeof r) {
				case "function":
				case "symbol":
				case "boolean": break;
				default: if (Ve(r, t), e === "" + r) return;
			}
			Td(t, e, r, a);
		}
		function Bd(e, t, n, r, i, a) {
			if (i.delete(n), e = e.getAttribute(n), e === null) {
				switch (typeof r) {
					case "function":
					case "symbol": return;
				}
				if (!r) return;
			} else switch (typeof r) {
				case "function":
				case "symbol": break;
				default: if (r) return;
			}
			Td(t, e, r, a);
		}
		function Vd(e, t, n, r, i, a) {
			if (i.delete(n), e = e.getAttribute(n), e === null) switch (typeof r) {
				case "undefined":
				case "function":
				case "symbol": return;
			}
			else if (r != null) switch (typeof r) {
				case "function":
				case "symbol": break;
				default: if (Ve(r, n), e === "" + r) return;
			}
			Td(t, e, r, a);
		}
		function Hd(e, t, n, r, i, a) {
			if (i.delete(n), e = e.getAttribute(n), e === null) switch (typeof r) {
				case "undefined":
				case "function":
				case "symbol":
				case "boolean": return;
				default: if (isNaN(r)) return;
			}
			else if (r != null) switch (typeof r) {
				case "function":
				case "symbol":
				case "boolean": break;
				default: if (!isNaN(r) && (Ve(r, t), e === "" + r)) return;
			}
			Td(t, e, r, a);
		}
		function Ud(e, t, n, r, i, a) {
			if (i.delete(n), e = e.getAttribute(n), e === null) switch (typeof r) {
				case "undefined":
				case "function":
				case "symbol":
				case "boolean": return;
			}
			else if (r != null) switch (typeof r) {
				case "function":
				case "symbol":
				case "boolean": break;
				default: if (Ve(r, t), n = Cn("" + r), e === n) return;
			}
			Td(t, e, r, a);
		}
		function Wd(e, t, n, r) {
			for (var i = {}, a = /* @__PURE__ */ new Set(), o = e.attributes, s = 0; s < o.length; s++) switch (o[s].name.toLowerCase()) {
				case "value": break;
				case "checked": break;
				case "selected": break;
				case "vt-name":
				case "vt-update":
				case "vt-enter":
				case "vt-exit":
				case "vt-share":
				case "vt-parent-enter":
				case "vt-parent-exit": break;
				default: a.add(o[s].name);
			}
			if (_n(t)) {
				for (var c in n) if (n.hasOwnProperty(c)) {
					var l = n[c];
					if (l != null) {
						if (tg.hasOwnProperty(c)) typeof l != "function" && kd(c, l);
						else if (!0 !== n.suppressHydrationWarning) switch (c) {
							case "children":
								typeof l != "string" && typeof l != "number" || Td("children", e.textContent, l, i);
								continue;
							case "suppressContentEditableWarning":
							case "suppressHydrationWarning":
							case "defaultValue":
							case "defaultChecked":
							case "innerHTML":
							case "ref": continue;
							case "dangerouslySetInnerHTML":
								o = e.innerHTML, l = l ? l.__html : void 0, l != null && (l = Ad(e, l), Td(c, o, l, i));
								continue;
							case "style":
								a.delete(c), Rd(e, l, i);
								continue;
							case "offsetParent":
							case "offsetTop":
							case "offsetLeft":
							case "offsetWidth":
							case "offsetHeight":
							case "isContentEditable":
							case "outerText":
							case "outerHTML":
								a.delete(c.toLowerCase()), console.error("Assignment to read-only property will result in a no-op: `%s`", c);
								continue;
							case "className":
								a.delete("class"), o = Ct(e, "class", l), Td("className", o, l, i);
								continue;
							default: r.context === _T && t !== "svg" && t !== "math" ? a.delete(c.toLowerCase()) : a.delete(c), o = Ct(e, c, l), Td(c, o, l, i);
						}
					}
				}
			} else for (l in n) if (n.hasOwnProperty(l) && (c = n[l], c != null)) {
				if (tg.hasOwnProperty(l)) typeof c != "function" && kd(l, c);
				else if (!0 !== n.suppressHydrationWarning) switch (l) {
					case "children":
						typeof c != "string" && typeof c != "number" || Td("children", e.textContent, c, i);
						continue;
					case "suppressContentEditableWarning":
					case "suppressHydrationWarning":
					case "value":
					case "checked":
					case "selected":
					case "defaultValue":
					case "defaultChecked":
					case "innerHTML":
					case "ref": continue;
					case "dangerouslySetInnerHTML":
						o = e.innerHTML, c = c ? c.__html : void 0, c != null && (c = Ad(e, c), o !== c && (i[l] = { __html: o }));
						continue;
					case "className":
						zd(e, l, "class", c, a, i);
						continue;
					case "tabIndex":
						zd(e, l, "tabindex", c, a, i);
						continue;
					case "style":
						a.delete(l), Rd(e, c, i);
						continue;
					case "multiple":
						a.delete(l), Td(l, e.multiple, c, i);
						continue;
					case "muted":
						a.delete(l), Td(l, e.muted, c, i);
						continue;
					case "autoFocus":
						a.delete("autofocus"), Td(l, e.autofocus, c, i);
						continue;
					case "data": if (t !== "object") {
						a.delete(l), o = e.getAttribute("data"), Td(l, o, c, i);
						continue;
					}
					case "src":
					case "href":
						if (!(c !== "" || t === "a" && l === "href" || t === "object" && l === "data")) {
							console.error(l === "src" ? "An empty string (\"\") was passed to the %s attribute. This may cause the browser to download the whole page again over the network. To fix this, either do not render the element at all or pass null to %s instead of an empty string." : "An empty string (\"\") was passed to the %s attribute. To fix this, either do not render the element at all or pass null to %s instead of an empty string.", l, l);
							continue;
						}
						Ud(e, l, l, c, a, i);
						continue;
					case "action":
					case "formAction":
						if (o = e.getAttribute(l), typeof c == "function") {
							a.delete(l.toLowerCase()), l === "formAction" ? (a.delete("name"), a.delete("formenctype"), a.delete("formmethod"), a.delete("formtarget")) : (a.delete("enctype"), a.delete("method"), a.delete("target"));
							continue;
						}
						if (o === tT) {
							a.delete(l.toLowerCase()), Td(l, "function", c, i);
							continue;
						}
						Ud(e, l, l.toLowerCase(), c, a, i);
						continue;
					case "xlinkHref":
						Ud(e, l, "xlink:href", c, a, i);
						continue;
					case "contentEditable":
						Vd(e, l, "contenteditable", c, a, i);
						continue;
					case "spellCheck":
						Vd(e, l, "spellcheck", c, a, i);
						continue;
					case "draggable":
					case "autoReverse":
					case "externalResourcesRequired":
					case "focusable":
					case "preserveAlpha":
						Vd(e, l, l, c, a, i);
						continue;
					case "allowFullScreen":
					case "async":
					case "autoPlay":
					case "controls":
					case "credentialless":
					case "default":
					case "defer":
					case "disabled":
					case "disablePictureInPicture":
					case "disableRemotePlayback":
					case "formNoValidate":
					case "hidden":
					case "loop":
					case "noModule":
					case "noValidate":
					case "open":
					case "playsInline":
					case "readOnly":
					case "required":
					case "reversed":
					case "scoped":
					case "seamless":
					case "itemScope":
						Bd(e, l, l.toLowerCase(), c, a, i);
						continue;
					case "capture":
					case "download":
						a: {
							s = e;
							var u = o = l, d = i;
							if (a.delete(u), s = s.getAttribute(u), s === null) switch (typeof c) {
								case "undefined":
								case "function":
								case "symbol": break a;
								default: if (!1 === c) break a;
							}
							else if (c != null) switch (typeof c) {
								case "function":
								case "symbol": break;
								case "boolean":
									if (!0 === c && s === "") break a;
									break;
								default: if (Ve(c, o), s === "" + c) break a;
							}
							Td(o, s, c, d);
						}
						continue;
					case "cols":
					case "rows":
					case "size":
					case "span":
						a: {
							if (s = e, u = o = l, d = i, a.delete(u), s = s.getAttribute(u), s === null) switch (typeof c) {
								case "undefined":
								case "function":
								case "symbol":
								case "boolean": break a;
								default: if (isNaN(c) || 1 > c) break a;
							}
							else if (c != null) switch (typeof c) {
								case "function":
								case "symbol":
								case "boolean": break;
								default: if (!(isNaN(c) || 1 > c) && (Ve(c, o), s === "" + c)) break a;
							}
							Td(o, s, c, d);
						}
						continue;
					case "rowSpan":
						Hd(e, l, "rowspan", c, a, i);
						continue;
					case "start":
						Hd(e, l, l, c, a, i);
						continue;
					case "xHeight":
						zd(e, l, "x-height", c, a, i);
						continue;
					case "xlinkActuate":
						zd(e, l, "xlink:actuate", c, a, i);
						continue;
					case "xlinkArcrole":
						zd(e, l, "xlink:arcrole", c, a, i);
						continue;
					case "xlinkRole":
						zd(e, l, "xlink:role", c, a, i);
						continue;
					case "xlinkShow":
						zd(e, l, "xlink:show", c, a, i);
						continue;
					case "xlinkTitle":
						zd(e, l, "xlink:title", c, a, i);
						continue;
					case "xlinkType":
						zd(e, l, "xlink:type", c, a, i);
						continue;
					case "xmlBase":
						zd(e, l, "xml:base", c, a, i);
						continue;
					case "xmlLang":
						zd(e, l, "xml:lang", c, a, i);
						continue;
					case "xmlSpace":
						zd(e, l, "xml:space", c, a, i);
						continue;
					case "inert":
						c !== "" || Yw[l] || (Yw[l] = !0, console.error("Received an empty string for a boolean attribute `%s`. This will treat the attribute as if it were false. Either pass `false` to silence this warning, or pass `true` if you used an empty string in earlier versions of React to indicate this attribute is true.", l)), Bd(e, l, l, c, a, i);
						continue;
					default: if (!(2 < l.length) || l[0] !== "o" && l[0] !== "O" || l[1] !== "n" && l[1] !== "N") {
						s = vn(l), o = !1, r.context === _T && t !== "svg" && t !== "math" ? a.delete(s.toLowerCase()) : (u = l.toLowerCase(), u = Rg.hasOwnProperty(u) && Rg[u] || null, u !== null && u !== l && (o = !0, a.delete(u)), a.delete(s));
						a: if (u = e, d = s, s = c, xt(d)) {
							if (u.hasAttribute(d)) u = d.toLowerCase() === "nonce" ? u.nonce : u.getAttribute(d), Ve(s, d), s = u === "" + s ? s : u;
							else {
								switch (typeof s) {
									case "function":
									case "symbol": break a;
									case "boolean": if (u = d.toLowerCase().slice(0, 5), u !== "data-" && u !== "aria-") break a;
								}
								s = s === void 0 ? void 0 : null;
							}
						} else s = void 0;
						o || Td(l, s, c, i);
					}
				}
			}
			return 0 < a.size && !0 !== n.suppressHydrationWarning && Od(e, a, i), Object.keys(i).length === 0 ? null : i;
		}
		function Gd(e, t) {
			switch (e.length) {
				case 0: return "";
				case 1: return e[0];
				case 2: return e[0] + " " + t + " " + e[1];
				default: return e.slice(0, -1).join(", ") + ", " + t + " " + e[e.length - 1];
			}
		}
		function Kd(e) {
			switch (e) {
				case "css":
				case "script":
				case "font":
				case "img":
				case "image":
				case "input":
				case "link": return !0;
				default: return !1;
			}
		}
		function qd() {
			if (typeof performance.getEntriesByType == "function") {
				for (var e = 0, t = 0, n = performance.getEntriesByType("resource"), r = 0; r < n.length; r++) {
					var i = n[r], a = i.transferSize, o = i.initiatorType, s = i.duration;
					if (a && s && Kd(o)) {
						for (o = 0, s = i.responseEnd, r += 1; r < n.length; r++) {
							var c = n[r], l = c.startTime;
							if (l > s) break;
							var u = c.transferSize, d = c.initiatorType;
							u && Kd(d) && (c = c.responseEnd, o += u * (c < s ? 1 : (s - l) / (c - l)));
						}
						if (--r, t += 8 * (a + o) / (i.duration / 1e3), e++, 10 < e) break;
					}
				}
				if (0 < e) return t / e / 1e6;
			}
			return navigator.connection && (e = navigator.connection.downlink, typeof e == "number") ? e : 5;
		}
		function Jd(e) {
			return e.nodeType === 9 ? e : e.ownerDocument;
		}
		function Yd(e) {
			switch (e) {
				case Ig: return vT;
				case Fg: return yT;
				default: return _T;
			}
		}
		function Xd(e, t) {
			if (e === _T) switch (t) {
				case "svg": return vT;
				case "math": return yT;
				default: return _T;
			}
			return e === vT && t === "foreignObject" ? _T : e;
		}
		function Zd(e, t, n, r) {
			return n = Jd(n).createElement(e), n[Gh] = r, n[Kh] = t, Pd(n, e, t), gt(n), n;
		}
		function Qd(e) {
			if (e = e.type, typeof e != "string" || e === "" || (e = e.toLowerCase(), e === "module" || e === "importmap" || e === "speculationrules")) return !1;
			switch (e) {
				case "application/ecmascript":
				case "application/javascript":
				case "application/x-ecmascript":
				case "application/x-javascript":
				case "text/ecmascript":
				case "text/javascript":
				case "text/javascript1.0":
				case "text/javascript1.1":
				case "text/javascript1.2":
				case "text/javascript1.3":
				case "text/javascript1.4":
				case "text/javascript1.5":
				case "text/jscript":
				case "text/livescript":
				case "text/x-ecmascript":
				case "text/x-javascript": return !1;
			}
			return !0;
		}
		function $d(e, t) {
			return e === "textarea" || e === "noscript" || typeof t.children == "string" || typeof t.children == "number" || typeof t.children == "bigint" || typeof t.dangerouslySetInnerHTML == "object" && t.dangerouslySetInnerHTML !== null && t.dangerouslySetInnerHTML.__html != null;
		}
		function ef() {
			var e = window.event;
			return e && e.type === "popstate" ? e !== wT && (wT = e, !0) : (wT = null, !1);
		}
		function tf() {
			var e = window.event;
			return e && e !== TT ? e.type : null;
		}
		function nf() {
			var e = window.event;
			return e && e !== TT ? e.timeStamp : -1.1;
		}
		function rf(e) {
			setTimeout(function() {
				throw e;
			});
		}
		function af(e, t, n) {
			switch (t) {
				case "button":
				case "input":
				case "select":
				case "textarea":
					n.autoFocus && e.focus();
					break;
				case "img": n.src ? e.src = n.src : n.srcSet && (e.srcset = n.srcSet);
			}
		}
		function of() {}
		function sf(e, t, n, r) {
			Fd(e, t, n, r), e[Kh] = r;
		}
		function cf(e) {
			pn(e, "");
		}
		function lf(e, t, n) {
			e.nodeValue = n;
		}
		function uf(e) {
			if (!e.__reactWarnedAboutChildrenConflict) {
				var t = e[Kh] || null;
				if (t !== null) {
					var n = pt(e);
					n !== null && (typeof t.children == "string" || typeof t.children == "number" ? (e.__reactWarnedAboutChildrenConflict = !0, T(n, function() {
						console.error("Cannot use a ref on a React element as a container to `createRoot` or `createPortal` if that element also sets \"children\" text content using React. It should be a leaf with no children. Otherwise it's ambiguous which children should be used.");
					})) : t.dangerouslySetInnerHTML != null && (e.__reactWarnedAboutChildrenConflict = !0, T(n, function() {
						console.error("Cannot use a ref on a React element as a container to `createRoot` or `createPortal` if that element also sets \"dangerouslySetInnerHTML\" using React. It should be a leaf with no children. Otherwise it's ambiguous which children should be used.");
					})));
				}
			}
		}
		function df(e) {
			return e === "head";
		}
		function ff(e, t) {
			e.removeChild(t);
		}
		function pf(e, t) {
			(e.nodeType === 9 ? e.body : e.nodeName === "HTML" ? e.ownerDocument.body : e).removeChild(t);
		}
		function mf(e, t) {
			var n = t, r = 0;
			do {
				var i = n.nextSibling;
				if (e.removeChild(n), i && i.nodeType === 8) {
					if (n = i.data, n === oT || n === iT) {
						if (r === 0) {
							e.removeChild(i), _m(t);
							return;
						}
						r--;
					} else if (n === aT || n === sT || n === cT || n === lT || n === rT) r++;
					else if (n === uT) vp(e.ownerDocument.documentElement);
					else if (n === fT) {
						n = e.ownerDocument.head, vp(n);
						for (var a = n.firstChild; a;) {
							var o = a.nextSibling, s = a.nodeName;
							a[Qh] || s === "SCRIPT" || s === "STYLE" || s === "LINK" && a.rel.toLowerCase() === "stylesheet" || n.removeChild(a), a = o;
						}
					} else n === dT && vp(e.ownerDocument.body);
				}
				n = i;
			} while (n);
			_m(t);
		}
		function hf(e, t) {
			var n = e;
			e = 0;
			do {
				var r = n.nextSibling;
				if (n.nodeType === 1 ? t ? (n._stashedDisplay = n.style.display, n.style.display = "none") : (n.style.display = n._stashedDisplay || "", n.getAttribute("style") === "" && n.removeAttribute("style")) : n.nodeType === 3 && (t ? (n._stashedText = n.nodeValue, n.nodeValue = "") : n.nodeValue = n._stashedText || ""), r && r.nodeType === 8) {
					if (n = r.data, n === oT) {
						if (e === 0) break;
						e--;
					} else n !== aT && n !== sT && n !== cT && n !== lT || e++;
				}
				n = r;
			} while (n);
		}
		function gf(e) {
			hf(e, !0);
		}
		function _f(e) {
			e = e.style, typeof e.setProperty == "function" ? e.setProperty("display", "none", "important") : e.display = "none";
		}
		function vf(e) {
			e.nodeValue = "";
		}
		function yf(e) {
			hf(e, !1);
		}
		function bf(e, t) {
			t = t[gT], t = t != null && t.hasOwnProperty("display") ? t.display : null, e.style.display = t == null || typeof t == "boolean" ? "" : ("" + t).trim();
		}
		function xf(e, t) {
			e.nodeValue = t;
		}
		function Sf(e) {
			for (var t = e.firstChild; t != null;) {
				if (t.nodeType === 1 && getComputedStyle(t).display === "block") {
					T(pt(t) || pt(e), function(e, t) {
						console.error("You're about to start a <ViewTransition> around a display: inline element <%s>, which itself has a display: block element <%s> inside it. This might trigger a bug in Safari which causes the View Transition to be skipped with a duplicate name error.\nhttps://bugs.webkit.org/show_bug.cgi?id=290923", e.toLocaleLowerCase(), t.toLocaleLowerCase());
					}, e.tagName, t.tagName);
					break;
				}
				if (t.firstChild != null) t = t.firstChild;
				else {
					if (t === e) break;
					for (; t.nextSibling == null && t.parentNode != null && t.parentNode !== e;) t = t.parentNode;
					t = t.nextSibling;
				}
			}
		}
		function Cf(e, t, n) {
			if (t = CSS.escape(t) === t ? t : "r-" + btoa(t).replace(/=/g, ""), e.style.viewTransitionName = t, n != null && (e.style.viewTransitionClass = n), n = getComputedStyle(e), n.display === "inline") {
				if (t = e.getClientRects(), t.length === 1) var r = 1;
				else for (var i = r = 0; i < t.length; i++) {
					var a = t[i];
					0 < a.width && 0 < a.height && r++;
				}
				r === 1 ? (e = e.style, e.display = t.length === 1 ? "inline-block" : "block", e.marginTop = "-" + n.paddingTop, e.marginBottom = "-" + n.paddingBottom) : Sf(e);
			}
		}
		function wf(e, t) {
			e = e.style, t = t[gT];
			var n = t == null ? null : t.hasOwnProperty("viewTransitionName") ? t.viewTransitionName : t.hasOwnProperty("view-transition-name") ? t["view-transition-name"] : null;
			e.viewTransitionName = n == null || typeof n == "boolean" ? "" : ("" + n).trim(), n = t == null ? null : t.hasOwnProperty("viewTransitionClass") ? t.viewTransitionClass : t.hasOwnProperty("view-transition-class") ? t["view-transition-class"] : null, e.viewTransitionClass = n == null || typeof n == "boolean" ? "" : ("" + n).trim(), e.display === "inline-block" && (t == null ? e.display = e.margin = "" : (n = t.display, e.display = n == null || typeof n == "boolean" ? "" : n, n = t.margin, n == null ? (n = t.hasOwnProperty("marginTop") ? t.marginTop : t["margin-top"], e.marginTop = n == null || typeof n == "boolean" ? "" : n, t = t.hasOwnProperty("marginBottom") ? t.marginBottom : t["margin-bottom"], e.marginBottom = t == null || typeof t == "boolean" ? "" : t) : e.margin = n));
		}
		function Tf(e, t, n) {
			return n = n.ownerDocument.defaultView, {
				rect: e,
				abs: t.position === "absolute" || t.position === "fixed",
				clip: t.clipPath !== "none" || t.overflow !== "visible" || t.filter !== "none" || t.mask !== "none" || t.mask !== "none" || t.borderRadius !== "0px",
				view: 0 <= e.bottom && 0 <= e.right && e.top <= n.innerHeight && e.left <= n.innerWidth
			};
		}
		function Ef(e) {
			return Tf(e.getBoundingClientRect(), getComputedStyle(e), e);
		}
		function Df(e) {
			var t = e.getBoundingClientRect();
			t = new DOMRect(t.x + 2e4, t.y + 2e4, t.width, t.height);
			var n = getComputedStyle(e);
			return Tf(t, n, e);
		}
		function Of(e, t) {
			if (typeof e == "object" && e) switch (e.name) {
				case "TimeoutError": return Error("A ViewTransition timed out because a Navigation stalled. This can happen if a Navigation is blocked on React itself. Such as if it's resolved inside useEffect. This can be solved by moving the resolution to useLayoutEffect.", { cause: e });
				case "AbortError": return t ? null : Error("A ViewTransition was aborted early. This might be because you have other View Transition libraries on the page and only one can run at a time. To avoid this, use only React's built-in <ViewTransition> to coordinate.", { cause: e });
				case "InvalidStateError": if (e.message === "View transition was skipped because document visibility state is hidden." || e.message === "Skipping view transition because document visibility state has become hidden." || e.message === "Skipping view transition because viewport size changed." || e.message === "Transition was aborted because of invalid state") return null;
			}
			return e;
		}
		function kf(e) {
			return e.documentElement.clientHeight;
		}
		function Af(e) {
			this.addEventListener("load", e), this.addEventListener("error", e);
		}
		function jf(e, t, n, r, i, a, o, s, c, l, u) {
			var d = t.nodeType === 9 ? t : t.ownerDocument;
			try {
				var f = d.startViewTransition({
					update: function() {
						var t = d.defaultView, n = t.navigation && t.navigation.transition, o = d.fonts.status;
						r();
						var s = [];
						if (o === "loaded" && (kf(d), d.fonts.status === "loading" && s.push(d.fonts.ready)), o = s.length, e !== null) for (var c = e.suspenseyImages, u = 0, f = 0; f < c.length; f++) {
							var p = c[f];
							if (!p.complete) {
								var m = p.getBoundingClientRect();
								if (0 < m.bottom && 0 < m.right && m.top < t.innerHeight && m.left < t.innerWidth) {
									if (u += Rp(p), u > YT) {
										s.length = o;
										break;
									}
									p = new Promise(Af.bind(p)), s.push(p);
								}
							}
						}
						if (0 < s.length) return l(0 < o ? s.length > o ? "Waiting on Fonts and Images" : "Waiting on Fonts" : "Waiting on Images"), t = Promise.race([Promise.all(s), new Promise(function(e) {
							return setTimeout(e, MT);
						})]).then(i, i), (n ? Promise.allSettled([n.finished, t]) : t).then(a, a);
						if (i(), n) return n.finished.then(a, a);
						a();
					},
					types: n
				});
				d.__reactViewTransition = f;
				var p = [];
				return f.ready.then(function() {
					for (var e = d.documentElement.getAnimations({ subtree: !0 }), t = 0; t < e.length; t++) {
						var n = e[t], r = n.effect, i = r.pseudoElement;
						if (i != null && i.startsWith("::view-transition")) {
							p.push(n), n = r.getKeyframes();
							for (var a = i = void 0, s = !0, c = 0; c < n.length; c++) {
								var l = n[c], u = l.width;
								if (i === void 0) i = u;
								else if (i !== u) {
									s = !1;
									break;
								}
								if (u = l.height, a === void 0) a = u;
								else if (a !== u) {
									s = !1;
									break;
								}
								delete l.width, delete l.height, l.transform === "none" && delete l.transform;
							}
							s && i !== void 0 && a !== void 0 && (r.setKeyframes(n), s = getComputedStyle(r.target, r.pseudoElement), s.width !== i || s.height !== a) && (s = n[0], s.width = i, s.height = a, s = n[n.length - 1], s.width = i, s.height = a, r.setKeyframes(n));
						}
					}
					o();
				}, function(e) {
					d.__reactViewTransition === f && (d.__reactViewTransition = null);
					try {
						e = Of(e, !1), e !== null && c(e);
					} finally {
						r(), i(), o(), u();
					}
				}), f.finished.finally(function() {
					for (var e = 0; e < p.length; e++) p[e].cancel();
					d.__reactViewTransition === f && (d.__reactViewTransition = null), u(), s();
				}), f;
			} catch {
				return r(), i(), u(), o(), null;
			}
		}
		function Mf(e, t) {
			this._scope = document.documentElement, this._selector = "::view-transition-" + e + "(" + t + ")";
		}
		function Nf(e) {
			return {
				name: e,
				group: new Mf("group", e),
				imagePair: new Mf("image-pair", e),
				old: new Mf("old", e),
				new: new Mf("new", e)
			};
		}
		function Pf(e) {
			this._fragmentFiber = e, this._observers = this._eventListeners = null;
		}
		function Ff(e, t, n, r) {
			return ue(e).addEventListener(t, n, r), !1;
		}
		function If(e, t, n, r) {
			return ue(e).removeEventListener(t, n, r), !1;
		}
		function Lf(e) {
			return e != null && typeof e != "boolean" && (!0 === e.once || e.signal instanceof AbortSignal) ? {
				capture: e.capture,
				passive: e.passive
			} : e;
		}
		function Rf(e) {
			return e == null ? "c=0" : typeof e == "boolean" ? "c=" + (e ? "1" : "0") : "c=" + (e.capture ? "1" : "0");
		}
		function zf(e, t, n, r) {
			if (e.length === 0) return -1;
			r = Rf(r);
			for (var i = 0; i < e.length; i++) {
				var a = e[i];
				if (a.type === t && a.listener === n && Rf(a.optionsOrUseCapture) === r) return i;
			}
			return -1;
		}
		function Bf(e, t) {
			return e.tag !== 6 && (e = ue(e), pp(e, t));
		}
		function Vf(e, t) {
			return t.push(e), !1;
		}
		function Hf(e, t) {
			return e.tag !== 6 && (e = ue(e), e === t || e.contains(t) ? (t.blur(), !0) : !1);
		}
		function Uf(e, t) {
			return e.tag !== 6 && (e = ue(e), t.observe(e), !1);
		}
		function Wf(e, t) {
			return e.tag !== 6 && (e = ue(e), t.unobserve(e), !1);
		}
		function Gf(e, t, n) {
			NT.push({
				fragmentInstance: e,
				observer: t,
				instance: n
			}), PT || (PT = !0, mp(function() {
				PT = !1;
				var e = NT;
				NT = [];
				for (var t = 0; t < e.length; t++) {
					var n = e[t];
					n.observer.unobserve(n.instance);
				}
			}));
		}
		function Kf(e, t) {
			if (e.tag === 6) {
				e = e.stateNode;
				var n = e.ownerDocument.createRange();
				n.selectNodeContents(e), t.push.apply(t, n.getClientRects());
			} else e = ue(e), t.push.apply(t, e.getClientRects());
			return !1;
		}
		function qf(e, t, n, r, i) {
			var a = ft(i);
			if (e & Node.DOCUMENT_POSITION_CONTAINED_BY) {
				if (n = !!a) a: {
					for (; a !== null;) {
						if (a.tag === 7 && (a === t || a.alternate === t)) {
							n = !0;
							break a;
						}
						a = a.return;
					}
					n = !1;
				}
				return n;
			}
			if (e & Node.DOCUMENT_POSITION_CONTAINS) {
				if (a === null) return a = i.ownerDocument, i === a || i === a.documentElement || i === a.body;
				a: {
					for (a = t, t = S(t); a !== null;) {
						if (!(a.tag !== 5 && a.tag !== 3 && a.tag !== 27 || a !== t && a.alternate !== t)) {
							a = !0;
							break a;
						}
						a = a.return;
					}
					a = !1;
				}
				return a;
			}
			return e & Node.DOCUMENT_POSITION_PRECEDING ? ((t = !!a) && !(t = a === n) && (t = me(n, a, pe), t === null ? t = !1 : (oe(t, !0, de, a, n), a = Tm, Tm = null, t = a !== null)), t) : e & Node.DOCUMENT_POSITION_FOLLOWING ? ((t = !!a) && !(t = a === r) && (t = me(r, a, pe), t === null ? t = !1 : (oe(t, !0, fe, a, r), a = Tm, Em = Tm = null, t = a !== null)), t) : !1;
		}
		function Jf(e, t) {
			var n = e.ownerDocument.createRange();
			n.selectNodeContents(e), e = n.getBoundingClientRect(), window.scrollTo(window.scrollX + e.left, t ? window.scrollY + e.top : window.scrollY + e.bottom - window.innerHeight);
		}
		function Yf(e, t) {
			return e = ue(e), Xf(e, t), !1;
		}
		function Xf(e, t) {
			e.reactFragments ??= /* @__PURE__ */ new Set(), e.reactFragments.add(t);
		}
		function Zf(e, t) {
			var n = t._eventListeners;
			if (n !== null) for (var r = 0; r < n.length; r++) {
				var i = n[r];
				e.addEventListener(i.type, i.attachedListener, Lf(i.optionsOrUseCapture));
			}
			e.nodeType !== 3 && (n = t._observers, n !== null && n.forEach(function(n) {
				for (var r = 0, i = 0; i < NT.length; i++) {
					var a = NT[i];
					(a.fragmentInstance !== t || a.observer !== n || a.instance !== e) && (NT[r++] = a);
				}
				NT.length = r, n.observe(e);
			}), Xf(e, t));
		}
		function Qf(e, t) {
			var n = t._eventListeners;
			if (n !== null) for (var r = 0; r < n.length; r++) {
				var i = n[r];
				e.removeEventListener(i.type, i.attachedListener, Lf(i.optionsOrUseCapture));
			}
			e.nodeType !== 3 && (n = t._observers, n !== null && n.forEach(function(n) {
				typeof n.rootMargin == "string" ? Gf(t, n, e) : n.unobserve(e);
			}), e.reactFragments != null && e.reactFragments.delete(t));
		}
		function $f(e) {
			var t = e.firstChild;
			for (t && t.nodeType === 10 && (t = t.nextSibling); t;) {
				var n = t;
				switch (t = t.nextSibling, n.nodeName) {
					case "HTML":
					case "HEAD":
					case "BODY":
						$f(n), dt(n);
						continue;
					case "SCRIPT":
					case "STYLE": continue;
					case "LINK": if (n.rel.toLowerCase() === "stylesheet") continue;
				}
				e.removeChild(n);
			}
		}
		function ep(e, t, n, r) {
			for (; e.nodeType === 1;) {
				var i = n;
				if (e.nodeName.toLowerCase() !== t.toLowerCase()) {
					if (!r && (e.nodeName !== "INPUT" || e.type !== "hidden")) break;
				} else if (!r) {
					if (t === "input" && e.type === "hidden") {
						Ve(i.name, "name");
						var a = i.name == null ? null : "" + i.name;
						if (i.type === "hidden" && e.getAttribute("name") === a) return e;
					} else return e;
				} else if (!e[Qh]) switch (t) {
					case "meta":
						if (!e.hasAttribute("itemprop")) break;
						return e;
					case "link":
						if (a = e.getAttribute("rel"), a === "stylesheet" && e.hasAttribute("data-precedence") || a !== i.rel || e.getAttribute("href") !== (i.href == null || i.href === "" ? null : i.href) || e.getAttribute("crossorigin") !== (i.crossOrigin == null ? null : i.crossOrigin) || e.getAttribute("title") !== (i.title == null ? null : i.title)) break;
						return e;
					case "style":
						if (e.hasAttribute("data-precedence")) break;
						return e;
					case "script":
						if (a = e.getAttribute("src"), (a !== (i.src == null ? null : i.src) || e.getAttribute("type") !== (i.type == null ? null : i.type) || e.getAttribute("crossorigin") !== (i.crossOrigin == null ? null : i.crossOrigin)) && a && e.hasAttribute("async") && !e.hasAttribute("itemprop")) break;
						return e;
					default: return e;
				}
				if (e = ap(e.nextSibling), e === null) break;
			}
			return null;
		}
		function tp(e, t, n) {
			if (t === "") return null;
			for (; e.nodeType !== 3;) if ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") && !n || (e = ap(e.nextSibling), e === null)) return null;
			return e;
		}
		function np(e, t) {
			for (; e.nodeType !== 8;) if ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") && !t || (e = ap(e.nextSibling), e === null)) return null;
			return e;
		}
		function L(e) {
			return e.data === sT || e.data === cT;
		}
		function rp(e) {
			return e.data === lT || e.data === sT && e.ownerDocument.readyState !== hT;
		}
		function ip(e, t) {
			var n = e.ownerDocument;
			if (e.data === cT) e._reactRetry = t;
			else if (e.data !== sT || n.readyState !== hT) t();
			else {
				var r = function() {
					t(), n.removeEventListener("DOMContentLoaded", r);
				};
				n.addEventListener("DOMContentLoaded", r), e._reactRetry = r;
			}
		}
		function ap(e) {
			for (; e != null; e = e.nextSibling) {
				var t = e.nodeType;
				if (t === 1 || t === 3) break;
				if (t === 8) {
					if (t = e.data, t === aT || t === lT || t === sT || t === cT || t === rT || t === pT || t === mT) break;
					if (t === oT || t === iT) return null;
				}
			}
			return e;
		}
		function op(e) {
			if (e.nodeType === 1) {
				for (var t = e.nodeName.toLowerCase(), n = {}, r = e.attributes, i = 0; i < r.length; i++) {
					var a = r[i];
					n[Id(a.name)] = a.name.toLowerCase() === "style" ? Ld(e) : a.value;
				}
				return {
					type: t,
					props: n
				};
			}
			return e.nodeType === 8 ? e.data === rT ? {
				type: "Activity",
				props: {}
			} : {
				type: "Suspense",
				props: {}
			} : e.nodeValue;
		}
		function sp(e, t, n) {
			return n === null || !0 !== n[nT] ? (e.nodeValue === t ? e = null : (t = jd(t), e = jd(e.nodeValue) === t ? null : e.nodeValue), e) : null;
		}
		function cp(e) {
			e = e.nextSibling;
			for (var t = 0; e;) {
				if (e.nodeType === 8) {
					var n = e.data;
					if (n === oT || n === iT) {
						if (t === 0) return ap(e.nextSibling);
						t--;
					} else n !== aT && n !== lT && n !== sT && n !== cT && n !== rT || t++;
				}
				e = e.nextSibling;
			}
			return null;
		}
		function lp(e) {
			e = e.previousSibling;
			for (var t = 0; e;) {
				if (e.nodeType === 8) {
					var n = e.data;
					if (n === aT || n === lT || n === sT || n === cT || n === rT) {
						if (t === 0) return e;
						t--;
					} else n !== oT && n !== iT || t++;
				}
				e = e.previousSibling;
			}
			return null;
		}
		function up(e) {
			_m(e);
		}
		function dp(e) {
			_m(e);
		}
		function fp(e) {
			_m(e);
		}
		function pp(e, t) {
			function n() {
				r = !0;
			}
			if (e.ownerDocument.activeElement === e) return !0;
			var r = !1;
			try {
				e.ownerDocument.addEventListener("focus", n, !0), (e.focus || HTMLElement.prototype.focus).call(e, t);
			} finally {
				e.ownerDocument.removeEventListener("focus", n, !0);
			}
			return r;
		}
		function mp(e) {
			AT(function() {
				AT(function(t) {
					return e(t);
				});
			});
		}
		function hp(e, t, n, r, i) {
			switch (i && dn(e, r.ancestorInfo), t = Jd(n), e) {
				case "html":
					if (e = t.documentElement, !e) throw Error("React expected an <html> element (document.documentElement) to exist in the Document but one was not found. React never removes the documentElement for any Document it renders into so the cause is likely in some other script running on this page.");
					return e;
				case "head":
					if (e = t.head, !e) throw Error("React expected a <head> element (document.head) to exist in the Document but one was not found. React never removes the head for any Document it renders into so the cause is likely in some other script running on this page.");
					return e;
				case "body":
					if (e = t.body, !e) throw Error("React expected a <body> element (document.body) to exist in the Document but one was not found. React never removes the body for any Document it renders into so the cause is likely in some other script running on this page.");
					return e;
				default: throw Error("resolveSingletonInstance was called with an element type that is not supported. This is a bug in React.");
			}
		}
		function gp(e, t, n, r) {
			if (!n[qh] && pt(n)) {
				var i = n.tagName.toLowerCase();
				console.error("You are mounting a new %s component when a previous one has not first unmounted. It is an error to render more than one %s component at a time and attributes and children of these components will likely fail in unpredictable ways. Please only render a single instance of <%s> and if you need to mount a new one, ensure any previous ones have unmounted first.", i, i, i);
			}
			switch (e) {
				case "html":
				case "head":
				case "body": break;
				default: console.error("acquireSingletonInstance was called with an element type that is not supported. This is a bug in React.");
			}
			for (i = n.attributes; i.length;) n.removeAttributeNode(i[0]);
			Pd(n, e, t), n[Gh] = r, n[Kh] = t;
		}
		function _p(e, t, n) {
			for (var r in n) {
				var i = n[r];
				n.hasOwnProperty(r) && i != null && I(e, t, r, null, eT, i);
			}
			n.dangerouslySetInnerHTML != null && (e.textContent = ""), e.onclick === wn && (e.onclick = null), dt(e);
		}
		function vp(e) {
			for (var t = e.attributes; t.length;) e.removeAttributeNode(t[0]);
			dt(e);
		}
		function yp(e) {
			if (typeof e.getRootNode == "function") {
				var t = e.getRootNode();
				if (t.nodeType === 9 || t.nodeType === 11) return t;
			}
			return e.nodeType === 9 ? e : e.ownerDocument;
		}
		function bp(e, t, n) {
			var r = WT;
			if (r && typeof t == "string" && t) {
				var i = Mt(t);
				i = "link[rel=\"" + e + "\"][href=\"" + i + "\"]", typeof n == "string" && (i += "[crossorigin=\"" + n + "\"]"), HT.has(i) || (HT.add(i), e = {
					rel: e,
					crossOrigin: n,
					href: t
				}, r.querySelector(i) === null && (t = r.createElement("link"), Pd(t, "link", e), gt(t), r.head.appendChild(t)));
			}
		}
		function xp(e, t, n, r) {
			var i = (i = eh.current) ? yp(i) : null;
			if (!i) throw Error("\"resourceRoot\" was expected to exist. This is a bug in React.");
			switch (e) {
				case "meta":
				case "title": return null;
				case "style": return typeof n.precedence == "string" && typeof n.href == "string" ? (n = Cp(n.href), t = ht(i).hoistableStyles, r = t.get(n), r || (r = {
					type: "style",
					instance: null,
					count: 0,
					state: null
				}, t.set(n, r)), r) : {
					type: "void",
					instance: null,
					count: 0,
					state: null
				};
				case "link":
					if (n.rel === "stylesheet" && typeof n.href == "string" && typeof n.precedence == "string") {
						e = Cp(n.href);
						var a = ht(i).hoistableStyles, o = a.get(e);
						if (o || (i = i.ownerDocument || i, o = {
							type: "stylesheet",
							instance: null,
							count: 0,
							state: {
								loading: IT,
								preload: null
							}
						}, a.set(e, o), (a = i.querySelector(wp(e))) ? a._p || (o.instance = a, o.state.loading = LT | BT) : (a = VT.get(e), a || (a = {
							rel: "preload",
							as: "style",
							href: n.href,
							crossOrigin: n.crossOrigin,
							integrity: n.integrity,
							media: n.media,
							hrefLang: n.hrefLang,
							referrerPolicy: n.referrerPolicy
						}, VT.set(e, a)), Ep(i, e, a, o.state))), t && r === null) throw n = "\n\n  - " + Sp(t) + "\n  + " + Sp(n), Error("Expected <link> not to update to be updated to a stylesheet with precedence. Check the `rel`, `href`, and `precedence` props of this component. Alternatively, check whether two different <link> components render in the same slot or share the same key." + n);
						return o;
					}
					if (t && r !== null) throw n = "\n\n  - " + Sp(t) + "\n  + " + Sp(n), Error("Expected stylesheet with precedence to not be updated to a different kind of <link>. Check the `rel`, `href`, and `precedence` props of this component. Alternatively, check whether two different <link> components render in the same slot or share the same key." + n);
					return null;
				case "script": return t = n.async, n = n.src, typeof n == "string" && t && typeof t != "function" && typeof t != "symbol" ? (n = Dp(n), t = ht(i).hoistableScripts, r = t.get(n), r || (r = {
					type: "script",
					instance: null,
					count: 0,
					state: null
				}, t.set(n, r)), r) : {
					type: "void",
					instance: null,
					count: 0,
					state: null
				};
				default: throw Error("getResource encountered a type it did not expect: \"" + e + "\". this is a bug in React.");
			}
		}
		function Sp(e) {
			var t = 0, n = "<link";
			return typeof e.rel == "string" ? (t++, n += " rel=\"" + e.rel + "\"") : gh.call(e, "rel") && (t++, n += " rel=\"" + (e.rel === null ? "null" : "invalid type " + typeof e.rel) + "\""), typeof e.href == "string" ? (t++, n += " href=\"" + e.href + "\"") : gh.call(e, "href") && (t++, n += " href=\"" + (e.href === null ? "null" : "invalid type " + typeof e.href) + "\""), typeof e.precedence == "string" ? (t++, n += " precedence=\"" + e.precedence + "\"") : gh.call(e, "precedence") && (t++, n += " precedence={" + (e.precedence === null ? "null" : "invalid type " + typeof e.precedence) + "}"), Object.getOwnPropertyNames(e).length > t && (n += " ..."), n + " />";
		}
		function Cp(e) {
			return "href=\"" + Mt(e) + "\"";
		}
		function wp(e) {
			return "link[rel=\"stylesheet\"][" + e + "]";
		}
		function Tp(e) {
			return R({}, e, {
				"data-precedence": e.precedence,
				precedence: null
			});
		}
		function Ep(e, t, n, r) {
			if (t = e.querySelector("link[rel=\"preload\"][as=\"style\"][" + t + "]")) {
				if (!0 !== t[$h]) {
					r.loading = LT;
					return;
				}
			} else t = e.createElement("link"), t[$h] = !0, t.onload = t.onerror = _t.bind(null, t), Pd(t, "link", n), gt(t), e.head.appendChild(t);
			r.preload = t, t.addEventListener("load", function() {
				return r.loading |= LT;
			}), t.addEventListener("error", function() {
				return r.loading |= RT;
			});
		}
		function Dp(e) {
			return "[src=\"" + Mt(e) + "\"]";
		}
		function Op(e) {
			return "script[async]" + e;
		}
		function kp(e, t, n) {
			if (t.count++, t.instance === null) switch (t.type) {
				case "style":
					var r = e.querySelector("style[data-href~=\"" + Mt(n.href) + "\"]");
					if (r) return t.instance = r, gt(r), r;
					var i = R({}, n, {
						"data-href": n.href,
						"data-precedence": n.precedence,
						href: null,
						precedence: null
					});
					return r = (e.ownerDocument || e).createElement("style"), gt(r), Pd(r, "style", i), Ap(r, n.precedence, e), t.instance = r;
				case "stylesheet":
					i = Cp(n.href);
					var a = e.querySelector(wp(i));
					if (a) return t.state.loading |= BT, t.instance = a, gt(a), a;
					r = Tp(n), (i = VT.get(i)) && jp(r, i), a = (e.ownerDocument || e).createElement("link"), gt(a);
					var o = a;
					return o._p = new Promise(function(e, t) {
						o.onload = e, o.onerror = t;
					}), Pd(a, "link", r), t.state.loading |= BT, Ap(a, n.precedence, e), t.instance = a;
				case "script": return a = Dp(n.src), (i = e.querySelector(Op(a))) ? (t.instance = i, gt(i), i) : (r = n, (i = VT.get(a)) && (r = R({}, n), Mp(r, i)), e = e.ownerDocument || e, i = e.createElement("script"), gt(i), Pd(i, "link", r), e.head.appendChild(i), t.instance = i);
				case "void": return null;
				default: throw Error("acquireResource encountered a resource type it did not expect: \"" + t.type + "\". this is a bug in React.");
			}
			else t.type === "stylesheet" && (t.state.loading & BT) === IT && (r = t.instance, t.state.loading |= BT, Ap(r, n.precedence, e));
			return t.instance;
		}
		function Ap(e, t, n) {
			for (var r = n.querySelectorAll("link[rel=\"stylesheet\"][data-precedence],style[data-precedence]"), i = r.length ? r[r.length - 1] : null, a = i, o = 0; o < r.length; o++) {
				var s = r[o];
				if (s.dataset.precedence === t) a = s;
				else if (a !== i) break;
			}
			a ? a.parentNode.insertBefore(e, a.nextSibling) : (t = n.nodeType === 9 ? n.head : n, t.insertBefore(e, t.firstChild));
		}
		function jp(e, t) {
			e.crossOrigin ??= t.crossOrigin, e.referrerPolicy ??= t.referrerPolicy, e.title ??= t.title;
		}
		function Mp(e, t) {
			e.crossOrigin ??= t.crossOrigin, e.referrerPolicy ??= t.referrerPolicy, e.integrity ??= t.integrity;
		}
		function Np(e, t, n) {
			if (GT === null) {
				var r = /* @__PURE__ */ new Map(), i = GT = /* @__PURE__ */ new Map();
				i.set(n, r);
			} else i = GT, r = i.get(n), r || (r = /* @__PURE__ */ new Map(), i.set(n, r));
			if (r.has(e)) return r;
			for (r.set(e, null), n = n.getElementsByTagName(e), i = 0; i < n.length; i++) {
				var a = n[i];
				if (!(a[Qh] || a[Gh] || e === "link" && a.getAttribute("rel") === "stylesheet") && a.namespaceURI !== Ig) {
					var o = a.getAttribute(t) || "";
					o = e + o;
					var s = r.get(o);
					s ? s.push(a) : r.set(o, [a]);
				}
			}
			return r;
		}
		function Pp(e, t, n) {
			e = e.ownerDocument || e, e.head.insertBefore(n, t === "title" ? e.querySelector("head > title") : null);
		}
		function Fp(e, t, n) {
			var r = !n.ancestorInfo.containerTagInScope;
			if (n.context === vT || t.itemProp != null) return !r || t.itemProp == null || e !== "meta" && e !== "title" && e !== "style" && e !== "link" && e !== "script" || console.error("Cannot render a <%s> outside the main document if it has an `itemProp` prop. `itemProp` suggests the tag belongs to an `itemScope` which can appear anywhere in the DOM. If you were intending for React to hoist this <%s> remove the `itemProp` prop. Otherwise, try moving this tag into the <head> or <body> of the Document.", e, e), !1;
			switch (e) {
				case "meta":
				case "title": return !0;
				case "style":
					if (typeof t.precedence != "string" || typeof t.href != "string" || t.href === "") {
						r && console.error("Cannot render a <style> outside the main document without knowing its precedence and a unique href key. React can hoist and deduplicate <style> tags if you provide a `precedence` prop along with an `href` prop that does not conflict with the `href` values used in any other hoisted <style> or <link rel=\"stylesheet\" ...> tags.  Note that hoisting <style> tags is considered an advanced feature that most will not use directly. Consider moving the <style> tag to the <head> or consider adding a `precedence=\"default\"` and `href=\"some unique resource identifier\"`.");
						break;
					}
					return !0;
				case "link":
					if (typeof t.rel != "string" || typeof t.href != "string" || t.href === "" || t.onLoad || t.onError) {
						if (t.rel === "stylesheet" && typeof t.precedence == "string") {
							e = t.href;
							var i = t.onError, a = t.disabled;
							n = [], t.onLoad && n.push("`onLoad`"), i && n.push("`onError`"), a != null && n.push("`disabled`"), i = Gd(n, "and"), i += n.length === 1 ? " prop" : " props", a = n.length === 1 ? "an " + i : "the " + i, n.length && console.error("React encountered a <link rel=\"stylesheet\" href=\"%s\" ... /> with a `precedence` prop that also included %s. The presence of loading and error handlers indicates an intent to manage the stylesheet loading state from your from your Component code and React will not hoist or deduplicate this stylesheet. If your intent was to have React hoist and deduplciate this stylesheet using the `precedence` prop remove the %s, otherwise remove the `precedence` prop.", e, a, i);
						}
						r && (typeof t.rel != "string" || typeof t.href != "string" || t.href === "" ? console.error("Cannot render a <link> outside the main document without a `rel` and `href` prop. Try adding a `rel` and/or `href` prop to this <link> or moving the link into the <head> tag") : (t.onError || t.onLoad) && console.error("Cannot render a <link> with onLoad or onError listeners outside the main document. Try removing onLoad={...} and onError={...} or moving it into the root <head> tag or somewhere in the <body>."));
						break;
					}
					switch (t.rel) {
						case "stylesheet": return e = t.precedence, t = t.disabled, typeof e != "string" && r && console.error("Cannot render a <link rel=\"stylesheet\" /> outside the main document without knowing its precedence. Consider adding precedence=\"default\" or moving it into the root <head> tag."), typeof e == "string" && t == null;
						default: return !0;
					}
				case "script":
					if (e = t.async && typeof t.async != "function" && typeof t.async != "symbol", !e || t.onLoad || t.onError || !t.src || typeof t.src != "string") {
						r && (e ? t.onLoad || t.onError ? console.error("Cannot render a <script> with onLoad or onError listeners outside the main document. Try removing onLoad={...} and onError={...} or moving it into the root <head> tag or somewhere in the <body>.") : console.error("Cannot render a <script> outside the main document without `async={true}` and a non-empty `src` prop. Ensure there is a valid `src` and either make the script async or move it into the root <head> tag or somewhere in the <body>.") : console.error("Cannot render a sync or defer <script> outside the main document without knowing its order. Try adding async=\"\" or moving it into the root <head> tag."));
						break;
					}
					return !0;
				case "noscript":
				case "template": r && console.error("Cannot render <%s> outside the main document. Try moving it into the root <head> tag.", e);
			}
			return !1;
		}
		function Ip(e, t) {
			return e === "img" && t.src != null && t.src !== "" && t.onLoad == null && t.loading !== "lazy";
		}
		function Lp(e) {
			return e.type !== "stylesheet" || (e.state.loading & zT) !== IT;
		}
		function Rp(e) {
			return (e.width || 100) * (e.height || 100) * (typeof devicePixelRatio == "number" ? devicePixelRatio : 1) * .25;
		}
		function zp(e, t) {
			typeof t.decode == "function" && (e.imgCount++, t.complete || (e.imgBytes += Rp(t), e.suspenseyImages.push(t)), e = Wp.bind(e), t.decode().then(e, e));
		}
		function Bp(e, t, n, r) {
			if (n.type === "stylesheet" && (typeof r.media != "string" || !1 !== matchMedia(r.media).matches) && (n.state.loading & BT) === IT) {
				if (n.instance === null) {
					var i = Cp(r.href), a = t.querySelector(wp(i));
					if (a) {
						t = a._p, typeof t == "object" && t && typeof t.then == "function" && (e.count++, e = Up.bind(e), t.then(e, e)), n.state.loading |= BT, n.instance = a, gt(a);
						return;
					}
					a = t.ownerDocument || t, r = Tp(r), (i = VT.get(i)) && jp(r, i), a = a.createElement("link"), gt(a);
					var o = a;
					o._p = new Promise(function(e, t) {
						o.onload = e, o.onerror = t;
					}), Pd(a, "link", r), n.instance = a;
				}
				e.stylesheets === null && (e.stylesheets = /* @__PURE__ */ new Map()), e.stylesheets.set(n, t), (t = n.state.preload) && (n.state.loading & zT) === IT && (e.count++, n = Up.bind(e), t.addEventListener("load", n), t.addEventListener("error", n));
			}
		}
		function Vp(e, t) {
			return e.stylesheets && e.count === 0 && Gp(e, e.stylesheets), 0 < e.count || 0 < e.imgCount ? function(n) {
				var r = setTimeout(function() {
					if (e.stylesheets && Gp(e, e.stylesheets), e.unsuspend) {
						var t = e.unsuspend;
						e.unsuspend = null, t();
					}
				}, KT + t);
				0 < e.imgBytes && YT === 0 && (YT = 125 * qd() * JT);
				var i = setTimeout(function() {
					if (e.waitingForImages = !1, e.count === 0 && (e.stylesheets && Gp(e, e.stylesheets), e.unsuspend)) {
						var t = e.unsuspend;
						e.unsuspend = null, t();
					}
				}, (e.imgBytes > YT ? 50 : qT) + t);
				return e.unsuspend = n, function() {
					e.unsuspend = null, clearTimeout(r), clearTimeout(i);
				};
			} : null;
		}
		function Hp(e) {
			if (e.count === 0 && (e.imgCount === 0 || !e.waitingForImages)) {
				if (e.stylesheets) Gp(e, e.stylesheets);
				else if (e.unsuspend) {
					var t = e.unsuspend;
					e.unsuspend = null, t();
				}
			}
		}
		function Up() {
			this.count--, Hp(this);
		}
		function Wp() {
			this.imgCount--, Hp(this);
		}
		function Gp(e, t) {
			e.stylesheets = null, e.unsuspend !== null && (e.count++, ZT = /* @__PURE__ */ new Map(), t.forEach(Kp, e), ZT = null, Up.call(e));
		}
		function Kp(e, t) {
			if (!(t.state.loading & BT)) {
				var n = ZT.get(e);
				if (n) var r = n.get(XT);
				else {
					n = /* @__PURE__ */ new Map(), ZT.set(e, n);
					for (var i = e.querySelectorAll("link[data-precedence],style[data-precedence]"), a = 0; a < i.length; a++) {
						var o = i[a];
						(o.nodeName === "LINK" || o.getAttribute("media") !== "not all") && (n.set(o.dataset.precedence, o), r = o);
					}
					r && n.set(XT, r);
				}
				i = t.instance, o = i.getAttribute("data-precedence"), a = n.get(o) || r, a === r && n.set(XT, i), n.set(o, i), this.count++, r = Up.bind(this), i.addEventListener("load", r), i.addEventListener("error", r), a ? a.parentNode.insertBefore(i, a.nextSibling) : (e = e.nodeType === 9 ? e.head : e, e.insertBefore(i, e.firstChild)), t.state.loading |= BT;
			}
		}
		function qp(e, t, n, r, i, a, o, s, c) {
			for (this.tag = 1, this.containerInfo = e, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = OT, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = $e(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = $e(0), this.hiddenUpdates = $e(null), this.identifierPrefix = r, this.onUncaughtError = i, this.onCaughtError = a, this.onRecoverableError = o, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = c, this.transitionTypes = null, this.incompleteTransitions = /* @__PURE__ */ new Map(), this.passiveEffectDuration = this.effectDuration = -0, this.memoizedUpdaters = /* @__PURE__ */ new Set(), e = this.pendingUpdatersLaneMap = [], t = 0; 31 > t; t++) e.push(/* @__PURE__ */ new Set());
			this._debugRootType = n ? "hydrateRoot()" : "createRoot()";
		}
		function Jp(e, t, n, r, i, a, o, s, c, l, u, d) {
			return e = new qp(e, t, n, o, c, l, u, d, s), t = Bv, !0 === a && (t |= Vv | Hv), t |= G, a = g(3, null, null, t), e.current = a, a.stateNode = e, t = Di(), Oi(t), e.pooledCache = t, Oi(t), a.memoizedState = {
				element: r,
				isDehydrated: n,
				cache: t
			}, Sa(a), e;
		}
		function Yp(e) {
			return e ? (e = Lv, e) : Lv;
		}
		function Xp(e, t, n, r, i, a) {
			if (jh && typeof jh.onScheduleFiberRoot == "function") try {
				jh.onScheduleFiberRoot(Ah, r, n);
			} catch (e) {
				Mh || (Mh = !0, console.error("React instrumentation encountered an error: %o", e));
			}
			i = Yp(i), r.context === null ? r.context = i : r.pendingContext = i, hh && mh !== null && !aE && (aE = !0, console.error("Render methods should be a pure function of props and state; triggering nested component updates from render is not allowed. If necessary, trigger nested updates in componentDidUpdate.\n\nCheck the render method of %s.", C(mh) || "Unknown")), r = wa(t), r.payload = { element: n }, a = a === void 0 ? null : a, a !== null && (typeof a != "function" && console.error("Expected the last optional `callback` argument to be a function. Instead received: %s.", a), r.callback = a), n = Ta(e, r, t), n !== null && (Mi(t, "root.render()", null), ou(n, e, t), Ea(n, e, t));
		}
		function Zp(e, t) {
			if (e = e.memoizedState, e !== null && e.dehydrated !== null) {
				var n = e.retryLane;
				e.retryLane = n !== 0 && n < t ? n : t;
			}
		}
		function Qp(e, t) {
			Zp(e, t), (e = e.alternate) && Zp(e, t);
		}
		function $p(e) {
			if (e.tag === 13 || e.tag === 31) {
				var t = Pr(e, 67108864);
				t !== null && ou(t, e, 67108864), Qp(e, 67108864);
			}
		}
		function em(e) {
			if (e.tag === 13 || e.tag === 31) {
				var t = ru(e);
				t = at(t);
				var n = Pr(e, t);
				n !== null && ou(n, e, t), Qp(e, t);
			}
		}
		function tm() {
			return mh;
		}
		function nm(e, t, n, r) {
			var i = z.T;
			z.T = null;
			var a = B.p;
			try {
				B.p = Bh, im(e, t, n, r);
			} finally {
				B.p = a, z.T = i;
			}
		}
		function rm(e, t, n, r) {
			var i = z.T;
			z.T = null;
			var a = B.p;
			try {
				B.p = Vh, im(e, t, n, r);
			} finally {
				B.p = a, z.T = i;
			}
		}
		function im(e, t, n, r) {
			if (gE) {
				var i = am(r);
				if (i === null) yd(e, t, r, _E, n), cm(e, r);
				else if (um(i, e, t, n, r)) r.stopPropagation();
				else if (cm(e, r), t & 4 && -1 < TE.indexOf(e)) {
					for (; i !== null;) {
						var a = pt(i);
						if (a !== null) switch (a.tag) {
							case 3:
								if (a = a.stateNode, a.current.memoizedState.isDehydrated) {
									var o = qe(a.pendingLanes);
									if (o !== 0) {
										var s = a;
										for (s.pendingLanes |= 2, s.entangledLanes |= 2; o;) {
											var c = 1 << 31 - Ph(o);
											s.entanglements[1] |= c, o &= ~c;
										}
										id(a), (fC & (rC | iC)) === nC && (HC = xh() + UC, ad(0, !1));
									}
								}
								break;
							case 31:
							case 13: s = Pr(a, 2), s !== null && ou(s, a, 2), du(), Qp(a, 2);
						}
						if (a = am(r), a === null && yd(e, t, r, _E, n), a === i) break;
						i = a;
					}
					i !== null && r.stopPropagation();
				} else yd(e, t, r, null, n);
			}
		}
		function am(e) {
			return e = Tn(e), om(e);
		}
		function om(e) {
			if (_E = null, e = ft(e), e !== null) {
				var t = ee(e);
				if (t === null) e = null;
				else {
					var n = t.tag;
					if (n === 13) {
						if (e = te(t), e !== null) return e;
						e = null;
					} else if (n === 31) {
						if (e = ne(t), e !== null) return e;
						e = null;
					} else if (n === 3) {
						if (t.stateNode.current.memoizedState.isDehydrated) return t.tag === 3 ? t.stateNode.containerInfo : null;
						e = null;
					} else t !== e && (e = null);
				}
			}
			return _E = e, null;
		}
		function sm(e) {
			switch (e) {
				case "beforetoggle":
				case "cancel":
				case "click":
				case "close":
				case "contextmenu":
				case "copy":
				case "cut":
				case "auxclick":
				case "dblclick":
				case "dragend":
				case "dragstart":
				case "drop":
				case "focusin":
				case "focusout":
				case "input":
				case "invalid":
				case "keydown":
				case "keypress":
				case "keyup":
				case "mousedown":
				case "mouseup":
				case "paste":
				case "pause":
				case "play":
				case "pointercancel":
				case "pointerdown":
				case "pointerup":
				case "ratechange":
				case "reset":
				case "seeked":
				case "submit":
				case "toggle":
				case "touchcancel":
				case "touchend":
				case "touchstart":
				case "volumechange":
				case "change":
				case "selectionchange":
				case "textInput":
				case "compositionstart":
				case "compositionend":
				case "compositionupdate":
				case "beforeblur":
				case "afterblur":
				case "beforeinput":
				case "blur":
				case "fullscreenchange":
				case "fullscreenerror":
				case "focus":
				case "hashchange":
				case "popstate":
				case "select":
				case "selectstart": return Bh;
				case "drag":
				case "dragenter":
				case "dragexit":
				case "dragleave":
				case "dragover":
				case "mousemove":
				case "mouseout":
				case "mouseover":
				case "pointermove":
				case "pointerout":
				case "pointerover":
				case "resize":
				case "scroll":
				case "touchmove":
				case "wheel":
				case "mouseenter":
				case "mouseleave":
				case "pointerenter":
				case "pointerleave": return Vh;
				case "message": switch (Sh()) {
					case Ch: return Bh;
					case wh: return Vh;
					case Th:
					case Eh: return Hh;
					case Dh: return Uh;
					default: return Hh;
				}
				default: return Hh;
			}
		}
		function cm(e, t) {
			switch (e) {
				case "focusin":
				case "focusout":
					yE = null;
					break;
				case "dragenter":
				case "dragleave":
					bE = null;
					break;
				case "mouseover":
				case "mouseout":
					xE = null;
					break;
				case "pointerover":
				case "pointerout":
					SE.delete(t.pointerId);
					break;
				case "gotpointercapture":
				case "lostpointercapture": CE.delete(t.pointerId);
			}
		}
		function lm(e, t, n, r, i, a) {
			return e === null || e.nativeEvent !== a ? (e = {
				blockedOn: t,
				domEventName: n,
				eventSystemFlags: r,
				nativeEvent: a,
				targetContainers: [i]
			}, t !== null && (t = pt(t), t !== null && $p(t)), e) : (e.eventSystemFlags |= r, t = e.targetContainers, i !== null && t.indexOf(i) === -1 && t.push(i), e);
		}
		function um(e, t, n, r, i) {
			switch (t) {
				case "focusin": return yE = lm(yE, e, t, n, r, i), !0;
				case "dragenter": return bE = lm(bE, e, t, n, r, i), !0;
				case "mouseover": return xE = lm(xE, e, t, n, r, i), !0;
				case "pointerover":
					var a = i.pointerId;
					return SE.set(a, lm(SE.get(a) || null, e, t, n, r, i)), !0;
				case "gotpointercapture": return a = i.pointerId, CE.set(a, lm(CE.get(a) || null, e, t, n, r, i)), !0;
			}
			return !1;
		}
		function dm(e) {
			var t = ft(e.target);
			if (t !== null) {
				var n = ee(t);
				if (n !== null) {
					if (t = n.tag, t === 13) {
						if (t = te(n), t !== null) {
							e.blockedOn = t, ut(e.priority, function() {
								em(n);
							});
							return;
						}
					} else if (t === 31) {
						if (t = ne(n), t !== null) {
							e.blockedOn = t, ut(e.priority, function() {
								em(n);
							});
							return;
						}
					} else if (t === 3 && n.stateNode.current.memoizedState.isDehydrated) {
						e.blockedOn = n.tag === 3 ? n.stateNode.containerInfo : null;
						return;
					}
				}
			}
			e.blockedOn = null;
		}
		function fm(e) {
			if (e.blockedOn !== null) return !1;
			for (var t = e.targetContainers; 0 < t.length;) {
				var n = am(e.nativeEvent);
				if (n === null) {
					n = e.nativeEvent;
					var r = new n.constructor(n.type, n), i = r;
					Xg !== null && console.error("Expected currently replaying event to be null. This error is likely caused by a bug in React. Please file an issue."), Xg = i, n.target.dispatchEvent(r), Xg === null && console.error("Expected currently replaying event to not be null. This error is likely caused by a bug in React. Please file an issue."), Xg = null;
				} else return t = pt(n), t !== null && $p(t), e.blockedOn = n, !1;
				t.shift();
			}
			return !0;
		}
		function pm(e, t, n) {
			fm(e) && n.delete(t);
		}
		function mm() {
			vE = !1, yE !== null && fm(yE) && (yE = null), bE !== null && fm(bE) && (bE = null), xE !== null && fm(xE) && (xE = null), SE.forEach(pm), CE.forEach(pm);
		}
		function hm(e, t) {
			e.blockedOn === t && (e.blockedOn = null, vE || (vE = !0, Sm.unstable_scheduleCallback(Sm.unstable_NormalPriority, mm)));
		}
		function gm(e) {
			EE !== e && (EE = e, Sm.unstable_scheduleCallback(Sm.unstable_NormalPriority, function() {
				EE === e && (EE = null);
				for (var t = 0; t < e.length; t += 3) {
					var n = e[t], r = e[t + 1], i = e[t + 2];
					if (typeof r != "function") {
						if (om(r || n) === null) continue;
						break;
					}
					var a = pt(n);
					a !== null && (e.splice(t, 3), t -= 3, n = {
						pending: !0,
						data: i,
						method: n.method,
						action: r
					}, Object.freeze(n), as(a, n, r, i));
				}
			}));
		}
		function _m(e) {
			function t(t) {
				return hm(t, e);
			}
			yE !== null && hm(yE, e), bE !== null && hm(bE, e), xE !== null && hm(xE, e), SE.forEach(t), CE.forEach(t);
			for (var n = 0; n < wE.length; n++) {
				var r = wE[n];
				r.blockedOn === e && (r.blockedOn = null);
			}
			for (; 0 < wE.length && (n = wE[0], n.blockedOn === null);) dm(n), n.blockedOn === null && wE.shift();
			if (n = (e.ownerDocument || e).$$reactFormReplay, n != null) for (r = 0; r < n.length; r += 3) {
				var i = n[r], a = n[r + 1], o = i[Kh] || null;
				if (typeof a == "function") o || gm(n);
				else if (o) {
					var s = null;
					if (a && a.hasAttribute("formAction")) {
						if (i = a, o = a[Kh] || null) s = o.formAction;
						else if (om(i) !== null) continue;
					} else s = o.action;
					typeof s == "function" ? n[r + 1] = s : (n.splice(r, 3), r -= 3), gm(n);
				}
			}
		}
		function vm() {
			function e(e) {
				e.canIntercept && e.info === "react-transition" && e.intercept({
					handler: function() {
						return new Promise(function(e) {
							return i = e;
						});
					},
					focusReset: "manual",
					scroll: "manual"
				});
			}
			function t() {
				i !== null && (i(), i = null), r || setTimeout(n, 20);
			}
			function n() {
				if (!r && !navigation.transition) {
					var e = navigation.currentEntry;
					e && e.url != null && navigation.navigate(e.url, {
						state: e.getState(),
						info: "react-transition",
						history: "replace"
					});
				}
			}
			if (typeof navigation == "object") {
				var r = !1, i = null;
				return navigation.addEventListener("navigate", e), navigation.addEventListener("navigatesuccess", t), navigation.addEventListener("navigateerror", t), setTimeout(n, 100), function() {
					r = !0, navigation.removeEventListener("navigate", e), navigation.removeEventListener("navigatesuccess", t), navigation.removeEventListener("navigateerror", t), i !== null && (i(), i = null);
				};
			}
		}
		function ym(e) {
			this._internalRoot = e;
		}
		function bm(e) {
			this._internalRoot = e;
		}
		function xm(e) {
			e[qh] && (e._reactRootContainer ? console.error("You are calling ReactDOMClient.createRoot() on a container that was previously passed to ReactDOM.render(). This is not supported.") : console.error("You are calling ReactDOMClient.createRoot() on a container that has already been passed to createRoot() before. Instead, call root.render() on the existing root instead if you want to update it."));
		}
		typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart == "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
		var Sm = l(), Cm = r(), wm = f(), Tm = null, Em = null, R = Object.assign, Dm = Symbol.for("react.element"), Om = Symbol.for("react.transitional.element"), km = Symbol.for("react.portal"), Am = Symbol.for("react.fragment"), jm = Symbol.for("react.strict_mode"), Mm = Symbol.for("react.profiler"), Nm = Symbol.for("react.consumer"), Pm = Symbol.for("react.context"), Fm = Symbol.for("react.forward_ref"), Im = Symbol.for("react.suspense"), Lm = Symbol.for("react.suspense_list"), Rm = Symbol.for("react.memo"), zm = Symbol.for("react.lazy"), Bm = Symbol.for("react.activity"), Vm = Symbol.for("react.legacy_hidden"), Hm = Symbol.for("react.memo_cache_sentinel"), Um = Symbol.for("react.view_transition"), Wm = Symbol.for("react.recoverable"), Gm = Symbol.iterator, Km = Symbol.for("react.client.reference"), qm = Array.isArray, z = Cm.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, B = wm.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Jm = Object.freeze({
			pending: !1,
			data: null,
			method: null,
			action: null
		}), Ym = [], Xm = [], Zm = -1, Qm = ve(null), $m = ve(null), eh = ve(null), th = ve(null), nh = 0, rh, ih, ah, oh, sh, ch, lh;
		w.__reactDisabledLog = !0;
		var uh, dh, fh = !1, ph = new (typeof WeakMap == "function" ? WeakMap : Map)(), mh = null, hh = !1, gh = Object.prototype.hasOwnProperty, _h = Sm.unstable_scheduleCallback, vh = Sm.unstable_cancelCallback, yh = Sm.unstable_shouldYield, bh = Sm.unstable_requestPaint, xh = Sm.unstable_now, Sh = Sm.unstable_getCurrentPriorityLevel, Ch = Sm.unstable_ImmediatePriority, wh = Sm.unstable_UserBlockingPriority, Th = Sm.unstable_NormalPriority, Eh = Sm.unstable_LowPriority, Dh = Sm.unstable_IdlePriority, Oh = Sm.log, kh = Sm.unstable_setDisableYieldValue, Ah = null, jh = null, Mh = !1, Nh = typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u", Ph = Math.clz32 ? Math.clz32 : Ke, Fh = Math.log, Ih = Math.LN2, Lh = 256, Rh = 262144, zh = 4194304, Bh = 2, Vh = 8, Hh = 32, Uh = 268435456, Wh = Math.random().toString(36).slice(2), Gh = "__reactFiber$" + Wh, Kh = "__reactProps$" + Wh, qh = "__reactContainer$" + Wh, Jh = "__reactEvents$" + Wh, Yh = "__reactListeners$" + Wh, Xh = "__reactHandles$" + Wh, Zh = "__reactResources$" + Wh, Qh = "__reactMarker$" + Wh, $h = "__reactLoad$" + Wh, eg = /* @__PURE__ */ new Set(), tg = {}, ng = {}, rg = {
			button: !0,
			checkbox: !0,
			image: !0,
			hidden: !0,
			radio: !0,
			reset: !0,
			submit: !0
		}, ig = RegExp("^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"), ag = {}, og = {}, V = !1, sg = /[\n"\\]/g, cg = !1, lg = !1, ug = !1, dg = !1, fg = !1, pg = !1, mg = ["value", "defaultValue"], hg = !1, gg = /["'&<>\n\t]|^\s|\s$/, _g = "address applet area article aside base basefont bgsound blockquote body br button caption center col colgroup dd details dir div dl dt embed fieldset figcaption figure footer form frame frameset h1 h2 h3 h4 h5 h6 head header hgroup hr html iframe img input isindex li link listing main marquee menu menuitem meta nav noembed noframes noscript object ol p param plaintext pre script section select source style summary table tbody td template textarea tfoot th thead title tr track ul wbr xmp".split(" "), vg = "applet caption html table td th marquee object select template foreignObject desc title".split(" "), yg = vg.concat(["button"]), bg = "dd dt li option optgroup p rp rt".split(" "), xg = {
			current: null,
			formTag: null,
			aTagInScope: null,
			buttonTagInScope: null,
			nobrTagInScope: null,
			pTagInButtonScope: null,
			listItemTagAutoclosing: null,
			dlItemTagAutoclosing: null,
			containerTagInScope: null,
			implicitRootScope: !1
		}, Sg = {}, Cg = {
			animation: "animationDelay animationDirection animationDuration animationFillMode animationIterationCount animationName animationPlayState animationTimingFunction".split(" "),
			background: "backgroundAttachment backgroundClip backgroundColor backgroundImage backgroundOrigin backgroundPositionX backgroundPositionY backgroundRepeat backgroundSize".split(" "),
			backgroundPosition: ["backgroundPositionX", "backgroundPositionY"],
			border: "borderBottomColor borderBottomStyle borderBottomWidth borderImageOutset borderImageRepeat borderImageSlice borderImageSource borderImageWidth borderLeftColor borderLeftStyle borderLeftWidth borderRightColor borderRightStyle borderRightWidth borderTopColor borderTopStyle borderTopWidth".split(" "),
			borderBlock: "borderBlockEndColor borderBlockEndStyle borderBlockEndWidth borderBlockStartColor borderBlockStartStyle borderBlockStartWidth".split(" "),
			borderBlockColor: ["borderBlockEndColor", "borderBlockStartColor"],
			borderBlockEnd: [
				"borderBlockEndColor",
				"borderBlockEndStyle",
				"borderBlockEndWidth"
			],
			borderBlockStart: [
				"borderBlockStartColor",
				"borderBlockStartStyle",
				"borderBlockStartWidth"
			],
			borderBlockStyle: ["borderBlockEndStyle", "borderBlockStartStyle"],
			borderBlockWidth: ["borderBlockEndWidth", "borderBlockStartWidth"],
			borderBottom: [
				"borderBottomColor",
				"borderBottomStyle",
				"borderBottomWidth"
			],
			borderColor: [
				"borderBottomColor",
				"borderLeftColor",
				"borderRightColor",
				"borderTopColor"
			],
			borderImage: [
				"borderImageOutset",
				"borderImageRepeat",
				"borderImageSlice",
				"borderImageSource",
				"borderImageWidth"
			],
			borderInline: "borderInlineEndColor borderInlineEndStyle borderInlineEndWidth borderInlineStartColor borderInlineStartStyle borderInlineStartWidth".split(" "),
			borderInlineColor: ["borderInlineEndColor", "borderInlineStartColor"],
			borderInlineEnd: [
				"borderInlineEndColor",
				"borderInlineEndStyle",
				"borderInlineEndWidth"
			],
			borderInlineStart: [
				"borderInlineStartColor",
				"borderInlineStartStyle",
				"borderInlineStartWidth"
			],
			borderInlineStyle: ["borderInlineEndStyle", "borderInlineStartStyle"],
			borderInlineWidth: ["borderInlineEndWidth", "borderInlineStartWidth"],
			borderLeft: [
				"borderLeftColor",
				"borderLeftStyle",
				"borderLeftWidth"
			],
			borderRadius: [
				"borderBottomLeftRadius",
				"borderBottomRightRadius",
				"borderTopLeftRadius",
				"borderTopRightRadius"
			],
			borderRight: [
				"borderRightColor",
				"borderRightStyle",
				"borderRightWidth"
			],
			borderStyle: [
				"borderBottomStyle",
				"borderLeftStyle",
				"borderRightStyle",
				"borderTopStyle"
			],
			borderTop: [
				"borderTopColor",
				"borderTopStyle",
				"borderTopWidth"
			],
			borderWidth: [
				"borderBottomWidth",
				"borderLeftWidth",
				"borderRightWidth",
				"borderTopWidth"
			],
			colorAdjust: ["printColorAdjust"],
			columnRule: [
				"columnRuleColor",
				"columnRuleStyle",
				"columnRuleWidth"
			],
			columns: ["columnCount", "columnWidth"],
			containIntrinsicSize: ["containIntrinsicHeight", "containIntrinsicWidth"],
			container: ["containerName", "containerType"],
			flex: [
				"flexBasis",
				"flexGrow",
				"flexShrink"
			],
			flexFlow: ["flexDirection", "flexWrap"],
			font: "fontFamily fontFeatureSettings fontKerning fontLanguageOverride fontSize fontSizeAdjust fontStretch fontStyle fontVariant fontVariantAlternates fontVariantCaps fontVariantEastAsian fontVariantLigatures fontVariantNumeric fontVariantPosition fontWeight lineHeight".split(" "),
			fontSynthesis: [
				"fontSynthesisPosition",
				"fontSynthesisSmallCaps",
				"fontSynthesisStyle",
				"fontSynthesisWeight"
			],
			fontVariant: "fontVariantAlternates fontVariantCaps fontVariantEastAsian fontVariantLigatures fontVariantNumeric fontVariantPosition".split(" "),
			gap: ["columnGap", "rowGap"],
			grid: "gridAutoColumns gridAutoFlow gridAutoRows gridTemplateAreas gridTemplateColumns gridTemplateRows".split(" "),
			gridArea: [
				"gridColumnEnd",
				"gridColumnStart",
				"gridRowEnd",
				"gridRowStart"
			],
			gridColumn: ["gridColumnEnd", "gridColumnStart"],
			gridColumnGap: ["columnGap"],
			gridGap: ["columnGap", "rowGap"],
			gridRow: ["gridRowEnd", "gridRowStart"],
			gridRowGap: ["rowGap"],
			gridTemplate: [
				"gridTemplateAreas",
				"gridTemplateColumns",
				"gridTemplateRows"
			],
			inset: [
				"bottom",
				"left",
				"right",
				"top"
			],
			insetBlock: ["insetBlockEnd", "insetBlockStart"],
			insetInline: ["insetInlineEnd", "insetInlineStart"],
			listStyle: [
				"listStyleImage",
				"listStylePosition",
				"listStyleType"
			],
			margin: [
				"marginBottom",
				"marginLeft",
				"marginRight",
				"marginTop"
			],
			marginBlock: ["marginBlockEnd", "marginBlockStart"],
			marginInline: ["marginInlineEnd", "marginInlineStart"],
			marker: [
				"markerEnd",
				"markerMid",
				"markerStart"
			],
			mask: "maskClip maskComposite maskImage maskMode maskOrigin maskPositionX maskPositionY maskRepeat maskSize".split(" "),
			maskPosition: ["maskPositionX", "maskPositionY"],
			offset: [
				"offsetAnchor",
				"offsetDistance",
				"offsetPath",
				"offsetPosition",
				"offsetRotate"
			],
			outline: [
				"outlineColor",
				"outlineStyle",
				"outlineWidth"
			],
			overflow: ["overflowX", "overflowY"],
			overscrollBehavior: ["overscrollBehaviorX", "overscrollBehaviorY"],
			padding: [
				"paddingBottom",
				"paddingLeft",
				"paddingRight",
				"paddingTop"
			],
			paddingBlock: ["paddingBlockEnd", "paddingBlockStart"],
			paddingInline: ["paddingInlineEnd", "paddingInlineStart"],
			pageBreakAfter: ["breakAfter"],
			pageBreakBefore: ["breakBefore"],
			pageBreakInside: ["breakInside"],
			placeContent: ["alignContent", "justifyContent"],
			placeItems: ["alignItems", "justifyItems"],
			placeSelf: ["alignSelf", "justifySelf"],
			scrollMargin: [
				"scrollMarginBottom",
				"scrollMarginLeft",
				"scrollMarginRight",
				"scrollMarginTop"
			],
			scrollMarginBlock: ["scrollMarginBlockEnd", "scrollMarginBlockStart"],
			scrollMarginInline: ["scrollMarginInlineEnd", "scrollMarginInlineStart"],
			scrollPadding: [
				"scrollPaddingBottom",
				"scrollPaddingLeft",
				"scrollPaddingRight",
				"scrollPaddingTop"
			],
			scrollPaddingBlock: ["scrollPaddingBlockEnd", "scrollPaddingBlockStart"],
			scrollPaddingInline: ["scrollPaddingInlineEnd", "scrollPaddingInlineStart"],
			textDecoration: [
				"textDecorationColor",
				"textDecorationLine",
				"textDecorationStyle",
				"textDecorationThickness"
			],
			textEmphasis: ["textEmphasisColor", "textEmphasisStyle"],
			textWrap: ["textWrapMode", "textWrapStyle"],
			transition: [
				"transitionBehavior",
				"transitionDelay",
				"transitionDuration",
				"transitionProperty",
				"transitionTimingFunction"
			],
			verticalAlign: [
				"alignmentBaseline",
				"baselineShift",
				"baselineSource"
			],
			whiteSpace: ["textWrapMode", "whiteSpaceCollapse"],
			wordWrap: ["overflowWrap"]
		}, wg = /([A-Z])/g, Tg = /^ms-/, Eg = /^(?:webkit|moz|o)[A-Z]/, Dg = /^-ms-/, Og = /-(.)/g, kg = /;\s*$/, Ag = {}, jg = {}, Mg = !1, Ng = !1, Pg = new Set("animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(" ")), Fg = "http://www.w3.org/1998/Math/MathML", Ig = "http://www.w3.org/2000/svg", Lg = /* @__PURE__ */ new Map([
			["acceptCharset", "accept-charset"],
			["htmlFor", "for"],
			["httpEquiv", "http-equiv"],
			["crossOrigin", "crossorigin"],
			["accentHeight", "accent-height"],
			["alignmentBaseline", "alignment-baseline"],
			["arabicForm", "arabic-form"],
			["baselineShift", "baseline-shift"],
			["capHeight", "cap-height"],
			["clipPath", "clip-path"],
			["clipRule", "clip-rule"],
			["colorInterpolation", "color-interpolation"],
			["colorInterpolationFilters", "color-interpolation-filters"],
			["colorProfile", "color-profile"],
			["colorRendering", "color-rendering"],
			["dominantBaseline", "dominant-baseline"],
			["enableBackground", "enable-background"],
			["fillOpacity", "fill-opacity"],
			["fillRule", "fill-rule"],
			["floodColor", "flood-color"],
			["floodOpacity", "flood-opacity"],
			["fontFamily", "font-family"],
			["fontSize", "font-size"],
			["fontSizeAdjust", "font-size-adjust"],
			["fontStretch", "font-stretch"],
			["fontStyle", "font-style"],
			["fontVariant", "font-variant"],
			["fontWeight", "font-weight"],
			["glyphName", "glyph-name"],
			["glyphOrientationHorizontal", "glyph-orientation-horizontal"],
			["glyphOrientationVertical", "glyph-orientation-vertical"],
			["horizAdvX", "horiz-adv-x"],
			["horizOriginX", "horiz-origin-x"],
			["imageRendering", "image-rendering"],
			["letterSpacing", "letter-spacing"],
			["lightingColor", "lighting-color"],
			["markerEnd", "marker-end"],
			["markerMid", "marker-mid"],
			["markerStart", "marker-start"],
			["maskType", "mask-type"],
			["overlinePosition", "overline-position"],
			["overlineThickness", "overline-thickness"],
			["paintOrder", "paint-order"],
			["panose-1", "panose-1"],
			["pointerEvents", "pointer-events"],
			["renderingIntent", "rendering-intent"],
			["shapeRendering", "shape-rendering"],
			["stopColor", "stop-color"],
			["stopOpacity", "stop-opacity"],
			["strikethroughPosition", "strikethrough-position"],
			["strikethroughThickness", "strikethrough-thickness"],
			["strokeDasharray", "stroke-dasharray"],
			["strokeDashoffset", "stroke-dashoffset"],
			["strokeLinecap", "stroke-linecap"],
			["strokeLinejoin", "stroke-linejoin"],
			["strokeMiterlimit", "stroke-miterlimit"],
			["strokeOpacity", "stroke-opacity"],
			["strokeWidth", "stroke-width"],
			["textAnchor", "text-anchor"],
			["textDecoration", "text-decoration"],
			["textRendering", "text-rendering"],
			["transformOrigin", "transform-origin"],
			["underlinePosition", "underline-position"],
			["underlineThickness", "underline-thickness"],
			["unicodeBidi", "unicode-bidi"],
			["unicodeRange", "unicode-range"],
			["unitsPerEm", "units-per-em"],
			["vAlphabetic", "v-alphabetic"],
			["vHanging", "v-hanging"],
			["vIdeographic", "v-ideographic"],
			["vMathematical", "v-mathematical"],
			["vectorEffect", "vector-effect"],
			["vertAdvY", "vert-adv-y"],
			["vertOriginX", "vert-origin-x"],
			["vertOriginY", "vert-origin-y"],
			["wordSpacing", "word-spacing"],
			["writingMode", "writing-mode"],
			["xmlnsXlink", "xmlns:xlink"],
			["xHeight", "x-height"]
		]), Rg = {
			accept: "accept",
			acceptcharset: "acceptCharset",
			"accept-charset": "acceptCharset",
			accesskey: "accessKey",
			action: "action",
			allowfullscreen: "allowFullScreen",
			alt: "alt",
			as: "as",
			async: "async",
			autocapitalize: "autoCapitalize",
			autocomplete: "autoComplete",
			autocorrect: "autoCorrect",
			autofocus: "autoFocus",
			autoplay: "autoPlay",
			autosave: "autoSave",
			capture: "capture",
			cellpadding: "cellPadding",
			cellspacing: "cellSpacing",
			challenge: "challenge",
			charset: "charSet",
			checked: "checked",
			children: "children",
			cite: "cite",
			class: "className",
			classid: "classID",
			classname: "className",
			cols: "cols",
			colspan: "colSpan",
			content: "content",
			contenteditable: "contentEditable",
			contextmenu: "contextMenu",
			controls: "controls",
			controlslist: "controlsList",
			coords: "coords",
			credentialless: "credentialless",
			crossorigin: "crossOrigin",
			dangerouslysetinnerhtml: "dangerouslySetInnerHTML",
			data: "data",
			datetime: "dateTime",
			default: "default",
			defaultchecked: "defaultChecked",
			defaultvalue: "defaultValue",
			defer: "defer",
			dir: "dir",
			disabled: "disabled",
			disablepictureinpicture: "disablePictureInPicture",
			disableremoteplayback: "disableRemotePlayback",
			download: "download",
			draggable: "draggable",
			enctype: "encType",
			enterkeyhint: "enterKeyHint",
			fetchpriority: "fetchPriority",
			for: "htmlFor",
			form: "form",
			formmethod: "formMethod",
			formaction: "formAction",
			formenctype: "formEncType",
			formnovalidate: "formNoValidate",
			formtarget: "formTarget",
			frameborder: "frameBorder",
			headers: "headers",
			height: "height",
			hidden: "hidden",
			high: "high",
			href: "href",
			hreflang: "hrefLang",
			htmlfor: "htmlFor",
			httpequiv: "httpEquiv",
			"http-equiv": "httpEquiv",
			icon: "icon",
			id: "id",
			imagesizes: "imageSizes",
			imagesrcset: "imageSrcSet",
			inert: "inert",
			innerhtml: "innerHTML",
			inputmode: "inputMode",
			integrity: "integrity",
			is: "is",
			itemid: "itemID",
			itemprop: "itemProp",
			itemref: "itemRef",
			itemscope: "itemScope",
			itemtype: "itemType",
			keyparams: "keyParams",
			keytype: "keyType",
			kind: "kind",
			label: "label",
			lang: "lang",
			list: "list",
			loop: "loop",
			low: "low",
			manifest: "manifest",
			marginwidth: "marginWidth",
			marginheight: "marginHeight",
			max: "max",
			maxlength: "maxLength",
			media: "media",
			mediagroup: "mediaGroup",
			method: "method",
			min: "min",
			minlength: "minLength",
			multiple: "multiple",
			muted: "muted",
			name: "name",
			nomodule: "noModule",
			nonce: "nonce",
			novalidate: "noValidate",
			open: "open",
			optimum: "optimum",
			pattern: "pattern",
			placeholder: "placeholder",
			playsinline: "playsInline",
			poster: "poster",
			preload: "preload",
			profile: "profile",
			radiogroup: "radioGroup",
			readonly: "readOnly",
			referrerpolicy: "referrerPolicy",
			rel: "rel",
			required: "required",
			reversed: "reversed",
			role: "role",
			rows: "rows",
			rowspan: "rowSpan",
			sandbox: "sandbox",
			scope: "scope",
			scoped: "scoped",
			scrolling: "scrolling",
			seamless: "seamless",
			selected: "selected",
			shape: "shape",
			size: "size",
			sizes: "sizes",
			span: "span",
			spellcheck: "spellCheck",
			src: "src",
			srcdoc: "srcDoc",
			srclang: "srcLang",
			srcset: "srcSet",
			start: "start",
			step: "step",
			style: "style",
			summary: "summary",
			tabindex: "tabIndex",
			target: "target",
			title: "title",
			type: "type",
			usemap: "useMap",
			value: "value",
			width: "width",
			wmode: "wmode",
			wrap: "wrap",
			about: "about",
			accentheight: "accentHeight",
			"accent-height": "accentHeight",
			accumulate: "accumulate",
			additive: "additive",
			alignmentbaseline: "alignmentBaseline",
			"alignment-baseline": "alignmentBaseline",
			allowreorder: "allowReorder",
			alphabetic: "alphabetic",
			amplitude: "amplitude",
			arabicform: "arabicForm",
			"arabic-form": "arabicForm",
			ascent: "ascent",
			attributename: "attributeName",
			attributetype: "attributeType",
			autoreverse: "autoReverse",
			azimuth: "azimuth",
			basefrequency: "baseFrequency",
			baselineshift: "baselineShift",
			"baseline-shift": "baselineShift",
			baseprofile: "baseProfile",
			bbox: "bbox",
			begin: "begin",
			bias: "bias",
			by: "by",
			calcmode: "calcMode",
			capheight: "capHeight",
			"cap-height": "capHeight",
			clip: "clip",
			clippath: "clipPath",
			"clip-path": "clipPath",
			clippathunits: "clipPathUnits",
			cliprule: "clipRule",
			"clip-rule": "clipRule",
			color: "color",
			colorinterpolation: "colorInterpolation",
			"color-interpolation": "colorInterpolation",
			colorinterpolationfilters: "colorInterpolationFilters",
			"color-interpolation-filters": "colorInterpolationFilters",
			colorprofile: "colorProfile",
			"color-profile": "colorProfile",
			colorrendering: "colorRendering",
			"color-rendering": "colorRendering",
			contentscripttype: "contentScriptType",
			contentstyletype: "contentStyleType",
			cursor: "cursor",
			cx: "cx",
			cy: "cy",
			d: "d",
			datatype: "datatype",
			decelerate: "decelerate",
			descent: "descent",
			diffuseconstant: "diffuseConstant",
			direction: "direction",
			display: "display",
			divisor: "divisor",
			dominantbaseline: "dominantBaseline",
			"dominant-baseline": "dominantBaseline",
			dur: "dur",
			dx: "dx",
			dy: "dy",
			edgemode: "edgeMode",
			elevation: "elevation",
			enablebackground: "enableBackground",
			"enable-background": "enableBackground",
			end: "end",
			exponent: "exponent",
			externalresourcesrequired: "externalResourcesRequired",
			fill: "fill",
			fillopacity: "fillOpacity",
			"fill-opacity": "fillOpacity",
			fillrule: "fillRule",
			"fill-rule": "fillRule",
			filter: "filter",
			filterres: "filterRes",
			filterunits: "filterUnits",
			floodopacity: "floodOpacity",
			"flood-opacity": "floodOpacity",
			floodcolor: "floodColor",
			"flood-color": "floodColor",
			focusable: "focusable",
			fontfamily: "fontFamily",
			"font-family": "fontFamily",
			fontsize: "fontSize",
			"font-size": "fontSize",
			fontsizeadjust: "fontSizeAdjust",
			"font-size-adjust": "fontSizeAdjust",
			fontstretch: "fontStretch",
			"font-stretch": "fontStretch",
			fontstyle: "fontStyle",
			"font-style": "fontStyle",
			fontvariant: "fontVariant",
			"font-variant": "fontVariant",
			fontweight: "fontWeight",
			"font-weight": "fontWeight",
			format: "format",
			from: "from",
			fx: "fx",
			fy: "fy",
			g1: "g1",
			g2: "g2",
			glyphname: "glyphName",
			"glyph-name": "glyphName",
			glyphorientationhorizontal: "glyphOrientationHorizontal",
			"glyph-orientation-horizontal": "glyphOrientationHorizontal",
			glyphorientationvertical: "glyphOrientationVertical",
			"glyph-orientation-vertical": "glyphOrientationVertical",
			glyphref: "glyphRef",
			gradienttransform: "gradientTransform",
			gradientunits: "gradientUnits",
			hanging: "hanging",
			horizadvx: "horizAdvX",
			"horiz-adv-x": "horizAdvX",
			horizoriginx: "horizOriginX",
			"horiz-origin-x": "horizOriginX",
			ideographic: "ideographic",
			imagerendering: "imageRendering",
			"image-rendering": "imageRendering",
			in2: "in2",
			in: "in",
			inlist: "inlist",
			intercept: "intercept",
			k1: "k1",
			k2: "k2",
			k3: "k3",
			k4: "k4",
			k: "k",
			kernelmatrix: "kernelMatrix",
			kernelunitlength: "kernelUnitLength",
			kerning: "kerning",
			keypoints: "keyPoints",
			keysplines: "keySplines",
			keytimes: "keyTimes",
			lengthadjust: "lengthAdjust",
			letterspacing: "letterSpacing",
			"letter-spacing": "letterSpacing",
			lightingcolor: "lightingColor",
			"lighting-color": "lightingColor",
			limitingconeangle: "limitingConeAngle",
			local: "local",
			markerend: "markerEnd",
			"marker-end": "markerEnd",
			markerheight: "markerHeight",
			markermid: "markerMid",
			"marker-mid": "markerMid",
			markerstart: "markerStart",
			"marker-start": "markerStart",
			markerunits: "markerUnits",
			markerwidth: "markerWidth",
			mask: "mask",
			maskcontentunits: "maskContentUnits",
			masktype: "maskType",
			maskunits: "maskUnits",
			mathematical: "mathematical",
			mode: "mode",
			numoctaves: "numOctaves",
			offset: "offset",
			opacity: "opacity",
			operator: "operator",
			order: "order",
			orient: "orient",
			orientation: "orientation",
			origin: "origin",
			overflow: "overflow",
			overlineposition: "overlinePosition",
			"overline-position": "overlinePosition",
			overlinethickness: "overlineThickness",
			"overline-thickness": "overlineThickness",
			paintorder: "paintOrder",
			"paint-order": "paintOrder",
			panose1: "panose1",
			"panose-1": "panose1",
			pathlength: "pathLength",
			patterncontentunits: "patternContentUnits",
			patterntransform: "patternTransform",
			patternunits: "patternUnits",
			pointerevents: "pointerEvents",
			"pointer-events": "pointerEvents",
			points: "points",
			pointsatx: "pointsAtX",
			pointsaty: "pointsAtY",
			pointsatz: "pointsAtZ",
			popover: "popover",
			popovertarget: "popoverTarget",
			popovertargetaction: "popoverTargetAction",
			prefix: "prefix",
			preservealpha: "preserveAlpha",
			preserveaspectratio: "preserveAspectRatio",
			primitiveunits: "primitiveUnits",
			property: "property",
			r: "r",
			radius: "radius",
			refx: "refX",
			refy: "refY",
			renderingintent: "renderingIntent",
			"rendering-intent": "renderingIntent",
			repeatcount: "repeatCount",
			repeatdur: "repeatDur",
			requiredextensions: "requiredExtensions",
			requiredfeatures: "requiredFeatures",
			resource: "resource",
			restart: "restart",
			result: "result",
			results: "results",
			rotate: "rotate",
			rx: "rx",
			ry: "ry",
			scale: "scale",
			security: "security",
			seed: "seed",
			shaperendering: "shapeRendering",
			"shape-rendering": "shapeRendering",
			slope: "slope",
			spacing: "spacing",
			specularconstant: "specularConstant",
			specularexponent: "specularExponent",
			speed: "speed",
			spreadmethod: "spreadMethod",
			startoffset: "startOffset",
			stddeviation: "stdDeviation",
			stemh: "stemh",
			stemv: "stemv",
			stitchtiles: "stitchTiles",
			stopcolor: "stopColor",
			"stop-color": "stopColor",
			stopopacity: "stopOpacity",
			"stop-opacity": "stopOpacity",
			strikethroughposition: "strikethroughPosition",
			"strikethrough-position": "strikethroughPosition",
			strikethroughthickness: "strikethroughThickness",
			"strikethrough-thickness": "strikethroughThickness",
			string: "string",
			stroke: "stroke",
			strokedasharray: "strokeDasharray",
			"stroke-dasharray": "strokeDasharray",
			strokedashoffset: "strokeDashoffset",
			"stroke-dashoffset": "strokeDashoffset",
			strokelinecap: "strokeLinecap",
			"stroke-linecap": "strokeLinecap",
			strokelinejoin: "strokeLinejoin",
			"stroke-linejoin": "strokeLinejoin",
			strokemiterlimit: "strokeMiterlimit",
			"stroke-miterlimit": "strokeMiterlimit",
			strokewidth: "strokeWidth",
			"stroke-width": "strokeWidth",
			strokeopacity: "strokeOpacity",
			"stroke-opacity": "strokeOpacity",
			suppresscontenteditablewarning: "suppressContentEditableWarning",
			suppresshydrationwarning: "suppressHydrationWarning",
			surfacescale: "surfaceScale",
			systemlanguage: "systemLanguage",
			tablevalues: "tableValues",
			targetx: "targetX",
			targety: "targetY",
			textanchor: "textAnchor",
			"text-anchor": "textAnchor",
			textdecoration: "textDecoration",
			"text-decoration": "textDecoration",
			textlength: "textLength",
			textrendering: "textRendering",
			"text-rendering": "textRendering",
			to: "to",
			transform: "transform",
			transformorigin: "transformOrigin",
			"transform-origin": "transformOrigin",
			typeof: "typeof",
			u1: "u1",
			u2: "u2",
			underlineposition: "underlinePosition",
			"underline-position": "underlinePosition",
			underlinethickness: "underlineThickness",
			"underline-thickness": "underlineThickness",
			unicode: "unicode",
			unicodebidi: "unicodeBidi",
			"unicode-bidi": "unicodeBidi",
			unicoderange: "unicodeRange",
			"unicode-range": "unicodeRange",
			unitsperem: "unitsPerEm",
			"units-per-em": "unitsPerEm",
			unselectable: "unselectable",
			valphabetic: "vAlphabetic",
			"v-alphabetic": "vAlphabetic",
			values: "values",
			vectoreffect: "vectorEffect",
			"vector-effect": "vectorEffect",
			version: "version",
			vertadvy: "vertAdvY",
			"vert-adv-y": "vertAdvY",
			vertoriginx: "vertOriginX",
			"vert-origin-x": "vertOriginX",
			vertoriginy: "vertOriginY",
			"vert-origin-y": "vertOriginY",
			vhanging: "vHanging",
			"v-hanging": "vHanging",
			videographic: "vIdeographic",
			"v-ideographic": "vIdeographic",
			viewbox: "viewBox",
			viewtarget: "viewTarget",
			visibility: "visibility",
			vmathematical: "vMathematical",
			"v-mathematical": "vMathematical",
			vocab: "vocab",
			widths: "widths",
			wordspacing: "wordSpacing",
			"word-spacing": "wordSpacing",
			writingmode: "writingMode",
			"writing-mode": "writingMode",
			x1: "x1",
			x2: "x2",
			x: "x",
			xchannelselector: "xChannelSelector",
			xheight: "xHeight",
			"x-height": "xHeight",
			xlinkactuate: "xlinkActuate",
			"xlink:actuate": "xlinkActuate",
			xlinkarcrole: "xlinkArcrole",
			"xlink:arcrole": "xlinkArcrole",
			xlinkhref: "xlinkHref",
			"xlink:href": "xlinkHref",
			xlinkrole: "xlinkRole",
			"xlink:role": "xlinkRole",
			xlinkshow: "xlinkShow",
			"xlink:show": "xlinkShow",
			xlinktitle: "xlinkTitle",
			"xlink:title": "xlinkTitle",
			xlinktype: "xlinkType",
			"xlink:type": "xlinkType",
			xmlbase: "xmlBase",
			"xml:base": "xmlBase",
			xmllang: "xmlLang",
			"xml:lang": "xmlLang",
			xmlns: "xmlns",
			"xml:space": "xmlSpace",
			xmlnsxlink: "xmlnsXlink",
			"xmlns:xlink": "xmlnsXlink",
			xmlspace: "xmlSpace",
			y1: "y1",
			y2: "y2",
			y: "y",
			ychannelselector: "yChannelSelector",
			z: "z",
			zoomandpan: "zoomAndPan"
		}, zg = {
			"aria-current": 0,
			"aria-description": 0,
			"aria-details": 0,
			"aria-disabled": 0,
			"aria-hidden": 0,
			"aria-invalid": 0,
			"aria-keyshortcuts": 0,
			"aria-label": 0,
			"aria-roledescription": 0,
			"aria-autocomplete": 0,
			"aria-checked": 0,
			"aria-expanded": 0,
			"aria-haspopup": 0,
			"aria-level": 0,
			"aria-modal": 0,
			"aria-multiline": 0,
			"aria-multiselectable": 0,
			"aria-orientation": 0,
			"aria-placeholder": 0,
			"aria-pressed": 0,
			"aria-readonly": 0,
			"aria-required": 0,
			"aria-selected": 0,
			"aria-sort": 0,
			"aria-valuemax": 0,
			"aria-valuemin": 0,
			"aria-valuenow": 0,
			"aria-valuetext": 0,
			"aria-atomic": 0,
			"aria-busy": 0,
			"aria-live": 0,
			"aria-relevant": 0,
			"aria-dropeffect": 0,
			"aria-grabbed": 0,
			"aria-activedescendant": 0,
			"aria-colcount": 0,
			"aria-colindex": 0,
			"aria-colspan": 0,
			"aria-controls": 0,
			"aria-describedby": 0,
			"aria-errormessage": 0,
			"aria-flowto": 0,
			"aria-labelledby": 0,
			"aria-owns": 0,
			"aria-posinset": 0,
			"aria-rowcount": 0,
			"aria-rowindex": 0,
			"aria-rowspan": 0,
			"aria-setsize": 0,
			"aria-braillelabel": 0,
			"aria-brailleroledescription": 0,
			"aria-colindextext": 0,
			"aria-rowindextext": 0
		}, Bg = {}, Vg = RegExp("^(aria)-[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"), Hg = RegExp("^(aria)[A-Z][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"), Ug = !1, Wg = {}, Gg = /^on./, Kg = /^on[^A-Z]/, qg = RegExp("^(aria)-[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"), Jg = RegExp("^(aria)[A-Z][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"), Yg = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i, Xg = null, Zg = null, Qg = null, $g = !1, e_ = typeof window < "u" && window.document !== void 0 && window.document.createElement !== void 0, t_ = !1;
		if (e_) try {
			var n_ = {};
			Object.defineProperty(n_, "passive", { get: function() {
				t_ = !0;
			} }), window.addEventListener("test", n_, n_), window.removeEventListener("test", n_, n_);
		} catch {
			t_ = !1;
		}
		var r_ = null, i_ = null, a_ = null, o_ = {
			eventPhase: 0,
			bubbles: 0,
			cancelable: 0,
			timeStamp: function(e) {
				return e.timeStamp || Date.now();
			},
			defaultPrevented: 0,
			isTrusted: 0
		}, s_ = Nn(o_), c_ = R({}, o_, {
			view: 0,
			detail: 0
		}), l_ = Nn(c_), u_, d_, f_, p_ = R({}, c_, {
			screenX: 0,
			screenY: 0,
			clientX: 0,
			clientY: 0,
			pageX: 0,
			pageY: 0,
			ctrlKey: 0,
			shiftKey: 0,
			altKey: 0,
			metaKey: 0,
			getModifierState: Fn,
			button: 0,
			buttons: 0,
			relatedTarget: function(e) {
				return e.relatedTarget === void 0 ? e.fromElement === e.srcElement ? e.toElement : e.fromElement : e.relatedTarget;
			},
			movementX: function(e) {
				return "movementX" in e ? e.movementX : (e !== f_ && (f_ && e.type === "mousemove" ? (u_ = e.screenX - f_.screenX, d_ = e.screenY - f_.screenY) : d_ = u_ = 0, f_ = e), u_);
			},
			movementY: function(e) {
				return "movementY" in e ? e.movementY : d_;
			}
		}), m_ = Nn(p_), h_ = Nn(R({}, p_, { dataTransfer: 0 })), g_ = Nn(R({}, c_, { relatedTarget: 0 })), __ = Nn(R({}, o_, {
			animationName: 0,
			elapsedTime: 0,
			pseudoElement: 0
		})), v_ = Nn(R({}, o_, { clipboardData: function(e) {
			return "clipboardData" in e ? e.clipboardData : window.clipboardData;
		} })), y_ = Nn(R({}, o_, { data: 0 })), b_ = y_, x_ = {
			Esc: "Escape",
			Spacebar: " ",
			Left: "ArrowLeft",
			Up: "ArrowUp",
			Right: "ArrowRight",
			Down: "ArrowDown",
			Del: "Delete",
			Win: "OS",
			Menu: "ContextMenu",
			Apps: "ContextMenu",
			Scroll: "ScrollLock",
			MozPrintableKey: "Unidentified"
		}, S_ = {
			8: "Backspace",
			9: "Tab",
			12: "Clear",
			13: "Enter",
			16: "Shift",
			17: "Control",
			18: "Alt",
			19: "Pause",
			20: "CapsLock",
			27: "Escape",
			32: " ",
			33: "PageUp",
			34: "PageDown",
			35: "End",
			36: "Home",
			37: "ArrowLeft",
			38: "ArrowUp",
			39: "ArrowRight",
			40: "ArrowDown",
			45: "Insert",
			46: "Delete",
			112: "F1",
			113: "F2",
			114: "F3",
			115: "F4",
			116: "F5",
			117: "F6",
			118: "F7",
			119: "F8",
			120: "F9",
			121: "F10",
			122: "F11",
			123: "F12",
			144: "NumLock",
			145: "ScrollLock",
			224: "Meta"
		}, C_ = {
			Alt: "altKey",
			Control: "ctrlKey",
			Meta: "metaKey",
			Shift: "shiftKey"
		}, w_ = Nn(R({}, c_, {
			key: function(e) {
				if (e.key) {
					var t = x_[e.key] || e.key;
					if (t !== "Unidentified") return t;
				}
				return e.type === "keypress" ? (e = An(e), e === 13 ? "Enter" : String.fromCharCode(e)) : e.type === "keydown" || e.type === "keyup" ? S_[e.keyCode] || "Unidentified" : "";
			},
			code: 0,
			location: 0,
			ctrlKey: 0,
			shiftKey: 0,
			altKey: 0,
			metaKey: 0,
			repeat: 0,
			locale: 0,
			getModifierState: Fn,
			charCode: function(e) {
				return e.type === "keypress" ? An(e) : 0;
			},
			keyCode: function(e) {
				return e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
			},
			which: function(e) {
				return e.type === "keypress" ? An(e) : e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
			}
		})), T_ = Nn(R({}, p_, {
			pointerId: 0,
			width: 0,
			height: 0,
			pressure: 0,
			tangentialPressure: 0,
			tiltX: 0,
			tiltY: 0,
			twist: 0,
			pointerType: 0,
			isPrimary: 0
		})), E_ = Nn(R({}, o_, { submitter: 0 })), D_ = Nn(R({}, c_, {
			touches: 0,
			targetTouches: 0,
			changedTouches: 0,
			altKey: 0,
			metaKey: 0,
			ctrlKey: 0,
			shiftKey: 0,
			getModifierState: Fn
		})), O_ = Nn(R({}, o_, {
			propertyName: 0,
			elapsedTime: 0,
			pseudoElement: 0
		})), k_ = Nn(R({}, p_, {
			deltaX: function(e) {
				return "deltaX" in e ? e.deltaX : "wheelDeltaX" in e ? -e.wheelDeltaX : 0;
			},
			deltaY: function(e) {
				return "deltaY" in e ? e.deltaY : "wheelDeltaY" in e ? -e.wheelDeltaY : "wheelDelta" in e ? -e.wheelDelta : 0;
			},
			deltaZ: 0,
			deltaMode: 0
		})), A_ = Nn(R({}, o_, {
			newState: 0,
			oldState: 0,
			source: 0
		})), j_ = [
			9,
			13,
			27,
			32
		], M_ = 229, N_ = e_ && "CompositionEvent" in window, P_ = null;
		e_ && "documentMode" in document && (P_ = document.documentMode);
		var F_ = e_ && "TextEvent" in window && !P_, I_ = e_ && (!N_ || P_ && 8 < P_ && 11 >= P_), L_ = 32, R_ = String.fromCharCode(L_), z_ = !1, B_ = !1, V_ = {
			color: !0,
			date: !0,
			datetime: !0,
			"datetime-local": !0,
			email: !0,
			month: !0,
			number: !0,
			password: !0,
			range: !0,
			search: !0,
			tel: !0,
			text: !0,
			time: !0,
			url: !0,
			week: !0
		}, H_ = null, U_ = null, W_ = !1;
		e_ && (W_ = Vn("input") && (!document.documentMode || 9 < document.documentMode));
		var G_ = typeof Object.is == "function" ? Object.is : Qn, K_ = e_ && "documentMode" in document && 11 >= document.documentMode, q_ = null, J_ = null, Y_ = null, X_ = !1, Z_ = {
			animationend: sr("Animation", "AnimationEnd"),
			animationiteration: sr("Animation", "AnimationIteration"),
			animationstart: sr("Animation", "AnimationStart"),
			transitionrun: sr("Transition", "TransitionRun"),
			transitionstart: sr("Transition", "TransitionStart"),
			transitioncancel: sr("Transition", "TransitionCancel"),
			transitionend: sr("Transition", "TransitionEnd")
		}, Q_ = {}, $_ = {};
		e_ && ($_ = document.createElement("div").style, "AnimationEvent" in window || (delete Z_.animationend.animation, delete Z_.animationiteration.animation, delete Z_.animationstart.animation), "TransitionEvent" in window || delete Z_.transitionend.transition);
		var ev = cr("animationend"), tv = cr("animationiteration"), nv = cr("animationstart"), rv = cr("transitionrun"), iv = cr("transitionstart"), av = cr("transitioncancel"), ov = cr("transitionend"), sv = /* @__PURE__ */ new Map(), cv = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error fullscreenChange fullscreenError gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
		cv.push("scrollEnd");
		var lv = 0, uv = 0;
		if (typeof performance == "object" && typeof performance.now == "function") var dv = performance, fv = function() {
			return dv.now();
		};
		else {
			var pv = Date;
			fv = function() {
				return pv.now();
			};
		}
		var mv = typeof reportError == "function" ? reportError : function(e) {
			if (typeof window == "object" && typeof window.ErrorEvent == "function") {
				var t = new window.ErrorEvent("error", {
					bubbles: !0,
					cancelable: !0,
					message: typeof e == "object" && e && typeof e.message == "string" ? String(e.message) : String(e),
					error: e
				});
				if (!window.dispatchEvent(t)) return;
			} else if (typeof process == "object" && typeof process.emit == "function") {
				process.emit("uncaughtException", e);
				return;
			}
			console.error(e);
		}, hv = "This object has been omitted by React in the console log to avoid sending too much data from the server. Try logging smaller or more specific objects.", gv = 0, _v = 1, vv = 2, yv = 3, bv = 100, xv = "-\xA0", Sv = "+\xA0", Cv = " \xA0", wv = typeof console < "u" && typeof console.timeStamp == "function" && typeof performance < "u" && typeof performance.measure == "function", Tv = "Components ⚛", H = "Scheduler ⚛", U = "Blocking", Ev = !1, Dv = {
			color: "primary",
			properties: null,
			tooltipText: "",
			track: Tv
		}, Ov = {
			start: -0,
			end: -0,
			detail: { devtools: Dv }
		}, kv = ["Changed Props", ""], Av = "This component received deeply equal props. It might benefit from useMemo or the React Compiler in its owner.", jv = ["Changed Props", Av], Mv = 1, Nv = 2, Pv = [], Fv = 0, Iv = 0, Lv = {};
		Object.freeze(Lv);
		var Rv = null, zv = null, W = 0, Bv = 1, G = 2, Vv = 8, Hv = 16, Uv = 32, Wv = !1;
		try {
			Object.preventExtensions({});
		} catch {
			Wv = !0;
		}
		var Gv = /* @__PURE__ */ new WeakMap(), Kv = [], qv = 0, Jv = null, Yv = 0, Xv = [], Zv = 0, Qv = null, $v = 1, ey = "", ty = null, ny = null, K = !1, ry = !1, iy = null, ay = null, oy = !1, sy = Error("Hydration Mismatch Exception: This is not a real error, and should not leak into userspace. If you're seeing this, it's likely a bug in React."), cy = ve(null), ly = ve(null), uy = {}, dy = null, fy = null, py = !1, my = typeof AbortController < "u" ? AbortController : function() {
			var e = [], t = this.signal = {
				aborted: !1,
				addEventListener: function(t, n) {
					e.push(n);
				}
			};
			this.abort = function() {
				t.aborted = !0, e.forEach(function(e) {
					return e();
				});
			};
		}, hy = Sm.unstable_scheduleCallback, gy = Sm.unstable_NormalPriority, _y = {
			$$typeof: Pm,
			Consumer: null,
			Provider: null,
			_currentValue: null,
			_currentValue2: null,
			_threadCount: 0,
			_currentRenderer: null,
			_currentRenderer2: null
		}, vy = null, yy = Sm.unstable_now, by = console.createTask ? console.createTask : function() {
			return null;
		}, xy = 1, Sy = 2, Cy = -0, wy = -0, Ty = -0, Ey = null, Dy = -1.1, Oy = -0, ky = -0, q = -1.1, J = -1.1, Ay = null, jy = !1, My = -0, Ny = -1.1, Py = null, Fy = 0, Iy = null, Ly = null, Ry = -1.1, zy = null, By = -1.1, Vy = -1.1, Hy = -0, Uy = -1.1, Wy = -1.1, Gy = 0, Ky = null, qy = null, Jy = null, Yy = -1.1, Xy = null, Zy = -1.1, Qy = -1.1, $y = -0, eb = -0, tb = 0, nb = null, rb = 0, ib = -1.1, ab = !1, ob = !1, sb = null, cb = 0, lb = 0, ub = null, db = z.S;
		z.S = function(e, t) {
			if (BC = xh(), typeof t == "object" && t && typeof t.then == "function") {
				if (0 > Uy && 0 > Wy) {
					Uy = yy();
					var n = nf(), r = tf();
					(n !== Zy || r !== Xy) && (Zy = -1.1), Yy = n, Xy = r;
				}
				Zi(e, t);
			}
			if (vy !== null) for (n = jw; n !== null;) Ai(n, vy), n = n.next;
			if (n = e.types, n !== null) {
				for (r = jw; r !== null;) Ai(r, n), r = r.next;
				if (lb !== 0) {
					r = vy, r === null && (r = vy = []);
					for (var i = 0; i < n.length; i++) {
						var a = n[i];
						r.indexOf(a) === -1 && r.push(a);
					}
				}
			}
			db !== null && db(e, t);
		};
		var fb = ve(null), pb = {
			recordUnsafeLifecycleWarnings: function() {},
			flushPendingUnsafeLifecycleWarnings: function() {},
			recordLegacyContextWarning: function() {},
			flushLegacyContextWarning: function() {},
			discardPendingWarnings: function() {}
		}, mb = [], hb = [], gb = [], _b = [], vb = [], yb = [], bb = /* @__PURE__ */ new Set();
		pb.recordUnsafeLifecycleWarnings = function(e, t) {
			bb.has(e.type) || (typeof t.componentWillMount == "function" && !0 !== t.componentWillMount.__suppressDeprecationWarning && mb.push(e), e.mode & Vv && typeof t.UNSAFE_componentWillMount == "function" && hb.push(e), typeof t.componentWillReceiveProps == "function" && !0 !== t.componentWillReceiveProps.__suppressDeprecationWarning && gb.push(e), e.mode & Vv && typeof t.UNSAFE_componentWillReceiveProps == "function" && _b.push(e), typeof t.componentWillUpdate == "function" && !0 !== t.componentWillUpdate.__suppressDeprecationWarning && vb.push(e), e.mode & Vv && typeof t.UNSAFE_componentWillUpdate == "function" && yb.push(e));
		}, pb.flushPendingUnsafeLifecycleWarnings = function() {
			var e = /* @__PURE__ */ new Set();
			0 < mb.length && (mb.forEach(function(t) {
				e.add(C(t) || "Component"), bb.add(t.type);
			}), mb = []);
			var t = /* @__PURE__ */ new Set();
			0 < hb.length && (hb.forEach(function(e) {
				t.add(C(e) || "Component"), bb.add(e.type);
			}), hb = []);
			var n = /* @__PURE__ */ new Set();
			0 < gb.length && (gb.forEach(function(e) {
				n.add(C(e) || "Component"), bb.add(e.type);
			}), gb = []);
			var r = /* @__PURE__ */ new Set();
			0 < _b.length && (_b.forEach(function(e) {
				r.add(C(e) || "Component"), bb.add(e.type);
			}), _b = []);
			var i = /* @__PURE__ */ new Set();
			0 < vb.length && (vb.forEach(function(e) {
				i.add(C(e) || "Component"), bb.add(e.type);
			}), vb = []);
			var a = /* @__PURE__ */ new Set();
			if (0 < yb.length && (yb.forEach(function(e) {
				a.add(C(e) || "Component"), bb.add(e.type);
			}), yb = []), 0 < t.size) {
				var o = h(t);
				console.error("Using UNSAFE_componentWillMount in strict mode is not recommended and may indicate bugs in your code. See https://react.dev/link/unsafe-component-lifecycles for details.\n\n* Move code with side effects to componentDidMount, and set initial state in the constructor.\n\nPlease update the following components: %s", o);
			}
			0 < r.size && (o = h(r), console.error("Using UNSAFE_componentWillReceiveProps in strict mode is not recommended and may indicate bugs in your code. See https://react.dev/link/unsafe-component-lifecycles for details.\n\n* Move data fetching code or side effects to componentDidUpdate.\n* If you're updating state whenever props change, refactor your code to use memoization techniques or move it to static getDerivedStateFromProps. Learn more at: https://react.dev/link/derived-state\n\nPlease update the following components: %s", o)), 0 < a.size && (o = h(a), console.error("Using UNSAFE_componentWillUpdate in strict mode is not recommended and may indicate bugs in your code. See https://react.dev/link/unsafe-component-lifecycles for details.\n\n* Move data fetching code or side effects to componentDidUpdate.\n\nPlease update the following components: %s", o)), 0 < e.size && (o = h(e), console.warn("componentWillMount has been renamed, and is not recommended for use. See https://react.dev/link/unsafe-component-lifecycles for details.\n\n* Move code with side effects to componentDidMount, and set initial state in the constructor.\n* Rename componentWillMount to UNSAFE_componentWillMount to suppress this warning in non-strict mode. In React 18.x, only the UNSAFE_ name will work. To rename all deprecated lifecycles to their new names, you can run `npx react-codemod rename-unsafe-lifecycles` in your project source folder.\n\nPlease update the following components: %s", o)), 0 < n.size && (o = h(n), console.warn("componentWillReceiveProps has been renamed, and is not recommended for use. See https://react.dev/link/unsafe-component-lifecycles for details.\n\n* Move data fetching code or side effects to componentDidUpdate.\n* If you're updating state whenever props change, refactor your code to use memoization techniques or move it to static getDerivedStateFromProps. Learn more at: https://react.dev/link/derived-state\n* Rename componentWillReceiveProps to UNSAFE_componentWillReceiveProps to suppress this warning in non-strict mode. In React 18.x, only the UNSAFE_ name will work. To rename all deprecated lifecycles to their new names, you can run `npx react-codemod rename-unsafe-lifecycles` in your project source folder.\n\nPlease update the following components: %s", o)), 0 < i.size && (o = h(i), console.warn("componentWillUpdate has been renamed, and is not recommended for use. See https://react.dev/link/unsafe-component-lifecycles for details.\n\n* Move data fetching code or side effects to componentDidUpdate.\n* Rename componentWillUpdate to UNSAFE_componentWillUpdate to suppress this warning in non-strict mode. In React 18.x, only the UNSAFE_ name will work. To rename all deprecated lifecycles to their new names, you can run `npx react-codemod rename-unsafe-lifecycles` in your project source folder.\n\nPlease update the following components: %s", o));
		};
		var xb = /* @__PURE__ */ new Map(), Sb = /* @__PURE__ */ new Set();
		pb.recordLegacyContextWarning = function(e, t) {
			for (var n = null, r = e; r !== null;) r.mode & Vv && (n = r), r = r.return;
			n === null ? console.error("Expected to find a StrictMode component in a strict mode tree. This error is likely caused by a bug in React. Please file an issue.") : !Sb.has(e.type) && (r = xb.get(n), e.type.contextTypes != null || e.type.childContextTypes != null || t !== null && typeof t.getChildContext == "function") && (r === void 0 && (r = [], xb.set(n, r)), r.push(e));
		}, pb.flushLegacyContextWarning = function() {
			xb.forEach(function(e) {
				if (e.length !== 0) {
					var t = e[0], n = /* @__PURE__ */ new Set();
					e.forEach(function(e) {
						n.add(C(e) || "Component"), Sb.add(e.type);
					});
					var r = h(n);
					T(t, function() {
						console.error("Legacy context API has been detected within a strict-mode tree.\n\nThe old API will be supported in all 16.x releases, but applications using it should migrate to the new version.\n\nPlease update the following components: %s\n\nLearn more about this warning here: https://react.dev/link/legacy-context", r);
					});
				}
			});
		}, pb.discardPendingWarnings = function() {
			mb = [], hb = [], gb = [], _b = [], vb = [], yb = [], xb = /* @__PURE__ */ new Map();
		};
		var Cb = "", wb = { react_stack_bottom_frame: function(e, t, n) {
			var r = hh;
			hh = !0;
			try {
				return e(t, n);
			} finally {
				hh = r;
			}
		} }, Tb = wb.react_stack_bottom_frame.bind(wb), Eb = { react_stack_bottom_frame: function(e) {
			var t = hh;
			hh = !0;
			try {
				return e.render();
			} finally {
				hh = t;
			}
		} }, Db = Eb.react_stack_bottom_frame.bind(Eb), Ob = { react_stack_bottom_frame: function(e, t) {
			try {
				t.componentDidMount();
			} catch (t) {
				Gu(e, e.return, t);
			}
		} }, kb = Ob.react_stack_bottom_frame.bind(Ob), Ab = { react_stack_bottom_frame: function(e, t, n, r, i) {
			try {
				t.componentDidUpdate(n, r, i);
			} catch (t) {
				Gu(e, e.return, t);
			}
		} }, jb = Ab.react_stack_bottom_frame.bind(Ab), Mb = { react_stack_bottom_frame: function(e, t) {
			var n = t.stack;
			e.componentDidCatch(t.value, { componentStack: n === null ? "" : n });
		} }, Nb = Mb.react_stack_bottom_frame.bind(Mb), Pb = { react_stack_bottom_frame: function(e, t, n) {
			try {
				n.componentWillUnmount();
			} catch (n) {
				Gu(e, t, n);
			}
		} }, Fb = Pb.react_stack_bottom_frame.bind(Pb), Ib = { react_stack_bottom_frame: function(e) {
			var t = e.create;
			return e = e.inst, t = t(), e.destroy = t;
		} }, Lb = Ib.react_stack_bottom_frame.bind(Ib), Rb = { react_stack_bottom_frame: function(e, t, n) {
			try {
				n();
			} catch (n) {
				Gu(e, t, n);
			}
		} }, zb = Rb.react_stack_bottom_frame.bind(Rb), Bb = { react_stack_bottom_frame: function(e) {
			var t = e._init;
			return t(e._payload);
		} }, Vb = Bb.react_stack_bottom_frame.bind(Bb), Hb = Error("Suspense Exception: This is not a real error! It's an implementation detail of `use` to interrupt the current render. You must either rethrow it immediately, or move the `use` call outside of the `try/catch` block. Capturing without rethrowing will lead to unexpected behavior.\n\nTo handle async errors, wrap your component in an error boundary, or call the promise's `.catch` method and pass the result to `use`."), Ub = Error("Suspense Exception: This is not a real error, and should not leak into userspace. If you're seeing this, it's likely a bug in React."), Wb = Error("Suspense Exception: This is not a real error! It's an implementation detail of `useActionState` to interrupt the current render. You must either rethrow it immediately, or move the `useActionState` call outside of the `try/catch` block. Capturing without rethrowing will lead to unexpected behavior.\n\nTo handle async errors, wrap your component in an error boundary."), Gb = { then: function() {
			console.error("Internal React error: A listener was unexpectedly attached to a \"noop\" thenable. This is a bug in React. Please file an issue.");
		} }, Kb = null, qb = null, Jb = !1, Yb = null, Xb = !1, Zb = null, Qb = 0, Y = null, $b, ex = $b = !1, tx = {}, nx = {}, rx = {};
		m = function(e, t, n) {
			if (typeof n == "object" && n && n._store && (!n._store.validated && n.key == null || n._store.validated === 2)) {
				if (typeof n._store != "object") throw Error("React Component in warnForMissingKey should have a _store. This error is likely caused by a bug in React. Please file an issue.");
				n._store.validated = 1;
				var r = C(e), i = r || "null";
				if (!tx[i]) {
					tx[i] = !0, n = n._owner, e = e._debugOwner;
					var a = "";
					e && typeof e.tag == "number" && (i = C(e)) && (a = "\n\nCheck the render method of `" + i + "`."), a || r && (a = "\n\nCheck the top-level render call using <" + r + ">.");
					var o = "";
					n != null && e !== n && (r = null, typeof n.tag == "number" ? r = C(n) : typeof n.name == "string" && (r = n.name), r && (o = " It was passed a child from " + r + ".")), T(t, function() {
						console.error("Each child in a list should have a unique \"key\" prop.%s%s See https://react.dev/link/warning-keys for more information.", a, o);
					});
				}
			}
		};
		var ix = ba(!0), ax = ba(!1), ox = 0, sx = 1, cx = 2, lx = 3, ux = !1, dx = !1, fx = null, px = !1, mx = ve(null), hx = ve(0), gx = ve(null), _x = null, vx = 1, yx = 2, bx = ve(0), xx = 0, Sx = 1, Cx = 2, wx = 4, Tx = 8, Ex, Dx = /* @__PURE__ */ new Set(), Ox = /* @__PURE__ */ new Set(), kx = /* @__PURE__ */ new Set(), Ax = /* @__PURE__ */ new Set(), jx = 0, X = null, Mx = null, Nx = null, Px = !1, Fx = !1, Ix = !1, Lx = 0, Rx = 0, zx = null, Bx = 0, Vx = 25, Z = null, Hx = null, Ux = -1, Wx = !1, Gx = {
			readContext: wi,
			use: io,
			useCallback: Ka,
			useContext: Ka,
			useEffect: Ka,
			useImperativeHandle: Ka,
			useLayoutEffect: Ka,
			useInsertionEffect: Ka,
			useMemo: Ka,
			useReducer: Ka,
			useRef: Ka,
			useState: Ka,
			useDebugValue: Ka,
			useDeferredValue: Ka,
			useTransition: Ka,
			useSyncExternalStore: Ka,
			useId: Ka,
			useHostTransitionStatus: Ka,
			useFormState: Ka,
			useActionState: Ka,
			useOptimistic: Ka,
			useMemoCache: Ka,
			useCacheRefresh: Ka,
			useEffectEvent: Ka
		}, Kx = null, qx = null, Jx = null, Yx = null, Xx = null, Zx = null, Qx = null;
		Kx = {
			readContext: function(e) {
				return wi(e);
			},
			use: io,
			useCallback: function(e, t) {
				return Z = "useCallback", O(), Wa(t), Yo(e, t);
			},
			useContext: function(e) {
				return Z = "useContext", O(), wi(e);
			},
			useEffect: function(e, t) {
				return Z = "useEffect", O(), Wa(t), Vo(e, t);
			},
			useImperativeHandle: function(e, t, n) {
				return Z = "useImperativeHandle", O(), Wa(n), qo(e, t, n);
			},
			useInsertionEffect: function(e, t) {
				Z = "useInsertionEffect", O(), Wa(t), zo(4, Cx, e, t);
			},
			useLayoutEffect: function(e, t) {
				return Z = "useLayoutEffect", O(), Wa(t), Go(e, t);
			},
			useMemo: function(e, t) {
				Z = "useMemo", O(), Wa(t);
				var n = z.H;
				z.H = Xx;
				try {
					return Zo(e, t);
				} finally {
					z.H = n;
				}
			},
			useReducer: function(e, t, n) {
				Z = "useReducer", O();
				var r = z.H;
				z.H = Xx;
				try {
					return so(e, t, n);
				} finally {
					z.H = r;
				}
			},
			useRef: function(e) {
				return Z = "useRef", O(), Ro(e);
			},
			useState: function(e) {
				Z = "useState", O();
				var t = z.H;
				z.H = Xx;
				try {
					return bo(e);
				} finally {
					z.H = t;
				}
			},
			useDebugValue: function() {
				Z = "useDebugValue", O();
			},
			useDeferredValue: function(e, t) {
				return Z = "useDeferredValue", O(), j(e, t);
			},
			useTransition: function() {
				return Z = "useTransition", O(), cs();
			},
			useSyncExternalStore: function(e, t, n) {
				return Z = "useSyncExternalStore", O(), fo(e, t, n);
			},
			useId: function() {
				return Z = "useId", O(), fs();
			},
			useFormState: function(e, t) {
				return Z = "useFormState", O(), Ga(), Mo(e, t);
			},
			useActionState: function(e, t) {
				return Z = "useActionState", O(), Mo(e, t);
			},
			useOptimistic: function(e) {
				return Z = "useOptimistic", O(), xo(e);
			},
			useHostTransitionStatus: ds,
			useMemoCache: ao,
			useCacheRefresh: function() {
				return Z = "useCacheRefresh", O(), ps();
			},
			useEffectEvent: function(e) {
				return Z = "useEffectEvent", O(), Uo(e);
			}
		}, qx = {
			readContext: function(e) {
				return wi(e);
			},
			use: io,
			useCallback: function(e, t) {
				return Z = "useCallback", k(), Yo(e, t);
			},
			useContext: function(e) {
				return Z = "useContext", k(), wi(e);
			},
			useEffect: function(e, t) {
				return Z = "useEffect", k(), Vo(e, t);
			},
			useImperativeHandle: function(e, t, n) {
				return Z = "useImperativeHandle", k(), qo(e, t, n);
			},
			useInsertionEffect: function(e, t) {
				Z = "useInsertionEffect", k(), zo(4, Cx, e, t);
			},
			useLayoutEffect: function(e, t) {
				return Z = "useLayoutEffect", k(), Go(e, t);
			},
			useMemo: function(e, t) {
				Z = "useMemo", k();
				var n = z.H;
				z.H = Xx;
				try {
					return Zo(e, t);
				} finally {
					z.H = n;
				}
			},
			useReducer: function(e, t, n) {
				Z = "useReducer", k();
				var r = z.H;
				z.H = Xx;
				try {
					return so(e, t, n);
				} finally {
					z.H = r;
				}
			},
			useRef: function(e) {
				return Z = "useRef", k(), Ro(e);
			},
			useState: function(e) {
				Z = "useState", k();
				var t = z.H;
				z.H = Xx;
				try {
					return bo(e);
				} finally {
					z.H = t;
				}
			},
			useDebugValue: function() {
				Z = "useDebugValue", k();
			},
			useDeferredValue: function(e, t) {
				return Z = "useDeferredValue", k(), j(e, t);
			},
			useTransition: function() {
				return Z = "useTransition", k(), cs();
			},
			useSyncExternalStore: function(e, t, n) {
				return Z = "useSyncExternalStore", k(), fo(e, t, n);
			},
			useId: function() {
				return Z = "useId", k(), fs();
			},
			useActionState: function(e, t) {
				return Z = "useActionState", k(), Mo(e, t);
			},
			useFormState: function(e, t) {
				return Z = "useFormState", k(), Ga(), Mo(e, t);
			},
			useOptimistic: function(e) {
				return Z = "useOptimistic", k(), xo(e);
			},
			useHostTransitionStatus: ds,
			useMemoCache: ao,
			useCacheRefresh: function() {
				return Z = "useCacheRefresh", k(), ps();
			},
			useEffectEvent: function(e) {
				return Z = "useEffectEvent", k(), Uo(e);
			}
		}, Jx = {
			readContext: function(e) {
				return wi(e);
			},
			use: io,
			useCallback: function(e, t) {
				return Z = "useCallback", k(), Xo(e, t);
			},
			useContext: function(e) {
				return Z = "useContext", k(), wi(e);
			},
			useEffect: function(e, t) {
				Z = "useEffect", k(), Bo(2048, Tx, e, t);
			},
			useImperativeHandle: function(e, t, n) {
				return Z = "useImperativeHandle", k(), Jo(e, t, n);
			},
			useInsertionEffect: function(e, t) {
				return Z = "useInsertionEffect", k(), Bo(4, Cx, e, t);
			},
			useLayoutEffect: function(e, t) {
				return Z = "useLayoutEffect", k(), Bo(4, wx, e, t);
			},
			useMemo: function(e, t) {
				Z = "useMemo", k();
				var n = z.H;
				z.H = Zx;
				try {
					return Qo(e, t);
				} finally {
					z.H = n;
				}
			},
			useReducer: function(e, t, n) {
				Z = "useReducer", k();
				var r = z.H;
				z.H = Zx;
				try {
					return co(e, t, n);
				} finally {
					z.H = r;
				}
			},
			useRef: function() {
				return Z = "useRef", k(), A().memoizedState;
			},
			useState: function() {
				Z = "useState", k();
				var e = z.H;
				z.H = Zx;
				try {
					return co(oo);
				} finally {
					z.H = e;
				}
			},
			useDebugValue: function() {
				Z = "useDebugValue", k();
			},
			useDeferredValue: function(e, t) {
				return Z = "useDeferredValue", k(), $o(e, t);
			},
			useTransition: function() {
				return Z = "useTransition", k(), ls();
			},
			useSyncExternalStore: function(e, t, n) {
				return Z = "useSyncExternalStore", k(), po(e, t, n);
			},
			useId: function() {
				return Z = "useId", k(), A().memoizedState;
			},
			useFormState: function(e) {
				return Z = "useFormState", k(), Ga(), No(e);
			},
			useActionState: function(e) {
				return Z = "useActionState", k(), No(e);
			},
			useOptimistic: function(e, t) {
				return Z = "useOptimistic", k(), So(e, t);
			},
			useHostTransitionStatus: ds,
			useMemoCache: ao,
			useCacheRefresh: function() {
				return Z = "useCacheRefresh", k(), A().memoizedState;
			},
			useEffectEvent: function(e) {
				return Z = "useEffectEvent", k(), Wo(e);
			}
		}, Yx = {
			readContext: function(e) {
				return wi(e);
			},
			use: io,
			useCallback: function(e, t) {
				return Z = "useCallback", k(), Xo(e, t);
			},
			useContext: function(e) {
				return Z = "useContext", k(), wi(e);
			},
			useEffect: function(e, t) {
				Z = "useEffect", k(), Bo(2048, Tx, e, t);
			},
			useImperativeHandle: function(e, t, n) {
				return Z = "useImperativeHandle", k(), Jo(e, t, n);
			},
			useInsertionEffect: function(e, t) {
				return Z = "useInsertionEffect", k(), Bo(4, Cx, e, t);
			},
			useLayoutEffect: function(e, t) {
				return Z = "useLayoutEffect", k(), Bo(4, wx, e, t);
			},
			useMemo: function(e, t) {
				Z = "useMemo", k();
				var n = z.H;
				z.H = Qx;
				try {
					return Qo(e, t);
				} finally {
					z.H = n;
				}
			},
			useReducer: function(e, t, n) {
				Z = "useReducer", k();
				var r = z.H;
				z.H = Qx;
				try {
					return uo(e, t, n);
				} finally {
					z.H = r;
				}
			},
			useRef: function() {
				return Z = "useRef", k(), A().memoizedState;
			},
			useState: function() {
				Z = "useState", k();
				var e = z.H;
				z.H = Qx;
				try {
					return uo(oo);
				} finally {
					z.H = e;
				}
			},
			useDebugValue: function() {
				Z = "useDebugValue", k();
			},
			useDeferredValue: function(e, t) {
				return Z = "useDeferredValue", k(), es(e, t);
			},
			useTransition: function() {
				return Z = "useTransition", k(), us();
			},
			useSyncExternalStore: function(e, t, n) {
				return Z = "useSyncExternalStore", k(), po(e, t, n);
			},
			useId: function() {
				return Z = "useId", k(), A().memoizedState;
			},
			useFormState: function(e) {
				return Z = "useFormState", k(), Ga(), Io(e);
			},
			useActionState: function(e) {
				return Z = "useActionState", k(), Io(e);
			},
			useOptimistic: function(e, t) {
				return Z = "useOptimistic", k(), wo(e, t);
			},
			useHostTransitionStatus: ds,
			useMemoCache: ao,
			useCacheRefresh: function() {
				return Z = "useCacheRefresh", k(), A().memoizedState;
			},
			useEffectEvent: function(e) {
				return Z = "useEffectEvent", k(), Wo(e);
			}
		}, Xx = {
			readContext: function(e) {
				return d(), wi(e);
			},
			use: function(e) {
				return u(), io(e);
			},
			useCallback: function(e, t) {
				return Z = "useCallback", u(), O(), Yo(e, t);
			},
			useContext: function(e) {
				return Z = "useContext", u(), O(), wi(e);
			},
			useEffect: function(e, t) {
				return Z = "useEffect", u(), O(), Vo(e, t);
			},
			useImperativeHandle: function(e, t, n) {
				return Z = "useImperativeHandle", u(), O(), qo(e, t, n);
			},
			useInsertionEffect: function(e, t) {
				Z = "useInsertionEffect", u(), O(), zo(4, Cx, e, t);
			},
			useLayoutEffect: function(e, t) {
				return Z = "useLayoutEffect", u(), O(), Go(e, t);
			},
			useMemo: function(e, t) {
				Z = "useMemo", u(), O();
				var n = z.H;
				z.H = Xx;
				try {
					return Zo(e, t);
				} finally {
					z.H = n;
				}
			},
			useReducer: function(e, t, n) {
				Z = "useReducer", u(), O();
				var r = z.H;
				z.H = Xx;
				try {
					return so(e, t, n);
				} finally {
					z.H = r;
				}
			},
			useRef: function(e) {
				return Z = "useRef", u(), O(), Ro(e);
			},
			useState: function(e) {
				Z = "useState", u(), O();
				var t = z.H;
				z.H = Xx;
				try {
					return bo(e);
				} finally {
					z.H = t;
				}
			},
			useDebugValue: function() {
				Z = "useDebugValue", u(), O();
			},
			useDeferredValue: function(e, t) {
				return Z = "useDeferredValue", u(), O(), j(e, t);
			},
			useTransition: function() {
				return Z = "useTransition", u(), O(), cs();
			},
			useSyncExternalStore: function(e, t, n) {
				return Z = "useSyncExternalStore", u(), O(), fo(e, t, n);
			},
			useId: function() {
				return Z = "useId", u(), O(), fs();
			},
			useFormState: function(e, t) {
				return Z = "useFormState", u(), O(), Mo(e, t);
			},
			useActionState: function(e, t) {
				return Z = "useActionState", u(), O(), Mo(e, t);
			},
			useOptimistic: function(e) {
				return Z = "useOptimistic", u(), O(), xo(e);
			},
			useMemoCache: function(e) {
				return u(), ao(e);
			},
			useHostTransitionStatus: ds,
			useCacheRefresh: function() {
				return Z = "useCacheRefresh", O(), ps();
			},
			useEffectEvent: function(e) {
				return Z = "useEffectEvent", u(), O(), Uo(e);
			}
		}, Zx = {
			readContext: function(e) {
				return d(), wi(e);
			},
			use: function(e) {
				return u(), io(e);
			},
			useCallback: function(e, t) {
				return Z = "useCallback", u(), k(), Xo(e, t);
			},
			useContext: function(e) {
				return Z = "useContext", u(), k(), wi(e);
			},
			useEffect: function(e, t) {
				Z = "useEffect", u(), k(), Bo(2048, Tx, e, t);
			},
			useImperativeHandle: function(e, t, n) {
				return Z = "useImperativeHandle", u(), k(), Jo(e, t, n);
			},
			useInsertionEffect: function(e, t) {
				return Z = "useInsertionEffect", u(), k(), Bo(4, Cx, e, t);
			},
			useLayoutEffect: function(e, t) {
				return Z = "useLayoutEffect", u(), k(), Bo(4, wx, e, t);
			},
			useMemo: function(e, t) {
				Z = "useMemo", u(), k();
				var n = z.H;
				z.H = Zx;
				try {
					return Qo(e, t);
				} finally {
					z.H = n;
				}
			},
			useReducer: function(e, t, n) {
				Z = "useReducer", u(), k();
				var r = z.H;
				z.H = Zx;
				try {
					return co(e, t, n);
				} finally {
					z.H = r;
				}
			},
			useRef: function() {
				return Z = "useRef", u(), k(), A().memoizedState;
			},
			useState: function() {
				Z = "useState", u(), k();
				var e = z.H;
				z.H = Zx;
				try {
					return co(oo);
				} finally {
					z.H = e;
				}
			},
			useDebugValue: function() {
				Z = "useDebugValue", u(), k();
			},
			useDeferredValue: function(e, t) {
				return Z = "useDeferredValue", u(), k(), $o(e, t);
			},
			useTransition: function() {
				return Z = "useTransition", u(), k(), ls();
			},
			useSyncExternalStore: function(e, t, n) {
				return Z = "useSyncExternalStore", u(), k(), po(e, t, n);
			},
			useId: function() {
				return Z = "useId", u(), k(), A().memoizedState;
			},
			useFormState: function(e) {
				return Z = "useFormState", u(), k(), No(e);
			},
			useActionState: function(e) {
				return Z = "useActionState", u(), k(), No(e);
			},
			useOptimistic: function(e, t) {
				return Z = "useOptimistic", u(), k(), So(e, t);
			},
			useMemoCache: function(e) {
				return u(), ao(e);
			},
			useHostTransitionStatus: ds,
			useCacheRefresh: function() {
				return Z = "useCacheRefresh", k(), A().memoizedState;
			},
			useEffectEvent: function(e) {
				return Z = "useEffectEvent", u(), k(), Wo(e);
			}
		}, Qx = {
			readContext: function(e) {
				return d(), wi(e);
			},
			use: function(e) {
				return u(), io(e);
			},
			useCallback: function(e, t) {
				return Z = "useCallback", u(), k(), Xo(e, t);
			},
			useContext: function(e) {
				return Z = "useContext", u(), k(), wi(e);
			},
			useEffect: function(e, t) {
				Z = "useEffect", u(), k(), Bo(2048, Tx, e, t);
			},
			useImperativeHandle: function(e, t, n) {
				return Z = "useImperativeHandle", u(), k(), Jo(e, t, n);
			},
			useInsertionEffect: function(e, t) {
				return Z = "useInsertionEffect", u(), k(), Bo(4, Cx, e, t);
			},
			useLayoutEffect: function(e, t) {
				return Z = "useLayoutEffect", u(), k(), Bo(4, wx, e, t);
			},
			useMemo: function(e, t) {
				Z = "useMemo", u(), k();
				var n = z.H;
				z.H = Zx;
				try {
					return Qo(e, t);
				} finally {
					z.H = n;
				}
			},
			useReducer: function(e, t, n) {
				Z = "useReducer", u(), k();
				var r = z.H;
				z.H = Zx;
				try {
					return uo(e, t, n);
				} finally {
					z.H = r;
				}
			},
			useRef: function() {
				return Z = "useRef", u(), k(), A().memoizedState;
			},
			useState: function() {
				Z = "useState", u(), k();
				var e = z.H;
				z.H = Zx;
				try {
					return uo(oo);
				} finally {
					z.H = e;
				}
			},
			useDebugValue: function() {
				Z = "useDebugValue", u(), k();
			},
			useDeferredValue: function(e, t) {
				return Z = "useDeferredValue", u(), k(), es(e, t);
			},
			useTransition: function() {
				return Z = "useTransition", u(), k(), us();
			},
			useSyncExternalStore: function(e, t, n) {
				return Z = "useSyncExternalStore", u(), k(), po(e, t, n);
			},
			useId: function() {
				return Z = "useId", u(), k(), A().memoizedState;
			},
			useFormState: function(e) {
				return Z = "useFormState", u(), k(), Io(e);
			},
			useActionState: function(e) {
				return Z = "useActionState", u(), k(), Io(e);
			},
			useOptimistic: function(e, t) {
				return Z = "useOptimistic", u(), k(), wo(e, t);
			},
			useMemoCache: function(e) {
				return u(), ao(e);
			},
			useHostTransitionStatus: ds,
			useCacheRefresh: function() {
				return Z = "useCacheRefresh", k(), A().memoizedState;
			},
			useEffectEvent: function(e) {
				return Z = "useEffectEvent", u(), k(), Wo(e);
			}
		};
		var $x = {}, eS = /* @__PURE__ */ new Set(), tS = /* @__PURE__ */ new Set(), nS = /* @__PURE__ */ new Set(), rS = /* @__PURE__ */ new Set(), iS = /* @__PURE__ */ new Set(), aS = /* @__PURE__ */ new Set(), oS = /* @__PURE__ */ new Set(), sS = /* @__PURE__ */ new Set(), cS = /* @__PURE__ */ new Set(), lS = /* @__PURE__ */ new Set();
		Object.freeze($x);
		var uS = {
			enqueueSetState: function(e, t, n) {
				e = e._reactInternals;
				var r = ru(e), i = wa(r);
				i.payload = t, n != null && (Ss(n), i.callback = n), t = Ta(e, i, r), t !== null && (Mi(r, "this.setState()", e), ou(t, e, r), Ea(t, e, r));
			},
			enqueueReplaceState: function(e, t, n) {
				e = e._reactInternals;
				var r = ru(e), i = wa(r);
				i.tag = sx, i.payload = t, n != null && (Ss(n), i.callback = n), t = Ta(e, i, r), t !== null && (Mi(r, "this.replaceState()", e), ou(t, e, r), Ea(t, e, r));
			},
			enqueueForceUpdate: function(e, t) {
				e = e._reactInternals;
				var n = ru(e), r = wa(n);
				r.tag = cx, t != null && (Ss(t), r.callback = t), t = Ta(e, r, n), t !== null && (Mi(n, "this.forceUpdate()", e), ou(t, e, n), Ea(t, e, n));
			}
		}, dS = null, fS = null, pS = Error("This is not a real error. It's an implementation detail of React's selective hydration feature. If this leaks into userspace, it's a bug in React. Please file an issue."), mS = !1, hS = {}, gS = {}, _S = {}, vS = {}, yS = !1, bS = {}, xS = {}, SS = {}, CS = {
			dehydrated: null,
			treeContext: null,
			retryLane: 0,
			hydrationErrors: null
		}, wS = !1, TS = null;
		TS = /* @__PURE__ */ new Set();
		var ES = !1, DS = null, OS = null, kS = 0, AS = /* @__PURE__ */ new Map(), jS = {}, MS = 0, NS = 1, PS = 2, FS = !1, IS = !1, LS = !1, RS = !1, zS = typeof WeakSet == "function" ? WeakSet : Set, BS = null, VS = null, HS = null, US = !1, WS = !1, GS = !1, KS = !1, qS = null, JS = !1, YS = null, XS = !1, ZS = 8192, QS = {
			getCacheForType: function(e) {
				var t = wi(_y), n = t.data.get(e);
				return n === void 0 && (n = e(), t.data.set(e, n)), n;
			},
			cacheSignal: function() {
				return wi(_y).controller.signal;
			},
			getOwner: function() {
				return mh;
			}
		};
		if (typeof Symbol == "function" && Symbol.for) {
			var $S = Symbol.for;
			$S("selector.component"), $S("selector.has_pseudo_class"), $S("selector.role"), $S("selector.test_id"), $S("selector.text");
		}
		var eC = [], tC = typeof WeakMap == "function" ? WeakMap : Map, nC = 0, rC = 2, iC = 4, aC = 0, oC = 1, sC = 2, cC = 3, lC = 4, uC = 6, dC = 5, fC = nC, pC = null, Q = null, $ = 0, mC = 0, hC = 1, gC = 2, _C = 3, vC = 4, yC = 5, bC = 6, xC = 7, SC = 8, CC = 9, wC = mC, TC = null, EC = !1, DC = !1, OC = !1, kC = 0, AC = aC, jC = 0, MC = 0, NC = 0, PC = 0, FC = 0, IC = null, LC = null, RC = !1, zC = 0, BC = 0, VC = 300, HC = Infinity, UC = 500, WC = null, GC = null, KC = null, qC = 0, JC = 1, YC = 2, XC = 3, ZC = 0, QC = 1, $C = 2, ew = 3, tw = 4, nw = 5, rw = 0, iw = null, aw = null, ow = 0, sw = 0, cw = -0, lw = null, uw = null, dw = null, fw = null, pw = null, mw = null, hw = qC, gw = null, _w = 50, vw = 0, yw = null, bw = !1, xw = !1, Sw = 50, Cw = 0, ww = null, Tw = !1, Ew = !1, Dw = null, Ow = !1, kw = /* @__PURE__ */ new Set(), Aw = {}, jw = null, Mw = null, Nw = !1, Pw = !1, Fw = !1, Iw = !1, Lw = 0, Rw = {};
		(function() {
			for (var e = 0; e < cv.length; e++) {
				var t = cv[e], n = t.toLowerCase();
				t = t[0].toUpperCase() + t.slice(1), lr(n, "on" + t);
			}
			lr(ev, "onAnimationEnd"), lr(tv, "onAnimationIteration"), lr(nv, "onAnimationStart"), lr("dblclick", "onDoubleClick"), lr("focusin", "onFocus"), lr("focusout", "onBlur"), lr(rv, "onTransitionRun"), lr(iv, "onTransitionStart"), lr(av, "onTransitionCancel"), lr(ov, "onTransitionEnd");
		})(), yt("onMouseEnter", ["mouseout", "mouseover"]), yt("onMouseLeave", ["mouseout", "mouseover"]), yt("onPointerEnter", ["pointerout", "pointerover"]), yt("onPointerLeave", ["pointerout", "pointerover"]), vt("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" ")), vt("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")), vt("onBeforeInput", [
			"compositionend",
			"keypress",
			"textInput",
			"paste"
		]), vt("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" ")), vt("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" ")), vt("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
		var zw = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "), Bw = new Set("beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(zw)), Vw = "_reactListening" + Math.random().toString(36).slice(2), Hw = !1, Uw = !1, Ww = !1, Gw = !1, Kw = !1, qw = !1, Jw = !1, Yw = {}, Xw = /\r\n?/g, Zw = /\u0000|\uFFFD/g, Qw = "http://www.w3.org/1999/xlink", $w = "http://www.w3.org/XML/1998/namespace", eT = {}, tT = "javascript:throw new Error('React form unexpectedly submitted.')", nT = "suppressHydrationWarning", rT = "&", iT = "/&", aT = "$", oT = "/$", sT = "$?", cT = "$~", lT = "$!", uT = "html", dT = "body", fT = "head", pT = "F!", mT = "F", hT = "loading", gT = "style", _T = 0, vT = 1, yT = 2, bT = null, xT = null, ST = !1, CT = {
			dialog: !0,
			webview: !0
		}, wT = null, TT = void 0, ET = typeof setTimeout == "function" ? setTimeout : void 0, DT = typeof clearTimeout == "function" ? clearTimeout : void 0, OT = -1, kT = typeof Promise == "function" ? Promise : void 0, AT = typeof requestAnimationFrame == "function" ? requestAnimationFrame : ET, jT = typeof queueMicrotask == "function" ? queueMicrotask : kT === void 0 ? ET : function(e) {
			return kT.resolve(null).then(e).catch(rf);
		}, MT = 500;
		Mf.prototype.animate = function(e, t) {
			return t = typeof t == "number" ? { duration: t } : R({}, t), t.pseudoElement = this._selector, this._scope.animate(e, t);
		}, Mf.prototype.getAnimations = function() {
			for (var e = this._scope, t = this._selector, n = e.getAnimations({ subtree: !0 }), r = [], i = 0; i < n.length; i++) {
				var a = n[i].effect;
				a !== null && a.target === e && a.pseudoElement === t && r.push(n[i]);
			}
			return r;
		}, Mf.prototype.getComputedStyle = function() {
			return getComputedStyle(this._scope, this._selector);
		}, Pf.prototype.addEventListener = function(e, t, n) {
			var r = null, i = null;
			if (!(n != null && typeof n != "boolean" && (r = n.signal || null, r !== null && r.aborted))) {
				this._eventListeners === null && (this._eventListeners = []);
				var a = this._eventListeners;
				if (zf(a, e, t, n) === -1) {
					var o = this, s = t;
					n != null && typeof n != "boolean" && !0 === n.once && (s = function(r) {
						o.removeEventListener(e, t, n), typeof t == "function" ? t.call(this, r) : t.handleEvent(r);
					}), r !== null && (i = o.removeEventListener.bind(o, e, t, n), r.addEventListener("abort", i, { once: !0 }), i = r.removeEventListener.bind(r, "abort", i)), r = Lf(n), a.push({
						type: e,
						listener: t,
						optionsOrUseCapture: n,
						attachedListener: s,
						cleanup: i
					}), x(this._fragmentFiber, Ff, e, s, r);
				}
				this._eventListeners = a;
			}
		}, Pf.prototype.removeEventListener = function(e, t, n) {
			var r = this._eventListeners;
			if (r !== null && (t = zf(r, e, t, n), t !== -1)) {
				var i = r[t];
				n = i.attachedListener;
				var a = i.cleanup;
				i = Lf(i.optionsOrUseCapture), x(this._fragmentFiber, If, e, n, i), r.splice(t, 1), a !== null && a();
			}
		}, Pf.prototype.dispatchEvent = function(e) {
			var t = S(this._fragmentFiber);
			if (t === null) return !0;
			t = ue(t);
			var n = this._eventListeners;
			if (n !== null && 0 < n.length || !e.bubbles) {
				var r = t.nodeType === 9 ? t.createComment("") : document.createTextNode("");
				if (n) for (var i = 0; i < n.length; i++) {
					var a = n[i];
					r.addEventListener(a.type, a.attachedListener, Lf(a.optionsOrUseCapture));
				}
				if (t.appendChild(r), e = r.dispatchEvent(e), n) for (i = 0; i < n.length; i++) a = n[i], r.removeEventListener(a.type, a.attachedListener, Lf(a.optionsOrUseCapture));
				return t.removeChild(r), e;
			}
			return t.dispatchEvent(e);
		}, Pf.prototype.focus = function(e) {
			oe(this._fragmentFiber.child, !0, Bf, e, void 0, void 0);
		}, Pf.prototype.focusLast = function(e) {
			var t = [];
			oe(this._fragmentFiber.child, !0, Vf, t, void 0, void 0);
			for (var n = t.length - 1; 0 <= n && !Bf(t[n], e); n--);
		}, Pf.prototype.blur = function() {
			var e = S(this._fragmentFiber);
			e !== null && (e = ue(e), e = Jd(e).activeElement, e !== null && x(this._fragmentFiber, Hf, e));
		}, Pf.prototype.observeUsing = function(e) {
			var t = !1, n = !1;
			x(this._fragmentFiber, function(e) {
				if (e.tag === 6) t = !0;
				else return n = !0;
				return !1;
			}), t && !n && console.error("observeUsing() was called on a FragmentInstance with only text children. Observers do not work on text nodes."), this._observers === null && (this._observers = /* @__PURE__ */ new Set()), this._observers.add(e), x(this._fragmentFiber, Uf, e);
		}, Pf.prototype.unobserveUsing = function(e) {
			var t = this._observers;
			if (t !== null && t.has(e)) {
				t.delete(e), x(this._fragmentFiber, Wf, e);
				for (var n = t = 0; n < NT.length; n++) {
					var r = NT[n];
					r.fragmentInstance === this && r.observer === e ? e.unobserve(r.instance) : NT[t++] = r;
				}
				NT.length = t;
			} else console.error("You are calling unobserveUsing() with an observer that is not being observed with this fragment instance. First attach the observer with observeUsing()");
		};
		var NT = [], PT = !1;
		Pf.prototype.getClientRects = function() {
			var e = [];
			return x(this._fragmentFiber, Kf, e), e;
		}, Pf.prototype.getRootNode = function(e) {
			var t = S(this._fragmentFiber);
			return t === null ? this : ue(t).getRootNode(e);
		}, Pf.prototype.compareDocumentPosition = function(e) {
			var t = S(this._fragmentFiber);
			if (t === null) return Node.DOCUMENT_POSITION_DISCONNECTED;
			var n = [];
			x(this._fragmentFiber, Vf, n);
			var r = ue(t);
			if (n.length === 0) {
				if (t = r, se(this._fragmentFiber)) {
					a: {
						for (n = this._fragmentFiber.return; n !== null;) {
							if (n.tag === 4) {
								n = n.stateNode.containerInfo;
								break a;
							}
							if (n.tag === 3 || n.tag === 5 || n.tag === 27) break;
							n = n.return;
						}
						n = null;
					}
					n != null && (t = n);
				}
				n = this._fragmentFiber;
				var i = r = t.compareDocumentPosition(e);
				return t === e ? i = Node.DOCUMENT_POSITION_CONTAINS : r & Node.DOCUMENT_POSITION_CONTAINED_BY && (n = ce(n)[1], n === null ? i = Node.DOCUMENT_POSITION_PRECEDING : (e = ue(n).compareDocumentPosition(e), i = e === 0 || e & Node.DOCUMENT_POSITION_FOLLOWING ? Node.DOCUMENT_POSITION_FOLLOWING : Node.DOCUMENT_POSITION_PRECEDING)), i |= Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC;
			}
			t = ue(n[0]), i = ue(n[n.length - 1]);
			var a = se(this._fragmentFiber) ? t.parentElement : r;
			if (a == null) return Node.DOCUMENT_POSITION_DISCONNECTED;
			r = a.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_CONTAINED_BY, a = a.compareDocumentPosition(i) & Node.DOCUMENT_POSITION_CONTAINED_BY;
			var o = t.compareDocumentPosition(e), s = i.compareDocumentPosition(e), c = o & Node.DOCUMENT_POSITION_CONTAINED_BY || s & Node.DOCUMENT_POSITION_CONTAINED_BY;
			return s = r && a && o & Node.DOCUMENT_POSITION_FOLLOWING && s & Node.DOCUMENT_POSITION_PRECEDING, t = r && t === e || a && i === e || c || s ? Node.DOCUMENT_POSITION_CONTAINED_BY : !r && t === e || !a && i === e ? Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC : o, t & Node.DOCUMENT_POSITION_DISCONNECTED || t & Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC || qf(t, this._fragmentFiber, n[0], n[n.length - 1], e) ? t : Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC;
		}, Pf.prototype.scrollIntoView = function(e) {
			if (typeof e == "object") throw Error("FragmentInstance.scrollIntoView() does not support scrollIntoViewOptions. Use the alignToTop boolean instead.");
			var t = [];
			x(this._fragmentFiber, Vf, t);
			var n = !1 !== e;
			if (t.length === 0) {
				var r = ce(this._fragmentFiber);
				if (r = n ? r[1] || r[0] || S(this._fragmentFiber) : r[0] || r[1], r === null) return;
				if (r.tag === 6) {
					e = ue(r), Jf(e, n);
					return;
				}
				if (r = ue(r), r.nodeType !== 9) {
					if (r.nodeType === 11) {
						n = "host" in r ? r.host : null, n === null ? console.warn("You are attempting to scroll a FragmentInstance that is only mounted inside a detached DocumentFragment. No scroll was performed.") : n.scrollIntoView(e);
						return;
					}
					r.scrollIntoView(e);
				}
			}
			for (r = n ? t.length - 1 : 0; r !== (n ? -1 : t.length);) {
				var i = t[r];
				i.tag === 6 ? (i = ue(i), Jf(i, n)) : ue(i).scrollIntoView(e), r += n ? -1 : 1;
			}
		};
		var FT = null, IT = 0, LT = 1, RT = 2, zT = 3, BT = 4, VT = /* @__PURE__ */ new Map(), HT = /* @__PURE__ */ new Set(), UT = B.d;
		B.d = {
			f: function() {
				var e = UT.f(), t = du();
				return e || t;
			},
			r: function(e) {
				var t = pt(e);
				t !== null && t.tag === 5 && t.type === "form" ? ss(t) : UT.r(e);
			},
			D: function(e) {
				UT.D(e), bp("dns-prefetch", e, null);
			},
			C: function(e, t) {
				UT.C(e, t), bp("preconnect", e, t);
			},
			L: function(e, t, n) {
				UT.L(e, t, n);
				var r = WT;
				if (r && e && t) {
					var i = "link[rel=\"preload\"][as=\"" + Mt(t) + "\"]";
					t === "image" && n && n.imageSrcSet ? (i += "[imagesrcset=\"" + Mt(n.imageSrcSet) + "\"]", typeof n.imageSizes == "string" && (i += "[imagesizes=\"" + Mt(n.imageSizes) + "\"]")) : i += "[href=\"" + Mt(e) + "\"]";
					var a = i;
					switch (t) {
						case "style":
							a = Cp(e);
							break;
						case "script": a = Dp(e);
					}
					if (!(VT.has(a) || (e = R({
						rel: "preload",
						href: t === "image" && n && n.imageSrcSet ? void 0 : e,
						as: t
					}, n), VT.set(a, e), r.querySelector(i) !== null || t === "style" && r.querySelector(wp(a)) || t === "script" && r.querySelector(Op(a))))) {
						var o = r.createElement("link");
						Pd(o, "link", e), t === "style" && (o[$h] = !0, o.onload = o.onerror = function() {
							_t(o);
						}), gt(o), r.head.appendChild(o);
					}
				}
			},
			m: function(e, t) {
				UT.m(e, t);
				var n = WT;
				if (n && e) {
					var r = t && typeof t.as == "string" ? t.as : "script", i = "link[rel=\"modulepreload\"][as=\"" + Mt(r) + "\"][href=\"" + Mt(e) + "\"]", a = i;
					switch (r) {
						case "audioworklet":
						case "paintworklet":
						case "serviceworker":
						case "sharedworker":
						case "worker":
						case "script": a = Dp(e);
					}
					if (!VT.has(a) && (e = R({
						rel: "modulepreload",
						href: e
					}, t), VT.set(a, e), n.querySelector(i) === null)) {
						switch (r) {
							case "audioworklet":
							case "paintworklet":
							case "serviceworker":
							case "sharedworker":
							case "worker":
							case "script": if (n.querySelector(Op(a))) return;
						}
						r = n.createElement("link"), Pd(r, "link", e), gt(r), n.head.appendChild(r);
					}
				}
			},
			X: function(e, t) {
				UT.X(e, t);
				var n = WT;
				if (n && e) {
					var r = ht(n).hoistableScripts, i = Dp(e), a = r.get(i);
					a || (a = n.querySelector(Op(i)), a || (e = R({
						src: e,
						async: !0
					}, t), (t = VT.get(i)) && Mp(e, t), a = n.createElement("script"), gt(a), Pd(a, "link", e), n.head.appendChild(a)), a = {
						type: "script",
						instance: a,
						count: 1,
						state: null
					}, r.set(i, a));
				}
			},
			S: function(e, t, n) {
				UT.S(e, t, n);
				var r = WT;
				if (r && e) {
					var i = ht(r).hoistableStyles, a = Cp(e);
					t ||= "default";
					var o = i.get(a);
					if (!o) {
						var s = {
							loading: IT,
							preload: null
						};
						if (o = r.querySelector(wp(a))) s.loading = LT | BT;
						else {
							e = R({
								rel: "stylesheet",
								href: e,
								"data-precedence": t
							}, n), (n = VT.get(a)) && jp(e, n);
							var c = o = r.createElement("link");
							gt(c), Pd(c, "link", e), c._p = new Promise(function(e, t) {
								c.onload = e, c.onerror = t;
							}), c.addEventListener("load", function() {
								s.loading |= LT;
							}), c.addEventListener("error", function() {
								s.loading |= RT;
							}), s.loading |= BT, Ap(o, t, r);
						}
						o = {
							type: "stylesheet",
							instance: o,
							count: 1,
							state: s
						}, i.set(a, o);
					}
				}
			},
			M: function(e, t) {
				UT.M(e, t);
				var n = WT;
				if (n && e) {
					var r = ht(n).hoistableScripts, i = Dp(e), a = r.get(i);
					a || (a = n.querySelector(Op(i)), a || (e = R({
						src: e,
						async: !0,
						type: "module"
					}, t), (t = VT.get(i)) && Mp(e, t), a = n.createElement("script"), gt(a), Pd(a, "link", e), n.head.appendChild(a)), a = {
						type: "script",
						instance: a,
						count: 1,
						state: null
					}, r.set(i, a));
				}
			}
		};
		var WT = typeof document > "u" ? null : document, GT = null, KT = 6e4, qT = 800, JT = 500, YT = 0, XT = null, ZT = null, QT = Jm, $T = {
			$$typeof: Pm,
			Provider: null,
			Consumer: null,
			_currentValue: QT,
			_currentValue2: QT,
			_threadCount: 0
		}, eE = "%c%s%c", tE = "background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px", nE = "", rE = " ", iE = Function.prototype.bind, aE = !1, oE = null, sE = null, cE = null, lE = null, uE = null, dE = null, fE = null, pE = null, mE = null, hE = null;
		oE = function(e, r, i, a) {
			r = t(e, r), r !== null && (i = n(r.memoizedState, i, 0, a), r.memoizedState = i, r.baseState = i, e.memoizedProps = R({}, e.memoizedProps), i = Pr(e, 2), i !== null && ou(i, e, 2));
		}, sE = function(e, n, r) {
			n = t(e, n), n !== null && (r = o(n.memoizedState, r, 0), n.memoizedState = r, n.baseState = r, e.memoizedProps = R({}, e.memoizedProps), r = Pr(e, 2), r !== null && ou(r, e, 2));
		}, cE = function(e, n, r, a) {
			n = t(e, n), n !== null && (r = i(n.memoizedState, r, a), n.memoizedState = r, n.baseState = r, e.memoizedProps = R({}, e.memoizedProps), r = Pr(e, 2), r !== null && ou(r, e, 2));
		}, lE = function(e, t, r) {
			e.pendingProps = n(e.memoizedProps, t, 0, r), e.alternate && (e.alternate.pendingProps = e.pendingProps), t = Pr(e, 2), t !== null && ou(t, e, 2);
		}, uE = function(e, t) {
			e.pendingProps = o(e.memoizedProps, t, 0), e.alternate && (e.alternate.pendingProps = e.pendingProps), t = Pr(e, 2), t !== null && ou(t, e, 2);
		}, dE = function(e, t, n) {
			e.pendingProps = i(e.memoizedProps, t, n), e.alternate && (e.alternate.pendingProps = e.pendingProps), t = Pr(e, 2), t !== null && ou(t, e, 2);
		}, fE = function(e) {
			var t = Pr(e, 2);
			t !== null && ou(t, e, 2);
		}, pE = function(e) {
			var t = Qe(), n = Pr(e, t);
			n !== null && ou(n, e, t);
		}, mE = function(e) {
			c = e;
		}, hE = function(e) {
			s = e;
		};
		var gE = !0, _E = null, vE = !1, yE = null, bE = null, xE = null, SE = /* @__PURE__ */ new Map(), CE = /* @__PURE__ */ new Map(), wE = [], TE = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(" "), EE = null;
		if (bm.prototype.render = ym.prototype.render = function(e) {
			var t = this._internalRoot;
			if (t === null) throw Error("Cannot update an unmounted root.");
			var n = arguments;
			typeof n[1] == "function" ? console.error("does not support the second callback argument. To execute a side effect after rendering, declare it in a component body with useEffect().") : b(n[1]) ? console.error("You passed a container to the second argument of root.render(...). You don't need to pass it again since you already passed it to create the root.") : n[1] !== void 0 && console.error("You passed a second argument to root.render(...) but it only accepts one argument."), n = e;
			var r = t.current;
			Xp(r, ru(r), n, t, null, null);
		}, bm.prototype.unmount = ym.prototype.unmount = function() {
			var e = arguments;
			if (typeof e[0] == "function" && console.error("does not support a callback argument. To execute a side effect after rendering, declare it in a component body with useEffect()."), e = this._internalRoot, e !== null) {
				this._internalRoot = null;
				var t = e.containerInfo;
				(fC & (rC | iC)) !== nC && console.error("Attempted to synchronously unmount a root while React was already rendering. React cannot finish unmounting the root until the current render has completed, which may lead to a race condition."), Xp(e.current, 2, null, e, null, null), du(), t[qh] = null;
			}
		}, bm.prototype.unstable_scheduleHydration = function(e) {
			if (e) {
				var t = lt();
				e = {
					blockedOn: null,
					target: e,
					priority: t
				};
				for (var n = 0; n < wE.length && t !== 0 && t < wE[n].priority; n++);
				wE.splice(n, 0, e), n === 0 && dm(e);
			}
		}, (function() {
			var e = Cm.version;
			if (e !== "19.3.0") throw Error("Incompatible React versions: The \"react\" and \"react-dom\" packages must have the exact same version. Instead got:\n  - react:      " + (e + "\n  - react-dom:  19.3.0\nLearn more: https://react.dev/warnings/version-mismatch"));
		})(), typeof Map == "function" && Map.prototype != null && typeof Map.prototype.forEach == "function" && typeof Set == "function" && Set.prototype != null && typeof Set.prototype.clear == "function" && typeof Set.prototype.forEach == "function" || console.error("React depends on Map and Set built-in types. Make sure that you load a polyfill in older browsers. https://react.dev/link/react-polyfills"), B.findDOMNode = function(e) {
			var t = e._reactInternals;
			if (t === void 0) throw typeof e.render == "function" ? Error("Unable to find node on an unmounted component.") : (e = Object.keys(e).join(","), Error("Argument appears to not be a ReactComponent. Keys: " + e));
			return e = ie(t), e = e === null ? null : ae(e), e = e === null ? null : e.stateNode, e;
		}, !(function() {
			var e = {
				bundleType: 1,
				version: "19.3.0",
				rendererPackageName: "react-dom",
				currentDispatcherRef: z,
				reconcilerVersion: "19.3.0"
			};
			return e.overrideHookState = oE, e.overrideHookStateDeletePath = sE, e.overrideHookStateRenamePath = cE, e.overrideProps = lE, e.overridePropsDeletePath = uE, e.overridePropsRenamePath = dE, e.scheduleUpdate = fE, e.scheduleRetry = pE, e.setErrorHandler = mE, e.setSuspenseHandler = hE, e.scheduleRefresh = v, e.scheduleRoot = _, e.setRefreshHandler = y, e.getCurrentFiber = tm, We(e);
		})() && e_ && window.top === window.self && (-1 < navigator.userAgent.indexOf("Chrome") && navigator.userAgent.indexOf("Edge") === -1 || -1 < navigator.userAgent.indexOf("Firefox"))) {
			var DE = window.location.protocol;
			/^(https?|file):$/.test(DE) && console.info("%cDownload the React DevTools for a better development experience: https://react.dev/link/react-devtools" + (DE === "file:" ? "\nYou might need to use a local HTTP server (instead of file://): https://react.dev/link/react-devtools-faq" : ""), "font-weight:bold");
		}
		e.createRoot = function(e, t) {
			if (!b(e)) throw Error("Target container is not a DOM element.");
			xm(e);
			var n = !1, r = "", i = Ds, a = Os, o = ks;
			return t != null && (t.hydrate ? console.warn("hydrate through createRoot is deprecated. Use ReactDOMClient.hydrateRoot(container, <App />) instead.") : typeof t == "object" && t && t.$$typeof === Om && console.error("You passed a JSX element to createRoot. You probably meant to call root.render instead. Example usage:\n\n  let root = createRoot(domContainer);\n  root.render(<App />);"), !0 === t.unstable_strictMode && (n = !0), t.identifierPrefix !== void 0 && (r = t.identifierPrefix), t.onUncaughtError !== void 0 && (i = t.onUncaughtError), t.onCaughtError !== void 0 && (a = t.onCaughtError), t.onRecoverableError !== void 0 && (o = t.onRecoverableError)), t = Jp(e, 1, !1, null, null, n, r, null, i, a, o, vm), e[qh] = t.current, _d(e), new ym(t);
		}, e.hydrateRoot = function(e, t, n) {
			if (!b(e)) throw Error("Target container is not a DOM element.");
			xm(e), t === void 0 && console.error("Must provide initial children as second argument to hydrateRoot. Example usage: hydrateRoot(domContainer, <App />)");
			var r = !1, i = "", a = Ds, o = Os, s = ks, c = null;
			return n != null && (!0 === n.unstable_strictMode && (r = !0), n.identifierPrefix !== void 0 && (i = n.identifierPrefix), n.onUncaughtError !== void 0 && (a = n.onUncaughtError), n.onCaughtError !== void 0 && (o = n.onCaughtError), n.onRecoverableError !== void 0 && (s = n.onRecoverableError), n.formState !== void 0 && (c = n.formState)), t = Jp(e, 1, !0, t, n ?? null, r, i, c, a, o, s, vm), t.context = Yp(null), n = t.current, r = ru(n), r = at(r), i = wa(r), i.callback = null, Ta(n, i, r), Mi(r, "hydrateRoot()", null), n = r, t.current.lanes = n, et(t, n), id(t), e[qh] = t.current, _d(e), new bm(t);
		}, e.version = "19.3.0", typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop == "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
	})();
})), h = /* @__PURE__ */ a(((e, t) => {
	function n() {
		if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE == "function") {
			if (process.env.NODE_ENV !== "production") throw Error("^_^");
			try {
				__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n);
			} catch (e) {
				console.error(e);
			}
		}
	}
	process.env.NODE_ENV === "production" ? (n(), t.exports = p()) : t.exports = m();
})), g = r(), _ = h(), v = "google-identity-services", y = "https://accounts.google.com/gsi/client?hl=de", b = null, ee = !1, te = null, ne = null;
function re() {
	return window.google?.accounts?.id || null;
}
function ie(e) {
	let t = String.fromCharCode(...e);
	return btoa(t).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}
async function ae() {
	let e = ie(crypto.getRandomValues(/* @__PURE__ */ new Uint8Array(32))), t = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(e));
	return {
		nonce: e,
		hashedNonce: [...new Uint8Array(t)].map((e) => e.toString(16).padStart(2, "0")).join("")
	};
}
async function x() {
	return re() || b || (b = new Promise((e, t) => {
		let n = document.getElementById(v), r = n || document.createElement("script"), i = window.setTimeout(() => {
			t(/* @__PURE__ */ Error("Google Identity Services wurde nicht rechtzeitig geladen."));
		}, 12e3);
		r.addEventListener("load", () => {
			window.clearTimeout(i);
			let n = re();
			if (!n) {
				t(/* @__PURE__ */ Error("Google Identity Services ist nicht verfügbar."));
				return;
			}
			e(n);
		}, { once: !0 }), r.addEventListener("error", () => {
			window.clearTimeout(i), t(/* @__PURE__ */ Error("Google Identity Services konnte nicht geladen werden."));
		}, { once: !0 }), n || (r.id = v, r.src = y, r.async = !0, r.defer = !0, r.referrerPolicy = "strict-origin-when-cross-origin", document.head.append(r));
	}).catch((e) => {
		throw b = null, e;
	}), b);
}
async function oe(t, n) {
	let r = await x(), i = e();
	te = n, ne ||= ae();
	let a = await ne;
	ee ||= (r.initialize({
		client_id: i.googleClientId,
		callback: (e) => {
			let t = String(e?.credential || "");
			te?.(t, a.nonce);
		},
		context: "signin",
		ux_mode: "popup",
		nonce: a.hashedNonce,
		auto_select: !1,
		itp_support: !0,
		use_fedcm_for_button: !0,
		button_auto_select: !1
	}), !0), t.replaceChildren(), r.renderButton(t, {
		type: "standard",
		theme: "filled_blue",
		size: "large",
		text: "signin_with",
		shape: "pill",
		logo_alignment: "left",
		width: Math.min(360, Math.max(220, Math.floor(t.getBoundingClientRect().width || 320))),
		locale: "de"
	});
}
//#endregion
//#region src/components/LoginGate.tsx
var S = t();
function se({ onCredential: e, onDevPortalLogin: t }) {
	let n = (0, g.useRef)(null), [r, i] = (0, g.useState)("");
	(0, g.useEffect)(() => {
		if (t) return;
		let r = n.current;
		if (!r) return;
		let a = !1;
		return oe(r, async (t, n) => {
			if (!a) {
				i("Google-Anmeldung wird geprüft …");
				try {
					await e(t, n);
				} catch (e) {
					a || i(e instanceof Error ? e.message : "Anmeldung fehlgeschlagen.");
				}
			}
		}).catch((e) => {
			a || i(e instanceof Error ? e.message : "Google-Anmeldung konnte nicht geladen werden.");
		}), () => {
			a = !0;
		};
	}, [e, t]);
	async function a() {
		if (t) {
			i("DEV-Portal wird geöffnet …");
			try {
				await t();
			} catch (e) {
				i(e instanceof Error ? e.message : "DEV-Portal konnte nicht geöffnet werden.");
			}
		}
	}
	return /* @__PURE__ */ (0, S.jsxs)("section", {
		className: "card auth-card",
		children: [
			/* @__PURE__ */ (0, S.jsx)("p", {
				className: "eyebrow",
				children: "Plärrdeifl Liveticker"
			}),
			/* @__PURE__ */ (0, S.jsx)("h1", { children: "Anmelden" }),
			/* @__PURE__ */ (0, S.jsx)("p", { children: "Melde dich mit deinem bestehenden Portal-Konto an." }),
			t ? /* @__PURE__ */ (0, S.jsx)("button", {
				type: "button",
				onClick: () => void a(),
				children: "Über DEV-Portal anmelden"
			}) : /* @__PURE__ */ (0, S.jsx)("div", {
				ref: n,
				className: "google-slot",
				"aria-label": "Mit Google anmelden"
			}),
			/* @__PURE__ */ (0, S.jsx)("p", {
				className: "status",
				role: "status",
				children: r
			})
		]
	});
}
//#endregion
//#region src/platform/auth.ts
function ce(e) {
	if (!e || e.state !== "ACTIVE") return !1;
	let t = new Set(e.permissions || []);
	return t.has("portal.admin") || t.has("liveticker.manage");
}
async function le() {
	let { data: e, error: t } = await n().auth.getSession();
	if (t) throw t;
	let r = e.session;
	if (!r) return {
		session: null,
		user: null,
		bootstrap: null,
		authenticated: !1,
		active: !1,
		allowed: !1
	};
	let i = await o("bootstrap"), a = ce(i);
	{
		let e = await o("cockpit_access_get"), t = e && typeof e == "object" && !Array.isArray(e) ? e : null, n = t?.portal, i = t?.cockpit, s = t?.permissions?.liveticker;
		if (!t || t.schemaVersion !== 1 || t.userId !== r.user.id || typeof n?.active != "boolean" || typeof i?.allowed != "boolean" || typeof s?.effectiveAllowed != "boolean" || s.capability !== "liveticker.manage") throw Error("Der serverseitige Cockpit-Liveticker-Zugang ist ungültig.");
		a = n.active && i.allowed && s.effectiveAllowed;
	}
	return {
		session: r,
		user: r.user,
		bootstrap: i,
		authenticated: !0,
		active: i.state === "ACTIVE",
		allowed: a
	};
}
async function ue(e, t = "") {
	let r = String(e || "").trim();
	if (!r) throw Error("Google hat kein gültiges ID-Token zurückgegeben.");
	let i = n(), a = {
		provider: "google",
		token: r
	};
	t && (a.nonce = t);
	let { data: o, error: s } = await i.auth.signInWithIdToken(a);
	if (s) throw s;
	if (!o.session) throw Error("Die Google-Anmeldung hat keine Portalsitzung erzeugt.");
	return le();
}
async function de() {
	let { error: e } = await n().auth.signOut();
	if (e) throw e;
}
//#endregion
//#region src/platform/dev-handoff.ts
var fe = "https://dev.plaerrdeifl.de/liveticker-local-handoff", pe = "pd_session";
function me(e) {
	return typeof e == "string" ? e.trim() : "";
}
function he(e) {
	let t = String(e || "").replace(/^#/, "");
	if (!t) return null;
	let n = new URLSearchParams(t).get(pe);
	if (!n) return null;
	try {
		let e = JSON.parse(n), t = me(e.accessToken), r = me(e.refreshToken);
		return !t || !r ? null : {
			accessToken: t,
			refreshToken: r
		};
	} catch {
		return null;
	}
}
function ge() {
	let e = window.location.pathname + window.location.search;
	window.history.replaceState(null, "", e);
}
async function _e() {
	if (e().environment !== "DEV") return !1;
	let t = he(window.location.hash);
	if (!t) return !1;
	ge();
	let r = n(), { error: i } = await r.auth.setSession({
		access_token: t.accessToken,
		refresh_token: t.refreshToken
	});
	if (i) throw i;
	let { data: a, error: o } = await r.auth.getUser();
	if (o) throw o;
	if (!a.user) throw Error("Die übergebene DEV-Portalsitzung konnte nicht bestätigt werden.");
	return !0;
}
//#endregion
//#region src/App.tsx
var C = (0, g.lazy)(async () => ({ default: (await import("./chunks/GameWorkspace-DIEBLarW.js")).GameWorkspace })), ve = (0, g.lazy)(async () => ({ default: (await import("./chunks/LivetickerAdmin-BV1eCoTH.js")).LivetickerAdmin }));
function ye() {
	let [t, n] = (0, g.useState)({ kind: "loading" }), [r, a] = (0, g.useState)("ticker"), o = (0, g.useCallback)(async () => {
		n({ kind: "loading" });
		try {
			await _e();
			let e = await i();
			if (!e.available || e.mode === "MAINTENANCE") {
				n({
					kind: "maintenance",
					platform: e
				});
				return;
			}
			let t = await le();
			if (!t.authenticated) {
				n({ kind: "signed-out" });
				return;
			}
			if (!t.allowed) {
				n({
					kind: "denied",
					auth: t
				});
				return;
			}
			n({
				kind: "ready",
				auth: t,
				platform: e
			});
		} catch (e) {
			n({
				kind: "error",
				message: e instanceof Error ? e.message : "Liveticker konnte nicht gestartet werden."
			});
		}
	}, []);
	(0, g.useEffect)(() => {
		o();
	}, [o]);
	let s = (0, g.useCallback)(async (e, t) => {
		let r = await ue(e, t), a = await i();
		if (!a.available || a.mode === "MAINTENANCE") {
			n({
				kind: "maintenance",
				platform: a
			});
			return;
		}
		if (!r.allowed) {
			n({
				kind: "denied",
				auth: r
			});
			return;
		}
		n({
			kind: "ready",
			auth: r,
			platform: a
		});
	}, []);
	(0, g.useCallback)(async () => {
		window.location.assign(fe);
	}, []);
	let c = (0, g.useCallback)(async () => {
		await de(), n({ kind: "signed-out" });
	}, []);
	if (t.kind === "loading") return /* @__PURE__ */ (0, S.jsx)("main", {
		className: "shell",
		children: /* @__PURE__ */ (0, S.jsxs)("section", {
			className: "card",
			children: [
				/* @__PURE__ */ (0, S.jsx)("p", {
					className: "eyebrow",
					children: "Plärrdeifl Liveticker"
				}),
				/* @__PURE__ */ (0, S.jsx)("h1", { children: "Wird geöffnet …" }),
				/* @__PURE__ */ (0, S.jsx)("p", { children: "Plattformstatus und Berechtigung werden geprüft." })
			]
		})
	});
	if (t.kind === "maintenance") return /* @__PURE__ */ (0, S.jsx)("main", {
		className: "shell",
		children: /* @__PURE__ */ (0, S.jsxs)("section", {
			className: "card",
			children: [
				/* @__PURE__ */ (0, S.jsx)("p", {
					className: "eyebrow",
					children: "Plärrdeifl Liveticker"
				}),
				/* @__PURE__ */ (0, S.jsx)("h1", { children: "Wartungsmodus" }),
				/* @__PURE__ */ (0, S.jsx)("p", { children: t.platform.message || "Der Liveticker ist vorübergehend nicht verfügbar." }),
				/* @__PURE__ */ (0, S.jsx)("button", {
					type: "button",
					onClick: () => void o(),
					children: "Erneut prüfen"
				})
			]
		})
	});
	if (t.kind === "signed-out") return /* @__PURE__ */ (0, S.jsx)("main", {
		className: "shell",
		children: /* @__PURE__ */ (0, S.jsx)(se, {
			onCredential: s,
			onDevPortalLogin: (e().environment, void 0)
		})
	});
	if (t.kind === "denied") return /* @__PURE__ */ (0, S.jsx)("main", {
		className: "shell",
		children: /* @__PURE__ */ (0, S.jsxs)("section", {
			className: "card",
			children: [
				/* @__PURE__ */ (0, S.jsx)("p", {
					className: "eyebrow",
					children: "Plärrdeifl Liveticker"
				}),
				/* @__PURE__ */ (0, S.jsx)("h1", { children: "Kein Liveticker-Zugriff" }),
				/* @__PURE__ */ (0, S.jsxs)("p", { children: [
					"Dein Portal-Konto besitzt aktuell nicht die Berechtigung ",
					/* @__PURE__ */ (0, S.jsx)("code", { children: "liveticker.manage" }),
					"."
				] }),
				/* @__PURE__ */ (0, S.jsx)("button", {
					type: "button",
					onClick: () => void c(),
					children: "Abmelden"
				})
			]
		})
	});
	if (t.kind === "error") return /* @__PURE__ */ (0, S.jsx)("main", {
		className: "shell",
		children: /* @__PURE__ */ (0, S.jsxs)("section", {
			className: "card",
			children: [
				/* @__PURE__ */ (0, S.jsx)("p", {
					className: "eyebrow",
					children: "Plärrdeifl Liveticker"
				}),
				/* @__PURE__ */ (0, S.jsx)("h1", { children: "Start fehlgeschlagen" }),
				/* @__PURE__ */ (0, S.jsx)("p", { children: t.message }),
				/* @__PURE__ */ (0, S.jsx)("button", {
					type: "button",
					onClick: () => void o(),
					children: "Erneut versuchen"
				})
			]
		})
	});
	let l = t.auth.bootstrap?.user, u = [l?.firstName, l?.lastName].filter(Boolean).join(" ");
	return /* @__PURE__ */ (0, S.jsxs)("main", {
		className: "app-shell classic-shell",
		children: [
			/* @__PURE__ */ (0, S.jsxs)("header", {
				className: "classic-topline",
				children: [/* @__PURE__ */ (0, S.jsxs)("div", {
					className: "classic-brand",
					"aria-label": "Plärrdeifl Liveticker",
					children: [/* @__PURE__ */ (0, S.jsx)("img", {
						src: "/liveticker/icons/icon-192.png",
						alt: ""
					}), /* @__PURE__ */ (0, S.jsxs)("span", { children: [/* @__PURE__ */ (0, S.jsx)("strong", { children: "Plärrdeifl" }), /* @__PURE__ */ (0, S.jsx)("small", { children: "LIVETICKER" })] })]
				}), /* @__PURE__ */ (0, S.jsx)("a", {
					className: "liveticker-back-to-cockpit",
					href: "/cockpit/",
					children: "← Cockpit"
				})]
			}),
			r === "ticker" ? /* @__PURE__ */ (0, S.jsx)(g.Suspense, {
				fallback: /* @__PURE__ */ (0, S.jsxs)("section", {
					className: "workspace-card",
					children: [/* @__PURE__ */ (0, S.jsx)("p", {
						className: "eyebrow",
						children: "Liveticker"
					}), /* @__PURE__ */ (0, S.jsx)("h2", { children: "Spieltag wird geladen …" })]
				}),
				children: /* @__PURE__ */ (0, S.jsx)(C, { mutationsAllowed: t.platform.mode === "NORMAL" && e().mutationsEnabled })
			}) : /* @__PURE__ */ (0, S.jsx)(g.Suspense, {
				fallback: /* @__PURE__ */ (0, S.jsxs)("section", {
					className: "workspace-card",
					children: [/* @__PURE__ */ (0, S.jsx)("p", {
						className: "eyebrow",
						children: "Liveticker"
					}), /* @__PURE__ */ (0, S.jsx)("h2", { children: "Verwaltung wird geladen …" })]
				}),
				children: /* @__PURE__ */ (0, S.jsx)(ve, { mutationsAllowed: t.platform.mode === "NORMAL" && e().mutationsEnabled })
			}),
			/* @__PURE__ */ (0, S.jsxs)("footer", {
				className: "classic-app-footer",
				title: u || "Portalzugang aktiv",
				children: [
					e().environment === "DEV" && /* @__PURE__ */ (0, S.jsx)("span", {
						className: "dev-badge",
						children: "DEV · INTERN"
					}),
					/* @__PURE__ */ (0, S.jsx)("button", {
						type: "button",
						onClick: () => a(r === "ticker" ? "admin" : "ticker"),
						children: r === "ticker" ? "Verwaltung" : "← Spieltag"
					}),
					/* @__PURE__ */ (0, S.jsx)("button", {
						type: "button",
						onClick: () => void c(),
						children: "Abmelden"
					})
				]
			})
		]
	});
}
//#endregion
//#region src/embed.tsx
function be(e) {
	if (!e || e.shadowRoot || !e.isConnected) throw Error("Liveticker-Modul kann nicht sicher gestartet werden.");
	let t = e.attachShadow({ mode: "open" }), n = document.createElement("link");
	n.rel = "stylesheet", n.href = "/liveticker/embed/style.css", t.append(n);
	let r = document.createElement("div");
	t.append(r);
	let i = (0, _.createRoot)(r);
	return i.render(/* @__PURE__ */ (0, S.jsx)(ye, {})), () => i.unmount();
}
//#endregion
export { be as mountLiveticker };
