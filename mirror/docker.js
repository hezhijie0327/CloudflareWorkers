// Current Version: 1.0.8
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

    let tempHeaders = new Headers( response.headers )

    if ( tempHeaders.get( "WWW-Authenticate" ) )
    {
        tempHeaders.set( "WWW-Authenticate", tempHeaders.get( "WWW-Authenticate" ).replace( /https:\/\/auth\.(ipv6\.)?docker\.(io|com)/g, `https://${ e.request.url.split( '/' )[ 2 ] }` ) )
    }

    if ( tempHeaders.get( "Location" ) )
    {
        const res = await fetch( new Request( tempHeaders.get( "Location" ), { body: e.request.body, headers: e.request.headers, method: e.request.method, redirect: 'follow' } ) )
        const resHdrNew = new Headers( res.headers )

        resHdrNew.set( 'Access-Control-Allow-Headers', '*' )
        resHdrNew.set( 'Access-Control-Allow-Methods', '*' )
        resHdrNew.set( 'Access-Control-Allow-Origin', '*' )
        resHdrNew.set( 'Cache-Control', 'no-store' )

        return new Response( res.body, { headers: resHdrNew, status: res.status } )
    }

    return new Response( response.body, { status: response.status, headers: response.headers } )
}
