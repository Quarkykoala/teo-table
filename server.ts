import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createProductionGeminiRunner,
  generateBlueprintInsights,
  generateGoDeeperPrompt,
  generateMovieCards,
  isGeminiConfigured,
  SlidingWindowRateLimiter,
} from './src/server/gemini.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const geminiRateLimiter = new SlidingWindowRateLimiter(20, 60_000);

function getClientKey(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]!.trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/api/gemini/status', (_req: Request, res: Response) => {
    res.json({ configured: isGeminiConfigured() });
  });

  // Rate limit all POST /api/gemini/* endpoints
  app.use('/api/gemini', (req: Request, res: Response, next) => {
    if (req.method !== 'POST') {
      next();
      return;
    }
    const verdict = geminiRateLimiter.check(getClientKey(req));
    if (!verdict.allowed) {
      res.setHeader('Retry-After', String(verdict.retryAfterSeconds));
      res.status(429).json({
        error: `Too many AI requests. Please wait ${verdict.retryAfterSeconds}s and try again.`,
      });
      return;
    }
    next();
  });

  // 1. Watch & Talk (Film / Series Debrief Generator)
  app.post('/api/gemini/movie-cards', async (req: Request, res: Response) => {
    const runner = createProductionGeminiRunner();
    const result = await generateMovieCards(req.body, runner);
    if (result.error) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(result.status).json(result.data);
  });

  // 2. Contextual "Go Deeper" Prompt
  app.post('/api/gemini/go-deeper', async (req: Request, res: Response) => {
    const runner = createProductionGeminiRunner();
    const result = await generateGoDeeperPrompt(req.body, runner);
    if (result.error) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(result.status).json(result.data);
  });

  // 3. Privacy-Preserving Blueprint Insights (Opt-in Required)
  app.post('/api/gemini/blueprint-insights', async (req: Request, res: Response) => {
    const runner = createProductionGeminiRunner();
    const result = await generateBlueprintInsights(req.body, runner);
    if (result.error) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(result.status).json(result.data);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TwoTable server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start TwoTable server:', err);
  process.exit(1);
});
