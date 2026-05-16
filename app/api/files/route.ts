// ─────────────────────────────────────────────────────────────────
// app/api/files/route.ts   (GET: list files | POST: upload)
// API ref: https://pages.edgeone.ai/document/blob-storage
// ─────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@edgeone/pages-blob";
import { getDriveStore } from "@/lib/blob";
export const runtime = "nodejs";


// ── GET /api/files?prefix=photos/ ────────────────────────────────
// list() 返回: { blobs: [{key, etag}], directories?: string[] }
// blobs 里没有 size/lastModified，需要靠上传时写入的 sidecar meta 补充
export async function GET(request: NextRequest) {
  try {
    const store = getDriveStore();
    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get("prefix") ?? "";

    const { blobs, directories } = await store.list({
      prefix,
      directories: true,
    });

    // 过滤掉所有内部 key：__meta__/ __chunks__/ .keep 占位
    const fileBlobs = blobs.filter(
      (b: { key: string }) =>
        !b.key.startsWith("__meta__/") &&
        !b.key.startsWith("__chunks__/") &&
        !b.key.endsWith("/.keep")
    );

    // 同样过滤掉 __chunks__ __meta__ 目录
    // （directories 是 list 返回的子目录前缀字符串数组）

    const filesWithMeta = await Promise.allSettled(
      fileBlobs.map(async (b: { key: string; etag: string }) => {
        const meta = await store.get(`__meta__/${b.key}`, { type: "json" }) as {
          contentType: string;
          size: number;
          lastModified: string;
          fileName: string;
          chunked?: boolean;
        } | null;
        return {
          key: b.key,
          etag: b.etag,
          contentType: meta?.contentType ?? "application/octet-stream",
          size: meta?.size ?? 0,
          lastModified: meta?.lastModified ?? "",
          fileName: meta?.fileName ?? b.key.split("/").pop() ?? b.key,
        };
      })
    );

    const files = filesWithMeta
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    const filteredDirs = (directories ?? []).filter(
      (d: string) =>
        !d.startsWith("__meta__") &&
        !d.startsWith("__chunks__") &&
        d !== prefix
    );

    return NextResponse.json({ files, directories: filteredDirs });
  } catch (err: any) {
    console.error("[list]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
// ── POST /api/files   multipart/form-data: file + path ───────────
export async function POST(request: NextRequest) {
  try {
    const store = getDriveStore();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const pathPrefix = (formData.get("path") as string | null) ?? "";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Cloud Function 请求体上限约 100 MB
    const MAX_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `文件过大 (${(file.size / 1024 / 1024).toFixed(1)} MB)，限制 100 MB` },
        { status: 413 }
      );
    }

    const key = pathPrefix ? `${pathPrefix}/${file.name}` : file.name;
    const arrayBuffer = await file.arrayBuffer();

    // 写入文件本体
    // store.set 不支持直接传 contentType，用 cacheControl 控制缓存策略
    await store.set(key, arrayBuffer, {
      cacheControl: "private, max-age=3600",
    });

    // 写入 sidecar 元数据（contentType / size / lastModified）
    // key 前缀 __meta__/ 与文件本体隔离，list 时自动过滤掉
    await store.setJSON(`__meta__/${key}`, {
      contentType: file.type || "application/octet-stream",
      size: file.size,
      lastModified: new Date().toISOString(),
      fileName: file.name,
    });

    return NextResponse.json({ success: true, key });
  } catch (err: any) {
    console.error("[upload]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
