import {
  CustomerDetailResponse,
  CustomerHistoryResponse,
  CustomerOffer,
  EarnPointsResponse,
  LoyaltyActivity,
  Offer,
  RedeemRewardResponse,
  Reward,
  ClaimOfferResponse,
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

const customers = new Map<string, InternalCustomer>([
  [
    'cust-alicia',
    {
      id: 'cust-alicia',
      name: 'Alicia Patel',
      email: 'alicia.patel@example.com',
      phone: '555-0147',
      tier: 'gold',
      pointsBalance: 12850,
      lifetimePoints: 45200,
      preferences: { marketingOptIn: true, preferredChannel: 'sms' },
      joinedAt: isoDaysAgo(120),
      updatedAt: new Date().toISOString(),
    },
  ],
  [
    'cust-marcus',
    {
      id: 'cust-marcus',
      name: 'Marcus Lee',
      email: 'marcus.lee@example.com',
      phone: '555-0199',
      tier: 'silver',
      pointsBalance: 4200,
      lifetimePoints: 9200,
      preferences: { marketingOptIn: true, preferredChannel: 'email' },
      joinedAt: isoDaysAgo(200),
      updatedAt: new Date().toISOString(),
    },
  ],
  [
    'cust-jasmine',
    {
      id: 'cust-jasmine',
      name: 'Jasmine Ortiz',
      email: 'jasmine.ortiz@example.com',
      phone: undefined,
      tier: 'platinum',
      pointsBalance: 32000,
      lifetimePoints: 88000,
      preferences: { marketingOptIn: true, preferredChannel: 'push' },
      joinedAt: isoDaysAgo(300),
      updatedAt: new Date().toISOString(),
    },
  ],
]);

const activityStore = new Map<string, LoyaltyActivity[]>([
  [
    'cust-alicia',
    [
      buildActivity('cust-alicia', 'earn', 1200, 12850, 'In-store purchase', 3),
      buildActivity('cust-alicia', 'redeem', -750, 11650, 'Espresso upgrade', 7),
    ],
  ],
  [
    'cust-marcus',
    [
      buildActivity('cust-marcus', 'earn', 900, 4200, 'Mobile order', 5),
    ],
  ],
  [
    'cust-jasmine',
    [
      buildActivity('cust-jasmine', 'earn', 1800, 32000, 'Premium booking', 4),
    ],
  ],
]);

const rewards: Reward[] = [
  {
    id: 'reward-espresso',
    name: 'Complimentary Espresso Upgrade',
    description: 'Upgrade any beverage to include an extra espresso shot.',
    cost: 750,
    inventory: null,
    active: true,
    fulfillmentInstructions: 'Apply upgrade at point of sale; no additional charge.',
  },
  {
    id: 'reward-flight-upgrade',
    name: 'Priority Boarding Voucher',
    description: 'Skip the line and board early on your next flight.',
    cost: 5600,
    inventory: 120,
    active: true,
    fulfillmentInstructions: 'Present voucher at gate for verification.',
  },
  {
    id: 'reward-gift-card',
    name: '$25 Partner Gift Card',
    description: 'Redeemable at participating retail partners.',
    cost: 7800,
    inventory: 45,
    active: true,
    fulfillmentInstructions: 'Digital code sent via email within 24 hours.',
  },
];

const offers: Offer[] = [
  {
    id: 'offer-espresso-upgrade',
    name: 'Weekend Espresso Upgrade',
    description: 'Free espresso shot upgrade for elite customers this weekend.',
    rewardId: 'reward-espresso',
    startDate: new Date().toISOString(),
    endDate: isoDaysAhead(7),
    active: true,
    quantity: null,
  },
  {
    id: 'offer-priority-boarding',
    name: 'Priority Boarding Token',
    description: 'Limited boarding upgrades for recent high-value purchases.',
    rewardId: 'reward-flight-upgrade',
    startDate: new Date().toISOString(),
    endDate: isoDaysAhead(14),
    active: true,
    quantity: 50,
  },
];

const customerOfferStore = new Map<string, CustomerOffer[]>([
  [
    'cust-alicia',
    [
      {
        id: 'coffer-alicia-upgrade',
        offerId: 'offer-espresso-upgrade',
        customerId: 'cust-alicia',
        status: 'available',
        assignedAt: new Date().toISOString(),
        expiresAt: isoDaysAhead(7),
        offer: offers[0],
      },
    ],
  ],
]);

export async function lookupCustomer(args: LookupCustomerArgs) {
  const identifier = await resolveCustomerId(args);
  const profile = customers.get(identifier);
  if (!profile) {
    throw new Error('Customer not found');
  }

  const history = (activityStore.get(identifier) ?? []).sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
  const detail: CustomerDetailResponse = {
    ...profile,
    recentActivity: history.slice(0, 5),
  };

  let historyResponse: CustomerHistoryResponse['history'] = [];
  if (args.includeHistory) {
    const limit = args.historyLimit ?? history.length;
    historyResponse = history.slice(0, limit);
  }

  return {
    customer: detail,
    history: historyResponse,
  };
}

export async function activitySummary(args: ActivitySummaryArgs) {
  const history = (activityStore.get(args.customerId) ?? []).sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
  const records = args.limit ? history.slice(0, args.limit) : history;
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
  const customer = customers.get(args.customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }
  if (!Number.isFinite(args.points) || args.points <= 0) {
    throw new Error('points must be a positive number');
  }

  customer.pointsBalance += Math.round(args.points);
  customer.lifetimePoints += Math.round(args.points);
  customer.updatedAt = new Date().toISOString();

  const activity = pushActivity({
    customerId: customer.id,
    type: 'earn',
    points: Math.round(args.points),
    balanceAfter: customer.pointsBalance,
    source: `Goodwill - ${args.reason}`,
  });

  const response: EarnPointsResponse = {
    customer: {
      ...customer,
      recentActivity: (activityStore.get(customer.id) ?? []).slice(0, 5),
    },
    activity,
  };

  return response;
}

export async function redeemReward(args: RedeemRewardArgs) {
  const customer = customers.get(args.customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }

  const reward = rewards.find((entry) => entry.id === args.rewardId);
  if (!reward) {
    throw new Error('Reward not found');
  }

  customer.pointsBalance = Math.max(0, customer.pointsBalance - reward.cost);
  customer.updatedAt = new Date().toISOString();

  if (reward.inventory !== null) {
    reward.inventory = Math.max(0, reward.inventory - 1);
  }

  const activity = pushActivity({
    customerId: customer.id,
    type: 'redeem',
    points: -reward.cost,
    balanceAfter: customer.pointsBalance,
    source: reward.name,
  });

  const response: RedeemRewardResponse = {
    customer: {
      ...customer,
      recentActivity: (activityStore.get(customer.id) ?? []).slice(0, 5),
    },
    reward,
    activity,
  };

  return response;
}

export async function catalogSnapshot(args: CatalogSnapshotArgs = {}) {
  const filtered = rewards.filter((reward) => {
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
  const reward = rewards.find((entry) => entry.id === args.rewardId);
  if (!reward) {
    throw new Error('Reward not found');
  }

  if (reward.inventory !== null) {
    reward.inventory = Math.max(0, reward.inventory + Math.round(args.inventoryDelta));
  }
  if (typeof args.active === 'boolean') {
    reward.active = args.active;
  }

  return reward;
}

export async function offerCatalog(args: OfferCatalogArgs = {}) {
  const availableOffers = args.onlyActive
    ? offers.filter((offer) => offer.active && !isExpired(offer.endDate))
    : offers;
  return {
    offers: availableOffers,
    total: availableOffers.length,
  };
}

export async function customerOffers(args: CustomerOffersArgs) {
  const offersList = (customerOfferStore.get(args.customerId) ?? []).map((entry) => {
    const offer = offers.find((item) => item.id === entry.offerId);
    if (offer && entry.offer === undefined) {
      entry.offer = offer;
    }
    if (entry.status === 'available' && entry.expiresAt && isExpired(entry.expiresAt)) {
      entry.status = 'expired';
    }
    return entry;
  });

  const filtered = args.includeExpired ? offersList : offersList.filter((entry) => entry.status !== 'expired');

  return {
    offers: filtered,
    total: filtered.length,
  };
}

export async function assignOffer(args: AssignOfferArgs) {
  const offer = offers.find((entry) => entry.id === args.offerId);
  if (!offer) {
    throw new Error('Offer not found');
  }
  if (!offer.active) {
    throw new Error('Offer is not active');
  }
  if (offer.quantity !== null && offer.quantity <= 0) {
    throw new Error('Offer has no remaining quantity');
  }

  const entry: CustomerOffer = {
    id: generateId('coffer'),
    offerId: offer.id,
    customerId: args.customerId,
    status: 'available',
    assignedAt: new Date().toISOString(),
    expiresAt: args.expiresAt ?? offer.endDate,
    offer,
  };

  const list = customerOfferStore.get(args.customerId) ?? [];
  list.push(entry);
  customerOfferStore.set(args.customerId, list);

  return entry;
}

export async function claimOffer(args: ClaimOfferArgs) {
  const offersList = customerOfferStore.get(args.customerId) ?? [];
  const entry = offersList.find((item) => item.id === args.customerOfferId);
  if (!entry) {
    throw new Error('Customer offer not found');
  }
  if (entry.status === 'claimed') {
    throw new Error('Offer already claimed');
  }
  if (entry.status === 'expired') {
    throw new Error('Offer expired');
  }

  const offer = offers.find((item) => item.id === entry.offerId);
  if (!offer) {
    throw new Error('Offer definition missing');
  }
  if (!offer.active || (offer.endDate && isExpired(offer.endDate))) {
    entry.status = 'expired';
    throw new Error('Offer no longer active');
  }
  if (offer.quantity !== null) {
    offer.quantity = Math.max(0, offer.quantity - 1);
  }

  entry.status = 'claimed';
  entry.claimedAt = new Date().toISOString();

  const reward = rewards.find((item) => item.id === offer.rewardId);
  if (!reward) {
    throw new Error('Linked reward not found');
  }
  if (reward.inventory !== null) {
    reward.inventory = Math.max(0, reward.inventory - 1);
  }

  const customer = customers.get(args.customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }

  const activity = pushActivity({
    customerId: customer.id,
    type: 'redeem',
    points: 0,
    balanceAfter: customer.pointsBalance,
    source: `${offer.name} (offer claim)`,
  });

  const response: ClaimOfferResponse = {
    customer: {
      ...customer,
      recentActivity: (activityStore.get(customer.id) ?? []).slice(0, 5),
    },
    offer,
    customerOffer: entry,
    reward,
    activity,
  };

  return response;
}

async function resolveCustomerId({ customerId, email }: LookupCustomerArgs) {
  if (customerId) {
    if (!customers.has(customerId)) {
      throw new Error('Customer not found');
    }
    return customerId;
  }
  if (!email) {
    throw new Error('Provide either customerId or email');
  }

  const match = Array.from(customers.values()).find((customer) => customer.email.toLowerCase() === email.toLowerCase());
  if (!match) {
    throw new Error(`Customer with email ${email} not found`);
  }

  return match.id;
}

function pushActivity(entry: Omit<LoyaltyActivity, 'id' | 'occurredAt'> & { occurredAt?: string }) {
  const activity: LoyaltyActivity = {
    id: generateId('act'),
    occurredAt: entry.occurredAt ?? new Date().toISOString(),
    ...entry,
  };
  const list = activityStore.get(entry.customerId) ?? [];
  list.unshift(activity);
  activityStore.set(entry.customerId, list);
  return activity;
}

function buildActivity(
  customerId: string,
  type: 'earn' | 'redeem',
  points: number,
  balanceAfter: number,
  source: string,
  daysAgo: number,
): LoyaltyActivity {
  return {
    id: generateId('act'),
    customerId,
    type,
    points,
    balanceAfter,
    source,
    occurredAt: isoDaysAgo(daysAgo),
  };
}

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function isoDaysAhead(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function generateId(prefix: string) {
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}`;
}

type InternalCustomer = Omit<CustomerDetailResponse, 'recentActivity'>;

function isExpired(date?: string) {
  if (!date) return false;
  return new Date(date).getTime() < Date.now();
}
