"use client";

import { useEffect, useState } from "react";
import { AnimatedButterfly } from "./animated-butterfly";

// A light-chrome cousin of the recording flow's ProcessingScreen, for the
// finance demo: same butterfly, same fade, but the messages and timing are
// the caller's and it finishes on its own.
export function DemoProcessing({
  messages,
  durationMs,
  onDone,
}: {
  messages: string[];
  durationMs: number;
  onDone: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const step = durationMs / messages.length;

  useEffect(() => {
    const timers = messages.map((_, i) =>
      i === 0 ? null : setTimeout(() => setIdx(i), step * i),
    );
    const done = setTimeout(onDone, durationMs);
    return () => {
      timers.forEach((t) => t && clearTimeout(t));
      clearTimeout(done);
    };
  }, [messages, step, durationMs, onDone]);

  return (
    <section
      className="flex flex-col items-center justify-center"
      style={{ minHeight: "calc(100vh - 65px)", padding: "32px 24px 80px" }}
    >
      <AnimatedButterfly />
      <div
        key={idx}
        className="magicus-placeholder-fade"
        style={{
          fontFamily: "var(--font-dm-sans), sans-serif",
          marginTop: 48,
          fontSize: 17,
          color: "#547863",
          letterSpacing: 0.2,
          textAlign: "center",
          minHeight: 24,
        }}
      >
        {messages[idx]}
      </div>
    </section>
  );
}
