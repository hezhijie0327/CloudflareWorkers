// Current Version: 1.0.1
// Description: Using Cloudflare Workers to speed up gcr.io's visting.

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
    if ( e.request.method === 'OPTIONS' )
    {
        return new Response( null, {
            headers: {
                'Access-Control-Allow-Headers': "Authorization, Cache-Control, Content-Type, DNT, If-Modified-Since, Keep-Alive, User-Agent, X-CustomHeader, X-Requested-With",
                'Access-Control-Allow-Methods': 'DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Max-Age': '86400',
            }, status: 204
        } )
    }

    const getReqHeader = ( key ) => e.request.headers.get( key )

    let parameter = {
        headers: {
            'Accept': getReqHeader( "Accept" ),
            'Accept-Encoding': getReqHeader( "Accept-Encoding" ),
            'Accept-Language': getReqHeader( "Accept-Language" ),
            'Cache-Control': 'max-age=0',
            'Connection': 'keep-alive',
            'Host': 'gcr.io',
            'User-Agent': getReqHeader( "User-Agent" ),
        }
    }
    let url = new URL( e.request.url )
    url.hostname = 'gcr.io'
    let workers_url = e.request.url.substr( 8 )
    workers_url = workers_url.split( "/" )

    if ( e.request.headers.has( "Authorization" ) )
    {
        parameter.headers.Authorization = getReqHeader( "Authorization" )
    }

    let original_response = await fetch( new Request( url, e.request ), parameter )
    let original_response_clone = original_response.clone()
    let original_response_headers = original_response.headers
    let original_status = original_response.status
    let original_text = original_response_clone.body
    let replace_response_headers = new Headers( original_response_headers )

    if ( replace_response_headers.get( "WWW-Authenticate" ) )
    {
        replace_response_headers.set( "WWW-Authenticate", original_response_headers.get( "WWW-Authenticate" ).replace( new RegExp( 'https://gcr.io', 'g' ), 'https://' + workers_url[ 0 ] ) )
    }

    if ( replace_response_headers.get( "Location" ) )
    {
        return httpHandler( e.request, replace_response_headers.get( "Location" ) )
    }

    replace_response_headers.set( 'Access-Control-Allow-Headers', "Authorization, Cache-Control, Content-Type, DNT, If-Modified-Since, Keep-Alive, User-Agent, X-CustomHeader, X-Requested-With" )
    replace_response_headers.set( 'Access-Control-Allow-Methods', 'DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT' )
    replace_response_headers.set( 'Access-Control-Allow-Origin', '*' )

    return new Response( original_text, {
        status: original_status,
        headers: replace_response_headers
    } )

}

function httpHandler ( req, pathname )
{
    const reqHdrRaw = req.headers

    if ( req.method === 'OPTIONS' && reqHdrRaw.has( 'Access-Control-Allow-Headers' ) )
    {
        return new Response( null, {
            headers: {
                'Access-Control-Allow-Headers': "Authorization, Cache-Control, Content-Type, DNT, If-Modified-Since, Keep-Alive, User-Agent, X-CustomHeader, X-Requested-With",
                'Access-Control-Allow-Methods': 'DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Max-Age': '86400',
            }, status: 204
        } )
    }

    let rawLen = ''
    let urlStr = pathname

    const reqHdrNew = new Headers( reqHdrRaw )
    reqHdrNew.delete( 'Authorization' )
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
                'access-control-expose-headers': '--error',
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
