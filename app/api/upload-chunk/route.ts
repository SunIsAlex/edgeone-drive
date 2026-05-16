import { NextRequest, NextResponse } from "next/server";
import { getDriveStore } from "@/lib/blob";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const store = getDriveStore();
    const formData = await request.formData();

    const chunk     = formData.get("chunk") as File | null;   // 当前分片 Blob
    const key       = formData.get("key") as string;          // 最终文件路径
    const indexStr  = formData.get("index") as string;        // 分片序号 0,1,2…
    const totalStr  = formData.get("total") as string;        // 总分片数
    const fileType  = formData.get("fileType") as string;     // 原始 MIME
    const fileSize  = formData.get("fileSize") as string;     // 原始文件大小（字节）

    if (!chunk || !key || indexStr == null || !totalStr) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const index = parseInt(indexStr);
    const total = parseInt(totalStr);
    const chunkBuffer = await chunk.arrayBuffer();

    // 分片 key：__chunks__/<key>/<index>
    const chunkKey = `__chunks__/${key}/${index}`;
    await store.set(chunkKey, chunkBuffer);

    // 最后一片上传完毕 → 合并所有分片
    if (index === total - 1) {
      // 读取所有分片并拼接
      const parts: Uint8Array[] = [];
      for (let i = 0; i < total; i++) {
        const buf = await store.get(`__chunks__/${key}/${i}`, { type: "arrayBuffer" }) as ArrayBuffer;
        if (!buf) throw new Error(`Missing chunk ${i}`);
        parts.push(new Uint8Array(buf));
      }

      // 合并
      const totalLen = parts.reduce((s, p) => s + p.byteLength, 0);
      const merged = new Uint8Array(totalLen);
      let offset = 0;
      for (const p of parts) {
        merged.set(p, offset);
        offset += p.byteLength;
      }

      // 写入最终文件
      await store.set(key, merged.buffer, {
        cacheControl: "private, max-age=3600",
      });

      // 写入 sidecar meta
      await store.setJSON(`__meta__/${key}`, {
        contentType: fileType || "application/octet-stream",
        size: parseInt(fileSize) || totalLen,
        lastModified: new Date().toISOString(),
        fileName: key.split("/").pop(),
      });

      // 清理分片
      for (let i = 0; i < total; i++) {
        await store.delete(`__chunks__/${key}/${i}`);
      }

      return NextResponse.json({ success: true, done: true, key });
    }

    return NextResponse.json({ success: true, done: false, index });
  } catch (err: any) {
    console.error("[upload-chunk]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}