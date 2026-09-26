/**
 * The wire shape of the swarm's self-model — what `GET /api/admin/qayyim/self`
 * answers and what the chat screen renders.
 *
 * It lives in its own client-safe file on purpose: `self-model.ts` reads the
 * service-role database and imports `server-only`, so no component may touch it.
 * Every Arabic phrase the owner sees is produced on the server, which is why
 * `counters` arrives as label/value pairs instead of a key the browser has to
 * translate by hand.
 */

export interface SelfToolView {
  name: string;
  desc: string;
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
