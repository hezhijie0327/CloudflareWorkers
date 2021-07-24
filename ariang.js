// Current Version: 1.1.3
// Description: Using Cloudflare Workers to deploy AriaNg.

addEventListener("fetch", (event) => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    let country_code = request.headers.get("CF-IPCountry");
    let url = request.url.substr(8);
    path = url.split("/");
    url = url.substr(url.indexOf("/") + 1);
    const ariang_repo = "https://raw.githubusercontent.com/mayswind/AriaNg-DailyBuild/master/";
    const config_secret = btoa("");
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
    if ((config_secret === "" && url === "config.json") || (config_secret !== "" && url === atob(config_secret) + "/config.json")) {
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
            return Response.redirect("https://" + path[0] + "/index.html", 301);
        } else if (url === "index.html") {
            var response = await fetch(ariang_repo + "index.html");
            return new Response(response.body, {
                status: 200,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "content-type": "text/html;charset=UTF-8",
                },
            });
        } else {
            var response = await fetch(ariang_repo + url);
            if (response.status === 200) {
                if (url.includes(".css")) {
                    return new Response(response.body, {
                        status: 200,
                        headers: {
                            "Access-Control-Allow-Origin": "*",
                            "content-type": "text/css;charset=UTF-8",
                        },
                    });
                } else if (url.includes(".eot")) {
                    return new Response(response.body, {
                        status: 200,
                        headers: {
                            "Access-Control-Allow-Origin": "*",
                            "content-type": "application/vnd.ms-fontobject;charset=UTF-8",
                        },
                    });
                } else if (url.includes(".html")) {
                    return new Response(response.body, {
                        status: 200,
                        headers: {
                            "Access-Control-Allow-Origin": "*",
                            "content-type": "text/html;charset=UTF-8",
                        },
                    });
                } else if (url.includes(".ico")) {
                    return new Response(response.body, {
                        status: 200,
                        headers: {
                            "Access-Control-Allow-Origin": "*",
                            "content-type": "image/x-icon;charset=UTF-8",
                        },
                    });
                } else if (url.includes(".js")) {
                    return new Response(response.body, {
                        status: 200,
                        headers: {
                            "Access-Control-Allow-Origin": "*",
                            "content-type": "text/javascript;charset=UTF-8",
                        },
                    });
                } else if (url.includes(".manifest")) {
                    return new Response(response.body, {
                        status: 200,
                        headers: {
                            "Access-Control-Allow-Origin": "*",
                            "content-type": "text/cache-manifest;charset=UTF-8",
                        },
                    });
                } else if (url.includes(".png")) {
                    return new Response(response.body, {
                        status: 200,
                        headers: {
                            "Access-Control-Allow-Origin": "*",
                            "content-type": "image/png;charset=UTF-8",
                        },
                    });
                } else if (url.includes(".svg")) {
                    return new Response(response.body, {
                        status: 200,
                        headers: {
                            "Access-Control-Allow-Origin": "*",
                            "content-type": "image/svg+xml;charset=UTF-8",
                        },
                    });
                } else if (url.includes(".ttf")) {
                    return new Response(response.body, {
                        status: 200,
                        headers: {
                            "Access-Control-Allow-Origin": "*",
                            "content-type": "font/ttf;charset=UTF-8",
                        },
                    });
                } else if (url.includes(".txt")) {
                    return new Response(response.body, {
                        status: 200,
                        headers: {
                            "Access-Control-Allow-Origin": "*",
                            "content-type": "text/plain;charset=UTF-8",
                        },
                    });
                } else if (url.includes(".woff")) {
                    return new Response(response.body, {
                        status: 200,
                        headers: {
                            "Access-Control-Allow-Origin": "*",
                            "content-type": "font/woff;charset=UTF-8",
                        },
                    });
                } else if (url.includes(".woff2")) {
                    return new Response(response.body, {
                        status: 200,
                        headers: {
                            "Access-Control-Allow-Origin": "*",
                            "content-type": "font/woff2;charset=UTF-8",
                        },
                    });
                } else {
                    return new Response(response.body, {
                        status: response.status,
                        headers: response.headers,
                    });
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
