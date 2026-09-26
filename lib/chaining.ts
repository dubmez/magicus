// When a run of steps is one butterfly, and when it becomes a chain of them.
//
// The rule is one sentence: split where the work waits. A butterfly is what one
// person or team does in one go, from its trigger to a hand-off. When the next step
// cannot start until something outside happens (a reply, an approval, another team
// picking it up, a date), the butterfly ends there, and the next one starts with that
// event as its trigger. The connection between them is labelled with the event.
//
// Things that never split a butterfly on their own: a change of tool, a colleague
// consulted inside a step, or length. A long butterfly is only a hint that a wait was
// missed.
//
// The same rule is given to the model that drafts workflows (app/api/generate), and
// `waitsInside` lets code and tests hold a map to it.

import type { Step } from "./workflows";

/** The rule as the model that drafts workflows is told it. */
export const CHAIN_RULE = `Decide between one workflow and a chain with one rule: split where the work waits.
   - A workflow card is what one person or team does in one go, from its trigger to a hand-off.
   - When the next step cannot start until something outside happens (a reply, an approval, another team picking the work up, a date), end the card at the step that hands off, and start a new card whose trigger is that event. Label the connection with the event (e.g. "Receipts in", "Draft approved").
   - Never split only because the tool changes, a colleague helps inside one step, or the card is long. A card past 8 steps usually hides a wait: look for one, and split there if you find it.
   - If nothing waits, generate ONE card.`;

/** Words that say a step leaves the work waiting on someone or something else. */
const WAITS = /\b(chase|chasing|wait|waits|waiting|await|awaiting|until|follow[- ]?up|approval from|sign-?off from)\b/i;

export const LONG_BUTTERFLY = 8;

export type ChainIssue = { afterStep: number; reason: string };

/**
 * Where a butterfly breaks the rule: a step that waits with more work after it (the
 * card should end there), or a card long enough that a wait was probably missed.
 */
export function waitsInside(steps: Step[]): ChainIssue[] {
  const issues: ChainIssue[] = [];
  steps.forEach((step, index) => {
    if (index < steps.length - 1 && WAITS.test(step.text)) {
      issues.push({ afterStep: step.n, reason: `"${step.text}" waits on someone else, so the next card starts after it.` });
    }
  });
  if (steps.length > LONG_BUTTERFLY && issues.length === 0) {
    issues.push({ afterStep: steps[LONG_BUTTERFLY - 1].n, reason: `${steps.length} steps: look for a wait to split at.` });
  }
  return issues;
}
