import { getSessionUser, HttpError } from "@/lib/auth";
import { getRun } from "@/lib/arena/engine";

/** A run is visible to its owner, and to everyone when it is the public demo. */
export async function readableRun(runId: string) {
  const run = await getRun(runId);
  if (!run) throw new HttpError(404, "Run not found");
  if (run.isPublicDemo) return { run, user: await getSessionUser() };
  const user = await getSessionUser();
  if (!user || user.uid !== run.ownerId) throw new HttpError(403, "Not your run");
  return { run, user };
}
