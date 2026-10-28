import { env } from '../src/config/env';
import { generateSchoolAnswer,providerMessages } from '../src/services/groq-provider';
import { workflowSources } from '../src/services/chatbot-knowledge';
async function main(){
 if(!env.GROQ_API_KEY){console.log('Groq check skipped: GROQ_API_KEY is not configured.');return;}
 const started=Date.now();
 const result=JSON.parse(await generateSchoolAnswer(env.GROQ_MODEL,1024,providerMessages('How do I register for alumni membership?',workflowSources.slice(0,1))));
 if(typeof result.answer!=='string'||!result.answer.trim()||!Array.isArray(result.ids)||result.ids.length!==1||result.ids[0]!=='registration')throw new Error('Provider returned no verifiable synthetic guidance.');
 console.log(JSON.stringify({connected:true,model:env.GROQ_MODEL,syntheticEvidenceVerified:true,latencyMs:Date.now()-started}));
}
main().catch(()=>{console.error('Groq connection check failed. Verify the server credential, model and provider availability. No credential or provider response was logged.');process.exitCode=1;});
