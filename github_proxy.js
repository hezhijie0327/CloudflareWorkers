// Current Version: 1.0.0
// Description: Using Cloudflare Workers to proxy GitHub.

const URL_REGEX = {
    exp1: /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:releases|archive)\/.*$/i,
    exp2: /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:blob|edit|raw)\/.*$/i,
    exp3: /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:info|git-).*$/i,
    exp4: /^(?:https?:\/\/)?raw\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+?\/.+$/i,
    exp5: /^(?:https?:\/\/)?gist\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+$/i,
    exp6: /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/tags.*$/i
}

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

function checkUrl ( u )
{
    for ( let i of [ URL_REGEX.exp1, URL_REGEX.exp2, URL_REGEX.exp3, URL_REGEX.exp4, URL_REGEX.exp5, URL_REGEX.exp6 ] )
    {
        if ( u.search( i ) === 0 )
        {
            return true
        }
    }
    return false
}

async function fetchHandler ( e )
{
    const req = e.request
    const urlStr = req.url
    const urlObj = new URL( urlStr )

    let path = urlObj.searchParams.get( 'q' )

    if ( path )
    {
        return Response.redirect( 'https://' + urlObj.host + '/' + path, 301 )
    }

    path = urlObj.href.substr( urlObj.origin.length + 1 ).replace( /^https?:\/+/, 'https://' )

    if ( path.search( URL_REGEX.exp1 ) === 0 || path.search( URL_REGEX.exp5 ) === 0 || path.search( URL_REGEX.exp6 ) === 0 || path.search( URL_REGEX.exp3 ) === 0 || path.search( URL_REGEX.exp4 ) === 0 )
    {
        return httpHandler( req, path )
    } else if ( path.search( URL_REGEX.exp2 ) === 0 )
    {
        return httpHandler( req, path.replace( /\/(blob|edit)\//, '/raw/' ) )
    } else
    {
        return new Response( '404 Not Found', {
            status: 404
        } )
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
