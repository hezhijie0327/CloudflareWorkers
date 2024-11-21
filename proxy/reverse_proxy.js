// Current Version: 1.1.2
// Description: Using Cloudflare Workers to Reverse Proxy everything.

addEventListener( 'fetch', event =>
{
    event.respondWith( handleRequest( event.request ) )
} )

async function handleRequest ( request )
{
    try
    {
        const url = new URL( request.url )

        const urlStr = request.url
        const urlObj = new URL( urlStr )

        let path = decodeURIComponent(
            urlObj.href.substring( urlObj.origin.length + 1 )
        ).replace( /^https?:\/+/, 'https://' )

        const targetUrl = path + urlObj.search + urlObj.hash

        const headers = new Headers( [ ...request.headers ].filter( ( [ name ] ) => !name.startsWith( 'cf-' ) ) )

        const response = await fetch( new Request( targetUrl, {
            headers,
            method: request.method,
            body: request.body,
            redirect: 'manual'
        } ) )

        let body = response.body

        if ( [ 301, 302, 303, 307, 308 ].includes( response.status ) )
        {
            const location = response.headers.get( 'location' )
            return new Response( body, {
                status: response.status,
                headers: {
                    ...response.headers,
                    'Location': `/${ encodeURIComponent( location ) }`
                }
            } )
        }

        if ( response.headers.get( "Content-Type" )?.includes( "text/html" ) )
        {
            const originalText = await response.text()
            body = originalText.replace(
                /((href|src|action)=["'])\/(?!\/)/g,
                `$1${ url.protocol }//${ url.host }/${ new URL( targetUrl ).origin }/`
            )
        }

        const modifiedResponse = new Response( body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
        } )

        modifiedResponse.headers.set( 'Access-Control-Allow-Headers', '*' )
        modifiedResponse.headers.set( 'Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE' )
        modifiedResponse.headers.set( 'Access-Control-Allow-Origin', '*' )
        modifiedResponse.headers.set( 'Cache-Control', 'no-store' )

        return modifiedResponse
    } catch ( error )
    {
        return new Response( JSON.stringify( { error: error.message } ), {
            status: 500,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
        } )
    }
}
