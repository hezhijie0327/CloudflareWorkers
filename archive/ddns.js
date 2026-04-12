// Description: Using Cloudflare Workers to update your DNS record.

addEventListener(
  "fetch",
  /** @param {any} event */ (event) => {
    event.respondWith(handleRequest(event.request));
  },
);

/** @param {Request} request */
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
  const explicitZoneName = params.get("zone_name") || null;
  const zoneName = explicitZoneName
    ? explicitZoneName.trim()
    : recordName
      ? recordName.split(".").slice(-2).join(".")
      : null;

  const jsonHeaders = {
    "Content-Type": "application/json;charset=UTF-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "*",
  };

  const debug =
    /** @type {{ auth: { xAuthEmail: string|null; xAuthKey: string|null }; request: { operation: string; recordName: string|null; recordProxy: boolean; recordTTL: number; recordType: string; recordValue: string|null; zoneName: string|null }; result: { accountName: string|null; zoneID: string|null; recordID: string|null } }} */ ({
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
    });

  let success = false;

  if (!xAuthEmail || !xAuthKey) {
    return new Response(
      JSON.stringify({
        debug,
        error: "Missing X-Auth-Email or X-Auth-Key",
        success,
      }),
      { status: 400, headers: jsonHeaders },
    );
  }

  if (!recordName || !recordType || !zoneName) {
    return new Response(
      JSON.stringify({
        debug,
        error:
          "Missing required record_name, record_type, or zone_name parameters",
        success,
      }),
      { status: 400, headers: jsonHeaders },
    );
  }

  if ((operation === "CREATE" || operation === "UPDATE") && !recordValue) {
    return new Response(
      JSON.stringify({ debug, error: "Missing record_value", success }),
      { status: 400, headers: jsonHeaders },
    );
  }

  const authEmail = /** @type {string} */ (xAuthEmail);
  const authKey = /** @type {string} */ (xAuthKey);
  const validRecordName = /** @type {string} */ (recordName);
  const validRecordType = /** @type {string} */ (recordType);
  const validZoneName = /** @type {string} */ (zoneName);
  const validRecordValue = recordValue
    ? /** @type {string} */ (recordValue)
    : "";

  debug.result.accountName = await getAccountName(authEmail, authKey);
  if (!debug.result.accountName) {
    return new Response(JSON.stringify({ debug, success }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  debug.result.zoneID = await getZoneID(authEmail, authKey, validZoneName);
  if (!debug.result.zoneID) {
    return new Response(JSON.stringify({ debug, success }), {
      status: 404,
      headers: jsonHeaders,
    });
  }

  switch (operation) {
    case "CREATE":
      success = await ddnsCreateRecord(
        authEmail,
        authKey,
        debug.result.zoneID,
        validRecordName,
        validRecordType,
        validRecordValue,
        recordTTL,
        recordProxy,
      );
      return new Response(JSON.stringify({ debug }), {
        status: success ? 200 : 500,
        headers: jsonHeaders,
      });

    case "UPDATE":
      debug.result.recordID = await getRecordID(
        authEmail,
        authKey,
        debug.result.zoneID,
        validRecordName,
        validRecordType,
      );
      if (!debug.result.recordID) {
        return new Response(JSON.stringify({ debug, success }), {
          status: 404,
          headers: jsonHeaders,
        });
      }
      success = await ddnsUpdateRecord(
        authEmail,
        authKey,
        debug.result.zoneID,
        debug.result.recordID,
        validRecordName,
        validRecordType,
        validRecordValue,
        recordTTL,
        recordProxy,
      );
      return new Response(JSON.stringify({ debug }), {
        status: success ? 200 : 500,
        headers: jsonHeaders,
      });

    case "DELETE":
      debug.result.recordID = await getRecordID(
        authEmail,
        authKey,
        debug.result.zoneID,
        validRecordName,
        validRecordType,
      );
      if (!debug.result.recordID) {
        return new Response(JSON.stringify({ debug, success }), {
          status: 404,
          headers: jsonHeaders,
        });
      }
      success = await ddnsDeleteRecord(
        authEmail,
        authKey,
        debug.result.zoneID,
        debug.result.recordID,
      );
      return new Response(JSON.stringify({ debug }), {
        status: success ? 200 : 500,
        headers: jsonHeaders,
      });

    default:
      return new Response(JSON.stringify({ debug, success }), {
        status: 400,
        headers: jsonHeaders,
      });
  }
}

/**
 * @param {string|null} XAuthEmail
 * @param {string|null} XAuthKey
 * @param {string|null} ZoneID
 * @param {string|null} RecordName
 * @param {string|null} RecordType
 * @param {string|null} RecordValue
 * @param {number} RecordTTL
 * @param {boolean} RecordProxy
 * @returns {Promise<boolean>}
 */
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
    const authEmail = /** @type {string} */ (XAuthEmail);
    const authKey = /** @type {string} */ (XAuthKey);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-Auth-Email": authEmail,
        "X-Auth-Key": authKey,
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

/**
 * @param {string|null} XAuthEmail
 * @param {string|null} XAuthKey
 * @param {string|null} ZoneID
 * @param {string|null} RecordID
 * @param {string|null} RecordName
 * @param {string|null} RecordType
 * @param {string|null} RecordValue
 * @param {number} RecordTTL
 * @param {boolean} RecordProxy
 * @returns {Promise<boolean>}
 */
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
    const authEmail = /** @type {string} */ (XAuthEmail);
    const authKey = /** @type {string} */ (XAuthKey);
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "X-Auth-Email": authEmail,
        "X-Auth-Key": authKey,
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

/**
 * @param {string|null} XAuthEmail
 * @param {string|null} XAuthKey
 * @param {string|null} ZoneID
 * @param {string|null} RecordID
 * @returns {Promise<boolean>}
 */
async function ddnsDeleteRecord(XAuthEmail, XAuthKey, ZoneID, RecordID) {
  const url = `https://api.cloudflare.com/client/v4/zones/${ZoneID}/dns_records/${RecordID}`;

  try {
    const authEmail = /** @type {string} */ (XAuthEmail);
    const authKey = /** @type {string} */ (XAuthKey);
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "X-Auth-Email": authEmail,
        "X-Auth-Key": authKey,
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

/**
 * @param {string|null} XAuthEmail
 * @param {string|null} XAuthKey
 * @param {string|null} ZoneID
 * @param {string|null} RecordName
 * @param {string|null} RecordType
 * @returns {Promise<string|null>}
 */
async function getRecordID(
  XAuthEmail,
  XAuthKey,
  ZoneID,
  RecordName,
  RecordType,
) {
  const url = `https://api.cloudflare.com/client/v4/zones/${ZoneID}/dns_records?name=${encodeURIComponent(
    /** @type {string} */ (RecordName),
  )}`;

  try {
    const authEmail = /** @type {string} */ (XAuthEmail);
    const authKey = /** @type {string} */ (XAuthKey);
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Auth-Email": authEmail,
        "X-Auth-Key": authKey,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();
    if (data.success && data.result.length > 0) {
      const record = data.result.find(
        /** @param {any} record */ (record) => record.type === RecordType,
      );
      return record ? record.id : null;
    }
    return null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

/**
 * @param {string|null} XAuthEmail
 * @param {string|null} XAuthKey
 * @param {string|null} ZoneName
 * @returns {Promise<string|null>}
 */
async function getZoneID(XAuthEmail, XAuthKey, ZoneName) {
  const url = `https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(
    /** @type {string} */ (ZoneName),
  )}`;

  try {
    const authEmail = /** @type {string} */ (XAuthEmail);
    const authKey = /** @type {string} */ (XAuthKey);
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Auth-Email": authEmail,
        "X-Auth-Key": authKey,
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

/**
 * @param {string} XAuthEmail
 * @param {string} XAuthKey
 * @returns {Promise<string|null>}
 */
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
