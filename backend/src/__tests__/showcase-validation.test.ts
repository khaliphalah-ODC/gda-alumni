import { describe, expect, it } from 'vitest';
import { achievementSchema } from '../validators/showcase.validator';
const achievement = { title: 'School award', content: 'Confirmed award details', category: 'Academic', imageAlt: 'School award photograph', summary: 'School award description', heading: 'School award heading', milestoneDate: '2024-02-29', sourceUrl: 'https://example.test/source', sourceLabel: 'Official award source' };
describe('Featured achievement validation', () => {
  it('accepts real leap days and supported date precision', () => {
    for (const milestoneDate of ['2024-02-29', '2026-09', '2026']) expect(achievementSchema.safeParse({ ...achievement, milestoneDate }).success).toBe(true);
  });
  it('rejects impossible and malformed dates without throwing', () => {
    for (const milestoneDate of ['2026-02-29', '2026-13-01', '2026-04-31', 'nonsense!!']) expect(achievementSchema.safeParse({ ...achievement, milestoneDate }).success).toBe(false);
  });
  it('rejects invalid, unsafe and credential-bearing source links without throwing', () => {
    for (const sourceUrl of ['not a URL', 'javascript:alert(1)', 'http://example.test', 'https://user:password@example.test/source']) expect(achievementSchema.safeParse({ ...achievement, sourceUrl }).success).toBe(false);
  });
});
