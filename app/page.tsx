"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface FileItem {
  key: string;
  size: number;
  lastModified: string;
  contentType: string;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFileIcon(contentType: string, name: string): string {
  if (contentType.startsWith("image/")) return "🖼";
  if (contentType.startsWith("video/")) return "🎬";
  if (contentType.startsWith("audio/")) return "🎵";
  if (contentType.includes("pdf")) return "📄";
  if (contentType.includes("zip") || contentType.includes("compressed")) return "📦";
  if (contentType.includes("text/")) return "📝";
  if (
    name.endsWith(".js") ||
    name.endsWith(".ts") ||
    name.endsWith(".py") ||
    name.endsWith(".go")
  )
    return "💻";
  return "📁";
}

export default function DrivePage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState("");
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const res = await fetch(`/api/files?prefix=${encodeURIComponent(currentPath)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFiles(data.files || []);
    } catch (e: any) {
      notify(e.message, true);
    } finally {
      setLoading(false);
    }
  }, [currentPath]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const uploadFile = async (file: File) => {
    const MAX = 100 * 1024 * 1024;
    if (file.size > MAX) {
      notify(`文件 "${file.name}" 超过 100 MB 限制`, true);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const form = new FormData();
    form.append("file", file);
    form.append("path", currentPath);

    // Simulate progress since fetch doesn't expose upload progress easily
    const progressInterval = setInterval(() => {
      setUploadProgress((p) => Math.min(p + 8, 85));
    }, 200);

    try {
      const res = await fetch("/api/files", { method: "POST", body: form });
      const data = await res.json();
      clearInterval(progressInterval);
      if (!res.ok) throw new Error(data.error);
      setUploadProgress(100);
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 600);
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

  const handleDelete = async (key: string) => {
    if (!confirm(`确认删除 "${key.split("/").pop()}"？`)) return;
    setDeleting(key);
    try {
      const res = await fetch(`/api/delete?key=${encodeURIComponent(key)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notify("文件已删除");
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

  const filteredFiles = files.filter((f) =>
    f.key.toLowerCase().includes(search.toLowerCase())
  );

  const totalSize = files.reduce((s, f) => s + f.size, 0);

  return (
    <div className="drive-root">
      {/* Notification bar */}
      {(error || successMsg) && (
        <div className={`notif ${error ? "notif-error" : "notif-ok"}`}>
          {error ? "⚠ " : "✓ "}
          {error || successMsg}
        </div>
      )}

      <header className="header">
        <div className="logo">
          <span className="logo-mark">▲</span>
          <span className="logo-text">EdgeOne Drive</span>
        </div>
        <div className="header-stats">
          {files.length} 个文件 · {formatSize(totalSize)}
        </div>
      </header>

      <main className="main">
        {/* Toolbar */}
        <div className="toolbar">
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input
              className="search-input"
              placeholder="搜索文件…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            className="upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "上传中…" : "+ 上传文件"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
        </div>

        {/* Upload progress */}
        {uploading && (
          <div className="progress-bar-wrap">
            <div className="progress-bar" style={{ width: `${uploadProgress}%` }} />
            <span className="progress-label">{uploadProgress}%</span>
          </div>
        )}

        {/* Drop zone */}
        <div
          className={`drop-zone ${dragging ? "drag-over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          {dragging ? (
            <span className="drop-hint active">松开鼠标上传</span>
          ) : (
            <span className="drop-hint">或将文件拖拽至此处（最大 100 MB）</span>
          )}
        </div>

        {/* File list */}
        <div className="file-list">
          {loading ? (
            <div className="empty">
              <span className="spinner">◌</span> 加载中…
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="empty">
              {search ? "没有匹配的文件" : "暂无文件，上传第一个文件吧 🚀"}
            </div>
          ) : (
            <>
              <div className="file-list-header">
                <span>文件名</span>
                <span>类型</span>
                <span>大小</span>
                <span>修改时间</span>
                <span>操作</span>
              </div>
              {filteredFiles.map((file) => {
                const name = file.key.split("/").pop() || file.key;
                return (
                  <div key={file.key} className="file-row">
                    <span className="file-name">
                      <span className="file-icon">
                        {getFileIcon(file.contentType, name)}
                      </span>
                      <span className="file-name-text" title={file.key}>
                        {name}
                      </span>
                    </span>
                    <span className="file-type">
                      {file.contentType.split("/")[1]?.toUpperCase() || "FILE"}
                    </span>
                    <span className="file-size">{formatSize(file.size)}</span>
                    <span className="file-date">{formatDate(file.lastModified)}</span>
                    <span className="file-actions">
                      <button
                        className="act-btn act-download"
                        onClick={() => handleDownload(file.key)}
                        title="下载"
                      >
                        ↓
                      </button>
                      <button
                        className="act-btn act-delete"
                        onClick={() => handleDelete(file.key)}
                        disabled={deleting === file.key}
                        title="删除"
                      >
                        {deleting === file.key ? "…" : "✕"}
                      </button>
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </main>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .drive-root {
          min-height: 100vh;
          background: #0a0a0f;
          color: #e8e8f0;
          font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 13px;
        }

        .notif {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          padding: 10px 24px;
          font-size: 13px;
          font-weight: 600;
          text-align: center;
          animation: slideDown 0.2s ease;
        }
        .notif-ok  { background: #0d3320; color: #4ade80; border-bottom: 1px solid #166534; }
        .notif-error { background: #3b0a0a; color: #f87171; border-bottom: 1px solid #991b1b; }
        @keyframes slideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }

        .header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 32px;
          border-bottom: 1px solid #1e1e2e;
          background: #0d0d18;
        }
        .logo { display: flex; align-items: center; gap: 10px; }
        .logo-mark { color: #6366f1; font-size: 20px; }
        .logo-text { font-size: 16px; font-weight: 700; letter-spacing: 0.05em; color: #c7c7e8; }
        .header-stats { color: #4a4a6a; font-size: 11px; }

        .main { max-width: 1100px; margin: 0 auto; padding: 28px 24px; }

        .toolbar {
          display: flex; gap: 12px; align-items: center; margin-bottom: 16px;
        }
        .search-wrap {
          position: relative; flex: 1;
        }
        .search-icon {
          position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
          color: #4a4a6a; font-size: 16px; pointer-events: none;
        }
        .search-input {
          width: 100%; padding: 9px 12px 9px 34px;
          background: #12121e; border: 1px solid #1e1e30;
          border-radius: 6px; color: #c7c7e8; font-family: inherit; font-size: 13px;
          outline: none; transition: border-color 0.15s;
        }
        .search-input:focus { border-color: #4a4aff; }
        .search-input::placeholder { color: #3a3a5a; }

        .upload-btn {
          padding: 9px 18px;
          background: #4a4aff; color: #fff;
          border: none; border-radius: 6px; cursor: pointer;
          font-family: inherit; font-size: 13px; font-weight: 600;
          transition: background 0.15s, transform 0.1s;
          white-space: nowrap;
        }
        .upload-btn:hover:not(:disabled) { background: #5a5aff; }
        .upload-btn:active:not(:disabled) { transform: scale(0.97); }
        .upload-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .progress-bar-wrap {
          position: relative; height: 4px; background: #1e1e30;
          border-radius: 2px; margin-bottom: 12px; overflow: hidden;
        }
        .progress-bar {
          height: 100%; background: #4a4aff;
          border-radius: 2px; transition: width 0.2s ease;
        }
        .progress-label {
          position: absolute; right: 0; top: 6px;
          font-size: 10px; color: #4a4aff;
        }

        .drop-zone {
          border: 1px dashed #1e1e35;
          border-radius: 8px; padding: 14px 20px;
          text-align: center; margin-bottom: 20px;
          transition: border-color 0.15s, background 0.15s;
          cursor: default;
        }
        .drop-zone.drag-over { border-color: #4a4aff; background: #0f0f2a; }
        .drop-hint { color: #3a3a5a; font-size: 12px; }
        .drop-hint.active { color: #6366f1; }

        .file-list { border: 1px solid #1a1a2a; border-radius: 8px; overflow: hidden; }

        .file-list-header {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1.5fr 80px;
          padding: 10px 16px;
          background: #0d0d18;
          color: #3a3a5a;
          font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em;
          border-bottom: 1px solid #1a1a2a;
        }

        .file-row {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1.5fr 80px;
          padding: 12px 16px;
          border-bottom: 1px solid #14141e;
          align-items: center;
          transition: background 0.1s;
        }
        .file-row:last-child { border-bottom: none; }
        .file-row:hover { background: #0e0e1c; }

        .file-name { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .file-icon { font-size: 16px; flex-shrink: 0; }
        .file-name-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #c7c7e8; }
        .file-type { color: #4a4a6a; font-size: 10px; letter-spacing: 0.05em; }
        .file-size { color: #7a7a9a; }
        .file-date { color: #4a4a6a; font-size: 11px; }

        .file-actions { display: flex; gap: 6px; }
        .act-btn {
          padding: 4px 9px; border-radius: 4px; border: 1px solid transparent;
          cursor: pointer; font-size: 12px; font-family: inherit; font-weight: 600;
          transition: all 0.1s;
        }
        .act-download {
          background: #0d1a2a; color: #60a5fa; border-color: #1a2a3a;
        }
        .act-download:hover { background: #1a2a3a; }
        .act-delete {
          background: #1a0d0d; color: #f87171; border-color: #2a1a1a;
        }
        .act-delete:hover:not(:disabled) { background: #2a1a1a; }
        .act-delete:disabled { opacity: 0.4; cursor: not-allowed; }

        .empty {
          padding: 48px; text-align: center; color: #3a3a5a; font-size: 13px;
        }
        .spinner { display: inline-block; animation: spin 1.2s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 680px) {
          .file-list-header,
          .file-row {
            grid-template-columns: 1fr auto 64px;
          }
          .file-list-header span:nth-child(2),
          .file-list-header span:nth-child(4),
          .file-row .file-type,
          .file-row .file-date { display: none; }
          .header { padding: 14px 16px; }
          .main { padding: 16px; }
        }
      `}</style>
    </div>
  );
}
