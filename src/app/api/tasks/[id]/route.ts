import { supabaseAdmin } from "@/lib/supabase";
import { currentUserId, membershipRole, jsonError } from "@/lib/authz";
import { cleanText, MAX_SHORT } from "@/lib/validation";

// Toggle done / update a task.
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const { data: task } = await supabaseAdmin
    .from("tasks")
    .select("id, business_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!task) return jsonError("Task not found.", 404);
  if (!(await membershipRole(userId, task.business_id)))
    return jsonError("No access to this task.", 403);

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  if ("done" in body) update.done = !!body.done;
  if ("title" in body) {
    const title = cleanText(body.title, MAX_SHORT);
    if (!title) return jsonError("Task title can't be empty.");
    update.title = title;
  }
  if ("dueAt" in body) update.due_at = body.dueAt;

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .update(update)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) return jsonError("Could not update task.", 500);
  return Response.json({ task: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const { data: task } = await supabaseAdmin
    .from("tasks")
    .select("id, business_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!task) return jsonError("Task not found.", 404);
  if (!(await membershipRole(userId, task.business_id)))
    return jsonError("No access to this task.", 403);

  await supabaseAdmin.from("tasks").delete().eq("id", params.id);
  return Response.json({ ok: true });
}
