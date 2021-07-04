// Current Version: 1.0.6
// Description: Using Cloudflare Workers to backup your GPG key.

addEventListener("fetch", (event) => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    let url = request.url.substr(8);
    path = url.split("/");
    url = url.substr(url.indexOf("/") + 1);
    const gpg = {
        info: {
            private: "curl -fsSL 'https://" + path[0] + "/" + url + "' | jq -r '.key.private' | base64 -d | gpg --import --pinentry-mode loopback --batch --passphrase '<PASSWORD>'",
            public: "curl -fsSL 'https://" + path[0] + "/" + url + "' | jq -r '.key.public' | base64 -d | gpg --import",
        },
        key: {
            private: "",
            public: "",
        },
        secret: "",
    };
    if (url === "secret=" + atob(gpg.secret) || url === "secret=" + gpg.secret) {
        return new Response(JSON.stringify(gpg, null, 2), {
            status: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "content-type": "application/json;charset=UTF-8",
            },
        });
    } else {
        return new Response("404 Not Found", {
            status: 404,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "content-type": "text/plain;charset=UTF-8",
            },
        });
    }
}
