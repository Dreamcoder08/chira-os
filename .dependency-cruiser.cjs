module.exports = {
  forbidden: [
    {
      name: 'domain-has-no-infrastructure',
      severity: 'error',
      from: { path: '^packages/domain/' },
      to: { pathNot: '^packages/domain/', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'web-does-not-import-server',
      severity: 'error',
      from: { path: '^apps/web/' },
      to: { path: '^(apps/(api|worker)|packages/data)/' },
    },
    {
      name: 'application-does-not-import-adapters',
      severity: 'error',
      from: { path: '^packages/domain/' },
      to: { path: '(node_modules|apps/|packages/data/)' },
    },
    { name: 'no-cycles', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
  },
};
