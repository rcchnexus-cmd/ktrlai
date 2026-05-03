const adminRoles = new Set(["owner", "admin"]);

export function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const value = Array.isArray(header) ? header[0] : header;

  if (!value || !String(value).toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return String(value).slice(7).trim();
}

export async function requireWorkspaceRole(
  supabase,
  req,
  res,
  { workspaceId, allowedRoles = ["owner", "admin"], action = "perform this action" } = {}
) {
  if (!workspaceId) {
    res.status(400).json({
      ok: false,
      message: "workspace_id is required."
    });
    return { ok: false };
  }

  const token = getBearerToken(req);

  if (!token) {
    res.status(401).json({
      ok: false,
      message: `Authentication is required to ${action}.`
    });
    return { ok: false };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData?.user;

  if (userError || !user) {
    res.status(401).json({
      ok: false,
      message: "Authentication token is invalid or expired."
    });
    return { ok: false };
  }

  const { data: member, error: memberError } = await supabase
    .from("workspace_members")
    .select("workspace_id, user_id, role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberError) {
    res.status(500).json({
      ok: false,
      message: "Workspace membership could not be verified."
    });
    return { ok: false };
  }

  if (!member) {
    res.status(403).json({
      ok: false,
      message: "You do not have access to this workspace."
    });
    return { ok: false };
  }

  const allowed = new Set(allowedRoles);

  if (allowed.size > 0 && !allowed.has(member.role)) {
    res.status(403).json({
      ok: false,
      message: "You do not have the required workspace role for this action."
    });
    return { ok: false };
  }

  return {
    ok: true,
    user,
    member,
    isAdmin: adminRoles.has(member.role)
  };
}
