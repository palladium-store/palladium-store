export class ZodError extends Error { issues: { path: (string|number)[]; message: string }[] = []; }
export const z = {};
