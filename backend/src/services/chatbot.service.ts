import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { defaultGroqModel, supportedGroqModels } from '../config/ai';
import { AppError } from '../utils/app-error';
import { z } from 'zod';
import { retrieveSources } from './chatbot-retrieval';
import { generateSchoolAnswer, providerMessages } from './groq-provider';
import { selectedSources, sensitiveMessage } from './chatbot-knowledge';
export interface ChatSettings { enabled:boolean; model:string; dailyRequests:number; dailyBudgetMicros:number; outputTokenLimit:number }
function environmentEnabled() { return env.AI_CHAT_ENABLED !== false; }
export const defaultChatSettings: ChatSettings = { enabled: false, model: env.GROQ_MODEL ?? defaultGroqModel, dailyRequests: 100, dailyBudgetMicros: 1000000, outputTokenLimit: 1024 };
export async function chatSettings() { return await prisma.chatbotSettings.findUnique({ where: { id: 1 } }) ?? defaultChatSettings; }
export async function reserveUsage(settings: typeof defaultChatSettings, amount: number) {
  const day = new Date().toISOString().slice(0, 10);
  await prisma.$transaction(async tx => {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    await tx.chatbotUsage.deleteMany({ where: { day: { lt: cutoff } } });
    await tx.chatbotUsage.upsert({ where: { day }, create: { day }, update: {} });
    const changed = await tx.chatbotUsage.updateMany({ where: { day, requests: { lt: settings.dailyRequests }, reservedMicros: { lte: settings.dailyBudgetMicros - amount } }, data: { requests: { increment: 1 }, reservedMicros: { increment: amount } } });
    if (changed.count !== 1) throw new AppError(429, 'The assistant has reached its daily usage allowance. Please use Help or try tomorrow.');
  });
}
export async function askChatbot(message: string) {
  const settings = await chatSettings();
  if (!environmentEnabled() || !settings.enabled || !env.GROQ_API_KEY) throw new AppError(503, 'The assistant is currently unavailable. Please use Help or Contact.');
  if (sensitiveMessage(message)) throw new AppError(400, 'Please remove personal details, links and private credentials. Ask a general question instead.');
  const sources = await retrieveSources(message);
  const unknown = { answer: 'I do not have confirmed information to answer that question. Please contact the school.', sources: [] as { title:string; path:string; documentId?:string; pageNumber?:number; edition?:number }[] };
  if (!sources.length) return unknown;
  const messages = providerMessages(message,sources);
  const inputBound = Buffer.byteLength(JSON.stringify(messages),'utf8') + 512;
  const large = settings.model === supportedGroqModels[1];
  const outputLimit = settings.outputTokenLimit ?? 1024;
  await reserveUsage(settings,Math.ceil(inputBound*(large?0.15:0.075)+outputLimit*(large?0.60:0.30)));
  let parsed: { answer?:string; ids:string[] };
  try {
    parsed = z.object({ answer:z.string().max(3500).optional(), ids:z.array(z.string()).max(3) }).strict().parse(JSON.parse(await generateSchoolAnswer(settings.model,outputLimit,messages)));
  } catch(error) {
    if(error instanceof AppError) throw error;
    throw new AppError(503,'The assistant returned an invalid response. Please retry or use Help.');
  }
  if (!parsed.ids.length) return unknown;
  if (parsed.ids.some(id=>!sources.some(s=>s.id===id))) return unknown;
  const chosen = selectedSources(JSON.stringify({ids:parsed.ids}),sources);
  const current = await retrieveSources(message);
  if (!chosen.every(s=>current.some(c=>c.id===s.id && c.text===s.text && c.title===s.title && c.path===s.path))) return unknown;
  if (!(await chatSettings()).enabled || !environmentEnabled()) throw new AppError(503,'The assistant is currently unavailable.');
  const answer = parsed.answer?.trim() || chosen.map(s=>s.text).join('\n\n');
  // Never accept provider-generated links; only server-owned citation paths reach the UI.
  if (/https?:\/\/|www\.|<[^>]+>/i.test(answer)) return unknown;
  return { answer, sources:chosen.map(({title,path,documentId,pageNumber,edition})=>({title,path,...(documentId?{documentId,pageNumber,edition}:{})})) };
}
