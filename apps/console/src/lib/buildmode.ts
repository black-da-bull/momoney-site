// Build-mode signal detection (soul §1): "make me the prompt," "run it,"
// "give me the triad," "lock it." Detection routes to the factory; in this slice
// the factory is a stub and Maestro says so in-voice.

const SIGNALS: RegExp[] = [
  /\bmake (me )?the prompts?\b/i,
  /\bmake me the prompt\b/i,
  /\brun it\b/i,
  /\bgive me the triad\b/i,
  /\bthe triad\b/i,
  /\block it\b/i,
  /\bbuild (it|the (song|track|prompt))\b/i,
  /\bsession sheet\b/i,
  /\bsuno prompts?\b/i,
];

export function detectBuildSignal(text: string): boolean {
  return SIGNALS.some((r) => r.test(text));
}
