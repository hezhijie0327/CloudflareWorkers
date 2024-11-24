// Current Version: 1.0.0
// Description: Using Cloudflare Workers for web scraping.

addEventListener( 'fetch', ( event ) =>
{
    event.respondWith( handleRequest( event.request ) )
} )

async function handleRequest ( request )
{
    const searchParams = new URL( request.url ).searchParams

    let url = searchParams.get( 'url' )
    if ( url && !url.match( /^[a-zA-Z]+:\/\// ) ) url = 'http://' + url

    const selector = searchParams.get( 'selector' )
    const attr = searchParams.get( 'attr' )

    if ( !url || !selector )
    {
        return new Response(
            JSON.stringify( { error: 'Missing url or selector parameters' } ),
            {
                status: 400,
                headers: { 'content-type': 'application/json;charset=UTF-8' },
            }
        )
    }

    try
    {
        const response = await fetch( url )
        const server = response.headers.get( 'server' )
        const isError = [ 530, 503, 502, 403, 400 ].includes( response.status ) &&
            ( server === 'cloudflare' || !server )

        if ( isError )
        {
            throw new Error( `Status ${ response.status } requesting ${ url }` )
        }

        const rewriter = new HTMLRewriter()
        const matches = {}
        let currentText = ''

        rewriter.on( selector, {
            element ()
            {
                if ( !matches[ selector ] ) matches[ selector ] = []
                if ( currentText.trim() )
                {
                    matches[ selector ].push( currentText.trim() )
                    currentText = ''
                }
            },
            text ( text )
            {
                currentText += text.text + ' ' // Add space by default
                if ( text.lastInTextNode )
                {
                    currentText = currentText.replace( /\s\s+/g, ' ' ) // Clean excess spaces
                }
            },
        } )

        await rewriter.transform( response ).arrayBuffer()

        // Ensure final text is included
        if ( currentText.trim() )
        {
            if ( !matches[ selector ] ) matches[ selector ] = []
            matches[ selector ].push( currentText.trim() )
        }

        const result = attr
            ? matches[ selector ].map( ( el ) => el.getAttribute( attr ) || '' ).filter( Boolean )
            : matches[ selector ] || []

        return new Response(
            JSON.stringify( { result: result.length === 1 ? result[ 0 ] : result }, null, 2 ), // Always pretty-print
            {
                headers: {
                    'content-type': 'application/json;charset=UTF-8',
                    'Access-Control-Allow-Origin': '*',
                },
            }
        )
    } catch ( error )
    {
        return new Response(
            JSON.stringify( { error: error.message }, null, 2 ), // Always pretty-print
            {
                status: 500,
                headers: { 'content-type': 'application/json;charset=UTF-8' },
            }
        )
    }
}
