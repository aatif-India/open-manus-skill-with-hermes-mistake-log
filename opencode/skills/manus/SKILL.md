# Manus Pipeline Reasoning Patterns

## ANALYZE Stage

**Pattern: Context Gap Detection**
```
IF task is vague → ask clarifying questions
IF dependencies unknown → scan codebase first
IF constraints missing → infer from project type
```

**Pattern: Risk Assessment**
```
IF task touches critical paths → flag as HIGH RISK
IF task has many unknowns → add exploration tasks
IF task is time-sensitive → prioritize speed over quality
```

## PLAN Stage

**Pattern: Dependency DAG Construction**
```
1. Identify atomic tasks (one clear outcome each)
2. Group by lane (frontend, backend, infra, etc.)
3. Mark dependencies (what must complete before what)
4. Find critical path (longest chain)
5. Identify parallel opportunities
```

**Pattern: Complexity Scaling**
```
IF tasks < 5 → sequential is fine
IF tasks 5-15 → hybrid (parallel where possible)
IF tasks > 15 → full parallel with wave execution
```

## EXECUTE Stage

**Pattern: Fan-out/Fan-in**
```
Wave 1: All tasks with no dependencies
Wave 2: Tasks whose deps completed in Wave 1
Wave N: Continue until all done or critical path blocked
```

**Pattern: Failure Handling**
```
IF non-critical task fails → continue with warning
IF critical path task fails → retry once, then abort pipeline
IF all retries fail → partial completion with clear error report
```

## VERIFY Stage

**Pattern: Incremental Verification**
```
After each wave:
- Check critical path status
- Verify deliverables match expectations
- Flag regressions or issues
```

**Pattern: Quality Gates**
```
PASS: All critical tasks done, no failures
PARTIAL: Critical path done, some non-critical failed
FAIL: Critical path blocked
```

## Dynamic DAG Patterns

**Pattern: Task Discovery**
```
IF executor discovers new work → ADD_TASK: ID | desc | lane | deps | est
IF task output invalidates other tasks → mark as BLOCKED
IF dependencies change → recalculate critical path
```

**Pattern: Cycle Detection**
```
After adding tasks:
1. Build adjacency list
2. DFS with color coding (WHITE/GRAY/BLACK)
3. If GRAY node revisited → cycle found
4. Break last edge in cycle
```
