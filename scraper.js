// Current Version: 1.0.2
// Description: Using Cloudflare Workers for web scraping.

addEventListener( 'fetch', ( event ) =>
{
    event.respondWith( handleRequest( event.request ) )
} )

async function handleRequest ( request )
{
    const { searchParams } = new URL( request.url )
    let url = searchParams.get( 'url' )
    if ( url && !url.match( /^[a-zA-Z]+:\/\// ) ) url = 'http://' + url

    const selectors = ( searchParams.get( 'selector' ) || 'p' ).split( ',' ).map( s => s.trim() )
    if ( !url || !selectors.length ) return new Response( JSON.stringify( { error: 'Missing url or selector parameters' } ), { status: 400 } )

    try
    {
        const response = await fetch( url )
        const server = response.headers.get( 'server' )
        if ( [ 530, 503, 502, 403, 400 ].includes( response.status ) && ( server === 'cloudflare' || !server ) )
        {
            throw new Error( `Status ${ response.status } requesting ${ url }` )
        }

        const rewriter = new HTMLRewriter()
        const matches = {}
        const currentTexts = Object.fromEntries( selectors.map( selector => [ selector, '' ] ) )

        selectors.forEach( selector =>
        {
            rewriter.on( selector, {
                element ()
                {
                    if ( currentTexts[ selector ].trim() )
                    {
                        if ( !matches[ selector ] ) matches[ selector ] = []
                        matches[ selector ].push( currentTexts[ selector ].trim() )
                        currentTexts[ selector ] = ''
                    }
                },
                text ( text )
                {
                    currentTexts[ selector ] += text.text
                    if ( text.lastInTextNode ) currentTexts[ selector ] = currentTexts[ selector ].replace( /\s\s+/g, ' ' )
                }
            } )
        } )

        await rewriter.transform( response ).arrayBuffer()

        selectors.forEach( selector =>
        {
            if ( currentTexts[ selector ].trim() )
            {
                if ( !matches[ selector ] ) matches[ selector ] = []
                matches[ selector ].push( currentTexts[ selector ].trim() )
            }
        } )

        const result = Object.fromEntries( selectors.map( selector => [ selector, matches[ selector ] || [] ] ) )
        return new Response( JSON.stringify( { result }, null, 2 ), { headers: { 'content-type': 'application/json;charset=UTF-8', 'Access-Control-Allow-Origin': '*' } } )
    } catch ( error )
    {
        return new Response( JSON.stringify( { error: error.message }, null, 2 ), { status: 500, headers: { 'content-type': 'application/json;charset=UTF-8' } } )
    }
}
