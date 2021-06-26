// Current Version: 1.1.1
// Description: Using Cloudflare Workers to deploy AriaNg.

addEventListener("fetch", (event) => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    let country_code = request.headers.get("CF-IPCountry");
    let url = request.url.substr(8);
    path = url.split("/");
    url = url.substr(url.indexOf("/") + 1);
    const ariang_mirror_repo = "https://cdn.jsdelivr.net/gh/mayswind/AriaNg-DailyBuild@master/";
    const ariang_origin_repo = "https://raw.githubusercontent.com/mayswind/AriaNg-DailyBuild/master/";
    const config_secret = "";
    if (country_code === "CN" || country_code === "SG") {
        language = "zh_Hans";
        rpcalias = "演示网站 1";
    } else if (country_code === "HK" || country_code === "MO" || country_code === "TW") {
        language = "zh_Hant";
        rpcalias = "演示網站 1";
    } else {
        language = "en";
        rpcalias = "Demo Site 1";
    }
    switch (Math.floor(Math.random() * 3)) {
        case 0:
            method = "GET";
            protocol = "https";
            break;
        case 1:
            method = "POST";
            protocol = "https";
            break;
        case 2:
            method = "";
            protocol = "wss";
            break;
    }
    if ((config_secret === "" && url === "config") || (config_secret !== "" && url === "config=" + config_secret)) {
        const server = [
            /* {
                httpMethod: "GET",
                protocol: "https",
                rpcAlias: "",
                rpcHost: "",
                rpcInterface: "jsonrpc",
                rpcPort: "6800",
                secret: btoa(""),
            },
            {
                httpMethod: "POST",
                protocol: "https",
                rpcAlias: "",
                rpcHost: "",
                rpcInterface: "jsonrpc",
                rpcPort: "6800",
                secret: btoa(""),
            },
            {
                httpMethod: "",
                protocol: "wss",
                rpcAlias: "",
                rpcHost: "",
                rpcInterface: "jsonrpc",
                rpcPort: "6800",
                secret: btoa(""),
            }, */
        ];
        const config = {
            afterCreatingNewTask: "task-list",
            afterRetryingTask: "task-list-downloading",
            browserNotification: true,
            confirmTaskRemoval: true,
            displayOrder: "default:asc",
            downloadTaskRefreshInterval: 1000,
            dragAndDropTasks: true,
            extendRpcServers: server,
            fileListDisplayOrder: "default:asc",
            globalStatRefreshInterval: 1000,
            httpMethod: method,
            includePrefixWhenCopyingFromTaskDetails: true,
            language: language,
            peerListDisplayOrder: "default:asc",
            protocol: protocol,
            removeOldTaskAfterRetrying: true,
            rpcAlias: rpcalias,
            rpcHost: path[0],
            rpcInterface: "jsonrpc",
            rpcListDisplayOrder: "rpcAlias",
            rpcPort: "6800",
            secret: btoa(path[0]),
            showPiecesInfoInTaskDetailPage: "never",
            swipeGesture: true,
            theme: "system",
            title: "${title} - ${rpcprofile}",
            titleRefreshInterval: 0,
        };
        return new Response(JSON.stringify(config, null, 2), {
            status: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "content-type": "application/json;charset=UTF-8",
            },
        });
    } else {
        if (url === "") {
            var response = await fetch(ariang_origin_repo + "index.html");
            return new Response(response.body, {
                status: 200,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "content-type": "text/html;charset=UTF-8",
                },
            });
        } else if (url === "index.html") {
            return Response.redirect("https://" + path[0], 301);
        } else {
            var response = await fetch(ariang_origin_repo + url);
            if (response.status === 200) {
                if (url.includes(".html")) {
                    return new Response(response.body, {
                        status: 200,
                        headers: {
                            "Access-Control-Allow-Origin": "*",
                            "content-type": "text/html;charset=UTF-8",
                        },
                    });
                } else {
                    return Response.redirect(ariang_mirror_repo + url, 301);
                }
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
    }
}
