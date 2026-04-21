import postgres from 'postgres';

async function seed() {
  const connectionString = "postgresql://postgres.dmavypdmtbxzwrexqesu:3laa1992aziz@aws-1-eu-central-1.pooler.supabase.com:5432/postgres";
  const sql = postgres(connectionString);

  try {
    console.log("🚀 Seeding Omnipotent Dimensions & Anchors...");

    // 1. Insert Dimensions
    const dimensions = await sql`
      INSERT INTO omnipotent_dimensions (name, risk_level, description)
      VALUES 
        ('surface', 1, 'Clear web, indexed by public search engines'),
        ('academic', 2, 'Scholarly articles, research papers, journals'),
        ('regional', 3, 'Geographically restricted or specialized search engines'),
        ('code', 2, 'Source code repositories and developer forums'),
        ('social', 4, 'Social media networks and real-time feeds'),
        ('archive', 2, 'Historical internet archives and cached pages')
      ON CONFLICT (name) DO UPDATE SET 
        risk_level = EXCLUDED.risk_level, 
        description = EXCLUDED.description
      RETURNING id, name;
    `;

    const dimMap: Record<string, string> = {};
    dimensions.forEach((d: any) => dimMap[d.name] = d.id);

    // 2. Insert Anchors (Engines)
    await sql`
      INSERT INTO dimensional_anchors (name, base_url, dimension_id, is_active, reliability_score)
      VALUES 
        ('Google', 'https://www.google.com/search?q=', ${dimMap['surface']}, true, 1.0),
        ('Bing', 'https://www.bing.com/search?q=', ${dimMap['surface']}, true, 1.0),
        ('DuckDuckGo', 'https://html.duckduckgo.com/html/?q=', ${dimMap['surface']}, true, 1.0),
        ('Yahoo', 'https://search.yahoo.com/search?p=', ${dimMap['surface']}, true, 1.0),
        ('Brave', 'https://search.brave.com/search?q=', ${dimMap['surface']}, true, 1.0),
        ('Startpage', 'https://www.startpage.com/do/search?q=', ${dimMap['surface']}, true, 1.0),
        ('Ecosia', 'https://www.ecosia.org/search?q=', ${dimMap['surface']}, true, 1.0),
        ('Qwant', 'https://lite.qwant.com/?q=', ${dimMap['surface']}, true, 1.0),
        ('Mojeek', 'https://www.mojeek.com/search?q=', ${dimMap['surface']}, true, 1.0),
        ('Yandex', 'https://yandex.com/search/?text=', ${dimMap['regional']}, true, 1.0),
        ('Sogou', 'https://www.sogou.com/web?query=', ${dimMap['regional']}, true, 1.0),
        ('Naver', 'https://search.naver.com/search.naver?query=', ${dimMap['regional']}, true, 1.0),
        ('Google Scholar', 'https://scholar.google.com/scholar?q=', ${dimMap['academic']}, true, 1.0),
        ('Wikipedia', 'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=', ${dimMap['academic']}, true, 1.0),
        ('WikiAr', 'https://ar.wikipedia.org/w/api.php?action=query&list=search&srsearch=', ${dimMap['academic']}, true, 1.0),
        ('GitHub', 'https://github.com/search?q=', ${dimMap['code']}, true, 1.0),
        ('StackOverflow', 'https://stackoverflow.com/search?q=', ${dimMap['code']}, true, 1.0),
        ('Reddit', 'https://old.reddit.com/search?q=', ${dimMap['social']}, true, 1.0),
        ('X', 'https://twitter.com/search?q=', ${dimMap['social']}, true, 1.0),
        ('Archive', 'https://web.archive.org/web/*/', ${dimMap['archive']}, true, 1.0)
      ON CONFLICT DO NOTHING;
    `;

    console.log("✅ Seeding completed! Database is fully armed.");
  } catch (err) {
    console.error("❌ Failed to seed database:", err);
  } finally {
    await sql.end();
  }
}

seed();
