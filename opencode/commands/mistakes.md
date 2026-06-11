# /mistakes — View Mistake Log

View, search, or clear the mistake log. Mistakes are automatically detected from assistant responses.

## Usage

```
/mistakes recent           # Show recent mistakes
/mistakes stats            # Show category/agent stats
/mistakes search <query>   # Search by keyword
/mistakes clear            # Clear the log
```

## Actions

### recent
Shows the most recent mistakes in a table format.
- Optional: `--limit <n>` (default: 20)
- Optional: `--category <CODE|LOGIC|COMM|PERF|SECURITY|ARCH>`

### stats
Shows statistics about logged mistakes:
- Count by category
- Count by agent
- Hourly distribution chart

### search
Searches mistakes by keyword using text matching + vector similarity.
- Required: `<query>` string
- Optional: `--category <category>`
- Optional: `--limit <n>` (default: 20)

### clear
Clears the entire mistake log (both JSON and TurboQuant formats).

## Categories

- **CODE** — Syntax errors, runtime errors, self-acknowledged bugs
- **LOGIC** — Incorrect assumptions, contradictions, reasoning errors
- **COMM** — Clarity issues, context gaps, unclear instructions
- **PERF** — Inefficiency, suboptimal choices, wasted resources
- **SECURITY** — Vulnerabilities, secrets, unsafe patterns
- **ARCH** — Design flaws, coupling, anti-patterns

## Examples

```
/mistakes recent
/mistakes recent --limit 10 --category CODE
/mistakes stats
/mistakes search "undefined variable"
/mistakes search "slow performance" --category PERF
/mistakes clear
```
