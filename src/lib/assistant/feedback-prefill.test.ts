import { describe, expect, it, vi } from 'vitest';
import { FEEDBACK_CATEGORIES, initialFeedbackValues, parseFeedbackPrefill, assistantSupportPrefill } from './feedback-prefill';

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

describe('assistant support question sanitisation', () => {
  it('sets a fixed subject and labels the sanitised question', () => {
    expect(assistantSupportPrefill('  How   do I delete an asset?  ')).toEqual({ category: 'contact', subject: 'FleetFlow Assistant question', message: 'Question to FleetFlow Assistant: How do I delete an asset?' });
  });
  it.each(['https://evil.com/path', 'http:evil.com', 'javascript:alert(1)', 'data:text/html,attack', 'mailto:person@example.com', 'ftp://evil.com', 'custom+scheme:payload', 'www.evil.com/path', 'evil.group/path', '//evil.com/path'])('removes URL/scheme payload %s', url => {
    expect(assistantSupportPrefill(`Help ${url} please`).message).toBe('Question to FleetFlow Assistant: Help please');
  });
  it('removes controls, invisible characters and collapses whitespace', () => {
    expect(assistantSupportPrefill('Help\u0000\t\n\u007f\u009f\u202e\u200b please').message).toBe('Question to FleetFlow Assistant: Help please');
  });
  it('caps the entire message, including the label, at 500 characters', () => {
    const result = assistantSupportPrefill('x'.repeat(1000));
    expect(result.message).toHaveLength(500);
    expect(result.message).toBe('Question to FleetFlow Assistant: ' + 'x'.repeat(468));
  });
});