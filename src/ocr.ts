export type OcrDraftTask = {
  title: string;
  category: string;
  description?: string;
};

export type BaiduOcrConfig =
  | { mode: "proxy"; proxyUrl: string }
  | { mode: "local"; apiKey: string; secretKey: string };

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

export async function recognizeHomeworkWithBaidu(file: File, config: BaiduOcrConfig): Promise<OcrDraftTask[]> {
  if (config.mode === "proxy") {
    return recognizeViaProxy(file, config.proxyUrl);
  }

  const token = await getAccessToken(config.apiKey, config.secretKey);
  const image = await fileToBase64(file);
  const body = new URLSearchParams({
    image,
    language_type: "CHN_ENG",
    detect_direction: "true",
    paragraph: "false",
  });
  const response = await fetch(`https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await response.json()) as BaiduOcrResponse;
  if (!response.ok || data.error_code) {
    throw new Error(data.error_msg ?? "百度云 OCR 识别失败");
  }

  return parseHomeworkText((data.words_result ?? []).map((item) => item.words).join("\n"));
}

export function parseHomeworkText(text: string): OcrDraftTask[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      title: line,
      category: inferCategory(line),
      description: "来自 OCR 识别，请确认后保存",
    }));
}

function inferCategory(line: string) {
  if (/数学|口算|计算|应用题/.test(line)) return "数学";
  if (/语文|作文|阅读|生字/.test(line)) return "语文";
  if (/英语|单词|听力/.test(line)) return "英语";
  return "其他";
}

async function getAccessToken(apiKey: string, secretKey: string) {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: apiKey,
    client_secret: secretKey,
  });
  const response = await fetch(`https://aip.baidubce.com/oauth/2.0/token?${params.toString()}`, {
    method: "POST",
  });
  const data = (await response.json()) as BaiduTokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? "百度云 access_token 获取失败");
  }
  return data.access_token;
}

async function recognizeViaProxy(file: File, proxyUrl: string) {
  const formData = new FormData();
  formData.append("image", file);
  const response = await fetch(proxyUrl, { method: "POST", body: formData });
  const data = (await response.json()) as { tasks?: OcrDraftTask[]; text?: string; error?: string };
  if (!response.ok || data.error) {
    throw new Error(data.error ?? "OCR 代理识别失败");
  }
  return data.tasks ?? parseHomeworkText(data.text ?? "");
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.replace(/^data:.*?;base64,/, ""));
    };
    reader.readAsDataURL(file);
  });
}
