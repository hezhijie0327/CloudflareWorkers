// Description: Using Cloudflare Workers to Reverse Proxy everything.

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
    const rawTarget = urlObj.href.slice(urlObj.origin.length + 1);
    const targetUrl = rawTarget
      .replace(/^https?:\/+/, "https://")
      .replace(/^\/\//, "https://");

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: "Missing target URL" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const filteredHeaders = new Headers();
    req.headers.forEach(
      /** @param {string} value @param {string} key */
      (value, key) => {
        const lowerKey = key.toLowerCase();
        if (
          !lowerKey.startsWith("cf-") &&
          lowerKey !== "host" &&
          lowerKey !== "content-length"
        ) {
          filteredHeaders.set(key, value);
        }
      },
    );

    const res = await fetch(targetUrl, {
      body: req.body,
      headers: filteredHeaders,
      method: req.method,
      redirect: "manual",
    });

    const resHdr = new Headers(res.headers);

    const deleteHeaders = ["Content-Security-Policy", "X-Frame-Options"];
    deleteHeaders.forEach((value) => resHdr.delete(value));

    const setHeaders = {
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "*",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    };
    Object.entries(setHeaders).forEach(([key, value]) =>
      resHdr.set(key, value),
    );

    const locationHeader = resHdr.get("Location");
    if (locationHeader) {
      resHdr.set(
        "Location",
        `${urlObj.origin}/${new URL(locationHeader, targetUrl)}`,
      );
      return new Response(null, { status: res.status, headers: resHdr });
    }

    const targetOrigin = new URL(targetUrl).origin;
    const contentReplacements = {
      "text/css": /(url\(['"]?)\/(?!\/)/g,
      "text/html": /((?:action|href|src)=["'])\/(?!\/)/g,
    };
    for (const [contentType, regex] of Object.entries(contentReplacements)) {
      if (resHdr.get("Content-Type")?.includes(contentType)) {
        const body = (await res.text()).replace(
          regex,
          `$1${urlObj.protocol}//${urlObj.host}/${targetOrigin}/`,
        );
        return new Response(body, { headers: resHdr, status: res.status });
      }
    }

    return new Response(res.body, { headers: resHdr, status: res.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}
