// Current Version: 1.0.0
// Description: Using Cloudflare Workers to speed up registry-1.docker.io's visting or randomly redirect to [acr_prefix].mirror.aliyuncs.com or [swr_prefix].mirror.swr.myhuaweicloud.com.

addEventListener("fetch", (event) => {
    const enable_mirror = true;
    if (enable_mirror == false) {
        let url = new URL(event.request.url);
        url.host = "registry-1.docker.io";
        event.respondWith(fetch(new Request(url, event.request)));
    } else {
        event.respondWith(handleRequest(event.request));
    }
});

async function handleRequest(request) {
    const acr_prefix = "acr_prefix"; // Alibaba Cloud ACR - https://help.aliyun.com/document_detail/60750.html
    const swr_prefix = "swr_prefix"; // Huawei Cloud SWR - https://support.huaweicloud.com/usermanual-swr/swr_01_0045.html
    const mirror_url = new Array(acr_prefix + ".mirror.aliyuncs.com", swr_prefix + ".mirror.swr.myhuaweicloud.com");
    let url = request.url.substr(8);
    url = url.substr(url.indexOf("/") + 1);
    var response = await fetch("https://registry-1.docker.io/" + url);
    if (url != "" && response.status == 200) {
        return Response.redirect("https://" + mirror_url[Math.floor(Math.random() * mirror_url.length)] + "/" + url, 302);
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
