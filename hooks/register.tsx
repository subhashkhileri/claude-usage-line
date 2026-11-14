import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit, Model, Usage } from '../types'

const usage = atom({ plugin: 'usage-line', key: 'usage' } as const, null)
const model = atom({ plugin: 'usage-line', key: 'model' } as const, null)

// claude-fable-5-2-20260101 -> fable-5-2, Fable 5.2 -> fable-5-2, fable[1m] -> fable
const short = (id: string) =>
  id.toLowerCase().replace(/\[.*\]$/, '').replace(/[ .]+/g, '-').replace(/^claude-/, '').replace(/-\d{8}$/, '')

const LEVELS = ['low', 'medium', 'high', 'xhigh', 'max']
const level = (v: unknown) => (typeof v === 'string' && LEVELS.includes(v) ? v : null)

// What a new session will send before any request confirms it: the effort saved
// for the model in settings (modelSettings.<id>.effortLevel, else effortLevel),
// overridden by CLAUDE_CODE_EFFORT_LEVEL and capped by maxEffortLevel.
const saved = (name: string, settings: Record<string, unknown>, env: string | undefined): Model => {
  const per = (settings.modelSettings ?? {}) as Record<string, { effortLevel?: unknown } | null>
  const n = short(name)
  // `fable` is an alias of the newest fable-* id that has settings
  const ids = Object.keys(per).filter(k => short(k) === n || short(k).startsWith(n + '-')).sort()
  const id = ids.find(k => short(k) === n) ?? ids.at(-1)
  const cap = level(settings.maxEffortLevel)
  let effort = env === undefined
    ? level(id ? per[id]?.effortLevel : undefined) ?? level(settings.effortLevel)
    : level(env)
  if (effort && cap && LEVELS.indexOf(effort) > LEVELS.indexOf(cap)) effort = cap
  return { name: id ?? name, effort }
}

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
    const name = await $.session.model()
    const settings = await $.settings.read()
    const env = await $.env.get('CLAUDE_CODE_EFFORT_LEVEL')
    await update($, model, (m: Model | null) => (m?.effort ? m : saved(name, settings, env)))
    return next(e)
  })

  // each main-loop request names the model and effort actually sent
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) {
      const effort = typeof e.effort === 'string' ? e.effort : null
      await update($, model, () => ({ name: e.model, effort }))
    }
    return yield* next(e)
  })

  on('session.measure', async ($, e, next) => {
    await update($, usage, () => snap(e.context.percent, e.rateLimits))
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const u = await read($, usage)
    const m = await read($, model)
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
        {m ? (
          <Box key="model" flexDirection="row" gap={1}>
            <Text bold>{short(m.name)}</Text>
            {m.effort ? <Text dimColor>{m.effort}</Text> : null}
          </Box>
        ) : null}
        {m ? sep('s0') : null}
        {cell('ctx', 'ctx', u.ctx)}
        {sep('s1')}
        {cell('5h', '5h', f?.percentUsed, f?.resetsAt)}
        {sep('s2')}
        {cell('wk', 'week', w?.percentUsed, w?.resetsAt)}
      </Box>
    )
  })
}
