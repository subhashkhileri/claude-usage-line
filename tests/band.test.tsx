import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  plugin: 'usage-line',
  component: 'AbovePrompt',
  surface: 'terminal',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

test('the saved effort shows before the first prompt', async ($, on) => {
  // Nothing sits beneath the plugin: each hook here stands for the engine.
  mock.clock(on)
  mock.env(on, {})
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.model', () => ({ value: 'fable' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: {}, rateLimits: [] } as never }))
  on('settings.read', () => ({
    value: { modelSettings: { 'claude-fable-5-2': { effortLevel: 'medium' } } },
  }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(BAND)

  expect((await ui.find({ type: 'Text', text: /fable/ }))?.text).toBe('fable-5-2')
  expect((await ui.find({ type: 'Text', text: /medium/ }))?.text).toBe('medium')
  await ui.unmount()
})
