// Description: Using Cloudflare Workers to Reverse Proxy everything.
// Version: 2.0 - HTMLRewriter based URL rewriting, SPA client shim injection,
//          cookie translation, WebSocket relay, git passthrough.
//
// Usage:
//   https://worker/https://example.com/page
//   git clone https://worker/https://github.com/user/repo.git
//   new WebSocket("wss://worker/wss://example.com/ws")

/** @param {any} e */
addEventListener(
  "fetch",
  /** @param {any} e */ (e) => e.respondWith(fetchHandler(e)),
);

/** @param {any} e */
async function fetchHandler(e) {
  try {
    const req = e.request;
    const urlObj = new URL(req.url);

    if (urlObj.pathname === "/" && !urlObj.search) {
      return usagePage(urlObj.origin);
    }

    const targetUrl = extractTarget(urlObj, req);
    if (!targetUrl) {
      return jsonError(
        "Missing or invalid target URL. Usage: " + urlObj.origin + "/https://example.com/",
        400,
      );
    }

    if ((req.headers.get("upgrade") || "").toLowerCase() === "websocket") {
      return await proxyWebSocket(req, targetUrl);
    }

    return await proxyHttp(req, targetUrl, urlObj);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonError(message, 500);
  }
}

async function proxyHttp(req, targetUrl, urlObj) {
  const git = isGitTarget(targetUrl, req);
  const res = await fetch(targetUrl, {
    body: req.body,
    headers: filterRequestHeaders(req, targetUrl, urlObj),
    method: req.method,
    redirect: "manual",
  });

  if (!res.body || res.status === 204 || res.status === 304) {
    return new Response(null, {
      status: res.status,
      statusText: res.statusText,
      headers: buildResponseHeaders(res, targetUrl, urlObj, { git }),
    });
  }

  if (git) {
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: buildResponseHeaders(res, targetUrl, urlObj, { git: true }),
    });
  }

  const contentType = (res.headers.get("Content-Type") || "").toLowerCase();
  if (contentType.includes("text/html")) {
    return await serveHtml(res, targetUrl, urlObj);
  }
  if (contentType.includes("text/css")) {
    return await serveCss(res, targetUrl, urlObj);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: buildResponseHeaders(res, targetUrl, urlObj, {}),
  });
}

function extractTarget(urlObj, req) {
  let raw = urlObj.href.slice(urlObj.origin.length + 1);
  raw = raw
    .replace(/^(https?):\/+/i, "$1://")
    .replace(/^(wss?):\/+/i, "$1://")
    .replace(/^\/\//, "https://");

  if (/^(https?|wss?):\/\//i.test(raw)) {
    try {
      return /^wss/i.test(raw) ? raw : new URL(raw).href;
    } catch {
      return null;
    }
  }

  // Relative path (e.g. JS-driven navigation that skipped rewriting): resolve
  // against the target embedded in the Referer of the proxied page.
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const ref = new URL(referer);
      if (ref.origin === urlObj.origin) {
        const refTarget = ref.href.slice(ref.origin.length + 1);
        if (/^https?:\/\//i.test(refTarget)) {
          return new URL(urlObj.pathname + urlObj.search, refTarget).href;
        }
      }
    } catch {
      // fall through
    }
  }
  return null;
}

function isGitTarget(targetUrl, req) {
  if (req.headers.get("git-protocol")) {
    return true;
  }
  try {
    return /\/(info\/refs|git-upload-pack|git-receive-pack)$/.test(new URL(targetUrl).pathname);
  } catch {
    return false;
  }
}

const REQUEST_SKIP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "expect",
  "cookie",
  "host",
  "content-length",
]);

function filterRequestHeaders(req, targetUrl, urlObj) {
  const out = new Headers();
  req.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (!lowerKey.startsWith("cf-") && !REQUEST_SKIP_HEADERS.has(lowerKey)) {
      out.set(key, value);
    }
  });

  const workerOrigin = urlObj.origin;
  const referer = out.get("referer");
  if (referer && referer.startsWith(workerOrigin + "/")) {
    const inner = referer.slice(workerOrigin.length + 1);
    if (/^https?:\/\//i.test(inner)) {
      out.set("referer", inner);
    } else {
      out.delete("referer");
    }
  }
  const origin = out.get("origin");
  if (origin === workerOrigin) {
    out.set("origin", new URL(targetUrl).origin);
  }

  const cookie = translateRequestCookie(
    req.headers.get("cookie"),
    hostTag(new URL(targetUrl).host),
  );
  if (cookie) {
    out.set("cookie", cookie);
  }
  return out;
}

function buildResponseHeaders(res, targetUrl, urlObj, opts) {
  const out = new Headers(res.headers);
  [
    "Content-Encoding",
    "Content-Length",
    "Content-Security-Policy",
    "Content-Security-Policy-Report-Only",
    "X-Frame-Options",
    "Cross-Origin-Opener-Policy",
    "Cross-Origin-Embedder-Policy",
    "Cross-Origin-Resource-Policy",
  ].forEach((name) => out.delete(name));

  if (!opts.git) {
    const setHeaders = {
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "*",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    };
    Object.entries(setHeaders).forEach(([key, value]) => out.set(key, value));
  }

  const location = out.get("Location");
  if (location) {
    try {
      const abs = new URL(location, targetUrl);
      if (/^(https?|wss?):/i.test(abs.protocol)) {
        out.set("Location", urlObj.origin + "/" + abs.href);
      }
    } catch {
      // keep original Location if unparseable
    }
  }

  if (!opts.git && typeof out.getSetCookie === "function") {
    const cookies = out.getSetCookie();
    if (cookies.length) {
      out.delete("Set-Cookie");
      const tag = hostTag(new URL(targetUrl).host);
      cookies.forEach((cookie) => out.append("Set-Cookie", rewriteSetCookie(cookie, tag)));
    }
  }
  return out;
}

function rewriteSetCookie(cookie, tag) {
  const parts = cookie.split(";");
  const eq = parts[0].indexOf("=");
  if (eq > 0) {
    const name = parts[0].slice(0, eq).trim();
    if (name && !name.startsWith(tag)) {
      parts[0] = " " + tag + name + "=" + parts[0].slice(eq + 1).trim();
    }
  }
  const kept = parts.slice(1).filter((attr) => {
    const attrName = attr.trim().split("=")[0].toLowerCase();
    return attrName !== "domain" && attrName !== "path";
  });
  kept.push(" Path=/");
  return parts[0] + kept.join(";");
}

function translateRequestCookie(header, tag) {
  if (!header) {
    return null;
  }
  const keep = [];
  header.split(";").forEach((pair) => {
    const eq = pair.indexOf("=");
    if (eq < 1) {
      return;
    }
    const name = pair.slice(0, eq).trim();
    if (name.startsWith(tag)) {
      keep.push(name.slice(tag.length) + "=" + pair.slice(eq + 1).trim());
    }
  });
  return keep.length ? keep.join("; ") : null;
}

function hostTag(host) {
  let hash = 5381;
  for (let i = 0; i < host.length; i++) {
    hash = ((hash << 5) + hash + host.charCodeAt(i)) >>> 0;
  }
  return "p" + hash.toString(36);
}

function makeCtx(targetUrl, urlObj) {
  const workerOrigin = urlObj.origin;
  return {
    workerOrigin,
    targetUrl,
    proxify(value) {
      if (value == null) {
        return value;
      }
      const v = String(value).trim();
      if (!v || v.startsWith("#") || /^(data|blob|javascript|mailto|tel|sms|about):/i.test(v)) {
        return value;
      }
      if (/^wss?:\/\//i.test(v)) {
        return workerOrigin + "/" + v;
      }
      let abs;
      try {
        abs = new URL(v, targetUrl).href;
      } catch {
        return value;
      }
      if (abs.startsWith(workerOrigin + "/")) {
        return abs;
      }
      if (!/^https?:\/\//i.test(abs)) {
        return value;
      }
      return workerOrigin + "/" + abs;
    },
  };
}

function rewriteSrcset(value, ctx) {
  return value
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) {
        return part;
      }
      const m = /^(\S+)(\s[\s\S]*)?$/.exec(trimmed);
      return m ? ctx.proxify(m[1]) + (m[2] || "") : part;
    })
    .join(", ");
}

function rewriteCssText(css, ctx) {
  return css
    .replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, quote, url) => "url(" + quote + ctx.proxify(url) + quote + ")")
    .replace(/@import\s+(['"])([^'"]+)\1/gi, (m, quote, url) => "@import " + quote + ctx.proxify(url) + quote);
}

function detectCharset(contentType, buf) {
  const fromHeader = /charset=([\w-]+)/i.exec(contentType || "");
  if (fromHeader) {
    return fromHeader[1];
  }
  const head = new TextDecoder("latin1").decode(buf.slice(0, 4096));
  const fromMeta = /<meta[^>]+charset\s*=\s*["']?\s*([\w-]+)/i.exec(head);
  return fromMeta ? fromMeta[1] : "utf-8";
}

function decodeBody(buf, charset) {
  try {
    return new TextDecoder(charset).decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}

class AttrRewriter {
  /** @param {any} ctx */
  constructor(ctx) {
    this.ctx = ctx;
  }

  /** @param {any} el */
  element(el) {
    if (el.tagName === "link") {
      const rel = (el.getAttribute("rel") || "").toLowerCase();
      if (rel === "preconnect" || rel === "dns-prefetch") {
        el.removeAttribute("href");
        return;
      }
    }
    const names = ["href", "src", "srcset", "action", "data", "poster", "style"];
    for (const name of names) {
      const value = el.getAttribute(name);
      if (value == null || value === "") {
        continue;
      }
      let next;
      if (name === "srcset") {
        next = rewriteSrcset(value, this.ctx);
      } else if (name === "style") {
        next = rewriteCssText(value, this.ctx);
      } else {
        next = this.ctx.proxify(value);
      }
      if (next !== value) {
        el.setAttribute(name, next);
      }
    }
  }
}

class MetaRefreshRewriter {
  /** @param {any} ctx */
  constructor(ctx) {
    this.ctx = ctx;
  }

  /** @param {any} el */
  element(el) {
    if ((el.getAttribute("http-equiv") || "").toLowerCase() !== "refresh") {
      return;
    }
    const content = el.getAttribute("content");
    if (!content) {
      return;
    }
    const m = /^\s*(.*?;\s*url\s*=\s*)([\s\S]+)$/i.exec(content);
    if (!m) {
      return;
    }
    const url = m[2].trim().replace(/^['"]|['"]$/g, "");
    el.setAttribute("content", m[1] + this.ctx.proxify(url));
  }
}

class StyleTextRewriter {
  /** @param {any} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    this.buf = "";
  }

  /** @param {any} chunk */
  text(chunk) {
    this.buf += chunk.text;
    if (chunk.lastInTextNode) {
      chunk.replace(rewriteCssText(this.buf, this.ctx), { html: false });
      this.buf = "";
    } else {
      chunk.remove();
    }
  }
}

class HeadInjector {
  /** @param {string} scriptHtml */
  constructor(scriptHtml) {
    this.scriptHtml = scriptHtml;
  }

  /** @param {any} el */
  element(el) {
    el.append(this.scriptHtml, { html: true });
  }
}

async function serveHtml(res, targetUrl, urlObj) {
  const buf = await res.arrayBuffer();
  const charset = detectCharset(res.headers.get("Content-Type"), buf);
  const html = decodeBody(buf, charset);

  const headers = buildResponseHeaders(res, targetUrl, urlObj, {});
  headers.set("Content-Type", "text/html; charset=utf-8");

  const tag = hostTag(new URL(targetUrl).host);
  const rewriter = new HTMLRewriter()
    .on(
      "a, area, base, form, img, script, iframe, audio, video, source, embed, track, input, object, link",
      new AttrRewriter(makeCtx(targetUrl, urlObj)),
    )
    .on("meta", new MetaRefreshRewriter(makeCtx(targetUrl, urlObj)))
    .on("style", new StyleTextRewriter(makeCtx(targetUrl, urlObj)))
    .on("head", new HeadInjector(clientShim(tag)));

  return rewriter.transform(
    new Response(html, { status: res.status, statusText: res.statusText, headers }),
  );
}

async function serveCss(res, targetUrl, urlObj) {
  const buf = await res.arrayBuffer();
  const charset = detectCharset(res.headers.get("Content-Type"), buf);
  const css = rewriteCssText(decodeBody(buf, charset), makeCtx(targetUrl, urlObj));

  const headers = buildResponseHeaders(res, targetUrl, urlObj, {});
  headers.set("Content-Type", "text/css; charset=utf-8");
  return new Response(css, { status: res.status, statusText: res.statusText, headers });
}

async function proxyWebSocket(req, targetUrl) {
  const upstreamUrl = targetUrl.replace(/^ws:/i, "http:").replace(/^wss:/i, "https:");
  const headers = new Headers({ Upgrade: "websocket" });
  const protocol = req.headers.get("sec-websocket-protocol");
  if (protocol) {
    headers.set("Sec-WebSocket-Protocol", protocol);
  }

  const res = await fetch(upstreamUrl, { headers });
  if (!res.webSocket) {
    return jsonError("Upstream did not accept the WebSocket upgrade", 502);
  }

  const upstream = res.webSocket;
  upstream.accept();
  const pair = new WebSocketPair();
  const server = pair[1];
  server.accept();

  server.addEventListener("message", (event) => {
    try {
      upstream.send(event.data);
    } catch {
      // upstream already closed
    }
  });
  upstream.addEventListener("message", (event) => {
    try {
      server.send(event.data);
    } catch {
      // client already closed
    }
  });
  server.addEventListener("close", (event) => {
    try {
      upstream.close(event.code, event.reason);
    } catch {
      // already closed
    }
  });
  upstream.addEventListener("close", (event) => {
    try {
      server.close(event.code, event.reason);
    } catch {
      // already closed
    }
  });

  return new Response(null, { status: 101, webSocket: pair[0] });
}

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function usagePage(workerOrigin) {
  const body = [
    "<!doctype html><html><head><meta charset='utf-8'><title>Reverse Proxy</title></head><body>",
    "<h1>Reverse Proxy</h1>",
    "<ul>",
    "<li>Page: <code>" + workerOrigin + "/https://example.com/page</code></li>",
    "<li>Git: <code>git clone " + workerOrigin + "/https://github.com/user/repo.git</code></li>",
    "<li>WebSocket: <code>new WebSocket(\"" + workerOrigin + "/wss://example.com/ws\")</code></li>",
    "</ul>",
    "</body></html>",
  ].join("");
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

// Injected into every proxied HTML page. Rewrites runtime-generated URLs
// (fetch/XHR/pushState/WebSocket/setAttribute/src-srcset properties, clicks,
// form submits), namespaces document.cookie per target host, and blocks the
// target site's own service workers from taking over the proxy origin.
function clientShim(tag) {
  const code = [
    "(function(){",
    'var TAG="' + tag + '",W=location.origin;',
    "var T=location.pathname.slice(1)+location.search;",
    "var ABS=/^[a-z][a-z0-9+.-]*:/i;",
    "function abs(u){try{return new URL(u,T).href}catch(e){return null}}",
    "function px(u){",
    "if(u==null)return u;u=String(u);",
    'if(!u||u.charAt(0)==="#")return u;',
    "if(/^(data|blob|javascript|mailto|tel|about):/i.test(u))return u;",
    'if(u.indexOf(W+"/")===0)return u;',
    "var a=ABS.test(u)?u:abs(u);",
    "if(!a)return u;",
    'if(/^wss?:\\/\\//i.test(a))return W+"/"+a;',
    'if(!/^https?:\\/\\//i.test(a))return u;',
    'return W+"/"+a}',
    "function pxSet(v){return v.split(\",\").map(function(p){var t=p.trim();if(!t)return p;",
    "var m=t.match(/^(\\S+)(\\s[\\s\\S]*)?$/);return m?px(m[1])+(m[2]||\"\"):p}).join(\", \")}",
    "function fixState(u){",
    "if(u==null)return u;var s=String(u);",
    'if(s.charAt(0)==="#"||s.indexOf(W+"/")===0)return s;',
    "return px(ABS.test(s)?s:abs(s))}",
    "var hp=history.pushState,hr=history.replaceState;",
    "history.pushState=function(s,t,u){return hp.call(history,s,t,u==null?u:fixState(u))};",
    "history.replaceState=function(s,t,u){return hr.call(history,s,t,u==null?u:fixState(u))};",
    "var of=window.fetch;",
    'window.fetch=function(i,n){try{if(typeof i==="string"||i instanceof URL)i=px(String(i))}catch(e){}return of.call(this,i,n)};',
    "var xo=XMLHttpRequest.prototype.open;",
    "XMLHttpRequest.prototype.open=function(m,u){var r=[].slice.call(arguments,2);try{u=px(u)}catch(e){}return xo.apply(this,[m,u].concat(r))};",
    "var ws=window.WebSocket;",
    "window.WebSocket=function(u,p){return new ws(px(u),p)};",
    "window.WebSocket.prototype=ws.prototype;",
    "window.WebSocket.CONNECTING=0;window.WebSocket.OPEN=1;window.WebSocket.CLOSING=2;window.WebSocket.CLOSED=3;",
    "var ow=window.open;",
    "window.open=function(u,n,f){try{u=px(u)}catch(e){}return ow.call(window,u,n,f)};",
    "var sat=Element.prototype.setAttribute;",
    "Element.prototype.setAttribute=function(n,v){",
    "try{var l=String(n).toLowerCase();",
    'if(l==="srcset")v=pxSet(v);',
    'else if(l==="src"||l==="href"||l==="action"||l==="poster"||l==="data")v=px(v)}catch(e){}',
    "return sat.call(this,n,v)};",
    "function patch(ctor,prop){",
    "if(!ctor)return;",
    "var d=Object.getOwnPropertyDescriptor(ctor.prototype,prop);",
    "if(!d||!d.set)return;",
    "Object.defineProperty(ctor.prototype,prop,{configurable:true,enumerable:d.enumerable,get:d.get,",
    'set:function(v){try{v=prop==="srcset"?pxSet(String(v)):px(v)}catch(e){}d.set.call(this,v)}})}',
    "[window.HTMLImageElement,window.HTMLScriptElement,window.HTMLIFrameElement,window.HTMLMediaElement,",
    "window.HTMLSourceElement,window.HTMLLinkElement,window.HTMLFormElement,window.HTMLEmbedElement,",
    "window.HTMLTrackElement,window.HTMLInputElement,window.HTMLAnchorElement].forEach(function(c){",
    'if(!c)return;patch(c,"src");patch(c,"href");patch(c,"srcset");patch(c,"action");patch(c,"poster")});',
    "if(navigator.serviceWorker){try{navigator.serviceWorker.register=function(){",
    'return Promise.reject(new Error("ServiceWorker is disabled behind this proxy"))}}catch(e){}}',
    'var cd=Object.getOwnPropertyDescriptor(Document.prototype,"cookie");',
    "if(cd&&cd.set){",
    'Object.defineProperty(document,"cookie",{configurable:true,',
    "get:function(){var out=[];cd.get.call(document).split(/;\\s*/).forEach(function(p){",
    "var eq=p.indexOf(\"=\");if(eq<1)return;var n=p.slice(0,eq);",
    "if(n.indexOf(TAG)===0)out.push(p.slice(TAG.length))});return out.join(\"; \")},",
    "set:function(v){if(typeof v!==\"string\"){cd.set.call(document,v);return}",
    "var eq=v.indexOf(\"=\");if(eq<1){cd.set.call(document,v);return}",
    "var n=v.slice(0,eq).trim();",
    "if(n.indexOf(TAG)===0){cd.set.call(document,v);return}",
    "cd.set.call(document,TAG+n+v.slice(eq))}})}",
    'document.addEventListener("click",function(e){',
    "if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;",
    'var t=e.target;var el=t&&t.closest?t.closest("a[href],area[href]"):null;',
    "if(!el)return;var h=el.getAttribute(\"href\");",
    'if(h&&h.charAt(0)!=="#"){var n=px(h);if(n!==h)el.setAttribute("href",n)}},true);',
    'document.addEventListener("submit",function(e){',
    'var f=e.target;if(!f||f.tagName!=="FORM"||e.defaultPrevented)return;',
    'var a=f.getAttribute("action");',
    'if(a){var n=px(a);if(n!==a)f.setAttribute("action",n)}},true);',
    "})();",
  ].join("\n");
  return "<script>" + code + "</script>";
}
