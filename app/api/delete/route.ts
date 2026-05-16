// ─────────────────────────────────────────────────────────────────
// app/api/delete/route.ts   (DELETE: remove file)
// API ref: https://pages.edgeone.ai/document/blob-storage
// ─────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@edgeone/pages-blob";
import { getDriveStore } from "@/lib/blob";
export const runtime = "nodejs";


// ── DELETE /api/delete?key=photos/cat.jpg ────────────────────────
// store.delete() 在 key 不存在时也不报错（文档明确说明）
export async function DELETE(request: NextRequest) {
  try {
    const store = getDriveStore();

    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Missing key parameter" }, { status: 400 });
    }

    // 同时删除文件本体和 sidecar 元数据
    await Promise.all([
      store.delete(key),
      store.delete(`__meta__/${key}`),
    ]);

    return NextResponse.json({ success: true, key });
  } catch (err: any) {
    console.error("[delete]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
