import express, { Request, Response } from 'express';
import {
  CampaignState,
  DomainResult,
  GrantItemInput,
  listPlayers,
  getPlayer,
  updatePlayerStats,
  StatsUpdateInput,
  grantItem,
  useItem,
  dropItem,
} from '../../campaign/state';

export function registerPlayerRoutes(app: express.Application, campaign: CampaignState) {
  const router = express.Router();

  router.get('/', (_req: Request, res: Response) => {
    res.json({ players: listPlayers(campaign) });
  });

  router.get('/:playerId', (req: Request<{ playerId: string }>, res: Response) => {
    respondWithDomainResult(res, getPlayer(campaign, req.params.playerId));
  });

  router.patch('/:playerId/stats', (req: Request<{ playerId: string }>, res: Response) => {
    const payload = req.body as StatsUpdateInput;
    respondWithDomainResult(res, updatePlayerStats(campaign, req.params.playerId, payload));
  });

  router.post('/:playerId/items', (req: Request<{ playerId: string }>, res: Response) => {
    const payload = req.body as GrantItemInput;
    respondWithDomainResult(res, grantItem(campaign, req.params.playerId, payload));
  });

  router.post('/:playerId/items/:itemId/use', (req: Request<{ playerId: string; itemId: string }>, res: Response) => {
    respondWithDomainResult(
      res,
      useItem(campaign, req.params.playerId, req.params.itemId),
    );
  });

  router.delete('/:playerId/items/:itemId', (req: Request<{ playerId: string; itemId: string }>, res: Response) => {
    respondWithDomainResult(
      res,
      dropItem(campaign, req.params.playerId, req.params.itemId),
    );
  });

  app.use('/players', router);
}

function respondWithDomainResult<T>(res: Response, result: DomainResult<T>): void {
  if (result.ok) {
    res.json(result.data);
  } else {
    res.status(result.status).json({ error: result.message });
  }
}
