const UPSTREAM = "https://studio.genlayer.com/api";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req.body)
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader(
      "content-type",
      upstream.headers.get("content-type") || "application/json"
    );
    res.setHeader("cache-control", "no-store");
    res.send(text);
  } catch (error) {
    res.status(502).json({
      error: "Studionet RPC proxy failed",
      message: error instanceof Error ? error.message : String(error)
    });
  }
}
