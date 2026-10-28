import { aiKnowledgeRouter, publicKnowledgeRouter } from './routes/ai-knowledge.routes';
import { chatbotRouter, chatbotPlatformRouter, chatbotFaqRouter } from './routes/chatbot.routes';
import { accountRouter } from './routes/account.routes';
import { historyRouter, schoolLeadershipRouter, alumniLeadershipRouter } from './routes/about-content.routes';
import { platformRouter } from './routes/platform.routes';
import { readiness } from './controllers/health.controller';
import { adminRouter } from './routes/admin.routes';
import { membershipRouter } from './routes/membership.routes';
import { protectMutations } from './middleware/csrf.middleware';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { apiLimiter } from './middleware/rate-limit.middleware';
import { authRouter } from './routes/auth.routes';
import { alumniRouter } from './routes/alumni.routes';
import { eventsRouter } from './routes/events.routes';
import { postsRouter } from './routes/posts.routes';
import { requestsRouter } from './routes/requests.routes';
import { storiesRouter } from './routes/stories.routes';
import { sendSuccess } from './utils/api-response';
import { localMediaRoot, localAssetPath } from './services/local-media';
import { maintenanceRouter } from './routes/maintenance.routes';
import { galleryRouter, achievementsRouter } from './routes/showcase.routes';

export const app = express();

app.disable('x-powered-by');
if (env.TRUST_PROXY_HOPS > 0) app.set('trust proxy', env.TRUST_PROXY_HOPS);
app.use(helmet());
app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
// Authenticated responses must never be cached by the hosting API proxy.
app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use(apiLimiter);
app.use(protectMutations);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// Serve only processed, server-named WebP assets from the upload volume.
app.use('/api/media/images', (req, res, next) => {
  if (!['GET', 'HEAD'].includes(req.method) || !localAssetPath(req.path.slice(1))) return res.sendStatus(404);
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(localMediaRoot, { dotfiles: 'deny', index: false, maxAge: '1y', immutable: true, redirect: false }));

app.get('/api/health', (_request, response) => sendSuccess(response, 200, 'API is healthy', { status: 'ok' }));
app.get('/api/ready', readiness);
app.use('/api/cron', maintenanceRouter);
app.use('/api/chatbot/documents', publicKnowledgeRouter);
app.use('/api/admin/ai-knowledge', aiKnowledgeRouter);
app.use('/api/chatbot', chatbotRouter);
app.use('/api/super-admin/chatbot', chatbotPlatformRouter);
app.use('/api/admin/chatbot/faqs', chatbotFaqRouter);
app.use('/api/auth', authRouter);
app.use('/api/account', accountRouter);
app.use('/api/super-admin', platformRouter);
app.use('/api/admin', adminRouter);
app.use('/api/membership', membershipRouter);
app.use('/api/alumni', alumniRouter);
app.use('/api/posts', postsRouter);
app.use('/api/stories', storiesRouter);
app.use('/api/events', eventsRouter);
app.use('/api/history', historyRouter);
app.use('/api/gallery', galleryRouter);
app.use('/api/achievements', achievementsRouter);
app.use('/api/leadership/school', schoolLeadershipRouter);
app.use('/api/leadership/alumni', alumniLeadershipRouter);
app.use('/api/requests', requestsRouter);
app.use(notFoundHandler);
app.use(errorHandler);

// Vercel invokes the Express app directly; server.ts remains the local/Railway listener.
export default app;
