"use client";

import { useState, type CSSProperties } from "react";
import { useChat } from "@ai-sdk/react";
import type { ChatMessage } from "@/lib/types";
import type { ListingRef } from "@/lib/listings";

const SUGGESTIONS = [
  "Where can I get breakfast in Brookline?",
  "A waterfront spot for date night?",
  "A wedding venue for about 150 guests.",
];

const CATEGORY_COLOR: Record<ListingRef["category"], string> = {
  dining: "var(--c-dining)",
  lodging: "var(--c-lodging)",
  attraction: "var(--c-attraction)",
  venue: "var(--c-venue)",
};

function Entries({ listings }: { listings: ListingRef[] }) {
  if (listings.length === 0) return null;
  return (
    <div className="entries">
      {listings.map((l) => (
        <article
          className="entry"
          key={l.id}
          style={{ "--cat": CATEGORY_COLOR[l.category] } as CSSProperties}
        >
          <div className="entry-top">
            <span className="entry-code">{l.id}</span>
            <span className="tag">{l.category}</span>
          </div>
          <h3 className="entry-name">{l.name}</h3>
          <p className="entry-meta">
            {l.city} <span className="price">· {l.priceTier}</span>
          </p>
          {l.externalUrl ? (
            <a
              className="entry-link"
              href={l.externalUrl}
              target="_blank"
              rel="noreferrer"
            >
              Visit site ↗
            </a>
          ) : (
            <span className="entry-nolink">No link on file</span>
          )}
        </article>
      ))}
    </div>
  );
}

export default function Home() {
  const { messages, sendMessage, status, setMessages } = useChat<ChatMessage>();
  const [input, setInput] = useState("");
  const busy = status === "submitted" || status === "streaming";

  // Show the loader for the whole in-flight window — from the moment a question
  // is sent until the assistant has actually rendered text or cards. This covers
  // the silent gap while the model is searching the registry (running tools).
  const last = messages.at(-1);
  const lastAssistantRendered =
    last?.role === "assistant" &&
    last.parts.some(
      (p) =>
        (p.type === "text" && p.text.trim().length > 0) ||
        (p.type === "data-listings" && p.data.listings.length > 0) ||
        p.type === "data-integrity",
    );
  const showLoader = busy && !lastAssistantRendered;

  const submit = (text: string) => {
    const value = text.trim();
    if (!value || busy) return;
    setInput("");
    void sendMessage({ text: value });
  };

  // The disclaimer arrives as a data part; fall back before the first response.
  let disclaimer =
    "AI can be wrong — please verify details before you rely on them.";
  for (const m of messages) {
    for (const part of m.parts) {
      if (part.type === "data-disclaimer") disclaimer = part.data.text;
    }
  }

  const goHome = () => {
    if (busy) return;
    setMessages([]);
    setInput("");
  };

  return (
    <main className="page">
      <button
        type="button"
        className="home-btn"
        aria-label="Back to home — start a new conversation"
        title="Back to home"
        onClick={goHome}
        disabled={busy}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
          <path d="M9.5 20v-6h5v6" />
        </svg>
      </button>

      <header className="masthead">
        <div className="eyebrow">The Local Registry · grounded concierge</div>
        <h1 className="wordmark">Find a place, on the record.</h1>
        <p className="lede">
          A vetted guide to Brookline, Cape Vernon &amp; Ridgeway. Ask for
          somewhere to eat, stay, visit, or host — every answer comes straight
          from the registry, never invented and never off-list.
        </p>
        <p className="disclaimer">
          <span className="badge">NOTE</span>
          {disclaimer}
        </p>
      </header>

      {messages.length === 0 ? (
        <>
          <p className="start-label">Start with one of these</p>
          <div className="chips">
            {SUGGESTIONS.map((s) => (
              <button
                type="button"
                className="chip"
                key={s}
                onClick={() => submit(s)}
              >
                <span className="ask">?</span>
                <span>{s}</span>
                <span className="go">Ask →</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="thread">
          {messages.map((m) => (
            <div className={`turn ${m.role}`} key={m.id}>
              <div className="who">
                {m.role === "user" ? "You" : "Registry concierge"}
              </div>
              {m.parts.map((part, i) => {
                if (part.type === "text") {
                  return (
                    <div className="say" key={i}>
                      {part.text}
                    </div>
                  );
                }
                if (part.type === "data-listings") {
                  return <Entries key={i} listings={part.data.listings} />;
                }
                if (part.type === "data-integrity") {
                  return (
                    <div className="integrity" key={i}>
                      {part.data.message}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          ))}
          {showLoader && (
            <div className="turn assistant">
              <div className="who">Registry concierge</div>
              <div className="thinking">
                <span className="dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                Consulting the registry…
              </div>
            </div>
          )}
        </div>
      )}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
      >
        <div className="composer-inner">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about places to eat, stay, visit, or host…"
            aria-label="Message"
          />
          <button type="submit" disabled={busy || !input.trim()}>
            {busy ? <span className="spinner" aria-label="Working" /> : "Ask"}
          </button>
        </div>
      </form>
    </main>
  );
}
