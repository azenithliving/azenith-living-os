import { getKeyStats } from "../lib/api-keys-service";

async function run() {
  try {
    const stats = await getKeyStats("pexels");
    console.log(stats);
  } catch(e) {
    console.error("ERROR", e);
  }
}

run();
