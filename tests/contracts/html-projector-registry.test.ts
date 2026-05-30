import { describe, expect, it } from 'vitest';

// Importing the catalog runs the registerHtmlProjector(...) side-effects that
// wire flow-specific HTML projectors into the shared registry (CSR-3/MACRO-1
// inverted the shared/html -> flows dependency so the catalog is the one
// sanctioned registration point). This contract pins those registrations: if a
// consumer stops importing the catalog, or a new HTML-emitting flow forgets to
// register, operator-summary HTML emission would silently degrade to
// markdown-only with no other guard catching it.
import { flowPackages } from '../../src/flows/catalog.js';
import { getHtmlProjector } from '../../src/shared/html/index.js';

const HTML_EMITTING_FLOWS = ['build', 'explore', 'prototype'] as const;

describe('HTML projector registry', () => {
  it('registers a projector for each HTML-emitting flow via the catalog side-effect', () => {
    const catalogIds = new Set(flowPackages.map((pkg) => pkg.id));
    for (const flowId of HTML_EMITTING_FLOWS) {
      expect(catalogIds.has(flowId), `${flowId} should be a real catalog flow`).toBe(true);
      expect(getHtmlProjector(flowId), `expected an HTML projector for ${flowId}`).toBeDefined();
    }
  });

  it('returns undefined for flows that do not emit HTML', () => {
    expect(getHtmlProjector('fix')).toBeUndefined();
    expect(getHtmlProjector('goal')).toBeUndefined();
    expect(getHtmlProjector('no-such-flow')).toBeUndefined();
  });
});
