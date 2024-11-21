// Current Version: 1.1.3
// Description: Using Cloudflare Workers to proxy GitHub.

addEventListener( 'fetch', e =>
{
    e.respondWith( fetchHandler( e ).catch( err => makeRes( 'Error:\n' + err.stack, {}, 502 ) ) )
} )

function makeRes ( body, headers = {}, status = 200 )
{
    headers[ 'Access-Control-Allow-Origin' ] = '*'
    return new Response( body, { headers, status } )
}

async function fetchHandler ( e )
{
    const URL_REGEX = /^(?:https?:\/\/)?(((?:codeload|gist)?(?:\.)?github\.com)|(?:desktop|gist|github\-releases|raw|user\-images)?(?:\.)?(githubusercontent\.com))\/.*$/i

    const req = e.request
    const urlObj = new URL( req.url )
    let path = urlObj.searchParams.get( 'q' )

    if ( path )
    {
        return Response.redirect( 'https://' + urlObj.host + '/' + path, 301 )
    }

    path = urlObj.href.substring( urlObj.origin.length + 1 ).replace( /^https?:\/+/, 'https://' )

    if ( !URL_REGEX.test( path ) )
    {
        return new Response( "403 Forbidden", {
            status: 403,
            headers: { "Access-Control-Allow-Origin": "*", "content-type": "text/plain;charset=UTF-8" },
        } )
    }

    const reqHdrRaw = req.headers
    const reqInit = { body: req.body, headers: reqHdrRaw, method: req.method, redirect: 'manual' }

    if ( req.method === 'OPTIONS' && reqHdrRaw.has( 'Access-Control-Request-Headers' ) )
    {
        return new Response( null, {
            headers: {
                'Access-Control-Allow-Methods': 'DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Max-Age': '86400',
            },
            status: 204,
        } )
    }

    const res = await fetch( path, reqInit )
    const resHdrNew = new Headers( res.headers )

    if ( resHdrNew.has( 'Location' ) )
    {
        const location = resHdrNew.get( 'Location' )
        if ( URL_REGEX.test( location ) )
        {
            resHdrNew.set( 'Location', '/' + location )
        } else
        {
            reqInit.redirect = 'follow'
            return proxy( reqInit, new URL( location ) )
        }
    }

    resHdrNew.set( 'Access-Control-Allow-Origin', '*' )
    resHdrNew.set( 'Access-Control-Expose-Headers', '*' )
    resHdrNew.set( 'Cache-Control', 'no-store' )

    resHdrNew.delete( 'Clear-Site-Data' )
    resHdrNew.delete( 'Content-Security-Policy' )
    resHdrNew.delete( 'Content-Security-Policy-Report-Only' )

    return new Response( res.body, { headers: resHdrNew, status: res.status } )
}

async function proxy ( reqInit, urlObj )
{
    const res = await fetch( urlObj.href, reqInit )
    const resHdrOld = res.headers
    const resHdrNew = new Headers( resHdrOld )

    if ( resHdrNew.has( 'Location' ) )
    {
        let location = resHdrNew.get( 'Location' )
        if ( URL_REGEX.test( location ) )
        {
            resHdrNew.set( 'Location', '/' + location )
        } else
        {
            reqInit.redirect = 'follow'
            return proxy( reqInit, new URL( location ) )
        }
    }

    resHdrNew.set( 'Access-Control-Allow-Origin', '*' )
    resHdrNew.set( 'Access-Control-Expose-Headers', '*' )
    resHdrNew.set( 'Cache-Control', 'no-store' )

    resHdrNew.delete( 'Clear-Site-Data' )
    resHdrNew.delete( 'Content-Security-Policy' )
    resHdrNew.delete( 'Content-Security-Policy-Report-Only' )

    return new Response( res.body, { headers: resHdrNew, status: res.status } )
}
