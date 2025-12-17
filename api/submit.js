export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const GAS_URL =
      "https://script.google.com/macros/s/AKfycbw-OjUkZcMZCs2li0JvSKYvIImRIRR58XNsOAegoQqChrIeifc8hv_e8MUuHj4vclXsLw/exec";

    await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });

    // GAS không cần trả gì, chỉ cần không lỗi
    return res.status(200).json({ status: "ok" });

  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ status: "error" });
  }
}
