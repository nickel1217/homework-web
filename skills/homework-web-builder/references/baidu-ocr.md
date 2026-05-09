# Baidu Cloud OCR Notes

## Requirement

Homework OCR must use Baidu Cloud OCR when implemented.

## Security Constraint

Baidu OCR commonly requires an API key and secret to obtain an access token. A static GitHub Pages frontend cannot keep that secret private.

Do not commit credentials, tokens, `.env` files containing secrets, or sample real secrets.

## Preferred Integration

Use an isolated OCR service boundary, for example:

```text
src/services/ocr/
  types.ts
  baiduOcrClient.ts
  parseHomeworkText.ts
```

Prefer a small user-owned proxy or serverless function for token exchange and OCR requests. The browser sends the image to that proxy; the proxy calls Baidu with the secret stored in platform environment variables.

## Frontend-Only Fallback

If the user insists on GitHub Pages with no proxy:

- Add an opt-in parent settings form for Baidu OCR credentials.
- Store credentials only in local browser storage.
- Show a clear warning that browser-stored credentials are visible to anyone with access to the app/browser.
- Keep OCR disabled until credentials are configured.
- Never include default credentials.

## Behavior Requirements

- OCR is P1 and must remain optional.
- OCR failures should show a friendly retry/error state and must not corrupt local data.
- Convert OCR text into editable task drafts before saving tasks.
- Keep the user in control: do not auto-create tasks without a review step.
