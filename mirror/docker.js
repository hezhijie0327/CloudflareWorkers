// Current Version: 1.0.5
// Description: Using Cloudflare Workers to speed up registry-1.docker.io's visting.

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
    const getReqHeader = ( key ) => e.request.headers.get( key )

    let parameter = {
        headers: {
            'Accept': getReqHeader( "Accept" ),
            'Accept-Encoding': getReqHeader( "Accept-Encoding" ),
            'Accept-Language': getReqHeader( "Accept-Language" ),
            'Cache-Control': 'max-age=0',
            'Connection': 'keep-alive',
            'Host': 'registry-1.docker.io',
            'User-Agent': getReqHeader( "User-Agent" ),
        }
    }
    let url = new URL( e.request.url )
    url.hostname = 'registry-1.docker.io'
    let workers_url = e.request.url.substr( 8 )
    workers_url = workers_url.split( "/" )

    if ( url.pathname === '/token' )
    {
        let visiting_ip = e.request.headers.get( 'CF-Connecting-IP' )

        if ( visiting_ip === null )
        {
            visiting_ip = '127.0.0.1'
        }

        if ( visiting_ip.search( /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}$/i ) === 0 )
        {
            switch ( Math.floor( Math.random() * 2 ) )
            {
                case 0:
                    var auth_hostname = 'auth.docker.com'
                case 1:
                    var auth_hostname = 'auth.docker.io'
            }
        } else
        {
            var auth_hostname = 'auth.ipv6.docker.com'
        }

        return fetch( new Request( 'https://' + auth_hostname + url.pathname + url.search, e.request ) )
    }

    if ( e.request.headers.has( "Authorization" ) )
    {
        parameter.headers.Authorization = getReqHeader( "Authorization" )
    }

    let response = await fetch( new Request( url, e.request ), parameter )
    let temp_headers = new Headers( response.headers )

    if ( temp_headers.get( "WWW-Authenticate" ) )
    {
        temp_headers.set( "WWW-Authenticate", response.headers.get( "WWW-Authenticate" ).replace( new RegExp( 'https://auth.(ipv6.)?docker.(io|com)', 'g' ), 'https://' + workers_url[ 0 ] ) )
    }

    if ( temp_headers.get( "Location" ) )
    {
        return httpHandler( e.request, temp_headers.get( "Location" ) )
    }

    return new Response( response.body, {
        status: response.status,
        headers: temp_headers
    } )

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
