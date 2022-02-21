// Current Version: 1.0.4
// Description: Using Cloudflare Workers to proxy download everything.

addEventListener( 'fetch', e =>
{
    const ret = fetchHandler( e )
        .catch( err => makeRes( 'Error:\n' + err.stack, {}, 502 ) )
    e.respondWith( ret )
} )

function makeRes ( body, headers = {}, status = 200 )
{
    headers[ 'Access-Control-Allow-Origin' ] = '*'
    return new Response( body, { headers, status } )
}

function newUrl ( urlStr )
{
    try
    {
        return new URL( urlStr )
    } catch ( err )
    {
        return null
    }
}

async function fetchHandler ( e )
{
    const req = e.request
    const urlStr = req.url
    const urlObj = new URL( urlStr )

    let path = urlObj.href.substring( urlObj.origin.length + 1 ).replace( /^https?:\/+/, 'https://' )

    if ( !path.match( /^https?:\/\// ) )
    {
        return new Response( "403 Forbidden", {
            status: 403,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "content-type": "text/plain;charset=UTF-8",
            },
        } )
    }
    else
    {
        return httpHandler( req, path )
    }
}

function httpHandler ( req, pathname )
{
    const reqHdrRaw = req.headers

    if ( req.method === 'OPTIONS' && reqHdrRaw.has( 'Access-Control-Request-Headers' ) )
    {
        return new Response( null, {
            headers: {
                'Access-Control-Allow-Methods': 'DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Max-Age': '86400',
            }, status: 204
        } )
    }

    let rawLen = ''
    let urlStr = pathname

    const reqHdrNew = new Headers( reqHdrRaw )
    const urlObj = newUrl( urlStr )
    const reqInit = {
        body: req.body,
        headers: reqHdrNew,
        method: req.method,
        redirect: 'follow'
    }

    return proxy( rawLen, reqInit, urlObj )
}

async function proxy ( rawLen, reqInit, urlObj )
{
    const res = await fetch( urlObj.href, reqInit )
    const resHdrOld = res.headers
    const resHdrNew = new Headers( resHdrOld )

    if ( rawLen )
    {
        const newLen = resHdrOld.get( 'Content-Length' ) || ''
        const badLen = ( rawLen !== newLen )

        if ( badLen )
        {
            return makeRes( res.body, {
                '--error': `bad len: ${ newLen }, except: ${ rawLen }`,
                'Access-Control-Expose-Headers': '--error',
            }, 400 )
        }
    }

    resHdrNew.set( 'Access-Control-Allow-Origin', '*' )
    resHdrNew.set( 'Access-Control-Expose-Headers', '*' )
    resHdrNew.set( 'Cache-Control', 'max-age=0' )

    resHdrNew.delete( 'Clear-Site-Data' )
    resHdrNew.delete( 'Content-Security-Policy' )
    resHdrNew.delete( 'Content-Security-Policy-Report-Only' )

    return new Response( res.body, {
        headers: resHdrNew,
        status: res.status
    } )
}
