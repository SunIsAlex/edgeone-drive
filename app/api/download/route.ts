import { NextRequest, NextResponse } from "next/server";
import { getDriveStore } from "@/lib/blob";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const store = getDriveStore();
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    const meta = await store.get(`__meta__/${key}`, { type: "json" }) as {
      contentType: string;
      size: number;
      fileName: string;
      chunks?: number;
      chunked?: boolean;
    } | null;

    const contentType  = meta?.contentType ?? "application/octet-stream";
    const contentLength = meta?.size ?? 0;
    const filename     = meta?.fileName ?? key.split("/").pop() ?? "download";

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "private, max-age=3600",
    };
    if (contentLength) {
      headers["Content-Length"] = String(contentLength);
    }

    // 分片文件：用 ReadableStream 逐片读取输出，不在内存里合并
    if (meta?.chunked && meta.chunks) {
      const total = meta.chunks;
      const stream = new ReadableStream({
        async start(controller) {
          for (let i = 0; i < total; i++) {
            const buf = await store.get(
              `__chunks__/${key}/${i}`,
              { type: "arrayBuffer" }
            ) as ArrayBuffer | null;
            if (!buf) {
              controller.error(new Error(`Missing chunk ${i}`));
              return;
            }
            controller.enqueue(new Uint8Array(buf));
          }
          controller.close();
        },
      });
      return new NextResponse(stream, { headers });
    }

    // 普通小文件：直接读取 arrayBuffer
    const buffer = await store.get(key, { type: "arrayBuffer" }) as ArrayBuffer | null;
    if (!buffer) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    return new NextResponse(buffer, { headers });

  } catch (err: any) {
    console.error("[download]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
