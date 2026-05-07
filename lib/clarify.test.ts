import { describe, it, expect } from "vitest";
import {
  combineDescriptionWithClarifications,
  shouldClarifyRecording,
  SHORT_RECORDING_SECONDS,
  SHORT_TRANSCRIPT_WORD_THRESHOLD,
} from "./clarify";

describe("combineDescriptionWithClarifications", () => {
  it("returns the original description unchanged when no Q/A is supplied", () => {
    expect(combineDescriptionWithClarifications("hello", [])).toBe("hello");
  });

  it("renders an answered Q/A pair with the verbatim answer", () => {
    const out = combineDescriptionWithClarifications("desc", [
      { question: "Who triggers it?", answer: "Sales rep" },
    ]);
    expect(out).toContain("Original description: desc");
    expect(out).toContain("Q: Who triggers it?");
    expect(out).toContain("A: Sales rep");
  });

  it("substitutes 'Not provided' for empty answers so the model still sees the question", () => {
    const out = combineDescriptionWithClarifications("desc", [
      { question: "Q1", answer: "" },
      { question: "Q2", answer: "   " },
    ]);
    expect(out).toContain("Q: Q1");
    expect(out).toContain("Q: Q2");
    expect((out.match(/A: Not provided/g) ?? []).length).toBe(2);
  });

  it("trims whitespace from answers", () => {
    const out = combineDescriptionWithClarifications("desc", [
      { question: "Q1", answer: "  trimmed  " },
    ]);
    expect(out).toContain("A: trimmed");
    expect(out).not.toContain("A:   trimmed  ");
  });
});

describe("shouldClarifyRecording", () => {
  it("triggers clarification when the recording is shorter than the threshold", () => {
    expect(
      shouldClarifyRecording({
        durationSeconds: SHORT_RECORDING_SECONDS - 1,
        // 100 words — far above the transcript threshold
        transcript: "word ".repeat(100).trim(),
      })
    ).toBe(true);
  });

  it("triggers clarification when the transcript word count is below the threshold", () => {
    const fewWords = Array.from(
      { length: SHORT_TRANSCRIPT_WORD_THRESHOLD - 1 },
      () => "word"
    ).join(" ");
    expect(
      shouldClarifyRecording({
        // Long enough recording to clear the duration check
        durationSeconds: SHORT_RECORDING_SECONDS + 30,
        transcript: fewWords,
      })
    ).toBe(true);
  });

  it("skips clarification when both duration and transcript are sufficient", () => {
    const enoughWords = Array.from(
      { length: SHORT_TRANSCRIPT_WORD_THRESHOLD + 5 },
      () => "word"
    ).join(" ");
    expect(
      shouldClarifyRecording({
        durationSeconds: SHORT_RECORDING_SECONDS + 30,
        transcript: enoughWords,
      })
    ).toBe(false);
  });

  it("treats whitespace-only transcripts as zero words", () => {
    expect(
      shouldClarifyRecording({
        durationSeconds: SHORT_RECORDING_SECONDS + 30,
        transcript: "   ",
      })
    ).toBe(true);
  });
});
