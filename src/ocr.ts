export type OcrDraftTask = {
  title: string;
  category: string;
  description?: string;
};

export type BaiduOcrConfig =
  | { mode: "proxy"; proxyUrl: string }
  | { mode: "local"; apiKey: string; secretKey: string };

export async function recognizeHomeworkWithBaidu(_file: File, _config: BaiduOcrConfig): Promise<OcrDraftTask[]> {
  throw new Error("百度云 OCR 将在 P1 接入。请优先使用代理/云函数保护 Secret Key。");
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
