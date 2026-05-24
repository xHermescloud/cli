/// ANSI palette + rendering helpers. Brand: amber instrument light, dim
/// grey chrome. Auto-disables color when stdout is not a TTY or when
/// NO_COLOR is set (per https://no-color.org/).

const useColor = (): boolean => {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR === "0") return false;
  return Boolean(process.stdout.isTTY);
};

const wrap = (open: string, close: string) => (s: string) =>
  useColor() ? `\x1b[${open}m${s}\x1b[${close}m` : s;

/// 256-color amber. Closest match to oklch(0.82 0.15 92) in the xterm palette.
export const amber = wrap("38;5;214", "39");
/// Deep forest accent for chrome lines.
export const forest = wrap("38;5;22", "39");
export const dim = wrap("2", "22");
export const bold = wrap("1", "22");
export const red = wrap("38;5;167", "39");

export const prompt = (s: string): string => amber("›") + " " + s;

/// One-line banner shown at the top of the auth flow.
export const banner = (): string =>
  [
    forest("┌─────────────────────────────────┐"),
    forest("│ ") + amber("xhermes") + dim("  · provisioning terminal") + forest(" │"),
    forest("└─────────────────────────────────┘"),
  ].join("\n");
