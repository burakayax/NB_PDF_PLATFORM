/** Icon exports — Centralized tool and logo icons */

// Logo
export { LogoIcon, LogoWithText, LogoMinimal } from "./Logo";

// Tool Icons
export {
  MergeIcon,
  SplitIcon,
  CompressIcon,
  ConvertIcon,
  WatermarkIcon,
  EncryptIcon,
  RotateIcon,
  DeleteIcon,
  ExtractIcon,
  SettingsIcon,
  PDFIcon,
} from "./ToolIcons";

// Icon map for dynamic rendering
export const TOOL_ICONS = {
  merge: () => import("./ToolIcons").then((m) => m.MergeIcon),
  split: () => import("./ToolIcons").then((m) => m.SplitIcon),
  compress: () => import("./ToolIcons").then((m) => m.CompressIcon),
  "pdf-to-word": () => import("./ToolIcons").then((m) => m.ConvertIcon),
  watermark: () => import("./ToolIcons").then((m) => m.WatermarkIcon),
  encrypt: () => import("./ToolIcons").then((m) => m.EncryptIcon),
  rotate: () => import("./ToolIcons").then((m) => m.RotateIcon),
  "delete-pages": () => import("./ToolIcons").then((m) => m.DeleteIcon),
  extract: () => import("./ToolIcons").then((m) => m.ExtractIcon),
  settings: () => import("./ToolIcons").then((m) => m.SettingsIcon),
};
