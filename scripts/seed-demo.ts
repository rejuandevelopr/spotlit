// Seeds Halftone House (fictional demo venue), a 60 persona baseline run, the strategist's
// measured fixes and a what-if run with the same personas. Usage: npm run seed:demo [-- --force]
import "./_env";

async function main() {
  const { seedDemo } = await import("../lib/demo");
  const force = process.argv.includes("--force");
  const started = Date.now();
  const meta = await seedDemo({ force, log: (s) => console.log(s) });
  console.log(`\nDemo ready in ${Math.round((Date.now() - started) / 1000)}s`);
  console.log(meta);
  // Give the in memory store (mock mode) time to flush to disk.
  await new Promise((r) => setTimeout(r, 800));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
