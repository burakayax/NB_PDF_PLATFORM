/**
 * Araç kilidi kararı. Plan bilgisi alınamadıysa (429/500/ağ) kilitli araç AÇIK gösterilmez:
 * güvenli tarafta kalınır. Gerçek yetki kapısı sunucudur; bu yalnız arayüz kararıdır.
 */
export type PlanGateInput = {
  isAuthenticated: boolean;
  allowedFeatures: readonly string[] | null;
  loading: boolean;
  failed: boolean;
};

export function isFeatureLockedByPlan(featureId: string, g: PlanGateInput): boolean {
  if (!g.isAuthenticated) return false;
  if (!g.allowedFeatures) return g.failed;
  if (g.loading) return false;
  return !g.allowedFeatures.includes(featureId);
}
