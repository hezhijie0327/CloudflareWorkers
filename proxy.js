// Current Version: 1.1.6
// Description: Using Cloudflare Workers to Reverse Proxy everything.

addEventListener( 'fetch', e => e.respondWith( fetchHandler( e ) ) )

async function fetchHandler ( e )
{
    try
    {
        const req = e.request
        const urlObj = new URL( req.url )
        const targetUrl = urlObj.searchParams.get( 'q' )
            ? `https://${ urlObj.host }/${ urlObj.searchParams.get( 'q' ) }`
            : urlObj.href.substring( urlObj.origin.length + 1 ).replace( /^https?:\/+/, 'https://' )

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

        const resHdr = new Headers( res.headers )
        const commonHeaders = {
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': '*',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store'
        }
        Object.entries( commonHeaders ).forEach( ( [ key, value ] ) => resHdr.set( key, value ) )

        if ( [ 301, 302, 303, 307, 308 ].includes( res.status ) && resHdr.has( 'Location' ) )
        {
            const location = resHdr.get( 'Location' )
            const absoluteLocation = new URL( location, targetUrl )

            const modifiedLocation = `${ urlObj.protocol }//${ urlObj.host }/${ absoluteLocation.toString() }`
            resHdr.set( 'Location', modifiedLocation )
            return new Response( null, {
                status: res.status,
                headers: resHdr,
            } )
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
