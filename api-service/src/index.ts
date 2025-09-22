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
  const port = Number(process.env.PORT) || 4000;
  const host = process.env.HOST || '127.0.0.1';
  const server = app.listen(port, host, () => {
    console.log(`API service listening on http://${host}:${port}`);
  });

  server.on('error', (error) => {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EPERM' || code === 'EACCES') {
      console.warn(
        `API service could not bind to http://${host}:${port} due to permissions. ` +
          'Set HOST/PORT to permitted values or run outside the restricted sandbox.',
      );
      process.exit(0);
      return;
    }

    console.error(error);
    process.exit(1);
  });
}
