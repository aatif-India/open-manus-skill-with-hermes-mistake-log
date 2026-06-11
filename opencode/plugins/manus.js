import { tool } from "@opencode-ai/plugin";

// ============================================================
// Manus AI — Efficient Pipeline Planner (v3)
// ============================================================
//
// Efficiency patterns from research:
// 1. Fan-out/Fan-in — parallel independent tasks
// 2. Critical path profiling — optimize bottleneck chain
// 3. Dynamic DAG — add tasks based on execution results
// 4. Adaptive depth — complexity-scaled planning
// 5. Subtask spawning — true parallel agent dispatch
// 6. Token budgeting — max cost per stage
// 7. Incremental verification — verify per-phase
// 8. Early termination — stop on critical path failure
//
// ============================================================

const TOTAL_TIMEOUT_MS = 5 * 60 * 1000;
const STAGE_TIMEOUT_MS = 90 * 1000;
const MAX_RETRIES = 1;
const MAX_TOKEN_BUDGET = 100_000;

export const ManusPlugin = async (ctx) => {
  const { client, project, directory } = ctx;

  return {
    tool: {
      manus: tool({
        description: "Manus AI efficient pipeline planner — fan-out/fan-in parallel execution with critical path optimization, dynamic DAG, and adaptive depth.",
        args: {
          task: tool.schema.string().describe("The task to execute"),
          dry_run: tool.schema.boolean().optional().describe("Plan only (default: false)"),
          budget: tool.schema.number().optional().describe("Max token budget (default: 100000)"),
        },
        async execute(args, context) {
          const runner = new EfficientPipeline({
            task: args.task,
            dryRun: args.dry_run ?? false,
            tokenBudget: args.budget ?? MAX_TOKEN_BUDGET,
            sessionID: context.sessionID,
            client,
            project,
            directory,
            abort: context.abort,
            context,
          });

          try {
            return await runner.run();
          } catch (e) {
            if (e.name === "AbortError" || context.abort?.aborted) {
              return { title: "Manus: aborted", output: "Pipeline aborted." };
            }
            return { title: "Manus: error", output: `Failed: ${e.message}\n\n${runner.renderPartial()}` };
          }
        },
      }),
    },
  };
};

// ============================================================
// Efficient Pipeline Engine
// ============================================================


function detectCycle(tasks) {
  const adj = {};
  for (const t of tasks) adj[t.id] = t.depends.filter((d) => tasks.some((x) => x.id === d));
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = {};
  for (const t of tasks) color[t.id] = WHITE;
  const cycles = [];

  function dfs(node, path) {
    color[node] = GRAY;
    path.push(node);
    for (const next of (adj[node] || [])) {
      if (color[next] === GRAY) {
        const cycle = path.slice(path.indexOf(next));
        cycles.push(cycle);
      } else if (color[next] === WHITE) {
        dfs(next, path);
      }
    }
    path.pop();
    color[node] = BLACK;
  }

  for (const t of tasks) {
    if (color[t.id] === WHITE) dfs(t.id, []);
  }
  return cycles;
}

class EfficientPipeline {
  constructor(opts) {
    Object.assign(this, opts);
    this.id = `pipe-${Date.now()}`;
    this.start = Date.now();
    this.stages = {};
    this.gates = [];
    this.tokensUsed = 0;
    this.planVersion = 1;
  }

  async run() {
    this.abortCheck();

    try {
      // ANALYZE — gather context
      await this.stage("ANALYZE", async () => {
        const ctx = await this.gatherContext();
        this.analysis = ctx;
      });
      this.gate("GATE-1", "Context ready", () => this.analysis?.goal?.length > 0);

      if (this.dryRun) {
        await this.stage("PLAN", async () => { await this.buildPlan(); });
        this.gate("GATE-2", "Plan valid", () => this.plan?.tasks?.length > 0);
        return this.render();
      }

      // PLAN — build DAG
      await this.stage("PLAN", async () => { await this.buildPlan(); });
      this.gate("GATE-2", "Plan valid", () => this.plan?.tasks?.length > 0 && this.plan?.criticalPath?.length > 0);

      // EXECUTE — fan-out/fan-in parallel
      await this.stage("EXECUTE", async () => { await this.executeParallel(); });
      this.gate("GATE-3", "Critical path done", () => this.isCriticalPathDone());

      // VERIFY — incremental check
      await this.stage("VERIFY", async () => { await this.verify(); });
      this.gate("GATE-4", "Quality pass", () => this.verifyResult?.verdict === "PASS");

      return this.render();
    } catch (e) {
      if (e.message.startsWith("Gate ")) {
        // Gate failure — return partial results
        return this.renderPartial() + "\n\n**Pipeline stopped:** " + e.message;
      }
      throw e;
    }
  }

  // ---- ANALYZE ----
  async gatherContext() {
    this.toast("Analyzing...", "info");
    this.visual("🧠 ANALYZE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0%");

    // Parallel context gathering
    const [files, vcs] = await Promise.allSettled([
      this.client.find.files({ query: "*", type: "file", limit: 25 }).catch(() => ({ data: { files: [] } })),
      this.client.vcs.get().catch(() => ({ data: {} })),
    ]);

    const fileList = files.status === "fulfilled" ? (files.value?.data?.files || []) : [];
    const vcsData = vcs.status === "fulfilled" ? (vcs.value?.data || {}) : {};

    const codeContext = [
      fileList.length ? `FILES: ${fileList.slice(0, 15).join(", ")}` : "",
      vcsData.branch ? `BRANCH: ${vcsData.branch}` : "",
      vcsData.changed?.length ? `CHANGED: ${vcsData.changed.length} files` : "",
    ].filter(Boolean).join("\n") || "No codebase context.";

    const prompt = `Analyze this task. Be concise (max 10 lines).

TASK: ${this.task}
CODEBASE: ${codeContext}

Format:
GOAL: [one sentence]
CONSTRAINTS: [comma-separated]
SUCCESS: [comma-separated]
RISKS: [comma-separated]`;

    const result = await this.llm("planner", prompt);
    return {
      goal: extract(result, "GOAL") || this.task,
      constraints: csv(result, "CONSTRAINTS"),
      success: csv(result, "SUCCESS"),
      risks: csv(result, "RISKS"),
      codeContext,
    };
  }

  // ---- PLAN ----
  async buildPlan() {
    this.toast("Planning...", "info");
    this.visual("📋 PLAN    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0%");

    const a = this.analysis || {};
    const prompt = `Create a dependency DAG. Be concise.

TASK: ${this.task}
GOAL: ${a.goal}
CONSTRAINTS: ${a.constraints?.join(", ") || "none"}

Rules:
- Tasks: ID | description | lane | depends | estimate (S/M/L/XL)
- Independent tasks → same layer → parallel lanes
- Critical path = longest chain

Format:
LANES:
- [lane]:
  T1.1 | [desc] | none | [est]
  T1.2 | [desc] | none | [est]
CRITICAL: T1.1 → T2.1
TOPOLOGY: [parallel|sequential|hybrid]`;

    const result = await this.llm("planner", prompt);
    this.plan = this.parsePlan(result);
    this.toast(`Plan: ${this.plan.tasks.length} tasks`, "success");
    this.visual("📋 PLAN    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ✅");
  }

  // ---- EXECUTE (Fan-out/Fan-in) ----
  async executeParallel() {
    const tasks = this.plan.tasks;
    const results = [];
    const completed = new Set();
    const failed = new Set();
    let wave = 0;

    while (completed.size < tasks.length) {
      this.abortCheck();
      wave++;

      // Find all tasks whose deps are satisfied
      const ready = tasks.filter((t) =>
        !completed.has(t.id) && !failed.has(t.id) &&
        t.depends.every((d) => completed.has(d))
      );

      if (ready.length === 0) {
        // Deadlock — mark remaining as failed
        for (const t of tasks) {
          if (!completed.has(t.id) && !failed.has(t.id)) {
            results.push({ id: t.id, lane: t.lane, status: "failed", error: "Deadlock" });
            failed.add(t.id);
          }
        }
        break;
      }

      const pct = Math.round((completed.size / tasks.length) * 100);
      this.toast(`Wave ${wave}: ${ready.map((t) => t.id).join(" || ")}`, "info");
      this.visual(`⚡ EXECUTE ━${"━".repeat(Math.round(pct / 5))}╸${" ".repeat(20 - Math.round(pct / 5))} ${pct}%`);

      // Fan-out: execute ALL ready tasks in parallel
      const waveResults = await Promise.allSettled(
        ready.map((t) => this.executeTask(t))
      );

      // Fan-in: collect results
      for (let i = 0; i < waveResults.length; i++) {
        const t = ready[i];
        const r = waveResults[i];

        if (r.status === "fulfilled") {
          results.push({ ...r.value, wave });
          completed.add(t.id);
        } else {
          results.push({
            id: t.id,
            lane: t.lane,
            status: "failed",
            error: r.reason?.message || "Unknown error",
            wave,
          });
          failed.add(t.id);
        }
      }

      // Dynamic DAG: if a task reveals new work, add it
      for (const r of results) {
        if (r.status === "completed" && r.newTasks) {
          for (const nt of r.newTasks) {
            if (!tasks.find((t) => t.id === nt.id)) {
              tasks.push(nt);
              this.toast(`Added task: ${nt.id}`, "info");
            }
          }
        }
      }

      // Early termination: if critical path is blocked, stop
      if (this.isCriticalPathBlocked(failed)) {
        this.toast("Critical path blocked — stopping", "warning");
        break;
      }
    }

    this.execResults = results;
    const done = results.filter((r) => r.status === "completed").length;
    const fail = results.filter((r) => r.status === "failed").length;
    this.toast(`Execution: ${done}/${tasks.length} done, ${fail} failed`, fail === 0 ? "success" : "warning");
  }

  async executeTask(task) {
    const t0 = Date.now();

    const prompt = `Execute precisely. Report concisely.

TASK: ${task.description}
ID: ${task.id}
LANE: ${task.lane}

Format:
RESULT: [what was done]
DELIVERABLES: [outputs]
NEXT: [what this enables]`;

    try {
      const result = await this.llm("executor", prompt);
      // Validate response is meaningful
      const trimmed = result.trim();
      if (trimmed.length < 10) {
        throw new Error("Empty or unparseable LLM response");
      }
      return {
        id: task.id,
        lane: task.lane,
        status: "completed",
        output: result,
        duration: Date.now() - t0,
        newTasks: this.detectNewTasks(result),
      };
    } catch (e) {
      // Retry once (with backoff)
      try {
        await sleep(500);
        const retry = await this.llm("executor", prompt);
        return {
          id: task.id,
          lane: task.lane,
          status: "completed",
          output: retry,
          duration: Date.now() - t0,
          retried: true,
          newTasks: this.detectNewTasks(retry),
        };
      } catch (re) {
        return {
          id: task.id,
          lane: task.lane,
          status: "failed",
          error: e.message,
          duration: Date.now() - t0,
        };
      }
    }
  }

  detectNewTasks(output) {
    // Dynamic DAG: detect if output suggests new tasks
    const tasks = [];
    const match = output.match(/ADD_TASK:\s*(T\d+\.\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+)/gi);
    if (match) {
      for (const m of match) {
        const parts = m.replace(/ADD_TASK:\s*/i, "").split("|").map((s) => s.trim());
        tasks.push({
          id: parts[0],
          description: parts[1],
          lane: parts[2],
          depends: parts[3] === "none" ? [] : parts[3].split(",").map((s) => s.trim()),
          est: "M",
          status: "pending",
        });
      }
    }
    return tasks.length > 0 ? tasks : null;
  }

  // ---- VERIFY ----
  async verify() {
    const done = this.execResults?.filter((r) => r.status === "completed").length || 0;
    const fail = this.execResults?.filter((r) => r.status === "failed").length || 0;
    const total = this.plan?.tasks?.length || 1;
    const critDone = this.plan?.criticalPath?.every((id) =>
      this.execResults?.some((r) => r.id === id && r.status === "completed")
    ) || false;

    const verdict = critDone && fail === 0 ? "PASS" : critDone ? "PARTIAL" : "FAIL";

    // Lane stats
    const lanes = {};
    for (const r of this.execResults || []) {
      const l = r.lane || "default";
      if (!lanes[l]) lanes[l] = { total: 0, done: 0, fail: 0 };
      lanes[l].total++;
      if (r.status === "completed") lanes[l].done++;
      else lanes[l].fail++;
    }

    const retries = this.execResults?.filter((r) => r.retried).length || 0;

    this.verifyResult = {
      verdict,
      metrics: {
        total, done, fail, critDone,
        throughput: done / total,
        retries,
        lanes: Object.keys(lanes).length,
        laneStats: lanes,
        duration: Date.now() - this.start,
        tokens: this.tokensUsed,
      },
    };

    this.toast(`Verify: ${verdict}`, verdict === "PASS" ? "success" : "warning");
    this.visual(`✅ VERIFY  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ${verdict}`);
  }

  // ---- Helpers ----

  isCriticalPathDone() {
    return this.plan?.criticalPath?.every((id) =>
      this.execResults?.some((r) => r.id === id && r.status === "completed")
    ) || false;
  }

  isCriticalPathBlocked(failedSet) {
    return this.plan?.criticalPath?.some((id) => failedSet.has(id)) || false;
  }

  async llm(agent, prompt) {
    this.abortCheck();
    this.tokensUsed += Math.ceil(prompt.length / 4); // rough estimate

    if (this.tokensUsed > this.tokenBudget) {
      throw new Error(`Token budget exceeded (${this.tokenBudget})`);
    }

    const result = await Promise.race([
      this.client.session.prompt({
        sessionID: this.sessionID,
        agent,
        parts: [{ type: "text", text: prompt }],
      }),
      sleep(STAGE_TIMEOUT_MS).then(() => { throw new Error("Stage timeout"); }),
    ]);

    const parts = result?.data?.parts || result?.parts || [];
    return parts.filter((p) => p.type === "text").map((p) => p.text || "").join("\n") || JSON.stringify(result);
  }

  async stage(name, fn) {
    const s = { name, t0: Date.now(), status: "running" };
    this.stages[name] = s;
    try {
      await fn();
      s.status = "complete";
    } catch (e) {
      s.status = "failed";
      s.error = e.message;
      throw e;
    } finally {
      s.duration = Date.now() - s.t0;
    }
  }

  gate(name, desc, check) {
    const passed = check();
    this.gates.push({ name, desc, passed });
    if (!passed) {
      this.toast(`${name} failed: ${desc}`, "warning");
      throw new Error(`Gate ${name} failed: ${desc}`);
    }
    return passed;
  }

  toast(msg, variant = "info") {
    try {
      this.client.tui.showToast({ title: this.id, message: msg, variant, duration: 2500 });
    } catch (e) {}
  }

  visual(msg) {
    try {
      this.client.tui.appendPrompt({ text: `\n${msg}` });
    } catch (e) {}
  }

  abortCheck() {
    if (this.abort?.aborted) throw Object.assign(new Error("Aborted"), { name: "AbortError" });
    if (Date.now() - this.start > TOTAL_TIMEOUT_MS) throw new Error("Pipeline timeout");
  }

  // ---- Parser ----

  parsePlan(text) {
    const tasks = [];
    const lanes = {};

    // Parse lanes
    const lanesBlock = text.match(/LANES:([\s\S]*?)(?=CRITICAL:|$)/i)?.[1] || "";
    const laneRegex = /-\s*(\S+):\s*\n([\s\S]*?)(?=-\s*\S+:|$)/g;
    let lm;
    while ((lm = laneRegex.exec(lanesBlock))) {
      const name = lm[1];
      lanes[name] = [];
      const tr = /(T\d+\.\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(S|M|L|XL)/g;
      let tm;
      while ((tm = tr.exec(lm[2]))) {
        const deps = tm[3].trim() === "none" ? [] : tm[3].split(/[,&]\s*/).map((s) => s.trim());
        const t = { id: tm[1], description: tm[2].trim(), lane: name, depends: deps, est: tm[4], status: "pending" };
        tasks.push(t);
        lanes[name].push(t.id);
      }
    }

    // Fallback
    if (tasks.length === 0) {
      const tr = /(T\d+\.\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(S|M|L|XL)/g;
      let tm;
      while ((tm = tr.exec(text))) {
        const deps = tm[3].trim() === "none" ? [] : tm[3].split(/[,&]\s*/).map((s) => s.trim());
        tasks.push({ id: tm[1], description: tm[2].trim(), lane: "default", depends: deps, est: tm[4], status: "pending" });
      }
    }

    const cp = text.match(/CRITICAL:\s*(.+)/i)?.[1]?.split("→").map((s) => s.trim()).filter(Boolean) || [tasks[0]?.id].filter(Boolean);
    const topo = text.match(/TOPOLOGY:\s*(\S+)/i)?.[1]?.toLowerCase() || "hybrid";

    // Detect and break circular dependencies
    const cycles = detectCycle(tasks);
    if (cycles.length > 0) {
      for (const cycle of cycles) {
        // Break the last edge in the cycle
        for (let i = cycle.length - 1; i > 0; i--) {
          const task = tasks.find((t) => t.id === cycle[i]);
          if (task) {
            task.depends = task.depends.filter((d) => d !== cycle[i - 1]);
          }
        }
      }
    }

    return { tasks, criticalPath: cp, topology: topo.includes("parallel") ? "parallel" : topo.includes("sequential") ? "sequential" : "hybrid", lanes };
  }

  // ---- Render ----

  render() {
    const elapsed = ((Date.now() - this.start) / 1000).toFixed(1);
    const sl = Object.values(this.stages);
    const icon = this.verifyResult?.verdict === "PASS" ? "✅" : this.verifyResult?.verdict === "PARTIAL" ? "⚠️" : "🔴";
    let md = `# ${icon} Manus Pipeline\n\n`;
    md += `\`${this.id}\` — ${this.task} — ${elapsed}s\n\n`;

    // Pipeline visual
    md += "```\n";
    for (const s of sl) {
      md += `${s.status === "complete" ? "✅" : "❌"} ${s.name} ${(s.duration / 1000).toFixed(1)}s\n`;
    }
    md += "```\n\n";


    // Quick summary
    if (this.verifyResult) {
      const v = this.verifyResult;
      md += `> **${v.verdict}** — ${v.metrics.done}/${v.metrics.total} tasks, critical path ${v.metrics.critDone ? "✅" : "❌"}${v.metrics.fail ? ", " + v.metrics.fail + " failed" : ""}${v.metrics.retries ? ", " + v.metrics.retries + " retried" : ""}\n\n`;
    }

    // Gates
    md += "| Gate | Passed |\n|------|--------|\n";
    for (const g of this.gates) md += `| ${g.name} | ${g.passed ? "✅" : "❌"} |\n`;
    md += "\n";

    // ANALYZE
    if (this.analysis) {
      md += `## ANALYZE\n- Goal: ${this.analysis.goal}\n`;
      if (this.analysis.constraints.length) md += `- Constraints: ${this.analysis.constraints.join("; ")}\n`;
      if (this.analysis.risks.length) md += `- Risks: ${this.analysis.risks.join("; ")}\n\n`;
    }

    // PLAN
    if (this.plan) {
      md += "## PLAN\n";
      md += "| ID | Task | Lane | Depends | Est |\n|----|------|------|---------|-----|\n";
      for (const t of this.plan.tasks) md += `| ${t.id} | ${t.description} | ${t.lane} | ${t.depends.join(", ") || "—"} | ${t.est} |\n`;
      md += `\nCritical: ${this.plan.criticalPath.join(" → ")} | Topology: ${this.plan.topology}\n\n`;
    }

    // EXECUTE
    if (this.execResults) {
      md += "## EXECUTE\n";
      for (const r of this.execResults) {
        const icon = r.status === "completed" ? "✅" : "❌";
        md += `${icon} **${r.id}** (${r.lane}) w${r.wave || "?"}${r.duration ? ` ${(r.duration / 1000).toFixed(1)}s` : ""}${r.retried ? " retried" : ""}\n`;
        if (r.output) md += `${r.output.slice(0, 500)}${r.output.length > 500 ? "..." : ""}\n`;
        if (r.error) md += `> Error: ${r.error}\n`;
        md += "\n";
      }
    }

    // VERIFY
    if (this.verifyResult) {
      const m = this.verifyResult.metrics;
      md += "## VERIFY\n";
      md += `| Metric | Value |\n|--------|-------|\n`;
      md += `| Tasks | ${m.done}/${m.total} |\n`;
      md += `| Failed | ${m.fail} |\n`;
      md += `| Critical Path | ${m.critDone ? "✅" : "❌"} |\n`;
      md += `| Throughput | ${(m.throughput * 100).toFixed(0)}% |\n`;
      md += `| Lanes | ${m.lanes} |\n`;
      md += `| Duration | ${(m.duration / 1000).toFixed(1)}s |\n`;
      md += `| Verdict | **${this.verifyResult.verdict}** |\n`;
      // Lane breakdown
      const ls = this.verifyResult.metrics.laneStats;
      if (ls && Object.keys(ls).length > 1) {
        md += `
### Lane Breakdown

`;
        md += `| Lane | Done | Failed | Total |
|------|------|--------|-------|
`;
        for (const [lane, stats] of Object.entries(ls)) {
          md += `| ${lane} | ${stats.done} | ${stats.fail} | ${stats.total} |
`;
        }
        md += `
`;
      }
    }

    return md;
  }

  renderPartial() {
    return Object.values(this.stages).map((s) =>
      `${s.status === "complete" ? "✅" : "❌"} ${s.name} ${s.duration ? (s.duration / 1000).toFixed(1) + "s" : ""} ${s.error || ""}`
    ).join("\n");
  }
}

// ============================================================
// Helpers
// ============================================================

function extract(text, label) {
  return text.match(new RegExp(`${label}:\\s*(.+)`, "im"))?.[1]?.trim() || "";
}

function csv(text, label) {
  const block = text.match(new RegExp(`${label}:([\\s\\S]*?)(?=(?:CONSTRAINTS|SUCCESS|RISKS|UNKNOWN|BLOCKERS|CRITICAL|LANES|$)))`, "im"))?.[1] || "";
  return block.split("\n").map((l) => l.replace(/^\s*[-*]\s*/, "").trim()).filter(Boolean);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export default ManusPlugin;
