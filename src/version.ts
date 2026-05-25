/// Single source of truth for the CLI version. Sent on every HTTP request
/// as `X-XHermes-CLI-Version` so the control plane can enforce a minimum
/// supported version and 426 Upgrade Required older clients. Keep in sync
/// with `version` in package.json on every release.

export const CLI_VERSION = "0.0.1";
export const CLI_VERSION_HEADER = "X-XHermes-CLI-Version";
