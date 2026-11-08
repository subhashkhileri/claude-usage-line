import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit, Usage } from '../types'

const usage = atom({ plugin: 'usage-line', key: 'usage' } as const, null)

const pct = (v: number | null | undefined) => (v == null ? '--' : `${Math.round(v)}%`)

const left = (resetsAt: string | undefined, now: number) => {
  if (!resetsAt) return ''
  const t = Date.parse(resetsAt)
  if (Number.isNaN(t)) return ''
  let s = Math.max(0, Math.floor((t - now) / 1000))
  const d = Math.floor(s / 86400); s -= d * 86400
  const h = Math.floor(s / 3600); s -= h * 3600
  const m = Math.floor(s / 60)
  const txt = d ? `${d}d${h}h` : h ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m`
  return txt
}

const snap = (ctx: number | undefined, rl: Limit[]): Usage => ({
  ctx: ctx ?? null,
  limits: rl.map(l => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt })),
})

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const u = await $.session.usage()
    await update($, usage, () => snap(u.context.percent, u.rateLimits))
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await update($, usage, () => snap(e.context.percent, e.rateLimits))
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const u = await read($, usage)
    if (!u) return next(e)
    const now = await $.clock.now()
    const get = (k: string) => u.limits.find(l => l.kind === k)
    const { Box, Text } = $.ui.resolve(e)

    // green under 50%, amber under 80%, red from 80%
    const tone = (v: number | null | undefined) =>
      v == null ? 'inactive' : v >= 80 ? 'error' : v >= 50 ? 'warning' : 'success'
    // five-cell bar: ▰▰▱▱▱
    const bar = (v: number | null | undefined) => {
      const n = v == null ? 0 : Math.min(5, Math.round(v / 20))
      return '▰'.repeat(n) + '▱'.repeat(5 - n)
    }

    const cell = (key: string, label: string, v: number | null | undefined, resetsAt?: string) => {
      const r = left(resetsAt, now)
      return (
        <Box key={key} flexDirection="row" gap={1}>
          <Text dimColor>{label}</Text>
          <Text color={tone(v)}>{bar(v)}</Text>
          <Text color={tone(v)} bold tabular>{pct(v).padStart(4)}</Text>
          {r ? <Text dimColor tabular>{'↻ ' + r}</Text> : null}
        </Box>
      )
    }
    const sep = (key: string) => <Text key={key} dimColor>│</Text>

    const f = get('five_hour')
    const w = get('seven_day')
    return (
      <Box flexDirection="row" gap={2} paddingX={1}>
        {cell('ctx', 'ctx', u.ctx)}
        {sep('s1')}
        {cell('5h', '5h', f?.percentUsed, f?.resetsAt)}
        {sep('s2')}
        {cell('wk', 'week', w?.percentUsed, w?.resetsAt)}
      </Box>
    )
  })
}
