// Current Version: 1.1.2
// Description: Using Cloudflare Workers to speed up registry.hub.docker.com's visting or randomly redirect to Docker Hub's mirrors(private or public) in China.

addEventListener( "fetch", ( event ) =>
{
    event.respondWith( handleRequest( event.request ) )

} )

async function handleRequest ( request )
{
    const config = {
        prefix: {
            acr_prefix: "acr_prefix", // Alibaba Cloud ACR - https://help.aliyun.com/document_detail/60750.html
            swr_prefix: "swr_prefix", // Huawei Cloud SWR - https://support.huaweicloud.com/usermanual-swr/swr_01_0045.html
        },
    }
    const mirror = {
        library: {
            private: [ config.prefix.acr_prefix + ".mirror.aliyuncs.com", config.prefix.swr_prefix + ".mirror.swr.myhuaweicloud.com" ],
            public: [ "docker.mirrors.ustc.edu.cn", "hub-mirror.c.163.com" ],
        },
        repo: {
            private: [],
            public: [ "docker.mirrors.sjtug.sjtu.edu.cn", "mirror.iscas.ac.cn" ],
        },
    }

    let url = request.url.substr( 8 )
    url = url.substr( url.indexOf( "/" ) + 1 )

    if ( url.includes( "/library/" ) )
    {
        var mirror_url = mirror.library.private.concat( mirror.library.public ).concat( mirror.repo.private ).concat( mirror.repo.public )
    } else
    {
        var mirror_url = mirror.repo.private.concat( mirror.repo.public )
    }

    var redirect = mirror_url[ Math.floor( Math.random() * mirror_url.length ) ]
    var response = await fetch( "https://" + redirect + "/" + url )

    if ( url !== "" && response.status === 200 )
    {
        return Response.redirect( "https://" + redirect + "/" + url, 302 )
    } else
    {
        return new Response( "404 Not Found", {
            status: 404,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "content-type": "text/plain;charset=UTF-8",
            },
        } )
    }
}
