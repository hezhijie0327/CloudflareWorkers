// Description: Using Cloudflare Workers to speed up container repo visiting.

const PAT_MAPPING = {
  docker: "",
  ecr: "",
  elastic: "",
  gcr: "",
  ghcr: "",
  k8s: "",
  mcr: "",
  nvcr: "",
  quay: "",
};

addEventListener("fetch", function (e) {
  return e.respondWith(fetchHandler(e));
});

async function fetchHandler(e) {
  try {
    const url = new URL(e.request.url);
    const hostname = url.hostname;
    const subdomain = hostname.split(".")[0];

    const domainMapping = {
      docker: "registry-1.docker.io",
      ecr: "public.ecr.aws",
      elastic: "docker.elastic.co",
      gcr: "gcr.io",
      ghcr: "ghcr.io",
      k8s: "registry.k8s.io",
      mcr: "mcr.microsoft.com",
      nvcr: "nvcr.io",
      quay: "quay.io",
    };

    if (!(subdomain in domainMapping)) {
      return new Response("Unsupported domain", { status: 400 });
    }

    const targetHost = domainMapping[subdomain];
    url.hostname = targetHost;

    const isDockerHub = url.hostname === domainMapping["docker"];

    if (isDockerHub && url.pathname === "/token") {
      const tokenHeaders = new Headers(e.request.headers);
      tokenHeaders.set("Host", "auth.docker.io");

      return fetch(
        new Request(`https://auth.docker.io${url.pathname}${url.search}`, {
          method: e.request.method,
          headers: tokenHeaders,
          body: ["GET", "HEAD"].includes(e.request.method)
            ? null
            : e.request.body,
          redirect: "follow",
        }),
      );
    }

    let reqHdr = new Headers(e.request.headers);
    const commonReqHeaders = {
      Host: url.hostname,
    };
    Object.entries(commonReqHeaders).forEach(([key, value]) =>
      reqHdr.set(key, value),
    );

    const registryPatToken = String(PAT_MAPPING[subdomain] || "").trim();
    if (registryPatToken) {
      reqHdr.set("Authorization", `Bearer ${registryPatToken}`);
    }

    let res = await fetch(
      new Request(url, {
        method: e.request.method,
        headers: reqHdr,
        body: ["GET", "HEAD"].includes(e.request.method)
          ? null
          : e.request.body,
      }),
      { redirect: "follow" },
    );

    let resHdr = new Headers(res.headers);
    const commonResHeaders = {
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "*",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    };
    Object.entries(commonResHeaders).forEach(([key, value]) =>
      resHdr.set(key, value),
    );

    const location = resHdr.get("Location");
    if (location) {
      const redirectUrl = new URL(location, url).toString();
      res = await fetch(
        new Request(redirectUrl, {
          method: isDockerHub && res.status === 307 ? "GET" : undefined,
          redirect: "follow",
        }),
      );

      const redirectHdr = new Headers(res.headers);
      Object.entries(commonResHeaders).forEach(([key, value]) =>
        redirectHdr.set(key, value),
      );

      return new Response(res.body, {
        headers: redirectHdr,
        status: res.status,
      });
    }

    if (resHdr.has("WWW-Authenticate")) {
      const authRegex =
        url.hostname === "registry-1.docker.io"
          ? /https:\/\/auth\.(ipv6\.)?docker\.(io|com)/g
          : new RegExp(
              `https://${url.hostname.replace(/[.*+?^${}()|[\\]\\]/g, "\\\\$&")}`,
              "g",
            );
      const authHeader = resHdr.get("WWW-Authenticate");
      if (authHeader !== null) {
        resHdr.set(
          "WWW-Authenticate",
          authHeader.replace(
            authRegex,
            `https://${e.request.url.split("/")[2]}`,
          ),
        );
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
