import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

// Placeholder data sources can be wired to real systems as the API evolves.

type MetricsRequest = {
  scenarioId: string;
  from?: string;
  to?: string;
};

type ReportRequest = {
  runId: string;
  audience: 'internal' | 'customer';
};

type ArtifactRequest = {
  runId: string;
  artifactType: 'regression' | 'summary';
  payload: unknown;
};

app.post('/metrics/fetch', (req: Request<unknown, unknown, MetricsRequest>, res: Response) => {
  const { scenarioId } = req.body;
  if (!scenarioId) {
    return res.status(400).json({ error: 'scenarioId is required' });
  }

  // TODO: Integrate with eval log reader to compute metrics per scenario.
  return res.json({
    scenarioId,
    stats: {
      passRate: 1.0,
      meanLatencyMs: 320,
      toolMismatches: 0,
    },
  });
});

app.post('/reports/summarise', (req: Request<unknown, unknown, ReportRequest>, res: Response) => {
  const { runId, audience } = req.body;
  if (!runId) {
    return res.status(400).json({ error: 'runId is required' });
  }

  // TODO: Pull run metadata + golden expectations to compose a summary.
  return res.json({
    runId,
    audience,
    summary: `Run ${runId} completed. No regressions detected.`,
  });
});

app.post('/artifacts/upload', (req: Request<unknown, unknown, ArtifactRequest>, res: Response) => {
  const { runId, artifactType } = req.body;
  if (!runId || !artifactType) {
    return res.status(400).json({ error: 'runId and artifactType are required' });
  }

  // TODO: Persist artifact to storage (S3, filesystem, etc.).
  return res.status(202).json({
    runId,
    artifactType,
    status: 'accepted',
  });
});

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
