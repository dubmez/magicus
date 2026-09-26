// When a run of steps is one butterfly, and when it becomes several.
//
// The rule: a card ends where the work waits, or where it can go more than one way;
// each way out is one of its outputs, and an output is the next card's entrance.
// The original half of it: A butterfly is what one
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
export const CHAIN_RULE = `Decide between one workflow and a chain with one rule: a card is what one person or team does in one go. It ends where the work waits, or where it can go more than one way.
   - Never branch inside a card: its steps are always one straight line.
   - When the work can end more than one way, give the card one output per way out, each with "when" saying when it happens (e.g. "every line matches", "a line is off"). A card with one way out has one output and no "when".
   - When the next step cannot start until something outside happens (a reply, an approval, another team picking the work up, a date), end the card there too.
   - Connect each output that leads somewhere to the card that picks it up, naming the output it leaves by ("fromOutput") and the input of the next card it arrives through ("toInput"): one card's exit is the next card's entrance. Label the connection with what it waits for or which way it went (e.g. "Waits for the supplier's reply", "A line is off"). An output that goes nowhere else in the map needs no connection.
   - Never split only because the tool changes, a colleague helps inside one step, or the card is long. A card past 8 steps usually hides a wait or a fork: look for one.
   - If nothing waits and nothing forks, generate ONE card.`;

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
