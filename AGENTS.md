<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Who is who: naming map (read before touching any name)

- **«مدير تشغيل المحتوى»** — the job title of the swarm leader. This is the ONLY name a human
  reads: chat headers, agent cards, Telegram messages, daily reports, the owner dashboard.
- **«قيّم الدار» / "Qayyim al-Dar"** — the product brand of the suite. It stays where the line is
  a brand line: the studio headers, the seed card's subtitle, the `brand` field of the self-model.
  It is not the agent's name, and it must never be used as one in a sentence addressed to the owner.
- **`qayyim-core` … `qayyim-qa`** — agent KEYS. They are stored in every `agent_messages` and
  `qayyim_sync_events` row. Renaming a key is a data migration, never a find-and-replace.
- **`lib/qayyim/**`, `app/api/admin/qayyim/**`, tables `qayyim_*`** — root identifiers that still
  carry the brand on purpose. Retiring them is its own planned phase, not a side cleanup.

So: "content operations manager" or «مدير تشغيل المحتوى» in a task means the human-facing
surfaces; `qayyim-*` means the key. Searching the code for the job title and concluding the
feature does not exist is the mistake this map exists to prevent.
