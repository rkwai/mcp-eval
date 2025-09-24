import { HttpAdapter, HttpRequest, HttpResponse } from './api';
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
  LoyaltyActivity,
  Reward,
  Offer,
  CustomerOffer,
} from '../types';

const customers = new Map<string, CustomerDetailResponse>([
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
      recentActivity: [],
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
      recentActivity: [],
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
      recentActivity: [],
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

export const mockHttpAdapter: HttpAdapter = async <T>(request: HttpRequest): Promise<HttpResponse<T>> => {
  const { method, url, body } = request;

  if (method === 'GET' && url === '/customers') {
    const response: CustomerListResponse = {
      customers: Array.from(customers.values()).map(({ recentActivity, ...rest }) => rest),
    };
    return { status: 200, data: response as T };
  }

  if (method === 'POST' && url === '/customers') {
    const payload = body as Partial<CustomerDetailResponse> & { startingPoints?: number };
    if (!payload?.name || !payload.email) {
      return errorResponse('name and email are required.', 400);
    }
    const id = generateId('cust');
    const now = new Date().toISOString();
    const profile: CustomerDetailResponse = {
      id,
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      tier: payload.tier ?? 'bronze',
      pointsBalance: payload.startingPoints ?? 0,
      lifetimePoints: payload.startingPoints ?? 0,
      preferences: payload.preferences ?? { marketingOptIn: true, preferredChannel: 'email' },
      joinedAt: now,
      updatedAt: now,
      recentActivity: [],
    };
    customers.set(id, profile);
    return { status: 201, data: profile as unknown as T };
  }

  const customerIdMatch = url.match(/^\/customers\/([^/]+)/);
  if (customerIdMatch) {
    const customerId = customerIdMatch[1];
    const customer = lookupCustomerById(customerId);
    if (!customer) {
      return errorResponse('Customer not found.', 404);
    }

    if (method === 'GET' && url === `/customers/${customerId}`) {
      return { status: 200, data: customer as unknown as T };
    }

    if (method === 'PATCH' && url === `/customers/${customerId}`) {
      Object.assign(customer, body ?? {});
      customer.updatedAt = new Date().toISOString();
      return { status: 200, data: customer as unknown as T };
    }

    if (method === 'POST' && url === `/customers/${customerId}/earn`) {
      const payload = body as { points: number; source: string };
      const points = Math.round(payload.points ?? 0);
      customer.pointsBalance += points;
      customer.lifetimePoints += points;
      const activity = pushActivity({
        customerId,
        type: 'earn',
        points,
        balanceAfter: customer.pointsBalance,
        source: payload.source,
      });
      const response: EarnPointsResponse = {
        customer,
        activity,
      };
      return { status: 201, data: response as unknown as T };
    }

    if (method === 'POST' && url === `/customers/${customerId}/redeem`) {
      const payload = body as { rewardId: string };
      const reward = rewards.find((entry) => entry.id === payload.rewardId);
      if (!reward) {
        return errorResponse('Reward not found.', 404);
      }
      customer.pointsBalance = Math.max(0, customer.pointsBalance - reward.cost);
      if (reward.inventory !== null) {
        reward.inventory = Math.max(0, reward.inventory - 1);
      }
      const activity = pushActivity({
        customerId,
        type: 'redeem',
        points: -reward.cost,
        balanceAfter: customer.pointsBalance,
        source: reward.name,
      });
      const response: RedeemRewardResponse = {
        customer,
        reward,
        activity,
      };
      return { status: 201, data: response as unknown as T };
    }

    if (method === 'GET' && url === `/customers/${customerId}/history`) {
      const history: CustomerHistoryResponse = {
        history: activityStore.get(customerId) ?? [],
      };
      return { status: 200, data: history as unknown as T };
    }

    if (method === 'GET' && url === `/customers/${customerId}/offers`) {
      const offersResponse: CustomerOffersResponse = {
        offers: (customerOfferStore.get(customerId) ?? []).map((entry) => updateOfferStatus(entry)),
      };
      return { status: 200, data: offersResponse as unknown as T };
    }

    if (method === 'POST' && url === `/customers/${customerId}/offers`) {
      const payload = body as { offerId: string; expiresAt?: string };
      const entry = assignOfferToCustomer(customerId, payload.offerId, payload.expiresAt);
      const response: AssignOfferResponse = {
        customerOffer: entry,
      };
      return { status: 201, data: response as unknown as T };
    }

    const claimMatch = url.match(/^\/customers\/[^/]+\/offers\/([^/]+)\/claim$/);
    if (claimMatch && method === 'POST') {
      const customerOfferId = claimMatch[1];
      const response = claimOfferForCustomer(customerId, customerOfferId);
      return { status: 201, data: response as unknown as T };
    }
  }

  if (method === 'GET' && url === '/rewards') {
    const response: RewardCatalogResponse = {
      rewards,
    };
    return { status: 200, data: response as unknown as T };
  }

  if (method === 'PATCH' && url.startsWith('/rewards/')) {
    const rewardId = url.split('/')[2];
    const reward = rewards.find((entry) => entry.id === rewardId);
    if (!reward) {
      return errorResponse('Reward not found.', 404);
    }
    Object.assign(reward, body ?? {});
    const response: UpdateRewardResponse = {
      reward,
    };
    return { status: 200, data: response as unknown as T };
  }

  if (method === 'GET' && url === '/offers') {
    const response: OffersResponse = {
      offers,
    };
    return { status: 200, data: response as unknown as T };
  }

  return errorResponse(`Unhandled request ${method} ${url}`, 404);
};

function lookupCustomerById(id: string) {
  const customer = customers.get(id);
  if (!customer) return undefined;
  return {
    ...customer,
    recentActivity: activityStore.get(id)?.slice(0, 5) ?? [],
  };
}

export function lookupCustomerByEmail(email: string) {
  for (const customer of customers.values()) {
    if (customer.email.toLowerCase() === email.toLowerCase()) {
      return lookupCustomerById(customer.id);
    }
  }
  return undefined;
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

function assignOfferToCustomer(customerId: string, offerId: string, expiresAt?: string) {
  const offer = offers.find((entry) => entry.id === offerId);
  if (!offer) {
    throw new Error('Offer not found');
  }
  if (!offer.active) {
    throw new Error('Offer not active');
  }
  if (offer.quantity !== null && offer.quantity <= 0) {
    throw new Error('Offer has no remaining quantity');
  }

  const entry: CustomerOffer = {
    id: generateId('coffer'),
    offerId: offer.id,
    customerId,
    status: 'available',
    assignedAt: new Date().toISOString(),
    expiresAt: expiresAt ?? offer.endDate,
    offer,
  };

  const list = customerOfferStore.get(customerId) ?? [];
  list.push(entry);
  customerOfferStore.set(customerId, list);

  return entry;
}

function claimOfferForCustomer(customerId: string, customerOfferId: string): ClaimOfferResponse {
  const offersList = customerOfferStore.get(customerId) ?? [];
  const entry = offersList.find((offer) => offer.id === customerOfferId);
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
    throw new Error('Offer missing');
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
    throw new Error('Linked reward missing');
  }
  if (reward.inventory !== null) {
    reward.inventory = Math.max(0, reward.inventory - 1);
  }

  const customer = lookupCustomerById(customerId);
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

  return {
    customer,
    offer,
    customerOffer: entry,
    reward,
    activity,
  };
}

function updateOfferStatus(entry: CustomerOffer) {
  if (entry.status === 'available' && entry.expiresAt && isExpired(entry.expiresAt)) {
    entry.status = 'expired';
  }
  return entry;
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

function isExpired(date?: string) {
  if (!date) return false;
  return new Date(date).getTime() < Date.now();
}

function errorResponse(message: string, status: number): HttpResponse<never> {
  throw Object.assign(new Error(message), { status });
}
