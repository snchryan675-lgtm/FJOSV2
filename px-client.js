// Runs inside proxied pages: routes dynamic requests back through the proxy and reports the page URL/title to FJOS
(function () {
  var B = window.__PX; if (!B) return;
  var P = function (u) {
    try {
      u = String(u); if (/^(data:|blob:|javascript:|mailto:|tel:|#)/i.test(u) || u.indexOf('/proxy?u=') === 0) return u;
      var a = new URL(u, B).href; return /^https?:/i.test(a) ? '/proxy?u=' + encodeURIComponent(a) : u;
    } catch (e) { return u; }
  };
  var f = window.fetch; window.fetch = function (i, o) { if (typeof i === 'string' || i instanceof URL) i = P(i); else if (i && i.url) i = new Request(P(i.url), i); return f.call(this, i, o); };
  var xo = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function (m, u) { arguments[1] = P(u); return xo.apply(this, arguments); };
  var wo = window.open; window.open = function (u) { if (u) arguments[0] = P(u); return wo.apply(this, arguments); };
  var sa = Element.prototype.setAttribute; Element.prototype.setAttribute = function (n, v) { if (/^(src|href|action)$/i.test(n) && typeof v === 'string') v = P(v); return sa.call(this, n, v); };
  [[HTMLScriptElement, 'src'], [HTMLImageElement, 'src'], [HTMLLinkElement, 'href'], [HTMLAnchorElement, 'href'], [HTMLIFrameElement, 'src'], [HTMLMediaElement, 'src'], [HTMLSourceElement, 'src'], [HTMLFormElement, 'action']].forEach(function (x) {
    var d = Object.getOwnPropertyDescriptor(x[0].prototype, x[1]); if (!d || !d.set) return;
    Object.defineProperty(x[0].prototype, x[1], { get: d.get, set: function (v) { d.set.call(this, P(v)); } });
  });
  ['pushState', 'replaceState'].forEach(function (k) { var o = history[k]; history[k] = function (s, t, u) { if (u != null) { try { B = new URL(u, B).href; } catch (e) {} u = P(u); } return o.call(this, s, t, u); }; });
  function r() { try { parent.postMessage({ fjosNav: 1, url: B, title: document.title }, '*'); } catch (e) {} }
  document.addEventListener('DOMContentLoaded', r); window.addEventListener('load', r); setInterval(r, 1500);
})();
