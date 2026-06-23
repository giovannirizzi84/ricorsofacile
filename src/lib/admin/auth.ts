export function verifyAdminSecret(request: Request) {
  const configured = process.env.ADMIN_SECRET?.trim();
  if (!configured) return { ok: false, reason: "not_configured" } as const;

  const url = new URL(request.url);
  const provided =
    request.headers.get("x-admin-secret")?.trim() ||
    url.searchParams.get("secret")?.trim();

  if (provided !== configured) {
    return { ok: false, reason: "unauthorized" } as const;
  }

  return { ok: true, reason: "ok" } as const;
}
