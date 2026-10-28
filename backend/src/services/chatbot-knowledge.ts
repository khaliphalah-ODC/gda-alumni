import { z } from 'zod';
import { supportedGroqModels } from '../config/ai';
export const publicPaths = ['/register', '/membership/status', '/activate', '/login', '/services', '/requests/new', '/requests', '/events', '/announcements', '/stories', '/about', '/contact', '/help', '/privacy', '/terms'] as const;
export interface ChatSource { id: string; title: string; text: string; path: string; documentId?: string; pageNumber?: number; edition?: number }
// Product workflow guidance, not unverified school fees, dates or policy claims.
export const workflowSources: ChatSource[] = [
  { id: 'registration', title: 'Registration guide', path: '/register', text: 'Submit a membership application on the registration page. Save the private receipt and tracking credentials. School Admin reviews the application; submitting it does not immediately create an active account.' },
  { id: 'activation', title: 'Activation guide', path: '/activate', text: 'After school approval, use your private activation invitation to create your password. Never share the invitation or paste it into this chat. Ask the school for assistance if it has expired.' },
  { id: 'tracking', title: 'Membership tracking', path: '/membership/status', text: 'Use your private application reference and tracking credentials on the membership status page to view the review result or submit permitted corrections. This chat cannot look up applications.' },
  { id: 'documents', title: 'Document services', path: '/services', text: 'Sign in with an approved, activated account to submit a document request. Available types include certificate, transcript, diploma, WAEC certificate and WASSCE certificate. Fees and processing times must be confirmed with the school.' },
  { id: 'requests', title: 'Track document requests', path: '/requests', text: 'Sign in and open My Requests to view your own requests and processing status. The Services tracking form also takes you to the protected request page. This public chat cannot retrieve private request status.' },
  { id: 'events', title: 'Published upcoming events', path: '/events', text: 'Open Events for published upcoming school events. Event details appear on their individual pages. If no events are published, no schedule is confirmed here.' },
  { id: 'navigation', title: 'Website navigation', path: '/help', text: 'Use the public navigation for About, Services, Announcements, Stories and Events. Log in to reach your role dashboard and Account Settings. Contact the school through Contact for information unavailable here.' },
];
export const messageSchema = z.object({ message: z.string().trim().min(2).max(600) }).strict();
export const settingsSchema = z.object({ enabled: z.boolean(), model: z.enum(supportedGroqModels), outputTokenLimit: z.number().int().min(256).max(2048).default(1024), dailyRequests: z.number().int().min(1).max(10000), dailyBudgetMicros: z.number().int().min(1000).max(100000000), currentPassword: z.string().min(1).max(128) }).strict();
export const faqSchema = z.object({ question: z.string().trim().min(5).max(180), answer: z.string().trim().min(5).max(1800), path: z.enum(publicPaths), published: z.boolean(), validUntil: z.string().datetime().refine(v => Date.parse(v) > Date.now() && Date.parse(v) < Date.now() + 366 * 86400000, 'Choose a future review date within one year'), version: z.number().int().nonnegative().optional() }).strict();
// Reject common credential/PII formats before anything is sent to the provider.
export function sensitiveMessage(message: string) {
  return /[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?:\/\/|(?:token|password|secret|tracking credential|api.key)\s*[:=]|\b\d[\d ()+-]{7,}\d\b|\bc[a-z0-9]{24}\b/i.test(message);
}
export function selectedSources(output: string, sources: ChatSource[]) {
  const result = z.object({ ids: z.array(z.string()).max(3) }).strict().safeParse(JSON.parse(output));
  if (!result.success) return [];
  return sources.filter(s => result.data.ids.includes(s.id));
}
