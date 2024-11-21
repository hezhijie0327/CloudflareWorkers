// Current Version: 1.0.5
// Description: Using Cloudflare Workers to speed up gcr.io's visiting.

addEventListener( 'fetch', e => e.respondWith( fetchHandler( e ) ) )

async function fetchHandler ( e )
{
    const url = new URL( e.request.url )
    url.hostname = 'gcr.io'

    let response = await fetch( new Request( url, {
        headers: {
            'Host': url.hostname,
            ...( e.request.headers.has( "Authorization" ) && { Authorization: e.request.headers.get( "Authorization" ) } )
        }
    } ), e.request )

    let tempHeaders = new Headers( response.headers )

    if ( tempHeaders.get( "WWW-Authenticate" ) )
    {
        tempHeaders.set( "WWW-Authenticate", tempHeaders.get( "WWW-Authenticate" ).replace( /https:\/\/ghci\.io/g, `https://${ e.request.url.split( '/' )[ 2 ] }` ) )
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
