export type ContentKind = 'announcements' | 'stories' | 'events';
export const contentEndpoint = (kind: ContentKind) => kind === 'announcements' ? '/posts/announcements' : `/${kind}`;
export const contentLabel = (kind: ContentKind) => ({ announcements: 'Announcements', stories: 'Alumni stories', events: 'Events' }[kind]);
export function localDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
