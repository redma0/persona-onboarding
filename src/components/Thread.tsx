"use client";
// The iMessage thread: bubbles (with link previews), cards, call stamps, Delivered/Read, typing.
import { forwardRef } from "react";
import type { ChatItem, OnboardingState } from "@/lib/types";
import { IBubble, ITyping, ThreadStamp } from "./ios";
import { ContactCard, GoogleLinkCard, LinkPreview, splitLinks } from "./cards";
import { BandLink } from "./band";

interface Props {
  items: ChatItem[];
  state: OnboardingState;
  typing: boolean;
  startedAt: number | null;
  googleWaiting: boolean;
  contactSaved: boolean;
  onSaveContact: (name: string) => void;
  onConnectGoogle: () => void;
  onDemoGoogle: () => void;
  onOpenBand: () => void;
}

export const Thread = forwardRef<HTMLDivElement, Props>(function Thread(
  { items, state, typing, startedAt, googleWaiting, contactSaved, onSaveContact, onConnectGoogle, onDemoGoogle, onOpenBand },
  ref,
) {
  const lastUserIdx = items.map((i) => i.role === "user" && i.kind === "text").lastIndexOf(true);
  const lastLinkId = [...items].reverse().find((i) => i.kind === "google_link")?.id;
  const opened = items[0]?.at ?? startedAt;

  return (
    <div ref={ref} className="absolute inset-0 overflow-y-auto no-scrollbar px-[16px] pt-[calc(max(env(safe-area-inset-top),14px)+96px)] sm:pt-[150px] pb-[96px] flex flex-col">
      <ThreadStamp top="iMessage" bottom={`Today ${opened ? new Date(opened).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}`} />
      {items.map((it, idx) => {
        const next = items[idx + 1];
        const prev = items[idx - 1];
        // like iOS: only the last bubble in a run from the same sender gets a tail
        const tail = !next || next.role !== it.role || !["text", "band_card"].includes(next.kind);
        const gap = !prev ? "" : prev.role !== it.role || prev.kind !== it.kind ? "mt-[10px]" : "mt-[2px]";
        return (
          <div key={it.id} className={gap}>
            {it.kind === "text" && <TextItem item={it} tail={tail} />}
            {idx === lastUserIdx && (
              <div className="text-right text-[11px] leading-[13px] text-[#8e8e93] mt-[3px] mr-[4px] fade-in">
                {items.slice(idx + 1).some((x) => x.role === "agent") || typing ? "Read" : "Delivered"}
              </div>
            )}
            {it.kind === "contact_card" && <ContactCard name={it.text!} saved={contactSaved} onSave={() => onSaveContact(it.text!)} />}
            {it.kind === "google_link" && (
              <GoogleLinkCard
                onConnect={onConnectGoogle}
                onDemo={onDemoGoogle}
                state={state.google.status === "connected" ? "connected" : googleWaiting && it.id === lastLinkId ? "waiting" : "idle"}
              />
            )}
            {it.kind === "band_card" && <BandLink onOpen={onOpenBand} />}
            {it.kind === "call_log" && <ThreadStamp bottom={it.text!} />}
          </div>
        );
      })}
      {typing && <div className="mt-[10px] mb-[4px]"><ITyping /></div>}
    </div>
  );
});

/** Agent links render like iMessage: the text, then a rich preview card per URL. */
function TextItem({ item, tail }: { item: ChatItem; tail: boolean }) {
  const me = item.role === "user";
  const { rest, urls } = me ? { rest: item.text || "", urls: [] as string[] } : splitLinks(item.text || "");
  return (
    <>
      {rest && <IBubble text={rest} me={me} tail={tail && !urls.length} />}
      {urls.map((u, k) => (
        <div key={u} className={rest || k ? "mt-[2px]" : ""}><LinkPreview url={u} tail={tail && k === urls.length - 1} /></div>
      ))}
    </>
  );
}
