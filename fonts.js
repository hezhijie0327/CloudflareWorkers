// Description: Using Cloudflare Workers to speed up fonts.googleapis.com and fonts.gstatic.com's visiting.

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  let url = request.url.substr(8);
  let path = url.split("/")[0];
  url = url.substr(url.indexOf("/") + 1);

  const response_css = await fetch("https://fonts.googleapis.com/" + url);
  const response_font = await fetch("https://fonts.gstatic.com/" + url);

  if (!url || (response_css.status !== 200 && response_font.status !== 200)) {
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
    css = css.replace(/fonts\.gstatic\.com/gim, path);
    return new Response(css, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "content-type": "text/css;charset=UTF-8",
      },
    });
  }

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
    if (url.match(new RegExp(`${ext}$`))) {
      return new Response(response_font.body, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "content-type": fontExtMap[ext],
        },
      });
    }
  }

  return new Response(response_font.body, {
    status: 200,
    headers: response_font.headers,
  });
}
