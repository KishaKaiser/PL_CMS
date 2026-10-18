/**
 * The fixed lines callers and advisors hear on the phone. Each can be replaced by a recording uploaded in Admin;
 * without one, the computer voice reads the line. Lines that include a name, a price or a place in line cannot be
 * recorded whole, so where one has a recordable version it is worded without them.
 */
export type PromptKey =
  | 'call.client-press1'
  | 'call.client-press1-scheduled'
  | 'call.client-press1-callback'
  | 'call.advisor-press1'
  | 'call.advisor-press1-scheduled'
  | 'call.advisor-press1-callback'
  | 'call.advisor-unavailable'
  | 'call.low-balance-client'
  | 'call.low-balance-advisor'
  | 'call.out-of-funds-client'
  | 'call.out-of-funds-advisor'
  | 'call.invalid-choice'
  | 'call.hold-contacting'
  | 'call.connected'
  | 'call.hold-music'
  | 'hotline.menu'
  | 'hotline.menu-retry'
  | 'hotline.no-account'
  | 'hotline.nothing-entered'
  | 'hotline.extension-not-found'
  | 'hotline.no-advisors'
  | 'hotline.all-busy'
  | 'hotline.balance-too-low'
  | 'hotline.callback-offer'
  | 'hotline.generic-failure'
  | 'hotline.goodbye';

/** Something to say: the line's key (so a recording can be used) and the words for the computer voice. */
export interface Spoken {
  key: PromptKey;
  text: string;
}

export type Say = string | Spoken;

export function textOf(say: Say): string {
  return typeof say === 'string' ? say : say.text;
}

export interface PromptDefinition {
  key: PromptKey;
  group: 'Calls' | 'Hotline' | 'Music';
  /** A music slot loops while callers wait; it is not a line of speech. */
  kind?: 'line' | 'music';
  label: string;
  /** When the caller or advisor hears it. */
  when: string;
  /** What to say when recording it. */
  recordingText: string;
  /** Anything the person recording should know. */
  note?: string;
}

const NAME_NOTE = "The computer voice includes the advisor's name; your recording leaves it out.";

export const PROMPT_DEFINITIONS: PromptDefinition[] = [
  {
    key: 'call.client-press1',
    group: 'Calls',
    label: 'Client: start the call',
    when: 'The client picks up after pressing Call Now and is asked to press 1.',
    recordingText: 'Welcome to The Psychic Link. To begin your call, press 1 now.',
  },
  {
    key: 'call.client-press1-scheduled',
    group: 'Calls',
    label: 'Client: scheduled call',
    when: 'The client picks up for a booked appointment.',
    recordingText: 'Welcome to The Psychic Link. This is your scheduled call. To begin your call, press 1 now.',
    note: NAME_NOTE,
  },
  {
    key: 'call.client-press1-callback',
    group: 'Calls',
    label: 'Client: callback from the line',
    when: 'The client picks up when their turn in the callback line comes.',
    recordingText: 'Welcome to The Psychic Link. Your advisor is ready to take your call now. To begin your call, press 1 now.',
    note: NAME_NOTE,
  },
  {
    key: 'call.advisor-press1',
    group: 'Calls',
    label: 'Advisor: accept a call',
    when: 'The advisor picks up when a client has chosen them.',
    recordingText: 'You have a call from The Psychic Link. Press 1 to accept this call.',
  },
  {
    key: 'call.advisor-press1-scheduled',
    group: 'Calls',
    label: 'Advisor: scheduled call',
    when: 'The advisor picks up for a booked appointment.',
    recordingText: 'You have a scheduled call from The Psychic Link. Press 1 to accept this call.',
  },
  {
    key: 'call.advisor-press1-callback',
    group: 'Calls',
    label: 'Advisor: next client in the line',
    when: 'The advisor picks up for the next client in their callback line.',
    recordingText: 'The next client in your queue is ready. Press 1 to accept this call.',
  },
  {
    key: 'call.advisor-unavailable',
    group: 'Calls',
    label: 'Client: advisor could not be reached',
    when: 'The advisor did not answer or did not accept, and the client is told before the line is dropped.',
    recordingText: 'We are sorry, your advisor is unavailable right now. You have not been charged. Goodbye.',
  },
  {
    key: 'call.low-balance-client',
    group: 'Calls',
    label: 'Client: balance running low',
    when: 'About a minute before the client runs out of funds, during the call.',
    recordingText:
      'Your balance is running low. This call will end in about one minute unless you add funds to your wallet on the website.',
  },
  {
    key: 'call.low-balance-advisor',
    group: 'Calls',
    label: 'Advisor: client balance running low',
    when: 'The same moment, spoken to the advisor.',
    recordingText: "The client's balance is running low. This call will end in about one minute.",
  },
  {
    key: 'call.out-of-funds-client',
    group: 'Calls',
    label: 'Client: out of funds',
    when: 'The client has run out of funds and the call is ending.',
    recordingText: 'Your balance has run out, so this call is ending. Goodbye.',
  },
  {
    key: 'call.out-of-funds-advisor',
    group: 'Calls',
    label: 'Advisor: client out of funds',
    when: 'The same moment, spoken to the advisor.',
    recordingText: "The client's balance has run out, so this call is ending. Goodbye.",
  },
  {
    key: 'call.invalid-choice',
    group: 'Calls',
    label: 'Wrong key pressed',
    when: 'Someone presses a key other than 1 at a "press 1" prompt.',
    recordingText: 'That was not a valid choice.',
  },
  {
    key: 'call.hold-contacting',
    group: 'Calls',
    label: 'Client: please hold',
    when: "The client has pressed 1 and the advisor's phone is being rung. Hold music follows, if you have uploaded some.",
    recordingText: 'Please hold while I contact your advisor.',
  },
  {
    key: 'call.connected',
    group: 'Calls',
    label: 'Client: you are now connected',
    when: 'The advisor has accepted, just before the two of them are connected.',
    recordingText: 'You are now connected.',
  },
  {
    key: 'call.hold-music',
    group: 'Music',
    kind: 'music',
    label: 'Hold music',
    when: 'Plays on a loop while the client waits for the advisor to answer, after the "please hold" line, and stops the moment the advisor accepts.',
    recordingText: 'Any music you have the right to use, such as royalty-free or licensed music.',
    note: 'MP3 or WAV, up to 15 MB. Phone lines make music sound thin, so calm music with few instruments works best.',
  },
  {
    key: 'hotline.menu',
    group: 'Hotline',
    label: 'Hotline: welcome and menu',
    when: 'A caller reaches the hotline and has been recognised by their phone number.',
    recordingText:
      "Welcome to The Psychic Link. Please enter your advisor's extension, followed by the pound key. Or press 0 to be connected with the first available advisor.",
  },
  {
    key: 'hotline.menu-retry',
    group: 'Hotline',
    label: 'Hotline: extension not found, try again',
    when: 'The caller keyed an extension that does not exist (up to three tries).',
    recordingText:
      "We could not find that extension. Please enter your advisor's extension, followed by the pound key. Or press 0 to be connected with the first available advisor.",
  },
  {
    key: 'hotline.no-account',
    group: 'Hotline',
    label: 'Hotline: phone number not recognised',
    when: 'No account matches the number the caller is dialling from, or several accounts share it.',
    recordingText:
      'We could not find an account for the phone number you are calling from. Please sign in to The Psychic Link website and save this phone number to your account, then call again. Goodbye.',
  },
  {
    key: 'hotline.nothing-entered',
    group: 'Hotline',
    label: 'Hotline: nothing entered',
    when: 'The caller pressed nothing at the menu.',
    recordingText: 'We did not receive a selection. Please call again. Goodbye.',
  },
  {
    key: 'hotline.extension-not-found',
    group: 'Hotline',
    label: 'Hotline: extension not found, giving up',
    when: 'The caller keyed a wrong extension three times.',
    recordingText: 'We could not find that extension. Please check it and call again. Goodbye.',
  },
  {
    key: 'hotline.no-advisors',
    group: 'Hotline',
    label: 'Hotline: no advisors online',
    when: 'The caller pressed 0 and no advisor is online.',
    recordingText: 'We are sorry, no advisors are available right now. Please try again later. Goodbye.',
  },
  {
    key: 'hotline.all-busy',
    group: 'Hotline',
    label: 'Hotline: all advisors busy',
    when: 'The caller pressed 0 and every online advisor is with another caller.',
    recordingText:
      'We are sorry, all of our advisors are with other callers right now. Please try again in a few minutes. Goodbye.',
  },
  {
    key: 'hotline.balance-too-low',
    group: 'Hotline',
    label: 'Hotline: balance too low',
    when: 'The caller pressed 0 and cannot afford any advisor who is free.',
    recordingText:
      'Your wallet balance is too low for the advisors who are available. Please add funds on The Psychic Link website and call again. Goodbye.',
  },
  {
    key: 'hotline.callback-offer',
    group: 'Hotline',
    label: 'Hotline: offer a callback',
    when: 'The advisor the caller chose is busy or offline, and the caller is offered a callback.',
    recordingText:
      'Your advisor is not available right now. To have us call you back at this number as soon as they are free, press 1. Otherwise, you can hang up.',
    note: "The computer voice says the advisor's name and whether they are busy or offline; your recording says neither.",
  },
  {
    key: 'hotline.generic-failure',
    group: 'Hotline',
    label: 'Hotline: something went wrong',
    when: 'The hotline could not complete a request for a reason the caller cannot fix.',
    recordingText:
      'We are sorry, we could not connect your call. You have not been charged. Please try again later. Goodbye.',
  },
  {
    key: 'hotline.goodbye',
    group: 'Hotline',
    label: 'Hotline: goodbye',
    when: 'The caller declines a callback and the call ends.',
    recordingText: 'Goodbye.',
  },
];

export const PROMPT_KEYS = new Set<string>(PROMPT_DEFINITIONS.map((definition) => definition.key));

/** Lines that are never recorded because they carry a price, a name or a place in line:
 * "You have chosen Ada, at 2 dollars per minute", the callback confirmation, and explanations of why a call failed. */
export const COMPUTER_VOICE_ONLY_NOTE =
  'Lines that include an advisor, a price or your place in line (for example "You have chosen … at 2 dollars per minute") are always read by the computer voice.';
