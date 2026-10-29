import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { MessageCircle, Send, LifeBuoy, Loader2, ArrowUpRight, Trash2, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useCurrentUser } from '@/hooks/use-current-user';
import { askFleetFlow, getAssistantStatus } from '@/lib/assistant/assistant.functions';
import { audienceFor } from '@/lib/assistant/context';
import { routeForAudience, supportReplyForAudience } from '@/lib/assistant/routes';
import type { AssistantResult } from '@/lib/assistant/service';
import type { AssistantInput } from '@/lib/assistant/input';
import { assistantSupportPrefill } from '@/lib/assistant/feedback-prefill';
import { ERROR_REPLIES } from '@/lib/assistant/errors';
const AssistantContext = createContext({ open: () => {}, enabled: false });
const ADMIN_STARTERS = ['How do I invite my operators?', 'How does my employee join my company?', 'How do I add my first machine?', 'How do I get my operators completing prestarts?', "Why can't my employee log in?", "How do I check an operator's licence expiry?", 'How do I set up servicing reminders?'];
const OPERATOR_STARTERS = ['How do I complete a prestart?', "Why won't my prestart submit?", "How do I scan a machine's QR code?", "Why can't I log in?"];
type Turn = AssistantInput['messages'][number] & Partial<Pick<AssistantResult, 'links' | 'escalate'>>;
export function AssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const { data: me } = useCurrentUser();
  const status = useServerFn(getAssistantStatus);
  // Server decides (flag + allowlist); askFleetFlow enforces it again.
  useEffect(() => { let live = true; setEnabled(false); if (me) status().then(r => { if (live) setEnabled(r.enabled); }).catch(() => {}); return () => { live = false; }; }, [me?.userId, me?.company?.id]);
  return <AssistantContext.Provider value={{ open: () => setOpen(true), enabled }}>{children}{enabled && me && <AssistantPanel key={`${me.userId}:${me.company?.id ?? ''}:${me.role ?? ''}`} open={open} onOpenChange={setOpen} />}</AssistantContext.Provider>;
}
export function AssistantHeaderButton() {
  const assistant = useContext(AssistantContext);
  if (!assistant.enabled) return null;
  return <Button variant="ghost" size="icon" title="Ask FleetFlow" aria-label="Ask FleetFlow" onClick={assistant.open}><MessageCircle className="size-5" /></Button>;
}
export function AssistantHelpTile() {
  const assistant = useContext(AssistantContext);
  if (!assistant.enabled) return null;
  return <Button variant="outline" className="h-auto min-h-24 w-full flex-col gap-2 rounded-lg p-4" onClick={assistant.open}><MessageCircle className="size-7 text-primary" /><span>Need help?</span></Button>;
}
function AssistantPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (value: boolean) => void }) {
  const { data: me } = useCurrentUser();
  const audience = audienceFor(me?.role ?? null);
  const navigate = useNavigate();
  const location = useLocation();
  const ask = useServerFn(askFleetFlow);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const run = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; run.current?.abort(); }; }, []);
  useEffect(() => { if (!open) run.current?.abort(); }, [open]);
  function stop() { run.current?.abort(); }
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'auto', block: 'end' }); }, [turns, pending, open]);
  async function send(question = draft) {
    const content = question.trim();
    if (!content || lock.current || content.length > 2000) return;
    const messages = [...turns.map(({ role, content }) => ({ role, content })), { role: 'user' as const, content }].slice(-6);
    while (messages.reduce((n, m) => n + m.content.length, 0) > 8000) messages.shift();
    lock.current = true; setPending(true); setDraft(''); setTurns(messages);
    const controller = new AbortController(); run.current = controller;
    try {
      const result = await ask({ data: { messages, currentPath: location.pathname }, signal: controller.signal });
      if (controller.signal.aborted) throw new DOMException('Stopped', 'AbortError');
      if (alive.current) setTurns([...messages, { role: 'assistant' as const, content: supportReplyForAudience(result.reply, audience), links: result.links, escalate: result.escalate }].slice(-6));
    } catch {
      // Stopped runs never show links, actions or a partial answer as complete.
      if (controller.signal.aborted) { if (alive.current) setTurns([...messages, { role: 'assistant' as const, content: ERROR_REPLIES.cancelled, links: [], escalate: false }].slice(-6)); }
      else if (alive.current) setTurns([...messages, { role: 'assistant' as const, content: supportReplyForAudience('The assistant could not answer just now. Please try again or contact support.', audience), escalate: true }].slice(-6));
    } finally { if (run.current === controller) run.current = null; lock.current = false; if (alive.current) setPending(false); }
  }
  function contactSupport() {
    if (audience === 'operator') return;
    const question = [...turns].reverse().find(t => t.role === 'user')?.content ?? draft;
    onOpenChange(false);
    navigate({ to: '/feedback', search: assistantSupportPrefill(question) });
  }
  const starters = audience === 'operator' ? OPERATOR_STARTERS : audience === 'admin' ? ADMIN_STARTERS : ['How do I check an operator’s licence expiry?', 'How do I find machine details?', 'How do I contact support?'];
  return <>
    {!open && <Button className="fixed bottom-5 right-5 z-40 gap-2 rounded-lg" onClick={() => onOpenChange(true)}><MessageCircle className="size-4" />Ask FleetFlow</Button>}
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent onEscapeKeyDown={event => { if (lock.current) { event.preventDefault(); stop(); } }} className="flex h-dvh w-full flex-col gap-0 p-0 sm:w-[460px] sm:max-w-[460px] motion-reduce:transition-none motion-reduce:animate-none">
        <SheetHeader className="border-b border-border p-5 pr-12 text-left">
          <SheetTitle className="flex items-center gap-2"><MessageCircle className="size-5 text-primary" />Ask FleetFlow</SheetTitle>
          <SheetDescription>FleetFlow Assistant gives guidance only and can't change anything in your account.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
          {turns.length === 0 && <div className="space-y-2">{starters.map(s => <Button key={s} variant="outline" className="h-auto w-full justify-between gap-3 whitespace-normal rounded-lg px-3 py-3 text-left font-normal" onClick={() => send(s)}>{s}<ArrowUpRight className="size-4 shrink-0 text-muted-foreground" /></Button>)}</div>}
          <div className="space-y-5" role="log" aria-live="polite" aria-label="Assistant conversation">
            {turns.map((turn, index) => <div key={index} className={turn.role === 'user' ? 'ml-8 rounded-lg bg-muted p-3' : 'border-l-2 border-primary pl-3'}>
              <div className="mb-1 text-xs font-medium text-muted-foreground">{turn.role === 'user' ? 'You' : 'FleetFlow'}</div>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">{turn.content}</p>
              {!!turn.links?.length && <div className="mt-2 flex flex-wrap gap-2">{turn.links.map(link => routeForAudience(link, audience)).filter((link): link is string => !!link).map(link => <Button key={link} asChild variant="outline" size="sm" className="h-auto whitespace-normal"><a href={link} onClick={() => onOpenChange(false)}>{link.split('/').filter(Boolean).join(' / ')}<ArrowUpRight className="ml-1 size-3" /></a></Button>)}</div>}
            </div>)}
            {pending && <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" />Checking FleetFlow help…</div>}
          </div><div ref={bottom} />
        </div>
        <div className="shrink-0 border-t border-border p-4 pb-6">
          <form onSubmit={event => { event.preventDefault(); void send(); }} className="space-y-2">
            <Textarea aria-label="Your question" placeholder="Ask a FleetFlow question…" value={draft} onChange={event => setDraft(event.target.value)} maxLength={2000} rows={3} disabled={pending} className="max-h-32 resize-none" />
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="ghost" size="icon" title="Clear conversation" aria-label="Clear conversation" disabled={pending || !turns.length} onClick={() => setTurns([])}><Trash2 className="size-4" /></Button>
              {pending ? <Button type="button" variant="secondary" aria-label="Stop generating" onClick={stop}><Square className="mr-2 size-4" />Stop</Button> : <Button type="submit" disabled={!draft.trim()}><Send className="mr-2 size-4" />Send</Button>}
            </div>
          </form>
          {audience === 'operator' ? <p className="mt-3 text-xs text-muted-foreground">For help, ask your company admin.</p> : <Button variant="link" className="mt-2 h-auto p-0 text-sm" onClick={contactSupport}><LifeBuoy className="mr-2 size-4" />Contact support</Button>}
        </div>
      </SheetContent>
    </Sheet>
  </>;
}
