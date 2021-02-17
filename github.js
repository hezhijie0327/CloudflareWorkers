// Current Version: 1.0.2
// Description: Using Cloudflare Workers to speed up github.com's visting.

addEventListener("fetch", (event) => {
    const clone_mode = false;
    if (clone_mode === true) {
        let url = new URL(event.request.url);
        url.host = "github.com";
        event.respondWith(fetch(new Request(url, event.request)));
    } else {
        event.respondWith(handleRequest(event.request));
    }
});

async function handleRequest(request) {
    const clone_url = new Array("github.com.cnpmjs.org", "hub.fastgit.org");
    let url = request.url.substr(8);
    path = url.split("/");
    url = url.substr(url.indexOf("/") + 1);
    if (url.startsWith("https://")) {
        return Response.redirect("https://" + path[0] + "/" + url.replace(/^https\:\/\/(desktop\.githubusercontent\.com|github\-releases\.githubusercontent\.com|github\.com|raw\.githubusercontent\.com|user\-images\.githubusercontent\.com)\//gim, ""), 301);
    }
    var response = "";
    var response_archive_blob_edit_raw_release = await fetch("https://github.com/" + url);
    var response_desktop = await fetch("https://desktop.githubusercontent.com/" + url);
    var response_image = await fetch("https://user-images.githubusercontent.com/" + url);
    var response_raw = await fetch("https://raw.githubusercontent.com/" + url);
    var response_release = await fetch("https://github-releases.githubusercontent.com/" + url);
    if (response_archive_blob_edit_raw_release.status === 200) {
        if (path[2].endsWith(".git")) {
            return Response.redirect("https://" + clone_url[Math.floor(Math.random() * clone_url.length)] + "/" + url, 302);
        } else {
            if (path[3] === "archive" || (path[3] === "releases" && path[4] === "download")) {
                response = response_archive_blob_edit_raw_release;
            } else if (path[3] === "blob" || path[3] === "edit" || path[3] === "raw") {
                for (var i = 0; i < path.length; i++) {
                    if (i === 0) {
                        url = path[i];
                    } else if (i === 3) {
                        url = url;
                    } else {
                        url = url + "/" + path[i];
                    }
                }
                return Response.redirect("https://" + url, 301);
            }
        }
    } else if (response_desktop.status === 200) {
        response = response_desktop;
    } else if (response_image.status === 200) {
        response = response_image;
    } else if (response_raw.status === 200) {
        response = response_raw;
    } else if (response_release.status === 200) {
        response = response_release;
    }
    if (response !== "") {
        return new Response(response.body, {
            status: 200,
            headers: response.headers,
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
