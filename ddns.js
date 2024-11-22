addEventListener( "fetch", ( event ) =>
{
    event.respondWith( handleRequest( event.request ) )
} )

async function handleRequest ( request )
{
    // 从请求头中获取 X-Auth-Email 和 X-Auth-Key
    const headers = request.headers
    const XAuthEmail = headers.get( "X-Auth-Email" ) || null
    const XAuthKey = headers.get( "X-Auth-Key" ) || null

    // 解析 URL 查询参数
    const requestUrl = new URL( request.url )

    const params = requestUrl.searchParams
    const operation = ( params.get( "operation" ) || 'CREATE' ).toUpperCase()
    const recordProxy = params.get( "record_proxy" ) || 'false'
    const recordName = params.get( "record_name" ) || null
    const recordType = ( params.get( "record_type" ) || 'A' ).toUpperCase()
    const recordTTL = params.get( "record_ttl" ) || 0
    const recordValue = params.get( "record_value" ) || headers.get( "CF-Connecting-IP" ) || null
    const zoneName = params.get( "zone_name" ) || null

    if ( !XAuthEmail || !XAuthKey )
    {
        return new Response(
            JSON.stringify( { error: "Missing X-Auth-Email or X-Auth-Key" } ),
            { status: 400, headers: { "Content-Type": "application/json" } }
        )
    }

    const accountName = await getAccountName( XAuthEmail, XAuthKey )
    if ( !accountName )
    {
        return new Response(
            JSON.stringify( { error: "Account Name Not Found" } ),
            { status: 401, headers: { "Content-Type": "application/json" } }
        )
    }

    const zoneID = await getZoneID( XAuthEmail, XAuthKey, zoneName )
    if ( !zoneID )
    {
        return new Response(
            JSON.stringify( { error: "Zone ID Not Found" } ),
            { status: 401, headers: { "Content-Type": "application/json" } }
        )
    }


    let result
    switch ( operation )
    {
        case 'CREATE':
            result = await ddnsCreateRecord( XAuthEmail, XAuthKey, zoneID, recordName, recordType, recordValue, recordTTL, recordProxy === 'true' )
            if ( result )
            {
                return new Response( JSON.stringify( { message: "Record created successfully." } ), { status: 200 } )
            } else
            {
                return new Response( JSON.stringify( { error: "Failed to create record." } ), { status: 500 } )
            }

        case 'UPDATE':
            const recordID = await getRecordID( XAuthEmail, XAuthKey, zoneID, recordName, recordType )
            if ( !recordID )
            {
                return new Response( JSON.stringify( { error: "Record ID Not Found" } ), { status: 404, headers: { "Content-Type": "application/json" } } )
            }
            result = await ddnsUpdateRecord( XAuthEmail, XAuthKey, zoneID, recordID, recordName, recordType, recordValue, recordTTL, recordProxy === 'true' )
            if ( result )
            {
                return new Response( JSON.stringify( { message: "Record updated successfully." } ), { status: 200 } )
            } else
            {
                return new Response( JSON.stringify( { error: "Failed to update record." } ), { status: 500 } )
            }

        case 'DELETE':
            const deleteRecordID = await getRecordID( XAuthEmail, XAuthKey, zoneID, recordName, recordType )
            if ( !deleteRecordID )
            {
                return new Response( JSON.stringify( { error: "Record ID Not Found" } ), { status: 404, headers: { "Content-Type": "application/json" } } )
            }
            result = await ddnsDeleteRecord( XAuthEmail, XAuthKey, zoneID, deleteRecordID )
            if ( result )
            {
                return new Response( JSON.stringify( { message: "Record deleted successfully." } ), { status: 200 } )
            } else
            {
                return new Response( JSON.stringify( { error: "Failed to delete record." } ), { status: 500 } )
            }

        default:
            return new Response( JSON.stringify( { error: "Invalid operation." } ), { status: 400, headers: { "Content-Type": "application/json" } } )
    }
}

// 发送 POST 请求并处理响应
async function ddnsCreateRecord ( XAuthEmail, XAuthKey, ZoneID, RecordName, Type, WANIP, TTL, ProxyStatus )
{
    const url = `https://api.cloudflare.com/client/v4/zones/${ ZoneID }/dns_records`

    const requestData = {
        type: Type,
        name: RecordName,
        content: WANIP,
        ttl: TTL,
        proxied: ProxyStatus
    }

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

        if ( data.success === true )
        {
            return true
        } else
        {
            return false
        }
    } catch ( error )
    {
        console.error( error )
        return false
    }
}

// 发送 PUT 请求并处理响应
async function ddnsUpdateRecord ( XAuthEmail, XAuthKey, ZoneID, RecordID, RecordName, Type, WANIP, TTL, ProxyStatus )
{
    const url = `https://api.cloudflare.com/client/v4/zones/${ ZoneID }/dns_records/${ RecordID }`

    const requestData = {
        type: Type,
        name: RecordName,
        content: WANIP,
        ttl: TTL,
        proxied: ProxyStatus
    }

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

        if ( data.success === true )
        {
            return true
        } else
        {
            return false
        }
    } catch ( error )
    {
        console.error( error )
        return false
    }
}

// 发送 DELETE 请求并处理响应
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

        if ( data.success === true )
        {
            return true
        } else
        {
            return false
        }
    } catch ( error )
    {
        console.error( error )
        return false
    }
}

async function getRecordValue ( XAuthEmail, XAuthKey, ZoneID, RecordID )
{
    const url = `https://api.cloudflare.com/client/v4/zones/${ ZoneID }/dns_records/${ RecordID }`

    try
    {
        // 发起请求
        const response = await fetch( url, {
            method: "GET",
            headers: {
                "X-Auth-Email": XAuthEmail,
                "X-Auth-Key": XAuthKey,
                "Content-Type": "application/json",
            },
        } )

        // 解析响应
        const data = await response.json()

        // 检查 success 字段
        if ( data.success === true )
        {
            return data.result.content
        } else
        {
            return null
        }
    } catch ( error )
    {
        console.error( error )
        return null
    }
}

async function getRecordID ( XAuthEmail, XAuthKey, ZoneID, RecordName, RecordType )
{
    const url = `https://api.cloudflare.com/client/v4/zones/${ ZoneID }/dns_records?name=${ RecordName }`

    try
    {
        // 发起请求
        const response = await fetch( url, {
            method: "GET",
            headers: {
                "X-Auth-Email": XAuthEmail,
                "X-Auth-Key": XAuthKey,
                "Content-Type": "application/json",
            },
        } )

        // 解析响应
        const data = await response.json()

        // 检查 success 字段
        if ( data.success === true && data.result.length > 0 )
        {
            const record = data.result.find( record => record.type === RecordType )
            if ( record )
            {
                return record.id // 返回符合条件的记录 ID
            } else
            {
                return null
            }
        } else if ( data.success === false )
        {
            return null
        } else
        {
            return null
        }
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
        // 发起请求
        const response = await fetch( url, {
            method: "GET",
            headers: {
                "X-Auth-Email": XAuthEmail,
                "X-Auth-Key": XAuthKey,
                "Content-Type": "application/json",
            },
        } )

        // 解析响应
        const data = await response.json()

        // 检查 success 字段
        if ( data.success === true && data.result.length > 0 )
        {
            return data.result[ 0 ].id
        } else if ( data.success === false )
        {
            return null
        } else
        {
            return null
        }
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
        // 发起请求
        const response = await fetch( url, {
            method: "GET",
            headers: {
                "X-Auth-Email": XAuthEmail,
                "X-Auth-Key": XAuthKey,
                "Content-Type": "application/json",
            },
        } )

        // 解析响应
        const data = await response.json()

        // 检查 success 字段
        if ( data.success === true && data.result.length > 0 )
        {
            return data.result[ 0 ].name
        } else if ( data.success === false )
        {
            return null
        } else
        {
            return null
        }
    } catch ( error )
    {
        console.error( error )
        return null
    }
}
