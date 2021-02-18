// Current Version: 1.0.4
// Description: Using Cloudflare Workers to speed up registry-1.docker.io's visting or randomly redirect to Docker Hub's mirrors(private or public) in China.

addEventListener("fetch", (event) => {
    const enable_mirror = true;
    if (enable_mirror === false) {
        let url = new URL(event.request.url);
        url.host = "registry-1.docker.io";
        event.respondWith(fetch(new Request(url, event.request)));
    } else {
        event.respondWith(handleRequest(event.request));
    }
});

async function handleRequest(request) {
    const mirror = {
        private: [
            "acr_prefix.mirror.aliyuncs.com", // Alibaba Cloud ACR - https://help.aliyun.com/document_detail/60750.html
            "swr_prefix.mirror.swr.myhuaweicloud.com", // Huawei Cloud SWR - https://support.huaweicloud.com/usermanual-swr/swr_01_0045.html
        ],
        public: [
            "hub-mirror.c.163.com", // 163 - https://c.163yun.com/hub#/home
            "mirror.iscas.ac.cn", // ISRC - https://mirror.iscas.ac.cn/mirror/docker.html
        ],
    };
    let url = request.url.substr(8);
    url = url.substr(url.indexOf("/") + 1);
    if (url.includes("/library/")) {
        var mirror_url = mirror.private.concat(mirror.public);
    } else {
        var mirror_url = mirror.public;
    }
    var response = await fetch("https://registry-1.docker.io/" + url);
    if (url !== "" || response.status === 200) {
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
