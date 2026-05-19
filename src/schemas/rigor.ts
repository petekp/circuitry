import { z } from 'zod';

export const Rigor = z.enum(['lite', 'standard', 'deep']);
export type Rigor = z.infer<typeof Rigor>;
