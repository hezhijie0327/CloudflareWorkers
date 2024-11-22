// Current Version: 1.0.6
// Description: Using Cloudflare Workers to update your DNS record.

addEventListener( "fetch", event =>
{
    event.respondWith( handleRequest( event.request ) )
} )

async function handleRequest ( request )
{
    const headers = request.headers

    const [ xAuthEmail, xAuthKey ] = ( headers.get( "Authorization" ) || '' ).replace( 'Bearer ', '' ).split( ':' )
    const authData = { xAuthEmail, xAuthKey }

    const requestUrl = new URL( request.url )
    const params = requestUrl.searchParams
    const requestData = {
        operation: ( params.get( "operation" ) || 'CREATE' ).toUpperCase(),
        recordName: params.get( "record_name" ) || null,
        recordProxy: params.get( "record_proxy" ) === 'false',
        recordTTL: Number( params.get( "record_ttl" ) ) || 0,
        recordType: ( params.get( "record_type" ) || 'A' ).toUpperCase(),
        recordValue: params.get( "record_value" ) || headers.get( "CF-Connecting-IP" ) || null,
        zoneName: params.get( "record_name" )
            ? params.get( "record_name" ).split( '.' ).slice( -2 ).join( '.' )
            : null,
    }

    const zoneID = await getZoneID( authData.xAuthEmail, authData.xAuthKey, requestData.zoneName )
    const recordID = await getRecordID( authData.xAuthEmail, authData.xAuthKey, zoneID, requestData.recordName, requestData.recordType )
    const recordData = { recordID, zoneID }

    const debug = { authData, recordData, requestData, }

    let result = false

    if ( !authData.xAuthEmail || !authData.xAuthKey )
    {
        return new Response( JSON.stringify( { debug, result } ), { status: 401, headers: { "Content-Type": "application/json" } } )
    }

    switch ( requestData.operation )
    {
        case 'CREATE':
            result = await ddnsCreateRecord( authData.xAuthEmail, authData.xAuthKey, recordData.zoneID, requestData.recordName, requestData.recordType, requestData.recordValue, requestData.recordTTL, requestData.recordProxy )

        case 'UPDATE':
            if ( recordData.recordID )
            {
                result = await ddnsUpdateRecord( authData.xAuthEmail, authData.xAuthKey, recordData.zoneID, recordData.recordID, requestData.recordName, requestData.recordType, requestData.recordValue, requestData.recordTTL, requestData.recordProxy )
            }

        case 'DELETE':
            if ( recordData.recordID )
            {
                result = await ddnsDeleteRecord( authData.xAuthEmail, authData.xAuthKey, recordData.zoneID, recordData.recordID )
            }
    }

    return new Response( JSON.stringify( { debug, result } ), { status: result ? 200 : 500 } )
}

async function getRecordID ( XAuthEmail, XAuthKey, ZoneID, RecordName, RecordType )
{
    const url = `https://api.cloudflare.com/client/v4/zones/${ ZoneID }/dns_records?name=${ RecordName }`

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
}

async function getZoneID ( XAuthEmail, XAuthKey, ZoneName )
{
    const url = `https://api.cloudflare.com/client/v4/zones?name=${ ZoneName }`

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
}

async function ddnsCreateRecord ( XAuthEmail, XAuthKey, ZoneID, RecordName, RecordType, RecordValue, RecordTTL, RecordProxy )
{
    const url = `https://api.cloudflare.com/client/v4/zones/${ ZoneID }/dns_records`
    const requestData = { type: RecordType, name: RecordName, content: RecordValue, ttl: RecordTTL, proxied: RecordProxy }

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
}

async function ddnsUpdateRecord ( XAuthEmail, XAuthKey, ZoneID, RecordID, RecordName, RecordType, RecordValue, RecordTTL, RecordProxy )
{
    const url = `https://api.cloudflare.com/client/v4/zones/${ ZoneID }/dns_records/${ RecordID }`
    const requestData = { type: RecordType, name: RecordName, content: RecordValue, ttl: RecordTTL, proxied: RecordProxy }

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
}

async function ddnsDeleteRecord ( XAuthEmail, XAuthKey, ZoneID, RecordID )
{
    const url = `https://api.cloudflare.com/client/v4/zones/${ ZoneID }/dns_records/${ RecordID }`

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
}
