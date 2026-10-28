import { describe, expect, it, vi } from 'vitest';
import { FEEDBACK_CATEGORIES, initialFeedbackValues, parseFeedbackPrefill } from './feedback-prefill';

describe('initial feedback values', () => {
  it('truncates subjects to 150 characters', () => {
    expect(initialFeedbackValues({ subject: 's'.repeat(151) }).subject).toHaveLength(150);
  });
  it('truncates messages to 2000 characters', () => {
    expect(initialFeedbackValues({ message: 'm'.repeat(2001) }).message).toHaveLength(2000);
  });
  it.each(FEEDBACK_CATEGORIES)('accepts existing category %s', category => {
    expect(initialFeedbackValues({ category }).category).toBe(category);
  });
  it('ignores unknown categories', () => {
    expect(parseFeedbackPrefill({ category: 'admin' }).category).toBeUndefined();
    expect(initialFeedbackValues({ category: 'admin' }).category).toBe('contact');
  });
  it('uses defaults for missing params', () => {
    expect(initialFeedbackValues({})).toEqual({ subject: '', message: '', category: 'contact' });
    expect(initialFeedbackValues(undefined)).toEqual({ subject: '', message: '', category: 'contact' });
  });
  it('ignores non-string params', () => {
    expect(initialFeedbackValues({ subject: 5, message: ['text'], category: null })).toEqual({ subject: '', message: '', category: 'contact' });
  });
  it('cannot invoke a submit callback supplied in search params', () => {
    const submit = vi.fn();
    expect(initialFeedbackValues({ subject: 'Help', message: 'Question', category: 'bug', submit, autoSubmit: true })).toEqual({ subject: 'Help', message: 'Question', category: 'bug' });
    expect(submit).not.toHaveBeenCalled();
    expect(parseFeedbackPrefill({ submit, autoSubmit: true })).not.toHaveProperty('submit');
  });
});