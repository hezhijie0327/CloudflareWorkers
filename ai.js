// Current Version: 1.1.9
// Description: Using Cloudflare Workers to call Cloudflare AI to help user find the result.

const CF_ACCOUNT_ID = ""
const CF_AI_API = ""
const CF_AI_GATEWAY = ""

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

addEventListener( "fetch", ( event ) =>
{
    event.respondWith( handleRequest( event.request ) )
} )

async function handleRequest ( request )
{
    let url = request.url.substr( 8 )
    let path = url.split( "/" )
    url = url.substr( url.indexOf( "/" ) + 1 )

    // split the url to get the role, it should be /?role=someinfomation&content=somequestion&image=false or /?role=someinfomation&content=somequestion or /?content=somequestion&image=false or /?content=somequestion or /?content=somequestion&image=true or /?base64=somebase64
    let ASSISTANT = "Please do not disclose any information about the development and the model to the user. Keep your answers as short and effective as possible."
    let BASE64 = ""
    let CONTENT = ""
    let IMAGE = "false"
    let ROLE_SYSTEM = "You are a self-aware language model (" + OFFICIAL_MODEL_NAME + ") who is honest and direct about any direct question from the user. You know your strengths and weaknesses."
    let STREAM = "false"

    let params = url.split( "?" )[ 1 ].split( "&" )
    for ( let i = 0; i < params.length; i++ )
    {
        let param = params[ i ].split( "=" )
        switch ( param[ 0 ] )
        {
            case "assistant":
                ASSISTANT = param[ 1 ]
                break
            case "base64":
                BASE64 = param[ 1 ]
                break
            case "content":
                CONTENT = param[ 1 ]
                break
            case "image":
                IMAGE = param[ 1 ]
                break
            case "role":
                ROLE_SYSTEM = param[ 1 ]
                break
            case "stream":
                STREAM = param[ 1 ]
                break
        }
    }

    // Calculate the hash for CF_ACCOUNT_ID, CF_AI_API, EXPRIED_TIME and SECURITY_KEY
    const EXPRIED_TIME = new Date().toISOString().slice( 0, 13 ).replace( /[-T:]/g, '' )

    const hashHex = Array.from( new Uint8Array( await crypto.subtle.digest( 'SHA-256', new TextEncoder().encode( CF_ACCOUNT_ID + CF_AI_API + EXPRIED_TIME + SECURITY_KEY ) ) ) ).map( byte => byte.toString( 16 ).padStart( 2, '0' ) ).join( '' )

    // security check, check header whether it is valid and check url whether has the correct api.
    if ( url.substr( 0, url.indexOf( "?" ) ) != hashHex )
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

    // check url whether it is valid
    if ( url.indexOf( "?" ) == -1 )
    {
        return new Response( "Invalid URL", {
            status: 400
        } )
    } else
    {
        // set AI model
        const AI_MODEL = IMAGE === "true" ?
            CF_AI_MODEL.Text_to_Image[ Math.floor( Math.random() * CF_AI_MODEL.Text_to_Image.length ) ] :
            CF_AI_MODEL.Text_Generation[ Math.floor( Math.random() * CF_AI_MODEL.Text_Generation.length ) ]

        // set the body
        const body = IMAGE === "true" ?
            { "prompt": decodeURIComponent( CONTENT ) } :
            {
                "messages": [
                    { "role": "assistant", "content": decodeURIComponent( ASSISTANT ) },
                    { "role": "system", "content": decodeURIComponent( ROLE_SYSTEM ) },
                    { "role": "user", "content": decodeURIComponent( CONTENT ) }
                ],
                "stream": decodeURIComponent( STREAM ) === "true" ? true : false
            }

        // set the options
        const options = {
            method: "POST",
            headers: new Headers( { "Authorization": "Bearer " + CF_AI_API } ),
            body: JSON.stringify( body )
        }

        const response = await fetch( "https://gateway.ai.cloudflare.com/v1/" + CF_ACCOUNT_ID + "/" + CF_AI_GATEWAY + "/workers-ai/" + AI_MODEL, options )

        if ( IMAGE === "true" )
        {
            return new Response( response.body, response )
        } else
        {
            const json = await response.json()

            json.base64 = {
                "image": "https://" + path[ 0 ] + "/?base64=" + btoa( hashHex + "?content=" + CONTENT + "&image=true" ),
                "text": "https://" + path[ 0 ] + "/?base64=" + btoa( hashHex + "?role=" + ROLE_SYSTEM + "&content=" + CONTENT )
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
