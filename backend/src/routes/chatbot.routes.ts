import { Router, type RequestHandler } from 'express';
import { createLimiter } from '../utils/shared-rate-limit';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { requireAuth } from '../middleware/auth.middleware';
import { requirePermission } from '../policies/permission.policy';
import { validateBody, validateParams } from '../middleware/validate.middleware';
import { z } from 'zod';
import { sensitiveLimiter } from './account.routes';
import { sendSuccess } from '../utils/api-response';
import { AppError } from '../utils/app-error';
import { accountService } from '../services/account.service';
import { askChatbot, chatSettings } from '../services/chatbot.service';
import { messageSchema, settingsSchema, faqSchema } from '../services/chatbot-knowledge';
const handle = (fn: RequestHandler): RequestHandler => (req, res, next) => { Promise.resolve(fn(req,res,next)).catch(next); };
export const chatbotRouter = Router();
chatbotRouter.get('/availability', handle(async (_req,res) => { const s = await chatSettings(); return sendSuccess(res,200,'Assistant availability',{ enabled: s.enabled && Boolean(env.GROQ_API_KEY) }); }));
chatbotRouter.get('/faqs', handle(async (_req,res) => sendSuccess(res,200,'Approved school answers',await prisma.chatbotFaq.findMany({where:{published:true,validUntil:{gt:new Date()}},select:{id:true,question:true,answer:true,path:true,validUntil:true,updatedAt:true},orderBy:{updatedAt:'desc'},take:200}))));
chatbotRouter.post('/messages', createLimiter('chatbot', { windowMs: 60000, limit: 6, standardHeaders: 'draft-8', legacyHeaders: false, handler: (_req,res) => res.status(429).json({ success:false, message:'Please wait a minute before asking another question.', data:null, pagination:null }) }), validateBody(messageSchema), handle(async (req,res) => sendSuccess(res,200,'School guidance',await askChatbot(req.body.message))));
export const chatbotPlatformRouter = Router();
chatbotPlatformRouter.use(requireAuth, requirePermission('PLATFORM_MANAGE'));
chatbotPlatformRouter.get('/', handle(async (_req,res) => sendSuccess(res,200,'Chatbot configuration',{ ...await chatSettings(), configured:Boolean(env.GROQ_API_KEY), usage: await prisma.chatbotUsage.findUnique({ where:{ day:new Date().toISOString().slice(0,10) } }) })));
chatbotPlatformRouter.patch('/', sensitiveLimiter, validateBody(settingsSchema), handle(async (req,res) => {
  const { currentPassword, ...data } = req.body;
  await accountService.confirm(req.user!,currentPassword);
  if (data.enabled && !env.GROQ_API_KEY) throw new AppError(400,'Configure GROQ_API_KEY on the server before enabling the assistant.');
  const settings = await prisma.$transaction(async tx => {
    const saved = await tx.chatbotSettings.upsert({ where:{id:1}, create:{id:1,...data}, update:data });
    await tx.auditRecord.create({data:{actorId:req.user!.userId,action:'CHATBOT_SETTINGS_UPDATED',targetId:'1'}}); return saved;
  });
  return sendSuccess(res,200,'Chatbot settings saved',settings);
}));
export const chatbotFaqRouter = Router();
chatbotFaqRouter.use(requireAuth, requirePermission('SCHOOL_MANAGE'));
chatbotFaqRouter.get('/', handle(async (_req,res) => sendSuccess(res,200,'School answers',await prisma.chatbotFaq.findMany({orderBy:{updatedAt:'desc'},take:200}))));
chatbotFaqRouter.post('/', validateBody(faqSchema), handle(async (req,res) => {
  const {version:_version,...data}=req.body;
  const item=await prisma.$transaction(async tx=> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(742622)`;
    if(await tx.chatbotFaq.count()>=200) throw new AppError(400,'The answer library is limited to 200 entries. Remove an unused entry first.');
    const saved=await tx.chatbotFaq.create({data});
    await tx.auditRecord.create({data:{actorId:req.user!.userId,action:'CHATBOT_FAQ_CREATED',targetId:saved.id}}); return saved;
  });return sendSuccess(res,201,'Answer saved',item);
}));
chatbotFaqRouter.patch('/:id', validateParams(z.object({id:z.string().cuid()})), validateBody(faqSchema.extend({version:z.number().int().nonnegative()})), handle(async (req,res)=>{
  const {version,...data}=req.body;
  await prisma.$transaction(async tx=> {
    const result=await tx.chatbotFaq.updateMany({where:{id:req.params.id as string,version},data:{...data,version:{increment:1}}});
    if(result.count!==1) throw new AppError(409,'This answer changed. Reload before editing.');
    await tx.auditRecord.create({data:{actorId:req.user!.userId,action:'CHATBOT_FAQ_UPDATED',targetId:req.params.id as string}});
  });return sendSuccess(res,200,'Answer saved',null);
}));
chatbotFaqRouter.delete('/:id', validateParams(z.object({id:z.string().cuid()})), validateBody(z.object({version:z.number().int().nonnegative()}).strict()), handle(async(req,res)=>{
  await prisma.$transaction(async tx=> {
    const deleted=await tx.chatbotFaq.deleteMany({where:{id:req.params.id as string,version:req.body.version}});
    if(deleted.count!==1) throw new AppError(409,'This answer changed. Reload before deleting.');
    await tx.auditRecord.create({data:{actorId:req.user!.userId,action:'CHATBOT_FAQ_DELETED',targetId:req.params.id as string}});
  });return sendSuccess(res,200,'Answer removed',null);
}));
