export function interpolatePrompt(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\[([^\]]+)\]/g, (_match, key: string) => {
    const value = vars[key];
    return value ?? '';
  });
}


