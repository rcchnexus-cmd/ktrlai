import { getBearerToken } from "./_auth.js";

export async function requirePlatformAdmin(supabase, req, res) {
  const token = getBearerToken(req);

  if (!token) {
    res.status(401).json({
      ok: false,
      message: "Authentication is required to access platform admin data."
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

  const { data: admin, error: adminError } = await supabase
    .from("platform_admins")
    .select("id, user_id, role, created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError) {
    res.status(500).json({
      ok: false,
      message: "Platform admin access could not be verified."
    });
    return { ok: false };
  }

  if (!admin || !["admin", "owner", "operator"].includes(String(admin.role || "").toLowerCase())) {
    res.status(403).json({
      ok: false,
      message: "Access denied. Platform administrator privileges are required."
    });
    return { ok: false };
  }

  return {
    ok: true,
    user,
    admin
  };
}
