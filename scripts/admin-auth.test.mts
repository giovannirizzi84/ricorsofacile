import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../src/app/api/admin/stats/route.ts";

test("admin-auth.test", async () => {
  const previousAdminSecret = process.env.ADMIN_SECRET;
  const previousSupabaseMode = process.env.SUPABASE_TEST_MODE;

  try {
    delete process.env.ADMIN_SECRET;
    process.env.SUPABASE_TEST_MODE = "memory";

    const notConfigured = await GET(
      new Request("http://localhost/api/admin/stats?secret=test-secret"),
    );
    assert.equal(notConfigured.status, 503);

    process.env.ADMIN_SECRET = "test-secret";
    const unauthorized = await GET(
      new Request("http://localhost/api/admin/stats?secret=wrong"),
    );
    assert.equal(unauthorized.status, 401);
  } finally {
    restoreEnv("ADMIN_SECRET", previousAdminSecret);
    restoreEnv("SUPABASE_TEST_MODE", previousSupabaseMode);
  }
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
