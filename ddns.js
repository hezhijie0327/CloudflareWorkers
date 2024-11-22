// Current Version: 1.0.4
// Description: Using Cloudflare Workers to update your DNS record.

addEventListener( "fetch", event =>
{
    event.respondWith( handleRequest( event.request ) )
} )

async function handleRequest ( request )
{
    const headers = request.headers

    const [ xAuthEmail, xAuthKey ] = ( headers.get( "Authorization" ) || '' ).replace( 'Bearer ', '' ).split( ':' )

    const requestUrl = new URL( request.url )
    const params = requestUrl.searchParams

    const operation = ( params.get( "operation" ) || 'CREATE' ).toUpperCase()
    const recordProxy = params.get( "record_proxy" ) || 'false'
    const recordName = params.get( "record_name" ) || null
    const recordType = ( params.get( "record_type" ) || 'A' ).toUpperCase()
    const recordTTL = params.get( "record_ttl" ) || 0
    const recordValue = params.get( "record_value" ) || headers.get( "CF-Connecting-IP" ) || null
    const zoneName = recordName ? recordName.split( '.' ).slice( -2 ).join( '.' ) : null

    if ( !xAuthEmail || !xAuthKey )
    {
        return new Response(
            JSON.stringify( { error: "Missing X-Auth-Email or X-Auth-Key" } ),
            { status: 400, headers: { "Content-Type": "application/json" } }
        )
    }

    const accountName = await getAccountName( xAuthEmail, xAuthKey )
    if ( !accountName )
    {
        return new Response(
            JSON.stringify( { error: "Account Name Not Found" } ),
            { status: 404, headers: { "Content-Type": "application/json" } }
        )
    }

    const zoneID = await getZoneID( xAuthEmail, xAuthKey, zoneName )
    if ( !zoneID )
    {
        return new Response(
            JSON.stringify( { error: "Zone ID Not Found" } ),
            { status: 404, headers: { "Content-Type": "application/json" } }
        )
    }

    let result
    switch ( operation )
    {
        case 'CREATE':
            result = await ddnsCreateRecord( xAuthEmail, xAuthKey, zoneID, recordName, recordType, recordValue, recordTTL, recordProxy === 'false' )
            return result
                ? new Response( JSON.stringify( {
                    message: "Record created successfully.",
                    operation,
                    zoneName,
                    recordName,
                    recordType,
                    recordValue,
                    recordTTL,
                    recordProxy
                } ), { status: 200 } )
                : new Response( JSON.stringify( {
                    error: "Failed to create record.",
                    operation,
                    zoneName,
                    recordName,
                    recordType,
                    recordValue,
                    recordTTL,
                    recordProxy
                } ), { status: 500 } )

        case 'UPDATE':
            const recordID = await getRecordID( xAuthEmail, xAuthKey, zoneID, recordName, recordType )
            if ( !recordID )
            {
                return new Response( JSON.stringify( {
                    error: "Record ID Not Found",
                    operation,
                    zoneName,
                    recordName,
                    recordType
                } ), { status: 404, headers: { "Content-Type": "application/json" } } )
            }
            result = await ddnsUpdateRecord( xAuthEmail, xAuthKey, zoneID, recordID, recordName, recordType, recordValue, recordTTL, recordProxy === 'false' )
            return result
                ? new Response( JSON.stringify( {
                    message: "Record updated successfully.",
                    operation,
                    zoneName,
                    recordName,
                    recordType,
                    recordValue,
                    recordTTL,
                    recordProxy
                } ), { status: 200 } )
                : new Response( JSON.stringify( {
                    error: "Failed to update record.",
                    operation,
                    zoneName,
                    recordName,
                    recordType,
                    recordValue,
                    recordTTL,
                    recordProxy
                } ), { status: 500 } )

        case 'DELETE':
            const deleteRecordID = await getRecordID( xAuthEmail, xAuthKey, zoneID, recordName, recordType )
            if ( !deleteRecordID )
            {
                return new Response( JSON.stringify( {
                    error: "Record ID Not Found",
                    operation,
                    zoneName,
                    recordName,
                    recordType
                } ), { status: 404, headers: { "Content-Type": "application/json" } } )
            }
            result = await ddnsDeleteRecord( xAuthEmail, xAuthKey, zoneID, deleteRecordID )
            return result
                ? new Response( JSON.stringify( {
                    message: "Record deleted successfully.",
                    operation,
                    zoneName,
                    recordName,
                    recordType
                } ), { status: 200 } )
                : new Response( JSON.stringify( {
                    error: "Failed to delete record.",
                    operation,
                    zoneName,
                    recordName,
                    recordType
                } ), { status: 500 } )

        default:
            return new Response( JSON.stringify( {
                error: "Invalid operation.",
                operation,
                zoneName,
                recordName
            } ), { status: 400, headers: { "Content-Type": "application/json" } } )
    }

}

async function ddnsCreateRecord ( XAuthEmail, XAuthKey, ZoneID, RecordName, RecordType, RecordValue, RecordTTL, RecordProxy )
{
    const url = `https://api.cloudflare.com/client/v4/zones/${ ZoneID }/dns_records`
    const requestData = { type: RecordType, name: RecordName, content: RecordValue, ttl: RecordTTL, proxied: RecordProxy }

    try
    {
        const response = await fetch( url, {
            method: 'POST',
            headers: {
                'X-Auth-Email': XAuthEmail,
                'X-Auth-Key': XAuthKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify( requestData )
        } )
        const data = await response.json()
        return data.success === true
    } catch ( error )
    {
        console.error( error )
        return false
    }
}

async function ddnsUpdateRecord ( XAuthEmail, XAuthKey, ZoneID, RecordID, RecordName, RecordType, RecordValue, RecordTTL, RecordProxy )
{
    const url = `https://api.cloudflare.com/client/v4/zones/${ ZoneID }/dns_records/${ RecordID }`
    const requestData = { type: RecordType, name: RecordName, content: RecordValue, ttl: RecordTTL, proxied: RecordProxy }

    try
    {
        const response = await fetch( url, {
            method: 'PUT',
            headers: {
                'X-Auth-Email': XAuthEmail,
                'X-Auth-Key': XAuthKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify( requestData )
        } )
        const data = await response.json()
        return data.success === true
    } catch ( error )
    {
        console.error( error )
        return false
    }
}

async function ddnsDeleteRecord ( XAuthEmail, XAuthKey, ZoneID, RecordID )
{
    const url = `https://api.cloudflare.com/client/v4/zones/${ ZoneID }/dns_records/${ RecordID }`

    try
    {
        const response = await fetch( url, {
            method: 'DELETE',
            headers: {
                'X-Auth-Email': XAuthEmail,
                'X-Auth-Key': XAuthKey,
                'Content-Type': 'application/json'
            }
        } )
        const data = await response.json()
        return data.success === true
    } catch ( error )
    {
        console.error( error )
        return false
    }
}

async function getRecordID ( XAuthEmail, XAuthKey, ZoneID, RecordName, RecordType )
{
    const url = `https://api.cloudflare.com/client/v4/zones/${ ZoneID }/dns_records?name=${ RecordName }`

    try
    {
        const response = await fetch( url, {
            method: "GET",
            headers: {
                "X-Auth-Email": XAuthEmail,
                "X-Auth-Key": XAuthKey,
                "Content-Type": "application/json",
            },
        } )
        const data = await response.json()
        if ( data.success && data.result.length > 0 )
        {
            const record = data.result.find( record => record.type === RecordType )
            return record ? record.id : null
        }
        return null
    } catch ( error )
    {
        console.error( error )
        return null
    }
}

async function getZoneID ( XAuthEmail, XAuthKey, ZoneName )
{
    const url = `https://api.cloudflare.com/client/v4/zones?name=${ ZoneName }`

    try
    {
        const response = await fetch( url, {
            method: "GET",
            headers: {
                "X-Auth-Email": XAuthEmail,
                "X-Auth-Key": XAuthKey,
                "Content-Type": "application/json",
            },
        } )
        const data = await response.json()
        return data.success && data.result.length > 0 ? data.result[ 0 ].id : null
    } catch ( error )
    {
        console.error( error )
        return null
    }
}

async function getAccountName ( XAuthEmail, XAuthKey )
{
    const url = "https://api.cloudflare.com/client/v4/accounts?page=1&per_page=5&direction=desc"

    try
    {
        const response = await fetch( url, {
            method: "GET",
            headers: {
                "X-Auth-Email": XAuthEmail,
                "X-Auth-Key": XAuthKey,
                "Content-Type": "application/json",
            },
        } )
        const data = await response.json()
        return data.success && data.result.length > 0 ? data.result[ 0 ].name : null
    } catch ( error )
    {
        console.error( error )
        return null
    }
}
