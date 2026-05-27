import { FlowGlyph, type MotifCell } from "@/components/flow-glyph";
import { Wordmark } from "@/components/wordmark";

type Flow = {
  name: string;
  command: string;
  color: string;
  accent: string;
  motif: MotifCell[];
  summary: string;
};

const flows: Flow[] = [
  {
    name: "EXPLORE",
    command: "/circuit:explore",
    color: "var(--flow-explore)",
    accent: "var(--flow-explore-accent)",
    motif: [
      "filled", "empty", "filled",
      "empty", "filled", "empty",
      "filled", "empty", "filled",
    ],
    summary:
      "Compare directions before the agent commits to a path.",
  },
  {
    name: "BUILD",
    command: "/circuit:build",
    color: "var(--flow-build)",
    accent: "var(--flow-build-accent)",
    motif: [
      "empty", "empty", "filled",
      "empty", "filled", "filled",
      "filled", "filled", "filled",
    ],
    summary:
      "Move from framing to plan, implementation, verification, and review.",
  },
  {
    name: "FIX",
    command: "/circuit:fix",
    color: "var(--flow-fix)",
    accent: "var(--flow-fix-accent)",
    motif: [
      "empty", "filled", "empty",
      "filled", "filled", "filled",
      "empty", "filled", "empty",
    ],
    summary:
      "Reproduce the bug, make the fix, and keep the proof attached.",
  },
  {
    name: "REVIEW",
    command: "/circuit:review",
    color: "var(--flow-review)",
    accent: "var(--flow-review-accent)",
    motif: [
      "filled", "filled", "filled",
      "filled", "empty", "filled",
      "filled", "filled", "filled",
    ],
    summary: "Check a scoped change against evidence, not guesswork.",
  },
  {
    name: "GOAL",
    command: "/circuit:goal",
    color: "var(--flow-goal)",
    accent: "var(--flow-goal-accent)",
    motif: [
      "empty", "filled", "empty",
      "filled", "empty", "filled",
      "empty", "filled", "empty",
    ],
    summary:
      "Keep a bounded objective moving until it is done, blocked, or needs recovery.",
  },
];

const principles = [
  {
    title: "Process above skills",
    body: "A skill teaches one move. A flow gives the agent a repeatable way to use the right moves in the right order.",
  },
  {
    title: "A better working environment",
    body: "The human stops carrying every thread, prompt, and routine step. The agent gets a clearer path through the work.",
  },
  {
    title: "Evidence to check against",
    body: "Runs leave traces, reports, and verification results so the agent and operator can see what happened.",
  },
  {
    title: "Judgment still matters",
    body: "Checkpoints pause for decisions when they matter, while declared safe defaults can keep routine work moving.",
  },
];

const agentInstallInstructions = `Please install Circuit for the coding-agent tool I am using in this project.

If this is Claude Code, run:
/plugin marketplace add petekp/circuit
/plugin install circuit@circuit
/reload-plugins

If this is Codex, run:
codex plugin marketplace add petekp/circuit

After Circuit is installed, start with:
/circuit:run <my task>

Use a direct flow only when it is clearly the right fit:
/circuit:explore, /circuit:build, /circuit:fix, /circuit:review, or /circuit:goal`;

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </div>
  );
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-24">
      <section className="flex flex-col gap-10">
        <Wordmark />

        <h1 className="max-w-2xl text-base font-medium leading-tight tracking-tight sm:text-xl">
          Powerful, repeatable work patterns for coding agents.
        </h1>

        <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Circuit helps agents work like experienced practitioners: following a
          clear process, applying the right skills at the right time, and
          checking the work against evidence. Ad-hoc chat asks the human to
          remember the state, choose the next move, and keep nudging the work
          forward. Circuit puts that process into flows, giving both the human
          and the agent a better working environment.
        </p>

        <div className="flex w-full max-w-3xl flex-col gap-5 mt-2">
          <Label>[ Install ]</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <h2 className="text-[15px] font-medium tracking-tight">
                Claude Code
              </h2>
              <pre className="bg-[var(--panel)] border border-border text-foreground px-5 py-4 text-[13px] leading-7 overflow-x-auto">
                <code>
                  {`/plugin marketplace add petekp/circuit
/plugin install circuit@circuit
/reload-plugins`}
                </code>
              </pre>
            </div>

            <div className="flex flex-col gap-2">
              <h2 className="text-[15px] font-medium tracking-tight">
                Codex
              </h2>
              <pre className="bg-[var(--panel)] border border-border text-foreground px-5 py-4 text-[13px] leading-7 overflow-x-auto">
                <code>{`codex plugin marketplace add petekp/circuit`}</code>
              </pre>
            </div>
          </div>
          <p className="text-[13px] text-muted-foreground">
            Then run{" "}
            <code className="px-1.5 py-0.5 bg-muted text-foreground">
              /circuit:run &lt;your task&gt;
            </code>
          </p>
        </div>

        <div className="flex w-full max-w-3xl flex-col gap-3">
          <Label>[ Copy Agent Instructions ]</Label>
          <textarea
            readOnly
            rows={9}
            value={agentInstallInstructions}
            className="max-h-56 min-h-36 w-full resize-y overflow-y-auto border border-border bg-[var(--panel)] px-5 py-4 font-mono text-[13px] leading-6 text-foreground outline-none"
          />
        </div>
      </section>

      <section className="mt-28 flex flex-col gap-10">
        <Label>[ Flows ]</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-8 gap-y-12">
          {flows.map((f) => (
            <div key={f.name} className="flex flex-col gap-5">
              <FlowGlyph
                name={f.name}
                color={f.color}
                accent={f.accent}
                motif={f.motif}
                cellSize={25}
              />
              <div className="flex flex-col gap-1">
                <div className="text-[15px] font-medium tracking-tight">
                  {f.name}
                </div>
                <code className="text-[11px] text-muted-foreground">
                  {f.command}
                </code>
              </div>
              <p className="text-balance text-[13px] leading-relaxed text-muted-foreground">
                {f.summary}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-28 flex flex-col gap-10">
        <Label>[ Why flows ]</Label>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-8">
          {principles.map((p) => (
            <li key={p.title} className="flex flex-col gap-1.5">
              <h3 className="text-[15px] font-medium tracking-tight">
                {p.title}
              </h3>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {p.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-28 pt-8 border-t border-border flex flex-col sm:flex-row gap-2 sm:justify-between text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        <span>[ Circuit ]</span>
        <a
          href="https://github.com/petekp/circuit"
          className="hover:text-foreground transition-colors"
        >
          github.com/petekp/circuit
        </a>
      </footer>
    </main>
  );
}
