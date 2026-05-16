"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface FileItem {
  key: string;
  size: number;
  lastModified: string;
  contentType: string;
  etag?: string;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFileIcon(contentType: string, name: string): string {
  if (contentType === "application/x-directory") return "📁";
  if (contentType.startsWith("image/")) return "🖼";
  if (contentType.startsWith("video/")) return "🎬";
  if (contentType.startsWith("audio/")) return "🎵";
  if (contentType.includes("pdf")) return "📄";
  if (contentType.includes("zip") || contentType.includes("compressed")) return "📦";
  if (contentType.includes("text/")) return "📝";
  if (/\.(js|ts|py|go|rs|java|c|cpp|cs)$/.test(name)) return "💻";
  return "📄";
}

function getFileTypeLabel(contentType: string): string {
  if (contentType === "application/x-directory") return "文件夹";
  const sub = contentType.split("/")[1];
  if (!sub) return "文件";
  return sub.toUpperCase().replace(/X-/, "");
}

export default function DrivePage() {
  const [files, setFiles]                   = useState<FileItem[]>([]);
  const [directories, setDirectories]       = useState<string[]>([]);
  const [loading, setLoading]               = useState(true);
  const [uploading, setUploading]           = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState("");
  const [error, setError]                   = useState<string | null>(null);
  const [successMsg, setSuccessMsg]         = useState<string | null>(null);
  const [dragging, setDragging]             = useState(false);
  const [deleting, setDeleting]             = useState<string | null>(null);
  const [currentPath, setCurrentPath]       = useState("");
  const [search, setSearch]                 = useState("");
  const [showMkdir, setShowMkdir]           = useState(false);
  const [newFolderName, setNewFolderName]   = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mkdirInputRef = useRef<HTMLInputElement>(null);

  const notify = (msg: string, isError = false) => {
    if (isError) {
      setError(msg);
      setTimeout(() => setError(null), 5000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/files?prefix=${encodeURIComponent(currentPath)}&directories=true`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // 过滤掉 sidecar meta 文件和 .keep 占位文件
      const filtered = (data.files || []).filter(
        (f: FileItem) =>
          !f.key.startsWith("__meta__/") && !f.key.endsWith("/.keep")
      );
      setFiles(filtered);
      setDirectories(data.directories || []);
    } catch (e: any) {
      notify(e.message, true);
    } finally {
      setLoading(false);
    }
  }, [currentPath]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // 打开文件夹
  const enterFolder = (dirKey: string) => {
    // dirKey 形如 "photos/" 末尾带斜杠
    setCurrentPath(dirKey);
    setSearch("");
  };

  // 面包屑导航
  const breadcrumbs = () => {
    if (!currentPath) return [{ label: "我的网盘", path: "" }];
    const parts = currentPath.replace(/\/$/, "").split("/");
    const crumbs = [{ label: "我的网盘", path: "" }];
    parts.forEach((p, i) => {
      crumbs.push({ label: p, path: parts.slice(0, i + 1).join("/") + "/" });
    });
    return crumbs;
  };

  const uploadFile = async (file: File) => {
    const MAX = 100 * 1024 * 1024;
    if (file.size > MAX) {
      notify(`文件 "${file.name}" 超过 100 MB 限制`, true);
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    setUploadFileName(file.name);

    const form = new FormData();
    form.append("file", file);
    form.append("path", currentPath.replace(/\/$/, ""));

    const progressInterval = setInterval(() => {
      setUploadProgress((p) => Math.min(p + 6, 88));
    }, 150);

    try {
      const res = await fetch("/api/files", { method: "POST", body: form });
      const data = await res.json();
      clearInterval(progressInterval);
      if (!res.ok) throw new Error(data.error);
      setUploadProgress(100);
      setTimeout(() => { setUploading(false); setUploadProgress(0); }, 500);
      notify(`"${file.name}" 上传成功`);
      loadFiles();
    } catch (e: any) {
      clearInterval(progressInterval);
      setUploading(false);
      setUploadProgress(0);
      notify(e.message, true);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) uploadFile(f);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) uploadFile(f);
  };

  const handleDelete = async (key: string, isDir = false) => {
    const label = isDir
      ? `文件夹 "${key.replace(/\/$/, "").split("/").pop()}"`
      : `"${key.split("/").pop()}"`;
    if (!confirm(`确认删除 ${label}？`)) return;
    setDeleting(key);
    try {
      const res = await fetch(`/api/delete?key=${encodeURIComponent(key)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notify("已删除");
      loadFiles();
    } catch (e: any) {
      notify(e.message, true);
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = (key: string) => {
    window.location.href = `/api/download?key=${encodeURIComponent(key)}`;
  };

  const handleMkdir = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      const res = await fetch("/api/mkdir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: currentPath.replace(/\/$/, ""), name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notify(`文件夹 "${name}" 已创建`);
      setShowMkdir(false);
      setNewFolderName("");
      loadFiles();
    } catch (e: any) {
      notify(e.message, true);
    }
  };

  const filteredFiles = files.filter((f) =>
    f.key.toLowerCase().includes(search.toLowerCase())
  );

  // 目录也要过滤（去掉 __meta__ 和当前路径本身）
  const filteredDirs = directories.filter(
    (d) => !d.startsWith("__meta__") && d !== currentPath
  );

  const totalSize = files.reduce((s, f) => s + (f.size || 0), 0);
  const crumbs = breadcrumbs();

  return (
    <div className="root">
      {/* Toast */}
      {(error || successMsg) && (
        <div className={`toast ${error ? "toast-err" : "toast-ok"}`}>
          <span>{error ? "⚠" : "✓"}</span>
          {error || successMsg}
        </div>
      )}

      {/* Title bar */}
      <div className="titlebar">
        <div className="titlebar-logo">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="6" height="6" fill="#0078D4"/>
            <rect x="9" y="1" width="6" height="6" fill="#0078D4"/>
            <rect x="1" y="9" width="6" height="6" fill="#0078D4"/>
            <rect x="9" y="9" width="6" height="6" fill="#0078D4"/>
          </svg>
          EdgeOne Drive
        </div>
        <div className="titlebar-stat">
          {files.length} 个项目 &nbsp;|&nbsp; {formatSize(totalSize)}
        </div>
      </div>

      {/* Ribbon toolbar */}
      <div className="ribbon">
        <button className="ribbon-btn primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <span className="ribbon-icon">⬆</span>
          <span>{uploading ? "上传中…" : "上传"}</span>
        </button>
        <button className="ribbon-btn"
          onClick={() => { setShowMkdir(true); setTimeout(() => mkdirInputRef.current?.focus(), 50); }}
        >
          <span className="ribbon-icon">📁</span>
          <span>新建文件夹</span>
        </button>
        <div className="ribbon-sep" />
        <button className="ribbon-btn" onClick={loadFiles}>
          <span className="ribbon-icon">↻</span>
          <span>刷新</span>
        </button>
        <div className="ribbon-spacer" />
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            placeholder="搜索当前文件夹"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={handleFileChange} />
      </div>

      {/* Address bar / breadcrumb */}
      <div className="addrbar">
        <span className="addrbar-label">位置:</span>
        <div className="breadcrumbs">
          {crumbs.map((c, i) => (
            <span key={c.path} className="crumb-group">
              {i > 0 && <span className="crumb-sep">›</span>}
              <button
                className={`crumb ${i === crumbs.length - 1 ? "crumb-active" : ""}`}
                onClick={() => { setCurrentPath(c.path); setSearch(""); }}
              >
                {c.label}
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Upload progress bar */}
      {uploading && (
        <div className="upload-banner">
          <span className="upload-name">正在上传: {uploadFileName}</span>
          <div className="upload-track">
            <div className="upload-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
          <span className="upload-pct">{uploadProgress}%</span>
        </div>
      )}

      {/* Main content */}
      <div
        className={`content ${dragging ? "drag-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {loading ? (
          <div className="state-msg">
            <div className="spinner" />
            加载中…
          </div>
        ) : (filteredDirs.length === 0 && filteredFiles.length === 0) ? (
          <div className="state-msg">
            {search
              ? `未找到匹配 "${search}" 的项目`
              : dragging
              ? "松开鼠标以上传文件"
              : "此文件夹为空，拖拽文件到此处或点击"上传""}
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="col-header">
              <span className="col-name">名称</span>
              <span className="col-date">修改日期</span>
              <span className="col-type">类型</span>
              <span className="col-size">大小</span>
              <span className="col-actions" />
            </div>

            {/* Folders */}
            {filteredDirs.map((dir) => {
              const label = dir.replace(/\/$/, "").split("/").pop() || dir;
              return (
                <div key={dir} className="row" onDoubleClick={() => enterFolder(dir)}>
                  <span className="col-name">
                    <span className="item-icon">📁</span>
                    <span className="item-label" title={dir}>{label}</span>
                  </span>
                  <span className="col-date">—</span>
                  <span className="col-type">文件夹</span>
                  <span className="col-size">—</span>
                  <span className="col-actions">
                    <button className="act open" onClick={() => enterFolder(dir)} title="打开">▶</button>
                    <button
                      className="act del"
                      onClick={() => handleDelete(dir + ".keep", true)}
                      disabled={deleting === dir + ".keep"}
                      title="删除"
                    >✕</button>
                  </span>
                </div>
              );
            })}

            {/* Files */}
            {filteredFiles.map((file) => {
              const name = file.key.split("/").pop() || file.key;
              return (
                <div key={file.key} className="row">
                  <span className="col-name">
                    <span className="item-icon">{getFileIcon(file.contentType, name)}</span>
                    <span className="item-label" title={file.key}>{name}</span>
                  </span>
                  <span className="col-date">{formatDate(file.lastModified)}</span>
                  <span className="col-type">{getFileTypeLabel(file.contentType)}</span>
                  <span className="col-size">{file.size ? formatSize(file.size) : "—"}</span>
                  <span className="col-actions">
                    <button className="act dl" onClick={() => handleDownload(file.key)} title="下载">↓</button>
                    <button
                      className="act del"
                      onClick={() => handleDelete(file.key)}
                      disabled={deleting === file.key}
                      title="删除"
                    >{deleting === file.key ? "…" : "✕"}</button>
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Status bar */}
      <div className="statusbar">
        {search
          ? `搜索结果: ${filteredFiles.length} 个文件`
          : `${filteredDirs.length} 个文件夹，${filteredFiles.length} 个文件`}
      </div>

      {/* New folder modal */}
      {showMkdir && (
        <div className="overlay" onClick={() => setShowMkdir(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">
              <span>📁</span> 新建文件夹
            </div>
            <div className="dialog-body">
              <label className="dialog-label">请输入文件夹名称</label>
              <input
                ref={mkdirInputRef}
                className="dialog-input"
                placeholder="新建文件夹"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleMkdir();
                  if (e.key === "Escape") setShowMkdir(false);
                }}
              />
            </div>
            <div className="dialog-footer">
              <button className="dialog-btn" onClick={() => setShowMkdir(false)}>取消</button>
              <button
                className="dialog-btn primary"
                onClick={handleMkdir}
                disabled={!newFolderName.trim()}
              >确定</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }

        /* ── 全局变量 (Windows 11 Explorer 风格，浅色) ── */
        :root {
          --bg:          #f3f3f3;
          --bg-content:  #ffffff;
          --bg-titlebar: #f3f3f3;
          --bg-ribbon:   #ffffff;
          --bg-addr:     #f9f9f9;
          --bg-header:   #f3f3f3;
          --bg-row-hover:#cce8ff;
          --bg-row-sel:  #cce8ff;
          --border:      #e0e0e0;
          --border-addr: #c8c8c8;
          --text:        #1a1a1a;
          --text-sub:    #666666;
          --text-head:   #444444;
          --accent:      #0078D4;
          --accent-dark: #005a9e;
          --accent-light:#deecf9;
          --danger:      #c42b1c;
          --success-bg:  #dff6dd;
          --success-text:#107c10;
          --err-bg:      #fde7e9;
          --err-text:    #c42b1c;
          --shadow:      0 2px 8px rgba(0,0,0,0.12);
          --radius:      4px;
          --font:        'Segoe UI', 'Microsoft YaHei UI', system-ui, sans-serif;
          --font-mono:   'Consolas', 'Courier New', monospace;
        }

        .root {
          min-height: 100vh;
          display: flex; flex-direction: column;
          background: var(--bg);
          font-family: var(--font);
          font-size: 13px;
          color: var(--text);
        }

        /* ── Toast ── */
        .toast {
          position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
          z-index: 999; display: flex; align-items: center; gap: 8px;
          padding: 10px 20px; border-radius: var(--radius);
          font-size: 13px; font-weight: 500;
          box-shadow: var(--shadow);
          animation: toastIn 0.2s ease;
        }
        .toast-ok  { background: var(--success-bg); color: var(--success-text); border: 1px solid #a7d7a8; }
        .toast-err { background: var(--err-bg);     color: var(--err-text);     border: 1px solid #f4abab; }
        @keyframes toastIn { from { opacity:0; transform: translateX(-50%) translateY(-8px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }

        /* ── Title bar ── */
        .titlebar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 6px 16px;
          background: var(--bg-titlebar);
          border-bottom: 1px solid var(--border);
          user-select: none;
        }
        .titlebar-logo {
          display: flex; align-items: center; gap: 8px;
          font-size: 12px; font-weight: 600; color: var(--text);
        }
        .titlebar-stat { font-size: 11px; color: var(--text-sub); }

        /* ── Ribbon ── */
        .ribbon {
          display: flex; align-items: center; gap: 4px;
          padding: 6px 12px;
          background: var(--bg-ribbon);
          border-bottom: 1px solid var(--border);
        }
        .ribbon-btn {
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          padding: 6px 12px; min-width: 52px;
          background: transparent; border: 1px solid transparent;
          border-radius: var(--radius); cursor: pointer;
          font-family: var(--font); font-size: 11px; color: var(--text);
          transition: background 0.1s, border-color 0.1s;
        }
        .ribbon-btn:hover { background: var(--accent-light); border-color: #90c8f0; }
        .ribbon-btn:active { background: #b0d8f5; }
        .ribbon-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .ribbon-btn.primary .ribbon-icon { color: var(--accent); }
        .ribbon-icon { font-size: 18px; line-height: 1; }
        .ribbon-sep { width: 1px; height: 36px; background: var(--border); margin: 0 4px; }
        .ribbon-spacer { flex: 1; }

        /* ── Search ── */
        .search-wrap { position: relative; }
        .search-icon {
          position: absolute; left: 8px; top: 50%; transform: translateY(-50%);
          font-size: 12px; pointer-events: none;
        }
        .search-input {
          padding: 5px 10px 5px 28px; width: 220px;
          background: var(--bg); border: 1px solid var(--border-addr);
          border-radius: 16px; font-family: var(--font); font-size: 12px;
          color: var(--text); outline: none; transition: border-color 0.15s, box-shadow 0.15s;
        }
        .search-input:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-light); }
        .search-input::placeholder { color: #aaa; }

        /* ── Address bar ── */
        .addrbar {
          display: flex; align-items: center; gap: 8px;
          padding: 5px 12px;
          background: var(--bg-addr);
          border-bottom: 1px solid var(--border);
        }
        .addrbar-label { font-size: 11px; color: var(--text-sub); white-space: nowrap; }
        .breadcrumbs { display: flex; align-items: center; flex-wrap: wrap; gap: 0; }
        .crumb-group { display: flex; align-items: center; }
        .crumb-sep { color: var(--text-sub); margin: 0 4px; font-size: 12px; }
        .crumb {
          padding: 2px 6px; background: transparent; border: none;
          border-radius: var(--radius); cursor: pointer;
          font-family: var(--font); font-size: 12px; color: var(--accent);
          transition: background 0.1s;
        }
        .crumb:hover { background: var(--accent-light); text-decoration: underline; }
        .crumb.crumb-active { color: var(--text); cursor: default; font-weight: 500; }
        .crumb.crumb-active:hover { background: transparent; text-decoration: none; }

        /* ── Upload banner ── */
        .upload-banner {
          display: flex; align-items: center; gap: 10px;
          padding: 6px 16px;
          background: var(--accent-light);
          border-bottom: 1px solid #90c8f0;
          font-size: 12px;
        }
        .upload-name { color: var(--text); min-width: 120px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .upload-track { flex: 1; height: 6px; background: #c8e0f5; border-radius: 3px; overflow: hidden; }
        .upload-fill { height: 100%; background: var(--accent); transition: width 0.2s ease; border-radius: 3px; }
        .upload-pct { color: var(--accent); font-weight: 600; min-width: 36px; text-align: right; }

        /* ── Content area ── */
        .content {
          flex: 1;
          background: var(--bg-content);
          overflow-y: auto;
          transition: background 0.15s;
        }
        .content.drag-over { background: var(--accent-light); }

        /* ── Column header ── */
        .col-header {
          display: grid;
          grid-template-columns: minmax(200px, 2.5fr) 160px 120px 90px 88px;
          padding: 6px 16px;
          background: var(--bg-header);
          border-bottom: 1px solid var(--border);
          color: var(--text-head);
          font-size: 12px; font-weight: 600;
          position: sticky; top: 0; z-index: 1;
          user-select: none;
        }

        /* ── File/folder row ── */
        .row {
          display: grid;
          grid-template-columns: minmax(200px, 2.5fr) 160px 120px 90px 88px;
          padding: 4px 16px;
          align-items: center;
          border-bottom: 1px solid transparent;
          transition: background 0.08s;
          cursor: default;
        }
        .row:hover { background: var(--bg-row-hover); }
        .row:hover .col-actions { opacity: 1; }

        .col-name  { display: flex; align-items: center; gap: 6px; min-width: 0; }
        .col-date  { color: var(--text-sub); font-size: 12px; }
        .col-type  { color: var(--text-sub); font-size: 12px; }
        .col-size  { color: var(--text-sub); font-size: 12px; text-align: right; padding-right: 8px; }
        .col-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.1s; }

        .item-icon { font-size: 16px; flex-shrink: 0; }
        .item-label {
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          font-size: 13px; color: var(--text);
        }

        /* ── Action buttons ── */
        .act {
          padding: 3px 8px; border-radius: var(--radius);
          border: 1px solid transparent; cursor: pointer;
          font-size: 12px; font-family: var(--font); font-weight: 600;
          transition: background 0.1s, border-color 0.1s;
          line-height: 1.4;
        }
        .act.dl   { background: var(--accent-light); color: var(--accent); border-color: #90c8f0; }
        .act.dl:hover { background: #b0d8f5; }
        .act.open { background: var(--accent-light); color: var(--accent); border-color: #90c8f0; font-size: 10px; }
        .act.open:hover { background: #b0d8f5; }
        .act.del  { background: #fde7e9; color: var(--danger); border-color: #f4abab; }
        .act.del:hover:not(:disabled) { background: #f9c5c3; }
        .act.del:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── State messages ── */
        .state-msg {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 12px;
          padding: 80px 24px; color: var(--text-sub); font-size: 13px;
          text-align: center;
        }
        .spinner {
          width: 24px; height: 24px;
          border: 3px solid var(--border);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Status bar ── */
        .statusbar {
          padding: 4px 16px;
          background: var(--bg-titlebar);
          border-top: 1px solid var(--border);
          font-size: 11px; color: var(--text-sub);
          user-select: none;
        }

        /* ── New folder dialog ── */
        .overlay {
          position: fixed; inset: 0; z-index: 500;
          background: rgba(0,0,0,0.35);
          display: flex; align-items: center; justify-content: center;
          animation: fadeIn 0.15s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .dialog {
          background: #ffffff;
          border: 1px solid var(--border);
          border-radius: 6px;
          width: 380px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.2);
          animation: dialogIn 0.15s ease;
          overflow: hidden;
        }
        @keyframes dialogIn { from { transform: scale(0.96) translateY(8px); opacity:0; } to { transform: scale(1) translateY(0); opacity:1; } }

        .dialog-title {
          display: flex; align-items: center; gap: 8px;
          padding: 14px 16px;
          background: var(--bg-titlebar);
          border-bottom: 1px solid var(--border);
          font-size: 13px; font-weight: 600; color: var(--text);
        }
        .dialog-body { padding: 16px; }
        .dialog-label { display: block; font-size: 12px; color: var(--text-sub); margin-bottom: 8px; }
        .dialog-input {
          width: 100%; padding: 7px 10px;
          border: 1px solid var(--border-addr); border-radius: var(--radius);
          font-family: var(--font); font-size: 13px; color: var(--text);
          outline: none; transition: border-color 0.15s, box-shadow 0.15s;
        }
        .dialog-input:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-light); }

        .dialog-footer {
          display: flex; justify-content: flex-end; gap: 8px;
          padding: 10px 16px;
          background: var(--bg-titlebar);
          border-top: 1px solid var(--border);
        }
        .dialog-btn {
          padding: 6px 20px; border-radius: var(--radius);
          border: 1px solid var(--border-addr);
          background: #ffffff; color: var(--text);
          font-family: var(--font); font-size: 13px; cursor: pointer;
          transition: background 0.1s;
        }
        .dialog-btn:hover { background: var(--bg); }
        .dialog-btn.primary {
          background: var(--accent); color: #fff; border-color: var(--accent);
        }
        .dialog-btn.primary:hover:not(:disabled) { background: var(--accent-dark); border-color: var(--accent-dark); }
        .dialog-btn.primary:disabled { opacity: 0.45; cursor: not-allowed; }

        /* ── Responsive ── */
        @media (max-width: 680px) {
          .col-header, .row {
            grid-template-columns: 1fr 80px 72px;
          }
          .col-date, .col-type { display: none; }
          .col-size { padding-right: 4px; }
          .search-input { width: 140px; }
          .ribbon-btn span:last-child { display: none; }
          .ribbon-btn { min-width: 36px; }
        }
      `}</style>
    </div>
  );
}