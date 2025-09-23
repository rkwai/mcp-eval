import {
  getJson,
  postJson,
  patchJson,
} from '../client/api';
import {
  CustomerDetailResponse,
  CustomerHistoryResponse,
  CustomerListResponse,
  EarnPointsResponse,
  RedeemRewardResponse,
  Reward,
  RewardCatalogResponse,
  UpdateRewardResponse,
  OffersResponse,
  CustomerOffersResponse,
  AssignOfferResponse,
  ClaimOfferResponse,
  Offer,
  CustomerOffer,
} from '../types';

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
  const customer = await getJson<CustomerDetailResponse>(`/customers/${identifier}`);

  let history = [] as CustomerHistoryResponse['history'];
  if (args.includeHistory) {
    const response = await getJson<CustomerHistoryResponse>(`/customers/${identifier}/history`);
    history = args.historyLimit
      ? response.history.slice(0, args.historyLimit)
      : response.history;
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

  const historyResponse = await getJson<CustomerHistoryResponse>(`/customers/${args.customerId}/history`);
  const records = args.limit ? historyResponse.history.slice(0, args.limit) : historyResponse.history;
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

  return postJson<EarnPointsResponse>(`/customers/${args.customerId}/earn`, {
    points: Math.round(args.points),
    source: `Goodwill - ${args.reason.trim()}`,
    channel: args.channel,
    metadata: {
      reason: args.reason.trim(),
      issuedBy: 'support',
    },
  });
}

export async function redeemReward(args: RedeemRewardArgs) {
  if (!args.customerId) {
    throw new Error('customerId is required');
  }
  if (!args.rewardId) {
    throw new Error('rewardId is required');
  }

  return postJson<RedeemRewardResponse>(`/customers/${args.customerId}/redeem`, {
    rewardId: args.rewardId,
    channel: args.channel,
    metadata: args.note ? { note: args.note } : undefined,
  });
}

export async function catalogSnapshot(args: CatalogSnapshotArgs = {}) {
  const catalog = await getJson<RewardCatalogResponse>('/rewards');
  const filtered = catalog.rewards.filter((reward) => {
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

  const reward = await getReward(args.rewardId);
  const newInventory = reward.inventory === null
    ? null
    : Math.max(0, reward.inventory + Math.round(args.inventoryDelta));

  const payload: Record<string, unknown> = {};
  if (newInventory !== null) {
    payload.inventory = newInventory;
  }
  if (typeof args.active === 'boolean') {
    payload.active = args.active;
  }

  const response = await patchJson<UpdateRewardResponse>(`/rewards/${args.rewardId}`, payload);
  return response.reward;
}

export async function offerCatalog(args: OfferCatalogArgs = {}) {
  const response = await getJson<OffersResponse>('/offers');
  const offers = args.onlyActive
    ? response.offers.filter((offer) => offer.active && !isExpired(offer.endDate))
    : response.offers;

  return {
    offers,
    total: offers.length,
  };
}

export async function customerOffers(args: CustomerOffersArgs) {
  if (!args.customerId) {
    throw new Error('customerId is required');
  }

  const response = await getJson<CustomerOffersResponse>(`/customers/${args.customerId}/offers`);
  const offers = args.includeExpired
    ? response.offers
    : response.offers.filter((entry) => entry.status !== 'expired');

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

  const response = await postJson<AssignOfferResponse>(`/customers/${args.customerId}/offers`, {
    offerId: args.offerId,
    expiresAt: args.expiresAt,
  });

  return response.customerOffer;
}

export async function claimOffer(args: ClaimOfferArgs) {
  if (!args.customerId) {
    throw new Error('customerId is required');
  }
  if (!args.customerOfferId) {
    throw new Error('customerOfferId is required');
  }

  return postJson<ClaimOfferResponse>(
    `/customers/${args.customerId}/offers/${args.customerOfferId}/claim`,
    {},
  );
}

async function resolveCustomerId({ customerId, email }: LookupCustomerArgs) {
  if (customerId) {
    return customerId;
  }
  if (!email) {
    throw new Error('Provide either customerId or email');
  }

  const list = await getJson<CustomerListResponse>('/customers');
  const match = list.customers.find((customer) => customer.email.toLowerCase() === email.toLowerCase());
  if (!match) {
    throw new Error(`Customer with email ${email} not found`);
  }

  return match.id;
}

async function getReward(rewardId: string): Promise<Reward> {
  const catalog = await getJson<RewardCatalogResponse>('/rewards');
  const reward = catalog.rewards.find((entry) => entry.id === rewardId);
  if (!reward) {
    throw new Error(`Reward ${rewardId} not found`);
  }
  return reward;
}

function isExpired(date?: string) {
  if (!date) return false;
  return new Date(date).getTime() < Date.now();
}
