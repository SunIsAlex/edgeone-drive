import { NextRequest, NextResponse } from "next/server";
import { getDriveStore } from "@/lib/blob";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const store = getDriveStore();
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Missing key parameter" }, { status: 400 });
    }

    // ✅ 用 arrayBuffer 读取，保留完整二进制内容
    const buffer = await store.get(key, { type: "arrayBuffer" }) as ArrayBuffer | null;

    if (!buffer) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // 从 sidecar meta 读取 contentType 和 size
    const meta = await store.get(`__meta__/${key}`, { type: "json" }) as {
      contentType: string;
      size: number;
      fileName: string;
    } | null;

    const contentType = meta?.contentType ?? "application/octet-stream";
    const contentLength = meta?.size ?? buffer.byteLength;
    const filename = meta?.fileName ?? key.split("/").pop() ?? "download";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        // ✅ 明确告知浏览器文件大小，下载进度条才能正常显示
        "Content-Length": String(contentLength),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err: any) {
    console.error("[download]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
