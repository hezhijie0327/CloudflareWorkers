// Description: Using Cloudflare Workers to speed up fonts.googleapis.com and fonts.gstatic.com's visiting.

/** @param {any} event */
addEventListener(
  "fetch",
  /** @param {any} event */ (event) => {
    event.respondWith(handleRequest(event.request));
  },
);

/** @param {Request} request */
async function handleRequest(request) {
  const requestUrl = new URL(request.url);
  const host = requestUrl.host;
  const pathname = requestUrl.pathname;
  const path = `${pathname}${requestUrl.search}`;

  const response_css = await fetch(`https://fonts.googleapis.com${path}`);
  const response_font = await fetch(`https://fonts.gstatic.com${path}`);

  if (
    pathname === "/" ||
    (response_css.status !== 200 && response_font.status !== 200)
  ) {
    return new Response("404 Not Found", {
      status: 404,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "content-type": "text/plain;charset=UTF-8",
      },
    });
  }

  if (response_css.status === 200) {
    let css = await response_css.text();
    const proxyPrefix = `https://${host}/https://fonts.gstatic.com`;
    css = css
      .replace(/https?:\/\/fonts\.gstatic\.com/gim, proxyPrefix)
      .replace(/\/\/fonts\.gstatic\.com/gim, proxyPrefix);

    return new Response(css, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "content-type": "text/css;charset=UTF-8",
      },
    });
  }

  /** @type {{ [key: string]: string }} */
  const fontExtMap = {
    ".collection": "font/collection;charset=UTF-8",
    ".eot": "application/vnd.ms-fontobject;charset=UTF-8",
    ".otf": "font/otf;charset=UTF-8",
    ".sfnt": "font/sfnt;charset=UTF-8",
    ".svg": "image/svg+xml;charset=UTF-8",
    ".ttf": "font/ttf;charset=UTF-8",
    ".woff": "font/woff;charset=UTF-8",
    ".woff2": "font/woff2;charset=UTF-8",
  };

  for (const ext in fontExtMap) {
    if (pathname.match(new RegExp(`${ext}$`))) {
      const headers = new Headers(response_font.headers);
      headers.set("Access-Control-Allow-Origin", "*");
      if (!headers.has("content-type")) {
        headers.set("content-type", fontExtMap[ext]);
      }
      return new Response(response_font.body, {
        status: response_font.status,
        headers,
      });
    }
  }

  const headers = new Headers(response_font.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(response_font.body, {
    status: response_font.status,
    headers,
  });
}
