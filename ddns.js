addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // 解析 URL 查询参数
  const requestUrl = new URL(request.url);
  const params = requestUrl.searchParams;
  const mode = params.get("mode") || 'get';
  const proxy = params.get("proxy") || 'false';
  const name = params.get("name") || null;
  const type = params.get("type") || 'A';
  const ttl = params.get("ttl") || 0;
  const zone = params.get("zone") || null;

  // 从请求头中获取 X-Auth-Email 和 X-Auth-Key
  const headers = request.headers;
  const XAuthEmail = headers.get("X-Auth-Email") || null;
  const XAuthKey = headers.get("X-Auth-Key") || null;
  const IP = headers.get("CF-Connecting-IP") || null;

  // 如果认证信息缺失，返回错误响应
  if (!XAuthEmail || !XAuthKey) {
      return new Response(
          JSON.stringify({ error: "Missing X-Auth-Email or X-Auth-Key" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
      );
  }

  // 调用 getAccountName 函数获取账户名称
  const accountNames = await getAccountName(XAuthEmail, XAuthKey);
  if (!accountNames) {
    return new Response(
        JSON.stringify({ error: "Account Name Not Found" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const zoneID = await getZoneID(XAuthEmail, XAuthKey, zone)
  if (!zoneID) {
    return new Response(
        JSON.stringify({ error: "Zone ID Not Found" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const recordID = await getRecordID(XAuthEmail, XAuthKey, zoneID, name, type)
  if (!recordID) {
    return new Response(
        JSON.stringify({ error: "Record ID Not Found" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const recordValue = await getRecordValue(XAuthEmail, XAuthKey, zoneID, recordID)
  if (!recordValue) {
    return new Response(
        JSON.stringify({ error: "Record Value Not Found" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // 返回解析后的响应
  return new Response(
      JSON.stringify({
          accountNames,
          zoneID,
          recordID,
          recordValue,
      }),
      { headers: { "Content-Type": "application/json" } }
  );
}

// 发送 POST 请求并处理响应
async function ddnsCreateRecord(XAuthEmail, XAuthKey, ZoneID, RecordName, Type, WANIP, TTL, ProxyStatus) {
    const url = `https://api.cloudflare.com/client/v4/zones/${ZoneID}/dns_records`;
  
    const requestData = {
      type: Type,
      name: RecordName,
      content: WANIP,
      ttl: TTL,
      proxied: ProxyStatus
    };
  
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Auth-Email': XAuthEmail,
          'X-Auth-Key': XAuthKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
  
      const data = await response.json();
  
      if (data.success === true) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error(error);
      return false;
    }
  }
  
  // 发送 PUT 请求并处理响应
  async function ddnsUpdateRecord(XAuthEmail, XAuthKey, ZoneID, RecordID, RecordName, Type, WANIP, TTL, ProxyStatus) {
    const url = `https://api.cloudflare.com/client/v4/zones/${ZoneID}/dns_records/${RecordID}`;
  
    const requestData = {
      type: Type,
      name: RecordName,
      content: WANIP,
      ttl: TTL,
      proxied: ProxyStatus
    };
  
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'X-Auth-Email': XAuthEmail,
          'X-Auth-Key': XAuthKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
  
      const data = await response.json();
  
      if (data.success === true) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error(error);
      return false;
    }
  }
  
  // 发送 DELETE 请求并处理响应
  async function ddnsDeleteRecord(XAuthEmail, XAuthKey, ZoneID, RecordID) {
    const url = `https://api.cloudflare.com/client/v4/zones/${ZoneID}/dns_records/${RecordID}`;
  
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'X-Auth-Email': XAuthEmail,
          'X-Auth-Key': XAuthKey,
          'Content-Type': 'application/json'
        }
      });
  
      const data = await response.json();
  
      if (data.success === true) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error(error);
      return false;
    }
  }
  
async function getRecordValue(XAuthEmail, XAuthKey, ZoneID, RecordID) {
    const url = `https://api.cloudflare.com/client/v4/zones/${ZoneID}/dns_records/${RecordID}`

    try {
        // 发起请求
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "X-Auth-Email": XAuthEmail,
                "X-Auth-Key": XAuthKey,
                "Content-Type": "application/json",
            },
        });
  
        // 解析响应
        const data = await response.json();
  
        // 检查 success 字段
        if (data.success === true) {
            return data.result.content;
        } else {
            return null;
        }
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function getRecordID(XAuthEmail, XAuthKey, ZoneID, RecordName, RecordType) {
    const url = `https://api.cloudflare.com/client/v4/zones/${ZoneID}/dns_records?name=${RecordName}`

    try {
        // 发起请求
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "X-Auth-Email": XAuthEmail,
                "X-Auth-Key": XAuthKey,
                "Content-Type": "application/json",
            },
        });
  
        // 解析响应
        const data = await response.json();
  
        // 检查 success 字段
        if (data.success === true && data.result.length > 0) {
            const record = data.result.find(record => record.type === RecordType);
            if (record) {
                return record.id; // 返回符合条件的记录 ID
            } else {
                return null
            }
        } else if (data.success === false) {
            return null;
        } else {
            return null;
        }
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function getZoneID(XAuthEmail, XAuthKey, ZoneName) {
    const url = `https://api.cloudflare.com/client/v4/zones?name=${ZoneName}`

    try {
        // 发起请求
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "X-Auth-Email": XAuthEmail,
                "X-Auth-Key": XAuthKey,
                "Content-Type": "application/json",
            },
        });
  
        // 解析响应
        const data = await response.json();
  
        // 检查 success 字段
        if (data.success === true && data.result.length > 0) {
            return data.result[0].id;
        } else if (data.success === false) {
            return null;
        } else {
            return null;
        }
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function getAccountName(XAuthEmail, XAuthKey) {
  const url = "https://api.cloudflare.com/client/v4/accounts?page=1&per_page=5&direction=desc";

  try {
      // 发起请求
      const response = await fetch(url, {
          method: "GET",
          headers: {
              "X-Auth-Email": XAuthEmail,
              "X-Auth-Key": XAuthKey,
              "Content-Type": "application/json",
          },
      });

      // 解析响应
      const data = await response.json();

      // 检查 success 字段
      if (data.success === true && data.result.length > 0) {
          return data.result[0].name;
      } else if (data.success === false) {
          return null;
      } else {
          return null;
      }
  } catch (error) {
      console.error(error);
      return null;
  }
}
