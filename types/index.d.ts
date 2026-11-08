export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type Usage = { ctx: number | null; limits: Limit[] }

declare module 'claude-code' {
  interface PluginState {
    'usage-line': { usage: Usage | null }
  }
}
