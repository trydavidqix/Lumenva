export interface RevenueMetricInput {
  organizationId: string;
  sourceOrganizationIds?: string[];
  sales: number[];
  refunds: number[];
  chargebacks: number[];
  commissionsPending: number[];
  commissionsApproved: number[];
  commissionsPaid: number[];
  views: number;
  clicks: number;
  conversions: number;
  videos: number;
}

export interface RevenueMetrics {
  organizationId: string;
  gmvMinor: number;
  grossRevenueMinor: number;
  netRevenueMinor: number;
  refundsMinor: number;
  chargebacksMinor: number;
  commissionPendingMinor: number;
  commissionApprovedMinor: number;
  commissionPaidMinor: number;
  ctr: number | null;
  conversionRate: number | null;
  epcMinor: number | null;
  revenuePerThousandViewsMinor: number | null;
  revenuePerVideoMinor: number | null;
}

const sumMoney = (values: number[]): number => {
  if (!values.every(Number.isSafeInteger)) throw new Error("revenue_metrics_money_must_be_integer");
  return values.reduce((total, value) => total + value, 0);
};

const ratio = (numerator: number, denominator: number): number | null => denominator > 0 ? numerator / denominator : null;

export function calculateRevenueMetrics(input: RevenueMetricInput): RevenueMetrics {
  if ((input.sourceOrganizationIds ?? [input.organizationId]).some((id) => id !== input.organizationId)) {
    throw new Error("revenue_metrics_tenant_mismatch");
  }
  const gross = sumMoney(input.sales);
  const refunds = sumMoney(input.refunds);
  const chargebacks = sumMoney(input.chargebacks);
  const net = gross - refunds - chargebacks;
  return {
    organizationId: input.organizationId,
    gmvMinor: gross,
    grossRevenueMinor: gross,
    netRevenueMinor: net,
    refundsMinor: refunds,
    chargebacksMinor: chargebacks,
    commissionPendingMinor: sumMoney(input.commissionsPending),
    commissionApprovedMinor: sumMoney(input.commissionsApproved),
    commissionPaidMinor: sumMoney(input.commissionsPaid),
    ctr: ratio(input.clicks, input.views),
    conversionRate: ratio(input.conversions, input.clicks),
    epcMinor: input.clicks > 0 ? Math.round(net / input.clicks) : null,
    revenuePerThousandViewsMinor: input.views > 0 ? Math.round((net * 1000) / input.views) : null,
    revenuePerVideoMinor: input.videos > 0 ? Math.round(net / input.videos) : null,
  };
}
