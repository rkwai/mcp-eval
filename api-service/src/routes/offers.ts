import express, { Request, Response } from 'express';
import { store, Offer, generateId } from '../data/store';

interface CreateOfferRequest {
  name: string;
  description: string;
  rewardId: string;
  startDate?: string;
  endDate?: string;
  active?: boolean;
  quantity?: number | null;
}

interface UpdateOfferRequest {
  name?: string;
  description?: string;
  rewardId?: string;
  startDate?: string;
  endDate?: string;
  active?: boolean;
  quantity?: number | null;
}

export function registerOfferRoutes(app: express.Application) {
  const router = express.Router();

  router.get('/', (_req, res) => {
    res.json({ offers: Array.from(store.offers.values()) });
  });

  router.post('/', (req: Request<unknown, unknown, CreateOfferRequest>, res: Response) => {
    const { name, description, rewardId, startDate, endDate, active = true, quantity = null } = req.body ?? {};

    if (!name || !description || !rewardId) {
      return res.status(400).json({ error: 'name, description, and rewardId are required.' });
    }

    if (!store.rewards.get(rewardId)) {
      return res.status(404).json({ error: 'Reward not found.' });
    }

    if (quantity !== null && (!Number.isInteger(quantity) || quantity < 0)) {
      return res.status(400).json({ error: 'quantity must be a non-negative integer or null.' });
    }

    const offer: Offer = {
      id: generateId('offer'),
      name: name.trim(),
      description: description.trim(),
      rewardId,
      startDate: startDate ?? new Date().toISOString(),
      endDate,
      active,
      quantity,
    };

    store.offers.set(offer.id, offer);
    return res.status(201).json({ offer });
  });

  router.patch('/:offerId', (req: Request<{ offerId: string }, unknown, UpdateOfferRequest>, res: Response) => {
    const offer = store.offers.get(req.params.offerId);
    if (!offer) {
      return res.status(404).json({ error: 'Offer not found.' });
    }

    const updates = req.body ?? {};
    if (typeof updates.name === 'string' && updates.name.trim()) {
      offer.name = updates.name.trim();
    }
    if (typeof updates.description === 'string' && updates.description.trim()) {
      offer.description = updates.description.trim();
    }
    if (typeof updates.rewardId === 'string') {
      if (!store.rewards.get(updates.rewardId)) {
        return res.status(404).json({ error: 'Reward not found.' });
      }
      offer.rewardId = updates.rewardId;
    }
    if (typeof updates.startDate === 'string') {
      offer.startDate = updates.startDate;
    }
    if (typeof updates.endDate === 'string') {
      offer.endDate = updates.endDate;
    }
    if (typeof updates.active === 'boolean') {
      offer.active = updates.active;
    }
    if (updates.quantity !== undefined) {
      if (updates.quantity !== null && (!Number.isInteger(updates.quantity) || updates.quantity < 0)) {
        return res.status(400).json({ error: 'quantity must be a non-negative integer or null.' });
      }
      offer.quantity = updates.quantity ?? null;
    }

    return res.json({ offer });
  });

  app.use('/offers', router);
}
