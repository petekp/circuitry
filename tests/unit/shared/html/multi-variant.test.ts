import { describe, expect, it } from 'vitest';

import {
  isPreviewableArtifactPath,
  previewForEntryPoints,
  renderMultiVariantComparisonPage,
  runArtifactPreviewHref,
} from '../../../../src/shared/html/multi-variant.js';

describe('multi-variant HTML primitives', () => {
  it('recognizes visual artifact paths without treating evidence docs as previews', () => {
    expect(isPreviewableArtifactPath('prototype-files/variants/a/index.html')).toBe(true);
    expect(isPreviewableArtifactPath('prototype-files/variants/a/screen.png')).toBe(true);
    expect(isPreviewableArtifactPath('prototype-files/variants/a/README.md')).toBe(false);
    expect(isPreviewableArtifactPath('reports/prototype/variant-review.json')).toBe(false);
  });

  it('builds report-relative preview URLs only for artifacts inside the current run', () => {
    const runFolder = '/tmp/project/.circuit/runs/run-123';
    expect(
      runArtifactPreviewHref({
        entryPath: '.circuit/runs/run-123/prototype-files/variants/a/index.html',
        runFolder,
      }),
    ).toBe('../prototype-files/variants/a/index.html');
    expect(
      runArtifactPreviewHref({
        entryPath: '/tmp/project/.circuit/runs/run-123/prototype-files/with space/index.html',
        runFolder,
      }),
    ).toBe('../prototype-files/with%20space/index.html');
    expect(
      runArtifactPreviewHref({
        entryPath: '.circuit/runs/other-run/prototype-files/variants/a/index.html',
        runFolder,
      }),
    ).toBeUndefined();
    expect(
      runArtifactPreviewHref({
        entryPath: '.circuit/runs/run-123/prototype-files/variants/a/README.md',
        runFolder,
      }),
    ).toBeUndefined();
    expect(
      runArtifactPreviewHref({
        entryPath: '.circuit/prototypes/external-run/variants/a/index.html',
        runFolder,
        projectRoot: '/tmp/project',
      }),
    ).toBe('file:///tmp/project/.circuit/prototypes/external-run/variants/a/index.html');
  });

  it('selects the first previewable entry point from current-run artifacts', () => {
    expect(
      previewForEntryPoints({
        entryPoints: [
          '.circuit/runs/run-123/prototype-files/variants/a/README.md',
          '.circuit/runs/run-123/prototype-files/variants/a/index.html',
        ],
        runFolder: '/tmp/project/.circuit/runs/run-123',
      }),
    ).toEqual({
      href: '../prototype-files/variants/a/index.html',
      sourcePath: '.circuit/runs/run-123/prototype-files/variants/a/index.html',
    });
  });

  it('renders a pinned preview rail only when at least one variant has a visual preview', () => {
    const html = renderMultiVariantComparisonPage({
      title: 'Variant checkpoint',
      metaLine: 'Prototype - run',
      headline: 'Choose a variant',
      subtitle: 'Compare variants.',
      recommendation: {
        label: 'Variant A',
        rationale: 'Clearer visual artifact.',
        badgeText: 'Recommended variant',
        intent: 'positive',
      },
      variants: [
        {
          id: 'variant-a',
          label: 'Variant A',
          description: 'Clearer.',
          recommended: true,
          facts: [{ label: 'Relay', value: 'anthropic/sonnet (medium)' }],
          evidence: ['artifact exists'],
          preview: {
            href: '../prototype-files/variants/a/index.html',
            sourcePath: '.circuit/runs/run/prototype-files/variants/a/index.html',
          },
        },
        {
          id: 'variant-b',
          label: 'Variant B',
          description: 'Denser.',
          recommended: false,
          facts: [],
          evidence: ['artifact exists'],
        },
      ],
    });

    expect(html).toContain('mv-wrap mv-visual');
    expect(html).toContain('position:fixed');
    expect(html).toContain('overscroll-behavior:contain');
    expect(html).toContain('data-mv-frame');
    expect(html).toContain('src="../prototype-files/variants/a/index.html"');
  });

  it('renders evidence-first comparison without preview chrome for non-visual variants', () => {
    const html = renderMultiVariantComparisonPage({
      title: 'Variant checkpoint',
      metaLine: 'Prototype - run',
      headline: 'Choose a variant',
      subtitle: 'Compare variants.',
      recommendation: {
        label: 'Variant A',
        rationale: 'Better evidence.',
        badgeText: 'Recommended variant',
        intent: 'positive',
      },
      variants: [
        {
          id: 'variant-a',
          label: 'Variant A',
          description: 'Clearer report.',
          recommended: true,
          facts: [{ label: 'Relay', value: 'anthropic/sonnet (medium)' }],
          evidence: ['reports/a.json'],
        },
        {
          id: 'variant-b',
          label: 'Variant B',
          description: 'Denser report.',
          recommended: false,
          facts: [],
          evidence: ['reports/b.json'],
        },
      ],
    });

    expect(html).toContain('mv-wrap mv-evidence');
    expect(html).not.toContain('data-mv-frame');
    expect(html).not.toContain('Selected variant preview');
    expect(html).toContain('reports/a.json');
    expect(html).toContain('reports/b.json');
  });
});
