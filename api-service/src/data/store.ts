import { randomUUID } from 'crypto';

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type ActivityType = 'earn' | 'redeem';

export interface CustomerPreferences {
  marketingOptIn: boolean;
  preferredChannel: 'email' | 'sms' | 'push';
}

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  tier: LoyaltyTier;
  pointsBalance: number;
  lifetimePoints: number;
  preferences: CustomerPreferences;
  joinedAt: string;
  updatedAt: string;
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  cost: number;
  inventory: number | null;
  active: boolean;
  fulfillmentInstructions?: string;
}

export interface LoyaltyActivity {
  id: string;
  customerId: string;
  type: ActivityType;
  points: number;
  balanceAfter: number;
  source: string;
  channel?: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

export interface Offer {
  id: string;
  name: string;
  description: string;
  rewardId: string;
  startDate: string;
  endDate?: string;
  active: boolean;
  quantity: number | null;
}

export type CustomerOfferStatus = 'available' | 'claimed' | 'expired';

export interface CustomerOffer {
  id: string;
  offerId: string;
  customerId: string;
  status: CustomerOfferStatus;
  assignedAt: string;
  expiresAt?: string;
  claimedAt?: string;
}

export interface LoyaltyStore {
  customers: Map<string, CustomerProfile>;
  rewards: Map<string, Reward>;
  offers: Map<string, Offer>;
  customerOffers: Map<string, CustomerOffer[]>;
  activities: LoyaltyActivity[];
}

const marketingChannels: Array<CustomerPreferences['preferredChannel']> = ['email', 'sms', 'push'];
const tiers: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum'];

export const store: LoyaltyStore = seedStore();

export function getCustomerSummary(customer: CustomerProfile) {
  const history = store.activities
    .filter((activity) => activity.customerId === customer.id)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 10);

  return {
    ...customer,
    recentActivity: history,
  };
}

export function recordActivity(activity: Omit<LoyaltyActivity, 'id' | 'occurredAt'> & { occurredAt?: string }) {
  const entry: LoyaltyActivity = {
    id: `act-${randomUUID().slice(0, 8)}`,
    occurredAt: activity.occurredAt ?? new Date().toISOString(),
    ...activity,
  };
  store.activities.push(entry);
  return entry;
}

export function assignOfferToCustomer(customerId: string, offerId: string, expiresAt?: string) {
  const offer = store.offers.get(offerId);
  if (!offer) {
    throw new Error('Offer not found.');
  }

  const now = new Date();
  const expiry = expiresAt ?? offer.endDate ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const status: CustomerOfferStatus = isExpired(expiry) || !offer.active ? 'expired' : 'available';

  const entry: CustomerOffer = {
    id: generateId('coffer'),
    offerId,
    customerId,
    status,
    assignedAt: now.toISOString(),
    expiresAt: expiry,
  };

  const list = store.customerOffers.get(customerId) ?? [];
  list.push(entry);
  store.customerOffers.set(customerId, list);

  return entry;
}

export function listCustomerOffers(customerId: string) {
  const offers = store.customerOffers.get(customerId) ?? [];
  offers.forEach((customerOffer) => {
    if (customerOffer.status === 'available' && customerOffer.expiresAt && isExpired(customerOffer.expiresAt)) {
      customerOffer.status = 'expired';
    }
  });
  return offers;
}

export function claimCustomerOffer(customerId: string, customerOfferId: string) {
  const offers = store.customerOffers.get(customerId);
  if (!offers) {
    throw new Error('Customer has no offers.');
  }

  const entry = offers.find((customerOffer) => customerOffer.id === customerOfferId);
  if (!entry) {
    throw new Error('Customer offer not found.');
  }

  if (entry.status === 'claimed') {
    throw new Error('Offer already claimed.');
  }

  if (entry.status === 'expired') {
    throw new Error('Offer expired.');
  }

  const offer = store.offers.get(entry.offerId);
  if (!offer) {
    throw new Error('Offer definition missing.');
  }

  if (!offer.active || (offer.endDate && isExpired(offer.endDate))) {
    entry.status = 'expired';
    throw new Error('Offer no longer active.');
  }

  if (offer.quantity !== null && offer.quantity <= 0) {
    throw new Error('Offer has no remaining quantity.');
  }

  if (offer.quantity !== null) {
    offer.quantity -= 1;
  }

  entry.status = 'claimed';
  entry.claimedAt = new Date().toISOString();

  return { entry, offer };
}

function seedStore(): LoyaltyStore {
  const customers = new Map<string, CustomerProfile>();
  const rewards = new Map<string, Reward>();
  const offers = new Map<string, Offer>();
  const customerOffers = new Map<string, CustomerOffer[]>();
  const activities: LoyaltyActivity[] = [];

  const sampleCustomers = [
    buildCustomer('Alicia Patel', 'alicia.patel@example.com', '555-0147', 'gold', 12850, 45200, 'sms'),
    buildCustomer('Marcus Lee', 'marcus.lee@example.com', '555-0199', 'silver', 4200, 9200, 'email'),
    buildCustomer('Jasmine Ortiz', 'jasmine.ortiz@example.com', undefined, 'platinum', 32000, 88000, 'push'),
  ];

  sampleCustomers.forEach((customer) => {
    customers.set(customer.id, customer);
  });

  const sampleRewards: Reward[] = [
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

  sampleRewards.forEach((reward) => {
    rewards.set(reward.id, reward);
  });

  sampleCustomers.forEach((customer, idx) => {
    const baseDate = new Date();
    const adjustments: Array<{ type: ActivityType; points: number; label: string; daysAgo: number }> = [
      { type: 'earn', points: 1200, label: 'in-store purchase', daysAgo: 3 + idx },
      { type: 'earn', points: 900, label: 'mobile order', daysAgo: 8 + idx },
      { type: 'redeem', points: 750, label: 'espresso upgrade', daysAgo: 15 + idx },
    ];

    let balance = customer.pointsBalance;
    adjustments.forEach((activity) => {
      const occurredAt = new Date(baseDate.getTime() - activity.daysAgo * 24 * 60 * 60 * 1000).toISOString();
      if (activity.type === 'redeem') {
        balance += -activity.points;
      } else {
        balance += activity.points;
      }
      activities.push({
        id: `act-${randomUUID().slice(0, 8)}`,
        customerId: customer.id,
        type: activity.type,
        points: activity.type === 'earn' ? activity.points : -activity.points,
        balanceAfter: balance,
        source: activity.label,
        occurredAt,
      });
    });
  });

  const sampleOffers: Offer[] = [
    {
      id: 'offer-espresso-upgrade',
      name: 'Weekend Espresso Upgrade',
      description: 'Free espresso shot upgrade for elite customers this weekend.',
      rewardId: 'reward-espresso',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      active: true,
      quantity: null,
    },
    {
      id: 'offer-priority-boarding',
      name: 'Priority Boarding Token',
      description: 'Limited boarding upgrades for recent high-value purchases.',
      rewardId: 'reward-flight-upgrade',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      active: true,
      quantity: 50,
    },
  ];

  sampleOffers.forEach((offer) => {
    offers.set(offer.id, offer);
  });

  // Assign first offer to Alicia and Marcus
  const alicia = sampleCustomers[0];
  const marcus = sampleCustomers[1];
  if (alicia) {
    const list = customerOffers.get(alicia.id) ?? [];
    list.push({
      id: 'coffer-alicia-upgrade',
      offerId: 'offer-espresso-upgrade',
      customerId: alicia.id,
      status: 'available',
      assignedAt: new Date().toISOString(),
      expiresAt: sampleOffers[0].endDate,
    });
    customerOffers.set(alicia.id, list);
  }

  if (marcus) {
    const list = customerOffers.get(marcus.id) ?? [];
    list.push({
      id: 'coffer-marcus-boarding',
      offerId: 'offer-priority-boarding',
      customerId: marcus.id,
      status: 'available',
      assignedAt: new Date().toISOString(),
      expiresAt: sampleOffers[1].endDate,
    });
    customerOffers.set(marcus.id, list);
  }

  return { customers, rewards, offers, customerOffers, activities };
}

function buildCustomer(
  name: string,
  email: string,
  phone: string | undefined,
  tier: LoyaltyTier,
  pointsBalance: number,
  lifetimePoints: number,
  preferredChannel: CustomerPreferences['preferredChannel'],
): CustomerProfile {
  const id = `cust-${randomUUID().slice(0, 8)}`;
  const now = new Date();
  return {
    id,
    name,
    email,
    phone,
    tier,
    pointsBalance,
    lifetimePoints,
    preferences: {
      marketingOptIn: true,
      preferredChannel,
    },
    joinedAt: new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function generateId(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export function nextTier(points: number): LoyaltyTier {
  if (points >= 20000) return 'platinum';
  if (points >= 10000) return 'gold';
  if (points >= 5000) return 'silver';
  return 'bronze';
}

export function randomChannel() {
  return marketingChannels[Math.floor(Math.random() * marketingChannels.length)];
}

export function allTiers() {
  return [...tiers];
}

function isExpired(date?: string) {
  if (!date) return false;
  return new Date(date).getTime() < Date.now();
}
