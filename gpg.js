// Current Version: 1.1.4
// Description: Using Cloudflare Workers to backup your GPG key.

addEventListener( "fetch", ( event ) =>
{
    event.respondWith( handleRequest( event.request ) )
} )

async function handleRequest ( request )
{
    let url = request.url.substr( 8 )
    path = url.split( "/" )
    url = url.substr( url.indexOf( "/" ) + 1 )
    const gpg = {
        info: {
            private: "curl -fsSL 'https://" + path[ 0 ] + "/" + url + "' | jq -r '.key.private' | base64 -d | gpg --batch --import --passphrase '<PASSWORD>'",
            public: "curl -fsSL 'https://" + path[ 0 ] + "/" + url + "' | jq -r '.key.public' | base64 -d | gpg --batch --import",
            trust: "Z3BnIC0tbGlzdC1rZXlzIC0tZmluZ2VycHJpbnQgXAogICAgfCBncmVwICdecHViJyAtQSAxIFwKICAgIHwgdGFpbCAtbiAxIFwKICAgIHwgdHIgLWQgJyAnIFwKICAgIHwgYXdrICdCRUdJTiB7IEZTID0gIlxuIiB9OyB7IHByaW50ICQxIjo2OiIgfScgXAogICAgfCBncGcgLS1pbXBvcnQtb3duZXJ0cnVzdAo=",
        },
        key: {
            private: "",
            public: "",
        },
        secret: btoa( "" ),
    }
    if ( url === atob( gpg.secret ) + "/import.json" )
    {
        return new Response( JSON.stringify( gpg, null, 2 ), {
            status: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "content-type": "application/json;charset=UTF-8",
            },
        } )
    } else if ( url === atob( gpg.secret ) + "/private.txt" )
    {
        return new Response( atob( gpg.key.private ), {
            status: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "content-type": "text/plain;charset=UTF-8",
            },
        } )
    } else if ( url === atob( gpg.secret ) + "/public.txt" )
    {
        return new Response( atob( gpg.key.public ), {
            status: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "content-type": "text/plain;charset=UTF-8",
            },
        } )
    } else
    {
        return new Response( "404 Not Found", {
            status: 404,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "content-type": "text/plain;charset=UTF-8",
            },
        } )
    }
}
