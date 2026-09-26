'use client'

// Shared between magicus (/map) and the control layer (/agents, /track). Keep the two
// copies byte-identical: they are one file living in two repos until the zones merge.
// Inline styles on purpose, so neither repo's stylesheet can make them drift apart.

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'
import { setDemoMode, useDemoMode, withMode, type DemoMode } from './demo-mode'

type Zone = 'map' | 'control'

const MAP_HREF = process.env.NEXT_PUBLIC_MAP_URL ?? '/map'

/** The workflow each agent automates, as its map's path under /map. */
const MAP_FOR: Record<DemoMode, string> = {
  invoices: 'invoice-check',
  contracts: 'contract-review',
}

type Step = { label: string; href: (mode: DemoMode) => string; zone: Zone; active: (path: string) => boolean }

/** Where work gets stuck, how it runs today, the agent at work, and what it found. */
const AGENT_SCREENS = ['/agents', '/agents/reading', '/agents/connect', '/agents/audit']
const STEPS: Step[] = [
  { label: 'Frictions', href: () => MAP_HREF, zone: 'map', active: (p) => p === '/map' },
  { label: 'Map', href: (mode) => `${MAP_HREF}/${MAP_FOR[mode]}`, zone: 'map', active: (p) => p.startsWith('/map/') },
  { label: 'Agent', href: () => '/agents', zone: 'control', active: (p) => AGENT_SCREENS.includes(p) },
  {
    label: 'Result',
    href: () => '/agents/answer',
    zone: 'control',
    active: (p) => p === '/track' || p.startsWith('/track/') || (p.startsWith('/agents/') && !AGENT_SCREENS.includes(p)),
  },
]

const C = {
  bg: '#F7FAF2',
  ink: '#3B4953',
  sage: '#547863',
  surface: '#EBF4DD',
  rule: '#E3EAD8',
  white: '#FFFFFF',
}

const SANS = 'var(--font-dm-sans), system-ui, sans-serif'
const SERIF = 'var(--font-dm-serif), Georgia, serif'

/** Keeps the mode in step with ?mode= as the viewer moves around inside a zone. */
function ModeFromUrl() {
  const params = useSearchParams()
  const fromUrl = params.get('mode')
  useEffect(() => {
    if (fromUrl === 'invoices' || fromUrl === 'contracts') setDemoMode(fromUrl)
  }, [fromUrl])
  return null
}

export function DemoHeader({ zone, children }: { zone: Zone; children?: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const mode = useDemoMode()

  return (
    <header
      style={{
        position: 'sticky',
        top: 'env(safe-area-inset-top, 0px)',
        zIndex: 40,
        background: C.bg,
        borderBottom: `1px solid ${C.rule}`,
        fontFamily: SANS,
      }}
    >
      <ModeFromUrlBoundary />
      <div
        style={{
          maxWidth: 1600,
          margin: '0 auto',
          padding: '0 32px',
          height: 64,
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 24,
        }}
      >
        <HeaderLink href={withMode(MAP_HREF, mode)} inZone={zone === 'map'} label="Magicus, back to the start">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
            <Mark />
            <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 25, color: C.ink, letterSpacing: '-0.01em', lineHeight: 1 }}>
              magicus
            </span>
          </span>
        </HeaderLink>

        <nav aria-label="Demo" style={{ display: 'flex', alignItems: 'center', gap: 4, background: C.white, border: `1px solid ${C.rule}`, borderRadius: 999, padding: 4 }}>
          {STEPS.map((step, index) => {
            const active = step.active(pathname)
            return (
              <HeaderLink key={step.label} href={withMode(step.href(mode), mode)} inZone={step.zone === zone} current={active}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    height: 32,
                    padding: '0 16px 0 8px',
                    borderRadius: 999,
                    fontSize: 14,
                    fontWeight: 500,
                    color: active ? C.ink : C.sage,
                    background: active ? C.surface : 'transparent',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 20,
                      height: 20,
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      color: active ? C.white : C.sage,
                      background: active ? C.sage : C.surface,
                    }}
                  >
                    {index + 1}
                  </span>
                  {step.label}
                </span>
              </HeaderLink>
            )
          })}
        </nav>

        <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 16 }}>
          {children}
          {/* On the map the friction chosen sets the lead; the toggle only matters past it. */}
          {zone === 'control' ? <ModeToggle mode={mode} /> : null}
        </div>
      </div>
    </header>
  )
}

function ModeFromUrlBoundary() {
  // useSearchParams needs a Suspense boundary to keep the page statically renderable.
  return (
    <Suspense fallback={null}>
      <ModeFromUrl />
    </Suspense>
  )
}

function HeaderLink({
  href,
  inZone,
  current,
  label,
  children,
}: {
  href: string
  inZone: boolean
  current?: boolean
  label?: string
  children: React.ReactNode
}) {
  const common = {
    'aria-current': current ? ('page' as const) : undefined,
    'aria-label': label,
    style: { textDecoration: 'none' },
  }
  // A client-side hop into the other zone would load the wrong app's payload, so
  // anything outside this zone is a plain full-page link.
  return inZone ? (
    <Link href={href} {...common}>
      {children}
    </Link>
  ) : (
    <a href={href} {...common}>
      {children}
    </a>
  )
}

function ModeToggle({ mode }: { mode: DemoMode }) {
  const router = useRouter()
  const pathname = usePathname() ?? ''

  function choose(next: DemoMode) {
    setDemoMode(next)
    // Read at click time rather than subscribing, so the header never needs its own
    // Suspense boundary just to render.
    const query = new URLSearchParams(window.location.search)
    if (next === 'invoices') query.delete('mode')
    else query.set('mode', next)
    const qs = query.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <div role="group" aria-label="Lead with" style={{ display: 'inline-flex', border: `1px solid ${C.rule}`, borderRadius: 8, overflow: 'hidden' }}>
      {(['invoices', 'contracts'] as const).map((option) => {
        const on = option === mode
        return (
          <button
            key={option}
            type="button"
            aria-pressed={on}
            onClick={() => choose(option)}
            style={{
              fontFamily: SANS,
              fontSize: 12,
              fontWeight: 500,
              height: 28,
              padding: '0 12px',
              border: 'none',
              cursor: 'pointer',
              color: on ? C.ink : C.sage,
              background: on ? C.surface : C.white,
            }}
          >
            {option === 'invoices' ? 'Invoices' : 'Contracts'}
          </button>
        )
      })}
    </div>
  )
}

/** The Magicus butterfly, sage variant. Geometry from magicus/app/components/logo.tsx. */
function Mark() {
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <ellipse cx="8.5" cy="11" rx="5" ry="7.2" fill={C.sage} />
      <ellipse cx="15.5" cy="11" rx="5" ry="7.2" fill={C.sage} />
      <line x1="12" y1="3.2" x2="12" y2="20.8" stroke={C.ink} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
