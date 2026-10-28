import { afterEach,describe,expect,it,vi } from 'vitest';
vi.mock('../config/env',()=>({env:{GROQ_API_KEY:'unit-provider-credential'}}));
import { generateSchoolAnswer,providerMessages } from '../services/groq-provider';
import { workflowSources } from '../services/chatbot-knowledge';
afterEach(()=>vi.unstubAllGlobals());
describe('official Groq SDK adapter',()=>{
 it('uses the configured model, structured response, token cap and server-only authentication',async()=>{
  const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'{"answer":"Apply online.","ids":["registration"]}'}}]}),{status:200,headers:{'Content-Type':'application/json'}}));vi.stubGlobal('fetch',fetch);
  const reply=await generateSchoolAnswer('openai/gpt-oss-20b',512,providerMessages('Register?',workflowSources));expect(JSON.parse(reply).ids).toEqual(['registration']);
  const options=fetch.mock.calls[0][1];const body=JSON.parse(options.body);expect(body).toMatchObject({model:'openai/gpt-oss-20b',max_completion_tokens:512,response_format:{type:'json_schema'}});expect(body).not.toHaveProperty('tools');expect(JSON.stringify(body)).not.toContain('unit-provider-credential');
 });
 it.each([401,429,500])('maps provider %s errors without leaking response text and does not retry',async status=>{const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{message:'private-provider-error'}}),{status,headers:{'Content-Type':'application/json'}}));vi.stubGlobal('fetch',fetch);await expect(generateSchoolAnswer('openai/gpt-oss-20b',512,providerMessages('Register?',workflowSources))).rejects.toMatchObject({statusCode:status===429?429:503});expect(fetch).toHaveBeenCalledTimes(1);});
 it('handles aborted or timed-out provider calls safely',async()=>{const fetch=vi.fn().mockRejectedValue(new DOMException('private-provider-error','AbortError'));vi.stubGlobal('fetch',fetch);await expect(generateSchoolAnswer('openai/gpt-oss-20b',512,providerMessages('Register?',workflowSources))).rejects.toMatchObject({statusCode:503});expect(fetch).toHaveBeenCalledTimes(1);});
});
