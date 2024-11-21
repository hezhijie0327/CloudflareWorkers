// Current Version: 1.0.4
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

    if ( response.headers.get( "WWW-Authenticate" ) )
    {
        response.headers.set( "WWW-Authenticate", response.headers.get( "WWW-Authenticate" ).replace(
            /https:\/\/gcr\.io/g,
            `https://${ e.request.url.split( '/' )[ 2 ] }`
        ) )
    }

    return new Response( response.body, { status: response.status, headers: response.headers } )
}
