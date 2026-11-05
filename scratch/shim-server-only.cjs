/**
 * Point the bundler guard at a harmless stand-in so the real modules can be loaded from a plain Node
 * process. See `scratch/noop-server-only.cjs` for why that is a build-time guard and not a fake.
 */
const Module = require("module");
const path = require("path");

const noop = path.join(__dirname, "noop-server-only.cjs");
const original = Module._resolveFilename;

Module._resolveFilename = function resolveFilename(request, ...rest) {
  if (request === "server-only") return noop;
  return original.call(this, request, ...rest);
};
