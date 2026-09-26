/**
 * The wire shape of the swarm's self-model — what `GET /api/admin/ops/self`
 * answers and what the chat screen renders.
 *
 * It lives in its own client-safe file on purpose: `self-model.ts` reads the
 * service-role database and imports `server-only`, so no component may touch it.
 * Every Arabic phrase the owner sees is produced on the server, which is why
 * `counters` arrives as label/value pairs instead of a key the browser has to
 * translate by hand.
 */

/**
 * A tool crosses the wire as its id and nothing else. Its Arabic name lives in
 * `CAPABILITY_LABELS` (`lib/ops/palette.ts`, client-safe and tested), because
 * the router's `desc` is a prompt written for a model — it carries strings like
 * `p50/p95` and `CORS probe`, and those make an Arabic line unreadable the
 * second a browser puts them in one.
 */
export interface SelfToolView {
  name: string;
}

export interface SelfAgentView {
  key: string;
  name: string;
  roles: number;
}

export interface SelfOrganView {
  label: string;
  cadence: string;
}

export interface SelfCounterView {
  label: string;
  value: number | null;
}

export interface SelfGapView {
  label: string;
  reason: string;
}

export interface SelfModelView {
  generatedAt: string;
  title: string;
  brand: string;
  agents: SelfAgentView[];
  tools: SelfToolView[];
  limits: string[];
  organs: SelfOrganView[];
  counters?: SelfCounterView[];
  dataGaps?: SelfGapView[];
}
