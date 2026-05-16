import { NextRequest, NextResponse } from "next/server";
import { getDriveStore } from "@/lib/blob";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const store = getDriveStore();
    const formData = await request.formData();

    const chunk    = formData.get("chunk")    as File   | null;
    const key      = formData.get("key")      as string;
    const indexStr = formData.get("index")    as string;
    const totalStr = formData.get("total")    as string;
    const fileType = formData.get("fileType") as string;
    const fileSize = formData.get("fileSize") as string;

    if (!chunk || !key || indexStr == null || !totalStr) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const index = parseInt(indexStr);
    const total = parseInt(totalStr);

    // 写入分片
    const chunkBuffer = await chunk.arrayBuffer();
    await store.set(`__chunks__/${key}/${index}`, chunkBuffer);

    // 最后一片：写 manifest，不合并
    if (index === total - 1) {
      await store.setJSON(`__meta__/${key}`, {
        contentType: fileType || "application/octet-stream",
        size: parseInt(fileSize) || 0,
        lastModified: new Date().toISOString(),
        fileName: key.split("/").pop(),
        chunks: total,           // ← 记录分片数，下载时用
        chunked: true,           // ← 标记为分片文件
      });
      return NextResponse.json({ success: true, done: true, key });
    }

    return NextResponse.json({ success: true, done: false, index });
  } catch (err: any) {
    console.error("[upload-chunk]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
