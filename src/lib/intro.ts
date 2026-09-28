// The scripted opener (mirrors Persona's own intro) and when to use it.

export const INTRO = [
  "hey! i'm your new personal assistant",
  "you can text me or call me anytime and i can help with:\n📞 talking things through on a quick call\n💻 digging through the web for answers\n🛍️ finding and comparing stuff to buy\n✉️ sorting your email and calendar\n🚗 finding DoorDash or Uber options",
  "first things first, what should my name be?",
];

/** Prefilled first text after "Continue with iMessage". */
export const FIRST_DRAFT = "Hey, what's a persona?";

/** Pure greetings / "what is this" get the scripted intro; anything else goes to the agent. */
export const GREETING = /^\s*(hi+|hey+|hello+|yo+|sup|hiya|howdy)?[\s,!.]*((what'?s|what is|who'?s|who is) (a |an |this|that|up|persona|you)[\w\s]*)?[\s?!.👋]*$/i;
