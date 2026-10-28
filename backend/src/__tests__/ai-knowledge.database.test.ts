import { beforeAll,afterAll,describe,it,expect,vi } from 'vitest';
import { PrismaClient, type ChatbotSettings } from '@prisma/client';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { makePdf } from './fixtures/pdf';
const provider=vi.hoisted(()=>({generate:vi.fn()}));
vi.mock('../services/groq-provider',async original=>({...await original<typeof import('../services/groq-provider')>(),generateSchoolAnswer:provider.generate}));
const url=process.env.PHASE1_TEST_DATABASE_URL;
if(url){const parsed=new URL(url);if(!['127.0.0.1','localhost'].includes(parsed.hostname)||parsed.pathname!='/gda_phase1_test')throw new Error('An isolated local test database is required');process.env.DATABASE_URL=url;}
vi.setConfig({hookTimeout:60000,testTimeout:60000});
describe.skipIf(!url)('private PDF library, approvals and PostgreSQL RAG',()=>{
 let db:PrismaClient,app:typeof import('../app.js').app,retrieve:typeof import('../services/chatbot-retrieval.js').retrieveSources,ask:typeof import('../services/chatbot.service.js').askChatbot,env:typeof import('../config/env.js').env;
 const tag=`knowledge-${Date.now()}`,ids:string[]=[],cookies:Record<string,string>={};let documentId='',replacementId='',oldKey:string|undefined,oldSettings:ChatbotSettings|null=null;
 const pdf=makePdf(['The falconparade archive records a verified school cadet parade achievement for the public library.','The quasaracademic archive records a verified academic achievement for the public school library.']);
 const upload=(bytes=pdf,name='history.pdf',mime='application/pdf')=>request(app).post('/api/admin/ai-knowledge').set('Cookie',cookies.ADMIN).set('X-GDA-CSRF','1').field('title',`${tag} School archives`).field('description','Synthetic public school fixture').field('category','School History').attach('document',bytes,{filename:name,contentType:mime});
 const detail=async(id=documentId)=>(await request(app).get(`/api/admin/ai-knowledge/${id}`).set('Cookie',cookies.ADMIN)).body.data;
 const review=async(id:string,decision:string,extra={})=>request(app).post(`/api/admin/ai-knowledge/${id}/review`).set('Cookie',cookies.ADMIN).set('X-GDA-CSRF','1').send({version:(await detail(id)).version,decision,...extra});
 beforeAll(async()=>{
  db=new PrismaClient({datasourceUrl:url});({app}=await import('../app.js'));({env}=await import('../config/env.js'));oldKey=env.GROQ_API_KEY;env.GROQ_API_KEY='synthetic-provider-key';({retrieveSources:retrieve}=await import('../services/chatbot-retrieval.js'));({askChatbot:ask}=await import('../services/chatbot.service.js'));
  oldSettings=await db.chatbotSettings.findUnique({where:{id:1}});await db.chatbotSettings.upsert({where:{id:1},create:{id:1,enabled:true},update:{enabled:true}});
  const {signToken}=await import('../utils/jwt.js');
  for(const role of ['ADMIN','SUPER_ADMIN','ALUMNI','STUDENT'] as const){const user=await db.user.create({data:{email:`${role}-${tag}@example.test`,password:await bcrypt.hash('KnowledgeTestPassword123!',4),role,...(role==='ALUMNI'?{membershipApplication:{create:{email:`member-${tag}@example.test`,reference:tag,trackingHash:'isolated-fixture',fullName:'Test alumni',phone:'123456789',graduationYear:2005,status:'APPROVED',activatedAt:new Date()}}}:{})}});ids.push(user.id);cookies[role]=`gray_d_allison_token=${signToken({userId:user.id,role})}`;}
 });
 afterAll(async()=>{env.GROQ_API_KEY=oldKey;await db.aiKnowledgeDocument.deleteMany({where:{uploadedBy:{in:ids}}});await db.chatbotFaq.deleteMany({where:{question:{startsWith:tag}}});await db.post.deleteMany({where:{createdBy:{in:ids}}});await db.auditRecord.deleteMany({where:{actorId:{in:ids}}});await db.membershipApplication.deleteMany({where:{userId:{in:ids}}});await db.user.deleteMany({where:{id:{in:ids}}});if(oldSettings)await db.chatbotSettings.update({where:{id:1},data:oldSettings});else await db.chatbotSettings.deleteMany({where:{id:1}});await db.$disconnect();const {prisma}=await import('../config/prisma.js');await prisma.$disconnect();});
 it('allows only Admin knowledge uploads and requires CSRF before reading files',async()=>{
  expect((await request(app).post('/api/admin/ai-knowledge').set('X-GDA-CSRF','1')).status).toBe(401);
  for(const role of ['SUPER_ADMIN','ALUMNI','STUDENT'])expect((await request(app).post('/api/admin/ai-knowledge').set('Cookie',cookies[role]).set('X-GDA-CSRF','1')).status).toBe(role==='STUDENT'?401:403);
  expect((await request(app).post('/api/admin/ai-knowledge').set('Cookie',cookies.ADMIN)).status).toBe(403);
 });
 it('stores a genuine PDF privately, extracts pages and chunks, and quarantines new content',async()=>{
  const response=await upload();expect(response.status).toBe(201);const doc=response.body.data;documentId=doc.id;expect(doc).toMatchObject({processingStatus:'READY',approvalStatus:'PENDING',publicOriginal:false,pageCount:2,securityReviewed:false});expect(doc).not.toHaveProperty('originalBytes');expect(doc).not.toHaveProperty('storagePath');const stored=await db.aiKnowledgeDocument.findUniqueOrThrow({where:{id:doc.id}});expect(Buffer.from(stored.originalBytes)).toEqual(pdf);const full=await detail();expect(full.chunks.map((c:{pageNumber:number})=>c.pageNumber)).toEqual([1,2]);expect(full.chunks[0].text).toContain('falconparade');expect((await retrieve('falconparade')).some(s=>s.documentId===doc.id)).toBe(false);
  const original=await request(app).get(`/api/admin/ai-knowledge/${doc.id}/original`).set('Cookie',cookies.ADMIN);expect(original.status).toBe(200);expect(original.headers['content-type']).toContain('application/octet-stream');expect(original.headers['content-disposition']).toContain('attachment');
  expect((await request(app).get(`/api/chatbot/documents/${doc.id}`)).status).toBe(404);expect((await request(app).get(`/api/chatbot/documents/${doc.id}/original`)).status).toBe(404);
 });
 it('rejects false file types, incomplete signatures and oversized uploads',async()=>{
  expect((await upload(pdf,'history.txt')).status).toBe(400);expect((await upload(pdf,'history.pdf','text/plain')).status).toBe(400);expect((await upload(Buffer.from('fake document'))).status).toBe(400);expect((await upload(Buffer.alloc(10*1024*1024+1))).status).toBe(413);
 });
 it('flags scanned textless documents and refuses approval without OCR',async()=>{
  const response=await upload(makePdf(['']),'scan.pdf');expect(response.status).toBe(201);expect(response.body.data.processingStatus).toBe('OCR_REQUIRED');expect(response.body.data.emptyPages).toEqual([1]);expect((await review(response.body.data.id,'APPROVED',{confirmedPublicAndSafe:true})).status).toBe(400);
 });
 it('quarantines unsafe PDFs and supports retrying failed extraction',async()=>{
  const response=await upload(makePdf(['A public school document with synthetic active content for testing.'],'/OpenAction << /S /JavaScript /JS (app.alert\\(1\\)) >>'),'unsafe.pdf');expect(response.body.data.processingStatus).toBe('FAILED');expect((await review(response.body.data.id,'APPROVED',{confirmedPublicAndSafe:true})).status).toBe(400);
  const retry=await request(app).post(`/api/admin/ai-knowledge/${response.body.data.id}/reprocess`).set('Cookie',cookies.ADMIN).set('X-GDA-CSRF','1').send({version:response.body.data.version});expect(retry.status).toBe(200);expect(retry.body.data.processingStatus).toBe('FAILED');
 });
 it('requires deliberate safety review; approved passages are searchable with real page citations',async()=>{
  expect((await review(documentId,'APPROVED')).status).toBe(400);const approved=await review(documentId,'APPROVED',{confirmedPublicAndSafe:true});expect(approved.status).toBe(200);const sources=await retrieve('quasaracademic');expect(sources[0]).toMatchObject({documentId,pageNumber:2,edition:1});expect(sources[0].path).toContain(`/help/knowledge/${documentId}?page=1#chunk-`);
  expect((await request(app).get(`/api/chatbot/documents/${documentId}`)).status).toBe(200);expect((await request(app).get(`/api/chatbot/documents/${documentId}/original`)).status).toBe(404);
  provider.generate.mockResolvedValue(JSON.stringify({answer:'The archive records an academic achievement.',ids:[sources[0].id]}));const reply=await ask('quasaracademic');expect(reply.sources[0]).toMatchObject({documentId,pageNumber:2});const sent=JSON.stringify(provider.generate.mock.calls.at(-1)![2]);expect(sent).not.toContain('synthetic-provider-key');expect(sent).not.toContain('@example.test');
 });
 it('metadata edits revoke approval, reject stale writes and cannot approve a running parser',async()=>{
  const doc=await detail();const payload={title:doc.title+' reviewed',description:doc.description,category:doc.category,version:doc.version};
  const patch=()=>request(app).patch(`/api/admin/ai-knowledge/${documentId}`).set('Cookie',cookies.ADMIN).set('X-GDA-CSRF','1').send(payload);
  expect((await patch()).status).toBe(200);expect((await detail()).approvalStatus).toBe('PENDING');expect((await retrieve('falconparade')).some(source=>source.documentId===documentId)).toBe(false);expect((await patch()).status).toBe(409);
  await db.aiKnowledgeDocument.update({where:{id:documentId},data:{processingStatus:'PROCESSING'}});
  try{expect((await review(documentId,'APPROVED',{confirmedPublicAndSafe:true})).status).toBe(409);}finally{await db.aiKnowledgeDocument.update({where:{id:documentId},data:{processingStatus:'READY'}});}
  expect((await review(documentId,'APPROVED',{confirmedPublicAndSafe:true})).status).toBe(200);
 });
 it('permits public original downloads only when explicitly approved and withdraws rejected content',async()=>{
  expect((await review(documentId,'APPROVED',{confirmedPublicAndSafe:true,publicOriginal:true})).status).toBe(200);expect((await request(app).get(`/api/chatbot/documents/${documentId}/original`)).status).toBe(200);expect((await review(documentId,'REJECTED')).status).toBe(200);expect((await retrieve('falconparade')).some(s=>s.documentId===documentId)).toBe(false);expect((await request(app).get(`/api/chatbot/documents/${documentId}/original`)).status).toBe(404);
 });
 it('replaces an approved edition atomically and excludes superseded and archived content',async()=>{
  await review(documentId,'APPROVED',{confirmedPublicAndSafe:true});const old=await detail();const newer=makePdf(['The falconparade replacement provides corrected public parade achievement information.']);const response=await request(app).post(`/api/admin/ai-knowledge/${documentId}/replace`).set('Cookie',cookies.ADMIN).set('X-GDA-CSRF','1').field('title',`${tag} New archive`).field('category','School History').field('version',String(old.version)).attach('document',newer,{filename:'replacement.pdf',contentType:'application/pdf'});expect(response.status).toBe(201);replacementId=response.body.data.id;expect((await retrieve('falconparade')).some(s=>s.documentId===documentId)).toBe(true);expect((await retrieve('falconparade')).some(s=>s.documentId===replacementId)).toBe(false);
  expect((await review(replacementId,'APPROVED',{confirmedPublicAndSafe:true})).status).toBe(200);expect((await detail(documentId)).approvalStatus).toBe('SUPERSEDED');const sources=await retrieve('falconparade');expect(sources.some(s=>s.documentId===documentId)).toBe(false);expect(sources.some(s=>s.documentId===replacementId&&s.edition===2)).toBe(true);
  await review(replacementId,'ARCHIVED');expect((await retrieve('falconparade')).some(s=>s.documentId===replacementId)).toBe(false);
 });
 it('retrieves only current approved FAQs and published public content',async()=>{
  const faq=await db.chatbotFaq.create({data:{question:`${tag} orbitalfaq guidelines?`,answer:'Verified orbitalfaq guidance for public alumni membership.',path:'/register',published:true,validUntil:new Date(Date.now()+86400000)}});expect((await retrieve('orbitalfaq')).some(s=>s.id===faq.id)).toBe(true);await db.chatbotFaq.update({where:{id:faq.id},data:{validUntil:new Date(0)}});expect((await retrieve('orbitalfaq')).some(s=>s.id===faq.id)).toBe(false);
  const post=await db.post.create({data:{title:'cometannouncement',content:'Published public school information.',type:'ANNOUNCEMENT',createdBy:ids[0],isPublished:true}});expect((await retrieve('cometannouncement')).some(s=>s.id===post.id)).toBe(true);await db.post.update({where:{id:post.id},data:{isPublished:false}});expect((await retrieve('cometannouncement')).some(s=>s.id===post.id)).toBe(false);
 });
 it('removes original bytes and chunks together, audits removal and prevents stale actions',async()=>{
  const doc=await detail(replacementId);const remove=(version:number)=>request(app).delete(`/api/admin/ai-knowledge/${doc.id}`).set('Cookie',cookies.ADMIN).set('X-GDA-CSRF','1').send({version});expect((await remove(doc.version-1)).status).toBe(409);expect((await remove(doc.version)).status).toBe(200);expect(await db.aiKnowledgeChunk.count({where:{documentId:doc.id}})).toBe(0);expect(await db.aiKnowledgeDocument.findUnique({where:{id:doc.id}})).toBeNull();expect(await db.auditRecord.count({where:{targetId:doc.id,action:'AI_KNOWLEDGE_REMOVED'}})).toBe(1);
 });
 it('rate limits expensive parsing and public chat requests',async()=>{
  let limited=false;for(let i=0;i<4;i++){const result=await upload();if(result.status===429){limited=true;break;}}expect(limited).toBe(true);
  provider.generate.mockResolvedValue('{"answer":"Apply through the registration page.","ids":["registration"]}');let chatLimited=false;for(let i=0;i<8;i++){const result=await request(app).post('/api/chatbot/messages').set('X-GDA-CSRF','1').send({message:'How do I register?'});if(result.status===429){chatLimited=true;break;}}expect(chatLimited).toBe(true);
 });
});
