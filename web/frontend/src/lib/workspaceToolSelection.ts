import type { FeatureKey } from "../api/subscription";

import { parseWorkspaceToolPath } from "./toolRoutes";
import { WORKSPACE_TOOL_IDS } from "./workspaceFeatures";

const STORAGE_KEY = "nb_workspace_selected_tool_v1";

function isAllowedTool(id: string): id is FeatureKey {
  return (WORKSPACE_TOOL_IDS as readonly string[]).includes(id);
}

export function readPersistedWorkspaceTool(): FeatureKey | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || !isAllowedTool(raw)) {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

/** URL path wins when it maps to a tool; otherwise last remembered tool when valid. */
export function readInitialWorkspaceToolSelection(pathname: string): FeatureKey {
  const fromUrl = parseWorkspaceToolPath(pathname);
  if (fromUrl) {
    return fromUrl;
  }
  return readPersistedWorkspaceTool() ?? "split";
}

/** Remove per-file split draft keys (nb_pdf_workspace_split::$name::$size) — must run when clearing workspace after download. */
export function clearPdfWorkspaceSplitDraftsFromLocalStorage(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const prefix = "nb_pdf_workspace_split::";
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) {
        keys.push(k);
      }
    }
    for (const k of keys) {
      localStorage.removeItem(k);
    }
  } catch {
    /* noop */
  }
}

/** Remove workspace-scratch keys from sessionStorage without nuking unrelated keys (OAuth, CMS preview). */
export function clearWorkspaceSessionStoragePrefixes(): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  try {
    const prefixes = ["nb_pdf_workspace_", "nb_workspace_"];
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (!k) {
        continue;
      }
      if (prefixes.some((p) => k.startsWith(p))) {
        keys.push(k);
      }
    }
    for (const k of keys) {
      sessionStorage.removeItem(k);
    }
  } catch {
    /* noop */
  }
}

export function persistWorkspaceTool(tool: FeatureKey): void {
  if (typeof window === "undefined" || !isAllowedTool(tool)) {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, tool);
  } catch {
    /* quota / private mode */
  }
}

export function clearPersistedWorkspaceTool(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
