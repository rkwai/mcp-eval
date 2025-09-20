import express, { Request, Response } from 'express';
import {
  CampaignState,
  DomainResult,
  createLoreEntry,
  createNpc,
  createWorldItem,
  getWorldOverview,
  listItems,
  listLore,
  listNpcs,
} from '../../campaign/state';
import type { LoreInput, NpcInput, ItemInput } from '../../campaign/state';

export function registerWorldRoutes(app: express.Application, campaign: CampaignState) {
  const router = express.Router();

  router.get('/', (_req: Request, res: Response) => {
    res.json(getWorldOverview(campaign));
  });

  router.get('/lore', (_req: Request, res: Response) => {
    res.json({ lore: listLore(campaign) });
  });

  router.post('/lore', (req: Request<any, any, LoreInput>, res: Response) => {
    respondWithDomainResult(res, createLoreEntry(campaign, req.body));
  });

  router.get('/npcs', (_req: Request, res: Response) => {
    res.json({ npcs: listNpcs(campaign) });
  });

  router.post('/npcs', (req: Request<any, any, NpcInput>, res: Response) => {
    respondWithDomainResult(res, createNpc(campaign, req.body));
  });

  router.get('/items', (_req: Request, res: Response) => {
    res.json({ items: listItems(campaign) });
  });

  router.post('/items', (req: Request<any, any, ItemInput>, res: Response) => {
    respondWithDomainResult(res, createWorldItem(campaign, req.body));
  });

  app.use('/world', router);
}

function respondWithDomainResult<T>(res: Response, result: DomainResult<T>) {
  if (result.ok) {
    res.status(201).json(result.data);
  } else {
    res.status(result.status).json({ error: result.message });
  }
}
