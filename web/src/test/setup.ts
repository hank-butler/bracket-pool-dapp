import Module from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

// Register a .ts handler so that require('./someModule') resolves .ts files.
// This is needed because vitest runs test files as ESM but some tests
// use require() for dynamic imports.
const originalLoad = (Module as any)._extensions['.js'];

(Module as any)._extensions['.ts'] = function (mod: any, filename: string) {
  const source = fs.readFileSync(filename, 'utf8');
  // Use esbuild's synchronous transform to convert TypeScript to CJS
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const esbuild = require('esbuild');
  const result = esbuild.transformSync(source, {
    loader: filename.endsWith('.tsx') ? 'tsx' : 'ts',
    format: 'cjs',
    target: 'node18',
    sourcemap: false,
  });
  mod._compile(result.code, filename);
};

// Also patch Module._resolveFilename to try .ts extension when .js not found
const originalResolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
  try {
    return originalResolve.call(this, request, parent, isMain, options);
  } catch (err: any) {
    if (err.code === 'MODULE_NOT_FOUND' && !request.endsWith('.ts')) {
      try {
        return originalResolve.call(this, request + '.ts', parent, isMain, options);
      } catch {
        // fall through to original error
      }
    }
    throw err;
  }
};
