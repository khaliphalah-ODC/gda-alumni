export const supportedGroqModels = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'] as const;
export const defaultGroqModel = supportedGroqModels[0];
export const groqModelOptions = supportedGroqModels.map((id,index)=>({id,label:index===0?'GPT OSS 20B':'GPT OSS 120B'}));
