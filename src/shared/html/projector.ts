// HTML projector contract.
//
// A projector renders a single flow's operator-summary HTML from the run
// folder. It owns evidence loading, schema validation, and gating logic for
// its flow. The writer dispatches by flow id through HTML_PROJECTORS.

export type JsonObject = Record<string, unknown>;

export type HtmlProjectorContext = {
  readonly runFolder: string;
  readonly runId: string;
  readonly flowId: string;
  readonly runOutcome: string;
  readonly checkpoint?:
    | {
        readonly step_id: string;
        readonly request_path: string;
        readonly allowed_choices: readonly string[];
      }
    | undefined;
  readonly flowReport: JsonObject | undefined;
  readonly readJsonRunRelative: (relPath: string) => JsonObject | undefined;
  readonly readEvidenceReportById: (reportId: string) => JsonObject | undefined;
};

// Returns rendered HTML, or undefined when the flow has not produced the
// inputs HTML projection requires (e.g. an Explore run that has not yet
// finalized a decision).
export type HtmlProjector = (ctx: HtmlProjectorContext) => string | undefined;
