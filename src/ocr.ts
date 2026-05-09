export type OcrDraftTask = {
  title: string;
  category: string;
  description?: string;
  plannedMinutes?: number;
  rewardPoints?: number;
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
  const normalizedLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const mergedLines = mergeContinuationLines(normalizedLines);

  return mergedLines.map((line) => {
    const category = inferCategory(line);
    const plannedMinutes = inferMinutes(line);
    return {
      title: cleanupTitle(line),
      category,
      plannedMinutes,
      rewardPoints: inferPoints(plannedMinutes),
      description: "来自 OCR/文本智能拆解，请确认后保存",
    };
  });
}

function inferCategory(line: string) {
  if (/数学|口算|计算|应用题|练习册|竖式|方程|几何/.test(line)) return "数学";
  if (/语文|作文|阅读|生字|词语|课文|背诵|默写|日记/.test(line)) return "语文";
  if (/英语|单词|听力|跟读|课文录音|默写.*英/.test(line)) return "英语";
  if (/科学|实验|观察|自然/.test(line)) return "科学";
  if (/阅读|读书|课外书/.test(line)) return "阅读";
  return "其他";
}

function mergeContinuationLines(lines: string[]) {
  const result: string[] = [];
  for (const line of lines) {
    const startsNewTask = /^(\d+[\).、]|[一二三四五六七八九十]+[、.．]|[-*·])/.test(line) || /[:：]$/.test(line) || inferCategory(line) !== "其他";
    if (result.length === 0 || startsNewTask || line.length > 18) {
      result.push(line);
    } else {
      result[result.length - 1] = `${result[result.length - 1]} ${line}`;
    }
  }
  return result;
}

function cleanupTitle(line: string) {
  return line
    .replace(/^(\d+[\).、]|[一二三四五六七八九十]+[、.．]|[-*·])\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferMinutes(line: string) {
  if (/作文|日记|阅读理解|试卷/.test(line)) return 45;
  if (/背诵|听写|默写|单词|口算/.test(line)) return 20;
  if (/阅读|课外书|预习|复习/.test(line)) return 30;
  if (/练习册|应用题|计算|数学/.test(line)) return 35;
  return 25;
}

function inferPoints(minutes: number) {
  if (minutes >= 45) return 15;
  if (minutes >= 30) return 10;
  return 8;
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
