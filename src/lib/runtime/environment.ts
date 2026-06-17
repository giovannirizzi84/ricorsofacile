export function isProductionRuntime() {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

export function isOcrRecoveryEnabled() {
  return !isProductionRuntime();
}
