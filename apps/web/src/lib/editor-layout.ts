'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Layout state for the editor's three columns, remembered between sessions.
 *
 * Writing is the job; the panels are in service of it. So the outline gets out
 * of the way once you start typing, and comes back when you reach for it.
 */

const KEY = 'ub_editor_layout_v1';

export type OutlineMode = 'auto' | 'pinned';

interface Stored {
  outlineMode: OutlineMode;
  panelWidth: number;
  tab: string;
}

const DEFAULTS: Stored = { outlineMode: 'auto', panelWidth: 420, tab: 'assistant' };

export const PANEL_MIN = 320;
export const PANEL_MAX = 900;

function read(): Stored {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return DEFAULTS;
  }
}

function write(patch: Partial<Stored>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), ...patch }));
  } catch {
    /* private browsing */
  }
}

export function useEditorLayout() {
  // Read after mount so the server and first client render agree.
  const [ready, setReady] = useState(false);
  const [outlineMode, setOutlineModeState] = useState<OutlineMode>(DEFAULTS.outlineMode);
  const [panelWidth, setPanelWidthState] = useState(DEFAULTS.panelWidth);
  const [tab, setTabState] = useState(DEFAULTS.tab);

  const [typing, setTyping] = useState(false);
  const [peeking, setPeeking] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    const s = read();
    setOutlineModeState(s.outlineMode);
    setPanelWidthState(Math.min(PANEL_MAX, Math.max(PANEL_MIN, s.panelWidth)));
    setTabState(s.tab);
    setReady(true);
  }, []);

  const setOutlineMode = useCallback((m: OutlineMode) => {
    setOutlineModeState(m);
    write({ outlineMode: m });
    if (m === 'pinned') setTyping(false);
  }, []);

  const setPanelWidth = useCallback((w: number) => {
    const clamped = Math.min(PANEL_MAX, Math.max(PANEL_MIN, Math.round(w)));
    setPanelWidthState(clamped);
    write({ panelWidth: clamped });
  }, []);

  const setTab = useCallback((t: string) => {
    setTabState(t);
    write({ tab: t });
  }, []);

  /** Called on the first keystroke — collapses the outline in auto mode. */
  const noteTyping = useCallback(() => {
    setTyping(true);
    setPeeking(false);
  }, []);

  const outlineCollapsed = outlineMode === 'auto' && typing && !peeking;
  /** Peeking overlays rather than reflows, so text never shifts under the caret. */
  const outlineOverlaid = outlineMode === 'auto' && typing && peeking;

  return {
    ready,
    outlineMode, setOutlineMode,
    outlineCollapsed, outlineOverlaid,
    setPeeking, noteTyping,
    panelWidth, setPanelWidth,
    panelOpen, setPanelOpen,
    tab, setTab,
  };
}

/** Drag-to-resize for the right panel. Widths grow leftwards. */
export function usePanelResize(current: number, commit: (w: number) => void) {
  const dragging = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    const startX = e.clientX;
    const startW = current;

    const move = (ev: PointerEvent) => {
      if (!dragging.current) return;
      commit(startW + (startX - ev.clientX));
    };
    const up = () => {
      dragging.current = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [current, commit]);

  return { onPointerDown };
}
