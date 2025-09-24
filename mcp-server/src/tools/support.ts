import {
  CustomerDetailResponse,
  CustomerHistoryResponse,
  CustomerListResponse,
  EarnPointsResponse,
  RedeemRewardResponse,
  RewardCatalogResponse,
  UpdateRewardResponse,
  OffersResponse,
  CustomerOffersResponse,
  AssignOfferResponse,
  ClaimOfferResponse,
} from '../types';
import { httpGet, httpPost, httpPatch } from '../client/api';

interface LookupCustomerArgs {
  customerId?: string;
  email?: string;
  includeHistory?: boolean;
  historyLimit?: number;
}

interface ActivitySummaryArgs {
  customerId: string;
  limit?: number;
}

interface IssueGoodwillArgs {
  customerId: string;
  points: number;
  reason: string;
  channel?: string;
}

interface RedeemRewardArgs {
  customerId: string;
  rewardId: string;
  channel?: string;
  note?: string;
}

interface CatalogSnapshotArgs {
  onlyActive?: boolean;
  minInventory?: number;
  maxCost?: number;
}

interface RestockRewardArgs {
  rewardId: string;
  inventoryDelta: number;
  active?: boolean;
}

interface OfferCatalogArgs {
  onlyActive?: boolean;
}

interface CustomerOffersArgs {
  customerId: string;
  includeExpired?: boolean;
}

interface AssignOfferArgs {
  customerId: string;
  offerId: string;
  expiresAt?: string;
}

interface ClaimOfferArgs {
  customerId: string;
  customerOfferId: string;
}

export async function lookupCustomer(args: LookupCustomerArgs) {
  const identifier = await resolveCustomerId(args);
  const { data: customer } = await httpGet<CustomerDetailResponse>(`/customers/${identifier}`);

  let history: CustomerHistoryResponse['history'] = [];
  if (args.includeHistory) {
    const { data } = await httpGet<CustomerHistoryResponse>(`/customers/${identifier}/history`);
    history = args.historyLimit ? data.history.slice(0, args.historyLimit) : data.history;
  }

  return {
    customer,
    history,
  };
}

export async function activitySummary(args: ActivitySummaryArgs) {
  if (!args.customerId) {
    throw new Error('customerId is required');
  }

  const { data } = await httpGet<CustomerHistoryResponse>(`/customers/${args.customerId}/history`);
  const records = args.limit ? data.history.slice(0, args.limit) : data.history;
  const totals = records.reduce(
    (acc, entry) => {
      if (entry.type === 'earn') {
        acc.earned += entry.points;
      } else if (entry.type === 'redeem') {
        acc.redeemed += Math.abs(entry.points);
      }
      return acc;
    },
    { earned: 0, redeemed: 0 },
  );

  const recentRedeems = records.filter((entry) => entry.type === 'redeem');
  const highValueRedeems = recentRedeems.filter((entry) => Math.abs(entry.points) >= 5000);

  return {
    totalEvents: records.length,
    totals,
    highValueRedeems,
    records,
  };
}

export async function issueGoodwill(args: IssueGoodwillArgs) {
  if (!args.customerId) {
    throw new Error('customerId is required');
  }
  if (!Number.isFinite(args.points) || args.points <= 0) {
    throw new Error('points must be a positive number');
  }
  if (!args.reason || !args.reason.trim()) {
    throw new Error('reason is required');
  }

  const { data } = await httpPost<EarnPointsResponse>(`/customers/${args.customerId}/earn`, {
    points: Math.round(args.points),
    source: `Goodwill - ${args.reason.trim()}`,
    channel: args.channel,
    metadata: {
      reason: args.reason.trim(),
      issuedBy: 'support',
    },
  });

  return data;
}

export async function redeemReward(args: RedeemRewardArgs) {
  if (!args.customerId) {
    throw new Error('customerId is required');
  }
  if (!args.rewardId) {
    throw new Error('rewardId is required');
  }

  const { data } = await httpPost<RedeemRewardResponse>(`/customers/${args.customerId}/redeem`, {
    rewardId: args.rewardId,
    channel: args.channel,
    metadata: args.note ? { note: args.note } : undefined,
  });

  return data;
}

export async function catalogSnapshot(args: CatalogSnapshotArgs = {}) {
  const { data } = await httpGet<RewardCatalogResponse>('/rewards');
  const filtered = data.rewards.filter((reward) => {
    if (args.onlyActive && !reward.active) return false;
    if (typeof args.minInventory === 'number') {
      const stock = reward.inventory ?? Infinity;
      if (stock < args.minInventory) return false;
    }
    if (typeof args.maxCost === 'number' && reward.cost > args.maxCost) {
      return false;
    }
    return true;
  });

  return {
    rewards: filtered,
    total: filtered.length,
  };
}

export async function restockReward(args: RestockRewardArgs) {
  if (!args.rewardId) {
    throw new Error('rewardId is required');
  }
  if (!Number.isFinite(args.inventoryDelta)) {
    throw new Error('inventoryDelta must be numeric');
  }

  const payload: Record<string, unknown> = {
    inventory: Math.round(args.inventoryDelta),
  };
  if (typeof args.active === 'boolean') {
    payload.active = args.active;
  }

  const { data } = await httpPatch<UpdateRewardResponse>(`/rewards/${args.rewardId}`, payload);
  return data.reward;
}

export async function offerCatalog(args: OfferCatalogArgs = {}) {
  const { data } = await httpGet<OffersResponse>('/offers');
  const offers = args.onlyActive
    ? data.offers.filter((offer) => offer.active && !isExpired(offer.endDate))
    : data.offers;

  return {
    offers,
    total: offers.length,
  };
}

export async function customerOffers(args: CustomerOffersArgs) {
  if (!args.customerId) {
    throw new Error('customerId is required');
  }

  const { data } = await httpGet<CustomerOffersResponse>(`/customers/${args.customerId}/offers`);
  const offers = args.includeExpired ? data.offers : data.offers.filter((entry) => entry.status !== 'expired');

  return {
    offers,
    total: offers.length,
  };
}

export async function assignOffer(args: AssignOfferArgs) {
  if (!args.customerId) {
    throw new Error('customerId is required');
  }
  if (!args.offerId) {
    throw new Error('offerId is required');
  }

  const { data } = await httpPost<AssignOfferResponse>(`/customers/${args.customerId}/offers`, {
    offerId: args.offerId,
    expiresAt: args.expiresAt,
  });

  return data.customerOffer;
}

export async function claimOffer(args: ClaimOfferArgs) {
  if (!args.customerId) {
    throw new Error('customerId is required');
  }
  if (!args.customerOfferId) {
    throw new Error('customerOfferId is required');
  }

  const { data } = await httpPost<ClaimOfferResponse>(
    `/customers/${args.customerId}/offers/${args.customerOfferId}/claim`,
    {},
  );

  return data;
}

async function resolveCustomerId({ customerId, email }: LookupCustomerArgs) {
  if (customerId) {
    return customerId;
  }
  if (!email) {
    throw new Error('Provide either customerId or email');
  }

  const { data } = await httpGet<CustomerListResponse>('/customers');
  const match = data.customers.find((customer) => customer.email.toLowerCase() === email.toLowerCase());
  if (!match) {
    throw new Error(`Customer with email ${email} not found`);
  }

  return match.id;
}

function isExpired(date?: string) {
  if (!date) return false;
  return new Date(date).getTime() < Date.now();
}
