import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, apiKey, email, timeout, fileId, filter, limit, offset } = await req.json();

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let url: string;
    let options: RequestInit = { method: "GET" };

    switch (action) {
      case "credits":
        url = `https://api.millionverifier.com/api/v3/credits?api=${encodeURIComponent(apiKey)}`;
        break;

      case "verify_single":
        if (!email) {
          return new Response(JSON.stringify({ error: "Email is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        url = `https://api.millionverifier.com/api/v3/?api=${encodeURIComponent(apiKey)}&email=${encodeURIComponent(email)}&timeout=${timeout || 10}`;
        break;

      case "file_info":
        url = `https://bulkapi.millionverifier.com/bulkapi/v2/fileinfo?key=${encodeURIComponent(apiKey)}&file_id=${fileId}`;
        break;

      case "file_list":
        url = `https://bulkapi.millionverifier.com/bulkapi/v2/filelist?key=${encodeURIComponent(apiKey)}&limit=${limit || 50}&offset=${offset || 0}`;
        break;

      case "stop":
        url = `https://bulkapi.millionverifier.com/bulkapi/stop?key=${encodeURIComponent(apiKey)}&file_id=${fileId}`;
        break;

      case "download":
        url = `https://bulkapi.millionverifier.com/bulkapi/v2/download?key=${encodeURIComponent(apiKey)}&file_id=${fileId}&filter=${filter || "all"}`;
        break;

      case "delete":
        url = `https://bulkapi.millionverifier.com/bulkapi/v2/delete?key=${encodeURIComponent(apiKey)}&file_id=${fileId}`;
        break;

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const response = await fetch(url, options);
    const contentType = response.headers.get("content-type") || "";

    if (action === "download") {
      const text = await response.text();
      return new Response(text, {
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
