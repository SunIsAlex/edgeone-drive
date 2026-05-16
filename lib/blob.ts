// lib/blob.ts
import { getStore } from "@edgeone/pages-blob";

export function getDriveStore() {
  const projectId = process.env.EDGEONE_PROJECT_ID;
  const token = process.env.EDGEONE_API_TOKEN;

  // 有环境变量就显式传入（本地开发 / 外部访问）
  // 没有则依赖平台自动注入（Pages Functions 运行时）
  if (projectId && token) {
    return getStore({ name: "drive", projectId, token });
  }
  return getStore("drive");
}