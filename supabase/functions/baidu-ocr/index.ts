const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type BaiduTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type BaiduOcrResponse = {
  words_result?: Array<{ words: string }>;
  error_code?: number;
  error_msg?: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Only POST is supported" }, 405);
  }

  try {
    const apiKey = Deno.env.get("BAIDU_OCR_API_KEY");
    const secretKey = Deno.env.get("BAIDU_OCR_SECRET_KEY");
    if (!apiKey || !secretKey) {
      return jsonResponse({ error: "Baidu OCR secrets are not configured" }, 500);
    }

    const formData = await request.formData();
    const image = formData.get("image");
    if (!(image instanceof File)) {
      return jsonResponse({ error: "Missing image file" }, 400);
    }

    const imageBase64 = bytesToBase64(new Uint8Array(await image.arrayBuffer()));
    const accessToken = await getAccessToken(apiKey, secretKey);
    const body = new URLSearchParams({
      image: imageBase64,
      language_type: "CHN_ENG",
      detect_direction: "true",
      paragraph: "false",
    });

    const ocrResponse = await fetch(`https://aip.baidubce.com/rest/2.0/ocr/v1/handwriting?access_token=${encodeURIComponent(accessToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await ocrResponse.json()) as BaiduOcrResponse;
    if (!ocrResponse.ok || data.error_code) {
      return jsonResponse({ error: data.error_msg ?? "百度云 OCR 识别失败" }, ocrResponse.ok ? 502 : ocrResponse.status);
    }

    return jsonResponse({ text: (data.words_result ?? []).map((item) => item.words).join("\n") });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "OCR 代理识别失败" }, 500);
  }
});

async function getAccessToken(apiKey: string, secretKey: string) {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: apiKey,
    client_secret: secretKey,
  });
  const response = await fetch("https://aip.baidubce.com/oauth/2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await response.json()) as BaiduTokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? "百度云 access_token 获取失败");
  }
  return data.access_token;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}
