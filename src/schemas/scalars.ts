import { z } from 'zod';

/**
 * Path-safe filename stem for engine state and continuity records (run
 * folders, continuity records, similar). Used for any field whose value
 * is joined into a filesystem path at parse time, not at the call site.
 *
 * Any field that is later used as a path stem should use this (or a
 * conservatively-equivalent scalar) so path-traversal, Windows reserved
 * names, and case-folding hazards are rejected up front rather than at the
 * eventual `path.join` call.
 */
export const ControlPlaneFileStem = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9._-]*$/, {
    message:
      'must match /^[a-z0-9][a-z0-9._-]*$/ (lowercase alnum start; alnum, dot, underscore, hyphen thereafter)',
  })
  .refine((value) => value !== '.' && value !== '..', {
    message: 'must not be a current or parent directory segment',
  })
  .refine((value) => !value.includes('..'), {
    message: 'must not contain parent-directory traversal',
  })
  .refine((value) => !value.includes('/') && !value.includes('\\'), {
    message: 'must not contain path separators',
  });

export type ControlPlaneFileStem = z.infer<typeof ControlPlaneFileStem>;

/**
 * Portable POSIX-style path relative to a single run folder. This scalar is
 * for flow-authored read/write paths that the runtime later resolves into
 * the run directory.
 */
export const RunRelativePath = z
  .string()
  .min(1, { message: 'run-relative path must be non-empty' })
  .refine((value) => !value.startsWith('/'), {
    message: 'run-relative path must not be absolute',
  })
  .refine((value) => !value.includes('\\'), {
    message: 'run-relative path must use POSIX "/" separators, not backslashes',
  })
  .refine((value) => !value.includes(':'), {
    message: 'run-relative path must not contain drive-letter or colon forms',
  })
  .refine(
    (value) =>
      value
        .split('/')
        .every((segment) => segment.length > 0 && segment !== '.' && segment !== '..'),
    {
      message:
        'run-relative path must not contain empty, current-directory, or parent-directory segments',
    },
  )
  .brand<'RunRelativePath'>();

export type RunRelativePath = z.infer<typeof RunRelativePath>;
