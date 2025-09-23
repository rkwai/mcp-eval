import express, { Request, Response } from 'express';
import {
  store,
  getCustomerSummary,
  recordActivity,
  generateId,
  nextTier,
  assignOfferToCustomer,
  listCustomerOffers,
  claimCustomerOffer,
} from '../data/store';

interface CreateCustomerRequest {
  name: string;
  email: string;
  phone?: string;
  tier?: string;
  startingPoints?: number;
  marketingOptIn?: boolean;
  preferredChannel?: 'email' | 'sms' | 'push';
}

interface UpdateCustomerRequest {
  name?: string;
  email?: string;
  phone?: string;
  marketingOptIn?: boolean;
  preferredChannel?: 'email' | 'sms' | 'push';
}

interface EarnRequest {
  points: number;
  source: string;
  channel?: string;
  metadata?: Record<string, unknown>;
}

interface RedeemRequest {
  rewardId: string;
  channel?: string;
  metadata?: Record<string, unknown>;
}

interface AssignOfferRequest {
  offerId: string;
  expiresAt?: string;
}

export function registerCustomerRoutes(app: express.Application) {
  const router = express.Router();

  router.get('/', (_req, res) => {
    const customers = Array.from(store.customers.values()).map((customer) => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      tier: customer.tier,
      pointsBalance: customer.pointsBalance,
      lifetimePoints: customer.lifetimePoints,
      updatedAt: customer.updatedAt,
    }));

    res.json({ customers });
  });

  router.post('/', (req: Request<unknown, unknown, CreateCustomerRequest>, res: Response) => {
    const { name, email, phone, tier, startingPoints = 0, marketingOptIn = true, preferredChannel = 'email' } = req.body ?? {};

    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required.' });
    }

    const normalizedTier = validateTier(tier) ?? nextTier(startingPoints);
    const id = generateId('cust');
    const now = new Date().toISOString();

    const profile = {
      id,
      name,
      email,
      phone,
      tier: normalizedTier,
      pointsBalance: Math.max(0, Math.round(startingPoints)),
      lifetimePoints: Math.max(0, Math.round(startingPoints)),
      preferences: {
        marketingOptIn,
        preferredChannel,
      },
      joinedAt: now,
      updatedAt: now,
    };

    store.customers.set(id, profile);

    if (startingPoints > 0) {
      recordActivity({
        customerId: id,
        type: 'earn',
        points: startingPoints,
        balanceAfter: profile.pointsBalance,
        source: 'initial grant',
      });
    }

    return res.status(201).json(getCustomerSummary(profile));
  });

  router.get('/:customerId', (req, res) => {
    const customer = store.customers.get(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    res.json(getCustomerSummary(customer));
  });

  router.patch('/:customerId', (req: Request<{ customerId: string }, unknown, UpdateCustomerRequest>, res: Response) => {
    const customer = store.customers.get(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const updates = req.body ?? {};
    if (typeof updates.name === 'string' && updates.name.trim()) {
      customer.name = updates.name.trim();
    }
    if (typeof updates.email === 'string' && updates.email.trim()) {
      customer.email = updates.email.trim();
    }
    if (typeof updates.phone === 'string') {
      customer.phone = updates.phone.trim();
    }
    if (typeof updates.marketingOptIn === 'boolean') {
      customer.preferences.marketingOptIn = updates.marketingOptIn;
    }
    if (updates.preferredChannel) {
      customer.preferences.preferredChannel = updates.preferredChannel;
    }

    customer.updatedAt = new Date().toISOString();

    return res.json(getCustomerSummary(customer));
  });

  router.post('/:customerId/earn', (req: Request<{ customerId: string }, unknown, EarnRequest>, res: Response) => {
    const customer = store.customers.get(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const { points, source, channel, metadata } = req.body ?? {};
    const parsedPoints = Number(points);

    if (!Number.isFinite(parsedPoints) || parsedPoints <= 0) {
      return res.status(400).json({ error: 'points must be a positive number.' });
    }
    if (!source || !source.trim()) {
      return res.status(400).json({ error: 'source is required.' });
    }

    customer.pointsBalance += Math.round(parsedPoints);
    customer.lifetimePoints += Math.round(parsedPoints);
    customer.tier = nextTier(customer.lifetimePoints);
    customer.updatedAt = new Date().toISOString();

    const activity = recordActivity({
      customerId: customer.id,
      type: 'earn',
      points: Math.round(parsedPoints),
      balanceAfter: customer.pointsBalance,
      source: source.trim(),
      channel,
      metadata,
    });

    return res.status(201).json({
      customer: getCustomerSummary(customer),
      activity,
    });
  });

  router.post('/:customerId/redeem', (req: Request<{ customerId: string }, unknown, RedeemRequest>, res: Response) => {
    const customer = store.customers.get(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const { rewardId, channel, metadata } = req.body ?? {};
    if (!rewardId) {
      return res.status(400).json({ error: 'rewardId is required.' });
    }

    const reward = store.rewards.get(rewardId);
    if (!reward) {
      return res.status(404).json({ error: 'Reward not found.' });
    }

    if (!reward.active) {
      return res.status(409).json({ error: 'Reward is not currently active.' });
    }

    if (reward.inventory !== null && reward.inventory <= 0) {
      return res.status(409).json({ error: 'Reward is out of stock.' });
    }

    if (customer.pointsBalance < reward.cost) {
      return res.status(422).json({ error: 'Insufficient points to redeem this reward.' });
    }

    customer.pointsBalance -= reward.cost;
    customer.updatedAt = new Date().toISOString();

    if (reward.inventory !== null) {
      reward.inventory -= 1;
    }

    const activity = recordActivity({
      customerId: customer.id,
      type: 'redeem',
      points: -reward.cost,
      balanceAfter: customer.pointsBalance,
      source: reward.name,
      channel,
      metadata: {
        ...metadata,
        rewardId: reward.id,
      },
    });

    return res.status(201).json({
      customer: getCustomerSummary(customer),
      reward,
      activity,
    });
  });

  router.get('/:customerId/history', (req, res) => {
    const customer = store.customers.get(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const history = store.activities
      .filter((activity) => activity.customerId === customer.id)
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

    res.json({ history });
  });

  router.get('/:customerId/offers', (req, res) => {
    const customer = store.customers.get(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const offers = listCustomerOffers(customer.id).map((entry) => {
      const offer = store.offers.get(entry.offerId);
      return {
        ...entry,
        offer,
      };
    });

    res.json({ offers });
  });

  router.post('/:customerId/offers', (req: Request<{ customerId: string }, unknown, AssignOfferRequest>, res: Response) => {
    const customer = store.customers.get(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const { offerId, expiresAt } = req.body ?? {};
    if (!offerId) {
      return res.status(400).json({ error: 'offerId is required.' });
    }

    const offer = store.offers.get(offerId);
    if (!offer) {
      return res.status(404).json({ error: 'Offer not found.' });
    }

    if (!offer.active) {
      return res.status(409).json({ error: 'Offer is not active.' });
    }

    if (offer.quantity !== null && offer.quantity <= 0) {
      return res.status(409).json({ error: 'Offer has no remaining quantity.' });
    }

    const entry = assignOfferToCustomer(customer.id, offerId, expiresAt);

    return res.status(201).json({
      customerOffer: {
        ...entry,
        offer,
      },
    });
  });

  router.post('/:customerId/offers/:customerOfferId/claim', async (req, res) => {
    const customer = store.customers.get(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    try {
      const { entry, offer } = claimCustomerOffer(customer.id, req.params.customerOfferId);
      const reward = store.rewards.get(offer.rewardId);
      if (!reward) {
        return res.status(500).json({ error: 'Linked reward not found for this offer.' });
      }

      if (reward.inventory !== null) {
        reward.inventory = Math.max(0, reward.inventory - 1);
      }

      const activity = recordActivity({
        customerId: customer.id,
        type: 'redeem',
        points: 0,
        balanceAfter: customer.pointsBalance,
        source: `${offer.name} (offer claim)`,
        metadata: {
          offerId: offer.id,
          rewardId: reward.id,
        },
      });

      return res.status(201).json({
        customer: getCustomerSummary(customer),
        offer,
        customerOffer: entry,
        reward,
        activity,
      });
    } catch (error) {
      return res.status(400).json({ error: (error as Error).message });
    }
  });

  app.use('/customers', router);
}

function validateTier(value?: string) {
  if (!value) return undefined;
  const candidate = value.toLowerCase();
  if (candidate === 'bronze' || candidate === 'silver' || candidate === 'gold' || candidate === 'platinum') {
    return candidate;
  }
  return undefined;
}
