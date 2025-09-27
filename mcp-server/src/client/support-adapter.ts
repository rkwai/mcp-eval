import {
  AssignOfferResponse,
  ClaimOfferResponse,
  CustomerDetailResponse,
  CustomerHistoryResponse,
  CustomerListResponse,
  CustomerOffersResponse,
  EarnPointsResponse,
  OffersResponse,
  RedeemRewardResponse,
  RewardCatalogResponse,
  UpdateRewardResponse,
} from '../types';
import { Transport, HttpResponse } from './transport';
import { createMockTransport } from './mock-transport';

export interface SupportAdapter {
  listCustomers(): Promise<CustomerListResponse>;
  getCustomer(customerId: string): Promise<CustomerDetailResponse>;
  getCustomerHistory(customerId: string): Promise<CustomerHistoryResponse>;
  earnPoints(
    customerId: string,
    payload: { points: number; source: string; channel?: string; metadata?: Record<string, unknown> },
  ): Promise<EarnPointsResponse>;
  redeemReward(
    customerId: string,
    payload: { rewardId: string; channel?: string; metadata?: Record<string, unknown> },
  ): Promise<RedeemRewardResponse>;
  listRewards(): Promise<RewardCatalogResponse>;
  updateReward(rewardId: string, payload: Record<string, unknown>): Promise<UpdateRewardResponse>;
  listOffers(): Promise<OffersResponse>;
  listCustomerOffers(
    customerId: string,
    options?: { includeExpired?: boolean },
  ): Promise<CustomerOffersResponse>;
  assignOffer(
    customerId: string,
    payload: { offerId: string; expiresAt?: string },
  ): Promise<AssignOfferResponse>;
  claimOffer(customerId: string, customerOfferId: string): Promise<ClaimOfferResponse>;
}

let activeAdapter: SupportAdapter | undefined;

export function buildSupportAdapter(transport: Transport): SupportAdapter {
  async function send<T>(request: Parameters<Transport>[0]): Promise<T> {
    const response: HttpResponse<T> = await transport<T>(request);
    return response.data;
  }

  return {
    listCustomers: () => send<CustomerListResponse>({ method: 'GET', url: '/customers' }),

    getCustomer: (customerId) => send<CustomerDetailResponse>({ method: 'GET', url: `/customers/${customerId}` }),

    getCustomerHistory: (customerId) =>
      send<CustomerHistoryResponse>({ method: 'GET', url: `/customers/${customerId}/history` }),

    earnPoints: (customerId, payload) =>
      send<EarnPointsResponse>({ method: 'POST', url: `/customers/${customerId}/earn`, body: payload }),

    redeemReward: (customerId, payload) =>
      send<RedeemRewardResponse>({ method: 'POST', url: `/customers/${customerId}/redeem`, body: payload }),

    listRewards: () => send<RewardCatalogResponse>({ method: 'GET', url: '/rewards' }),

    updateReward: (rewardId, payload) =>
      send<UpdateRewardResponse>({ method: 'PATCH', url: `/rewards/${rewardId}`, body: payload }),

    listOffers: () => send<OffersResponse>({ method: 'GET', url: '/offers' }),

    listCustomerOffers: (customerId) =>
      send<CustomerOffersResponse>({ method: 'GET', url: `/customers/${customerId}/offers` }),

    assignOffer: (customerId, payload) =>
      send<AssignOfferResponse>({ method: 'POST', url: `/customers/${customerId}/offers`, body: payload }),

    claimOffer: (customerId, customerOfferId) =>
      send<ClaimOfferResponse>({
        method: 'POST',
        url: `/customers/${customerId}/offers/${customerOfferId}/claim`,
        body: {},
      }),
  };
}

export function getSupportAdapter(): SupportAdapter {
  if (!activeAdapter) {
    activeAdapter = buildSupportAdapter(createMockTransport());
  }
  return activeAdapter;
}

export function setSupportAdapter(adapter: SupportAdapter): void {
  activeAdapter = adapter;
}

export function useMockSupportAdapter(): void {
  setSupportAdapter(buildSupportAdapter(createMockTransport()));
}

export function useTransport(transport: Transport): void {
  setSupportAdapter(buildSupportAdapter(transport));
}
