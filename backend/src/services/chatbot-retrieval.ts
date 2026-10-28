import { prisma } from '../config/prisma';
import { workflowSources, type ChatSource } from './chatbot-knowledge';
export function searchTerms(question: string) {
  const stop = new Set(['the','and','for','are','was','were','what','when','where','how','who','does','can','could','would','please','tell','about','with','this','that','from','have','your','school']);
  const terms = (question.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter(t => !stop.has(t));
  const aliases:Record<string,string>={register:'registration',activate:'activation',apply:'application',join:'membership',drill:'parade',cadet:'parade'};
  return [...new Set([...terms,...terms.flatMap(t=>aliases[t]?[aliases[t]]:[])])].slice(0,16);
}
export async function retrieveSources(question: string): Promise<ChatSource[]> {
 const terms = searchTerms(question);
 if (!terms.length) return [];
 const query = terms.join(' OR ');
 const [chunks,faqs,posts] = await Promise.all([
  prisma.$queryRaw<{ id:string; documentId:string; title:string; text:string; pageNumber:number; edition:number; ordering:number }[]>`
   SELECT c.id, c."documentId", d.title, c.text, c."pageNumber", c.edition, c.ordering
   FROM "AiKnowledgeChunk" c JOIN "AiKnowledgeDocument" d ON d.id=c."documentId"
   WHERE d."approvalStatus"='APPROVED' AND d."processingStatus" IN ('READY','NEEDS_REVIEW')
    AND d."securityReviewed"=true AND c.edition=d.edition
    AND to_tsvector('english',c.text) @@ websearch_to_tsquery('english',${query})
   ORDER BY ts_rank_cd(to_tsvector('english',c.text), websearch_to_tsquery('english',${query})) DESC, c.id LIMIT 8`,
  prisma.$queryRaw<{ id:string; question:string; answer:string }[]>`
   SELECT id, question, answer FROM "ChatbotFaq"
   WHERE published=true AND "validUntil">NOW()
    AND to_tsvector('english',question || ' ' || answer) @@ websearch_to_tsquery('english',${query})
   ORDER BY ts_rank_cd(to_tsvector('english',question || ' ' || answer),websearch_to_tsquery('english',${query})) DESC, id LIMIT 4`,
  prisma.post.findMany({ where: { isPublished: true, type: { in: ['EVENT','ANNOUNCEMENT','HISTORY','ACHIEVEMENT'] }, OR: terms.map(term => ({ OR: [{ title: { contains: term, mode: 'insensitive' as const } }, { content: { contains: term, mode: 'insensitive' as const } }] })) }, select: { id:true, title:true, content:true, type:true, eventDate:true, milestoneDate:true }, orderBy: { publishedAt:'desc' }, take:4 }),
 ]);
 const workflows = workflowSources.filter(s => terms.some(term => `${s.title} ${s.text}`.toLowerCase().includes(term)));
 return [...faqs.map(f => ({ id:f.id, title:f.question, text:f.answer, path:`/help/faqs#faq-${f.id}` })), ...chunks.map(c => ({ id:c.id, documentId:c.documentId, pageNumber:c.pageNumber, edition:c.edition, title:`${c.title} · page ${c.pageNumber} · edition ${c.edition}`, text:c.text, path:`/help/knowledge/${c.documentId}?page=${Math.floor(c.ordering/12)+1}#chunk-${c.id}` })), ...workflows, ...posts.map(p => ({ id:p.id, title:p.title, text:`${p.eventDate ? (p.eventDate > new Date() ? 'Upcoming event: ' : 'Historical event: ') + p.eventDate.toISOString() + '. ' : p.milestoneDate ? p.milestoneDate + '. ' : ''}${p.content.slice(0,1200)}`, path:p.type==='HISTORY'?'/about':p.type==='ACHIEVEMENT'?'/#excellence-heading':`/${p.type==='EVENT'?'events':'announcements'}/${p.id}` }))].slice(0,12);
}
