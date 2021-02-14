// Current Version: 1.0.0
// Description: Using Cloudflare Workers to show website visiter's IP address and country in JSON.

addEventListener("fetch", (event) => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    let url = request.url.substr(8);
    path = url.split("/");
    url = url.substr(url.indexOf("/") + 1);
    const access_ip = request.headers.get("CF-Connecting-IP");
    const country_code = request.headers.get("CF-IPCountry");
    const user_agent = request.headers.get("User-Agent");
    var status_code = "200";
    if (url == "") {
        var data = {
            agent: user_agent,
            country: country_code,
            ip: access_ip,
            status: true,
        };
    } else if (url == "agent") {
        var data = {
            agent: user_agent,
            status: true,
        };
    } else if (url == "country") {
        var data = {
            country: country_code,
            status: true,
        };
    } else if (url == "ip") {
        var data = {
            ip: access_ip,
            status: true,
        };
    } else {
        var data = {
            agent: null,
            country: null,
            ip: null,
            status: false,
        };
        var status_code = "404";
    }
    return new Response(JSON.stringify(data, null, 4), {
        status: status_code,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "content-type": "application/json;charset=UTF-8",
        },
    });
}
