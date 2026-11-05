//#region \0rolldown/runtime.js
var e = (e, t) => () => (t || (e((t = { exports: {} }).exports, t), e = null), t.exports), t = /* @__PURE__ */ e(((e) => {
	var t = Symbol.for("react.transitional.element"), n = Symbol.for("react.portal"), r = Symbol.for("react.fragment"), i = Symbol.for("react.strict_mode"), a = Symbol.for("react.profiler"), o = Symbol.for("react.consumer"), s = Symbol.for("react.context"), c = Symbol.for("react.forward_ref"), l = Symbol.for("react.suspense"), u = Symbol.for("react.memo"), d = Symbol.for("react.lazy"), f = Symbol.for("react.activity"), p = Symbol.for("react.view_transition"), m = Symbol.iterator;
	function h(e) {
		return typeof e != "object" || !e ? null : (e = m && e[m] || e["@@iterator"], typeof e == "function" ? e : null);
	}
	var g = {
		isMounted: function() {
			return !1;
		},
		enqueueForceUpdate: function() {},
		enqueueReplaceState: function() {},
		enqueueSetState: function() {}
	}, _ = Object.assign, v = {};
	function y(e, t, n) {
		this.props = e, this.context = t, this.refs = v, this.updater = n || g;
	}
	y.prototype.isReactComponent = {}, y.prototype.setState = function(e, t) {
		if (typeof e != "object" && typeof e != "function" && e != null) throw Error("takes an object of state variables to update or a function which returns an object of state variables.");
		this.updater.enqueueSetState(this, e, t, "setState");
	}, y.prototype.forceUpdate = function(e) {
		this.updater.enqueueForceUpdate(this, e, "forceUpdate");
	};
	function b() {}
	b.prototype = y.prototype;
	function x(e, t, n) {
		this.props = e, this.context = t, this.refs = v, this.updater = n || g;
	}
	var S = x.prototype = new b();
	S.constructor = x, _(S, y.prototype), S.isPureReactComponent = !0;
	var ee = Array.isArray;
	function te() {}
	var C = {
		H: null,
		A: null,
		T: null,
		S: null
	}, ne = Object.prototype.hasOwnProperty;
	function w(e, n, r) {
		var i = r.ref;
		return {
			$$typeof: t,
			type: e,
			key: n,
			ref: i === void 0 ? null : i,
			props: r
		};
	}
	function re(e, t) {
		return w(e.type, t, e.props);
	}
	function ie(e) {
		return typeof e == "object" && !!e && e.$$typeof === t;
	}
	function ae(e) {
		var t = {
			"=": "=0",
			":": "=2"
		};
		return "$" + e.replace(/[=:]/g, function(e) {
			return t[e];
		});
	}
	var oe = /\/+/g;
	function T(e, t) {
		return typeof e == "object" && e && e.key != null ? ae("" + e.key) : t.toString(36);
	}
	function se(e) {
		switch (e.status) {
			case "fulfilled": return e.value;
			case "rejected": throw e.reason;
			default: switch (typeof e.status == "string" ? e.then(te, te) : (e.status = "pending", e.then(function(t) {
				e.status === "pending" && (e.status = "fulfilled", e.value = t);
			}, function(t) {
				e.status === "pending" && (e.status = "rejected", e.reason = t);
			})), e.status) {
				case "fulfilled": return e.value;
				case "rejected": throw e.reason;
			}
		}
		throw e;
	}
	function ce(e, r, i, a, o) {
		var s = typeof e;
		(s === "undefined" || s === "boolean") && (e = null);
		var c = !1;
		if (e === null) c = !0;
		else switch (s) {
			case "bigint":
			case "string":
			case "number":
				c = !0;
				break;
			case "object": switch (e.$$typeof) {
				case t:
				case n:
					c = !0;
					break;
				case d: return c = e._init, ce(c(e._payload), r, i, a, o);
			}
		}
		if (c) return o = o(e), c = a === "" ? "." + T(e, 0) : a, ee(o) ? (i = "", c != null && (i = c.replace(oe, "$&/") + "/"), ce(o, r, i, "", function(e) {
			return e;
		})) : o != null && (ie(o) && (o = re(o, i + (o.key == null || e && e.key === o.key ? "" : ("" + o.key).replace(oe, "$&/") + "/") + c)), r.push(o)), 1;
		c = 0;
		var l = a === "" ? "." : a + ":";
		if (ee(e)) for (var u = 0; u < e.length; u++) a = e[u], s = l + T(a, u), c += ce(a, r, i, s, o);
		else if (u = h(e), typeof u == "function") for (e = u.call(e), u = 0; !(a = e.next()).done;) a = a.value, s = l + T(a, u++), c += ce(a, r, i, s, o);
		else if (s === "object") {
			if (typeof e.then == "function") return ce(se(e), r, i, a, o);
			throw r = String(e), Error("Objects are not valid as a React child (found: " + (r === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : r) + "). If you meant to render a collection of children, use an array instead.");
		}
		return c;
	}
	function le(e, t, n) {
		if (e == null) return e;
		var r = [], i = 0;
		return ce(e, r, "", "", function(e) {
			return t.call(n, e, i++);
		}), r;
	}
	function ue(e) {
		if (e._status === -1) {
			var t = e._result, n = t();
			n.then(function(t) {
				(e._status === 0 || e._status === -1) && (e._status = 1, e._result = t, n.status === void 0 && (n.status = "fulfilled", n.value = t));
			}, function(t) {
				(e._status === 0 || e._status === -1) && (e._status = 2, e._result = t, n.status === void 0 && (n.status = "rejected", n.reason = t));
			}), e._status === -1 && (e._status = 0, e._result = n);
		}
		if (e._status === 1) return e._result.default;
		throw e._result;
	}
	var de = typeof reportError == "function" ? reportError : function(e) {
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
	};
	function fe(e) {
		var t = C.T, n = {};
		n.types = t === null ? null : t.types, C.T = n;
		try {
			var r = e(), i = C.S;
			i !== null && i(n, r), typeof r == "object" && r && typeof r.then == "function" && r.then(te, de);
		} catch (e) {
			de(e);
		} finally {
			t !== null && n.types !== null && (t.types = n.types), C.T = t;
		}
	}
	function pe(e) {
		var t = C.T;
		if (t !== null) {
			var n = t.types;
			n === null ? t.types = [e] : n.indexOf(e) === -1 && n.push(e);
		} else fe(pe.bind(null, e));
	}
	var me = {
		map: le,
		forEach: function(e, t, n) {
			le(e, function() {
				t.apply(this, arguments);
			}, n);
		},
		count: function(e) {
			var t = 0;
			return le(e, function() {
				t++;
			}), t;
		},
		toArray: function(e) {
			return le(e, function(e) {
				return e;
			}) || [];
		},
		only: function(e) {
			if (!ie(e)) throw Error("React.Children.only expected to receive a single React element child.");
			return e;
		}
	};
	e.Activity = f, e.Children = me, e.Component = y, e.Fragment = r, e.Profiler = a, e.PureComponent = x, e.StrictMode = i, e.Suspense = l, e.ViewTransition = p, e.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = C, e.__COMPILER_RUNTIME = {
		__proto__: null,
		c: function(e) {
			return C.H.useMemoCache(e);
		}
	}, e.addTransitionType = pe, e.cache = function(e) {
		return function() {
			return e.apply(null, arguments);
		};
	}, e.cacheSignal = function() {
		return null;
	}, e.cloneElement = function(e, t, n) {
		if (e == null) throw Error("The argument must be a React element, but you passed " + e + ".");
		var r = _({}, e.props), i = e.key;
		if (t != null) for (a in t.key !== void 0 && (i = "" + t.key), t) !ne.call(t, a) || a === "key" || a === "__self" || a === "__source" || a === "ref" && t.ref === void 0 || (r[a] = t[a]);
		var a = arguments.length - 2;
		if (a === 1) r.children = n;
		else if (1 < a) {
			for (var o = Array(a), s = 0; s < a; s++) o[s] = arguments[s + 2];
			r.children = o;
		}
		return w(e.type, i, r);
	}, e.createContext = function(e) {
		return e = {
			$$typeof: s,
			_currentValue: e,
			_currentValue2: e,
			_threadCount: 0,
			Provider: null,
			Consumer: null
		}, e.Provider = e, e.Consumer = {
			$$typeof: o,
			_context: e
		}, e;
	}, e.createElement = function(e, t, n) {
		var r, i = {}, a = null;
		if (t != null) for (r in t.key !== void 0 && (a = "" + t.key), t) ne.call(t, r) && r !== "key" && r !== "__self" && r !== "__source" && (i[r] = t[r]);
		var o = arguments.length - 2;
		if (o === 1) i.children = n;
		else if (1 < o) {
			for (var s = Array(o), c = 0; c < o; c++) s[c] = arguments[c + 2];
			i.children = s;
		}
		if (e && e.defaultProps) for (r in o = e.defaultProps, o) i[r] === void 0 && (i[r] = o[r]);
		return w(e, a, i);
	}, e.createRef = function() {
		return { current: null };
	}, e.forwardRef = function(e) {
		return {
			$$typeof: c,
			render: e
		};
	}, e.isValidElement = ie, e.lazy = function(e) {
		return {
			$$typeof: d,
			_payload: {
				_status: -1,
				_result: e
			},
			_init: ue
		};
	}, e.memo = function(e, t) {
		return {
			$$typeof: u,
			type: e,
			compare: t === void 0 ? null : t
		};
	}, e.startTransition = fe, e.unstable_useCacheRefresh = function() {
		return C.H.useCacheRefresh();
	}, e.use = function(e) {
		return C.H.use(e);
	}, e.useActionState = function(e, t, n) {
		return C.H.useActionState(e, t, n);
	}, e.useCallback = function(e, t) {
		return C.H.useCallback(e, t);
	}, e.useContext = function(e) {
		return C.H.useContext(e);
	}, e.useDebugValue = function() {}, e.useDeferredValue = function(e, t) {
		return C.H.useDeferredValue(e, t);
	}, e.useEffect = function(e, t) {
		return C.H.useEffect(e, t);
	}, e.useEffectEvent = function(e) {
		return C.H.useEffectEvent(e);
	}, e.useId = function() {
		return C.H.useId();
	}, e.useImperativeHandle = function(e, t, n) {
		return C.H.useImperativeHandle(e, t, n);
	}, e.useInsertionEffect = function(e, t) {
		return C.H.useInsertionEffect(e, t);
	}, e.useLayoutEffect = function(e, t) {
		return C.H.useLayoutEffect(e, t);
	}, e.useMemo = function(e, t) {
		return C.H.useMemo(e, t);
	}, e.useOptimistic = function(e, t) {
		return C.H.useOptimistic(e, t);
	}, e.useReducer = function(e, t, n) {
		return C.H.useReducer(e, t, n);
	}, e.useRef = function(e) {
		return C.H.useRef(e);
	}, e.useState = function(e) {
		return C.H.useState(e);
	}, e.useSyncExternalStore = function(e, t, n) {
		return C.H.useSyncExternalStore(e, t, n);
	}, e.useTransition = function() {
		return C.H.useTransition();
	}, e.version = "19.3.0";
})), n = /* @__PURE__ */ e(((e, n) => {
	n.exports = t();
})), r = /* @__PURE__ */ e(((e) => {
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
	function x(e) {
		if (h = !1, b(e), !m) {
			if (n(c) !== null) m = !0, S || (S = !0, re());
			else {
				var t = n(l);
				t !== null && oe(x, t.startTime - e);
			}
		}
	}
	var S = !1, ee = -1, te = 5, C = -1;
	function ne() {
		return g ? !0 : !(e.unstable_now() - C < te);
	}
	function w() {
		if (g = !1, S) {
			var t = e.unstable_now();
			C = t;
			var i = !0;
			try {
				a: {
					m = !1, h && (h = !1, v(ee), ee = -1), p = !0;
					var a = f;
					try {
						b: {
							for (b(t), d = n(c); d !== null && !(d.expirationTime > t && ne());) {
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
								u !== null && oe(x, u.startTime - t), i = !1;
							}
						}
						break a;
					} finally {
						d = null, f = a, p = !1;
					}
					i = void 0;
				}
			} finally {
				i ? re() : S = !1;
			}
		}
	}
	var re;
	if (typeof y == "function") re = function() {
		y(w);
	};
	else if (typeof MessageChannel < "u") {
		var ie = new MessageChannel(), ae = ie.port2;
		ie.port1.onmessage = w, re = function() {
			ae.postMessage(null);
		};
	} else re = function() {
		_(w, 0);
	};
	function oe(t, n) {
		ee = _(function() {
			t(e.unstable_now());
		}, n);
	}
	e.unstable_IdlePriority = 5, e.unstable_ImmediatePriority = 1, e.unstable_LowPriority = 4, e.unstable_NormalPriority = 3, e.unstable_Profiling = null, e.unstable_UserBlockingPriority = 2, e.unstable_cancelCallback = function(e) {
		e.callback = null;
	}, e.unstable_forceFrameRate = function(e) {
		0 > e || 125 < e ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : te = 0 < e ? Math.floor(1e3 / e) : 5;
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
		}, a > o ? (r.sortIndex = a, t(l, r), n(c) === null && r === n(l) && (h ? (v(ee), ee = -1) : h = !0, oe(x, a - o))) : (r.sortIndex = s, t(c, r), m || p || (m = !0, S || (S = !0, re()))), r;
	}, e.unstable_shouldYield = ne, e.unstable_wrapCallback = function(e) {
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
})), i = /* @__PURE__ */ e(((e, t) => {
	t.exports = r();
})), a = /* @__PURE__ */ e(((e) => {
	var t = n();
	function r(e) {
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
				throw Error(r(522));
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
		var n = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
		if (!t || t.nodeType !== 1 && t.nodeType !== 9 && t.nodeType !== 11) throw Error(r(299));
		return l(e, t, null, n);
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
})), o = /* @__PURE__ */ e(((e, t) => {
	function n() {
		if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE == "function") try {
			__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n);
		} catch (e) {
			console.error(e);
		}
	}
	n(), t.exports = a();
})), s = /* @__PURE__ */ e(((e) => {
	var t = i(), r = n(), a = o();
	function s(e) {
		var t = "https://react.dev/errors/" + e;
		if (1 < arguments.length) {
			t += "?args[]=" + encodeURIComponent(arguments[1]);
			for (var n = 2; n < arguments.length; n++) t += "&args[]=" + encodeURIComponent(arguments[n]);
		}
		return "Minified React error #" + e + "; visit " + t + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
	}
	function c(e) {
		return !(!e || e.nodeType !== 1 && e.nodeType !== 9 && e.nodeType !== 11);
	}
	function l(e) {
		for (var t = e, n = t; n && !n.alternate;) t = n, t.flags & 4098 && (e = t.return), n = t.return;
		for (; t.return;) t = t.return;
		return t.tag === 3 ? e : null;
	}
	function u(e) {
		if (e.tag === 13) {
			var t = e.memoizedState;
			if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null) return t.dehydrated;
		}
		return null;
	}
	function d(e) {
		if (e.tag === 31) {
			var t = e.memoizedState;
			if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null) return t.dehydrated;
		}
		return null;
	}
	function f(e) {
		if (l(e) !== e) throw Error(s(188));
	}
	function p(e) {
		var t = e.alternate;
		if (!t) {
			if (t = l(e), t === null) throw Error(s(188));
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
					if (a === n) return f(i), e;
					if (a === r) return f(i), t;
					a = a.sibling;
				}
				throw Error(s(188));
			}
			if (n.return !== r.return) n = i, r = a;
			else {
				for (var o = !1, c = i.child; c;) {
					if (c === n) {
						o = !0, n = i, r = a;
						break;
					}
					if (c === r) {
						o = !0, r = i, n = a;
						break;
					}
					c = c.sibling;
				}
				if (!o) {
					for (c = a.child; c;) {
						if (c === n) {
							o = !0, n = a, r = i;
							break;
						}
						if (c === r) {
							o = !0, r = a, n = i;
							break;
						}
						c = c.sibling;
					}
					if (!o) throw Error(s(189));
				}
			}
			if (n.alternate !== r) throw Error(s(190));
		}
		if (n.tag !== 3) throw Error(s(188));
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
			default: throw Error(s(559));
		}
	}
	var x = null, S = null;
	function ee(e, t, n) {
		return e === n || e === t && (x = e, !0);
	}
	function te(e, t, n) {
		return e === n ? (S = e, !1) : e === t && (S !== null && (x = e), !0);
	}
	function C(e) {
		if (e === null) return null;
		do
			e = e === null ? null : e.return;
		while (e && e.tag !== 5 && e.tag !== 27 && e.tag !== 3);
		return e || null;
	}
	function ne(e, t, n) {
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
	var w = Object.assign, re = Symbol.for("react.element"), ie = Symbol.for("react.transitional.element"), ae = Symbol.for("react.portal"), oe = Symbol.for("react.fragment"), T = Symbol.for("react.strict_mode"), se = Symbol.for("react.profiler"), ce = Symbol.for("react.consumer"), le = Symbol.for("react.context"), ue = Symbol.for("react.forward_ref"), de = Symbol.for("react.suspense"), fe = Symbol.for("react.suspense_list"), pe = Symbol.for("react.memo"), me = Symbol.for("react.lazy"), he = Symbol.for("react.activity"), ge = Symbol.for("react.legacy_hidden"), _e = Symbol.for("react.memo_cache_sentinel"), ve = Symbol.for("react.view_transition"), ye = Symbol.for("react.recoverable"), be = Symbol.iterator;
	function E(e) {
		return typeof e != "object" || !e ? null : (e = be && e[be] || e["@@iterator"], typeof e == "function" ? e : null);
	}
	var xe = Symbol.for("react.client.reference");
	function D(e) {
		if (e == null) return null;
		if (typeof e == "function") return e.$$typeof === xe ? null : e.displayName || e.name || null;
		if (typeof e == "string") return e;
		switch (e) {
			case oe: return "Fragment";
			case se: return "Profiler";
			case T: return "StrictMode";
			case de: return "Suspense";
			case fe: return "SuspenseList";
			case he: return "Activity";
			case ve: return "ViewTransition";
		}
		if (typeof e == "object") switch (e.$$typeof) {
			case ae: return "Portal";
			case le: return e.displayName || "Context";
			case ce: return (e._context.displayName || "Context") + ".Consumer";
			case ue:
				var t = e.render;
				return e = e.displayName, e ||= (e = t.displayName || t.name || "", e === "" ? "ForwardRef" : "ForwardRef(" + e + ")"), e;
			case pe: return t = e.displayName || null, t === null ? D(e.type) || "Memo" : t;
			case me:
				t = e._payload, e = e._init;
				try {
					return D(e(t));
				} catch {}
		}
		return null;
	}
	var Se = Array.isArray, O = r.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, k = a.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Ce = {
		pending: !1,
		data: null,
		method: null,
		action: null
	}, we = [], Te = -1;
	function A(e) {
		return { current: e };
	}
	function Ee(e) {
		0 > Te || (e.current = we[Te], we[Te] = null, Te--);
	}
	function j(e, t) {
		Te++, we[Te] = e.current, e.current = t;
	}
	var De = A(null), Oe = A(null), ke = A(null), Ae = A(null);
	function je(e, t) {
		switch (j(ke, t), j(Oe, e), j(De, null), t.nodeType) {
			case 9:
			case 11:
				e = (e = t.documentElement) && (e = e.namespaceURI) ? up(e) : 0;
				break;
			default: if (e = t.tagName, t = t.namespaceURI) t = up(t), e = dp(t, e);
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
		Ee(De), j(De, e);
	}
	function Me() {
		Ee(De), Ee(Oe), Ee(ke);
	}
	function Ne(e) {
		var t = e.memoizedState;
		t !== null && (sh._currentValue = t.memoizedState, j(Ae, e)), t = De.current;
		var n = dp(t, e.type);
		t !== n && (j(Oe, e), j(De, n));
	}
	function Pe(e) {
		Oe.current === e && (Ee(De), Ee(Oe)), Ae.current === e && (Ee(Ae), sh._currentValue = Ce);
	}
	var Fe, Ie;
	function Le(e) {
		if (Fe === void 0) try {
			throw Error();
		} catch (e) {
			var t = e.stack.trim().match(/\n( *(at )?)/);
			Fe = t && t[1] || "", Ie = -1 < e.stack.indexOf("\n    at") ? " (<anonymous>)" : -1 < e.stack.indexOf("@") ? "@unknown:0:0" : "";
		}
		return "\n" + Fe + e + Ie;
	}
	var Re = !1;
	function ze(e, t) {
		if (!e || Re) return "";
		Re = !0;
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
			Re = !1, Error.prepareStackTrace = n;
		}
		return (n = e ? e.displayName || e.name : "") ? Le(n) : "";
	}
	function Be(e, t) {
		switch (e.tag) {
			case 26:
			case 27:
			case 5: return Le(e.type);
			case 16: return Le("Lazy");
			case 13: return e.child !== t && t !== null ? Le("Suspense Fallback") : Le("Suspense");
			case 19: return Le("SuspenseList");
			case 0:
			case 15: return ze(e.type, !1);
			case 11: return ze(e.type.render, !1);
			case 1: return ze(e.type, !0);
			case 31: return Le("Activity");
			case 30: return Le("ViewTransition");
			default: return "";
		}
	}
	function Ve(e) {
		try {
			var t = "", n = null;
			do
				t += Be(e, n), n = e, e = e.return;
			while (e);
			return t;
		} catch (e) {
			return "\nError generating stack: " + e.message + "\n" + e.stack;
		}
	}
	var He = Object.prototype.hasOwnProperty, Ue = t.unstable_scheduleCallback, We = t.unstable_cancelCallback, Ge = t.unstable_shouldYield, Ke = t.unstable_requestPaint, qe = t.unstable_now, Je = t.unstable_getCurrentPriorityLevel, Ye = t.unstable_ImmediatePriority, Xe = t.unstable_UserBlockingPriority, Ze = t.unstable_NormalPriority, Qe = t.unstable_LowPriority, $e = t.unstable_IdlePriority, et = t.log, tt = t.unstable_setDisableYieldValue, nt = null, rt = null;
	function it(e) {
		if (typeof et == "function" && tt(e), rt && typeof rt.setStrictMode == "function") try {
			rt.setStrictMode(nt, e);
		} catch {}
	}
	var at = Math.clz32 ? Math.clz32 : ct, ot = Math.log, st = Math.LN2;
	function ct(e) {
		return e >>>= 0, e === 0 ? 32 : 31 - (ot(e) / st | 0) | 0;
	}
	var lt = 256, ut = 262144, dt = 4194304;
	function ft(e) {
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
	function pt(e, t, n) {
		var r = e.pendingLanes;
		if (r === 0) return 0;
		var i = 0, a = e.suspendedLanes, o = e.pingedLanes;
		e = e.warmLanes;
		var s = r & 134217727;
		return s === 0 ? (s = r & ~a, s === 0 ? o === 0 ? n || (n = r & ~e, n !== 0 && (i = ft(n))) : i = ft(o) : i = ft(s)) : (r = s & ~a, r === 0 ? (o &= s, o === 0 ? n || (n = s & ~e, n !== 0 && (i = ft(n))) : i = ft(o)) : i = ft(r)), i === 0 ? 0 : t !== 0 && t !== i && (t & a) === 0 && (a = i & -i, n = t & -t, a >= n || a === 32 && n & 4194048) ? t : i;
	}
	function mt(e, t) {
		return (e.pendingLanes & ~(e.suspendedLanes & ~e.pingedLanes) & t) === 0;
	}
	function ht(e, t) {
		t & 8 && (t |= t & 32);
		var n = e.entangledLanes;
		if (n !== 0) for (e = e.entanglements, n &= t; 0 < n;) {
			var r = 31 - at(n), i = 1 << r;
			t |= e[r], n &= ~i;
		}
		return t;
	}
	function gt(e, t) {
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
	function _t() {
		var e = dt;
		return dt <<= 1, !(dt & 62914560) && (dt = 4194304), e;
	}
	function vt(e) {
		for (var t = [], n = 0; 31 > n; n++) t.push(e);
		return t;
	}
	function yt(e, t) {
		e.pendingLanes |= t, t !== 268435456 && (e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0);
	}
	function bt(e, t, n, r, i, a) {
		var o = e.pendingLanes;
		e.pendingLanes = n, e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0, e.expiredLanes &= n, e.entangledLanes &= n, e.errorRecoveryDisabledLanes &= n, e.shellSuspendCounter = 0;
		var s = e.entanglements, c = e.expirationTimes, l = e.hiddenUpdates;
		for (n = o & ~n; 0 < n;) {
			var u = 31 - at(n), d = 1 << u;
			s[u] = 0, c[u] = -1;
			var f = l[u];
			if (f !== null) for (l[u] = null, u = 0; u < f.length; u++) {
				var p = f[u];
				p !== null && (p.lane &= -536870913);
			}
			n &= ~d;
		}
		r !== 0 && xt(e, r, 0), a !== 0 && i === 0 && e.tag !== 0 && (e.suspendedLanes |= a & ~(o & ~t));
	}
	function xt(e, t, n) {
		e.pendingLanes |= t, e.suspendedLanes &= ~t;
		var r = 31 - at(t);
		e.entangledLanes |= t, e.entanglements[r] = e.entanglements[r] | 1073741824 | n & 261930;
	}
	function St(e, t) {
		var n = e.entangledLanes |= t;
		for (e = e.entanglements; n;) {
			var r = 31 - at(n), i = 1 << r;
			i & t | e[r] & t && (e[r] |= t), n &= ~i;
		}
	}
	function Ct(e, t) {
		var n = t & -t;
		return n = n & 42 ? 1 : wt(n), (n & (e.suspendedLanes | t)) === 0 ? n : 0;
	}
	function wt(e) {
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
	function Tt(e) {
		return e &= -e, 2 < e ? 8 < e ? e & 134217727 ? 32 : 268435456 : 8 : 2;
	}
	function Et() {
		var e = k.p;
		return e === 0 ? (e = window.event, e === void 0 ? 32 : Ch(e.type)) : e;
	}
	function Dt(e, t) {
		var n = k.p;
		try {
			return k.p = e, t();
		} finally {
			k.p = n;
		}
	}
	var Ot = Math.random().toString(36).slice(2), kt = "__reactFiber$" + Ot, At = "__reactProps$" + Ot, jt = "__reactContainer$" + Ot, Mt = "__reactEvents$" + Ot, Nt = "__reactListeners$" + Ot, Pt = "__reactHandles$" + Ot, Ft = "__reactResources$" + Ot, It = "__reactMarker$" + Ot, Lt = "__reactLoad$" + Ot;
	function Rt(e) {
		delete e[kt], delete e[At], delete e[Nt], delete e[Pt];
	}
	function zt(e) {
		var t;
		if (t = e[kt]) return t;
		for (var n = e.parentNode; n;) {
			if (t = n[jt] || n[kt]) {
				if (n = t.alternate, t.child !== null || n !== null && n.child !== null) for (e = fm(e); e !== null;) {
					if (n = e[kt]) return n;
					e = fm(e);
				}
				return t;
			}
			e = n, n = e.parentNode;
		}
		return null;
	}
	function Bt(e) {
		if (e = e[kt] || e[jt]) {
			var t = e.tag;
			if (t === 5 || t === 6 || t === 13 || t === 31 || t === 26 || t === 27 || t === 3) return e;
		}
		return null;
	}
	function Vt(e) {
		var t = e.tag;
		if (t === 5 || t === 26 || t === 27 || t === 6) return e.stateNode;
		throw Error(s(33));
	}
	function Ht(e) {
		var t = e[Ft];
		return t ||= e[Ft] = {
			hoistableStyles: /* @__PURE__ */ new Map(),
			hoistableScripts: /* @__PURE__ */ new Map()
		}, t;
	}
	function Ut(e) {
		e[It] = !0;
	}
	function Wt(e) {
		e[Lt] = void 0;
	}
	var Gt = /* @__PURE__ */ new Set(), Kt = {};
	function M(e, t) {
		qt(e, t), qt(e + "Capture", t);
	}
	function qt(e, t) {
		for (Kt[e] = t, e = 0; e < t.length; e++) Gt.add(t[e]);
	}
	var Jt = RegExp("^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"), Yt = {}, Xt = {};
	function Zt(e) {
		return He.call(Xt, e) ? !0 : He.call(Yt, e) ? !1 : Jt.test(e) ? Xt[e] = !0 : (Yt[e] = !0, !1);
	}
	var N = !1;
	function Qt() {
		var e = N;
		return N = !1, e;
	}
	function $t(e, t, n) {
		if (Zt(t)) {
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
	function en(e, t, n) {
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
	function tn(e, t, n, r) {
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
	function nn(e) {
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
	function rn(e) {
		var t = e.type;
		return (e = e.nodeName) && e.toLowerCase() === "input" && (t === "checkbox" || t === "radio");
	}
	function an(e, t, n) {
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
	function on(e) {
		if (!e._valueTracker) {
			var t = rn(e) ? "checked" : "value";
			e._valueTracker = an(e, t, "" + e[t]);
		}
	}
	function sn(e) {
		if (!e) return !1;
		var t = e._valueTracker;
		if (!t) return !0;
		var n = t.getValue(), r = "";
		return e && (r = rn(e) ? e.checked ? "true" : "false" : e.value), e = r, e !== n && (t.setValue(e), !0);
	}
	var cn = /[\n"\\]/g;
	function ln(e) {
		return e.replace(cn, function(e) {
			return "\\" + e.charCodeAt(0).toString(16) + " ";
		});
	}
	function un(e, t, n, r, i, a, o, s) {
		e.name = "", o != null && typeof o != "function" && typeof o != "symbol" && typeof o != "boolean" ? e.type = o : e.removeAttribute("type"), t == null ? o !== "submit" && o !== "reset" || e.removeAttribute("value") : o === "number" ? (t === 0 && e.value === "" || e.value != t) && (e.value = "" + nn(t)) : e.value !== "" + nn(t) && (e.value = "" + nn(t)), t == null ? n == null ? r != null && e.removeAttribute("value") : fn(e, nn(n)) : o === "number" && e.value == t ? fn(e, nn(e.value)) : fn(e, nn(t)), i == null && a != null && (e.defaultChecked = !!a), i != null && (e.checked = i && typeof i != "function" && typeof i != "symbol"), s != null && typeof s != "function" && typeof s != "symbol" && typeof s != "boolean" ? e.name = "" + nn(s) : e.removeAttribute("name");
	}
	function dn(e, t, n, r, i, a, o, s) {
		if (a != null && typeof a != "function" && typeof a != "symbol" && typeof a != "boolean" && (e.type = a), t != null || n != null) {
			if (!(a !== "submit" && a !== "reset" || t != null)) {
				on(e);
				return;
			}
			n = n == null ? "" : "" + nn(n), t = t == null ? n : "" + nn(t), s || t === e.value || (e.value = t), e.defaultValue = t;
		}
		r ??= i, r = typeof r != "function" && typeof r != "symbol" && !!r, e.checked = s ? e.checked : !!r, e.defaultChecked = !!r, o != null && typeof o != "function" && typeof o != "symbol" && typeof o != "boolean" && (e.name = o), on(e);
	}
	function fn(e, t) {
		e.defaultValue !== "" + t && (e.defaultValue = "" + t);
	}
	function pn(e, t, n, r) {
		if (e = e.options, t) {
			t = {};
			for (var i = 0; i < n.length; i++) t["$" + n[i]] = !0;
			for (n = 0; n < e.length; n++) i = t.hasOwnProperty("$" + e[n].value), e[n].selected !== i && (e[n].selected = i), i && r && (e[n].defaultSelected = !0);
		} else {
			for (n = "" + nn(n), t = null, i = 0; i < e.length; i++) {
				if (e[i].value === n) {
					e[i].selected = !0, r && (e[i].defaultSelected = !0);
					return;
				}
				t !== null || e[i].disabled || (t = e[i]);
			}
			t !== null && (t.selected = !0);
		}
	}
	function mn(e, t, n) {
		if (t != null && (t = "" + nn(t), t !== e.value && (e.value = t), n == null)) {
			e.defaultValue !== t && (e.defaultValue = t);
			return;
		}
		e.defaultValue = n == null ? "" : "" + nn(n);
	}
	function hn(e, t, n, r) {
		if (t == null) {
			if (r != null) {
				if (n != null) throw Error(s(92));
				if (Se(r)) {
					if (1 < r.length) throw Error(s(93));
					r = r[0];
				}
				n = r;
			}
			n ??= "", t = n;
		}
		n = nn(t), e.defaultValue = n, r = e.textContent, r === n && r !== "" && r !== null && (e.value = r), on(e);
	}
	function gn(e, t) {
		if (t) {
			var n = e.firstChild;
			if (n && n === e.lastChild && n.nodeType === 3) {
				n.nodeValue = t;
				return;
			}
		}
		e.textContent = t;
	}
	var _n = new Set("animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(" "));
	function vn(e, t, n) {
		var r = t.indexOf("--") === 0;
		n == null || typeof n == "boolean" || n === "" ? r ? e.setProperty(t, "") : t === "float" ? e.cssFloat = "" : e[t] = "" : r ? e.setProperty(t, n) : typeof n != "number" || n === 0 || _n.has(t) ? t === "float" ? e.cssFloat = n : e[t] = ("" + n).trim() : e[t] = n + "px";
	}
	function yn(e, t, n) {
		if (t != null && typeof t != "object") throw Error(s(62));
		if (e = e.style, n != null) {
			for (var r in n) !n.hasOwnProperty(r) || t != null && t.hasOwnProperty(r) || (r.indexOf("--") === 0 ? e.setProperty(r, "") : r === "float" ? e.cssFloat = "" : e[r] = "", N = !0);
			for (var i in t) r = t[i], t.hasOwnProperty(i) && n[i] !== r && (vn(e, i, r), N = !0);
		} else for (var a in t) t.hasOwnProperty(a) && vn(e, a, t[a]);
	}
	function bn(e) {
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
	var xn = /* @__PURE__ */ new Map([
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
	]), Sn = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
	function Cn(e) {
		return Sn.test("" + e) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : e;
	}
	function wn() {}
	var Tn = null;
	function En(e) {
		return e = e.target || e.srcElement || window, e.correspondingUseElement && (e = e.correspondingUseElement), e.nodeType === 3 ? e.parentNode : e;
	}
	var Dn = null, On = null;
	function kn(e) {
		var t = Bt(e);
		if (t && (e = t.stateNode)) {
			var n = e[At] || null;
			a: switch (e = t.stateNode, t.type) {
				case "input":
					if (un(e, n.value, n.defaultValue, n.defaultValue, n.checked, n.defaultChecked, n.type, n.name), t = n.name, n.type === "radio" && t != null) {
						for (n = e; n.parentNode;) n = n.parentNode;
						for (n = n.querySelectorAll("input[name=\"" + ln("" + t) + "\"][type=\"radio\"]"), t = 0; t < n.length; t++) {
							var r = n[t];
							if (r !== e && r.form === e.form) {
								var i = r[At] || null;
								if (!i) throw Error(s(90));
								un(r, i.value, i.defaultValue, i.defaultValue, i.checked, i.defaultChecked, i.type, i.name);
							}
						}
						for (t = 0; t < n.length; t++) r = n[t], r.form === e.form && sn(r);
					}
					break a;
				case "textarea":
					mn(e, n.value, n.defaultValue);
					break a;
				case "select": t = n.value, t != null && pn(e, !!n.multiple, t, !1);
			}
		}
	}
	var An = !1;
	function jn(e, t, n) {
		if (An) return e(t, n);
		An = !0;
		try {
			return e(t);
		} finally {
			if (An = !1, (Dn !== null || On !== null) && (zd(), Dn && (t = Dn, e = On, On = Dn = null, kn(t), e))) for (t = 0; t < e.length; t++) kn(e[t]);
		}
	}
	function Mn(e, t) {
		var n = e.stateNode;
		if (n === null) return null;
		var r = n[At] || null;
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
		if (n && typeof n != "function") throw Error(s(231, t, typeof n));
		return n;
	}
	var Nn = typeof window < "u" && window.document !== void 0 && window.document.createElement !== void 0, Pn = !1;
	if (Nn) try {
		var Fn = {};
		Object.defineProperty(Fn, "passive", { get: function() {
			Pn = !0;
		} }), window.addEventListener("test", Fn, Fn), window.removeEventListener("test", Fn, Fn);
	} catch {
		Pn = !1;
	}
	var In = null, Ln = null, Rn = null;
	function zn() {
		if (Rn) return Rn;
		var e, t = Ln, n = t.length, r, i = "value" in In ? In.value : In.textContent, a = i.length;
		for (e = 0; e < n && t[e] === i[e]; e++);
		var o = n - e;
		for (r = 1; r <= o && t[n - r] === i[a - r]; r++);
		return Rn = i.slice(e, 1 < r ? 1 - r : void 0);
	}
	function Bn(e) {
		var t = e.keyCode;
		return "charCode" in e ? (e = e.charCode, e === 0 && t === 13 && (e = 13)) : e = t, e === 10 && (e = 13), 32 <= e || e === 13 ? e : 0;
	}
	function Vn() {
		return !0;
	}
	function Hn() {
		return !1;
	}
	function Un(e) {
		function t(t, n, r, i, a) {
			for (var o in this._reactName = t, this._targetInst = r, this.type = n, this.nativeEvent = i, this.target = a, this.currentTarget = null, e) e.hasOwnProperty(o) && (t = e[o], this[o] = t ? t(i) : i[o]);
			return this.isDefaultPrevented = (i.defaultPrevented == null ? !1 === i.returnValue : i.defaultPrevented) ? Vn : Hn, this.isPropagationStopped = Hn, this;
		}
		return w(t.prototype, {
			preventDefault: function() {
				this.defaultPrevented = !0;
				var e = this.nativeEvent;
				e && (e.preventDefault ? e.preventDefault() : typeof e.returnValue != "unknown" && (e.returnValue = !1), this.isDefaultPrevented = Vn);
			},
			stopPropagation: function() {
				var e = this.nativeEvent;
				e && (e.stopPropagation ? e.stopPropagation() : typeof e.cancelBubble != "unknown" && (e.cancelBubble = !0), this.isPropagationStopped = Vn);
			},
			persist: function() {},
			isPersistent: Vn
		}), t;
	}
	var Wn = {
		eventPhase: 0,
		bubbles: 0,
		cancelable: 0,
		timeStamp: function(e) {
			return e.timeStamp || Date.now();
		},
		defaultPrevented: 0,
		isTrusted: 0
	}, P = Un(Wn), Gn = w({}, Wn, {
		view: 0,
		detail: 0
	}), Kn = Un(Gn), qn, Jn, Yn, Xn = w({}, Gn, {
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
		getModifierState: sr,
		button: 0,
		buttons: 0,
		relatedTarget: function(e) {
			return e.relatedTarget === void 0 ? e.fromElement === e.srcElement ? e.toElement : e.fromElement : e.relatedTarget;
		},
		movementX: function(e) {
			return "movementX" in e ? e.movementX : (e !== Yn && (Yn && e.type === "mousemove" ? (qn = e.screenX - Yn.screenX, Jn = e.screenY - Yn.screenY) : Jn = qn = 0, Yn = e), qn);
		},
		movementY: function(e) {
			return "movementY" in e ? e.movementY : Jn;
		}
	}), Zn = Un(Xn), Qn = Un(w({}, Xn, { dataTransfer: 0 })), $n = Un(w({}, Gn, { relatedTarget: 0 })), er = Un(w({}, Wn, {
		animationName: 0,
		elapsedTime: 0,
		pseudoElement: 0
	})), tr = Un(w({}, Wn, { clipboardData: function(e) {
		return "clipboardData" in e ? e.clipboardData : window.clipboardData;
	} })), nr = Un(w({}, Wn, { data: 0 })), rr = {
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
	}, ir = {
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
	}, ar = {
		Alt: "altKey",
		Control: "ctrlKey",
		Meta: "metaKey",
		Shift: "shiftKey"
	};
	function or(e) {
		var t = this.nativeEvent;
		return t.getModifierState ? t.getModifierState(e) : (e = ar[e]) ? !!t[e] : !1;
	}
	function sr() {
		return or;
	}
	var cr = Un(w({}, Gn, {
		key: function(e) {
			if (e.key) {
				var t = rr[e.key] || e.key;
				if (t !== "Unidentified") return t;
			}
			return e.type === "keypress" ? (e = Bn(e), e === 13 ? "Enter" : String.fromCharCode(e)) : e.type === "keydown" || e.type === "keyup" ? ir[e.keyCode] || "Unidentified" : "";
		},
		code: 0,
		location: 0,
		ctrlKey: 0,
		shiftKey: 0,
		altKey: 0,
		metaKey: 0,
		repeat: 0,
		locale: 0,
		getModifierState: sr,
		charCode: function(e) {
			return e.type === "keypress" ? Bn(e) : 0;
		},
		keyCode: function(e) {
			return e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
		},
		which: function(e) {
			return e.type === "keypress" ? Bn(e) : e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
		}
	})), lr = Un(w({}, Xn, {
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
	})), ur = Un(w({}, Wn, { submitter: 0 })), dr = Un(w({}, Gn, {
		touches: 0,
		targetTouches: 0,
		changedTouches: 0,
		altKey: 0,
		metaKey: 0,
		ctrlKey: 0,
		shiftKey: 0,
		getModifierState: sr
	})), fr = Un(w({}, Wn, {
		propertyName: 0,
		elapsedTime: 0,
		pseudoElement: 0
	})), pr = Un(w({}, Xn, {
		deltaX: function(e) {
			return "deltaX" in e ? e.deltaX : "wheelDeltaX" in e ? -e.wheelDeltaX : 0;
		},
		deltaY: function(e) {
			return "deltaY" in e ? e.deltaY : "wheelDeltaY" in e ? -e.wheelDeltaY : "wheelDelta" in e ? -e.wheelDelta : 0;
		},
		deltaZ: 0,
		deltaMode: 0
	})), mr = Un(w({}, Wn, {
		newState: 0,
		oldState: 0,
		source: 0
	})), hr = [
		9,
		13,
		27,
		32
	], gr = Nn && "CompositionEvent" in window, _r = null;
	Nn && "documentMode" in document && (_r = document.documentMode);
	var vr = Nn && "TextEvent" in window && !_r, yr = Nn && (!gr || _r && 8 < _r && 11 >= _r), br = " ", xr = !1;
	function Sr(e, t) {
		switch (e) {
			case "keyup": return hr.indexOf(t.keyCode) !== -1;
			case "keydown": return t.keyCode !== 229;
			case "keypress":
			case "mousedown":
			case "focusout": return !0;
			default: return !1;
		}
	}
	function Cr(e) {
		return e = e.detail, typeof e == "object" && "data" in e ? e.data : null;
	}
	var wr = !1;
	function Tr(e, t) {
		switch (e) {
			case "compositionend": return Cr(t);
			case "keypress": return t.which === 32 ? (xr = !0, br) : null;
			case "textInput": return e = t.data, e === br && xr ? null : e;
			default: return null;
		}
	}
	function Er(e, t) {
		if (wr) return e === "compositionend" || !gr && Sr(e, t) ? (e = zn(), Rn = Ln = In = null, wr = !1, e) : null;
		switch (e) {
			case "paste": return null;
			case "keypress":
				if (!(t.ctrlKey || t.altKey || t.metaKey) || t.ctrlKey && t.altKey) {
					if (t.char && 1 < t.char.length) return t.char;
					if (t.which) return String.fromCharCode(t.which);
				}
				return null;
			case "compositionend": return yr && t.locale !== "ko" ? null : t.data;
			default: return null;
		}
	}
	var Dr = {
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
	function Or(e) {
		var t = e && e.nodeName && e.nodeName.toLowerCase();
		return t === "input" ? !!Dr[e.type] : t === "textarea";
	}
	function kr(e, t, n, r) {
		Dn ? On ? On.push(r) : On = [r] : Dn = r, t = Jf(t, "onChange"), 0 < t.length && (n = new P("onChange", "change", null, n, r), e.push({
			event: n,
			listeners: t
		}));
	}
	var Ar = null, jr = null;
	function Mr(e) {
		Vf(e, 0);
	}
	function Nr(e) {
		if (sn(Vt(e))) return e;
	}
	function Pr(e, t) {
		if (e === "change") return t;
	}
	var Fr = !1;
	if (Nn) {
		var Ir;
		if (Nn) {
			var Lr = "oninput" in document;
			if (!Lr) {
				var Rr = document.createElement("div");
				Rr.setAttribute("oninput", "return;"), Lr = typeof Rr.oninput == "function";
			}
			Ir = Lr;
		} else Ir = !1;
		Fr = Ir && (!document.documentMode || 9 < document.documentMode);
	}
	function zr() {
		Ar && (Ar.detachEvent("onpropertychange", Br), jr = Ar = null);
	}
	function Br(e) {
		if (e.propertyName === "value" && Nr(jr)) {
			var t = [];
			kr(t, jr, e, En(e)), jn(Mr, t);
		}
	}
	function Vr(e, t, n) {
		e === "focusin" ? (zr(), Ar = t, jr = n, Ar.attachEvent("onpropertychange", Br)) : e === "focusout" && zr();
	}
	function Hr(e) {
		if (e === "selectionchange" || e === "keyup" || e === "keydown") return Nr(jr);
	}
	function Ur(e, t) {
		if (e === "click") return Nr(t);
	}
	function Wr(e, t) {
		if (e === "input" || e === "change") return Nr(t);
	}
	function Gr(e, t) {
		return e === t && (e !== 0 || 1 / e == 1 / t) || e !== e && t !== t;
	}
	var Kr = typeof Object.is == "function" ? Object.is : Gr;
	function qr(e, t) {
		if (Kr(e, t)) return !0;
		if (typeof e != "object" || !e || typeof t != "object" || !t) return !1;
		var n = Object.keys(e), r = Object.keys(t);
		if (n.length !== r.length) return !1;
		for (r = 0; r < n.length; r++) {
			var i = n[r];
			if (!He.call(t, i) || !Kr(e[i], t[i])) return !1;
		}
		return !0;
	}
	function Jr(e) {
		if (e ||= typeof document < "u" ? document : void 0, e === void 0) return null;
		try {
			return e.activeElement || e.body;
		} catch {
			return e.body;
		}
	}
	function Yr(e) {
		for (; e && e.firstChild;) e = e.firstChild;
		return e;
	}
	function Xr(e, t) {
		var n = Yr(e);
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
			n = Yr(n);
		}
	}
	function Zr(e, t) {
		return e && t ? e === t ? !0 : e && e.nodeType === 3 ? !1 : t && t.nodeType === 3 ? Zr(e, t.parentNode) : "contains" in e ? e.contains(t) : e.compareDocumentPosition ? !!(e.compareDocumentPosition(t) & 16) : !1 : !1;
	}
	function Qr(e) {
		e = e != null && e.ownerDocument != null && e.ownerDocument.defaultView != null ? e.ownerDocument.defaultView : window;
		for (var t = Jr(e.document); t instanceof e.HTMLIFrameElement;) {
			try {
				var n = typeof t.contentWindow.location.href == "string";
			} catch {
				n = !1;
			}
			if (n) e = t.contentWindow;
			else break;
			t = Jr(e.document);
		}
		return t;
	}
	function $r(e) {
		var t = e && e.nodeName && e.nodeName.toLowerCase();
		return t && (t === "input" && (e.type === "text" || e.type === "search" || e.type === "tel" || e.type === "url" || e.type === "password") || t === "textarea" || e.contentEditable === "true");
	}
	var ei = Nn && "documentMode" in document && 11 >= document.documentMode, ti = null, ni = null, ri = null, ii = !1;
	function ai(e, t, n) {
		var r = n.window === n ? n.document : n.nodeType === 9 ? n : n.ownerDocument;
		ii || ti == null || ti !== Jr(r) || (r = ti, "selectionStart" in r && $r(r) ? r = {
			start: r.selectionStart,
			end: r.selectionEnd
		} : (r = (r.ownerDocument && r.ownerDocument.defaultView || window).getSelection(), r = {
			anchorNode: r.anchorNode,
			anchorOffset: r.anchorOffset,
			focusNode: r.focusNode,
			focusOffset: r.focusOffset
		}), ri && qr(ri, r) || (ri = r, r = Jf(ni, "onSelect"), 0 < r.length && (t = new P("onSelect", "select", null, t, n), e.push({
			event: t,
			listeners: r
		}), t.target = ti)));
	}
	function oi(e, t) {
		var n = {};
		return n[e.toLowerCase()] = t.toLowerCase(), n["Webkit" + e] = "webkit" + t, n["Moz" + e] = "moz" + t, n;
	}
	var si = {
		animationend: oi("Animation", "AnimationEnd"),
		animationiteration: oi("Animation", "AnimationIteration"),
		animationstart: oi("Animation", "AnimationStart"),
		transitionrun: oi("Transition", "TransitionRun"),
		transitionstart: oi("Transition", "TransitionStart"),
		transitioncancel: oi("Transition", "TransitionCancel"),
		transitionend: oi("Transition", "TransitionEnd")
	}, ci = {}, li = {};
	Nn && (li = document.createElement("div").style, "AnimationEvent" in window || (delete si.animationend.animation, delete si.animationiteration.animation, delete si.animationstart.animation), "TransitionEvent" in window || delete si.transitionend.transition);
	function ui(e) {
		if (ci[e]) return ci[e];
		if (!si[e]) return e;
		var t = si[e], n;
		for (n in t) if (t.hasOwnProperty(n) && n in li) return ci[e] = t[n];
		return e;
	}
	var di = ui("animationend"), F = ui("animationiteration"), fi = ui("animationstart"), pi = ui("transitionrun"), mi = ui("transitionstart"), hi = ui("transitioncancel"), gi = ui("transitionend"), _i = /* @__PURE__ */ new Map(), vi = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error fullscreenChange fullscreenError gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
	vi.push("scrollEnd");
	function yi(e, t) {
		_i.set(e, t), M(t, [e]);
	}
	var bi = 0;
	function xi(e, t) {
		if (e.name != null && e.name !== "auto") return e.name;
		if (t.autoName !== null) return t.autoName;
		e = bd.identifierPrefix;
		var n = bi++;
		return e = "_" + e + "t_" + n.toString(32) + "_", t.autoName = e;
	}
	function Si(e) {
		if (e == null || typeof e == "string") return e;
		var t = null, n = Od;
		if (n !== null) for (var r = 0; r < n.length; r++) {
			var i = e[n[r]];
			if (i != null) {
				if (i === "none") return "none";
				t = t == null ? i : t + (" " + i);
			}
		}
		return t ?? e.default;
	}
	function Ci(e, t) {
		return e = Si(e), t = Si(t), t == null ? e === "auto" ? null : e : t === "auto" ? null : t;
	}
	var wi = typeof reportError == "function" ? reportError : function(e) {
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
	}, Ti = [], Ei = 0, Di = 0;
	function Oi() {
		for (var e = Ei, t = Di = Ei = 0; t < e;) {
			var n = Ti[t];
			Ti[t++] = null;
			var r = Ti[t];
			Ti[t++] = null;
			var i = Ti[t];
			Ti[t++] = null;
			var a = Ti[t];
			if (Ti[t++] = null, r !== null && i !== null) {
				var o = r.pending;
				o === null ? i.next = i : (i.next = o.next, o.next = i), r.pending = i;
			}
			a !== 0 && Mi(n, i, a);
		}
	}
	function ki(e, t, n, r) {
		Ti[Ei++] = e, Ti[Ei++] = t, Ti[Ei++] = n, Ti[Ei++] = r, Di |= r, e.lanes |= r, e = e.alternate, e !== null && (e.lanes |= r);
	}
	function Ai(e, t, n, r) {
		return ki(e, t, n, r), Ni(e);
	}
	function ji(e, t) {
		return ki(e, null, null, t), Ni(e);
	}
	function Mi(e, t, n) {
		e.lanes |= n;
		var r = e.alternate;
		r !== null && (r.lanes |= n);
		for (var i = !1, a = e.return; a !== null;) a.childLanes |= n, r = a.alternate, r !== null && (r.childLanes |= n), a.tag === 22 && (e = a.stateNode, e === null || e._visibility & 1 || (i = !0)), e = a, a = a.return;
		return e.tag === 3 ? (a = e.stateNode, i && t !== null && (i = 31 - at(n), e = a.hiddenUpdates, r = e[i], r === null ? e[i] = [t] : r.push(t), t.lane = n | 536870912), a) : null;
	}
	function Ni(e) {
		if (50 < kd) throw kd = 0, Ad = null, Error(s(185));
		for (var t = e.return; t !== null;) e = t, t = e.return;
		return e.tag === 3 ? e.stateNode : null;
	}
	var Pi = {};
	function Fi(e, t, n, r) {
		this.tag = e, this.key = n, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = t, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
	}
	function Ii(e, t, n, r) {
		return new Fi(e, t, n, r);
	}
	function Li(e) {
		return e = e.prototype, !(!e || !e.isReactComponent);
	}
	function Ri(e, t) {
		var n = e.alternate;
		return n === null ? (n = Ii(e.tag, t, e.key, e.mode), n.elementType = e.elementType, n.type = e.type, n.stateNode = e.stateNode, n.alternate = e, e.alternate = n) : (n.pendingProps = t, n.type = e.type, n.flags = 0, n.subtreeFlags = 0, n.deletions = null), n.flags = e.flags & 1206910976, n.childLanes = e.childLanes, n.lanes = e.lanes, n.child = e.child, n.memoizedProps = e.memoizedProps, n.memoizedState = e.memoizedState, n.updateQueue = e.updateQueue, t = e.dependencies, n.dependencies = t === null ? null : {
			lanes: t.lanes,
			firstContext: t.firstContext
		}, n.sibling = e.sibling, n.index = e.index, n.ref = e.ref, n.refCleanup = e.refCleanup, n;
	}
	function zi(e, t) {
		e.flags &= 1206910978;
		var n = e.alternate;
		return n === null ? (e.childLanes = 0, e.lanes = t, e.child = null, e.subtreeFlags = 0, e.memoizedProps = null, e.memoizedState = null, e.updateQueue = null, e.dependencies = null, e.stateNode = null) : (e.childLanes = n.childLanes, e.lanes = n.lanes, e.child = n.child, e.subtreeFlags = 0, e.deletions = null, e.memoizedProps = n.memoizedProps, e.memoizedState = n.memoizedState, e.updateQueue = n.updateQueue, e.type = n.type, t = n.dependencies, e.dependencies = t === null ? null : {
			lanes: t.lanes,
			firstContext: t.firstContext
		}), e;
	}
	function Bi(e, t, n, r, i, a) {
		var o = 0;
		if (r = e, typeof r == "function") Li(r) && (o = 1);
		else if (typeof r == "string") o = qm(e, n, De.current) ? 26 : e === "html" || e === "head" || e === "body" ? 27 : 5;
		else a: switch (r) {
			case he: return e = Ii(31, n, t, i), e.elementType = he, e.lanes = a, e;
			case oe: return Vi(n.children, i, a, t);
			case T:
				o = 8, i |= 24;
				break;
			case se: return e = Ii(12, n, t, i | 2), e.elementType = se, e.lanes = a, e;
			case de: return e = Ii(13, n, t, i), e.elementType = de, e.lanes = a, e;
			case fe: return e = Ii(19, n, t, i), e.elementType = fe, e.lanes = a, e;
			case ge:
			case ve: return e = i | 32, e = Ii(30, n, t, e), e.elementType = ve, e.lanes = a, e.stateNode = {
				autoName: null,
				paired: null,
				clones: null,
				ref: null
			}, e;
			default:
				if (typeof r == "object" && r) switch (r.$$typeof) {
					case le:
						o = 10;
						break a;
					case ce:
						o = 9;
						break a;
					case ue:
						o = 11;
						break a;
					case pe:
						o = 14;
						break a;
					case me:
						o = 16, r = null;
						break a;
				}
				o = 29, n = Error(s(130, e === null ? "null" : typeof e, "")), r = null;
		}
		return t = Ii(o, n, t, i), t.elementType = e, t.type = r, t.lanes = a, t;
	}
	function Vi(e, t, n, r) {
		return e = Ii(7, e, r, t), e.lanes = n, e;
	}
	function Hi(e, t, n) {
		return e = Ii(6, e, null, t), e.lanes = n, e;
	}
	function Ui(e) {
		var t = Ii(18, null, null, 0);
		return t.stateNode = e, t;
	}
	function Wi(e, t, n) {
		return t = Ii(4, e.children === null ? [] : e.children, e.key, t), t.lanes = n, t.stateNode = {
			containerInfo: e.containerInfo,
			pendingChildren: null,
			implementation: e.implementation
		}, t;
	}
	var Gi = /* @__PURE__ */ new WeakMap();
	function Ki(e, t) {
		if (typeof e == "object" && e) {
			var n = Gi.get(e);
			return n === void 0 ? (t = {
				value: e,
				source: t,
				stack: Ve(t)
			}, Gi.set(e, t), t) : n;
		}
		return {
			value: e,
			source: t,
			stack: Ve(t)
		};
	}
	var qi = [], Ji = 0, Yi = null, Xi = 0, Zi = [], Qi = 0, $i = null, ea = 1, ta = "";
	function na(e, t) {
		qi[Ji++] = Xi, qi[Ji++] = Yi, Yi = e, Xi = t;
	}
	function ra(e, t, n) {
		Zi[Qi++] = ea, Zi[Qi++] = ta, Zi[Qi++] = $i, $i = e;
		var r = ea;
		e = ta;
		var i = 32 - at(r) - 1;
		r &= ~(1 << i), n += 1;
		var a = 32 - at(t) + i;
		if (30 < a) {
			var o = i - i % 5;
			a = (r & (1 << o) - 1).toString(32), r >>= o, i -= o, ea = 1 << 32 - at(t) + i | n << i | r, ta = a + e;
		} else ea = 1 << a | n << i | r, ta = e;
	}
	function ia(e) {
		e.return !== null && (na(e, 1), ra(e, 1, 0));
	}
	function aa(e) {
		for (; e === Yi;) Yi = qi[--Ji], qi[Ji] = null, Xi = qi[--Ji], qi[Ji] = null;
		for (; e === $i;) $i = Zi[--Qi], Zi[Qi] = null, ta = Zi[--Qi], Zi[Qi] = null, ea = Zi[--Qi], Zi[Qi] = null;
	}
	function oa(e, t) {
		Zi[Qi++] = ea, Zi[Qi++] = ta, Zi[Qi++] = $i, ea = t.id, ta = t.overflow, $i = e;
	}
	var sa = null, I = null, L = !1, ca = null, la = !1, ua = Error(s(519));
	function da(e) {
		throw _a(Ki(Error(s(418, 1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML", "")), e)), ua;
	}
	function fa(e) {
		var t = e.stateNode, n = e.type, r = e.memoizedProps;
		switch (t[kt] = e, t[At] = r, n) {
			case "dialog":
				Q("cancel", t), Q("close", t);
				break;
			case "iframe":
			case "object":
			case "embed":
				Q("load", t);
				break;
			case "video":
			case "audio":
				for (n = 0; n < zf.length; n++) Q(zf[n], t);
				break;
			case "source":
				Q("error", t);
				break;
			case "img":
			case "image":
			case "link":
				Q("error", t), Q("load", t);
				break;
			case "details":
				Q("toggle", t);
				break;
			case "input":
				Q("invalid", t), dn(t, r.value, r.defaultValue, r.checked, r.defaultChecked, r.type, r.name, !0);
				break;
			case "select":
				Q("invalid", t);
				break;
			case "textarea": Q("invalid", t), hn(t, r.value, r.defaultValue, r.children);
		}
		n = r.children, typeof n != "string" && typeof n != "number" && typeof n != "bigint" || t.textContent === "" + n || !0 === r.suppressHydrationWarning || ep(t.textContent, n) ? (r.popover != null && (Q("beforetoggle", t), Q("toggle", t)), r.onScroll != null && Q("scroll", t), r.onScrollEnd != null && Q("scrollend", t), r.onClick != null && (t.onclick = wn), t = !0) : t = !1, t || da(e, !0);
	}
	function pa(e) {
		for (sa = e.return; sa;) switch (sa.tag) {
			case 5:
			case 31:
			case 13:
				la = !1;
				return;
			case 27:
			case 3:
				la = !0;
				return;
			default: sa = sa.return;
		}
	}
	function ma(e) {
		if (e !== sa) return !1;
		if (!L) return pa(e), L = !0, !1;
		var t = e.tag, n;
		if ((n = t !== 3 && t !== 27) && ((n = t === 5) && (n = e.type, n = n === "form" || n === "button" || pp(e.type, e.memoizedProps)), n = !n), n && I && da(e), pa(e), t === 13) {
			if (e = e.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error(s(317));
			I = dm(e);
		} else if (t === 31) {
			if (e = e.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error(s(317));
			I = dm(e);
		} else t === 27 ? (t = I, Sp(e.type) ? (e = um, um = null, I = e) : I = t) : I = sa ? lm(e.stateNode.nextSibling) : null;
		return !0;
	}
	function ha() {
		I = sa = null, L = !1;
	}
	function ga() {
		var e = ca;
		return e !== null && (fd === null ? fd = e : fd.push.apply(fd, e), ca = null), e;
	}
	function _a(e) {
		ca === null ? ca = [e] : ca.push(e);
	}
	var va = A(null), ya = null, ba = null;
	function xa(e, t, n) {
		j(va, t._currentValue), t._currentValue = n;
	}
	function Sa(e) {
		e._currentValue = va.current, Ee(va);
	}
	function Ca(e, t, n) {
		for (; e !== null;) {
			var r = e.alternate;
			if ((e.childLanes & t) === t ? r !== null && (r.childLanes & t) !== t && (r.childLanes |= t) : (e.childLanes |= t, r !== null && (r.childLanes |= t)), e === n) break;
			e = e.return;
		}
	}
	function wa(e, t, n, r) {
		var i = e.child;
		for (i !== null && (i.return = e); i !== null;) {
			var a = i.dependencies;
			if (a !== null) {
				var o = i.child;
				a = a.firstContext;
				a: for (; a !== null;) {
					var c = a;
					a = i;
					for (var l = 0; l < t.length; l++) if (c.context === t[l]) {
						a.lanes |= n, c = a.alternate, c !== null && (c.lanes |= n), Ca(a.return, n, e), r || (o = null);
						break a;
					}
					a = c.next;
				}
			} else if (i.tag === 18) {
				if (o = i.return, o === null) throw Error(s(341));
				o.lanes |= n, a = o.alternate, a !== null && (a.lanes |= n), Ca(o, n, e), o = null;
			} else i.tag === 13 && i.memoizedState !== null && i.memoizedState.dehydrated === null ? (i.lanes |= n, o = i.alternate, o !== null && (o.lanes |= n), Ca(i.return, n, e), o = i.child, o = o === null ? null : o.sibling) : o = i.child;
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
	function Ta(e, t, n, r) {
		e = null;
		for (var i = t, a = !1; i !== null;) {
			if (!a) {
				if (i.flags & 524288) a = !0;
				else if (i.flags & 262144) break;
			}
			if (i.tag === 10) {
				var o = i.alternate;
				if (o === null) throw Error(s(387));
				if (o = o.memoizedProps, o !== null) {
					var c = i.type;
					Kr(i.pendingProps.value, o.value) || (e === null ? e = [c] : e.push(c));
				}
			} else if (i === Ae.current) {
				if (o = i.alternate, o === null) throw Error(s(387));
				o.memoizedState.memoizedState !== i.memoizedState.memoizedState && (e === null ? e = [sh] : e.push(sh));
			}
			i = i.return;
		}
		return e !== null && wa(t, e, n, r), t.flags |= 262144, e !== null;
	}
	function Ea(e) {
		for (e = e.firstContext; e !== null;) {
			if (!Kr(e.context._currentValue, e.memoizedValue)) return !0;
			e = e.next;
		}
		return !1;
	}
	function Da(e) {
		ya = e, ba = null, e = e.dependencies, e !== null && (e.firstContext = null);
	}
	function Oa(e) {
		return Aa(ya, e);
	}
	function ka(e, t) {
		return ya === null && Da(e), Aa(e, t);
	}
	function Aa(e, t) {
		var n = t._currentValue;
		if (t = {
			context: t,
			memoizedValue: n,
			next: null
		}, ba === null) {
			if (e === null) throw Error(s(308));
			ba = t, e.dependencies = {
				lanes: 0,
				firstContext: t
			}, e.flags |= 524288;
		} else ba = ba.next = t;
		return n;
	}
	var ja = typeof AbortController < "u" ? AbortController : function() {
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
	}, Ma = t.unstable_scheduleCallback, Na = t.unstable_NormalPriority, Pa = {
		$$typeof: le,
		Consumer: null,
		Provider: null,
		_currentValue: null,
		_currentValue2: null,
		_threadCount: 0
	};
	function Fa() {
		return {
			controller: new ja(),
			data: /* @__PURE__ */ new Map(),
			refCount: 0
		};
	}
	function Ia(e) {
		e.refCount--, e.refCount === 0 && Ma(Na, function() {
			e.controller.abort();
		});
	}
	function La(e, t) {
		if (e.pendingLanes & 4194048) {
			var n = e.transitionTypes;
			for (n === null && (n = e.transitionTypes = []), e = 0; e < t.length; e++) {
				var r = t[e];
				n.indexOf(r) === -1 && n.push(r);
			}
		}
	}
	var Ra = null;
	function za(e) {
		var t = e.transitionTypes;
		return e.transitionTypes = null, t;
	}
	var Ba = null, Va = 0, Ha = 0, Ua = null;
	function Wa(e, t) {
		if (Ba === null) {
			var n = Ba = [];
			Va = 0, Ha = Pf(), Ua = {
				status: "pending",
				value: void 0,
				then: function(e) {
					n.push(e);
				}
			};
		}
		return Va++, t.then(Ga, Ga), t;
	}
	function Ga() {
		if (--Va === 0 && (Ra = null, Ba !== null)) {
			Ua !== null && (Ua.status = "fulfilled");
			var e = Ba;
			Ba = null, Ha = 0, Ua = null;
			for (var t = 0; t < e.length; t++) (0, e[t])();
		}
	}
	function R(e, t) {
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
	var z = O.S;
	O.S = function(e, t) {
		if (hd = qe(), typeof t == "object" && t && typeof t.then == "function" && Wa(e, t), Ra !== null) for (var n = bf; n !== null;) La(n, Ra), n = n.next;
		if (n = e.types, n !== null) {
			for (var r = bf; r !== null;) La(r, n), r = r.next;
			if (Ha !== 0) {
				r = Ra, r === null && (r = Ra = []);
				for (var i = 0; i < n.length; i++) {
					var a = n[i];
					r.indexOf(a) === -1 && r.push(a);
				}
			}
		}
		z !== null && z(e, t);
	};
	var Ka = A(null);
	function qa() {
		var e = Ka.current;
		return e === null ? q.pooledCache : e;
	}
	function Ja(e, t) {
		t === null ? j(Ka, Ka.current) : j(Ka, t.pool);
	}
	function Ya() {
		var e = qa();
		return e === null ? null : {
			parent: Pa._currentValue,
			pool: e
		};
	}
	var Xa = Error(s(460)), B = Error(s(474)), Za = Error(s(542)), Qa = { then: function() {} };
	function $a(e) {
		return e = e.status, e === "fulfilled" || e === "rejected";
	}
	function eo(e, t, n) {
		switch (n = e[n], n === void 0 ? e.push(t) : n !== t && (t.then(wn, wn), t = n), t.status) {
			case "fulfilled": return t.value;
			case "rejected": throw e = t.reason, io(e), e === void 0 && !("reason" in t) ? Error(s(600)) : e;
			default:
				if (typeof t.status == "string") t.then(wn, wn);
				else {
					if (e = q, e !== null && 100 < e.shellSuspendCounter) throw Error(s(482));
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
					case "rejected": throw e = t.reason, io(e), e;
				}
				throw no = t, Xa;
		}
	}
	function to(e) {
		try {
			var t = e._init;
			return t(e._payload);
		} catch (e) {
			throw typeof e == "object" && e && typeof e.then == "function" ? (no = e, Xa) : e;
		}
	}
	var no = null;
	function ro() {
		if (no === null) throw Error(s(459));
		var e = no;
		return no = null, e;
	}
	function io(e) {
		if (e === Xa || e === Za) throw Error(s(483));
	}
	var ao = null, oo = 0;
	function so(e) {
		var t = oo;
		return oo += 1, ao === null && (ao = []), eo(ao, e, t);
	}
	function co(e, t) {
		t = t.props.ref, e.ref = t === void 0 ? null : t;
	}
	function lo(e, t) {
		throw t.$$typeof === re ? Error(s(525)) : (e = Object.prototype.toString.call(t), Error(s(31, e === "[object Object]" ? "object with keys {" + Object.keys(t).join(", ") + "}" : e)));
	}
	function uo(e) {
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
			return e = Ri(e, t), e.index = 0, e.sibling = null, e;
		}
		function a(t, n, r) {
			return t.index = r, e ? (r = t.alternate, r === null ? (t.flags |= 134217730, n) : (r = r.index, r < n ? (t.flags |= 2, n) : r)) : (t.flags |= 1048576, n);
		}
		function o(t) {
			return e && t.alternate === null && (t.flags |= 134217730), t;
		}
		function c(e, t, n, r) {
			return t === null || t.tag !== 6 ? (t = Hi(n, e.mode, r), t.return = e, t) : (t = i(t, n), t.return = e, t);
		}
		function l(e, t, n, r) {
			var a = n.type;
			return a === oe ? (e = d(e, t, n.props.children, r, n.key), co(e, n), e) : t !== null && (t.elementType === a || typeof a == "object" && a && a.$$typeof === me && to(a) === t.type) ? (t = i(t, n.props), co(t, n), t.return = e, t) : (t = Bi(n.type, n.key, n.props, null, e.mode, r), co(t, n), t.return = e, t);
		}
		function u(e, t, n, r) {
			return t === null || t.tag !== 4 || t.stateNode.containerInfo !== n.containerInfo || t.stateNode.implementation !== n.implementation ? (t = Wi(n, e.mode, r), t.return = e, t) : (t = i(t, n.children || []), t.return = e, t);
		}
		function d(e, t, n, r, a) {
			return t === null || t.tag !== 7 ? (t = Vi(n, e.mode, r, a), t.return = e, t) : (t = i(t, n), t.return = e, t);
		}
		function f(e, t, n) {
			if (typeof t == "string" && t !== "" || typeof t == "number" || typeof t == "bigint") return t = Hi("" + t, e.mode, n), t.return = e, t;
			if (typeof t == "object" && t) {
				switch (t.$$typeof) {
					case ie: return n = Bi(t.type, t.key, t.props, null, e.mode, n), co(n, t), n.return = e, n;
					case ae: return t = Wi(t, e.mode, n), t.return = e, t;
					case me: return t = to(t), f(e, t, n);
				}
				if (Se(t) || E(t)) return t = Vi(t, e.mode, n, null), t.return = e, t;
				if (typeof t.then == "function") return f(e, so(t), n);
				if (t.$$typeof === le) return f(e, ka(e, t), n);
				lo(e, t);
			}
			return null;
		}
		function p(e, t, n, r) {
			var i = t === null ? null : t.key;
			if (typeof n == "string" && n !== "" || typeof n == "number" || typeof n == "bigint") return i === null ? c(e, t, "" + n, r) : null;
			if (typeof n == "object" && n) {
				switch (n.$$typeof) {
					case ie: return n.key === i ? l(e, t, n, r) : null;
					case ae: return n.key === i ? u(e, t, n, r) : null;
					case me: return n = to(n), p(e, t, n, r);
				}
				if (Se(n) || E(n)) return i === null ? d(e, t, n, r, null) : null;
				if (typeof n.then == "function") return p(e, t, so(n), r);
				if (n.$$typeof === le) return p(e, t, ka(e, n), r);
				lo(e, n);
			}
			return null;
		}
		function m(e, t, n, r, i) {
			if (typeof r == "string" && r !== "" || typeof r == "number" || typeof r == "bigint") return e = e.get(n) || null, c(t, e, "" + r, i);
			if (typeof r == "object" && r) {
				switch (r.$$typeof) {
					case ie: return e = e.get(r.key === null ? n : r.key) || null, l(t, e, r, i);
					case ae: return e = e.get(r.key === null ? n : r.key) || null, u(t, e, r, i);
					case me: return r = to(r), m(e, t, n, r, i);
				}
				if (Se(r) || E(r)) return e = e.get(n) || null, d(t, e, r, i, null);
				if (typeof r.then == "function") return m(e, t, n, so(r), i);
				if (r.$$typeof === le) return m(e, t, n, ka(t, r), i);
				lo(t, r);
			}
			return null;
		}
		function h(i, o, s, c) {
			for (var l = null, u = null, d = o, h = o = 0, g = null; d !== null && h < s.length; h++) {
				d.index > h ? (g = d, d = null) : g = d.sibling;
				var _ = p(i, d, s[h], c);
				if (_ === null) {
					d === null && (d = g);
					break;
				}
				e && d && _.alternate === null && t(i, d), o = a(_, o, h), u === null ? l = _ : u.sibling = _, u = _, d = g;
			}
			if (h === s.length) return n(i, d), L && na(i, h), l;
			if (d === null) {
				for (; h < s.length; h++) d = f(i, s[h], c), d !== null && (o = a(d, o, h), u === null ? l = d : u.sibling = d, u = d);
				return L && na(i, h), l;
			}
			for (d = r(d); h < s.length; h++) g = m(d, i, h, s[h], c), g !== null && (e && (_ = g.alternate, _ !== null && d.delete(_.key === null ? h : _.key)), o = a(g, o, h), u === null ? l = g : u.sibling = g, u = g);
			return e && d.forEach(function(e) {
				return t(i, e);
			}), L && na(i, h), l;
		}
		function g(i, o, c, l) {
			if (c == null) throw Error(s(151));
			for (var u = null, d = null, h = o, g = o = 0, _ = null, v = c.next(); h !== null && !v.done; g++, v = c.next()) {
				h.index > g ? (_ = h, h = null) : _ = h.sibling;
				var y = p(i, h, v.value, l);
				if (y === null) {
					h === null && (h = _);
					break;
				}
				e && h && y.alternate === null && t(i, h), o = a(y, o, g), d === null ? u = y : d.sibling = y, d = y, h = _;
			}
			if (v.done) return n(i, h), L && na(i, g), u;
			if (h === null) {
				for (; !v.done; g++, v = c.next()) v = f(i, v.value, l), v !== null && (o = a(v, o, g), d === null ? u = v : d.sibling = v, d = v);
				return L && na(i, g), u;
			}
			for (h = r(h); !v.done; g++, v = c.next()) v = m(h, i, g, v.value, l), v !== null && (e && (_ = v.alternate, _ !== null && h.delete(_.key === null ? g : _.key)), o = a(v, o, g), d === null ? u = v : d.sibling = v, d = v);
			return e && h.forEach(function(e) {
				return t(i, e);
			}), L && na(i, g), u;
		}
		function _(e, r, a, c) {
			if (typeof a == "object" && a && a.type === oe && a.key === null && a.props.ref === void 0 && (a = a.props.children), typeof a == "object" && a) {
				switch (a.$$typeof) {
					case ie:
						a: {
							for (var l = a.key; r !== null;) {
								if (r.key === l) {
									if (l = a.type, l === oe) {
										if (r.tag === 7) {
											n(e, r.sibling), c = i(r, a.props.children), co(c, a), c.return = e, e = c;
											break a;
										}
									} else if (r.elementType === l || typeof l == "object" && l && l.$$typeof === me && to(l) === r.type) {
										n(e, r.sibling), c = i(r, a.props), co(c, a), c.return = e, e = c;
										break a;
									}
									n(e, r);
									break;
								}
								t(e, r), r = r.sibling;
							}
							a.type === oe ? (c = Vi(a.props.children, e.mode, c, a.key), co(c, a), c.return = e, e = c) : (c = Bi(a.type, a.key, a.props, null, e.mode, c), co(c, a), c.return = e, e = c);
						}
						return o(e);
					case ae:
						a: {
							for (l = a.key; r !== null;) {
								if (r.key === l) {
									if (r.tag === 4 && r.stateNode.containerInfo === a.containerInfo && r.stateNode.implementation === a.implementation) {
										n(e, r.sibling), c = i(r, a.children || []), c.return = e, e = c;
										break a;
									}
									n(e, r);
									break;
								}
								t(e, r), r = r.sibling;
							}
							c = Wi(a, e.mode, c), c.return = e, e = c;
						}
						return o(e);
					case me: return a = to(a), _(e, r, a, c);
				}
				if (Se(a)) return h(e, r, a, c);
				if (E(a)) {
					if (l = E(a), typeof l != "function") throw Error(s(150));
					return a = l.call(a), g(e, r, a, c);
				}
				if (typeof a.then == "function") return _(e, r, so(a), c);
				if (a.$$typeof === le) return _(e, r, ka(e, a), c);
				lo(e, a);
			}
			return typeof a == "string" && a !== "" || typeof a == "number" || typeof a == "bigint" ? (a = "" + a, r !== null && r.tag === 6 ? (n(e, r.sibling), c = i(r, a), c.return = e, e = c) : (n(e, r), c = Hi(a, e.mode, c), c.return = e, e = c), o(e)) : n(e, r);
		}
		return function(e, t, n, r) {
			try {
				oo = 0;
				var i = _(e, t, n, r);
				return ao = null, i;
			} catch (t) {
				if (t === Xa || t === Za) throw t;
				var a = Ii(29, t, null, e.mode);
				return a.lanes = r, a.return = e, a;
			}
		};
	}
	var fo = uo(!0), po = uo(!1), mo = !1;
	function ho(e) {
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
	function go(e, t) {
		e = e.updateQueue, t.updateQueue === e && (t.updateQueue = {
			baseState: e.baseState,
			firstBaseUpdate: e.firstBaseUpdate,
			lastBaseUpdate: e.lastBaseUpdate,
			shared: e.shared,
			callbacks: null
		});
	}
	function _o(e) {
		return {
			lane: e,
			tag: 0,
			payload: null,
			callback: null,
			next: null
		};
	}
	function vo(e, t, n) {
		var r = e.updateQueue;
		if (r === null) return null;
		if (r = r.shared, K & 2) {
			var i = r.pending;
			return i === null ? t.next = t : (t.next = i.next, i.next = t), r.pending = t, t = Ni(e), Mi(e, null, n), t;
		}
		return ki(e, r, t, n), Ni(e);
	}
	function yo(e, t, n) {
		if (t = t.updateQueue, t !== null && (t = t.shared, n & 4194048)) {
			var r = t.lanes;
			r &= e.pendingLanes, n |= r, t.lanes = n, St(e, n);
		}
	}
	function bo(e, t) {
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
	var xo = !1;
	function So() {
		if (xo) {
			var e = Ua;
			if (e !== null) throw e;
		}
	}
	function Co(e, t, n, r) {
		xo = !1;
		var i = e.updateQueue;
		mo = !1;
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
				if (p ? (Y & f) === f : (r & f) === f) {
					f !== 0 && f === Ha && (xo = !0), u !== null && (u = u.next = {
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
								d = w({}, d, f);
								break a;
							case 2: mo = !0;
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
			u === null && (c = d), i.baseState = c, i.firstBaseUpdate = l, i.lastBaseUpdate = u, a === null && (i.shared.lanes = 0), od |= o, e.lanes = o, e.memoizedState = d;
		}
	}
	function wo(e, t) {
		if (typeof e != "function") throw Error(s(191, e));
		e.call(t);
	}
	function To(e, t) {
		var n = e.callbacks;
		if (n !== null) for (e.callbacks = null, e = 0; e < n.length; e++) wo(n[e], t);
	}
	var Eo = A(null), Do = A(0);
	function Oo(e, t) {
		e = id, j(Do, e), j(Eo, t), id = e | t.baseLanes;
	}
	function ko() {
		j(Do, id), j(Eo, Eo.current);
	}
	function Ao() {
		id = Do.current, Ee(Eo), Ee(Do);
	}
	var jo = A(null), Mo = null;
	function No(e) {
		var t = e.alternate;
		j(Ro, Ro.current & 1), j(jo, e), Mo === null && (t === null || Eo.current !== null || t.memoizedState !== null) && (Mo = e);
	}
	function Po(e) {
		j(Ro, Ro.current), j(jo, e), Mo === null && (Mo = e);
	}
	function Fo(e) {
		e.tag === 22 ? (j(Ro, Ro.current), j(jo, e), Mo === null && (Mo = e)) : Io();
	}
	function Io() {
		j(Ro, Ro.current), j(jo, jo.current);
	}
	function Lo(e) {
		Ee(jo), Mo === e && (Mo = null), Ee(Ro);
	}
	var Ro = A(0);
	function zo(e, t) {
		j(jo, jo.current), j(Ro, t);
	}
	function Bo(e) {
		Ee(Ro), Ee(jo), Mo === e && (Mo = null);
	}
	function Vo(e) {
		for (var t = e; t !== null;) {
			if (t.tag === 13) {
				var n = t.memoizedState;
				if (n !== null && (n = n.dehydrated, n === null || om(n) || sm(n))) return t;
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
	var Ho = 0, V = null, H = null, Uo = null, Wo = !1, Go = !1, Ko = !1, qo = 0, Jo = 0, Yo = null, Xo = 0;
	function Zo() {
		throw Error(s(321));
	}
	function Qo(e, t) {
		if (t === null) return !1;
		for (var n = 0; n < t.length && n < e.length; n++) if (!Kr(e[n], t[n])) return !1;
		return !0;
	}
	function $o(e, t, n, r, i, a) {
		return Ho = a, V = t, t.memoizedState = null, t.updateQueue = null, t.lanes = 0, O.H = e === null || e.memoizedState === null ? hc : gc, Ko = !1, a = n(r, i), Ko = !1, Go && (a = ts(t, n, r, i)), es(e), a;
	}
	function es(e) {
		O.H = mc;
		var t = H !== null && H.next !== null;
		if (Ho = 0, Uo = H = V = null, Wo = !1, Jo = 0, Yo = null, t) throw Error(s(300));
		e === null || Nc || (e = e.dependencies, e !== null && Ea(e) && (Nc = !0));
	}
	function ts(e, t, n, r) {
		V = e;
		var i = 0;
		do {
			if (Go && (Yo = null), Jo = 0, Go = !1, 25 <= i) throw Error(s(301));
			if (i += 1, Uo = H = null, e.updateQueue != null) {
				var a = e.updateQueue;
				a.lastEffect = null, a.events = null, a.stores = null, a.memoCache != null && (a.memoCache.index = 0);
			}
			O.H = _c, a = t(n, r);
		} while (Go);
		return a;
	}
	function ns() {
		var e = O.H, t = e.useState()[0];
		return t = typeof t.then == "function" ? ls(t) : t, e = e.useState()[0], (H === null ? null : H.memoizedState) !== e && (V.flags |= 1024), t;
	}
	function rs() {
		var e = qo !== 0;
		return qo = 0, e;
	}
	function is(e, t, n) {
		t.updateQueue = e.updateQueue, t.flags &= -2053, e.lanes &= ~n;
	}
	function as(e) {
		if (Wo) {
			for (e = e.memoizedState; e !== null;) {
				var t = e.queue;
				t !== null && (t.pending = null), e = e.next;
			}
			Wo = !1;
		}
		Ho = 0, Uo = H = V = null, Go = !1, Jo = qo = 0, Yo = null;
	}
	function os() {
		var e = {
			memoizedState: null,
			baseState: null,
			baseQueue: null,
			queue: null,
			next: null
		};
		return Uo === null ? V.memoizedState = Uo = e : Uo = Uo.next = e, Uo;
	}
	function ss() {
		if (H === null) {
			var e = V.alternate;
			e = e === null ? null : e.memoizedState;
		} else e = H.next;
		var t = Uo === null ? V.memoizedState : Uo.next;
		if (t !== null) Uo = t, H = e;
		else {
			if (e === null) throw V.alternate === null ? Error(s(467)) : Error(s(310));
			H = e, e = {
				memoizedState: H.memoizedState,
				baseState: H.baseState,
				baseQueue: H.baseQueue,
				queue: H.queue,
				next: null
			}, Uo === null ? V.memoizedState = Uo = e : Uo = Uo.next = e;
		}
		return Uo;
	}
	function cs() {
		return {
			lastEffect: null,
			events: null,
			stores: null,
			memoCache: null
		};
	}
	function ls(e) {
		var t = Jo;
		return Jo += 1, Yo === null && (Yo = []), e = eo(Yo, e, t), t = V, (Uo === null ? t.memoizedState : Uo.next) === null && (t = t.alternate, O.H = t === null || t.memoizedState === null ? hc : gc), e;
	}
	function us(e) {
		if (typeof e == "object" && e) {
			if (typeof e.then == "function") return ls(e);
			if (e.$$typeof === ye) return;
			if (e.$$typeof === le) return Oa(e);
		}
		throw Error(s(438, String(e)));
	}
	function ds(e) {
		var t = null, n = V.updateQueue;
		if (n !== null && (t = n.memoCache), t == null) {
			var r = V.alternate;
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
		}, n === null && (n = cs(), V.updateQueue = n), n.memoCache = t, n = t.data[t.index], n === void 0) for (n = t.data[t.index] = Array(e), r = 0; r < e; r++) n[r] = _e;
		return t.index++, n;
	}
	function fs(e, t) {
		return typeof t == "function" ? t(e) : t;
	}
	function ps(e) {
		return ms(ss(), H, e);
	}
	function ms(e, t, n) {
		var r = e.queue;
		if (r === null) throw Error(s(311));
		r.lastRenderedReducer = n;
		var i = e.baseQueue, a = r.pending;
		if (a !== null) {
			if (i !== null) {
				var o = i.next;
				i.next = a.next, a.next = o;
			}
			t.baseQueue = i = a, r.pending = null;
		}
		if (a = e.baseState, i === null) e.memoizedState = a;
		else {
			t = i.next;
			var c = o = null, l = null, u = t, d = !1;
			do {
				var f = u.lane & -536870913;
				if (f === u.lane ? (Ho & f) === f : (Y & f) === f) {
					var p = u.revertLane;
					if (p === 0) l !== null && (l = l.next = {
						lane: 0,
						revertLane: 0,
						gesture: null,
						action: u.action,
						hasEagerState: u.hasEagerState,
						eagerState: u.eagerState,
						next: null
					}), f === Ha && (d = !0);
					else if ((Ho & p) === p) {
						u = u.next, p === Ha && (d = !0);
						continue;
					} else f = {
						lane: 0,
						revertLane: u.revertLane,
						gesture: null,
						action: u.action,
						hasEagerState: u.hasEagerState,
						eagerState: u.eagerState,
						next: null
					}, l === null ? (c = l = f, o = a) : l = l.next = f, V.lanes |= p, od |= p;
					f = u.action, Ko && n(a, f), a = u.hasEagerState ? u.eagerState : n(a, f);
				} else p = {
					lane: f,
					revertLane: u.revertLane,
					gesture: u.gesture,
					action: u.action,
					hasEagerState: u.hasEagerState,
					eagerState: u.eagerState,
					next: null
				}, l === null ? (c = l = p, o = a) : l = l.next = p, V.lanes |= f, od |= f;
				u = u.next;
			} while (u !== null && u !== t);
			if (l === null ? o = a : l.next = c, !Kr(a, e.memoizedState) && (Nc = !0, d && (n = Ua, n !== null))) throw n;
			e.memoizedState = a, e.baseState = o, e.baseQueue = l, r.lastRenderedState = a;
		}
		return i === null && (r.lanes = 0), [e.memoizedState, r.dispatch];
	}
	function hs(e) {
		var t = ss(), n = t.queue;
		if (n === null) throw Error(s(311));
		n.lastRenderedReducer = e;
		var r = n.dispatch, i = n.pending, a = t.memoizedState;
		if (i !== null) {
			n.pending = null;
			var o = i = i.next;
			do
				a = e(a, o.action), o = o.next;
			while (o !== i);
			Kr(a, t.memoizedState) || (Nc = !0), t.memoizedState = a, t.baseQueue === null && (t.baseState = a), n.lastRenderedState = a;
		}
		return [a, r];
	}
	function gs(e, t, n) {
		var r = V, i = ss(), a = L;
		if (a) {
			if (n === void 0) throw Error(s(407));
			n = n();
		} else n = t();
		var o = !Kr((H || i).memoizedState, n);
		if (o && (i.memoizedState = n, Nc = !0), i = i.queue, Bs(U.bind(null, r, i, e), [e]), e = i.getSnapshot !== t || o || Uo !== null && !!(Uo.memoizedState.tag & 1), Fs(e ? 9 : 8, { destroy: void 0 }, vs.bind(null, r, i, n, t), null), e) {
			if (r.flags |= 2048, q === null) throw Error(s(349));
			a || Ho & 127 || _s(r, t, n);
		}
		return n;
	}
	function _s(e, t, n) {
		e.flags |= 16384, e = {
			getSnapshot: t,
			value: n
		}, t = V.updateQueue, t === null ? (t = cs(), V.updateQueue = t, t.stores = [e]) : (n = t.stores, n === null ? t.stores = [e] : n.push(e));
	}
	function vs(e, t, n, r) {
		t.value = n, t.getSnapshot = r, ys(t) && bs(e);
	}
	function U(e, t, n) {
		return n(function() {
			ys(t) && bs(e);
		});
	}
	function ys(e) {
		var t = e.getSnapshot;
		e = e.value;
		try {
			var n = t();
			return !Kr(e, n);
		} catch {
			return !0;
		}
	}
	function bs(e) {
		var t = ji(e, 2);
		t !== null && Pd(t, e, 2);
	}
	function xs(e) {
		var t = os();
		if (typeof e == "function") {
			var n = e;
			if (e = n(), Ko) {
				it(!0);
				try {
					n();
				} finally {
					it(!1);
				}
			}
		}
		return t.memoizedState = t.baseState = e, t.queue = {
			pending: null,
			lanes: 0,
			dispatch: null,
			lastRenderedReducer: fs,
			lastRenderedState: e
		}, t;
	}
	function Ss(e, t, n, r) {
		return e.baseState = n, ms(e, H, typeof r == "function" ? r : fs);
	}
	function Cs(e, t, n, r, i) {
		if (dc(e)) throw Error(s(485));
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
			O.T === null ? a.isTransition = !1 : n(!0), r(a), n = t.pending, n === null ? (a.next = t.pending = a, ws(t, a)) : (a.next = n.next, t.pending = n.next = a);
		}
	}
	function ws(e, t) {
		var n = t.action, r = t.payload, i = e.state;
		if (t.isTransition) {
			var a = O.T, o = {};
			o.types = a === null ? null : a.types, O.T = o;
			try {
				var s = n(i, r), c = O.S;
				c !== null && c(o, s), Ts(e, t, s);
			} catch (n) {
				Ds(e, t, n);
			} finally {
				a !== null && o.types !== null && (a.types = o.types), O.T = a;
			}
		} else try {
			a = n(i, r), Ts(e, t, a);
		} catch (n) {
			Ds(e, t, n);
		}
	}
	function Ts(e, t, n) {
		typeof n == "object" && n && typeof n.then == "function" ? n.then(function(n) {
			Es(e, t, n);
		}, function(n) {
			return Ds(e, t, n);
		}) : Es(e, t, n);
	}
	function Es(e, t, n) {
		t.status = "fulfilled", t.value = n, Os(t), e.state = n, t = e.pending, t !== null && (n = t.next, n === t ? e.pending = null : (n = n.next, t.next = n, ws(e, n)));
	}
	function Ds(e, t, n) {
		var r = e.pending;
		if (e.pending = null, r !== null) {
			r = r.next;
			do
				t.status = "rejected", t.reason = n, Os(t), t = t.next;
			while (t !== r);
		}
		e.action = null;
	}
	function Os(e) {
		e = e.listeners;
		for (var t = 0; t < e.length; t++) (0, e[t])();
	}
	function ks(e, t) {
		return t;
	}
	function As(e, t) {
		if (L) {
			var n = q.formState;
			if (n !== null) {
				a: {
					var r = V;
					if (L) {
						if (I) {
							b: {
								for (var i = I, a = la; i.nodeType !== 8;) {
									if (!a) {
										i = null;
										break b;
									}
									if (i = lm(i.nextSibling), i === null) {
										i = null;
										break b;
									}
								}
								a = i.data, i = a === "F!" || a === "F" ? i : null;
							}
							if (i) {
								I = lm(i.nextSibling), r = i.data === "F!";
								break a;
							}
						}
						da(r);
					}
					r = !1;
				}
				r && (t = n[0]);
			}
		}
		return n = os(), n.memoizedState = n.baseState = t, r = {
			pending: null,
			lanes: 0,
			dispatch: null,
			lastRenderedReducer: ks,
			lastRenderedState: t
		}, n.queue = r, n = cc.bind(null, V, r), r.dispatch = n, r = xs(!1), a = uc.bind(null, V, !1, r.queue), r = os(), i = {
			state: t,
			dispatch: null,
			action: e,
			pending: null
		}, r.queue = i, n = Cs.bind(null, V, i, a, n), i.dispatch = n, r.memoizedState = e, [
			t,
			n,
			!1
		];
	}
	function js(e) {
		return Ms(ss(), H, e);
	}
	function Ms(e, t, n) {
		if (t = ms(e, t, ks)[0], e = ps(fs)[0], typeof t == "object" && t && typeof t.then == "function") try {
			var r = ls(t);
		} catch (e) {
			throw e === Xa ? Za : e;
		}
		else r = t;
		t = ss();
		var i = t.queue, a = i.dispatch;
		return n !== t.memoizedState && (V.flags |= 2048, Fs(9, { destroy: void 0 }, Ns.bind(null, i, n), null)), [
			r,
			a,
			e
		];
	}
	function Ns(e, t) {
		e.action = t;
	}
	function Ps(e) {
		var t = ss(), n = H;
		if (n !== null) return Ms(t, n, e);
		ss(), t = t.memoizedState, n = ss();
		var r = n.queue.dispatch;
		return n.memoizedState = e, [
			t,
			r,
			!1
		];
	}
	function Fs(e, t, n, r) {
		return e = {
			tag: e,
			create: n,
			deps: r,
			inst: t,
			next: null
		}, t = V.updateQueue, t === null && (t = cs(), V.updateQueue = t), n = t.lastEffect, n === null ? t.lastEffect = e.next = e : (r = n.next, n.next = e, e.next = r, t.lastEffect = e), e;
	}
	function Is() {
		return ss().memoizedState;
	}
	function Ls(e, t, n, r) {
		var i = os();
		V.flags |= e, i.memoizedState = Fs(1 | t, { destroy: void 0 }, n, r === void 0 ? null : r);
	}
	function Rs(e, t, n, r) {
		var i = ss();
		r = r === void 0 ? null : r;
		var a = i.memoizedState.inst;
		H !== null && r !== null && Qo(r, H.memoizedState.deps) ? i.memoizedState = Fs(t, a, n, r) : (V.flags |= e, i.memoizedState = Fs(1 | t, a, n, r));
	}
	function zs(e, t) {
		Ls(8390656, 8, e, t);
	}
	function Bs(e, t) {
		Rs(2048, 8, e, t);
	}
	function Vs(e) {
		V.flags |= 4;
		var t = V.updateQueue;
		if (t === null) t = cs(), V.updateQueue = t, t.events = [e];
		else {
			var n = t.events;
			n === null ? t.events = [e] : n.push(e);
		}
	}
	function Hs(e) {
		var t = ss().memoizedState;
		return Vs({
			ref: t,
			nextImpl: e
		}), function() {
			if (K & 2) throw Error(s(440));
			return t.impl.apply(void 0, arguments);
		};
	}
	function Us(e, t) {
		return Rs(4, 2, e, t);
	}
	function Ws(e, t) {
		return Rs(4, 4, e, t);
	}
	function Gs(e, t) {
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
	function Ks(e, t, n) {
		n = n == null ? null : n.concat([e]), Rs(4, 4, Gs.bind(null, t, e), n);
	}
	function qs() {}
	function Js(e, t) {
		var n = ss();
		t = t === void 0 ? null : t;
		var r = n.memoizedState;
		return t !== null && Qo(t, r[1]) ? r[0] : (n.memoizedState = [e, t], e);
	}
	function Ys(e, t) {
		var n = ss();
		t = t === void 0 ? null : t;
		var r = n.memoizedState;
		if (t !== null && Qo(t, r[1])) return r[0];
		if (r = e(), Ko) {
			it(!0);
			try {
				e();
			} finally {
				it(!1);
			}
		}
		return n.memoizedState = [r, t], r;
	}
	function Xs(e, t, n) {
		return n === void 0 || Ho & 1073741824 && !(Y & 261930) ? e.memoizedState = t : (e.memoizedState = n, e = Md(), V.lanes |= e, od |= e, n);
	}
	function Zs(e, t, n, r) {
		return Kr(n, t) ? n : Eo.current === null ? !(Ho & 106) || Ho & 1073741824 && !(Y & 261930) ? (Nc = !0, e.memoizedState = n) : (e = Md(), V.lanes |= e, od |= e, t) : (e = Xs(e, n, r), Kr(e, t) || (Nc = !0), e);
	}
	function Qs(e, t, n, r, i) {
		var a = k.p;
		k.p = a !== 0 && 8 > a ? a : 8;
		var o = O.T, s = {};
		s.types = o === null ? null : o.types, O.T = s, uc(e, !1, t, n);
		try {
			var c = i(), l = O.S;
			l !== null && l(s, c), typeof c == "object" && c && typeof c.then == "function" ? lc(e, t, R(c, r), jd(e)) : lc(e, t, r, jd(e));
		} catch (n) {
			lc(e, t, {
				then: function() {},
				status: "rejected",
				reason: n
			}, jd());
		} finally {
			k.p = a, o !== null && s.types !== null && (o.types = s.types), O.T = o;
		}
	}
	function $s() {}
	function ec(e, t, n, r) {
		if (e.tag !== 5) throw Error(s(476));
		var i = tc(e).queue;
		Qs(e, i, t, Ce, n === null ? $s : function() {
			return nc(e), n(r);
		});
	}
	function tc(e) {
		var t = e.memoizedState;
		if (t !== null) return t;
		t = {
			memoizedState: Ce,
			baseState: Ce,
			baseQueue: null,
			queue: {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: fs,
				lastRenderedState: Ce
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
				lastRenderedReducer: fs,
				lastRenderedState: n
			},
			next: null
		}, e.memoizedState = t, e = e.alternate, e !== null && (e.memoizedState = t), t;
	}
	function nc(e) {
		var t = tc(e);
		t.next === null && (t = e.alternate.memoizedState), lc(e, t.next.queue, {}, jd());
	}
	function rc() {
		return Oa(sh);
	}
	function ic() {
		return ss().memoizedState;
	}
	function ac() {
		return ss().memoizedState;
	}
	function oc(e) {
		for (var t = e.return; t !== null;) {
			switch (t.tag) {
				case 24:
				case 3:
					var n = jd();
					e = _o(n);
					var r = vo(t, e, n);
					r !== null && (Pd(r, t, n), yo(r, t, n)), t = { cache: Fa() }, e.payload = t;
					return;
			}
			t = t.return;
		}
	}
	function sc(e, t, n) {
		var r = jd();
		n = {
			lane: r,
			revertLane: 0,
			gesture: null,
			action: n,
			hasEagerState: !1,
			eagerState: null,
			next: null
		}, dc(e) ? fc(t, n) : (n = Ai(e, t, n, r), n !== null && (Pd(n, e, r), pc(n, t, r)));
	}
	function cc(e, t, n) {
		lc(e, t, n, jd());
	}
	function lc(e, t, n, r) {
		var i = {
			lane: r,
			revertLane: 0,
			gesture: null,
			action: n,
			hasEagerState: !1,
			eagerState: null,
			next: null
		};
		if (dc(e)) fc(t, i);
		else {
			var a = e.alternate;
			if (e.lanes === 0 && (a === null || a.lanes === 0) && (a = t.lastRenderedReducer, a !== null)) try {
				var o = t.lastRenderedState, s = a(o, n);
				if (i.hasEagerState = !0, i.eagerState = s, Kr(s, o)) return ki(e, t, i, 0), q === null && Oi(), !1;
			} catch {}
			if (n = Ai(e, t, i, r), n !== null) return Pd(n, e, r), pc(n, t, r), !0;
		}
		return !1;
	}
	function uc(e, t, n, r) {
		if (r = {
			lane: 2,
			revertLane: Pf(),
			gesture: null,
			action: r,
			hasEagerState: !1,
			eagerState: null,
			next: null
		}, dc(e)) {
			if (t) throw Error(s(479));
		} else t = Ai(e, n, r, 2), t !== null && Pd(t, e, 2);
	}
	function dc(e) {
		var t = e.alternate;
		return e === V || t !== null && t === V;
	}
	function fc(e, t) {
		Go = Wo = !0;
		var n = e.pending;
		n === null ? t.next = t : (t.next = n.next, n.next = t), e.pending = t;
	}
	function pc(e, t, n) {
		if (n & 4194048) {
			var r = t.lanes;
			r &= e.pendingLanes, n |= r, t.lanes = n, St(e, n);
		}
	}
	var mc = {
		readContext: Oa,
		use: us,
		useCallback: Zo,
		useContext: Zo,
		useEffect: Zo,
		useImperativeHandle: Zo,
		useLayoutEffect: Zo,
		useInsertionEffect: Zo,
		useMemo: Zo,
		useReducer: Zo,
		useRef: Zo,
		useState: Zo,
		useDebugValue: Zo,
		useDeferredValue: Zo,
		useTransition: Zo,
		useSyncExternalStore: Zo,
		useId: Zo,
		useHostTransitionStatus: Zo,
		useFormState: Zo,
		useActionState: Zo,
		useOptimistic: Zo,
		useMemoCache: Zo,
		useCacheRefresh: Zo,
		useEffectEvent: Zo
	}, hc = {
		readContext: Oa,
		use: us,
		useCallback: function(e, t) {
			return os().memoizedState = [e, t === void 0 ? null : t], e;
		},
		useContext: Oa,
		useEffect: zs,
		useImperativeHandle: function(e, t, n) {
			n = n == null ? null : n.concat([e]), Ls(4194308, 4, Gs.bind(null, t, e), n);
		},
		useLayoutEffect: function(e, t) {
			return Ls(4194308, 4, e, t);
		},
		useInsertionEffect: function(e, t) {
			Ls(4, 2, e, t);
		},
		useMemo: function(e, t) {
			var n = os();
			t = t === void 0 ? null : t;
			var r = e();
			if (Ko) {
				it(!0);
				try {
					e();
				} finally {
					it(!1);
				}
			}
			return n.memoizedState = [r, t], r;
		},
		useReducer: function(e, t, n) {
			var r = os();
			if (n !== void 0) {
				var i = n(t);
				if (Ko) {
					it(!0);
					try {
						n(t);
					} finally {
						it(!1);
					}
				}
			} else i = t;
			return r.memoizedState = r.baseState = i, e = {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: e,
				lastRenderedState: i
			}, r.queue = e, e = e.dispatch = sc.bind(null, V, e), [r.memoizedState, e];
		},
		useRef: function(e) {
			var t = os();
			return e = { current: e }, t.memoizedState = e;
		},
		useState: function(e) {
			e = xs(e);
			var t = e.queue, n = cc.bind(null, V, t);
			return t.dispatch = n, [e.memoizedState, n];
		},
		useDebugValue: qs,
		useDeferredValue: function(e, t) {
			return Xs(os(), e, t);
		},
		useTransition: function() {
			var e = xs(!1);
			return e = Qs.bind(null, V, e.queue, !0, !1), os().memoizedState = e, [!1, e];
		},
		useSyncExternalStore: function(e, t, n) {
			var r = V, i = os();
			if (L) {
				if (n === void 0) throw Error(s(407));
				n = n();
			} else {
				if (n = t(), q === null) throw Error(s(349));
				Y & 127 || _s(r, t, n);
			}
			i.memoizedState = n;
			var a = {
				value: n,
				getSnapshot: t
			};
			return i.queue = a, zs(U.bind(null, r, a, e), [e]), r.flags |= 2048, Fs(9, { destroy: void 0 }, vs.bind(null, r, a, n, t), null), n;
		},
		useId: function() {
			var e = os(), t = q.identifierPrefix;
			if (L) {
				var n = ta, r = ea;
				n = (r & ~(1 << 32 - at(r) - 1)).toString(32) + n, t = "_" + t + "R_" + n, n = qo++, 0 < n && (t += "H" + n.toString(32)), t += "_";
			} else n = Xo++, t = "_" + t + "r_" + n.toString(32) + "_";
			return e.memoizedState = t;
		},
		useHostTransitionStatus: rc,
		useFormState: As,
		useActionState: As,
		useOptimistic: function(e) {
			var t = os();
			t.memoizedState = t.baseState = e;
			var n = {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: null,
				lastRenderedState: null
			};
			return t.queue = n, t = uc.bind(null, V, !0, n), n.dispatch = t, [e, t];
		},
		useMemoCache: ds,
		useCacheRefresh: function() {
			return os().memoizedState = oc.bind(null, V);
		},
		useEffectEvent: function(e) {
			var t = os(), n = { impl: e };
			return t.memoizedState = n, function() {
				if (K & 2) throw Error(s(440));
				return n.impl.apply(void 0, arguments);
			};
		}
	}, gc = {
		readContext: Oa,
		use: us,
		useCallback: Js,
		useContext: Oa,
		useEffect: Bs,
		useImperativeHandle: Ks,
		useInsertionEffect: Us,
		useLayoutEffect: Ws,
		useMemo: Ys,
		useReducer: ps,
		useRef: Is,
		useState: function() {
			return ps(fs);
		},
		useDebugValue: qs,
		useDeferredValue: function(e, t) {
			return Zs(ss(), H.memoizedState, e, t);
		},
		useTransition: function() {
			var e = ps(fs)[0], t = ss().memoizedState;
			return [typeof e == "boolean" ? e : ls(e), t];
		},
		useSyncExternalStore: gs,
		useId: ic,
		useHostTransitionStatus: rc,
		useFormState: js,
		useActionState: js,
		useOptimistic: function(e, t) {
			return Ss(ss(), H, e, t);
		},
		useMemoCache: ds,
		useCacheRefresh: ac,
		useEffectEvent: Hs
	}, _c = {
		readContext: Oa,
		use: us,
		useCallback: Js,
		useContext: Oa,
		useEffect: Bs,
		useImperativeHandle: Ks,
		useInsertionEffect: Us,
		useLayoutEffect: Ws,
		useMemo: Ys,
		useReducer: hs,
		useRef: Is,
		useState: function() {
			return hs(fs);
		},
		useDebugValue: qs,
		useDeferredValue: function(e, t) {
			var n = ss();
			return H === null ? Xs(n, e, t) : Zs(n, H.memoizedState, e, t);
		},
		useTransition: function() {
			var e = hs(fs)[0], t = ss().memoizedState;
			return [typeof e == "boolean" ? e : ls(e), t];
		},
		useSyncExternalStore: gs,
		useId: ic,
		useHostTransitionStatus: rc,
		useFormState: Ps,
		useActionState: Ps,
		useOptimistic: function(e, t) {
			var n = ss();
			return H === null ? (n.baseState = e, [e, n.queue.dispatch]) : Ss(n, H, e, t);
		},
		useMemoCache: ds,
		useCacheRefresh: ac,
		useEffectEvent: Hs
	};
	function vc(e, t, n, r) {
		t = e.memoizedState, n = n(r, t), n = n == null ? t : w({}, t, n), e.memoizedState = n, e.lanes === 0 && (e.updateQueue.baseState = n);
	}
	var yc = {
		enqueueSetState: function(e, t, n) {
			e = e._reactInternals;
			var r = jd(), i = _o(r);
			i.payload = t, n != null && (i.callback = n), t = vo(e, i, r), t !== null && (Pd(t, e, r), yo(t, e, r));
		},
		enqueueReplaceState: function(e, t, n) {
			e = e._reactInternals;
			var r = jd(), i = _o(r);
			i.tag = 1, i.payload = t, n != null && (i.callback = n), t = vo(e, i, r), t !== null && (Pd(t, e, r), yo(t, e, r));
		},
		enqueueForceUpdate: function(e, t) {
			e = e._reactInternals;
			var n = jd(), r = _o(n);
			r.tag = 2, t != null && (r.callback = t), t = vo(e, r, n), t !== null && (Pd(t, e, n), yo(t, e, n));
		}
	};
	function bc(e, t, n, r, i, a, o) {
		return e = e.stateNode, typeof e.shouldComponentUpdate == "function" ? e.shouldComponentUpdate(r, a, o) : t.prototype && t.prototype.isPureReactComponent ? !qr(n, r) || !qr(i, a) : !0;
	}
	function xc(e, t, n, r) {
		e = t.state, typeof t.componentWillReceiveProps == "function" && t.componentWillReceiveProps(n, r), typeof t.UNSAFE_componentWillReceiveProps == "function" && t.UNSAFE_componentWillReceiveProps(n, r), t.state !== e && yc.enqueueReplaceState(t, t.state, null);
	}
	function Sc(e, t) {
		var n = t;
		if ("ref" in t) for (var r in n = {}, t) r !== "ref" && (n[r] = t[r]);
		if (e = e.defaultProps) for (var i in n === t && (n = w({}, n)), e) n[i] === void 0 && (n[i] = e[i]);
		return n;
	}
	function Cc(e) {
		wi(e);
	}
	function wc(e) {
		console.error(e);
	}
	function Tc(e) {
		wi(e);
	}
	function Ec(e, t) {
		try {
			var n = e.onUncaughtError;
			n(t.value, { componentStack: t.stack });
		} catch (e) {
			setTimeout(function() {
				throw e;
			});
		}
	}
	function Dc(e, t, n) {
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
	function Oc(e, t, n) {
		return n = _o(n), n.tag = 3, n.payload = { element: null }, n.callback = function() {
			Ec(e, t);
		}, n;
	}
	function kc(e) {
		return e = _o(e), e.tag = 3, e;
	}
	function Ac(e, t, n, r) {
		var i = n.type.getDerivedStateFromError;
		if (typeof i == "function") {
			var a = r.value;
			e.payload = function() {
				return i(a);
			}, e.callback = function() {
				Dc(t, n, r);
			};
		}
		var o = n.stateNode;
		o !== null && typeof o.componentDidCatch == "function" && (e.callback = function() {
			Dc(t, n, r), typeof i != "function" && (vd === null ? vd = /* @__PURE__ */ new Set([this]) : vd.add(this));
			var e = r.stack;
			this.componentDidCatch(r.value, { componentStack: e === null ? "" : e });
		});
	}
	function jc(e, t, n, r, i) {
		if (n.flags |= 32768, typeof r == "object" && r && typeof r.then == "function") {
			if (t = n.alternate, t !== null && Ta(t, n, i, !0), n = jo.current, n !== null) {
				switch (n.tag) {
					case 31:
					case 13:
					case 19: return Mo === null ? Kd() : n.alternate === null && ad === 0 && (ad = 3), n.flags &= -257, n.flags |= 65536, n.lanes = i, r === Qa ? n.flags |= 16384 : (t = n.updateQueue, t === null ? n.updateQueue = /* @__PURE__ */ new Set([r]) : t.add(r), mf(e, r, i)), !1;
					case 22: return n.flags |= 65536, r === Qa ? n.flags |= 16384 : (t = n.updateQueue, t === null ? (t = {
						transitions: null,
						markerInstances: null,
						retryQueue: /* @__PURE__ */ new Set([r])
					}, n.updateQueue = t) : (n = t.retryQueue, n === null ? t.retryQueue = /* @__PURE__ */ new Set([r]) : n.add(r)), mf(e, r, i)), !1;
				}
				throw Error(s(435, n.tag));
			}
			return mf(e, r, i), Kd(), !1;
		}
		if (L) return t = jo.current, t === null ? (r !== ua && (t = Error(s(423), { cause: r }), _a(Ki(t, n))), e = e.current.alternate, e.flags |= 65536, i &= -i, e.lanes |= i, r = Ki(r, n), i = Oc(e.stateNode, r, i), bo(e, i), ad !== 4 && (ad = 2)) : (!(t.flags & 65536) && (t.flags |= 256), t.flags |= 65536, t.lanes = i, r !== ua && (e = Error(s(422), { cause: r }), _a(Ki(e, n)))), !1;
		var a = Error(s(520), { cause: r });
		if (a = Ki(a, n), dd === null ? dd = [a] : dd.push(a), ad !== 4 && (ad = 2), t === null) return !0;
		r = Ki(r, n), n = t;
		do {
			switch (n.tag) {
				case 3: return n.flags |= 65536, e = i & -i, n.lanes |= e, e = Oc(n.stateNode, r, e), bo(n, e), !1;
				case 1:
					if (t = n.type, a = n.stateNode, !(n.flags & 128) && (typeof t.getDerivedStateFromError == "function" || a !== null && typeof a.componentDidCatch == "function" && (vd === null || !vd.has(a)))) return n.flags |= 65536, i &= -i, n.lanes |= i, i = kc(i), Ac(i, e, n, r), bo(n, i), !1;
					break;
				case 22: if (n.memoizedState !== null) return n.flags |= 65536, !1;
			}
			n = n.return;
		} while (n !== null);
		return !1;
	}
	var Mc = Error(s(461)), Nc = !1;
	function Pc(e, t, n, r) {
		t.child = e === null ? po(t, null, n, r) : fo(t, e.child, n, r);
	}
	function Fc(e, t, n, r, i) {
		n = n.render;
		var a = t.ref;
		if ("ref" in r) {
			var o = {};
			for (var s in r) s !== "ref" && (o[s] = r[s]);
		} else o = r;
		return Da(t), r = $o(e, t, n, o, a, i), s = rs(), e !== null && !Nc ? (is(e, t, i), ll(e, t, i)) : (L && s && ia(t), t.flags |= 1, Pc(e, t, r, i), t.child);
	}
	function Ic(e, t, n, r, i) {
		if (e === null) {
			var a = n.type;
			return typeof a == "function" && !Li(a) && a.defaultProps === void 0 && n.compare === null ? (t.tag = 15, t.type = a, Lc(e, t, a, r, i)) : (e = Bi(n.type, null, r, t, t.mode, i), e.ref = t.ref, e.return = t, t.child = e);
		}
		if (a = e.child, !ul(e, i)) {
			var o = a.memoizedProps;
			if (n = n.compare, n = n === null ? qr : n, n(o, r) && e.ref === t.ref) return ll(e, t, i);
		}
		return t.flags |= 1, e = Ri(a, r), e.ref = t.ref, e.return = t, t.child = e;
	}
	function Lc(e, t, n, r, i) {
		if (e !== null) {
			var a = e.memoizedProps;
			if (qr(a, r) && e.ref === t.ref) {
				if (Nc = !1, t.pendingProps = r = a, ul(e, i)) e.flags & 131072 && (Nc = !0);
				else return t.lanes = e.lanes, ll(e, t, i);
			}
		}
		return Gc(e, t, n, r, i);
	}
	function Rc(e, t, n, r) {
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
				return Bc(e, t, a, n, r);
			}
			if (n & 536870912) t.memoizedState = {
				baseLanes: 0,
				cachePool: null
			}, e !== null && Ja(t, a === null ? null : a.cachePool), a === null ? ko() : Oo(t, a), Fo(t);
			else return r = t.lanes = 536870912, Bc(e, t, a === null ? n : a.baseLanes | n, n, r);
		} else a === null ? (e !== null && Ja(t, null), ko(), Io()) : (Ja(t, a.cachePool), Oo(t, a), Io(), t.memoizedState = null);
		return Pc(e, t, i, n), t.child;
	}
	function zc(e, t) {
		return e !== null && e.tag === 22 || t.stateNode !== null || (t.stateNode = {
			_visibility: 1,
			_pendingMarkers: null,
			_retryCache: null,
			_transitions: null
		}), t.sibling;
	}
	function Bc(e, t, n, r, i) {
		var a = qa();
		return a = a === null ? null : {
			parent: Pa._currentValue,
			pool: a
		}, t.memoizedState = {
			baseLanes: n,
			cachePool: a
		}, e !== null && Ja(t, null), ko(), Fo(t), e !== null && Ta(e, t, r, !0), t.childLanes = i, null;
	}
	function Vc(e, t) {
		return t = el({
			mode: t.mode,
			children: t.children
		}, e.mode), t.ref = e.ref, e.child = t, t.return = e, t;
	}
	function Hc(e, t, n) {
		return fo(t, e.child, null, n), e = Vc(t, t.pendingProps), e.flags |= 2, Lo(t), t.memoizedState = null, e;
	}
	function Uc(e, t, n) {
		var r = t.pendingProps, i = !!(t.flags & 128);
		if (t.flags &= -129, e === null) {
			if (L) {
				if (r.mode === "hidden") return e = Vc(t, r), t.lanes = 536870912, e.memoizedState = {
					baseLanes: 0,
					cachePool: null
				}, zc(null, e);
				if (Po(t), (e = I) ? (e = am(e, la), e = e !== null && e.data === "&" ? e : null, e !== null && (t.memoizedState = {
					dehydrated: e,
					treeContext: $i === null ? null : {
						id: ea,
						overflow: ta
					},
					retryLane: 536870912,
					hydrationErrors: null
				}, n = Ui(e), n.return = t, t.child = n, sa = t, I = null)) : e = null, e === null) throw da(t);
				return t.lanes = 536870912, null;
			}
			return Vc(t, r);
		}
		var a = e.memoizedState;
		if (a !== null) {
			var o = a.dehydrated;
			if (Po(t), i) {
				if (t.flags & 256) t.flags &= -257, t = Hc(e, t, n);
				else if (t.memoizedState !== null) t.child = e.child, t.flags |= 128, t = null;
				else throw Error(s(558));
			} else if (Nc || Ta(e, t, n, !1), i = (n & e.childLanes) !== 0, Nc || i) {
				if (Eo.current === null) {
					if (r = q, r !== null && (o = Ct(r, n), o !== 0 && o !== a.retryLane)) throw a.retryLane = o, ji(e, o), Pd(r, e, o), Mc;
					Kd();
				}
				t = Hc(e, t, n);
			} else e = a.treeContext, I = lm(o.nextSibling), sa = t, L = !0, ca = null, la = !1, e !== null && oa(t, e), t = Vc(t, r), t.flags |= 134221824;
			return t;
		}
		return e = Ri(e.child, {
			mode: r.mode,
			children: r.children
		}), e.ref = t.ref, t.child = e, e.return = t, e;
	}
	function Wc(e, t) {
		var n = t.ref;
		if (n === null) e !== null && e.ref !== null && (t.flags |= 4194816);
		else {
			if (typeof n != "function" && typeof n != "object") throw Error(s(284));
			(e === null || e.ref !== n) && (t.flags |= 4194816);
		}
	}
	function Gc(e, t, n, r, i) {
		return Da(t), n = $o(e, t, n, r, void 0, i), r = rs(), e !== null && !Nc ? (is(e, t, i), ll(e, t, i)) : (L && r && ia(t), t.flags |= 1, Pc(e, t, n, i), t.child);
	}
	function Kc(e, t, n, r, i, a) {
		return Da(t), t.updateQueue = null, n = ts(t, r, n, i), es(e), r = rs(), e !== null && !Nc ? (is(e, t, a), ll(e, t, a)) : (L && r && ia(t), t.flags |= 1, Pc(e, t, n, a), t.child);
	}
	function qc(e, t, n, r, i) {
		if (Da(t), t.stateNode === null) {
			var a = Pi, o = n.contextType;
			typeof o == "object" && o && (a = Oa(o)), a = new n(r, a), t.memoizedState = a.state !== null && a.state !== void 0 ? a.state : null, a.updater = yc, t.stateNode = a, a._reactInternals = t, a = t.stateNode, a.props = r, a.state = t.memoizedState, a.refs = {}, ho(t), o = n.contextType, a.context = typeof o == "object" && o ? Oa(o) : Pi, a.state = t.memoizedState, o = n.getDerivedStateFromProps, typeof o == "function" && (vc(t, n, o, r), a.state = t.memoizedState), typeof n.getDerivedStateFromProps == "function" || typeof a.getSnapshotBeforeUpdate == "function" || typeof a.UNSAFE_componentWillMount != "function" && typeof a.componentWillMount != "function" || (o = a.state, typeof a.componentWillMount == "function" && a.componentWillMount(), typeof a.UNSAFE_componentWillMount == "function" && a.UNSAFE_componentWillMount(), o !== a.state && yc.enqueueReplaceState(a, a.state, null), Co(t, r, a, i), So(), a.state = t.memoizedState), typeof a.componentDidMount == "function" && (t.flags |= 4194308), r = !0;
		} else if (e === null) {
			a = t.stateNode;
			var s = t.memoizedProps, c = Sc(n, s);
			a.props = c;
			var l = a.context, u = n.contextType;
			o = Pi, typeof u == "object" && u && (o = Oa(u));
			var d = n.getDerivedStateFromProps;
			u = typeof d == "function" || typeof a.getSnapshotBeforeUpdate == "function", s = t.pendingProps !== s, u || typeof a.UNSAFE_componentWillReceiveProps != "function" && typeof a.componentWillReceiveProps != "function" || (s || l !== o) && xc(t, a, r, o), mo = !1;
			var f = t.memoizedState;
			a.state = f, Co(t, r, a, i), So(), l = t.memoizedState, s || f !== l || mo ? (typeof d == "function" && (vc(t, n, d, r), l = t.memoizedState), (c = mo || bc(t, n, c, r, f, l, o)) ? (u || typeof a.UNSAFE_componentWillMount != "function" && typeof a.componentWillMount != "function" || (typeof a.componentWillMount == "function" && a.componentWillMount(), typeof a.UNSAFE_componentWillMount == "function" && a.UNSAFE_componentWillMount()), typeof a.componentDidMount == "function" && (t.flags |= 4194308)) : (typeof a.componentDidMount == "function" && (t.flags |= 4194308), t.memoizedProps = r, t.memoizedState = l), a.props = r, a.state = l, a.context = o, r = c) : (typeof a.componentDidMount == "function" && (t.flags |= 4194308), r = !1);
		} else {
			a = t.stateNode, go(e, t), o = t.memoizedProps, u = Sc(n, o), a.props = u, d = t.pendingProps, f = a.context, l = n.contextType, c = Pi, typeof l == "object" && l && (c = Oa(l)), s = n.getDerivedStateFromProps, (l = typeof s == "function" || typeof a.getSnapshotBeforeUpdate == "function") || typeof a.UNSAFE_componentWillReceiveProps != "function" && typeof a.componentWillReceiveProps != "function" || (o !== d || f !== c) && xc(t, a, r, c), mo = !1, f = t.memoizedState, a.state = f, Co(t, r, a, i), So();
			var p = t.memoizedState;
			o !== d || f !== p || mo || e !== null && e.dependencies !== null && Ea(e.dependencies) ? (typeof s == "function" && (vc(t, n, s, r), p = t.memoizedState), (u = mo || bc(t, n, u, r, f, p, c) || e !== null && e.dependencies !== null && Ea(e.dependencies)) ? (l || typeof a.UNSAFE_componentWillUpdate != "function" && typeof a.componentWillUpdate != "function" || (typeof a.componentWillUpdate == "function" && a.componentWillUpdate(r, p, c), typeof a.UNSAFE_componentWillUpdate == "function" && a.UNSAFE_componentWillUpdate(r, p, c)), typeof a.componentDidUpdate == "function" && (t.flags |= 4), typeof a.getSnapshotBeforeUpdate == "function" && (t.flags |= 1024)) : (typeof a.componentDidUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 4), typeof a.getSnapshotBeforeUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 1024), t.memoizedProps = r, t.memoizedState = p), a.props = r, a.state = p, a.context = c, r = u) : (typeof a.componentDidUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 4), typeof a.getSnapshotBeforeUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 1024), r = !1);
		}
		return a = r, Wc(e, t), r = !!(t.flags & 128), a || r ? (a = t.stateNode, n = r && typeof n.getDerivedStateFromError != "function" ? null : a.render(), t.flags |= 1, e !== null && r ? (t.child = fo(t, e.child, null, i), t.child = fo(t, null, n, i)) : Pc(e, t, n, i), t.memoizedState = a.state, e = t.child) : e = ll(e, t, i), e;
	}
	function Jc(e, t, n, r) {
		return ha(), t.flags |= 256, Pc(e, t, n, r), t.child;
	}
	var Yc = {
		dehydrated: null,
		treeContext: null,
		retryLane: 0,
		hydrationErrors: null
	};
	function Xc(e) {
		return {
			baseLanes: e,
			cachePool: Ya()
		};
	}
	function Zc(e, t, n) {
		return e = e === null ? 0 : e.childLanes & ~n, t && (e |= ld), e;
	}
	function Qc(e, t, n) {
		var r = t.pendingProps, i = !1, a = !!(t.flags & 128), o;
		if ((o = a) || (o = e !== null && e.memoizedState === null ? !1 : !!(Ro.current & 2)), o && (i = !0, t.flags &= -129), o = !!(t.flags & 32), t.flags &= -33, e === null) {
			if (L) {
				if (i ? No(t) : Io(), (e = I) ? (e = am(e, la), e = e !== null && e.data !== "&" ? e : null, e !== null && (t.memoizedState = {
					dehydrated: e,
					treeContext: $i === null ? null : {
						id: ea,
						overflow: ta
					},
					retryLane: 536870912,
					hydrationErrors: null
				}, n = Ui(e), n.return = t, t.child = n, sa = t, I = null)) : e = null, e === null) throw da(t);
				return t.lanes = sm(e) ? 32 : 536870912, null;
			}
			return a = r.children, r = r.fallback, i ? (Io(), i = t.mode, a = el({
				mode: "hidden",
				children: a
			}, i), r = Vi(r, i, n, null), a.return = t, r.return = t, a.sibling = r, t.child = a, r = t.child, r.memoizedState = Xc(n), r.childLanes = Zc(e, o, n), t.memoizedState = Yc, zc(null, r)) : (No(t), $c(t, a));
		}
		var s = e.memoizedState;
		if (s !== null) {
			var c = s.dehydrated;
			if (c !== null) return nl(e, t, a, o, r, c, s, n);
		}
		return i ? (Io(), i = r.fallback, a = t.mode, s = e.child, c = s.sibling, r = Ri(s, {
			mode: "hidden",
			children: r.children
		}), r.subtreeFlags = s.subtreeFlags & 1206910976, c === null ? (i = Vi(i, a, n, null), i.flags |= 2) : i = Ri(c, i), i.return = t, r.return = t, r.sibling = i, t.child = r, zc(null, r), r = t.child, i = e.child.memoizedState, i === null ? i = Xc(n) : (a = i.cachePool, a === null ? a = Ya() : (s = Pa._currentValue, a = a.parent === s ? a : {
			parent: s,
			pool: s
		}), i = {
			baseLanes: i.baseLanes | n,
			cachePool: a
		}), r.memoizedState = i, r.childLanes = Zc(e, o, n), t.memoizedState = Yc, zc(e.child, r)) : (No(t), n = e.child, e = n.sibling, n = Ri(n, {
			mode: "visible",
			children: r.children
		}), n.return = t, n.sibling = null, e !== null && (o = t.deletions, o === null ? (t.deletions = [e], t.flags |= 16) : o.push(e)), t.child = n, t.memoizedState = null, n);
	}
	function $c(e, t) {
		return t = el({
			mode: "visible",
			children: t
		}, e.mode), t.return = e, e.child = t;
	}
	function el(e, t) {
		return e = Ii(22, e, null, t), e.lanes = 0, e;
	}
	function tl(e, t, n) {
		return fo(t, e.child, null, n), e = $c(t, t.pendingProps.children), e.flags |= 2, t.memoizedState = null, e;
	}
	function nl(e, t, n, r, i, a, o, c) {
		if (n) return t.flags & 256 ? (No(t), t.flags &= -257, tl(e, t, c)) : t.memoizedState === null ? (Io(), a = i.fallback, o = t.mode, i = el({
			mode: "visible",
			children: i.children
		}, o), a = Vi(a, o, c, null), a.flags |= 2, i.return = t, a.return = t, i.sibling = a, t.child = i, fo(t, e.child, null, c), i = t.child, i.memoizedState = Xc(c), i.childLanes = Zc(e, r, c), t.memoizedState = Yc, zc(null, i)) : (Io(), t.child = e.child, t.flags |= 128, null);
		if (No(t), sm(a)) {
			if (r = a.nextSibling && a.nextSibling.dataset, r) var l = r.dgst;
			return r = l, r !== "" && (i = Error(s(419)), i.stack = "", i.digest = r, _a({
				value: i,
				source: null,
				stack: null
			})), tl(e, t, c);
		}
		if (Nc || Ta(e, t, c, !1), r = (c & e.childLanes) !== 0, Nc || r) {
			if (Eo.current !== null) return tl(e, t, c);
			if (r = q, r !== null && (i = Ct(r, c), i !== 0 && i !== o.retryLane)) throw o.retryLane = i, ji(e, i), Pd(r, e, i), Mc;
			return om(a) || Kd(), tl(e, t, c);
		}
		return om(a) ? (t.flags |= 192, t.child = e.child, null) : (e = o.treeContext, I = lm(a.nextSibling), sa = t, L = !0, ca = null, la = !1, e !== null && oa(t, e), t = $c(t, i.children), t.flags |= 134221824, t);
	}
	function rl(e, t, n) {
		e.lanes |= t;
		var r = e.alternate;
		r !== null && (r.lanes |= t), Ca(e.return, t, n);
	}
	function il(e) {
		for (var t = null; e !== null;) {
			var n = e.alternate;
			n !== null && Vo(n) === null && (t = e), e = e.sibling;
		}
		return t;
	}
	function al(e, t, n, r, i, a) {
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
	function ol(e) {
		var t = e.child;
		for (e.child = null; t !== null;) {
			var n = t.sibling;
			t.sibling = e.child, e.child = t, t = n;
		}
	}
	function sl(e, t, n) {
		var r = t.pendingProps, i = r.revealOrder, a = r.tail;
		r = r.children;
		var o = Ro.current;
		if (t.flags & 128) return zo(t, o), null;
		var s = !!(o & 2);
		if (s ? (o = o & 1 | 2, t.flags |= 128) : o &= 1, zo(t, o), i === "backwards" && e !== null ? (ol(e), Pc(e, t, r, n), ol(e)) : Pc(e, t, r, n), r = L ? Xi : 0, !s && e !== null && e.flags & 128) a: for (e = t.child; e !== null;) {
			if (e.tag === 13) e.memoizedState !== null && rl(e, n, t);
			else if (e.tag === 19) rl(e, n, t);
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
				n = il(t.child), n === null ? (i = t.child, t.child = null) : (i = n.sibling, n.sibling = null, ol(t)), al(t, !0, i, null, a, r);
				break;
			case "unstable_legacy-backwards":
				for (n = null, i = t.child, t.child = null; i !== null;) {
					if (e = i.alternate, e !== null && Vo(e) === null) {
						t.child = i;
						break;
					}
					e = i.sibling, i.sibling = n, n = i, i = e;
				}
				al(t, !0, n, null, a, r);
				break;
			case "together":
				al(t, !1, null, null, void 0, r);
				break;
			case "independent":
				t.memoizedState = null;
				break;
			default: n = il(t.child), n === null ? (i = t.child, t.child = null) : (i = n.sibling, n.sibling = null), al(t, !1, i, n, a, r);
		}
		return t.child;
	}
	function cl(e, t, n) {
		var r = t.pendingProps;
		return xa(t, t.type, r.value), Pc(e, t, r.children, n), t.child;
	}
	function ll(e, t, n) {
		if (e !== null && (t.dependencies = e.dependencies), od |= t.lanes, (n & t.childLanes) === 0) {
			if (e !== null) {
				if (Ta(e, t, n, !1), (n & t.childLanes) === 0) return null;
			} else return null;
		}
		if (e !== null && t.child !== e.child) throw Error(s(153));
		if (t.child !== null) {
			for (e = t.child, n = Ri(e, e.pendingProps), t.child = n, n.return = t; e.sibling !== null;) e = e.sibling, n = n.sibling = Ri(e, e.pendingProps), n.return = t;
			n.sibling = null;
		}
		return t.child;
	}
	function ul(e, t) {
		return (e.lanes & t) !== 0 || (e = e.dependencies, !!(e !== null && Ea(e)));
	}
	function dl(e, t, n) {
		switch (t.tag) {
			case 3:
				je(t, t.stateNode.containerInfo), xa(t, Pa, e.memoizedState.cache), ha();
				break;
			case 27:
			case 5:
				Ne(t);
				break;
			case 4:
				je(t, t.stateNode.containerInfo);
				break;
			case 10:
				xa(t, t.type, t.memoizedProps.value);
				break;
			case 31:
				if (t.memoizedState !== null) return t.flags |= 128, Po(t), null;
				break;
			case 13:
				var r = t.memoizedState;
				if (r !== null) {
					if (r.dehydrated !== null) return No(t), t.flags |= 128, null;
					r = Ta(e, t, n, !1);
					var i = t.child.childLanes;
					return r || (n & i) !== 0 ? Qc(e, t, n) : (No(t), e = ll(e, t, n), e === null ? null : e.sibling);
				}
				No(t);
				break;
			case 19:
				if (t.flags & 128) return sl(e, t, n);
				if (i = !!(e.flags & 128), r = (n & t.childLanes) !== 0, r ||= (Ta(e, t, n, !1), (n & t.childLanes) !== 0), i) {
					if (r) return sl(e, t, n);
					t.flags |= 128;
				}
				if (i = t.memoizedState, i !== null && (i.rendering = null, i.tail = null, i.lastEffect = null), zo(t, Ro.current), r) break;
				return null;
			case 22: return t.lanes = 0, Rc(e, t, n, t.pendingProps);
			case 24: xa(t, Pa, e.memoizedState.cache);
		}
		return ll(e, t, n);
	}
	function fl(e, t, n) {
		if (e !== null) {
			if (e.memoizedProps !== t.pendingProps) Nc = !0;
			else {
				if (!ul(e, n) && !(t.flags & 128)) return Nc = !1, dl(e, t, n);
				Nc = !!(e.flags & 131072);
			}
		} else Nc = !1, L && t.flags & 1048576 && ra(t, Xi, t.index);
		switch (t.lanes = 0, t.tag) {
			case 16:
				a: {
					var r = t.pendingProps;
					if (e = to(t.elementType), t.type = e, typeof e == "function") Li(e) ? (r = Sc(e, r), t.tag = 1, t = qc(null, t, e, r, n)) : (t.tag = 0, t = Gc(null, t, e, r, n));
					else {
						if (e != null) {
							var i = e.$$typeof;
							if (i === ue) {
								t.tag = 11, t = Fc(null, t, e, r, n);
								break a;
							}
							if (i === pe) {
								t.tag = 14, t = Ic(null, t, e, r, n);
								break a;
							}
							if (i === le) {
								t.tag = 10, t.type = e, t = cl(null, t, n);
								break a;
							}
						}
						throw t = D(e) || e, Error(s(306, t, ""));
					}
				}
				return t;
			case 0: return Gc(e, t, t.type, t.pendingProps, n);
			case 1: return r = t.type, i = Sc(r, t.pendingProps), qc(e, t, r, i, n);
			case 3:
				a: {
					if (je(t, t.stateNode.containerInfo), e === null) throw Error(s(387));
					r = t.pendingProps;
					var a = t.memoizedState;
					i = a.element, go(e, t), Co(t, r, null, n);
					var o = t.memoizedState;
					if (r = o.cache, xa(t, Pa, r), r !== a.cache && wa(t, [Pa], n, !0), So(), r = o.element, a.isDehydrated) {
						if (a = {
							element: r,
							isDehydrated: !1,
							cache: o.cache
						}, t.updateQueue.baseState = a, t.memoizedState = a, t.flags & 256) {
							t = Jc(e, t, r, n);
							break a;
						}
						if (r !== i) {
							i = Ki(Error(s(424)), t), _a(i), t = Jc(e, t, r, n);
							break a;
						}
						switch (e = t.stateNode.containerInfo, e.nodeType) {
							case 9:
								e = e.body;
								break;
							default: e = e.nodeName === "HTML" ? e.ownerDocument.body : e;
						}
						for (I = lm(e.firstChild), sa = t, L = !0, ca = null, la = !0, n = po(t, null, r, n), t.child = n; n;) n.flags = n.flags & -3 | 134221824, n = n.sibling;
					} else {
						if (ha(), r === i) {
							t = ll(e, t, n);
							break a;
						}
						Pc(e, t, r, n);
					}
					t = t.child;
				}
				return t;
			case 26: return Wc(e, t), e === null ? (n = Nm(t.type, null, t.pendingProps, null)) ? t.memoizedState = n : L || (t.stateNode = fp(t.type, t.pendingProps, ke.current, t)) : t.memoizedState = Nm(t.type, e.memoizedProps, t.pendingProps, e.memoizedState), null;
			case 27: return Ne(t), e === null && L && (r = t.stateNode = hm(t.type, t.pendingProps, ke.current), sa = t, la = !0, i = I, Sp(t.type) ? (um = i, I = lm(r.firstChild)) : I = i), Pc(e, t, t.pendingProps.children, n), Wc(e, t), e === null && (t.flags |= 4194304), t.child;
			case 5: return e === null && L && ((i = r = I) && (r = rm(r, t.type, t.pendingProps, la), r === null ? i = !1 : (t.stateNode = r, sa = t, I = lm(r.firstChild), la = !1, i = !0)), i || da(t)), Ne(t), i = t.type, a = t.pendingProps, o = e === null ? null : e.memoizedProps, r = a.children, pp(i, a) ? r = null : o !== null && pp(i, o) && (t.flags |= 32), t.memoizedState !== null && (i = $o(e, t, ns, null, null, n), sh._currentValue = i), Wc(e, t), Pc(e, t, r, n), t.child;
			case 6: return e === null && L && ((e = n = I) && (n = im(n, t.pendingProps, la), n === null ? e = !1 : (t.stateNode = n, sa = t, I = null, e = !0)), e || da(t)), null;
			case 13: return Qc(e, t, n);
			case 4: return je(t, t.stateNode.containerInfo), r = t.pendingProps, e === null ? t.child = fo(t, null, r, n) : Pc(e, t, r, n), t.child;
			case 11: return Fc(e, t, t.type, t.pendingProps, n);
			case 7: return r = t.pendingProps, Wc(e, t), Pc(e, t, r, n), t.child;
			case 8: return Pc(e, t, t.pendingProps.children, n), t.child;
			case 12: return Pc(e, t, t.pendingProps.children, n), t.child;
			case 10: return cl(e, t, n);
			case 9: return i = t.type._context, r = t.pendingProps.children, Da(t), i = Oa(i), r = r(i), t.flags |= 1, Pc(e, t, r, n), t.child;
			case 14: return Ic(e, t, t.type, t.pendingProps, n);
			case 15: return Lc(e, t, t.type, t.pendingProps, n);
			case 19: return sl(e, t, n);
			case 31: return Uc(e, t, n);
			case 22: return Rc(e, t, n, t.pendingProps);
			case 24: return Da(t), r = Oa(Pa), e === null ? (i = qa(), i === null && (i = q, a = Fa(), i.pooledCache = a, a.refCount++, a !== null && (i.pooledCacheLanes |= n), i = a), t.memoizedState = {
				parent: r,
				cache: i
			}, ho(t), xa(t, Pa, i)) : ((e.lanes & n) !== 0 && (go(e, t), Co(t, null, null, n), So()), i = e.memoizedState, a = t.memoizedState, i.parent === r ? (r = a.cache, xa(t, Pa, r), r !== i.cache && wa(t, [Pa], n, !0)) : (i = {
				parent: r,
				cache: r
			}, t.memoizedState = i, t.lanes === 0 && (t.memoizedState = t.updateQueue.baseState = i), xa(t, Pa, r))), Pc(e, t, t.pendingProps.children, n), t.child;
			case 30: return t.stateNode === null && (t.stateNode = {
				autoName: null,
				paired: null,
				clones: null,
				ref: null
			}), r = t.pendingProps, r.name != null && r.name !== "auto" ? t.flags |= e === null ? 18882560 : 18874368 : L && ia(t), e !== null && e.memoizedProps.name !== r.name ? t.flags |= 4194816 : Wc(e, t), Pc(e, t, r.children, n), t.child;
			case 29: throw t.pendingProps;
		}
		throw Error(s(156, t.tag));
	}
	function pl(e) {
		e.flags |= 4;
	}
	function ml(e, t, n, r, i) {
		var a;
		if ((a = !!(e.mode & 32)) && (a = n === null ? Jm(t, r) : Jm(t, r) && (r.src !== n.src || r.srcSet !== n.srcSet)), a) {
			if (e.flags |= 16777216, (i & 335544128) === i) {
				if (e.stateNode.complete) e.flags |= 8192;
				else if (Ud()) e.flags |= 8192;
				else throw no = Qa, B;
			}
		} else e.flags &= -16777217;
	}
	function hl(e, t) {
		if (t.type !== "stylesheet" || t.state.loading & 4) e.flags &= -16777217;
		else if (e.flags |= 16777216, !Ym(t)) {
			if (Ud()) e.flags |= 8192;
			else throw no = Qa, B;
		}
	}
	function gl(e, t) {
		t !== null && (e.flags |= 4), e.flags & 16384 && (t = e.tag === 22 ? 536870912 : _t(), e.lanes |= t, ud |= t);
	}
	function _l(e, t) {
		if (!L) switch (e.tailMode) {
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
	function W(e) {
		var t = e.alternate !== null && e.alternate.child === e.child, n = 0, r = 0;
		if (t) for (var i = e.child; i !== null;) n |= i.lanes | i.childLanes, r |= i.subtreeFlags & 1206910976, r |= i.flags & 1206910976, i.return = e, i = i.sibling;
		else for (i = e.child; i !== null;) n |= i.lanes | i.childLanes, r |= i.subtreeFlags, r |= i.flags, i.return = e, i = i.sibling;
		return e.subtreeFlags |= r, e.childLanes = n, t;
	}
	function vl(e, t, n) {
		var r = t.pendingProps;
		switch (aa(t), t.tag) {
			case 16:
			case 15:
			case 0:
			case 11:
			case 7:
			case 8:
			case 12:
			case 9:
			case 14: return W(t), null;
			case 1: return W(t), null;
			case 3: return n = t.stateNode, r = null, e !== null && (r = e.memoizedState.cache), t.memoizedState.cache !== r && (t.flags |= 2048), Sa(Pa), Me(), n.pendingContext && (n.context = n.pendingContext, n.pendingContext = null), (e === null || e.child === null) && (ma(t) ? pl(t) : e === null || e.memoizedState.isDehydrated && !(t.flags & 256) || (t.flags |= 1024, ga())), W(t), null;
			case 26:
				var i = t.type, a = t.memoizedState;
				return e === null ? (pl(t), a === null ? (W(t), ml(t, i, null, r, n)) : (W(t), hl(t, a))) : a ? a === e.memoizedState ? (W(t), t.flags &= -16777217) : (pl(t), W(t), hl(t, a)) : (e = e.memoizedProps, e !== r && pl(t), W(t), ml(t, i, e, r, n)), null;
			case 27:
				if (Pe(t), n = ke.current, i = t.type, e !== null && t.stateNode != null) e.memoizedProps !== r && pl(t);
				else {
					if (!r) {
						if (t.stateNode === null) throw Error(s(166));
						return W(t), t.subtreeFlags &= -33554433, null;
					}
					e = De.current, ma(t) ? fa(t, e) : (e = hm(i, r, n), t.stateNode = e, pl(t));
				}
				return W(t), t.subtreeFlags &= -33554433, null;
			case 5:
				if (Pe(t), i = t.type, e !== null && t.stateNode != null) e.memoizedProps !== r && pl(t);
				else {
					if (!r) {
						if (t.stateNode === null) throw Error(s(166));
						return W(t), t.subtreeFlags &= -33554433, null;
					}
					if (a = De.current, ma(t)) fa(t, a);
					else {
						var o = lp(ke.current);
						switch (a) {
							case 1:
								a = o.createElementNS("http://www.w3.org/2000/svg", i);
								break;
							case 2:
								a = o.createElementNS("http://www.w3.org/1998/Math/MathML", i);
								break;
							default: switch (i) {
								case "svg":
									a = o.createElementNS("http://www.w3.org/2000/svg", i);
									break;
								case "math":
									a = o.createElementNS("http://www.w3.org/1998/Math/MathML", i);
									break;
								case "script":
									a = o.createElement("div"), a.innerHTML = "<script><\/script>", a = a.removeChild(a.firstChild);
									break;
								case "select":
									a = typeof r.is == "string" ? o.createElement("select", { is: r.is }) : o.createElement("select"), r.multiple ? a.multiple = !0 : r.size && (a.size = r.size);
									break;
								default: a = typeof r.is == "string" ? o.createElement(i, { is: r.is }) : o.createElement(i);
							}
						}
						a[kt] = t, a[At] = r;
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
						a: switch (np(a, i, r), i) {
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
						r && pl(t);
					}
				}
				return W(t), t.subtreeFlags &= -33554433, ml(t, t.type, e === null ? null : e.memoizedProps, t.pendingProps, n), null;
			case 6:
				if (e && t.stateNode != null) e.memoizedProps !== r && pl(t);
				else {
					if (typeof r != "string" && t.stateNode === null) throw Error(s(166));
					if (e = ke.current, ma(t)) {
						if (e = t.stateNode, n = t.memoizedProps, r = null, i = sa, i !== null) switch (i.tag) {
							case 27:
							case 5: r = i.memoizedProps;
						}
						e[kt] = t, e = !!(e.nodeValue === n || r !== null && !0 === r.suppressHydrationWarning || ep(e.nodeValue, n)), e || da(t, !0);
					} else e = lp(e).createTextNode(r), e[kt] = t, t.stateNode = e;
				}
				return W(t), null;
			case 31:
				if (n = t.memoizedState, e === null || e.memoizedState !== null) {
					if (r = ma(t), n !== null) {
						if (e === null) {
							if (!r) throw Error(s(318));
							if (e = t.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error(s(557));
							e[kt] = t;
						} else ha(), !(t.flags & 128) && (t.memoizedState = null), t.flags |= 4;
						W(t), e = !1;
					} else n = ga(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = n), e = !0;
					if (!e) return t.flags & 256 ? (Lo(t), t) : (Lo(t), null);
					if (t.flags & 128) throw Error(s(558));
				}
				return W(t), null;
			case 13:
				if (r = t.memoizedState, e === null || e.memoizedState !== null && e.memoizedState.dehydrated !== null) {
					if (i = ma(t), r !== null && r.dehydrated !== null) {
						if (e === null) {
							if (!i) throw Error(s(318));
							if (i = t.memoizedState, i = i === null ? null : i.dehydrated, !i) throw Error(s(317));
							i[kt] = t;
						} else ha(), !(t.flags & 128) && (t.memoizedState = null), t.flags |= 4;
						W(t), i = !1;
					} else i = ga(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = i), i = !0;
					if (!i) return t.flags & 256 ? (Lo(t), t) : (Lo(t), null);
				}
				return Lo(t), t.flags & 128 ? (t.lanes = n, t) : (n = r !== null, e = e !== null && e.memoizedState !== null, n && (r = t.child, i = null, r.alternate !== null && r.alternate.memoizedState !== null && r.alternate.memoizedState.cachePool !== null && (i = r.alternate.memoizedState.cachePool.pool), a = null, r.memoizedState !== null && r.memoizedState.cachePool !== null && (a = r.memoizedState.cachePool.pool), a !== i && (r.flags |= 2048)), n !== e && n && (t.child.flags |= 8192), gl(t, t.updateQueue), W(t), null);
			case 4: return Me(), e === null && Wf(t.stateNode.containerInfo), t.flags |= 67108864, W(t), null;
			case 10: return Sa(t.type), W(t), null;
			case 19:
				if (Bo(t), r = t.memoizedState, r === null) return W(t), null;
				if (i = !!(t.flags & 128), a = r.rendering, a === null) {
					if (i) _l(r, !1);
					else {
						if (ad !== 0 || e !== null && e.flags & 128) for (e = t.child; e !== null;) {
							if (a = Vo(e), a !== null) {
								for (t.flags |= 128, _l(r, !1), e = a.updateQueue, t.updateQueue = e, gl(t, e), t.subtreeFlags = 0, e = n, n = t.child; n !== null;) zi(n, e), n = n.sibling;
								return zo(t, Ro.current & 1 | 2), L && na(t, r.treeForkCount), t.child;
							}
							e = e.sibling;
						}
						r.tail !== null && qe() > gd && (t.flags |= 128, i = !0, _l(r, !1), t.lanes = 4194304);
					}
				} else {
					if (!i) {
						if (e = Vo(a), e !== null) {
							if (t.flags |= 128, i = !0, e = e.updateQueue, t.updateQueue = e, gl(t, e), _l(r, !0), r.tail === null && r.tailMode !== "collapsed" && r.tailMode !== "visible" && !a.alternate && !L) return W(t), null;
						} else 2 * qe() - r.renderingStartTime > gd && n !== 536870912 && (t.flags |= 128, i = !0, _l(r, !1), t.lanes = 4194304);
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
					return r.rendering = e, r.tail = e.sibling, r.renderingStartTime = qe(), e.sibling = null, a = Ro.current, a = i ? a & 1 | 2 : a & 1, r.tailMode === "visible" || r.tailMode === "collapsed" || !n || L ? zo(t, a) : (n = a, j(jo, t), j(Ro, n), Mo === null && (Mo = t)), L && na(t, r.treeForkCount), e;
				}
				return W(t), null;
			case 22:
			case 23: return Lo(t), Ao(), r = t.memoizedState !== null, e === null ? r && (t.flags |= 8192) : e.memoizedState !== null !== r && (t.flags |= 8192), r ? n & 536870912 && !(t.flags & 128) && (W(t), t.subtreeFlags & 6 && (t.flags |= 8192)) : W(t), n = t.updateQueue, n !== null && gl(t, n.retryQueue), n = null, e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), r = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (r = t.memoizedState.cachePool.pool), r !== n && (t.flags |= 2048), e !== null && Ee(Ka), null;
			case 24: return n = null, e !== null && (n = e.memoizedState.cache), t.memoizedState.cache !== n && (t.flags |= 2048), Sa(Pa), W(t), null;
			case 25: return null;
			case 30: return t.flags |= 33554432, W(t), null;
		}
		throw Error(s(156, t.tag));
	}
	function yl(e, t) {
		switch (aa(t), t.tag) {
			case 1: return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 3: return Sa(Pa), Me(), e = t.flags, e & 65536 && !(e & 128) ? (t.flags = e & -65537 | 128, t) : null;
			case 26:
			case 27:
			case 5: return Pe(t), null;
			case 31:
				if (t.memoizedState !== null) {
					if (Lo(t), t.alternate === null) throw Error(s(340));
					ha();
				}
				return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 13:
				if (Lo(t), e = t.memoizedState, e !== null && e.dehydrated !== null) {
					if (t.alternate === null) throw Error(s(340));
					ha();
				}
				return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 19: return Bo(t), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, e = t.memoizedState, e !== null && (e.rendering = null, e.tail = null), t.flags |= 4, t) : null;
			case 4: return Me(), null;
			case 10: return Sa(t.type), null;
			case 22:
			case 23: return Lo(t), Ao(), e !== null && Ee(Ka), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 24: return Sa(Pa), null;
			case 25: return null;
			default: return null;
		}
	}
	function bl(e, t) {
		switch (aa(t), t.tag) {
			case 3:
				Sa(Pa), Me();
				break;
			case 26:
			case 27:
			case 5:
				Pe(t);
				break;
			case 4:
				Me();
				break;
			case 31:
				t.memoizedState !== null && Lo(t);
				break;
			case 13:
				Lo(t);
				break;
			case 19:
				Bo(t);
				break;
			case 10:
				Sa(t.type);
				break;
			case 22:
			case 23:
				Lo(t), Ao(), e !== null && Ee(Ka);
				break;
			case 24: Sa(Pa);
		}
	}
	function xl(e, t) {
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
			Z(t, t.return, e);
		}
	}
	function Sl(e, t, n) {
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
								Z(i, c, e);
							}
						}
					}
					r = r.next;
				} while (r !== a);
			}
		} catch (e) {
			Z(t, t.return, e);
		}
	}
	function Cl(e) {
		var t = e.updateQueue;
		if (t !== null) {
			var n = e.stateNode;
			try {
				To(t, n);
			} catch (t) {
				Z(e, e.return, t);
			}
		}
	}
	function wl(e, t, n) {
		n.props = Sc(e.type, e.memoizedProps), n.state = e.memoizedState;
		try {
			n.componentWillUnmount();
		} catch (n) {
			Z(e, t, n);
		}
	}
	function Tl(e, t) {
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
						var i = e.stateNode, a = xi(e.memoizedProps, i);
						(i.ref === null || i.ref.name !== a) && (i.ref = Pp(a)), r = i.ref;
						break;
					case 7:
						if (e.stateNode === null) {
							var o = new Fp(e);
							h(e.child, !1, Qp, o, void 0, void 0), e.stateNode = o;
						}
						r = e.stateNode;
						break;
					default: r = e.stateNode;
				}
				typeof n == "function" ? e.refCleanup = n(r) : n.current = r;
			}
		} catch (n) {
			Z(e, t, n);
		}
	}
	function El(e, t) {
		var n = e.ref, r = e.refCleanup;
		if (n !== null) {
			if (typeof r == "function") try {
				r();
			} catch (n) {
				Z(e, t, n);
			} finally {
				e.refCleanup = null, e = e.alternate, e != null && (e.refCleanup = null);
			}
			else if (typeof n == "function") try {
				n(null);
			} catch (n) {
				Z(e, t, n);
			}
			else n.current = null;
		}
	}
	function Dl(e, t) {
		if ((e.tag === 5 || e.tag === 27 || e.tag === 6) && e.alternate === null && t !== null) for (var n = 0; n < t.length; n++) em(e.stateNode, t[n]);
	}
	function Ol(e) {
		for (var t = e.return; t !== null && (jl(t) && em(e.stateNode, t.stateNode), !Al(t));) t = t.return;
	}
	function kl(e) {
		for (var t = e.return; t !== null && (jl(t) && tm(e.stateNode, t.stateNode), !Al(t));) t = t.return;
	}
	function Al(e) {
		return e.tag === 5 || e.tag === 3 || e.tag === 27;
	}
	function jl(e) {
		return e && e.tag === 7 && e.stateNode !== null;
	}
	function Ml(e) {
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
			Z(e, e.return, t);
		}
	}
	function Nl(e, t, n) {
		try {
			var r = e.stateNode;
			ip(r, e.type, n, t), r[At] = t;
		} catch (t) {
			Z(e, e.return, t);
		}
	}
	function Pl(e) {
		return e.tag === 5 || e.tag === 3 || e.tag === 26 || e.tag === 27 && Sp(e.type) || e.tag === 4;
	}
	function Fl(e) {
		a: for (;;) {
			for (; e.sibling === null;) {
				if (e.return === null || Pl(e.return)) return null;
				e = e.return;
			}
			for (e.sibling.return = e.return, e = e.sibling; e.tag !== 5 && e.tag !== 6 && e.tag !== 18;) {
				if (e.tag === 27 && Sp(e.type) || e.flags & 2 || e.child === null || e.tag === 4) continue a;
				e.child.return = e, e = e.child;
			}
			if (!(e.flags & 2)) return e.stateNode;
		}
	}
	function Il(e, t, n, r) {
		var i = e.tag;
		if (i === 5 || i === 6) i = e.stateNode, t ? (n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n).insertBefore(i, t) : (t = n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n, t.appendChild(i), n = n._reactRootContainer, n != null || t.onclick !== null || (t.onclick = wn)), Dl(e, r), N = !0;
		else if (i !== 4 && (i === 27 && (Dl(e, r), r = null, Sp(e.type) && (n = e.stateNode, t = null)), e = e.child, e !== null)) for (Il(e, t, n, r), e = e.sibling; e !== null;) Il(e, t, n, r), e = e.sibling;
	}
	function Ll(e, t, n, r) {
		var i = e.tag;
		if (i === 5 || i === 6) i = e.stateNode, t ? n.insertBefore(i, t) : n.appendChild(i), Dl(e, r), N = !0;
		else if (i !== 4 && (i === 27 && (Dl(e, r), r = null, Sp(e.type) && (n = e.stateNode)), e = e.child, e !== null)) for (Ll(e, t, n, r), e = e.sibling; e !== null;) Ll(e, t, n, r), e = e.sibling;
	}
	function Rl(e) {
		var t = e.stateNode, n = e.memoizedProps;
		try {
			for (var r = e.type, i = t.attributes; i.length;) t.removeAttributeNode(i[0]);
			np(t, r, n), t[kt] = e, t[At] = n;
		} catch (t) {
			Z(e, e.return, t);
		}
	}
	var zl = !1, Bl = null;
	function Vl(e) {
		(e.tag === 30 || e.subtreeFlags & 33554432) && (zl = !0);
	}
	var Hl = null;
	function Ul() {
		var e = Hl;
		return Hl = null, e;
	}
	var Wl = 0;
	function Gl(e, t, n, r, i) {
		return Wl = 0, Kl(e.child, t, n, r, i);
	}
	function Kl(e, t, n, r, i) {
		for (var a = !1; e !== null;) {
			if (e.tag === 5) {
				var o = e.stateNode;
				if (r !== null) {
					var s = Op(o);
					r.push(s), s.view && (a = !0);
				} else a || Op(o).view && (a = !0);
				zl = !0, Tp(o, Wl === 0 ? t : t + "_" + Wl, n), Wl++;
			} else (e.tag !== 22 || e.memoizedState === null) && (e.tag === 30 && i || Kl(e.child, t, n, r, i) && (a = !0));
			e = e.sibling;
		}
		return a;
	}
	function ql(e, t) {
		for (; e !== null;) e.tag === 5 ? Ep(e.stateNode, e.memoizedProps) : (e.tag !== 22 || e.memoizedState === null) && (e.tag === 30 && t || ql(e.child, t)), e = e.sibling;
	}
	function Jl(e) {
		if (e.subtreeFlags & 18874368) for (e = e.child; e !== null;) {
			if ((e.tag !== 22 || e.memoizedState === null) && (Jl(e), e.tag === 30 && e.flags & 18874368 && e.stateNode.paired)) {
				var t = e.memoizedProps;
				if (t.name == null || t.name === "auto") throw Error(s(544));
				var n = t.name;
				t = Ci(t.default, t.share), t !== "none" && (Gl(e, n, t, null, !1) || ql(e.child, !1));
			}
			e = e.sibling;
		}
	}
	function Yl(e, t) {
		if (e.tag === 30) {
			var n = e.stateNode, r = e.memoizedProps, i = xi(r, n), a = Ci(r.default, n.paired ? r.share : r.enter);
			a === "none" ? Jl(e) : Gl(e, i, a, null, !1) ? (Jl(e), n.paired || t || Nd(e, r.onEnter)) : ql(e.child, !1);
		} else if (e.subtreeFlags & 33554432) for (e = e.child; e !== null;) Yl(e, t), e = e.sibling;
		else Jl(e);
	}
	function Xl(e) {
		if (Bl !== null && Bl.size !== 0) {
			var t = Bl;
			if (e.subtreeFlags & 18874368) for (e = e.child; e !== null;) {
				if (e.tag !== 22 || e.memoizedState === null) {
					if (e.tag === 30 && e.flags & 18874368) {
						var n = e.memoizedProps, r = n.name;
						if (r != null && r !== "auto") {
							var i = t.get(r);
							if (i !== void 0) {
								var a = Ci(n.default, n.share);
								if (a !== "none" && (Gl(e, r, a, null, !1) ? (a = e.stateNode, i.paired = a, a.paired = i, Nd(e, n.onShare)) : ql(e.child, !1)), t.delete(r), t.size === 0) break;
							}
						}
					}
					Xl(e);
				}
				e = e.sibling;
			}
		}
	}
	function Zl(e) {
		if (e.tag === 30) {
			var t = e.memoizedProps, n = xi(t, e.stateNode), r = Bl === null ? void 0 : Bl.get(n), i = Ci(t.default, r === void 0 ? t.exit : t.share);
			i !== "none" && (Gl(e, n, i, null, !1) ? r === void 0 ? Nd(e, t.onExit) : (i = e.stateNode, r.paired = i, i.paired = r, Bl.delete(n), Nd(e, t.onShare)) : ql(e.child, !1)), Bl !== null && Xl(e);
		} else if (e.subtreeFlags & 33554432) for (e = e.child; e !== null;) Zl(e), e = e.sibling;
		else Bl !== null && Xl(e);
	}
	function Ql(e) {
		for (e = e.child; e !== null;) {
			if (e.tag === 30) {
				var t = e.memoizedProps, n = xi(t, e.stateNode);
				t = Ci(t.default, t.update), e.flags &= -5, t !== "none" && Gl(e, n, t, e.memoizedState = [], !1);
			} else e.subtreeFlags & 33554432 && Ql(e);
			e = e.sibling;
		}
	}
	function $l(e) {
		if (e.subtreeFlags & 18874368) for (e = e.child; e !== null;) {
			if (e.tag !== 22 || e.memoizedState === null) {
				if (e.tag === 30 && e.flags & 18874368) {
					var t = e.stateNode;
					t.paired !== null && (t.paired = null, ql(e.child, !1));
				}
				$l(e);
			}
			e = e.sibling;
		}
	}
	function eu(e) {
		if (e.tag === 30) e.stateNode.paired = null, ql(e.child, !1), $l(e);
		else if (e.subtreeFlags & 33554432) for (e = e.child; e !== null;) eu(e), e = e.sibling;
		else $l(e);
	}
	function tu(e) {
		for (e = e.child; e !== null;) e.tag === 30 ? ql(e.child, !1) : e.subtreeFlags & 33554432 && tu(e), e = e.sibling;
	}
	function nu(e, t, n, r, i, a, o) {
		for (var s = !1; t !== null;) {
			if (t.tag === 5) {
				var c = t.stateNode;
				if (a !== null && Wl < a.length) {
					var l = a[Wl], u = Op(c);
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
				e.flags & 4 && Tp(c, Wl === 0 ? n : n + "_" + Wl, i), s && e.flags & 4 || (Hl === null && (Hl = []), Hl.push(c, Wl === 0 ? r : r + "_" + Wl, t.memoizedProps)), Wl++;
			} else (t.tag !== 22 || t.memoizedState === null) && (t.tag === 30 && o ? e.flags |= t.flags & 32 : nu(e, t.child, n, r, i, a, o) && (s = !0));
			t = t.sibling;
		}
		return s;
	}
	function ru(e, t) {
		for (e = e.child; e !== null;) {
			if (e.tag === 30) {
				var n = e.memoizedProps, r = e.stateNode, i = xi(n, r), a = Ci(n.default, n.update);
				if (t) {
					r = r.clones;
					var o = r === null ? null : r.map(kp);
				} else o = e.memoizedState, e.memoizedState = null;
				r = e;
				var s = e.child;
				Wl = 0, i = nu(r, s, i, i, a, o, !1), e.flags & 4 && i && (t || Nd(e, n.onUpdate));
			} else e.subtreeFlags & 33554432 && ru(e, t);
			e = e.sibling;
		}
	}
	var iu = !1, G = !1, au = !1, ou = !1, su = typeof WeakSet == "function" ? WeakSet : Set, cu = null, lu = !1, uu = !1, du = !1, fu = !1;
	function pu(e, t, n) {
		if (e = e.containerInfo, sp = gh, e = Qr(e), $r(e)) {
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
		for (cp = {
			focusedElem: e,
			selectionRange: r
		}, gh = !1, n = (n & 335544064) === n, cu = t, t = n ? 9270 : 1024; cu !== null;) {
			if (e = cu, n && (r = e.deletions, r !== null)) for (a = 0; a < r.length; a++) n && Zl(r[a]);
			if (e.alternate === null && e.flags & 2) n && Vl(e), mu(n);
			else {
				if (e.tag === 22) {
					if (r = e.alternate, e.memoizedState !== null) {
						r !== null && r.memoizedState === null && n && Zl(r), mu(n);
						continue;
					}
					if (r !== null && r.memoizedState !== null) {
						n && Vl(e), mu(n);
						continue;
					}
				}
				r = e.child, (e.subtreeFlags & t) !== 0 && r !== null ? (r.return = e, cu = r) : (n && Ql(e), mu(n));
			}
		}
		Bl = null;
	}
	function mu(e) {
		for (; cu !== null;) {
			var t = cu, n = e, r = t.alternate, i = t.flags;
			switch (t.tag) {
				case 0:
				case 11:
				case 15: break;
				case 1:
					if (i & 1024 && r !== null) {
						n = void 0, i = r.memoizedProps, r = r.memoizedState;
						var a = t.stateNode;
						try {
							var o = Sc(t.type, i);
							n = a.getSnapshotBeforeUpdate(o, r), a.__reactInternalSnapshotBeforeUpdate = n;
						} catch (e) {
							Z(t, t.return, e);
						}
					}
					break;
				case 3:
					if (i & 1024) {
						if (r = t.stateNode.containerInfo, n = r.nodeType, n === 9) nm(r);
						else if (n === 1) switch (r.nodeName) {
							case "HEAD":
							case "HTML":
							case "BODY":
								nm(r);
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
					n && r !== null && (n = xi(r.memoizedProps, r.stateNode), i = t.memoizedProps, i = Ci(i.default, i.update), i !== "none" && Gl(r, n, i, r.memoizedState = [], !0));
					break;
				default: if (i & 1024) throw Error(s(163));
			}
			if (r = t.sibling, r !== null) {
				r.return = t.return, cu = r;
				break;
			}
			cu = t.return;
		}
	}
	function hu(e, t, n) {
		var r = n.flags;
		switch (n.tag) {
			case 0:
			case 11:
			case 15:
				Fu(e, n), r & 4 && xl(5, n);
				break;
			case 1:
				if (Fu(e, n), r & 4) {
					if (e = n.stateNode, t === null) try {
						e.componentDidMount();
					} catch (e) {
						Z(n, n.return, e);
					}
					else {
						var i = Sc(n.type, t.memoizedProps);
						t = t.memoizedState;
						try {
							e.componentDidUpdate(i, t, e.__reactInternalSnapshotBeforeUpdate);
						} catch (e) {
							Z(n, n.return, e);
						}
					}
				}
				r & 64 && Cl(n), r & 512 && Tl(n, n.return);
				break;
			case 3:
				if (Fu(e, n), r & 64 && (e = n.updateQueue, e !== null)) {
					if (t = null, n.child !== null) switch (n.child.tag) {
						case 27:
						case 5:
							t = n.child.stateNode;
							break;
						case 1: t = n.child.stateNode;
					}
					try {
						To(e, t);
					} catch (e) {
						Z(n, n.return, e);
					}
				}
				break;
			case 27: t === null && r & 4 && Rl(n);
			case 26:
			case 5:
				Fu(e, n), t === null && r & 4 && Ml(n), r & 512 && Tl(n, n.return);
				break;
			case 12:
				Fu(e, n);
				break;
			case 31:
				Fu(e, n), r & 4 && wu(e, n);
				break;
			case 13:
				Fu(e, n), r & 4 && Tu(e, n), r & 64 && (e = n.memoizedState, e !== null && (e = e.dehydrated, e !== null && (n = _f.bind(null, n), cm(e, n))));
				break;
			case 22:
				if (r = n.memoizedState !== null || iu, !r) {
					var a = t !== null && t.memoizedState !== null || G;
					t = iu, i = G, iu = r, (G = a) && !i ? (r = 2, n.subtreeFlags & 8772 && (r |= 1), Lu(e, n, r)) : Fu(e, n), iu = t, G = i;
				}
				break;
			case 30:
				Fu(e, n), r & 512 && Tl(n, n.return);
				break;
			case 7: r & 512 && Tl(n, n.return);
			default: Fu(e, n);
		}
	}
	function gu(e, t) {
		for (e = e.child; e !== null;) _u(e, t), e = e.sibling;
	}
	function _u(e, t) {
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
					Z(e, e.return, t);
				}
				vu(e, t);
				break;
			case 6:
				try {
					e.stateNode.nodeValue = t ? "" : e.memoizedProps, N = !0;
				} catch (t) {
					Z(e, e.return, t);
				}
				break;
			case 18:
				try {
					var s = e.stateNode;
					t ? wp(s, !0) : wp(e.stateNode, !1);
				} catch (t) {
					Z(e, e.return, t);
				}
				break;
			case 22:
			case 23:
				e.memoizedState === null && gu(e, t);
				break;
			default: gu(e, t);
		}
	}
	function vu(e, t) {
		if (e.subtreeFlags & 67108864) for (e = e.child; e !== null;) {
			a: {
				var n = e, r = t;
				switch (n.tag) {
					case 4:
						_u(n, r);
						break a;
					case 22:
						n.memoizedState === null && vu(n, r);
						break a;
					default: vu(n, r);
				}
			}
			e = e.sibling;
		}
	}
	function yu(e) {
		var t = e.alternate;
		t !== null && (e.alternate = null, yu(t)), e.child = null, e.deletions = null, e.sibling = null, e.tag === 5 && (t = e.stateNode, t !== null && Rt(t)), e.stateNode = null, e.return = null, e.dependencies = null, e.memoizedProps = null, e.memoizedState = null, e.pendingProps = null, e.stateNode = null, e.updateQueue = null;
	}
	var bu = null, xu = !1;
	function Su(e, t, n) {
		for (n = n.child; n !== null;) Cu(e, t, n), n = n.sibling;
	}
	function Cu(e, t, n) {
		if (rt && typeof rt.onCommitFiberUnmount == "function") try {
			rt.onCommitFiberUnmount(nt, n);
		} catch {}
		switch (n.tag) {
			case 26:
				G || El(n, t), Su(e, t, n), n.memoizedState ? n.memoizedState.count-- : n.stateNode && !G && (n = n.stateNode, n.parentNode.removeChild(n));
				break;
			case 27:
				G || El(n, t), kl(n);
				var r = bu, i = xu;
				Sp(n.type) && (bu = n.stateNode, xu = !1), Su(e, t, n), gm(n.stateNode, n.type, n.memoizedProps), bu = r, xu = i;
				break;
			case 5: G || El(n, t), kl(n);
			case 6:
				if (n.tag === 6 && kl(n), r = bu, i = xu, bu = null, Su(e, t, n), bu = r, xu = i, bu !== null) {
					if (xu) try {
						(bu.nodeType === 9 ? bu.body : bu.nodeName === "HTML" ? bu.ownerDocument.body : bu).removeChild(n.stateNode), N = !0;
					} catch (e) {
						Z(n, t, e);
					}
					else try {
						bu.removeChild(n.stateNode), N = !0;
					} catch (e) {
						Z(n, t, e);
					}
				}
				break;
			case 18:
				bu !== null && (xu ? (e = bu, Cp(e.nodeType === 9 ? e.body : e.nodeName === "HTML" ? e.ownerDocument.body : e, n.stateNode), Hh(e)) : Cp(bu, n.stateNode));
				break;
			case 4:
				r = bu, i = xu, bu = n.stateNode.containerInfo, xu = !0, Su(e, t, n), bu = r, xu = i;
				break;
			case 0:
			case 11:
			case 14:
			case 15:
				Sl(2, n, t), G || Sl(4, n, t), Su(e, t, n);
				break;
			case 1:
				G || (El(n, t), r = n.stateNode, typeof r.componentWillUnmount == "function" && wl(n, t, r)), Su(e, t, n);
				break;
			case 21:
				Su(e, t, n);
				break;
			case 22:
				G = (r = G) || n.memoizedState !== null, Su(e, t, n), G = r;
				break;
			case 30:
				El(n, t), Su(e, t, n);
				break;
			case 7:
				G || El(n, t), Su(e, t, n);
				break;
			default: Su(e, t, n);
		}
	}
	function wu(e, t) {
		if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null))) {
			e = e.dehydrated;
			try {
				Hh(e);
			} catch (e) {
				Z(t, t.return, e);
			}
		}
	}
	function Tu(e, t) {
		if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null && (e = e.dehydrated, e !== null)))) try {
			Hh(e);
		} catch (e) {
			Z(t, t.return, e);
		}
	}
	function Eu(e) {
		switch (e.tag) {
			case 31:
			case 13:
			case 19:
				var t = e.stateNode;
				return t === null && (t = e.stateNode = new su()), t;
			case 22: return e = e.stateNode, t = e._retryCache, t === null && (t = e._retryCache = new su()), t;
			default: throw Error(s(435, e.tag));
		}
	}
	function Du(e, t) {
		var n = Eu(e);
		t.forEach(function(t) {
			if (!n.has(t)) {
				n.add(t);
				var r = vf.bind(null, e, t);
				t.then(r, r);
			}
		});
	}
	function Ou(e, t, n) {
		var r = t.deletions;
		if (r !== null) for (var i = 0; i < r.length; i++) {
			var a = r[i], o = e, c = t, l = c;
			a: for (; l !== null;) {
				switch (l.tag) {
					case 27:
						if (Sp(l.type)) {
							bu = l.stateNode, xu = !1;
							break a;
						}
						break;
					case 5:
						bu = l.stateNode, xu = !1;
						break a;
					case 3:
					case 4:
						bu = l.stateNode.containerInfo, xu = !0;
						break a;
				}
				l = l.return;
			}
			if (bu === null) throw Error(s(160));
			Cu(o, c, a), bu = null, xu = !1, o = a.alternate, o !== null && (o.return = null), a.return = null;
		}
		if (t.subtreeFlags & 13886) for (t = t.child; t !== null;) Au(t, e, n), t = t.sibling;
	}
	var ku = null;
	function Au(e, t, n) {
		var r = e.alternate, i = e.flags;
		switch (e.tag) {
			case 0:
			case 11:
			case 14:
			case 15:
				if (i & 4 && (r = e.updateQueue, r = r === null ? null : r.events, r !== null)) for (var a = 0; a < r.length; a++) {
					var o = r[a];
					o.ref.impl = o.nextImpl;
				}
				Ou(t, e, n), ju(e), i & 4 && (Sl(3, e, e.return), xl(3, e), Sl(5, e, e.return));
				break;
			case 1:
				Ou(t, e, n), ju(e), i & 512 && (G || r === null || El(r, r.return)), i & 64 && iu && (e = e.updateQueue, e !== null && (t = e.callbacks, t !== null && (n = e.shared.hiddenCallbacks, e.shared.hiddenCallbacks = n === null ? t : n.concat(t))));
				break;
			case 26:
				if (a = ku, Ou(t, e, n), ju(e), i & 512 && (G || r === null || El(r, r.return)), i & 4) {
					if (i = r === null ? null : r.memoizedState, n = e.memoizedState, r === null) {
						if (n === null) {
							if (e.stateNode === null) {
								if (iu) e.stateNode = fp(e.type, e.memoizedProps, t.containerInfo, e);
								else {
									a: {
										t = e.type, n = e.memoizedProps, i = a.ownerDocument || a;
										b: switch (t) {
											case "title":
												r = i.getElementsByTagName("title")[0], (!r || r[It] || r[kt] || r.namespaceURI === "http://www.w3.org/2000/svg" || r.hasAttribute("itemprop")) && (r = i.createElement(t), i.head.insertBefore(r, i.querySelector("head > title"))), np(r, t, n), r[kt] = e, Ut(r), t = r;
												break a;
											case "link":
												if (a = Gm("link", "href", i).get(t + (n.href || ""))) {
													for (o = 0; o < a.length; o++) if (r = a[o], r.getAttribute("href") === (n.href == null || n.href === "" ? null : n.href) && r.getAttribute("rel") === (n.rel == null ? null : n.rel) && r.getAttribute("title") === (n.title == null ? null : n.title) && r.getAttribute("crossorigin") === (n.crossOrigin == null ? null : n.crossOrigin)) {
														a.splice(o, 1);
														break b;
													}
												}
												r = i.createElement(t), np(r, t, n), i.head.appendChild(r);
												break;
											case "meta":
												if (a = Gm("meta", "content", i).get(t + (n.content || ""))) {
													for (o = 0; o < a.length; o++) if (r = a[o], r.getAttribute("content") === (n.content == null ? null : "" + n.content) && r.getAttribute("name") === (n.name == null ? null : n.name) && r.getAttribute("property") === (n.property == null ? null : n.property) && r.getAttribute("http-equiv") === (n.httpEquiv == null ? null : n.httpEquiv) && r.getAttribute("charset") === (n.charSet == null ? null : n.charSet)) {
														a.splice(o, 1);
														break b;
													}
												}
												r = i.createElement(t), np(r, t, n), i.head.appendChild(r);
												break;
											default: throw Error(s(468, t));
										}
										r[kt] = e, Ut(r), t = r;
									}
									e.stateNode = t;
								}
							} else iu || Km(a, e.type, e.stateNode);
						} else e.stateNode = Bm(a, n, e.memoizedProps);
					} else i === n ? n === null && e.stateNode !== null && Nl(e, e.memoizedProps, r.memoizedProps) : (i === null ? (t = r.stateNode, t === null || G || t.parentNode.removeChild(t)) : i.count--, n === null ? iu || Km(a, e.type, e.stateNode) : Bm(a, n, e.memoizedProps));
				}
				break;
			case 27:
				Ou(t, e, n), ju(e), i & 512 && (G || r === null || El(r, r.return)), r !== null && i & 4 && Nl(e, e.memoizedProps, r.memoizedProps);
				break;
			case 5:
				if (a = au, au = !1, Ou(t, e, n), au = a, ju(e), i & 512 && (G || r === null || El(r, r.return)), e.flags & 32) {
					t = e.stateNode;
					try {
						gn(t, ""), N = !0;
					} catch (t) {
						Z(e, e.return, t);
					}
				}
				i & 4 && e.stateNode != null && (t = e.memoizedProps, Nl(e, t, r === null ? t : r.memoizedProps)), i & 1024 && (ou = !0);
				break;
			case 6:
				if (Ou(t, e, n), ju(e), i & 4) {
					if (e.stateNode === null) throw Error(s(162));
					t = e.memoizedProps, n = e.stateNode;
					try {
						n.nodeValue = t, N = !0;
					} catch (t) {
						Z(e, e.return, t);
					}
				}
				break;
			case 3:
				if (N = !1, Wm = null, a = ku, ku = bm(t.containerInfo), Ou(t, e, n), ku = a, ju(e), i & 4 && r !== null && r.memoizedState.isDehydrated) try {
					Hh(t.containerInfo);
				} catch (t) {
					Z(e, e.return, t);
				}
				ou && (ou = !1, Mu(e)), N = !1;
				break;
			case 4:
				i = au, au = iu, r = Qt(), a = ku, ku = bm(e.stateNode.containerInfo), Ou(t, e, n), ju(e), ku = a, N && uu && (du = !0), N = r, au = i;
				break;
			case 12:
				Ou(t, e, n), ju(e);
				break;
			case 31:
				Ou(t, e, n), ju(e), i & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, Du(e, t)));
				break;
			case 13:
				Ou(t, e, n), ju(e), e.child.flags & 8192 && e.memoizedState !== null != (r !== null && r.memoizedState !== null) && (md = qe()), i & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, Du(e, t)));
				break;
			case 22:
				a = e.memoizedState !== null, o = r !== null && r.memoizedState !== null;
				var c = iu, l = G, u = au;
				iu = c || a, au = u || a, G = l || o, Ou(t, e, n), G = l, au = u, iu = c, ju(e), i & 8192 && (t = e.stateNode, t._visibility = a ? t._visibility & -2 : t._visibility | 1, !a || r === null || o || iu || G || (t = o || G, n = iu, r = G, iu = a || iu, G = t, Iu(e, 2), iu = n, G = r), !a && au || gu(e, a)), i & 4 && (t = e.updateQueue, t !== null && (n = t.retryQueue, n !== null && (t.retryQueue = null, Du(e, n))));
				break;
			case 19:
				Ou(t, e, n), ju(e), i & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, Du(e, t)));
				break;
			case 30:
				i & 512 && (G || r === null || El(r, r.return)), i = Qt(), a = uu, o = (n & 335544064) === n, c = e.memoizedProps, uu = o && Ci(c.default, c.update) !== "none", Ou(t, e, n), ju(e), o && r !== null && N && (e.flags |= 4), uu = a, N = i;
				break;
			case 21: break;
			case 7: i & 512 && (G || r === null || El(r, r.return)), r && r.stateNode !== null && (r.stateNode._fragmentFiber = e);
			default: Ou(t, e, n), ju(e);
		}
	}
	function ju(e) {
		var t = e.flags;
		if (t & 2) {
			try {
				for (var n, r = e.return; r !== null;) {
					if (Pl(r)) {
						n = r;
						break;
					}
					r = r.return;
				}
				r = null;
				for (var i = e.return; i !== null;) {
					if (jl(i)) {
						var a = i.stateNode;
						r === null ? r = [a] : r.push(a);
					}
					if (Al(i)) break;
					i = i.return;
				}
				var o = r;
				if (n == null) throw Error(s(160));
				switch (n.tag) {
					case 27:
						var c = n.stateNode;
						Ll(e, Fl(e), c, o);
						break;
					case 5:
						var l = n.stateNode;
						n.flags & 32 && (gn(l, ""), n.flags &= -33), Ll(e, Fl(e), l, o);
						break;
					case 3:
					case 4:
						var u = n.stateNode.containerInfo;
						Il(e, Fl(e), u, o);
						break;
					default: throw Error(s(161));
				}
			} catch (t) {
				Z(e, e.return, t);
			}
			e.flags &= -3;
		}
		t & 4096 && (e.flags &= -4097);
	}
	function Mu(e) {
		if (e.subtreeFlags & 1024) for (e = e.child; e !== null;) {
			var t = e;
			Mu(t), t.tag === 5 && t.flags & 1024 && (t = t.stateNode, gh = !0, t.reset(), gh = !1), e = e.sibling;
		}
	}
	function Nu(e, t) {
		if (t.subtreeFlags & 9270) for (t = t.child; t !== null;) Pu(t, e), t = t.sibling;
		else ru(t, !1);
	}
	function Pu(e, t) {
		var n = e.alternate;
		if (n === null) Yl(e, !1);
		else switch (e.tag) {
			case 3:
				if (fu = lu = !1, Ul(), Nu(t, e), !lu && !du) {
					if (e = Hl, e !== null) for (var r = 0; r < e.length; r += 3) {
						n = e[r];
						var i = e[r + 1];
						Ep(n, e[r + 2]), n = n.ownerDocument.documentElement, n !== null && n.animate({
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
					})), fu = !0;
				}
				Hl = null;
				break;
			case 5:
				Nu(t, e);
				break;
			case 4:
				r = lu, lu = !1, Nu(t, e), lu && (du = !0), lu = r;
				break;
			case 22:
				e.memoizedState === null && (n.memoizedState === null ? Nu(t, e) : Yl(e, !1));
				break;
			case 30:
				r = lu, i = Ul(), lu = !1, Nu(t, e), lu && (e.flags |= 4);
				var a = e.memoizedProps, o = e.stateNode;
				t = xi(a, o), o = xi(n.memoizedProps, o);
				var s = Ci(a.default, a.update);
				s === "none" ? t = !1 : (a = n.memoizedState, n.memoizedState = null, n = e.child, Wl = 0, t = nu(e, n, t, o, s, a, !0), Wl !== (a === null ? 0 : a.length) && (e.flags |= 32)), e.flags & 4 && t ? (Nd(e, e.memoizedProps.onUpdate), Hl = i) : i !== null && (i.push.apply(i, Hl), Hl = i), lu = e.flags & 32 ? !0 : r;
				break;
			default: Nu(t, e);
		}
	}
	function Fu(e, t) {
		if (t.subtreeFlags & 8772) for (t = t.child; t !== null;) hu(e, t.alternate, t), t = t.sibling;
	}
	function Iu(e, t) {
		for (e = e.child; e !== null;) {
			var n = e, r = t;
			switch (n.tag) {
				case 0:
				case 11:
				case 14:
				case 15:
					Sl(4, n, n.return), Iu(n, r);
					break;
				case 1:
					El(n, n.return);
					var i = n.stateNode;
					typeof i.componentWillUnmount == "function" && wl(n, n.return, i), Iu(n, r);
					break;
				case 27: r & 2 && gm(n.stateNode, n.type, n.memoizedProps);
				case 5:
					El(n, n.return), n.tag !== 5 && n.tag !== 27 || kl(n), Iu(n, r);
					break;
				case 6:
					kl(n);
					break;
				case 26:
					El(n, n.return), i = n.stateNode, n.memoizedState !== null || i === null || G || i.parentNode.removeChild(i), Iu(n, r);
					break;
				case 22:
					n.memoizedState === null && Iu(n, r);
					break;
				case 30:
					El(n, n.return), Iu(n, r);
					break;
				case 7: El(n, n.return);
				default: Iu(n, r);
			}
			e = e.sibling;
		}
	}
	function Lu(e, t, n) {
		for (n = t.subtreeFlags & 8772 ? n : n & -2, t = t.child; t !== null;) {
			var r = t.alternate, i = e, a = t, o = a.flags, s = !!(n & 1);
			switch (a.tag) {
				case 0:
				case 11:
				case 15:
					Lu(i, a, n), xl(4, a);
					break;
				case 1:
					if (Lu(i, a, n), r = a, i = r.stateNode, typeof i.componentDidMount == "function") try {
						i.componentDidMount();
					} catch (e) {
						Z(r, r.return, e);
					}
					if (r = a, i = r.updateQueue, i !== null) {
						var c = r.stateNode;
						try {
							var l = i.shared.hiddenCallbacks;
							if (l !== null) for (i.shared.hiddenCallbacks = null, i = 0; i < l.length; i++) wo(l[i], c);
						} catch (e) {
							Z(r, r.return, e);
						}
					}
					s && o & 64 && Cl(a), Tl(a, a.return);
					break;
				case 27: n & 2 && Rl(a);
				case 5:
					a.tag !== 5 && a.tag !== 27 || Ol(a), Lu(i, a, n), s && r === null && o & 4 && Ml(a), Tl(a, a.return);
					break;
				case 6:
					Ol(a);
					break;
				case 26:
					c = a.stateNode, a.memoizedState !== null || c === null || iu || Km(bm(c.ownerDocument), a.type, c), Lu(i, a, n), s && r === null && o & 4 && Ml(a), Tl(a, a.return);
					break;
				case 12:
					Lu(i, a, n);
					break;
				case 31:
					Lu(i, a, n), s && o & 4 && wu(i, a);
					break;
				case 13:
					Lu(i, a, n), s && o & 4 && Tu(i, a);
					break;
				case 22:
					a.memoizedState === null && Lu(i, a, n), Tl(a, a.return);
					break;
				case 30:
					Lu(i, a, n), Tl(a, a.return);
					break;
				case 7: Tl(a, a.return);
				default: Lu(i, a, n);
			}
			t = t.sibling;
		}
	}
	function Ru(e, t) {
		var n = null;
		e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), e = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (e = t.memoizedState.cachePool.pool), e !== n && (e != null && e.refCount++, n != null && Ia(n));
	}
	function zu(e, t) {
		e = null, t.alternate !== null && (e = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== e && (t.refCount++, e != null && Ia(e));
	}
	function Bu(e, t, n, r) {
		var i = (n & 335544064) === n;
		if (t.subtreeFlags & (i ? 10262 : 10256)) for (t = t.child; t !== null;) Vu(e, t, n, r), t = t.sibling;
		else i && tu(t);
	}
	function Vu(e, t, n, r) {
		var i = (n & 335544064) === n;
		i && t.alternate === null && t.return !== null && t.return.alternate !== null && eu(t);
		var a = t.flags;
		switch (t.tag) {
			case 0:
			case 11:
			case 15:
				Bu(e, t, n, r), a & 2048 && xl(9, t);
				break;
			case 1:
				Bu(e, t, n, r);
				break;
			case 3:
				Bu(e, t, n, r), i && fu && (e = e.containerInfo, e = e.nodeType === 9 ? e.body : e.nodeName === "HTML" ? e.ownerDocument.body : e, e.style.viewTransitionName === "root" && (e.style.viewTransitionName = ""), e = e.ownerDocument.documentElement, e !== null && e.style.viewTransitionName === "none" && (e.style.viewTransitionName = "")), a & 2048 && (a = null, t.alternate !== null && (a = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== a && (t.refCount++, a != null && Ia(a)));
				break;
			case 12:
				if (a & 2048) {
					Bu(e, t, n, r), a = t.stateNode;
					try {
						var o = t.memoizedProps, s = o.id, c = o.onPostCommit;
						typeof c == "function" && c(s, t.alternate === null ? "mount" : "update", a.passiveEffectDuration, -0);
					} catch (e) {
						Z(t, t.return, e);
					}
				} else Bu(e, t, n, r);
				break;
			case 31:
				Bu(e, t, n, r);
				break;
			case 13:
				Bu(e, t, n, r);
				break;
			case 23: break;
			case 22:
				o = t.stateNode, s = t.alternate, t.memoizedState === null ? (i && s !== null && s.memoizedState !== null && eu(t), o._visibility & 2 ? Bu(e, t, n, r) : (o._visibility |= 2, Hu(e, t, n, r, !!(t.subtreeFlags & 10256) || !1))) : (i && s !== null && s.memoizedState === null && eu(s), o._visibility & 2 ? Bu(e, t, n, r) : Uu(e, t)), a & 2048 && Ru(s, t);
				break;
			case 24:
				Bu(e, t, n, r), a & 2048 && zu(t.alternate, t);
				break;
			case 30:
				i && (a = t.alternate, a !== null && (ql(a.child, !0), ql(t.child, !0))), Bu(e, t, n, r);
				break;
			default: Bu(e, t, n, r);
		}
	}
	function Hu(e, t, n, r, i) {
		for (i &&= !!(t.subtreeFlags & 10256) || !1, t = t.child; t !== null;) {
			var a = e, o = t, s = n, c = r, l = o.flags;
			switch (o.tag) {
				case 0:
				case 11:
				case 15:
					Hu(a, o, s, c, i), xl(8, o);
					break;
				case 23: break;
				case 22:
					var u = o.stateNode;
					o.memoizedState === null ? (u._visibility |= 2, Hu(a, o, s, c, i)) : u._visibility & 2 ? Hu(a, o, s, c, i) : Uu(a, o), i && l & 2048 && Ru(o.alternate, o);
					break;
				case 24:
					Hu(a, o, s, c, i), i && l & 2048 && zu(o.alternate, o);
					break;
				default: Hu(a, o, s, c, i);
			}
			t = t.sibling;
		}
	}
	function Uu(e, t) {
		if (t.subtreeFlags & 10256) for (t = t.child; t !== null;) {
			var n = e, r = t, i = r.flags;
			switch (r.tag) {
				case 22:
					Uu(n, r), i & 2048 && Ru(r.alternate, r);
					break;
				case 24:
					Uu(n, r), i & 2048 && zu(r.alternate, r);
					break;
				default: Uu(n, r);
			}
			t = t.sibling;
		}
	}
	var Wu = 8192;
	function Gu(e, t, n) {
		if (e.subtreeFlags & Wu) for (e = e.child; e !== null;) Ku(e, t, n), e = e.sibling;
	}
	function Ku(e, t, n) {
		switch (e.tag) {
			case 26:
				Gu(e, t, n), e.flags & Wu && (e.memoizedState === null ? (e = e.stateNode, (t & 335544128) === t && Zm(n, e)) : Qm(n, ku, e.memoizedState, e.memoizedProps));
				break;
			case 5:
				Gu(e, t, n), e.flags & Wu && (e = e.stateNode, (t & 335544128) === t && Zm(n, e));
				break;
			case 3:
			case 4:
				var r = ku;
				ku = bm(e.stateNode.containerInfo), Gu(e, t, n), ku = r;
				break;
			case 22:
				e.memoizedState === null && (r = e.alternate, r !== null && r.memoizedState !== null ? (r = Wu, Wu = 16777216, Gu(e, t, n), Wu = r) : Gu(e, t, n));
				break;
			case 30:
				if ((e.flags & Wu) !== 0 && (r = e.memoizedProps.name, r != null && r !== "auto")) {
					var i = e.stateNode;
					i.paired = null, Bl === null && (Bl = /* @__PURE__ */ new Map()), Bl.set(r, i);
				}
				Gu(e, t, n);
				break;
			default: Gu(e, t, n);
		}
	}
	function qu(e) {
		var t = e.alternate;
		if (t !== null && (e = t.child, e !== null)) {
			t.child = null;
			do
				t = e.sibling, e.sibling = null, e = t;
			while (e !== null);
		}
	}
	function Ju(e) {
		var t = e.deletions;
		if (e.flags & 16) {
			if (t !== null) for (var n = 0; n < t.length; n++) {
				var r = t[n];
				cu = r, Zu(r, e);
			}
			qu(e);
		}
		if (e.subtreeFlags & 10256) for (e = e.child; e !== null;) Yu(e), e = e.sibling;
	}
	function Yu(e) {
		switch (e.tag) {
			case 0:
			case 11:
			case 15:
				Ju(e), e.flags & 2048 && Sl(9, e, e.return);
				break;
			case 3:
				Ju(e);
				break;
			case 12:
				Ju(e);
				break;
			case 22:
				var t = e.stateNode;
				e.memoizedState !== null && t._visibility & 2 && (e.return === null || e.return.tag !== 13) ? (t._visibility &= -3, Xu(e)) : Ju(e);
				break;
			default: Ju(e);
		}
	}
	function Xu(e) {
		var t = e.deletions;
		if (e.flags & 16) {
			if (t !== null) for (var n = 0; n < t.length; n++) {
				var r = t[n];
				cu = r, Zu(r, e);
			}
			qu(e);
		}
		for (e = e.child; e !== null;) {
			switch (t = e, t.tag) {
				case 0:
				case 11:
				case 15:
					Sl(8, t, t.return), Xu(t);
					break;
				case 22:
					n = t.stateNode, n._visibility & 2 && (n._visibility &= -3, Xu(t));
					break;
				default: Xu(t);
			}
			e = e.sibling;
		}
	}
	function Zu(e, t) {
		for (; cu !== null;) {
			var n = cu;
			switch (n.tag) {
				case 0:
				case 11:
				case 15:
					Sl(8, n, t);
					break;
				case 23:
				case 22:
					if (n.memoizedState !== null && n.memoizedState.cachePool !== null) {
						var r = n.memoizedState.cachePool.pool;
						r != null && r.refCount++;
					}
					break;
				case 24: Ia(n.memoizedState.cache);
			}
			if (r = n.child, r !== null) r.return = n, cu = r;
			else a: for (n = e; cu !== null;) {
				r = cu;
				var i = r.sibling, a = r.return;
				if (yu(r), r === n) {
					cu = null;
					break a;
				}
				if (i !== null) {
					i.return = a, cu = i;
					break a;
				}
				cu = a;
			}
		}
	}
	var Qu = {
		getCacheForType: function(e) {
			var t = Oa(Pa), n = t.data.get(e);
			return n === void 0 && (n = e(), t.data.set(e, n)), n;
		},
		cacheSignal: function() {
			return Oa(Pa).controller.signal;
		}
	}, $u = typeof WeakMap == "function" ? WeakMap : Map, K = 0, q = null, J = null, Y = 0, X = 0, ed = null, td = !1, nd = !1, rd = !1, id = 0, ad = 0, od = 0, sd = 0, cd = 0, ld = 0, ud = 0, dd = null, fd = null, pd = !1, md = 0, hd = 0, gd = Infinity, _d = null, vd = null, yd = 0, bd = null, xd = null, Sd = 0, Cd = 0, wd = null, Td = null, Ed = null, Dd = null, Od = null, kd = 0, Ad = null;
	function jd() {
		return K & 2 && Y !== 0 ? Y & -Y : O.T === null ? Et() : Pf();
	}
	function Md() {
		if (ld === 0) {
			if (!(Y & 536870912) || L) {
				var e = ut;
				ut <<= 1, !(ut & 3932160) && (ut = 262144), ld = e;
			} else ld = 536870912;
		}
		return e = jo.current, e !== null && (e.flags |= 32), ld;
	}
	function Nd(e, t) {
		if (t != null) {
			var n = e.stateNode, r = n.ref;
			r === null && (r = n.ref = Pp(xi(e.memoizedProps, n))), Dd === null && (Dd = []), Dd.push(t.bind(null, r));
		}
	}
	function Pd(e, t, n) {
		(e === q && (X === 2 || X === 9) || e.cancelPendingCommit !== null) && (Vd(e, 0), Rd(e, Y, ld, !1)), yt(e, n), (!(K & 2) || e !== q) && (e === q && (!(K & 2) && (sd |= n), ad === 4 && Rd(e, Y, ld, !1)), Ef(e));
	}
	function Fd(e, t, n) {
		if (K & 6) throw Error(s(327));
		var r = !n && !(t & 127) && (t & e.expiredLanes) === 0 || mt(e, t), i = r ? Yd(e, t) : qd(e, t, !0), a = r;
		do {
			if (i === 0) {
				nd && !r && Rd(e, t, 0, !1);
				break;
			}
			if (n = e.current.alternate, a && !Ld(n)) {
				i = qd(e, t, !1), a = !1;
				continue;
			}
			if (i === 2) {
				if (a = t, e.errorRecoveryDisabledLanes & a) var o = 0;
				else o = e.pendingLanes & -536870913, o = o === 0 ? o & 536870912 ? 536870912 : 0 : o;
				if (o !== 0) {
					t = o;
					a: {
						var c = e;
						i = dd;
						var l = c.current.memoizedState.isDehydrated;
						if (l && (Vd(c, o).flags |= 256), o = qd(c, o, !1), o !== 2 && o !== 6) {
							if (rd && !l) {
								c.errorRecoveryDisabledLanes |= a, sd |= a, i = 4;
								break a;
							}
							a = fd, fd = i, a !== null && (fd === null ? fd = a : fd.push.apply(fd, a));
						}
						i = o;
					}
					if (a = !1, i !== 2) continue;
				}
			}
			if (i === 1) {
				Vd(e, 0), Rd(e, t, 0, !0);
				break;
			}
			a: {
				switch (r = e, a = i, a) {
					case 0:
					case 1: throw Error(s(345));
					case 4: if ((t & 4194048) !== t && (t & 62914560) !== t) break;
					case 6:
						Rd(r, t, ld, !td);
						break a;
					case 2:
						fd = null;
						break;
					case 3:
					case 5: break;
					default: throw Error(s(329));
				}
				if ((t & 62914560) === t && (i = md + 300 - qe(), 10 < i)) {
					if (Rd(r, t, ld, !td), pt(r, 0, !0) !== 0) break a;
					Sd = t, r.timeoutHandle = gp(Id.bind(null, r, n, fd, _d, pd, t, ld, sd, ud, td, a, "Throttled", -0, 0), i);
					break a;
				}
				Id(r, n, fd, _d, pd, t, ld, sd, ud, td, a, null, -0, 0);
			}
			break;
		} while (1);
		Ef(e);
	}
	function Id(e, t, n, r, i, a, o, s, c, l, u, d, f, p) {
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
			unsuspend: wn
		}, Bl = null, Ku(t, a, d), h && (m = d, h = e.containerInfo, h = (h.nodeType === 9 ? h : h.ownerDocument).__reactViewTransition, h != null && (m.count++, m.waitingForViewTransition = !0, m = nh.bind(m), h.finished.then(m, m))), m = (a & 62914560) === a ? md - qe() : (a & 4194048) === a ? hd - qe() : 0, m = eh(d, m), m !== null)) {
			Sd = a, e.cancelPendingCommit = m(nf.bind(null, e, t, a, n, r, i, o, s, c, l, u, d, null, f, p)), Rd(e, a, o, !l);
			return;
		}
		nf(e, t, a, n, r, i, o, s, c, l, u, d);
	}
	function Ld(e) {
		for (var t = e;;) {
			var n = t.tag;
			if ((n === 0 || n === 11 || n === 15) && t.flags & 16384 && (n = t.updateQueue, n !== null && (n = n.stores, n !== null))) for (var r = 0; r < n.length; r++) {
				var i = n[r], a = i.getSnapshot;
				i = i.value;
				try {
					if (!Kr(a(), i)) return !1;
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
	function Rd(e, t, n, r) {
		t = ht(e, t), t &= ~cd, t &= ~sd, e.suspendedLanes |= t, e.pingedLanes &= ~t, r && (e.warmLanes |= t), r = e.expirationTimes;
		for (var i = t; 0 < i;) {
			var a = 31 - at(i), o = 1 << a;
			r[a] = -1, i &= ~o;
		}
		n !== 0 && xt(e, n, t);
	}
	function zd() {
		return K & 6 ? !0 : (Df(0, !1), !1);
	}
	function Bd() {
		if (J !== null) {
			if (X === 0) var e = J.return;
			else e = J, ba = ya = null, as(e), ao = null, oo = 0, e = J;
			for (; e !== null;) bl(e.alternate, e), e = e.return;
			J = null;
		}
	}
	function Vd(e, t) {
		var n = e.timeoutHandle;
		return n !== -1 && (e.timeoutHandle = -1, _p(n)), n = e.cancelPendingCommit, n !== null && (e.cancelPendingCommit = null, n()), Sd = 0, Bd(), q = e, J = n = Ri(e.current, null), Y = t, X = 0, ed = null, td = !1, nd = mt(e, t), rd = !1, ud = ld = cd = sd = od = ad = 0, fd = dd = null, pd = !1, id = ht(e, t), Oi(), n;
	}
	function Hd(e, t) {
		V = null, O.H = mc, t === Xa || t === Za ? (t = ro(), X = 3) : t === B ? (t = ro(), X = 4) : X = t === Mc ? 8 : typeof t == "object" && t && typeof t.then == "function" ? 6 : 1, ed = t, J === null && (ad = 1, Ec(e, Ki(t, e.current)));
	}
	function Ud() {
		var e = jo.current;
		return e === null ? !0 : (Y & 4194048) === Y ? Mo === null : (Y & 62914560) === Y || Y & 536870912 ? e === Mo : !1;
	}
	function Wd() {
		var e = O.H;
		return O.H = mc, e === null ? mc : e;
	}
	function Gd() {
		var e = O.A;
		return O.A = Qu, e;
	}
	function Kd() {
		ad = 4, td || (Y & 4194048) !== Y && jo.current !== null || (nd = !0), !(od & 134217727) && !(sd & 134217727) || q === null || Rd(q, Y, ld, !1);
	}
	function qd(e, t, n) {
		var r = K;
		K |= 2;
		var i = Wd(), a = Gd();
		(q !== e || Y !== t) && (_d = null, Vd(e, t)), t = !1;
		var o = ad;
		a: do
			try {
				if (X !== 0 && J !== null) {
					var s = J, c = ed;
					switch (X) {
						case 8:
							Bd(), o = 6;
							break a;
						case 3:
						case 2:
						case 9:
						case 6:
							jo.current === null && (t = !0);
							var l = X;
							if (X = 0, ed = null, $d(e, s, c, l), n && nd) {
								o = 0;
								break a;
							}
							break;
						default: l = X, X = 0, ed = null, $d(e, s, c, l);
					}
				}
				Jd(), o = ad;
				break;
			} catch (t) {
				Hd(e, t);
			}
		while (1);
		return t && e.shellSuspendCounter++, ba = ya = null, K = r, O.H = i, O.A = a, J === null && (q = null, Y = 0, Oi()), o;
	}
	function Jd() {
		for (; J !== null;) Zd(J);
	}
	function Yd(e, t) {
		var n = K;
		K |= 2;
		var r = Wd(), i = Gd();
		q !== e || Y !== t ? (_d = null, gd = qe() + 500, Vd(e, t)) : nd = mt(e, t);
		a: do
			try {
				if (X !== 0 && J !== null) {
					t = J;
					var a = ed;
					b: switch (X) {
						case 1:
							X = 0, ed = null, $d(e, t, a, 1);
							break;
						case 2:
						case 9:
							if ($a(a)) {
								X = 0, ed = null, Qd(t);
								break;
							}
							t = function() {
								X !== 2 && X !== 9 || q !== e || (X = 7), Ef(e);
							}, a.then(t, t);
							break a;
						case 3:
							X = 7;
							break a;
						case 4:
							X = 5;
							break a;
						case 7:
							$a(a) ? (X = 0, ed = null, Qd(t)) : (X = 0, ed = null, $d(e, t, a, 7));
							break;
						case 5:
							var o = null;
							switch (J.tag) {
								case 26: o = J.memoizedState;
								case 5:
								case 27:
									var c = J;
									if (o ? Ym(o) : c.stateNode.complete) {
										X = 0, ed = null;
										var l = c.sibling;
										if (l !== null) J = l;
										else {
											var u = c.return;
											u === null ? J = null : (J = u, ef(u));
										}
										break b;
									}
							}
							X = 0, ed = null, $d(e, t, a, 5);
							break;
						case 6:
							X = 0, ed = null, $d(e, t, a, 6);
							break;
						case 8:
							Bd(), ad = 6;
							break a;
						default: throw Error(s(462));
					}
				}
				Xd();
				break;
			} catch (t) {
				Hd(e, t);
			}
		while (1);
		return ba = ya = null, O.H = r, O.A = i, K = n, J === null ? (q = null, Y = 0, Oi(), ad) : 0;
	}
	function Xd() {
		for (; J !== null && !Ge();) Zd(J);
	}
	function Zd(e) {
		var t = fl(e.alternate, e, id);
		e.memoizedProps = e.pendingProps, t === null ? ef(e) : J = t;
	}
	function Qd(e) {
		var t = e, n = t.alternate;
		switch (t.tag) {
			case 15:
			case 0:
				t = Kc(n, t, t.pendingProps, t.type, void 0, Y);
				break;
			case 11:
				t = Kc(n, t, t.pendingProps, t.type.render, t.ref, Y);
				break;
			case 5:
				as(t);
				var r = t;
				r === sa && (L ? (pa(r), r.tag === 5 && r.stateNode != null && (I = r.stateNode)) : (pa(r), L = !0));
			default: bl(n, t), t = J = zi(t, id), t = fl(n, t, id);
		}
		e.memoizedProps = e.pendingProps, t === null ? ef(e) : J = t;
	}
	function $d(e, t, n, r) {
		ba = ya = null, as(t), ao = null, oo = 0;
		var i = t.return;
		try {
			if (jc(e, i, t, n, Y)) {
				ad = 1, Ec(e, Ki(n, e.current)), J = null;
				return;
			}
		} catch (t) {
			if (i !== null) throw J = i, t;
			ad = 1, Ec(e, Ki(n, e.current)), J = null;
			return;
		}
		t.flags & 32768 ? (L || r === 1 ? e = !0 : nd || Y & 536870912 ? e = !1 : (td = e = !0, (r === 2 || r === 9 || r === 3 || r === 6) && (r = jo.current, r !== null && r.tag === 13 && (r.flags |= 16384))), tf(t, e)) : ef(t);
	}
	function ef(e) {
		var t = e;
		do {
			if (t.flags & 32768) {
				tf(t, td);
				return;
			}
			e = t.return;
			var n = vl(t.alternate, t, id);
			if (n !== null) {
				J = n;
				return;
			}
			if (t = t.sibling, t !== null) {
				J = t;
				return;
			}
			J = t = e;
		} while (t !== null);
		ad === 0 && (ad = 5);
	}
	function tf(e, t) {
		do {
			var n = yl(e.alternate, e);
			if (n !== null) {
				n.flags &= 32767, J = n;
				return;
			}
			if (n = e.return, n !== null && (n.flags |= 32768, n.subtreeFlags = 0, n.deletions = null), !t && (e = e.sibling, e !== null)) {
				J = e;
				return;
			}
			J = e = n;
		} while (e !== null);
		ad = 6, J = null;
	}
	function nf(e, t, n, r, i, a, o, c, l, u, d, f) {
		e.cancelPendingCommit = null;
		do
			df();
		while (yd !== 0);
		if (K & 6) throw Error(s(327));
		if (t !== null) {
			if (t === e.current) throw Error(s(177));
			e === q && (J = q = null, Y = 0), xd = t, bd = e, Sd = n, wd = i, Td = r, rf(e, t, n, o, c, l, f);
		}
	}
	function rf(e, t, n, r, i, a, o) {
		var s = t.lanes | t.childLanes;
		if (Cd = s, s |= Di, bt(e, n, s, r, i, a), Dd = null, (n & 335544064) === n ? (Od = za(e), r = 10262) : (Od = null, r = 10256), (t.subtreeFlags & r) !== 0 || (t.flags & r) !== 0 ? (e.callbackNode = null, e.callbackPriority = 0, yf(Ze, function() {
			return ff(), null;
		})) : (e.callbackNode = null, e.callbackPriority = 0), zl = !1, r = !!(t.flags & 13878), t.subtreeFlags & 13878 || r) {
			r = O.T, O.T = null, i = k.p, k.p = 2, a = K, K |= 4;
			try {
				pu(e, t, n);
			} finally {
				K = a, k.p = i, O.T = r;
			}
		}
		yd = 1, zl ? Ed = Mp(o, e.containerInfo, Od, sf, cf, of, lf, ff, af, null, null) : (sf(), cf(), lf());
	}
	function af(e) {
		if (yd !== 0) {
			var t = bd.onRecoverableError;
			t(e, { componentStack: null });
		}
	}
	function of() {
		yd === 3 && (yd = 0, Pu(xd, bd), yd = 4);
	}
	function sf() {
		if (yd === 1) {
			yd = 0;
			var e = bd, t = xd, n = Sd, r = !!(t.flags & 13878);
			if (t.subtreeFlags & 13878 || r) {
				r = O.T, O.T = null;
				var i = k.p;
				k.p = 2;
				var a = K;
				K |= 4;
				try {
					uu = du = !1, Au(t, e, n), n = cp;
					var o = Qr(e.containerInfo), s = n.focusedElem, c = n.selectionRange;
					if (o !== s && s && s.ownerDocument && Zr(s.ownerDocument.documentElement, s)) {
						if (c !== null && $r(s)) {
							var l = c.start, u = c.end;
							if (u === void 0 && (u = l), "selectionStart" in s) s.selectionStart = l, s.selectionEnd = Math.min(u, s.value.length);
							else {
								var d = s.ownerDocument || document, f = d && d.defaultView || window;
								if (f.getSelection) {
									var p = f.getSelection(), m = s.textContent.length, h = Math.min(c.start, m), g = c.end === void 0 ? h : Math.min(c.end, m);
									!p.extend && h > g && (o = g, g = h, h = o);
									var _ = Xr(s, h), v = Xr(s, g);
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
					gh = !!sp, cp = sp = null;
				} finally {
					K = a, k.p = i, O.T = r;
				}
			}
			e.current = t, yd = 2;
		}
	}
	function cf() {
		if (yd === 2) {
			yd = 0;
			var e = bd, t = xd, n = !!(t.flags & 8772);
			if (t.subtreeFlags & 8772 || n) {
				n = O.T, O.T = null;
				var r = k.p;
				k.p = 2;
				var i = K;
				K |= 4;
				try {
					hu(e, t.alternate, t);
				} finally {
					K = i, k.p = r, O.T = n;
				}
			}
			yd = 3;
		}
	}
	function lf() {
		if (yd === 4 || yd === 3) {
			yd = 0;
			var e = Ed;
			Ed = null, Ke();
			var t = bd, n = xd, r = Sd, i = Td, a = (r & 335544064) === r ? 10262 : 10256;
			if ((n.subtreeFlags & a) !== 0 || (n.flags & a) !== 0 ? yd = 5 : (yd = 0, xd = bd = null, uf(t, t.pendingLanes)), a = t.pendingLanes, a === 0 && (vd = null), Tt(r), n = n.stateNode, rt && typeof rt.onCommitFiberRoot == "function") try {
				rt.onCommitFiberRoot(nt, n, void 0, (n.current.flags & 128) == 128);
			} catch {}
			if (i !== null) {
				n = O.T, a = k.p, k.p = 2, O.T = null;
				try {
					for (var o = t.onRecoverableError, s = 0; s < i.length; s++) {
						var c = i[s];
						o(c.value, { componentStack: c.stack });
					}
				} finally {
					O.T = n, k.p = a;
				}
			}
			if (i = Dd, o = Od, Od = null, i !== null && (Dd = null, o === null && (o = []), e !== null)) for (c = 0; c < i.length; c++) n = (0, i[c])(o), n !== void 0 && e.finished.finally(n);
			Sd & 3 && df(), Ef(t), a = t.pendingLanes, r & 261930 && a & 42 ? t === Ad ? kd++ : (kd = 0, Ad = t) : (kd = 0, Ad = null), Df(0, !1);
		}
	}
	function uf(e, t) {
		(e.pooledCacheLanes &= t) === 0 && (t = e.pooledCache, t != null && (e.pooledCache = null, Ia(t)));
	}
	function df() {
		return Ed !== null && (Ed.skipTransition(), Ed = null), sf(), cf(), lf(), ff();
	}
	function ff() {
		if (yd !== 5) return !1;
		var e = bd, t = Cd;
		Cd = 0;
		var n = Tt(Sd), r = O.T, i = k.p;
		try {
			k.p = 32 > n ? 32 : n, O.T = null, n = wd, wd = null;
			var a = bd, o = Sd;
			if (yd = 0, xd = bd = null, Sd = 0, K & 6) throw Error(s(331));
			var c = K;
			if (K |= 4, Yu(a.current), Vu(a, a.current, o, n), K = c, Df(0, !1), rt && typeof rt.onPostCommitFiberRoot == "function") try {
				rt.onPostCommitFiberRoot(nt, a);
			} catch {}
			return !0;
		} finally {
			k.p = i, O.T = r, uf(e, t);
		}
	}
	function pf(e, t, n) {
		t = Ki(n, t), t = Oc(e.stateNode, t, 2), e = vo(e, t, 2), e !== null && (yt(e, 2), Ef(e));
	}
	function Z(e, t, n) {
		if (e.tag === 3) pf(e, e, n);
		else for (; t !== null;) {
			if (t.tag === 3) {
				pf(t, e, n);
				break;
			}
			if (t.tag === 1) {
				var r = t.stateNode;
				if (typeof t.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (vd === null || !vd.has(r))) {
					e = Ki(n, e), n = kc(2), r = vo(t, n, 2), r !== null && (Ac(n, r, t, e), yt(r, 2), Ef(r));
					break;
				}
			}
			t = t.return;
		}
	}
	function mf(e, t, n) {
		var r = e.pingCache;
		if (r === null) {
			r = e.pingCache = new $u();
			var i = /* @__PURE__ */ new Set();
			r.set(t, i);
		} else i = r.get(t), i === void 0 && (i = /* @__PURE__ */ new Set(), r.set(t, i));
		i.has(n) || (rd = !0, i.add(n), e = hf.bind(null, e, t, n), t.then(e, e));
	}
	function hf(e, t, n) {
		var r = e.pingCache;
		r !== null && r.delete(t), e.pingedLanes |= e.suspendedLanes & n, e.warmLanes &= ~n, q === e && (Y & n) === n && (ad === 4 || ad === 3 && (Y & 62914560) === Y && 300 > qe() - md ? K & 2 ? cd |= n : Vd(e, 0) : cd |= n, ud === Y && (ud = 0)), Ef(e);
	}
	function gf(e, t) {
		t === 0 && (t = _t()), e = ji(e, t), e !== null && (yt(e, t), Ef(e));
	}
	function _f(e) {
		var t = e.memoizedState, n = 0;
		t !== null && (n = t.retryLane), gf(e, n);
	}
	function vf(e, t) {
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
			default: throw Error(s(314));
		}
		r !== null && r.delete(t), gf(e, n);
	}
	function yf(e, t) {
		return Ue(e, t);
	}
	var bf = null, xf = null, Sf = !1, Cf = !1, wf = !1, Tf = 0;
	function Ef(e) {
		e !== xf && e.next === null && (xf === null ? bf = xf = e : xf = xf.next = e), Cf = !0, Sf || (Sf = !0, Nf());
	}
	function Df(e, t) {
		if (!wf && Cf) {
			wf = !0;
			do
				for (var n = !1, r = bf; r !== null;) {
					if (!t) {
						if (e !== 0) {
							var i = r.pendingLanes;
							if (i === 0) var a = 0;
							else {
								var o = r.suspendedLanes, s = r.pingedLanes;
								a = (1 << 31 - at(42 | e) + 1) - 1, a &= i & ~(o & ~s), a = a & 201326741 ? a & 201326741 | 1 : a ? a | 2 : 0;
							}
							a !== 0 && (n = !0, Mf(r, a));
						} else a = Y, a = pt(r, r === q ? a : 0, r.cancelPendingCommit !== null || r.timeoutHandle !== -1), !(a & 3) || mt(r, a) || (n = !0, Mf(r, a));
					}
					r = r.next;
				}
			while (n);
			wf = !1;
		}
	}
	function Of() {
		kf();
	}
	function kf() {
		Cf = Sf = !1;
		var e = 0;
		Tf !== 0 && hp() && (e = Tf);
		for (var t = qe(), n = null, r = bf; r !== null;) {
			var i = r.next, a = Af(r, t);
			a === 0 ? (r.next = null, n === null ? bf = i : n.next = i, i === null && (xf = n)) : (n = r, (e !== 0 || a & 3) && (Cf = !0)), r = i;
		}
		yd !== 0 && yd !== 5 || Df(e, !1), Tf !== 0 && (Tf = 0);
	}
	function Af(e, t) {
		for (var n = e.suspendedLanes, r = e.pingedLanes, i = e.expirationTimes, a = e.pendingLanes & -62914561; 0 < a;) {
			var o = 31 - at(a), s = 1 << o, c = i[o];
			c === -1 ? ((s & n) === 0 || (s & r) !== 0) && (i[o] = gt(s, t)) : c <= t && (e.expiredLanes |= s), a &= ~s;
		}
		if (t = q, n = Y, n = pt(e, e === t ? n : 0, e.cancelPendingCommit !== null || e.timeoutHandle !== -1), r = e.callbackNode, n === 0 || e === t && (X === 2 || X === 9) || e.cancelPendingCommit !== null) return r !== null && r !== null && We(r), e.callbackNode = null, e.callbackPriority = 0;
		if (!(n & 3) || mt(e, n)) {
			if (t = n & -n, t === e.callbackPriority) return t;
			switch (r !== null && We(r), Tt(n)) {
				case 2:
				case 8:
					n = Xe;
					break;
				case 32:
					n = Ze;
					break;
				case 268435456:
					n = $e;
					break;
				default: n = Ze;
			}
			return r = jf.bind(null, e), n = Ue(n, r), e.callbackPriority = t, e.callbackNode = n, t;
		}
		return r !== null && r !== null && We(r), e.callbackPriority = 2, e.callbackNode = null, 2;
	}
	function jf(e, t) {
		if (yd !== 0 && yd !== 5) return e.callbackNode = null, e.callbackPriority = 0, null;
		var n = e.callbackNode;
		if (df() && e.callbackNode !== n) return null;
		var r = Y;
		return r = pt(e, e === q ? r : 0, e.cancelPendingCommit !== null || e.timeoutHandle !== -1), r === 0 ? null : (Fd(e, r, t), Af(e, qe()), e.callbackNode != null && e.callbackNode === n ? jf.bind(null, e) : null);
	}
	function Mf(e, t) {
		if (df()) return null;
		Fd(e, t, !0);
	}
	function Nf() {
		bp(function() {
			K & 6 ? Ue(Ye, Of) : kf();
		});
	}
	function Pf() {
		if (Tf === 0) {
			var e = Ha;
			e === 0 && (e = lt, lt <<= 1, !(lt & 261888) && (lt = 256)), Tf = e;
		}
		return Tf;
	}
	function Ff(e) {
		return e == null || typeof e == "symbol" || typeof e == "boolean" ? null : typeof e == "function" ? e : Cn(e);
	}
	function If(e, t, n, r, i) {
		if (t === "submit" && n && n.stateNode === i) {
			var a = Ff((i[At] || null).action), o = r.submitter;
			o && (t = (t = o[At] || null) ? Ff(t.formAction) : o.getAttribute("formAction"), t !== null && (a = t, o = null));
			var s = new P("action", "action", null, r, i);
			e.push({
				event: s,
				listeners: [{
					instance: null,
					listener: function() {
						if (r.defaultPrevented) {
							if (Tf !== 0) {
								var e = new FormData(i, o);
								ec(n, {
									pending: !0,
									data: e,
									method: i.method,
									action: a
								}, null, e);
							}
						} else typeof a == "function" && (s.preventDefault(), e = new FormData(i, o), ec(n, {
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
	for (var Lf = 0; Lf < vi.length; Lf++) {
		var Rf = vi[Lf];
		yi(Rf.toLowerCase(), "on" + (Rf[0].toUpperCase() + Rf.slice(1)));
	}
	yi(di, "onAnimationEnd"), yi(F, "onAnimationIteration"), yi(fi, "onAnimationStart"), yi("dblclick", "onDoubleClick"), yi("focusin", "onFocus"), yi("focusout", "onBlur"), yi(pi, "onTransitionRun"), yi(mi, "onTransitionStart"), yi(hi, "onTransitionCancel"), yi(gi, "onTransitionEnd"), qt("onMouseEnter", ["mouseout", "mouseover"]), qt("onMouseLeave", ["mouseout", "mouseover"]), qt("onPointerEnter", ["pointerout", "pointerover"]), qt("onPointerLeave", ["pointerout", "pointerover"]), M("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" ")), M("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")), M("onBeforeInput", [
		"compositionend",
		"keypress",
		"textInput",
		"paste"
	]), M("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" ")), M("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" ")), M("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
	var zf = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "), Bf = new Set("beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(zf));
	function Vf(e, t) {
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
						wi(e);
					}
					i.currentTarget = null, a = c;
				}
				else for (o = 0; o < r.length; o++) {
					if (s = r[o], c = s.instance, l = s.currentTarget, s = s.listener, c !== a && i.isPropagationStopped()) break a;
					a = s, i.currentTarget = l;
					try {
						a(i);
					} catch (e) {
						wi(e);
					}
					i.currentTarget = null, a = c;
				}
			}
		}
	}
	function Q(e, t) {
		var n = t[Mt];
		n === void 0 && (n = t[Mt] = /* @__PURE__ */ new Set());
		var r = e + "__bubble";
		n.has(r) || (Gf(t, e, 2, !1), n.add(r));
	}
	function Hf(e, t, n) {
		var r = 0;
		t && (r |= 4), Gf(n, e, r, t);
	}
	var Uf = "_reactListening" + Math.random().toString(36).slice(2);
	function Wf(e) {
		if (!e[Uf]) {
			e[Uf] = !0, Gt.forEach(function(t) {
				t !== "selectionchange" && (Bf.has(t) || Hf(t, !1, e), Hf(t, !0, e));
			});
			var t = e.nodeType === 9 ? e : e.ownerDocument;
			t === null || t[Uf] || (t[Uf] = !0, Hf("selectionchange", !1, t));
		}
	}
	function Gf(e, t, n, r) {
		switch (Ch(t)) {
			case 2:
				var i = _h;
				break;
			case 8:
				i = vh;
				break;
			default: i = yh;
		}
		n = i.bind(null, t, n, e), i = void 0, !Pn || t !== "touchstart" && t !== "touchmove" && t !== "wheel" || (i = !0), r ? i === void 0 ? e.addEventListener(t, n, !0) : e.addEventListener(t, n, {
			capture: !0,
			passive: i
		}) : i === void 0 ? e.addEventListener(t, n, !1) : e.addEventListener(t, n, { passive: i });
	}
	function Kf(e, t, n, r, i) {
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
					if (o = zt(s), o === null) return;
					if (c = o.tag, c === 5 || c === 6 || c === 26 || c === 27) {
						r = a = o;
						continue a;
					}
					s = s.parentNode;
				}
			}
			r = r.return;
		}
		jn(function() {
			var r = a, i = En(n), o = [];
			a: {
				var s = _i.get(e);
				if (s !== void 0) {
					var c = P, u = e;
					switch (e) {
						case "keypress": if (Bn(n) === 0) break a;
						case "keydown":
						case "keyup":
							c = cr;
							break;
						case "focusin":
							u = "focus", c = $n;
							break;
						case "focusout":
							u = "blur", c = $n;
							break;
						case "beforeblur":
						case "afterblur":
							c = $n;
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
							c = Zn;
							break;
						case "drag":
						case "dragend":
						case "dragenter":
						case "dragexit":
						case "dragleave":
						case "dragover":
						case "dragstart":
						case "drop":
							c = Qn;
							break;
						case "touchcancel":
						case "touchend":
						case "touchmove":
						case "touchstart":
							c = dr;
							break;
						case di:
						case F:
						case fi:
							c = er;
							break;
						case gi:
							c = fr;
							break;
						case "scroll":
						case "scrollend":
							c = Kn;
							break;
						case "wheel":
							c = pr;
							break;
						case "copy":
						case "cut":
						case "paste":
							c = tr;
							break;
						case "gotpointercapture":
						case "lostpointercapture":
						case "pointercancel":
						case "pointerdown":
						case "pointermove":
						case "pointerout":
						case "pointerover":
						case "pointerup":
							c = lr;
							break;
						case "submit":
							c = ur;
							break;
						case "toggle":
						case "beforetoggle": c = mr;
					}
					var d = !!(t & 4), f = !d && (e === "scroll" || e === "scrollend"), p = d ? s === null ? null : s + "Capture" : s;
					d = [];
					for (var m = r, h; m !== null;) {
						var g = m;
						if (h = g.stateNode, g = g.tag, g !== 5 && g !== 26 && g !== 27 || h === null || p === null || (g = Mn(m, p), g != null && d.push(qf(m, g, h))), f) break;
						m = m.return;
					}
					0 < d.length && (s = new c(s, u, null, n, i), o.push({
						event: s,
						listeners: d
					}));
				}
			}
			if (!(t & 7)) {
				a: {
					if (c = e === "mouseover" || e === "pointerover", s = e === "mouseout" || e === "pointerout", c && n !== Tn && (u = n.relatedTarget || n.fromElement) && (zt(u) || u[jt])) break a;
					(s || c) && (u = i.window === i ? i : (c = i.ownerDocument) ? c.defaultView || c.parentWindow : window, s ? (c = n.relatedTarget || n.toElement, s = r, c = c ? zt(c) : null, c !== null && (f = l(c), d = c.tag, c !== f || d !== 5 && d !== 27 && d !== 6) && (c = null)) : (s = null, c = r), s !== c && (d = Zn, g = "onMouseLeave", p = "onMouseEnter", m = "mouse", (e === "pointerout" || e === "pointerover") && (d = lr, g = "onPointerLeave", p = "onPointerEnter", m = "pointer"), f = s == null ? u : Vt(s), h = c == null ? u : Vt(c), u = new d(g, m + "leave", s, n, i), u.target = f, u.relatedTarget = h, g = null, zt(i) === r && (d = new d(p, m + "enter", c, n, i), d.target = h, d.relatedTarget = f, g = d), f = g, d = s && c ? ne(s, c, Yf) : null, s !== null && Xf(o, u, s, d, !1), c !== null && f !== null && Xf(o, f, c, d, !0)));
				}
				a: {
					if (s = r ? Vt(r) : window, c = s.nodeName && s.nodeName.toLowerCase(), c === "select" || c === "input" && s.type === "file") var _ = Pr;
					else if (Or(s)) {
						if (Fr) _ = Wr;
						else {
							_ = Hr;
							var v = Vr;
						}
					} else c = s.nodeName, !c || c.toLowerCase() !== "input" || s.type !== "checkbox" && s.type !== "radio" ? r && bn(r.elementType) && (_ = Pr) : _ = Ur;
					if (_ &&= _(e, r)) {
						kr(o, _, n, i);
						break a;
					}
					v && v(e, s, r);
				}
				switch (v = r ? Vt(r) : window, e) {
					case "focusin":
						(Or(v) || v.contentEditable === "true") && (ti = v, ni = r, ri = null);
						break;
					case "focusout":
						ri = ni = ti = null;
						break;
					case "mousedown":
						ii = !0;
						break;
					case "contextmenu":
					case "mouseup":
					case "dragend":
						ii = !1, ai(o, n, i);
						break;
					case "selectionchange": if (ei) break;
					case "keydown":
					case "keyup": ai(o, n, i);
				}
				var y;
				if (gr) b: {
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
				else wr ? Sr(e, n) && (b = "onCompositionEnd") : e === "keydown" && n.keyCode === 229 && (b = "onCompositionStart");
				b && (yr && n.locale !== "ko" && (wr || b !== "onCompositionStart" ? b === "onCompositionEnd" && wr && (y = zn()) : (In = i, Ln = "value" in In ? In.value : In.textContent, wr = !0)), v = Jf(r, b), 0 < v.length && (b = new nr(b, e, null, n, i), o.push({
					event: b,
					listeners: v
				}), y ? b.data = y : (y = Cr(n), y !== null && (b.data = y)))), (y = vr ? Tr(e, n) : Er(e, n)) && (b = Jf(r, "onBeforeInput"), 0 < b.length && (v = new nr("onBeforeInput", "beforeinput", null, n, i), o.push({
					event: v,
					listeners: b
				}), v.data = y)), If(o, e, r, n, i);
			}
			Vf(o, t);
		});
	}
	function qf(e, t, n) {
		return {
			instance: e,
			listener: t,
			currentTarget: n
		};
	}
	function Jf(e, t) {
		for (var n = t + "Capture", r = []; e !== null;) {
			var i = e, a = i.stateNode;
			if (i = i.tag, i !== 5 && i !== 26 && i !== 27 || a === null || (i = Mn(e, n), i != null && r.unshift(qf(e, i, a)), i = Mn(e, t), i != null && r.push(qf(e, i, a))), e.tag === 3) return r;
			e = e.return;
		}
		return [];
	}
	function Yf(e) {
		if (e === null) return null;
		do
			e = e.return;
		while (e && e.tag !== 5 && e.tag !== 27);
		return e || null;
	}
	function Xf(e, t, n, r, i) {
		for (var a = t._reactName, o = []; n !== null && n !== r;) {
			var s = n, c = s.alternate, l = s.stateNode;
			if (s = s.tag, c !== null && c === r) break;
			s !== 5 && s !== 26 && s !== 27 || l === null || (c = l, i ? (l = Mn(n, a), l != null && o.unshift(qf(n, l, c))) : i || (l = Mn(n, a), l != null && o.push(qf(n, l, c)))), n = n.return;
		}
		o.length !== 0 && e.push({
			event: t,
			listeners: o
		});
	}
	var Zf = /\r\n?/g, Qf = /\u0000|\uFFFD/g;
	function $f(e) {
		return (typeof e == "string" ? e : "" + e).replace(Zf, "\n").replace(Qf, "");
	}
	function ep(e, t) {
		return t = $f(t), $f(e) === t;
	}
	function $(e, t, n, r, i, a) {
		switch (n) {
			case "children":
				if (typeof r == "string") t === "body" || t === "textarea" && r === "" || gn(e, r);
				else if (typeof r == "number" || typeof r == "bigint") t !== "body" && gn(e, "" + r);
				else return;
				break;
			case "className":
				en(e, "class", r);
				break;
			case "tabIndex":
				en(e, "tabindex", r);
				break;
			case "dir":
			case "role":
			case "viewBox":
			case "width":
			case "height":
				en(e, n, r);
				break;
			case "style":
				yn(e, r, a);
				return;
			case "data": if (t !== "object") {
				en(e, "data", r);
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
				r = Cn(r), e.setAttribute(n, r);
				break;
			case "action":
			case "formAction":
				if (typeof r == "function") {
					e.setAttribute(n, "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')");
					break;
				}
				if (typeof a == "function" && (n === "formAction" ? (t !== "input" && $(e, t, "name", i.name, i, null), $(e, t, "formEncType", i.formEncType, i, null), $(e, t, "formMethod", i.formMethod, i, null), $(e, t, "formTarget", i.formTarget, i, null)) : ($(e, t, "encType", i.encType, i, null), $(e, t, "method", i.method, i, null), $(e, t, "target", i.target, i, null))), r == null || typeof r == "symbol" || typeof r == "boolean") {
					e.removeAttribute(n);
					break;
				}
				r = Cn(r), e.setAttribute(n, r);
				break;
			case "onClick":
				r != null && (e.onclick = wn);
				return;
			case "onScroll":
				r != null && Q("scroll", e);
				return;
			case "onScrollEnd":
				r != null && Q("scrollend", e);
				return;
			case "dangerouslySetInnerHTML":
				if (r != null) {
					if (typeof r != "object" || !("__html" in r)) throw Error(s(61));
					if (n = r.__html, n != null) {
						if (i.children != null) throw Error(s(60));
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
				n = Cn(r), e.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", n);
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
				Q("beforetoggle", e), Q("toggle", e), $t(e, "popover", r);
				break;
			case "xlinkActuate":
				tn(e, "http://www.w3.org/1999/xlink", "xlink:actuate", r);
				break;
			case "xlinkArcrole":
				tn(e, "http://www.w3.org/1999/xlink", "xlink:arcrole", r);
				break;
			case "xlinkRole":
				tn(e, "http://www.w3.org/1999/xlink", "xlink:role", r);
				break;
			case "xlinkShow":
				tn(e, "http://www.w3.org/1999/xlink", "xlink:show", r);
				break;
			case "xlinkTitle":
				tn(e, "http://www.w3.org/1999/xlink", "xlink:title", r);
				break;
			case "xlinkType":
				tn(e, "http://www.w3.org/1999/xlink", "xlink:type", r);
				break;
			case "xmlBase":
				tn(e, "http://www.w3.org/XML/1998/namespace", "xml:base", r);
				break;
			case "xmlLang":
				tn(e, "http://www.w3.org/XML/1998/namespace", "xml:lang", r);
				break;
			case "xmlSpace":
				tn(e, "http://www.w3.org/XML/1998/namespace", "xml:space", r);
				break;
			case "is":
				$t(e, "is", r);
				break;
			case "innerText":
			case "textContent": return;
			default: if (!(2 < n.length) || n[0] !== "o" && n[0] !== "O" || n[1] !== "n" && n[1] !== "N") n = xn.get(n) || n, $t(e, n, r);
			else return;
		}
		N = !0;
	}
	function tp(e, t, n, r, i, a) {
		switch (n) {
			case "style":
				yn(e, r, a);
				return;
			case "dangerouslySetInnerHTML":
				if (r != null) {
					if (typeof r != "object" || !("__html" in r)) throw Error(s(61));
					if (n = r.__html, n != null) {
						if (i.children != null) throw Error(s(60));
						a?.__html !== n && (e.innerHTML = n);
					}
				}
				break;
			case "children":
				if (typeof r == "string") gn(e, r);
				else if (typeof r == "number" || typeof r == "bigint") gn(e, "" + r);
				else return;
				break;
			case "onScroll":
				r != null && Q("scroll", e);
				return;
			case "onScrollEnd":
				r != null && Q("scrollend", e);
				return;
			case "onClick":
				r != null && (e.onclick = wn);
				return;
			case "suppressContentEditableWarning":
			case "suppressHydrationWarning":
			case "innerHTML":
			case "ref": return;
			case "innerText":
			case "textContent": return;
			default:
				if (!Kt.hasOwnProperty(n)) a: {
					if (n[0] === "o" && n[1] === "n" && (i = n.endsWith("Capture"), a = n.slice(2, i ? n.length - 7 : void 0), t = e[At] || null, t = t == null ? null : t[n], typeof t == "function" && e.removeEventListener(a, t, i), typeof r == "function")) {
						typeof t != "function" && t !== null && (n in e ? e[n] = null : e.hasAttribute(n) && e.removeAttribute(n)), e.addEventListener(a, r, i);
						break a;
					}
					N = !0, n in e ? e[n] = r : !0 === r ? e.setAttribute(n, "") : $t(e, n, r);
				}
				return;
		}
		N = !0;
	}
	function np(e, t, n) {
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
				Q("error", e), Q("load", e);
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
						case "dangerouslySetInnerHTML": throw Error(s(137, t));
						default: $(e, t, a, o, n, null);
					}
				}
				i && $(e, t, "srcSet", n.srcSet, n, null), r && $(e, t, "src", n.src, n, null);
				return;
			case "input":
				Q("invalid", e);
				var c = a = o = i = null, l = null, u = null;
				for (r in n) if (n.hasOwnProperty(r)) {
					var d = n[r];
					if (d != null) switch (r) {
						case "name":
							i = d;
							break;
						case "type":
							o = d;
							break;
						case "checked":
							l = d;
							break;
						case "defaultChecked":
							u = d;
							break;
						case "value":
							a = d;
							break;
						case "defaultValue":
							c = d;
							break;
						case "children":
						case "dangerouslySetInnerHTML":
							if (d != null) throw Error(s(137, t));
							break;
						default: $(e, t, r, d, n, null);
					}
				}
				dn(e, a, c, l, u, o, i, !1);
				return;
			case "select":
				for (i in Q("invalid", e), r = o = a = null, n) if (n.hasOwnProperty(i) && (c = n[i], c != null)) switch (i) {
					case "value":
						a = c;
						break;
					case "defaultValue":
						o = c;
						break;
					case "multiple": r = c;
					default: $(e, t, i, c, n, null);
				}
				t = a, n = o, e.multiple = !!r, t == null ? n != null && pn(e, !!r, n, !0) : pn(e, !!r, t, !1);
				return;
			case "textarea":
				for (o in Q("invalid", e), a = i = r = null, n) if (n.hasOwnProperty(o) && (c = n[o], c != null)) switch (o) {
					case "value":
						r = c;
						break;
					case "defaultValue":
						i = c;
						break;
					case "children":
						a = c;
						break;
					case "dangerouslySetInnerHTML":
						if (c != null) throw Error(s(91));
						break;
					default: $(e, t, o, c, n, null);
				}
				hn(e, r, i, a);
				return;
			case "option":
				for (l in n) if (n.hasOwnProperty(l) && (r = n[l], r != null)) switch (l) {
					case "selected":
						e.selected = r && typeof r != "function" && typeof r != "symbol";
						break;
					default: $(e, t, l, r, n, null);
				}
				return;
			case "dialog":
				Q("beforetoggle", e), Q("toggle", e), Q("cancel", e), Q("close", e);
				break;
			case "iframe":
			case "object":
				Q("load", e);
				break;
			case "video":
			case "audio":
				for (r = 0; r < zf.length; r++) Q(zf[r], e);
				break;
			case "image":
				Q("error", e), Q("load", e);
				break;
			case "details":
				Q("toggle", e);
				break;
			case "embed":
			case "source":
			case "link": Q("error", e), Q("load", e);
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
					case "dangerouslySetInnerHTML": throw Error(s(137, t));
					default: $(e, t, u, r, n, null);
				}
				return;
			default: if (bn(t)) {
				for (d in n) n.hasOwnProperty(d) && (r = n[d], r !== void 0 && tp(e, t, d, r, n, void 0));
				return;
			}
		}
		for (c in n) n.hasOwnProperty(c) && (r = n[c], r != null && $(e, t, c, r, n, null));
	}
	var rp = {};
	function ip(e, t, n, r) {
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
				var i = null, a = null, o = null, c = null, l = null, u = null, d = null;
				for (m in n) {
					var f = n[m];
					if (n.hasOwnProperty(m) && f != null) switch (m) {
						case "checked": break;
						case "value": break;
						case "defaultValue": l = f;
						default: r.hasOwnProperty(m) || $(e, t, m, null, r, f);
					}
				}
				for (var p in r) {
					var m = r[p];
					if (f = n[p], r.hasOwnProperty(p) && (m != null || f != null)) switch (p) {
						case "type":
							m !== f && (N = !0), a = m;
							break;
						case "name":
							m !== f && (N = !0), i = m;
							break;
						case "checked":
							m !== f && (N = !0), u = m;
							break;
						case "defaultChecked":
							m !== f && (N = !0), d = m;
							break;
						case "value":
							m !== f && (N = !0), o = m;
							break;
						case "defaultValue":
							m !== f && (N = !0), c = m;
							break;
						case "children":
						case "dangerouslySetInnerHTML":
							if (m != null) throw Error(s(137, t));
							break;
						default: m !== f && $(e, t, p, m, r, f);
					}
				}
				un(e, o, c, l, u, d, a, i);
				return;
			case "select":
				for (a in m = o = c = p = null, n) if (l = n[a], n.hasOwnProperty(a) && l != null) switch (a) {
					case "value": break;
					case "multiple": m = l;
					default: r.hasOwnProperty(a) || $(e, t, a, null, r, l);
				}
				for (i in r) if (a = r[i], l = n[i], r.hasOwnProperty(i) && (a != null || l != null)) switch (i) {
					case "value":
						a !== l && (N = !0), p = a;
						break;
					case "defaultValue":
						a !== l && (N = !0), c = a;
						break;
					case "multiple": a !== l && (N = !0), o = a;
					default: a !== l && $(e, t, i, a, r, l);
				}
				t = c, n = o, r = m, p == null ? !!r != !!n && (t == null ? pn(e, !!n, n ? [] : "", !1) : pn(e, !!n, t, !0)) : pn(e, !!n, p, !1);
				return;
			case "textarea":
				for (c in m = p = null, n) if (i = n[c], n.hasOwnProperty(c) && i != null && !r.hasOwnProperty(c)) switch (c) {
					case "value": break;
					case "children": break;
					default: $(e, t, c, null, r, i);
				}
				for (o in r) if (i = r[o], a = n[o], r.hasOwnProperty(o) && (i != null || a != null)) switch (o) {
					case "value":
						i !== a && (N = !0), p = i;
						break;
					case "defaultValue":
						i !== a && (N = !0), m = i;
						break;
					case "children": break;
					case "dangerouslySetInnerHTML":
						if (i != null) throw Error(s(91));
						break;
					default: i !== a && $(e, t, o, i, r, a);
				}
				mn(e, p, m);
				return;
			case "option":
				for (var h in n) if (p = n[h], n.hasOwnProperty(h) && p != null && !r.hasOwnProperty(h)) switch (h) {
					case "selected":
						e.selected = !1;
						break;
					default: $(e, t, h, null, r, p);
				}
				for (l in r) if (p = r[l], m = n[l], r.hasOwnProperty(l) && p !== m && (p != null || m != null)) switch (l) {
					case "selected":
						p !== m && (N = !0), e.selected = p && typeof p != "function" && typeof p != "symbol";
						break;
					default: $(e, t, l, p, r, m);
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
				for (var g in n) p = n[g], n.hasOwnProperty(g) && p != null && !r.hasOwnProperty(g) && $(e, t, g, null, r, p);
				for (u in r) if (p = r[u], m = n[u], r.hasOwnProperty(u) && p !== m && (p != null || m != null)) switch (u) {
					case "children":
					case "dangerouslySetInnerHTML":
						if (p != null) throw Error(s(137, t));
						break;
					default: $(e, t, u, p, r, m);
				}
				return;
			default: if (bn(t)) {
				for (var _ in n) p = n[_], n.hasOwnProperty(_) && p !== void 0 && !r.hasOwnProperty(_) && tp(e, t, _, void 0, r, p);
				for (d in r) p = r[d], m = n[d], !r.hasOwnProperty(d) || p === m || p === void 0 && m === void 0 || tp(e, t, d, p, r, m);
				return;
			}
		}
		for (var v in n) p = n[v], n.hasOwnProperty(v) && p != null && !r.hasOwnProperty(v) && $(e, t, v, null, r, p);
		for (f in r) p = r[f], m = n[f], !r.hasOwnProperty(f) || p === m || p == null && m == null || $(e, t, f, p, r, m);
	}
	function ap(e) {
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
	function op() {
		if (typeof performance.getEntriesByType == "function") {
			for (var e = 0, t = 0, n = performance.getEntriesByType("resource"), r = 0; r < n.length; r++) {
				var i = n[r], a = i.transferSize, o = i.initiatorType, s = i.duration;
				if (a && s && ap(o)) {
					for (o = 0, s = i.responseEnd, r += 1; r < n.length; r++) {
						var c = n[r], l = c.startTime;
						if (l > s) break;
						var u = c.transferSize, d = c.initiatorType;
						u && ap(d) && (c = c.responseEnd, o += u * (c < s ? 1 : (s - l) / (c - l)));
					}
					if (--r, t += 8 * (a + o) / (i.duration / 1e3), e++, 10 < e) break;
				}
			}
			if (0 < e) return t / e / 1e6;
		}
		return navigator.connection && (e = navigator.connection.downlink, typeof e == "number") ? e : 5;
	}
	var sp = null, cp = null;
	function lp(e) {
		return e.nodeType === 9 ? e : e.ownerDocument;
	}
	function up(e) {
		switch (e) {
			case "http://www.w3.org/2000/svg": return 1;
			case "http://www.w3.org/1998/Math/MathML": return 2;
			default: return 0;
		}
	}
	function dp(e, t) {
		if (e === 0) switch (t) {
			case "svg": return 1;
			case "math": return 2;
			default: return 0;
		}
		return e === 1 && t === "foreignObject" ? 0 : e;
	}
	function fp(e, t, n, r) {
		return n = lp(n).createElement(e), n[kt] = r, n[At] = t, np(n, e, t), Ut(n), n;
	}
	function pp(e, t) {
		return e === "textarea" || e === "noscript" || typeof t.children == "string" || typeof t.children == "number" || typeof t.children == "bigint" || typeof t.dangerouslySetInnerHTML == "object" && t.dangerouslySetInnerHTML !== null && t.dangerouslySetInnerHTML.__html != null;
	}
	var mp = null;
	function hp() {
		var e = window.event;
		return e && e.type === "popstate" ? e !== mp && (mp = e, !0) : (mp = null, !1);
	}
	var gp = typeof setTimeout == "function" ? setTimeout : void 0, _p = typeof clearTimeout == "function" ? clearTimeout : void 0, vp = typeof Promise == "function" ? Promise : void 0, yp = typeof requestAnimationFrame == "function" ? requestAnimationFrame : gp, bp = typeof queueMicrotask == "function" ? queueMicrotask : vp === void 0 ? gp : function(e) {
		return vp.resolve(null).then(e).catch(xp);
	};
	function xp(e) {
		setTimeout(function() {
			throw e;
		});
	}
	function Sp(e) {
		return e === "head";
	}
	function Cp(e, t) {
		var n = t, r = 0;
		do {
			var i = n.nextSibling;
			if (e.removeChild(n), i && i.nodeType === 8) {
				if (n = i.data, n === "/$" || n === "/&") {
					if (r === 0) {
						e.removeChild(i), Hh(t);
						return;
					}
					r--;
				} else if (n === "$" || n === "$?" || n === "$~" || n === "$!" || n === "&") r++;
				else if (n === "html") _m(e.ownerDocument.documentElement);
				else if (n === "head") {
					n = e.ownerDocument.head, _m(n);
					for (var a = n.firstChild; a;) {
						var o = a.nextSibling, s = a.nodeName;
						a[It] || s === "SCRIPT" || s === "STYLE" || s === "LINK" && a.rel.toLowerCase() === "stylesheet" || n.removeChild(a), a = o;
					}
				} else n === "body" && _m(e.ownerDocument.body);
			}
			n = i;
		} while (n);
		Hh(t);
	}
	function wp(e, t) {
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
	function Tp(e, t, n) {
		if (t = CSS.escape(t) === t ? t : "r-" + btoa(t).replace(/=/g, ""), e.style.viewTransitionName = t, n != null && (e.style.viewTransitionClass = n), n = getComputedStyle(e), n.display === "inline") {
			if (t = e.getClientRects(), t.length === 1) var r = 1;
			else for (var i = r = 0; i < t.length; i++) {
				var a = t[i];
				0 < a.width && 0 < a.height && r++;
			}
			r === 1 && (e = e.style, e.display = t.length === 1 ? "inline-block" : "block", e.marginTop = "-" + n.paddingTop, e.marginBottom = "-" + n.paddingBottom);
		}
	}
	function Ep(e, t) {
		e = e.style, t = t.style;
		var n = t == null ? null : t.hasOwnProperty("viewTransitionName") ? t.viewTransitionName : t.hasOwnProperty("view-transition-name") ? t["view-transition-name"] : null;
		e.viewTransitionName = n == null || typeof n == "boolean" ? "" : ("" + n).trim(), n = t == null ? null : t.hasOwnProperty("viewTransitionClass") ? t.viewTransitionClass : t.hasOwnProperty("view-transition-class") ? t["view-transition-class"] : null, e.viewTransitionClass = n == null || typeof n == "boolean" ? "" : ("" + n).trim(), e.display === "inline-block" && (t == null ? e.display = e.margin = "" : (n = t.display, e.display = n == null || typeof n == "boolean" ? "" : n, n = t.margin, n == null ? (n = t.hasOwnProperty("marginTop") ? t.marginTop : t["margin-top"], e.marginTop = n == null || typeof n == "boolean" ? "" : n, t = t.hasOwnProperty("marginBottom") ? t.marginBottom : t["margin-bottom"], e.marginBottom = t == null || typeof t == "boolean" ? "" : t) : e.margin = n));
	}
	function Dp(e, t, n) {
		return n = n.ownerDocument.defaultView, {
			rect: e,
			abs: t.position === "absolute" || t.position === "fixed",
			clip: t.clipPath !== "none" || t.overflow !== "visible" || t.filter !== "none" || t.mask !== "none" || t.mask !== "none" || t.borderRadius !== "0px",
			view: 0 <= e.bottom && 0 <= e.right && e.top <= n.innerHeight && e.left <= n.innerWidth
		};
	}
	function Op(e) {
		return Dp(e.getBoundingClientRect(), getComputedStyle(e), e);
	}
	function kp(e) {
		var t = e.getBoundingClientRect();
		t = new DOMRect(t.x + 2e4, t.y + 2e4, t.width, t.height);
		var n = getComputedStyle(e);
		return Dp(t, n, e);
	}
	function Ap(e) {
		return e.documentElement.clientHeight;
	}
	function jp(e) {
		this.addEventListener("load", e), this.addEventListener("error", e);
	}
	function Mp(e, t, n, r, i, a, o, s, c) {
		var l = t.nodeType === 9 ? t : t.ownerDocument;
		try {
			var u = l.startViewTransition({
				update: function() {
					var t = l.defaultView, n = t.navigation && t.navigation.transition, o = l.fonts.status;
					r();
					var s = [];
					if (o === "loaded" && (Ap(l), l.fonts.status === "loading" && s.push(l.fonts.ready)), o = s.length, e !== null) for (var c = e.suspenseyImages, u = 0, d = 0; d < c.length; d++) {
						var f = c[d];
						if (!f.complete) {
							var p = f.getBoundingClientRect();
							if (0 < p.bottom && 0 < p.right && p.top < t.innerHeight && p.left < t.innerWidth) {
								if (u += Xm(f), u > $m) {
									s.length = o;
									break;
								}
								f = new Promise(jp.bind(f)), s.push(f);
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
	function Np(e, t) {
		this._scope = document.documentElement, this._selector = "::view-transition-" + e + "(" + t + ")";
	}
	Np.prototype.animate = function(e, t) {
		return t = typeof t == "number" ? { duration: t } : w({}, t), t.pseudoElement = this._selector, this._scope.animate(e, t);
	}, Np.prototype.getAnimations = function() {
		for (var e = this._scope, t = this._selector, n = e.getAnimations({ subtree: !0 }), r = [], i = 0; i < n.length; i++) {
			var a = n[i].effect;
			a !== null && a.target === e && a.pseudoElement === t && r.push(n[i]);
		}
		return r;
	}, Np.prototype.getComputedStyle = function() {
		return getComputedStyle(this._scope, this._selector);
	};
	function Pp(e) {
		return {
			name: e,
			group: new Np("group", e),
			imagePair: new Np("image-pair", e),
			old: new Np("old", e),
			new: new Np("new", e)
		};
	}
	function Fp(e) {
		this._fragmentFiber = e, this._observers = this._eventListeners = null;
	}
	Fp.prototype.addEventListener = function(e, t, n) {
		var r = null, i = null;
		if (!(n != null && typeof n != "boolean" && (r = n.signal || null, r !== null && r.aborted))) {
			this._eventListeners === null && (this._eventListeners = []);
			var a = this._eventListeners;
			if (Bp(a, e, t, n) === -1) {
				var o = this, s = t;
				n != null && typeof n != "boolean" && !0 === n.once && (s = function(r) {
					o.removeEventListener(e, t, n), typeof t == "function" ? t.call(this, r) : t.handleEvent(r);
				}), r !== null && (i = o.removeEventListener.bind(o, e, t, n), r.addEventListener("abort", i, { once: !0 }), i = r.removeEventListener.bind(r, "abort", i)), r = Rp(n), a.push({
					type: e,
					listener: t,
					optionsOrUseCapture: n,
					attachedListener: s,
					cleanup: i
				}), h(this._fragmentFiber.child, !1, Ip, e, s, r);
			}
			this._eventListeners = a;
		}
	};
	function Ip(e, t, n, r) {
		return b(e).addEventListener(t, n, r), !1;
	}
	Fp.prototype.removeEventListener = function(e, t, n) {
		var r = this._eventListeners;
		if (r !== null && (t = Bp(r, e, t, n), t !== -1)) {
			var i = r[t];
			n = i.attachedListener;
			var a = i.cleanup;
			i = Rp(i.optionsOrUseCapture), h(this._fragmentFiber.child, !1, Lp, e, n, i), r.splice(t, 1), a !== null && a();
		}
	};
	function Lp(e, t, n, r) {
		return b(e).removeEventListener(t, n, r), !1;
	}
	function Rp(e) {
		return e != null && typeof e != "boolean" && (!0 === e.once || e.signal instanceof AbortSignal) ? {
			capture: e.capture,
			passive: e.passive
		} : e;
	}
	function zp(e) {
		return e == null ? "c=0" : typeof e == "boolean" ? "c=" + (e ? "1" : "0") : "c=" + (e.capture ? "1" : "0");
	}
	function Bp(e, t, n, r) {
		if (e.length === 0) return -1;
		r = zp(r);
		for (var i = 0; i < e.length; i++) {
			var a = e[i];
			if (a.type === t && a.listener === n && zp(a.optionsOrUseCapture) === r) return i;
		}
		return -1;
	}
	Fp.prototype.dispatchEvent = function(e) {
		var t = g(this._fragmentFiber);
		if (t === null) return !0;
		t = b(t);
		var n = this._eventListeners;
		if (n !== null && 0 < n.length || !e.bubbles) {
			var r = t.nodeType === 9 ? t.createComment("") : document.createTextNode("");
			if (n) for (var i = 0; i < n.length; i++) {
				var a = n[i];
				r.addEventListener(a.type, a.attachedListener, Rp(a.optionsOrUseCapture));
			}
			if (t.appendChild(r), e = r.dispatchEvent(e), n) for (i = 0; i < n.length; i++) a = n[i], r.removeEventListener(a.type, a.attachedListener, Rp(a.optionsOrUseCapture));
			return t.removeChild(r), e;
		}
		return t.dispatchEvent(e);
	}, Fp.prototype.focus = function(e) {
		h(this._fragmentFiber.child, !0, Vp, e, void 0, void 0);
	};
	function Vp(e, t) {
		return e.tag !== 6 && (e = b(e), pm(e, t));
	}
	Fp.prototype.focusLast = function(e) {
		var t = [];
		h(this._fragmentFiber.child, !0, Hp, t, void 0, void 0);
		for (var n = t.length - 1; 0 <= n && !Vp(t[n], e); n--);
	};
	function Hp(e, t) {
		return t.push(e), !1;
	}
	Fp.prototype.blur = function() {
		var e = g(this._fragmentFiber);
		e !== null && (e = b(e), e = lp(e).activeElement, e !== null && h(this._fragmentFiber.child, !1, Up, e, void 0, void 0));
	};
	function Up(e, t) {
		return e.tag !== 6 && (e = b(e), e === t || e.contains(t) ? (t.blur(), !0) : !1);
	}
	Fp.prototype.observeUsing = function(e) {
		this._observers === null && (this._observers = /* @__PURE__ */ new Set()), this._observers.add(e), h(this._fragmentFiber.child, !1, Wp, e, void 0, void 0);
	};
	function Wp(e, t) {
		return e.tag !== 6 && (e = b(e), t.observe(e), !1);
	}
	Fp.prototype.unobserveUsing = function(e) {
		var t = this._observers;
		if (t !== null && t.has(e)) {
			t.delete(e), h(this._fragmentFiber.child, !1, Gp, e, void 0, void 0);
			for (var n = t = 0; n < Kp.length; n++) {
				var r = Kp[n];
				r.fragmentInstance === this && r.observer === e ? e.unobserve(r.instance) : Kp[t++] = r;
			}
			Kp.length = t;
		}
	};
	function Gp(e, t) {
		return e.tag !== 6 && (e = b(e), t.unobserve(e), !1);
	}
	var Kp = [], qp = !1;
	function Jp(e, t, n) {
		Kp.push({
			fragmentInstance: e,
			observer: t,
			instance: n
		}), qp || (qp = !0, mm(function() {
			qp = !1;
			var e = Kp;
			Kp = [];
			for (var t = 0; t < e.length; t++) {
				var n = e[t];
				n.observer.unobserve(n.instance);
			}
		}));
	}
	Fp.prototype.getClientRects = function() {
		var e = [];
		return h(this._fragmentFiber.child, !1, Yp, e, void 0, void 0), e;
	};
	function Yp(e, t) {
		if (e.tag === 6) {
			e = e.stateNode;
			var n = e.ownerDocument.createRange();
			n.selectNodeContents(e), t.push.apply(t, n.getClientRects());
		} else e = b(e), t.push.apply(t, e.getClientRects());
		return !1;
	}
	Fp.prototype.getRootNode = function(e) {
		var t = g(this._fragmentFiber);
		return t === null ? this : b(t).getRootNode(e);
	}, Fp.prototype.compareDocumentPosition = function(e) {
		var t = g(this._fragmentFiber);
		if (t === null) return Node.DOCUMENT_POSITION_DISCONNECTED;
		var n = [];
		h(this._fragmentFiber.child, !1, Hp, n, void 0, void 0);
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
		return s = r && a && o & Node.DOCUMENT_POSITION_FOLLOWING && s & Node.DOCUMENT_POSITION_PRECEDING, t = r && t === e || a && i === e || c || s ? Node.DOCUMENT_POSITION_CONTAINED_BY : !r && t === e || !a && i === e ? Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC : o, t & Node.DOCUMENT_POSITION_DISCONNECTED || t & Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC || Xp(t, this._fragmentFiber, n[0], n[n.length - 1], e) ? t : Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC;
	};
	function Xp(e, t, n, r, i) {
		var a = zt(i);
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
		return e & Node.DOCUMENT_POSITION_PRECEDING ? ((t = !!a) && !(t = a === n) && (t = ne(n, a, C), t === null ? t = !1 : (h(t, !0, ee, a, n), a = x, x = null, t = a !== null)), t) : e & Node.DOCUMENT_POSITION_FOLLOWING ? ((t = !!a) && !(t = a === r) && (t = ne(r, a, C), t === null ? t = !1 : (h(t, !0, te, a, r), a = x, S = x = null, t = a !== null)), t) : !1;
	}
	function Zp(e, t) {
		var n = e.ownerDocument.createRange();
		n.selectNodeContents(e), e = n.getBoundingClientRect(), window.scrollTo(window.scrollX + e.left, t ? window.scrollY + e.top : window.scrollY + e.bottom - window.innerHeight);
	}
	Fp.prototype.scrollIntoView = function(e) {
		if (typeof e == "object") throw Error(s(566));
		var t = [];
		h(this._fragmentFiber.child, !1, Hp, t, void 0, void 0);
		var n = !1 !== e;
		if (t.length === 0) {
			var r = v(this._fragmentFiber);
			if (r = n ? r[1] || r[0] || g(this._fragmentFiber) : r[0] || r[1], r === null) return;
			if (r.tag === 6) {
				e = b(r), Zp(e, n);
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
			i.tag === 6 ? (i = b(i), Zp(i, n)) : b(i).scrollIntoView(e), r += n ? -1 : 1;
		}
	};
	function Qp(e, t) {
		return e = b(e), $p(e, t), !1;
	}
	function $p(e, t) {
		e.reactFragments ??= /* @__PURE__ */ new Set(), e.reactFragments.add(t);
	}
	function em(e, t) {
		var n = t._eventListeners;
		if (n !== null) for (var r = 0; r < n.length; r++) {
			var i = n[r];
			e.addEventListener(i.type, i.attachedListener, Rp(i.optionsOrUseCapture));
		}
		e.nodeType !== 3 && (n = t._observers, n !== null && n.forEach(function(n) {
			for (var r = 0, i = 0; i < Kp.length; i++) {
				var a = Kp[i];
				(a.fragmentInstance !== t || a.observer !== n || a.instance !== e) && (Kp[r++] = a);
			}
			Kp.length = r, n.observe(e);
		}), $p(e, t));
	}
	function tm(e, t) {
		var n = t._eventListeners;
		if (n !== null) for (var r = 0; r < n.length; r++) {
			var i = n[r];
			e.removeEventListener(i.type, i.attachedListener, Rp(i.optionsOrUseCapture));
		}
		e.nodeType !== 3 && (n = t._observers, n !== null && n.forEach(function(n) {
			typeof n.rootMargin == "string" ? Jp(t, n, e) : n.unobserve(e);
		}), e.reactFragments != null && e.reactFragments.delete(t));
	}
	function nm(e) {
		var t = e.firstChild;
		for (t && t.nodeType === 10 && (t = t.nextSibling); t;) {
			var n = t;
			switch (t = t.nextSibling, n.nodeName) {
				case "HTML":
				case "HEAD":
				case "BODY":
					nm(n), Rt(n);
					continue;
				case "SCRIPT":
				case "STYLE": continue;
				case "LINK": if (n.rel.toLowerCase() === "stylesheet") continue;
			}
			e.removeChild(n);
		}
	}
	function rm(e, t, n, r) {
		for (; e.nodeType === 1;) {
			var i = n;
			if (e.nodeName.toLowerCase() !== t.toLowerCase()) {
				if (!r && (e.nodeName !== "INPUT" || e.type !== "hidden")) break;
			} else if (!r) {
				if (t === "input" && e.type === "hidden") {
					var a = i.name == null ? null : "" + i.name;
					if (i.type === "hidden" && e.getAttribute("name") === a) return e;
				} else return e;
			} else if (!e[It]) switch (t) {
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
			if (e = lm(e.nextSibling), e === null) break;
		}
		return null;
	}
	function im(e, t, n) {
		if (t === "") return null;
		for (; e.nodeType !== 3;) if ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") && !n || (e = lm(e.nextSibling), e === null)) return null;
		return e;
	}
	function am(e, t) {
		for (; e.nodeType !== 8;) if ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") && !t || (e = lm(e.nextSibling), e === null)) return null;
		return e;
	}
	function om(e) {
		return e.data === "$?" || e.data === "$~";
	}
	function sm(e) {
		return e.data === "$!" || e.data === "$?" && e.ownerDocument.readyState !== "loading";
	}
	function cm(e, t) {
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
	function lm(e) {
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
	var um = null;
	function dm(e) {
		e = e.nextSibling;
		for (var t = 0; e;) {
			if (e.nodeType === 8) {
				var n = e.data;
				if (n === "/$" || n === "/&") {
					if (t === 0) return lm(e.nextSibling);
					t--;
				} else n !== "$" && n !== "$!" && n !== "$?" && n !== "$~" && n !== "&" || t++;
			}
			e = e.nextSibling;
		}
		return null;
	}
	function fm(e) {
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
	function pm(e, t) {
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
	function mm(e) {
		yp(function() {
			yp(function(t) {
				return e(t);
			});
		});
	}
	function hm(e, t, n) {
		switch (t = lp(n), e) {
			case "html":
				if (e = t.documentElement, !e) throw Error(s(452));
				return e;
			case "head":
				if (e = t.head, !e) throw Error(s(453));
				return e;
			case "body":
				if (e = t.body, !e) throw Error(s(454));
				return e;
			default: throw Error(s(451));
		}
	}
	function gm(e, t, n) {
		for (var r in n) {
			var i = n[r];
			n.hasOwnProperty(r) && i != null && $(e, t, r, null, rp, i);
		}
		n.dangerouslySetInnerHTML != null && (e.textContent = ""), e.onclick === wn && (e.onclick = null), Rt(e);
	}
	function _m(e) {
		for (var t = e.attributes; t.length;) e.removeAttributeNode(t[0]);
		Rt(e);
	}
	var vm = /* @__PURE__ */ new Map(), ym = /* @__PURE__ */ new Set();
	function bm(e) {
		if (typeof e.getRootNode == "function") {
			var t = e.getRootNode();
			if (t.nodeType === 9 || t.nodeType === 11) return t;
		}
		return e.nodeType === 9 ? e : e.ownerDocument;
	}
	var xm = k.d;
	k.d = {
		f: Sm,
		r: Cm,
		D: Em,
		C: Dm,
		L: Om,
		m: km,
		X: jm,
		S: Am,
		M: Mm
	};
	function Sm() {
		var e = xm.f(), t = zd();
		return e || t;
	}
	function Cm(e) {
		var t = Bt(e);
		t !== null && t.tag === 5 && t.type === "form" ? nc(t) : xm.r(e);
	}
	var wm = typeof document > "u" ? null : document;
	function Tm(e, t, n) {
		var r = wm;
		if (r && typeof t == "string" && t) {
			var i = ln(t);
			i = "link[rel=\"" + e + "\"][href=\"" + i + "\"]", typeof n == "string" && (i += "[crossorigin=\"" + n + "\"]"), ym.has(i) || (ym.add(i), e = {
				rel: e,
				crossOrigin: n,
				href: t
			}, r.querySelector(i) === null && (t = r.createElement("link"), np(t, "link", e), Ut(t), r.head.appendChild(t)));
		}
	}
	function Em(e) {
		xm.D(e), Tm("dns-prefetch", e, null);
	}
	function Dm(e, t) {
		xm.C(e, t), Tm("preconnect", e, t);
	}
	function Om(e, t, n) {
		xm.L(e, t, n);
		var r = wm;
		if (r && e && t) {
			var i = "link[rel=\"preload\"][as=\"" + ln(t) + "\"]";
			t === "image" && n && n.imageSrcSet ? (i += "[imagesrcset=\"" + ln(n.imageSrcSet) + "\"]", typeof n.imageSizes == "string" && (i += "[imagesizes=\"" + ln(n.imageSizes) + "\"]")) : i += "[href=\"" + ln(e) + "\"]";
			var a = i;
			switch (t) {
				case "style":
					a = Pm(e);
					break;
				case "script": a = Rm(e);
			}
			if (!(vm.has(a) || (e = w({
				rel: "preload",
				href: t === "image" && n && n.imageSrcSet ? void 0 : e,
				as: t
			}, n), vm.set(a, e), r.querySelector(i) !== null || t === "style" && r.querySelector(Fm(a)) || t === "script" && r.querySelector(zm(a))))) {
				var o = r.createElement("link");
				np(o, "link", e), t === "style" && (o[Lt] = !0, o.onload = o.onerror = function() {
					Wt(o);
				}), Ut(o), r.head.appendChild(o);
			}
		}
	}
	function km(e, t) {
		xm.m(e, t);
		var n = wm;
		if (n && e) {
			var r = t && typeof t.as == "string" ? t.as : "script", i = "link[rel=\"modulepreload\"][as=\"" + ln(r) + "\"][href=\"" + ln(e) + "\"]", a = i;
			switch (r) {
				case "audioworklet":
				case "paintworklet":
				case "serviceworker":
				case "sharedworker":
				case "worker":
				case "script": a = Rm(e);
			}
			if (!vm.has(a) && (e = w({
				rel: "modulepreload",
				href: e
			}, t), vm.set(a, e), n.querySelector(i) === null)) {
				switch (r) {
					case "audioworklet":
					case "paintworklet":
					case "serviceworker":
					case "sharedworker":
					case "worker":
					case "script": if (n.querySelector(zm(a))) return;
				}
				r = n.createElement("link"), np(r, "link", e), Ut(r), n.head.appendChild(r);
			}
		}
	}
	function Am(e, t, n) {
		xm.S(e, t, n);
		var r = wm;
		if (r && e) {
			var i = Ht(r).hoistableStyles, a = Pm(e);
			t ||= "default";
			var o = i.get(a);
			if (!o) {
				var s = {
					loading: 0,
					preload: null
				};
				if (o = r.querySelector(Fm(a))) s.loading = 5;
				else {
					e = w({
						rel: "stylesheet",
						href: e,
						"data-precedence": t
					}, n), (n = vm.get(a)) && Hm(e, n);
					var c = o = r.createElement("link");
					Ut(c), np(c, "link", e), c._p = new Promise(function(e, t) {
						c.onload = e, c.onerror = t;
					}), c.addEventListener("load", function() {
						s.loading |= 1;
					}), c.addEventListener("error", function() {
						s.loading |= 2;
					}), s.loading |= 4, Vm(o, t, r);
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
	function jm(e, t) {
		xm.X(e, t);
		var n = wm;
		if (n && e) {
			var r = Ht(n).hoistableScripts, i = Rm(e), a = r.get(i);
			a || (a = n.querySelector(zm(i)), a || (e = w({
				src: e,
				async: !0
			}, t), (t = vm.get(i)) && Um(e, t), a = n.createElement("script"), Ut(a), np(a, "link", e), n.head.appendChild(a)), a = {
				type: "script",
				instance: a,
				count: 1,
				state: null
			}, r.set(i, a));
		}
	}
	function Mm(e, t) {
		xm.M(e, t);
		var n = wm;
		if (n && e) {
			var r = Ht(n).hoistableScripts, i = Rm(e), a = r.get(i);
			a || (a = n.querySelector(zm(i)), a || (e = w({
				src: e,
				async: !0,
				type: "module"
			}, t), (t = vm.get(i)) && Um(e, t), a = n.createElement("script"), Ut(a), np(a, "link", e), n.head.appendChild(a)), a = {
				type: "script",
				instance: a,
				count: 1,
				state: null
			}, r.set(i, a));
		}
	}
	function Nm(e, t, n, r) {
		var i = (i = ke.current) ? bm(i) : null;
		if (!i) throw Error(s(446));
		switch (e) {
			case "meta":
			case "title": return null;
			case "style": return typeof n.precedence == "string" && typeof n.href == "string" ? (n = Pm(n.href), t = Ht(i).hoistableStyles, r = t.get(n), r || (r = {
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
					e = Pm(n.href);
					var a = Ht(i).hoistableStyles, o = a.get(e);
					if (o || (i = i.ownerDocument || i, o = {
						type: "stylesheet",
						instance: null,
						count: 0,
						state: {
							loading: 0,
							preload: null
						}
					}, a.set(e, o), (a = i.querySelector(Fm(e))) ? a._p || (o.instance = a, o.state.loading = 5) : (a = vm.get(e), a || (a = {
						rel: "preload",
						as: "style",
						href: n.href,
						crossOrigin: n.crossOrigin,
						integrity: n.integrity,
						media: n.media,
						hrefLang: n.hrefLang,
						referrerPolicy: n.referrerPolicy
					}, vm.set(e, a)), Lm(i, e, a, o.state))), t && r === null) throw Error(s(528, ""));
					return o;
				}
				if (t && r !== null) throw Error(s(529, ""));
				return null;
			case "script": return t = n.async, n = n.src, typeof n == "string" && t && typeof t != "function" && typeof t != "symbol" ? (n = Rm(n), t = Ht(i).hoistableScripts, r = t.get(n), r || (r = {
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
			default: throw Error(s(444, e));
		}
	}
	function Pm(e) {
		return "href=\"" + ln(e) + "\"";
	}
	function Fm(e) {
		return "link[rel=\"stylesheet\"][" + e + "]";
	}
	function Im(e) {
		return w({}, e, {
			"data-precedence": e.precedence,
			precedence: null
		});
	}
	function Lm(e, t, n, r) {
		if (t = e.querySelector("link[rel=\"preload\"][as=\"style\"][" + t + "]")) {
			if (!0 !== t[Lt]) {
				r.loading = 1;
				return;
			}
		} else t = e.createElement("link"), t[Lt] = !0, t.onload = t.onerror = Wt.bind(null, t), np(t, "link", n), Ut(t), e.head.appendChild(t);
		r.preload = t, t.addEventListener("load", function() {
			return r.loading |= 1;
		}), t.addEventListener("error", function() {
			return r.loading |= 2;
		});
	}
	function Rm(e) {
		return "[src=\"" + ln(e) + "\"]";
	}
	function zm(e) {
		return "script[async]" + e;
	}
	function Bm(e, t, n) {
		if (t.count++, t.instance === null) switch (t.type) {
			case "style":
				var r = e.querySelector("style[data-href~=\"" + ln(n.href) + "\"]");
				if (r) return t.instance = r, Ut(r), r;
				var i = w({}, n, {
					"data-href": n.href,
					"data-precedence": n.precedence,
					href: null,
					precedence: null
				});
				return r = (e.ownerDocument || e).createElement("style"), Ut(r), np(r, "style", i), Vm(r, n.precedence, e), t.instance = r;
			case "stylesheet":
				i = Pm(n.href);
				var a = e.querySelector(Fm(i));
				if (a) return t.state.loading |= 4, t.instance = a, Ut(a), a;
				r = Im(n), (i = vm.get(i)) && Hm(r, i), a = (e.ownerDocument || e).createElement("link"), Ut(a);
				var o = a;
				return o._p = new Promise(function(e, t) {
					o.onload = e, o.onerror = t;
				}), np(a, "link", r), t.state.loading |= 4, Vm(a, n.precedence, e), t.instance = a;
			case "script": return a = Rm(n.src), (i = e.querySelector(zm(a))) ? (t.instance = i, Ut(i), i) : (r = n, (i = vm.get(a)) && (r = w({}, n), Um(r, i)), e = e.ownerDocument || e, i = e.createElement("script"), Ut(i), np(i, "link", r), e.head.appendChild(i), t.instance = i);
			case "void": return null;
			default: throw Error(s(443, t.type));
		}
		else t.type === "stylesheet" && !(t.state.loading & 4) && (r = t.instance, t.state.loading |= 4, Vm(r, n.precedence, e));
		return t.instance;
	}
	function Vm(e, t, n) {
		for (var r = n.querySelectorAll("link[rel=\"stylesheet\"][data-precedence],style[data-precedence]"), i = r.length ? r[r.length - 1] : null, a = i, o = 0; o < r.length; o++) {
			var s = r[o];
			if (s.dataset.precedence === t) a = s;
			else if (a !== i) break;
		}
		a ? a.parentNode.insertBefore(e, a.nextSibling) : (t = n.nodeType === 9 ? n.head : n, t.insertBefore(e, t.firstChild));
	}
	function Hm(e, t) {
		e.crossOrigin ??= t.crossOrigin, e.referrerPolicy ??= t.referrerPolicy, e.title ??= t.title;
	}
	function Um(e, t) {
		e.crossOrigin ??= t.crossOrigin, e.referrerPolicy ??= t.referrerPolicy, e.integrity ??= t.integrity;
	}
	var Wm = null;
	function Gm(e, t, n) {
		if (Wm === null) {
			var r = /* @__PURE__ */ new Map(), i = Wm = /* @__PURE__ */ new Map();
			i.set(n, r);
		} else i = Wm, r = i.get(n), r || (r = /* @__PURE__ */ new Map(), i.set(n, r));
		if (r.has(e)) return r;
		for (r.set(e, null), n = n.getElementsByTagName(e), i = 0; i < n.length; i++) {
			var a = n[i];
			if (!(a[It] || a[kt] || e === "link" && a.getAttribute("rel") === "stylesheet") && a.namespaceURI !== "http://www.w3.org/2000/svg") {
				var o = a.getAttribute(t) || "";
				o = e + o;
				var s = r.get(o);
				s ? s.push(a) : r.set(o, [a]);
			}
		}
		return r;
	}
	function Km(e, t, n) {
		e = e.ownerDocument || e, e.head.insertBefore(n, t === "title" ? e.querySelector("head > title") : null);
	}
	function qm(e, t, n) {
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
	function Jm(e, t) {
		return e === "img" && t.src != null && t.src !== "" && t.onLoad == null && t.loading !== "lazy";
	}
	function Ym(e) {
		return !(e.type === "stylesheet" && !(e.state.loading & 3));
	}
	function Xm(e) {
		return (e.width || 100) * (e.height || 100) * (typeof devicePixelRatio == "number" ? devicePixelRatio : 1) * .25;
	}
	function Zm(e, t) {
		typeof t.decode == "function" && (e.imgCount++, t.complete || (e.imgBytes += Xm(t), e.suspenseyImages.push(t)), e = rh.bind(e), t.decode().then(e, e));
	}
	function Qm(e, t, n, r) {
		if (n.type === "stylesheet" && (typeof r.media != "string" || !1 !== matchMedia(r.media).matches) && !(n.state.loading & 4)) {
			if (n.instance === null) {
				var i = Pm(r.href), a = t.querySelector(Fm(i));
				if (a) {
					t = a._p, typeof t == "object" && t && typeof t.then == "function" && (e.count++, e = nh.bind(e), t.then(e, e)), n.state.loading |= 4, n.instance = a, Ut(a);
					return;
				}
				a = t.ownerDocument || t, r = Im(r), (i = vm.get(i)) && Hm(r, i), a = a.createElement("link"), Ut(a);
				var o = a;
				o._p = new Promise(function(e, t) {
					o.onload = e, o.onerror = t;
				}), np(a, "link", r), n.instance = a;
			}
			e.stylesheets === null && (e.stylesheets = /* @__PURE__ */ new Map()), e.stylesheets.set(n, t), (t = n.state.preload) && !(n.state.loading & 3) && (e.count++, n = nh.bind(e), t.addEventListener("load", n), t.addEventListener("error", n));
		}
	}
	var $m = 0;
	function eh(e, t) {
		return e.stylesheets && e.count === 0 && ah(e, e.stylesheets), 0 < e.count || 0 < e.imgCount ? function(n) {
			var r = setTimeout(function() {
				if (e.stylesheets && ah(e, e.stylesheets), e.unsuspend) {
					var t = e.unsuspend;
					e.unsuspend = null, t();
				}
			}, 6e4 + t);
			0 < e.imgBytes && $m === 0 && ($m = 62500 * op());
			var i = setTimeout(function() {
				if (e.waitingForImages = !1, e.count === 0 && (e.stylesheets && ah(e, e.stylesheets), e.unsuspend)) {
					var t = e.unsuspend;
					e.unsuspend = null, t();
				}
			}, (e.imgBytes > $m ? 50 : 800) + t);
			return e.unsuspend = n, function() {
				e.unsuspend = null, clearTimeout(r), clearTimeout(i);
			};
		} : null;
	}
	function th(e) {
		if (e.count === 0 && (e.imgCount === 0 || !e.waitingForImages)) {
			if (e.stylesheets) ah(e, e.stylesheets);
			else if (e.unsuspend) {
				var t = e.unsuspend;
				e.unsuspend = null, t();
			}
		}
	}
	function nh() {
		this.count--, th(this);
	}
	function rh() {
		this.imgCount--, th(this);
	}
	var ih = null;
	function ah(e, t) {
		e.stylesheets = null, e.unsuspend !== null && (e.count++, ih = /* @__PURE__ */ new Map(), t.forEach(oh, e), ih = null, nh.call(e));
	}
	function oh(e, t) {
		if (!(t.state.loading & 4)) {
			var n = ih.get(e);
			if (n) var r = n.get(null);
			else {
				n = /* @__PURE__ */ new Map(), ih.set(e, n);
				for (var i = e.querySelectorAll("link[data-precedence],style[data-precedence]"), a = 0; a < i.length; a++) {
					var o = i[a];
					(o.nodeName === "LINK" || o.getAttribute("media") !== "not all") && (n.set(o.dataset.precedence, o), r = o);
				}
				r && n.set(null, r);
			}
			i = t.instance, o = i.getAttribute("data-precedence"), a = n.get(o) || r, a === r && n.set(null, i), n.set(o, i), this.count++, r = nh.bind(this), i.addEventListener("load", r), i.addEventListener("error", r), a ? a.parentNode.insertBefore(i, a.nextSibling) : (e = e.nodeType === 9 ? e.head : e, e.insertBefore(i, e.firstChild)), t.state.loading |= 4;
		}
	}
	var sh = {
		$$typeof: le,
		Provider: null,
		Consumer: null,
		_currentValue: Ce,
		_currentValue2: Ce,
		_threadCount: 0
	};
	function ch(e, t, n, r, i, a, o, s, c) {
		this.tag = 1, this.containerInfo = e, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = vt(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = vt(0), this.hiddenUpdates = vt(null), this.identifierPrefix = r, this.onUncaughtError = i, this.onCaughtError = a, this.onRecoverableError = o, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = c, this.transitionTypes = null, this.incompleteTransitions = /* @__PURE__ */ new Map();
	}
	function lh(e, t, n, r, i, a, o, s, c, l, u, d) {
		return e = new ch(e, t, n, o, c, l, u, d, s), t = 1, !0 === a && (t |= 24), a = Ii(3, null, null, t), e.current = a, a.stateNode = e, t = Fa(), t.refCount++, e.pooledCache = t, t.refCount++, a.memoizedState = {
			element: r,
			isDehydrated: n,
			cache: t
		}, ho(a), e;
	}
	function uh(e) {
		return e ? (e = Pi, e) : Pi;
	}
	function dh(e, t, n, r, i, a) {
		i = uh(i), r.context === null ? r.context = i : r.pendingContext = i, r = _o(t), r.payload = { element: n }, a = a === void 0 ? null : a, a !== null && (r.callback = a), n = vo(e, r, t), n !== null && (Pd(n, e, t), yo(n, e, t));
	}
	function fh(e, t) {
		if (e = e.memoizedState, e !== null && e.dehydrated !== null) {
			var n = e.retryLane;
			e.retryLane = n !== 0 && n < t ? n : t;
		}
	}
	function ph(e, t) {
		fh(e, t), (e = e.alternate) && fh(e, t);
	}
	function mh(e) {
		if (e.tag === 13 || e.tag === 31) {
			var t = ji(e, 67108864);
			t !== null && Pd(t, e, 67108864), ph(e, 67108864);
		}
	}
	function hh(e) {
		if (e.tag === 13 || e.tag === 31) {
			var t = jd();
			t = wt(t);
			var n = ji(e, t);
			n !== null && Pd(n, e, t), ph(e, t);
		}
	}
	var gh = !0;
	function _h(e, t, n, r) {
		var i = O.T;
		O.T = null;
		var a = k.p;
		try {
			k.p = 2, yh(e, t, n, r);
		} finally {
			k.p = a, O.T = i;
		}
	}
	function vh(e, t, n, r) {
		var i = O.T;
		O.T = null;
		var a = k.p;
		try {
			k.p = 8, yh(e, t, n, r);
		} finally {
			k.p = a, O.T = i;
		}
	}
	function yh(e, t, n, r) {
		if (gh) {
			var i = bh(r);
			if (i === null) Kf(e, t, r, xh, n), Mh(e, r);
			else if (Ph(i, e, t, n, r)) r.stopPropagation();
			else if (Mh(e, r), t & 4 && -1 < jh.indexOf(e)) {
				for (; i !== null;) {
					var a = Bt(i);
					if (a !== null) switch (a.tag) {
						case 3:
							if (a = a.stateNode, a.current.memoizedState.isDehydrated) {
								var o = ft(a.pendingLanes);
								if (o !== 0) {
									var s = a;
									for (s.pendingLanes |= 2, s.entangledLanes |= 2; o;) {
										var c = 1 << 31 - at(o);
										s.entanglements[1] |= c, o &= ~c;
									}
									Ef(a), !(K & 6) && (gd = qe() + 500, Df(0, !1));
								}
							}
							break;
						case 31:
						case 13: s = ji(a, 2), s !== null && Pd(s, a, 2), zd(), ph(a, 2);
					}
					if (a = bh(r), a === null && Kf(e, t, r, xh, n), a === i) break;
					i = a;
				}
				i !== null && r.stopPropagation();
			} else Kf(e, t, r, null, n);
		}
	}
	function bh(e) {
		return e = En(e), Sh(e);
	}
	var xh = null;
	function Sh(e) {
		if (xh = null, e = zt(e), e !== null) {
			var t = l(e);
			if (t === null) e = null;
			else {
				var n = t.tag;
				if (n === 13) {
					if (e = u(t), e !== null) return e;
					e = null;
				} else if (n === 31) {
					if (e = d(t), e !== null) return e;
					e = null;
				} else if (n === 3) {
					if (t.stateNode.current.memoizedState.isDehydrated) return t.tag === 3 ? t.stateNode.containerInfo : null;
					e = null;
				} else t !== e && (e = null);
			}
		}
		return xh = e, null;
	}
	function Ch(e) {
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
			case "message": switch (Je()) {
				case Ye: return 2;
				case Xe: return 8;
				case Ze:
				case Qe: return 32;
				case $e: return 268435456;
				default: return 32;
			}
			default: return 32;
		}
	}
	var wh = !1, Th = null, Eh = null, Dh = null, Oh = /* @__PURE__ */ new Map(), kh = /* @__PURE__ */ new Map(), Ah = [], jh = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(" ");
	function Mh(e, t) {
		switch (e) {
			case "focusin":
			case "focusout":
				Th = null;
				break;
			case "dragenter":
			case "dragleave":
				Eh = null;
				break;
			case "mouseover":
			case "mouseout":
				Dh = null;
				break;
			case "pointerover":
			case "pointerout":
				Oh.delete(t.pointerId);
				break;
			case "gotpointercapture":
			case "lostpointercapture": kh.delete(t.pointerId);
		}
	}
	function Nh(e, t, n, r, i, a) {
		return e === null || e.nativeEvent !== a ? (e = {
			blockedOn: t,
			domEventName: n,
			eventSystemFlags: r,
			nativeEvent: a,
			targetContainers: [i]
		}, t !== null && (t = Bt(t), t !== null && mh(t)), e) : (e.eventSystemFlags |= r, t = e.targetContainers, i !== null && t.indexOf(i) === -1 && t.push(i), e);
	}
	function Ph(e, t, n, r, i) {
		switch (t) {
			case "focusin": return Th = Nh(Th, e, t, n, r, i), !0;
			case "dragenter": return Eh = Nh(Eh, e, t, n, r, i), !0;
			case "mouseover": return Dh = Nh(Dh, e, t, n, r, i), !0;
			case "pointerover":
				var a = i.pointerId;
				return Oh.set(a, Nh(Oh.get(a) || null, e, t, n, r, i)), !0;
			case "gotpointercapture": return a = i.pointerId, kh.set(a, Nh(kh.get(a) || null, e, t, n, r, i)), !0;
		}
		return !1;
	}
	function Fh(e) {
		var t = zt(e.target);
		if (t !== null) {
			var n = l(t);
			if (n !== null) {
				if (t = n.tag, t === 13) {
					if (t = u(n), t !== null) {
						e.blockedOn = t, Dt(e.priority, function() {
							hh(n);
						});
						return;
					}
				} else if (t === 31) {
					if (t = d(n), t !== null) {
						e.blockedOn = t, Dt(e.priority, function() {
							hh(n);
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
	function Ih(e) {
		if (e.blockedOn !== null) return !1;
		for (var t = e.targetContainers; 0 < t.length;) {
			var n = bh(e.nativeEvent);
			if (n === null) {
				n = e.nativeEvent;
				var r = new n.constructor(n.type, n);
				Tn = r, n.target.dispatchEvent(r), Tn = null;
			} else return t = Bt(n), t !== null && mh(t), e.blockedOn = n, !1;
			t.shift();
		}
		return !0;
	}
	function Lh(e, t, n) {
		Ih(e) && n.delete(t);
	}
	function Rh() {
		wh = !1, Th !== null && Ih(Th) && (Th = null), Eh !== null && Ih(Eh) && (Eh = null), Dh !== null && Ih(Dh) && (Dh = null), Oh.forEach(Lh), kh.forEach(Lh);
	}
	function zh(e, n) {
		e.blockedOn === n && (e.blockedOn = null, wh || (wh = !0, t.unstable_scheduleCallback(t.unstable_NormalPriority, Rh)));
	}
	var Bh = null;
	function Vh(e) {
		Bh !== e && (Bh = e, t.unstable_scheduleCallback(t.unstable_NormalPriority, function() {
			Bh === e && (Bh = null);
			for (var t = 0; t < e.length; t += 3) {
				var n = e[t], r = e[t + 1], i = e[t + 2];
				if (typeof r != "function") {
					if (Sh(r || n) === null) continue;
					break;
				}
				var a = Bt(n);
				a !== null && (e.splice(t, 3), t -= 3, ec(a, {
					pending: !0,
					data: i,
					method: n.method,
					action: r
				}, r, i));
			}
		}));
	}
	function Hh(e) {
		function t(t) {
			return zh(t, e);
		}
		Th !== null && zh(Th, e), Eh !== null && zh(Eh, e), Dh !== null && zh(Dh, e), Oh.forEach(t), kh.forEach(t);
		for (var n = 0; n < Ah.length; n++) {
			var r = Ah[n];
			r.blockedOn === e && (r.blockedOn = null);
		}
		for (; 0 < Ah.length && (n = Ah[0], n.blockedOn === null);) Fh(n), n.blockedOn === null && Ah.shift();
		if (n = (e.ownerDocument || e).$$reactFormReplay, n != null) for (r = 0; r < n.length; r += 3) {
			var i = n[r], a = n[r + 1], o = i[At] || null;
			if (typeof a == "function") o || Vh(n);
			else if (o) {
				var s = null;
				if (a && a.hasAttribute("formAction")) {
					if (i = a, o = a[At] || null) s = o.formAction;
					else if (Sh(i) !== null) continue;
				} else s = o.action;
				typeof s == "function" ? n[r + 1] = s : (n.splice(r, 3), r -= 3), Vh(n);
			}
		}
	}
	function Uh() {
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
	function Wh(e) {
		this._internalRoot = e;
	}
	Gh.prototype.render = Wh.prototype.render = function(e) {
		var t = this._internalRoot;
		if (t === null) throw Error(s(409));
		var n = t.current;
		dh(n, jd(), e, t, null, null);
	}, Gh.prototype.unmount = Wh.prototype.unmount = function() {
		var e = this._internalRoot;
		if (e !== null) {
			this._internalRoot = null;
			var t = e.containerInfo;
			dh(e.current, 2, null, e, null, null), zd(), t[jt] = null;
		}
	};
	function Gh(e) {
		this._internalRoot = e;
	}
	Gh.prototype.unstable_scheduleHydration = function(e) {
		if (e) {
			var t = Et();
			e = {
				blockedOn: null,
				target: e,
				priority: t
			};
			for (var n = 0; n < Ah.length && t !== 0 && t < Ah[n].priority; n++);
			Ah.splice(n, 0, e), n === 0 && Fh(e);
		}
	};
	var Kh = r.version;
	if (Kh !== "19.3.0") throw Error(s(527, Kh, "19.3.0"));
	k.findDOMNode = function(e) {
		var t = e._reactInternals;
		if (t === void 0) throw typeof e.render == "function" ? Error(s(188)) : (e = Object.keys(e).join(","), Error(s(268, e)));
		return e = p(t), e = e === null ? null : m(e), e = e === null ? null : e.stateNode, e;
	};
	var qh = {
		bundleType: 0,
		version: "19.3.0",
		rendererPackageName: "react-dom",
		currentDispatcherRef: O,
		reconcilerVersion: "19.3.0"
	};
	if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
		var Jh = __REACT_DEVTOOLS_GLOBAL_HOOK__;
		if (!Jh.isDisabled && Jh.supportsFiber) try {
			nt = Jh.inject(qh), rt = Jh;
		} catch {}
	}
	e.createRoot = function(e, t) {
		if (!c(e)) throw Error(s(299));
		var n = !1, r = "", i = Cc, a = wc, o = Tc;
		return t != null && (!0 === t.unstable_strictMode && (n = !0), t.identifierPrefix !== void 0 && (r = t.identifierPrefix), t.onUncaughtError !== void 0 && (i = t.onUncaughtError), t.onCaughtError !== void 0 && (a = t.onCaughtError), t.onRecoverableError !== void 0 && (o = t.onRecoverableError)), t = lh(e, 1, !1, null, null, n, r, null, i, a, o, Uh), e[jt] = t.current, Wf(e), new Wh(t);
	};
})), c = /* @__PURE__ */ e(((e, t) => {
	function n() {
		if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE == "function") try {
			__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n);
		} catch (e) {
			console.error(e);
		}
	}
	n(), t.exports = s();
})), l = n(), u = c(), d = Symbol.for("@supabase/supabase-js.traceContextExtractor");
function f() {
	return globalThis[d];
}
//#endregion
//#region ../social-media-generator/node_modules/tslib/tslib.es6.mjs
function p(e, t) {
	var n = {};
	for (var r in e) Object.prototype.hasOwnProperty.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
	if (e != null && typeof Object.getOwnPropertySymbols == "function") for (var i = 0, r = Object.getOwnPropertySymbols(e); i < r.length; i++) t.indexOf(r[i]) < 0 && Object.prototype.propertyIsEnumerable.call(e, r[i]) && (n[r[i]] = e[r[i]]);
	return n;
}
function m(e, t, n, r) {
	function i(e) {
		return e instanceof n ? e : new n(function(t) {
			t(e);
		});
	}
	return new (n ||= Promise)(function(n, a) {
		function o(e) {
			try {
				c(r.next(e));
			} catch (e) {
				a(e);
			}
		}
		function s(e) {
			try {
				c(r.throw(e));
			} catch (e) {
				a(e);
			}
		}
		function c(e) {
			e.done ? n(e.value) : i(e.value).then(o, s);
		}
		c((r = r.apply(e, t || [])).next());
	});
}
//#endregion
//#region ../social-media-generator/node_modules/@supabase/functions-js/dist/module/helper.js
var h = (e) => e ? (...t) => e(...t) : (...e) => fetch(...e), g = class extends Error {
	constructor(e, t = "FunctionsError", n) {
		super(e), this.name = t, this.context = n;
	}
	toJSON() {
		return {
			name: this.name,
			message: this.message,
			context: this.context
		};
	}
}, _ = class extends g {
	constructor(e) {
		super("Failed to send a request to the Edge Function", "FunctionsFetchError", e);
	}
}, v = class extends g {
	constructor(e) {
		super("Relay Error invoking the Edge Function", "FunctionsRelayError", e);
	}
}, y = class extends g {
	constructor(e) {
		super("Edge Function returned a non-2xx status code", "FunctionsHttpError", e);
	}
}, b;
(function(e) {
	e.Any = "any", e.ApNortheast1 = "ap-northeast-1", e.ApNortheast2 = "ap-northeast-2", e.ApSouth1 = "ap-south-1", e.ApSoutheast1 = "ap-southeast-1", e.ApSoutheast2 = "ap-southeast-2", e.CaCentral1 = "ca-central-1", e.EuCentral1 = "eu-central-1", e.EuWest1 = "eu-west-1", e.EuWest2 = "eu-west-2", e.EuWest3 = "eu-west-3", e.SaEast1 = "sa-east-1", e.UsEast1 = "us-east-1", e.UsWest1 = "us-west-1", e.UsWest2 = "us-west-2";
})(b ||= {});
//#endregion
//#region ../social-media-generator/node_modules/@supabase/functions-js/dist/module/FunctionsClient.js
var x = class {
	constructor(e, { headers: t = {}, customFetch: n, region: r = b.Any } = {}) {
		this.url = e, this.headers = t, this.region = r, this.fetch = h(n);
	}
	setAuth(e) {
		this.headers.Authorization = `Bearer ${e}`;
	}
	invoke(e) {
		return m(this, arguments, void 0, function* (e, t = {}) {
			var n;
			let r, i, a;
			try {
				let { headers: n, method: o, body: s, signal: c, timeout: l } = t, u = {}, { region: d } = t;
				d ||= this.region;
				let f = new URL(`${this.url}/${e}`);
				d && d !== "any" && (u["x-region"] = d, f.searchParams.set("forceFunctionRegion", d));
				let p, m = !!n && Object.keys(n).some((e) => e.toLowerCase() === "content-type");
				s && !m ? typeof Blob < "u" && s instanceof Blob || s instanceof ArrayBuffer ? (u["Content-Type"] = "application/octet-stream", p = s) : typeof s == "string" ? (u["Content-Type"] = "text/plain", p = s) : typeof FormData < "u" && s instanceof FormData ? p = s : (u["Content-Type"] = "application/json", p = JSON.stringify(s)) : p = s && typeof s != "string" && !(typeof Blob < "u" && s instanceof Blob) && !(s instanceof ArrayBuffer) && !(typeof FormData < "u" && s instanceof FormData) ? JSON.stringify(s) : s;
				let h = c;
				l && (i = new AbortController(), r = setTimeout(() => i.abort(), l), c ? (h = i.signal, a = () => i.abort(), c.addEventListener("abort", a)) : h = i.signal);
				let g = yield this.fetch(f.toString(), {
					method: o || "POST",
					headers: Object.assign(Object.assign(Object.assign({}, u), this.headers), n),
					body: p,
					signal: h
				}).catch((e) => {
					throw new _(e);
				}), b = g.headers.get("x-relay-error");
				if (b && b === "true") throw new v(g);
				if (!g.ok) throw new y(g);
				let x = (g.headers.get("Content-Type") ?? "text/plain").split(";")[0].trim().toLowerCase(), S;
				return S = x === "application/json" ? yield g.json() : x === "application/octet-stream" || x === "application/pdf" ? yield g.blob() : x === "text/event-stream" ? g : x === "multipart/form-data" ? yield g.formData() : yield g.text(), {
					data: S,
					error: null,
					response: g
				};
			} catch (e) {
				return {
					data: null,
					error: e,
					response: e instanceof y || e instanceof v ? e.context : void 0
				};
			} finally {
				r && clearTimeout(r), a && ((n = t.signal) == null || n.removeEventListener("abort", a));
			}
		});
	}
}, S = class extends Error {
	constructor(e) {
		super(e.message), this.name = "PostgrestError", this.details = e.details, this.hint = e.hint, this.code = e.code;
	}
	toJSON() {
		return {
			name: this.name,
			message: this.message,
			details: this.details,
			hint: this.hint,
			code: this.code
		};
	}
}, ee = 3, te = (e) => Math.min(1e3 * 2 ** e, 3e4), C = [520, 503], ne = [
	"GET",
	"HEAD",
	"OPTIONS"
];
function w(e) {
	"@babel/helpers - typeof";
	return w = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, w(e);
}
function re(e, t) {
	if (w(e) != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (w(r) != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function ie(e) {
	var t = re(e, "string");
	return w(t) == "symbol" ? t : t + "";
}
function ae(e, t, n) {
	return (t = ie(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function oe(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function T(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? oe(Object(n), !0).forEach(function(t) {
			ae(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : oe(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function se(e, t) {
	return new Promise((n) => {
		if (t?.aborted) {
			n();
			return;
		}
		let r = setTimeout(() => {
			t?.removeEventListener("abort", i), n();
		}, e);
		function i() {
			clearTimeout(r), n();
		}
		t?.addEventListener("abort", i);
	});
}
function ce(e, t, n, r) {
	return !(!r || n >= ee || !ne.includes(e) || !C.includes(t));
}
async function le(e, t, n, r) {
	let i = 0;
	for (;;) {
		let a = T({}, n.headers);
		i > 0 && (a["X-Retry-Count"] = String(i));
		let o;
		try {
			o = await e(t, {
				method: n.method,
				headers: a,
				body: n.body,
				signal: n.signal
			});
		} catch (e) {
			if (e?.name === "AbortError" || e?.code === "ABORT_ERR" || !ne.includes(n.method)) throw e;
			if (r && i < ee) {
				let e = te(i);
				i++, await se(e, n.signal);
				continue;
			}
			throw e;
		}
		if (ce(n.method, o.status, i, r)) {
			let e = o.headers?.get("Retry-After") ?? null, t = e === null ? te(i) : Math.max(0, parseInt(e, 10) || 0) * 1e3;
			await o.text(), i++, await se(t, n.signal);
			continue;
		}
		return o;
	}
}
var ue = class {
	constructor(e) {
		this.shouldThrowOnError = !1, this.retryEnabled = !0, this.method = e.method, this.url = e.url, this.headers = new Headers(e.headers), this.schema = e.schema, this.body = e.body, this.shouldThrowOnError = e.shouldThrowOnError ?? !1, this.signal = e.signal, this.isMaybeSingle = e.isMaybeSingle ?? !1, this.shouldStripNulls = e.shouldStripNulls ?? !1, this.urlLengthLimit = e.urlLengthLimit ?? 8e3, this.retryEnabled = e.retry ?? !0, this.fetch = e.fetch ? e.fetch : fetch;
	}
	throwOnError() {
		return this.shouldThrowOnError = !0, this;
	}
	stripNulls() {
		if (this.headers.get("Accept") === "text/csv") throw Error("stripNulls() cannot be used with csv()");
		return this.shouldStripNulls = !0, this;
	}
	setHeader(e, t) {
		return this.headers = new Headers(this.headers), this.headers.set(e, t), this;
	}
	retry(e) {
		return this.retryEnabled = e, this;
	}
	then(e, t) {
		var n = this;
		if (this.schema === void 0 || (["GET", "HEAD"].includes(this.method) ? this.headers.set("Accept-Profile", this.schema) : this.headers.set("Content-Profile", this.schema)), this.method !== "GET" && this.method !== "HEAD" && this.headers.set("Content-Type", "application/json"), this.shouldStripNulls) {
			let e = this.headers.get("Accept");
			e === "application/vnd.pgrst.object+json" ? this.headers.set("Accept", "application/vnd.pgrst.object+json;nulls=stripped") : (!e || e === "application/json") && this.headers.set("Accept", "application/vnd.pgrst.array+json;nulls=stripped");
		}
		let r = this.fetch, i = (async () => {
			let e = {};
			n.headers.forEach((t, n) => {
				e[n] = t;
			});
			let t = await le(r, n.url.toString(), {
				method: n.method,
				headers: e,
				body: JSON.stringify(n.body, (e, t) => typeof t == "bigint" ? t.toString() : t),
				signal: n.signal
			}, n.retryEnabled);
			return await n.processResponse(t);
		})();
		return this.shouldThrowOnError || (i = i.catch((e) => {
			let t = "", n = "", r = "", i = e?.cause;
			if (i) {
				let n = i?.message ?? "", r = i?.code ?? "";
				t = `${e?.name ?? "FetchError"}: ${e?.message}`, t += `\n\nCaused by: ${i?.name ?? "Error"}: ${n}`, r && (t += ` (${r})`), i?.stack && (t += `\n${i.stack}`);
			} else t = e?.stack ?? "";
			let a = this.url.toString().length;
			return e?.name === "AbortError" || e?.code === "ABORT_ERR" ? (r = "", n = "Request was aborted (timeout or manual cancellation)", a > this.urlLengthLimit && (n += `. Note: Your request URL is ${a} characters, which may exceed server limits. If selecting many fields, consider using views. If filtering with large arrays (e.g., .in('id', [many IDs])), consider using an RPC function to pass values server-side.`)) : (i?.name === "HeadersOverflowError" || i?.code === "UND_ERR_HEADERS_OVERFLOW") && (r = "", n = "HTTP headers exceeded server limits (typically 16KB)", a > this.urlLengthLimit && (n += `. Your request URL is ${a} characters. If selecting many fields, consider using views. If filtering with large arrays (e.g., .in('id', [200+ IDs])), consider using an RPC function instead.`)), {
				success: !1,
				error: {
					message: `${e?.name ?? "FetchError"}: ${e?.message}`,
					details: t,
					hint: n,
					code: r
				},
				data: null,
				count: null,
				status: 0,
				statusText: ""
			};
		})), i.then(e, t);
	}
	async processResponse(e) {
		var t = this;
		let n = null, r = null, i = null, a = e.status, o = e.statusText;
		if (e.ok) {
			if (t.method !== "HEAD") {
				let i = await e.text();
				if (i !== "") {
					if (t.headers.get("Accept") === "text/csv") r = i;
					else if (t.headers.get("Accept") && t.headers.get("Accept")?.includes("application/vnd.pgrst.plan+text")) r = i;
					else try {
						r = JSON.parse(i);
					} catch {
						if (n = { message: i }, r = null, t.shouldThrowOnError) throw new S({
							message: i,
							details: "",
							hint: "",
							code: ""
						});
					}
				}
			}
			let s = t.headers.get("Prefer")?.match(/count=(exact|planned|estimated)/), c = e.headers.get("content-range")?.split("/");
			if (s && c && c.length > 1 && (i = parseInt(c[1])), t.isMaybeSingle && Array.isArray(r)) {
				if (r.length > 1) {
					if (n = {
						code: "PGRST116",
						details: `Results contain ${r.length} rows, application/vnd.pgrst.object+json requires 1 row`,
						hint: null,
						message: "JSON object requested, multiple (or no) rows returned"
					}, r = null, i = null, a = 406, o = "Not Acceptable", t.shouldThrowOnError) throw new S(T(T({}, n), {}, { hint: n.hint ?? "" }));
				} else r = r.length === 1 ? r[0] : null;
			}
		} else {
			let i = await e.text();
			try {
				n = JSON.parse(i), Array.isArray(n) && e.status === 404 && (r = [], n = null, a = 200, o = "OK");
			} catch {
				e.status === 404 && i === "" ? (a = 204, o = "No Content") : n = { message: i };
			}
			if (n && t.shouldThrowOnError) throw new S(n);
		}
		return {
			success: n === null,
			error: n,
			data: r,
			count: i,
			status: a,
			statusText: o
		};
	}
	returns() {
		/* istanbul ignore next */
		return this;
	}
	overrideTypes() {
		return this;
	}
}, de = class extends ue {
	throwOnError() {
		return super.throwOnError();
	}
	select(e) {
		let t = !1, n = (e ?? "*").split("").map((e) => /\s/.test(e) && !t ? "" : (e === "\"" && (t = !t), e)).join("");
		return this.url.searchParams.set("select", n), this.headers.append("Prefer", "return=representation"), this;
	}
	order(e, { ascending: t = !0, nullsFirst: n, foreignTable: r, referencedTable: i = r } = {}) {
		let a = i ? `${i}.order` : "order", o = this.url.searchParams.get(a);
		return this.url.searchParams.set(a, `${o ? `${o},` : ""}${e}.${t ? "asc" : "desc"}${n === void 0 ? "" : n ? ".nullsfirst" : ".nullslast"}`), this;
	}
	limit(e, { foreignTable: t, referencedTable: n = t } = {}) {
		let r = n === void 0 ? "limit" : `${n}.limit`;
		return this.url.searchParams.set(r, `${e}`), this;
	}
	range(e, t, { foreignTable: n, referencedTable: r = n } = {}) {
		let i = r === void 0 ? "offset" : `${r}.offset`, a = r === void 0 ? "limit" : `${r}.limit`;
		return this.url.searchParams.set(i, `${e}`), this.url.searchParams.set(a, `${t - e + 1}`), this;
	}
	abortSignal(e) {
		return this.signal = e, this;
	}
	single() {
		return this.headers.set("Accept", "application/vnd.pgrst.object+json"), this;
	}
	maybeSingle() {
		return this.isMaybeSingle = !0, this;
	}
	csv() {
		return this.headers.set("Accept", "text/csv"), this;
	}
	geojson() {
		return this.headers.set("Accept", "application/geo+json"), this;
	}
	explain({ analyze: e = !1, verbose: t = !1, settings: n = !1, buffers: r = !1, wal: i = !1, format: a = "text" } = {}) {
		let o = [
			e ? "analyze" : null,
			t ? "verbose" : null,
			n ? "settings" : null,
			r ? "buffers" : null,
			i ? "wal" : null
		].filter(Boolean).join("|"), s = this.headers.get("Accept") ?? "application/json";
		return this.headers.set("Accept", `application/vnd.pgrst.plan+${a}; for="${s}"; options=${o};`), this;
	}
	rollback() {
		return this.headers.append("Prefer", "tx=rollback"), this;
	}
	returns() {
		return this;
	}
	maxAffected(e) {
		return this.headers.append("Prefer", "handling=strict"), this.headers.append("Prefer", `max-affected=${e}`), this;
	}
}, fe = /* @__PURE__ */ RegExp("[,()]"), pe = class extends de {
	throwOnError() {
		return super.throwOnError();
	}
	eq(e, t) {
		return this.url.searchParams.append(e, `eq.${t}`), this;
	}
	neq(e, t) {
		return this.url.searchParams.append(e, `neq.${t}`), this;
	}
	gt(e, t) {
		return this.url.searchParams.append(e, `gt.${t}`), this;
	}
	gte(e, t) {
		return this.url.searchParams.append(e, `gte.${t}`), this;
	}
	lt(e, t) {
		return this.url.searchParams.append(e, `lt.${t}`), this;
	}
	lte(e, t) {
		return this.url.searchParams.append(e, `lte.${t}`), this;
	}
	like(e, t) {
		return this.url.searchParams.append(e, `like.${t}`), this;
	}
	likeAllOf(e, t) {
		return this.url.searchParams.append(e, `like(all).{${t.join(",")}}`), this;
	}
	likeAnyOf(e, t) {
		return this.url.searchParams.append(e, `like(any).{${t.join(",")}}`), this;
	}
	ilike(e, t) {
		return this.url.searchParams.append(e, `ilike.${t}`), this;
	}
	ilikeAllOf(e, t) {
		return this.url.searchParams.append(e, `ilike(all).{${t.join(",")}}`), this;
	}
	ilikeAnyOf(e, t) {
		return this.url.searchParams.append(e, `ilike(any).{${t.join(",")}}`), this;
	}
	regexMatch(e, t) {
		return this.url.searchParams.append(e, `match.${t}`), this;
	}
	regexIMatch(e, t) {
		return this.url.searchParams.append(e, `imatch.${t}`), this;
	}
	is(e, t) {
		return this.url.searchParams.append(e, `is.${t}`), this;
	}
	isDistinct(e, t) {
		return this.url.searchParams.append(e, `isdistinct.${t}`), this;
	}
	in(e, t) {
		let n = Array.from(new Set(t)).map((e) => typeof e == "string" && fe.test(e) ? `"${e}"` : `${e}`).join(",");
		return this.url.searchParams.append(e, `in.(${n})`), this;
	}
	notIn(e, t) {
		let n = Array.from(new Set(t)).map((e) => typeof e == "string" && fe.test(e) ? `"${e}"` : `${e}`).join(",");
		return this.url.searchParams.append(e, `not.in.(${n})`), this;
	}
	contains(e, t) {
		return typeof t == "string" ? this.url.searchParams.append(e, `cs.${t}`) : Array.isArray(t) ? this.url.searchParams.append(e, `cs.{${t.join(",")}}`) : this.url.searchParams.append(e, `cs.${JSON.stringify(t)}`), this;
	}
	containedBy(e, t) {
		return typeof t == "string" ? this.url.searchParams.append(e, `cd.${t}`) : Array.isArray(t) ? this.url.searchParams.append(e, `cd.{${t.join(",")}}`) : this.url.searchParams.append(e, `cd.${JSON.stringify(t)}`), this;
	}
	rangeGt(e, t) {
		return this.url.searchParams.append(e, `sr.${t}`), this;
	}
	rangeGte(e, t) {
		return this.url.searchParams.append(e, `nxl.${t}`), this;
	}
	rangeLt(e, t) {
		return this.url.searchParams.append(e, `sl.${t}`), this;
	}
	rangeLte(e, t) {
		return this.url.searchParams.append(e, `nxr.${t}`), this;
	}
	rangeAdjacent(e, t) {
		return this.url.searchParams.append(e, `adj.${t}`), this;
	}
	overlaps(e, t) {
		return typeof t == "string" ? this.url.searchParams.append(e, `ov.${t}`) : this.url.searchParams.append(e, `ov.{${t.join(",")}}`), this;
	}
	textSearch(e, t, { config: n, type: r } = {}) {
		let i = "";
		r === "plain" ? i = "pl" : r === "phrase" ? i = "ph" : r === "websearch" && (i = "w");
		let a = n === void 0 ? "" : `(${n})`;
		return this.url.searchParams.append(e, `${i}fts${a}.${t}`), this;
	}
	match(e) {
		return Object.entries(e).filter(([e, t]) => t !== void 0).forEach(([e, t]) => {
			this.url.searchParams.append(e, `eq.${t}`);
		}), this;
	}
	not(e, t, n) {
		return this.url.searchParams.append(e, `not.${t}.${n}`), this;
	}
	or(e, { foreignTable: t, referencedTable: n = t } = {}) {
		let r = n ? `${n}.or` : "or";
		return this.url.searchParams.append(r, `(${e})`), this;
	}
	filter(e, t, n) {
		return this.url.searchParams.append(e, `${t}.${n}`), this;
	}
}, me = class {
	constructor(e, { headers: t = {}, schema: n, fetch: r, urlLengthLimit: i = 8e3, retry: a }) {
		this.url = e, this.headers = new Headers(t), this.schema = n, this.fetch = r, this.urlLengthLimit = i, this.retry = a;
	}
	cloneRequestState() {
		return {
			url: new URL(this.url.toString()),
			headers: new Headers(this.headers)
		};
	}
	select(e, t) {
		let { head: n = !1, count: r } = t ?? {}, i = n ? "HEAD" : "GET", a = !1, o = (e ?? "*").split("").map((e) => /\s/.test(e) && !a ? "" : (e === "\"" && (a = !a), e)).join(""), { url: s, headers: c } = this.cloneRequestState();
		return s.searchParams.set("select", o), r && c.append("Prefer", `count=${r}`), new pe({
			method: i,
			url: s,
			headers: c,
			schema: this.schema,
			fetch: this.fetch,
			urlLengthLimit: this.urlLengthLimit,
			retry: this.retry
		});
	}
	insert(e, { count: t, defaultToNull: n = !0 } = {}) {
		let { url: r, headers: i } = this.cloneRequestState();
		if (t && i.append("Prefer", `count=${t}`), n || i.append("Prefer", "missing=default"), Array.isArray(e)) {
			let t = e.reduce((e, t) => e.concat(Object.keys(t)), []);
			if (t.length > 0) {
				let e = [...new Set(t)].map((e) => `"${e}"`);
				r.searchParams.set("columns", e.join(","));
			}
		}
		return new pe({
			method: "POST",
			url: r,
			headers: i,
			schema: this.schema,
			body: e,
			fetch: this.fetch ?? fetch,
			urlLengthLimit: this.urlLengthLimit,
			retry: this.retry
		});
	}
	upsert(e, { onConflict: t, ignoreDuplicates: n = !1, count: r, defaultToNull: i = !0 } = {}) {
		let { url: a, headers: o } = this.cloneRequestState();
		if (o.append("Prefer", `resolution=${n ? "ignore" : "merge"}-duplicates`), t !== void 0 && a.searchParams.set("on_conflict", t), r && o.append("Prefer", `count=${r}`), i || o.append("Prefer", "missing=default"), Array.isArray(e)) {
			let t = e.reduce((e, t) => e.concat(Object.keys(t)), []);
			if (t.length > 0) {
				let e = [...new Set(t)].map((e) => `"${e}"`);
				a.searchParams.set("columns", e.join(","));
			}
		}
		return new pe({
			method: "POST",
			url: a,
			headers: o,
			schema: this.schema,
			body: e,
			fetch: this.fetch ?? fetch,
			urlLengthLimit: this.urlLengthLimit,
			retry: this.retry
		});
	}
	update(e, { count: t } = {}) {
		let { url: n, headers: r } = this.cloneRequestState();
		return t && r.append("Prefer", `count=${t}`), new pe({
			method: "PATCH",
			url: n,
			headers: r,
			schema: this.schema,
			body: e,
			fetch: this.fetch ?? fetch,
			urlLengthLimit: this.urlLengthLimit,
			retry: this.retry
		});
	}
	delete({ count: e } = {}) {
		let { url: t, headers: n } = this.cloneRequestState();
		return e && n.append("Prefer", `count=${e}`), new pe({
			method: "DELETE",
			url: t,
			headers: n,
			schema: this.schema,
			fetch: this.fetch ?? fetch,
			urlLengthLimit: this.urlLengthLimit,
			retry: this.retry
		});
	}
};
function he(e, t) {
	try {
		let t = JSON.parse(e);
		if (t && typeof t == "object" && !Array.isArray(t)) return new S({
			message: String(t.message ?? e),
			details: t.details ?? "",
			hint: t.hint ?? "",
			code: t.code ?? ""
		});
	} catch {}
	return new S({
		message: e || t,
		details: "",
		hint: "",
		code: ""
	});
}
function ge(e, t, n) {
	let r = e;
	return {
		success: !1,
		error: new S({
			message: `${r?.name ?? "FetchError"}: ${r?.message}`,
			details: "",
			hint: "",
			code: ""
		}),
		data: null,
		count: null,
		status: t,
		statusText: n
	};
}
var _e = class e {
	constructor(e, { headers: t = {}, schema: n, fetch: r, timeout: i, urlLengthLimit: a = 8e3, retry: o } = {}) {
		this.url = e, this.headers = new Headers(t), this.schemaName = n, this.urlLengthLimit = a;
		let s = r ?? globalThis.fetch;
		this.fetch = i !== void 0 && i > 0 ? (e, t) => {
			let n = new AbortController(), r = setTimeout(() => n.abort(), i), a = t?.signal;
			if (a) {
				if (a.aborted) return clearTimeout(r), s(e, t);
				let i = () => {
					clearTimeout(r), n.abort();
				};
				return a.addEventListener("abort", i, { once: !0 }), s(e, T(T({}, t), {}, { signal: n.signal })).finally(() => {
					clearTimeout(r), a.removeEventListener("abort", i);
				});
			}
			return s(e, T(T({}, t), {}, { signal: n.signal })).finally(() => clearTimeout(r));
		} : s, this.retry = o;
	}
	from(e) {
		if (!e || typeof e != "string" || e.trim() === "") throw Error("Invalid relation name: relation must be a non-empty string.");
		return new me(new URL(`${this.url}/${e}`), {
			headers: new Headers(this.headers),
			schema: this.schemaName,
			fetch: this.fetch,
			urlLengthLimit: this.urlLengthLimit,
			retry: this.retry
		});
	}
	schema(t) {
		return new e(this.url, {
			headers: this.headers,
			schema: t,
			fetch: this.fetch,
			urlLengthLimit: this.urlLengthLimit,
			retry: this.retry
		});
	}
	async getOpenApiSpec() {
		var e = this;
		let t = new Headers(e.headers);
		t.set("Accept", "application/openapi+json"), e.schemaName && t.set("Accept-Profile", e.schemaName);
		let n = {};
		t.forEach((e, t) => {
			n[t] = e;
		});
		let r = e.fetch ?? globalThis.fetch, i;
		try {
			i = await le(r, `${e.url}/`, {
				method: "GET",
				headers: n
			}, e.retry ?? !0);
		} catch (e) {
			return ge(e, 0, "");
		}
		let a;
		try {
			a = await i.text();
		} catch (e) {
			return ge(e, i.status, i.statusText);
		}
		if (i.ok) try {
			return {
				success: !0,
				error: null,
				data: JSON.parse(a),
				count: null,
				status: i.status,
				statusText: i.statusText
			};
		} catch {}
		return {
			success: !1,
			error: he(a, i.statusText),
			data: null,
			count: null,
			status: i.status,
			statusText: i.statusText
		};
	}
	rpc(e, t = {}, { head: n = !1, get: r = !1, count: i } = {}) {
		let a, o = new URL(`${this.url}/rpc/${e}`), s, c = (e) => typeof e == "object" && !!e && (!Array.isArray(e) || e.some(c)), l = n && Object.values(t).some(c);
		l ? (a = "POST", s = t) : n || r ? (a = n ? "HEAD" : "GET", Object.entries(t).filter(([e, t]) => t !== void 0).map(([e, t]) => [e, Array.isArray(t) ? `{${t.join(",")}}` : `${t}`]).forEach(([e, t]) => {
			o.searchParams.append(e, t);
		})) : (a = "POST", s = t);
		let u = new Headers(this.headers);
		return l ? u.set("Prefer", i ? `count=${i},return=minimal` : "return=minimal") : i && u.set("Prefer", `count=${i}`), new pe({
			method: a,
			url: o,
			headers: u,
			schema: this.schemaName,
			body: s,
			fetch: this.fetch ?? fetch,
			urlLengthLimit: this.urlLengthLimit,
			retry: this.retry
		});
	}
}, ve = class {
	constructor() {}
	static detectEnvironment() {
		if (typeof WebSocket < "u") return {
			type: "native",
			wsConstructor: WebSocket
		};
		let e = globalThis;
		if (typeof globalThis < "u" && e.WebSocket !== void 0) return {
			type: "native",
			wsConstructor: e.WebSocket
		};
		let t = typeof global < "u" ? global : void 0;
		if (t && t.WebSocket !== void 0) return {
			type: "native",
			wsConstructor: t.WebSocket
		};
		if (typeof globalThis < "u" && e.WebSocketPair !== void 0 && globalThis.WebSocket === void 0) return {
			type: "cloudflare",
			error: "Cloudflare Workers detected. WebSocket clients are not supported in Cloudflare Workers.",
			workaround: "Use Cloudflare Workers WebSocket API for server-side WebSocket handling, or deploy to a different runtime."
		};
		if (typeof globalThis < "u" && e.EdgeRuntime || typeof navigator < "u" && navigator.userAgent?.includes("Vercel-Edge")) return {
			type: "unsupported",
			error: "Edge runtime detected (Vercel Edge/Netlify Edge). WebSockets are not supported in edge functions.",
			workaround: "Use serverless functions or a different deployment target for WebSocket functionality."
		};
		let n = globalThis.process;
		if (n) {
			let e = n.versions;
			if (e && e.node) return {
				type: "unsupported",
				error: "Node.js detected but native WebSocket not found.",
				workaround: "Ensure you are running Node.js 22+ or provide a WebSocket implementation via the transport option."
			};
		}
		return {
			type: "unsupported",
			error: "Unknown JavaScript runtime without WebSocket support.",
			workaround: "Ensure you're running in a supported environment (browser, Node.js, Deno) or provide a custom WebSocket implementation."
		};
	}
	static getWebSocketConstructor() {
		let e = this.detectEnvironment();
		if (e.wsConstructor) return e.wsConstructor;
		let t = e.error || "WebSocket not supported in this environment.";
		throw e.workaround && (t += `\n\nSuggested solution: ${e.workaround}`), Error(t);
	}
	static isWebSocketSupported() {
		try {
			return this.detectEnvironment().type === "native";
		} catch {
			return !1;
		}
	}
}, ye = "realtime-js/2.117.2", be = "1.0.0", E = "2.0.0", xe = E, D = 1e4, Se = 15e3, O = 1e4, k = {
	closed: "closed",
	errored: "errored",
	joined: "joined",
	joining: "joining",
	leaving: "leaving"
}, Ce = {
	close: "phx_close",
	error: "phx_error",
	join: "phx_join",
	reply: "phx_reply",
	leave: "phx_leave",
	access_token: "access_token"
}, we = {
	connecting: "connecting",
	open: "open",
	closing: "closing",
	closed: "closed"
}, Te = class {
	constructor(e) {
		this.HEADER_LENGTH = 1, this.USER_BROADCAST_PUSH_META_LENGTH = 6, this.KINDS = {
			userBroadcastPush: 3,
			userBroadcast: 4
		}, this.BINARY_ENCODING = 0, this.JSON_ENCODING = 1, this.BROADCAST_EVENT = "broadcast", this.allowedMetadataKeys = [], this.allowedMetadataKeys = e ?? [];
	}
	encode(e, t) {
		if (e.event === this.BROADCAST_EVENT && !(e.payload instanceof ArrayBuffer) && typeof e.payload.event == "string") return t(this._binaryEncodeUserBroadcastPush(e));
		let n = [
			e.join_ref,
			e.ref,
			e.topic,
			e.event,
			e.payload
		];
		return t(JSON.stringify(n));
	}
	_binaryEncodeUserBroadcastPush(e) {
		return this._isArrayBuffer(e.payload?.payload) ? this._encodeBinaryUserBroadcastPush(e) : this._encodeJsonUserBroadcastPush(e);
	}
	_encodeBinaryUserBroadcastPush(e) {
		let t = e.payload?.payload ?? /* @__PURE__ */ new ArrayBuffer(0);
		return this._encodeUserBroadcastPush(e, this.BINARY_ENCODING, t);
	}
	_encodeJsonUserBroadcastPush(e) {
		let t = e.payload?.payload ?? {}, n = new TextEncoder().encode(JSON.stringify(t)).buffer;
		return this._encodeUserBroadcastPush(e, this.JSON_ENCODING, n);
	}
	_encodeUserBroadcastPush(e, t, n) {
		let r = new TextEncoder(), i = r.encode(e.topic), a = r.encode(e.ref ?? ""), o = r.encode(e.join_ref ?? ""), s = r.encode(e.payload.event), c = this.allowedMetadataKeys ? this._pick(e.payload, this.allowedMetadataKeys) : {}, l = r.encode(Object.keys(c).length === 0 ? "" : JSON.stringify(c));
		if (o.length > 255) throw Error(`joinRef length ${o.length} exceeds maximum of 255`);
		if (a.length > 255) throw Error(`ref length ${a.length} exceeds maximum of 255`);
		if (i.length > 255) throw Error(`topic length ${i.length} exceeds maximum of 255`);
		if (s.length > 255) throw Error(`userEvent length ${s.length} exceeds maximum of 255`);
		if (l.length > 255) throw Error(`metadata length ${l.length} exceeds maximum of 255`);
		let u = this.USER_BROADCAST_PUSH_META_LENGTH + o.length + a.length + i.length + s.length + l.length, d = new ArrayBuffer(this.HEADER_LENGTH + u), f = new DataView(d), p = new Uint8Array(d), m = 0;
		f.setUint8(m++, this.KINDS.userBroadcastPush), f.setUint8(m++, o.length), f.setUint8(m++, a.length), f.setUint8(m++, i.length), f.setUint8(m++, s.length), f.setUint8(m++, l.length), f.setUint8(m++, t), p.set(o, m), m += o.length, p.set(a, m), m += a.length, p.set(i, m), m += i.length, p.set(s, m), m += s.length, p.set(l, m), m += l.length;
		var h = new Uint8Array(d.byteLength + n.byteLength);
		return h.set(new Uint8Array(d), 0), h.set(new Uint8Array(n), d.byteLength), h.buffer;
	}
	decode(e, t) {
		if (this._isArrayBuffer(e)) return t(this._binaryDecode(e));
		if (typeof e == "string") {
			let [n, r, i, a, o] = JSON.parse(e);
			return t({
				join_ref: n,
				ref: r,
				topic: i,
				event: a,
				payload: o
			});
		}
		return t({});
	}
	_binaryDecode(e) {
		let t = new DataView(e), n = t.getUint8(0), r = new TextDecoder();
		switch (n) {
			case this.KINDS.userBroadcast: return this._decodeUserBroadcast(e, t, r);
		}
	}
	_decodeUserBroadcast(e, t, n) {
		let r = t.getUint8(1), i = t.getUint8(2), a = t.getUint8(3), o = t.getUint8(4), s = this.HEADER_LENGTH + 4, c = n.decode(e.slice(s, s + r));
		s += r;
		let l = n.decode(e.slice(s, s + i));
		s += i;
		let u = n.decode(e.slice(s, s + a));
		s += a;
		let d = e.slice(s, e.byteLength), f = o === this.JSON_ENCODING ? JSON.parse(n.decode(d)) : d, p = {
			type: this.BROADCAST_EVENT,
			event: l,
			payload: f
		};
		return a > 0 && (p.meta = JSON.parse(u)), {
			join_ref: null,
			ref: null,
			topic: c,
			event: this.BROADCAST_EVENT,
			payload: p
		};
	}
	_isArrayBuffer(e) {
		return e instanceof ArrayBuffer || e?.constructor?.name === "ArrayBuffer";
	}
	_pick(e, t) {
		return !e || typeof e != "object" ? {} : Object.fromEntries(Object.entries(e).filter(([e]) => t.includes(e)));
	}
}, A;
(function(e) {
	e.abstime = "abstime", e.bool = "bool", e.date = "date", e.daterange = "daterange", e.float4 = "float4", e.float8 = "float8", e.int2 = "int2", e.int4 = "int4", e.int4range = "int4range", e.int8 = "int8", e.int8range = "int8range", e.json = "json", e.jsonb = "jsonb", e.money = "money", e.numeric = "numeric", e.oid = "oid", e.reltime = "reltime", e.text = "text", e.time = "time", e.timestamp = "timestamp", e.timestamptz = "timestamptz", e.timetz = "timetz", e.tsrange = "tsrange", e.tstzrange = "tstzrange";
})(A ||= {});
var Ee = (e, t, n = {}) => {
	let r = n.skipTypes ?? [];
	return t ? Object.keys(t).reduce((n, i) => (n[i] = j(i, e, t, r), n), {}) : {};
}, j = (e, t, n, r) => {
	let i = t.find((t) => t.name === e)?.type, a = n[e];
	return i && !r.includes(i) ? De(i, a) : Oe(a);
}, De = (e, t) => {
	if (e.charAt(0) === "_") return Me(t, e.slice(1, e.length));
	switch (e) {
		case A.bool: return ke(t);
		case A.float4:
		case A.float8:
		case A.int2:
		case A.int4:
		case A.int8:
		case A.numeric:
		case A.oid: return Ae(t);
		case A.json:
		case A.jsonb: return je(t);
		case A.timestamp: return Ne(t);
		case A.abstime:
		case A.date:
		case A.daterange:
		case A.int4range:
		case A.int8range:
		case A.money:
		case A.reltime:
		case A.text:
		case A.time:
		case A.timestamptz:
		case A.timetz:
		case A.tsrange:
		case A.tstzrange: return Oe(t);
		default: return Oe(t);
	}
}, Oe = (e) => e, ke = (e) => {
	switch (e) {
		case "t": return !0;
		case "f": return !1;
		default: return e;
	}
}, Ae = (e) => {
	if (typeof e == "string") {
		let t = parseFloat(e);
		if (!Number.isNaN(t)) return t;
	}
	return e;
}, je = (e) => {
	if (typeof e == "string") try {
		return JSON.parse(e);
	} catch {
		return e;
	}
	return e;
}, Me = (e, t) => {
	if (typeof e != "string") return e;
	let n = e.length - 1, r = e[n];
	if (e[0] === "{" && r === "}") {
		let r, i = e.slice(1, n);
		try {
			r = JSON.parse("[" + i + "]");
		} catch {
			r = i ? i.split(",") : [];
		}
		return r.map((e) => De(t, e));
	}
	return e;
}, Ne = (e) => typeof e == "string" ? e.replace(" ", "T") : e, Pe = (e) => {
	let t = new URL(e);
	return t.protocol = t.protocol.replace(/^ws/i, "http"), t.pathname = t.pathname.replace(/\/+$/, "").replace(/\/socket\/websocket$/i, "").replace(/\/socket$/i, "").replace(/\/websocket$/i, ""), t.pathname === "" || t.pathname === "/" ? t.pathname = "/api/broadcast" : t.pathname += "/api/broadcast", t.href;
}, Fe = (e) => typeof e == "function" ? e : function() {
	return e;
}, Ie = typeof self < "u" ? self : null, Le = typeof window < "u" ? window : null, Re = Ie || Le || globalThis, ze = "2.0.0", Be = 1e4, Ve = 1e3, He = 100, Ue = {
	connecting: 0,
	open: 1,
	closing: 2,
	closed: 3
}, We = {
	closed: "closed",
	errored: "errored",
	joined: "joined",
	joining: "joining",
	leaving: "leaving"
}, Ge = {
	close: "phx_close",
	error: "phx_error",
	join: "phx_join",
	reply: "phx_reply",
	leave: "phx_leave"
}, Ke = {
	longpoll: "longpoll",
	websocket: "websocket"
}, qe = { complete: 4 }, Je = "base64url.bearer.phx.", Ye = class {
	constructor(e, t, n, r) {
		this.channel = e, this.event = t, this.payload = n || function() {
			return {};
		}, this.receivedResp = null, this.timeout = r, this.timeoutTimer = null, this.recHooks = [], this.sent = !1, this.ref = void 0;
	}
	resend(e) {
		this.timeout = e, this.reset(), this.send();
	}
	send() {
		this.hasReceived("timeout") || (this.startTimeout(), this.sent = !0, this.channel.socket.push({
			topic: this.channel.topic,
			event: this.event,
			payload: this.payload(),
			ref: this.ref,
			join_ref: this.channel.joinRef()
		}));
	}
	receive(e, t) {
		return this.hasReceived(e) && t(this.receivedResp.response), this.recHooks.push({
			status: e,
			callback: t
		}), this;
	}
	reset() {
		this.cancelRefEvent(), this.ref = null, this.refEvent = null, this.receivedResp = null, this.sent = !1;
	}
	destroy() {
		this.cancelRefEvent(), this.cancelTimeout();
	}
	matchReceive({ status: e, response: t, _ref: n }) {
		this.recHooks.filter((t) => t.status === e).forEach((e) => e.callback(t));
	}
	cancelRefEvent() {
		this.refEvent && this.channel.off(this.refEvent);
	}
	cancelTimeout() {
		clearTimeout(this.timeoutTimer), this.timeoutTimer = null;
	}
	startTimeout() {
		this.timeoutTimer && this.cancelTimeout(), this.ref = this.channel.socket.makeRef(), this.refEvent = this.channel.replyEventName(this.ref), this.channel.on(this.refEvent, (e) => {
			this.cancelRefEvent(), this.cancelTimeout(), this.receivedResp = e, this.matchReceive(e);
		}), this.timeoutTimer = setTimeout(() => {
			this.trigger("timeout", {});
		}, this.timeout);
	}
	hasReceived(e) {
		return this.receivedResp && this.receivedResp.status === e;
	}
	trigger(e, t) {
		this.channel.trigger(this.refEvent, {
			status: e,
			response: t
		});
	}
}, Xe = class {
	constructor(e, t) {
		this.callback = e, this.timerCalc = t, this.timer = void 0, this.tries = 0;
	}
	reset() {
		this.tries = 0, clearTimeout(this.timer);
	}
	scheduleTimeout() {
		clearTimeout(this.timer), this.timer = setTimeout(() => {
			this.tries += 1, this.callback();
		}, this.timerCalc(this.tries + 1));
	}
}, Ze = class {
	constructor(e, t, n) {
		this.state = We.closed, this.topic = e, this.params = Fe(t || {}), this.socket = n, this.bindings = [], this.bindingRef = 0, this.timeout = this.socket.timeout, this.joinedOnce = !1, this.joinPush = new Ye(this, Ge.join, this.params, this.timeout), this.pushBuffer = [], this.stateChangeRefs = [], this.rejoinTimer = new Xe(() => {
			this.socket.isConnected() && this.rejoin();
		}, this.socket.rejoinAfterMs), this.stateChangeRefs.push(this.socket.onError(() => this.rejoinTimer.reset())), this.stateChangeRefs.push(this.socket.onOpen(() => {
			this.rejoinTimer.reset(), this.isErrored() && this.rejoin();
		})), this.joinPush.receive("ok", () => {
			this.state = We.joined, this.rejoinTimer.reset(), this.pushBuffer.forEach((e) => e.send()), this.pushBuffer = [];
		}), this.joinPush.receive("error", (e) => {
			this.state = We.errored, this.socket.hasLogger() && this.socket.log("channel", `error ${this.topic}`, e), this.socket.isConnected() && this.rejoinTimer.scheduleTimeout();
		}), this.onClose(() => {
			this.rejoinTimer.reset(), this.socket.hasLogger() && this.socket.log("channel", `close ${this.topic}`), this.state = We.closed, this.socket.remove(this);
		}), this.onError((e) => {
			this.socket.hasLogger() && this.socket.log("channel", `error ${this.topic}`, e), this.isJoining() && this.joinPush.reset(), this.state = We.errored, this.socket.isConnected() && this.rejoinTimer.scheduleTimeout();
		}), this.joinPush.receive("timeout", () => {
			this.socket.hasLogger() && this.socket.log("channel", `timeout ${this.topic}`, this.joinPush.timeout), new Ye(this, Ge.leave, Fe({}), this.timeout).send(), this.state = We.errored, this.joinPush.reset(), this.socket.isConnected() && this.rejoinTimer.scheduleTimeout();
		}), this.on(Ge.reply, (e, t) => {
			this.trigger(this.replyEventName(t), e);
		});
	}
	join(e = this.timeout) {
		if (this.joinedOnce) throw Error("tried to join multiple times. 'join' can only be called a single time per channel instance");
		return this.timeout = e, this.joinedOnce = !0, this.rejoin(), this.joinPush;
	}
	teardown() {
		this.pushBuffer.forEach((e) => e.destroy()), this.pushBuffer = [], this.rejoinTimer.reset(), this.joinPush.destroy(), this.state = We.closed, this.bindings = [];
	}
	onClose(e) {
		this.on(Ge.close, e);
	}
	onError(e) {
		return this.on(Ge.error, (t) => e(t));
	}
	on(e, t) {
		let n = this.bindingRef++;
		return this.bindings.push({
			event: e,
			ref: n,
			callback: t
		}), n;
	}
	off(e, t) {
		this.bindings = this.bindings.filter((n) => n.event !== e || t !== void 0 && t !== n.ref);
	}
	canPush() {
		return this.socket.isConnected() && this.isJoined();
	}
	push(e, t, n = this.timeout) {
		if (t ||= {}, !this.joinedOnce) throw Error(`tried to push '${e}' to '${this.topic}' before joining. Use channel.join() before pushing events`);
		let r = new Ye(this, e, function() {
			return t;
		}, n);
		return this.canPush() ? r.send() : (r.startTimeout(), this.pushBuffer.push(r)), r;
	}
	leave(e = this.timeout) {
		this.rejoinTimer.reset(), this.joinPush.cancelTimeout(), this.state = We.leaving;
		let t = () => {
			this.socket.hasLogger() && this.socket.log("channel", `leave ${this.topic}`), this.trigger(Ge.close, "leave");
		}, n = new Ye(this, Ge.leave, Fe({}), e);
		return n.receive("ok", () => t()).receive("timeout", () => t()), n.send(), this.canPush() || n.trigger("ok", {}), n;
	}
	onMessage(e, t, n) {
		return t;
	}
	filterBindings(e, t, n) {
		return !0;
	}
	isMember(e, t, n, r) {
		return this.topic === e ? r && r !== this.joinRef() ? (this.socket.hasLogger() && this.socket.log("channel", "dropping outdated message", {
			topic: e,
			event: t,
			payload: n,
			joinRef: r
		}), !1) : !0 : !1;
	}
	joinRef() {
		return this.joinPush.ref;
	}
	rejoin(e = this.timeout) {
		this.isLeaving() || (this.socket.leaveOpenTopic(this.topic), this.state = We.joining, this.joinPush.resend(e));
	}
	trigger(e, t, n, r) {
		let i = this.onMessage(e, t, n, r);
		if (t && !i) throw Error("channel onMessage callbacks must return the payload, modified or unmodified");
		let a = this.bindings.filter((r) => r.event === e && this.filterBindings(r, t, n));
		for (let e = 0; e < a.length; e++) a[e].callback(i, n, r || this.joinRef());
	}
	replyEventName(e) {
		return `chan_reply_${e}`;
	}
	isClosed() {
		return this.state === We.closed;
	}
	isErrored() {
		return this.state === We.errored;
	}
	isJoined() {
		return this.state === We.joined;
	}
	isJoining() {
		return this.state === We.joining;
	}
	isLeaving() {
		return this.state === We.leaving;
	}
}, Qe = class {
	static request(e, t, n, r, i, a, o) {
		if (Re.XDomainRequest) {
			let n = new Re.XDomainRequest();
			return this.xdomainRequest(n, e, t, r, i, a, o);
		}
		if (Re.XMLHttpRequest) {
			let s = new Re.XMLHttpRequest();
			return this.xhrRequest(s, e, t, n, r, i, a, o);
		}
		if (Re.fetch && Re.AbortController) return this.fetchRequest(e, t, n, r, i, a, o);
		throw Error("No suitable XMLHttpRequest implementation found");
	}
	static fetchRequest(e, t, n, r, i, a, o) {
		let s = {
			method: e,
			headers: n,
			body: r
		}, c = null;
		return i && (c = new AbortController(), setTimeout(() => c.abort(), i), s.signal = c.signal), Re.fetch(t, s).then((e) => e.text()).then((e) => this.parseJSON(e)).then((e) => o && o(e)).catch((e) => {
			e.name === "AbortError" && a ? a() : o && o(null);
		}), c;
	}
	static xdomainRequest(e, t, n, r, i, a, o) {
		return e.timeout = i, e.open(t, n), e.onload = () => {
			let t = this.parseJSON(e.responseText);
			o && o(t);
		}, a && (e.ontimeout = a), e.onprogress = () => {}, e.send(r), e;
	}
	static xhrRequest(e, t, n, r, i, a, o, s) {
		e.open(t, n, !0), e.timeout = a;
		for (let [t, n] of Object.entries(r)) e.setRequestHeader(t, n);
		return e.onerror = () => s && s(null), e.onreadystatechange = () => {
			e.readyState === qe.complete && s && s(this.parseJSON(e.responseText));
		}, o && (e.ontimeout = o), e.send(i), e;
	}
	static parseJSON(e) {
		if (!e || e === "") return null;
		try {
			return JSON.parse(e);
		} catch {
			return console && console.log("failed to parse JSON response", e), null;
		}
	}
	static serialize(e, t) {
		let n = [];
		for (var r in e) {
			if (!Object.prototype.hasOwnProperty.call(e, r)) continue;
			let i = t ? `${t}[${r}]` : r, a = e[r];
			typeof a == "object" ? n.push(this.serialize(a, i)) : n.push(encodeURIComponent(i) + "=" + encodeURIComponent(a));
		}
		return n.join("&");
	}
	static appendParams(e, t) {
		return Object.keys(t).length === 0 ? e : `${e}${e.match(/\?/) ? "&" : "?"}${this.serialize(t)}`;
	}
}, $e = (e) => {
	let t = "", n = new Uint8Array(e), r = n.byteLength;
	for (let e = 0; e < r; e++) t += String.fromCharCode(n[e]);
	return btoa(t);
}, et = class {
	constructor(e, t) {
		t && t.length === 2 && t[1].startsWith(Je) && (this.authToken = atob(t[1].slice(Je.length))), this.endPoint = null, this.token = null, this.skipHeartbeat = !0, this.reqs = /* @__PURE__ */ new Set(), this.awaitingBatchAck = !1, this.currentBatch = null, this.currentBatchTimer = null, this.batchBuffer = [], this.onopen = function() {}, this.onerror = function() {}, this.onmessage = function() {}, this.onclose = function() {}, this.pollEndpoint = this.normalizeEndpoint(e), this.readyState = Ue.connecting, setTimeout(() => this.poll(), 0);
	}
	normalizeEndpoint(e) {
		return e.replace("ws://", "http://").replace("wss://", "https://").replace(RegExp("(.*)/" + Ke.websocket), "$1/" + Ke.longpoll);
	}
	endpointURL() {
		return Qe.appendParams(this.pollEndpoint, { token: this.token });
	}
	closeAndRetry(e, t, n) {
		this.close(e, t, n), this.readyState = Ue.connecting;
	}
	ontimeout() {
		this.onerror("timeout"), this.closeAndRetry(1005, "timeout", !1);
	}
	isActive() {
		return this.readyState === Ue.open || this.readyState === Ue.connecting;
	}
	poll() {
		let e = { Accept: "application/json" };
		this.authToken && (e["X-Phoenix-AuthToken"] = this.authToken), this.ajax("GET", e, null, () => this.ontimeout(), (e) => {
			if (e) {
				var { status: t, token: n, messages: r } = e;
				if (t === 410 && this.token !== null) {
					this.onerror(410), this.closeAndRetry(3410, "session_gone", !1);
					return;
				}
				this.token = n;
			} else t = 0;
			switch (t) {
				case 200:
					r.forEach((e) => {
						setTimeout(() => this.onmessage({ data: e }), 0);
					}), this.poll();
					break;
				case 204:
					this.poll();
					break;
				case 410:
					this.readyState = Ue.open, this.onopen({}), this.poll();
					break;
				case 403:
					this.onerror(403), this.close(1008, "forbidden", !1);
					break;
				case 0:
				case 500:
					this.onerror(500), this.closeAndRetry(1011, "internal server error", 500);
					break;
				default: throw Error(`unhandled poll status ${t}`);
			}
		});
	}
	send(e) {
		typeof e != "string" && (e = $e(e)), this.currentBatch ? this.currentBatch.push(e) : this.awaitingBatchAck ? this.batchBuffer.push(e) : (this.currentBatch = [e], this.currentBatchTimer = setTimeout(() => {
			this.batchSend(this.currentBatch), this.currentBatch = null;
		}, 0));
	}
	batchSend(e, t = 0) {
		this.awaitingBatchAck = !0;
		let n = t + He, r = e.slice(t, n);
		this.ajax("POST", { "Content-Type": "application/x-ndjson" }, r.join("\n"), () => this.onerror("timeout"), (t) => {
			!t || t.status !== 200 ? (this.awaitingBatchAck = !1, this.onerror(t && t.status), this.closeAndRetry(1011, "internal server error", !1)) : n < e.length ? this.batchSend(e, n) : this.batchBuffer.length > 0 ? (this.batchSend(this.batchBuffer), this.batchBuffer = []) : this.awaitingBatchAck = !1;
		});
	}
	close(e, t, n) {
		for (let e of this.reqs) e.abort();
		this.readyState = Ue.closed;
		let r = Object.assign({
			code: 1e3,
			reason: void 0,
			wasClean: !0
		}, {
			code: e,
			reason: t,
			wasClean: n
		});
		this.batchBuffer = [], clearTimeout(this.currentBatchTimer), this.currentBatchTimer = null, typeof CloseEvent < "u" ? this.onclose(new CloseEvent("close", r)) : this.onclose(r);
	}
	ajax(e, t, n, r, i) {
		let a;
		a = Qe.request(e, this.endpointURL(), t, n, this.timeout, () => {
			this.reqs.delete(a), r();
		}, (e) => {
			this.reqs.delete(a), this.isActive() && i(e);
		}), this.reqs.add(a);
	}
}, tt = class e {
	constructor(t, n = {}) {
		let r = n.events || {
			state: "presence_state",
			diff: "presence_diff"
		};
		this.state = /* @__PURE__ */ Object.create(null), this.pendingDiffs = [], this.channel = t, this.joinRef = null, this.caller = {
			onJoin: function() {},
			onLeave: function() {},
			onSync: function() {}
		}, this.channel.on(r.state, (t) => {
			let { onJoin: n, onLeave: r, onSync: i } = this.caller;
			this.joinRef = this.channel.joinRef(), this.state = e.syncState(this.state, t, n, r), this.pendingDiffs.forEach((t) => {
				this.state = e.syncDiff(this.state, t, n, r);
			}), this.pendingDiffs = [], i();
		}), this.channel.on(r.diff, (t) => {
			let { onJoin: n, onLeave: r, onSync: i } = this.caller;
			this.inPendingSyncState() ? this.pendingDiffs.push(t) : (this.state = e.syncDiff(this.state, t, n, r), i());
		});
	}
	onJoin(e) {
		this.caller.onJoin = e;
	}
	onLeave(e) {
		this.caller.onLeave = e;
	}
	onSync(e) {
		this.caller.onSync = e;
	}
	list(t) {
		return e.list(this.state, t);
	}
	inPendingSyncState() {
		return !this.joinRef || this.joinRef !== this.channel.joinRef();
	}
	static syncState(e, t, n, r) {
		let i = this.toNullProtoObj(this.clone(e));
		t = this.toNullProtoObj(t);
		let a = /* @__PURE__ */ Object.create(null), o = /* @__PURE__ */ Object.create(null);
		return this.map(i, (e, n) => {
			t[e] || (o[e] = n);
		}), this.map(t, (e, t) => {
			let n = i[e];
			if (n) {
				let r = t.metas.map((e) => e.phx_ref), i = n.metas.map((e) => e.phx_ref), s = t.metas.filter((e) => i.indexOf(e.phx_ref) < 0), c = n.metas.filter((e) => r.indexOf(e.phx_ref) < 0);
				s.length > 0 && (a[e] = t, a[e].metas = s), c.length > 0 && (o[e] = this.clone(n), o[e].metas = c);
			} else a[e] = t;
		}), this.syncDiff(i, {
			joins: a,
			leaves: o
		}, n, r);
	}
	static syncDiff(e, t, n, r) {
		e = this.toNullProtoObj(e);
		let { joins: i, leaves: a } = this.clone(t);
		return n ||= function() {}, r ||= function() {}, this.map(i, (t, r) => {
			let i = e[t];
			if (e[t] = this.clone(r), i) {
				let n = e[t].metas.map((e) => e.phx_ref), r = i.metas.filter((e) => n.indexOf(e.phx_ref) < 0);
				e[t].metas.unshift(...r);
			}
			n(t, i, r);
		}), this.map(a, (t, n) => {
			let i = e[t];
			if (!i) return;
			let a = n.metas.map((e) => e.phx_ref);
			i.metas = i.metas.filter((e) => a.indexOf(e.phx_ref) < 0), r(t, i, n), i.metas.length === 0 && delete e[t];
		}), e;
	}
	static list(e, t) {
		return t ||= function(e, t) {
			return t;
		}, this.map(e, (e, n) => t(e, n));
	}
	static map(e, t) {
		return Object.getOwnPropertyNames(e).map((n) => t(n, e[n]));
	}
	static toNullProtoObj(e) {
		if (Object.getPrototypeOf(e) === null) return e;
		let t = /* @__PURE__ */ Object.create(null);
		return Object.getOwnPropertyNames(e).forEach((n) => {
			t[n] = e[n];
		}), t;
	}
	static clone(e) {
		return JSON.parse(JSON.stringify(e));
	}
}, nt = {
	HEADER_LENGTH: 1,
	META_LENGTH: 4,
	KINDS: {
		push: 0,
		reply: 1,
		broadcast: 2
	},
	encode(e, t) {
		if (e.payload.constructor === ArrayBuffer) return t(this.binaryEncode(e));
		{
			let n = [
				e.join_ref,
				e.ref,
				e.topic,
				e.event,
				e.payload
			];
			return t(JSON.stringify(n));
		}
	},
	decode(e, t) {
		if (e.constructor === ArrayBuffer) return t(this.binaryDecode(e));
		{
			let [n, r, i, a, o] = JSON.parse(e);
			return t({
				join_ref: n,
				ref: r,
				topic: i,
				event: a,
				payload: o
			});
		}
	},
	binaryEncode(e) {
		let { join_ref: t, ref: n, event: r, topic: i, payload: a } = e, o = new TextEncoder(), s = o.encode(t), c = o.encode(n), l = o.encode(i), u = o.encode(r);
		this.assertFieldSize(s.byteLength, "join_ref"), this.assertFieldSize(c.byteLength, "ref"), this.assertFieldSize(l.byteLength, "topic"), this.assertFieldSize(u.byteLength, "event");
		let d = this.META_LENGTH + s.byteLength + c.byteLength + l.byteLength + u.byteLength, f = new ArrayBuffer(this.HEADER_LENGTH + d), p = new Uint8Array(f), m = new DataView(f), h = 0;
		m.setUint8(h++, this.KINDS.push), m.setUint8(h++, s.byteLength), m.setUint8(h++, c.byteLength), m.setUint8(h++, l.byteLength), m.setUint8(h++, u.byteLength), p.set(s, h), h += s.byteLength, p.set(c, h), h += c.byteLength, p.set(l, h), h += l.byteLength, p.set(u, h), h += u.byteLength;
		var g = new Uint8Array(f.byteLength + a.byteLength);
		return g.set(p, 0), g.set(new Uint8Array(a), f.byteLength), g.buffer;
	},
	assertFieldSize(e, t) {
		if (e > 255) throw Error(`unable to convert ${t} to binary: must be less than or equal to 255 bytes, but is ${e} bytes`);
	},
	binaryDecode(e) {
		let t = new DataView(e), n = t.getUint8(0), r = new TextDecoder();
		switch (n) {
			case this.KINDS.push: return this.decodePush(e, t, r);
			case this.KINDS.reply: return this.decodeReply(e, t, r);
			case this.KINDS.broadcast: return this.decodeBroadcast(e, t, r);
		}
	},
	decodePush(e, t, n) {
		let r = t.getUint8(1), i = t.getUint8(2), a = t.getUint8(3), o = this.HEADER_LENGTH + this.META_LENGTH - 1, s = n.decode(e.slice(o, o + r));
		o += r;
		let c = n.decode(e.slice(o, o + i));
		o += i;
		let l = n.decode(e.slice(o, o + a));
		return o += a, {
			join_ref: s,
			ref: null,
			topic: c,
			event: l,
			payload: e.slice(o, e.byteLength)
		};
	},
	decodeReply(e, t, n) {
		let r = t.getUint8(1), i = t.getUint8(2), a = t.getUint8(3), o = t.getUint8(4), s = this.HEADER_LENGTH + this.META_LENGTH, c = n.decode(e.slice(s, s + r));
		s += r;
		let l = n.decode(e.slice(s, s + i));
		s += i;
		let u = n.decode(e.slice(s, s + a));
		s += a;
		let d = n.decode(e.slice(s, s + o));
		s += o;
		let f = {
			status: d,
			response: e.slice(s, e.byteLength)
		};
		return {
			join_ref: c,
			ref: l,
			topic: u,
			event: Ge.reply,
			payload: f
		};
	},
	decodeBroadcast(e, t, n) {
		let r = t.getUint8(1), i = t.getUint8(2), a = this.HEADER_LENGTH + 2, o = n.decode(e.slice(a, a + r));
		a += r;
		let s = n.decode(e.slice(a, a + i));
		return a += i, {
			join_ref: null,
			ref: null,
			topic: o,
			event: s,
			payload: e.slice(a, e.byteLength)
		};
	}
}, rt = class {
	constructor(e, t = {}) {
		this.stateChangeCallbacks = {
			open: [],
			close: [],
			error: [],
			message: []
		}, this.channels = [], this.sendBuffer = [], this.ref = 0, this.fallbackRef = null, this.timeout = t.timeout || Be, this.transport = t.transport || Re.WebSocket || et, this.conn = void 0, this.primaryPassedHealthCheck = !1, this.longPollFallbackMs = t.longPollFallbackMs, this.fallbackTimer = null;
		let n = null;
		try {
			n = Re && Re.sessionStorage;
		} catch {}
		this.sessionStore = t.sessionStorage || n, this.establishedConnections = 0, this.defaultEncoder = nt.encode.bind(nt), this.defaultDecoder = nt.decode.bind(nt), this.closeWasClean = !0, this.disconnecting = !1, this.binaryType = t.binaryType || "arraybuffer", this.connectClock = 1, this.pageHidden = !1, this.encode = void 0, this.decode = void 0, this.transport === et ? (this.encode = this.defaultEncoder, this.decode = this.defaultDecoder) : (this.encode = t.encode || this.defaultEncoder, this.decode = t.decode || this.defaultDecoder);
		let r = null;
		Le && Le.addEventListener && (Le.addEventListener("pagehide", (e) => {
			this.conn && (this.disconnect(), r = this.connectClock);
		}), Le.addEventListener("pageshow", (e) => {
			r === this.connectClock && (r = null, this.connect());
		}), Le.addEventListener("visibilitychange", () => {
			document.visibilityState === "hidden" ? this.pageHidden = !0 : (this.pageHidden = !1, !this.isConnected() && !this.closeWasClean && this.teardown(() => this.connect()));
		})), this.heartbeatIntervalMs = t.heartbeatIntervalMs || 3e4, this.autoSendHeartbeat = t.autoSendHeartbeat ?? !0, this.heartbeatCallback = t.heartbeatCallback ?? (() => {}), this.rejoinAfterMs = (e) => t.rejoinAfterMs ? t.rejoinAfterMs(e) : [
			1e3,
			2e3,
			5e3
		][e - 1] || 1e4, this.reconnectAfterMs = (e) => t.reconnectAfterMs ? t.reconnectAfterMs(e) : [
			10,
			50,
			100,
			150,
			200,
			250,
			500,
			1e3,
			2e3
		][e - 1] || 5e3, this.logger = t.logger || null, !this.logger && t.debug && (this.logger = (e, t, n) => {
			console.log(`${e}: ${t}`, n);
		}), this.longpollerTimeout = t.longpollerTimeout || 2e4, this.params = Fe(t.params || {}), this.endPoint = `${e}/${Ke.websocket}`, this.vsn = t.vsn || ze, this.heartbeatTimeoutTimer = null, this.heartbeatTimer = null, this.heartbeatSentAt = null, this.pendingHeartbeatRef = null, this.reconnectTimer = new Xe(() => {
			if (this.pageHidden) {
				this.log("Not reconnecting as page is hidden!"), this.teardown();
				return;
			}
			this.teardown(async () => {
				t.beforeReconnect && await t.beforeReconnect(), this.connect();
			});
		}, this.reconnectAfterMs), this.authToken = t.authToken && Fe(t.authToken);
	}
	getLongPollTransport() {
		return et;
	}
	replaceTransport(e) {
		this.connectClock++, this.closeWasClean = !0, clearTimeout(this.fallbackTimer), this.reconnectTimer.reset(), this.conn &&= (this.conn.close(), null), this.transport = e;
	}
	protocol() {
		return location.protocol.match(/^https/) ? "wss" : "ws";
	}
	endPointURL() {
		let e = Qe.appendParams(Qe.appendParams(this.endPoint, this.params()), { vsn: this.vsn });
		return e.charAt(0) === "/" ? e.charAt(1) === "/" ? `${this.protocol()}:${e}` : `${this.protocol()}://${location.host}${e}` : e;
	}
	disconnect(e, t, n) {
		this.connectClock++, this.disconnecting = !0, this.closeWasClean = !0, clearTimeout(this.fallbackTimer), this.reconnectTimer.reset(), this.teardown(() => {
			this.disconnecting = !1, e && e();
		}, t, n);
	}
	connect(e) {
		e && (console && console.log("passing params to connect is deprecated. Instead pass :params to the Socket constructor"), this.params = Fe(e)), (!this.conn || this.disconnecting) && (this.longPollFallbackMs && this.transport !== et ? this.connectWithFallback(et, this.longPollFallbackMs) : this.transportConnect());
	}
	log(e, t, n) {
		this.logger && this.logger(e, t, n);
	}
	hasLogger() {
		return this.logger !== null;
	}
	onOpen(e) {
		let t = this.makeRef();
		return this.stateChangeCallbacks.open.push([t, e]), t;
	}
	onClose(e) {
		let t = this.makeRef();
		return this.stateChangeCallbacks.close.push([t, e]), t;
	}
	onError(e) {
		let t = this.makeRef();
		return this.stateChangeCallbacks.error.push([t, e]), t;
	}
	onMessage(e) {
		let t = this.makeRef();
		return this.stateChangeCallbacks.message.push([t, e]), t;
	}
	onHeartbeat(e) {
		this.heartbeatCallback = e;
	}
	ping(e) {
		if (!this.isConnected()) return !1;
		let t = this.makeRef(), n = Date.now();
		this.push({
			topic: "phoenix",
			event: "heartbeat",
			payload: {},
			ref: t
		});
		let r = this.onMessage((i) => {
			i.ref === t && (this.off([r]), e(Date.now() - n));
		});
		return !0;
	}
	transportName(e) {
		switch (e) {
			case et: return "LongPoll";
			default: return e.name;
		}
	}
	transportConnect() {
		this.connectClock++, this.closeWasClean = !1;
		let e;
		this.authToken && (e = ["phoenix", `${Je}${btoa(this.authToken()).replace(/=/g, "")}`]), this.conn = new this.transport(this.endPointURL(), e), this.conn.binaryType = this.binaryType, this.conn.timeout = this.longpollerTimeout, this.conn.onopen = () => this.onConnOpen(), this.conn.onerror = (e) => this.onConnError(e), this.conn.onmessage = (e) => this.onConnMessage(e), this.conn.onclose = (e) => this.onConnClose(e);
	}
	getSession(e) {
		return this.sessionStore && this.sessionStore.getItem(e);
	}
	storeSession(e, t) {
		this.sessionStore && this.sessionStore.setItem(e, t);
	}
	connectWithFallback(e, t = 2500) {
		clearTimeout(this.fallbackTimer);
		let n = !1, r = !0, i, a, o = this.transportName(e), s = (t) => {
			this.log("transport", `falling back to ${o}...`, t), this.off([i, a]), r = !1, this.replaceTransport(e), this.transportConnect();
		};
		if (this.getSession(`phx:fallback:${o}`)) return s("memorized");
		this.fallbackTimer = setTimeout(s, t), a = this.onError((e) => {
			this.log("transport", "error", e), r && !n && (clearTimeout(this.fallbackTimer), s(e));
		}), this.fallbackRef && this.off([this.fallbackRef]), this.fallbackRef = this.onOpen(() => {
			if (n = !0, !r) {
				let t = this.transportName(e);
				return this.primaryPassedHealthCheck || this.storeSession(`phx:fallback:${t}`, "true"), this.log("transport", `established ${t} fallback`);
			}
			clearTimeout(this.fallbackTimer), this.fallbackTimer = setTimeout(s, t), this.ping((e) => {
				this.log("transport", "connected to primary after", e), this.primaryPassedHealthCheck = !0, clearTimeout(this.fallbackTimer);
			});
		}), this.transportConnect();
	}
	clearHeartbeats() {
		clearTimeout(this.heartbeatTimer), clearTimeout(this.heartbeatTimeoutTimer);
	}
	onConnOpen() {
		this.hasLogger() && this.log("transport", `connected to ${this.endPointURL()}`), this.closeWasClean = !1, this.disconnecting = !1, this.establishedConnections++, this.flushSendBuffer(), this.reconnectTimer.reset(), this.autoSendHeartbeat && this.resetHeartbeat(), this.triggerStateCallbacks("open");
	}
	heartbeatTimeout() {
		if (this.pendingHeartbeatRef) {
			this.pendingHeartbeatRef = null, this.heartbeatSentAt = null, this.hasLogger() && this.log("transport", "heartbeat timeout. Attempting to re-establish connection");
			try {
				this.heartbeatCallback("timeout");
			} catch (e) {
				this.log("error", "error in heartbeat callback", e);
			}
			this.triggerChanError(/* @__PURE__ */ Error("heartbeat timeout")), this.closeWasClean = !1, this.teardown(() => this.reconnectTimer.scheduleTimeout(), Ve, "heartbeat timeout");
		}
	}
	resetHeartbeat() {
		this.conn && this.conn.skipHeartbeat || (this.pendingHeartbeatRef = null, this.clearHeartbeats(), this.heartbeatTimer = setTimeout(() => this.sendHeartbeat(), this.heartbeatIntervalMs));
	}
	teardown(e, t, n) {
		if (!this.conn) return e && e();
		let r = this.conn;
		this.waitForBufferDone(r, () => {
			t ? r.close(t, n || "") : r.close(), this.waitForSocketClosed(r, () => {
				this.conn === r && (this.conn.onopen = function() {}, this.conn.onerror = function() {}, this.conn.onmessage = function() {}, this.conn.onclose = function() {}, this.conn = null), e && e();
			});
		});
	}
	waitForBufferDone(e, t, n = 1) {
		if (n === 5 || !e.bufferedAmount) {
			t();
			return;
		}
		setTimeout(() => {
			this.waitForBufferDone(e, t, n + 1);
		}, 150 * n);
	}
	waitForSocketClosed(e, t, n = 1) {
		if (n === 5 || e.readyState === Ue.closed) {
			t();
			return;
		}
		setTimeout(() => {
			this.waitForSocketClosed(e, t, n + 1);
		}, 150 * n);
	}
	onConnClose(e) {
		this.conn && (this.conn.onclose = () => {}), this.hasLogger() && this.log("transport", "close", e), this.triggerChanError(e), this.clearHeartbeats(), this.closeWasClean || this.reconnectTimer.scheduleTimeout(), this.triggerStateCallbacks("close", e);
	}
	onConnError(e) {
		this.hasLogger() && this.log("transport", "error", e);
		let t = this.transport, n = this.establishedConnections;
		this.triggerStateCallbacks("error", e, t, n), (t === this.transport || n > 0) && this.triggerChanError(e);
	}
	triggerChanError(e) {
		this.channels.forEach((t) => {
			t.isErrored() || t.isLeaving() || t.isClosed() || t.trigger(Ge.error, e);
		});
	}
	connectionState() {
		switch (this.conn && this.conn.readyState) {
			case Ue.connecting: return "connecting";
			case Ue.open: return "open";
			case Ue.closing: return "closing";
			default: return "closed";
		}
	}
	isConnected() {
		return this.connectionState() === "open";
	}
	remove(e) {
		this.off(e.stateChangeRefs), this.channels = this.channels.filter((t) => t !== e);
	}
	off(e) {
		for (let t in this.stateChangeCallbacks) this.stateChangeCallbacks[t] = this.stateChangeCallbacks[t].filter(([t]) => e.indexOf(t) === -1);
	}
	channel(e, t = {}) {
		let n = new Ze(e, t, this);
		return this.channels.push(n), n;
	}
	push(e) {
		if (this.hasLogger()) {
			let { topic: t, event: n, payload: r, ref: i, join_ref: a } = e;
			this.log("push", `${t} ${n} (${a}, ${i})`, r);
		}
		this.isConnected() ? this.encode(e, (e) => this.conn.send(e)) : this.sendBuffer.push(() => this.encode(e, (e) => this.conn.send(e)));
	}
	makeRef() {
		let e = this.ref + 1;
		return this.ref = e === this.ref ? 0 : e, this.ref.toString();
	}
	sendHeartbeat() {
		if (!this.isConnected()) {
			try {
				this.heartbeatCallback("disconnected");
			} catch (e) {
				this.log("error", "error in heartbeat callback", e);
			}
			return;
		}
		if (this.pendingHeartbeatRef) {
			this.heartbeatTimeout();
			return;
		}
		this.pendingHeartbeatRef = this.makeRef(), this.heartbeatSentAt = Date.now(), this.push({
			topic: "phoenix",
			event: "heartbeat",
			payload: {},
			ref: this.pendingHeartbeatRef
		});
		try {
			this.heartbeatCallback("sent");
		} catch (e) {
			this.log("error", "error in heartbeat callback", e);
		}
		this.heartbeatTimeoutTimer = setTimeout(() => this.heartbeatTimeout(), this.heartbeatIntervalMs);
	}
	flushSendBuffer() {
		this.isConnected() && this.sendBuffer.length > 0 && (this.sendBuffer.forEach((e) => e()), this.sendBuffer = []);
	}
	onConnMessage(e) {
		this.decode(e.data, (e) => {
			let { topic: t, event: n, payload: r, ref: i, join_ref: a } = e;
			if (i && i === this.pendingHeartbeatRef) {
				let e = this.heartbeatSentAt ? Date.now() - this.heartbeatSentAt : void 0;
				this.clearHeartbeats();
				try {
					this.heartbeatCallback(r.status === "ok" ? "ok" : "error", e);
				} catch (e) {
					this.log("error", "error in heartbeat callback", e);
				}
				this.pendingHeartbeatRef = null, this.heartbeatSentAt = null, this.autoSendHeartbeat && (this.heartbeatTimer = setTimeout(() => this.sendHeartbeat(), this.heartbeatIntervalMs));
			}
			this.hasLogger() && this.log("receive", `${r.status || ""} ${t} ${n} ${i && "(" + i + ")" || ""}`.trim(), r);
			for (let e = 0; e < this.channels.length; e++) {
				let o = this.channels[e];
				o.isMember(t, n, r, a) && o.trigger(n, r, i, a);
			}
			this.triggerStateCallbacks("message", e);
		});
	}
	triggerStateCallbacks(e, ...t) {
		try {
			this.stateChangeCallbacks[e].forEach(([n, r]) => {
				try {
					r(...t);
				} catch (t) {
					this.log("error", `error in ${e} callback`, t);
				}
			});
		} catch (t) {
			this.log("error", `error triggering ${e} callbacks`, t);
		}
	}
	leaveOpenTopic(e) {
		let t = this.channels.find((t) => t.topic === e && (t.isJoined() || t.isJoining()));
		t && (this.hasLogger() && this.log("transport", `leaving duplicate topic "${e}"`), t.leave());
	}
}, it = class e {
	constructor(t, n) {
		let r = st(n);
		this.presence = new tt(t.getChannel(), r), this.presence.onJoin((n, r, i) => {
			let a = e.onJoinPayload(n, r, i);
			t.getChannel().trigger("presence", a);
		}), this.presence.onLeave((n, r, i) => {
			let a = e.onLeavePayload(n, r, i);
			t.getChannel().trigger("presence", a);
		}), this.presence.onSync(() => {
			t.getChannel().trigger("presence", { event: "sync" });
		});
	}
	get state() {
		return e.transformState(this.presence.state);
	}
	static transformState(e) {
		return e = ot(e), Object.getOwnPropertyNames(e).reduce((t, n) => {
			let r = e[n];
			return t[n] = at(r), t;
		}, {});
	}
	static onJoinPayload(e, t, n) {
		return {
			event: "join",
			key: e,
			currentPresences: ct(t),
			newPresences: at(n)
		};
	}
	static onLeavePayload(e, t, n) {
		return {
			event: "leave",
			key: e,
			currentPresences: ct(t),
			leftPresences: at(n)
		};
	}
};
function at(e) {
	return e.metas.map((e) => {
		let t = Object.getOwnPropertyDescriptors(e), n = Object.defineProperties({}, t);
		return n.presence_ref = n.phx_ref, delete n.phx_ref, delete n.phx_ref_prev, n;
	});
}
function ot(e) {
	return JSON.parse(JSON.stringify(e));
}
function st(e) {
	return e?.events && { events: e.events };
}
function ct(e) {
	return e?.metas ? at(e) : [];
}
//#endregion
//#region ../social-media-generator/node_modules/@supabase/realtime-js/dist/module/RealtimePresence.js
var lt;
(function(e) {
	e.SYNC = "sync", e.JOIN = "join", e.LEAVE = "leave";
})(lt ||= {});
var ut = class {
	get state() {
		return this.presenceAdapter.state;
	}
	constructor(e, t) {
		this.channel = e, this.presenceAdapter = new it(this.channel.channelAdapter, t);
	}
};
//#endregion
//#region ../social-media-generator/node_modules/@supabase/realtime-js/dist/module/lib/normalizeChannelError.js
function dt(e) {
	if (e instanceof Error) return e;
	if (typeof e == "string") return Error(e);
	if (e && typeof e == "object") {
		let t = e;
		if (typeof t.code == "number") {
			let n = typeof t.reason == "string" && t.reason ? ` (${t.reason})` : "";
			return Error(`socket closed: ${t.code}${n}`, { cause: e });
		}
		return Error("channel error: transport failure", { cause: e });
	}
	return /* @__PURE__ */ Error("channel error: connection lost");
}
//#endregion
//#region ../social-media-generator/node_modules/@supabase/realtime-js/dist/module/phoenix/channelAdapter.js
var ft = class {
	constructor(e, t, n) {
		let r = pt(n);
		this.channel = e.getSocket().channel(t, r), this.socket = e;
	}
	get state() {
		return this.channel.state;
	}
	set state(e) {
		this.channel.state = e;
	}
	get joinedOnce() {
		return this.channel.joinedOnce;
	}
	get joinPush() {
		return this.channel.joinPush;
	}
	get rejoinTimer() {
		return this.channel.rejoinTimer;
	}
	on(e, t) {
		return this.channel.on(e, t);
	}
	off(e, t) {
		this.channel.off(e, t);
	}
	subscribe(e) {
		return this.channel.join(e);
	}
	unsubscribe(e) {
		return this.channel.leave(e);
	}
	teardown() {
		this.channel.teardown();
	}
	onClose(e) {
		this.channel.onClose(e);
	}
	onError(e) {
		return this.channel.onError(e);
	}
	push(e, t, n) {
		let r;
		try {
			r = this.channel.push(e, t, n);
		} catch {
			throw Error(`tried to push '${e}' to '${this.channel.topic}' before joining. Use channel.subscribe() before pushing events`);
		}
		if (this.channel.pushBuffer.length > 100) {
			let e = this.channel.pushBuffer.shift();
			e.cancelTimeout(), this.socket.log("channel", `discarded push due to buffer overflow: ${e.event}`, e.payload());
		}
		return r;
	}
	updateJoinPayload(e) {
		let t = this.channel.joinPush.payload();
		this.channel.joinPush.payload = () => Object.assign(Object.assign({}, t), e);
	}
	canPush() {
		return this.socket.isConnected() && this.state === k.joined;
	}
	isJoined() {
		return this.state === k.joined;
	}
	isJoining() {
		return this.state === k.joining;
	}
	isClosed() {
		return this.state === k.closed;
	}
	isLeaving() {
		return this.state === k.leaving;
	}
	updateFilterBindings(e) {
		this.channel.filterBindings = e;
	}
	updatePayloadTransform(e) {
		this.channel.onMessage = e;
	}
	getChannel() {
		return this.channel;
	}
};
function pt(e) {
	return { config: Object.assign({
		broadcast: {
			ack: !1,
			self: !1
		},
		presence: {
			key: "",
			enabled: !1
		},
		private: !1
	}, e.config) };
}
//#endregion
//#region ../social-media-generator/node_modules/@supabase/realtime-js/dist/module/RealtimePostgresFilterBuilder.js
var mt = /[,()"\\]/, ht = (e) => mt.test(e) || e !== e.trim(), gt = (e) => `"${e.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`, _t = (e) => {
	let t = e === null ? "null" : String(e);
	return ht(t) ? gt(t) : t;
}, vt = (e) => e === null ? "null" : String(e), yt = (e, t) => {
	if (e === "in") {
		let e = Array.isArray(t) ? t : [t];
		if (e.length === 0) throw Error("Realtime `in` filter requires at least one value.");
		return `in.(${Array.from(new Set(e)).map((e) => _t(e)).join(",")})`;
	}
	return e === "is" ? `is.${vt(t)}` : `${e}.${_t(t)}`;
}, bt = class {
	constructor() {
		this.filters = [];
	}
	add(e, t, n, r = !1) {
		let i = r ? "not." : "";
		return this.filters.push(`${e}=${i}${yt(t, n)}`), this;
	}
	eq(e, t) {
		return this.add(e, "eq", t);
	}
	neq(e, t) {
		return this.add(e, "neq", t);
	}
	gt(e, t) {
		return this.add(e, "gt", t);
	}
	gte(e, t) {
		return this.add(e, "gte", t);
	}
	lt(e, t) {
		return this.add(e, "lt", t);
	}
	lte(e, t) {
		return this.add(e, "lte", t);
	}
	in(e, t) {
		return this.add(e, "in", t);
	}
	like(e, t) {
		return this.add(e, "like", t);
	}
	ilike(e, t) {
		return this.add(e, "ilike", t);
	}
	match(e, t) {
		return this.add(e, "match", t);
	}
	imatch(e, t) {
		return this.add(e, "imatch", t);
	}
	is(e, t) {
		return this.add(e, "is", t);
	}
	isDistinct(e, t) {
		return this.add(e, "isdistinct", t);
	}
	not(e, t, n) {
		return this.add(e, t, n, !0);
	}
	build() {
		return this.filters.join(",");
	}
	toString() {
		return this.build();
	}
}, xt;
(function(e) {
	e.ALL = "*", e.INSERT = "INSERT", e.UPDATE = "UPDATE", e.DELETE = "DELETE";
})(xt ||= {});
var St;
(function(e) {
	e.BROADCAST = "broadcast", e.PRESENCE = "presence", e.POSTGRES_CHANGES = "postgres_changes", e.SYSTEM = "system";
})(St ||= {});
var Ct;
(function(e) {
	e.SUBSCRIBED = "SUBSCRIBED", e.TIMED_OUT = "TIMED_OUT", e.CLOSED = "CLOSED", e.CHANNEL_ERROR = "CHANNEL_ERROR";
})(Ct ||= {});
var wt = class e {
	get state() {
		return this.channelAdapter.state;
	}
	set state(e) {
		this.channelAdapter.state = e;
	}
	get joinedOnce() {
		return this.channelAdapter.joinedOnce;
	}
	get timeout() {
		return this.socket.timeout;
	}
	get joinPush() {
		return this.channelAdapter.joinPush;
	}
	get rejoinTimer() {
		return this.channelAdapter.rejoinTimer;
	}
	constructor(e, t = { config: {} }, n) {
		if (this.topic = e, this.params = t, this.socket = n, this.bindings = {}, this.subTopic = e.replace(/^realtime:/i, ""), this.params.config = Object.assign({
			broadcast: {
				ack: !1,
				self: !1
			},
			presence: {
				key: "",
				enabled: !1
			},
			private: !1
		}, t.config), this.channelAdapter = new ft(this.socket.socketAdapter, e, this.params), this.presence = new ut(this), this._onClose(() => {
			this.socket._remove(this);
		}), this._updateFilterTransform(), this.broadcastEndpointURL = Pe(this.socket.socketAdapter.endPointURL()), this.private = this.params.config.private || !1, !this.private && this.params.config?.broadcast?.replay) throw Error(`tried to use replay on public channel '${this.topic}'. It must be a private channel.`);
	}
	subscribe(e, t = this.timeout) {
		if (this.socket.isConnected() || this.socket.connect(), this.channelAdapter.isClosed()) {
			let { config: { broadcast: n, presence: r, private: i, postgres_changes_options: a } } = this.params, o = this.bindings.postgres_changes?.map((e) => e.filter) ?? [], s = !!this.bindings[St.PRESENCE] && this.bindings[St.PRESENCE].length > 0 || this.params.config.presence?.enabled === !0, c = {}, l = Object.assign({
				broadcast: n,
				presence: Object.assign(Object.assign({}, r), { enabled: s }),
				postgres_changes: o,
				private: i
			}, a ? { postgres_changes_options: a } : {});
			this.socket.accessTokenValue && (c.access_token = this.socket.accessTokenValue), this._onError((t) => {
				e?.(Ct.CHANNEL_ERROR, dt(t));
			}), this._onClose(() => e?.(Ct.CLOSED)), this.updateJoinPayload(Object.assign({ config: l }, c)), this._updateFilterMessage();
			let u = a?.wait && o.length > 0 ? Math.max(t, (a.timeout ?? Se) + O) : t;
			this.channelAdapter.subscribe(u).receive("ok", async ({ postgres_changes: t }) => {
				if (this.socket._isManualToken() || this.socket.setAuth(), t === void 0) {
					e?.(Ct.SUBSCRIBED);
					return;
				}
				this._updatePostgresBindings(t, e);
			}).receive("error", (t) => {
				this.state = k.errored;
				let n = Object.values(t).join(", ") || "error";
				e?.(Ct.CHANNEL_ERROR, Error(n, { cause: t }));
			}).receive("timeout", () => {
				e?.(Ct.TIMED_OUT);
			});
		}
		return this;
	}
	_updatePostgresBindings(t, n) {
		let r = this.bindings.postgres_changes, i = r?.length ?? 0, a = [];
		for (let o = 0; o < i; o++) {
			let i = r[o], { filter: { event: s, schema: c, table: l, filter: u } } = i, d = t && t[o];
			if (d && d.event === s && e.isFilterValueEqual(d.schema, c) && e.isFilterValueEqual(d.table, l) && e.isFilterValueEqual(d.filter, u)) a.push(Object.assign(Object.assign({}, i), { id: d.id }));
			else {
				this.unsubscribe(), this.state = k.errored, n?.(Ct.CHANNEL_ERROR, /* @__PURE__ */ Error("mismatch between server and client bindings for postgres changes"));
				return;
			}
		}
		this.bindings.postgres_changes = a, this.state != k.errored && n && n(Ct.SUBSCRIBED);
	}
	presenceState() {
		return this.presence.state;
	}
	async track(e, t = {}) {
		return await this.send({
			type: "presence",
			event: "track",
			payload: e
		}, t);
	}
	async untrack(e = {}) {
		return await this.send({
			type: "presence",
			event: "untrack"
		}, e);
	}
	on(e, t, n) {
		let r = this.channelAdapter.isJoined() || this.channelAdapter.isJoining(), i = e === St.PRESENCE || e === St.POSTGRES_CHANGES;
		if (r && i) throw this.socket.log("channel", `cannot add \`${e}\` callbacks for ${this.topic} after \`subscribe()\`.`), Error(`cannot add \`${e}\` callbacks for ${this.topic} after \`subscribe()\`.`);
		return this._on(e, t, n);
	}
	async httpSend(e, t, n = {}) {
		if (t == null) return Promise.reject(/* @__PURE__ */ Error("Payload is required for httpSend()"));
		let r = t instanceof ArrayBuffer || ArrayBuffer.isView(t), i = {
			apikey: this.socket.apiKey ? this.socket.apiKey : "",
			"Content-Type": r ? "application/octet-stream" : "application/json"
		};
		this.socket.accessTokenValue && (i.Authorization = `Bearer ${this.socket.accessTokenValue}`);
		let a = new URL(this.broadcastEndpointURL);
		a.pathname += `/${encodeURIComponent(this.subTopic)}/events/${encodeURIComponent(e)}`, this.private && a.searchParams.set("private", "true");
		let o = {
			method: "POST",
			headers: i,
			body: r ? t : JSON.stringify(t)
		}, s = await this._fetchWithTimeout(a.toString(), o, n.timeout ?? this.timeout);
		if (s.status === 202) return { success: !0 };
		if (s.status === 404) return Promise.reject(/* @__PURE__ */ Error("httpSend() requires Realtime server v2.97.0 or newer; the endpoint returned 404. Update your Supabase CLI to a recent version, or upgrade the Realtime server in your self-hosted setup. See https://github.com/supabase/supabase-js/blob/master/packages/core/realtime-js/migrations/httpsend-server-version.md"));
		let c = s.statusText;
		try {
			let e = await s.json();
			c = e.error || e.message || c;
		} catch {}
		return Promise.reject(Error(c));
	}
	async send(e, t = {}) {
		if (!this.channelAdapter.canPush() && e.type === "broadcast") {
			let n = "Realtime send() is automatically falling back to REST API. This behavior will be deprecated in the future. Please use httpSend() explicitly for REST delivery.";
			this.socket.hasLogger() ? this.socket.log("channel", n) : console.warn(n);
			let { event: r, payload: i } = e, a = {
				apikey: this.socket.apiKey ? this.socket.apiKey : "",
				"Content-Type": "application/json"
			};
			this.socket.accessTokenValue && (a.Authorization = `Bearer ${this.socket.accessTokenValue}`);
			let o = {
				method: "POST",
				headers: a,
				body: JSON.stringify({ messages: [{
					topic: this.subTopic,
					event: r,
					payload: i,
					private: this.private
				}] })
			};
			try {
				let e = await this._fetchWithTimeout(this.broadcastEndpointURL, o, t.timeout ?? this.timeout);
				return await e.body?.cancel(), e.ok ? "ok" : "error";
			} catch (e) {
				return e instanceof Error && e.name === "AbortError" ? "timed out" : "error";
			}
		}
		return new Promise((n) => {
			let r = this.channelAdapter.push(e.type, e, t.timeout || this.timeout);
			e.type === "broadcast" && !this.params?.config?.broadcast?.ack && n("ok"), r.receive("ok", () => n("ok")), r.receive("error", () => n("error")), r.receive("timeout", () => n("timed out"));
		});
	}
	updateJoinPayload(e) {
		this.channelAdapter.updateJoinPayload(e);
	}
	async unsubscribe(e = this.timeout) {
		return new Promise((t) => {
			this.channelAdapter.unsubscribe(e).receive("ok", () => t("ok")).receive("timeout", () => t("timed out")).receive("error", () => t("error"));
		});
	}
	teardown() {
		this.channelAdapter.teardown();
	}
	async _fetchWithTimeout(e, t, n) {
		let r = new AbortController(), i = setTimeout(() => r.abort(), n), a = await this.socket.fetch(e, Object.assign(Object.assign({}, t), { signal: r.signal }));
		return clearTimeout(i), a;
	}
	_on(t, n, r) {
		let i = t.toLocaleLowerCase(), a = n?.filter;
		if ((a instanceof bt || typeof a == "object" && a && typeof a.build == "function") && (n = Object.assign(Object.assign({}, n), { filter: a.build() })), i === St.POSTGRES_CHANGES && this.bindings[i]?.find((t) => e.isSamePostgresFilter(t.filter, n))) return this.socket.log("error", `duplicate \`postgres_changes\` binding for ${this.topic} ignored`, n), this;
		let o = this.channelAdapter.on(t, r), s = {
			type: i,
			filter: n,
			callback: r,
			ref: o
		};
		return this.bindings[i] ? this.bindings[i].push(s) : this.bindings[i] = [s], this._updateFilterMessage(), this;
	}
	_onClose(e) {
		this.channelAdapter.onClose(e);
	}
	_onError(e) {
		this.channelAdapter.onError(e);
	}
	_updateFilterMessage() {
		this.channelAdapter.updateFilterBindings((e, t, n) => {
			let r = e.event.toLocaleLowerCase();
			if (this._notThisChannelEvent(r, n)) return !1;
			let i = this.bindings[r]?.find((t) => t.ref === e.ref);
			if (!i) return !0;
			if ([
				"broadcast",
				"presence",
				"postgres_changes"
			].includes(r)) {
				if ("id" in i) {
					let e = i.id, n = i.filter?.event;
					return e && t.ids?.includes(e) && (n === "*" || n?.toLocaleLowerCase() === t.data?.type.toLocaleLowerCase());
				}
				{
					let e = (i?.filter?.event)?.toLocaleLowerCase();
					return e === "*" || e === (t?.event)?.toLocaleLowerCase();
				}
			}
			return i.type.toLocaleLowerCase() === r;
		});
	}
	_notThisChannelEvent(e, t) {
		let { close: n, error: r, leave: i, join: a } = Ce;
		return t && [
			n,
			r,
			i,
			a
		].includes(e) && t !== this.joinPush.ref;
	}
	_updateFilterTransform() {
		this.channelAdapter.updatePayloadTransform((e, t, n) => {
			if (typeof t == "object" && "ids" in t) {
				let e = t.data, { schema: n, table: r, commit_timestamp: i, type: a, errors: o } = e;
				return Object.assign(Object.assign({}, {
					schema: n,
					table: r,
					commit_timestamp: i,
					eventType: a,
					new: {},
					old: {},
					errors: o
				}), this._getPayloadRecords(e));
			}
			return t;
		});
	}
	copyBindings(e) {
		if (this.joinedOnce) throw Error("cannot copy bindings into joined channel");
		for (let t in e.bindings) for (let n of e.bindings[t]) this._on(n.type, n.filter, n.callback);
	}
	static isFilterValueEqual(e, t) {
		return (e ?? void 0) === (t ?? void 0);
	}
	static isSamePostgresFilter(t, n) {
		let r = (t?.select)?.join() ?? void 0, i = (n?.select)?.join() ?? void 0;
		return t?.event === n?.event && e.isFilterValueEqual(t?.schema, n?.schema) && e.isFilterValueEqual(t?.table, n?.table) && e.isFilterValueEqual(t?.filter, n?.filter) && r === i;
	}
	_getPayloadRecords(e) {
		let t = {
			new: {},
			old: {}
		};
		return (e.type === "INSERT" || e.type === "UPDATE") && (t.new = Ee(e.columns, e.record)), (e.type === "UPDATE" || e.type === "DELETE") && (t.old = Ee(e.columns, e.old_record)), t;
	}
}, Tt = class {
	constructor(e, t) {
		this.socket = new rt(e, t);
	}
	get timeout() {
		return this.socket.timeout;
	}
	get endPoint() {
		return this.socket.endPoint;
	}
	get transport() {
		return this.socket.transport;
	}
	get heartbeatIntervalMs() {
		return this.socket.heartbeatIntervalMs;
	}
	get heartbeatCallback() {
		return this.socket.heartbeatCallback;
	}
	set heartbeatCallback(e) {
		this.socket.heartbeatCallback = e;
	}
	get heartbeatTimer() {
		return this.socket.heartbeatTimer;
	}
	get pendingHeartbeatRef() {
		return this.socket.pendingHeartbeatRef;
	}
	get reconnectTimer() {
		return this.socket.reconnectTimer;
	}
	get vsn() {
		return this.socket.vsn;
	}
	get encode() {
		return this.socket.encode;
	}
	get decode() {
		return this.socket.decode;
	}
	get reconnectAfterMs() {
		return this.socket.reconnectAfterMs;
	}
	get sendBuffer() {
		return this.socket.sendBuffer;
	}
	get stateChangeCallbacks() {
		return this.socket.stateChangeCallbacks;
	}
	connect() {
		this.socket.connect();
	}
	disconnect(e, t, n, r = 1e4) {
		return new Promise((i) => {
			setTimeout(() => i("timeout"), r), this.socket.disconnect(() => {
				e(), i("ok");
			}, t, n);
		});
	}
	push(e) {
		this.socket.push(e);
	}
	log(e, t, n) {
		this.socket.log(e, t, n);
	}
	hasLogger() {
		return this.socket.hasLogger();
	}
	makeRef() {
		return this.socket.makeRef();
	}
	onOpen(e) {
		this.socket.onOpen(e);
	}
	onClose(e) {
		this.socket.onClose(e);
	}
	onError(e) {
		this.socket.onError(e);
	}
	onMessage(e) {
		this.socket.onMessage(e);
	}
	isConnected() {
		return this.socket.isConnected();
	}
	isConnecting() {
		return this.socket.connectionState() == we.connecting;
	}
	isDisconnecting() {
		return this.socket.connectionState() == we.closing;
	}
	connectionState() {
		return this.socket.connectionState();
	}
	endPointURL() {
		return this.socket.endPointURL();
	}
	sendHeartbeat() {
		this.socket.sendHeartbeat();
	}
	getSocket() {
		return this.socket;
	}
}, Et = {
	HEARTBEAT_INTERVAL: 25e3,
	RECONNECT_DELAY: 10,
	HEARTBEAT_TIMEOUT_FALLBACK: 100
}, Dt = [
	1e3,
	2e3,
	5e3,
	1e4
], Ot = 1e4;
function kt() {
	let e = /* @__PURE__ */ new Map();
	return {
		get length() {
			return e.size;
		},
		clear() {
			e.clear();
		},
		getItem(t) {
			return e.has(t) ? e.get(t) : null;
		},
		key(t) {
			return Array.from(e.keys())[t] ?? null;
		},
		removeItem(t) {
			e.delete(t);
		},
		setItem(t, n) {
			e.set(t, String(n));
		}
	};
}
function At() {
	try {
		if (typeof globalThis < "u" && globalThis.sessionStorage) return globalThis.sessionStorage;
	} catch {}
	return kt();
}
var jt = "\n  addEventListener(\"message\", (e) => {\n    if (e.data.event === \"start\") {\n      setInterval(() => postMessage({ event: \"keepAlive\" }), e.data.interval);\n    }\n  });", Mt = class {
	get endPoint() {
		return this.socketAdapter.endPoint;
	}
	get timeout() {
		return this.socketAdapter.timeout;
	}
	get transport() {
		return this.socketAdapter.transport;
	}
	get heartbeatCallback() {
		return this.socketAdapter.heartbeatCallback;
	}
	get heartbeatIntervalMs() {
		return this.socketAdapter.heartbeatIntervalMs;
	}
	get heartbeatTimer() {
		return this.worker ? this._workerHeartbeatTimer : this.socketAdapter.heartbeatTimer;
	}
	get pendingHeartbeatRef() {
		return this.worker ? this._pendingWorkerHeartbeatRef : this.socketAdapter.pendingHeartbeatRef;
	}
	get reconnectTimer() {
		return this.socketAdapter.reconnectTimer;
	}
	get vsn() {
		return this.socketAdapter.vsn;
	}
	get encode() {
		return this.socketAdapter.encode;
	}
	get decode() {
		return this.socketAdapter.decode;
	}
	get reconnectAfterMs() {
		return this.socketAdapter.reconnectAfterMs;
	}
	get sendBuffer() {
		return this.socketAdapter.sendBuffer;
	}
	get stateChangeCallbacks() {
		return this.socketAdapter.stateChangeCallbacks;
	}
	constructor(e, t) {
		if (this.channels = [], this.accessTokenValue = null, this.accessToken = null, this.apiKey = null, this.httpEndpoint = "", this.headers = {}, this.params = {}, this.ref = 0, this.serializer = new Te(), this._manuallySetToken = !1, this._authPromise = null, this._authGeneration = 0, this._workerHeartbeatTimer = void 0, this._pendingWorkerHeartbeatRef = null, this._pendingDisconnectTimer = null, this._disconnectOnEmptyChannelsAfterMs = 0, this._resolveFetch = (e) => e ? (...t) => e(...t) : (...e) => fetch(...e), !t?.params?.apikey) throw Error("API key is required to connect to Realtime");
		this.apiKey = t.params.apikey;
		let n = this._initializeOptions(t);
		this.socketAdapter = new Tt(e, n), this.httpEndpoint = Pe(e), this.fetch = this._resolveFetch(t?.fetch);
	}
	connect() {
		if (!(this.isConnecting() || this.isDisconnecting() || this.isConnected())) {
			this.accessToken && !this._authPromise && this._setAuthSafely("connect"), this._setupConnectionHandlers();
			try {
				this.socketAdapter.connect();
			} catch (e) {
				let t = e.message;
				throw Error(`WebSocket not available: ${t}`);
			}
			this._handleNodeJsRaceCondition();
		}
	}
	endpointURL() {
		return this.socketAdapter.endPointURL();
	}
	async disconnect(e, t) {
		return this._cancelPendingDisconnect(), this.isDisconnecting() ? "ok" : await this.socketAdapter.disconnect(() => {
			clearInterval(this._workerHeartbeatTimer), this._terminateWorker();
		}, e, t);
	}
	getChannels() {
		return this.channels;
	}
	async removeChannel(e) {
		let t = await e.unsubscribe();
		return t === "ok" && e.teardown(), t;
	}
	async removeAllChannels() {
		let e = this.channels.map(async (e) => {
			let t = await e.unsubscribe();
			return e.teardown(), t;
		}), t = await Promise.all(e);
		return await this.disconnect(), t;
	}
	log(e, t, n) {
		this.socketAdapter.log(e, t, n);
	}
	hasLogger() {
		return this.socketAdapter.hasLogger();
	}
	connectionState() {
		return this.socketAdapter.connectionState() || we.closed;
	}
	isConnected() {
		return this.socketAdapter.isConnected();
	}
	isConnecting() {
		return this.socketAdapter.isConnecting();
	}
	isDisconnecting() {
		return this.socketAdapter.isDisconnecting();
	}
	channel(e, t = { config: {} }) {
		let n = `realtime:${e}`, r = this.getChannels().find((e) => e.topic === n);
		if (r) return r;
		{
			let n = new wt(`realtime:${e}`, t, this);
			return this._cancelPendingDisconnect(), this.channels.push(n), n;
		}
	}
	push(e) {
		this.socketAdapter.push(e);
	}
	async setAuth(e = null) {
		let t = ++this._authGeneration, n = this._performAuth(e, t);
		t === this._authGeneration && (this._authPromise = n);
		try {
			await n;
		} finally {
			this._authPromise === n && (this._authPromise = null);
		}
	}
	_isManualToken() {
		return this._manuallySetToken;
	}
	async sendHeartbeat() {
		this.socketAdapter.sendHeartbeat();
	}
	onHeartbeat(e) {
		this.socketAdapter.heartbeatCallback = this._wrapHeartbeatCallback(e);
	}
	_makeRef() {
		return this.socketAdapter.makeRef();
	}
	_remove(e) {
		this.channels = this.channels.filter((t) => t.topic !== e.topic), this.channels.length === 0 && (this.log("transport", "no channels remaining, scheduling disconnect"), this._schedulePendingDisconnect());
	}
	_schedulePendingDisconnect() {
		if (this._cancelPendingDisconnect(), this._disconnectOnEmptyChannelsAfterMs === 0) {
			this.log("transport", "disconnecting immediately - no channels"), this.disconnect();
			return;
		}
		this._pendingDisconnectTimer = setTimeout(() => {
			this._pendingDisconnectTimer = null, this.channels.length === 0 && (this.log("transport", "deferred disconnect fired - no channels, disconnecting"), this.disconnect());
		}, this._disconnectOnEmptyChannelsAfterMs), this.log("transport", `deferred disconnect scheduled in ${this._disconnectOnEmptyChannelsAfterMs}ms`);
	}
	_cancelPendingDisconnect() {
		this._pendingDisconnectTimer !== null && (this.log("transport", "pending disconnect cancelled - channel activity detected"), clearTimeout(this._pendingDisconnectTimer), this._pendingDisconnectTimer = null);
	}
	async _performAuth(e, t) {
		let n, r = !1;
		if (e) n = e, r = !0;
		else if (this.accessToken) try {
			n = await this.accessToken();
		} catch (e) {
			this.log("error", "Error fetching access token from callback", e), n = this.accessTokenValue;
		}
		else n = this.accessTokenValue;
		t === this._authGeneration && (this.accessToken ? this._manuallySetToken = !1 : r && (this._manuallySetToken = !0), this.accessTokenValue != n && (this.accessTokenValue = n, this.channels.forEach((e) => {
			let t = {
				access_token: n,
				version: ye
			};
			e.updateJoinPayload(t), e.joinedOnce && e.channelAdapter.isJoined() && e.channelAdapter.push(Ce.access_token, { access_token: n });
		})));
	}
	async _waitForAuthIfNeeded() {
		this._authPromise && await this._authPromise;
	}
	_setAuthSafely(e = "general") {
		this._isManualToken() || this.setAuth().catch((t) => {
			this.log("error", `Error setting auth in ${e}`, t);
		});
	}
	_setupConnectionHandlers() {
		this.socketAdapter.onOpen(() => {
			(this._authPromise || (this.accessToken && !this.accessTokenValue ? this.setAuth() : Promise.resolve())).catch((e) => {
				this.log("error", "error waiting for auth on connect", e);
			}), this.worker && !this.workerRef && this._startWorkerHeartbeat();
		}), this.socketAdapter.onClose(() => {
			this.worker && this.workerRef && this._terminateWorker();
		}), this.socketAdapter.onMessage((e) => {
			e.ref && e.ref === this._pendingWorkerHeartbeatRef && (this._pendingWorkerHeartbeatRef = null);
		});
	}
	_handleNodeJsRaceCondition() {
		this.socketAdapter.isConnected() && this.socketAdapter.getSocket().onConnOpen();
	}
	_wrapHeartbeatCallback(e) {
		return (t, n) => {
			t !== "disconnected" && (t == "sent" && this._setAuthSafely(), e && e(t, n));
		};
	}
	_startWorkerHeartbeat() {
		this.workerUrl ? this.log("worker", `starting worker for from ${this.workerUrl}`) : this.log("worker", "starting default worker");
		let e = this._workerObjectUrl(this.workerUrl);
		this.workerRef = new Worker(e), this.workerRef.onerror = (e) => {
			this.log("worker", "worker error", e.message), this._terminateWorker(), this.disconnect();
		}, this.workerRef.onmessage = (e) => {
			e.data.event === "keepAlive" && this.sendHeartbeat();
		}, this.workerRef.postMessage({
			event: "start",
			interval: this.heartbeatIntervalMs
		});
	}
	_terminateWorker() {
		this.workerRef &&= (this.log("worker", "terminating worker"), this.workerRef.terminate(), void 0);
	}
	_workerObjectUrl(e) {
		let t;
		if (e) t = e;
		else {
			let e = new Blob([jt], { type: "application/javascript" });
			t = URL.createObjectURL(e);
		}
		return t;
	}
	_initializeOptions(e) {
		this.worker = e?.worker ?? !1, this.accessToken = e?.accessToken ?? null;
		let t = {};
		t.timeout = e?.timeout ?? D, t.heartbeatIntervalMs = e?.heartbeatIntervalMs ?? Et.HEARTBEAT_INTERVAL, this._disconnectOnEmptyChannelsAfterMs = e?.disconnectOnEmptyChannelsAfterMs ?? 2 * (e?.heartbeatIntervalMs ?? Et.HEARTBEAT_INTERVAL), t.transport = e?.transport ?? ve.getWebSocketConstructor(), t.params = e?.params, t.logger = e?.logger, t.heartbeatCallback = this._wrapHeartbeatCallback(e?.heartbeatCallback), t.sessionStorage = e?.sessionStorage ?? At(), t.reconnectAfterMs = e?.reconnectAfterMs ?? ((e) => Dt[e - 1] || Ot);
		let n, r, i = e?.vsn ?? xe;
		switch (i) {
			case be:
				n = (e, t) => t(JSON.stringify(e)), r = (e, t) => t(JSON.parse(e));
				break;
			case E:
				n = this.serializer.encode.bind(this.serializer), r = this.serializer.decode.bind(this.serializer);
				break;
			default: throw Error(`Unsupported serializer version: ${t.vsn}`);
		}
		if (t.vsn = i, t.encode = e?.encode ?? n, t.decode = e?.decode ?? r, t.beforeReconnect = this._reconnectAuth.bind(this), (e?.logLevel || e?.log_level) && (this.logLevel = e.logLevel || e.log_level, t.params = Object.assign(Object.assign({}, t.params), { log_level: this.logLevel })), this.worker) {
			if (typeof window < "u" && !window.Worker) throw Error("Web Worker is not supported");
			this.workerUrl = e?.workerUrl, t.autoSendHeartbeat = !this.worker;
		}
		return t;
	}
	async _reconnectAuth() {
		await this._waitForAuthIfNeeded(), this.isConnected() || this.connect();
	}
}, Nt = class extends Error {
	constructor(e, t) {
		super(e), this.name = "IcebergError", this.status = t.status, this.icebergType = t.icebergType, this.icebergCode = t.icebergCode, this.details = t.details, this.isCommitStateUnknown = t.icebergType === "CommitStateUnknownException" || [
			500,
			502,
			504
		].includes(t.status) && t.icebergType?.includes("CommitState") === !0;
	}
	isNotFound() {
		return this.status === 404;
	}
	isConflict() {
		return this.status === 409;
	}
	isAuthenticationTimeout() {
		return this.status === 419;
	}
};
function Pt(e, t, n) {
	let r = new URL(t, e);
	if (n) for (let [e, t] of Object.entries(n)) t !== void 0 && r.searchParams.set(e, t);
	return r.toString();
}
async function Ft(e) {
	return !e || e.type === "none" ? {} : e.type === "bearer" ? { Authorization: `Bearer ${e.token}` } : e.type === "header" ? { [e.name]: e.value } : e.type === "custom" ? await e.getHeaders() : {};
}
function It(e) {
	let t = e.fetchImpl ?? globalThis.fetch;
	return { async request({ method: n, path: r, query: i, body: a, headers: o }) {
		let s = Pt(e.baseUrl, r, i), c = await Ft(e.auth), l = await t(s, {
			method: n,
			headers: {
				...a ? { "Content-Type": "application/json" } : {},
				...c,
				...o
			},
			body: a ? JSON.stringify(a) : void 0
		}), u = await l.text(), d = (l.headers.get("content-type") || "").includes("application/json"), f = d && u ? JSON.parse(u) : u;
		if (!l.ok) {
			let e = d ? f : void 0, t = e?.error;
			throw new Nt(t?.message ?? `Request failed with status ${l.status}`, {
				status: l.status,
				icebergType: t?.type,
				icebergCode: t?.code,
				details: e
			});
		}
		return {
			status: l.status,
			headers: l.headers,
			data: f
		};
	} };
}
function Lt(e) {
	return e.join("");
}
var Rt = class {
	constructor(e, t = "") {
		this.client = e, this.prefix = t;
	}
	async listNamespaces(e) {
		let t = e ? { parent: Lt(e.namespace) } : void 0;
		return (await this.client.request({
			method: "GET",
			path: `${this.prefix}/namespaces`,
			query: t
		})).data.namespaces.map((e) => ({ namespace: e }));
	}
	async createNamespace(e, t) {
		let n = {
			namespace: e.namespace,
			properties: t?.properties
		};
		return (await this.client.request({
			method: "POST",
			path: `${this.prefix}/namespaces`,
			body: n
		})).data;
	}
	async dropNamespace(e) {
		await this.client.request({
			method: "DELETE",
			path: `${this.prefix}/namespaces/${Lt(e.namespace)}`
		});
	}
	async loadNamespaceMetadata(e) {
		return { properties: (await this.client.request({
			method: "GET",
			path: `${this.prefix}/namespaces/${Lt(e.namespace)}`
		})).data.properties };
	}
	async namespaceExists(e) {
		try {
			return await this.client.request({
				method: "HEAD",
				path: `${this.prefix}/namespaces/${Lt(e.namespace)}`
			}), !0;
		} catch (e) {
			if (e instanceof Nt && e.status === 404) return !1;
			throw e;
		}
	}
	async createNamespaceIfNotExists(e, t) {
		try {
			return await this.createNamespace(e, t);
		} catch (e) {
			if (e instanceof Nt && e.status === 409) return;
			throw e;
		}
	}
};
function zt(e) {
	return e.join("");
}
var Bt = class {
	constructor(e, t = "", n) {
		this.client = e, this.prefix = t, this.accessDelegation = n;
	}
	async listTables(e) {
		return (await this.client.request({
			method: "GET",
			path: `${this.prefix}/namespaces/${zt(e.namespace)}/tables`
		})).data.identifiers;
	}
	async createTable(e, t) {
		let n = {};
		return this.accessDelegation && (n["X-Iceberg-Access-Delegation"] = this.accessDelegation), (await this.client.request({
			method: "POST",
			path: `${this.prefix}/namespaces/${zt(e.namespace)}/tables`,
			body: t,
			headers: n
		})).data.metadata;
	}
	async updateTable(e, t) {
		let n = await this.client.request({
			method: "POST",
			path: `${this.prefix}/namespaces/${zt(e.namespace)}/tables/${e.name}`,
			body: t
		});
		return {
			"metadata-location": n.data["metadata-location"],
			metadata: n.data.metadata
		};
	}
	async dropTable(e, t) {
		await this.client.request({
			method: "DELETE",
			path: `${this.prefix}/namespaces/${zt(e.namespace)}/tables/${e.name}`,
			query: { purgeRequested: String(t?.purge ?? !1) }
		});
	}
	async loadTable(e) {
		let t = {};
		return this.accessDelegation && (t["X-Iceberg-Access-Delegation"] = this.accessDelegation), (await this.client.request({
			method: "GET",
			path: `${this.prefix}/namespaces/${zt(e.namespace)}/tables/${e.name}`,
			headers: t
		})).data.metadata;
	}
	async tableExists(e) {
		let t = {};
		this.accessDelegation && (t["X-Iceberg-Access-Delegation"] = this.accessDelegation);
		try {
			return await this.client.request({
				method: "HEAD",
				path: `${this.prefix}/namespaces/${zt(e.namespace)}/tables/${e.name}`,
				headers: t
			}), !0;
		} catch (e) {
			if (e instanceof Nt && e.status === 404) return !1;
			throw e;
		}
	}
	async createTableIfNotExists(e, t) {
		try {
			return await this.createTable(e, t);
		} catch (n) {
			if (n instanceof Nt && n.status === 409) return await this.loadTable({
				namespace: e.namespace,
				name: t.name
			});
			throw n;
		}
	}
}, Vt = class {
	constructor(e) {
		let t = "v1";
		e.catalogName && (t += `/${e.catalogName}`);
		let n = e.baseUrl.endsWith("/") ? e.baseUrl : `${e.baseUrl}/`;
		this.client = It({
			baseUrl: n,
			auth: e.auth,
			fetchImpl: e.fetch
		}), this.accessDelegation = e.accessDelegation?.join(","), this.namespaceOps = new Rt(this.client, t), this.tableOps = new Bt(this.client, t, this.accessDelegation);
	}
	async listNamespaces(e) {
		return this.namespaceOps.listNamespaces(e);
	}
	async createNamespace(e, t) {
		return this.namespaceOps.createNamespace(e, t);
	}
	async dropNamespace(e) {
		await this.namespaceOps.dropNamespace(e);
	}
	async loadNamespaceMetadata(e) {
		return this.namespaceOps.loadNamespaceMetadata(e);
	}
	async listTables(e) {
		return this.tableOps.listTables(e);
	}
	async createTable(e, t) {
		return this.tableOps.createTable(e, t);
	}
	async updateTable(e, t) {
		return this.tableOps.updateTable(e, t);
	}
	async dropTable(e, t) {
		await this.tableOps.dropTable(e, t);
	}
	async loadTable(e) {
		return this.tableOps.loadTable(e);
	}
	async namespaceExists(e) {
		return this.namespaceOps.namespaceExists(e);
	}
	async tableExists(e) {
		return this.tableOps.tableExists(e);
	}
	async createNamespaceIfNotExists(e, t) {
		return this.namespaceOps.createNamespaceIfNotExists(e, t);
	}
	async createTableIfNotExists(e, t) {
		return this.tableOps.createTableIfNotExists(e, t);
	}
};
//#endregion
//#region ../social-media-generator/node_modules/@supabase/storage-js/dist/index.mjs
function Ht(e) {
	"@babel/helpers - typeof";
	return Ht = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, Ht(e);
}
function Ut(e, t) {
	if (Ht(e) != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (Ht(r) != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function Wt(e) {
	var t = Ut(e, "string");
	return Ht(t) == "symbol" ? t : t + "";
}
function Gt(e, t, n) {
	return (t = Wt(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function Kt(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function M(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? Kt(Object(n), !0).forEach(function(t) {
			Gt(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : Kt(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
var qt = class extends Error {
	constructor(e, t = "storage", n, r) {
		super(e), this.__isStorageError = !0, this.namespace = t, this.name = t === "vectors" ? "StorageVectorsError" : "StorageError", this.status = n, this.statusCode = r;
	}
	toJSON() {
		return {
			name: this.name,
			message: this.message,
			status: this.status,
			statusCode: this.statusCode
		};
	}
};
function Jt(e) {
	return typeof e == "object" && !!e && "__isStorageError" in e;
}
var Yt = class extends qt {
	constructor(e, t, n, r = "storage", i) {
		super(e, r, t, n), this.name = r === "vectors" ? "StorageVectorsApiError" : "StorageApiError", this.status = t, this.statusCode = n, this.code = i;
	}
	toJSON() {
		return M(M({}, super.toJSON()), {}, { code: this.code });
	}
}, Xt = class extends qt {
	constructor(e, t, n = "storage") {
		super(e, n), this.name = n === "vectors" ? "StorageVectorsUnknownError" : "StorageUnknownError", this.originalError = t;
	}
};
function Zt(e, t, n) {
	let r = M({}, e), i = t.toLowerCase();
	for (let e of Object.keys(r)) e.toLowerCase() === i && delete r[e];
	return r[i] = n, r;
}
function N(e) {
	let t = {};
	for (let [n, r] of Object.entries(e)) t[n.toLowerCase()] = r;
	return t;
}
var Qt = (e) => e ? (...t) => e(...t) : (...e) => fetch(...e), $t = (e) => {
	if (typeof e != "object" || !e) return !1;
	let t = Object.getPrototypeOf(e);
	return (t === null || t === Object.prototype || Object.getPrototypeOf(t) === null) && !(Symbol.toStringTag in e) && !(Symbol.iterator in e);
}, en = (e) => {
	if (Array.isArray(e)) return e.map((e) => en(e));
	if (typeof e == "function" || e !== Object(e)) return e;
	let t = {};
	return Object.entries(e).forEach(([e, n]) => {
		let r = e.replace(/([-_][a-z])/gi, (e) => e.toUpperCase().replace(/[-_]/g, ""));
		t[r] = en(n);
	}), t;
}, tn = (e) => !e || typeof e != "string" || e.length === 0 || e.length > 100 || e.trim() !== e || e.includes("/") || e.includes("\\") ? !1 : /^[\w!.\*'() &$@=;:+,?-]+$/.test(e), nn = (e) => e.split("/").map(encodeURIComponent).join("/"), rn = (e) => {
	if (typeof e == "object" && e) {
		let t = e;
		if (typeof t.msg == "string") return t.msg;
		if (typeof t.message == "string") return t.message;
		if (typeof t.error_description == "string") return t.error_description;
		if (typeof t.error == "string") return t.error;
		if (typeof t.error == "object" && t.error !== null) {
			let e = t.error;
			if (typeof e.message == "string") return e.message;
		}
	}
	return JSON.stringify(e);
}, an = async (e, t, n, r) => {
	if (typeof e == "object" && e && "json" in e && typeof e.json == "function") {
		let n = e, i = parseInt(String(n.status), 10);
		Number.isFinite(i) || (i = 500), n.json().then((e) => {
			let n = e?.statusCode || e?.code || i + "";
			t(new Yt(rn(e), i, n, r, e?.code));
		}).catch(() => {
			let e = i + "";
			t(new Yt(n.statusText || `HTTP ${i} error`, i, e, r));
		});
	} else t(new Xt(rn(e), e, r));
}, on = (e, t, n, r) => {
	let i = {
		method: e,
		headers: t?.headers || {}
	};
	if (e === "GET" || e === "HEAD" || !r) return M(M({}, i), n);
	if ($t(r)) {
		let e = t?.headers || {}, n;
		for (let [t, r] of Object.entries(e)) t.toLowerCase() === "content-type" && (n = r);
		i.headers = Zt(e, "Content-Type", n ?? "application/json"), i.body = JSON.stringify(r);
	} else i.body = r;
	return t?.duplex && (i.duplex = t.duplex), M(M({}, i), n);
};
async function sn(e, t, n, r, i, a, o) {
	return new Promise((s, c) => {
		e(n, on(t, r, i, a)).then((e) => {
			if (!e.ok) throw e;
			if (r?.noResolveJson) return e;
			if (o === "vectors") {
				let t = e.headers.get("content-type");
				if (e.headers.get("content-length") === "0" || e.status === 204 || !t || !t.includes("application/json")) return {};
			}
			return e.json();
		}).then((e) => s(e)).catch((e) => an(e, c, r, o));
	});
}
function cn(e = "storage") {
	return {
		get: async (t, n, r, i) => sn(t, "GET", n, r, i, void 0, e),
		post: async (t, n, r, i, a) => sn(t, "POST", n, i, a, r, e),
		put: async (t, n, r, i, a) => sn(t, "PUT", n, i, a, r, e),
		head: async (t, n, r, i) => sn(t, "HEAD", n, M(M({}, r), {}, { noResolveJson: !0 }), i, void 0, e),
		remove: async (t, n, r, i, a) => sn(t, "DELETE", n, i, a, r, e)
	};
}
var { get: ln, post: un, put: dn, head: fn, remove: pn } = cn("storage"), mn = cn("vectors"), hn = class {
	constructor(e, t = {}, n, r = "storage") {
		this.shouldThrowOnError = !1, this.url = e, this.headers = N(t), this.fetch = Qt(n), this.namespace = r;
	}
	throwOnError() {
		return this.shouldThrowOnError = !0, this;
	}
	setHeader(e, t) {
		return this.headers = Zt(this.headers, e, t), this;
	}
	async handleOperation(e) {
		var t = this;
		try {
			return {
				data: await e(),
				error: null
			};
		} catch (e) {
			if (t.shouldThrowOnError) throw e;
			if (Jt(e)) return {
				data: null,
				error: e
			};
			throw e;
		}
	}
}, gn = Symbol.toStringTag, _n = class {
	constructor(e, t) {
		this.downloadFn = e, this.shouldThrowOnError = t, this[gn] = "StreamDownloadBuilder", this.promise = null;
	}
	then(e, t) {
		return this.getPromise().then(e, t);
	}
	catch(e) {
		return this.getPromise().catch(e);
	}
	finally(e) {
		return this.getPromise().finally(e);
	}
	getPromise() {
		return this.promise ||= this.execute(), this.promise;
	}
	async execute() {
		var e = this;
		try {
			return {
				data: (await e.downloadFn()).body,
				error: null
			};
		} catch (t) {
			if (e.shouldThrowOnError) throw t;
			if (Jt(t)) return {
				data: null,
				error: t
			};
			throw t;
		}
	}
}, vn = Symbol.toStringTag, yn = class {
	constructor(e, t) {
		this.downloadFn = e, this.shouldThrowOnError = t, this[vn] = "BlobDownloadBuilder", this.promise = null;
	}
	asStream() {
		return new _n(this.downloadFn, this.shouldThrowOnError);
	}
	then(e, t) {
		return this.getPromise().then(e, t);
	}
	catch(e) {
		return this.getPromise().catch(e);
	}
	finally(e) {
		return this.getPromise().finally(e);
	}
	getPromise() {
		return this.promise ||= this.execute(), this.promise;
	}
	async execute() {
		var e = this;
		try {
			return {
				data: await (await e.downloadFn()).blob(),
				error: null
			};
		} catch (t) {
			if (e.shouldThrowOnError) throw t;
			if (Jt(t)) return {
				data: null,
				error: t
			};
			throw t;
		}
	}
}, bn = {
	limit: 100,
	offset: 0,
	sortBy: {
		column: "name",
		order: "asc"
	}
}, xn = {
	cacheControl: "3600",
	contentType: "text/plain;charset=UTF-8",
	upsert: !1
}, Sn = class extends hn {
	constructor(e, t = {}, n, r) {
		super(e, t, r, "storage"), this.bucketId = n;
	}
	async uploadOrUpdate(e, t, n, r) {
		var i = this;
		return i.handleOperation(async () => {
			let a, o = M(M({}, xn), r), s = M(M({}, i.headers), e === "POST" && { "x-upsert": String(o.upsert) }), c = o.metadata;
			if (typeof Blob < "u" && n instanceof Blob ? (a = new FormData(), a.append("cacheControl", o.cacheControl), c && a.append("metadata", i.encodeMetadata(c)), a.append("", n)) : typeof FormData < "u" && n instanceof FormData ? (a = n, a.has("cacheControl") || a.append("cacheControl", o.cacheControl), c && !a.has("metadata") && a.append("metadata", i.encodeMetadata(c))) : (a = n, s["cache-control"] = `max-age=${o.cacheControl}`, s["content-type"] = o.contentType, c && (s["x-metadata"] = i.toBase64(i.encodeMetadata(c))), (typeof ReadableStream < "u" && a instanceof ReadableStream || a && typeof a == "object" && "pipe" in a && typeof a.pipe == "function") && !o.duplex && (o.duplex = "half")), r?.headers) for (let [e, t] of Object.entries(r.headers)) s = Zt(s, e, t);
			let l = i._removeEmptyFolders(t), u = i._getFinalPath(l), d = await (e == "PUT" ? dn : un)(i.fetch, `${i.url}/object/${u}`, a, M({ headers: s }, o?.duplex ? { duplex: o.duplex } : {}));
			return {
				path: l,
				id: d.Id,
				fullPath: d.Key
			};
		});
	}
	async upload(e, t, n) {
		return this.uploadOrUpdate("POST", e, t, n);
	}
	async uploadToSignedUrl(e, t, n, r) {
		var i = this;
		let a = i._removeEmptyFolders(e), o = i._getFinalPath(a), s = new URL(i.url + `/object/upload/sign/${o}`);
		return s.searchParams.set("token", t), i.handleOperation(async () => {
			let e, t = M(M({}, xn), r), o = M(M({}, i.headers), { "x-upsert": String(t.upsert) }), c = t.metadata;
			if (typeof Blob < "u" && n instanceof Blob ? (e = new FormData(), e.append("cacheControl", t.cacheControl), c && e.append("metadata", i.encodeMetadata(c)), e.append("", n)) : typeof FormData < "u" && n instanceof FormData ? (e = n, e.has("cacheControl") || e.append("cacheControl", t.cacheControl), c && !e.has("metadata") && e.append("metadata", i.encodeMetadata(c))) : (e = n, o["cache-control"] = `max-age=${t.cacheControl}`, o["content-type"] = t.contentType, c && (o["x-metadata"] = i.toBase64(i.encodeMetadata(c))), (typeof ReadableStream < "u" && e instanceof ReadableStream || e && typeof e == "object" && "pipe" in e && typeof e.pipe == "function") && !t.duplex && (t.duplex = "half")), r?.headers) for (let [e, t] of Object.entries(r.headers)) o = Zt(o, e, t);
			return {
				path: a,
				fullPath: (await dn(i.fetch, s.toString(), e, M({ headers: o }, t?.duplex ? { duplex: t.duplex } : {}))).Key
			};
		});
	}
	async createSignedUploadUrl(e, t) {
		var n = this;
		return n.handleOperation(async () => {
			let r = n._getFinalPath(e), i = M({}, n.headers);
			t?.upsert && (i["x-upsert"] = "true");
			let a = await un(n.fetch, `${n.url}/object/upload/sign/${r}`, {}, { headers: i }), o = new URL(n.url + a.url), s = o.searchParams.get("token");
			if (!s) throw new qt("No token returned by API");
			return {
				signedUrl: o.toString(),
				path: e,
				token: s
			};
		});
	}
	async update(e, t, n) {
		return this.uploadOrUpdate("PUT", e, t, n);
	}
	async move(e, t, n) {
		var r = this;
		return r.handleOperation(async () => await un(r.fetch, `${r.url}/object/move`, {
			bucketId: r.bucketId,
			sourceKey: e,
			destinationKey: t,
			destinationBucket: n?.destinationBucket,
			sourceVersionId: n?.sourceVersionId
		}, { headers: r.headers }));
	}
	async copy(e, t, n) {
		var r = this;
		return r.handleOperation(async () => ({ path: (await un(r.fetch, `${r.url}/object/copy`, {
			bucketId: r.bucketId,
			sourceKey: e,
			destinationKey: t,
			destinationBucket: n?.destinationBucket,
			sourceVersionId: n?.sourceVersionId
		}, { headers: r.headers })).Key }));
	}
	async createSignedUrl(e, t, n) {
		var r = this;
		return r.handleOperation(async () => {
			let i = r._getFinalPath(e), a = typeof n?.transform == "object" && n.transform !== null && Object.keys(n.transform).length > 0, o = await un(r.fetch, `${r.url}/object/sign/${i}`, M(M({ expiresIn: t }, a ? { transform: n.transform } : {}), n?.versionId == null ? {} : { versionId: n.versionId }), { headers: r.headers }), s = new URLSearchParams();
			n?.download && s.set("download", n.download === !0 ? "" : n.download), n?.cacheNonce != null && s.set("cacheNonce", String(n.cacheNonce));
			let c = s.toString();
			return { signedUrl: encodeURI(`${r.url}${o.signedURL}${c ? `&${c}` : ""}`) };
		});
	}
	async createSignedUrls(e, t, n) {
		var r = this;
		return r.handleOperation(async () => {
			let i = await un(r.fetch, `${r.url}/object/sign/${r.bucketId}`, {
				expiresIn: t,
				paths: e
			}, { headers: r.headers }), a = new URLSearchParams();
			n?.download && a.set("download", n.download === !0 ? "" : n.download), n?.cacheNonce != null && a.set("cacheNonce", String(n.cacheNonce));
			let o = a.toString();
			return i.map((e) => M(M({}, e), {}, { signedUrl: e.signedURL ? encodeURI(`${r.url}${e.signedURL}${o ? `&${o}` : ""}`) : null }));
		});
	}
	download(e, t, n) {
		let r = typeof t?.transform == "object" && t.transform !== null && Object.keys(t.transform).length > 0 ? "render/image/authenticated" : "object", i = new URLSearchParams();
		t?.transform && this.applyTransformOptsToQuery(i, t.transform), t?.cacheNonce != null && i.set("cacheNonce", String(t.cacheNonce)), t?.versionId != null && i.set("versionId", String(t.versionId));
		let a = i.toString(), o = this._getFinalPath(e);
		return new yn(() => ln(this.fetch, `${this.url}/${r}/${o}${a ? `?${a}` : ""}`, {
			headers: this.headers,
			noResolveJson: !0
		}, n), this.shouldThrowOnError);
	}
	async info(e, t) {
		var n = this;
		let r = n._getFinalPath(e), i = new URLSearchParams();
		t?.versionId != null && i.set("versionId", String(t.versionId));
		let a = i.toString();
		return n.handleOperation(async () => en(await ln(n.fetch, `${n.url}/object/info/${r}${a ? `?${a}` : ""}`, { headers: n.headers })));
	}
	async exists(e) {
		var t = this;
		let n = t._getFinalPath(e);
		try {
			return await fn(t.fetch, `${t.url}/object/${n}`, { headers: t.headers }), {
				data: !0,
				error: null
			};
		} catch (e) {
			if (t.shouldThrowOnError) throw e;
			if (Jt(e)) {
				let t = e instanceof Yt ? e.status : e instanceof Xt ? e.originalError?.status : void 0;
				if (t !== void 0 && [400, 404].includes(t)) return {
					data: !1,
					error: e
				};
			}
			throw e;
		}
	}
	getPublicUrl(e, t) {
		let n = this._getFinalPath(e), r = new URLSearchParams();
		t?.download && r.set("download", t.download === !0 ? "" : t.download), t?.transform && this.applyTransformOptsToQuery(r, t.transform), t?.cacheNonce != null && r.set("cacheNonce", String(t.cacheNonce)), t?.versionId != null && r.set("versionId", String(t.versionId));
		let i = r.toString(), a = typeof t?.transform == "object" && t.transform !== null && Object.keys(t.transform).length > 0 ? "render/image" : "object";
		return { data: { publicUrl: encodeURI(`${this.url}/${a}/public/${n}`) + (i ? `?${i}` : "") } };
	}
	async remove(e) {
		var t = this;
		return t.handleOperation(async () => await pn(t.fetch, `${t.url}/object/${t.bucketId}`, { prefixes: e }, { headers: t.headers }));
	}
	async purgeCache(e, t, n) {
		var r = this;
		return r.handleOperation(async () => {
			let i = nn(r._getFinalPath(e)), a = new URLSearchParams();
			t?.transformations && a.set("transformations", "true");
			let o = a.toString();
			return await pn(r.fetch, `${r.url}/cdn/${i}${o ? `?${o}` : ""}`, {}, { headers: r.headers }, n);
		});
	}
	async list(e, t, n) {
		var r = this;
		return r.handleOperation(async () => {
			let i = t?.sortBy ? M(M({}, bn.sortBy), t.sortBy) : bn.sortBy, a = M(M(M({}, bn), t), {}, {
				sortBy: i,
				prefix: e || ""
			});
			return await un(r.fetch, `${r.url}/object/list/${r.bucketId}`, a, { headers: r.headers }, n);
		});
	}
	async listV2(e, t) {
		var n = this;
		return n.handleOperation(async () => {
			let r = M({}, e);
			return await un(n.fetch, `${n.url}/object/list-v2/${n.bucketId}`, r, { headers: n.headers }, t);
		});
	}
	encodeMetadata(e) {
		return JSON.stringify(e);
	}
	toBase64(e) {
		return typeof Buffer < "u" ? Buffer.from(e).toString("base64") : btoa(e);
	}
	_getFinalPath(e) {
		return `${this.bucketId}/${e.replace(/^\/+/, "")}`;
	}
	_removeEmptyFolders(e) {
		return e.replace(/^\/|\/$/g, "").replace(/\/+/g, "/");
	}
	applyTransformOptsToQuery(e, t) {
		return t.width && e.set("width", t.width.toString()), t.height && e.set("height", t.height.toString()), t.resize && e.set("resize", t.resize), t.format && e.set("format", t.format), t.quality && e.set("quality", t.quality.toString()), e;
	}
}, Cn = { "X-Client-Info": "storage-js/2.117.2" }, wn = class extends hn {
	constructor(e, t = {}, n, r) {
		let i = new URL(e);
		r?.useNewHostname && /supabase\.(co|in|red)$/.test(i.hostname) && !i.hostname.includes("storage.supabase.") && (i.hostname = i.hostname.replace("supabase.", "storage.supabase."));
		let a = i.href.replace(/\/$/, ""), o = M(M({}, Cn), t);
		super(a, o, n, "storage");
	}
	async listBuckets(e) {
		var t = this;
		return t.handleOperation(async () => {
			let n = t.listBucketOptionsToQueryString(e);
			return await ln(t.fetch, `${t.url}/bucket${n}`, { headers: t.headers });
		});
	}
	async getBucket(e) {
		var t = this;
		return t.handleOperation(async () => await ln(t.fetch, `${t.url}/bucket/${e}`, { headers: t.headers }));
	}
	async createBucket(e, t = { public: !1 }) {
		var n = this;
		return n.handleOperation(async () => await un(n.fetch, `${n.url}/bucket`, {
			id: e,
			name: e,
			type: t.type,
			public: t.public,
			file_size_limit: t.fileSizeLimit,
			allowed_mime_types: t.allowedMimeTypes,
			versioning_status: t.versioningStatus
		}, { headers: n.headers }));
	}
	async updateBucket(e, t) {
		var n = this;
		return n.handleOperation(async () => await dn(n.fetch, `${n.url}/bucket/${e}`, {
			id: e,
			name: e,
			public: t.public,
			file_size_limit: t.fileSizeLimit,
			allowed_mime_types: t.allowedMimeTypes,
			versioning_status: t.versioningStatus
		}, { headers: n.headers }));
	}
	async emptyBucket(e) {
		var t = this;
		return t.handleOperation(async () => await un(t.fetch, `${t.url}/bucket/${e}/empty`, {}, { headers: t.headers }));
	}
	async deleteBucket(e) {
		var t = this;
		return t.handleOperation(async () => await pn(t.fetch, `${t.url}/bucket/${e}`, {}, { headers: t.headers }));
	}
	async getBucketLifecycle(e) {
		var t = this;
		return t.handleOperation(async () => await ln(t.fetch, t.bucketLifecycleUrl(e), { headers: t.headers }));
	}
	async updateBucketLifecycle(e, t) {
		var n = this;
		return n.handleOperation(async () => await dn(n.fetch, n.bucketLifecycleUrl(e), t, { headers: n.headers }));
	}
	async deleteBucketLifecycle(e) {
		var t = this;
		return t.handleOperation(async () => await pn(t.fetch, t.bucketLifecycleUrl(e), {}, { headers: t.headers }));
	}
	async purgeBucketCache(e, t, n) {
		var r = this;
		return r.handleOperation(async () => {
			let i = new URLSearchParams();
			t?.transformations && i.set("transformations", "true");
			let a = i.toString();
			return await pn(r.fetch, `${r.url}/cdn/${nn(e)}${a ? `?${a}` : ""}`, {}, { headers: r.headers }, n);
		});
	}
	bucketLifecycleUrl(e) {
		return `${this.url}/bucket/${nn(e)}/lifecycle`;
	}
	listBucketOptionsToQueryString(e) {
		let t = {};
		return e && ("limit" in e && (t.limit = String(e.limit)), "offset" in e && (t.offset = String(e.offset)), e.search && (t.search = e.search), e.sortColumn && (t.sortColumn = e.sortColumn), e.sortOrder && (t.sortOrder = e.sortOrder)), Object.keys(t).length > 0 ? "?" + new URLSearchParams(t).toString() : "";
	}
}, Tn = class extends hn {
	constructor(e, t = {}, n) {
		let r = e.replace(/\/$/, ""), i = M(M({}, Cn), t);
		super(r, i, n, "storage");
	}
	async createBucket(e) {
		var t = this;
		return t.handleOperation(async () => await un(t.fetch, `${t.url}/bucket`, { name: e }, { headers: t.headers }));
	}
	async listBuckets(e) {
		var t = this;
		return t.handleOperation(async () => {
			let n = new URLSearchParams();
			e?.limit !== void 0 && n.set("limit", e.limit.toString()), e?.offset !== void 0 && n.set("offset", e.offset.toString()), e?.sortColumn && n.set("sortColumn", e.sortColumn), e?.sortOrder && n.set("sortOrder", e.sortOrder), e?.search && n.set("search", e.search);
			let r = n.toString(), i = r ? `${t.url}/bucket?${r}` : `${t.url}/bucket`;
			return await ln(t.fetch, i, { headers: t.headers });
		});
	}
	async deleteBucket(e) {
		var t = this;
		return t.handleOperation(async () => await pn(t.fetch, `${t.url}/bucket/${e}`, {}, { headers: t.headers }));
	}
	from(e) {
		var t = this;
		if (!tn(e)) throw new qt("Invalid bucket name: File, folder, and bucket names must follow AWS object key naming guidelines and should avoid the use of any other characters.");
		let n = new Vt({
			baseUrl: this.url,
			catalogName: e,
			auth: {
				type: "custom",
				getHeaders: async () => t.headers
			},
			fetch: this.fetch
		}), r = this.shouldThrowOnError;
		return new Proxy(n, { get(e, t) {
			let n = e[t];
			return typeof n == "function" ? async (...t) => {
				try {
					return {
						data: await n.apply(e, t),
						error: null
					};
				} catch (e) {
					if (r) throw e;
					return {
						data: null,
						error: e
					};
				}
			} : n;
		} });
	}
}, En = class extends hn {
	constructor(e, t = {}, n) {
		let r = e.replace(/\/$/, ""), i = M(M({}, Cn), {}, { "Content-Type": "application/json" }, t);
		super(r, i, n, "vectors");
	}
	async createIndex(e) {
		var t = this;
		return t.handleOperation(async () => await mn.post(t.fetch, `${t.url}/CreateIndex`, e, { headers: t.headers }) || {});
	}
	async getIndex(e, t) {
		var n = this;
		return n.handleOperation(async () => await mn.post(n.fetch, `${n.url}/GetIndex`, {
			vectorBucketName: e,
			indexName: t
		}, { headers: n.headers }));
	}
	async listIndexes(e) {
		var t = this;
		return t.handleOperation(async () => await mn.post(t.fetch, `${t.url}/ListIndexes`, e, { headers: t.headers }));
	}
	async deleteIndex(e, t) {
		var n = this;
		return n.handleOperation(async () => await mn.post(n.fetch, `${n.url}/DeleteIndex`, {
			vectorBucketName: e,
			indexName: t
		}, { headers: n.headers }) || {});
	}
}, Dn = class extends hn {
	constructor(e, t = {}, n) {
		let r = e.replace(/\/$/, ""), i = M(M({}, Cn), {}, { "Content-Type": "application/json" }, t);
		super(r, i, n, "vectors");
	}
	async putVectors(e) {
		var t = this;
		if (e.vectors.length < 1 || e.vectors.length > 500) throw Error("Vector batch size must be between 1 and 500 items");
		return t.handleOperation(async () => await mn.post(t.fetch, `${t.url}/PutVectors`, e, { headers: t.headers }) || {});
	}
	async getVectors(e) {
		var t = this;
		return t.handleOperation(async () => await mn.post(t.fetch, `${t.url}/GetVectors`, e, { headers: t.headers }));
	}
	async listVectors(e) {
		var t = this;
		if (e.segmentCount !== void 0) {
			if (e.segmentCount < 1 || e.segmentCount > 16) throw Error("segmentCount must be between 1 and 16");
			if (e.segmentIndex !== void 0 && (e.segmentIndex < 0 || e.segmentIndex >= e.segmentCount)) throw Error(`segmentIndex must be between 0 and ${e.segmentCount - 1}`);
		}
		return t.handleOperation(async () => await mn.post(t.fetch, `${t.url}/ListVectors`, e, { headers: t.headers }));
	}
	async queryVectors(e) {
		var t = this;
		return t.handleOperation(async () => await mn.post(t.fetch, `${t.url}/QueryVectors`, e, { headers: t.headers }));
	}
	async deleteVectors(e) {
		var t = this;
		if (e.keys.length < 1 || e.keys.length > 500) throw Error("Keys batch size must be between 1 and 500 items");
		return t.handleOperation(async () => await mn.post(t.fetch, `${t.url}/DeleteVectors`, e, { headers: t.headers }) || {});
	}
}, On = class extends hn {
	constructor(e, t = {}, n) {
		let r = e.replace(/\/$/, ""), i = M(M({}, Cn), {}, { "Content-Type": "application/json" }, t);
		super(r, i, n, "vectors");
	}
	async createBucket(e) {
		var t = this;
		return t.handleOperation(async () => await mn.post(t.fetch, `${t.url}/CreateVectorBucket`, { vectorBucketName: e }, { headers: t.headers }) || {});
	}
	async getBucket(e) {
		var t = this;
		return t.handleOperation(async () => await mn.post(t.fetch, `${t.url}/GetVectorBucket`, { vectorBucketName: e }, { headers: t.headers }));
	}
	async listBuckets(e = {}) {
		var t = this;
		return t.handleOperation(async () => await mn.post(t.fetch, `${t.url}/ListVectorBuckets`, e, { headers: t.headers }));
	}
	async deleteBucket(e) {
		var t = this;
		return t.handleOperation(async () => await mn.post(t.fetch, `${t.url}/DeleteVectorBucket`, { vectorBucketName: e }, { headers: t.headers }) || {});
	}
}, kn = class extends On {
	constructor(e, t = {}) {
		super(e, t.headers || {}, t.fetch);
	}
	from(e) {
		return new An(this.url, this.headers, e, this.fetch);
	}
	async createBucket(e) {
		var t = () => super.createBucket, n = this;
		return t().call(n, e);
	}
	async getBucket(e) {
		var t = () => super.getBucket, n = this;
		return t().call(n, e);
	}
	async listBuckets(e = {}) {
		var t = () => super.listBuckets, n = this;
		return t().call(n, e);
	}
	async deleteBucket(e) {
		var t = () => super.deleteBucket, n = this;
		return t().call(n, e);
	}
}, An = class extends En {
	constructor(e, t, n, r) {
		super(e, t, r), this.vectorBucketName = n;
	}
	async createIndex(e) {
		var t = () => super.createIndex, n = this;
		return t().call(n, M(M({}, e), {}, { vectorBucketName: n.vectorBucketName }));
	}
	async listIndexes(e = {}) {
		var t = () => super.listIndexes, n = this;
		return t().call(n, M(M({}, e), {}, { vectorBucketName: n.vectorBucketName }));
	}
	async getIndex(e) {
		var t = () => super.getIndex, n = this;
		return t().call(n, n.vectorBucketName, e);
	}
	async deleteIndex(e) {
		var t = () => super.deleteIndex, n = this;
		return t().call(n, n.vectorBucketName, e);
	}
	index(e) {
		return new jn(this.url, this.headers, this.vectorBucketName, e, this.fetch);
	}
}, jn = class extends Dn {
	constructor(e, t, n, r, i) {
		super(e, t, i), this.vectorBucketName = n, this.indexName = r;
	}
	async putVectors(e) {
		var t = () => super.putVectors, n = this;
		return t().call(n, M(M({}, e), {}, {
			vectorBucketName: n.vectorBucketName,
			indexName: n.indexName
		}));
	}
	async getVectors(e) {
		var t = () => super.getVectors, n = this;
		return t().call(n, M(M({}, e), {}, {
			vectorBucketName: n.vectorBucketName,
			indexName: n.indexName
		}));
	}
	async listVectors(e = {}) {
		var t = () => super.listVectors, n = this;
		return t().call(n, M(M({}, e), {}, {
			vectorBucketName: n.vectorBucketName,
			indexName: n.indexName
		}));
	}
	async queryVectors(e) {
		var t = () => super.queryVectors, n = this;
		return t().call(n, M(M({}, e), {}, {
			vectorBucketName: n.vectorBucketName,
			indexName: n.indexName
		}));
	}
	async deleteVectors(e) {
		var t = () => super.deleteVectors, n = this;
		return t().call(n, M(M({}, e), {}, {
			vectorBucketName: n.vectorBucketName,
			indexName: n.indexName
		}));
	}
}, Mn = class extends wn {
	constructor(e, t = {}, n, r) {
		super(e, t, n, r);
	}
	from(e) {
		return new Sn(this.url, this.headers, e, this.fetch);
	}
	get vectors() {
		return new kn(this.url + "/vector", {
			headers: this.headers,
			fetch: this.fetch
		});
	}
	get analytics() {
		return new Tn(this.url + "/iceberg", this.headers, this.fetch);
	}
}, Nn = "2.117.2", Pn = 3e4, Fn = 3 * Pn, In = 2 * Pn, Ln = "http://localhost:9999", Rn = "supabase.auth.token", zn = { "X-Client-Info": `gotrue-js/${Nn}` }, Bn = "X-Supabase-Api-Version", Vn = { "2024-01-01": {
	timestamp: Date.parse("2024-01-01T00:00:00.0Z"),
	name: "2024-01-01"
} }, Hn = /^([a-z0-9_-]{4})*($|[a-z0-9_-]{3}$|[a-z0-9_-]{2}$)$/i, Un = "sb_flow_id", Wn = class extends Error {
	constructor(e, t, n) {
		super(e), this.__isAuthError = !0, this.name = "AuthError", this.status = t, this.code = n;
	}
	toJSON() {
		return {
			name: this.name,
			message: this.message,
			status: this.status,
			code: this.code
		};
	}
};
function P(e) {
	return typeof e == "object" && !!e && "__isAuthError" in e;
}
var Gn = class extends Wn {
	constructor(e, t, n) {
		super(e, t, n), this.name = "AuthApiError", this.status = t, this.code = n;
	}
};
function Kn(e) {
	return P(e) && e.name === "AuthApiError";
}
var qn = class extends Wn {
	constructor(e, t) {
		super(e), this.name = "AuthUnknownError", this.originalError = t;
	}
}, Jn = class extends Wn {
	constructor(e, t, n, r) {
		super(e, n, r), this.name = t, this.status = n;
	}
}, Yn = class extends Jn {
	constructor() {
		super("Auth session missing!", "AuthSessionMissingError", 400, void 0);
	}
};
function Xn(e) {
	return P(e) && e.name === "AuthSessionMissingError";
}
var Zn = class extends Jn {
	constructor() {
		super("Auth session or user missing", "AuthInvalidTokenResponseError", 500, void 0);
	}
}, Qn = class extends Jn {
	constructor(e) {
		super(e, "AuthInvalidCredentialsError", 400, void 0);
	}
}, $n = class extends Jn {
	constructor(e, t = null) {
		super(e, "AuthImplicitGrantRedirectError", 500, void 0), this.details = null, this.details = t;
	}
	toJSON() {
		return Object.assign(Object.assign({}, super.toJSON()), { details: this.details });
	}
};
function er(e) {
	return P(e) && e.name === "AuthImplicitGrantRedirectError";
}
var tr = class extends Jn {
	constructor(e, t = null) {
		super(e, "AuthPKCEGrantCodeExchangeError", 500, void 0), this.details = null, this.details = t;
	}
	toJSON() {
		return Object.assign(Object.assign({}, super.toJSON()), { details: this.details });
	}
}, nr = class extends Jn {
	constructor() {
		super("PKCE code verifier not found in storage. This can happen if the auth flow was initiated in a different browser or device, or if the storage was cleared. For SSR frameworks (Next.js, SvelteKit, etc.), use @supabase/ssr on both the server and client to store the code verifier in cookies.", "AuthPKCECodeVerifierMissingError", 400, "pkce_code_verifier_not_found");
	}
}, rr = class extends Jn {
	constructor(e, t) {
		super(e, "AuthRetryableFetchError", t, void 0);
	}
};
function ir(e) {
	return P(e) && e.name === "AuthRetryableFetchError";
}
var ar = class extends Jn {
	constructor(e = "Refresh result discarded: session state changed mid-flight (e.g., concurrent signOut)") {
		super(e, "AuthRefreshDiscardedError", 409, void 0);
	}
};
function or(e) {
	return P(e) && e.name === "AuthRefreshDiscardedError";
}
var sr = class extends Jn {
	constructor(e, t, n) {
		super(e, "AuthWeakPasswordError", t, "weak_password"), this.reasons = n;
	}
	toJSON() {
		return Object.assign(Object.assign({}, super.toJSON()), { reasons: this.reasons });
	}
}, cr = class extends Jn {
	constructor(e) {
		super(e, "AuthInvalidJwtError", 400, "invalid_jwt");
	}
}, lr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".split(""), ur = " 	\n\r=".split(""), dr = (() => {
	let e = Array(128);
	for (let t = 0; t < e.length; t += 1) e[t] = -1;
	for (let t = 0; t < ur.length; t += 1) e[ur[t].charCodeAt(0)] = -2;
	for (let t = 0; t < lr.length; t += 1) e[lr[t].charCodeAt(0)] = t;
	return e;
})();
function fr(e, t, n) {
	if (e !== null) for (t.queue = t.queue << 8 | e, t.queuedBits += 8; t.queuedBits >= 6;) n(lr[t.queue >> t.queuedBits - 6 & 63]), t.queuedBits -= 6;
	else if (t.queuedBits > 0) for (t.queue <<= 6 - t.queuedBits, t.queuedBits = 6; t.queuedBits >= 6;) n(lr[t.queue >> t.queuedBits - 6 & 63]), t.queuedBits -= 6;
}
function pr(e, t, n) {
	let r = dr[e];
	if (r > -1) for (t.queue = t.queue << 6 | r, t.queuedBits += 6; t.queuedBits >= 8;) n(t.queue >> t.queuedBits - 8 & 255), t.queuedBits -= 8;
	else if (r === -2) return;
	else throw Error(`Invalid Base64-URL character "${String.fromCharCode(e)}"`);
}
function mr(e) {
	let t = [], n = (e) => {
		t.push(String.fromCodePoint(e));
	}, r = {
		utf8seq: 0,
		codepoint: 0
	}, i = {
		queue: 0,
		queuedBits: 0
	}, a = (e) => {
		_r(e, r, n);
	};
	for (let t = 0; t < e.length; t += 1) pr(e.charCodeAt(t), i, a);
	return t.join("");
}
function hr(e, t) {
	if (e <= 127) {
		t(e);
		return;
	}
	if (e <= 2047) {
		t(192 | e >> 6), t(128 | e & 63);
		return;
	}
	if (e <= 65535) {
		t(224 | e >> 12), t(128 | e >> 6 & 63), t(128 | e & 63);
		return;
	}
	if (e <= 1114111) {
		t(240 | e >> 18), t(128 | e >> 12 & 63), t(128 | e >> 6 & 63), t(128 | e & 63);
		return;
	}
	throw Error(`Unrecognized Unicode codepoint: ${e.toString(16)}`);
}
function gr(e, t) {
	for (let n = 0; n < e.length; n += 1) {
		let r = e.charCodeAt(n);
		if (r > 55295 && r <= 56319) {
			let t = (r - 55296) * 1024 & 65535;
			r = (e.charCodeAt(n + 1) - 56320 & 65535 | t) + 65536, n += 1;
		}
		hr(r, t);
	}
}
function _r(e, t, n) {
	if (t.utf8seq === 0) {
		if (e <= 127) {
			n(e);
			return;
		}
		for (let n = 1; n < 6; n += 1) if (!(e >> 7 - n & 1)) {
			t.utf8seq = n;
			break;
		}
		if (t.utf8seq === 2) t.codepoint = e & 31;
		else if (t.utf8seq === 3) t.codepoint = e & 15;
		else if (t.utf8seq === 4) t.codepoint = e & 7;
		else throw Error("Invalid UTF-8 sequence");
		--t.utf8seq;
	} else if (t.utf8seq > 0) {
		if (e <= 127) throw Error("Invalid UTF-8 sequence");
		t.codepoint = t.codepoint << 6 | e & 63, --t.utf8seq, t.utf8seq === 0 && n(t.codepoint);
	}
}
function vr(e) {
	let t = [], n = {
		queue: 0,
		queuedBits: 0
	}, r = (e) => {
		t.push(e);
	};
	for (let t = 0; t < e.length; t += 1) pr(e.charCodeAt(t), n, r);
	return new Uint8Array(t);
}
function yr(e) {
	let t = [];
	return gr(e, (e) => t.push(e)), new Uint8Array(t);
}
function br(e) {
	let t = [], n = {
		queue: 0,
		queuedBits: 0
	}, r = (e) => {
		t.push(e);
	};
	return e.forEach((e) => fr(e, n, r)), fr(null, n, r), t.join("");
}
//#endregion
//#region ../social-media-generator/node_modules/@supabase/auth-js/dist/module/lib/helpers.js
function xr(e) {
	return Math.round(Date.now() / 1e3) + e;
}
function Sr() {
	return Symbol("auth-callback");
}
var Cr = () => typeof window < "u" && typeof document < "u", wr = {
	tested: !1,
	writable: !1
}, Tr = () => {
	if (!Cr()) return !1;
	try {
		if (typeof globalThis.localStorage != "object") return !1;
	} catch {
		return !1;
	}
	if (wr.tested) return wr.writable;
	let e = `lswt-${Math.random()}${Math.random()}`;
	try {
		globalThis.localStorage.setItem(e, e), globalThis.localStorage.removeItem(e), wr.tested = !0, wr.writable = !0;
	} catch {
		wr.tested = !0, wr.writable = !1;
	}
	return wr.writable;
};
function Er(e) {
	let t = {}, n = new URL(e);
	if (n.hash && n.hash[0] === "#") try {
		new URLSearchParams(n.hash.substring(1)).forEach((e, n) => {
			t[n] = e;
		});
	} catch {}
	return n.searchParams.forEach((e, n) => {
		t[n] = e;
	}), t;
}
var Dr = (e) => e ? (...t) => e(...t) : (...e) => fetch(...e), Or = (e) => typeof e == "object" && !!e && "status" in e && "ok" in e && "json" in e && typeof e.json == "function", kr = async (e, t, n) => {
	await e.setItem(t, JSON.stringify(n));
}, Ar = async (e, t) => {
	let n = await e.getItem(t);
	if (!n) return null;
	try {
		return JSON.parse(n);
	} catch {
		return null;
	}
}, jr = async (e, t) => {
	await e.removeItem(t);
}, Mr = class e {
	constructor() {
		this.promise = new e.promiseConstructor((e, t) => {
			this.resolve = e, this.reject = t;
		});
	}
};
Mr.promiseConstructor = Promise;
function Nr(e) {
	let t = e.split(".");
	if (t.length !== 3) throw new cr("Invalid JWT structure");
	for (let e = 0; e < t.length; e++) if (!Hn.test(t[e])) throw new cr("JWT not in base64url format");
	return {
		header: JSON.parse(mr(t[0])),
		payload: JSON.parse(mr(t[1])),
		signature: vr(t[2]),
		raw: {
			header: t[0],
			payload: t[1]
		}
	};
}
async function Pr(e) {
	return await new Promise((t) => {
		setTimeout(() => t(null), e);
	});
}
function Fr(e, t) {
	return new Promise((n, r) => {
		(async () => {
			for (let i = 0; i < Infinity; i++) try {
				let r = await e(i);
				if (!t(i, null, r)) {
					n(r);
					return;
				}
			} catch (e) {
				if (!t(i, e)) {
					r(e);
					return;
				}
			}
		})();
	});
}
function Ir(e) {
	return ("0" + e.toString(16)).substr(-2);
}
function Lr() {
	let e = /* @__PURE__ */ new Uint32Array(56);
	if (typeof crypto > "u") {
		let e = "";
		for (let t = 0; t < 56; t++) e += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~".charAt(Math.floor(Math.random() * 66));
		return e;
	}
	return crypto.getRandomValues(e), Array.from(e, Ir).join("");
}
async function Rr(e) {
	let t = new TextEncoder().encode(e), n = await crypto.subtle.digest("SHA-256", t), r = new Uint8Array(n);
	return Array.from(r).map((e) => String.fromCharCode(e)).join("");
}
async function zr(e) {
	if (typeof crypto > "u" || crypto.subtle === void 0 || typeof TextEncoder > "u") return console.warn("WebCrypto API is not supported. Code challenge method will default to use plain instead of sha256."), e;
	let t = await Rr(e);
	return btoa(t).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
var Br = /^[a-zA-Z0-9_-]{8,64}$/;
function Vr(e) {
	return typeof e == "string" && Br.test(e) ? e : null;
}
function Hr() {
	if (typeof crypto < "u" && typeof crypto.getRandomValues == "function") {
		let e = /* @__PURE__ */ new Uint8Array(16);
		return crypto.getRandomValues(e), Array.from(e, Ir).join("");
	}
	let e = "";
	for (let t = 0; t < 32; t++) e += Math.floor(Math.random() * 16).toString(16);
	return e;
}
var Ur = (e, t) => `${e}-flow-${t}-code-verifier`, Wr = (e) => `${e}-flows-code-verifier`;
async function Gr(e, t) {
	let n = await Ar(e, Wr(t));
	return Array.isArray(n) ? n.filter((e) => Vr(e) !== null) : [];
}
async function Kr(e, t, n, r, i) {
	await kr(e, Ur(t, n), r);
	let a = (await Gr(e, t)).filter((e) => e !== n);
	for (a.push(n); a.length > 5;) {
		let n = a.shift();
		await jr(e, Ur(t, n)), i?.(n);
	}
	await kr(e, Wr(t), a), await kr(e, `${t}-code-verifier`, r);
}
async function qr(e, t, n) {
	if (n) {
		let r = await Ar(e, Ur(t, n));
		return {
			verifier: typeof r == "string" ? r : null,
			flowId: n
		};
	}
	let r = await Ar(e, `${t}-code-verifier`);
	return {
		verifier: typeof r == "string" ? r : null,
		flowId: null
	};
}
async function Jr(e, t, n) {
	let r = `${t}-code-verifier`;
	if (!n) {
		await jr(e, r);
		return;
	}
	let i = Ur(t, n), a = await Ar(e, i);
	await jr(e, i);
	let o = await Gr(e, t), s = o.filter((e) => e !== n);
	s.length !== o.length && (s.length > 0 ? await kr(e, Wr(t), s) : await jr(e, Wr(t))), a != null && a === await Ar(e, r) && await jr(e, r);
}
async function Yr(e, t) {
	let n = await Gr(e, t);
	for (let r of n) await jr(e, Ur(t, r));
	await jr(e, Wr(t)), await jr(e, `${t}-code-verifier`);
}
function Xr(e, t) {
	let n = e.indexOf("#"), r = n === -1 ? e : e.slice(0, n), i = n === -1 ? "" : e.slice(n), a = r.indexOf("?");
	if (a !== -1) {
		let e = r.slice(0, a), t = r.slice(a + 1).split("&").filter((e) => e !== "" && e !== "sb_flow_id" && !e.startsWith("sb_flow_id="));
		r = t.length > 0 ? `${e}?${t.join("&")}` : e;
	}
	let o = r.includes("?") ? "&" : "?";
	return `${r}${o}${Un}=${encodeURIComponent(t)}${i}`;
}
async function Zr(e, t, n = !1, r) {
	let i = Lr(), a = i;
	n && (a += "/recovery");
	let o = Hr();
	await Kr(e, t, o, a, r);
	let s = await zr(i);
	return [
		s,
		i === s ? "plain" : "s256",
		o
	];
}
var Qr = /^2[0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|1[0-9]|2[0-9]|3[0-1])$/i;
function $r(e) {
	let t = e.headers.get(Bn);
	if (!t || !t.match(Qr)) return null;
	try {
		return /* @__PURE__ */ new Date(`${t}T00:00:00.0Z`);
	} catch {
		return null;
	}
}
function ei(e) {
	if (!e) throw Error("Missing exp claim");
	if (e <= Math.floor(Date.now() / 1e3)) throw Error("JWT has expired");
}
function ti(e) {
	switch (e) {
		case "RS256": return {
			name: "RSASSA-PKCS1-v1_5",
			hash: { name: "SHA-256" }
		};
		case "ES256": return {
			name: "ECDSA",
			namedCurve: "P-256",
			hash: { name: "SHA-256" }
		};
		default: throw Error("Invalid alg claim");
	}
}
var ni = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function ri(e) {
	if (!ni.test(e)) throw Error("@supabase/auth-js: Expected parameter to be UUID but is not");
}
function ii(e) {
	if (!e.recoveryCodes) throw Error("@supabase/auth-js: the MFA recovery codes API is experimental and disabled by default. Enable it by passing `auth: { experimental: { recoveryCodes: true } }` to createClient (or to the GoTrueClient constructor).");
}
function ai() {
	return new Proxy({}, {
		get: (e, t) => {
			if (t === "__isUserNotAvailableProxy") return !0;
			if (typeof t == "symbol") {
				let e = t.toString();
				if (e === "Symbol(Symbol.toPrimitive)" || e === "Symbol(Symbol.toStringTag)" || e === "Symbol(util.inspect.custom)") return;
			}
			throw Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Accessing the "${t}" property of the session object is not supported. Please use getUser() instead.`);
		},
		set: (e, t) => {
			throw Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Setting the "${t}" property of the session object is not supported. Please use getUser() to fetch a user object you can manipulate.`);
		},
		deleteProperty: (e, t) => {
			throw Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Deleting the "${t}" property of the session object is not supported. Please use getUser() to fetch a user object you can manipulate.`);
		}
	});
}
function oi(e, t) {
	return new Proxy(e, { get: (e, n, r) => {
		if (n === "__isInsecureUserWarningProxy") return !0;
		if (typeof n == "symbol") {
			let t = n.toString();
			if (t === "Symbol(Symbol.toPrimitive)" || t === "Symbol(Symbol.toStringTag)" || t === "Symbol(util.inspect.custom)" || t === "Symbol(nodejs.util.inspect.custom)") return Reflect.get(e, n, r);
		}
		return !t.value && typeof n == "string" && (console.warn("Using the user object as returned from supabase.auth.getSession() or from some supabase.auth.onAuthStateChange() events could be insecure! This value comes directly from the storage medium (usually cookies on the server) and may not be authentic. Use supabase.auth.getUser() instead which authenticates the data by contacting the Supabase Auth server."), t.value = !0), Reflect.get(e, n, r);
	} });
}
function si(e) {
	return JSON.parse(JSON.stringify(e));
}
//#endregion
//#region ../social-media-generator/node_modules/@supabase/auth-js/dist/module/lib/fetch.js
var ci = (e) => {
	if (typeof e == "object" && e) {
		let t = e;
		if (typeof t.msg == "string") return t.msg;
		if (typeof t.message == "string") return t.message;
		if (typeof t.error_description == "string") return t.error_description;
		if (typeof t.error == "string") return t.error;
	}
	return JSON.stringify(e);
}, li = [
	500,
	501,
	502,
	503,
	504,
	520,
	521,
	522,
	523,
	524,
	525,
	526,
	527,
	528,
	529,
	530
];
async function ui(e) {
	if (!Or(e)) throw new rr(ci(e), 0);
	let t;
	try {
		t = await e.json();
	} catch (t) {
		throw li.includes(e.status) ? new rr(e.statusText || `HTTP ${e.status}`, e.status) : new qn(ci(t), t);
	}
	if (li.includes(e.status)) throw new rr(ci(t), e.status);
	let n, r = $r(e);
	if (r && r.getTime() >= Vn["2024-01-01"].timestamp && typeof t == "object" && t && typeof t.code == "string" ? n = t.code : typeof t == "object" && t && typeof t.error_code == "string" && (n = t.error_code), !n) {
		if (typeof t == "object" && t && typeof t.weak_password == "object" && t.weak_password && Array.isArray(t.weak_password.reasons) && t.weak_password.reasons.length && t.weak_password.reasons.reduce((e, t) => e && typeof t == "string", !0)) throw new sr(ci(t), e.status, t.weak_password.reasons);
	} else if (n === "weak_password") throw new sr(ci(t), e.status, t.weak_password?.reasons || []);
	else if (n === "session_not_found") throw new Yn();
	throw new Gn(ci(t), e.status || 500, n);
}
var di = (e, t, n, r) => {
	let i = {
		method: e,
		headers: t?.headers || {}
	};
	return e === "GET" ? i : (i.headers = Object.assign({ "Content-Type": "application/json;charset=UTF-8" }, t?.headers), i.body = JSON.stringify(r), Object.assign(Object.assign({}, i), n));
};
async function F(e, t, n, r) {
	let i = Object.assign({}, r?.headers);
	i["X-Supabase-Api-Version"] || (i[Bn] = Vn["2024-01-01"].name), r?.jwt && (i.Authorization = `Bearer ${r.jwt}`);
	let a = r?.query ?? {};
	r?.redirectTo && (a.redirect_to = r.redirectTo);
	let o = await fi(e, t, n + (Object.keys(a).length ? "?" + new URLSearchParams(a).toString() : ""), {
		headers: i,
		noResolveJson: r?.noResolveJson
	}, {}, r?.body);
	return r?.xform ? r?.xform(o) : {
		data: Object.assign({}, o),
		error: null
	};
}
async function fi(e, t, n, r, i, a) {
	let o = di(t, r, i, a), s;
	try {
		s = await e(n, Object.assign({}, o));
	} catch (e) {
		throw new rr(ci(e), 0);
	}
	if (s.ok || await ui(s), r?.noResolveJson) return s;
	try {
		return await s.json();
	} catch (e) {
		await ui(e);
	}
}
function pi(e) {
	let t = null;
	yi(e) && (t = Object.assign({}, e), e.expires_at || (t.expires_at = xr(e.expires_in)));
	let n = e.user ?? (typeof e?.id == "string" ? e : null);
	return {
		data: {
			session: t,
			user: n
		},
		error: null
	};
}
function mi(e) {
	let t = pi(e);
	return !t.error && e.weak_password && typeof e.weak_password == "object" && Array.isArray(e.weak_password.reasons) && e.weak_password.reasons.length && e.weak_password.message && typeof e.weak_password.message == "string" && e.weak_password.reasons.reduce((e, t) => e && typeof t == "string", !0) && (t.data.weak_password = e.weak_password), t;
}
function hi(e) {
	return {
		data: { user: e.user ?? e },
		error: null
	};
}
function gi(e) {
	return {
		data: e,
		error: null
	};
}
function _i(e) {
	let { action_link: t, email_otp: n, hashed_token: r, redirect_to: i, verification_type: a } = e, o = p(e, [
		"action_link",
		"email_otp",
		"hashed_token",
		"redirect_to",
		"verification_type"
	]);
	return {
		data: {
			properties: {
				action_link: t,
				email_otp: n,
				hashed_token: r,
				redirect_to: i,
				verification_type: a
			},
			user: Object.assign({}, o)
		},
		error: null
	};
}
function vi(e) {
	return e;
}
function yi(e) {
	return !!e.access_token && !!e.refresh_token && !!e.expires_in;
}
//#endregion
//#region ../social-media-generator/node_modules/@supabase/auth-js/dist/module/lib/types.js
var bi = [
	"global",
	"local",
	"others"
], xi = class {
	constructor({ url: e = "", headers: t = {}, fetch: n, experimental: r }) {
		this.url = e, this.headers = t, this.fetch = Dr(n), this.experimental = r ?? {}, this.mfa = {
			listFactors: this._listFactors.bind(this),
			deleteFactor: this._deleteFactor.bind(this)
		}, this.oauth = {
			listClients: this._listOAuthClients.bind(this),
			createClient: this._createOAuthClient.bind(this),
			getClient: this._getOAuthClient.bind(this),
			updateClient: this._updateOAuthClient.bind(this),
			deleteClient: this._deleteOAuthClient.bind(this),
			regenerateClientSecret: this._regenerateOAuthClientSecret.bind(this)
		}, this.customProviders = {
			listProviders: this._listCustomProviders.bind(this),
			createProvider: this._createCustomProvider.bind(this),
			getProvider: this._getCustomProvider.bind(this),
			updateProvider: this._updateCustomProvider.bind(this),
			deleteProvider: this._deleteCustomProvider.bind(this)
		}, this.passkey = {
			listPasskeys: this._adminListPasskeys.bind(this),
			deletePasskey: this._adminDeletePasskey.bind(this)
		};
	}
	async signOut(e, t = bi[0]) {
		if (bi.indexOf(t) < 0) throw Error(`@supabase/auth-js: Parameter scope must be one of ${bi.join(", ")}`);
		try {
			return await F(this.fetch, "POST", `${this.url}/logout?scope=${t}`, {
				headers: this.headers,
				jwt: e,
				noResolveJson: !0
			}), {
				data: null,
				error: null
			};
		} catch (e) {
			if (P(e)) return {
				data: null,
				error: e
			};
			throw e;
		}
	}
	async inviteUserByEmail(e, t = {}) {
		try {
			return await F(this.fetch, "POST", `${this.url}/invite`, {
				body: {
					email: e,
					data: t.data
				},
				headers: this.headers,
				redirectTo: t.redirectTo,
				xform: hi
			});
		} catch (e) {
			if (P(e)) return {
				data: { user: null },
				error: e
			};
			throw e;
		}
	}
	async generateLink(e) {
		try {
			let { options: t } = e, n = p(e, ["options"]), r = Object.assign(Object.assign({}, n), t);
			return "newEmail" in n && (r.new_email = n?.newEmail, delete r.newEmail), await F(this.fetch, "POST", `${this.url}/admin/generate_link`, {
				body: r,
				headers: this.headers,
				xform: _i,
				redirectTo: t?.redirectTo
			});
		} catch (e) {
			if (P(e)) return {
				data: {
					properties: null,
					user: null
				},
				error: e
			};
			throw e;
		}
	}
	async createUser(e) {
		try {
			return await F(this.fetch, "POST", `${this.url}/admin/users`, {
				body: e,
				headers: this.headers,
				xform: hi
			});
		} catch (e) {
			if (P(e)) return {
				data: { user: null },
				error: e
			};
			throw e;
		}
	}
	async listUsers(e) {
		try {
			let t = {
				nextPage: null,
				lastPage: 0,
				total: 0
			}, n = await F(this.fetch, "GET", `${this.url}/admin/users`, {
				headers: this.headers,
				noResolveJson: !0,
				query: {
					page: (e?.page)?.toString() ?? "",
					per_page: (e?.perPage)?.toString() ?? ""
				},
				xform: vi
			});
			if (n.error) throw n.error;
			let r = await n.json(), i = n.headers.get("x-total-count") ?? 0, a = n.headers.get("link")?.split(",") ?? [];
			return a.length > 0 && (a.forEach((e) => {
				let n = parseInt(e.split(";")[0].split("=")[1].substring(0, 1)), r = JSON.parse(e.split(";")[1].split("=")[1]);
				t[`${r}Page`] = n;
			}), t.total = parseInt(i)), {
				data: Object.assign(Object.assign({}, r), t),
				error: null
			};
		} catch (e) {
			if (P(e)) return {
				data: { users: [] },
				error: e
			};
			throw e;
		}
	}
	async getUserById(e) {
		ri(e);
		try {
			return await F(this.fetch, "GET", `${this.url}/admin/users/${e}`, {
				headers: this.headers,
				xform: hi
			});
		} catch (e) {
			if (P(e)) return {
				data: { user: null },
				error: e
			};
			throw e;
		}
	}
	async updateUserById(e, t) {
		ri(e);
		try {
			return await F(this.fetch, "PUT", `${this.url}/admin/users/${e}`, {
				body: t,
				headers: this.headers,
				xform: hi
			});
		} catch (e) {
			if (P(e)) return {
				data: { user: null },
				error: e
			};
			throw e;
		}
	}
	async deleteUser(e, t = !1) {
		ri(e);
		try {
			return await F(this.fetch, "DELETE", `${this.url}/admin/users/${e}`, {
				headers: this.headers,
				body: { should_soft_delete: t },
				xform: hi
			});
		} catch (e) {
			if (P(e)) return {
				data: { user: null },
				error: e
			};
			throw e;
		}
	}
	async _listFactors(e) {
		ri(e.userId);
		try {
			let { data: t, error: n } = await F(this.fetch, "GET", `${this.url}/admin/users/${e.userId}/factors`, {
				headers: this.headers,
				xform: (e) => ({
					data: { factors: e },
					error: null
				})
			});
			return {
				data: t,
				error: n
			};
		} catch (e) {
			if (P(e)) return {
				data: null,
				error: e
			};
			throw e;
		}
	}
	async _deleteFactor(e) {
		ri(e.userId), ri(e.id);
		try {
			return {
				data: await F(this.fetch, "DELETE", `${this.url}/admin/users/${e.userId}/factors/${e.id}`, { headers: this.headers }),
				error: null
			};
		} catch (e) {
			if (P(e)) return {
				data: null,
				error: e
			};
			throw e;
		}
	}
	async _listOAuthClients(e) {
		try {
			let t = {
				nextPage: null,
				lastPage: 0,
				total: 0
			}, n = await F(this.fetch, "GET", `${this.url}/admin/oauth/clients`, {
				headers: this.headers,
				noResolveJson: !0,
				query: {
					page: (e?.page)?.toString() ?? "",
					per_page: (e?.perPage)?.toString() ?? ""
				},
				xform: vi
			});
			if (n.error) throw n.error;
			let r = await n.json(), i = n.headers.get("x-total-count") ?? 0, a = n.headers.get("link")?.split(",") ?? [];
			return a.length > 0 && (a.forEach((e) => {
				let n = parseInt(e.split(";")[0].split("=")[1].substring(0, 1)), r = JSON.parse(e.split(";")[1].split("=")[1]);
				t[`${r}Page`] = n;
			}), t.total = parseInt(i)), {
				data: Object.assign(Object.assign({}, r), t),
				error: null
			};
		} catch (e) {
			if (P(e)) return {
				data: { clients: [] },
				error: e
			};
			throw e;
		}
	}
	async _createOAuthClient(e) {
		try {
			return await F(this.fetch, "POST", `${this.url}/admin/oauth/clients`, {
				body: e,
				headers: this.headers,
				xform: (e) => ({
					data: e,
					error: null
				})
			});
		} catch (e) {
			if (P(e)) return {
				data: null,
				error: e
			};
			throw e;
		}
	}
	async _getOAuthClient(e) {
		try {
			return await F(this.fetch, "GET", `${this.url}/admin/oauth/clients/${e}`, {
				headers: this.headers,
				xform: (e) => ({
					data: e,
					error: null
				})
			});
		} catch (e) {
			if (P(e)) return {
				data: null,
				error: e
			};
			throw e;
		}
	}
	async _updateOAuthClient(e, t) {
		try {
			return await F(this.fetch, "PUT", `${this.url}/admin/oauth/clients/${e}`, {
				body: t,
				headers: this.headers,
				xform: (e) => ({
					data: e,
					error: null
				})
			});
		} catch (e) {
			if (P(e)) return {
				data: null,
				error: e
			};
			throw e;
		}
	}
	async _deleteOAuthClient(e) {
		try {
			return await F(this.fetch, "DELETE", `${this.url}/admin/oauth/clients/${e}`, {
				headers: this.headers,
				noResolveJson: !0
			}), {
				data: null,
				error: null
			};
		} catch (e) {
			if (P(e)) return {
				data: null,
				error: e
			};
			throw e;
		}
	}
	async _regenerateOAuthClientSecret(e) {
		try {
			return await F(this.fetch, "POST", `${this.url}/admin/oauth/clients/${e}/regenerate_secret`, {
				headers: this.headers,
				xform: (e) => ({
					data: e,
					error: null
				})
			});
		} catch (e) {
			if (P(e)) return {
				data: null,
				error: e
			};
			throw e;
		}
	}
	async _listCustomProviders(e) {
		try {
			let t = {};
			return e?.type && (t.type = e.type), await F(this.fetch, "GET", `${this.url}/admin/custom-providers`, {
				headers: this.headers,
				query: t,
				xform: (e) => ({
					data: { providers: e?.providers ?? [] },
					error: null
				})
			});
		} catch (e) {
			if (P(e)) return {
				data: { providers: [] },
				error: e
			};
			throw e;
		}
	}
	async _createCustomProvider(e) {
		try {
			return await F(this.fetch, "POST", `${this.url}/admin/custom-providers`, {
				body: e,
				headers: this.headers,
				xform: (e) => ({
					data: e,
					error: null
				})
			});
		} catch (e) {
			if (P(e)) return {
				data: null,
				error: e
			};
			throw e;
		}
	}
	async _getCustomProvider(e) {
		try {
			return await F(this.fetch, "GET", `${this.url}/admin/custom-providers/${e}`, {
				headers: this.headers,
				xform: (e) => ({
					data: e,
					error: null
				})
			});
		} catch (e) {
			if (P(e)) return {
				data: null,
				error: e
			};
			throw e;
		}
	}
	async _updateCustomProvider(e, t) {
		try {
			return await F(this.fetch, "PUT", `${this.url}/admin/custom-providers/${e}`, {
				body: t,
				headers: this.headers,
				xform: (e) => ({
					data: e,
					error: null
				})
			});
		} catch (e) {
			if (P(e)) return {
				data: null,
				error: e
			};
			throw e;
		}
	}
	async _deleteCustomProvider(e) {
		try {
			return await F(this.fetch, "DELETE", `${this.url}/admin/custom-providers/${e}`, {
				headers: this.headers,
				noResolveJson: !0
			}), {
				data: null,
				error: null
			};
		} catch (e) {
			if (P(e)) return {
				data: null,
				error: e
			};
			throw e;
		}
	}
	async _adminListPasskeys(e) {
		ri(e.userId);
		try {
			return await F(this.fetch, "GET", `${this.url}/admin/users/${e.userId}/passkeys`, {
				headers: this.headers,
				xform: (e) => ({
					data: e,
					error: null
				})
			});
		} catch (e) {
			if (P(e)) return {
				data: null,
				error: e
			};
			throw e;
		}
	}
	async _adminDeletePasskey(e) {
		ri(e.userId), ri(e.passkeyId);
		try {
			return await F(this.fetch, "DELETE", `${this.url}/admin/users/${e.userId}/passkeys/${e.passkeyId}`, {
				headers: this.headers,
				noResolveJson: !0
			}), {
				data: null,
				error: null
			};
		} catch (e) {
			if (P(e)) return {
				data: null,
				error: e
			};
			throw e;
		}
	}
};
//#endregion
//#region ../social-media-generator/node_modules/@supabase/auth-js/dist/module/lib/local-storage.js
function Si(e = {}) {
	return {
		getItem: (t) => e[t] || null,
		setItem: (t, n) => {
			e[t] = n;
		},
		removeItem: (t) => {
			delete e[t];
		}
	};
}
globalThis && Tr() && globalThis.localStorage && globalThis.localStorage.getItem("supabase.gotrue-js.locks.debug");
var Ci = class extends Error {
	constructor(e) {
		super(e), this.isAcquireTimeout = !0;
	}
};
//#endregion
//#region ../social-media-generator/node_modules/@supabase/auth-js/dist/module/lib/polyfills.js
function wi() {
	if (typeof globalThis != "object") try {
		Object.defineProperty(Object.prototype, "__magic__", {
			get: function() {
				return this;
			},
			configurable: !0
		}), __magic__.globalThis = __magic__, delete Object.prototype.__magic__;
	} catch {
		typeof self < "u" && (self.globalThis = self);
	}
}
//#endregion
//#region ../social-media-generator/node_modules/@supabase/auth-js/dist/module/lib/web3/ethereum.js
function Ti(e) {
	if (!/^0x[a-fA-F0-9]{40}$/.test(e)) throw Error(`@supabase/auth-js: Address "${e}" is invalid.`);
	return e.toLowerCase();
}
function Ei(e) {
	return parseInt(e, 16);
}
function Di(e) {
	let t = new TextEncoder().encode(e);
	return "0x" + Array.from(t, (e) => e.toString(16).padStart(2, "0")).join("");
}
function Oi(e) {
	let { chainId: t, domain: n, expirationTime: r, issuedAt: i = /* @__PURE__ */ new Date(), nonce: a, notBefore: o, requestId: s, resources: c, scheme: l, uri: u, version: d } = e;
	if (!Number.isInteger(t)) throw Error(`@supabase/auth-js: Invalid SIWE message field "chainId". Chain ID must be a EIP-155 chain ID. Provided value: ${t}`);
	if (!n) throw Error("@supabase/auth-js: Invalid SIWE message field \"domain\". Domain must be provided.");
	if (a && a.length < 8) throw Error(`@supabase/auth-js: Invalid SIWE message field "nonce". Nonce must be at least 8 characters. Provided value: ${a}`);
	if (!u) throw Error("@supabase/auth-js: Invalid SIWE message field \"uri\". URI must be provided.");
	if (d !== "1") throw Error(`@supabase/auth-js: Invalid SIWE message field "version". Version must be '1'. Provided value: ${d}`);
	if (e.statement?.includes("\n")) throw Error(`@supabase/auth-js: Invalid SIWE message field "statement". Statement must not include '\\n'. Provided value: ${e.statement}`);
	let f = Ti(e.address), p = `${l ? `${l}://${n}` : n} wants you to sign in with your Ethereum account:\n${f}\n\n${e.statement ? `${e.statement}\n` : ""}`, m = `URI: ${u}\nVersion: ${d}\nChain ID: ${t}${a ? `\nNonce: ${a}` : ""}\nIssued At: ${i.toISOString()}`;
	if (r && (m += `\nExpiration Time: ${r.toISOString()}`), o && (m += `\nNot Before: ${o.toISOString()}`), s && (m += `\nRequest ID: ${s}`), c) {
		let e = "\nResources:";
		for (let t of c) {
			if (!t || typeof t != "string") throw Error(`@supabase/auth-js: Invalid SIWE message field "resources". Every resource must be a valid string. Provided value: ${t}`);
			e += `\n- ${t}`;
		}
		m += e;
	}
	return `${p}\n${m}`;
}
//#endregion
//#region ../social-media-generator/node_modules/@supabase/auth-js/dist/module/lib/webauthn.errors.js
var ki = class extends Error {
	constructor({ message: e, code: t, cause: n, name: r }) {
		super(e, { cause: n }), this.__isWebAuthnError = !0, this.name = r ?? (n instanceof Error ? n.name : void 0) ?? "Unknown Error", this.code = t;
	}
	toJSON() {
		return {
			name: this.name,
			message: this.message,
			code: this.code
		};
	}
}, Ai = class extends ki {
	constructor(e, t) {
		super({
			code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
			cause: t,
			message: e
		}), this.name = "WebAuthnUnknownError", this.originalError = t;
	}
};
function ji({ error: e, options: t }) {
	let { publicKey: n } = t;
	if (!n) throw Error("options was missing required publicKey property");
	if (e.name === "AbortError") {
		if (t.signal instanceof AbortSignal) return new ki({
			message: "Registration ceremony was sent an abort signal",
			code: "ERROR_CEREMONY_ABORTED",
			cause: e
		});
	} else if (e.name === "ConstraintError") {
		if (n.authenticatorSelection?.requireResidentKey === !0) return new ki({
			message: "Discoverable credentials were required but no available authenticator supported it",
			code: "ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT",
			cause: e
		});
		if (t.mediation === "conditional" && n.authenticatorSelection?.userVerification === "required") return new ki({
			message: "User verification was required during automatic registration but it could not be performed",
			code: "ERROR_AUTO_REGISTER_USER_VERIFICATION_FAILURE",
			cause: e
		});
		if (n.authenticatorSelection?.userVerification === "required") return new ki({
			message: "User verification was required but no available authenticator supported it",
			code: "ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT",
			cause: e
		});
	} else if (e.name === "InvalidStateError") return new ki({
		message: "The authenticator was previously registered",
		code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",
		cause: e
	});
	else if (e.name === "NotAllowedError") return new ki({
		message: e.message,
		code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
		cause: e
	});
	else if (e.name === "NotSupportedError") return n.pubKeyCredParams.filter((e) => e.type === "public-key").length === 0 ? new ki({
		message: "No entry in pubKeyCredParams was of type \"public-key\"",
		code: "ERROR_MALFORMED_PUBKEYCREDPARAMS",
		cause: e
	}) : new ki({
		message: "No available authenticator supported any of the specified pubKeyCredParams algorithms",
		code: "ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG",
		cause: e
	});
	else if (e.name === "SecurityError") {
		let t = window.location.hostname;
		if (!Ri(t)) return new ki({
			message: `${window.location.hostname} is an invalid domain`,
			code: "ERROR_INVALID_DOMAIN",
			cause: e
		});
		if (n.rp.id !== t) return new ki({
			message: `The RP ID "${n.rp.id}" is invalid for this domain`,
			code: "ERROR_INVALID_RP_ID",
			cause: e
		});
	} else if (e.name === "TypeError") {
		if (n.user.id.byteLength < 1 || n.user.id.byteLength > 64) return new ki({
			message: "User ID was not between 1 and 64 characters",
			code: "ERROR_INVALID_USER_ID_LENGTH",
			cause: e
		});
	} else if (e.name === "UnknownError") return new ki({
		message: "The authenticator was unable to process the specified options, or could not create a new credential",
		code: "ERROR_AUTHENTICATOR_GENERAL_ERROR",
		cause: e
	});
	return new ki({
		message: "a Non-Webauthn related error has occurred",
		code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
		cause: e
	});
}
function Mi({ error: e, options: t }) {
	let { publicKey: n } = t;
	if (!n) throw Error("options was missing required publicKey property");
	if (e.name === "AbortError") {
		if (t.signal instanceof AbortSignal) return new ki({
			message: "Authentication ceremony was sent an abort signal",
			code: "ERROR_CEREMONY_ABORTED",
			cause: e
		});
	} else if (e.name === "NotAllowedError") return new ki({
		message: e.message,
		code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
		cause: e
	});
	else if (e.name === "SecurityError") {
		let t = window.location.hostname;
		if (!Ri(t)) return new ki({
			message: `${window.location.hostname} is an invalid domain`,
			code: "ERROR_INVALID_DOMAIN",
			cause: e
		});
		if (n.rpId !== t) return new ki({
			message: `The RP ID "${n.rpId}" is invalid for this domain`,
			code: "ERROR_INVALID_RP_ID",
			cause: e
		});
	} else if (e.name === "UnknownError") return new ki({
		message: "The authenticator was unable to process the specified options, or could not create a new assertion signature",
		code: "ERROR_AUTHENTICATOR_GENERAL_ERROR",
		cause: e
	});
	return new ki({
		message: "a Non-Webauthn related error has occurred",
		code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
		cause: e
	});
}
var Ni = new class {
	createNewAbortSignal() {
		if (this.controller) {
			let e = /* @__PURE__ */ Error("Cancelling existing WebAuthn API call for new one");
			e.name = "AbortError", this.controller.abort(e);
		}
		let e = new AbortController();
		return this.controller = e, e.signal;
	}
	cancelCeremony() {
		if (this.controller) {
			let e = /* @__PURE__ */ Error("Manually cancelling existing WebAuthn API call");
			e.name = "AbortError", this.controller.abort(e), this.controller = void 0;
		}
	}
}();
function Pi(e) {
	if (!e) throw Error("Credential creation options are required");
	if (typeof PublicKeyCredential < "u" && "parseCreationOptionsFromJSON" in PublicKeyCredential && typeof PublicKeyCredential.parseCreationOptionsFromJSON == "function") return PublicKeyCredential.parseCreationOptionsFromJSON(e);
	let { challenge: t, user: n, excludeCredentials: r } = e, i = p(e, [
		"challenge",
		"user",
		"excludeCredentials"
	]), a = vr(t).buffer, o = Object.assign(Object.assign({}, n), { id: vr(n.id).buffer }), s = Object.assign(Object.assign({}, i), {
		challenge: a,
		user: o
	});
	if (r && r.length > 0) {
		s.excludeCredentials = Array(r.length);
		for (let e = 0; e < r.length; e++) {
			let t = r[e];
			s.excludeCredentials[e] = Object.assign(Object.assign({}, t), {
				id: vr(t.id).buffer,
				type: t.type || "public-key",
				transports: t.transports
			});
		}
	}
	return s;
}
function Fi(e) {
	if (!e) throw Error("Credential request options are required");
	if (typeof PublicKeyCredential < "u" && "parseRequestOptionsFromJSON" in PublicKeyCredential && typeof PublicKeyCredential.parseRequestOptionsFromJSON == "function") return PublicKeyCredential.parseRequestOptionsFromJSON(e);
	let { challenge: t, allowCredentials: n } = e, r = p(e, ["challenge", "allowCredentials"]), i = vr(t).buffer, a = Object.assign(Object.assign({}, r), { challenge: i });
	if (n && n.length > 0) {
		a.allowCredentials = Array(n.length);
		for (let e = 0; e < n.length; e++) {
			let t = n[e];
			a.allowCredentials[e] = Object.assign(Object.assign({}, t), {
				id: vr(t.id).buffer,
				type: t.type || "public-key",
				transports: t.transports
			});
		}
	}
	return a;
}
function Ii(e) {
	if ("toJSON" in e && typeof e.toJSON == "function") return e.toJSON();
	let t = e;
	return {
		id: e.id,
		rawId: e.id,
		response: {
			attestationObject: br(new Uint8Array(e.response.attestationObject)),
			clientDataJSON: br(new Uint8Array(e.response.clientDataJSON))
		},
		type: "public-key",
		clientExtensionResults: e.getClientExtensionResults(),
		authenticatorAttachment: t.authenticatorAttachment ?? void 0
	};
}
function Li(e) {
	if ("toJSON" in e && typeof e.toJSON == "function") return e.toJSON();
	let t = e, n = e.getClientExtensionResults(), r = e.response;
	return {
		id: e.id,
		rawId: e.id,
		response: {
			authenticatorData: br(new Uint8Array(r.authenticatorData)),
			clientDataJSON: br(new Uint8Array(r.clientDataJSON)),
			signature: br(new Uint8Array(r.signature)),
			userHandle: r.userHandle ? br(new Uint8Array(r.userHandle)) : void 0
		},
		type: "public-key",
		clientExtensionResults: n,
		authenticatorAttachment: t.authenticatorAttachment ?? void 0
	};
}
function Ri(e) {
	return e === "localhost" || /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(e);
}
function zi() {
	return !!(Cr() && "PublicKeyCredential" in window && window.PublicKeyCredential && "credentials" in navigator && typeof (navigator == null ? void 0 : navigator.credentials)?.create == "function" && typeof (navigator == null ? void 0 : navigator.credentials)?.get == "function");
}
async function Bi(e) {
	try {
		let t = await navigator.credentials.create(e);
		return t ? t instanceof PublicKeyCredential ? {
			data: t,
			error: null
		} : {
			data: null,
			error: new Ai("Browser returned unexpected credential type", t)
		} : {
			data: null,
			error: new Ai("Empty credential response", t)
		};
	} catch (t) {
		return {
			data: null,
			error: ji({
				error: t,
				options: e
			})
		};
	}
}
async function Vi(e) {
	try {
		let t = await navigator.credentials.get(e);
		return t ? t instanceof PublicKeyCredential ? {
			data: t,
			error: null
		} : {
			data: null,
			error: new Ai("Browser returned unexpected credential type", t)
		} : {
			data: null,
			error: new Ai("Empty credential response", t)
		};
	} catch (t) {
		return {
			data: null,
			error: Mi({
				error: t,
				options: e
			})
		};
	}
}
var Hi = {
	hints: ["security-key"],
	authenticatorSelection: {
		authenticatorAttachment: "cross-platform",
		requireResidentKey: !1,
		userVerification: "preferred",
		residentKey: "discouraged"
	},
	attestation: "direct"
}, Ui = {
	userVerification: "preferred",
	hints: ["security-key"],
	attestation: "direct"
};
function Wi(...e) {
	let t = (e) => typeof e == "object" && !!e && !Array.isArray(e), n = (e) => e instanceof ArrayBuffer || ArrayBuffer.isView(e), r = {};
	for (let i of e) if (i) for (let e in i) {
		let a = i[e];
		if (a !== void 0) {
			if (Array.isArray(a)) r[e] = a;
			else if (n(a)) r[e] = a;
			else if (t(a)) {
				let n = r[e];
				r[e] = t(n) ? Wi(n, a) : Wi(a);
			} else r[e] = a;
		}
	}
	return r;
}
function Gi(e, t) {
	return Wi(Hi, e, t || {});
}
function Ki(e, t) {
	return Wi(Ui, e, t || {});
}
var qi = class {
	constructor(e) {
		this.client = e, this.enroll = this._enroll.bind(this), this.challenge = this._challenge.bind(this), this.verify = this._verify.bind(this), this.authenticate = this._authenticate.bind(this), this.register = this._register.bind(this);
	}
	async _enroll(e) {
		return this.client.mfa.enroll(Object.assign(Object.assign({}, e), { factorType: "webauthn" }));
	}
	async _challenge({ factorId: e, webauthn: t, friendlyName: n, signal: r }, i) {
		try {
			let { data: a, error: o } = await this.client.mfa.challenge({
				factorId: e,
				webauthn: t
			});
			if (!a) return {
				data: null,
				error: o
			};
			let s = r ?? Ni.createNewAbortSignal();
			if (a.webauthn.type === "create") {
				let { user: e } = a.webauthn.credential_options.publicKey;
				if (!e.name) {
					let t = n;
					if (t) e.name = `${e.id}:${t}`;
					else {
						let t = (await this.client.getUser()).data.user, n = t?.user_metadata?.name || t?.email || t?.id || "User";
						e.name = `${e.id}:${n}`;
					}
				}
				e.displayName ||= e.name;
			}
			switch (a.webauthn.type) {
				case "create": {
					let { data: t, error: n } = await Bi({
						publicKey: Gi(a.webauthn.credential_options.publicKey, i?.create),
						signal: s
					});
					return t ? {
						data: {
							factorId: e,
							challengeId: a.id,
							webauthn: {
								type: a.webauthn.type,
								credential_response: t
							}
						},
						error: null
					} : {
						data: null,
						error: n
					};
				}
				case "request": {
					let t = Ki(a.webauthn.credential_options.publicKey, i?.request), { data: n, error: r } = await Vi(Object.assign(Object.assign({}, a.webauthn.credential_options), {
						publicKey: t,
						signal: s
					}));
					return n ? {
						data: {
							factorId: e,
							challengeId: a.id,
							webauthn: {
								type: a.webauthn.type,
								credential_response: n
							}
						},
						error: null
					} : {
						data: null,
						error: r
					};
				}
			}
		} catch (e) {
			return P(e) ? {
				data: null,
				error: e
			} : {
				data: null,
				error: new qn("Unexpected error in challenge", e)
			};
		}
	}
	async _verify({ challengeId: e, factorId: t, webauthn: n }) {
		return this.client.mfa.verify({
			factorId: t,
			challengeId: e,
			webauthn: n
		});
	}
	async _authenticate({ factorId: e, webauthn: { rpId: t = typeof window < "u" ? window.location.hostname : void 0, rpOrigins: n = typeof window < "u" ? [window.location.origin] : void 0, signal: r } = {} }, i) {
		if (!t) return {
			data: null,
			error: new Wn("rpId is required for WebAuthn authentication")
		};
		try {
			if (!zi()) return {
				data: null,
				error: new qn("Browser does not support WebAuthn", null)
			};
			let { data: a, error: o } = await this.challenge({
				factorId: e,
				webauthn: {
					rpId: t,
					rpOrigins: n
				},
				signal: r
			}, { request: i });
			if (!a) return {
				data: null,
				error: o
			};
			let { webauthn: s } = a;
			return this._verify({
				factorId: e,
				challengeId: a.challengeId,
				webauthn: {
					type: s.type,
					rpId: t,
					rpOrigins: n,
					credential_response: s.credential_response
				}
			});
		} catch (e) {
			return P(e) ? {
				data: null,
				error: e
			} : {
				data: null,
				error: new qn("Unexpected error in authenticate", e)
			};
		}
	}
	async _register({ friendlyName: e, webauthn: { rpId: t = typeof window < "u" ? window.location.hostname : void 0, rpOrigins: n = typeof window < "u" ? [window.location.origin] : void 0, signal: r } = {} }, i) {
		if (!t) return {
			data: null,
			error: new Wn("rpId is required for WebAuthn registration")
		};
		try {
			if (!zi()) return {
				data: null,
				error: new qn("Browser does not support WebAuthn", null)
			};
			let { data: a, error: o } = await this._enroll({ friendlyName: e });
			if (!a) return await this.client.mfa.listFactors().then((t) => t.data?.all.find((t) => t.factor_type === "webauthn" && t.friendly_name === e && t.status === "unverified")).then((e) => e ? this.client.mfa.unenroll({ factorId: e?.id }) : void 0), {
				data: null,
				error: o
			};
			let { data: s, error: c } = await this._challenge({
				factorId: a.id,
				friendlyName: a.friendly_name,
				webauthn: {
					rpId: t,
					rpOrigins: n
				},
				signal: r
			}, { create: i });
			return s ? this._verify({
				factorId: a.id,
				challengeId: s.challengeId,
				webauthn: {
					rpId: t,
					rpOrigins: n,
					type: s.webauthn.type,
					credential_response: s.webauthn.credential_response
				}
			}) : {
				data: null,
				error: c
			};
		} catch (e) {
			return P(e) ? {
				data: null,
				error: e
			} : {
				data: null,
				error: new qn("Unexpected error in register", e)
			};
		}
	}
};
//#endregion
//#region ../social-media-generator/node_modules/@supabase/auth-js/dist/module/GoTrueClient.js
wi();
var Ji = {
	url: Ln,
	storageKey: Rn,
	autoRefreshToken: !0,
	persistSession: !0,
	detectSessionInUrl: !0,
	headers: zn,
	flowType: "implicit",
	debug: !1,
	hasCustomAuthorizationHeader: !1,
	throwOnError: !1,
	lockAcquireTimeout: 5e3,
	skipAutoInitialize: !1,
	experimental: {}
}, Yi = {}, Xi = !1, Zi = class e {
	get jwks() {
		return Yi[this.storageKey]?.jwks ?? { keys: [] };
	}
	set jwks(e) {
		Yi[this.storageKey] = Object.assign(Object.assign({}, Yi[this.storageKey]), { jwks: e });
	}
	get jwks_cached_at() {
		return Yi[this.storageKey]?.cachedAt ?? -(2 ** 53 - 1);
	}
	set jwks_cached_at(e) {
		Yi[this.storageKey] = Object.assign(Object.assign({}, Yi[this.storageKey]), { cachedAt: e });
	}
	constructor(t) {
		var n;
		this.userStorage = null, this.memoryStorage = null, this.stateChangeEmitters = /* @__PURE__ */ new Map(), this.autoRefreshTicker = null, this.autoRefreshTickTimeout = null, this.visibilityChangedCallback = null, this.refreshingDeferred = null, this.lastRefreshFailure = null, this._sessionRemovalEpoch = 0, this.initializePromise = null, this._pendingInitNotifications = null, this.detectSessionInUrl = !0, this.hasCustomAuthorizationHeader = !1, this.suppressGetSessionWarning = !1, this.lock = null, this.lockAcquired = !1, this.pendingInLock = [], this.broadcastChannel = null, this.logger = console.log;
		let r = Object.assign(Object.assign({}, Ji), t);
		if (this.storageKey = r.storageKey, this.instanceID = e.nextInstanceID[this.storageKey] ?? 0, e.nextInstanceID[this.storageKey] = this.instanceID + 1, this.logDebugMessages = !!r.debug, typeof r.debug == "function" && (this.logger = r.debug), this.instanceID > 0 && Cr()) {
			let e = `${this._logPrefix()} Multiple GoTrueClient instances detected in the same browser context. It is not an error, but this should be avoided as it may produce undefined behavior when used concurrently under the same storage key.`;
			console.warn(e), this.logDebugMessages && console.trace(e);
		}
		if (this.persistSession = r.persistSession, this.autoRefreshToken = r.autoRefreshToken, this.experimental = r.experimental ?? {}, this.admin = new xi({
			url: r.url,
			headers: r.headers,
			fetch: r.fetch,
			experimental: this.experimental
		}), this.url = r.url, this.headers = r.headers, this.fetch = Dr(r.fetch), this.detectSessionInUrl = r.detectSessionInUrl, this.flowType = r.flowType, this.hasCustomAuthorizationHeader = r.hasCustomAuthorizationHeader, this.throwOnError = r.throwOnError, this.lockAcquireTimeout = r.lockAcquireTimeout, r.lock != null && (this.lock = r.lock, Xi || (Xi = !0, console.warn(`${this._logPrefix()} The "lock" option is deprecated and will be removed in v3. The client now coordinates session refreshes without a lock, so most apps can drop the option. See https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/migrations/lockless-coordination.md`))), this.jwks || (this.jwks = { keys: [] }, this.jwks_cached_at = -(2 ** 53 - 1)), this.mfa = {
			verify: this._verify.bind(this),
			enroll: this._enroll.bind(this),
			unenroll: this._unenroll.bind(this),
			challenge: this._challenge.bind(this),
			listFactors: this._listFactors.bind(this),
			challengeAndVerify: this._challengeAndVerify.bind(this),
			getAuthenticatorAssuranceLevel: this._getAuthenticatorAssuranceLevel.bind(this),
			webauthn: new qi(this),
			recoveryCodes: {
				getStatus: this._getRecoveryCodesStatus.bind(this),
				generate: this._generateRecoveryCodes.bind(this),
				verify: this._verifyRecoveryCode.bind(this),
				regenerate: this._regenerateRecoveryCodes.bind(this),
				unenroll: this._unenrollRecoveryCodes.bind(this)
			}
		}, this.oauth = {
			getAuthorizationDetails: this._getAuthorizationDetails.bind(this),
			approveAuthorization: this._approveAuthorization.bind(this),
			denyAuthorization: this._denyAuthorization.bind(this),
			listGrants: this._listOAuthGrants.bind(this),
			revokeGrant: this._revokeOAuthGrant.bind(this)
		}, this.passkey = {
			startRegistration: this._startPasskeyRegistration.bind(this),
			verifyRegistration: this._verifyPasskeyRegistration.bind(this),
			startAuthentication: this._startPasskeyAuthentication.bind(this),
			verifyAuthentication: this._verifyPasskeyAuthentication.bind(this),
			list: this._listPasskeys.bind(this),
			update: this._updatePasskey.bind(this),
			delete: this._deletePasskey.bind(this)
		}, this.persistSession ? (r.storage ? this.storage = r.storage : Tr() ? this.storage = globalThis.localStorage : (this.memoryStorage = {}, this.storage = Si(this.memoryStorage)), r.userStorage && (this.userStorage = r.userStorage)) : (this.memoryStorage = {}, this.storage = Si(this.memoryStorage)), Cr() && globalThis.BroadcastChannel && this.persistSession && this.storageKey) {
			try {
				this.broadcastChannel = new globalThis.BroadcastChannel(this.storageKey);
			} catch (e) {
				console.error("Failed to create a new BroadcastChannel, multi-tab state changes will not be available", e);
			}
			(n = this.broadcastChannel) == null || n.addEventListener("message", async (e) => {
				this._debug("received broadcast notification from other tab or client", e), (e.data.event === "TOKEN_REFRESHED" || e.data.event === "SIGNED_IN") && (this.lastRefreshFailure = null);
				try {
					await this._notifyAllSubscribers(e.data.event, e.data.session, !1);
				} catch (e) {
					this._debug("#broadcastChannel", "error", e);
				}
			});
		}
		r.skipAutoInitialize || this.initialize().catch((e) => {
			this._debug("#initialize()", "error", e);
		});
	}
	isThrowOnErrorEnabled() {
		return this.throwOnError;
	}
	_returnResult(e) {
		if (this.throwOnError && e && e.error) throw e.error;
		return e;
	}
	_logPrefix() {
		return `GoTrueClient@${this.storageKey}:${this.instanceID} (${Nn}) ${(/* @__PURE__ */ new Date()).toISOString()}`;
	}
	_debug(...e) {
		return this.logDebugMessages && this.logger(this._logPrefix(), ...e), this;
	}
	async initialize() {
		if (this.initializePromise) return await this.initializePromise;
		this._pendingInitNotifications = [], this.initializePromise = (async () => this.lock == null ? await this._initialize() : await this._acquireLock(this.lockAcquireTimeout, async () => await this._initialize()))();
		let e = await this.initializePromise, t = this._pendingInitNotifications ?? [];
		this._pendingInitNotifications = null;
		for (let e of t) await this._notifyAllSubscribers(e.event, e.session, e.broadcast);
		return e;
	}
	async _initialize() {
		try {
			let e = {}, t = "none";
			if (Cr() && (e = Er(window.location.href), this._isImplicitGrantCallback(e) ? t = "implicit" : await this._isPKCECallback(e) && (t = "pkce")), Cr() && this.detectSessionInUrl && t !== "none") {
				let { data: n, error: r } = await this._getSessionFromURL(e, t);
				if (r) {
					if (this._debug("#_initialize()", "error detecting session from URL", r), er(r)) {
						let e = r.details?.code;
						if (e === "identity_already_exists" || e === "identity_not_found" || e === "single_identity_not_deletable") return { error: r };
					}
					return { error: r };
				}
				let { session: i, redirectType: a } = n;
				return this._debug("#_initialize()", "detected session in URL", i, "redirect type", a), await this._saveSession(i), setTimeout(async () => {
					a === "recovery" ? await this._notifyAllSubscribers("PASSWORD_RECOVERY", i) : await this._notifyAllSubscribers("SIGNED_IN", i);
				}, 0), { error: null };
			}
			return await this._recoverAndRefresh(), { error: null };
		} catch (e) {
			return P(e) ? this._returnResult({ error: e }) : this._returnResult({ error: new qn("Unexpected error during initialization", e) });
		} finally {
			await this._handleVisibilityChange(), this._debug("#_initialize()", "end");
		}
	}
	async signInAnonymously(e) {
		try {
			let { data: t, error: n } = await F(this.fetch, "POST", `${this.url}/signup`, {
				headers: this.headers,
				body: {
					data: e?.options?.data ?? {},
					gotrue_meta_security: { captcha_token: e?.options?.captchaToken }
				},
				xform: pi
			});
			if (n || !t) return this._returnResult({
				data: {
					user: null,
					session: null
				},
				error: n
			});
			let r = t.session, i = t.user;
			return t.session && (await this._saveSession(t.session), await this._notifyAllSubscribers("SIGNED_IN", r)), this._returnResult({
				data: {
					user: i,
					session: r
				},
				error: null
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: {
					user: null,
					session: null
				},
				error: e
			});
			throw e;
		}
	}
	async signUp(e) {
		let t = null;
		try {
			let n;
			if ("email" in e) {
				let { email: r, password: i, options: a } = e, o = null, s = null;
				this.flowType === "pkce" && ([o, s, t] = await this._getCodeChallengeAndMethod()), n = await F(this.fetch, "POST", `${this.url}/signup`, {
					headers: this.headers,
					redirectTo: this._maybeAppendFlowIdToRedirect(a?.emailRedirectTo, t),
					body: {
						email: r,
						password: i,
						data: a?.data ?? {},
						gotrue_meta_security: { captcha_token: a?.captchaToken },
						code_challenge: o,
						code_challenge_method: s
					},
					xform: pi
				});
			} else if ("phone" in e) {
				let { phone: t, password: r, options: i } = e;
				n = await F(this.fetch, "POST", `${this.url}/signup`, {
					headers: this.headers,
					body: {
						phone: t,
						password: r,
						data: i?.data ?? {},
						channel: i?.channel ?? "sms",
						gotrue_meta_security: { captcha_token: i?.captchaToken }
					},
					xform: pi
				});
			} else throw new Qn("You must provide either an email or phone number and a password");
			let { data: r, error: i } = n;
			if (i || !r) return await Jr(this.storage, this.storageKey, t), this._returnResult({
				data: {
					user: null,
					session: null
				},
				error: i
			});
			let a = r.session, o = r.user;
			return r.session && (await this._saveSession(r.session), await this._notifyAllSubscribers("SIGNED_IN", a)), this._returnResult({
				data: {
					user: o,
					session: a
				},
				error: null
			});
		} catch (e) {
			if (await Jr(this.storage, this.storageKey, t), P(e)) return this._returnResult({
				data: {
					user: null,
					session: null
				},
				error: e
			});
			throw e;
		}
	}
	async signInWithPassword(e) {
		try {
			let t;
			if ("email" in e) {
				let { email: n, password: r, options: i } = e;
				t = await F(this.fetch, "POST", `${this.url}/token?grant_type=password`, {
					headers: this.headers,
					body: {
						email: n,
						password: r,
						gotrue_meta_security: { captcha_token: i?.captchaToken }
					},
					xform: mi
				});
			} else if ("phone" in e) {
				let { phone: n, password: r, options: i } = e;
				t = await F(this.fetch, "POST", `${this.url}/token?grant_type=password`, {
					headers: this.headers,
					body: {
						phone: n,
						password: r,
						gotrue_meta_security: { captcha_token: i?.captchaToken }
					},
					xform: mi
				});
			} else throw new Qn("You must provide either an email or phone number and a password");
			let { data: n, error: r } = t;
			if (r) return this._returnResult({
				data: {
					user: null,
					session: null
				},
				error: r
			});
			if (!n || !n.session || !n.user) {
				let e = new Zn();
				return this._returnResult({
					data: {
						user: null,
						session: null
					},
					error: e
				});
			}
			return n.session && (await this._saveSession(n.session), await this._notifyAllSubscribers("SIGNED_IN", n.session)), this._returnResult({
				data: Object.assign({
					user: n.user,
					session: n.session
				}, n.weak_password ? { weakPassword: n.weak_password } : null),
				error: r
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: {
					user: null,
					session: null
				},
				error: e
			});
			throw e;
		}
	}
	async signInWithOAuth(e) {
		return await this._handleProviderSignIn(e.provider, {
			redirectTo: e.options?.redirectTo,
			scopes: e.options?.scopes,
			queryParams: e.options?.queryParams,
			skipBrowserRedirect: e.options?.skipBrowserRedirect
		});
	}
	async exchangeCodeForSession(e, t) {
		return await this.initializePromise, this.lock == null ? this._exchangeCodeForSession(e, t) : this._acquireLock(this.lockAcquireTimeout, async () => this._exchangeCodeForSession(e, t));
	}
	async signInWithWeb3(e) {
		let { chain: t } = e;
		switch (t) {
			case "ethereum": return await this.signInWithEthereum(e);
			case "solana": return await this.signInWithSolana(e);
			default: throw Error(`@supabase/auth-js: Unsupported chain "${t}"`);
		}
	}
	async signInWithEthereum(e) {
		let t, n;
		if ("message" in e) t = e.message, n = e.signature;
		else {
			let { chain: r, wallet: i, statement: a, options: o } = e, s;
			if (!Cr()) {
				if (typeof i != "object" || !o?.url) throw Error("@supabase/auth-js: Both wallet and url must be specified in non-browser environments.");
				s = i;
			} else if (typeof i == "object") s = i;
			else {
				let e = window;
				if ("ethereum" in e && typeof e.ethereum == "object" && "request" in e.ethereum && typeof e.ethereum.request == "function") s = e.ethereum;
				else throw Error("@supabase/auth-js: No compatible Ethereum wallet interface on the window object (window.ethereum) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'ethereum', wallet: resolvedUserWallet }) instead.");
			}
			let c = new URL(o?.url ?? window.location.href), l = await s.request({ method: "eth_requestAccounts" }).then((e) => e).catch(() => {
				throw Error("@supabase/auth-js: Wallet method eth_requestAccounts is missing or invalid");
			});
			if (!l || l.length === 0) throw Error("@supabase/auth-js: No accounts available. Please ensure the wallet is connected.");
			let u = Ti(l[0]), d = o?.signInWithEthereum?.chainId;
			d ||= Ei(await s.request({ method: "eth_chainId" })), t = Oi({
				domain: c.host,
				address: u,
				statement: a,
				uri: c.href,
				version: "1",
				chainId: d,
				nonce: o?.signInWithEthereum?.nonce,
				issuedAt: o?.signInWithEthereum?.issuedAt ?? /* @__PURE__ */ new Date(),
				expirationTime: o?.signInWithEthereum?.expirationTime,
				notBefore: o?.signInWithEthereum?.notBefore,
				requestId: o?.signInWithEthereum?.requestId,
				resources: o?.signInWithEthereum?.resources
			}), n = await s.request({
				method: "personal_sign",
				params: [Di(t), u]
			});
		}
		try {
			let { data: r, error: i } = await F(this.fetch, "POST", `${this.url}/token?grant_type=web3`, {
				headers: this.headers,
				body: Object.assign({
					chain: "ethereum",
					message: t,
					signature: n
				}, e.options?.captchaToken ? { gotrue_meta_security: { captcha_token: e.options?.captchaToken } } : null),
				xform: pi
			});
			if (i) throw i;
			if (!r || !r.session || !r.user) {
				let e = new Zn();
				return this._returnResult({
					data: {
						user: null,
						session: null
					},
					error: e
				});
			}
			return r.session && (await this._saveSession(r.session), await this._notifyAllSubscribers("SIGNED_IN", r.session)), this._returnResult({
				data: Object.assign({}, r),
				error: i
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: {
					user: null,
					session: null
				},
				error: e
			});
			throw e;
		}
	}
	async signInWithSolana(e) {
		let t, n;
		if ("message" in e) t = e.message, n = e.signature;
		else {
			let { chain: r, wallet: i, statement: a, options: o } = e, s;
			if (!Cr()) {
				if (typeof i != "object" || !o?.url) throw Error("@supabase/auth-js: Both wallet and url must be specified in non-browser environments.");
				s = i;
			} else if (typeof i == "object") s = i;
			else {
				let e = window;
				if ("solana" in e && typeof e.solana == "object" && ("signIn" in e.solana && typeof e.solana.signIn == "function" || "signMessage" in e.solana && typeof e.solana.signMessage == "function")) s = e.solana;
				else throw Error("@supabase/auth-js: No compatible Solana wallet interface on the window object (window.solana) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'solana', wallet: resolvedUserWallet }) instead.");
			}
			let c = new URL(o?.url ?? window.location.href);
			if ("signIn" in s && s.signIn) {
				let e = await s.signIn(Object.assign(Object.assign(Object.assign({ issuedAt: (/* @__PURE__ */ new Date()).toISOString() }, o?.signInWithSolana), {
					version: "1",
					domain: c.host,
					uri: c.href
				}), a ? { statement: a } : null)), r;
				if (Array.isArray(e) && e[0] && typeof e[0] == "object") r = e[0];
				else if (e && typeof e == "object" && "signedMessage" in e && "signature" in e) r = e;
				else throw Error("@supabase/auth-js: Wallet method signIn() returned unrecognized value");
				if ("signedMessage" in r && "signature" in r && (typeof r.signedMessage == "string" || r.signedMessage instanceof Uint8Array) && r.signature instanceof Uint8Array) t = typeof r.signedMessage == "string" ? r.signedMessage : new TextDecoder().decode(r.signedMessage), n = r.signature;
				else throw Error("@supabase/auth-js: Wallet method signIn() API returned object without signedMessage and signature fields");
			} else {
				if (!("signMessage" in s) || typeof s.signMessage != "function" || !("publicKey" in s) || typeof s != "object" || !s.publicKey || !("toBase58" in s.publicKey) || typeof s.publicKey.toBase58 != "function") throw Error("@supabase/auth-js: Wallet does not have a compatible signMessage() and publicKey.toBase58() API");
				t = [
					`${c.host} wants you to sign in with your Solana account:`,
					s.publicKey.toBase58(),
					...a ? [
						"",
						a,
						""
					] : [""],
					"Version: 1",
					`URI: ${c.href}`,
					`Issued At: ${o?.signInWithSolana?.issuedAt ?? (/* @__PURE__ */ new Date()).toISOString()}`,
					...o?.signInWithSolana?.notBefore ? [`Not Before: ${o.signInWithSolana.notBefore}`] : [],
					...o?.signInWithSolana?.expirationTime ? [`Expiration Time: ${o.signInWithSolana.expirationTime}`] : [],
					...o?.signInWithSolana?.chainId ? [`Chain ID: ${o.signInWithSolana.chainId}`] : [],
					...o?.signInWithSolana?.nonce ? [`Nonce: ${o.signInWithSolana.nonce}`] : [],
					...o?.signInWithSolana?.requestId ? [`Request ID: ${o.signInWithSolana.requestId}`] : [],
					...o?.signInWithSolana?.resources?.length ? ["Resources", ...o.signInWithSolana.resources.map((e) => `- ${e}`)] : []
				].join("\n");
				let e = await s.signMessage(new TextEncoder().encode(t), "utf8");
				if (!e || !(e instanceof Uint8Array)) throw Error("@supabase/auth-js: Wallet signMessage() API returned an recognized value");
				n = e;
			}
		}
		try {
			let { data: r, error: i } = await F(this.fetch, "POST", `${this.url}/token?grant_type=web3`, {
				headers: this.headers,
				body: Object.assign({
					chain: "solana",
					message: t,
					signature: br(n)
				}, e.options?.captchaToken ? { gotrue_meta_security: { captcha_token: e.options?.captchaToken } } : null),
				xform: pi
			});
			if (i) throw i;
			if (!r || !r.session || !r.user) {
				let e = new Zn();
				return this._returnResult({
					data: {
						user: null,
						session: null
					},
					error: e
				});
			}
			return r.session && (await this._saveSession(r.session), await this._notifyAllSubscribers("SIGNED_IN", r.session)), this._returnResult({
				data: Object.assign({}, r),
				error: i
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: {
					user: null,
					session: null
				},
				error: e
			});
			throw e;
		}
	}
	async _exchangeCodeForSession(e, t) {
		let n = t?.flowId != null, r = n ? Vr(t?.flowId) : Cr() ? Vr(Er(window.location.href)[Un]) : null;
		n && !r && this._debug("#_exchangeCodeForSession()", "provided flowId is not a valid flow id", t?.flowId);
		let { verifier: i, flowId: a } = n && !r ? {
			verifier: null,
			flowId: null
		} : await qr(this.storage, this.storageKey, r), [o, s] = (i ?? "").split("/");
		try {
			if (!o && this.flowType === "pkce") throw new nr();
			let { data: t, error: n } = await F(this.fetch, "POST", `${this.url}/token?grant_type=pkce`, {
				headers: this.headers,
				body: {
					auth_code: e,
					code_verifier: o
				},
				xform: pi
			});
			if (await Jr(this.storage, this.storageKey, a), n) throw n;
			if (!t || !t.session || !t.user) {
				let e = new Zn();
				return this._returnResult({
					data: {
						user: null,
						session: null,
						redirectType: null
					},
					error: e
				});
			}
			return t.session && (await this._saveSession(t.session), await this._notifyAllSubscribers(s === "recovery" ? "PASSWORD_RECOVERY" : "SIGNED_IN", t.session)), this._returnResult({
				data: Object.assign(Object.assign({}, t), { redirectType: s ?? null }),
				error: n
			});
		} catch (e) {
			if (await Jr(this.storage, this.storageKey, a), P(e)) return this._returnResult({
				data: {
					user: null,
					session: null,
					redirectType: null
				},
				error: e
			});
			throw e;
		}
	}
	async signInWithIdToken(e) {
		try {
			let { options: t, provider: n, token: r, access_token: i, nonce: a } = e, { data: o, error: s } = await F(this.fetch, "POST", `${this.url}/token?grant_type=id_token`, {
				headers: this.headers,
				body: {
					provider: n,
					id_token: r,
					access_token: i,
					nonce: a,
					gotrue_meta_security: { captcha_token: t?.captchaToken }
				},
				xform: pi
			});
			if (s) return this._returnResult({
				data: {
					user: null,
					session: null
				},
				error: s
			});
			if (!o || !o.session || !o.user) {
				let e = new Zn();
				return this._returnResult({
					data: {
						user: null,
						session: null
					},
					error: e
				});
			}
			return o.session && (await this._saveSession(o.session), await this._notifyAllSubscribers("SIGNED_IN", o.session)), this._returnResult({
				data: o,
				error: s
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: {
					user: null,
					session: null
				},
				error: e
			});
			throw e;
		}
	}
	async signInWithOtp(e) {
		let t = null;
		try {
			if ("email" in e) {
				let { email: n, options: r } = e, i = null, a = null;
				this.flowType === "pkce" && ([i, a, t] = await this._getCodeChallengeAndMethod());
				let { error: o } = await F(this.fetch, "POST", `${this.url}/otp`, {
					headers: this.headers,
					body: {
						email: n,
						data: r?.data ?? {},
						create_user: r?.shouldCreateUser ?? !0,
						gotrue_meta_security: { captcha_token: r?.captchaToken },
						code_challenge: i,
						code_challenge_method: a
					},
					redirectTo: this._maybeAppendFlowIdToRedirect(r?.emailRedirectTo, t)
				});
				return this._returnResult({
					data: {
						user: null,
						session: null
					},
					error: o
				});
			}
			if ("phone" in e) {
				let { phone: t, options: n } = e, { data: r, error: i } = await F(this.fetch, "POST", `${this.url}/otp`, {
					headers: this.headers,
					body: {
						phone: t,
						data: n?.data ?? {},
						create_user: n?.shouldCreateUser ?? !0,
						gotrue_meta_security: { captcha_token: n?.captchaToken },
						channel: n?.channel ?? "sms"
					}
				});
				return this._returnResult({
					data: {
						user: null,
						session: null,
						messageId: r?.message_id
					},
					error: i
				});
			}
			throw new Qn("You must provide either an email or phone number.");
		} catch (e) {
			if (await Jr(this.storage, this.storageKey, t), P(e)) return this._returnResult({
				data: {
					user: null,
					session: null
				},
				error: e
			});
			throw e;
		}
	}
	async verifyOtp(e) {
		try {
			let t, n;
			"options" in e && (t = e.options?.redirectTo, n = e.options?.captchaToken);
			let { data: r, error: i } = await F(this.fetch, "POST", `${this.url}/verify`, {
				headers: this.headers,
				body: Object.assign(Object.assign({}, e), { gotrue_meta_security: { captcha_token: n } }),
				redirectTo: t,
				xform: pi
			});
			if (i) throw i;
			if (!r) throw /* @__PURE__ */ Error("An error occurred on token verification.");
			let a = r.session, o = r.user;
			return a?.access_token && (await this._saveSession(a), await this._notifyAllSubscribers(e.type == "recovery" ? "PASSWORD_RECOVERY" : "SIGNED_IN", a)), this._returnResult({
				data: {
					user: o,
					session: a
				},
				error: null
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: {
					user: null,
					session: null
				},
				error: e
			});
			throw e;
		}
	}
	async signInWithSSO(e) {
		let t = null;
		try {
			let n = null, r = null;
			this.flowType === "pkce" && ([n, r, t] = await this._getCodeChallengeAndMethod());
			let i = await F(this.fetch, "POST", `${this.url}/sso`, {
				body: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, "providerId" in e ? { provider_id: e.providerId } : null), "domain" in e ? { domain: e.domain } : null), { redirect_to: this._maybeAppendFlowIdToRedirect(e.options?.redirectTo, t) }), e?.options?.captchaToken ? { gotrue_meta_security: { captcha_token: e.options.captchaToken } } : null), {
					skip_http_redirect: !0,
					code_challenge: n,
					code_challenge_method: r
				}),
				headers: this.headers,
				xform: gi
			});
			return i.data?.url && Cr() && !e.options?.skipBrowserRedirect && window.location.assign(i.data.url), this._returnResult(i);
		} catch (e) {
			if (await Jr(this.storage, this.storageKey, t), P(e)) return this._returnResult({
				data: null,
				error: e
			});
			throw e;
		}
	}
	async reauthenticate() {
		return await this.initializePromise, this.lock == null ? await this._reauthenticate() : await this._acquireLock(this.lockAcquireTimeout, async () => await this._reauthenticate());
	}
	async _reauthenticate() {
		try {
			return await this._useSession(async (e) => {
				let { data: { session: t }, error: n } = e;
				if (n) throw n;
				if (!t) throw new Yn();
				let { error: r } = await F(this.fetch, "GET", `${this.url}/reauthenticate`, {
					headers: this.headers,
					jwt: t.access_token
				});
				return this._returnResult({
					data: {
						user: null,
						session: null
					},
					error: r
				});
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: {
					user: null,
					session: null
				},
				error: e
			});
			throw e;
		}
	}
	async resend(e) {
		let t = null;
		try {
			let n = `${this.url}/resend`;
			if ("email" in e) {
				let { email: r, type: i, options: a } = e, o = null, s = null;
				this.flowType === "pkce" && ([o, s, t] = await this._getCodeChallengeAndMethod());
				let { error: c } = await F(this.fetch, "POST", n, {
					headers: this.headers,
					body: {
						email: r,
						type: i,
						gotrue_meta_security: { captcha_token: a?.captchaToken },
						code_challenge: o,
						code_challenge_method: s
					},
					redirectTo: this._maybeAppendFlowIdToRedirect(a?.emailRedirectTo, t)
				});
				return c && await Jr(this.storage, this.storageKey, t), this._returnResult({
					data: {
						user: null,
						session: null
					},
					error: c
				});
			}
			if ("phone" in e) {
				let { phone: t, type: r, options: i } = e, { data: a, error: o } = await F(this.fetch, "POST", n, {
					headers: this.headers,
					body: {
						phone: t,
						type: r,
						gotrue_meta_security: { captcha_token: i?.captchaToken }
					}
				});
				return this._returnResult({
					data: {
						user: null,
						session: null,
						messageId: a?.message_id
					},
					error: o
				});
			}
			throw new Qn("You must provide either an email or phone number and a type");
		} catch (e) {
			if (await Jr(this.storage, this.storageKey, t), P(e)) return this._returnResult({
				data: {
					user: null,
					session: null
				},
				error: e
			});
			throw e;
		}
	}
	async getSession() {
		return await this.initializePromise, this.lock == null ? await this._useSession(async (e) => e) : await this._acquireLock(this.lockAcquireTimeout, async () => this._useSession(async (e) => e));
	}
	async _acquireLock(e, t) {
		this._debug("#_acquireLock", "begin", e);
		try {
			if (this.lockAcquired) {
				let e = this.pendingInLock.length ? this.pendingInLock[this.pendingInLock.length - 1] : Promise.resolve(), n = (async () => (await e, await t()))();
				return this.pendingInLock.push((async () => {
					try {
						await n;
					} catch {}
				})()), n;
			}
			return await this.lock(`lock:${this.storageKey}`, e, async () => {
				this._debug("#_acquireLock", "lock acquired for storage key", this.storageKey);
				try {
					this.lockAcquired = !0;
					let e = t();
					for (this.pendingInLock.push((async () => {
						try {
							await e;
						} catch {}
					})()), await e; this.pendingInLock.length;) {
						let e = [...this.pendingInLock];
						await Promise.all(e), this.pendingInLock.splice(0, e.length);
					}
					return await e;
				} finally {
					this._debug("#_acquireLock", "lock released for storage key", this.storageKey), this.lockAcquired = !1;
				}
			});
		} finally {
			this._debug("#_acquireLock", "end");
		}
	}
	async _useSession(e) {
		this._debug("#_useSession", "begin");
		try {
			return await e(await this.__loadSession());
		} finally {
			this._debug("#_useSession", "end");
		}
	}
	async __loadSession() {
		this._debug("#__loadSession()", "begin"), this.lock != null && !this.lockAcquired && this._debug("#__loadSession()", "used outside of an acquired lock!", (/* @__PURE__ */ Error()).stack);
		try {
			let e = null, t = await Ar(this.storage, this.storageKey);
			if (this._debug("#getSession()", "session from storage", t), t !== null && (this._isValidSession(t) ? e = t : (this._debug("#getSession()", "session from storage is not valid"), await this._removeSession())), !e) return {
				data: { session: null },
				error: null
			};
			let n = e.expires_at ? e.expires_at * 1e3 - Date.now() < Fn : !1;
			if (this._debug("#__loadSession()", `session has${n ? "" : " not"} expired`, "expires_at", e.expires_at), !n) return {
				data: { session: await this._hydrateSessionUser(e) },
				error: null
			};
			let { data: r, error: i } = await this._callRefreshToken(e.refresh_token);
			if (i) {
				let e = await Ar(this.storage, this.storageKey);
				return e && this._isValidSession(e) && e.expires_at && e.expires_at * 1e3 > Date.now() ? this._returnResult({
					data: { session: await this._hydrateSessionUser(e) },
					error: null
				}) : this._returnResult({
					data: { session: null },
					error: i
				});
			}
			return this._returnResult({
				data: { session: r },
				error: null
			});
		} finally {
			this._debug("#__loadSession()", "end");
		}
	}
	async _hydrateSessionUser(e) {
		if (this.userStorage) {
			let t = await Ar(this.userStorage, this.storageKey + "-user");
			e.user = t?.user ? t.user : ai();
		}
		if (this.storage.isServer && e.user && !e.user.__isUserNotAvailableProxy) {
			let t = { value: this.suppressGetSessionWarning };
			e.user = oi(e.user, t), t.value && (this.suppressGetSessionWarning = !0);
		}
		return e;
	}
	async getUser(e) {
		if (e) return await this._getUser(e);
		await this.initializePromise;
		let t;
		return t = this.lock == null ? await this._getUser() : await this._acquireLock(this.lockAcquireTimeout, async () => await this._getUser()), t.data.user && (this.suppressGetSessionWarning = !0), t;
	}
	async _getUser(e) {
		try {
			return e ? await F(this.fetch, "GET", `${this.url}/user`, {
				headers: this.headers,
				jwt: e,
				xform: hi
			}) : await this._useSession(async (e) => {
				let { data: t, error: n } = e;
				if (n) throw n;
				return !t.session?.access_token && !this.hasCustomAuthorizationHeader ? {
					data: { user: null },
					error: new Yn()
				} : await F(this.fetch, "GET", `${this.url}/user`, {
					headers: this.headers,
					jwt: t.session?.access_token ?? void 0,
					xform: hi
				});
			});
		} catch (e) {
			if (P(e)) return Xn(e) && await this._removeSession(), this._returnResult({
				data: { user: null },
				error: e
			});
			throw e;
		}
	}
	async updateUser(e, t = {}) {
		return await this.initializePromise, this.lock == null ? await this._updateUser(e, t) : await this._acquireLock(this.lockAcquireTimeout, async () => await this._updateUser(e, t));
	}
	async _updateUser(e, t = {}) {
		let n = null;
		try {
			return await this._useSession(async (r) => {
				let { data: i, error: a } = r;
				if (a) throw a;
				if (!i.session) throw new Yn();
				let o = i.session, s = null, c = null;
				this.flowType === "pkce" && e.email != null && ([s, c, n] = await this._getCodeChallengeAndMethod());
				let { data: l, error: u } = await F(this.fetch, "PUT", `${this.url}/user`, {
					headers: this.headers,
					redirectTo: this._maybeAppendFlowIdToRedirect(t?.emailRedirectTo, n),
					body: Object.assign(Object.assign({}, e), {
						code_challenge: s,
						code_challenge_method: c
					}),
					jwt: o.access_token,
					xform: hi
				});
				if (u) throw u;
				return o.user = l.user, await this._saveSession(o), await this._notifyAllSubscribers("USER_UPDATED", o), this._returnResult({
					data: { user: o.user },
					error: null
				});
			});
		} catch (e) {
			if (await Jr(this.storage, this.storageKey, n), P(e)) return this._returnResult({
				data: { user: null },
				error: e
			});
			throw e;
		}
	}
	async setSession(e) {
		return await this.initializePromise, this.lock == null ? await this._setSession(e) : await this._acquireLock(this.lockAcquireTimeout, async () => await this._setSession(e));
	}
	async _setSession(e) {
		try {
			if (!e.access_token || !e.refresh_token) throw new Yn();
			let t = Date.now() / 1e3, n = t, r = !0, i = null, { payload: a } = Nr(e.access_token);
			if (a.exp && (n = a.exp, r = n <= t), r) {
				let { data: t, error: n } = await this._callRefreshToken(e.refresh_token);
				if (n) return this._returnResult({
					data: {
						user: null,
						session: null
					},
					error: n
				});
				if (!t) return {
					data: {
						user: null,
						session: null
					},
					error: null
				};
				i = t;
			} else {
				let { data: r, error: a } = await this._getUser(e.access_token);
				if (a) return this._returnResult({
					data: {
						user: null,
						session: null
					},
					error: a
				});
				i = {
					access_token: e.access_token,
					refresh_token: e.refresh_token,
					user: r.user,
					token_type: "bearer",
					expires_in: n - t,
					expires_at: n
				}, await this._saveSession(i), await this._notifyAllSubscribers("SIGNED_IN", i);
			}
			return this._returnResult({
				data: {
					user: i.user,
					session: i
				},
				error: null
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: {
					session: null,
					user: null
				},
				error: e
			});
			throw e;
		}
	}
	async refreshSession(e) {
		return await this.initializePromise, this.lock == null ? await this._refreshSession(e) : await this._acquireLock(this.lockAcquireTimeout, async () => await this._refreshSession(e));
	}
	async _refreshSession(e) {
		try {
			return await this._useSession(async (t) => {
				if (!e) {
					let { data: n, error: r } = t;
					if (r) throw r;
					e = n.session ?? void 0;
				}
				if (!e?.refresh_token) throw new Yn();
				let { data: n, error: r } = await this._callRefreshToken(e.refresh_token);
				return r ? this._returnResult({
					data: {
						user: null,
						session: null
					},
					error: r
				}) : n ? this._returnResult({
					data: {
						user: n.user,
						session: n
					},
					error: null
				}) : this._returnResult({
					data: {
						user: null,
						session: null
					},
					error: null
				});
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: {
					user: null,
					session: null
				},
				error: e
			});
			throw e;
		}
	}
	async _getSessionFromURL(e, t) {
		try {
			if (!Cr()) throw new $n("No browser detected.");
			if (e.error || e.error_description || e.error_code) throw new $n(e.error_description || "Error in URL with unspecified error_description", {
				error: e.error || "unspecified_error",
				code: e.error_code || "unspecified_code"
			});
			switch (t) {
				case "implicit":
					if (this.flowType === "pkce") throw new tr("Not a valid PKCE flow url.");
					break;
				case "pkce": if (this.flowType === "implicit") throw new $n("Not a valid implicit grant flow url.");
			}
			if (t === "pkce") {
				if (this._debug("#_initialize()", "begin", "is PKCE flow", !0), !e.code) throw new tr("No code detected.");
				let { data: t, error: n } = await this._exchangeCodeForSession(e.code, { flowId: e[Un] });
				if (n) throw n;
				let r = new URL(window.location.href);
				return r.searchParams.delete("code"), r.searchParams.delete(Un), window.history.replaceState(window.history.state, "", r.toString()), {
					data: {
						session: t.session,
						redirectType: t.redirectType ?? null
					},
					error: null
				};
			}
			let { provider_token: n, provider_refresh_token: r, access_token: i, refresh_token: a, expires_in: o, expires_at: s, token_type: c } = e;
			if (!i || !o || !a || !c) throw new $n("No session defined in URL");
			let l = Math.round(Date.now() / 1e3), u = parseInt(o), d = l + u;
			s && (d = parseInt(s));
			let f = d - l;
			f * 1e3 <= 3e4 && console.warn(`@supabase/gotrue-js: Session as retrieved from URL expires in ${f}s, should have been closer to ${u}s`);
			let p = d - u;
			l - p >= 120 ? console.warn("@supabase/gotrue-js: Session as retrieved from URL was issued over 120s ago, URL could be stale", p, d, l) : l - p < 0 && console.warn("@supabase/gotrue-js: Session as retrieved from URL was issued in the future? Check the device clock for skew", p, d, l);
			let { data: m, error: h } = await this._getUser(i);
			if (h) throw h;
			let g = {
				provider_token: n,
				provider_refresh_token: r,
				access_token: i,
				expires_in: u,
				expires_at: d,
				refresh_token: a,
				token_type: c,
				user: m.user
			};
			return window.location.hash = "", this._debug("#_getSessionFromURL()", "clearing window.location.hash"), this._returnResult({
				data: {
					session: g,
					redirectType: e.type
				},
				error: null
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: {
					session: null,
					redirectType: null
				},
				error: e
			});
			throw e;
		}
	}
	_isImplicitGrantCallback(e) {
		return typeof this.detectSessionInUrl == "function" ? this.detectSessionInUrl(new URL(window.location.href), e) : !!(e.access_token || e.error || e.error_description || e.error_code);
	}
	async _isPKCECallback(e) {
		if (!e.code) return !1;
		let t = Vr(e[Un]);
		return t && await Ar(this.storage, Ur(this.storageKey, t)) ? !0 : !!await Ar(this.storage, `${this.storageKey}-code-verifier`);
	}
	async signOut(e = { scope: "global" }) {
		return await this.initializePromise, this.lock == null ? await this._signOut(e) : await this._acquireLock(this.lockAcquireTimeout, async () => await this._signOut(e));
	}
	async _signOut({ scope: e } = { scope: "global" }) {
		return await this._useSession(async (t) => {
			let n = async () => {
				await this._removeSession();
			}, { data: r, error: i } = t;
			if (i && !Xn(i)) return this._returnResult({ error: i });
			let a = r.session?.access_token;
			if (a) {
				let { error: t } = await this.admin.signOut(a, e);
				if (t && !(Kn(t) && (t.status === 404 || t.status === 401 || t.status === 403) || Xn(t))) return e !== "others" && await n(), this._returnResult({ error: t });
			}
			return e !== "others" && await n(), this._returnResult({ error: null });
		});
	}
	onAuthStateChange(e) {
		let t = Sr(), n = {
			id: t,
			callback: e,
			unsubscribe: () => {
				this._debug("#unsubscribe()", "state change callback with id removed", t), this.stateChangeEmitters.delete(t);
			}
		};
		return this._debug("#onAuthStateChange()", "registered callback with id", t), this.stateChangeEmitters.set(t, n), (async () => {
			await this.initializePromise, this.lock == null ? await this._emitInitialSession(t) : await this._acquireLock(this.lockAcquireTimeout, async () => {
				this._emitInitialSession(t);
			});
		})(), { data: { subscription: n } };
	}
	async _emitInitialSession(e) {
		return await this._useSession(async (t) => {
			try {
				let { data: { session: n }, error: r } = t;
				if (r) throw r;
				await this.stateChangeEmitters.get(e)?.callback("INITIAL_SESSION", n), this._debug("INITIAL_SESSION", "callback id", e, "session", n);
			} catch (t) {
				if (await this.stateChangeEmitters.get(e)?.callback("INITIAL_SESSION", null), this._debug("INITIAL_SESSION", "callback id", e, "error", t), or(t)) return;
				Xn(t) || ir(t) || Kn(t) && (t.code === "refresh_token_not_found" || t.code === "refresh_token_already_used" || t.code === "session_expired") ? console.warn(t) : console.error(t);
			}
		});
	}
	async resetPasswordForEmail(e, t = {}) {
		let n = null, r = null, i = null;
		this.flowType === "pkce" && ([n, r, i] = await this._getCodeChallengeAndMethod(!0));
		try {
			return await F(this.fetch, "POST", `${this.url}/recover`, {
				body: {
					email: e,
					code_challenge: n,
					code_challenge_method: r,
					gotrue_meta_security: { captcha_token: t.captchaToken }
				},
				headers: this.headers,
				redirectTo: this._maybeAppendFlowIdToRedirect(t.redirectTo, i)
			});
		} catch (e) {
			if (await Jr(this.storage, this.storageKey, i), P(e)) return this._returnResult({
				data: null,
				error: e
			});
			throw e;
		}
	}
	async getUserIdentities() {
		try {
			let { data: e, error: t } = await this.getUser();
			if (t) throw t;
			return this._returnResult({
				data: { identities: e.user.identities ?? [] },
				error: null
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: null,
				error: e
			});
			throw e;
		}
	}
	async linkIdentity(e) {
		return "token" in e ? this.linkIdentityIdToken(e) : this.linkIdentityOAuth(e);
	}
	async linkIdentityOAuth(e) {
		let t = null;
		try {
			let { data: n, error: r } = await this._useSession(async (n) => {
				let { data: r, error: i } = n;
				if (i) throw i;
				let { url: a, flowId: o } = await this._getUrlForProvider(`${this.url}/user/identities/authorize`, e.provider, {
					redirectTo: e.options?.redirectTo,
					scopes: e.options?.scopes,
					queryParams: e.options?.queryParams,
					skipBrowserRedirect: !0
				});
				return t = o, await F(this.fetch, "GET", a, {
					headers: this.headers,
					jwt: r.session?.access_token ?? void 0
				});
			});
			if (r) throw r;
			return Cr() && !e.options?.skipBrowserRedirect && window.location.assign(n?.url), this._returnResult({
				data: {
					provider: e.provider,
					url: n?.url,
					flowId: t
				},
				error: null
			});
		} catch (n) {
			if (P(n)) return this._returnResult({
				data: {
					provider: e.provider,
					url: null,
					flowId: t
				},
				error: n
			});
			throw n;
		}
	}
	async linkIdentityIdToken(e) {
		return await this._useSession(async (t) => {
			try {
				let { error: n, data: { session: r } } = t;
				if (n) throw n;
				let { options: i, provider: a, token: o, access_token: s, nonce: c } = e, { data: l, error: u } = await F(this.fetch, "POST", `${this.url}/token?grant_type=id_token`, {
					headers: this.headers,
					jwt: r?.access_token ?? void 0,
					body: {
						provider: a,
						id_token: o,
						access_token: s,
						nonce: c,
						link_identity: !0,
						gotrue_meta_security: { captcha_token: i?.captchaToken }
					},
					xform: pi
				});
				return u ? this._returnResult({
					data: {
						user: null,
						session: null
					},
					error: u
				}) : !l || !l.session || !l.user ? this._returnResult({
					data: {
						user: null,
						session: null
					},
					error: new Zn()
				}) : (l.session && (await this._saveSession(l.session), await this._notifyAllSubscribers("USER_UPDATED", l.session)), this._returnResult({
					data: l,
					error: u
				}));
			} catch (e) {
				if (await Jr(this.storage, this.storageKey, null), P(e)) return this._returnResult({
					data: {
						user: null,
						session: null
					},
					error: e
				});
				throw e;
			}
		});
	}
	async unlinkIdentity(e) {
		try {
			return await this._useSession(async (t) => {
				let { data: n, error: r } = t;
				if (r) throw r;
				return await F(this.fetch, "DELETE", `${this.url}/user/identities/${e.identity_id}`, {
					headers: this.headers,
					jwt: n.session?.access_token ?? void 0
				});
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: null,
				error: e
			});
			throw e;
		}
	}
	async _refreshAccessToken(e) {
		let t = "#_refreshAccessToken()";
		this._debug(t, "begin");
		try {
			let n = Date.now();
			return await Fr(async (n) => (n > 0 && await Pr(200 * 2 ** (n - 1)), this._debug(t, "refreshing attempt", n), await F(this.fetch, "POST", `${this.url}/token?grant_type=refresh_token`, {
				body: { refresh_token: e },
				headers: this.headers,
				xform: pi
			})), (e, t) => {
				let r = 200 * 2 ** e;
				return t && ir(t) && Date.now() + r - n < 3e4;
			});
		} catch (e) {
			if (this._debug(t, "error", e), P(e)) return this._returnResult({
				data: {
					session: null,
					user: null
				},
				error: e
			});
			throw e;
		} finally {
			this._debug(t, "end");
		}
	}
	_isValidSession(e) {
		return typeof e == "object" && !!e && "access_token" in e && "refresh_token" in e && "expires_at" in e;
	}
	async _handleProviderSignIn(e, t) {
		let { url: n, flowId: r } = await this._getUrlForProvider(`${this.url}/authorize`, e, {
			redirectTo: t.redirectTo,
			scopes: t.scopes,
			queryParams: t.queryParams
		});
		return this._debug("#_handleProviderSignIn()", "provider", e, "options", t, "url", n), Cr() && !t.skipBrowserRedirect && window.location.assign(n), {
			data: {
				provider: e,
				url: n,
				flowId: r
			},
			error: null
		};
	}
	async _recoverAndRefresh() {
		let e = "#_recoverAndRefresh()";
		this._debug(e, "begin");
		try {
			let t = await Ar(this.storage, this.storageKey);
			if (t && this.userStorage) {
				let e = await Ar(this.userStorage, this.storageKey + "-user");
				!this.storage.isServer && Object.is(this.storage, this.userStorage) && !e && (e = { user: t.user }, await kr(this.userStorage, this.storageKey + "-user", e)), t.user = e?.user ?? ai();
			} else if (t && !t.user && !t.user) {
				let e = await Ar(this.storage, this.storageKey + "-user");
				e && e?.user ? (t.user = e.user, await jr(this.storage, this.storageKey + "-user"), await kr(this.storage, this.storageKey, t)) : t.user = ai();
			}
			if (this._debug(e, "session from storage", t), !this._isValidSession(t)) {
				this._debug(e, "session is not valid"), t !== null && await this._removeSession();
				return;
			}
			let n = (t.expires_at ?? Infinity) * 1e3 - Date.now() < Fn;
			if (this._debug(e, `session has${n ? "" : " not"} expired with margin of ${Fn}s`), n) {
				if (this.autoRefreshToken && t.refresh_token) {
					let { error: n } = await this._callRefreshToken(t.refresh_token);
					n && (or(n) ? this._debug(e, "refresh discarded by commit guard", n) : this._debug(e, "refresh failed", n));
				}
			} else if (t.user && t.user.__isUserNotAvailableProxy === !0) try {
				let { data: n, error: r } = await this._getUser(t.access_token);
				!r && n?.user ? (t.user = n.user, await this._saveSession(t), await this._notifyAllSubscribers("SIGNED_IN", t)) : this._debug(e, "could not get user data, skipping SIGNED_IN notification");
			} catch (t) {
				console.error("Error getting user data:", t), this._debug(e, "error getting user data, skipping SIGNED_IN notification", t);
			}
			else await this._notifyAllSubscribers("SIGNED_IN", t);
		} catch (t) {
			this._debug(e, "error", t), ir(t) ? console.warn(t) : console.error(t);
			return;
		} finally {
			this._debug(e, "end");
		}
	}
	async _callRefreshToken(e) {
		var t, n;
		if (!e) throw new Yn();
		if (this.refreshingDeferred) return this.refreshingDeferred.promise;
		if (this.lastRefreshFailure && this.lastRefreshFailure.refreshToken === e && Date.now() < this.lastRefreshFailure.expiresAt) return this._debug("#_callRefreshToken()", "returning cached failure (cooldown active)"), this.lastRefreshFailure.result;
		let r = "#_callRefreshToken()";
		this._debug(r, "begin");
		try {
			this.refreshingDeferred = new Mr(), this.refreshingDeferred.promise.then(void 0, () => {});
			let t = await Ar(this.storage, this.storageKey), { data: n, error: i } = await this._refreshAccessToken(e);
			if (i) throw i;
			if (!n.session) throw new Yn();
			let a = await Ar(this.storage, this.storageKey);
			if (t !== null && (a === null || a.refresh_token !== t.refresh_token)) {
				this._debug(r, "commit guard: storage changed since refresh started, discarding rotated tokens", {
					startedWith: "present",
					nowHolds: a ? "replaced" : "cleared"
				});
				let e = {
					data: null,
					error: new ar()
				};
				return this.refreshingDeferred.resolve(e), e;
			}
			let o = this._sessionRemovalEpoch;
			if (await this._saveSession(n.session), this._sessionRemovalEpoch !== o) {
				this._debug(r, "commit guard (post-save): _removeSession ran during _saveSession, undoing write"), await jr(this.storage, this.storageKey), this.userStorage && await jr(this.userStorage, this.storageKey + "-user");
				let e = {
					data: null,
					error: new ar()
				};
				return this.refreshingDeferred.resolve(e), e;
			}
			await this._notifyAllSubscribers("TOKEN_REFRESHED", n.session);
			let s = {
				data: n.session,
				error: null
			};
			return this.lastRefreshFailure = null, this.refreshingDeferred.resolve(s), s;
		} catch (i) {
			if (this._debug(r, "error", i), P(i)) {
				let n = {
					data: null,
					error: i
				};
				if (!ir(i)) {
					let e = await Ar(this.storage, this.storageKey);
					e?.expires_at && e.expires_at * 1e3 > Date.now() ? this._debug(r, "proactive refresh failed, access token still valid — preserving session") : await this._removeSession();
				}
				return this.lastRefreshFailure = {
					refreshToken: e,
					result: n,
					expiresAt: Date.now() + In
				}, (t = this.refreshingDeferred) == null || t.resolve(n), n;
			}
			throw (n = this.refreshingDeferred) == null || n.reject(i), i;
		} finally {
			this.refreshingDeferred = null, this._debug(r, "end");
		}
	}
	async _notifyAllSubscribers(e, t, n = !0) {
		if (this._pendingInitNotifications !== null && n) {
			this._pendingInitNotifications.push({
				event: e,
				session: t,
				broadcast: n
			});
			return;
		}
		let r = `#_notifyAllSubscribers(${e})`;
		this._debug(r, "begin", t, `broadcast = ${n}`);
		try {
			this.broadcastChannel && n && this.broadcastChannel.postMessage({
				event: e,
				session: t
			});
			let r = [], i = Array.from(this.stateChangeEmitters.values()).map(async (n) => {
				try {
					await n.callback(e, t);
				} catch (e) {
					r.push(e);
				}
			});
			if (await Promise.all(i), r.length > 0) {
				for (let e = 0; e < r.length; e += 1) console.error(r[e]);
				throw r[0];
			}
		} finally {
			this._debug(r, "end");
		}
	}
	async _saveSession(e) {
		this._debug("#_saveSession()", e), this.suppressGetSessionWarning = !0;
		let t = Object.assign({}, e), n = t.user && t.user.__isUserNotAvailableProxy === !0;
		if (this.userStorage) {
			!n && t.user && await kr(this.userStorage, this.storageKey + "-user", { user: t.user });
			let e = Object.assign({}, t);
			delete e.user;
			let r = si(e);
			await kr(this.storage, this.storageKey, r);
		} else {
			let e = si(t);
			await kr(this.storage, this.storageKey, e);
		}
	}
	async _removeSession() {
		this._sessionRemovalEpoch += 1, this._debug("#_removeSession()"), this.lastRefreshFailure = null, this.suppressGetSessionWarning = !1, await jr(this.storage, this.storageKey), await Yr(this.storage, this.storageKey), await jr(this.storage, this.storageKey + "-user"), this.userStorage && await jr(this.userStorage, this.storageKey + "-user"), await this._notifyAllSubscribers("SIGNED_OUT", null);
	}
	_removeVisibilityChangedCallback() {
		this._debug("#_removeVisibilityChangedCallback()");
		let e = this.visibilityChangedCallback;
		this.visibilityChangedCallback = null;
		try {
			e && Cr() && window != null && window.removeEventListener && window.removeEventListener("visibilitychange", e);
		} catch (e) {
			console.error("removing visibilitychange callback failed", e);
		}
	}
	async _startAutoRefresh() {
		await this._stopAutoRefresh(), this._debug("#_startAutoRefresh()");
		let e = setInterval(() => this._autoRefreshTokenTick(), Pn);
		this.autoRefreshTicker = e, e && typeof e == "object" && typeof e.unref == "function" ? e.unref() : typeof Deno < "u" && typeof Deno.unrefTimer == "function" && Deno.unrefTimer(e);
		let t = setTimeout(async () => {
			await this.initializePromise, await this._autoRefreshTokenTick();
		}, 0);
		this.autoRefreshTickTimeout = t, t && typeof t == "object" && typeof t.unref == "function" ? t.unref() : typeof Deno < "u" && typeof Deno.unrefTimer == "function" && Deno.unrefTimer(t);
	}
	async _stopAutoRefresh() {
		this._debug("#_stopAutoRefresh()");
		let e = this.autoRefreshTicker;
		this.autoRefreshTicker = null, e && clearInterval(e);
		let t = this.autoRefreshTickTimeout;
		this.autoRefreshTickTimeout = null, t && clearTimeout(t);
	}
	async startAutoRefresh() {
		this._removeVisibilityChangedCallback(), await this._startAutoRefresh();
	}
	async stopAutoRefresh() {
		this._removeVisibilityChangedCallback(), await this._stopAutoRefresh();
	}
	async dispose() {
		var e;
		this._removeVisibilityChangedCallback(), await this._stopAutoRefresh(), (e = this.broadcastChannel) == null || e.close(), this.broadcastChannel = null, this.stateChangeEmitters.clear();
	}
	async _autoRefreshTokenTick() {
		if (this._debug("#_autoRefreshTokenTick()", "begin"), this.lock != null) {
			try {
				await this._acquireLock(0, async () => {
					try {
						let e = Date.now();
						try {
							return await this._useSession(async (t) => {
								let { data: { session: n } } = t;
								if (!n || !n.refresh_token || !n.expires_at) {
									this._debug("#_autoRefreshTokenTick()", "no session");
									return;
								}
								let r = Math.floor((n.expires_at * 1e3 - e) / Pn);
								this._debug("#_autoRefreshTokenTick()", `access token expires in ${r} ticks, a tick lasts ${Pn}ms, refresh threshold is 3 ticks`), r <= 3 && await this._callRefreshToken(n.refresh_token);
							});
						} catch (e) {
							console.error("Auto refresh tick failed with error. This is likely a transient error.", e);
						}
					} finally {
						this._debug("#_autoRefreshTokenTick()", "end");
					}
				});
			} catch (e) {
				if (e instanceof Ci) this._debug("auto refresh token tick lock not available");
				else throw e;
			}
			return;
		}
		if (this.refreshingDeferred !== null) {
			this._debug("#_autoRefreshTokenTick()", "refresh already in flight, skipping");
			return;
		}
		try {
			let e = Date.now();
			try {
				await this._useSession(async (t) => {
					let { data: { session: n } } = t;
					if (!n || !n.refresh_token || !n.expires_at) {
						this._debug("#_autoRefreshTokenTick()", "no session");
						return;
					}
					let r = Math.floor((n.expires_at * 1e3 - e) / Pn);
					this._debug("#_autoRefreshTokenTick()", `access token expires in ${r} ticks, a tick lasts ${Pn}ms, refresh threshold is 3 ticks`), r <= 3 && await this._callRefreshToken(n.refresh_token);
				});
			} catch (e) {
				console.error("Auto refresh tick failed with error. This is likely a transient error.", e);
			}
		} finally {
			this._debug("#_autoRefreshTokenTick()", "end");
		}
	}
	async _handleVisibilityChange() {
		if (this._debug("#_handleVisibilityChange()"), !Cr() || !(window != null && window.addEventListener)) return this.autoRefreshToken && this.startAutoRefresh(), !1;
		try {
			this.visibilityChangedCallback = async () => {
				try {
					await this._onVisibilityChanged(!1);
				} catch (e) {
					this._debug("#visibilityChangedCallback", "error", e);
				}
			}, window == null || window.addEventListener("visibilitychange", this.visibilityChangedCallback), await this._onVisibilityChanged(!0);
		} catch (e) {
			console.error("_handleVisibilityChange", e);
		}
	}
	async _onVisibilityChanged(e) {
		let t = `#_onVisibilityChanged(${e})`;
		if (this._debug(t, "visibilityState", document.visibilityState), document.visibilityState === "visible") {
			if (this.autoRefreshToken && this._startAutoRefresh(), !e) {
				if (await this.initializePromise, this.lock != null) await this._acquireLock(this.lockAcquireTimeout, async () => {
					if (document.visibilityState !== "visible") {
						this._debug(t, "acquired the lock to recover the session, but the browser visibilityState is no longer visible, aborting");
						return;
					}
					await this._recoverAndRefresh();
				});
				else {
					if (document.visibilityState !== "visible") {
						this._debug(t, "visibilityState is no longer visible, skipping recovery");
						return;
					}
					await this._recoverAndRefresh();
				}
			}
		} else document.visibilityState === "hidden" && this.autoRefreshToken && this._stopAutoRefresh();
	}
	async _getUrlForProvider(e, t, n) {
		let r = n?.redirectTo, i = null, a = null, o = null;
		this.flowType === "pkce" && ([i, a, o] = await this._getCodeChallengeAndMethod(), r = this._maybeAppendFlowIdToRedirect(r, o));
		let s = [`provider=${encodeURIComponent(t)}`];
		if (r && s.push(`redirect_to=${encodeURIComponent(r)}`), n?.scopes && s.push(`scopes=${encodeURIComponent(n.scopes)}`), i != null && a != null) {
			let e = new URLSearchParams({
				code_challenge: `${encodeURIComponent(i)}`,
				code_challenge_method: `${encodeURIComponent(a)}`
			});
			s.push(e.toString());
		}
		if (n?.queryParams) {
			let e = new URLSearchParams(n.queryParams);
			s.push(e.toString());
		}
		return n?.skipBrowserRedirect && s.push(`skip_http_redirect=${n.skipBrowserRedirect}`), {
			url: `${e}?${s.join("&")}`,
			flowId: o
		};
	}
	_maybeAppendFlowIdToRedirect(e, t) {
		return !e || !t || !this.experimental.appendPkceFlowIdToRedirects ? e ?? void 0 : Xr(e, t);
	}
	async _getCodeChallengeAndMethod(e = !1) {
		return Zr(this.storage, this.storageKey, e, (e) => this._debug("#_getCodeChallengeAndMethod()", "evicted oldest pending PKCE verifier slot", e));
	}
	async _unenroll(e) {
		try {
			return await this._useSession(async (t) => {
				let { data: n, error: r } = t;
				return r ? this._returnResult({
					data: null,
					error: r
				}) : await F(this.fetch, "DELETE", `${this.url}/factors/${e.factorId}`, {
					headers: this.headers,
					jwt: n?.session?.access_token
				});
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: null,
				error: e
			});
			throw e;
		}
	}
	async _enroll(e) {
		try {
			return await this._useSession(async (t) => {
				let { data: n, error: r } = t;
				if (r) return this._returnResult({
					data: null,
					error: r
				});
				let i = Object.assign({
					friendly_name: e.friendlyName,
					factor_type: e.factorType
				}, e.factorType === "phone" ? { phone: e.phone } : e.factorType === "totp" ? { issuer: e.issuer } : {}), { data: a, error: o } = await F(this.fetch, "POST", `${this.url}/factors`, {
					body: i,
					headers: this.headers,
					jwt: n?.session?.access_token
				});
				return o ? this._returnResult({
					data: null,
					error: o
				}) : (e.factorType === "totp" && a.type === "totp" && a?.totp?.qr_code && (a.totp.qr_code = `data:image/svg+xml;utf-8,${a.totp.qr_code}`), this._returnResult({
					data: a,
					error: null
				}));
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: null,
				error: e
			});
			throw e;
		}
	}
	async _verify(e) {
		let t = async () => {
			try {
				return await this._useSession(async (t) => {
					let { data: n, error: r } = t;
					if (r) return this._returnResult({
						data: null,
						error: r
					});
					let i = Object.assign({ challenge_id: e.challengeId }, "webauthn" in e ? { webauthn: Object.assign(Object.assign({}, e.webauthn), { credential_response: e.webauthn.type === "create" ? Ii(e.webauthn.credential_response) : Li(e.webauthn.credential_response) }) } : { code: e.code }), { data: a, error: o } = await F(this.fetch, "POST", `${this.url}/factors/${e.factorId}/verify`, {
						body: i,
						headers: this.headers,
						jwt: n?.session?.access_token
					});
					return o ? this._returnResult({
						data: null,
						error: o
					}) : (await this._saveSession(Object.assign({ expires_at: Math.round(Date.now() / 1e3) + a.expires_in }, a)), await this._notifyAllSubscribers("MFA_CHALLENGE_VERIFIED", a), this._returnResult({
						data: a,
						error: o
					}));
				});
			} catch (e) {
				if (P(e)) return this._returnResult({
					data: null,
					error: e
				});
				throw e;
			}
		};
		return this.lock == null ? t() : this._acquireLock(this.lockAcquireTimeout, t);
	}
	async _challenge(e) {
		let t = async () => {
			try {
				return await this._useSession(async (t) => {
					let { data: n, error: r } = t;
					if (r) return this._returnResult({
						data: null,
						error: r
					});
					let i = await F(this.fetch, "POST", `${this.url}/factors/${e.factorId}/challenge`, {
						body: e,
						headers: this.headers,
						jwt: n?.session?.access_token
					});
					if (i.error) return i;
					let { data: a } = i;
					if (a.type !== "webauthn") return {
						data: a,
						error: null
					};
					switch (a.webauthn.type) {
						case "create": return {
							data: Object.assign(Object.assign({}, a), { webauthn: Object.assign(Object.assign({}, a.webauthn), { credential_options: Object.assign(Object.assign({}, a.webauthn.credential_options), { publicKey: Pi(a.webauthn.credential_options.publicKey) }) }) }),
							error: null
						};
						case "request": return {
							data: Object.assign(Object.assign({}, a), { webauthn: Object.assign(Object.assign({}, a.webauthn), { credential_options: Object.assign(Object.assign({}, a.webauthn.credential_options), { publicKey: Fi(a.webauthn.credential_options.publicKey) }) }) }),
							error: null
						};
					}
				});
			} catch (e) {
				if (P(e)) return this._returnResult({
					data: null,
					error: e
				});
				throw e;
			}
		};
		return this.lock == null ? t() : this._acquireLock(this.lockAcquireTimeout, t);
	}
	async _challengeAndVerify(e) {
		let { data: t, error: n } = await this._challenge({ factorId: e.factorId });
		return n ? this._returnResult({
			data: null,
			error: n
		}) : await this._verify({
			factorId: e.factorId,
			challengeId: t.id,
			code: e.code
		});
	}
	async _listFactors() {
		let { data: { user: e }, error: t } = await this.getUser();
		if (t) return {
			data: null,
			error: t
		};
		let n = {
			all: [],
			phone: [],
			totp: [],
			webauthn: [],
			recovery_code: []
		};
		for (let t of e?.factors ?? []) n.all.push(t), t.status === "verified" && t.factor_type in n && Array.isArray(n[t.factor_type]) && n[t.factor_type].push(t);
		return {
			data: n,
			error: null
		};
	}
	async _getAuthenticatorAssuranceLevel(e) {
		if (e) try {
			let { payload: t } = Nr(e), n = null;
			t.aal && (n = t.aal);
			let r = n, { data: { user: i }, error: a } = await this.getUser(e);
			if (a) return this._returnResult({
				data: null,
				error: a
			});
			((i?.factors)?.filter((e) => e.status === "verified") ?? []).length > 0 && (r = "aal2");
			let o = t.amr || [];
			return {
				data: {
					currentLevel: n,
					nextLevel: r,
					currentAuthenticationMethods: o
				},
				error: null
			};
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: null,
				error: e
			});
			throw e;
		}
		let { data: { session: t }, error: n } = await this.getSession();
		if (n) return this._returnResult({
			data: null,
			error: n
		});
		if (!t) return {
			data: {
				currentLevel: null,
				nextLevel: null,
				currentAuthenticationMethods: []
			},
			error: null
		};
		let { payload: r } = Nr(t.access_token), i = null;
		r.aal && (i = r.aal);
		let a = i;
		(t.user.factors?.filter((e) => e.status === "verified") ?? []).length > 0 && (a = "aal2");
		let o = r.amr || [];
		return {
			data: {
				currentLevel: i,
				nextLevel: a,
				currentAuthenticationMethods: o
			},
			error: null
		};
	}
	async _getRecoveryCodesStatus() {
		ii(this.experimental);
		try {
			return await this._useSession(async (e) => {
				let { data: t, error: n } = e;
				if (n) return this._returnResult({
					data: null,
					error: n
				});
				let { data: r, error: i } = await F(this.fetch, "GET", `${this.url}/factors/recovery-codes`, {
					headers: this.headers,
					jwt: t?.session?.access_token
				});
				return i ? this._returnResult({
					data: null,
					error: i
				}) : this._returnResult({
					data: r,
					error: null
				});
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: null,
				error: e
			});
			throw e;
		}
	}
	async _generateRecoveryCodes(e) {
		ii(this.experimental);
		try {
			return await this._useSession(async (t) => {
				let { data: n, error: r } = t;
				if (r) return this._returnResult({
					data: null,
					error: r
				});
				let { data: i, error: a } = await F(this.fetch, "POST", `${this.url}/factors/recovery-codes`, {
					body: e?.friendlyName ? { friendly_name: e.friendlyName } : void 0,
					headers: this.headers,
					jwt: n?.session?.access_token
				});
				return a ? this._returnResult({
					data: null,
					error: a
				}) : this._returnResult({
					data: i,
					error: null
				});
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: null,
				error: e
			});
			throw e;
		}
	}
	async _verifyRecoveryCode(e) {
		ii(this.experimental);
		let t = async () => {
			try {
				return await this._useSession(async (t) => {
					let { data: n, error: r } = t;
					if (r) return this._returnResult({
						data: null,
						error: r
					});
					let { data: i, error: a } = await F(this.fetch, "POST", `${this.url}/factors/recovery-codes/verify`, {
						body: { code: e.code },
						headers: this.headers,
						jwt: n?.session?.access_token
					});
					if (a) return this._returnResult({
						data: null,
						error: a
					});
					let o = Object.assign({ expires_at: xr(i.expires_in) }, i);
					return await this._saveSession(o), await this._notifyAllSubscribers("MFA_CHALLENGE_VERIFIED", o), this._returnResult({
						data: i,
						error: null
					});
				});
			} catch (e) {
				if (P(e)) return this._returnResult({
					data: null,
					error: e
				});
				throw e;
			}
		};
		return this.lock == null ? t() : this._acquireLock(this.lockAcquireTimeout, t);
	}
	async _regenerateRecoveryCodes() {
		ii(this.experimental);
		try {
			return await this._useSession(async (e) => {
				let { data: t, error: n } = e;
				if (n) return this._returnResult({
					data: null,
					error: n
				});
				let { data: r, error: i } = await F(this.fetch, "POST", `${this.url}/factors/recovery-codes/regenerate`, {
					headers: this.headers,
					jwt: t?.session?.access_token
				});
				return i ? this._returnResult({
					data: null,
					error: i
				}) : this._returnResult({
					data: r,
					error: null
				});
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: null,
				error: e
			});
			throw e;
		}
	}
	async _unenrollRecoveryCodes() {
		ii(this.experimental);
		try {
			return await this._useSession(async (e) => {
				let { data: t, error: n } = e;
				if (n) return this._returnResult({
					data: null,
					error: n
				});
				let { data: r, error: i } = await F(this.fetch, "DELETE", `${this.url}/factors/recovery-codes`, {
					headers: this.headers,
					jwt: t?.session?.access_token
				});
				return i ? this._returnResult({
					data: null,
					error: i
				}) : this._returnResult({
					data: r,
					error: null
				});
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: null,
				error: e
			});
			throw e;
		}
	}
	async _getAuthorizationDetails(e) {
		try {
			return await this._useSession(async (t) => {
				let { data: { session: n }, error: r } = t;
				return r ? this._returnResult({
					data: null,
					error: r
				}) : n ? await F(this.fetch, "GET", `${this.url}/oauth/authorizations/${e}`, {
					headers: this.headers,
					jwt: n.access_token,
					xform: (e) => ({
						data: e,
						error: null
					})
				}) : this._returnResult({
					data: null,
					error: new Yn()
				});
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: null,
				error: e
			});
			throw e;
		}
	}
	async _approveAuthorization(e, t) {
		try {
			return await this._useSession(async (n) => {
				let { data: { session: r }, error: i } = n;
				if (i) return this._returnResult({
					data: null,
					error: i
				});
				if (!r) return this._returnResult({
					data: null,
					error: new Yn()
				});
				let a = await F(this.fetch, "POST", `${this.url}/oauth/authorizations/${e}/consent`, {
					headers: this.headers,
					jwt: r.access_token,
					body: { action: "approve" },
					xform: (e) => ({
						data: e,
						error: null
					})
				});
				return a.data && a.data.redirect_url && Cr() && !t?.skipBrowserRedirect && window.location.assign(a.data.redirect_url), a;
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: null,
				error: e
			});
			throw e;
		}
	}
	async _denyAuthorization(e, t) {
		try {
			return await this._useSession(async (n) => {
				let { data: { session: r }, error: i } = n;
				if (i) return this._returnResult({
					data: null,
					error: i
				});
				if (!r) return this._returnResult({
					data: null,
					error: new Yn()
				});
				let a = await F(this.fetch, "POST", `${this.url}/oauth/authorizations/${e}/consent`, {
					headers: this.headers,
					jwt: r.access_token,
					body: { action: "deny" },
					xform: (e) => ({
						data: e,
						error: null
					})
				});
				return a.data && a.data.redirect_url && Cr() && !t?.skipBrowserRedirect && window.location.assign(a.data.redirect_url), a;
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: null,
				error: e
			});
			throw e;
		}
	}
	async _listOAuthGrants() {
		try {
			return await this._useSession(async (e) => {
				let { data: { session: t }, error: n } = e;
				return n ? this._returnResult({
					data: null,
					error: n
				}) : t ? await F(this.fetch, "GET", `${this.url}/user/oauth/grants`, {
					headers: this.headers,
					jwt: t.access_token,
					xform: (e) => ({
						data: e,
						error: null
					})
				}) : this._returnResult({
					data: null,
					error: new Yn()
				});
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: null,
				error: e
			});
			throw e;
		}
	}
	async _revokeOAuthGrant(e) {
		try {
			return await this._useSession(async (t) => {
				let { data: { session: n }, error: r } = t;
				return r ? this._returnResult({
					data: null,
					error: r
				}) : n ? (await F(this.fetch, "DELETE", `${this.url}/user/oauth/grants`, {
					headers: this.headers,
					jwt: n.access_token,
					query: { client_id: e.clientId },
					noResolveJson: !0
				}), {
					data: {},
					error: null
				}) : this._returnResult({
					data: null,
					error: new Yn()
				});
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: null,
				error: e
			});
			throw e;
		}
	}
	async fetchJwk(e, t = { keys: [] }) {
		let n = t.keys.find((t) => t.kid === e);
		if (n) return n;
		let r = Date.now();
		if (n = this.jwks.keys.find((t) => t.kid === e), n && this.jwks_cached_at + 6e5 > r) return n;
		let { data: i, error: a } = await F(this.fetch, "GET", `${this.url}/.well-known/jwks.json`, { headers: this.headers });
		if (a) throw a;
		return !i.keys || i.keys.length === 0 || (this.jwks = i, this.jwks_cached_at = r, n = i.keys.find((t) => t.kid === e), !n) ? null : n;
	}
	async getClaims(e, t = {}) {
		try {
			let n = e;
			if (!n) {
				let { data: e, error: t } = await this.getSession();
				if (t || !e.session) return this._returnResult({
					data: null,
					error: t
				});
				n = e.session.access_token;
			}
			let { header: r, payload: i, signature: a, raw: { header: o, payload: s } } = Nr(n);
			if (!t?.allowExpired) try {
				ei(i.exp);
			} catch (e) {
				throw new cr(e instanceof Error ? e.message : "JWT validation failed");
			}
			let c = !r.alg || r.alg.startsWith("HS") || !r.kid || !("crypto" in globalThis && "subtle" in globalThis.crypto) ? null : await this.fetchJwk(r.kid, t?.keys ? { keys: t.keys } : t?.jwks);
			if (!c) {
				let { error: e } = await this.getUser(n);
				if (e) throw e;
				return {
					data: {
						claims: i,
						header: r,
						signature: a
					},
					error: null
				};
			}
			let l = ti(r.alg), u = await crypto.subtle.importKey("jwk", c, l, !0, ["verify"]);
			if (!await crypto.subtle.verify(l, u, a, yr(`${o}.${s}`))) throw new cr("Invalid JWT signature");
			return {
				data: {
					claims: i,
					header: r,
					signature: a
				},
				error: null
			};
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: null,
				error: e
			});
			throw e;
		}
	}
	async signInWithPasskey(e) {
		try {
			if (!zi()) return this._returnResult({
				data: null,
				error: new qn("Browser does not support WebAuthn", null)
			});
			let { data: t, error: n } = await this._startPasskeyAuthentication({ options: { captchaToken: e?.options?.captchaToken } });
			if (n || !t) return this._returnResult({
				data: null,
				error: n
			});
			let { data: r, error: i } = await Vi({
				publicKey: Fi(t.options),
				signal: e?.options?.signal ?? Ni.createNewAbortSignal(),
				mediation: e?.options?.mediation
			});
			if (i || !r) return this._returnResult({
				data: null,
				error: i ?? new qn("WebAuthn ceremony failed", null)
			});
			let a = Li(r);
			return this._verifyPasskeyAuthentication({
				challengeId: t.challenge_id,
				credential: a
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: null,
				error: e
			});
			throw e;
		}
	}
	async registerPasskey(e) {
		try {
			if (!zi()) return this._returnResult({
				data: null,
				error: new qn("Browser does not support WebAuthn", null)
			});
			let { data: t, error: n } = await this._startPasskeyRegistration();
			if (n || !t) return this._returnResult({
				data: null,
				error: n
			});
			let { data: r, error: i } = await Bi({
				publicKey: Pi(t.options),
				signal: e?.options?.signal ?? Ni.createNewAbortSignal()
			});
			if (i || !r) return this._returnResult({
				data: null,
				error: i ?? new qn("WebAuthn ceremony failed", null)
			});
			let a = Ii(r);
			return this._verifyPasskeyRegistration({
				challengeId: t.challenge_id,
				credential: a
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: null,
				error: e
			});
			throw e;
		}
	}
	async _startPasskeyRegistration() {
		try {
			return await this._useSession(async (e) => {
				let { data: { session: t }, error: n } = e;
				if (n) return this._returnResult({
					data: null,
					error: n
				});
				if (!t) return this._returnResult({
					data: null,
					error: new Yn()
				});
				let { data: r, error: i } = await F(this.fetch, "POST", `${this.url}/passkeys/registration/options`, {
					headers: this.headers,
					jwt: t.access_token,
					body: {}
				});
				return i ? this._returnResult({
					data: null,
					error: i
				}) : this._returnResult({
					data: r,
					error: null
				});
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: null,
				error: e
			});
			throw e;
		}
	}
	async _verifyPasskeyRegistration(e) {
		try {
			return await this._useSession(async (t) => {
				let { data: { session: n }, error: r } = t;
				if (r) return this._returnResult({
					data: null,
					error: r
				});
				if (!n) return this._returnResult({
					data: null,
					error: new Yn()
				});
				let { data: i, error: a } = await F(this.fetch, "POST", `${this.url}/passkeys/registration/verify`, {
					headers: this.headers,
					jwt: n.access_token,
					body: {
						challenge_id: e.challengeId,
						credential: e.credential
					}
				});
				return a ? this._returnResult({
					data: null,
					error: a
				}) : this._returnResult({
					data: i,
					error: null
				});
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: null,
				error: e
			});
			throw e;
		}
	}
	async _startPasskeyAuthentication(e) {
		try {
			let { data: t, error: n } = await F(this.fetch, "POST", `${this.url}/passkeys/authentication/options`, {
				headers: this.headers,
				body: { gotrue_meta_security: { captcha_token: e?.options?.captchaToken } }
			});
			return n ? this._returnResult({
				data: null,
				error: n
			}) : this._returnResult({
				data: t,
				error: null
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: null,
				error: e
			});
			throw e;
		}
	}
	async _verifyPasskeyAuthentication(e) {
		try {
			let { data: t, error: n } = await F(this.fetch, "POST", `${this.url}/passkeys/authentication/verify`, {
				headers: this.headers,
				body: {
					challenge_id: e.challengeId,
					credential: e.credential
				},
				xform: pi
			});
			return n ? this._returnResult({
				data: null,
				error: n
			}) : (t.session && (await this._saveSession(t.session), await this._notifyAllSubscribers("SIGNED_IN", t.session)), this._returnResult({
				data: t,
				error: null
			}));
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: null,
				error: e
			});
			throw e;
		}
	}
	async _listPasskeys() {
		try {
			return await this._useSession(async (e) => {
				let { data: { session: t }, error: n } = e;
				if (n) return this._returnResult({
					data: null,
					error: n
				});
				if (!t) return this._returnResult({
					data: null,
					error: new Yn()
				});
				let { data: r, error: i } = await F(this.fetch, "GET", `${this.url}/passkeys`, {
					headers: this.headers,
					jwt: t.access_token,
					xform: (e) => ({
						data: e,
						error: null
					})
				});
				return i ? this._returnResult({
					data: null,
					error: i
				}) : this._returnResult({
					data: r,
					error: null
				});
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: null,
				error: e
			});
			throw e;
		}
	}
	async _updatePasskey(e) {
		try {
			return await this._useSession(async (t) => {
				let { data: { session: n }, error: r } = t;
				if (r) return this._returnResult({
					data: null,
					error: r
				});
				if (!n) return this._returnResult({
					data: null,
					error: new Yn()
				});
				let { data: i, error: a } = await F(this.fetch, "PATCH", `${this.url}/passkeys/${e.passkeyId}`, {
					headers: this.headers,
					jwt: n.access_token,
					body: { friendly_name: e.friendlyName }
				});
				return a ? this._returnResult({
					data: null,
					error: a
				}) : this._returnResult({
					data: i,
					error: null
				});
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: null,
				error: e
			});
			throw e;
		}
	}
	async _deletePasskey(e) {
		try {
			return await this._useSession(async (t) => {
				let { data: { session: n }, error: r } = t;
				if (r) return this._returnResult({
					data: null,
					error: r
				});
				if (!n) return this._returnResult({
					data: null,
					error: new Yn()
				});
				let { error: i } = await F(this.fetch, "DELETE", `${this.url}/passkeys/${e.passkeyId}`, {
					headers: this.headers,
					jwt: n.access_token,
					noResolveJson: !0
				});
				return i ? this._returnResult({
					data: null,
					error: i
				}) : this._returnResult({
					data: null,
					error: null
				});
			});
		} catch (e) {
			if (P(e)) return this._returnResult({
				data: null,
				error: e
			});
			throw e;
		}
	}
};
Zi.nextInstanceID = {};
//#endregion
//#region ../social-media-generator/node_modules/@supabase/auth-js/dist/module/AuthClient.js
var Qi = Zi, $i = "2.117.2", ea = "", ta;
if (typeof Deno < "u") ea = "deno", ta = Deno.version?.deno;
else if (typeof document < "u") ea = "web";
else if (typeof navigator < "u" && navigator.product === "ReactNative") ea = "react-native";
else {
	var na;
	ea = "node";
	let e = globalThis.process;
	ta = e == null || (na = e.version) == null ? void 0 : na.replace(/^v/, "");
}
var ra = [`runtime=${ea}`];
ta && ra.push(`runtime-version=${ta}`);
var ia = { headers: { "X-Client-Info": `supabase-js/${$i}; ${ra.join("; ")}` } }, aa = { schema: "public" }, oa = {
	autoRefreshToken: !0,
	persistSession: !0,
	detectSessionInUrl: !0,
	flowType: "implicit"
}, sa = {}, I = {
	enabled: !1,
	respectSamplingDecision: !0
};
function L(e) {
	if (!e || typeof e != "string") return null;
	let t = e.split("-");
	if (t.length !== 4) return null;
	let [n, r, i, a] = t;
	if (n.length !== 2 || r.length !== 32 || i.length !== 16 || a.length !== 2) return null;
	let o = /^[0-9a-f]+$/i;
	return !o.test(n) || !o.test(r) || !o.test(i) || !o.test(a) || r === "00000000000000000000000000000000" || i === "0000000000000000" ? null : {
		version: n,
		traceId: r,
		parentId: i,
		traceFlags: a,
		isSampled: (parseInt(a, 16) & 1) == 1
	};
}
function ca(e, t) {
	if (!e || !t || t.length === 0) return !1;
	let n;
	if (e instanceof URL) n = e;
	else try {
		n = new URL(e);
	} catch {
		return !1;
	}
	for (let e of t) try {
		if (typeof e == "string") {
			if (la(n.hostname, e)) return !0;
		} else if (e instanceof RegExp) {
			if (e.test(n.hostname)) return !0;
		} else if (typeof e == "function" && e(n)) return !0;
	} catch {
		continue;
	}
	return !1;
}
function la(e, t) {
	if (t === e) return !0;
	if (t.startsWith("*.")) {
		let n = t.slice(2);
		if (e.endsWith(n) && (e === n || e.endsWith("." + n))) return !0;
	}
	return !1;
}
function ua(e) {
	let t = [];
	try {
		let n = new URL(e);
		t.push(n.hostname);
	} catch {}
	return t.push("*.supabase.co", "*.supabase.in"), t.push("localhost", "127.0.0.1", "[::1]"), t;
}
function da(e) {
	"@babel/helpers - typeof";
	return da = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, da(e);
}
function fa(e, t) {
	if (da(e) != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (da(r) != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function pa(e) {
	var t = fa(e, "string");
	return da(t) == "symbol" ? t : t + "";
}
function ma(e, t, n) {
	return (t = pa(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function ha(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function ga(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? ha(Object(n), !0).forEach(function(t) {
			ma(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : ha(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
var _a = (e) => e ? (...t) => e(...t) : (...e) => fetch(...e), va = () => Headers, ya = (e) => e.startsWith("sb_publishable_") || e.startsWith("sb_secret_"), ba = "sb_temp_", xa = /* @__PURE__ */ new Set(), Sa = (e) => {
	if (!e.startsWith("sb_") || ya(e) || e.startsWith(ba)) return;
	let t = e.match(/^sb_[a-zA-Z0-9]+_/)?.[0] ?? "unknown";
	xa.has(t) || (xa.add(t), console.warn("@supabase/supabase-js: Unrecognized Supabase API key format. The client will proceed and send this key as-is; if you see authentication errors you may need to upgrade @supabase/supabase-js to a version that recognizes this key type."));
}, Ca = (e, t, n, r, i, a) => {
	let o = _a(r), s = va(), c = i?.enabled === !0, l = i?.respectSamplingDecision !== !1, u = c ? ua(t) : null, d = !(a?.omitApiKeyAsBearer && ya(e));
	return async (t, r) => {
		let i = await n(), a = new s(r?.headers);
		if (a.has("apikey") || a.set("apikey", e), !a.has("Authorization")) {
			let t = i ?? (d ? e : null);
			t && a.set("Authorization", `Bearer ${t}`);
		}
		if (u) {
			let e = Ea(t, u, l);
			e && (e.traceparent && !a.has("traceparent") && a.set("traceparent", e.traceparent), e.tracestate && !a.has("tracestate") && a.set("tracestate", e.tracestate), e.baggage && !a.has("baggage") && a.set("baggage", e.baggage));
		}
		return o(t, ga(ga({}, r), {}, { headers: a }));
	};
}, wa = !1, Ta = !1;
function Ea(e, t, n) {
	let r = f();
	if (!r) return wa || (wa = !0, console.warn("@supabase/supabase-js: tracePropagation is enabled but the tracing runtime is not loaded, so trace headers will not be attached. Add `import '@supabase/supabase-js/tracing'` at your application entry point (requires the OpenTelemetry API package to be installed). The CDN/UMD build does not support trace propagation.")), null;
	if (!ca(typeof e == "string" || e instanceof URL ? e : e.url, t)) return null;
	let i = r();
	if (!i || !i.traceparent) {
		var a;
		if (i != null && (a = i.carrierKeys) != null && a.length && !Ta) {
			Ta = !0;
			let e = i.carrierKeys.includes("sentry-trace") ? " Sentry detected: set `propagateTraceparent: true` in Sentry.init() to emit it." : " Configure your tracing SDK to emit W3C trace context on outgoing requests.";
			console.warn(`@supabase/supabase-js: tracePropagation is enabled and a tracing SDK is active, but its propagator wrote [${i.carrierKeys.join(", ")}] and no W3C traceparent header, so trace headers will not be attached.` + e);
		}
		return null;
	}
	if (n) {
		let e = L(i.traceparent);
		if (e && !e.isSampled) return { traceparent: i.traceparent };
	}
	return i;
}
function Da(e) {
	return typeof e == "boolean" ? { enabled: e } : e;
}
function Oa(e) {
	return e.endsWith("/") ? e : e + "/";
}
var ka = !1;
function Aa(e) {
	ka || typeof e == "object" && e && "schema" in e && e.schema !== void 0 && (ka = !0, console.warn("@supabase/supabase-js: The \"schema\" option must be nested under \"db\", e.g. createClient(url, key, { db: { schema: 'myschema' } }). A top-level \"schema\" is ignored and queries go to the default schema."));
}
function ja(e, t) {
	let { db: n, auth: r, realtime: i, global: a } = e, { db: o, auth: s, realtime: c, global: l } = t, u = Da(e.tracePropagation), d = Da(t.tracePropagation), f = {
		db: ga(ga({}, o), n),
		auth: ga(ga({}, s), r),
		realtime: ga(ga({}, c), i),
		storage: {},
		global: ga(ga(ga({}, l), a), {}, { headers: ga(ga({}, l?.headers ?? {}), a?.headers ?? {}) }),
		tracePropagation: {
			enabled: u?.enabled ?? d?.enabled ?? !1,
			respectSamplingDecision: u?.respectSamplingDecision ?? d?.respectSamplingDecision ?? !0
		},
		accessToken: async () => ""
	};
	return e.accessToken ? f.accessToken = e.accessToken : delete f.accessToken, f;
}
function Ma(e) {
	let t = e?.trim();
	if (!t) throw Error("supabaseUrl is required.");
	if (!t.match(/^https?:\/\//i)) throw Error("Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.");
	try {
		return new URL(Oa(t));
	} catch {
		throw Error("Invalid supabaseUrl: Provided URL is malformed.");
	}
}
var Na = class extends Qi {
	constructor(e) {
		super(e);
	}
}, Pa = class {
	constructor(e, t, n) {
		this.supabaseUrl = e, this.supabaseKey = t;
		let r = Ma(e);
		if (!t) throw Error("supabaseKey is required.");
		Sa(t), Aa(n), this.realtimeUrl = new URL("realtime/v1", r), this.realtimeUrl.protocol = this.realtimeUrl.protocol.replace("http", "ws"), this.authUrl = new URL("auth/v1", r), this.storageUrl = new URL("storage/v1", r), this.functionsUrl = new URL("functions/v1", r);
		let i = `sb-${r.hostname.split(".")[0]}-auth-token`, a = {
			db: aa,
			realtime: sa,
			auth: ga(ga({}, oa), {}, { storageKey: i }),
			global: ia,
			tracePropagation: I
		}, o = ja(n ?? {}, a);
		this.settings = o, this.storageKey = o.auth.storageKey ?? "", this.headers = o.global.headers ?? {}, o.accessToken ? (this.accessToken = o.accessToken, this.auth = new Proxy({}, { get: (e, t) => {
			throw Error(`@supabase/supabase-js: Supabase Client is configured with the accessToken option, accessing supabase.auth.${String(t)} is not possible`);
		} })) : this.auth = this._initSupabaseAuthClient(o.auth ?? {}, this.headers, o.global.fetch), this.fetch = Ca(t, e, this._getSessionToken.bind(this), o.global.fetch, o.tracePropagation), this.functionsFetch = Ca(t, e, this._getSessionToken.bind(this), o.global.fetch, o.tracePropagation, { omitApiKeyAsBearer: !0 }), this.realtime = this._initRealtimeClient(ga({
			headers: this.headers,
			accessToken: this._getAccessToken.bind(this),
			fetch: this.fetch
		}, o.realtime)), this.accessToken && Promise.resolve(this.accessToken()).then((e) => this.realtime.setAuth(e)).catch((e) => console.warn("Failed to set initial Realtime auth token:", e)), this.rest = new _e(new URL("rest/v1", r).href, {
			headers: this.headers,
			schema: o.db.schema,
			fetch: this.fetch,
			timeout: o.db.timeout,
			urlLengthLimit: o.db.urlLengthLimit,
			retry: o.db.retry
		}), this.storage = new Mn(this.storageUrl.href, this.headers, this.fetch, n?.storage), o.accessToken || this._listenForAuthEvents();
	}
	get functions() {
		return new x(this.functionsUrl.href, {
			headers: this.headers,
			customFetch: this.functionsFetch
		});
	}
	from(e) {
		return this.rest.from(e);
	}
	schema(e) {
		return this.rest.schema(e);
	}
	getOpenApiSpec() {
		return this.rest.getOpenApiSpec();
	}
	rpc(e, t = {}, n = {
		head: !1,
		get: !1,
		count: void 0
	}) {
		return this.rest.rpc(e, t, n);
	}
	channel(e, t = { config: {} }) {
		return this.realtime.channel(e, t);
	}
	getChannels() {
		return this.realtime.getChannels();
	}
	removeChannel(e) {
		return this.realtime.removeChannel(e);
	}
	removeAllChannels() {
		return this.realtime.removeAllChannels();
	}
	async _getSessionToken() {
		var e = this;
		if (e.accessToken) return await e.accessToken();
		let { data: t } = await e.auth.getSession();
		return t.session?.access_token ?? null;
	}
	async _getAccessToken() {
		var e = this;
		return await e._getSessionToken() ?? e.supabaseKey;
	}
	_initSupabaseAuthClient({ autoRefreshToken: e, persistSession: t, detectSessionInUrl: n, storage: r, userStorage: i, storageKey: a, flowType: o, lock: s, debug: c, throwOnError: l, experimental: u, lockAcquireTimeout: d, skipAutoInitialize: f }, p, m) {
		let h = {
			Authorization: `Bearer ${this.supabaseKey}`,
			apikey: `${this.supabaseKey}`
		};
		return new Na({
			url: this.authUrl.href,
			headers: ga(ga({}, h), p),
			storageKey: a,
			autoRefreshToken: e,
			persistSession: t,
			detectSessionInUrl: n,
			storage: r,
			userStorage: i,
			flowType: o,
			lock: s,
			debug: c,
			throwOnError: l,
			experimental: u,
			fetch: m,
			lockAcquireTimeout: d,
			skipAutoInitialize: f,
			hasCustomAuthorizationHeader: Object.keys(this.headers).some((e) => e.toLowerCase() === "authorization")
		});
	}
	_initRealtimeClient(e) {
		return new Mt(this.realtimeUrl.href, ga(ga({}, e), {}, { params: ga(ga({}, { apikey: this.supabaseKey }), e?.params) }));
	}
	_listenForAuthEvents() {
		return this.auth.onAuthStateChange((e, t) => {
			this._handleTokenChanged(e, "CLIENT", t?.access_token);
		});
	}
	_handleTokenChanged(e, t, n) {
		(e === "TOKEN_REFRESHED" || e === "SIGNED_IN" || e === "INITIAL_SESSION") && this.changedAccessToken !== n ? (this.changedAccessToken = n, this.realtime.setAuth(n)) : e === "SIGNED_OUT" && (this.realtime.setAuth(), t == "STORAGE" && this.auth.signOut(), this.changedAccessToken = void 0);
	}
}, Fa = (e, t, n) => new Pa(e, t, n);
function Ia() {
	if (typeof window < "u" || globalThis.Deno !== void 0) return !1;
	let e = globalThis.process;
	if (!e) return !1;
	let t = e.version;
	if (t == null) return !1;
	let n = t.match(/^v(\d+)\./);
	return n ? parseInt(n[1], 10) <= 20 : !1;
}
Ia() && console.warn("⚠️  Node.js 20 and below are deprecated and will no longer be supported in future versions of @supabase/supabase-js. Please upgrade to Node.js 22 or later. For more information, visit: https://github.com/orgs/supabase/discussions/45715");
//#endregion
//#region src/lib/runtime-config.ts
function La(e) {
	return e?.trim() ?? "";
}
var Ra = typeof window < "u" ? window.PD_RUNTIME_CONFIG : void 0, za = {
	supabaseUrl: La(Ra?.supabaseUrl) || La("https://tpieykhhawszlzsoflnl.supabase.co"),
	supabasePublishableKey: La(Ra?.supabasePublishableKey) || La("sb_publishable_F9X_4OniNUEKFHzCLyK7mw_BQmU-V-k"),
	googleClientId: La(Ra?.googleClientId) || La("628849757836-n6go6fl2j26pqbf640sg10gpmmbanlvg.apps.googleusercontent.com"),
	portalAssetBaseUrl: La("https://dev.plaerrdeifl.de").replace(/\/+$/, "") || (typeof window < "u" && Ra ? window.location.origin : "")
}, { supabaseUrl: Ba, supabasePublishableKey: Va } = za, Ha = Ba && Va ? Fa(Ba, Va, { auth: {
	persistSession: !0,
	autoRefreshToken: !0,
	detectSessionInUrl: !0
} }) : null, Ua = class extends Error {
	code;
	constructor(e, t) {
		super(e), this.name = "PdApiError", this.code = t;
	}
}, Wa = null;
function Ga(e) {
	Wa = e;
}
async function R(e, t = {}) {
	if (Wa) return Wa(e, t);
	if (!Ha) throw Error("Supabase ist lokal noch nicht konfiguriert.");
	let { data: n, error: r } = await Ha.rpc("pd_api", {
		p_action: e,
		p_payload: t
	});
	if (r) throw new Ua(r.message, r.code);
	let i = n;
	if (!i || typeof i != "object") throw Error("Ungültige API-Antwort.");
	if (!i.ok) throw new Ua(i.error?.message || "API-Aufruf fehlgeschlagen.", i.error?.code);
	return i.data;
}
//#endregion
//#region src/lib/generator-api.ts
var z = {
	bootstrap: () => R("social_media_generator_bootstrap"),
	updatePreferences: (e) => R("social_media_generator_preferences_update", { expertMode: e }),
	listDrafts: () => R("social_media_generator_drafts_list"),
	createDraft: (e, t) => R("social_media_generator_draft_create", {
		title: e,
		document: t
	}),
	createDraftFromTemplate: (e) => R("social_media_generator_draft_create_from_template", e),
	getDraft: (e) => R("social_media_generator_draft_get", { draftId: e }),
	saveDraft: (e) => R("social_media_generator_draft_save", e),
	listTemplates: (e = !1) => R("social_media_generator_templates_list", { includeInactive: e }),
	getTemplate: (e) => R("social_media_generator_template_get", e),
	createTemplate: (e) => R("social_media_generator_template_create", e),
	beginTemplateDraft: (e) => R("social_media_generator_template_draft_begin", { templateId: e }),
	saveTemplateDraft: (e) => R("social_media_generator_template_draft_save", e),
	publishTemplate: (e) => R("social_media_generator_template_publish", e),
	setTemplateFavorite: (e, t) => R("social_media_generator_template_favorite_set", {
		templateId: e,
		favorite: t
	}),
	listPackageTemplates: (e = !1) => R("social_media_generator_package_templates_list", { includeInactive: e }),
	getPackageTemplate: (e) => R("social_media_generator_package_template_get", e),
	createPackageTemplate: (e) => R("social_media_generator_package_template_create", e),
	beginPackageTemplateDraft: (e) => R("social_media_generator_package_template_draft_begin", { packageTemplateId: e }),
	savePackageTemplateDraft: (e) => R("social_media_generator_package_template_draft_save", e),
	publishPackageTemplate: (e) => R("social_media_generator_package_template_publish", e),
	setPackageTemplateFavorite: (e, t) => R("social_media_generator_package_template_favorite_set", {
		packageTemplateId: e,
		favorite: t
	}),
	createMediaPackage: (e) => R("social_media_generator_media_package_create", e),
	listMediaPackages: () => R("social_media_generator_media_packages_list"),
	getMediaPackage: (e) => R("social_media_generator_media_package_get", { mediaPackageId: e }),
	saveMediaPackageData: (e) => R("social_media_generator_media_package_data_save", e),
	listMatchdayGames: () => R("social_media_generator_matchday_games_list"),
	getMatchdayScore: (e) => R("social_media_generator_matchday_score_get", { eventId: e }),
	listFanbusTrips: () => R("social_media_generator_fanbus_trips_list"),
	createFanbusDraft: (e) => R("social_media_generator_fanbus_draft_create", e),
	listTeamMedia: () => R("social_media_generator_media_teams_list"),
	getTeamRoster: (e) => R("social_media_generator_team_roster_get", { teamId: e }),
	listMedia: (e, t = "") => R("social_media_generator_media_list", {
		type: e,
		search: t
	}),
	getMedia: (e) => R("social_media_generator_media_get", { mediaId: e }),
	getMediaUpload: (e) => R("social_media_generator_media_upload_get", { uploadId: e }),
	archiveMedia: (e) => R("social_media_generator_media_archive", { mediaId: e }),
	startRender: (e) => R("social_media_generator_render_start", e),
	getRenderJob: (e) => R("social_media_generator_render_get", { jobId: e }),
	retryRender: (e) => R("social_media_generator_render_retry", { jobId: e }),
	retryRenderCloud: (e) => R("social_media_generator_render_cloud_retry", { jobId: e })
};
function Ka(e) {
	return e instanceof Ua && (e.code === "42501" || e.message === "SOCIAL_MEDIA_GENERATOR_ACCESS_REQUIRED");
}
function qa(e) {
	return e instanceof Ua && (e.code === "PT409" || e.message === "SOCIAL_MEDIA_DRAFT_VERSION_CONFLICT");
}
function Ja(e) {
	return e instanceof Ua && (e.code === "PT409" || e.message === "SOCIAL_MEDIA_TEMPLATE_DRAFT_VERSION_CONFLICT");
}
function Ya(e) {
	return e instanceof Ua && (e.code === "PT409" || e.message === "SOCIAL_MEDIA_PACKAGE_DRAFT_VERSION_CONFLICT" || e.message === "SOCIAL_MEDIA_MEDIA_PACKAGE_VERSION_CONFLICT");
}
function Xa(e) {
	return qa(e) || Ja(e) || Ya(e);
}
function B(e) {
	if (!(e instanceof Error)) return "Unbekannter Fehler. Bitte erneut versuchen.";
	if (e instanceof Ua) {
		if (Ka(e)) return "Dein Portal-Konto hat keinen Zugriff auf den Social-Media-Generator.";
		if (e.message === "LIVETICKER_TEMPLATE_NOT_PUBLISHED") return "Die veröffentlichte Liveticker-Systemvorlage fehlt.";
		if (e.message === "FANBUS_TEMPLATE_NOT_PUBLISHED") return "Die veröffentlichte Fanbus-Systemvorlage fehlt.";
		switch (e.code) {
			case "P0002": return "Der angeforderte Generator-Datensatz wurde nicht gefunden.";
			case "22023": return "Die eingegebenen Generator-Daten sind ungültig.";
			case "PT409": return "Der Datensatz wurde zwischenzeitlich geändert.";
			case "PLATFORM_READ_ONLY":
			case "PLATFORM_WRITE_UNAVAILABLE":
			case "PLATFORM_MAINTENANCE": return "Speichern ist wegen des aktuellen Plattformmodus vorübergehend nicht möglich.";
		}
	}
	return e.message || "API-Aufruf fehlgeschlagen.";
}
function Za(e) {
	let { document: t, ...n } = e;
	return n;
}
function Qa(e) {
	return {
		id: e.version.id,
		title: e.template.name,
		document: e.version.document,
		documentSchemaVersion: e.version.documentSchemaVersion,
		version: e.version.revision,
		createdAt: e.version.createdAt,
		updatedAt: e.version.updatedAt,
		templateVersionId: e.version.id
	};
}
//#endregion
//#region packages/graphics-core/src/model.ts
function $a(e, t, n) {
	let r = (/* @__PURE__ */ new Date()).toISOString();
	return {
		schemaVersion: 1,
		id: e,
		title: t,
		format: n,
		elements: [],
		metadata: {
			createdAt: r,
			updatedAt: r
		}
	};
}
//#endregion
//#region packages/graphics-core/src/liveticker.ts
function eo(e) {
	return e <= 60 ? String(e) : `60+${e - 60}`;
}
function to(e, t = "default") {
	let n = String(e?.name || "").trim(), r = String(e?.number || "").trim(), i = (t === "classic" && n ? n.split(/\s+/).pop() : n) || "Torschütze offen";
	return r ? `#${r} ${i}` : i;
}
function no(e) {
	return String(e || "").trim().replace(/\s+/g, " ").toLowerCase();
}
function ro(e, t) {
	let n = String(e.player?.id || "").trim();
	if (n) return `player:${n}`;
	let r = no(e.player?.name);
	return r ? `display:${no(e.player?.number)}:${r}` : `open:${e.id || t}`;
}
function io(e, t = "default") {
	if (t === "classic") return eo(e.minute);
	let n = e.kind === "PENALTY_SHOT" ? " · PEN." : "";
	return `${eo(e.minute)}'${n}`;
}
function ao(e, t = "default") {
	let n = [], r = /* @__PURE__ */ new Map();
	return e.forEach((e, i) => {
		let a = ro(e, i), o = r.get(a), s = io(e, t);
		if (o === void 0) {
			r.set(a, n.length), n.push({
				player: e.player,
				moments: [s]
			});
			return;
		}
		n[o].moments.push(s);
	}), n.map((e) => `${to(e.player, t)} | ${e.moments.join(", ")}`);
}
//#endregion
//#region packages/graphics-core/src/svg.ts
var oo = (e) => e.replace(/[&<>"']/g, (e) => ({
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	"\"": "&quot;",
	"'": "&apos;"
})[e]), so = (e) => {
	let t = e.style ?? {}, n = e.rotation ? ` transform="rotate(${e.rotation} ${e.x + e.width / 2} ${e.y + e.height / 2})"` : "";
	return [
		`data-pd-id="${oo(e.id)}"`,
		`data-pd-type="${e.type}"`,
		e.name ? `data-pd-name="${oo(e.name)}"` : "",
		e.binding ? `data-pd-binding="${oo(e.binding.key)}"` : "",
		e.binding ? `data-pd-binding-source="${e.binding.source}"` : "",
		e.locked ? "data-pd-locked=\"true\"" : "",
		t.opacity === void 0 ? "" : `opacity="${t.opacity}"`,
		n.trim()
	].filter(Boolean).join(" ");
};
function co(e, t) {
	if (!e) return;
	let n = t?.[e.source];
	if (n && Object.prototype.hasOwnProperty.call(n, e.key)) return n[e.key];
}
function lo(e, t) {
	let n = co(e.binding, t);
	return n === void 0 ? e.text : n === null ? "" : typeof n == "string" || typeof n == "number" ? String(n) : typeof n == "boolean" ? n ? "Ja" : "Nein" : e.text;
}
var uo = (e) => Array.from(e).reduce((e, t) => /\s/.test(t) ? e + .34 : /[ilI1'|.,:]/.test(t) ? e + .32 : /[MW@#]/.test(t) ? e + .92 : e + .61, 0);
function fo(e, t) {
	let n = e.binding?.renderer;
	if (!n) return null;
	let r = co(e.binding, t);
	if (n === "liveticker-goal-scorers") {
		if (r === void 0) return {
			lines: e.text ? e.text.split(/\r?\n/) : [],
			overflowCode: "LIVETICKER_GOAL_SCORERS_OVERFLOW"
		};
		if (!Array.isArray(r)) throw Error("LIVETICKER_GOAL_SCORERS_INVALID");
		return {
			lines: ao(r, e.binding?.goalScorerFormat === "classic" ? "classic" : "default"),
			overflowCode: "LIVETICKER_GOAL_SCORERS_OVERFLOW"
		};
	}
	if (n === "fanbus-boarding-stops") {
		if (r === void 0) return {
			lines: e.text ? e.text.split(/\r?\n/) : [],
			overflowCode: "FANBUS_BOARDING_STOPS_OVERFLOW"
		};
		if (!Array.isArray(r)) throw Error("FANBUS_BOARDING_STOPS_INVALID");
		return {
			lines: r.map((e) => {
				if (!e || typeof e != "object") throw Error("FANBUS_BOARDING_STOPS_INVALID");
				let t = e, n = String(t.display ?? "").trim();
				if (n) return n;
				let r = String(t.label ?? "").trim();
				return [String(t.departureAt ?? "").trim(), r].filter(Boolean).join(" · ");
			}).filter(Boolean),
			overflowCode: "FANBUS_BOARDING_STOPS_OVERFLOW"
		};
	}
	return null;
}
function po(e, t, n) {
	let r = e.binding, i = Math.max(1, Number(e.style?.fontSize ?? 48)), a = Math.max(i, Number(e.style?.lineHeight ?? Math.ceil(i * 1.3))), o = Math.min(i, Math.max(1, Number(r?.minFontSize ?? i))), s = Math.min(a, Math.max(o, Number(r?.minLineHeight ?? o))), c = Math.max(1, Math.floor(Number(r?.standardMaxLines ?? 7))), l = (n, r) => {
		let i = t.length === 0 ? 0 : n + (t.length - 1) * r, a = t.reduce((e, t) => Math.max(e, uo(t) * n), 0);
		return i <= e.height && a <= e.width;
	};
	if (t.length <= c) {
		if (l(i, a)) return {
			fontSize: i,
			lineHeight: a
		};
		if (r?.goalScorerFormat !== "classic") throw Error(n);
	}
	let u = Math.min(i, Math.max(o, i - Math.max(0, t.length - c)));
	for (let e = u; e >= o; --e) {
		let t = Math.max(1, i - o), n = (i - e) / t, r = Math.max(s, Math.floor(a - n * (a - s)));
		if (l(e, r)) return {
			fontSize: e,
			lineHeight: r
		};
	}
	throw Error(n);
}
var mo = [
	"<defs>",
	"<linearGradient id=\"pd-classic-ice\" x1=\"0%\" y1=\"0%\" x2=\"0%\" y2=\"100%\">",
	"<stop offset=\"0%\" stop-color=\"#f7fdff\"/>",
	"<stop offset=\"14%\" stop-color=\"#ccefff\"/>",
	"<stop offset=\"34%\" stop-color=\"#77cfff\"/>",
	"<stop offset=\"58%\" stop-color=\"#2f9fe2\"/>",
	"<stop offset=\"79%\" stop-color=\"#116da8\"/>",
	"<stop offset=\"100%\" stop-color=\"#06446f\"/>",
	"</linearGradient>",
	"<linearGradient id=\"pd-classic-metal\" x1=\"0%\" y1=\"0%\" x2=\"0%\" y2=\"100%\">",
	"<stop offset=\"0%\" stop-color=\"#ffffff\"/>",
	"<stop offset=\"12%\" stop-color=\"#c8d7e3\"/>",
	"<stop offset=\"28%\" stop-color=\"#eef7ff\"/>",
	"<stop offset=\"48%\" stop-color=\"#8fb2cf\"/>",
	"<stop offset=\"64%\" stop-color=\"#c7dbea\"/>",
	"<stop offset=\"82%\" stop-color=\"#5d7f9b\"/>",
	"<stop offset=\"100%\" stop-color=\"#24425a\"/>",
	"</linearGradient>",
	"<filter id=\"pd-classic-glow\" x=\"-15%\" y=\"-65%\" width=\"130%\" height=\"230%\">",
	"<feGaussianBlur stdDeviation=\"4\" result=\"blur\"/>",
	"<feMerge><feMergeNode in=\"blur\"/><feMergeNode in=\"SourceGraphic\"/></feMerge>",
	"</filter>",
	"</defs>"
].join(""), ho = [
	"<filter id=\"pd4-ice-glow\" x=\"-0.065099478\" y=\"-0.59888777\" width=\"1.130199\" height=\"2.1977755\" color-interpolation-filters=\"sRGB\"><feGaussianBlur in=\"SourceAlpha\" stdDeviation=\"12\" result=\"outerBlur\" /><feFlood flood-color=\"#159ee8\" flood-opacity=\"0.34\" result=\"outerColor\" /><feComposite in=\"outerColor\" in2=\"outerBlur\" operator=\"in\" result=\"outerGlow\" /><feGaussianBlur in=\"SourceAlpha\" stdDeviation=\"4.5\" result=\"innerBlur\" /><feFlood flood-color=\"#6dd0ff\" flood-opacity=\"0.72\" result=\"innerColor\" /><feComposite in=\"innerColor\" in2=\"innerBlur\" operator=\"in\" result=\"innerGlow\" /><feMerge><feMergeNode in=\"outerGlow\" /><feMergeNode in=\"innerGlow\" /></feMerge></filter>",
	"<filter id=\"pd4-ice-depth\" x=\"-0.029602322\" y=\"-0.27232889\" width=\"1.0592047\" height=\"1.7509675\" color-interpolation-filters=\"sRGB\"><feGaussianBlur in=\"SourceAlpha\" stdDeviation=\"4\" result=\"shadowBlur\" /><feOffset in=\"shadowBlur\" dx=\"0\" dy=\"10\" result=\"shadowOffset\" /><feFlood flood-color=\"#020b12\" flood-opacity=\"0.62\" result=\"shadowColor\" /><feComposite in=\"shadowColor\" in2=\"shadowOffset\" operator=\"in\" result=\"shadow\" /><feMorphology in=\"SourceAlpha\" operator=\"dilate\" radius=\"2.3\" result=\"expanded\" /><feOffset in=\"expanded\" dx=\"0\" dy=\"7.5\" result=\"depthOffset\" /><feFlood flood-color=\"#032b48\" flood-opacity=\"0.98\" result=\"depthColor\" /><feComposite in=\"depthColor\" in2=\"depthOffset\" operator=\"in\" result=\"depth\" /><feMerge><feMergeNode in=\"shadow\" /><feMergeNode in=\"depth\" /></feMerge></filter>",
	"<filter id=\"pd4-ice-highlight\" x=\"-0.015736646\" y=\"-0.14477051\" width=\"1.0314734\" height=\"1.3154771\" color-interpolation-filters=\"sRGB\"><feOffset in=\"SourceAlpha\" dx=\"0\" dy=\"2.2\" result=\"shifted\" /><feComposite in=\"SourceAlpha\" in2=\"shifted\" operator=\"out\" result=\"topEdge\" /><feGaussianBlur in=\"topEdge\" stdDeviation=\"0.45\" result=\"softEdge\" /><feFlood flood-color=\"#ffffff\" flood-opacity=\"0.88\" result=\"highlightColor\" /><feComposite in=\"highlightColor\" in2=\"softEdge\" operator=\"in\" /></filter>",
	"<filter id=\"pd4-metal-shadow\" x=\"-0.032890842\" y=\"-0.18683772\" width=\"1.0657817\" height=\"1.5209574\" color-interpolation-filters=\"sRGB\"><feGaussianBlur in=\"SourceAlpha\" stdDeviation=\"3.2\" result=\"blur\" /><feOffset in=\"blur\" dx=\"0\" dy=\"7\" result=\"offset\" /><feFlood flood-color=\"#0b1f2f\" flood-opacity=\"0.72\" result=\"color\" /><feComposite in=\"color\" in2=\"offset\" operator=\"in\" result=\"shadow\" /><feMerge><feMergeNode in=\"shadow\" /></feMerge></filter>",
	"<filter id=\"pd4-metal-sheen\" x=\"-0.015112009\" y=\"-0.085844358\" width=\"1.030224\" height=\"1.1716887\" color-interpolation-filters=\"sRGB\"><feGaussianBlur in=\"SourceAlpha\" stdDeviation=\"1.2\" result=\"soft\" /><feFlood flood-color=\"#ffffff\" flood-opacity=\"0.60\" result=\"white\" /><feComposite in=\"white\" in2=\"soft\" operator=\"in\" /></filter>",
	"<filter id=\"pd4-sticker-shadow\" x=\"-0.035081409\" y=\"-0.26817208\" width=\"1.0701628\" height=\"1.687776\" color-interpolation-filters=\"sRGB\"><feGaussianBlur in=\"SourceAlpha\" stdDeviation=\"2.6\" result=\"blur\" /><feOffset in=\"blur\" dx=\"0\" dy=\"5.5\" result=\"offset\" /><feFlood flood-color=\"#0b1d2c\" flood-opacity=\"0.38\" result=\"color\" /><feComposite in=\"color\" in2=\"offset\" operator=\"in\" /></filter>",
	"<filter id=\"pd4-sticker-gloss\" x=\"-0.020386117\" y=\"-0.15583717\" width=\"1.0407722\" height=\"1.3116743\" color-interpolation-filters=\"sRGB\"><feGaussianBlur in=\"SourceAlpha\" stdDeviation=\"0.9\" result=\"soft\" /><feFlood flood-color=\"#ffffff\" flood-opacity=\"0.22\" result=\"gloss\" /><feComposite in=\"gloss\" in2=\"soft\" operator=\"in\" /></filter>"
].join("");
function go(e) {
	return e.some((e) => e.type === "text" && [
		"ice-depth-glow",
		"metal-depth",
		"sticker-gloss"
	].includes(e.style?.textEffect ?? "") || e.type === "group" && go(e.children));
}
function _o(e) {
	return e.some((e) => !!e.style?.textEffect || e.type === "group" && _o(e.children));
}
function vo(e, t) {
	let n = e.elements, r = (e) => n.find((t) => t.type === "text" && t.style?.classicOverlayRole === e), i = r("goal-heading"), a = r("goal-lines");
	if (!i || !a) return n;
	let o = fo(a, t);
	if (!o?.lines.length) return n;
	let s = po(a, o.lines, o.overflowCode), c = s.fontSize + (o.lines.length - 1) * s.lineHeight, l = Number(i.style?.fontSize ?? 48);
	if (e.format.height > e.format.width) {
		let t = n.find((e) => e.type === "text" && e.id.endsWith("-footer")), r = Math.min(e.format.height - 110, (t?.y ?? e.format.height - 50) - 55), i = l + 36 + c;
		if (i > r - 860) throw Error("LIVETICKER_GOAL_SCORERS_OVERFLOW");
		let a = 860 + (r - 860 - i) / 2;
		return n.map((e) => {
			switch (e.style?.classicOverlayRole) {
				case "goal-heading": return {
					...e,
					y: a
				};
				case "goal-shadow": return {
					...e,
					y: a + 8
				};
				case "goal-lines": return {
					...e,
					y: a + l + 36
				};
				default: return e;
			}
		});
	}
	if (t?.central?.["liveticker.homeAway"] !== "AWAY") return n;
	let u = lo(i, t), d = Math.max(uo(u) * l, ...o.lines.map((e) => uo(e) * s.fontSize)), f = Math.max(a.x, Math.min(470, e.format.width - 48 - d)) - a.x;
	return n.map((e) => e.style?.classicOverlayRole ? {
		...e,
		x: e.x + f
	} : e);
}
var yo = (e, t) => {
	let n = e.style ?? {}, r = fo(e, t), i = r ? po(e, r.lines, r.overflowCode) : {
		fontSize: Number(n.fontSize ?? 48),
		lineHeight: Number(n.lineHeight ?? n.fontSize ?? 48)
	}, a = r ? r.lines.reduce((e, t) => Math.max(e, uo(t) * i.fontSize), 0) : 0, o = r && n.blockAlign === "center" ? "left" : n.textAlign ?? "left", s = r && n.blockAlign === "center" ? e.x + (e.width - a) / 2 : o === "center" ? e.x + e.width / 2 : o === "right" ? e.x + e.width : e.x, c = o === "center" ? "middle" : o === "right" ? "end" : "start", l = r && r.lines.length > 0 ? i.fontSize + (r.lines.length - 1) * i.lineHeight : 0, u = e.y + i.fontSize + (r && n.blockVerticalAlign === "center" ? Math.max(0, (e.height - l) / 2) : 0), d = r ? r.lines.map((e, t) => `<tspan x="${s}" dy="${t === 0 ? 0 : i.lineHeight}">${oo(e)}</tspan>`).join("") : oo(lo(e, t)), f = n.textEffect === "ice-glow" ? "url(#pd-classic-ice)" : n.textEffect === "frost-metal" ? "url(#pd-classic-metal)" : n.fill ?? "#ffffff", p = n.textEffect === "ice-glow" ? " filter=\"url(#pd-classic-glow)\"" : "", m = Number(n.letterSpacing), h = Number.isFinite(m) && m >= 0 && m <= 20 ? ` letter-spacing="${m}"` : "";
	if (n.textEffect === "ice-depth-glow" || n.textEffect === "metal-depth" || n.textEffect === "sticker-gloss") {
		let t = [
			`x="${s}" y="${u}"`,
			`font-family="${oo(n.fontFamily ?? "sans-serif")}"`,
			`font-size="${i.fontSize}"`,
			`font-weight="${oo(String(n.fontWeight ?? 400))}"`,
			`text-anchor="${c}"${h}`,
			"paint-order=\"stroke fill\""
		].join(" "), r = (n, r, i = "none", a = 0, o, s = !1) => `<text ${s ? so(e) : `data-pd-effect-layer="${n}"`} ${t} fill="${oo(r)}" stroke="${oo(i)}" stroke-width="${a}"${o ? ` filter="url(#${o})"` : ""}>${d}</text>`;
		return n.textEffect === "ice-depth-glow" ? [
			"<g data-pd-effect=\"ice-depth-glow\">",
			r("depth", "#ffffff", "none", 0, "pd4-ice-depth"),
			r("glow", "#ffffff", "none", 0, "pd4-ice-glow"),
			r("face", "url(#pd-classic-ice)", n.stroke ?? "#dff4ff", n.strokeWidth ?? 3.2, void 0, !0),
			r("highlight", "#ffffff", "none", 0, "pd4-ice-highlight"),
			"</g>"
		].join("") : n.textEffect === "metal-depth" ? [
			"<g data-pd-effect=\"metal-depth\">",
			r("metal-shadow", "#ffffff", "none", 0, "pd4-metal-shadow"),
			r("metal-face", "url(#pd-classic-metal)", n.stroke ?? "#ecf7ff", n.strokeWidth ?? 2.4, void 0, !0),
			r("metal-sheen", "#ffffff", "none", 0, "pd4-metal-sheen"),
			"</g>"
		].join("") : [
			"<g data-pd-effect=\"sticker-gloss\">",
			r("sticker-shadow", "#ffffff", "none", 0, "pd4-sticker-shadow"),
			r("sticker-face", n.fill ?? "#f8fdff", n.stroke ?? "#168bdf", n.strokeWidth ?? 8, void 0, !0),
			r("sticker-highlight", "#ffffff", "none", 0, "pd4-sticker-gloss"),
			"</g>"
		].join("");
	}
	return `<text ${so(e)} x="${s}" y="${u}" fill="${oo(f)}" stroke="${oo(n.stroke ?? "none")}" stroke-width="${n.strokeWidth ?? 0}" paint-order="stroke fill" font-family="${oo(n.fontFamily ?? "sans-serif")}" font-size="${i.fontSize}" font-weight="${oo(String(n.fontWeight ?? 400))}" text-anchor="${c}"${p}${h}>${d}</text>`;
}, bo = (e) => {
	let t = e.style ?? {}, n = `${so(e)} fill="${oo(t.fill ?? "transparent")}" stroke="${oo(t.stroke ?? "none")}" stroke-width="${t.strokeWidth ?? 0}"`;
	return e.shape === "ellipse" ? `<ellipse ${n} cx="${e.x + e.width / 2}" cy="${e.y + e.height / 2}" rx="${e.width / 2}" ry="${e.height / 2}" />` : `<rect ${n} x="${e.x}" y="${e.y}" width="${e.width}" height="${e.height}" rx="${e.radius ?? 0}" />`;
}, xo = (e, t, n) => {
	let r = co(e.binding, t), i = e.mediaRef?.source === "library" ? n[e.mediaRef.mediaId] ?? "" : typeof r == "string" ? r : e.href ?? "", a = e.mediaRef?.source === "library" ? ` data-pd-media-version="${e.mediaRef.version}" data-pd-media-sha256="${oo(e.mediaRef.sha256)}"` : "";
	return `<image ${so(e)} x="${e.x}" y="${e.y}" width="${e.width}" height="${e.height}" href="${oo(i)}" preserveAspectRatio="${oo(e.preserveAspectRatio ?? "xMidYMid meet")}" data-pd-media-id="${oo(e.mediaId)}"${a} />`;
}, So = (e, t, n) => `<g ${so(e)}>${e.children.map((e) => Co(e, t, n)).join("")}</g>`, Co = (e, t, n) => {
	switch (e.type) {
		case "text": return yo(e, t);
		case "shape": return bo(e);
		case "image":
		case "logo":
		case "background": return xo(e, t, n);
		case "group": return So(e, t, n);
	}
};
function wo(e, t, n = {}) {
	let { width: r, height: i } = e.format;
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${r}" height="${i}" viewBox="0 0 ${r} ${i}" data-pd-document-id="${oo(e.id)}" data-pd-schema-version="${e.schemaVersion}">`,
		..._o(e.elements) ? [mo] : [],
		...go(e.elements) ? [ho] : [],
		...vo(e, t).map((e) => Co(e, t, n)),
		"</svg>"
	].join("");
}
//#endregion
//#region packages/graphics-core/src/matchday.ts
var To = () => "local-" + Date.now() + "-" + Math.random().toString(16).slice(2), Eo = () => globalThis.crypto?.randomUUID?.() ?? To();
function Do(e, t, n) {
	return $a(n(), e, t);
}
function Oo(e) {
	let t = /* @__PURE__ */ new Date(`${e}T12:00:00`);
	return Number.isNaN(t.valueOf()) ? e : new Intl.DateTimeFormat("de-DE", {
		weekday: "long",
		day: "2-digit",
		month: "2-digit",
		year: "numeric"
	}).format(t).toLocaleUpperCase("de-DE");
}
function ko(e) {
	return e ? `${e.slice(0, 5)} UHR` : "UHRZEIT OFFEN";
}
function Ao(e, t, n, r = Eo) {
	let i = Do(e, t, r), a = t.width, o = t.height, s = [], c = `matchday.${n.eventId}`, l = Math.round(a * .065), u = Math.round(a * .245), d = Math.round(o * (o > 1400 ? .29 : .27)), f = Math.round(a * .38), p = l, m = a - l - f, h = Math.round(o * (o > 1400 ? .69 : .67)), g = Math.round(a * .075), _ = Math.round(a * .044), v = (e, t, n, i, a, o, c = 0, l, u = 0) => {
		let d = {
			id: r(),
			name: e,
			type: "shape",
			shape: "rect",
			x: t,
			y: n,
			width: i,
			height: a,
			rotation: 0,
			radius: c,
			locked: e === "Hintergrund",
			style: {
				fill: o,
				stroke: l,
				strokeWidth: u,
				opacity: 1
			}
		};
		s.push(d);
	}, y = (e, t, n, i, a, o, l, u, d = "#ffffff", f = "center", p, m) => {
		let h = {
			id: r(),
			name: e,
			type: "text",
			x: n,
			y: i,
			width: a,
			height: o,
			rotation: 0,
			text: t,
			binding: p ? {
				key: `${c}.${p}`,
				source: "central",
				lastSyncedValue: m
			} : void 0,
			style: {
				fill: d,
				fontFamily: "sans-serif",
				fontSize: l,
				fontWeight: u,
				textAlign: f,
				opacity: 1
			}
		};
		s.push(h);
	}, b = (e, t, n) => {
		let i = n + Math.round((f - u) / 2);
		if (t.logo) {
			let n = {
				id: r(),
				name: `${t.shortName || t.name} Logo`,
				type: "logo",
				x: i,
				y: d,
				width: u,
				height: u,
				rotation: 0,
				mediaId: t.logo.mediaId,
				href: t.logo.href,
				binding: {
					key: `${c}.${e}Logo`,
					source: "central",
					lastSyncedValue: t.logo.mediaId
				},
				preserveAspectRatio: "xMidYMid meet",
				style: { opacity: 1 }
			};
			s.push(n);
			return;
		}
		v(`${t.shortName || t.name} Logo-Platzhalter`, i, d, u, u, "rgba(255,255,255,0.04)", Math.round(u * .12), "rgba(255,255,255,0.24)", Math.max(2, Math.round(a * .003))), y(`${t.shortName || t.name} Logo-Platzhaltertext`, t.shortName || t.name, i, d + Math.round(u * .37), u, Math.round(u * .3), Math.round(a * .032), 800, "rgba(255,255,255,0.72)");
	};
	return v("Hintergrund", 0, 0, a, o, "#111111"), v("Akzent oben", 0, 0, a, Math.max(18, Math.round(o * .018)), "#d71920"), v("Akzent unten", l, Math.round(o * .91), a - l * 2, Math.max(8, Math.round(o * .007)), "#d71920", 999), y("Spieltagskopf", "SPIELTAG", l, Math.round(o * .075), a - l * 2, Math.round(o * .09), g, 900), y("Spieltyp", n.homeAway === "HOME" ? "HEIMSPIEL" : "AUSWÄRTSSPIEL", l, Math.round(o * .145), a - l * 2, Math.round(o * .05), Math.round(a * .027), 800, "#d71920", "center", "homeAway", n.homeAway), b("home", n.homeTeam, p), b("away", n.awayTeam, m), y("Heimteam", n.homeTeam.shortName || n.homeTeam.name, p, d + u + Math.round(o * .018), f, Math.round(o * .06), _, 850, "#ffffff", "center", "homeTeamName", n.homeTeam.name), y("Gastteam", n.awayTeam.shortName || n.awayTeam.name, m, d + u + Math.round(o * .018), f, Math.round(o * .06), _, 850, "#ffffff", "center", "awayTeamName", n.awayTeam.name), y("VS", "VS", Math.round(a * .42), d + Math.round(u * .36), Math.round(a * .16), Math.round(o * .06), Math.round(a * .045), 900, "#d71920"), y("Datum", Oo(n.eventDate), l, h, a - l * 2, Math.round(o * .055), Math.round(a * .038), 850, "#ffffff", "center", "eventDate", n.eventDate), y("Uhrzeit", ko(n.eventTime), l, h + Math.round(o * .052), a - l * 2, Math.round(o * .05), Math.round(a * .032), 750, "#d71920", "center", "eventTime", n.eventTime ?? ""), y("Spielort", n.venue?.trim() || "SPIELORT OFFEN", l, h + Math.round(o * .104), a - l * 2, Math.round(o * .05), Math.round(a * .026), 650, "rgba(255,255,255,0.78)", "center", "venue", n.venue ?? ""), y("Absender", "PLÄRRDEIFL", l, Math.round(o * .935), a - l * 2, Math.round(o * .04), Math.round(a * .022), 850, "rgba(255,255,255,0.56)"), {
		...i,
		elements: s,
		metadata: {
			...i.metadata,
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		}
	};
}
function jo(e, t, n, r = Eo) {
	let i = Ao(e, t, n, r), a = `${n.homeScore} : ${n.awayScore}`, o = n.resultSuffix?.trim() || "", s = o ? `${a} ${o}` : a, c = n.kind === "PERIOD_RESULT" ? `${n.periodHomeScore ?? 0} : ${n.periodAwayScore ?? 0}` : a;
	return {
		...i,
		elements: i.elements.map((e) => e.type === "text" ? e.name === "Spieltagskopf" ? {
			...e,
			text: n.kind === "PERIOD_RESULT" ? "DRITTELERGEBNIS" : "ENDSTAND"
		} : e.name === "Spieltyp" ? {
			...e,
			text: n.kind === "PERIOD_RESULT" ? `${n.period ?? 1}. DRITTEL` : "FINAL",
			binding: n.kind === "PERIOD_RESULT" ? {
				key: `matchday.${n.eventId}.period`,
				source: "central",
				lastSyncedValue: String(n.period ?? 1)
			} : {
				key: `matchday.${n.eventId}.status`,
				source: "central",
				lastSyncedValue: "FINAL"
			}
		} : e.name === "VS" ? {
			...e,
			text: a,
			binding: {
				key: `matchday.${n.eventId}.totalScore`,
				source: "central",
				lastSyncedValue: a
			}
		} : e.name === "Uhrzeit" ? {
			...e,
			text: n.kind === "PERIOD_RESULT" ? `DRITTEL ${c} · GESAMT ${a}` : `ENDSTAND ${s}`,
			binding: {
				key: n.kind === "PERIOD_RESULT" ? `matchday.${n.eventId}.periodScore` : `matchday.${n.eventId}.finalScore`,
				source: "central",
				lastSyncedValue: n.kind === "PERIOD_RESULT" ? c : s
			}
		} : e : e),
		metadata: {
			...i.metadata,
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		}
	};
}
//#endregion
//#region src/lib/documents.ts
var Mo = [
	{
		code: "story",
		name: "Story",
		width: 1080,
		height: 1920
	},
	{
		code: "portrait",
		name: "Portrait",
		width: 1080,
		height: 1350
	},
	{
		code: "square",
		name: "Square",
		width: 1080,
		height: 1080
	}
], No = () => `local-${Date.now()}-${Math.random().toString(16).slice(2)}`, Po = () => globalThis.crypto?.randomUUID?.() ?? No();
function Fo(e, t, n = Po) {
	return $a(n(), e, t);
}
function Io(e, t = Po) {
	let n = Math.round(e.format.width * .72), r = Math.max(80, Math.round(e.format.height * .08)), i = {
		id: t(),
		name: "Text",
		type: "text",
		x: Math.round((e.format.width - n) / 2),
		y: Math.round(e.format.height * .18),
		width: n,
		height: r,
		rotation: 0,
		text: "Neuer Text",
		style: {
			fill: "#ffffff",
			fontSize: Math.max(36, Math.round(e.format.width * .055)),
			fontWeight: 700,
			textAlign: "left",
			opacity: 1
		}
	};
	return ns(e, { elements: [...e.elements, i] });
}
function Lo(e, t, n = Po) {
	let r = n(), i = Math.max(120, Math.round(e.format.width * .24)), a = {
		id: r,
		name: `${t.name} Logo`,
		type: "logo",
		x: Math.round((e.format.width - i) / 2),
		y: Math.round(e.format.height * .1),
		width: i,
		height: i,
		rotation: 0,
		mediaId: t.mediaId,
		href: t.href,
		preserveAspectRatio: "xMidYMid meet",
		style: { opacity: 1 }
	};
	return {
		document: ns(e, { elements: [...e.elements, a] }),
		elementId: r
	};
}
function Ro(e, t, n = Po) {
	let r = n(), i = t.type === "BACKGROUND", a = i ? e.format.width : Math.round(e.format.width * .72), o = i ? e.format.height : Math.round(e.format.height * .62), s = Math.min(a / t.width, o / t.height), c = i ? e.format.width : Math.max(1, Math.round(t.width * s)), l = i ? e.format.height : Math.max(1, Math.round(t.height * s)), u = {
		id: r,
		name: t.title,
		type: i ? "background" : "image",
		x: Math.round((e.format.width - c) / 2),
		y: Math.round((e.format.height - l) / 2),
		width: c,
		height: l,
		rotation: 0,
		mediaId: t.id,
		mediaRef: {
			source: "library",
			mediaId: t.id,
			version: t.version,
			sha256: t.sha256,
			name: t.title
		},
		preserveAspectRatio: i ? "xMidYMid slice" : "xMidYMid meet",
		style: { opacity: 1 }
	};
	return {
		document: ns(e, { elements: i ? [u, ...e.elements.filter((e) => e.type !== "background")] : [...e.elements, u] }),
		elementId: r
	};
}
function zo(e, t, n = Po) {
	let r = Math.round(e.format.width * .42), i = Math.round(e.format.height * .18), a = {
		id: n(),
		name: t === "ellipse" ? "Ellipse" : "Rechteck",
		type: "shape",
		shape: t,
		x: Math.round((e.format.width - r) / 2),
		y: Math.round((e.format.height - i) / 2),
		width: r,
		height: i,
		rotation: 0,
		radius: t === "rect" ? 24 : void 0,
		style: {
			fill: "#d71920",
			stroke: "#ffffff",
			strokeWidth: 0,
			opacity: 1
		}
	};
	return ns(e, { elements: [...e.elements, a] });
}
function Bo(e, t) {
	return ns(e, { title: t });
}
function Vo(e, t) {
	for (let n of e) {
		if (n.id === t) return n;
		if (n.type === "group") {
			let e = Vo(n.children, t);
			if (e) return e;
		}
	}
	return null;
}
function Ho(e, t, n) {
	let [r, i] = qo(e.elements, t, n);
	return i ? ns(e, { elements: r }) : e;
}
function V(e, t) {
	let [n, r] = Jo(e.elements, t);
	return r ? ns(e, { elements: n }) : e;
}
function H(e, t, n = Po) {
	let r = Vo(e.elements, t);
	if (!r) return {
		document: e,
		duplicatedId: null
	};
	let i = ts(r, n, !0), [a, o] = Yo(e.elements, t, i);
	return o ? {
		document: ns(e, { elements: a }),
		duplicatedId: i.id
	} : {
		document: e,
		duplicatedId: null
	};
}
function Uo(e, t, n) {
	let [r, i] = Xo(e.elements, t, n);
	return i ? ns(e, { elements: r }) : e;
}
function Wo(e, t, n = Po) {
	let r = [...new Set(t)].filter(Boolean);
	if (r.length < 2) return {
		document: e,
		groupId: null
	};
	let [i, a, o] = Zo(e.elements, new Set(r), n);
	return o && a ? {
		document: ns(e, { elements: i }),
		groupId: a
	} : {
		document: e,
		groupId: null
	};
}
function Go(e, t) {
	let [n, r, i] = Qo(e.elements, t);
	return i ? {
		document: ns(e, { elements: n }),
		childIds: r
	} : {
		document: e,
		childIds: []
	};
}
function Ko(e, t, n, r) {
	return !n && !r ? e : Ho(e, t, (e) => $o(e, n, r));
}
function qo(e, t, n) {
	let r = !1;
	return [e.map((e) => {
		if (e.id === t) return r = !0, n(e);
		if (e.type === "group") {
			let [i, a] = qo(e.children, t, n);
			if (a) return r = !0, es({
				...e,
				children: i
			});
		}
		return e;
	}), r];
}
function Jo(e, t) {
	let n = e.findIndex((e) => e.id === t);
	if (n >= 0) return [e.filter((e, t) => t !== n), !0];
	let r = !1;
	return [e.map((e) => {
		if (e.type !== "group") return e;
		let [n, i] = Jo(e.children, t);
		return i ? (r = !0, es({
			...e,
			children: n
		})) : e;
	}), r];
}
function Yo(e, t, n) {
	let r = e.findIndex((e) => e.id === t);
	if (r >= 0) {
		let t = [...e];
		return t.splice(r + 1, 0, n), [t, !0];
	}
	let i = !1;
	return [e.map((e) => {
		if (e.type !== "group") return e;
		let [r, a] = Yo(e.children, t, n);
		return a ? (i = !0, es({
			...e,
			children: r
		})) : e;
	}), i];
}
function Xo(e, t, n) {
	let r = e.findIndex((e) => e.id === t);
	if (r >= 0) {
		let t = r;
		switch (n) {
			case "forward":
				t = Math.min(e.length - 1, r + 1);
				break;
			case "backward":
				t = Math.max(0, r - 1);
				break;
			case "front":
				t = e.length - 1;
				break;
			case "back": t = 0;
		}
		if (t === r) return [e, !1];
		let i = [...e], [a] = i.splice(r, 1);
		return i.splice(t, 0, a), [i, !0];
	}
	let i = !1;
	return [e.map((e) => {
		if (e.type !== "group") return e;
		let [r, a] = Xo(e.children, t, n);
		return a ? (i = !0, {
			...e,
			children: r
		}) : e;
	}), i];
}
function Zo(e, t, n) {
	let r = e.filter((e) => t.has(e.id));
	if (r.length === t.size && r.length >= 2) {
		let i = es({
			id: n(),
			name: "Gruppe",
			type: "group",
			x: 0,
			y: 0,
			width: 1,
			height: 1,
			rotation: 0,
			children: r
		}), a = [], o = !1;
		for (let n of e) {
			if (t.has(n.id)) {
				o ||= (a.push(i), !0);
				continue;
			}
			a.push(n);
		}
		return [
			a,
			i.id,
			!0
		];
	}
	for (let r = 0; r < e.length; r += 1) {
		let i = e[r];
		if (i.type !== "group") continue;
		let [a, o, s] = Zo(i.children, t, n);
		if (s) {
			let t = [...e];
			return t[r] = es({
				...i,
				children: a
			}), [
				t,
				o,
				!0
			];
		}
	}
	return [
		e,
		null,
		!1
	];
}
function Qo(e, t) {
	let n = e.findIndex((e) => e.id === t && e.type === "group");
	if (n >= 0) {
		let t = e[n], r = [...e];
		return r.splice(n, 1, ...t.children), [
			r,
			t.children.map((e) => e.id),
			!0
		];
	}
	for (let n = 0; n < e.length; n += 1) {
		let r = e[n];
		if (r.type !== "group") continue;
		let [i, a, o] = Qo(r.children, t);
		if (o) {
			let t = [...e];
			return t[n] = es({
				...r,
				children: i
			}), [
				t,
				a,
				!0
			];
		}
	}
	return [
		e,
		[],
		!1
	];
}
function $o(e, t, n) {
	return e.type === "group" ? {
		...e,
		x: e.x + t,
		y: e.y + n,
		children: e.children.map((e) => $o(e, t, n))
	} : {
		...e,
		x: e.x + t,
		y: e.y + n
	};
}
function es(e) {
	if (e.children.length === 0) return e;
	let t = Math.min(...e.children.map((e) => e.x)), n = Math.min(...e.children.map((e) => e.y)), r = Math.max(...e.children.map((e) => e.x + e.width)), i = Math.max(...e.children.map((e) => e.y + e.height));
	return {
		...e,
		x: t,
		y: n,
		width: Math.max(1, r - t),
		height: Math.max(1, i - n)
	};
}
function ts(e, t, n) {
	let r = {
		...e,
		id: t(),
		name: e.name ? `${e.name} Kopie` : void 0,
		x: n ? e.x + 24 : e.x,
		y: n ? e.y + 24 : e.y
	};
	if (e.type === "group") {
		let i = e.children.map((e) => {
			let r = ts(e, t, !1);
			return n ? $o(r, 24, 24) : r;
		});
		return es({
			...r,
			type: "group",
			children: i
		});
	}
	return r;
}
function ns(e, t) {
	return {
		...e,
		...t,
		metadata: {
			...e.metadata,
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		}
	};
}
//#endregion
//#region src/lib/media-library.ts
var rs = 10485760, is = /* @__PURE__ */ new Set([
	"image/png",
	"image/jpeg",
	"image/webp"
]), as = null;
function os(e) {
	as = e;
}
async function ss() {
	if (as) {
		let e = await as();
		if (!e) throw Error("Deine Cockpit-Sitzung ist abgelaufen.");
		return e;
	}
	if (!Ha) throw Error("Supabase ist lokal noch nicht konfiguriert.");
	let { data: e, error: t } = await Ha.auth.getSession();
	if (t || !e.session?.access_token) throw Error("Deine Anmeldung ist abgelaufen. Bitte neu anmelden.");
	return e.session.access_token;
}
function cs() {
	let e = za.supabaseUrl.replace(/\/+$/, "");
	if (!e || !za.supabasePublishableKey) throw Error("Die Medienbibliothek ist nicht konfiguriert.");
	return `${e}/functions/v1/social-media-library`;
}
async function ls(e) {
	let t = await e.json().catch(() => null);
	if (!e.ok || !t || t.ok !== !0) {
		let e = t && "error" in t ? t.error?.message : void 0;
		throw Error(e || "Die Medienanfrage ist fehlgeschlagen.");
	}
	return t.data;
}
function us(e) {
	if (e.size < 1) throw Error("Die ausgewählte Datei ist leer.");
	if (e.size > rs) throw Error("Das Bild darf höchstens 10 MiB groß sein.");
	if (e.type && !is.has(e.type)) throw Error("Bitte eine PNG-, JPEG- oder WebP-Datei auswählen.");
}
async function ds(e, t, n) {
	us(e);
	let r = n.trim();
	if (!r || r.length > 160) throw Error("Bitte einen Titel mit höchstens 160 Zeichen eingeben.");
	let i = await ss(), a = new FormData();
	return a.set("action", "upload"), a.set("type", t), a.set("title", r), a.set("file", e, e.name), ls(await fetch(cs(), {
		method: "POST",
		headers: {
			Authorization: `Bearer ${i}`,
			apikey: za.supabasePublishableKey
		},
		body: a
	}));
}
async function fs(e) {
	let t = await ss(), n = new URL(cs());
	n.searchParams.set("mediaId", e);
	let r = await fetch(n, {
		headers: {
			Authorization: `Bearer ${t}`,
			apikey: za.supabasePublishableKey
		},
		cache: "no-store"
	});
	if (!r.ok) {
		let e = await r.json().catch(() => null);
		throw Error(e?.error?.message || "Die Medienvorschau konnte nicht geladen werden.");
	}
	return URL.createObjectURL(await r.blob());
}
async function ps(e, t = {}) {
	let n = t.timeoutMs ?? 9e4, r = t.intervalMs ?? 1500, i = Date.now() + n;
	for (; Date.now() < i;) {
		let t = await z.getMediaUpload(e);
		if (t.status === "SUCCEEDED" && t.asset) return t.asset;
		if (t.status === "FAILED") throw Error(t.errorCode ? `Die Verarbeitung ist fehlgeschlagen (${t.errorCode}).` : "Die Verarbeitung des Bildes ist fehlgeschlagen.");
		await new Promise((e) => window.setTimeout(e, r));
	}
	throw Error("Die Verarbeitung dauert länger als erwartet. Das Bild kann später erneut geladen werden.");
}
//#endregion
//#region src/lib/canvas-keyboard.ts
var ms = "input, textarea, select, button, [contenteditable], [role=\"textbox\"]";
function hs(e) {
	return e instanceof Element && (e.matches(ms) || e.closest(ms) !== null);
}
function gs() {
	let e = document.activeElement;
	for (; e?.shadowRoot?.activeElement;) e = e.shadowRoot.activeElement;
	return e;
}
function _s(e) {
	return !(e.defaultPrevented || e.isComposing || e.composedPath().some((e) => hs(e)) || hs(e.target) || hs(gs()));
}
//#endregion
//#region ../social-media-generator/node_modules/react/cjs/react-jsx-runtime.production.js
var vs = /* @__PURE__ */ e(((e) => {
	var t = Symbol.for("react.transitional.element"), n = Symbol.for("react.fragment");
	function r(e, n, r) {
		var i = null;
		if (r !== void 0 && (i = "" + r), n.key !== void 0 && (i = "" + n.key), "key" in n) for (var a in r = {}, n) a !== "key" && (r[a] = n[a]);
		else r = n;
		return n = r.ref, {
			$$typeof: t,
			type: e,
			key: i,
			ref: n === void 0 ? null : n,
			props: r
		};
	}
	e.Fragment = n, e.jsx = r, e.jsxs = r;
})), U = (/* @__PURE__ */ e(((e, t) => {
	t.exports = vs();
})))(), ys = [
	{
		type: "UPLOAD",
		label: "Eigene Uploads"
	},
	{
		type: "GENERAL",
		label: "Allgemein"
	},
	{
		type: "BACKGROUND",
		label: "Hintergründe"
	}
];
function bs({ onSelect: e, onClose: t }) {
	let [n, r] = (0, l.useState)("UPLOAD"), [i, a] = (0, l.useState)(""), [o, s] = (0, l.useState)([]), [c, u] = (0, l.useState)(!0), [d, f] = (0, l.useState)(null), [p, m] = (0, l.useState)(!1), [h, g] = (0, l.useState)(null), [_, v] = (0, l.useState)(""), [y, b] = (0, l.useState)(null), [x, S] = (0, l.useState)({}), ee = (0, l.useRef)({}), te = (0, l.useCallback)(async () => {
		u(!0), f(null);
		try {
			let e = await z.listMedia(n, i.trim());
			s(e.media);
		} catch (e) {
			console.error("Media library list failed", e), f(B(e));
		} finally {
			u(!1);
		}
	}, [i, n]);
	(0, l.useEffect)(() => {
		let e = window.setTimeout(() => void te(), 180);
		return () => window.clearTimeout(e);
	}, [te]), (0, l.useEffect)(() => {
		let e = !1, t = o.filter((e) => !ee.current[e.id]);
		return Promise.all(t.map(async (t) => {
			try {
				let n = await fs(t.id);
				if (e) {
					URL.revokeObjectURL(n);
					return;
				}
				ee.current[t.id] = n, S((e) => ({
					...e,
					[t.id]: n
				}));
			} catch (e) {
				console.error("Media preview failed", e);
			}
		})), () => {
			e = !0;
		};
	}, [o]), (0, l.useEffect)(() => () => {
		Object.values(ee.current).forEach((e) => URL.revokeObjectURL(e));
	}, []);
	let C = (0, l.useMemo)(() => ys.find((e) => e.type === n)?.label ?? "", [n]), ne = (e) => {
		if (f(null), !e) {
			b(null);
			return;
		}
		try {
			us(e), b(e), _.trim() || v(e.name.replace(/\.[^.]+$/, "").slice(0, 160));
		} catch (e) {
			b(null), f(B(e));
		}
	}, w = async () => {
		if (y && !p) {
			m(!0), f("Das Bild wird geprüft und in die Medienbibliothek übertragen …");
			try {
				let e = await ds(y, n, _);
				f("Upload abgeschlossen. Das Bild wird in Nextcloud abgelegt …"), await ps(e.uploadId), b(null), v(""), f("Das Bild ist jetzt in der Medienbibliothek verfügbar."), await te();
			} catch (e) {
				console.error("Media upload failed", e), f(B(e));
			} finally {
				m(!1);
			}
		}
	}, re = async (e) => {
		if (!h && window.confirm(`„${e.title}“ archivieren? Bestehende Entwürfe und Renderjobs bleiben nutzbar.`)) {
			g(e.id), f(null);
			try {
				await z.archiveMedia(e.id);
				let t = ee.current[e.id];
				t && (URL.revokeObjectURL(t), delete ee.current[e.id]), s((t) => t.filter((t) => t.id !== e.id));
			} catch (e) {
				console.error("Media archive failed", e), f(B(e));
			} finally {
				g(null);
			}
		}
	};
	return /* @__PURE__ */ (0, U.jsxs)("section", {
		className: "panel media-library",
		"aria-labelledby": "media-library-title",
		children: [
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "field-group-head media-library-head",
				children: [/* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("p", {
					className: "panel-label",
					children: "Medien"
				}), /* @__PURE__ */ (0, U.jsx)("h2", {
					id: "media-library-title",
					children: "Medienbibliothek"
				})] }), /* @__PURE__ */ (0, U.jsx)("button", {
					className: "secondary-button",
					onClick: t,
					children: "Schließen"
				})]
			}),
			/* @__PURE__ */ (0, U.jsx)("div", {
				className: "media-library-tabs",
				role: "tablist",
				"aria-label": "Medienkategorie",
				children: ys.map((e) => /* @__PURE__ */ (0, U.jsx)("button", {
					className: n === e.type ? "media-tab media-tab-active" : "media-tab",
					role: "tab",
					"aria-selected": n === e.type,
					onClick: () => {
						r(e.type), a(""), f(null);
					},
					children: e.label
				}, e.type))
			}),
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "media-library-controls",
				children: [/* @__PURE__ */ (0, U.jsxs)("label", {
					className: "field media-search",
					children: [/* @__PURE__ */ (0, U.jsxs)("span", { children: [C, " durchsuchen"] }), /* @__PURE__ */ (0, U.jsx)("input", {
						value: i,
						placeholder: "Titel oder Dateiname",
						onChange: (e) => a(e.target.value)
					})]
				}), /* @__PURE__ */ (0, U.jsxs)("div", {
					className: "media-upload-form",
					children: [
						/* @__PURE__ */ (0, U.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Titel" }), /* @__PURE__ */ (0, U.jsx)("input", {
								value: _,
								maxLength: 160,
								placeholder: "Anzeigename",
								disabled: p,
								onChange: (e) => v(e.target.value)
							})]
						}),
						/* @__PURE__ */ (0, U.jsxs)("label", {
							className: "field media-file-field",
							children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Bilddatei" }), /* @__PURE__ */ (0, U.jsx)("input", {
								type: "file",
								accept: "image/png,image/jpeg,image/webp",
								disabled: p,
								onChange: (e) => ne(e.target.files?.[0] ?? null)
							})]
						}),
						/* @__PURE__ */ (0, U.jsx)("button", {
							className: "primary-button media-upload-button",
							disabled: !y || !_.trim() || p,
							onClick: () => void w(),
							children: p ? "Wird verarbeitet …" : "Bild hochladen"
						})
					]
				})]
			}),
			d ? /* @__PURE__ */ (0, U.jsx)("div", {
				className: d.includes("fehl") || d.includes("ungültig") ? "message-box error-box" : "message-box media-info-box",
				role: "status",
				children: d
			}) : null,
			c ? /* @__PURE__ */ (0, U.jsx)("p", {
				className: "empty-copy",
				children: "Medien werden geladen …"
			}) : o.length === 0 ? /* @__PURE__ */ (0, U.jsx)("p", {
				className: "empty-copy",
				children: "In dieser Kategorie wurden keine Medien gefunden."
			}) : /* @__PURE__ */ (0, U.jsx)("div", {
				className: "media-library-grid",
				children: o.map((t) => /* @__PURE__ */ (0, U.jsxs)("article", {
					className: "media-card",
					children: [/* @__PURE__ */ (0, U.jsxs)("button", {
						className: "media-card-select",
						onClick: () => e(t),
						"aria-label": `${t.title} verwenden`,
						children: [/* @__PURE__ */ (0, U.jsx)("span", {
							className: "media-card-preview",
							children: x[t.id] ? /* @__PURE__ */ (0, U.jsx)("img", {
								src: x[t.id],
								alt: "",
								loading: "lazy"
							}) : /* @__PURE__ */ (0, U.jsx)("span", { children: "Vorschau lädt …" })
						}), /* @__PURE__ */ (0, U.jsxs)("span", {
							className: "media-card-copy",
							children: [/* @__PURE__ */ (0, U.jsx)("strong", { children: t.title }), /* @__PURE__ */ (0, U.jsxs)("small", { children: [
								t.width,
								" × ",
								t.height,
								" · ",
								xs(t.sizeBytes)
							] })]
						})]
					}), t.canArchive ? /* @__PURE__ */ (0, U.jsx)("button", {
						className: "media-card-archive",
						disabled: !!h,
						onClick: () => void re(t),
						children: h === t.id ? "Archiviert …" : "Archivieren"
					}) : null]
				}, t.id))
			})
		]
	});
}
function xs(e) {
	return e < 1024 ? `${e} B` : e < 1048576 ? `${Math.round(e / 1024)} KiB` : `${(e / 1048576).toFixed(1)} MiB`;
}
//#endregion
//#region src/components/RenderControls.tsx
var Ss = {
	QUEUED: "Warteschlange",
	PROCESSING: "PNG wird erstellt",
	SUCCEEDED: "PNG erstellt",
	FAILED: "Render fehlgeschlagen"
}, Cs = {
	PENDING: "Cloud ausstehend",
	PROCESSING: "Cloud wird gespeichert",
	SUCCEEDED: "Cloud gespeichert",
	FAILED: "Cloud fehlgeschlagen"
};
function ws({ draftId: e, version: t, editorStatus: n, bindingContext: r }) {
	let [i, a] = (0, l.useState)(null), [o, s] = (0, l.useState)(!1), [c, u] = (0, l.useState)(null), d = n === "saved" && !o, f = (0, l.useMemo)(() => r || void 0, [r]), p = async (e) => {
		try {
			let t = await z.getRenderJob(e);
			return a(t), u(null), t;
		} catch (e) {
			return console.error("Render status load failed", e), u(B(e)), null;
		}
	};
	(0, l.useEffect)(() => {
		if (!i) return;
		let e = ["QUEUED", "PROCESSING"].includes(i.renderStatus), t = i.renderStatus === "SUCCEEDED" && ["PENDING", "PROCESSING"].includes(i.cloudStatus);
		if (!e && !t) return;
		let n = window.setInterval(() => {
			p(i.id);
		}, 2e3);
		return () => window.clearInterval(n);
	}, [
		i?.id,
		i?.renderStatus,
		i?.cloudStatus
	]);
	let m = async () => {
		if (d) {
			s(!0), u(null);
			try {
				let n = await z.startRender({
					draftId: e,
					expectedVersion: t,
					bindingContext: f
				});
				a(n);
			} catch (e) {
				console.error("Render start failed", e), u(B(e));
			} finally {
				s(!1);
			}
		}
	}, h = async () => {
		if (i && !o) {
			s(!0), u(null);
			try {
				a(await z.retryRender(i.id));
			} catch (e) {
				console.error("Render retry failed", e), u(B(e));
			} finally {
				s(!1);
			}
		}
	}, g = async () => {
		if (i && !o) {
			s(!0), u(null);
			try {
				a(await z.retryRenderCloud(i.id));
			} catch (e) {
				console.error("Cloud retry failed", e), u(B(e));
			} finally {
				s(!1);
			}
		}
	};
	return /* @__PURE__ */ (0, U.jsxs)("section", {
		className: "render-controls",
		"aria-labelledby": "render-controls-title",
		children: [
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "render-controls-head",
				children: [/* @__PURE__ */ (0, U.jsxs)("div", {
					className: "render-title-line",
					children: [/* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("p", {
						className: "panel-label",
						children: "Export"
					}), /* @__PURE__ */ (0, U.jsx)("h3", {
						id: "render-controls-title",
						children: "PNG"
					})] }), i ? /* @__PURE__ */ (0, U.jsxs)("div", {
						className: "render-job-statuses",
						"aria-live": "polite",
						children: [/* @__PURE__ */ (0, U.jsx)("span", {
							className: `render-status render-status-${i.renderStatus.toLowerCase()}`,
							children: Ss[i.renderStatus]
						}), /* @__PURE__ */ (0, U.jsx)("span", {
							className: `cloud-status cloud-status-${i.cloudStatus.toLowerCase()}`,
							children: Cs[i.cloudStatus]
						})]
					}) : /* @__PURE__ */ (0, U.jsx)("span", {
						className: "render-idle",
						children: "Noch kein Export"
					})]
				}), /* @__PURE__ */ (0, U.jsxs)("div", {
					className: "render-actions",
					children: [
						i?.renderStatus === "FAILED" ? /* @__PURE__ */ (0, U.jsx)("button", {
							className: "secondary-button compact-button",
							disabled: o,
							onClick: () => void h(),
							children: "Render wiederholen"
						}) : null,
						i?.renderStatus === "SUCCEEDED" && i.cloudStatus === "FAILED" ? /* @__PURE__ */ (0, U.jsx)("button", {
							className: "secondary-button compact-button",
							disabled: o,
							onClick: () => void g(),
							children: "Cloud wiederholen"
						}) : null,
						i?.resultManifest?.downloadUrl ? /* @__PURE__ */ (0, U.jsx)("a", {
							className: "secondary-button compact-button render-download",
							href: i.resultManifest.downloadUrl,
							download: !0,
							children: "Herunterladen"
						}) : null,
						/* @__PURE__ */ (0, U.jsx)("button", {
							className: "primary-button compact-button",
							disabled: !d,
							onClick: () => void m(),
							title: n === "saved" ? "Gespeicherte Version als PNG rendern" : "Vor dem Rendern muss der Entwurf gespeichert sein.",
							children: o ? "Bitte warten …" : "PNG erstellen"
						})
					]
				})]
			}),
			n === "saved" ? null : /* @__PURE__ */ (0, U.jsx)("p", {
				className: "render-hint",
				children: "Export ist verfügbar, sobald die aktuelle Änderung gespeichert wurde."
			}),
			c ? /* @__PURE__ */ (0, U.jsx)("div", {
				className: "message-box error-box",
				role: "alert",
				children: c
			}) : null,
			i ? /* @__PURE__ */ (0, U.jsxs)("details", {
				className: "render-details",
				children: [
					/* @__PURE__ */ (0, U.jsx)("summary", { children: "Exportdetails" }),
					/* @__PURE__ */ (0, U.jsxs)("dl", {
						className: "render-job-meta",
						children: [
							/* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("dt", { children: "Entwurf" }), /* @__PURE__ */ (0, U.jsxs)("dd", { children: ["v", i.draftVersion] })] }),
							/* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("dt", { children: "Render" }), /* @__PURE__ */ (0, U.jsxs)("dd", { children: [
								i.attemptCount,
								" / ",
								i.maxAttempts
							] })] }),
							i.cloudAttemptCount !== void 0 && i.cloudMaxAttempts !== void 0 ? /* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("dt", { children: "Cloud" }), /* @__PURE__ */ (0, U.jsxs)("dd", { children: [
								i.cloudAttemptCount,
								" / ",
								i.cloudMaxAttempts
							] })] }) : null,
							/* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("dt", { children: "Kompatibilität" }), /* @__PURE__ */ (0, U.jsxs)("dd", { children: ["v", i.compatibilityVersion] })] }),
							i.rendererVersion ? /* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("dt", { children: "Renderer" }), /* @__PURE__ */ (0, U.jsx)("dd", { children: i.rendererVersion })] }) : null
						]
					}),
					i.renderErrorCode ? /* @__PURE__ */ (0, U.jsxs)("p", {
						className: "render-error-code",
						children: ["Renderfehler: ", /* @__PURE__ */ (0, U.jsx)("code", { children: i.renderErrorCode })]
					}) : null,
					i.cloudErrorCode ? /* @__PURE__ */ (0, U.jsxs)("p", {
						className: "render-error-code",
						children: ["Cloudfehler: ", /* @__PURE__ */ (0, U.jsx)("code", { children: i.cloudErrorCode })]
					}) : null
				]
			}) : null
		]
	});
}
//#endregion
//#region src/lib/team-media.ts
function Ts(e) {
	return !!(e.logoStorageBucket?.trim() && e.logoStoragePath?.trim());
}
function Es(e, t = za.supabaseUrl) {
	return As(e, t);
}
function Ds(e) {
	return Os(e);
}
function Os(e, t = za.supabaseUrl) {
	let n = As(e, t);
	if (!n) return null;
	let r = e.logoSha256 ?? e.logoStoragePath ?? "storage";
	return {
		mediaId: `team-logo:${e.id}:${r}`,
		href: n,
		name: e.shortName || e.name,
		sourceVersion: r
	};
}
function ks() {
	return !!za.supabaseUrl;
}
function As(e, t) {
	let n = e.logoStorageBucket?.trim(), r = e.logoStoragePath?.trim(), i = t.trim().replace(/\/+$/, "");
	if (!n || !r || !i) return null;
	let a = encodeURIComponent(n), o = r.split("/").filter(Boolean).map((e) => encodeURIComponent(e)).join("/");
	return o ? `${i}/storage/v1/object/public/${a}/${o}` : null;
}
//#endregion
//#region src/components/TeamLogoPicker.tsx
function js({ onSelect: e, onClose: t }) {
	let [n, r] = (0, l.useState)([]), [i, a] = (0, l.useState)(""), [o, s] = (0, l.useState)(!0), [c, u] = (0, l.useState)(null);
	(0, l.useEffect)(() => {
		let e = !1;
		return z.listTeamMedia().then((t) => {
			e || (r(t), u(null));
		}).catch((t) => {
			console.error("Team media list failed", t), e || u(B(t));
		}).finally(() => {
			e || s(!1);
		}), () => {
			e = !0;
		};
	}, []);
	let d = (0, l.useMemo)(() => {
		let e = i.trim().toLocaleLowerCase("de");
		return e ? n.filter((t) => [
			t.name,
			t.shortName,
			t.teamCode ?? ""
		].some((t) => t.toLocaleLowerCase("de").includes(e))) : n;
	}, [i, n]), f = (t) => {
		if (Ts(t)) {
			u(null);
			try {
				let n = Os(t);
				if (!n) throw ks() ? Error("Für dieses Team ist kein nutzbares zentrales Logo hinterlegt.") : Error("Die Supabase-Basis ist für diese Generator-Umgebung noch nicht konfiguriert.");
				e(n);
			} catch (e) {
				console.error("Team logo resolve failed", e), u(B(e));
			}
		}
	};
	return /* @__PURE__ */ (0, U.jsxs)("section", {
		className: "panel team-logo-picker",
		"aria-labelledby": "team-logo-picker-title",
		children: [
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "field-group-head",
				children: [/* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("p", {
					className: "panel-label",
					children: "Zentrale Medien"
				}), /* @__PURE__ */ (0, U.jsx)("h2", {
					id: "team-logo-picker-title",
					children: "Teamlogo auswählen"
				})] }), /* @__PURE__ */ (0, U.jsx)("button", {
					className: "secondary-button",
					onClick: t,
					children: "Schließen"
				})]
			}),
			/* @__PURE__ */ (0, U.jsxs)("label", {
				className: "field team-logo-search",
				children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Team suchen" }), /* @__PURE__ */ (0, U.jsx)("input", {
					value: i,
					placeholder: "Name, Kurzname oder Teamcode",
					onChange: (e) => a(e.target.value),
					autoFocus: !0
				})]
			}),
			c ? /* @__PURE__ */ (0, U.jsx)("div", {
				className: "message-box error-box",
				role: "alert",
				children: c
			}) : null,
			o ? /* @__PURE__ */ (0, U.jsx)("p", {
				className: "empty-copy",
				children: "Teamlogos werden geladen …"
			}) : d.length === 0 ? /* @__PURE__ */ (0, U.jsx)("p", {
				className: "empty-copy",
				children: "Kein passendes Team gefunden."
			}) : /* @__PURE__ */ (0, U.jsx)("div", {
				className: "team-logo-grid",
				children: d.map((e) => {
					let t = Es(e), n = Ts(e);
					return /* @__PURE__ */ (0, U.jsxs)("button", {
						className: "team-logo-card",
						disabled: !n,
						onClick: () => f(e),
						children: [/* @__PURE__ */ (0, U.jsx)("span", {
							className: "team-logo-preview",
							"aria-hidden": "true",
							children: t ? /* @__PURE__ */ (0, U.jsx)("img", {
								src: t,
								alt: "",
								loading: "lazy"
							}) : e.logoUploaded ? /* @__PURE__ */ (0, U.jsx)("span", { children: "LOGO" }) : /* @__PURE__ */ (0, U.jsx)("span", { children: "–" })
						}), /* @__PURE__ */ (0, U.jsxs)("span", {
							className: "team-logo-copy",
							children: [
								/* @__PURE__ */ (0, U.jsx)("strong", { children: e.shortName || e.name }),
								/* @__PURE__ */ (0, U.jsxs)("small", { children: [e.name, e.teamCode ? ` · ${e.teamCode}` : ""] }),
								/* @__PURE__ */ (0, U.jsx)("small", { children: n ? e.homeClub ? "Heimverein" : "Auswählen" : "Kein Logo hinterlegt" })
							]
						})]
					}, e.id);
				})
			})
		]
	});
}
//#endregion
//#region src/state/editor-state.ts
function Ms(e, t = !1) {
	return e === "saving" || t;
}
function Ns(e) {
	return e === "dirty" || e === "error" || e === "conflict";
}
function Ps(e, t) {
	return Ms(e) ? !1 : !Ns(e) || t();
}
function Fs(e) {
	return e.undoStack.length > 0 && !Ms(e.status);
}
function Is(e) {
	return e.redoStack.length > 0 && !Ms(e.status);
}
function Ls(e) {
	return {
		draftId: e.id,
		title: e.title,
		document: e.document,
		version: e.version,
		createdAt: e.createdAt,
		updatedAt: e.updatedAt,
		status: "saved",
		undoStack: [],
		redoStack: []
	};
}
function Rs(e, t) {
	switch (t.type) {
		case "load": return Ls(t.draft);
		case "titleChanged": {
			if (Ms(e.status) || t.title === e.title) return e;
			let n = Bo(e.document, t.title);
			return zs(e, {
				title: t.title,
				document: n
			});
		}
		case "documentChanged": return Ms(e.status) || t.document === e.document ? e : zs(e, { document: t.document }, t.selectedElementId);
		case "textAdded": {
			if (Ms(e.status)) return e;
			let n = Io(e.document, t.idFactory), r = n.elements.at(-1)?.id ?? e.selectedElementId;
			return zs(e, { document: n }, r);
		}
		case "shapeAdded": {
			if (Ms(e.status)) return e;
			let n = zo(e.document, t.shape, t.idFactory), r = n.elements.at(-1)?.id ?? e.selectedElementId;
			return zs(e, { document: n }, r);
		}
		case "elementSelected": return {
			...e,
			selectedElementId: t.elementId
		};
		case "undo": return Bs(e, "undo");
		case "redo": return Bs(e, "redo");
		case "saveStarted": return {
			...e,
			status: "saving",
			message: void 0
		};
		case "saveSucceeded": return {
			...e,
			draftId: t.draft.id,
			title: t.draft.title,
			document: t.draft.document,
			version: t.draft.version,
			createdAt: t.draft.createdAt,
			updatedAt: t.draft.updatedAt,
			status: "saved",
			message: void 0
		};
		case "saveFailed":
		case "reloadFailed": return {
			...e,
			status: "error",
			message: t.message
		};
		case "conflict": return {
			...e,
			status: "conflict",
			message: t.message
		};
	}
}
function zs(e, t, n = e.selectedElementId) {
	let r = Vs(e), i = [...e.undoStack, r].slice(-100), a = e.status === "conflict";
	return {
		...e,
		...t,
		selectedElementId: n === null ? void 0 : n,
		undoStack: i,
		redoStack: [],
		status: a ? "conflict" : "dirty",
		message: a ? e.message : void 0
	};
}
function Bs(e, t) {
	if (Ms(e.status)) return e;
	let n = t === "undo" ? e.undoStack : e.redoStack;
	if (n.length === 0) return e;
	let r = n[n.length - 1], i = Vs(e), a = n.slice(0, -1);
	return {
		...e,
		title: r.title,
		document: r.document,
		undoStack: t === "undo" ? a : [...e.undoStack, i].slice(-100),
		redoStack: t === "undo" ? [...e.redoStack, i].slice(-100) : a,
		selectedElementId: Hs(r.document, e.selectedElementId) ? e.selectedElementId : void 0,
		status: e.status === "conflict" ? "conflict" : "dirty",
		message: e.status === "conflict" ? e.message : void 0
	};
}
function Vs(e) {
	return {
		title: e.title,
		document: e.document
	};
}
function Hs(e, t) {
	if (!t) return !1;
	let n = (e) => e.some((e) => e.id === t || e.type === "group" && n(e.children));
	return n(e.elements);
}
//#endregion
//#region src/components/DraftEditor.tsx
function Us(e) {
	let t = /* @__PURE__ */ new Set(), n = (e) => {
		e.forEach((e) => {
			e.type === "group" ? n(e.children) : (e.type === "image" || e.type === "logo" || e.type === "background") && e.mediaRef?.source === "library" && t.add(e.mediaRef.mediaId);
		});
	};
	return n(e), [...t];
}
var Ws = {
	saved: "Gespeichert",
	dirty: "Ungespeicherte Änderung",
	saving: "Speichert …",
	error: "Fehler beim Speichern",
	conflict: "Versionskonflikt"
}, Gs = {
	text: "Text",
	shape: "Form",
	image: "Bild",
	logo: "Logo",
	background: "Hintergrund",
	group: "Gruppe"
};
function Ks({ draft: e, onDraftChanged: t, onClose: n, onTemplateCreated: r, persistence: i, editorLabel: a = "Grafikeditor", bindingContext: o }) {
	let [s, c] = (0, l.useReducer)(Rs, e, Ls), [u, d] = (0, l.useState)(!1), [f, p] = (0, l.useState)([]), [m, h] = (0, l.useState)("preview"), [g, _] = (0, l.useState)(!1), [v, y] = (0, l.useState)(!1), [b, x] = (0, l.useState)(!1), [S, ee] = (0, l.useState)(e.title), [te, C] = (0, l.useState)("Allgemein"), [ne, w] = (0, l.useState)(""), [re, ie] = (0, l.useState)(!1), [ae, oe] = (0, l.useState)(null), T = (0, l.useRef)(!1), [se, ce] = (0, l.useState)(null), [le, ue] = (0, l.useState)(null), [de, fe] = (0, l.useState)(!1), [pe, me] = (0, l.useState)({}), he = (0, l.useRef)({}), ge = (0, l.useRef)(null), _e = (0, l.useRef)(null), ve = (0, l.useRef)(null), ye = (0, l.useRef)(null), be = (0, l.useRef)(!1), E = Ms(s.status, u);
	(0, l.useEffect)(() => {
		e.id !== s.draftId && c({
			type: "load",
			draft: e
		});
	}, [e, s.draftId]);
	let xe = (0, l.useMemo)(() => wo(s.document, o, pe), [
		s.document,
		o,
		pe
	]), D = (0, l.useMemo)(() => s.selectedElementId ? Vo(s.document.elements, s.selectedElementId) : null, [s.document.elements, s.selectedElementId]), Se = (0, l.useMemo)(() => f.map((e) => Vo(s.document.elements, e)).filter((e) => !!e), [s.document.elements, f]), O = (0, l.useMemo)(() => Qs(s.document.elements), [s.document.elements]);
	(0, l.useEffect)(() => {
		let e = !1, t = Us(s.document.elements).filter((e) => !he.current[e]);
		return Promise.all(t.map(async (t) => {
			try {
				let n = await fs(t);
				if (e) {
					URL.revokeObjectURL(n);
					return;
				}
				he.current[t] = n, me((e) => ({
					...e,
					[t]: n
				}));
			} catch (e) {
				console.error("Draft media preview failed", e);
			}
		})), () => {
			e = !0;
		};
	}, [s.document.elements]), (0, l.useEffect)(() => () => {
		Object.values(he.current).forEach((e) => URL.revokeObjectURL(e));
	}, []), (0, l.useEffect)(() => {
		if (!s.selectedElementId) {
			f.length > 0 && p([]);
			return;
		}
		f.includes(s.selectedElementId) || p([s.selectedElementId]);
	}, [s.selectedElementId]), (0, l.useEffect)(() => {
		let e = ge.current;
		e && e.querySelectorAll("[data-pd-id]").forEach((e) => {
			f.includes(e.getAttribute("data-pd-id") ?? "") ? e.setAttribute("data-pd-selected", "true") : e.removeAttribute("data-pd-selected");
		});
	}, [xe, f]), (0, l.useEffect)(() => {
		let e = (e) => {
			if (!_s(e)) return;
			let t = e.ctrlKey || e.metaKey;
			if (t && e.key.toLowerCase() === "g") {
				e.preventDefault(), e.shiftKey ? Oe() : De();
				return;
			}
			if (t && e.key.toLowerCase() === "z") {
				e.preventDefault(), c({ type: e.shiftKey ? "redo" : "undo" });
				return;
			}
			if (t && e.key.toLowerCase() === "y") {
				e.preventDefault(), c({ type: "redo" });
				return;
			}
			if ((e.key === "Delete" || e.key === "Backspace") && D && !D.locked && !D.binding?.protected && !E) {
				e.preventDefault(), Me();
				return;
			}
			if (D && f.length === 1 && !D.locked && !E && [
				"ArrowLeft",
				"ArrowRight",
				"ArrowUp",
				"ArrowDown"
			].includes(e.key)) {
				e.preventDefault();
				let t = e.shiftKey ? 10 : 1, n = e.key === "ArrowLeft" ? -t : e.key === "ArrowRight" ? t : 0, r = e.key === "ArrowUp" ? -t : e.key === "ArrowDown" ? t : 0, i = Ko(s.document, D.id, n, r);
				c({
					type: "documentChanged",
					document: i,
					selectedElementId: D.id
				});
			}
		};
		return window.addEventListener("keydown", e), () => window.removeEventListener("keydown", e);
	});
	let k = async () => {
		if (!(E || be.current)) {
			if (!s.title.trim()) {
				c({
					type: "saveFailed",
					message: "Bitte einen Titel eingeben."
				});
				return;
			}
			be.current = !0, c({ type: "saveStarted" });
			try {
				let e = i ? await i.save({
					id: s.draftId,
					title: s.title.trim(),
					document: s.document,
					expectedVersion: s.version
				}) : await z.saveDraft({
					draftId: s.draftId,
					title: s.title.trim(),
					document: s.document,
					expectedVersion: s.version
				});
				c({
					type: "saveSucceeded",
					draft: e
				}), t(e);
			} catch (e) {
				console.error(`${i?.logLabel ?? "Generator draft"} save failed`, e), Xa(e) ? c({
					type: "conflict",
					message: i?.conflictMessage ?? "Dieser Entwurf wurde zwischenzeitlich geändert. Lade die aktuelle Version neu; deine lokale Änderung wird nicht automatisch überschrieben."
				}) : c({
					type: "saveFailed",
					message: B(e)
				});
			} finally {
				be.current = !1;
			}
		}
	};
	(0, l.useEffect)(() => {
		if (s.status !== "dirty" || u || !s.title.trim()) return;
		let e = window.setTimeout(() => {
			k();
		}, 1400);
		return () => window.clearTimeout(e);
	}, [
		s.status,
		s.title,
		s.document,
		s.version,
		u
	]), (0, l.useEffect)(() => {
		let e = () => {
			s.status === "dirty" && !u && s.title.trim() && k();
		}, t = () => {
			document.visibilityState === "hidden" && e();
		}, n = () => {
			e();
		}, r = (t) => {
			(s.status === "saving" || Ns(s.status)) && (e(), t.preventDefault(), t.returnValue = "");
		};
		return document.addEventListener("visibilitychange", t), window.addEventListener("pagehide", n), window.addEventListener("beforeunload", r), () => {
			document.removeEventListener("visibilitychange", t), window.removeEventListener("pagehide", n), window.removeEventListener("beforeunload", r);
		};
	}, [
		s.status,
		s.title,
		s.document,
		s.version,
		u
	]);
	let Ce = async () => {
		d(!0);
		try {
			let e = i ? await i.reload(s.draftId) : await z.getDraft(s.draftId);
			c({
				type: "load",
				draft: e
			}), t(e);
		} catch (e) {
			console.error(`${i?.logLabel ?? "Generator draft"} reload failed`, e), c({
				type: "reloadFailed",
				message: B(e)
			});
		} finally {
			d(!1);
		}
	}, we = () => {
		E || Ps(s.status, () => window.confirm("Lokale ungespeicherte Änderungen verwerfen und die Serverversion neu laden?")) && Ce();
	}, Te = () => {
		E || Ps(s.status, () => window.confirm("Ungespeicherte Änderungen verwerfen und schließen?")) && n();
	}, A = (e, t = !1) => {
		if (ce(null), !e) {
			p([]), c({
				type: "elementSelected",
				elementId: void 0
			});
			return;
		}
		if (!t) {
			p([e]), c({
				type: "elementSelected",
				elementId: e
			});
			return;
		}
		let n = f.includes(e), r = n ? f.filter((t) => t !== e) : [...f, e];
		p(r), c({
			type: "elementSelected",
			elementId: n ? s.selectedElementId === e ? r.at(-1) : s.selectedElementId : e
		});
	}, Ee = (e) => {
		if (!E) {
			if (le === "replace" && D?.binding?.protected) {
				ce("Diese Systembindung bleibt mit der zentralen Datenquelle verknüpft."), ue(null);
				return;
			}
			if (le === "replace" && D?.type === "logo") {
				let t = Ho(s.document, D.id, (t) => t.type === "logo" ? {
					...t,
					name: `${e.name} Logo`,
					mediaId: e.mediaId,
					href: e.href,
					preserveAspectRatio: "xMidYMid meet"
				} : t);
				p([D.id]), c({
					type: "documentChanged",
					document: t,
					selectedElementId: D.id
				});
			} else {
				let t = Lo(s.document, e);
				p([t.elementId]), c({
					type: "documentChanged",
					document: t.document,
					selectedElementId: t.elementId
				});
			}
			ue(null);
		}
	}, j = (e) => {
		if (E) return;
		let t = Ro(s.document, e);
		p([t.elementId]), c({
			type: "documentChanged",
			document: t.document,
			selectedElementId: t.elementId
		}), fe(!1);
	}, De = () => {
		if (E || f.length < 2) return;
		if (Se.some((e) => e.binding?.protected)) {
			ce("Systemgebundene Elemente bleiben einzeln, damit ihre Datenbindung eindeutig bleibt.");
			return;
		}
		let e = Wo(s.document, f);
		if (!e.groupId) {
			ce("Zum Gruppieren müssen die ausgewählten Elemente auf derselben Ebene liegen.");
			return;
		}
		p([e.groupId]), ce(null), c({
			type: "documentChanged",
			document: e.document,
			selectedElementId: e.groupId
		});
	}, Oe = () => {
		if (E || !D || D.type !== "group") return;
		let e = Go(s.document, D.id);
		e.childIds.length !== 0 && (p(e.childIds), ce(null), c({
			type: "documentChanged",
			document: e.document,
			selectedElementId: e.childIds.at(-1) ?? null
		}));
	}, ke = (e) => {
		if (!D || E) return;
		let t = Ho(s.document, D.id, e);
		c({
			type: "documentChanged",
			document: t,
			selectedElementId: D.id
		});
	}, Ae = (e, t) => {
		if (D?.type === "group") {
			if (e !== "x" && e !== "y") return;
			let n = $s(t, D[e]), r = Ko(s.document, D.id, e === "x" ? n - D.x : 0, e === "y" ? n - D.y : 0);
			c({
				type: "documentChanged",
				document: r,
				selectedElementId: D.id
			});
			return;
		}
		ke((n) => ({
			...n,
			[e]: e === "width" || e === "height" ? Math.max(1, $s(t, n[e])) : $s(t, n[e])
		}));
	}, je = (e) => {
		ke((t) => ({
			...t,
			style: {
				...t.style,
				...e
			}
		}));
	}, Me = () => {
		if (!D || f.length !== 1 || D.locked || D.binding?.protected || E) return;
		let e = V(s.document, D.id);
		p([]), c({
			type: "documentChanged",
			document: e,
			selectedElementId: null
		});
	}, Ne = () => {
		if (!D || D.binding?.protected || E) return;
		let e = H(s.document, D.id);
		e.duplicatedId && (p([e.duplicatedId]), c({
			type: "documentChanged",
			document: e.document,
			selectedElementId: e.duplicatedId
		}));
	}, Pe = (e) => {
		if (!D || D.locked || E) return;
		let t = Uo(s.document, D.id, e);
		c({
			type: "documentChanged",
			document: t,
			selectedElementId: D.id
		});
	}, Fe = (e) => {
		if (!D || f.length !== 1 || D.locked || E) return;
		let t = s.document.format, n = D.x, r = D.y;
		switch (e) {
			case "left":
				n = 0;
				break;
			case "centerX":
				n = Math.round((t.width - D.width) / 2);
				break;
			case "right":
				n = Math.round(t.width - D.width);
				break;
			case "top":
				r = 0;
				break;
			case "centerY":
				r = Math.round((t.height - D.height) / 2);
				break;
			case "bottom": r = Math.round(t.height - D.height);
		}
		let i = Ko(s.document, D.id, n - D.x, r - D.y);
		c({
			type: "documentChanged",
			document: i,
			selectedElementId: D.id
		});
	}, Ie = (e, t) => {
		if (!D || f.length !== 1 || D.type === "group" || D.locked || E) return;
		let n = ge.current?.querySelector("svg");
		if (!(n instanceof SVGSVGElement)) return;
		let r = n.getBoundingClientRect();
		r.width <= 0 || r.height <= 0 || (ye.current = {
			pointerId: e.pointerId,
			elementId: D.id,
			direction: t,
			startClientX: e.clientX,
			startClientY: e.clientY,
			startX: D.x,
			startY: D.y,
			startWidth: D.width,
			startHeight: D.height,
			latestX: D.x,
			latestY: D.y,
			latestWidth: D.width,
			latestHeight: D.height,
			scaleX: s.document.format.width / r.width,
			scaleY: s.document.format.height / r.height
		}, e.currentTarget.setPointerCapture(e.pointerId), e.stopPropagation(), e.preventDefault());
	}, Le = (e) => {
		let t = _e.current;
		if (!t) return;
		let n = s.document.format.width, r = s.document.format.height;
		t.style.left = `${e.latestX / n * 100}%`, t.style.top = `${e.latestY / r * 100}%`, t.style.width = `${e.latestWidth / n * 100}%`, t.style.height = `${e.latestHeight / r * 100}%`;
	}, Re = (e) => {
		let t = ye.current;
		if (!t || t.pointerId !== e.pointerId) return !1;
		let n = (e.clientX - t.startClientX) * t.scaleX, r = (e.clientY - t.startClientY) * t.scaleY, i = t.startX, a = t.startY, o = t.startWidth, s = t.startHeight;
		return t.direction.includes("e") && (o = Math.max(16, Math.round(t.startWidth + n))), t.direction.includes("s") && (s = Math.max(16, Math.round(t.startHeight + r))), t.direction.includes("w") && (i = Math.min(Math.round(t.startX + n), t.startX + t.startWidth - 16), o = t.startWidth - (i - t.startX)), t.direction.includes("n") && (a = Math.min(Math.round(t.startY + r), t.startY + t.startHeight - 16), s = t.startHeight - (a - t.startY)), t.latestX = i, t.latestY = a, t.latestWidth = o, t.latestHeight = s, Le(t), !0;
	}, ze = (e, t) => {
		let n = ye.current;
		if (!n || n.pointerId !== e) return !1;
		if (ye.current = null, !t) {
			let e = _e.current;
			if (e) {
				let t = s.document.format.width, r = s.document.format.height;
				e.style.left = `${n.startX / t * 100}%`, e.style.top = `${n.startY / r * 100}%`, e.style.width = `${n.startWidth / t * 100}%`, e.style.height = `${n.startHeight / r * 100}%`;
			}
			return !0;
		}
		if (n.latestX === n.startX && n.latestY === n.startY && n.latestWidth === n.startWidth && n.latestHeight === n.startHeight) return !0;
		let r = Ho(s.document, n.elementId, (e) => ({
			...e,
			x: n.latestX,
			y: n.latestY,
			width: n.latestWidth,
			height: n.latestHeight
		}));
		return c({
			type: "documentChanged",
			document: r,
			selectedElementId: n.elementId
		}), !0;
	}, Be = (e) => {
		if (e.button !== 0 || E) return;
		let t = e.target;
		if (!(t instanceof Element)) return;
		let n = t.closest("[data-pd-id]"), r = n?.getAttribute("data-pd-id") ?? void 0;
		if (D?.type === "group" && f.length === 1 && n?.closest(`[data-pd-id="${CSS.escape(D.id)}"]`)) {
			let e = n.closest(`[data-pd-id="${CSS.escape(D.id)}"]`);
			e && (n = e, r = D.id);
		}
		let i = e.shiftKey || e.ctrlKey || e.metaKey;
		if (A(r, i), i || !r || !n) return;
		let a = Vo(s.document.elements, r), o = ge.current?.querySelector("svg");
		if (!a || a.locked || !(o instanceof SVGSVGElement)) return;
		let c = o.getBoundingClientRect();
		c.width <= 0 || c.height <= 0 || (ve.current = {
			pointerId: e.pointerId,
			elementId: r,
			startClientX: e.clientX,
			startClientY: e.clientY,
			startElementX: a.x,
			startElementY: a.y,
			latestElementX: a.x,
			latestElementY: a.y,
			scaleX: s.document.format.width / c.width,
			scaleY: s.document.format.height / c.height,
			svgNode: n,
			originalTransform: n.getAttribute("transform")
		}, e.currentTarget.setPointerCapture(e.pointerId), e.preventDefault());
	}, Ve = (e) => {
		if (Re(e)) return;
		let t = ve.current;
		if (!t || t.pointerId !== e.pointerId) return;
		let n = (e.clientX - t.startClientX) * t.scaleX, r = (e.clientY - t.startClientY) * t.scaleY;
		t.latestElementX = Math.round(t.startElementX + n), t.latestElementY = Math.round(t.startElementY + r);
		let i = `translate(${t.latestElementX - t.startElementX} ${t.latestElementY - t.startElementY})`;
		t.svgNode.setAttribute("transform", t.originalTransform ? `${i} ${t.originalTransform}` : i);
	}, He = (e, t, n) => {
		let r = ve.current;
		if (!r || r.pointerId !== t || (r.originalTransform ? r.svgNode.setAttribute("transform", r.originalTransform) : r.svgNode.removeAttribute("transform"), e.hasPointerCapture(t) && e.releasePointerCapture(t), ve.current = null, !n || r.latestElementX === r.startElementX && r.latestElementY === r.startElementY)) return;
		let i = Ko(s.document, r.elementId, r.latestElementX - r.startElementX, r.latestElementY - r.startElementY);
		c({
			type: "documentChanged",
			document: i,
			selectedElementId: r.elementId
		});
	}, Ue = (e) => {
		ze(e.pointerId, !0) || He(e.currentTarget, e.pointerId, !0);
	}, We = (e) => {
		ze(e.pointerId, !1) || He(e.currentTarget, e.pointerId, !1);
	}, Ge = async (e) => {
		e.preventDefault();
		let t = S.trim(), n = te.trim();
		if (!(!r || E || T.current)) {
			if (!t || !n) {
				oe("Bitte Vorlagenname und Kategorie eingeben.");
				return;
			}
			T.current = !0, ie(!0), oe(null);
			try {
				r(await z.createTemplate({
					name: t,
					category: n,
					description: ne.trim(),
					document: {
						...s.document,
						title: t
					}
				}));
			} catch (e) {
				console.error("Generator create template from graphic failed", e), oe(B(e));
			} finally {
				T.current = !1, ie(!1);
			}
		}
	}, Ke = (s.status === "dirty" || s.status === "error") && !!s.title.trim();
	return /* @__PURE__ */ (0, U.jsxs)("section", {
		className: "editor",
		"aria-labelledby": "editor-title",
		children: [
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "workspace-head editor-head",
				children: [/* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("p", {
					className: "panel-label",
					children: a
				}), /* @__PURE__ */ (0, U.jsx)("h2", {
					id: "editor-title",
					children: s.title || "Unbenannter Entwurf"
				})] }), /* @__PURE__ */ (0, U.jsxs)("div", {
					className: "editor-actions",
					children: [
						/* @__PURE__ */ (0, U.jsx)("span", {
							className: `save-state save-state-${s.status}`,
							role: "status",
							children: u ? "Lädt …" : Ws[s.status]
						}),
						/* @__PURE__ */ (0, U.jsx)("button", {
							className: "secondary-button",
							onClick: we,
							disabled: E,
							children: "Neu laden"
						}),
						/* @__PURE__ */ (0, U.jsx)("button", {
							className: "primary-button",
							onClick: () => void k(),
							disabled: !Ke || E,
							children: a === "Vorlageneditor" ? "Vorlagenentwurf speichern" : "Speichern"
						}),
						/* @__PURE__ */ (0, U.jsx)("button", {
							className: "secondary-button",
							onClick: Te,
							disabled: E,
							children: "Schließen"
						})
					]
				})]
			}),
			s.status === "conflict" ? /* @__PURE__ */ (0, U.jsxs)("div", {
				className: "message-box conflict-box",
				role: "alert",
				children: [
					/* @__PURE__ */ (0, U.jsx)("strong", { children: "Versionskonflikt" }),
					/* @__PURE__ */ (0, U.jsx)("p", { children: s.message }),
					/* @__PURE__ */ (0, U.jsx)("button", {
						className: "primary-button",
						onClick: we,
						disabled: E,
						children: "Neu laden"
					})
				]
			}) : s.message ? /* @__PURE__ */ (0, U.jsx)("div", {
				className: "message-box error-box",
				role: "alert",
				children: s.message
			}) : null,
			r && !i ? /* @__PURE__ */ (0, U.jsxs)("section", {
				className: "editor-template-copy",
				"aria-label": "Grafik als Vorlage speichern",
				children: [/* @__PURE__ */ (0, U.jsx)("button", {
					type: "button",
					className: "secondary-button compact-button",
					"aria-controls": "editor-template-copy-form",
					"aria-expanded": b,
					disabled: E || re,
					onClick: () => {
						b || (ee(s.title), oe(null)), x((e) => !e);
					},
					children: "Als neue Vorlage speichern"
				}), b ? /* @__PURE__ */ (0, U.jsxs)("form", {
					id: "editor-template-copy-form",
					className: "editor-template-copy-form",
					onSubmit: (e) => void Ge(e),
					children: [
						/* @__PURE__ */ (0, U.jsxs)("p", { children: [
							"Legt eine ",
							/* @__PURE__ */ (0, U.jsx)("strong", { children: "neue, unveröffentlichte Vorlage" }),
							" aus dieser Grafik an. Die ursprüngliche Grafik und veröffentlichte Liveticker-Vorlagen bleiben unverändert. Auch noch nicht in der Grafik gespeicherte Änderungen werden übernommen."
						] }),
						/* @__PURE__ */ (0, U.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Vorlagenname" }), /* @__PURE__ */ (0, U.jsx)("input", {
								required: !0,
								maxLength: 160,
								value: S,
								onChange: (e) => ee(e.target.value)
							})]
						}),
						/* @__PURE__ */ (0, U.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Kategorie" }), /* @__PURE__ */ (0, U.jsx)("input", {
								required: !0,
								maxLength: 80,
								value: te,
								onChange: (e) => C(e.target.value)
							})]
						}),
						/* @__PURE__ */ (0, U.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Beschreibung (optional)" }), /* @__PURE__ */ (0, U.jsx)("textarea", {
								maxLength: 2e3,
								rows: 2,
								value: ne,
								onChange: (e) => w(e.target.value)
							})]
						}),
						ae ? /* @__PURE__ */ (0, U.jsx)("p", {
							role: "alert",
							className: "error-text",
							children: ae
						}) : null,
						/* @__PURE__ */ (0, U.jsxs)("div", {
							className: "editor-template-copy-actions",
							children: [/* @__PURE__ */ (0, U.jsx)("button", {
								className: "primary-button",
								type: "submit",
								disabled: E || re,
								children: re ? "Vorlage wird angelegt …" : "Neue Vorlage anlegen"
							}), /* @__PURE__ */ (0, U.jsx)("button", {
								className: "secondary-button",
								type: "button",
								disabled: re,
								onClick: () => x(!1),
								children: "Abbrechen"
							})]
						})
					]
				}) : null]
			}) : null,
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "editor-mobile-controls",
				"aria-label": "Weitere Editorfunktionen",
				children: [/* @__PURE__ */ (0, U.jsx)("button", {
					type: "button",
					className: "secondary-button",
					"aria-controls": "editor-mobile-export",
					"aria-expanded": g,
					onClick: () => _((e) => !e),
					children: g ? "Export schließen" : "PNG exportieren"
				}), /* @__PURE__ */ (0, U.jsx)("button", {
					type: "button",
					className: "secondary-button",
					"aria-controls": "editor-mobile-tools",
					"aria-expanded": v,
					onClick: () => y((e) => !e),
					children: v ? "Werkzeuge schließen" : "Werkzeuge"
				})]
			}),
			/* @__PURE__ */ (0, U.jsx)("div", {
				id: "editor-mobile-export",
				className: `editor-mobile-disclosure ${g ? "is-open" : ""}`,
				children: /* @__PURE__ */ (0, U.jsx)(ws, {
					draftId: s.draftId,
					version: s.version,
					editorStatus: s.status,
					bindingContext: o
				})
			}),
			/* @__PURE__ */ (0, U.jsx)("div", {
				id: "editor-mobile-tools",
				className: `editor-mobile-disclosure ${v ? "is-open" : ""}`,
				children: /* @__PURE__ */ (0, U.jsxs)("div", {
					className: "editor-toolbar",
					"aria-label": "Editor-Werkzeuge",
					children: [/* @__PURE__ */ (0, U.jsxs)("div", {
						className: "toolbar-group",
						children: [
							/* @__PURE__ */ (0, U.jsx)("button", {
								className: "secondary-button compact-button",
								disabled: E,
								onClick: () => c({ type: "textAdded" }),
								children: "+ Text"
							}),
							/* @__PURE__ */ (0, U.jsx)("button", {
								className: "secondary-button compact-button",
								disabled: E,
								onClick: () => c({
									type: "shapeAdded",
									shape: "rect"
								}),
								children: "+ Rechteck"
							}),
							/* @__PURE__ */ (0, U.jsx)("button", {
								className: "secondary-button compact-button",
								disabled: E,
								onClick: () => c({
									type: "shapeAdded",
									shape: "ellipse"
								}),
								children: "+ Ellipse"
							}),
							/* @__PURE__ */ (0, U.jsx)("button", {
								className: "secondary-button compact-button",
								disabled: E,
								onClick: () => ue("add"),
								children: "+ Teamlogo"
							}),
							/* @__PURE__ */ (0, U.jsx)("button", {
								className: "primary-button compact-button",
								disabled: E,
								onClick: () => fe(!0),
								children: "+ Medien"
							})
						]
					}), /* @__PURE__ */ (0, U.jsxs)("div", {
						className: "toolbar-group",
						children: [/* @__PURE__ */ (0, U.jsx)("button", {
							className: "secondary-button compact-button",
							disabled: !Fs(s) || E,
							onClick: () => c({ type: "undo" }),
							title: "Rückgängig (Strg/Cmd + Z)",
							children: "Rückgängig"
						}), /* @__PURE__ */ (0, U.jsx)("button", {
							className: "secondary-button compact-button",
							disabled: !Is(s) || E,
							onClick: () => c({ type: "redo" }),
							title: "Wiederholen (Strg/Cmd + Umschalt + Z)",
							children: "Wiederholen"
						})]
					})]
				})
			}),
			le ? /* @__PURE__ */ (0, U.jsx)(js, {
				onSelect: Ee,
				onClose: () => ue(null)
			}) : null,
			de ? /* @__PURE__ */ (0, U.jsx)(bs, {
				onSelect: j,
				onClose: () => fe(!1)
			}) : null,
			/* @__PURE__ */ (0, U.jsx)("nav", {
				className: "editor-mobile-tabs",
				"aria-label": "Grafikeditor-Bereiche",
				children: [
					["preview", "Vorschau"],
					["layers", `Ebenen (${O.length})`],
					["properties", "Bearbeiten"]
				].map(([e, t]) => /* @__PURE__ */ (0, U.jsx)("button", {
					type: "button",
					className: `editor-mobile-tab ${m === e ? "is-active" : ""}`,
					"aria-current": m === e ? "page" : void 0,
					onClick: () => h(e),
					children: t
				}, e))
			}),
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "editor-grid editor-grid-three",
				"data-mobile-panel": m,
				children: [
					/* @__PURE__ */ (0, U.jsxs)("aside", {
						className: "editor-sidebar",
						id: "editor-layers-panel",
						children: [
							/* @__PURE__ */ (0, U.jsxs)("label", {
								className: "field",
								children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Draft-Titel" }), /* @__PURE__ */ (0, U.jsx)("input", {
									value: s.title,
									maxLength: 160,
									disabled: E,
									onChange: (e) => c({
										type: "titleChanged",
										title: e.target.value
									})
								})]
							}),
							/* @__PURE__ */ (0, U.jsxs)("div", {
								className: "sidebar-section",
								children: [/* @__PURE__ */ (0, U.jsx)("div", {
									className: "field-group-head",
									children: /* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("span", {
										className: "field-label",
										children: "Ebenen"
									}), /* @__PURE__ */ (0, U.jsxs)("small", { children: [O.length, " Element(e)"] })] })
								}), O.length === 0 ? /* @__PURE__ */ (0, U.jsx)("p", {
									className: "empty-copy",
									children: "Noch keine Elemente vorhanden."
								}) : /* @__PURE__ */ (0, U.jsx)("div", {
									className: "layer-list",
									children: O.map(({ element: e, depth: t }) => /* @__PURE__ */ (0, U.jsxs)("button", {
										className: f.includes(e.id) ? "layer-row layer-row-selected" : "layer-row",
										style: { paddingLeft: `${12 + t * 16}px` },
										onClick: (t) => {
											A(e.id, t.shiftKey || t.ctrlKey || t.metaKey), h("properties");
										},
										children: [/* @__PURE__ */ (0, U.jsx)("span", { children: e.name || Gs[e.type] }), /* @__PURE__ */ (0, U.jsxs)("small", { children: [e.locked ? "🔒 " : "", Gs[e.type]] })]
									}, e.id))
								})]
							}),
							/* @__PURE__ */ (0, U.jsxs)("dl", {
								className: "draft-meta",
								children: [
									/* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("dt", { children: "Version" }), /* @__PURE__ */ (0, U.jsx)("dd", { children: s.version })] }),
									/* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("dt", { children: "Schema" }), /* @__PURE__ */ (0, U.jsx)("dd", { children: s.document.schemaVersion })] }),
									/* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("dt", { children: "Format" }), /* @__PURE__ */ (0, U.jsxs)("dd", { children: [
										s.document.format.width,
										" × ",
										s.document.format.height
									] })] })
								]
							})
						]
					}),
					/* @__PURE__ */ (0, U.jsx)("div", {
						ref: ge,
						className: "canvas-stage editor-canvas",
						id: "editor-canvas-panel",
						onPointerDown: Be,
						onPointerMove: Ve,
						onPointerUp: Ue,
						onPointerCancel: We,
						role: "presentation",
						children: /* @__PURE__ */ (0, U.jsxs)("div", {
							className: "canvas-preview dynamic-preview canvas-preview-frame",
							style: { aspectRatio: `${s.document.format.width} / ${s.document.format.height}` },
							children: [/* @__PURE__ */ (0, U.jsx)("div", {
								className: "canvas-svg-host",
								dangerouslySetInnerHTML: { __html: xe }
							}), D && f.length === 1 ? /* @__PURE__ */ (0, U.jsx)("div", {
								ref: _e,
								className: "selection-overlay",
								style: {
									left: `${D.x / s.document.format.width * 100}%`,
									top: `${D.y / s.document.format.height * 100}%`,
									width: `${D.width / s.document.format.width * 100}%`,
									height: `${D.height / s.document.format.height * 100}%`
								},
								"aria-hidden": "true",
								children: D.type === "group" ? null : [
									"nw",
									"ne",
									"sw",
									"se"
								].map((e) => /* @__PURE__ */ (0, U.jsx)("button", {
									type: "button",
									className: `resize-handle resize-handle-${e}`,
									disabled: E || !!D.locked,
									tabIndex: -1,
									onPointerDown: (t) => Ie(t, e),
									"aria-label": `Elementgröße ${e}`
								}, e))
							}) : null]
						})
					}),
					/* @__PURE__ */ (0, U.jsx)("aside", {
						className: "editor-sidebar inspector-sidebar",
						id: "editor-properties-panel",
						children: Se.length > 1 ? /* @__PURE__ */ (0, U.jsxs)("div", {
							className: "inspector multi-selection-inspector",
							children: [
								/* @__PURE__ */ (0, U.jsxs)("div", {
									className: "inspector-head",
									children: [/* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("p", {
										className: "panel-label",
										children: "Mehrfachauswahl"
									}), /* @__PURE__ */ (0, U.jsxs)("h3", { children: [Se.length, " Elemente"] })] }), /* @__PURE__ */ (0, U.jsx)("span", {
										className: "mode-badge",
										children: "Auswahl"
									})]
								}),
								/* @__PURE__ */ (0, U.jsx)("p", {
									className: "empty-copy",
									children: "Strg/Cmd- oder Shift-Klick fügt weitere Elemente zur Auswahl hinzu oder entfernt sie wieder."
								}),
								se ? /* @__PURE__ */ (0, U.jsx)("p", {
									className: "selection-message",
									children: se
								}) : null,
								/* @__PURE__ */ (0, U.jsx)("button", {
									className: "primary-button",
									disabled: E,
									onClick: De,
									title: "Gruppieren (Strg/Cmd + G)",
									children: "Gruppieren"
								})
							]
						}) : D ? /* @__PURE__ */ (0, U.jsx)(qs, {
							element: D,
							interactionLocked: E,
							onNameChange: (e) => ke((t) => ({
								...t,
								name: e
							})),
							onCommonNumberChange: Ae,
							onStyleChange: je,
							onElementChange: ke,
							bindingContext: o,
							onAlign: Fe,
							onUngroup: Oe,
							onChooseTeamLogo: () => ue("replace"),
							onDelete: Me,
							onDuplicate: Ne,
							onMove: Pe
						}) : /* @__PURE__ */ (0, U.jsxs)("div", {
							className: "inspector-empty",
							children: [
								/* @__PURE__ */ (0, U.jsx)("p", {
									className: "panel-label",
									children: "Eigenschaften"
								}),
								/* @__PURE__ */ (0, U.jsx)("h3", { children: "Element auswählen" }),
								/* @__PURE__ */ (0, U.jsx)("p", { children: "Klicke eine Ebene oder direkt ein Element in der Vorschau an." })
							]
						})
					})
				]
			})
		]
	});
}
function qs({ element: e, interactionLocked: t, onNameChange: n, onCommonNumberChange: r, onStyleChange: i, onElementChange: a, bindingContext: o, onAlign: s, onUngroup: c, onChooseTeamLogo: u, onDelete: d, onDuplicate: f, onMove: p }) {
	let [m, h] = (0, l.useState)(!1), g = t || !!e.locked, _ = !!e.binding?.protected, v = g || e.type === "group";
	return /* @__PURE__ */ (0, U.jsxs)("div", {
		className: `inspector ${e.type === "text" && !m ? "mobile-details-collapsed" : ""}`,
		children: [
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "inspector-head",
				children: [/* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("p", {
					className: "panel-label",
					children: "Eigenschaften"
				}), /* @__PURE__ */ (0, U.jsx)("h3", { children: e.name || Gs[e.type] })] }), /* @__PURE__ */ (0, U.jsx)("span", {
					className: "mode-badge",
					children: Gs[e.type]
				})]
			}),
			/* @__PURE__ */ (0, U.jsxs)("label", {
				className: "field",
				children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Name" }), /* @__PURE__ */ (0, U.jsx)("input", {
					value: e.name ?? "",
					disabled: g,
					onChange: (e) => n(e.target.value)
				})]
			}),
			/* @__PURE__ */ (0, U.jsxs)("label", {
				className: "switch-row inspector-lock",
				children: [/* @__PURE__ */ (0, U.jsx)("input", {
					type: "checkbox",
					checked: !!e.locked,
					disabled: t,
					onChange: (e) => a((t) => ({
						...t,
						locked: e.target.checked
					}))
				}), /* @__PURE__ */ (0, U.jsx)("span", { children: "Element sperren" })]
			}),
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "inspector-grid",
				children: [
					/* @__PURE__ */ (0, U.jsx)(Xs, {
						label: "X",
						value: e.x,
						disabled: g,
						onChange: (e) => r("x", e)
					}),
					/* @__PURE__ */ (0, U.jsx)(Xs, {
						label: "Y",
						value: e.y,
						disabled: g,
						onChange: (e) => r("y", e)
					}),
					/* @__PURE__ */ (0, U.jsx)(Xs, {
						label: "Breite",
						value: e.width,
						min: 1,
						disabled: v,
						onChange: (e) => r("width", e)
					}),
					/* @__PURE__ */ (0, U.jsx)(Xs, {
						label: "Höhe",
						value: e.height,
						min: 1,
						disabled: v,
						onChange: (e) => r("height", e)
					}),
					/* @__PURE__ */ (0, U.jsx)(Xs, {
						label: "Rotation",
						value: e.rotation,
						disabled: v,
						onChange: (e) => r("rotation", e)
					}),
					/* @__PURE__ */ (0, U.jsx)(Xs, {
						label: "Deckkraft",
						value: e.style?.opacity ?? 1,
						min: 0,
						max: 1,
						step: .05,
						disabled: g,
						onChange: (e) => i({ opacity: ec($s(e, 1), 0, 1) })
					})
				]
			}),
			e.type === "text" ? /* @__PURE__ */ (0, U.jsx)(Js, {
				element: e,
				disabled: g,
				onStyleChange: i,
				onElementChange: a,
				bindingContext: o
			}) : null,
			e.type === "text" ? /* @__PURE__ */ (0, U.jsx)("button", {
				type: "button",
				className: "secondary-button mobile-advanced-trigger",
				"aria-expanded": m,
				onClick: () => h((e) => !e),
				children: m ? "Weniger Einstellungen" : "Weitere Einstellungen: Position, Bindung und Ebenen"
			}) : null,
			e.type === "shape" ? /* @__PURE__ */ (0, U.jsx)(Ys, {
				element: e,
				disabled: g,
				onStyleChange: i,
				onElementChange: a
			}) : null,
			e.type === "logo" ? /* @__PURE__ */ (0, U.jsxs)("div", {
				className: "inspector-section",
				children: [
					/* @__PURE__ */ (0, U.jsx)("p", {
						className: "empty-copy",
						children: "Dieses Logo stammt aus der zentralen Team-/Logoquelle. Ein Wechsel ändert nur dieses Grafikelement und nicht die zentrale Teamverwaltung."
					}),
					/* @__PURE__ */ (0, U.jsx)("button", {
						className: "secondary-button",
						disabled: g || _,
						onClick: u,
						children: "Teamlogo wechseln"
					}),
					/* @__PURE__ */ (0, U.jsx)("small", {
						className: "media-id-copy",
						children: e.mediaId
					})
				]
			}) : null,
			e.type === "image" || e.type === "background" ? /* @__PURE__ */ (0, U.jsxs)("div", {
				className: "inspector-section",
				children: [/* @__PURE__ */ (0, U.jsxs)("p", {
					className: "empty-copy",
					children: [
						"Dieses ",
						e.type === "background" ? "Hintergrundbild" : "Bild",
						" ",
						"stammt aus der Medienbibliothek. Der Entwurf hält eine feste, reproduzierbare Version; Position, Größe und Deckkraft bleiben frei editierbar."
					]
				}), e.mediaRef ? /* @__PURE__ */ (0, U.jsxs)("small", { children: ["Version ", e.mediaRef.version] }) : null]
			}) : null,
			e.type === "group" ? /* @__PURE__ */ (0, U.jsxs)("div", {
				className: "inspector-section",
				children: [/* @__PURE__ */ (0, U.jsxs)("p", {
					className: "empty-copy",
					children: [e.children.length, " Elemente in dieser Gruppe. Die Gruppe kann als Einheit verschoben und ausgerichtet werden."]
				}), /* @__PURE__ */ (0, U.jsx)("button", {
					className: "secondary-button",
					disabled: t,
					onClick: c,
					title: "Gruppe auflösen (Strg/Cmd + Umschalt + G)",
					children: "Gruppe auflösen"
				})]
			}) : null,
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "inspector-section",
				children: [/* @__PURE__ */ (0, U.jsx)("span", {
					className: "field-label",
					children: "An Arbeitsfläche ausrichten"
				}), /* @__PURE__ */ (0, U.jsxs)("div", {
					className: "alignment-actions",
					children: [
						/* @__PURE__ */ (0, U.jsx)("button", {
							className: "secondary-button compact-button",
							disabled: g,
							onClick: () => s("left"),
							children: "Links"
						}),
						/* @__PURE__ */ (0, U.jsx)("button", {
							className: "secondary-button compact-button",
							disabled: g,
							onClick: () => s("centerX"),
							children: "Horizontal mittig"
						}),
						/* @__PURE__ */ (0, U.jsx)("button", {
							className: "secondary-button compact-button",
							disabled: g,
							onClick: () => s("right"),
							children: "Rechts"
						}),
						/* @__PURE__ */ (0, U.jsx)("button", {
							className: "secondary-button compact-button",
							disabled: g,
							onClick: () => s("top"),
							children: "Oben"
						}),
						/* @__PURE__ */ (0, U.jsx)("button", {
							className: "secondary-button compact-button",
							disabled: g,
							onClick: () => s("centerY"),
							children: "Vertikal mittig"
						}),
						/* @__PURE__ */ (0, U.jsx)("button", {
							className: "secondary-button compact-button",
							disabled: g,
							onClick: () => s("bottom"),
							children: "Unten"
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "inspector-actions",
				children: [
					/* @__PURE__ */ (0, U.jsx)("button", {
						className: "secondary-button compact-button",
						disabled: t || _,
						onClick: f,
						children: "Duplizieren"
					}),
					/* @__PURE__ */ (0, U.jsx)("button", {
						className: "secondary-button compact-button",
						disabled: g,
						onClick: () => p("backward"),
						children: "Ebene runter"
					}),
					/* @__PURE__ */ (0, U.jsx)("button", {
						className: "secondary-button compact-button",
						disabled: g,
						onClick: () => p("forward"),
						children: "Ebene hoch"
					}),
					/* @__PURE__ */ (0, U.jsx)("button", {
						className: "secondary-button compact-button danger-button",
						disabled: g || _,
						onClick: d,
						children: "Löschen"
					})
				]
			})
		]
	});
}
function Js({ element: e, disabled: t, onStyleChange: n, onElementChange: r, bindingContext: i }) {
	let a = e.binding?.source ?? "", o = e.binding?.key ?? "", s = !!e.binding?.protected, c = e.binding && i?.[e.binding.source] ? i[e.binding.source]?.[e.binding.key] : void 0, l = (e, t) => {
		r((n) => {
			if (n.type !== "text") return n;
			if (!e) {
				let { binding: e, ...t } = n;
				return t;
			}
			return {
				...n,
				binding: {
					key: t,
					source: e,
					lastSyncedValue: typeof c == "string" || typeof c == "number" ? c : n.binding?.lastSyncedValue
				}
			};
		});
	};
	return /* @__PURE__ */ (0, U.jsxs)("div", {
		className: "inspector-section text-inspector",
		children: [
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "binding-editor",
				children: [/* @__PURE__ */ (0, U.jsxs)("div", {
					className: "inspector-grid",
					children: [/* @__PURE__ */ (0, U.jsxs)("label", {
						className: "field",
						children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Datenquelle" }), /* @__PURE__ */ (0, U.jsxs)("select", {
							value: a,
							disabled: t || s,
							onChange: (e) => l(e.target.value, o),
							children: [
								/* @__PURE__ */ (0, U.jsx)("option", {
									value: "",
									children: "Keine Bindung"
								}),
								/* @__PURE__ */ (0, U.jsx)("option", {
									value: "package",
									children: "Paketweit"
								}),
								/* @__PURE__ */ (0, U.jsx)("option", {
									value: "central",
									children: "Zentral"
								}),
								/* @__PURE__ */ (0, U.jsx)("option", {
									value: "local",
									children: "Lokaler Override"
								})
							]
						})]
					}), /* @__PURE__ */ (0, U.jsxs)("label", {
						className: "field",
						children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Feldschlüssel" }), /* @__PURE__ */ (0, U.jsx)("input", {
							value: o,
							placeholder: "z. B. Spiel.Gegner",
							disabled: t || s || !a,
							onChange: (e) => l(a, e.target.value)
						})]
					})]
				}), e.binding ? /* @__PURE__ */ (0, U.jsxs)(U.Fragment, { children: [s ? /* @__PURE__ */ (0, U.jsx)("p", {
					className: "binding-preview",
					children: "Systembindung · Datenquelle und Feldschlüssel sind geschützt. Position, Größe und Darstellung bleiben bearbeitbar."
				}) : null, /* @__PURE__ */ (0, U.jsx)("p", {
					className: "binding-preview",
					children: c === void 0 ? "Für diese Bindung ist aktuell kein Wert im Kontext vorhanden." : Array.isArray(c) ? `Aktuell: ${c.length} dynamische Einträge` : `Aktueller Wert: ${String(c ?? "")}`
				})] }) : null]
			}),
			/* @__PURE__ */ (0, U.jsxs)("label", {
				className: "field",
				children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Text / Platzhalter" }), /* @__PURE__ */ (0, U.jsx)("textarea", {
					rows: 4,
					value: e.text,
					disabled: t,
					onChange: (e) => r((t) => t.type === "text" ? {
						...t,
						text: e.target.value
					} : t)
				})]
			}),
			/* @__PURE__ */ (0, U.jsxs)("label", {
				className: "field text-effect-field",
				children: [
					/* @__PURE__ */ (0, U.jsx)("span", { children: "Texteffekt" }),
					/* @__PURE__ */ (0, U.jsxs)("select", {
						value: e.style?.textEffect ?? "",
						disabled: t,
						onChange: (e) => n({ textEffect: e.target.value || void 0 }),
						children: [
							/* @__PURE__ */ (0, U.jsx)("option", {
								value: "",
								children: "Ohne Effekt"
							}),
							/* @__PURE__ */ (0, U.jsx)("option", {
								value: "ice-depth-glow",
								children: "Eis 3D + Leuchten (Liveticker V4)"
							}),
							/* @__PURE__ */ (0, U.jsx)("option", {
								value: "metal-depth",
								children: "Metall 3D (Liveticker V4)"
							}),
							/* @__PURE__ */ (0, U.jsx)("option", {
								value: "sticker-gloss",
								children: "Sticker-Glanz"
							}),
							/* @__PURE__ */ (0, U.jsx)("option", {
								value: "ice-glow",
								children: "Eis-Leuchten (klassisch)"
							}),
							/* @__PURE__ */ (0, U.jsx)("option", {
								value: "frost-metal",
								children: "Frost-Metall (klassisch)"
							})
						]
					}),
					/* @__PURE__ */ (0, U.jsx)("small", { children: "Der Effekt wird sofort in der Vorschau angezeigt und beim Speichern übernommen." })
				]
			}),
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "inspector-grid",
				children: [/* @__PURE__ */ (0, U.jsx)(Zs, {
					label: "Textfarbe",
					value: e.style?.fill ?? "#ffffff",
					disabled: t,
					onChange: (e) => n({ fill: e })
				}), /* @__PURE__ */ (0, U.jsx)(Xs, {
					label: "Schriftgröße",
					value: e.style?.fontSize ?? 48,
					min: 1,
					disabled: t,
					onChange: (e) => n({ fontSize: e })
				})]
			}),
			/* @__PURE__ */ (0, U.jsxs)("label", {
				className: "field",
				children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Schrift" }), /* @__PURE__ */ (0, U.jsx)("input", {
					value: e.style?.fontFamily ?? "sans-serif",
					disabled: t,
					onChange: (e) => n({ fontFamily: e.target.value })
				})]
			}),
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "inspector-grid",
				children: [/* @__PURE__ */ (0, U.jsxs)("label", {
					className: "field",
					children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Stärke" }), /* @__PURE__ */ (0, U.jsxs)("select", {
						value: String(e.style?.fontWeight ?? 700),
						disabled: t,
						onChange: (e) => n({ fontWeight: Number(e.target.value) }),
						children: [
							/* @__PURE__ */ (0, U.jsx)("option", {
								value: "400",
								children: "Normal"
							}),
							/* @__PURE__ */ (0, U.jsx)("option", {
								value: "500",
								children: "Medium"
							}),
							/* @__PURE__ */ (0, U.jsx)("option", {
								value: "600",
								children: "Semibold"
							}),
							/* @__PURE__ */ (0, U.jsx)("option", {
								value: "700",
								children: "Bold"
							}),
							/* @__PURE__ */ (0, U.jsx)("option", {
								value: "800",
								children: "Extra Bold"
							}),
							/* @__PURE__ */ (0, U.jsx)("option", {
								value: "900",
								children: "Black"
							})
						]
					})]
				}), /* @__PURE__ */ (0, U.jsxs)("label", {
					className: "field",
					children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Ausrichtung" }), /* @__PURE__ */ (0, U.jsxs)("select", {
						value: e.style?.textAlign ?? "left",
						disabled: t,
						onChange: (e) => n({ textAlign: e.target.value }),
						children: [
							/* @__PURE__ */ (0, U.jsx)("option", {
								value: "left",
								children: "Links"
							}),
							/* @__PURE__ */ (0, U.jsx)("option", {
								value: "center",
								children: "Mittig"
							}),
							/* @__PURE__ */ (0, U.jsx)("option", {
								value: "right",
								children: "Rechts"
							})
						]
					})]
				})]
			})
		]
	});
}
function Ys({ element: e, disabled: t, onStyleChange: n, onElementChange: r }) {
	return /* @__PURE__ */ (0, U.jsxs)("div", {
		className: "inspector-section",
		children: [/* @__PURE__ */ (0, U.jsxs)("label", {
			className: "field",
			children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Form" }), /* @__PURE__ */ (0, U.jsxs)("select", {
				value: e.shape,
				disabled: t,
				onChange: (e) => r((t) => t.type === "shape" ? {
					...t,
					shape: e.target.value
				} : t),
				children: [/* @__PURE__ */ (0, U.jsx)("option", {
					value: "rect",
					children: "Rechteck"
				}), /* @__PURE__ */ (0, U.jsx)("option", {
					value: "ellipse",
					children: "Ellipse"
				})]
			})]
		}), /* @__PURE__ */ (0, U.jsxs)("div", {
			className: "inspector-grid",
			children: [
				/* @__PURE__ */ (0, U.jsx)(Zs, {
					label: "Füllung",
					value: e.style?.fill ?? "#d71920",
					disabled: t,
					onChange: (e) => n({ fill: e })
				}),
				/* @__PURE__ */ (0, U.jsx)(Zs, {
					label: "Kontur",
					value: e.style?.stroke ?? "#ffffff",
					disabled: t,
					onChange: (e) => n({ stroke: e })
				}),
				/* @__PURE__ */ (0, U.jsx)(Xs, {
					label: "Kontur",
					value: e.style?.strokeWidth ?? 0,
					min: 0,
					disabled: t,
					onChange: (e) => n({ strokeWidth: e })
				}),
				e.shape === "rect" ? /* @__PURE__ */ (0, U.jsx)(Xs, {
					label: "Ecken",
					value: e.radius ?? 0,
					min: 0,
					disabled: t,
					onChange: (e) => r((t) => t.type === "shape" ? {
						...t,
						radius: e
					} : t)
				}) : null
			]
		})]
	});
}
function Xs({ label: e, value: t, onChange: n, disabled: r = !1, min: i, max: a, step: o = 1 }) {
	return /* @__PURE__ */ (0, U.jsxs)("label", {
		className: "field",
		children: [/* @__PURE__ */ (0, U.jsx)("span", { children: e }), /* @__PURE__ */ (0, U.jsx)("input", {
			type: "number",
			value: Number.isFinite(t) ? t : 0,
			min: i,
			max: a,
			step: o,
			disabled: r,
			onChange: (e) => n(Number(e.target.value))
		})]
	});
}
function Zs({ label: e, value: t, onChange: n, disabled: r }) {
	let i = /^#[0-9a-fA-F]{6}$/.test(t) ? t : "#000000";
	return /* @__PURE__ */ (0, U.jsxs)("label", {
		className: "field color-field",
		children: [/* @__PURE__ */ (0, U.jsx)("span", { children: e }), /* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("input", {
			type: "color",
			value: i,
			disabled: r,
			onChange: (e) => n(e.target.value)
		}), /* @__PURE__ */ (0, U.jsx)("input", {
			value: t,
			disabled: r,
			onChange: (e) => n(e.target.value)
		})] })]
	});
}
function Qs(e, t = 0) {
	let n = [];
	for (let r of [...e].reverse()) n.push({
		element: r,
		depth: t
	}), r.type === "group" && n.push(...Qs(r.children, t + 1));
	return n;
}
function $s(e, t) {
	return Number.isFinite(e) ? e : t;
}
function ec(e, t, n) {
	return Math.min(n, Math.max(t, e));
}
//#endregion
//#region src/lib/liveticker-sticker.ts
var tc = {
	width: 512,
	height: 512
};
function nc(e, t = Po) {
	if (!e.opponentLogo?.href || !e.opponentLogo.mediaId) throw Error("Für einen Sticker muss das zentrale Gegnerlogo vorhanden sein.");
	let n = e.title.trim();
	if (!n) throw Error("Bitte einen Stickertitel eingeben.");
	let r = [
		{
			id: t(),
			name: "Fester Sticker-Hintergrund",
			type: "shape",
			shape: "ellipse",
			x: 12,
			y: 12,
			width: 488,
			height: 488,
			rotation: 0,
			locked: !0,
			style: {
				fill: "#102c55",
				stroke: "#ffffff",
				strokeWidth: 14
			}
		},
		{
			id: t(),
			name: "Sticker Innenring",
			type: "shape",
			shape: "ellipse",
			x: 29,
			y: 29,
			width: 454,
			height: 454,
			rotation: 0,
			locked: !0,
			style: {
				fill: "#142e61",
				stroke: "#319cfa",
				strokeWidth: 7
			}
		},
		{
			id: t(),
			name: "TOR-Schriftzug",
			type: "text",
			text: "TOR!",
			x: 50,
			y: 40,
			width: 412,
			height: 122,
			rotation: 0,
			locked: !0,
			style: {
				fill: "#ffffff",
				stroke: "#1e8ff4",
				strokeWidth: 8,
				fontSize: 109,
				fontWeight: 900,
				textAlign: "center",
				textEffect: "sticker-gloss"
			}
		},
		{
			id: t(),
			name: "Gegnerlogo",
			type: "logo",
			x: 156,
			y: 180,
			width: 200,
			height: 200,
			rotation: 0,
			mediaId: e.opponentLogo.mediaId,
			href: e.opponentLogo.href,
			preserveAspectRatio: "xMidYMid meet",
			locked: !0,
			style: { opacity: 1 }
		},
		{
			id: t(),
			name: "Gegner",
			type: "text",
			text: e.opponentName.trim().slice(0, 42),
			x: 38,
			y: 398,
			width: 436,
			height: 65,
			rotation: 0,
			locked: !0,
			style: {
				fill: "#ffffff",
				stroke: "#09203e",
				strokeWidth: 2,
				fontSize: 27,
				fontWeight: 800,
				textAlign: "center"
			}
		}
	];
	return {
		...Fo(n, tc, t),
		elements: r
	};
}
//#endregion
//#region src/components/MatchdayWorkspace.tsx
var rc = [
	{
		type: "ANNOUNCEMENT",
		label: "Spieltagsankündigung",
		description: "Datum, Uhrzeit, Ort und beide Teams"
	},
	{
		type: "PERIOD_RESULT",
		label: "Drittelergebnis",
		description: "Drittelstand aus dem zentralen Liveticker"
	},
	{
		type: "FINAL",
		label: "Endstand",
		description: "Finaler Spielstand aus dem zentralen Liveticker"
	},
	{
		type: "GOAL_STICKER",
		label: "Tor-Sticker",
		description: "Feste 512 × 512 Stickervorlage mit dem zentralen Gegnerlogo"
	}
], ic = Mo.filter((e) => e.code === "story" || e.code === "square");
function ac(e) {
	let t = /* @__PURE__ */ new Date(`${e}T12:00:00`);
	return Number.isNaN(t.valueOf()) ? e : new Intl.DateTimeFormat("de-DE", {
		weekday: "short",
		day: "2-digit",
		month: "2-digit",
		year: "numeric"
	}).format(t);
}
function oc(e) {
	return e ? `${e.slice(0, 5)} Uhr` : "Uhrzeit offen";
}
function sc(e) {
	return `Spieltag · ${e.displayTitle} · ${ac(e.eventDate)}`;
}
function cc(e) {
	return e.id ? {
		id: e.id,
		name: e.name,
		shortName: e.shortName,
		teamCode: e.teamCode,
		homeClub: e.homeClub,
		active: e.active,
		logoUploaded: e.logoUploaded,
		logoSha256: e.logoSha256,
		logoStorageBucket: e.logoStorageBucket,
		logoStoragePath: e.logoStoragePath
	} : null;
}
async function lc(e) {
	let t = cc(e);
	return !t || !Ts(t) ? null : Ds(t);
}
function uc(e) {
	let t = e.eventTime?.slice(0, 8) || "23:59:59";
	return /* @__PURE__ */ new Date(`${e.eventDate}T${t}`);
}
function dc(e) {
	let t = uc(e);
	return !Number.isNaN(t.valueOf()) && t.valueOf() >= Date.now();
}
function fc({ onDraftCreated: e }) {
	let [t, n] = (0, l.useState)([]), [r, i] = (0, l.useState)(""), [a, o] = (0, l.useState)("ANNOUNCEMENT"), [s, c] = (0, l.useState)(1), [u, d] = (0, l.useState)("story"), [f, p] = (0, l.useState)(""), [m, h] = (0, l.useState)("loading"), [g, _] = (0, l.useState)(null);
	(0, l.useEffect)(() => {
		let e = !1;
		return z.listMatchdayGames().then(({ games: t }) => {
			if (e) return;
			n(t);
			let r = t.find((e) => dc(e)) ?? t[0] ?? null;
			r && (i(r.eventId), p(sc(r))), h("ready");
		}).catch((t) => {
			console.error("Matchday game list failed", t), e || (_(B(t)), h("error"));
		}), () => {
			e = !0;
		};
	}, []);
	let v = (0, l.useMemo)(() => t.find((e) => e.eventId === r) ?? null, [t, r]), y = (e) => {
		i(e.eventId), p(sc(e)), _(null);
	}, b = async () => {
		if (!v || m === "creating") return;
		let t = f.trim();
		if (!t) {
			_("Bitte einen Titel eingeben.");
			return;
		}
		let n = ic.find((e) => e.code === u) ?? ic[0];
		h("creating"), _("Spieldaten und Logos werden übernommen …");
		try {
			let [r, i] = await Promise.all([lc(v.homeTeam), lc(v.awayTeam)]), o = {
				eventId: v.eventId,
				eventDate: v.eventDate,
				eventTime: v.eventTime,
				venue: v.venue,
				homeAway: v.homeAway,
				homeTeam: {
					name: v.homeTeam.name,
					shortName: v.homeTeam.shortName,
					logo: r
				},
				awayTeam: {
					name: v.awayTeam.name,
					shortName: v.awayTeam.shortName,
					logo: i
				}
			}, c;
			if (a === "GOAL_STICKER") {
				let e = v.homeAway === "HOME" ? i : r;
				if (!e) throw Error("Für den Sticker fehlt das zentrale Gegnerlogo. Bitte im Liveticker hinterlegen.");
				c = nc({
					title: t,
					opponentName: v.opponentName,
					opponentLogo: e
				});
			} else if (a === "ANNOUNCEMENT") c = Ao(t, n, o);
			else {
				let e = await z.getMatchdayScore(v.eventId);
				if (a === "FINAL") {
					if (e.status !== "FINAL") {
						_("Für dieses Spiel liegt noch kein finaler Liveticker-Endstand vor."), h("ready");
						return;
					}
					c = jo(t, n, {
						...o,
						kind: "FINAL",
						homeScore: e.homeScore,
						awayScore: e.awayScore,
						resultSuffix: e.resultSuffix
					});
				} else {
					let r = e.periods.find((e) => e.period === s);
					if (!r?.available) {
						_(`Das ${s}. Drittel ist im Liveticker noch nicht abgeschlossen.`), h("ready");
						return;
					}
					c = jo(t, n, {
						...o,
						kind: "PERIOD_RESULT",
						period: s,
						homeScore: r.cumulativeHomeScore,
						awayScore: r.cumulativeAwayScore,
						periodHomeScore: r.homeScore,
						periodAwayScore: r.awayScore
					});
				}
			}
			e(await z.createDraft(t, c));
		} catch (e) {
			console.error("Matchday draft create failed", e), _(B(e)), h("ready");
		}
	}, x = v ? [!v.homeTeam.id || !v.homeTeam.logoUploaded ? v.homeTeam.shortName : null, !v.awayTeam.id || !v.awayTeam.logoUploaded ? v.awayTeam.shortName : null].filter(Boolean) : [];
	return /* @__PURE__ */ (0, U.jsx)("section", {
		className: "matchday-workspace",
		"aria-labelledby": "matchday-title",
		children: /* @__PURE__ */ (0, U.jsxs)("div", {
			className: "matchday-layout",
			children: [/* @__PURE__ */ (0, U.jsxs)("section", {
				className: "panel matchday-games-panel",
				children: [/* @__PURE__ */ (0, U.jsx)("div", {
					className: "field-group-head",
					children: /* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("p", {
						className: "panel-label",
						children: "Zentrale Plattformdaten"
					}), /* @__PURE__ */ (0, U.jsx)("h2", {
						id: "matchday-title",
						children: "Spiel auswählen"
					})] })
				}), m === "loading" ? /* @__PURE__ */ (0, U.jsx)("p", {
					className: "empty-copy",
					children: "Spiele werden geladen …"
				}) : t.length === 0 ? /* @__PURE__ */ (0, U.jsx)("p", {
					className: "empty-copy",
					children: "Keine passenden Spiele gefunden."
				}) : /* @__PURE__ */ (0, U.jsx)("div", {
					className: "matchday-game-list",
					children: t.map((e) => /* @__PURE__ */ (0, U.jsxs)("button", {
						type: "button",
						className: e.eventId === r ? "matchday-game-card matchday-game-card-active" : "matchday-game-card",
						onClick: () => y(e),
						children: [
							/* @__PURE__ */ (0, U.jsxs)("span", {
								className: "matchday-game-date",
								children: [ac(e.eventDate), e.eventTime ? ` · ${e.eventTime.slice(0, 5)}` : ""]
							}),
							/* @__PURE__ */ (0, U.jsx)("strong", { children: e.displayTitle }),
							/* @__PURE__ */ (0, U.jsxs)("small", { children: [e.homeAway === "HOME" ? "Heimspiel" : "Auswärtsspiel", e.venue ? ` · ${e.venue}` : ""] })
						]
					}, e.eventId))
				})]
			}), /* @__PURE__ */ (0, U.jsxs)("section", {
				className: "panel matchday-create-panel",
				children: [
					/* @__PURE__ */ (0, U.jsx)("p", {
						className: "panel-label",
						children: "Spieltagsgrafik"
					}),
					/* @__PURE__ */ (0, U.jsx)("h2", { children: "Grafikart wählen" }),
					v ? /* @__PURE__ */ (0, U.jsxs)(U.Fragment, { children: [
						/* @__PURE__ */ (0, U.jsxs)("div", {
							className: "matchday-summary",
							children: [
								/* @__PURE__ */ (0, U.jsx)("strong", { children: v.displayTitle }),
								/* @__PURE__ */ (0, U.jsxs)("span", { children: [
									ac(v.eventDate),
									" · ",
									oc(v.eventTime)
								] }),
								/* @__PURE__ */ (0, U.jsx)("span", { children: v.venue || "Spielort noch offen" })
							]
						}),
						/* @__PURE__ */ (0, U.jsx)("div", {
							className: "matchday-format-choice",
							role: "group",
							"aria-label": "Grafikart",
							children: rc.map((e) => /* @__PURE__ */ (0, U.jsx)("button", {
								type: "button",
								className: a === e.type ? "secondary-button matchday-format-active" : "secondary-button",
								disabled: m === "creating",
								onClick: () => {
									o(e.type), _(null);
								},
								children: e.label
							}, e.type))
						}),
						/* @__PURE__ */ (0, U.jsx)("p", {
							className: "matchday-hint",
							children: rc.find((e) => e.type === a)?.description
						}),
						a === "PERIOD_RESULT" ? /* @__PURE__ */ (0, U.jsx)("div", {
							className: "matchday-format-choice",
							role: "group",
							"aria-label": "Drittel",
							children: [1, 2].map((e) => /* @__PURE__ */ (0, U.jsxs)("button", {
								type: "button",
								className: s === e ? "secondary-button matchday-format-active" : "secondary-button",
								disabled: m === "creating",
								onClick: () => {
									c(e), _(null);
								},
								children: [e, ". Drittel"]
							}, e))
						}) : null,
						/* @__PURE__ */ (0, U.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Titel" }), /* @__PURE__ */ (0, U.jsx)("input", {
								value: f,
								maxLength: 160,
								disabled: m === "creating",
								onChange: (e) => p(e.target.value)
							})]
						}),
						a === "GOAL_STICKER" ? /* @__PURE__ */ (0, U.jsx)("p", {
							className: "matchday-hint",
							children: "Festes Stickerformat: 512 × 512 Pixel · transparenter Außenbereich."
						}) : /* @__PURE__ */ (0, U.jsx)("div", {
							className: "matchday-format-choice",
							role: "group",
							"aria-label": "Format",
							children: ic.map((e) => /* @__PURE__ */ (0, U.jsx)("button", {
								type: "button",
								className: u === e.code ? "secondary-button matchday-format-active" : "secondary-button",
								disabled: m === "creating",
								onClick: () => d(e.code),
								children: e.code === "story" ? "Story · 9:16" : "Post · 1:1"
							}, e.code))
						}),
						x.length && a !== "GOAL_STICKER" ? /* @__PURE__ */ (0, U.jsxs)("div", {
							className: "message-box media-info-box",
							children: [
								"Für ",
								x.join(" / "),
								" ist kein zentrales Logo auflösbar. Die Grafik wird trotzdem erstellt und kann im Editor ergänzt werden."
							]
						}) : null,
						g ? /* @__PURE__ */ (0, U.jsx)("div", {
							className: m === "error" ? "message-box error-box" : "message-box media-info-box",
							children: g
						}) : null,
						/* @__PURE__ */ (0, U.jsx)("button", {
							type: "button",
							className: "primary-button",
							disabled: m === "creating",
							onClick: () => void b(),
							children: m === "creating" ? "Grafik wird angelegt …" : rc.find((e) => e.type === a)?.label || "Grafik erstellen"
						}),
						/* @__PURE__ */ (0, U.jsx)("p", {
							className: "matchday-hint",
							children: a === "GOAL_STICKER" ? "Der feste Sticker wird als Entwurf erstellt und kann über den bestehenden Render-Worker als PNG exportiert werden." : "Danach öffnet sich der normale Editor. Hintergrund, Texte und weitere Medien können dort angepasst werden."
						})
					] }) : /* @__PURE__ */ (0, U.jsx)("p", {
						className: "empty-copy",
						children: "Wähle links zuerst ein Spiel."
					})
				]
			})]
		})
	});
}
//#endregion
//#region src/components/FanbusWorkspace.tsx
var pc = [{
	code: "STORY",
	label: "Story · 9:16"
}, {
	code: "POST",
	label: "Post · 4:5"
}];
function mc(e) {
	let t = /* @__PURE__ */ new Date(e + "T12:00:00");
	return Number.isNaN(t.valueOf()) ? e : new Intl.DateTimeFormat("de-DE", {
		weekday: "short",
		day: "2-digit",
		month: "2-digit",
		year: "numeric"
	}).format(t);
}
function hc(e) {
	return e == null ? "Preis offen" : new Intl.NumberFormat("de-DE", {
		style: "currency",
		currency: "EUR"
	}).format(e / 100);
}
function gc(e) {
	return "Fanbus · " + (e.opponentName || e.destination || e.displayTitle) + " · " + mc(e.eventDate);
}
function _c(e) {
	let t = /* @__PURE__ */ new Date(e.eventDate + "T23:59:59");
	return !Number.isNaN(t.valueOf()) && t.valueOf() >= Date.now();
}
function vc({ onDraftCreated: e }) {
	let [t, n] = (0, l.useState)([]), [r, i] = (0, l.useState)(""), [a, o] = (0, l.useState)("STORY"), [s, c] = (0, l.useState)(""), [u, d] = (0, l.useState)("loading"), [f, p] = (0, l.useState)(null);
	(0, l.useEffect)(() => {
		let e = !1;
		return z.listFanbusTrips().then(({ trips: t }) => {
			if (e) return;
			n(t);
			let r = t.find((e) => e.status === "PUBLISHED" && _c(e)) ?? t.find(_c) ?? t[0] ?? null;
			r && (i(r.tripId), c(gc(r))), d("ready");
		}).catch((t) => {
			console.error("Fanbus trip list failed", t), e || (p(B(t)), d("error"));
		}), () => {
			e = !0;
		};
	}, []);
	let m = (0, l.useMemo)(() => t.find((e) => e.tripId === r) ?? null, [r, t]), h = (e) => {
		i(e.tripId), c(gc(e)), p(null);
	}, g = async () => {
		if (!m || u === "creating") return;
		let t = s.trim();
		if (!t) {
			p("Bitte einen Titel eingeben.");
			return;
		}
		d("creating"), p("Veröffentlichte Fanbus-Vorlage und zentrale Daten werden übernommen …");
		try {
			e(await z.createFanbusDraft({
				tripId: m.tripId,
				artifactKind: a,
				title: t
			}));
		} catch (e) {
			console.error("Fanbus draft create failed", e), p(B(e)), d("ready");
		}
	};
	return /* @__PURE__ */ (0, U.jsx)("section", {
		className: "matchday-workspace",
		"aria-labelledby": "fanbus-title",
		children: /* @__PURE__ */ (0, U.jsxs)("div", {
			className: "matchday-layout",
			children: [/* @__PURE__ */ (0, U.jsxs)("section", {
				className: "panel matchday-games-panel",
				children: [/* @__PURE__ */ (0, U.jsx)("div", {
					className: "field-group-head",
					children: /* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("p", {
						className: "panel-label",
						children: "Zentrale Fanbusdaten"
					}), /* @__PURE__ */ (0, U.jsx)("h2", {
						id: "fanbus-title",
						children: "Fahrt auswählen"
					})] })
				}), u === "loading" ? /* @__PURE__ */ (0, U.jsx)("p", {
					className: "empty-copy",
					children: "Fanbusfahrten werden geladen …"
				}) : t.length === 0 ? /* @__PURE__ */ (0, U.jsx)("p", {
					className: "empty-copy",
					children: "Keine Fanbusfahrt verfügbar."
				}) : /* @__PURE__ */ (0, U.jsx)("div", {
					className: "matchday-game-list",
					children: t.map((e) => /* @__PURE__ */ (0, U.jsxs)("button", {
						type: "button",
						className: e.tripId === r ? "matchday-game-card matchday-game-card-active" : "matchday-game-card",
						onClick: () => h(e),
						children: [
							/* @__PURE__ */ (0, U.jsxs)("span", {
								className: "matchday-game-date",
								children: [
									mc(e.eventDate),
									" · ",
									e.status
								]
							}),
							/* @__PURE__ */ (0, U.jsx)("strong", { children: e.opponentName || e.displayTitle }),
							/* @__PURE__ */ (0, U.jsxs)("small", { children: [
								e.destination || e.venue || "Ziel offen",
								" ·",
								" ",
								hc(e.priceCents)
							] })
						]
					}, e.tripId))
				})]
			}), /* @__PURE__ */ (0, U.jsxs)("section", {
				className: "panel matchday-create-panel",
				children: [
					/* @__PURE__ */ (0, U.jsx)("p", {
						className: "panel-label",
						children: "Fanbus"
					}),
					/* @__PURE__ */ (0, U.jsx)("h2", { children: "Bus-Flyer erstellen" }),
					m ? /* @__PURE__ */ (0, U.jsxs)(U.Fragment, { children: [
						/* @__PURE__ */ (0, U.jsxs)("div", {
							className: "matchday-summary",
							children: [
								/* @__PURE__ */ (0, U.jsx)("strong", { children: m.opponentName || m.displayTitle }),
								/* @__PURE__ */ (0, U.jsxs)("span", { children: [
									mc(m.eventDate),
									" ·",
									" ",
									hc(m.priceCents)
								] }),
								/* @__PURE__ */ (0, U.jsx)("span", { children: m.boardingStops.length ? m.boardingStops.length + " Abfahrtsort" + (m.boardingStops.length === 1 ? "" : "e") : m.departureAt ? "Zentrale Abfahrt vorhanden" : "Abfahrt noch offen" })
							]
						}),
						/* @__PURE__ */ (0, U.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Titel" }), /* @__PURE__ */ (0, U.jsx)("input", {
								value: s,
								maxLength: 160,
								disabled: u === "creating",
								onChange: (e) => c(e.target.value)
							})]
						}),
						/* @__PURE__ */ (0, U.jsx)("div", {
							className: "matchday-format-choice",
							role: "group",
							"aria-label": "Format",
							children: pc.map((e) => /* @__PURE__ */ (0, U.jsx)("button", {
								type: "button",
								className: a === e.code ? "secondary-button matchday-format-active" : "secondary-button",
								disabled: u === "creating",
								onClick: () => o(e.code),
								children: e.label
							}, e.code))
						}),
						m.status === "PUBLISHED" ? null : /* @__PURE__ */ (0, U.jsxs)("div", {
							className: "message-box media-info-box",
							children: [
								"Diese Fahrt hat den Status ",
								m.status,
								". Der Flyer nutzt den aktuellen zentralen Datenstand und verändert die Fahrt nicht."
							]
						}),
						f ? /* @__PURE__ */ (0, U.jsx)("div", {
							className: u === "error" ? "message-box error-box" : "message-box media-info-box",
							children: f
						}) : null,
						/* @__PURE__ */ (0, U.jsx)("button", {
							type: "button",
							className: "primary-button",
							disabled: u === "creating",
							onClick: () => void g(),
							children: u === "creating" ? "Bus-Flyer wird angelegt …" : "Bus-Flyer erstellen"
						}),
						/* @__PURE__ */ (0, U.jsx)("p", {
							className: "matchday-hint",
							children: "Danach öffnet sich der normale Editor. Die Fanbusfahrt selbst bleibt unverändert."
						})
					] }) : /* @__PURE__ */ (0, U.jsx)("p", {
						className: "empty-copy",
						children: "Wähle links zuerst eine Fahrt."
					})
				]
			})]
		})
	});
}
//#endregion
//#region src/components/MediaPackageWorkspace.tsx
function yc({ initial: e, onClose: t, onOpenDraft: n, onChange: r }) {
	let [i, a] = (0, l.useState)(e), [o, s] = (0, l.useState)(xc(e.data)), [c, u] = (0, l.useState)("saved"), [d, f] = (0, l.useState)(null);
	(0, l.useEffect)(() => {
		a(e), s(xc(e.data)), u("saved"), f(null);
	}, [e.id]);
	let p = (0, l.useMemo)(() => [...i.drafts], [i.drafts]), m = (e) => {
		s(e), u("dirty"), f(null);
	}, h = async () => {
		if (c !== "saving") {
			u("saving"), f(null);
			try {
				let e = await z.saveMediaPackageData({
					mediaPackageId: i.id,
					data: Sc(o),
					expectedVersion: i.version
				});
				a(e), s(xc(e.data)), u("saved"), r?.(e);
			} catch (e) {
				console.error("Media package data save failed", e), f(B(e)), u("error");
				try {
					let e = await z.getMediaPackage(i.id);
					a(e);
				} catch {}
			}
		}
	};
	return (0, l.useEffect)(() => {
		if (c !== "dirty") return;
		let e = window.setTimeout(() => {
			h();
		}, 1200);
		return () => window.clearTimeout(e);
	}, [
		c,
		o,
		i.version
	]), /* @__PURE__ */ (0, U.jsxs)("section", {
		className: "media-package-workspace",
		children: [
			/* @__PURE__ */ (0, U.jsxs)("section", {
				className: "panel media-package-head-panel",
				children: [/* @__PURE__ */ (0, U.jsxs)("div", { children: [
					/* @__PURE__ */ (0, U.jsx)("p", {
						className: "panel-label",
						children: "Medienpaket"
					}),
					/* @__PURE__ */ (0, U.jsx)("h2", { children: i.title }),
					/* @__PURE__ */ (0, U.jsx)("p", { children: "Gemeinsame Daten gelten paketweit. Layoutänderungen bleiben in den einzelnen Grafiken." })
				] }), /* @__PURE__ */ (0, U.jsxs)("div", {
					className: "media-package-head-actions",
					children: [/* @__PURE__ */ (0, U.jsx)("span", {
						className: `save-state save-state-${c === "dirty" ? "dirty" : c}`,
						children: c === "saving" ? "Speichert …" : c === "error" ? "Fehler" : c === "dirty" ? "Ungespeichert" : "Gespeichert"
					}), /* @__PURE__ */ (0, U.jsx)("button", {
						className: "secondary-button",
						onClick: t,
						children: "Schließen"
					})]
				})]
			}),
			d ? /* @__PURE__ */ (0, U.jsx)("div", {
				className: "message-box error-box",
				role: "alert",
				children: d
			}) : null,
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "media-package-grid",
				children: [/* @__PURE__ */ (0, U.jsxs)("section", {
					className: "panel media-package-data-panel",
					children: [
						/* @__PURE__ */ (0, U.jsxs)("div", {
							className: "field-group-head",
							children: [/* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("p", {
								className: "panel-label",
								children: "Paketweit"
							}), /* @__PURE__ */ (0, U.jsx)("h2", { children: "Gemeinsame Daten" })] }), /* @__PURE__ */ (0, U.jsx)("button", {
								className: "secondary-button compact-button",
								onClick: () => m([...o, {
									key: "",
									value: ""
								}]),
								children: "+ Feld"
							})]
						}),
						o.length === 0 ? /* @__PURE__ */ (0, U.jsx)("p", {
							className: "empty-copy",
							children: "Noch keine gemeinsamen Daten hinterlegt."
						}) : /* @__PURE__ */ (0, U.jsx)("div", {
							className: "shared-field-list",
							children: o.map((e, t) => /* @__PURE__ */ (0, U.jsxs)("div", {
								className: "shared-field-row",
								children: [
									/* @__PURE__ */ (0, U.jsxs)("label", {
										className: "field",
										children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Feld" }), /* @__PURE__ */ (0, U.jsx)("input", {
											value: e.key,
											placeholder: "z. B. Gegner",
											onChange: (e) => m(o.map((n, r) => r === t ? {
												...n,
												key: e.target.value
											} : n))
										})]
									}),
									/* @__PURE__ */ (0, U.jsxs)("label", {
										className: "field",
										children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Wert" }), /* @__PURE__ */ (0, U.jsx)("input", {
											value: e.value,
											onChange: (e) => m(o.map((n, r) => r === t ? {
												...n,
												value: e.target.value
											} : n))
										})]
									}),
									/* @__PURE__ */ (0, U.jsx)("button", {
										className: "secondary-button compact-button danger-button",
										onClick: () => m(o.filter((e, n) => n !== t)),
										children: "Entfernen"
									})
								]
							}, t))
						}),
						/* @__PURE__ */ (0, U.jsx)("button", {
							className: "primary-button",
							disabled: c === "saving" || c === "saved",
							onClick: () => void h(),
							children: "Gemeinsame Daten speichern"
						})
					]
				}), /* @__PURE__ */ (0, U.jsxs)("section", {
					className: "panel media-package-drafts-panel",
					children: [/* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("p", {
						className: "panel-label",
						children: "Grafiken"
					}), /* @__PURE__ */ (0, U.jsxs)("h2", { children: [p.length, " Entwürfe"] })] }), /* @__PURE__ */ (0, U.jsx)("div", {
						className: "media-package-draft-list",
						children: p.map((e) => /* @__PURE__ */ (0, U.jsx)(bc, {
							draft: e,
							onOpen: () => n(e.id)
						}, e.id))
					})]
				})]
			}),
			/* @__PURE__ */ (0, U.jsxs)("dl", {
				className: "draft-meta media-package-meta",
				children: [
					/* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("dt", { children: "Paketversion" }), /* @__PURE__ */ (0, U.jsx)("dd", { children: i.version })] }),
					/* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("dt", { children: "Grafiken" }), /* @__PURE__ */ (0, U.jsx)("dd", { children: i.drafts.length })] }),
					/* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("dt", { children: "Vorlagenversion" }), /* @__PURE__ */ (0, U.jsx)("dd", { children: Cc(i.packageTemplateVersionId) })] })
				]
			})
		]
	});
}
function bc({ draft: e, onOpen: t }) {
	return /* @__PURE__ */ (0, U.jsxs)("button", {
		className: "media-package-draft-row",
		onClick: t,
		children: [/* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("strong", { children: e.title }), /* @__PURE__ */ (0, U.jsxs)("span", { children: [
			e.packageSlotKey ?? "Grafik",
			" · Entwurf V",
			e.version
		] })] }), /* @__PURE__ */ (0, U.jsx)("span", { children: "Bearbeiten" })]
	});
}
function xc(e) {
	return Object.entries(e).map(([e, t]) => ({
		key: e,
		value: typeof t == "string" ? t : t == null ? "" : JSON.stringify(t)
	}));
}
function Sc(e) {
	let t = {};
	for (let n of e) {
		let e = n.key.trim();
		e && (t[e] = n.value);
	}
	return t;
}
function Cc(e) {
	return e.length > 12 ? `${e.slice(0, 8)}…` : e;
}
//#endregion
//#region src/components/PackageBrowser.tsx
var wc = () => new Intl.DateTimeFormat("de-DE", {
	day: "2-digit",
	month: "2-digit",
	year: "numeric"
}).format(/* @__PURE__ */ new Date());
function Tc({ expertMode: e, onMediaPackageOpen: t, onActivityChange: n }) {
	let [r, i] = (0, l.useState)([]), [a, o] = (0, l.useState)([]), [s, c] = (0, l.useState)([]), [u, d] = (0, l.useState)("loading"), [f, p] = (0, l.useState)(null), [m, h] = (0, l.useState)(null), [g, _] = (0, l.useState)(!1), [v, y] = (0, l.useState)(""), [b, x] = (0, l.useState)(null), [S, ee] = (0, l.useState)(!1), [te, C] = (0, l.useState)("Neues Medienpaket"), [ne, w] = (0, l.useState)("Allgemein"), [re, ie] = (0, l.useState)(""), [ae, oe] = (0, l.useState)([]), T = async () => {
		d("loading"), p(null);
		try {
			let [t, n, r] = await Promise.all([
				z.listPackageTemplates(e),
				z.listTemplates(!1),
				z.listMediaPackages()
			]);
			i(t.packageTemplates), o(n.templates.filter((e) => e.isActive && e.publishedVersion)), c(r.mediaPackages), d("ready");
		} catch (e) {
			console.error("Generator package browser load failed", e), p(B(e)), d("error");
		}
	};
	(0, l.useEffect)(() => {
		T();
	}, [e]), (0, l.useEffect)(() => {
		n?.(!!b);
	}, [b, n]);
	let se = (0, l.useMemo)(() => {
		let t = v.trim().toLocaleLowerCase("de");
		return r.filter((n) => !e && (!n.isActive || !n.publishedVersion) || g && !n.isFavorite ? !1 : !t || [
			n.name,
			n.category,
			n.description
		].some((e) => e.toLocaleLowerCase("de").includes(t)));
	}, [
		r,
		e,
		g,
		v
	]), ce = async (e) => {
		h(e.id), p(null);
		try {
			let t = !e.isFavorite;
			await z.setPackageTemplateFavorite(e.id, t), i((n) => n.map((n) => n.id === e.id ? {
				...n,
				isFavorite: t
			} : n));
		} catch (e) {
			p(B(e));
		} finally {
			h(null);
		}
	}, le = async (e) => {
		let n = e.publishedVersion;
		if (n) {
			h(e.id), p(null);
			try {
				let r = await z.createMediaPackage({
					title: `${e.name} – ${wc()}`,
					packageTemplateId: e.id,
					versionId: n.id,
					data: {}
				});
				c((e) => [r, ...e.filter((e) => e.id !== r.id)]), t(r);
			} catch (e) {
				console.error("Media package creation failed", e), p(B(e));
			} finally {
				h(null);
			}
		}
	}, ue = async (e) => {
		h(e.id), p(null);
		try {
			let t = e.draftVersion ? await z.getPackageTemplate({
				packageTemplateId: e.id,
				versionId: e.draftVersion.id,
				mode: "DRAFT"
			}) : await z.beginPackageTemplateDraft(e.id);
			x(t);
		} catch (e) {
			console.error("Package template edit failed", e), p(B(e));
		} finally {
			h(null);
		}
	}, de = async (e) => {
		let t = e.draftVersion;
		if (t && window.confirm(`Paket-Vorlage „${e.name}“ als Version ${t.versionNumber} veröffentlichen?`)) {
			h(e.id), p(null);
			try {
				await z.publishPackageTemplate({
					packageTemplateId: e.id,
					versionId: t.id,
					expectedRevision: t.revision
				}), await T();
			} catch (e) {
				console.error("Package template publish failed", e), p(B(e)), await T();
			} finally {
				h(null);
			}
		}
	};
	return b ? /* @__PURE__ */ (0, U.jsx)(Dc, {
		initial: b,
		templates: a,
		onClose: () => {
			x(null), T();
		}
	}) : /* @__PURE__ */ (0, U.jsxs)("section", {
		className: "package-workspace",
		children: [
			/* @__PURE__ */ (0, U.jsxs)("section", {
				className: "panel package-browser-panel",
				children: [
					/* @__PURE__ */ (0, U.jsxs)("div", {
						className: "field-group-head",
						children: [/* @__PURE__ */ (0, U.jsxs)("div", { children: [
							/* @__PURE__ */ (0, U.jsx)("p", {
								className: "panel-label",
								children: "Schnellstart"
							}),
							/* @__PURE__ */ (0, U.jsx)("h2", { children: "Paket-Vorlagen" }),
							/* @__PURE__ */ (0, U.jsx)("p", { children: "Ein Klick erzeugt alle zusammengehörigen Grafiken als ein Medienpaket." })
						] }), /* @__PURE__ */ (0, U.jsx)("button", {
							className: "secondary-button compact-button",
							disabled: u === "loading",
							onClick: () => void T(),
							children: "Aktualisieren"
						})]
					}),
					/* @__PURE__ */ (0, U.jsxs)("div", {
						className: "package-filter-row",
						children: [/* @__PURE__ */ (0, U.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Suchen" }), /* @__PURE__ */ (0, U.jsx)("input", {
								type: "search",
								value: v,
								placeholder: "Paketname oder Kategorie",
								onChange: (e) => y(e.target.value)
							})]
						}), /* @__PURE__ */ (0, U.jsxs)("label", {
							className: "switch-row",
							children: [/* @__PURE__ */ (0, U.jsx)("input", {
								type: "checkbox",
								checked: g,
								onChange: (e) => _(e.target.checked)
							}), /* @__PURE__ */ (0, U.jsx)("span", { children: "Nur Favoriten" })]
						})]
					}),
					f ? /* @__PURE__ */ (0, U.jsx)("p", {
						className: "error-text",
						role: "alert",
						children: f
					}) : null,
					u === "loading" ? /* @__PURE__ */ (0, U.jsx)("p", { children: "Paket-Vorlagen werden geladen …" }) : se.length === 0 ? /* @__PURE__ */ (0, U.jsx)("p", {
						className: "empty-copy",
						children: "Noch keine veröffentlichte Paket-Vorlage vorhanden."
					}) : /* @__PURE__ */ (0, U.jsx)("div", {
						className: "package-template-grid",
						children: se.map((t) => /* @__PURE__ */ (0, U.jsx)(Ec, {
							item: t,
							expertMode: e,
							busy: m === t.id,
							onFavorite: () => void ce(t),
							onCreate: () => void le(t),
							onEdit: () => void ue(t),
							onPublish: () => void de(t)
						}, t.id))
					})
				]
			}),
			s.length > 0 ? /* @__PURE__ */ (0, U.jsxs)("section", {
				className: "panel media-package-list-panel",
				children: [/* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("p", {
					className: "panel-label",
					children: "Arbeitsstände"
				}), /* @__PURE__ */ (0, U.jsx)("h2", { children: "Medienpakete" })] }), /* @__PURE__ */ (0, U.jsx)("div", {
					className: "media-package-list",
					children: s.map((e) => /* @__PURE__ */ (0, U.jsxs)("button", {
						className: "media-package-row",
						onClick: () => t(e),
						children: [/* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("strong", { children: e.title }), /* @__PURE__ */ (0, U.jsxs)("span", { children: [
							e.drafts.length,
							" Grafiken · Paketversion ",
							e.version
						] })] }), /* @__PURE__ */ (0, U.jsx)("span", { children: "Öffnen" })]
					}, e.id))
				})]
			}) : null,
			e ? /* @__PURE__ */ (0, U.jsxs)("section", {
				className: "panel package-admin-panel",
				children: [/* @__PURE__ */ (0, U.jsxs)("div", { children: [
					/* @__PURE__ */ (0, U.jsx)("p", {
						className: "panel-label",
						children: "Expert-Modus"
					}),
					/* @__PURE__ */ (0, U.jsx)("h2", { children: "Neue Paket-Vorlage" }),
					/* @__PURE__ */ (0, U.jsx)("p", { children: "Verknüpft veröffentlichte Einzelvorlagen zu einem festen, versionierten Grafikpaket." })
				] }), /* @__PURE__ */ (0, U.jsxs)("form", {
					className: "package-create-form",
					onSubmit: async (e) => {
						e.preventDefault();
						let t = te.trim(), n = ne.trim();
						if (!t || !n || ae.length === 0) {
							p("Paketname, Kategorie und mindestens eine Grafik sind erforderlich.");
							return;
						}
						ee(!0), p(null);
						try {
							let e = await z.createPackageTemplate({
								name: t,
								category: n,
								description: re.trim(),
								items: ae.map((e, t) => ({
									...e,
									slotKey: Ac(e.slotKey, t),
									label: e.label.trim() || `Grafik ${t + 1}`,
									sortPosition: t
								}))
							});
							x(e), C("Neues Medienpaket"), ie(""), oe([]), await T();
						} catch (e) {
							console.error("Package template create failed", e), p(B(e));
						} finally {
							ee(!1);
						}
					},
					children: [
						/* @__PURE__ */ (0, U.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Name" }), /* @__PURE__ */ (0, U.jsx)("input", {
								value: te,
								maxLength: 160,
								onChange: (e) => C(e.target.value)
							})]
						}),
						/* @__PURE__ */ (0, U.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Kategorie" }), /* @__PURE__ */ (0, U.jsx)("input", {
								value: ne,
								maxLength: 80,
								onChange: (e) => w(e.target.value)
							})]
						}),
						/* @__PURE__ */ (0, U.jsxs)("label", {
							className: "field package-description-field",
							children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Beschreibung" }), /* @__PURE__ */ (0, U.jsx)("input", {
								value: re,
								maxLength: 2e3,
								onChange: (e) => ie(e.target.value)
							})]
						}),
						/* @__PURE__ */ (0, U.jsx)(Oc, {
							items: ae,
							templates: a,
							onChange: oe
						}),
						/* @__PURE__ */ (0, U.jsxs)("div", {
							className: "package-create-actions",
							children: [/* @__PURE__ */ (0, U.jsx)("button", {
								type: "button",
								className: "secondary-button",
								onClick: () => {
									let e = a[0]?.publishedVersion;
									if (!e) {
										p("Für eine Paket-Vorlage muss zuerst mindestens eine Einzelvorlage veröffentlicht sein.");
										return;
									}
									let t = ae.length + 1;
									oe((n) => [...n, {
										slotKey: `grafik-${t}`,
										label: `Grafik ${t}`,
										templateVersionId: e.id
									}]);
								},
								disabled: a.length === 0,
								children: "+ Grafik hinzufügen"
							}), /* @__PURE__ */ (0, U.jsx)("button", {
								className: "primary-button",
								disabled: S,
								children: S ? "Wird angelegt …" : "Paket-Draft anlegen"
							})]
						})
					]
				})]
			}) : null
		]
	});
}
function Ec({ item: e, expertMode: t, busy: n, onFavorite: r, onCreate: i, onEdit: a, onPublish: o }) {
	let s = e.publishedVersion, c = e.draftVersion;
	return /* @__PURE__ */ (0, U.jsxs)("article", {
		className: "package-template-card",
		children: [
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "template-card-head",
				children: [/* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("span", {
					className: "template-category",
					children: e.category
				}), /* @__PURE__ */ (0, U.jsx)("h3", { children: e.name })] }), /* @__PURE__ */ (0, U.jsx)("button", {
					className: e.isFavorite ? "favorite-button favorite-button-active" : "favorite-button",
					disabled: n,
					onClick: r,
					"aria-label": e.isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen",
					children: e.isFavorite ? "★" : "☆"
				})]
			}),
			e.description ? /* @__PURE__ */ (0, U.jsx)("p", {
				className: "template-description",
				children: e.description
			}) : null,
			s ? /* @__PURE__ */ (0, U.jsx)("div", {
				className: "package-slot-list",
				children: s.items.map((e) => /* @__PURE__ */ (0, U.jsxs)("span", { children: [
					e.label,
					" · ",
					jc(e)
				] }, e.slotKey))
			}) : /* @__PURE__ */ (0, U.jsx)("p", {
				className: "empty-copy",
				children: "Noch nicht veröffentlicht."
			}),
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "template-card-meta",
				children: [s ? /* @__PURE__ */ (0, U.jsxs)("span", { children: [
					"V",
					s.versionNumber,
					" · ",
					s.items.length,
					" Grafiken"
				] }) : null, c ? /* @__PURE__ */ (0, U.jsxs)("span", { children: ["Draft V", c.versionNumber] }) : null]
			}),
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "template-card-actions",
				children: [/* @__PURE__ */ (0, U.jsx)("button", {
					className: "primary-button compact-button",
					disabled: n || !s || !e.isActive,
					onClick: i,
					children: "Medienpaket erstellen"
				}), t ? /* @__PURE__ */ (0, U.jsxs)(U.Fragment, { children: [/* @__PURE__ */ (0, U.jsx)("button", {
					className: "secondary-button compact-button",
					disabled: n,
					onClick: a,
					children: c ? "Draft bearbeiten" : "Neue Version"
				}), c ? /* @__PURE__ */ (0, U.jsx)("button", {
					className: "secondary-button compact-button",
					disabled: n,
					onClick: o,
					children: "Veröffentlichen"
				}) : null] }) : null]
			})
		]
	});
}
function Dc({ initial: e, templates: t, onClose: n }) {
	let [r, i] = (0, l.useState)(e), [a, o] = (0, l.useState)(e.packageTemplate.name), [s, c] = (0, l.useState)(e.packageTemplate.category), [u, d] = (0, l.useState)(e.packageTemplate.description), [f, p] = (0, l.useState)(kc(e.version.items)), [m, h] = (0, l.useState)(!1), [g, _] = (0, l.useState)(null), v = () => {
		let e = t[0]?.publishedVersion;
		if (!e) {
			_("Keine veröffentlichte Einzelvorlage verfügbar.");
			return;
		}
		let n = f.length + 1;
		p((t) => [...t, {
			slotKey: `grafik-${n}`,
			label: `Grafik ${n}`,
			templateVersionId: e.id
		}]);
	}, y = async () => {
		h(!0), _(null);
		try {
			let e = await z.savePackageTemplateDraft({
				packageTemplateId: r.packageTemplate.id,
				versionId: r.version.id,
				expectedRevision: r.version.revision,
				name: a.trim(),
				category: s.trim(),
				description: u.trim(),
				items: f.map((e, t) => ({
					...e,
					slotKey: Ac(e.slotKey, t),
					label: e.label.trim() || `Grafik ${t + 1}`,
					sortPosition: t
				}))
			});
			i(e), p(kc(e.version.items));
		} catch (e) {
			_(B(e));
			try {
				let e = await z.getPackageTemplate({
					packageTemplateId: r.packageTemplate.id,
					versionId: r.version.id,
					mode: "DRAFT"
				});
				i(e);
			} catch {}
		} finally {
			h(!1);
		}
	};
	return /* @__PURE__ */ (0, U.jsxs)("section", {
		className: "panel package-editor-panel",
		children: [
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "field-group-head",
				children: [/* @__PURE__ */ (0, U.jsxs)("div", { children: [
					/* @__PURE__ */ (0, U.jsx)("p", {
						className: "panel-label",
						children: "Paket-Vorlageneditor"
					}),
					/* @__PURE__ */ (0, U.jsx)("h2", { children: a }),
					/* @__PURE__ */ (0, U.jsxs)("p", { children: [
						"Draft V",
						r.version.versionNumber,
						" · Revision ",
						r.version.revision
					] })
				] }), /* @__PURE__ */ (0, U.jsx)("button", {
					className: "secondary-button",
					onClick: n,
					children: "Schließen"
				})]
			}),
			g ? /* @__PURE__ */ (0, U.jsx)("p", {
				className: "error-text",
				role: "alert",
				children: g
			}) : null,
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "package-editor-meta",
				children: [
					/* @__PURE__ */ (0, U.jsxs)("label", {
						className: "field",
						children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Name" }), /* @__PURE__ */ (0, U.jsx)("input", {
							value: a,
							onChange: (e) => o(e.target.value)
						})]
					}),
					/* @__PURE__ */ (0, U.jsxs)("label", {
						className: "field",
						children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Kategorie" }), /* @__PURE__ */ (0, U.jsx)("input", {
							value: s,
							onChange: (e) => c(e.target.value)
						})]
					}),
					/* @__PURE__ */ (0, U.jsxs)("label", {
						className: "field",
						children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Beschreibung" }), /* @__PURE__ */ (0, U.jsx)("input", {
							value: u,
							onChange: (e) => d(e.target.value)
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, U.jsx)(Oc, {
				items: f,
				templates: t,
				onChange: p
			}),
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "package-create-actions",
				children: [/* @__PURE__ */ (0, U.jsx)("button", {
					className: "secondary-button",
					onClick: v,
					disabled: m || t.length === 0 || f.length >= 12,
					children: "+ Grafik hinzufügen"
				}), /* @__PURE__ */ (0, U.jsx)("button", {
					className: "primary-button",
					onClick: () => void y(),
					disabled: m || f.length === 0,
					children: m ? "Speichert …" : "Paket-Draft speichern"
				})]
			})
		]
	});
}
function Oc({ items: e, templates: t, onChange: n }) {
	let r = t.flatMap((e) => e.publishedVersion ? [{
		template: e,
		version: e.publishedVersion
	}] : []), i = (t, r) => {
		n(e.map((e, n) => n === t ? {
			...e,
			...r
		} : e));
	}, a = (t) => {
		n(e.filter((e, n) => n !== t));
	};
	return /* @__PURE__ */ (0, U.jsxs)("div", {
		className: "package-items-editor",
		children: [/* @__PURE__ */ (0, U.jsx)("div", {
			className: "field-group-head",
			children: /* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("span", {
				className: "field-label",
				children: "Enthaltene Grafiken"
			}), /* @__PURE__ */ (0, U.jsxs)("small", { children: [e.length, " Slot(s)"] })] })
		}), e.length === 0 ? /* @__PURE__ */ (0, U.jsx)("p", {
			className: "empty-copy",
			children: "Noch keine Grafik hinzugefügt."
		}) : /* @__PURE__ */ (0, U.jsx)("div", {
			className: "package-item-list",
			children: e.map((e, t) => /* @__PURE__ */ (0, U.jsxs)("div", {
				className: "package-item-row",
				children: [
					/* @__PURE__ */ (0, U.jsxs)("label", {
						className: "field",
						children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Bezeichnung" }), /* @__PURE__ */ (0, U.jsx)("input", {
							value: e.label,
							onChange: (e) => i(t, { label: e.target.value })
						})]
					}),
					/* @__PURE__ */ (0, U.jsxs)("label", {
						className: "field",
						children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Slot" }), /* @__PURE__ */ (0, U.jsx)("input", {
							value: e.slotKey,
							onChange: (e) => i(t, { slotKey: e.target.value })
						})]
					}),
					/* @__PURE__ */ (0, U.jsxs)("label", {
						className: "field package-item-template",
						children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Vorlage" }), /* @__PURE__ */ (0, U.jsx)("select", {
							value: e.templateVersionId,
							onChange: (e) => i(t, { templateVersionId: e.target.value }),
							children: r.map(({ template: e, version: t }) => /* @__PURE__ */ (0, U.jsxs)("option", {
								value: t.id,
								children: [
									e.name,
									" · V",
									t.versionNumber,
									" ·",
									" ",
									t.format.width,
									"×",
									t.format.height
								]
							}, t.id))
						})]
					}),
					/* @__PURE__ */ (0, U.jsx)("button", {
						type: "button",
						className: "secondary-button compact-button danger-button",
						onClick: () => a(t),
						children: "Entfernen"
					})
				]
			}, `${t}-${e.slotKey}`))
		})]
	});
}
function kc(e) {
	return e.map((e) => ({
		slotKey: e.slotKey,
		label: e.label,
		templateVersionId: e.templateVersionId
	}));
}
function Ac(e, t) {
	return e.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "") || `grafik-${t + 1}`;
}
function jc(e) {
	let { width: t, height: n } = e.templateVersion.format;
	return `${t}×${n}`;
}
//#endregion
//#region src/components/TemplateBrowser.tsx
var Mc = (e, t) => `${e}x${t}`, Nc = (e, t) => Mo.find((n) => n.width === e && n.height === t)?.name ?? `${e} × ${t}`, Pc = (e) => {
	let t = new Intl.DateTimeFormat("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric"
	}).format(/* @__PURE__ */ new Date());
	return `${e.name} – ${t}`;
};
function Fc({ expertMode: e, onDraftCreated: t, initialEditing: n, onInitialEditingClosed: r, onEditingChange: i }) {
	let [a, o] = (0, l.useState)([]), [s, c] = (0, l.useState)("loading"), [u, d] = (0, l.useState)(null), [f, p] = (0, l.useState)(""), [m, h] = (0, l.useState)("ALL"), [g, _] = (0, l.useState)("ALL"), [v, y] = (0, l.useState)(!1), [b, x] = (0, l.useState)(null), [S, ee] = (0, l.useState)(n ?? null), [te, C] = (0, l.useState)("Neue Vorlage"), [ne, w] = (0, l.useState)("Allgemein"), [re, ie] = (0, l.useState)(""), [ae, oe] = (0, l.useState)("square"), [T, se] = (0, l.useState)(!1), ce = async () => {
		c("loading"), d(null);
		try {
			let t = await z.listTemplates(e);
			o(t.templates), c("ready");
		} catch (e) {
			console.error("Generator template list failed", e), d(B(e)), c("error");
		}
	};
	(0, l.useEffect)(() => {
		ce();
	}, [e]), (0, l.useEffect)(() => {
		i?.(!!S);
	}, [S, i]);
	let le = (0, l.useMemo)(() => Array.from(new Set(a.map((e) => e.category).filter(Boolean))).sort((e, t) => e.localeCompare(t, "de")), [a]), ue = (0, l.useMemo)(() => {
		let t = f.trim().toLocaleLowerCase("de");
		return a.filter((n) => {
			if (!e && (!n.isActive || !n.publishedVersion) || v && !n.isFavorite || m !== "ALL" && n.category !== m) return !1;
			let r = n.publishedVersion;
			return g !== "ALL" && (!r || Mc(r.format.width, r.format.height) !== g) ? !1 : !t || [
				n.name,
				n.category,
				n.description
			].some((e) => e.toLocaleLowerCase("de").includes(t));
		});
	}, [
		a,
		e,
		v,
		m,
		g,
		f
	]), de = async (e) => {
		x(e.id), d(null);
		try {
			let t = !e.isFavorite;
			await z.setTemplateFavorite(e.id, t), o((n) => n.map((n) => n.id === e.id ? {
				...n,
				isFavorite: t
			} : n));
		} catch (e) {
			d(B(e));
		} finally {
			x(null);
		}
	}, fe = async (e) => {
		if (e.publishedVersion) {
			x(e.id), d(null);
			try {
				t(await z.createDraftFromTemplate({
					title: Pc(e),
					templateId: e.id,
					versionId: e.publishedVersion.id
				}));
			} catch (e) {
				console.error("Template draft creation failed", e), d(B(e));
			} finally {
				x(null);
			}
		}
	}, pe = async (e) => {
		x(e.id), d(null);
		try {
			let t = e.draftVersion ? await z.getTemplate({
				templateId: e.id,
				versionId: e.draftVersion.id,
				mode: "DRAFT"
			}) : await z.beginTemplateDraft(e.id);
			ee(t);
		} catch (e) {
			console.error("Template draft open failed", e), d(B(e));
		} finally {
			x(null);
		}
	}, me = async (e) => {
		let t = e.draftVersion;
		if (t && window.confirm(`Vorlage „${e.name}“ als Version ${t.versionNumber} veröffentlichen?`)) {
			x(e.id), d(null);
			try {
				await z.publishTemplate({
					templateId: e.id,
					versionId: t.id,
					expectedRevision: t.revision
				}), await ce();
			} catch (e) {
				console.error("Template publish failed", e), d(B(e)), await ce();
			} finally {
				x(null);
			}
		}
	};
	return S ? /* @__PURE__ */ (0, U.jsx)(Lc, {
		initial: S,
		onClose: () => {
			ee(null), r?.(), ce();
		}
	}) : /* @__PURE__ */ (0, U.jsxs)("section", {
		className: "template-workspace",
		children: [/* @__PURE__ */ (0, U.jsxs)("section", {
			className: "panel template-browser-panel",
			children: [
				/* @__PURE__ */ (0, U.jsxs)("div", {
					className: "field-group-head",
					children: [/* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("p", {
						className: "panel-label",
						children: "Vorlagen"
					}), /* @__PURE__ */ (0, U.jsx)("h2", { children: "Vorlagen verwalten" })] }), /* @__PURE__ */ (0, U.jsx)("button", {
						className: "secondary-button compact-button",
						disabled: s === "loading",
						onClick: () => void ce(),
						children: "Aktualisieren"
					})]
				}),
				/* @__PURE__ */ (0, U.jsxs)("p", {
					className: "template-workflow-explainer",
					children: [
						/* @__PURE__ */ (0, U.jsx)("strong", { children: "Grafik aus Vorlage erstellen" }),
						" legt eine Einzelgrafik unter „Meine Entwürfe“ an. ",
						/* @__PURE__ */ (0, U.jsx)("strong", { children: "Vorlage bearbeiten" }),
						" erstellt dagegen einen neuen Vorlagenentwurf. Erst",
						/* @__PURE__ */ (0, U.jsx)("strong", { children: " Vorlage veröffentlichen" }),
						" aktiviert ihn für neue Grafiken."
					]
				}),
				/* @__PURE__ */ (0, U.jsxs)("div", {
					className: "template-filters",
					children: [
						/* @__PURE__ */ (0, U.jsxs)("label", {
							className: "field template-search",
							children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Suchen" }), /* @__PURE__ */ (0, U.jsx)("input", {
								type: "search",
								value: f,
								placeholder: "Name, Kategorie oder Beschreibung",
								onChange: (e) => p(e.target.value)
							})]
						}),
						/* @__PURE__ */ (0, U.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Kategorie" }), /* @__PURE__ */ (0, U.jsxs)("select", {
								value: m,
								onChange: (e) => h(e.target.value),
								children: [/* @__PURE__ */ (0, U.jsx)("option", {
									value: "ALL",
									children: "Alle"
								}), le.map((e) => /* @__PURE__ */ (0, U.jsx)("option", {
									value: e,
									children: e
								}, e))]
							})]
						}),
						/* @__PURE__ */ (0, U.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Format" }), /* @__PURE__ */ (0, U.jsxs)("select", {
								value: g,
								onChange: (e) => _(e.target.value),
								children: [/* @__PURE__ */ (0, U.jsx)("option", {
									value: "ALL",
									children: "Alle"
								}), Mo.map((e) => /* @__PURE__ */ (0, U.jsx)("option", {
									value: Mc(e.width, e.height),
									children: e.name
								}, e.code))]
							})]
						}),
						/* @__PURE__ */ (0, U.jsxs)("label", {
							className: "switch-row template-favorite-filter",
							children: [/* @__PURE__ */ (0, U.jsx)("input", {
								type: "checkbox",
								checked: v,
								onChange: (e) => y(e.target.checked)
							}), /* @__PURE__ */ (0, U.jsx)("span", { children: "Nur Favoriten" })]
						})
					]
				}),
				u ? /* @__PURE__ */ (0, U.jsx)("p", {
					className: "error-text",
					role: "alert",
					children: u
				}) : null,
				s === "loading" ? /* @__PURE__ */ (0, U.jsx)("p", { children: "Vorlagen werden geladen …" }) : ue.length === 0 ? /* @__PURE__ */ (0, U.jsx)("p", {
					className: "empty-copy",
					children: a.length === 0 ? "Noch keine Vorlagen vorhanden." : "Keine Vorlage passt zu den aktuellen Filtern."
				}) : /* @__PURE__ */ (0, U.jsx)("div", {
					className: "template-grid",
					children: ue.map((t) => /* @__PURE__ */ (0, U.jsx)(Ic, {
						template: t,
						expertMode: e,
						busy: b === t.id,
						onFavorite: () => void de(t),
						onCreateDraft: () => void fe(t),
						onEdit: () => void pe(t),
						onPublish: () => void me(t)
					}, t.id))
				})
			]
		}), e ? /* @__PURE__ */ (0, U.jsxs)("section", {
			className: "panel template-admin-panel",
			children: [/* @__PURE__ */ (0, U.jsxs)("div", { children: [
				/* @__PURE__ */ (0, U.jsx)("p", {
					className: "panel-label",
					children: "Expert-Modus"
				}),
				/* @__PURE__ */ (0, U.jsx)("h2", { children: "Neue Vorlage anlegen" }),
				/* @__PURE__ */ (0, U.jsx)("p", { children: "Neue Vorlagen starten als bearbeitbarer Draft und werden erst nach ausdrücklicher Veröffentlichung im normalen Browser nutzbar." })
			] }), /* @__PURE__ */ (0, U.jsxs)("form", {
				className: "template-create-form",
				onSubmit: async (e) => {
					e.preventDefault();
					let t = te.trim(), n = ne.trim(), r = Mo.find((e) => e.code === ae) ?? Mo[2];
					if (!t || !n) {
						d("Vorlagenname und Kategorie sind erforderlich.");
						return;
					}
					se(!0), d(null);
					try {
						let e = await z.createTemplate({
							name: t,
							category: n,
							description: re.trim(),
							document: Fo(t, r)
						});
						ee(e), C("Neue Vorlage"), ie(""), await ce();
					} catch (e) {
						console.error("Template create failed", e), d(B(e));
					} finally {
						se(!1);
					}
				},
				children: [
					/* @__PURE__ */ (0, U.jsxs)("label", {
						className: "field",
						children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Name" }), /* @__PURE__ */ (0, U.jsx)("input", {
							value: te,
							maxLength: 160,
							onChange: (e) => C(e.target.value)
						})]
					}),
					/* @__PURE__ */ (0, U.jsxs)("label", {
						className: "field",
						children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Kategorie" }), /* @__PURE__ */ (0, U.jsx)("input", {
							value: ne,
							maxLength: 80,
							onChange: (e) => w(e.target.value)
						})]
					}),
					/* @__PURE__ */ (0, U.jsxs)("label", {
						className: "field",
						children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Format" }), /* @__PURE__ */ (0, U.jsx)("select", {
							value: ae,
							onChange: (e) => oe(e.target.value),
							children: Mo.map((e) => /* @__PURE__ */ (0, U.jsxs)("option", {
								value: e.code,
								children: [
									e.name,
									" – ",
									e.width,
									" × ",
									e.height
								]
							}, e.code))
						})]
					}),
					/* @__PURE__ */ (0, U.jsxs)("label", {
						className: "field template-description-field",
						children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Beschreibung" }), /* @__PURE__ */ (0, U.jsx)("input", {
							value: re,
							maxLength: 2e3,
							onChange: (e) => ie(e.target.value)
						})]
					}),
					/* @__PURE__ */ (0, U.jsx)("button", {
						className: "primary-button",
						disabled: T,
						children: T ? "Wird angelegt …" : "Vorlagen-Draft anlegen"
					})
				]
			})]
		}) : null]
	});
}
function Ic({ template: e, expertMode: t, busy: n, onFavorite: r, onCreateDraft: i, onEdit: a, onPublish: o }) {
	let s = e.publishedVersion, c = e.draftVersion, l = t || !!e.systemKey, u = e.systemKey?.endsWith("_STORY") ? "STORY" : e.systemKey?.endsWith("_POST") ? "POST" : null;
	return /* @__PURE__ */ (0, U.jsxs)("article", {
		className: "template-card",
		children: [
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "template-card-head",
				children: [/* @__PURE__ */ (0, U.jsxs)("div", { children: [
					/* @__PURE__ */ (0, U.jsx)("span", {
						className: "template-category",
						children: e.category
					}),
					e.systemKey ? /* @__PURE__ */ (0, U.jsxs)("span", {
						className: "mode-badge",
						children: ["Systemvorlage", u ? ` · ${u}` : ""]
					}) : null,
					/* @__PURE__ */ (0, U.jsx)("h3", { children: e.name })
				] }), /* @__PURE__ */ (0, U.jsx)("button", {
					className: e.isFavorite ? "favorite-button favorite-button-active" : "favorite-button",
					disabled: n,
					onClick: r,
					"aria-label": e.isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen",
					title: e.isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen",
					children: e.isFavorite ? "★" : "☆"
				})]
			}),
			e.description ? /* @__PURE__ */ (0, U.jsx)("p", {
				className: "template-description",
				children: e.description
			}) : null,
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "template-card-meta",
				children: [
					s ? /* @__PURE__ */ (0, U.jsxs)(U.Fragment, { children: [/* @__PURE__ */ (0, U.jsxs)("span", { children: ["V", s.versionNumber] }), /* @__PURE__ */ (0, U.jsx)("span", { children: Nc(s.format.width, s.format.height) })] }) : /* @__PURE__ */ (0, U.jsx)("span", { children: "Noch nicht veröffentlicht" }),
					e.isActive ? null : /* @__PURE__ */ (0, U.jsx)("span", { children: "Deaktiviert" }),
					c ? /* @__PURE__ */ (0, U.jsxs)("span", { children: ["Vorlagenentwurf V", c.versionNumber] }) : null
				]
			}),
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "template-card-actions",
				children: [/* @__PURE__ */ (0, U.jsx)("button", {
					className: "primary-button compact-button",
					disabled: n || !s || !e.isActive,
					onClick: i,
					children: n ? "Bitte warten …" : "Grafik aus Vorlage erstellen"
				}), l ? /* @__PURE__ */ (0, U.jsxs)(U.Fragment, { children: [/* @__PURE__ */ (0, U.jsx)("button", {
					className: "secondary-button compact-button",
					disabled: n,
					onClick: a,
					children: c ? "Vorlagenentwurf bearbeiten" : "Vorlage bearbeiten"
				}), c ? /* @__PURE__ */ (0, U.jsx)("button", {
					className: "secondary-button compact-button",
					disabled: n,
					onClick: o,
					children: "Vorlage veröffentlichen"
				}) : null] }) : null]
			})
		]
	});
}
function Lc({ initial: e, onClose: t }) {
	let [n, r] = (0, l.useState)(e);
	return (0, l.useEffect)(() => {
		r(e);
	}, [e.version.id]), /* @__PURE__ */ (0, U.jsxs)("section", {
		className: "template-editor-wrap",
		children: [
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "template-editor-context",
				children: [
					/* @__PURE__ */ (0, U.jsxs)("span", {
						className: "mode-badge",
						children: ["Vorlage · Entwurf V", n.version.versionNumber]
					}),
					/* @__PURE__ */ (0, U.jsx)("span", { children: n.template.category }),
					n.template.systemKey ? /* @__PURE__ */ (0, U.jsxs)("span", {
						className: "mode-badge",
						children: ["Systembindung · ", n.template.systemKey]
					}) : null
				]
			}),
			/* @__PURE__ */ (0, U.jsxs)("p", {
				className: "template-editor-hint",
				children: [/* @__PURE__ */ (0, U.jsx)("strong", { children: "Du bearbeitest die Vorlage selbst." }), " Speichern sichert den Vorlagenentwurf, veröffentlicht ihn aber nicht. Schließe danach den Editor und wähle in der Vorlagenübersicht „Vorlage veröffentlichen“. Bereits erstellte Grafiken bleiben unverändert."]
			}),
			/* @__PURE__ */ (0, U.jsx)(Ks, {
				draft: Qa(n),
				persistence: {
					save: async (e) => {
						let t = await z.saveTemplateDraft({
							templateId: n.template.id,
							versionId: n.version.id,
							expectedRevision: e.expectedVersion,
							name: e.title,
							category: n.template.category,
							description: n.template.description,
							document: e.document
						});
						return r(t), Qa(t);
					},
					reload: async () => {
						let e = await z.getTemplate({
							templateId: n.template.id,
							versionId: n.version.id,
							mode: "DRAFT"
						});
						return r(e), Qa(e);
					},
					conflictMessage: "Dieser Vorlagen-Draft wurde zwischenzeitlich geändert. Lade die aktuelle Version neu; deine lokalen Änderungen werden nicht automatisch überschrieben.",
					logLabel: "Generator template draft"
				},
				editorLabel: "Vorlageneditor",
				onDraftChanged: () => void 0,
				onClose: t
			})
		]
	});
}
//#endregion
//#region src/components/DraftManager.tsx
var Rc = (e) => {
	let t = new Date(e);
	return Number.isNaN(t.valueOf()) ? e : new Intl.DateTimeFormat("de-DE", {
		dateStyle: "medium",
		timeStyle: "short"
	}).format(t);
}, zc = {
	matchday: {
		title: "Spieltag",
		description: "Zentrales Spiel wählen und eine Story- oder Post-Grafik starten."
	},
	fanbus: {
		title: "Fanbus",
		description: "Zentrale Fanbusfahrt wählen und einen Bus-Flyer starten."
	},
	create: {
		title: "Neue Grafik",
		description: "Eine freie Grafik ohne Vorlage anlegen."
	},
	drafts: {
		title: "Meine Entwürfe",
		description: "Vorhandene Arbeitsstände öffnen und weiterbearbeiten."
	},
	templates: {
		title: "Vorlagen",
		description: "Vorlagenversionen bearbeiten oder aus einer veröffentlichten Vorlage eine eigene Grafik erstellen."
	},
	packages: {
		title: "Pakete",
		description: "Zusammengehörige Grafiken gemeinsam bearbeiten."
	}
};
function Bc({ expertMode: e, onEditingChange: t }) {
	let [n, r] = (0, l.useState)([]), [i, a] = (0, l.useState)("loading"), [o, s] = (0, l.useState)(null), [c, u] = (0, l.useState)(null), [d, f] = (0, l.useState)(null), [p, m] = (0, l.useState)("home"), [h, g] = (0, l.useState)(!1), [_, v] = (0, l.useState)(null), [y, b] = (0, l.useState)(!1), [x, S] = (0, l.useState)(null), [ee, te] = (0, l.useState)("Neuer Entwurf"), [C, ne] = (0, l.useState)(Mo[0].code), [w, re] = (0, l.useState)(!1);
	(0, l.useEffect)(() => {
		t?.(c !== null || h || y);
	}, [
		c,
		h,
		y,
		t
	]);
	let ie = async () => {
		a("loading"), s(null);
		try {
			let e = await z.listDrafts();
			r(e.drafts), a("ready");
		} catch (e) {
			console.error("Generator draft list failed", e), s(B(e)), a("error");
		}
	};
	(0, l.useEffect)(() => {
		ie();
	}, []);
	let ae = (e) => {
		u(e), r((t) => [Za(e), ...t.filter((t) => t.id !== e.id)]), a("ready");
	}, oe = async (e) => {
		e.preventDefault();
		let t = ee.trim(), n = Mo.find((e) => e.code === C) ?? Mo[0];
		if (!t) {
			s("Bitte einen Titel eingeben.");
			return;
		}
		re(!0), s(null);
		try {
			let e = await z.createDraft(t, Fo(t, n));
			ae(e);
		} catch (e) {
			console.error("Generator draft create failed", e), s(B(e));
		} finally {
			re(!1);
		}
	}, T = async (e) => {
		S(e), s(null);
		try {
			u(await z.getDraft(e));
		} catch (e) {
			console.error("Generator draft open failed", e), s(B(e));
		} finally {
			S(null);
		}
	}, se = (e) => {
		u(e), r((t) => {
			let n = t.filter((t) => t.id !== e.id);
			return [Za(e), ...n];
		});
	}, ce = (e) => {
		u(null), v(e), m("templates");
	}, le = () => {
		u(null), d && z.getMediaPackage(d.id).then(f).catch((e) => {
			console.error("Media package refresh after draft close failed", e);
		});
	};
	if (c) return /* @__PURE__ */ (0, U.jsx)(Ks, {
		draft: c,
		onDraftChanged: se,
		onClose: le,
		onTemplateCreated: e ? ce : void 0,
		editorLabel: c.mediaPackageId ? "Medienpaket · Grafikeditor" : "Grafikeditor",
		bindingContext: c.mediaPackageId && d ? {
			...c.bindingContext,
			package: d.data
		} : c.bindingContext
	});
	if (d) return /* @__PURE__ */ (0, U.jsx)(yc, {
		initial: d,
		onClose: () => {
			f(null), m("packages"), ie();
		},
		onOpenDraft: (e) => void T(e),
		onChange: f
	});
	let ue = h || y, de = p === "home" ? null : zc[p];
	return /* @__PURE__ */ (0, U.jsx)("div", {
		className: "generator-manager",
		children: p === "home" ? /* @__PURE__ */ (0, U.jsxs)("section", {
			className: "generator-home",
			"aria-labelledby": "generator-home-title",
			children: [/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "generator-home-head",
				children: [/* @__PURE__ */ (0, U.jsx)("p", {
					className: "panel-label",
					children: "Was möchtest du machen?"
				}), /* @__PURE__ */ (0, U.jsx)("h2", {
					id: "generator-home-title",
					children: "Generator"
				})]
			}), /* @__PURE__ */ (0, U.jsxs)("div", {
				className: "generator-home-grid",
				children: [
					/* @__PURE__ */ (0, U.jsxs)("button", {
						type: "button",
						className: "generator-home-action generator-home-action-featured",
						onClick: () => m("matchday"),
						children: [
							/* @__PURE__ */ (0, U.jsx)("span", {
								className: "generator-home-action-number",
								children: "01"
							}),
							/* @__PURE__ */ (0, U.jsx)("strong", { children: "Spieltag" }),
							/* @__PURE__ */ (0, U.jsx)("span", { children: "Spiel auswählen und Grafik starten" })
						]
					}),
					/* @__PURE__ */ (0, U.jsxs)("button", {
						type: "button",
						className: "generator-home-action generator-home-action-featured",
						onClick: () => m("fanbus"),
						children: [
							/* @__PURE__ */ (0, U.jsx)("span", {
								className: "generator-home-action-number",
								children: "02"
							}),
							/* @__PURE__ */ (0, U.jsx)("strong", { children: "Fanbus" }),
							/* @__PURE__ */ (0, U.jsx)("span", { children: "Fahrt auswählen und Bus-Flyer starten" })
						]
					}),
					/* @__PURE__ */ (0, U.jsxs)("button", {
						type: "button",
						className: "generator-home-action",
						onClick: () => m("create"),
						children: [
							/* @__PURE__ */ (0, U.jsx)("span", {
								className: "generator-home-action-number",
								children: "03"
							}),
							/* @__PURE__ */ (0, U.jsx)("strong", { children: "Neue Grafik" }),
							/* @__PURE__ */ (0, U.jsx)("span", { children: "Freien Entwurf anlegen" })
						]
					}),
					/* @__PURE__ */ (0, U.jsxs)("button", {
						type: "button",
						className: "generator-home-action",
						onClick: () => m("drafts"),
						children: [
							/* @__PURE__ */ (0, U.jsx)("span", {
								className: "generator-home-action-number",
								children: "04"
							}),
							/* @__PURE__ */ (0, U.jsx)("strong", { children: "Meine Entwürfe" }),
							/* @__PURE__ */ (0, U.jsx)("span", { children: "Vorhandene Grafik öffnen" })
						]
					}),
					/* @__PURE__ */ (0, U.jsxs)("button", {
						type: "button",
						className: "generator-home-action",
						onClick: () => m("templates"),
						children: [
							/* @__PURE__ */ (0, U.jsx)("span", {
								className: "generator-home-action-number",
								children: "05"
							}),
							/* @__PURE__ */ (0, U.jsx)("strong", { children: "Vorlagen" }),
							/* @__PURE__ */ (0, U.jsx)("span", { children: "Mit fertigem Layout starten" })
						]
					}),
					/* @__PURE__ */ (0, U.jsxs)("button", {
						type: "button",
						className: "generator-home-action",
						onClick: () => m("packages"),
						children: [
							/* @__PURE__ */ (0, U.jsx)("span", {
								className: "generator-home-action-number",
								children: "06"
							}),
							/* @__PURE__ */ (0, U.jsx)("strong", { children: "Pakete" }),
							/* @__PURE__ */ (0, U.jsx)("span", { children: "Mehrere Grafiken zusammen bearbeiten" })
						]
					})
				]
			})]
		}) : /* @__PURE__ */ (0, U.jsxs)(U.Fragment, { children: [
			ue ? null : /* @__PURE__ */ (0, U.jsxs)("header", {
				className: "workspace-view-head",
				children: [/* @__PURE__ */ (0, U.jsx)("button", {
					type: "button",
					className: "secondary-button compact-button workspace-back-button",
					onClick: () => m("home"),
					children: "← Übersicht"
				}), /* @__PURE__ */ (0, U.jsxs)("div", { children: [
					/* @__PURE__ */ (0, U.jsx)("p", {
						className: "panel-label",
						children: "Generator"
					}),
					/* @__PURE__ */ (0, U.jsx)("h2", { children: de?.title }),
					/* @__PURE__ */ (0, U.jsx)("p", { children: de?.description })
				] })]
			}),
			p === "matchday" ? /* @__PURE__ */ (0, U.jsx)(fc, { onDraftCreated: ae }) : null,
			p === "fanbus" ? /* @__PURE__ */ (0, U.jsx)(vc, { onDraftCreated: ae }) : null,
			p === "create" ? /* @__PURE__ */ (0, U.jsxs)("section", {
				className: "panel create-panel focused-panel",
				"aria-labelledby": "create-title",
				children: [
					/* @__PURE__ */ (0, U.jsx)("p", {
						className: "panel-label",
						children: "Neue Grafik"
					}),
					/* @__PURE__ */ (0, U.jsx)("h2", {
						id: "create-title",
						children: "Freier Entwurf"
					}),
					/* @__PURE__ */ (0, U.jsxs)("form", {
						className: "create-form",
						onSubmit: (e) => void oe(e),
						children: [
							/* @__PURE__ */ (0, U.jsxs)("label", {
								className: "field",
								children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Titel" }), /* @__PURE__ */ (0, U.jsx)("input", {
									value: ee,
									maxLength: 160,
									onChange: (e) => te(e.target.value)
								})]
							}),
							/* @__PURE__ */ (0, U.jsxs)("label", {
								className: "field",
								children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Format" }), /* @__PURE__ */ (0, U.jsx)("select", {
									value: C,
									onChange: (e) => ne(e.target.value),
									children: Mo.map((e) => /* @__PURE__ */ (0, U.jsxs)("option", {
										value: e.code,
										children: [
											e.name,
											" – ",
											e.width,
											" × ",
											e.height
										]
									}, e.code))
								})]
							}),
							o ? /* @__PURE__ */ (0, U.jsx)("p", {
								className: "error-text",
								role: "alert",
								children: o
							}) : null,
							/* @__PURE__ */ (0, U.jsx)("button", {
								className: "primary-button",
								disabled: w,
								children: w ? "Wird angelegt …" : "Entwurf anlegen"
							})
						]
					})
				]
			}) : null,
			p === "drafts" ? /* @__PURE__ */ (0, U.jsxs)("section", {
				className: "panel draft-list-panel focused-panel",
				"aria-labelledby": "draft-list-title",
				children: [
					/* @__PURE__ */ (0, U.jsxs)("div", {
						className: "field-group-head",
						children: [/* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("p", {
							className: "panel-label",
							children: "Arbeitsstände"
						}), /* @__PURE__ */ (0, U.jsx)("h2", {
							id: "draft-list-title",
							children: "Meine Entwürfe"
						})] }), /* @__PURE__ */ (0, U.jsx)("button", {
							className: "secondary-button compact-button",
							disabled: i === "loading",
							onClick: () => void ie(),
							children: "Aktualisieren"
						})]
					}),
					o ? /* @__PURE__ */ (0, U.jsx)("p", {
						className: "error-text",
						role: "alert",
						children: o
					}) : null,
					i === "loading" ? /* @__PURE__ */ (0, U.jsx)("p", { children: "Entwürfe werden geladen …" }) : n.length === 0 ? /* @__PURE__ */ (0, U.jsx)("p", { children: "Noch keine Entwürfe vorhanden." }) : /* @__PURE__ */ (0, U.jsx)("ul", {
						className: "draft-list",
						children: n.map((e) => /* @__PURE__ */ (0, U.jsxs)("li", { children: [/* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("strong", { children: e.title }), /* @__PURE__ */ (0, U.jsxs)("span", { children: [
							"v",
							e.version,
							e.mediaPackageId ? ` · Paket: ${e.packageSlotKey ?? "Grafik"}` : e.templateVersionId ? " · Vorlage" : "",
							" · ",
							Rc(e.updatedAt)
						] })] }), /* @__PURE__ */ (0, U.jsx)("button", {
							className: "secondary-button compact-button",
							disabled: x !== null,
							onClick: () => void T(e.id),
							children: x === e.id ? "Lädt …" : "Öffnen"
						})] }, e.id))
					})
				]
			}) : null,
			p === "templates" ? /* @__PURE__ */ (0, U.jsx)(Fc, {
				expertMode: e,
				onDraftCreated: ae,
				initialEditing: _,
				onInitialEditingClosed: () => v(null),
				onEditingChange: g
			}) : null,
			p === "packages" ? /* @__PURE__ */ (0, U.jsx)(Tc, {
				expertMode: e,
				onMediaPackageOpen: f,
				onActivityChange: b
			}) : null
		] })
	});
}
//#endregion
//#region src/state/expert-mode-state.ts
var Vc = (e) => ({
	value: e,
	status: "saved"
});
function Hc(e, t) {
	switch (t.type) {
		case "saveStarted": return {
			...e,
			status: "saving",
			message: void 0
		};
		case "saveSucceeded": return {
			value: t.value,
			status: "saved"
		};
		case "saveFailed": return {
			...e,
			status: "error",
			message: t.message
		};
	}
}
//#endregion
//#region src/components/ExpertModeControl.tsx
function Uc({ initialValue: e, onValueChange: t }) {
	let [n, r] = (0, l.useReducer)(Hc, e, Vc), i = async (e) => {
		r({ type: "saveStarted" });
		try {
			let n = await z.updatePreferences(e);
			r({
				type: "saveSucceeded",
				value: n.preferences.expertMode
			}), t?.(n.preferences.expertMode);
		} catch (e) {
			console.error("Generator preferences update failed", e), r({
				type: "saveFailed",
				message: B(e)
			});
		}
	};
	return /* @__PURE__ */ (0, U.jsxs)("section", {
		className: "workspace-settings",
		"aria-labelledby": "expert-mode-title",
		children: [
			/* @__PURE__ */ (0, U.jsxs)("div", { children: [/* @__PURE__ */ (0, U.jsx)("strong", {
				id: "expert-mode-title",
				children: "Expert-Modus"
			}), /* @__PURE__ */ (0, U.jsx)("span", { children: "Zusätzliche Vorlagen- und Verwaltungsfunktionen anzeigen" })] }),
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "workspace-settings-actions",
				children: [/* @__PURE__ */ (0, U.jsxs)("label", {
					className: "switch-row",
					children: [/* @__PURE__ */ (0, U.jsx)("input", {
						type: "checkbox",
						checked: n.value,
						disabled: n.status === "saving",
						onChange: (e) => void i(e.target.checked)
					}), /* @__PURE__ */ (0, U.jsx)("span", { children: n.value ? "An" : "Aus" })]
				}), n.status === "saving" ? /* @__PURE__ */ (0, U.jsx)("span", {
					className: "settings-state",
					children: "Speichert …"
				}) : null]
			}),
			n.message ? /* @__PURE__ */ (0, U.jsx)("p", {
				className: "error-text",
				children: n.message
			}) : null
		]
	});
}
//#endregion
//#region src/lib/sticker-team-brand.ts
var Wc = /^#[0-9A-F]{6}$/;
function Gc(e) {
	let t = String(e ?? "").trim().toUpperCase();
	return Wc.test(t) ? t : null;
}
function Kc(e, t) {
	let n = Gc(e.primaryColor), r = Gc(e.secondaryColor), i = t ? Os(e, t) : Os(e);
	return !n || !r || !i ? null : {
		id: e.id,
		name: e.name,
		primaryColor: n,
		secondaryColor: r,
		colorSource: e.teamColorSource === "MANUAL" ? "MANUAL" : e.teamColorSource === "LOGO" ? "LOGO" : "UNSET",
		logoHref: i.href,
		logoVersion: i.sourceVersion
	};
}
var qc = /* @__PURE__ */ new Map();
function Jc(e) {
	let t = qc.get(e);
	if (t) return t;
	let n = new Promise((t, n) => {
		let r = new Image();
		r.crossOrigin = "anonymous", r.onload = () => t(r), r.onerror = () => n(/* @__PURE__ */ Error("PNG/Logo konnte nicht geladen werden: " + e.split("/").pop())), r.src = e;
	});
	return qc.set(e, n), n.catch(() => qc.delete(e)), n;
}
function Yc(e, t, n, r, i) {
	let a = e.getContext("2d");
	if (!a) throw Error("Canvas 2D ist nicht verfügbar");
	a.clearRect(0, 0, i, i), a.globalCompositeOperation = "source-over", a.drawImage(n, 0, 0, i, i), a.globalCompositeOperation = "source-in", a.fillStyle = r, a.fillRect(0, 0, i, i), a.globalCompositeOperation = "source-over", t.drawImage(e, 0, 0);
}
function Xc(e, t, n) {
	return new Promise((r, i) => {
		e.toBlob((e) => {
			e ? r(e) : i(/* @__PURE__ */ Error("Sticker-Export konnte nicht erstellt werden"));
		}, t, n);
	});
}
async function Zc(e, t) {
	let n = document.createElement("canvas");
	n.width = 512, n.height = 512;
	let r = n.getContext("2d", { alpha: !0 });
	if (!r) throw Error("Canvas-Export ist nicht verfügbar");
	if (r.drawImage(e, 0, 0, 512, 512), t === "image/png") return Xc(n, "image/png");
	for (let e of [
		.88,
		.76,
		.64,
		.52,
		.4,
		.32,
		.24,
		.18,
		.12,
		.08
	]) {
		let t = await Xc(n, "image/webp", e);
		if (t.type !== "image/webp") throw Error("Dieser Browser unterstützt keinen WebP-Export");
		if (t.size <= 102400) return t;
	}
	throw Error("WebP überschreitet 100 KiB. Bitte PNG prüfen; kein fehlerhaftes WebP ausgegeben.");
}
var Qc = {
	version: "tor-v3",
	size: 768,
	logoSlot: {
		x: 116,
		y: 181,
		w: 219,
		h: 192
	},
	registration: {
		backdrop: [
			"00_ice_neutral.png",
			[
				0,
				0,
				1254,
				1254
			],
			[
				12,
				12,
				744,
				744
			]
		],
		goal: [
			"10_hockey_goal_puck.png",
			[
				0,
				0,
				1254,
				1254
			],
			[
				118,
				8,
				610,
				610
			]
		],
		badge: [
			"20_logo_badge.png",
			[
				0,
				0,
				1254,
				1254
			],
			[
				59,
				119,
				335,
				335
			]
		],
		wordmark: [
			"30_toooor_chrome.png",
			[
				0,
				345,
				1254,
				940
			],
			[
				26,
				410,
				716,
				302
			]
		]
	},
	layers: {
		"00_ice_backdrop.png": {
			sha256: "1dfac6bb81d1eec4703a69e40df2d066732932e78ca9e597c86ff38c4b409bda",
			bytes: 774114
		},
		"01_goal_puck.png": {
			sha256: "9edc25d31edb9f400a9c9e689de362b3afa6c870b19f76d407a0ec5056af141f",
			bytes: 463735
		},
		"02_badge.png": {
			sha256: "df880c6e020f199a1285899e43f7e2870d276c2d2668f564b05cfd881c4630b0",
			bytes: 121354
		},
		"03_primary_mask.png": {
			sha256: "0e7c7cd431c59f4ec2f6670acdcc57b8da4eeba043a974e6bd514398fe97340e",
			bytes: 243281
		},
		"04_secondary_mask.png": {
			sha256: "0856ef3d4f049983b2905b81b5b4ae349453d1c74625c3028ff0cd3f5002061b",
			bytes: 227398
		},
		"05_wordmark_metal.png": {
			sha256: "30be1f0ded555797c0e9025bc8bfd6acef35f37153dfbf920657212973724f2e",
			bytes: 228954
		},
		"06_wordmark_primary_mask.png": {
			sha256: "53447918f54f05e485beb6a0214541accd4dfa47a5dfc1a5d79e5c9661851e5a",
			bytes: 118350
		},
		"07_wordmark_secondary_mask.png": {
			sha256: "8d32543fc2cd98f2bc611819ea5f73b645e9c54b8508c1cb16af72c7690c23e7",
			bytes: 12313
		},
		"08_specular.png": {
			sha256: "a46f5465e2606894832ff18043d32d449f82141dea26e683a16e2887887b4a01",
			bytes: 63328
		}
	}
}, $c = Qc.size, el = Qc.logoSlot, tl = [
	"00_ice_backdrop.png",
	"01_goal_puck.png",
	"02_badge.png",
	"03_primary_mask.png",
	"04_secondary_mask.png",
	"05_wordmark_metal.png",
	"06_wordmark_primary_mask.png",
	"07_wordmark_secondary_mask.png",
	"08_specular.png"
];
function nl(e, t = "/assets/generator-dev/embed/") {
	return t.replace(/\/?$/, "/") + "sticker/tor-v3/" + e;
}
function rl(e, t, n, r) {
	Yc(e, t, n, r, $c);
}
async function il(e, t, n = Jc, r) {
	let i = tl.map((e) => nl(e)), a = await Promise.all([...i.map(n), n(t.logoHref)]);
	if (r?.aborted) return;
	if (a.slice(0, tl.length).some((e) => e.naturalWidth !== $c || e.naturalHeight !== $c)) throw Error("Die TOR-PNG-Ebenen passen nicht zum registrierten Master");
	let o = a[a.length - 1];
	if (!o?.naturalWidth || !o.naturalHeight) throw Error("Original-Teamlogo ist nicht verfügbar");
	let s = e.getContext("2d", { alpha: !0 });
	if (!s) throw Error("Canvas 2D ist nicht verfügbar");
	e.width = $c, e.height = $c, s.clearRect(0, 0, $c, $c);
	let c = document.createElement("canvas");
	c.width = $c, c.height = $c, s.drawImage(a[0], 0, 0), s.drawImage(a[1], 0, 0), s.drawImage(a[2], 0, 0), rl(c, s, a[3], t.primaryColor), rl(c, s, a[4], t.secondaryColor);
	let l = el, u = Math.min(l.w / o.naturalWidth, l.h / o.naturalHeight), d = o.naturalWidth * u, f = o.naturalHeight * u;
	s.drawImage(o, l.x + (l.w - d) / 2, l.y + (l.h - f) / 2, d, f), s.drawImage(a[5], 0, 0), rl(c, s, a[6], t.primaryColor), rl(c, s, a[7], t.secondaryColor), s.drawImage(a[8], 0, 0);
}
var al = {
	version: "timeout-v1",
	size: 1254,
	sourceSha256: "62bede5d5fb007e9c95dcbdf1b346ed013023a879bfa9874be9b6cb8f9a5d7e9",
	layers: [
		"layers/00_ice_explosion_background_neutral.png",
		"layers/01_tactics_board_neutral.png",
		"layers/02_logo_badge_neutral.png",
		"layers/03_whistle_neutral.png",
		"layers/04_wordmark_neutral.png",
		"layers/05_puck_foreground_neutral.png"
	],
	masks: [
		{
			path: "masks/10_primary_badge_frame.png",
			color: "primaryColor",
			opacity: .85
		},
		{
			path: "masks/11_primary_tactics_board.png",
			color: "primaryColor",
			opacity: .85
		},
		{
			path: "masks/12_primary_whistle_trail.png",
			color: "primaryColor",
			opacity: .85
		},
		{
			path: "masks/13_primary_wordmark_edges.png",
			color: "primaryColor",
			opacity: .85
		},
		{
			path: "masks/14_secondary_ice_sparks.png",
			color: "secondaryColor",
			opacity: .85
		}
	],
	logoSlot: {
		x: 161,
		y: 250,
		w: 347,
		h: 299,
		fit: "contain",
		polygon: [
			[244, 256],
			[403, 250],
			[518, 335],
			[500, 482],
			[396, 553],
			[253, 549],
			[154, 461],
			[164, 336]
		]
	},
	files: {
		"layers/00_ice_explosion_background_neutral.png": {
			sha256: "67622f96d298f1bc0c929f724722266e81de82862fba6d818800b368e476c0d1",
			bytes: 348033
		},
		"layers/01_tactics_board_neutral.png": {
			sha256: "f1ea02e0ae820c1e400c253d86b7187638c1ad0521cbde8208be98bb5f5b86f4",
			bytes: 462961
		},
		"layers/02_logo_badge_neutral.png": {
			sha256: "fc0766c829460f313830e19bb45cab4080eeab2785a93f4923df485950cb117e",
			bytes: 371929
		},
		"layers/03_whistle_neutral.png": {
			sha256: "be8edc903b434809c0fed5333ca081dfa1ae56751afba881e18b7158dab1d8bc",
			bytes: 477464
		},
		"layers/04_wordmark_neutral.png": {
			sha256: "29888fd5b31a99d8bb0c399dc3c96ddb95c4c6fae9434bd52862c9985340c547",
			bytes: 1082751
		},
		"layers/05_puck_foreground_neutral.png": {
			sha256: "63dcaaf95e781635f1610b0773f5fcce7f36faebb601464e095c240ef7da8f0a",
			bytes: 230108
		},
		"masks/10_primary_badge_frame.png": {
			sha256: "0cd7073d1b2e954fcdf0a962d4156eb0ef9a4adb42e6174ad31eff8dc18cfdce",
			bytes: 59400
		},
		"masks/11_primary_tactics_board.png": {
			sha256: "c0822e20ab980d792e2452d10320501a01b8c4bcf0cacf51873f4e7ddf9c338a",
			bytes: 69771
		},
		"masks/12_primary_whistle_trail.png": {
			sha256: "f1cb543825fb23397255f0bb904b7a9e2db41c9c767b80c3f086d24bc773ff04",
			bytes: 86751
		},
		"masks/13_primary_wordmark_edges.png": {
			sha256: "1c303697b4aa0d38160f62331df4aa5e1ce79965d932a2d7ed2dfd6992ee352f",
			bytes: 175639
		},
		"masks/14_secondary_ice_sparks.png": {
			sha256: "fa8ea1dbf887eba3a93c7c8a6f4e27be011cd5c982f882ba262a3af04edef54f",
			bytes: 137277
		}
	}
}, ol = al.size, sl = al.logoSlot;
al.layers, al.masks;
function cl(e, t = "/assets/generator-dev/embed/") {
	return t.replace(/\/?$/, "/") + "sticker/timeout-v1/" + e;
}
async function ll(e, t, n = Jc, r) {
	let i = [...al.layers, ...al.masks.map((e) => e.path)], a = await Promise.all([...i.map((e) => n(cl(e))), n(t.logoHref)]);
	if (r?.aborted) return;
	if (a.slice(0, i.length).some((e) => e.naturalWidth !== ol || e.naturalHeight !== ol)) throw Error("Die TIMEOUT-PNG-Ebenen passen nicht zum registrierten Master");
	let o = a[i.length];
	if (!o?.naturalWidth || !o.naturalHeight) throw Error("Original-Teamlogo ist nicht verfügbar");
	let s = e.getContext("2d", { alpha: !0 });
	if (!s) throw Error("Canvas 2D ist nicht verfügbar");
	e.width = e.height = ol;
	for (let e = 0; e < al.layers.length; e++) s.drawImage(a[e], 0, 0);
	let c = document.createElement("canvas");
	c.width = c.height = ol, s.save();
	for (let [e, n] of al.masks.entries()) s.globalAlpha = n.opacity, Yc(c, s, a[al.layers.length + e], n.color === "primaryColor" ? t.primaryColor : t.secondaryColor, ol);
	s.restore();
	let l = sl, u = Math.min(l.w / o.naturalWidth, l.h / o.naturalHeight), d = o.naturalWidth * u, f = o.naturalHeight * u;
	s.save(), s.beginPath(), l.polygon.forEach(([e, t], n) => n === 0 ? s.moveTo(e, t) : s.lineTo(e, t)), s.closePath(), s.clip(), s.globalCompositeOperation = "destination-over", s.drawImage(o, l.x + (l.w - d) / 2, l.y + (l.h - f) / 2, d, f), s.restore();
}
var ul = {
	name: "Empty Net PNG Master V1 – Bayreuth-style registered cutouts",
	type: "empty-net-png-masked-v1",
	created: "2026-11-04",
	reference: "source/bayreuth_empty_net_reference.png",
	reference_sha256: "a4806c1ae4530ced72fca1007692a1431821426228467cf21d98c056fd4ad429",
	dimensions: [1254, 1254],
	team_data_source: "central DEV social_media_generator_media_teams_list; no secondary database",
	source_logo_removed_from_production_layers: !0,
	logo_slot: {
		x: 161,
		y: 270,
		width: 400,
		height: 378,
		fit: "contain",
		original_only: !0
	},
	limitations: [
		"registered cutouts of flattened approved reference; hidden art cannot be reconstructed",
		"not freely relocatable Photoshop layers",
		"color masks are automated proposals and require final visual review",
		"gold is NOT a fixed team color; each mapped highlight is separately tintable",
		"badge source includes neutralized metallic accents and is independent of team logo",
		"the two sample colors/logos are previews; runtime must load the central DEV records"
	],
	draw_order: [
		"layers/00_crystal_ice_background.png",
		"layers/00a_badge_under_shadow.png",
		"layers/01_ice_crystal_shards_neutral.png",
		"masks/10_primary_ice_sparks.png",
		"masks/13_secondary_ice_sparkles.png",
		"layers/02_empty_goal_net_neutral.png",
		"masks/11_primary_goal_frame.png",
		"layers/03_metal_octagon_badge_neutral.png",
		"masks/15_primary_badge_neon.png",
		"DYNAMIC_ORIGINAL_TEAM_LOGO (contain, manifest logo_slot)",
		"layers/04_empty_net_chrome_wordmark_neutral.png",
		"masks/12_primary_empty_net_wordmark.png",
		"masks/14_secondary_wordmark_reflections.png"
	],
	mask_technology: "RGBA white with actual varying alpha, source-in color per central team; retain highlight shading",
	files: [
		{
			path: "layers/00_crystal_ice_background.png",
			size: 2693928,
			sha256: "4db156cfc72904050659fb086e721fb2246c3b611fa32bc94380db2f79369f56",
			width: 1254,
			height: 1254,
			mode: "RGBA"
		},
		{
			path: "layers/00a_badge_under_shadow.png",
			size: 78502,
			sha256: "a408d3a74e6a241d6f928f9ed46b44d2d9df5742ca02d271f8846b037579d2d5",
			width: 1254,
			height: 1254,
			mode: "RGBA"
		},
		{
			path: "layers/01_ice_crystal_shards_neutral.png",
			size: 170765,
			sha256: "3c7949c79e71a85692fa20124d51c6206f8dd0bb09f1700bc155fbebe4f354a7",
			width: 1254,
			height: 1254,
			mode: "RGBA"
		},
		{
			path: "layers/02_empty_goal_net_neutral.png",
			size: 628130,
			sha256: "9e06975aae539175feb1f4e0487b03ec5297e4986913a12885cfa7919b822f33",
			width: 1254,
			height: 1254,
			mode: "RGBA"
		},
		{
			path: "layers/03_metal_octagon_badge_neutral.png",
			size: 556566,
			sha256: "2a531097316f3ee97c3f3842ebff5003d3b03ca47b2703b9d3be9ce590474f0e",
			width: 1254,
			height: 1254,
			mode: "RGBA"
		},
		{
			path: "layers/04_empty_net_chrome_wordmark_neutral.png",
			size: 1163506,
			sha256: "9d0dcf7ed90652a995edf0f99777884d9a509605230703a025dc1172c812a603",
			width: 1254,
			height: 1254,
			mode: "RGBA"
		},
		{
			path: "masks/10_primary_ice_sparks.png",
			size: 22534,
			sha256: "e4e5605b82caddcb06144c43a704ad8516f0fc503b5b3d6c91b8614a02243d4b",
			width: 1254,
			height: 1254,
			mode: "RGBA"
		},
		{
			path: "masks/11_primary_goal_frame.png",
			size: 62387,
			sha256: "df3af7245f48389fb49a5c6ac57ec5b4824c0f6de11163913d1c77cd1db9812a",
			width: 1254,
			height: 1254,
			mode: "RGBA"
		},
		{
			path: "masks/12_primary_empty_net_wordmark.png",
			size: 221170,
			sha256: "356e20ff3ee5f6f69300a070ab6f0e3c5009eec060f6615fdc8e7f04a1b6297c",
			width: 1254,
			height: 1254,
			mode: "RGBA"
		},
		{
			path: "masks/13_secondary_ice_sparkles.png",
			size: 20905,
			sha256: "6bb206d4c7be9d468609a21f3d3a018aae55a2213163347af386baefd84ff44f",
			width: 1254,
			height: 1254,
			mode: "RGBA"
		},
		{
			path: "masks/14_secondary_wordmark_reflections.png",
			size: 166820,
			sha256: "225658061f47b75c2ae83dbb73a256c3da59f124756121713b52ce920aacc480",
			width: 1254,
			height: 1254,
			mode: "RGBA"
		},
		{
			path: "masks/15_primary_badge_neon.png",
			size: 263315,
			sha256: "efe71ecf39885ed2eff98c9cb1a75f859626ffe9f641e1690f6319ecc97b3cba",
			width: 1254,
			height: 1254,
			mode: "RGBA"
		}
	]
}, dl = ul.dimensions[0], fl = ul.logo_slot;
ul.draw_order, ul.files;
var pl = /* @__PURE__ */ new Set(["masks/13_secondary_ice_sparkles.png", "masks/14_secondary_wordmark_reflections.png"]);
function ml(e, t = "/assets/generator-dev/embed/") {
	return t.replace(/\/?$/, "/") + "sticker/empty-net-v1/" + e;
}
async function hl(e, t, n = Jc, r) {
	let i = ul.files.map((e) => e.path), a = await Promise.all([...i.map((e) => n(ml(e))), n(t.logoHref)]);
	if (r?.aborted) return;
	if (a.slice(0, i.length).some((e) => e.naturalWidth !== dl || e.naturalHeight !== dl)) throw Error("Die EMPTY-NET-PNG-Ebenen passen nicht zum registrierten Master");
	let o = a[i.length];
	if (!o?.naturalWidth || !o.naturalHeight) throw Error("Original-Teamlogo ist nicht verfügbar");
	let s = e.getContext("2d", { alpha: !0 });
	if (!s) throw Error("Canvas 2D ist nicht verfügbar");
	e.width = e.height = dl;
	let c = new Map(i.map((e, t) => [e, a[t]])), l = document.createElement("canvas");
	l.width = l.height = dl;
	for (let e of ul.draw_order) {
		if (e.startsWith("DYNAMIC_ORIGINAL_TEAM_LOGO")) {
			let e = fl, t = Math.min(e.width / o.naturalWidth, e.height / o.naturalHeight), n = o.naturalWidth * t, r = o.naturalHeight * t;
			s.drawImage(o, e.x + (e.width - n) / 2, e.y + (e.height - r) / 2, n, r);
			continue;
		}
		let n = c.get(e);
		if (!n) throw Error("Unbekannte EMPTY-NET-Ebene im Master: " + e);
		e.startsWith("masks/") ? Yc(l, s, n, pl.has(e) ? t.secondaryColor : t.primaryColor, dl) : s.drawImage(n, 0, 0);
	}
}
var gl = {
	schemaVersion: 1,
	stickerType: "STRAFE",
	environment: "DEV-only",
	canvas: {
		width: 1254,
		height: 1254,
		mode: "RGBA"
	},
	targetExport: {
		width: 512,
		height: 512,
		webpMaxBytes: 102400,
		transparent: !0
	},
	sourceOfTruth: {
		teamLogo: "central DEV team original logo via existing resolver",
		colors: "central DEV team primaryColor / secondaryColor"
	},
	logo_slot: {
		center_x: 324,
		center_y: 433,
		max_width: 360,
		max_height: 352,
		fit: "contain",
		logo_source: "original central team logo only"
	},
	text: "STRAFE!",
	penalty_minutes: !1,
	mask_mode: "white RGB + alpha; tint via source-in; draw at 0,0 full 1254x1254",
	draw_order: [
		{ layer: "layers/00_ice_and_arena_backdrop_registered.png" },
		{ layer: "layers/00a_crystal_ice_behind_badge.png" },
		{ layer: "layers/01_referee_and_arm_registered.png" },
		{ layer: "layers/02_rink_and_boards_registered.png" },
		{
			mask: "masks/10_primary_arena_neon.png",
			color: "primaryColor"
		},
		{
			mask: "masks/12_primary_ice_crystal_sparks.png",
			color: "primaryColor"
		},
		{ layer: "layers/03_chrome_badge_logo_slot_neutral.png" },
		{
			mask: "masks/13_primary_badge_chrome_light.png",
			color: "primaryColor"
		},
		{ original_team_logo: "logo_slot" },
		{ layer: "layers/04_metal_strafe_wordmark_registered.png" },
		{
			mask: "masks/11_primary_strafe_metal_rim.png",
			color: "primaryColor"
		},
		{
			mask: "masks/15_secondary_wordmark_specular.png",
			color: "secondaryColor"
		},
		{ layer: "layers/05_puck_and_trail_registered.png" },
		{
			mask: "masks/14_secondary_ice_reflections.png",
			color: "secondaryColor"
		}
	],
	assets: [
		{
			path: "layers/00_ice_and_arena_backdrop_registered.png",
			kind: "layer",
			sha256: "a22678482ff4e01b1b4a8870fd36939e4995bd8fe0bca8de815770beb377498f",
			bytes: 320216
		},
		{
			path: "layers/00a_crystal_ice_behind_badge.png",
			kind: "layer",
			sha256: "ae62cf5b5262938f218f0c844e68a89bdf63eb90ac917e488f429036f13834d1",
			bytes: 681937
		},
		{
			path: "layers/01_referee_and_arm_registered.png",
			kind: "layer",
			sha256: "d3b8669fe5761277626f8be5c01221622273c21159d9034e919a980d6b3fef70",
			bytes: 1021220
		},
		{
			path: "layers/02_rink_and_boards_registered.png",
			kind: "layer",
			sha256: "b7cd51c792a82793d82a1383d1a7a2a39df0135560ce29d969dedb1a0034566f",
			bytes: 32628
		},
		{
			path: "layers/03_chrome_badge_logo_slot_neutral.png",
			kind: "layer",
			sha256: "de5ded789d5bf6180223f6d126e0dc6afb1ad2e9c74de59e3a7edaaa21c61da5",
			bytes: 584401
		},
		{
			path: "layers/04_metal_strafe_wordmark_registered.png",
			kind: "layer",
			sha256: "a17634ea2db1eaaa39819f2b9313fe2e0627f718ba3816a89b38bf83a1724761",
			bytes: 1045744
		},
		{
			path: "layers/05_puck_and_trail_registered.png",
			kind: "layer",
			sha256: "6c74dfb84d2f394e8389ba4454275ec3d4f75766208990706c85ca35fcbd01e5",
			bytes: 239447
		},
		{
			path: "masks/10_primary_arena_neon.png",
			kind: "color_mask",
			sha256: "4a928850175053da7f332503196dddb9af6b1ed4aba7ced52d9664a278245739",
			bytes: 151263
		},
		{
			path: "masks/11_primary_strafe_metal_rim.png",
			kind: "color_mask",
			sha256: "8f0802b3a131398a8cad79982cd4edd14e748829375f6367d1356d6952d043cb",
			bytes: 264475
		},
		{
			path: "masks/12_primary_ice_crystal_sparks.png",
			kind: "color_mask",
			sha256: "ea73085ac66f05599c9f3c5eff40a207f34d13d0ebc9aa511393c0f6ef0e4a9b",
			bytes: 149644
		},
		{
			path: "masks/13_primary_badge_chrome_light.png",
			kind: "color_mask",
			sha256: "ff02b21c4fe8d4e2b0f6cec00889909f3cd0c0d4ba49931632022aa690d1e7dd",
			bytes: 134644
		},
		{
			path: "masks/14_secondary_ice_reflections.png",
			kind: "color_mask",
			sha256: "e5f16624f7c7859efd801b970182765570df5f5d70a94206c83e1b268053791f",
			bytes: 74493
		},
		{
			path: "masks/15_secondary_wordmark_specular.png",
			kind: "color_mask",
			sha256: "c163d5a39587c05f18c1b7ac4bcdf99654e6a1b85c8f5298248c3a0926b6693f",
			bytes: 33040
		}
	],
	demoOnly: {
		clubNames: ["Mighty Dogs Schweinfurt", "EHC Königsbrunn"],
		colors: ["#3246FA/#FCFCFC", "#991B1B/#181D24"],
		originalLogosIncludedForTestOnly: !0
	},
	notes: [
		"Registered cutouts of a flattened detailed PNG; not original independently editable artwork.",
		"Existing illustrated logo scrubbed from production fragments; badge is a separate neutral art asset.",
		"Mask intensity and visual fidelity must be approved on DEV; do not independently move registered fragments.",
		"Schiedsrichter-Armbinde stays orange regardless of team color.",
		"No penalty minutes and no production deployment implied."
	]
}, _l = gl.canvas.width, W = gl.logo_slot;
gl.draw_order, gl.assets;
function vl(e, t = "/assets/generator-dev/embed/") {
	return t.replace(/\/?$/, "/") + "sticker/strafe-v1/" + e;
}
async function yl(e, t, n = Jc, r) {
	let i = gl.assets.map((e) => e.path), a = await Promise.all([...i.map((e) => n(vl(e))), n(t.logoHref)]);
	if (r?.aborted) return;
	if (a.slice(0, i.length).some((e) => e.naturalWidth !== _l || e.naturalHeight !== _l)) throw Error("Die STRAFE-PNG-Ebenen passen nicht zum registrierten Master");
	let o = a[i.length];
	if (!o?.naturalWidth || !o.naturalHeight) throw Error("Original-Teamlogo ist nicht verfügbar");
	let s = e.getContext("2d", { alpha: !0 });
	if (!s) throw Error("Canvas 2D ist nicht verfügbar");
	e.width = e.height = _l;
	let c = new Map(i.map((e, t) => [e, a[t]])), l = document.createElement("canvas");
	l.width = l.height = _l;
	for (let e of gl.draw_order) {
		if ("original_team_logo" in e) {
			let e = W, t = Math.min(e.max_width / o.naturalWidth, e.max_height / o.naturalHeight), n = o.naturalWidth * t, r = o.naturalHeight * t;
			s.drawImage(o, e.center_x - n / 2, e.center_y - r / 2, n, r);
			continue;
		}
		if ("layer" in e && e.layer) {
			let t = c.get(e.layer);
			if (!t) throw Error("Unbekannte STRAFE-Ebene im Master: " + e.layer);
			s.drawImage(t, 0, 0);
			continue;
		}
		if ("mask" in e && e.mask) {
			let n = c.get(e.mask);
			if (!n) throw Error("Unbekannte STRAFE-Ebene im Master: " + e.mask);
			Yc(l, s, n, e.color === "primaryColor" ? t.primaryColor : t.secondaryColor, _l);
			continue;
		}
		throw Error("Ungültiger STRAFE-Zeichenschritt im Master");
	}
}
//#endregion
//#region src/components/StickerPngPreview.tsx
var bl = {
	TOR: il,
	TIMEOUT: ll,
	"EMPTY NET": hl,
	STRAFE: yl
}, xl = {
	TOR: $c,
	TIMEOUT: ol,
	"EMPTY NET": dl,
	STRAFE: _l
};
function Sl(e, t, n) {
	let r = t.toLocaleLowerCase("de").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
	return e.toLowerCase().replace(/\s+/g, "-") + "-" + r + "." + n;
}
function Cl({ brand: e, motif: t }) {
	let n = (0, l.useRef)(null), [r, i] = (0, l.useState)(!1), [a, o] = (0, l.useState)(""), [s, c] = (0, l.useState)(!1);
	(0, l.useEffect)(() => {
		let r = !0, a = new AbortController();
		i(!1), o("");
		let s = n.current;
		if (s) return bl[t](s, e, void 0, a.signal).then(() => {
			r && i(!0);
		}).catch((e) => {
			r && o(e instanceof Error ? e.message : "Sticker-Renderfehler");
		}), () => {
			r = !1, a.abort();
		};
	}, [
		t,
		e.id,
		e.logoHref,
		e.logoVersion,
		e.primaryColor,
		e.secondaryColor
	]);
	let u = async (i) => {
		if (r && !s && n.current) {
			c(!0), o("");
			try {
				let r = await Zc(n.current, i === "png" ? "image/png" : "image/webp"), a = URL.createObjectURL(r), o = document.createElement("a");
				o.href = a, o.download = Sl(t, e.name, i), document.body.appendChild(o), o.click(), o.remove(), window.setTimeout(() => URL.revokeObjectURL(a), 4e3);
			} catch (e) {
				o(e instanceof Error ? e.message : "Export fehlgeschlagen");
			} finally {
				c(!1);
			}
		}
	};
	return /* @__PURE__ */ (0, U.jsxs)("div", {
		className: "sticker-render-area",
		children: [
			/* @__PURE__ */ (0, U.jsx)("canvas", {
				ref: n,
				width: xl[t],
				height: xl[t],
				className: "sticker-tor-preview",
				role: "img",
				"aria-label": t + "-Sticker für " + e.name
			}),
			!r && !a ? /* @__PURE__ */ (0, U.jsx)("small", {
				role: "status",
				children: "PNG-Ebenen werden geladen …"
			}) : null,
			a ? /* @__PURE__ */ (0, U.jsx)("p", {
				role: "alert",
				className: "sticker-prototype-note",
				children: a
			}) : null,
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "sticker-export-actions",
				children: [/* @__PURE__ */ (0, U.jsx)("button", {
					type: "button",
					disabled: !r || s,
					onClick: () => void u("png"),
					children: "PNG 512 × 512"
				}), /* @__PURE__ */ (0, U.jsx)("button", {
					type: "button",
					disabled: !r || s,
					onClick: () => void u("webp"),
					children: "WhatsApp-WebP"
				})]
			})
		]
	});
}
//#endregion
//#region src/components/StickerWorkspace.tsx
function wl({ brand: e, motif: t }) {
	return /* @__PURE__ */ (0, U.jsxs)("article", {
		className: "sticker-brand-card",
		children: [
			/* @__PURE__ */ (0, U.jsx)(Cl, {
				brand: e,
				motif: t
			}),
			/* @__PURE__ */ (0, U.jsx)("h3", { children: e.name }),
			/* @__PURE__ */ (0, U.jsxs)("div", {
				className: "sticker-brand-colors",
				children: [/* @__PURE__ */ (0, U.jsxs)("span", { children: [/* @__PURE__ */ (0, U.jsx)("i", {
					style: { backgroundColor: e.primaryColor },
					"aria-hidden": "true"
				}), e.primaryColor] }), /* @__PURE__ */ (0, U.jsxs)("span", { children: [/* @__PURE__ */ (0, U.jsx)("i", {
					style: { backgroundColor: e.secondaryColor },
					"aria-hidden": "true"
				}), e.secondaryColor] })]
			}),
			/* @__PURE__ */ (0, U.jsxs)("small", { children: ["Original-Logo · ", e.colorSource === "MANUAL" ? "manuell korrigierte Teamfarben" : "aus Logo abgeleitete Teamfarben"] })
		]
	});
}
function Tl() {
	let [e, t] = (0, l.useState)([]), [n, r] = (0, l.useState)(!0), [i, a] = (0, l.useState)(""), [o, s] = (0, l.useState)(""), [c, u] = (0, l.useState)("TOR");
	(0, l.useEffect)(() => {
		let e = !0;
		return z.listTeamMedia().then((n) => {
			e && t(n);
		}).catch((t) => {
			e && a(B(t));
		}).finally(() => {
			e && r(!1);
		}), () => {
			e = !1;
		};
	}, []);
	let d = (0, l.useMemo)(() => e.filter((e) => e.active).map((e) => Kc(e)).filter((e) => e !== null), [e]), f = e.find((e) => e.homeClub)?.id, p = d.find((e) => e.id === f), m = d.filter((e) => e.id !== f), h = m.find((e) => e.name.toLowerCase().includes("königsbrunn")) ?? m[0], g = m.find((e) => e.id === o) ?? h;
	return /* @__PURE__ */ (0, U.jsxs)("section", {
		className: "panel sticker-workspace",
		"aria-label": "Sticker-Technikmuster DEV",
		children: [
			/* @__PURE__ */ (0, U.jsx)("p", {
				className: "panel-label",
				children: "Sticker · DEV"
			}),
			/* @__PURE__ */ (0, U.jsx)("h2", { children: "Sticker-Vorschau" }),
			/* @__PURE__ */ (0, U.jsx)("p", { children: "Wähle ein Motiv und vergleiche deine Mannschaft mit einem Gegner. Die Vorschauen verwenden die zentral gespeicherten Vereinsfarben und Original-Logos." }),
			/* @__PURE__ */ (0, U.jsx)("p", {
				className: "sticker-prototype-note",
				children: "DEV-Vorschau zur gestalterischen Abnahme. PNG- und WhatsApp-WebP-Downloads sind verfügbar."
			}),
			/* @__PURE__ */ (0, U.jsxs)("label", {
				className: "field sticker-team-select",
				children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Motiv" }), /* @__PURE__ */ (0, U.jsxs)("select", {
					value: c,
					onChange: (e) => u(e.target.value),
					children: [
						/* @__PURE__ */ (0, U.jsx)("option", {
							value: "TOR",
							children: "TOR"
						}),
						/* @__PURE__ */ (0, U.jsx)("option", {
							value: "TIMEOUT",
							children: "TIMEOUT"
						}),
						/* @__PURE__ */ (0, U.jsx)("option", {
							value: "EMPTY NET",
							children: "EMPTY NET"
						}),
						/* @__PURE__ */ (0, U.jsx)("option", {
							value: "STRAFE",
							children: "STRAFE"
						})
					]
				})]
			}),
			n ? /* @__PURE__ */ (0, U.jsx)("p", {
				role: "status",
				children: "Lade Teamlogos und Farben …"
			}) : i ? /* @__PURE__ */ (0, U.jsx)("p", {
				role: "alert",
				children: i
			}) : p ? /* @__PURE__ */ (0, U.jsxs)(U.Fragment, { children: [/* @__PURE__ */ (0, U.jsxs)("label", {
				className: "field sticker-team-select",
				children: [/* @__PURE__ */ (0, U.jsx)("span", { children: "Vergleichsgegner" }), /* @__PURE__ */ (0, U.jsx)("select", {
					value: g?.id ?? "",
					onChange: (e) => s(e.target.value),
					children: m.map((e) => /* @__PURE__ */ (0, U.jsx)("option", {
						value: e.id,
						children: e.name
					}, e.id))
				})]
			}), /* @__PURE__ */ (0, U.jsxs)("div", {
				className: "sticker-brand-comparison",
				children: [/* @__PURE__ */ (0, U.jsx)(wl, {
					brand: p,
					motif: c
				}), g ? /* @__PURE__ */ (0, U.jsx)(wl, {
					brand: g,
					motif: c
				}) : null]
			})] }) : /* @__PURE__ */ (0, U.jsx)("p", {
				role: "alert",
				children: "Für die Mighty Dogs fehlen Original-Logo oder gültige Teamfarben."
			})
		]
	});
}
//#endregion
//#region src/components/GeneratorWorkspace.tsx
function El({ bootstrap: e }) {
	let [t, n] = (0, l.useState)(e.preferences.expertMode), [r, i] = (0, l.useState)(!1), [a, o] = (0, l.useState)("graphics");
	return /* @__PURE__ */ (0, U.jsxs)("div", {
		className: "generator-workspace",
		children: [
			r ? null : /* @__PURE__ */ (0, U.jsxs)("section", {
				className: "workspace-overview",
				"aria-label": "Generator-Arbeitsbereich",
				children: [/* @__PURE__ */ (0, U.jsxs)("div", { children: [
					/* @__PURE__ */ (0, U.jsx)("p", {
						className: "panel-label",
						children: "Arbeitsbereich"
					}),
					/* @__PURE__ */ (0, U.jsx)("h2", { children: "Grafik erstellen" }),
					/* @__PURE__ */ (0, U.jsx)("p", {
						className: "workspace-subtitle",
						children: "Wähle zuerst, womit du arbeiten möchtest. Es wird immer nur der aktuell benötigte Bereich angezeigt."
					})
				] }), /* @__PURE__ */ (0, U.jsxs)("div", {
					className: "workspace-user-chip",
					children: [/* @__PURE__ */ (0, U.jsx)("span", { children: e.user.displayName || "Social-Media-Team" }), /* @__PURE__ */ (0, U.jsx)("span", {
						className: "access-badge",
						children: "DEV aktiv"
					})]
				})]
			}),
			r ? null : /* @__PURE__ */ (0, U.jsxs)("nav", {
				className: "sticker-workspace-tabs",
				"aria-label": "Generator-Arbeitsbereiche",
				children: [/* @__PURE__ */ (0, U.jsx)("button", {
					type: "button",
					"aria-pressed": a === "graphics",
					onClick: () => o("graphics"),
					children: "Grafiken und Vorlagen"
				}), /* @__PURE__ */ (0, U.jsx)("button", {
					type: "button",
					"aria-pressed": a === "stickers",
					onClick: () => o("stickers"),
					children: "Sticker-Master (DEV-Prototyp)"
				})]
			}),
			a === "graphics" && !r ? /* @__PURE__ */ (0, U.jsx)(Uc, {
				initialValue: e.preferences.expertMode,
				onValueChange: n
			}) : null,
			/* @__PURE__ */ (0, U.jsx)("div", {
				hidden: a !== "graphics",
				children: /* @__PURE__ */ (0, U.jsx)(Bc, {
					expertMode: t,
					onEditingChange: i
				})
			}),
			a === "stickers" && !r ? /* @__PURE__ */ (0, U.jsx)(Tl, {}) : null
		]
	});
}
//#endregion
//#region src/embed.tsx
var Dl = null;
function Ol({ userId: e, onReady: t, onFailure: n }) {
	let [r, i] = (0, l.useState)({ kind: "loading" }), [a, o] = (0, l.useState)(0);
	return (0, l.useEffect)(() => {
		r.kind === "ready" && t?.(), (r.kind === "error" || r.kind === "denied") && n?.();
	}, [
		r.kind,
		t,
		n
	]), (0, l.useEffect)(() => {
		let t = !0;
		return i({ kind: "loading" }), z.bootstrap().then((n) => {
			if (t) {
				if (!n.accessAllowed || n.user.id !== e) {
					i({
						kind: "denied",
						message: "Der serverseitige Generatorzugang ist nicht freigegeben."
					});
					return;
				}
				i({
					kind: "ready",
					bootstrap: n
				});
			}
		}).catch((e) => {
			t && i({
				kind: "error",
				message: B(e)
			});
		}), () => {
			t = !1;
		};
	}, [a, e]), r.kind === "ready" ? /* @__PURE__ */ (0, U.jsx)(El, { bootstrap: r.bootstrap }) : r.kind === "loading" ? /* @__PURE__ */ (0, U.jsx)("p", {
		role: "status",
		children: "Generator-Berechtigung wird geprüft …"
	}) : /* @__PURE__ */ (0, U.jsxs)("section", {
		className: "panel",
		role: "alert",
		children: [
			/* @__PURE__ */ (0, U.jsx)("h2", { children: r.kind === "denied" ? "Kein Generatorzugriff" : "Generator nicht verfügbar" }),
			/* @__PURE__ */ (0, U.jsx)("p", { children: r.message }),
			/* @__PURE__ */ (0, U.jsx)("button", {
				type: "button",
				className: "secondary-button",
				onClick: () => o((e) => e + 1),
				children: "Erneut prüfen"
			})
		]
	});
}
function kl(e, t) {
	if (Dl) throw Error("Der Bild-Generator ist bereits eingebunden.");
	if (!e || !t?.pdApi || !t?.getAccessToken || !t?.userId) throw Error("Ungültiger Generator-Integrationsvertrag.");
	let n = e.attachShadow({ mode: "open" }), r = document.createElement("style");
	r.textContent = ":host{display:block;font-family:Inter,system-ui,sans-serif;color:#f4f4f4;color-scheme:dark}.generator-embed-root{min-width:0}";
	let i = document.createElement("link");
	i.rel = "stylesheet", i.href = "/assets/generator-dev/embed/style.css";
	let a = document.createElement("div");
	a.className = "generator-embed-root", n.append(r, i, a), Ga(t.pdApi), os(t.getAccessToken);
	let o = (0, u.createRoot)(a);
	o.render(/* @__PURE__ */ (0, U.jsx)(Ol, {
		userId: t.userId,
		onReady: t.onReady,
		onFailure: t.onFailure
	}));
	let s = !1, c = () => {
		s || (s = !0, o.unmount(), n.replaceChildren(), Ga(null), os(null), Dl = null);
	};
	return Dl = c, c;
}
//#endregion
export { kl as mountGenerator };
