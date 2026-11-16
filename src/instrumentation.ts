export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureBootstrapped } = await import("./lib/bootstrap");
    await ensureBootstrapped();
  }
}
