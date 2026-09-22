'use client'

// Shared between magicus (/map) and the control layer (/agents, /track). Keep the two
// copies byte-identical: they are one file living in two repos until the zones merge.

import { useSyncExternalStore } from 'react'

export type DemoMode = 'invoices' | 'contracts'

const STORAGE_KEY = 'magicus:mode'
const DEFAULT_MODE: DemoMode = 'invoices'

let current: DemoMode | null = null
const listeners = new Set<() => void>()

function parse(value: string | null | undefined): DemoMode | null {
  return value === 'invoices' || value === 'contracts' ? value : null
}

function readStored(): DemoMode | null {
  try {
    return parse(window.sessionStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

/** The URL wins, then this tab's session, then invoices. */
function initial(): DemoMode {
  const fromUrl = parse(new URLSearchParams(window.location.search).get('mode'))
  return fromUrl ?? readStored() ?? DEFAULT_MODE
}

function snapshot(): DemoMode {
  if (current === null) {
    current = initial()
    remember(current)
  }
  return current
}

function remember(mode: DemoMode) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Private windows can refuse storage. The URL still carries the mode.
  }
}

export function setDemoMode(mode: DemoMode) {
  if (mode === current) return
  current = mode
  remember(mode)
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useDemoMode(): DemoMode {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT_MODE)
}

/**
 * Carry the mode on a link. Invoices is the default, so only contracts is written:
 * a clean URL for the common path, and an explicit one when it matters.
 */
export function withMode(href: string, mode: DemoMode): string {
  if (mode === DEFAULT_MODE) return href
  const [path, hash] = href.split('#')
  const joined = `${path}${path.includes('?') ? '&' : '?'}mode=${mode}`
  return hash ? `${joined}#${hash}` : joined
}
