// Migrate flow package.
//
// Routable via /circuit:run and also exposed through a direct command
// surface. It has no flow-owned command source because
// src/commands/migrate.md owns that host command source.

import type { CompiledFlowPackage, CompiledFlowSignal } from '../types.js';
import { migrateInventoryShapeHint, migrateReviewShapeHint } from './relay-hints.js';
import {
  MigrateBatch,
  MigrateBrief,
  MigrateCoexistence,
  MigrateInventory,
  MigrateResult,
  MigrateReview,
  MigrateVerification,
} from './reports.js';
import { migrateBriefComposeBuilder } from './writers/brief.js';
import { migrateCloseBuilder } from './writers/close.js';
import { migrateCoexistenceComposeBuilder } from './writers/coexistence.js';
import { migrateVerificationWriter } from './writers/verification.js';

const MIGRATE_SIGNALS: readonly CompiledFlowSignal[] = [
  { label: 'migrate prefix', pattern: /^\s*migrate\s*:/i },
  {
    label: 'migrate request',
    pattern:
      /^\s*(?:please\s+)?(?:migrate|port|swap|replace|rewrite|transition)\s+(?:a\s+|an\s+|the\s+|this\s+|that\s+|my\s+|all\s+|our\s+)?\S+/i,
  },
  {
    label: 'framework swap signal',
    pattern: /\b(?:framework|library|dependency|stack)\s+(?:swap|replacement|migration)\b/i,
  },
];

export const migrateCompiledFlowPackage: CompiledFlowPackage = {
  id: 'migrate',
  visibility: 'public',
  paths: {
    schematic: 'src/flows/migrate/schematic.json',
  },
  routing: {
    order: 10,
    signals: MIGRATE_SIGNALS,
    skipOnPlanningReport: true,
    reasonForMatch(signal) {
      return `matched ${signal.label}; routed to Migrate flow`;
    },
  },
  relayReports: [
    {
      schemaName: 'migrate.inventory@v1',
      schema: MigrateInventory,
      relayHint: migrateInventoryShapeHint.instruction,
    },
    {
      schemaName: 'migrate.review@v1',
      schema: MigrateReview,
      relayHint: migrateReviewShapeHint.instruction,
    },
  ],
  reportSchemas: [
    { schemaName: 'migrate.brief@v1', schema: MigrateBrief },
    { schemaName: 'migrate.coexistence@v1', schema: MigrateCoexistence },
    { schemaName: 'migrate.batch@v1', schema: MigrateBatch },
    { schemaName: 'migrate.verification@v1', schema: MigrateVerification },
    { schemaName: 'migrate.result@v1', schema: MigrateResult },
  ],
  writers: {
    compose: [migrateBriefComposeBuilder, migrateCoexistenceComposeBuilder],
    close: [migrateCloseBuilder],
    verification: [migrateVerificationWriter],
    checkpoint: [],
  },
};
