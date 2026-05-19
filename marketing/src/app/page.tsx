import { FlowGlyph } from "@/components/flow-glyph";
import { Wordmark } from "@/components/wordmark";

const flows = [
  {
    name: "EXPLORE",
    command: "/circuit:explore",
    color: "#00B8D4",
    ghost: "#FF6B6B",
    summary:
      "Investigate, compare options, and shape a plan before you commit code.",
  },
  {
    name: "BUILD",
    command: "/circuit:build",
    color: "#FF6B1A",
    ghost: "#1AB8FF",
    summary:
      "Implement a feature end-to-end with checkpoints along the way.",
  },
  {
    name: "FIX",
    command: "/circuit:fix",
    color: "#E91E63",
    ghost: "#1AFFB8",
    summary:
      "Reproduce the bug, fix it, and produce a proof the regression is gone.",
  },
  {
    name: "REVIEW",
    command: "/circuit:review",
    color: "#00C853",
    ghost: "#FF1A4A",
    summary: "Audit a scoped change against the contract you set for it.",
  },
  {
    name: "RUN",
    command: "/circuit:run",
    color: "#7C4DFF",
    ghost: "#FFC107",
    summary:
      "Describe a task in plain English. Circuit picks the right flow.",
  },
];

const principles = [
  {
    title: "Configurable relay steps",
    body: "Pick the model, reasoning effort, and connector for each step in the flow.",
  },
  {
    title: "Resumable",
    body: "If a session dies mid-run, pick up where it left off.",
  },
  {
    title: "Adjustable autonomy",
    body: "Steer at checkpoints, or run unattended.",
  },
  {
    title: "Mode-driven depth",
    body: "Lite for a fast pass. Deep for a thorough one. Default in between.",
  },
];

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
        <Label>[ Pre-release Alpha ]</Label>

        <Wordmark />

        <p className="max-w-2xl text-[15px] leading-relaxed">
          Structured flows for coding agents. Each step runs against a
          contract, so the next step only starts when the previous one
          actually finished.
        </p>

        <div className="flex items-end gap-1 mt-2">
          {flows.map((f) => (
            <FlowGlyph
              key={f.name}
              name={f.name}
              color={f.color}
              ghost={f.ghost}
              cellSize={28}
              offset={3}
            />
          ))}
        </div>

        <div className="flex flex-col gap-3 mt-2">
          <Label>[ Install · Claude Code ]</Label>
          <pre className="bg-black/40 border border-border text-foreground px-5 py-4 text-[13px] leading-7 overflow-x-auto">
            <code>
              {`/plugin marketplace add petekp/circuit-next
/plugin install circuit@circuit-next
/reload-plugins`}
            </code>
          </pre>
          <p className="text-[13px] text-muted-foreground">
            Then run{" "}
            <code className="px-1.5 py-0.5 bg-muted text-foreground">
              /circuit:run &lt;your task&gt;
            </code>
          </p>
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
                ghost={f.ghost}
                cellSize={44}
                offset={4}
              />
              <div className="flex flex-col gap-1">
                <div className="text-[15px] font-medium tracking-tight">
                  {f.name}
                </div>
                <code className="text-[11px] text-muted-foreground">
                  {f.command}
                </code>
              </div>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {f.summary}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-28 flex flex-col gap-10">
        <Label>[ What you get ]</Label>
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
        <span>[ Circuit · Pre-release ]</span>
        <a
          href="https://github.com/petekp/circuit-next"
          className="hover:text-foreground transition-colors"
        >
          github.com/petekp/circuit-next
        </a>
      </footer>
    </main>
  );
}
