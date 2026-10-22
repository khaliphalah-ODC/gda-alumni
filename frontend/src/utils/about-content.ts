export type AboutContentKind = 'history' | 'school' | 'alumni';
export const aboutContentEndpoint = (kind: AboutContentKind) => kind === 'history' ? '/history' : `/leadership/${kind}`;
export const aboutContentLabel = (kind: AboutContentKind) => ({ history: 'School history', school: 'School leadership', alumni: 'Alumni leadership' }[kind]);
