// Current Version: 1.0.1
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
            'quay': 'quay.io',
        }

        const subdomain = hostname.split( '.' )[ 0 ]

        if ( !( subdomain in domainMapping ) )
        {
            return new Response( 'Unsupported domain', { status: 400 } )
        }

        url.hostname = domainMapping[ subdomain ]

        let response = await fetch( new Request( url, {
            headers: {
                'Host': url.hostname,
                ...( e.request.headers.has( 'Authorization' ) && { Authorization: e.request.headers.get( 'Authorization' ) } )
            }
        } ), e.request )

        let tempHeaders = new Headers( response.headers )

        if ( tempHeaders.has( 'WWW-Authenticate' ) )
        {
            const authRegex = subdomain === 'docker'
                ? /https:\/\/auth\.(ipv6\.)?docker\.(io|com)/g
                : new RegExp( `https://${ url.hostname }`, 'g' )

            tempHeaders.set( 'WWW-Authenticate', tempHeaders.get( 'WWW-Authenticate' ).replace(
                authRegex,
                `https://${ e.request.url.split( '/' )[ 2 ] }`
            ) )
        }

        if ( tempHeaders.get( 'Location' ) )
        {
            const res = await fetch( new Request( tempHeaders.get( 'Location' ), {
                body: e.request.body,
                headers: e.request.headers,
                method: e.request.method,
                redirect: 'follow'
            } ) )
            const resHdrNew = new Headers( res.headers )

            resHdrNew.set( 'Access-Control-Allow-Headers', '*' )
            resHdrNew.set( 'Access-Control-Allow-Methods', '*' )
            resHdrNew.set( 'Access-Control-Allow-Origin', '*' )
            resHdrNew.set( 'Cache-Control', 'no-store' )

            return new Response( res.body, { headers: resHdrNew, status: res.status } )
        }

        return new Response( response.body, { status: response.status, headers: tempHeaders } )
    } catch ( error )
    {
        return new Response( JSON.stringify( { error: error.message } ), {
            status: 500,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
        } )
    }
}
