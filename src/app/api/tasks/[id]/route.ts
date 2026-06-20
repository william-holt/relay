import { createAdminClient, mapTask, DATABASE_ID, TASKS } from "@/lib/appwrite";
import { currentUserId, membershipRole, jsonError } from "@/lib/authz";
import { cleanText, MAX_SHORT } from "@/lib/validation";

async function loadTaskForUser(userId: string, taskId: string) {
  const { databases } = createAdminClient();
  let task;
  try {
    task = await databases.getDocument(DATABASE_ID, TASKS, taskId);
  } catch {
    return { error: jsonError("Task not found.", 404) };
  }
  if (!(await membershipRole(userId, task.businessId)))
    return { error: jsonError("No access to this task.", 403) };
  return { task };
}

// Toggle done / update a task.
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const { error } = await loadTaskForUser(userId, params.id);
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  if ("done" in body) update.done = !!body.done;
  if ("title" in body) {
    const title = cleanText(body.title, MAX_SHORT);
    if (!title) return jsonError("Task title can't be empty.");
    update.title = title;
  }
  if ("dueAt" in body) update.due_at = body.dueAt;

  try {
    const { databases } = createAdminClient();
    const doc = await databases.updateDocument(
      DATABASE_ID,
      TASKS,
      params.id,
      update
    );
    return Response.json({ task: mapTask(doc) });
  } catch {
    return jsonError("Could not update task.", 500);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const { error } = await loadTaskForUser(userId, params.id);
  if (error) return error;

  try {
    const { databases } = createAdminClient();
    await databases.deleteDocument(DATABASE_ID, TASKS, params.id);
    return Response.json({ ok: true });
  } catch {
    return jsonError("Could not delete task.", 500);
  }
}
