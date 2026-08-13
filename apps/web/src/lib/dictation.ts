'use client';

/**
 * Dictation via the browser's own speech recognition.
 *
 * Talking is the easiest thing a person does and writing 60,000 words is the
 * hardest, so this is the shortest path from what an author knows to words on
 * the page. It runs entirely in the browser — no audio leaves the device, no
 * API cost, nothing to bill.
 *
 * Chromium and Safari support it; Firefox does not. `isSupported()` lets the UI
 * hide the affordance rather than offer a button that does nothing.
 */

type SR = any;

function ctor(): SR | null {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function isSupported(): boolean {
  return ctor() !== null;
}

export interface DictationHandle {
  stop: () => void;
}

interface Options {
  /** Fires as you speak, replacing the previous interim text. */
  onInterim?: (text: string) => void;
  /** Fires when a phrase settles. This is the text to insert. */
  onFinal: (text: string) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
  lang?: string;
}

export function startDictation({ onInterim, onFinal, onError, onEnd, lang }: Options): DictationHandle | null {
  const Ctor = ctor();
  if (!Ctor) {
    onError?.('This browser cannot do speech recognition. Chrome, Edge and Safari can.');
    return null;
  }

  const rec: SR = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = lang || (typeof navigator !== 'undefined' ? navigator.language : 'en-US') || 'en-US';

  // The recogniser stops itself after a pause; restart until the user says stop.
  let stopping = false;

  rec.onresult = (event: any) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0]?.transcript ?? '';
      if (result.isFinal) {
        const trimmed = text.trim();
        if (trimmed) onFinal(trimmed);
      } else {
        interim += text;
      }
    }
    onInterim?.(interim);
  };

  rec.onerror = (event: any) => {
    if (event.error === 'no-speech' || event.error === 'aborted') return;
    onError?.(
      event.error === 'not-allowed'
        ? 'Microphone access was blocked. Allow it in your browser settings and try again.'
        : `Dictation stopped: ${event.error}`,
    );
  };

  rec.onend = () => {
    if (stopping) { onEnd?.(); return; }
    try { rec.start(); } catch { onEnd?.(); }
  };

  try {
    rec.start();
  } catch (e: any) {
    onError?.(e?.message || 'Could not start dictation.');
    return null;
  }

  return {
    stop: () => {
      stopping = true;
      try { rec.stop(); } catch { /* already stopped */ }
    },
  };
}
