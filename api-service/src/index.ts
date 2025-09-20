import express from 'express';
import { createCampaignState } from './campaign/state';
import { registerStoryRoutes } from './domains/story';
import { registerPlayerRoutes } from './domains/players';
import { registerWorldRoutes } from './domains/world';

const app = express();
app.use(express.json());

const campaignState = createCampaignState();

registerStoryRoutes(app, campaignState);
registerPlayerRoutes(app, campaignState);
registerWorldRoutes(app, campaignState);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

export function createServer() {
  return app;
}

if (require.main === module) {
  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    console.log(`API service listening on port ${port}`);
  });
}
