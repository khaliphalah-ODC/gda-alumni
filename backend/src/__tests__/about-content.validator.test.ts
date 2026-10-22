import { describe, expect, it } from 'vitest';
import { createHistorySchema, createLeaderSchema, milestoneDateSchema, updateHistorySchema } from '../validators/about-content.validator';

describe('About content validation', () => {
  it('accepts year-only milestones and real dates without normalizing invalid calendar dates', () => {
    for (const date of ['1980', '2024-02-29', '2001-12-31']) expect(milestoneDateSchema.safeParse(date).success).toBe(true);
    for (const date of ['', '80', '0000', '2023-02-29', '2024-02-30', '2024-13-01', '2024-04-31', '2024-1-1']) expect(milestoneDateSchema.safeParse(date).success, date).toBe(false);
  });
  it('rejects publication bypasses, invalid ordering, unsafe images and leadership fields in history', () => {
    const history = { title: 'School founded', content: 'Verified information', milestoneDate: '1980' };
    expect(createHistorySchema.parse(history).displayOrder).toBe(0);
    for (const extra of [{ isPublished: true }, { displayOrder: -1 }, { displayOrder: 0.5 }, { image: 'javascript:alert(1)' }, { position: 'Principal' }]) {
      expect(createHistorySchema.safeParse({ ...history, ...extra }).success).toBe(false);
    }
    expect(updateHistorySchema.safeParse(history).success).toBe(false);
    expect(updateHistorySchema.safeParse({ ...history, version: 0 }).success).toBe(true);
  });
  it('requires a name, position and short biography for leadership records', () => {
    const leader = { title: 'Test Leader', position: 'Principal', content: 'A verified biography.' };
    expect(createLeaderSchema.safeParse(leader).success).toBe(true);
    for (const change of [{ title: '' }, { position: '' }, { content: '' }, { content: 'x'.repeat(2001) }, { milestoneDate: '1980' }]) {
      expect(createLeaderSchema.safeParse({ ...leader, ...change }).success).toBe(false);
    }
  });
});
