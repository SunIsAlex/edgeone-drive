// ─────────────────────────────────────────────────────────────────
// app/api/mkdir/route.ts   (POST: create folder)
// Blob 没有真实目录，用 <folder>/.keep 占位文件模拟
// ─────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getDriveStore } from "@/lib/blob";

export const runtime = "nodejs";

// ── POST /api/mkdir   JSON body: { path: "photos", name: "2025" } ─
export async function POST(request: NextRequest) {
  try {
    const { path, name } = await request.json();

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Missing folder name" }, { status: 400 });
    }

    // 禁止文件夹名含 / 或 ..
    if (/[\/\\]/.test(name) || name.includes("..")) {
      return NextResponse.json({ error: "Invalid folder name" }, { status: 400 });
    }

    const store = getDriveStore();
    const folderKey = path ? `${path}/${name}/.keep` : `${name}/.keep`;

    // onlyIfNew: true → 文件夹已存在时不覆盖，也不报错
    await store.set(folderKey, "", { onlyIfNew: true });
    await store.setJSON(`__meta__/${folderKey}`, {
      contentType: "application/x-directory",
      size: 0,
      lastModified: new Date().toISOString(),
      fileName: ".keep",
    });

    return NextResponse.json({ success: true, key: folderKey });
  } catch (err: any) {
    console.error("[mkdir]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}