// Current Version: 1.0.4
// Description: Using Cloudflare Workers to speed up fonts.googleapis.com and fonts.gstatic.com's visting.

addEventListener( "fetch", ( event ) =>
{
    event.respondWith( handleRequest( event.request ) )
} )

async function handleRequest ( request )
{
    let url = request.url.substr( 8 )
    let path = url.split( "/" )
    url = url.substr( url.indexOf( "/" ) + 1 )

    var response_css = await fetch( "https://fonts.googleapis.com/" + url )
    var response_font = await fetch( "https://fonts.gstatic.com/" + url )

    if ( url === "" || ( response_css.status !== 200 && response_font.status !== 200 ) )
    {
        return new Response( "404 Not Found", {
            status: 404,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "content-type": "text/plain;charset=UTF-8",
            },
        } )
    } else
    {
        if ( response_css.status === 200 )
        {
            let css = await response_css.text()

            return new Response( css.replace( /fonts\.gstatic\.com/gim, path[ 0 ] ), {
                status: 200,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "content-type": "text/css;charset=UTF-8",
                },
            } )
        } else
        {
            if ( url.includes( ".collection" ) )
            {
                return new Response( response_font.body, {
                    status: 200,
                    headers: {
                        "Access-Control-Allow-Origin": "*",
                        "content-type": "font/collection;charset=UTF-8",
                    },
                } )
            } else if ( url.includes( ".eot" ) )
            {
                return new Response( response_font.body, {
                    status: 200,
                    headers: {
                        "Access-Control-Allow-Origin": "*",
                        "content-type": "application/vnd.ms-fontobject;charset=UTF-8",
                    },
                } )
            } else if ( url.includes( ".otf" ) )
            {
                return new Response( response_font.body, {
                    status: 200,
                    headers: {
                        "Access-Control-Allow-Origin": "*",
                        "content-type": "font/otf;charset=UTF-8",
                    },
                } )
            } else if ( url.includes( ".sfnt" ) )
            {
                return new Response( response_font.body, {
                    status: 200,
                    headers: {
                        "Access-Control-Allow-Origin": "*",
                        "content-type": "font/sfnt;charset=UTF-8",
                    },
                } )
            } else if ( url.includes( ".svg" ) )
            {
                return new Response( response_font.body, {
                    status: 200,
                    headers: {
                        "Access-Control-Allow-Origin": "*",
                        "content-type": "image/svg+xml;charset=UTF-8",
                    },
                } )
            } else if ( url.includes( ".ttf" ) )
            {
                return new Response( response_font.body, {
                    status: 200,
                    headers: {
                        "Access-Control-Allow-Origin": "*",
                        "content-type": "font/ttf;charset=UTF-8",
                    },
                } )
            } else if ( url.includes( ".woff" ) )
            {
                return new Response( response_font.body, {
                    status: 200,
                    headers: {
                        "Access-Control-Allow-Origin": "*",
                        "content-type": "font/woff;charset=UTF-8",
                    },
                } )
            } else if ( url.includes( ".woff2" ) )
            {
                return new Response( response_font.body, {
                    status: 200,
                    headers: {
                        "Access-Control-Allow-Origin": "*",
                        "content-type": "font/woff2;charset=UTF-8",
                    },
                } )
            } else
            {
                return new Response( response_font.body, {
                    status: 200,
                    headers: response_font.headers,
                } )
            }
        }
    }
}
