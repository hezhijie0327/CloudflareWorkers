// Current Version: 1.1.1
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
            'ecr': 'public.ecr.aws',
            'elastic': 'docker.elastic.co',
            'gcr': 'gcr.io',
            'ghcr': 'ghcr.io',
            'k8s': 'registry.k8s.io',
            'mcr': 'mcr.microsoft.com',
            'nvcr': 'nvcr.io',
            'quay': 'quay.io',
        }

        const subdomain = hostname.split( '.' )[ 0 ]

        if ( !( subdomain in domainMapping ) )
        {
            return new Response( 'Unsupported domain', { status: 400 } )
        }

        url.hostname = domainMapping[ subdomain ]

        const isDockerHub = url.hostname === domainMapping[ 'docker' ]

        if ( isDockerHub && url.pathname === '/token' )
        {
            const ip = e.request.headers.get( 'CF-Connecting-IP' ) || '127.0.0.1'
            const authHostname = /^(\d{1,3}\.){3}\d{1,3}$/.test( ip )
                ? ( Math.random() < 0.5 ? 'auth.docker.com' : 'auth.docker.io' )
                : 'auth.ipv6.docker.com'

            return fetch( new Request( `https://${ authHostname }${ url.pathname }${ url.search }`, e.request ) )
        }

        let reqHdr = new Headers( e.request.headers )
        const commonReqHeaders = {
            'Host': url.hostname,
        }
        Object.entries( commonReqHeaders ).forEach( ( [ key, value ] ) => reqHdr.set( key, value ) )

        let res = await fetch( new Request( url, { headers: reqHdr } ), e.request )

        let resHdr = new Headers( res.headers )
        const commonResHeaders = {
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': '*',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store'
        }
        Object.entries( commonResHeaders ).forEach( ( [ key, value ] ) => resHdr.set( key, value ) )

        if ( resHdr.has( 'Location' ) )
        {
            res = await fetch( new Request( resHdr.get( 'Location' ), {
                method: isDockerHub && res.status === 307 ? "GET" : undefined,
                redirect: "follow"
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

        return new Response( res.body, { headers: resHdr, status: res.status } )
    } catch ( error )
    {
        return new Response( JSON.stringify( { error: error.message } ), {
            status: 500,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
        } )
    }
}
