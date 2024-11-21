// Current Version: 1.1.3
// Description: Using Cloudflare Workers to Reverse Proxy everything.

addEventListener( 'fetch', e => e.respondWith( fetchHandler( e ) ) )

async function fetchHandler ( e )
{
    const req = e.request
    const urlObj = new URL( req.url )
    const targetUrl = urlObj.searchParams.get( 'q' )
        ? `https://${ urlObj.host }/${ urlObj.searchParams.get( 'q' ) }`
        : urlObj.href.substring( urlObj.origin.length + 1 ).replace( /^https?:\/+/, 'https://' )

    const res = await fetch( targetUrl, { body: req.body, headers: req.headers, method: req.method, redirect: 'manual' } )
    const resHdr = new Headers( res.headers )

    if ( resHdr.has( 'Location' ) )
    {
        return fetchHandler( { request: new Request( resHdr.get( 'Location' ), { ...req, redirect: 'manual' } ) } )
    }

    resHdr.set( 'Access-Control-Allow-Headers', '*' )
    resHdr.set( 'Access-Control-Allow-Methods', '*' )
    resHdr.set( 'Access-Control-Allow-Origin', '*' )
    resHdr.set( 'Cache-Control', 'no-store' )

    if ( resHdr.get( "Content-Type" )?.includes( "text/html" ) )
    {
        const body = ( await res.text() ).replace(
            /((href|src|action)=["'])\/(?!\/)/g,
            `$1${ urlObj.protocol }//${ urlObj.host }/${ new URL( targetUrl ).origin }/`
        )
        return new Response( body, { headers: resHdr, status: res.status } )
    }

    return new Response( res.body, { headers: resHdr, status: res.status } )
}
