# usage-line

A Claude Code mod that draws one compact line above the prompt:

```
fable-5-2 medium  │  ctx ▰▱▱▱▱  23%  │  5h ▰▰▱▱▱  41% ↻ 2h12m  │  week ▰▱▱▱▱  13% ↻ 3d4h
```

- Model and effort: at startup, the effort saved for the model in settings (`CLAUDE_CODE_EFFORT_LEVEL` wins); from the first reply on, what the latest request actually sent, so a `/model` or `/effort` change (or `--effort`) shows on the next reply.
- Green under 50%, amber from 50%, red from 80%.
- `↻` is the time until that limit resets.
- Limits appear after the first reply in a session (Pro/Max plans).
- No network calls, no buttons; it only reads the usage figures Claude Code already has.

## Install

At the prompt of a Claude Code session:

```
/plugin install usage-line --marketplace subhashkhileri/claude-usage-line
```

## Install (from a local clone)

```
git clone git@github.com:subhashkhileri/claude-usage-line.git /mnt/data/claude-mods/usage-line
claude plugin marketplace add /mnt/data/claude-mods/usage-line
claude plugin install usage-line@usage-line
```

Uninstall: `claude plugin uninstall usage-line@usage-line`
