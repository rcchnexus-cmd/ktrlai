import { resolveTxt } from "node:dns/promises";
import { requireWorkspaceRole } from "./_auth.js";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "./_supabaseAdmin.js";
import { auditEventTypes, recordAuditEvent } from "./_audit.js";

const propagationMessage = "TXT record not found yet. DNS can take a few minutes to propagate.";

function getRequestBody(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return req.body;
}

function normalizeHostname(hostname) {
  return String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function toClientDomain(domain) {
  return {
    id: domain.id,
    workspaceId: domain.workspace_id,
    hostname: domain.hostname,
    status: domain.status,
    verificationToken: domain.verification_token,
    verifiedAt: domain.verified_at,
    lastCheckedAt: domain.last_checked_at
  };
}

async function updateDomainStatus(supabase, domainId, updates) {
  const { data, error } = await supabase
    .from("domains")
    .update(updates)
    .eq("id", domainId)
    .select("id, workspace_id, hostname, status, verification_token, verified_at, last_checked_at")
    .single();

  return { data, error };
}

async function markFailedOrPending(supabase, domainId, checkedAt) {
  const failedUpdate = await updateDomainStatus(supabase, domainId, {
    status: "failed",
    last_checked_at: checkedAt
  });

  if (!failedUpdate.error) {
    return failedUpdate;
  }

  return updateDomainStatus(supabase, domainId, {
    status: "pending",
    last_checked_at: checkedAt
  });
}

function flattenTxtRecords(records) {
  return records.flat().map((record) => String(record).trim());
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const body = getRequestBody(req);
  const domainId = body.domain_id || body.domainId;
  const workspaceId = body.workspace_id || body.workspaceId;

  if (!domainId || !workspaceId) {
    return res.status(400).json({
      ok: false,
      message: "domain_id and workspace_id are required."
    });
  }

  if (!isSupabaseAdminConfigured()) {
    const checkedAt = new Date().toISOString();
    return res.status(202).json({
      ok: true,
      mode: "mock",
      verified: true,
      message: "Domain verification accepted in mock mode.",
      domain: {
        id: domainId,
        workspaceId,
        status: "verified",
        verifiedAt: checkedAt,
        lastCheckedAt: checkedAt
      }
    });
  }

  const supabase = getSupabaseAdmin();
  const auth = await requireWorkspaceRole(supabase, req, res, {
    workspaceId,
    action: "verify domains"
  });

  if (!auth.ok) {
    return;
  }

  const { data: domain, error: domainError } = await supabase
    .from("domains")
    .select("id, workspace_id, hostname, status, verification_token, verified_at, last_checked_at")
    .eq("id", domainId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (domainError) {
    return res.status(500).json({
      ok: false,
      mode: "supabase",
      message: "Domain could not be loaded for verification."
    });
  }

  if (!domain) {
    return res.status(404).json({
      ok: false,
      mode: "supabase",
      message: "Domain not found for this workspace."
    });
  }

  const hostname = normalizeHostname(domain.hostname);
  const txtHost = `_ktrlai.${hostname}`;
  const expectedValue = `ktrlai-verify=${domain.verification_token}`;
  const checkedAt = new Date().toISOString();

  let txtRecords = [];

  try {
    txtRecords = flattenTxtRecords(await resolveTxt(txtHost));
  } catch (error) {
    const { data: updatedDomain, error: updateError } = await markFailedOrPending(supabase, domain.id, checkedAt);

    if (updateError) {
      return res.status(500).json({
        ok: false,
        mode: "supabase",
        message: "DNS lookup failed and domain status could not be updated."
      });
    }

    await recordAuditEvent(supabase, {
      workspaceId,
      actorId: auth.user.id,
      eventType: auditEventTypes.domainVerification,
      metadata: {
        domain_id: domain.id,
        hostname,
        status: updatedDomain.status,
        dns_host: txtHost,
        verified: false,
        reason: error.code || "DNS_LOOKUP_FAILED"
      }
    });

    return res.status(200).json({
      ok: false,
      mode: "supabase",
      verified: false,
      message: propagationMessage,
      dnsHost: txtHost,
      expectedValue,
      domain: toClientDomain(updatedDomain),
      errorCode: error.code || "DNS_LOOKUP_FAILED"
    });
  }

  const matched = txtRecords.includes(expectedValue);

  if (!matched) {
    const { data: updatedDomain, error: updateError } = await markFailedOrPending(supabase, domain.id, checkedAt);

    if (updateError) {
      return res.status(500).json({
        ok: false,
        mode: "supabase",
        message: "TXT record did not match and domain status could not be updated."
      });
    }

    await recordAuditEvent(supabase, {
      workspaceId,
      actorId: auth.user.id,
      eventType: auditEventTypes.domainVerification,
      metadata: {
        domain_id: domain.id,
        hostname,
        status: updatedDomain.status,
        dns_host: txtHost,
        verified: false,
        reason: "TXT_MISMATCH"
      }
    });

    return res.status(200).json({
      ok: false,
      mode: "supabase",
      verified: false,
      message: propagationMessage,
      dnsHost: txtHost,
      expectedValue,
      foundValues: txtRecords,
      domain: toClientDomain(updatedDomain)
    });
  }

  const { data: updatedDomain, error: updateError } = await updateDomainStatus(supabase, domain.id, {
    status: "verified",
    verified_at: checkedAt,
    last_checked_at: checkedAt
  });

  if (updateError) {
    return res.status(500).json({
      ok: false,
      mode: "supabase",
      message: "TXT record matched but domain status could not be updated."
    });
  }

  await recordAuditEvent(supabase, {
    workspaceId,
    actorId: auth.user.id,
    eventType: auditEventTypes.domainVerification,
    metadata: {
      domain_id: domain.id,
      hostname,
      status: updatedDomain.status,
      dns_host: txtHost,
      verified: true
    }
  });

  return res.status(200).json({
    ok: true,
    mode: "supabase",
    verified: true,
    message: "Domain verified.",
    dnsHost: txtHost,
    expectedValue,
    domain: toClientDomain(updatedDomain)
  });
}
