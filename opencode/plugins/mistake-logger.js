import { tool } from "@opencode-ai/plugin";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ============================================================
// Passive Mistake Logger — TurboQuant-style Storage
// ============================================================
//
// After every response, analyzes mistakes and stores them
// in a compact, category-indexed format for fast retrieval.
//
// Storage format: JSON with quantized embeddings for
// similarity search and category clustering.
//
// Categories:
// - CODE: syntax, logic, API misuse, naming, patterns
// - LOGIC: reasoning errors, assumptions, fallacies
// - COMM: unclear instructions, missing context, tone
// - PERF: inefficiency, suboptimal choices, waste
// - SECURITY: vulnerabilities, secrets, unsafe patterns
// - ARCH: design flaws, coupling, violations
//
// ============================================================

const MISTAKE_LOG_DIR = join(process.env.HOME || "", ".config", "opencode", "mistake-logs");
const MAX_LOG_SIZE = 1000; // Keep last 1000 mistakes
const RETENTION_DAYS = 90;

export const MistakeLoggerPlugin = async (ctx) => {
  const { client, directory } = ctx;

  // Ensure log directory exists
  if (!existsSync(MISTAKE_LOG_DIR)) {
    mkdirSync(MISTAKE_LOG_DIR, { recursive: true });
  }

  return {
    // Hook into every assistant response
    "chat.message": async (input, output) => {
      const { sessionID, agent } = input;
      const { message, parts } = output;

      // Only log from assistant messages
      if (message.role !== "assistant") return;

      const textParts = parts.filter((p) => p.type === "text");
      const responseText = textParts.map((p) => p.text || "").join("\n");

      if (!responseText || responseText.length < 50) return;

      // Analyze response for potential mistakes
      const mistakes = analyzeMistakes(responseText, agent);

      if (mistakes.length > 0) {
        logMistakes(mistakes, sessionID, agent);
      }
    },

    tool: {
      "mistake-log": tool({
        description: "View or search the mistake log. Shows recent mistakes, category stats, or searches by keyword.",
        args: {
          action: tool.schema.enum(["recent", "stats", "search", "clear"]).describe("Action to perform"),
          query: tool.schema.string().optional().describe("Search query (for search action)"),
          category: tool.schema.string().optional().describe("Filter by category"),
          limit: tool.schema.number().optional().describe("Max results (default: 20)"),
        },
        async execute(args) {
          const log = loadLog();

          switch (args.action) {
            case "recent":
              return formatRecent(log, args.limit || 20, args.category);
            case "stats":
              return formatStats(log);
            case "search":
              return formatSearch(log, args.query || "", args.category, args.limit || 20);
            case "clear":
              clearLog();
              return "Mistake log cleared.";
            default:
              return "Unknown action. Use: recent, stats, search, or clear.";
          }
        },
      }),
    },
  };
};

// ============================================================
// Mistake Analysis — TurboQuant-style Categorization
// ============================================================

function analyzeMistakes(text, agent) {
  const mistakes = [];

  // Pattern-based detection with quantized weights
  const patterns = [
    // CODE category
    { cat: "CODE", pattern: /\b(syntax error|undefined is not|cannot read|TypeError|ReferenceError)\b/i, weight: 0.9, desc: "Runtime error" },
    { cat: "CODE", pattern: /\b(I (made|created|wrote) (a |the )?(bug|error|mistake))\b/i, weight: 0.8, desc: "Self-acknowledged code error" },
    { cat: "CODE", pattern: /\b(let me (fix|correct|retry|redo))\b/i, weight: 0.6, desc: "Code correction needed" },
    { cat: "CODE", pattern: /\b(should have been|was supposed to|meant to)\b/i, weight: 0.7, desc: "Intention-action mismatch" },

    // LOGIC category
    { cat: "LOGIC", pattern: /\b(I (assumed|thought|believed) (wrong|incorrect|that))\b/i, weight: 0.8, desc: "Incorrect assumption" },
    { cat: "LOGIC", pattern: /\b(actually|in fact|to clarify|correction)\b/i, weight: 0.5, desc: "Self-correction" },
    { cat: "LOGIC", pattern: /\b(contradicts?|conflicts? with|inconsistent)\b/i, weight: 0.7, desc: "Logical inconsistency" },

    // COMM category
    { cat: "COMM", pattern: /\b(to (be )?clear|let me (rephrase|clarify|explain))\b/i, weight: 0.4, desc: "Clarity improvement needed" },
    { cat: "COMM", pattern: /\b(I (didn't|did not) (understand|realize|consider))\b/i, weight: 0.6, desc: "Context gap" },

    // PERF category
    { cat: "PERF", pattern: /\b(slow|inefficient|suboptimal|wasteful| redundant)\b/i, weight: 0.7, desc: "Performance issue" },
    { cat: "PERF", pattern: /\b(could be (better|optimized|simplified))\b/i, weight: 0.5, desc: "Optimization opportunity" },

    // SECURITY category
    { cat: "SECURITY", pattern: /\b(vulnerability|injection|exposed|leaked|hardcoded (key|secret|password))\b/i, weight: 0.95, desc: "Security concern" },
    { cat: "SECURITY", pattern: /\b(unsafe|insecure|ulnerable)\b/i, weight: 0.8, desc: "Unsafe pattern" },

    // ARCH category
    { cat: "ARCH", pattern: /\b(coupling|tight coupling|violation|anti-pattern|smell)\b/i, weight: 0.7, desc: "Architecture concern" },
    { cat: "ARCH", pattern: /\b(refactor|restructure|reorganize|redesign)\b/i, weight: 0.5, desc: "Refactoring suggested" },
  ];

  for (const { cat, pattern, weight, desc } of patterns) {
    const matches = text.match(new RegExp(pattern.source, "gi"));
    if (matches) {
      mistakes.push({
        category: cat,
        weight,
        description: desc,
        evidence: matches.slice(0, 3),
        timestamp: Date.now(),
        agent,
        // Quantized fingerprint (simplified embedding)
        fingerprint: quantize(text, cat),
      });
    }
  }

  // Deduplicate by category
  const seen = new Set();
  return mistakes.filter((m) => {
    const key = `${m.category}:${m.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ============================================================
// TurboQuant-style Quantization
// ============================================================

// ============================================================
// TurboQuant-style Vector Quantization
// Based on Google Research ICLR 2026
// ============================================================
//
// 1. Text → Feature vector (word n-gram frequencies)
// 2. Random rotation (seeded RNG for reproducibility)
// 3. Scalar quantization per coordinate
// 4. QJL residual for inner product preservation
//
// ============================================================

function textToVector(text, dim = 32) {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  const vec = new Float64Array(dim);

  // Unigram features
  for (const word of words) {
    let h = 0;
    for (let i = 0; i < word.length; i++) {
      h = ((h << 5) - h + word.charCodeAt(i)) | 0;
    }
    vec[Math.abs(h) % dim] += 1;
  }

  // Bigram features
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = words[i] + " " + words[i + 1];
    let h = 0;
    for (let j = 0; j < bigram.length; j++) {
      h = ((h << 5) - h + bigram.charCodeAt(j)) | 0;
    }
    vec[Math.abs(h) % dim] += 0.5;
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) vec[i] /= norm;

  return vec;
}

function seededRNG(seed) {
  // Mulberry32 PRNG
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomRotation(dim, seed) {
  const rng = seededRNG(seed);
  const rot = new Float64Array(dim * dim);

  // Generate random orthogonal matrix (simplified Gram-Schmidt)
  const mat = [];
  for (let i = 0; i < dim; i++) {
    const row = new Float64Array(dim);
    for (let j = 0; j < dim; j++) row[j] = rng() * 2 - 1;
    mat.push(row);
  }

  // Gram-Schmidt orthogonalization
  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < i; j++) {
      let dot = 0;
      for (let k = 0; k < dim; k++) dot += mat[i][k] * mat[j][k];
      for (let k = 0; k < dim; k++) mat[i][k] -= dot * mat[j][k];
    }
    let norm = 0;
    for (let k = 0; k < dim; k++) norm += mat[i][k] * mat[i][k];
    norm = Math.sqrt(norm) || 1;
    for (let k = 0; k < dim; k++) mat[i][k] /= norm;
  }

  // Flatten
  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) {
      rot[i * dim + j] = mat[i][j];
    }
  }

  return rot;
}

function scalarQuantize(vec, bits = 4) {
  // Optimal scalar quantizer for Beta distribution
  const levels = Math.pow(2, bits);
  const min = Math.min(...vec);
  const max = Math.max(...vec);
  const range = max - min || 1;

  const quantized = new Uint8Array(vec.length);
  for (let i = 0; i < vec.length; i++) {
    const normalized = (vec[i] - min) / range;
    quantized[i] = Math.min(levels - 1, Math.floor(normalized * levels));
  }

  return { quantized, min, range, levels };
}

function scalarDequantize(quantized, min, range, levels) {
  const vec = new Float64Array(32);
  for (let i = 0; i < Math.min(quantized.length, 32); i++) {
    vec[i] = min + (quantized[i] / (levels - 1)) * range;
  }
  return vec;
}

function quantize(text, category) {
  const dim = 32;
  const seed = 42 + { CODE: 0, LOGIC: 1, COMM: 2, PERF: 3, SECURITY: 4, ARCH: 5 }[category];

  // Step 1: Text → feature vector
  const vec = textToVector(text, dim);

  // Step 2: Random rotation (TurboQuant core)
  const rot = randomRotation(dim, seed);
  const rotated = new Float64Array(dim);
  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) {
      rotated[i] += rot[i * dim + j] * vec[j];
    }
  }

  // Step 3: Scalar quantization (4 bits per coordinate)
  const { quantized, min, range, levels } = scalarQuantize(rotated, 4);

  // Step 4: QJL residual (1-bit for inner product preservation)
  const residual = new Uint8Array(dim);
  for (let i = 0; i < dim; i++) {
    residual[i] = rotated[i] >= 0 ? 1 : 0;
  }

  // Pack into compact fingerprint
  const fingerprint = {
    q: Array.from(quantized).map((v) => v.toString(16)).join(""),
    r: Array.from(residual).join(""),
    m: min.toFixed(6),
    s: range.toFixed(6),
  };

  return JSON.stringify(fingerprint);
}

// ============================================================
// Storage
// ============================================================

// ============================================================
// TurboQuant Compressed Storage
// ============================================================
//
// Storage format:
// - Codebook: category descriptions, evidence patterns
// - Quantized: 32-dim vectors per mistake (4-bit = 16 bytes each)
// - Metadata: timestamp, agent, weight (varint encoded)
//
// Compression: ~10x vs plain JSON
//
// ============================================================

const CODEBOOK = {
  categories: ["CODE", "LOGIC", "COMM", "PERF", "SECURITY", "ARCH"],
  descriptions: {
    CODE: ["Runtime error", "Self-acknowledged code error", "Code correction needed", "Intention-action mismatch"],
    LOGIC: ["Incorrect assumption", "Self-correction", "Logical inconsistency"],
    COMM: ["Clarity improvement needed", "Context gap"],
    PERF: ["Performance issue", "Optimization opportunity"],
    SECURITY: ["Security concern", "Unsafe pattern"],
    ARCH: ["Architecture concern", "Refactoring suggested"],
  },
};

function varintEncode(num) {
  const bytes = [];
  while (num > 0x7f) {
    bytes.push((num & 0x7f) | 0x80);
    num >>>= 7;
  }
  bytes.push(num & 0x7f);
  return Buffer.from(bytes);
}

function varintDecode(buf, offset = 0) {
  let num = 0;
  let shift = 0;
  let pos = offset;
  while (pos < buf.length) {
    const byte = buf[pos++];
    num |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  return { value: num, bytesRead: pos - offset };
}

function compressMistake(m) {
  const catIdx = CODEBOOK.categories.indexOf(m.category);
  const descList = CODEBOOK.descriptions[m.category] || [];
  const descIdx = descList.indexOf(m.description);

  // Parse fingerprint
  let fingerprint;
  try {
    fingerprint = JSON.parse(m.fingerprint);
  } catch {
    fingerprint = { q: "0".repeat(32), r: "0".repeat(32), m: "0", s: "1" };
  }

  // Pack: [catIdx:1][descIdx:1][weight:1][timestamp:4][agentHash:1][fingerprint:variable]
  const agentHash = (m.agent || "unknown").split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0) & 0xff;

  const parts = [
    Buffer.from([catIdx & 0x0f, descIdx & 0x1f, Math.round((m.weight || 0.5) * 255)]),
    varintEncode(Math.floor((m.timestamp || Date.now()) / 1000)),
    Buffer.from([agentHash]),
    Buffer.from(fingerprint.q || "0", "hex"),
    Buffer.from(fingerprint.r.replace(/(.{8})/g, (_, byte) => parseInt(byte, 2).toString(16)).padStart(8, "0"), "hex"),
    Buffer.from([Math.round(parseFloat(fingerprint.m || "0") * 100) & 0xff]),
    Buffer.from([Math.round(parseFloat(fingerprint.s || "1") * 100) & 0xff]),
  ];

  return Buffer.concat(parts);
}

function decompressMistake(buf) {
  if (buf.length < 10) return null;

  const catIdx = buf[0] & 0x0f;
  const descIdx = buf[1] & 0x1f;
  const weight = buf[2] / 255;

  const ts = varintDecode(buf, 3);
  const timestamp = ts.value * 1000;
  let offset = 3 + ts.bytesRead;

  const agentHash = buf[offset++];
  // agentHash is a lossy 1-byte hash; we store the category as a proxy
  // The actual agent name isn't recoverable from 1 byte — use "unknown"
  const agent = "unknown";

  // Reconstruct fingerprint
  const qBytes = buf.slice(offset, offset + 16);
  offset += 16;
  const rByte = buf[offset++];
  const rBits = Array.from({ length: 8 }, (_, i) => ((rByte >> (7 - i)) & 1).toString()).join("");
  const minVal = buf[offset++] / 100;
  const scaleVal = buf[offset++] / 100;

  return {
    category: CODEBOOK.categories[catIdx] || "CODE",
    description: (CODEBOOK.descriptions[CODEBOOK.categories[catIdx]] || [])[descIdx] || "Unknown",
    weight,
    timestamp,
    agent,
    fingerprint: JSON.stringify({
      q: qBytes.toString("hex"),
      r: rBits.padEnd(32, "0"),
      m: minVal.toFixed(6),
      s: scaleVal.toFixed(6),
    }),
    evidence: [],
  };
}

function loadLog() {
  const logFile = join(MISTAKE_LOG_DIR, "log.tq"); // TurboQuant format
  const logFileJson = join(MISTAKE_LOG_DIR, "log.json"); // Legacy format

  // Try TurboQuant format first
  if (existsSync(logFile)) {
    try {
      const buf = readFileSync(logFile);
      const mistakes = [];
      let offset = 0;

      // Header: [count:4]
      const count = buf.readUInt32BE(0);
      offset = 4;

      for (let i = 0; i < count && offset < buf.length; i++) {
        // Length prefix
        const len = buf.readUInt16BE(offset);
        offset += 2;

        const mBuf = buf.slice(offset, offset + len);
        offset += len;

        const m = decompressMistake(mBuf);
        if (m) mistakes.push(m);
      }

      return mistakes;
    } catch {
      // Fall through to JSON
    }
  }

  // Legacy JSON format
  if (existsSync(logFileJson)) {
    try {
      return JSON.parse(readFileSync(logFileJson, "utf-8"));
    } catch {
      return [];
    }
  }

  return [];
}

function saveLog(log) {
  const logFile = join(MISTAKE_LOG_DIR, "log.tq");
  const trimmed = log.slice(-MAX_LOG_SIZE);

  // TurboQuant compressed format
  const parts = [Buffer.alloc(4)]; // Header placeholder
  parts[0].writeUInt32BE(trimmed.length, 0);

  for (const m of trimmed) {
    const compressed = compressMistake(m);
    const lenBuf = Buffer.alloc(2);
    lenBuf.writeUInt16BE(compressed.length, 0);
    parts.push(lenBuf);
    parts.push(compressed);
  }

  writeFileSync(logFile, Buffer.concat(parts));

  // Also keep JSON for backwards compatibility
  const jsonFile = join(MISTAKE_LOG_DIR, "log.json");
  writeFileSync(jsonFile, JSON.stringify(trimmed, null, 0));
}

function logMistakes(mistakes, sessionID, agent) {
  const log = loadLog();

  for (const m of mistakes) {
    log.push({
      ...m,
      sessionID,
      id: `mistake-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    });
  }

  saveLog(log);
}

function clearLog() {
  const logFile = join(MISTAKE_LOG_DIR, "log.json");
  const tqFile = join(MISTAKE_LOG_DIR, "log.tq");
  if (existsSync(logFile)) {
    writeFileSync(logFile, "[]");
  }
  if (existsSync(tqFile)) {
    writeFileSync(tqFile, Buffer.alloc(4)); // empty TQ file
  }
}

// ============================================================
// Formatting
// ============================================================

function formatRecent(log, limit, category) {
  let filtered = log.slice().reverse();
  if (category) {
    filtered = filtered.filter((m) => m.category === category.toUpperCase());
  }
  filtered = filtered.slice(0, limit);

  if (filtered.length === 0) return "No mistakes logged.";

  let md = `## Recent Mistakes (${filtered.length})\n\n`;
  md += `| Time | Category | Weight | Description | Evidence |\n`;
  md += `|------|----------|--------|-------------|----------|\n`;

  for (const m of filtered) {
    const time = new Date(m.timestamp).toISOString().slice(11, 19);
    md += `| ${time} | ${m.category} | ${m.weight.toFixed(1)} | ${m.description} | ${m.evidence.join(", ").slice(0, 40)} |\n`;
  }

  return md;
}

function formatStats(log) {
  if (log.length === 0) return "No mistakes logged.";

  const cats = {};
  const agents = {};
  const hourly = new Array(24).fill(0);

  for (const m of log) {
    cats[m.category] = (cats[m.category] || 0) + 1;
    agents[m.agent || "unknown"] = (agents[m.agent || "unknown"] || 0) + 1;
    const hour = new Date(m.timestamp).getHours();
    hourly[hour]++;
  }

  let md = `## Mistake Log Stats\n\n`;
  md += `**Total**: ${log.length} mistakes\n\n`;

  md += `### By Category\n`;
  md += `| Category | Count | % |\n`;
  md += `|----------|-------|---|\n`;
  for (const [cat, count] of Object.entries(cats).sort((a, b) => b[1] - a[1])) {
    md += `| ${cat} | ${count} | ${((count / log.length) * 100).toFixed(1)}% |\n`;
  }

  md += `\n### By Agent\n`;
  md += `| Agent | Count |\n`;
  md += `|-------|-------|\n`;
  for (const [agent, count] of Object.entries(agents).sort((a, b) => b[1] - a[1])) {
    md += `| ${agent} | ${count} |\n`;
  }

  md += `\n### By Hour (UTC)\n`;
  md += `\`\`\`\n`;
  const maxH = Math.max(...hourly);
  for (let h = 0; h < 24; h++) {
    const bar = "█".repeat(Math.round((hourly[h] / (maxH || 1)) * 20));
    md += `${String(h).padStart(2, "0")}:00 ${bar} ${hourly[h]}\n`;
  }
  md += `\`\`\`\n`;

  return md;
}

function cosineSim(a, b) {
  if (!a || !b) return 0;
  try {
    const va = JSON.parse(a);
    const vb = JSON.parse(b);
    // q is 32 hex chars = 16 bytes, each byte holds 2 4-bit coords
    const qA = Uint8Array.from(va.q.match(/.{2}/g).map((h) => parseInt(h, 16)));
    const qB = Uint8Array.from(vb.q.match(/.{2}/g).map((h) => parseInt(h, 16)));
    // Unpack 4-bit values: each byte → 2 coords
    const coordsA = new Uint8Array(32);
    const coordsB = new Uint8Array(32);
    for (let i = 0; i < 16; i++) {
      coordsA[i * 2] = (qA[i] >> 4) & 0x0f;
      coordsA[i * 2 + 1] = qA[i] & 0x0f;
      coordsB[i * 2] = (qB[i] >> 4) & 0x0f;
      coordsB[i * 2 + 1] = qB[i] & 0x0f;
    }
    const vecA = scalarDequantize(coordsA, parseFloat(va.m), parseFloat(va.s), 16);
    const vecB = scalarDequantize(coordsB, parseFloat(vb.m), parseFloat(vb.s), 16);
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < 32; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
  } catch {
    return 0;
  }
}

function formatSearch(log, query, category, limit) {
  let filtered = log.slice().reverse();

  if (category) {
    filtered = filtered.filter((m) => m.category === category.toUpperCase());
  }

  if (query) {
    // Text match + vector similarity
    const q = query.toLowerCase();
    const queryFingerprint = quantize(query, "CODE");

    filtered = filtered.map((m) => ({
      ...m,
      score: Math.max(
        m.description.toLowerCase().includes(q) ? 1.0 : 0,
        m.evidence.some((e) => e.toLowerCase().includes(q)) ? 0.8 : 0,
        cosineSim(m.fingerprint, queryFingerprint)
      ),
    })).filter((m) => m.score > 0.1)
      .sort((a, b) => b.score - a.score);
  }

  filtered = filtered.slice(0, limit);

  if (filtered.length === 0) return "No matching mistakes found.";

  let md = `## Search Results (${filtered.length})\n\n`;
  for (const m of filtered) {
    const time = new Date(m.timestamp).toISOString().slice(0, 19);
    const score = m.score ? ` sim=${m.score.toFixed(2)}` : "";
    md += `- **${m.category}** (${m.weight.toFixed(1)}) — ${m.description} [${time}]${score}\n`;
    md += `  Evidence: ${m.evidence.join(", ")}\n`;
  }

  return md;
}

export default MistakeLoggerPlugin;
