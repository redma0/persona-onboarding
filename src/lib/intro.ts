// The scripted opener and when to use it.

const EXAMPLES = `people text me things like "find a dentist that takes my insurance" or "is anyone waiting on a reply from me?"`;
const NAME_ASK = "i don't have a name yet though. what should i go by?";

/** Opener bubbles: answer "what's a persona?" literally when asked, otherwise a plain hello. */
export function introFor(firstText: string): string[] {
  const asked = /persona|what|who/i.test(firstText);
  return [
    asked
      ? "it's me, your new assistant. i live in your texts and handle the annoying stuff"
      : "hey! i'm your new assistant. i live in your texts and handle the annoying stuff",
    EXAMPLES,
    NAME_ASK,
  ];
}

/** Prefilled first text after "Continue with iMessage". */
export const FIRST_DRAFT = "Hey, what's a persona?";

/** Pure greetings / "what is this" get the scripted intro; anything else goes to the agent. */
export const GREETING = /^\s*(hi+|hey+|hello+|yo+|sup|hiya|howdy)?[\s,!.]*((what'?s|what is|who'?s|who is) (a |an |this|that|up|persona|you)[\w\s]*)?[\s?!.👋]*$/i;
