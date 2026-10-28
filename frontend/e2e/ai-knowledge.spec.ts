import { test,expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
import { makePdf } from '../../backend/src/__tests__/fixtures/pdf';
const require=createRequire(import.meta.url);
const {PrismaClient}=require('../../backend/node_modules/@prisma/client');
const bcrypt=require('../../backend/node_modules/bcrypt');
const db=new PrismaClient({datasourceUrl:process.env.PHASE1_TEST_DATABASE_URL});
const tag=`browser-knowledge-${Date.now()}`,password='KnowledgeBrowserPassword123!';
const users:Record<string,string>={};const ids:string[]=[];
test.beforeAll(async()=>{for(const role of ['ADMIN','SUPER_ADMIN']){const email=`${role.toLowerCase()}-${tag}@example.test`;const u=await db.user.create({data:{email,password:await bcrypt.hash(password,4),role,staffProfile:{create:{fullName:'Knowledge test administrator'}}}});ids.push(u.id);users[role]=email;}});
test.afterAll(async()=>{await db.aiKnowledgeDocument.deleteMany({where:{uploadedBy:{in:ids}}});await db.auditRecord.deleteMany({where:{actorId:{in:ids}}});await db.user.deleteMany({where:{id:{in:ids}}});await db.$disconnect();});
async function login(page:import('@playwright/test').Page,role:string){await page.goto('/login');await page.getByLabel('Email address',{exact:true}).fill(users[role]);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Log in',exact:true}).click();await expect(page).toHaveURL(role==='ADMIN'?/\/admin$/:/\/super-admin$/);}
test('Admin uploads and approves real PDF knowledge; public citations protect originals on desktop and mobile',async({page,browser})=>{
 await login(page,'ADMIN');await page.goto('/admin/ai-knowledge');await expect(page.getByRole('heading',{name:'AI Knowledge Base',exact:true})).toBeVisible();
 await page.getByLabel('Document title',{exact:true}).fill(`${tag} Parade record`);await page.getByLabel('Description',{exact:true}).fill('Synthetic public archive for browser verification.');await page.getByLabel('Knowledge category',{exact:true}).selectOption('Cadet Drill and Parade History');
 const bytes=makePdf(['The browserparade fixture records a public cadet parade achievement reviewed by the school.','The second page describes the public alumni association homecoming program.']);
 await page.getByLabel(/PDF document \(maximum/).setInputFiles({name:'public-parade.pdf',mimeType:'application/pdf',buffer:bytes});await page.getByRole('button',{name:'Upload PDF',exact:true}).click();
 const review=page.getByRole('region',{name:'Document extraction review',exact:true});await expect(review).toBeVisible();await expect(review.getByText(/The browserparade fixture/)).toBeVisible();await expect(review.getByText('Page 2 · Passage 2',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Approve for assistant',exact:true})).toBeDisabled();
 const doc=await db.aiKnowledgeDocument.findFirstOrThrow({where:{uploadedBy:ids[0],title:`${tag} Parade record`},include:{chunks:{orderBy:{ordering:'asc'}}}});expect(doc.approvalStatus).toBe('PENDING');
 expect((await page.request.get(`/api/chatbot/documents/${doc.id}`)).status()).toBe(404);
 await page.getByLabel(/I reviewed the original offline/).check();await page.getByRole('button',{name:'Approve for assistant',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Document review saved.'})).toBeVisible();
 for(const width of [1440,375]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
 const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;expect(violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
 const context=await browser.newContext({viewport:{width:375,height:900}}),visitor=await context.newPage();
 try{
  await visitor.route('**/api/chatbot/availability',route=>route.fulfill({json:{success:true,data:{enabled:true}}}));
  const sourcePath=`/help/knowledge/${doc.id}?page=1#chunk-${doc.chunks[0].id}`;
  await visitor.route('**/api/chatbot/messages',route=>route.fulfill({json:{success:true,data:{answer:'The archive records a reviewed public parade achievement.',sources:[{title:'Parade record · page 1',path:sourcePath,documentId:doc.id,pageNumber:1,edition:1}]}}}));
  await visitor.goto('/help');await visitor.getByRole('button',{name:'Ask the school assistant',exact:true}).click();await visitor.getByLabel('Ask a general school question').fill('What does the parade archive confirm?');await visitor.getByRole('button',{name:'Send question',exact:true}).click();await visitor.getByRole('link',{name:'Parade record · page 1',exact:true}).click();await expect(visitor.getByRole('heading',{level:1})).toHaveText(`${tag} Parade record`);await expect(visitor.getByText(/The browserparade fixture/)).toBeVisible();await expect(visitor.getByRole('link',{name:'Download approved public PDF',exact:true})).toHaveCount(0);expect((await visitor.request.get(`/api/chatbot/documents/${doc.id}/original`)).status()).toBe(404);expect(await visitor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }finally{await context.close();}
 await page.getByRole('button',{name:'Archive document',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Document review saved.'})).toBeVisible();expect((await page.request.get(`/api/chatbot/documents/${doc.id}`)).status()).toBe(404);
 await page.getByRole('button',{name:'Remove document',exact:true}).click();await page.getByRole('button',{name:'Confirm permanent removal',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Original and extracted passages permanently removed.'})).toBeVisible();expect(await db.aiKnowledgeDocument.findUnique({where:{id:doc.id}})).toBeNull();
});
test('SuperAdmin keeps platform settings and cannot open the school PDF library',async({page})=>{await login(page,'SUPER_ADMIN');await page.goto('/admin/ai-knowledge');await expect(page).toHaveURL(/\/super-admin$/);expect((await page.request.get('/api/admin/ai-knowledge')).status()).toBe(403);await page.goto('/super-admin/chatbot');await expect(page.getByLabel('Output token limit',{exact:true})).toHaveValue('1024');});
