import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('public assistant supports keyboard, sources, errors, clearing and mobile accessibility',async({page})=>{
 await page.route('**/api/chatbot/availability',route=>route.fulfill({json:{success:true,data:{enabled:true}}}));
 let fail=false;
 await page.route('**/api/chatbot/messages',async route=>{
  const data=route.request().postDataJSON();expect(Object.keys(data)).toEqual(['message']);
  await route.fulfill({status:fail?429:200,json:fail?{success:false,message:'Please wait a minute.',data:null}:{success:true,data:{answer:'Submit an application, then wait for school approval.',sources:[{title:'Registration guide',path:'/register'}]}}});
 });
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});await page.goto('/help');
  const launch=page.getByRole('button',{name:'Ask the school assistant',exact:true});await launch.click();
  const input=page.getByLabel('Ask a general school question');await expect(input).toBeFocused();
  await page.getByRole('button',{name:'How do I register?',exact:true}).click();
  await expect(page.getByText('Submit an application, then wait for school approval.')).toBeVisible();
  await expect(page.getByRole('link',{name:'Registration guide',exact:true})).toHaveAttribute('href','/register');
  fail=true;await input.fill('Where are events?');await page.getByRole('button',{name:'Send question',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Please wait a minute.'})).toBeVisible();fail=false;
  await page.getByRole('button',{name:'Clear chat',exact:true}).click();await expect(page.getByText('Submit an application, then wait for school approval.')).toHaveCount(0);
  const violations=(await new AxeBuilder({page}).include('#school-assistant').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;expect(violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await input.press('Escape');await expect(launch).toBeFocused();await expect(page.locator('#school-assistant')).toHaveCount(0);
 }
});
test('disabled assistant stays hidden',async({page})=>{await page.route('**/api/chatbot/availability',route=>route.fulfill({json:{success:true,data:{enabled:false}}}));await page.goto('/help');await expect(page.getByRole('button',{name:'Ask the school assistant',exact:true})).toHaveCount(0);});
test('management screens respect separate roles and submit validated settings and school answers',async({page})=>{
 let role='ADMIN';
 await page.route('**/api/auth/me',route=>route.fulfill({json:{success:true,data:{id:'cm9z2p7es0000l9m86e4w8v1a',email:'test@example.test',role,isActive:true}}}));
 await page.route('**/api/chatbot/availability',route=>route.fulfill({json:{success:true,data:{enabled:false}}}));
 let saved=false;
 await page.route('**/api/admin/chatbot/faqs',async route=>{if(route.request().method()==='POST'){const data=route.request().postDataJSON();expect(data.published).toBe(true);expect(data.answer).toBe('Visit the Records Office for verified fees.');saved=true;}await route.fulfill({json:{success:true,data:[]}});});
 await page.goto('/admin/chatbot');await page.getByLabel('Question',{exact:true}).fill('What are the document fees?');await page.getByLabel('Approved answer',{exact:true}).fill('Visit the Records Office for verified fees.');await page.getByLabel('Approved for public answers').check();await page.getByRole('button',{name:'Save answer',exact:true}).click();await expect(page.getByText('Changes saved.',{exact:true})).toBeVisible();expect(saved).toBe(true);
 role='SUPER_ADMIN';let configured=false;
 await page.route('**/api/super-admin/chatbot',async route=>{if(route.request().method()==='PATCH'){const data=route.request().postDataJSON();expect(data.currentPassword).toBe('test-password');expect(data.dailyRequests).toBe(12);configured=true;}await route.fulfill({json:{success:true,data:{enabled:false,configured:true,model:'openai/gpt-oss-20b',dailyRequests:100,dailyBudgetMicros:1000000,usage:null}}});});
 await page.goto('/super-admin/chatbot');await page.getByLabel('Daily request limit').fill('12');await page.getByLabel('Current password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Save chatbot settings',exact:true}).click();await expect(page.getByText('Changes saved.',{exact:true})).toBeVisible();expect(configured).toBe(true);
});
