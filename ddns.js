// Description: Using Cloudflare Workers to update your DNS record.

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const headers = request.headers;

  const xAuthEmail = headers.get("X-Auth-Email") || null;
  const xAuthKey = headers.get("X-Auth-Key") || null;

  const requestUrl = new URL(request.url);
  const params = requestUrl.searchParams;

  const operation = (params.get("operation") || "CREATE").toUpperCase();
  const recordName = params.get("record_name") || null;
  const recordProxy = params.get("record_proxy") === "false";
  const recordTTL = Number(params.get("record_ttl")) || 0;
  const recordType = (params.get("record_type") || "A").toUpperCase();
  const recordValue =
    params.get("record_value") || headers.get("CF-Connecting-IP") || null;
  const zoneName = recordName
    ? recordName.split(".").slice(-2).join(".")
    : null;

  let debug = {
    auth: { xAuthEmail, xAuthKey },
    request: {
      operation,
      recordName,
      recordProxy,
      recordTTL,
      recordType,
      recordValue,
      zoneName,
    },
    result: {
      accountName: null,
      zoneID: null,
      recordID: null,
    },
  };

  let success = false;

  if (!xAuthEmail || !xAuthKey) {
    return new Response(JSON.stringify({ debug, success }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  debug.result.accountName = await getAccountName(xAuthEmail, xAuthKey);
  if (!debug.result.accountName) {
    return new Response(JSON.stringify({ debug, success }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  debug.result.zoneID = await getZoneID(xAuthEmail, xAuthKey, zoneName);
  if (!debug.result.zoneID) {
    return new Response(JSON.stringify({ debug, success }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  switch (operation) {
    case "CREATE":
      success = await ddnsCreateRecord(
        xAuthEmail,
        xAuthKey,
        debug.result.zoneID,
        recordName,
        recordType,
        recordValue,
        recordTTL,
        recordProxy,
      );
      return new Response(JSON.stringify({ debug }), {
        status: success ? 200 : 500,
      });

    case "UPDATE":
      debug.result.recordID = await getRecordID(
        xAuthEmail,
        xAuthKey,
        debug.result.zoneID,
        recordName,
        recordType,
      );
      if (!debug.result.recordID) {
        return new Response(JSON.stringify({ debug, success }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      success = await ddnsUpdateRecord(
        xAuthEmail,
        xAuthKey,
        debug.result.zoneID,
        debug.result.recordID,
        recordName,
        recordType,
        recordValue,
        recordTTL,
        recordProxy,
      );
      return new Response(JSON.stringify({ debug }), {
        status: success ? 200 : 500,
      });

    case "DELETE":
      debug.result.recordID = await getRecordID(
        xAuthEmail,
        xAuthKey,
        debug.result.zoneID,
        recordName,
        recordType,
      );
      if (!debug.result.recordID) {
        return new Response(JSON.stringify({ debug, success }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      success = await ddnsDeleteRecord(
        xAuthEmail,
        xAuthKey,
        debug.result.zoneID,
        debug.result.recordID,
      );
      return new Response(JSON.stringify({ debug }), {
        status: success ? 200 : 500,
      });

    default:
      return new Response(JSON.stringify({ debug, success }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
  }
}

async function ddnsCreateRecord(
  XAuthEmail,
  XAuthKey,
  ZoneID,
  RecordName,
  RecordType,
  RecordValue,
  RecordTTL,
  RecordProxy,
) {
  const url = `https://api.cloudflare.com/client/v4/zones/${ZoneID}/dns_records`;
  const requestData = {
    type: RecordType,
    name: RecordName,
    content: RecordValue,
    ttl: RecordTTL,
    proxied: RecordProxy,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-Auth-Email": XAuthEmail,
        "X-Auth-Key": XAuthKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });
    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

async function ddnsUpdateRecord(
  XAuthEmail,
  XAuthKey,
  ZoneID,
  RecordID,
  RecordName,
  RecordType,
  RecordValue,
  RecordTTL,
  RecordProxy,
) {
  const url = `https://api.cloudflare.com/client/v4/zones/${ZoneID}/dns_records/${RecordID}`;
  const requestData = {
    type: RecordType,
    name: RecordName,
    content: RecordValue,
    ttl: RecordTTL,
    proxied: RecordProxy,
  };

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "X-Auth-Email": XAuthEmail,
        "X-Auth-Key": XAuthKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });
    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

async function ddnsDeleteRecord(XAuthEmail, XAuthKey, ZoneID, RecordID) {
  const url = `https://api.cloudflare.com/client/v4/zones/${ZoneID}/dns_records/${RecordID}`;

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "X-Auth-Email": XAuthEmail,
        "X-Auth-Key": XAuthKey,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

async function getRecordID(
  XAuthEmail,
  XAuthKey,
  ZoneID,
  RecordName,
  RecordType,
) {
  const url = `https://api.cloudflare.com/client/v4/zones/${ZoneID}/dns_records?name=${RecordName}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Auth-Email": XAuthEmail,
        "X-Auth-Key": XAuthKey,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();
    if (data.success && data.result.length > 0) {
      const record = data.result.find((record) => record.type === RecordType);
      return record ? record.id : null;
    }
    return null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function getZoneID(XAuthEmail, XAuthKey, ZoneName) {
  const url = `https://api.cloudflare.com/client/v4/zones?name=${ZoneName}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Auth-Email": XAuthEmail,
        "X-Auth-Key": XAuthKey,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();
    return data.success && data.result.length > 0 ? data.result[0].id : null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function getAccountName(XAuthEmail, XAuthKey) {
  const url =
    "https://api.cloudflare.com/client/v4/accounts?page=1&per_page=5&direction=desc";

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Auth-Email": XAuthEmail,
        "X-Auth-Key": XAuthKey,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();
    return data.success && data.result.length > 0 ? data.result[0].name : null;
  } catch (error) {
    console.error(error);
    return null;
  }
}
