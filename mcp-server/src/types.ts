export interface CustomerSummary {
  id: string;
  name: string;
  email: string;
  phone?: string;
  tier: string;
  pointsBalance: number;
  lifetimePoints: number;
  preferences: {
    marketingOptIn: boolean;
    preferredChannel: 'email' | 'sms' | 'push';
  };
  joinedAt: string;
  updatedAt: string;
  recentActivity: LoyaltyActivity[];
}

export interface LoyaltyActivity {
  id: string;
  customerId: string;
  type: 'earn' | 'redeem';
  points: number;
  balanceAfter: number;
  source: string;
  channel?: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

export interface CustomerListResponse {
  customers: Array<{
    id: string;
    name: string;
    email: string;
    tier: string;
    pointsBalance: number;
    lifetimePoints: number;
    updatedAt: string;
  }>;
}

export interface CustomerDetailResponse extends CustomerSummary {}

export interface CustomerHistoryResponse {
  history: LoyaltyActivity[];
}

export interface EarnPointsResponse {
  customer: CustomerSummary;
  activity: LoyaltyActivity;
}

export interface RedeemRewardResponse {
  customer: CustomerSummary;
  reward: Reward;
  activity: LoyaltyActivity;
}

export interface RewardCatalogResponse {
  rewards: Reward[];
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

export interface UpdateRewardResponse {
  reward: Reward;
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
  offer?: Offer;
}

export interface OffersResponse {
  offers: Offer[];
}

export interface CustomerOffersResponse {
  offers: CustomerOffer[];
}

export interface AssignOfferResponse {
  customerOffer: CustomerOffer;
}

export interface ClaimOfferResponse {
  customer: CustomerSummary;
  offer: Offer;
  customerOffer: CustomerOffer;
  reward: Reward;
  activity: LoyaltyActivity;
}
