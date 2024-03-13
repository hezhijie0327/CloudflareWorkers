// Current Version: 1.1.2
// Description: Using Cloudflare Workers to call Cloudflare AI to help user find the result.

addEventListener( "fetch", ( event ) =>
{
    event.respondWith( handleRequest( event.request ) )
} )

async function handleRequest ( request )
{
    const CF_ACCOUNT_ID = ""
    const CF_AI_API = ""

    const CF_AI_MODEL = {
        // https://developers.cloudflare.com/workers-ai/models/#text-generation
        "Text_Generation": [
            //"@cf/defog/sqlcoder-7b-2", // SQL model
            "@cf/deepseek-ai/deepseek-math-7b-base",
            "@cf/deepseek-ai/deepseek-math-7b-instruct",
            "@cf/thebloke/discolm-german-7b-v1-awq",
            "@cf/tiiuae/falcon-7b-instruct",
            //"@cf/meta/llama-2-7b-chat-int8", // Paid model
            //"@cf/meta/llama-2-7b-chat-fp16", // Paid model
            "@cf/microsoft/phi-2",
            //"@cf/mistral/mistral-7b-instruct-v0.1", // Paid model
            "@cf/openchat/openchat-3.5-0106",
            "@cf/qwen/qwen1.5-0.5b-chat",
            "@cf/qwen/qwen1.5-1.8b-chat",
            "@cf/qwen/qwen1.5-7b-chat-awq",
            "@cf/qwen/qwen1.5-14b-chat-awq",
            "@cf/tinyllama/tinyllama-1.1b-chat-v1.0",
            "@hf/thebloke/deepseek-coder-6.7b-base-awq",
            "@hf/thebloke/deepseek-coder-6.7b-instruct-awq",
            "@hf/thebloke/llama-2-13b-chat-awq",
            "@hf/thebloke/llamaguard-7b-awq",
            "@hf/thebloke/mistral-7b-instruct-v0.1-awq",
            "@hf/thebloke/neural-chat-7b-v3-1-awq",
            "@hf/thebloke/openhermes-2.5-mistral-7b-awq",
            "@hf/thebloke/zephyr-7b-beta-awq",
        ],
        // https://developers.cloudflare.com/workers-ai/models/#text-to-image
        "Text_to_Image": [
            "@cf/bytedance/stable-diffusion-xl-lightning",
            "@cf/lykon/dreamshaper-8-lcm",
            "@cf/runwayml/stable-diffusion-v1-5-img2img",
            "@cf/runwayml/stable-diffusion-v1-5-inpainting",
            "@cf/stabilityai/stable-diffusion-xl-base-1.0",
        ]
    }

    const OFFICIAL_MODEL_NAME = "Cloudflare AI"
    const SECURITY_KEY = ""

    let BASE64 = ""
    let CONTENT = ""
    let EXPRIED_TIME = '' + new Date().getFullYear() + ( '0' + ( new Date().getMonth() + 1 ) ).slice( -2 ) + ( '0' + new Date().getDate() ).slice( -2 ) + ( '0' + new Date().getHours() ).slice( -2 )
    let HASH = ""
    let IMAGE = "false"
    let ROLE_SYSTEM = "You are a self-aware language model (" + OFFICIAL_MODEL_NAME + ") who is honest and direct about any direct question from the user. You know your strengths and weaknesses."

    let url = request.url.substr( 8 )
    let path = url.split( "/" )
    url = url.substr( url.indexOf( "/" ) + 1 )

    // split the url to get the role, content and image
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
        } else if ( param[ 0 ] == "image" )
        {
            IMAGE = param[ 1 ]
        } else if ( param[ 0 ] == "base64" )
        {
            BASE64 = param[ 1 ]
        }
    }

    // Calculate the hash for CF_ACCOUNT_ID, CF_AI_API and EXPRIED_TIME
    for ( let i = 0; i < CF_ACCOUNT_ID.length; i++ )
    {
        HASH += CF_ACCOUNT_ID.charCodeAt( i ).toString( 16 )
    }
    for ( let i = 0; i < CF_AI_API.length; i++ )
    {
        HASH += CF_AI_API.charCodeAt( i ).toString( 16 )
    }
    for ( let i = 0; i < EXPRIED_TIME.length; i++ )
    {
        HASH += EXPRIED_TIME.charCodeAt( i ).toString( 16 )
    }
    for ( let i = 0; i < SECURITY_KEY.length; i++ )
    {
        HASH += SECURITY_KEY.charCodeAt( i ).toString( 16 )
    }

    // security check, check header whether it is valid and check url whether has the correct api.
    if ( url.substr( 0, url.indexOf( "?" ) ) != HASH )
    {
        if ( BASE64 == "" )
        {
            if ( request.headers.get( "Authorization" ) != "Bearer " + CF_AI_API )
            {
                return new Response( "Invalid API", { status: 400 } )
            }
        } else
        {
            // Parsing base64 and 302 redirect to the original URL
            return Response.redirect( "https://" + path[ 0 ] + '/' + atob( BASE64 ), 301 )
        }
    }

    // check url whether it is valid, it should be /?role=someinfomation&content=somequestion&image=false or /?role=someinfomation&content=somequestion or /?content=somequestion&image=false or /?content=somequestion or /?content=somequestion&image=true or /?base64=somebase64
    if ( url.indexOf( "?" ) == -1 )
    {
        return new Response( "Invalid URL", { status: 400 } )
    } else
    {
        let AI_MODEL = ""

        let body = {}
        let headers = new Headers()

        // set the headers
        headers.set( "Authorization", "Bearer " + CF_AI_API )

        // set the body
        if ( IMAGE == "true" )
        {
            body = {
                "prompt": decodeURIComponent( CONTENT )
            }
        } else
        {
            body = {
                "messages": [
                    {
                        "role": "system",
                        "content": decodeURIComponent( ROLE_SYSTEM )
                    },
                    {
                        "role": "user",
                        "content": decodeURIComponent( CONTENT )
                    }
                ]
            }
        }

        // set the options
        let options = {
            method: "POST",
            headers: headers,
            body: JSON.stringify( body )
        }

        // set AI model
        if ( IMAGE == "true" )
        {
            AI_MODEL = CF_AI_MODEL.Text_to_Image[ Math.floor( Math.random() * CF_AI_MODEL.Text_to_Image.length ) ]
        } else
        {
            AI_MODEL = CF_AI_MODEL.Text_Generation[ Math.floor( Math.random() * CF_AI_MODEL.Text_Generation.length ) ]
        }

        // set the response
        let response = await fetch( "https://api.cloudflare.com/client/v4/accounts/" + CF_ACCOUNT_ID + "/ai/run/" + AI_MODEL, options )

        // call the AI, random select a model
        if ( IMAGE == "true" )
        {
            return new Response( response.body, response )
        } else
        {
            let json = await response.json()

            json.base64 = {
                "image": "https://" + path[ 0 ] + "/?base64=" + btoa( HASH + "?content=" + CONTENT + "&image=true" ),
                "text": "https://" + path[ 0 ] + "/?base64=" + btoa( HASH + "?role=" + ROLE_SYSTEM + "&content=" + CONTENT )
            }

            json.model = {
                "official": OFFICIAL_MODEL_NAME,
                "origin": CF_AI_MODEL.Text_Generation
            }

            // return the response
            return new Response( JSON.stringify( json ), response )
        }
    }
}
