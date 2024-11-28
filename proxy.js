// Current Version: 1.2.1
// Description: Using Cloudflare Workers to Reverse Proxy everything.

addEventListener( 'fetch', e => e.respondWith( fetchHandler( e ) ) )

async function fetchHandler ( e )
{
    try
    {
        const req = e.request
        const urlObj = new URL( req.url )
        const targetUrl = urlObj.href.slice( urlObj.origin.length + 1 ).replace( /^https?:\/+/, 'https://' )

        const filteredHeaders = new Headers()
        req.headers.forEach( ( value, key ) =>
        {
            if ( !key.toLowerCase().startsWith( 'cf-' ) )
            {
                filteredHeaders.set( key, value )
            }
        } )

        const res = await fetch( targetUrl, {
            body: req.body,
            headers: filteredHeaders,
            method: req.method,
            redirect: 'manual'
        } )

        const deleteHeaders = [
            'Content-Security-Policy',
            'X-Frame-Options',
        ]
        const setHeaders = {
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': '*',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store'
        }

        const resHdr = new Headers( res.headers )
        deleteHeaders.forEach( value => resHdr.delete( value ) )
        Object.entries( setHeaders ).forEach( ( [ key, value ] ) => resHdr.set( key, value ) )

        if ( resHdr.has( 'Location' ) )
        {
            resHdr.set( 'Location', `${ urlObj.origin }/${ new URL( resHdr.get( 'Location' ), targetUrl ) }` )
            return new Response( null, { status: res.status, headers: resHdr } )
        }

        if ( resHdr.get( "Content-Type" )?.includes( "text/html" ) )
        {
            const body = ( await res.text() ).replace(
                /((action|href|src)=["'])\/(?!\/)/g,
                `$1${ urlObj.protocol }//${ urlObj.host }/${ new URL( targetUrl ).origin }/`
            )
            return new Response( body, { headers: resHdr, status: res.status } )
        }

        return new Response( res.body, { headers: resHdr, status: res.status } )
    } catch ( error )
    {
        return new Response( JSON.stringify( { error: error.message } ), {
            status: 500,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
        } )
    }
}
