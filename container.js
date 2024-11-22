// Current Version: 1.0.5
// Description: Using Cloudflare Workers to speed up container repo visiting.

addEventListener( 'fetch', e => e.respondWith( fetchHandler( e ) ) )

async function fetchHandler ( e )
{
    try
    {
        const url = new URL( e.request.url )
        const hostname = url.hostname

        const domainMapping = {
            'docker': 'registry-1.docker.io',
            'gcr': 'gcr.io',
            'ghcr': 'ghcr.io',
            'k8s': 'k8s.gcr.io',
            'nvcr': 'nvcr.io',
            'quay': 'quay.io',
        }

        const subdomain = hostname.split( '.' )[ 0 ]

        if ( !( subdomain in domainMapping ) )
        {
            return new Response( 'Unsupported domain', { status: 400 } )
        }

        url.hostname = domainMapping[ subdomain ]

        if ( url.hostname === 'registry-1.docker.io' && url.pathname === '/token' )
        {
            const ip = e.request.headers.get( 'CF-Connecting-IP' ) || '127.0.0.1'
            const authHostname = /^(\d{1,3}\.){3}\d{1,3}$/.test( ip )
                ? ( Math.random() < 0.5 ? 'auth.docker.com' : 'auth.docker.io' )
                : 'auth.ipv6.docker.com'

            return fetch( new Request( `https://${ authHostname }${ url.pathname }${ url.search }`, e.request ) )
        }

        let res = await fetch( new Request( url, {
            headers: {
                'Host': url.hostname,
                ...( e.request.headers.has( 'Authorization' ) && { Authorization: e.request.headers.get( 'Authorization' ) } )
            }
        } ), e.request )

        let resHdr = new Headers( res.headers )
        const commonHeaders = {
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': '*',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store'
        }
        Object.entries( commonHeaders ).forEach( ( [ key, value ] ) => resHdr.set( key, value ) )

        if ( resHdr.has( 'Location' ) )
        {
            res = await fetch( new Request( resHdr.get( 'Location' ), {
                body: e.request.body,
                headers: e.request.headers,
                method: e.request.method,
                redirect: 'follow'
            } ) )

            return new Response( res.body, { headers: res.headers, status: res.status } )
        }

        if ( resHdr.has( 'WWW-Authenticate' ) )
        {
            const authRegex = url.hostname === 'registry-1.docker.io'
                ? /https:\/\/auth\.(ipv6\.)?docker\.(io|com)/g
                : `/https://${ url.hostname }/g`

            resHdr.set( 'WWW-Authenticate', resHdr.get( 'WWW-Authenticate' ).replace(
                authRegex,
                `https://${ e.request.url.split( '/' )[ 2 ] }`
            ) )
        }

        return new Response( res.body, { status: res.status, headers: resHdr } )
    } catch ( error )
    {
        return new Response( JSON.stringify( { error: error.message } ), {
            status: 500,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
        } )
    }
}
