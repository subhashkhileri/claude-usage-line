export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type Model = { name: string; effort: string | null }
export type Usage = { ctx: number | null; limits: Limit[] }

declare module 'claude-code' {
  interface PluginState {
    'usage-line': { usage: Usage | null; model: Model | null }
  }
}
