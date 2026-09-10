/**
 * Reads .env for scripts, before anything else is imported.
 *
 * The application gets its environment from Next; a script run with tsx gets
 * whatever the shell has. Loading it inside the script itself is too late —
 * imports are evaluated first, so a module that reads an environment variable
 * into a constant at load time would already have captured the default. Hence
 * a module of its own, imported before the ones that read the environment.
 *
 * Anything already exported by the shell wins, so this cannot override what a
 * caller passed on purpose.
 */
try {
  process.loadEnvFile?.();
} catch {
  /* no .env in this checkout: the shell environment is all there is */
}
