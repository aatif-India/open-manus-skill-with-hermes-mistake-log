<div align="center">

<img src="https://img.shields.io/badge/MANUS%20SKILL-v1.0.0-FF6B35?style=for-the-badge&logo=node.js&logoColor=white" alt="Manus Skill">

<br>

<img src="https://img.shields.io/badge/opencode-plugin-FF6B35?style=flat-square&logo=node.js" alt="opencode">
<img src="https://img.shields.io/badge/Claude%20Code-D97757?style=flat-square&logo=anthropic" alt="Claude Code">
<img src="https://img.shields.io/badge/OpenClaw-8B5CF6?style=flat-square" alt="OpenClaw">
<img src="https://img.shields.io/badge/Hermes%20Agent-10B981?style=flat-square" alt="Hermes">
<img src="https://img.shields.io/badge/License-MIT-10B981?style=flat-square" alt="MIT">

<br><br>

<h3>Autonomous Pipeline Planner for AI Coding Agents</h3>

<p>
4-stage pipeline with gate checks • Dependency DAGs • Parallel execution • TurboQuant mistake logging
</p>

<br>

</div>

---

## What is Manus Skill?

Manus Skill brings **Manus AI-style autonomous pipeline execution** to your favorite AI coding agent. It decomposes complex tasks into structured pipelines with dependency tracking, parallel execution, and quality gates.

```
ANALYZE ──▶ PLAN ──▶ EXECUTE ──▶ VERIFY
   │           │           │           │
   ▼           ▼           ▼           ▼
 Context     DAG +      Parallel    Validate
 Gaps        Critical   Lanes       Deliver
             Path
```

<br>

## Features

| Feature | Description |
|---------|-------------|
| **4-Stage Pipeline** | ANALYZE → PLAN → EXECUTE → VERIFY with gate checks |
| **Dependency DAG** | Automatic task decomposition with prerequisites |
| **Parallel Execution** | Fan-out/fan-in for independent tasks |
| **Critical Path** | Identifies bottleneck chain, early termination on failure |
| **Dynamic DAG** | Tasks can spawn new tasks during execution |
| **Gate Checks** | Quality gates at each stage boundary |
| **TurboQuant Storage** | 10x compression via vector quantization |
| **Mistake Logger** | Passive mistake detection with similarity search |
| **Universal** | Works across opencode, Claude Code, OpenClaw, Hermes Agent |

<br>

## Installation

### opencode

```bash
# Copy plugins
cp plugins/manus.js ~/.config/opencode/plugins/
cp plugins/mistake-logger.js ~/.config/opencode/plugins/

# Copy skills
cp -r skills/manus ~/.config/opencode/skills/
cp -r skills/mistake-logger ~/.config/opencode/skills/

# Copy commands
cp commands/manus.md ~/.config/opencode/commands/
cp commands/mistakes.md ~/.config/opencode/commands/

# Update config
cat opencode.jsonc >> ~/.config/opencode/opencode.jsonc
```

### Claude Code

```bash
cat claude-code/CLAUDE.md >> ~/.claude/CLAUDE.md
```

### OpenClaw

```bash
cp openclaw/SKILL.md ~/.openclaw/skills/manus/SKILL.md
```

### Hermes Agent

```bash
cp hermes-agent/MANUS.md ~/.hermes/agents/MANUS.md
```

<br>

## Usage

### Pipeline Execution

```
/manus Add user authentication to the API
/manus --dry-run Refactor database layer
/manus --budget 50000 Optimize search performance
```

### Mistake Logger

```
/mistakes recent              # Show recent mistakes
/mistakes stats               # Show category/agent stats
/mistakes search "undefined"  # Search by keyword
/mistakes clear               # Clear the log
```

<br>

## Pipeline Stages

### Stage 1: ANALYZE

Gathers context from codebase and task description. Identifies:
- Goal (one sentence)
- Constraints (comma-separated)
- Success criteria
- Risks and blockers

**Gate 1**: Context must have a goal.

### Stage 2: PLAN

Decomposes into atomic tasks with:
- **Dependency DAG** — what must complete before what
- **Parallel lanes** — independent tasks grouped by domain
- **Critical path** — zero-slack chain determining duration
- **Topology** — parallel / sequential / hybrid

**Gate 2**: Plan has tasks and critical path.

### Stage 3: EXECUTE

Runs tasks in dependency order:
```
Wave 1: Tasks with no dependencies
Wave 2: Tasks whose deps completed in Wave 1
Wave N: Continue until all done or critical path blocked
```

**Gate 3**: Critical path tasks completed.

### Stage 4: VERIFY

Validates deliverables:
- Task completion rate
- Critical path status
- Throughput metrics
- Lane utilization

**Gate 4**: Verdict is PASS.

<br>

## Gate Checks

| Gate | Stage | Condition | On Failure |
|------|-------|-----------|------------|
| GATE-1 | ANALYZE | Context has a goal | Stop pipeline |
| GATE-2 | PLAN | Plan has tasks and critical path | Stop pipeline |
| GATE-3 | EXECUTE | Critical path tasks completed | Stop pipeline |
| GATE-4 | VERIFY | Verdict is PASS | Return partial results |

<br>

## Mistake Logger

Passive mistake detection that runs after every assistant response:

### Categories

| Category | Triggers | Weight |
|----------|----------|--------|
| **CODE** | Syntax errors, runtime errors, self-acknowledged bugs | 0.6-0.9 |
| **LOGIC** | Incorrect assumptions, contradictions | 0.5-0.8 |
| **COMM** | Clarity issues, context gaps | 0.4-0.6 |
| **PERF** | Inefficiency, suboptimal choices | 0.5-0.7 |
| **SECURITY** | Vulnerabilities, secrets, unsafe patterns | 0.8-0.95 |
| **ARCH** | Design flaws, coupling, anti-patterns | 0.5-0.7 |

### TurboQuant Storage

Vector quantization for compact storage (~10x compression):

```
Text → 32-dim vector → Random rotation → 4-bit quantization → QJL residual
```

Each mistake stored in ~25 bytes (vs ~200 bytes JSON).

<br>

## File Structure

```
manus-skill/
├── README.md
├── opencode/
│   ├── opencode.jsonc          # Plugin/agent config
│   ├── plugins/
│   │   ├── manus.js            # Pipeline engine
│   │   └── mistake-logger.js   # Passive logger
│   ├── skills/
│   │   ├── manus/
│   │   │   └── SKILL.md        # Pipeline reasoning patterns
│   │   └── mistake-logger/
│   │       └── SKILL.md        # Logger reasoning patterns
│   └── commands/
│       ├── manus.md            # /manus documentation
│       └── mistakes.md         # /mistakes documentation
├── claude-code/
│   └── CLAUDE.md               # Claude Code integration
├── openclaw/
│   └── SKILL.md                # OpenClaw integration
└── hermes-agent/
    └── MANUS.md                # Hermes Agent integration
```

<br>

## Examples

### Simple Task

```
/manus Add dark mode toggle

Pipeline: pipe-1717650000
Elapsed: 12.3s

✅ ANALYZE (1.2s)
✅ PLAN (2.1s) — 4 tasks
✅ EXECUTE (8.4s) — 4/4 done
✅ VERIFY (0.6s) — PASS
```

### Complex Task with Failure

```
/manus Refactor auth system

Pipeline: pipe-1717650001
Elapsed: 45.2s

✅ ANALYZE (1.5s)
✅ PLAN (3.2s) — 8 tasks, critical: T1.1 → T2.1 → T3.1
⚠️ EXECUTE (35.4s) — 7/8 done, 1 failed (non-critical)
✅ VERIFY (1.1s) — PARTIAL
```

<br>

## License

Apache

---

<div align="center">

<img src="https://img.shields.io/badge/Built_with-%E2%9D%A4%EF%B8%8F-FF6B35?style=for-the-badge" alt="Made with love">

</div>

