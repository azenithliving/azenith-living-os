import { CommandCanvas } from "@/components/admin/v2/CommandCanvas";

/**
 * The swarm address. It mounts the same canvas as the owner's front door rather than
 * carrying its own copy: two pages with two counters is how two screens start telling him
 * two different numbers about one store.
 */
export default function V2AgentsPage() {
  return <CommandCanvas />;
}
