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
} from '../types';

import {
  customers,
  activityStore,
  rewards,
  offers,
  customerOfferStore,
  lookupCustomerById,
  lookupCustomerByEmail,
  pushActivity,
  claimOfferForCustomer,
  assignOfferToCustomer,
} from '../data/mock-store';

export const mockHttpAdapter: HttpAdapter = async <T>(request: HttpRequest): Promise<HttpResponse<T>> => {
  const { method, url, body } = request;

  // Simple routing based on path segments
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
    const id = `cust-${Math.random().toString(16).slice(2, 8)}`;
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
    return { status: 201, data: { ...profile } as T };
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
        offers: customerOfferStore.get(customerId) ?? [],
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

function errorResponse(message: string, status: number): HttpResponse<never> {
  throw Object.assign(new Error(message), { status });
}
