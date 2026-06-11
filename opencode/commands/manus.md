# /manus — Autonomous Pipeline Planner

Execute tasks through a 4-stage pipeline with gate checks.

## Usage

```
/manus <task description>
/manus --dry-run <task description>
```

## Stages

1. **ANALYZE** — Gather context, identify goal/constraints/risks
2. **PLAN** — Build dependency DAG with parallel lanes
3. **EXECUTE** — Fan-out/fan-in parallel task execution
4. **VERIFY** — Validate deliverables, compute metrics

## Gate Checks

Each stage has a gate that must pass before proceeding:
- GATE-1: Context has a goal
- GATE-2: Plan has tasks and critical path
- GATE-3: Critical path tasks completed
- GATE-4: Verdict is PASS

## Options

- `--dry-run` — Plan only, no execution
- `--budget <n>` — Max token budget (default: 100000)

## Output

Returns a structured pipeline report with:
- Pipeline visualization (status per stage)
- Gate results table
- Task DAG with statuses
- Execution results per lane
- Verification metrics

## Examples

```
/manus Add user authentication to the API
/manus --dry-run Refactor database layer
/manus --budget 50000 Optimize search performance
```
