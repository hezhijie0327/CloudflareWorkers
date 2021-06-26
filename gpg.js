// Current Version: 1.0.0
// Description: Using Cloudflare Workers to backup your GPG key.

addEventListener("fetch", (event) => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    let url = request.url.substr(8);
    url = url.substr(url.indexOf("/") + 1);
    const gpg_info = {
        public_key: "",
        private_key: "",
        secret_key: "",
    };
    if (url === "public=" + gpg_info.secret_key) {
        return new Response(atob(gpg_info.public_key), {
            status: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "content-type": "text/plain;charset=UTF-8",
            },
        });
    } else if (url === "private=" + gpg_info.secret_key) {
        return new Response(atob(gpg_info.private_key), {
            status: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "content-type": "text/plain;charset=UTF-8",
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
