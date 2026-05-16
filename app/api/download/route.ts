// ─────────────────────────────────────────────────────────────────
// app/api/download/route.ts   (GET: stream file download)
// API ref: https://pages.edgeone.ai/document/blob-storage
// ─────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@edgeone/pages-blob";

export const runtime = "nodejs";
import { getDriveStore } from "@/lib/blob";

// ── GET /api/download?key=photos/cat.jpg ─────────────────────────
export async function GET(request: NextRequest) {
  try {
    const store = getDriveStore();

    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Missing key parameter" }, { status: 400 });
    }

    // getWithHeaders 同时返回文件内容 + 完整响应头（content-type, etag 等）
    // 文档返回值: { body: string, headers: Record<string, string> } | null
    const result = await store.getWithHeaders(key);

    if (!result) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // 优先用 getWithHeaders 拿到的 content-type；
    // 若为空，再查上传时写入的 sidecar meta
    let contentType = result.headers["content-type"] ?? "";
    if (!contentType) {
      const meta = await store.get(`__meta__/${key}`, { type: "json" }) as {
        contentType: string;
      } | null;
      contentType = meta?.contentType ?? "application/octet-stream";
    }

    const filename = key.split("/").pop() ?? "download";

    return new NextResponse(result.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "private, max-age=3600",
        ...(result.headers["etag"] ? { ETag: result.headers["etag"] } : {}),
      },
    });
  } catch (err: any) {
    console.error("[download]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
