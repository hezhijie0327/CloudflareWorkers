// Current Version: 1.0.4
// Description: Using Cloudflare Workers to call Cloudflare AI to help user find the result.

addEventListener( "fetch", ( event ) =>
{
    event.respondWith( handleRequest( event.request ) )
} )

async function handleRequest ( request )
{
    const CF_ACCOUNT_ID = ""
    const CF_AI_API = ""
    const CF_AI_MODEL = "@cf/qwen/qwen1.5-14b-chat-awq"

    const OFFICIAL_MODEL_NAME = "Cloudflare AI"

    let url = request.url.substr( 8 )
    url = url.substr( url.indexOf( "/" ) + 1 )

    // security check, check header whether it is valid and check url whether has the correct api.
    if ( url.substr( 0, url.indexOf( "?" ) ) != CF_AI_API )
    {
        if ( request.headers.get( "Authorization" ) != "Bearer " + CF_AI_API )
        {
            return new Response( "Invalid API", { status: 400 } )
        }
    }

    // check url whether it is valid, it should be /?role=someinfomation&content=somequestion or /?content=somequestion
    if ( url.indexOf( "?" ) == -1 )
    {
        return new Response( "Invalid URL", { status: 400 } )
    } else
    {
        // Set default ROLE_SYSTEM
        let ROLE_SYSTEM = "You are a self-aware language model (" + OFFICIAL_MODEL_NAME + ") who is honest and direct about any direct question from the user. You know your strengths and weaknesses."
        let CONTENT = ""

        // split the url to get the role and content
        let params = url.split( "?" )[ 1 ].split( "&" )
        for ( let i = 0; i < params.length; i++ )
        {
            let param = params[ i ].split( "=" )
            if ( param[ 0 ] == "role" )
            {
                ROLE_SYSTEM = param[ 1 ]
            } else if ( param[ 0 ] == "content" )
            {
                CONTENT = param[ 1 ]
            }
        }

        // set the headers
        let headers = new Headers()
        headers.set( "Authorization", "Bearer " + CF_AI_API )

        // set the body
        let body = {
            "messages": [
                {
                    "role": "system",
                    "content": decodeURIComponent(ROLE_SYSTEM)
                },
                {
                    "role": "user",
                    "content": decodeURIComponent(CONTENT)
                }
            ]
        }

        // set the options
        let options = {
            method: "POST",
            headers: headers,
            body: JSON.stringify( body )
        }

        // call the AI
        let response = await fetch( "https://api.cloudflare.com/client/v4/accounts/" + CF_ACCOUNT_ID + "/ai/run/" + CF_AI_MODEL, options )

        // return the response
        return new Response( response.body, response )
    }
}
