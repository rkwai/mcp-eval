import express, { Request, Response } from 'express';
import {
  CampaignState,
  DomainResult,
  completeQuest,
  getStoryOverview,
  listQuests,
  startQuest,
  updateQuest,
} from '../../campaign/state';
import type { QuestUpdateInput } from '../../campaign/state';

export function registerStoryRoutes(app: express.Application, campaign: CampaignState) {
  const router = express.Router();

  router.get('/', (_req: Request, res: Response) => {
    res.json(getStoryOverview(campaign));
  });

  router.get('/quests', (_req: Request, res: Response) => {
    res.json({ quests: listQuests(campaign) });
  });

  router.patch('/quests/:questId', (req: Request<{ questId: string }>, res: Response) => {
    const { questId } = req.params;
    const payload = (req.body as QuestUpdateInput) ?? {};

    respondWithDomainResult(res, updateQuest(campaign, questId, payload));
  });

  router.post('/quests/:questId/start', (req: Request<{ questId: string }>, res: Response) => {
    const { questId } = req.params;
    const { playerId } = req.body as { playerId?: string };

    respondWithDomainResult(res, startQuest(campaign, questId, playerId ?? ''));
  });

  router.post('/quests/:questId/complete', (req: Request<{ questId: string }>, res: Response) => {
    const { questId } = req.params;
    const { playerId, resolutionNote } = req.body as { playerId?: string; resolutionNote?: string };

    respondWithDomainResult(
      res,
      completeQuest(campaign, questId, playerId ?? '', resolutionNote),
    );
  });

  app.use('/story', router);
}

function respondWithDomainResult<T>(
  res: Response,
  result: DomainResult<T>,
): void {
  if (result.ok) {
    res.json(result.data);
  } else {
    res.status(result.status).json({ error: result.message });
  }
}
