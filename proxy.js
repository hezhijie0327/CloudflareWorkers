// Current Version: 1.0.5
// Description: Using Cloudflare Workers to reverse proxy website.

addEventListener( "fetch", ( event ) =>
{
    event.respondWith( handleRequest( event.request ) )
} )

async function handleRequest ( request )
{
    const proxy_config = {
        access: {
            allowed: {
                country: [],
                ip: [],
            },
            blocked: {
                country: [],
                ip: [],
            },
            current: {
                country: request.headers.get( "CF-IPCountry" ),
                ip: request.headers.get( "CF-Connecting-IP" ),
            },
        },
        cf: {
            cache: true,
            minify: {
                css: true,
                html: true,
                javascript: true,
            },
            mirage: true,
            polish: "lossy",
        },
        host: "nyaa.si",
        path: "",
        protocol: "https",
    }
    if ( ( proxy_config.access.allowed.country.length === 0 || ( proxy_config.access.allowed.country.length !== 0 && proxy_config.access.allowed.country.includes( proxy_config.access.current.country ) ) ) && ( proxy_config.access.allowed.ip.length === 0 || ( proxy_config.access.allowed.ip.length !== 0 && proxy_config.access.allowed.ip.includes( proxy_config.access.current.ip ) ) ) && ( proxy_config.access.blocked.country.length === 0 || ( proxy_config.access.blocked.country.length !== 0 && ( proxy_config.access.blocked.country.includes( proxy_config.access.current.country ) === false || ( proxy_config.access.allowed.country.includes( proxy_config.access.current.country ) && proxy_config.access.blocked.country.includes( proxy_config.access.current.country ) ) ) ) ) && ( proxy_config.access.blocked.ip.length === 0 || ( proxy_config.access.blocked.ip.length !== 0 && ( proxy_config.access.blocked.ip.includes( proxy_config.access.current.ip ) === false || ( proxy_config.access.allowed.ip.includes( proxy_config.access.current.ip ) && proxy_config.access.blocked.ip.includes( proxy_config.access.current.ip ) ) ) ) ) )
    {
        const proxy_url = new URL( proxy_config.protocol + "://" + proxy_config.host + "/" + proxy_config.path )
        const request_url = new URL( request.url )
        request_url.protocol = proxy_url.protocol
        request_url.host = proxy_url.host
        request_url.pathname = proxy_url.pathname + request_url.pathname
        var proxy_response = await fetch(
            new Request( request_url, {
                cf: {
                    cacheEverything: proxy_config.cf.cache,
                    minify: {
                        css: proxy_config.cf.minify.css,
                        html: proxy_config.cf.minify.html,
                        javascript: proxy_config.cf.minify.javascript,
                    },
                    mirage: proxy_config.cf.mirage,
                    polish: proxy_config.cf.polish,
                },
                headers: request.headers,
                method: request.method,
            } )
        )
        return new Response( proxy_response.body, {
            status: proxy_response.status,
            headers: proxy_response.headers,
        } )
    } else
    {
        return new Response( "Access denied: " + proxy_config.access.current.ip + "(" + proxy_config.access.current.country + ")" + " has no access to reverse proxy " + proxy_config.host + ".", {
            status: 403,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "content-type": "text/plain;charset=UTF-8",
            },
        } )
    }
}
