# EdgeOne Drive 🗂️

A self-hosted personal cloud drive built with **EdgeOne Pages** (Next.js) + **Blob Storage**.

Upload, browse, download and delete files through a clean dark UI — zero external services, zero monthly fees during free beta.

---

## ✨ Features

- **File upload** via button or drag-and-drop (up to 100 MB per file)
- **File browser** with name, type, size and modification time
- **Download** any file with one click
- **Delete** files from Blob storage
- **Search/filter** files in real time
- Fully responsive, dark terminal aesthetic
- Deployed globally on EdgeOne edge network

---

## 🚀 Deploy in 3 Steps

### Step 1 — Fork & Connect to EdgeOne Pages

1. Fork this repo to your GitHub account.
2. Go to [EdgeOne Pages Console](https://console.tencentcloud.com/edgeone/pages) → **New Project** → select your fork.
3. Set the build command: `npm run build`
4. Set the output directory: `.next`
5. Click **Deploy**.

### Step 2 — Create & Bind a Blob Namespace

1. In the EdgeOne Pages console, go to **Storage → Blob**.
2. Click **Create Namespace** and give it any name (e.g. `drive-blob`).
3. Go to your project → **Settings → Storage Bindings**.
4. Bind the namespace to this project and set the **variable name** to `BLOB`.

> The `BLOB` variable name must match exactly — the API routes use `(globalThis as any).BLOB`.

### Step 3 — Redeploy

Trigger a new deployment (or push any commit). Your drive is live!

---

## 🗂️ Project Structure

```
edgeone-drive/
├── app/
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Main drive UI
│   └── api/
│       ├── files/route.ts   # GET: list files | POST: upload
│       ├── download/route.ts # GET: stream file download
│       └── delete/route.ts  # DELETE: remove file
├── next.config.js
├── edgeone.json
├── package.json
└── tsconfig.json
```

---

## ⚙️ How It Works

| Route | Method | Action |
|---|---|---|
| `/api/files` | `GET` | List all files in Blob (`?prefix=` optional) |
| `/api/files` | `POST` | Upload file (multipart/form-data, `file` + `path` fields) |
| `/api/download` | `GET` | Download a file (`?key=` required) |
| `/api/delete` | `DELETE` | Delete a file (`?key=` required) |

All API routes run on **Node.js Cloud Functions** and access Blob storage through the `BLOB` binding injected by EdgeOne Pages at runtime.

---

## 📏 Known Limits

| Limit | Value |
|---|---|
| Max file size (per upload) | 100 MB (Cloud Function request body cap) |
| Blob namespace storage | Depends on EdgeOne plan |
| KV storage (if used) | 1 GB (free tier) |

For files larger than 100 MB you would need a **presigned URL** flow — the client uploads directly to Blob. This is not yet supported by `@edgeone/pages-blob` v0.x but is on the roadmap.

---

## 🛡️ Adding Password Protection

Add this middleware (`middleware.ts` in the project root):

```ts
import { NextRequest, NextResponse } from 'next/server';

const PASSWORD = process.env.DRIVE_PASSWORD || 'changeme';

export function middleware(req: NextRequest) {
  const auth = req.cookies.get('drive_auth')?.value;
  if (auth === PASSWORD) return NextResponse.next();

  const url = req.nextUrl.clone();
  if (url.pathname === '/login') return NextResponse.next();
  url.pathname = '/login';
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!_next|favicon.ico).*)'] };
```

Set `DRIVE_PASSWORD` in EdgeOne Pages → Project Settings → Environment Variables.

---

## 📄 License

MIT
