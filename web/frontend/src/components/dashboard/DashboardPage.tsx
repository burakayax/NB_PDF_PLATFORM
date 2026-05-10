import type { AuthUser } from "../../api/auth";
import type { Language } from "../../i18n/landing";
import type { FeatureKey } from "../../api/subscription";
import type { UserBalance } from "../../api/entitlement";
import type { SidebarToolId } from "./DashboardSidebar";
import { DashboardLayout } from "./DashboardLayout";

interface DashboardPageProps {
  user: AuthUser;
  language: Language;
  userBalance?: UserBalance | null;
  lockedFeatures?: Set<FeatureKey>;
  enabledToolIds?: FeatureKey[];
  selectedTool: SidebarToolId;
  onSelectTool: (id: SidebarToolId) => void;
  accessToken?: string | null;
  limitsizProActive?: boolean;
  onUpgrade?: () => void;
  onAdminClick?: () => void;
  onOpenSettings?: () => void;
  resolveToolLabel?: (id: FeatureKey) => string;
}

export function DashboardPage(props: DashboardPageProps) {
  return <DashboardLayout {...props} />;
}
