import {
  CustomerDetailResponse,
  LoyaltyActivity,
  Reward,
  Offer,
  CustomerOffer,
  ClaimOfferResponse,
} from '../types';

export const customers = new Map<string, CustomerDetailResponse>([
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

export const activityStore = new Map<string, LoyaltyActivity[]>([
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

export const rewards: Reward[] = [
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

export const offers: Offer[] = [
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

export const customerOfferStore = new Map<string, CustomerOffer[]>([
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

export function lookupCustomerById(id: string) {
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

export function pushActivity(entry: Omit<LoyaltyActivity, 'id' | 'occurredAt'> & { occurredAt?: string }) {
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

export function assignOfferToCustomer(customerId: string, offerId: string, expiresAt?: string) {
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

export function claimOfferForCustomer(customerId: string, customerOfferId: string): ClaimOfferResponse {
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
