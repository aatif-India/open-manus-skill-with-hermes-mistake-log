# Manus AI + Mistake Logger

## Manus Pipeline

```
manus(task="Your task description")
```

## Mistake Logger

Passive skill that logs mistakes after every response.

### View Mistakes
```
/mistakes recent
/mistakes stats
/mistakes search <query>
```

### Categories
- CODE: syntax, bugs, API misuse
- LOGIC: assumptions, contradictions
- COMM: clarity, context gaps
- PERF: inefficiency, suboptimal
- SECURITY: vulnerabilities, secrets
- ARCH: design flaws, anti-patterns

### Storage
TurboQuant-style compact JSON with quantized fingerprints.
