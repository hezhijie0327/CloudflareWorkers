// Description: Using Cloudflare Workers for web scraping.

/** @param {any} event */
addEventListener(
  "fetch",
  /** @param {any} event */ (event) => {
    event.respondWith(handleRequest(event.request));
  },
);

/** @param {Request} request */
async function handleRequest(request) {
  const { searchParams } = new URL(request.url);

  let url = searchParams.get("url");
  const selectors = searchParams
    .getAll("selector")
    .flatMap((value) => value.split(","))
    .map((s) => s.trim())
    .filter(Boolean);
  if (!url || selectors.length === 0) {
    return new Response(
      JSON.stringify({ error: "Missing url or selector parameters" }),
      {
        status: 400,
        headers: { "content-type": "application/json;charset=UTF-8" },
      },
    );
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return new Response(
        JSON.stringify(
          { error: "Failed to fetch target URL", status: response.status },
          null,
          2,
        ),
        {
          status: response.status,
          headers: {
            "content-type": "application/json;charset=UTF-8",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    const globalAny = /** @type {any} */ (globalThis);
    const HTMLRewriterClass = /** @type {any} */ (globalAny.HTMLRewriter);
    const rewriter = new HTMLRewriterClass();
    const matches = /** @type {{ [selector: string]: string[] }} */ ({});
    const currentTexts = /** @type {{ [selector: string]: string }} */ (
      Object.fromEntries(selectors.map((selector) => [selector, ""]))
    );

    selectors.forEach((selector) => {
      rewriter.on(selector, {
        element() {
          if (currentTexts[selector].trim()) {
            if (!matches[selector]) matches[selector] = [];
            matches[selector].push(currentTexts[selector].trim());
            currentTexts[selector] = "";
          }
        },
        text: /** @param {any} text */ function (text) {
          currentTexts[selector] += text.text;
          if (text.lastInTextNode)
            currentTexts[selector] = currentTexts[selector].replace(
              /\s\s+/g,
              " ",
            );
        },
      });
    });

    await rewriter.transform(response).arrayBuffer();

    selectors.forEach((selector) => {
      if (currentTexts[selector].trim()) {
        if (!matches[selector]) matches[selector] = [];
        matches[selector].push(currentTexts[selector].trim());
      }
    });

    const result = Object.fromEntries(
      selectors.map((selector) => [selector, matches[selector] || []]),
    );
    return new Response(JSON.stringify({ result }, null, 2), {
      headers: {
        "content-type": "application/json;charset=UTF-8",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }, null, 2), {
      status: 500,
      headers: { "content-type": "application/json;charset=UTF-8" },
    });
  }
}
