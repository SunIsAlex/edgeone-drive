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
