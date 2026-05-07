export type PublicRuntimePathCategory = never;

export type PublicRuntimePathDisposition =
  | 'future-deprecation-candidate'
  | 'keep'
  | 'retained-owned';

export type PublicRuntimePathDeprecationStage = 'none' | 'soft-deprecated';

export interface PublicRuntimePathEntry {
  readonly oldPath: string;
  readonly category: PublicRuntimePathCategory;
  readonly currentDisposition: PublicRuntimePathDisposition;
  readonly deprecationStage: PublicRuntimePathDeprecationStage;
  readonly requiresReviewBeforeDeletion: true;
  readonly currentOwnerPath?: string;
  readonly compatibilityTestPaths: readonly string[];
  readonly notes: string;
}

export const PUBLIC_RUNTIME_PATHS: readonly PublicRuntimePathEntry[] = [];

export const PUBLIC_RUNTIME_WRAPPER_PATHS = PUBLIC_RUNTIME_PATHS.filter(
  (entry) => entry.currentOwnerPath !== undefined,
);

export const PUBLIC_RUNTIME_RETAINED_PATHS = PUBLIC_RUNTIME_PATHS.filter(
  (entry) => entry.currentOwnerPath === undefined,
);

export const PUBLIC_RUNTIME_SOFT_DEPRECATED_PATHS = PUBLIC_RUNTIME_PATHS.filter(
  (entry) => entry.deprecationStage === 'soft-deprecated',
);
