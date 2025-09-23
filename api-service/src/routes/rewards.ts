import express, { Request, Response } from 'express';
import { store, Reward, generateId } from '../data/store';

interface CreateRewardRequest {
  name: string;
  description: string;
  cost: number;
  inventory?: number | null;
  active?: boolean;
  fulfillmentInstructions?: string;
}

interface UpdateRewardRequest {
  name?: string;
  description?: string;
  cost?: number;
  inventory?: number | null;
  active?: boolean;
  fulfillmentInstructions?: string;
}

export function registerRewardRoutes(app: express.Application) {
  const router = express.Router();

  router.get('/', (_req, res) => {
    const rewards = Array.from(store.rewards.values());
    res.json({ rewards });
  });

  router.post('/', (req: Request<unknown, unknown, CreateRewardRequest>, res: Response) => {
    const { name, description, cost, inventory = null, active = true, fulfillmentInstructions } = req.body ?? {};

    if (!name || !description) {
      return res.status(400).json({ error: 'name and description are required.' });
    }

    if (!Number.isFinite(cost) || cost <= 0) {
      return res.status(400).json({ error: 'cost must be a positive number.' });
    }

    if (inventory !== null && (!Number.isInteger(inventory) || inventory < 0)) {
      return res.status(400).json({ error: 'inventory must be a non-negative integer or null.' });
    }

    const reward: Reward = {
      id: generateId('reward'),
      name: name.trim(),
      description: description.trim(),
      cost: Math.round(cost),
      inventory,
      active,
      fulfillmentInstructions: fulfillmentInstructions?.trim() || undefined,
    };

    store.rewards.set(reward.id, reward);

    return res.status(201).json({ reward });
  });

  router.patch('/:rewardId', (req: Request<{ rewardId: string }, unknown, UpdateRewardRequest>, res: Response) => {
    const reward = store.rewards.get(req.params.rewardId);
    if (!reward) {
      return res.status(404).json({ error: 'Reward not found.' });
    }

    const updates = req.body ?? {};
    if (typeof updates.name === 'string' && updates.name.trim()) {
      reward.name = updates.name.trim();
    }
    if (typeof updates.description === 'string' && updates.description.trim()) {
      reward.description = updates.description.trim();
    }
    if (updates.cost !== undefined) {
      if (!Number.isFinite(updates.cost) || updates.cost <= 0) {
        return res.status(400).json({ error: 'cost must be a positive number.' });
      }
      reward.cost = Math.round(updates.cost);
    }
    if (updates.inventory !== undefined) {
      if (updates.inventory !== null && (!Number.isInteger(updates.inventory) || updates.inventory < 0)) {
        return res.status(400).json({ error: 'inventory must be a non-negative integer or null.' });
      }
      reward.inventory = updates.inventory ?? null;
    }
    if (typeof updates.active === 'boolean') {
      reward.active = updates.active;
    }
    if (typeof updates.fulfillmentInstructions === 'string') {
      reward.fulfillmentInstructions = updates.fulfillmentInstructions.trim() || undefined;
    }

    return res.json({ reward });
  });

  app.use('/rewards', router);
}
