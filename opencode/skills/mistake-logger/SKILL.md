# Mistake Logger Reasoning Patterns

## Detection Patterns

### CODE Category
```
TRIGGERS:
- "syntax error", "undefined is not", "TypeError"
- "I made a bug", "let me fix", "should have been"
- Self-corrections, retried attempts
```

### LOGIC Category
```
TRIGGERS:
- "I assumed incorrectly", "actually", "to clarify"
- Contradictions, inconsistent statements
- Wrong reasoning paths
```

### COMM Category
```
TRIGGERS:
- "to be clear", "let me rephrase"
- "I didn't understand", missing context
- Unclear instructions, ambiguous output
```

### PERF Category
```
TRIGGERS:
- "slow", "inefficient", "suboptimal"
- "could be better", redundant operations
- Wasted resources, missed optimizations
```

### SECURITY Category
```
TRIGGERS:
- "vulnerability", "injection", "exposed"
- "hardcoded key/secret", unsafe patterns
- ANY security concern (weight: 0.95)
```

### ARCH Category
```
TRIGGERS:
- "coupling", "anti-pattern", "code smell"
- "refactor", "restructure", "redesign"
- Design flaws, violations
```

## Similarity Search Patterns

**Pattern: Fingerprint Matching**
```
1. Quantize query text → 32-dim vector
2. Rotate with category-specific seed
3. Scalar quantize (4-bit)
4. Compare with stored fingerprints
5. Return results with similarity > 0.1
```

**Pattern: Category Filtering**
```
IF category specified → filter by category first
THEN apply text matching + vector similarity
SORT by combined score
```

## Storage Patterns

**Pattern: TurboQuant Compression**
```
For each mistake:
1. Pack: category(4bit) + description(5bit) + weight(8bit)
2. Varint encode timestamp
3. Agent hash (1 byte)
4. Quantized fingerprint (16 bytes)
5. Min/scale metadata (2 bytes)

Total: ~25 bytes per mistake (vs ~200 bytes JSON)
```

**Pattern: Retention Management**
```
IF log > 1000 entries → FIFO eviction (remove oldest)
IF entry > 90 days old → eligible for deletion
IF storage > 10MB → aggressive pruning
```

## Query Patterns

**Pattern: Recent Query**
```
1. Load log
2. Reverse (newest first)
3. Filter by category (if specified)
4. Limit to N results
5. Format as table
```

**Pattern: Stats Query**
```
1. Load log
2. Count by category
3. Count by agent
4. Hourly distribution
5. Format as stats report
```

**Pattern: Search Query**
```
1. Load log
2. Apply category filter
3. For each entry:
   - Text match score (description + evidence)
   - Vector similarity score
   - Combined score = max(text, vector)
4. Filter score > 0.1
5. Sort by score descending
6. Return top N
```
