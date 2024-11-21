// Current Version: 1.0.7
// Description: Using Cloudflare Workers to speed up registry-1.docker.io's visiting.

addEventListener( 'fetch', e => e.respondWith( fetchHandler( e ) ) )

async function fetchHandler ( e )
{
    const url = new URL( e.request.url )
    url.hostname = 'registry-1.docker.io'

    if ( url.pathname === '/token' )
    {
        const ip = e.request.headers.get( 'CF-Connecting-IP' ) || '127.0.0.1'
        const authHostname = /^(\d{1,3}\.){3}\d{1,3}$/.test( ip )
            ? ( Math.random() < 0.5 ? 'auth.docker.com' : 'auth.docker.io' )
            : 'auth.ipv6.docker.com'

        return fetch( new Request( `https://${ authHostname }${ url.pathname }${ url.search }`, e.request ) )
    }

    let response = await fetch( new Request( url, {
        headers: {
            'Host': url.hostname,
            ...( e.request.headers.has( "Authorization" ) && { Authorization: e.request.headers.get( "Authorization" ) } )
        }
    } ), e.request )

    if ( response.headers.get( "WWW-Authenticate" ) )
    {
        response.headers.set( "WWW-Authenticate", response.headers.get( "WWW-Authenticate" ).replace(
            /https:\/\/auth\.(ipv6\.)?docker\.(io|com)/g,
            `https://${ e.request.url.split( '/' )[ 2 ] }`
        ) )
    }

    return new Response( response.body, { status: response.status, headers: response.headers } )
}
