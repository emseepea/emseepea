import { AssertionError } from "node:assert";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Calculate the WCAG contrast ratio for two opaque sRGB hex colors. */
export function wcagContrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(parseHexColor(foreground, "foreground"));
  const backgroundLuminance = relativeLuminance(parseHexColor(background, "background"));
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Assert that two opaque sRGB hex colors meet a required WCAG contrast ratio. */
export function assertWcagContrast(
  foreground: string,
  background: string,
  minimumRatio: number,
  label?: string,
): number {
  if (!Number.isFinite(minimumRatio) || minimumRatio <= 0) {
    throw new TypeError("minimumRatio must be a finite positive number.");
  }
  const ratio = wcagContrastRatio(foreground, background);
  if (ratio < minimumRatio) {
    throw new AssertionError({
      actual: ratio,
      expected: minimumRatio,
      operator: ">=",
      message: `${label ? `${label}: ` : ""}${foreground} on ${background} has a contrast ratio of ${ratio.toFixed(2)}:1; expected at least ${minimumRatio}:1.`,
    });
  }
  return ratio;
}

function parseHexColor(color: string, name: "foreground" | "background"): readonly [number, number, number] {
  if (typeof color !== "string" || !HEX_COLOR.test(color)) {
    throw new TypeError(`${name} must be an opaque sRGB color in #RRGGBB format.`);
  }
  return [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ];
}

function relativeLuminance([red, green, blue]: readonly [number, number, number]): number {
  return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
}

function linearize(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}
