// Description: Using Cloudflare Workers to speed up container repo visiting.
// Version: 1.1 - registry mapping and headers as constants, focused helpers.
//
// Usage: docker.<worker-host>/v2/... proxies Docker Hub, ghcr.<worker-host>/...
// proxies GHCR, etc. Auth challenges are rewritten so `docker login` and pulls
// negotiate their tokens through the proxy as well.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Worker subdomain -> upstream registry host.
const DOMAIN_MAPPING = /** @type {{ [key: string]: string }} */ ({
    docker: "registry-1.docker.io",
    ecr: "public.ecr.aws",
    elastic: "docker.elastic.co",
    gcr: "gcr.io",
    ghcr: "ghcr.io",
    k8s: "registry.k8s.io",
    mcr: "mcr.microsoft.com",
    nvcr: "nvcr.io",
    quay: "quay.io",
});

const DOCKER_HUB_HOST = DOMAIN_MAPPING.docker;
const DOCKER_AUTH_ORIGIN = "https://auth.docker.io";

// Registries whose auth realm lives outside the registry host itself; these
// hosts must also be rewritten to the worker host or `docker login` would
// bypass the proxy. Values are regex-escaped host fragments.
/** @type {{ [host: string]: string[] }} */
const REALM_ALIAS_HOSTS = {
    "docker.elastic.co": ["docker-auth\\.elastic\\.co"],
};

const RESPONSE_SET_HEADERS = {
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "*",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
};

// ---------------------------------------------------------------------------
// Entry point and request pipeline
// ---------------------------------------------------------------------------

/** @param {any} e */
addEventListener("fetch", /** @param {any} e */ (e) => e.respondWith(fetchHandler(e)));

/** @param {any} e */
async function fetchHandler(e) {
    try {
        const request = e.request;
        const url = new URL(request.url);
        const subdomain = url.hostname.split(".")[0];
        if (!Object.hasOwn(DOMAIN_MAPPING, subdomain)) {
            return jsonError("Unsupported domain", 400);
        }
        // Registries are https-only in practice; keeping the ingress scheme
        // (http in local/plain-http setups) would redirect to https and the
        // followed redirect bypasses the WWW-Authenticate realm rewrite.
        url.protocol = "https:";
        url.hostname = DOMAIN_MAPPING[subdomain];
        const isDockerHub = url.hostname === DOCKER_HUB_HOST;

        // Docker Hub tokens belong to auth.docker.io; pass those straight through.
        if (isDockerHub && url.pathname === "/token") {
            return fetch(new Request(`${DOCKER_AUTH_ORIGIN}${url.pathname}${url.search}`, request));
        }

        const response = await fetch(new Request(url, { headers: upstreamHeaders(request, url.hostname) }), request);

        if (response.headers.has("Location")) {
            return followUpstreamRedirect(response, isDockerHub);
        }

        const headers = new Headers(response.headers);
        applyCommonHeaders(headers);
        rewriteAuthRealm(headers, url.hostname, new URL(request.url).host, isDockerHub);
        return new Response(response.body, { status: response.status, headers });
    } catch (error) {
        return jsonError(error instanceof Error ? error.message : String(error), 500);
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** @param {Request} request @param {string} upstreamHost */
function upstreamHeaders(request, upstreamHost) {
    const headers = new Headers(request.headers);
    headers.set("Host", upstreamHost);
    return headers;
}

// Registries redirect layer pulls to CDNs; follow server-side so the client
// sees a single response. Docker Hub's 307 only replays as a GET.
/** @param {Response} response @param {boolean} isDockerHub */
function followUpstreamRedirect(response, isDockerHub) {
    const location = response.headers.get("Location");
    // Unreachable in practice: callers check headers.has("Location") first.
    if (!location) {
        return jsonError("Upstream redirect missing Location", 500);
    }
    return fetch(
        new Request(location, {
            method: isDockerHub && response.status === 307 ? "GET" : undefined,
            redirect: "follow",
        }),
    );
}

/** @param {Headers} headers */
function applyCommonHeaders(headers) {
    Object.entries(RESPONSE_SET_HEADERS).forEach(([key, value]) => {
        headers.set(key, value);
    });
}

// Point the auth realm in WWW-Authenticate at the worker host so the Docker
// CLI sends its token requests through the proxy too. Docker Hub realms use
// auth.docker.io / auth.ipv6.docker.com; other registries may have aliases
// (REALM_ALIAS_HOSTS) or host the realm on the registry host itself.
/** @param {Headers} headers @param {string} upstreamHost @param {string} workerHost @param {boolean} isDockerHub */
function rewriteAuthRealm(headers, upstreamHost, workerHost, isDockerHub) {
    if (!headers.has("WWW-Authenticate")) {
        return;
    }
    const escaped = upstreamHost.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const hosts = [escaped];
    if (isDockerHub) {
        hosts.push("auth\\.docker\\.io", "auth\\.ipv6\\.docker\\.com");
    }
    const aliases = REALM_ALIAS_HOSTS[upstreamHost];
    if (aliases) {
        hosts.push(...aliases);
    }
    const authHeader = headers.get("WWW-Authenticate");
    if (authHeader !== null) {
        headers.set(
            "WWW-Authenticate",
            authHeader.replace(new RegExp(`https://(?:${hosts.join("|")})`, "g"), `https://${workerHost}`),
        );
    }
}

/** @param {string} message @param {number} status */
function jsonError(message, status) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
}
