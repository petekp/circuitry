import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const flows = [
  {
    name: "Explore",
    command: "/circuit:explore",
    summary:
      "Investigate, compare options, and shape a plan before you commit code.",
  },
  {
    name: "Build",
    command: "/circuit:build",
    summary: "Implement a feature end-to-end with checkpoints along the way.",
  },
  {
    name: "Fix",
    command: "/circuit:fix",
    summary:
      "Reproduce the bug, fix it, and produce a proof the regression is gone.",
  },
  {
    name: "Review",
    command: "/circuit:review",
    summary: "Audit a scoped change against the contract you set for it.",
  },
  {
    name: "Run",
    command: "/circuit:run",
    summary: "Describe a task in plain English. Circuit picks the right flow.",
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

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-20 px-6 py-20 sm:py-28">
        <section className="flex flex-col gap-6">
          <Badge variant="secondary" className="w-fit">
            Pre-release alpha
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Structured flows for coding agents.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Circuit changes what your coding agent is allowed to call done. Each
            step runs against a contract, so the next step only starts when the
            previous one actually finished.
          </p>
          <div className="mt-2 flex flex-col gap-3">
            <p className="text-sm font-medium text-muted-foreground">
              Install for Claude Code
            </p>
            <pre className="rounded-md border bg-muted/50 px-4 py-3 text-sm leading-6 font-mono">
              <code>
                /plugin marketplace add petekp/circuit-next{"\n"}
                /plugin install circuit@circuit-next{"\n"}
                /reload-plugins
              </code>
            </pre>
            <p className="text-sm text-muted-foreground">
              Then ask Circuit to choose a flow:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                /circuit:run &lt;your task&gt;
              </code>
            </p>
          </div>
        </section>

        <Separator />

        <section className="flex flex-col gap-6">
          <h2 className="text-2xl font-semibold tracking-tight">Flows</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {flows.map((flow) => (
              <Card key={flow.name}>
                <CardHeader>
                  <CardTitle className="flex items-baseline justify-between gap-3">
                    <span>{flow.name}</span>
                    <code className="text-xs font-mono text-muted-foreground">
                      {flow.command}
                    </code>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {flow.summary}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator />

        <section className="flex flex-col gap-6">
          <h2 className="text-2xl font-semibold tracking-tight">
            What you get
          </h2>
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {principles.map((p) => (
              <li key={p.title} className="flex flex-col gap-1">
                <h3 className="font-medium">{p.title}</h3>
                <p className="text-sm text-muted-foreground">{p.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <Separator />

        <footer className="flex flex-col gap-2 pb-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>Circuit — pre-release alpha</span>
          <a
            href="https://github.com/petekp/circuit-next"
            className="font-medium text-foreground hover:underline"
          >
            github.com/petekp/circuit-next
          </a>
        </footer>
      </main>
    </div>
  );
}
