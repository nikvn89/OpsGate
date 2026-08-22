const UPSTREAM = "https://studio.genlayer.com/api";

function jsonRpcProxyError(id, code, message, data) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code,
      message,
      ...(data ? { data } : {})
    }
  };
}

async function requestBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") return req.body;
    if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
    return JSON.stringify(req.body);
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req, res) {
  res.setHeader("cache-control", "no-store");

  // Simple production health check.
  if (req.method === "GET") {
    res.status(200).json({
      ok: true,
      service: "OpsGate StudioNet RPC proxy",
      upstream: UPSTREAM
    });
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("allow", "GET, POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let rawBody = "";
  let requestId = null;

  try {
    rawBody = await requestBody(req);

    if (!rawBody.trim()) {
      res.status(400).json(
        jsonRpcProxyError(
          null,
          -32600,
          "Empty JSON-RPC request body"
        )
      );
      return;
    }

    try {
      const parsed = JSON.parse(rawBody);
      requestId = parsed?.id ?? null;
    } catch {
      res.status(400).json(
        jsonRpcProxyError(
          null,
          -32700,
          "Invalid JSON-RPC request body"
        )
      );
      return;
    }

    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept": "application/json"
      },
      body: rawBody
    });

    const text = await upstream.text();

    // Never return an empty body to viem/genlayer-js.
    if (!text.trim()) {
      res.status(502).json(
        jsonRpcProxyError(
          requestId,
          -32000,
          "StudioNet RPC returned an empty response",
          { upstreamStatus: upstream.status }
        )
      );
      return;
    }

    res.status(upstream.status);
    res.setHeader(
      "content-type",
      upstream.headers.get("content-type") || "application/json; charset=utf-8"
    );
    res.end(text);
  } catch (error) {
    res.status(502).json(
      jsonRpcProxyError(
        requestId,
        -32001,
        "StudioNet RPC proxy failed",
        {
          message: error instanceof Error ? error.message : String(error)
        }
      )
    );
  }
}
