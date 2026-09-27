// Lazy loading of the wasm engines. `engine.wasm` (ip-web-engine) is small and loads on
// any page that shows a problem. `typeset.wasm` (ip-web-typeset) is loaded only when the
// user actually asks for a PDF (SPEC §6.0).

let enginePromise = null;
let typesetPromise = null;

async function initEngine() {
  const mod = await import('./pkg/ip_web_engine.js');
  await mod.default();
  return mod;
}

function getEngine() {
  if (!enginePromise) enginePromise = initEngine();
  return enginePromise;
}

/** Call an exported engine function by name, parsing its JSON-string result.
 * If the wasm call throws (a panic trapped the instance, or a JS exception), the cached
 * instance is dropped so the next call gets a fresh one, and the error is re-thrown. */
export async function callEngine(fnName, ...args) {
  const mod = await getEngine();
  try {
    const raw = mod[fnName](...args);
    return JSON.parse(raw);
  } catch (e) {
    enginePromise = null;
    throw e;
  }
}

async function initTypeset() {
  const mod = await import('./pkg/ip_web_typeset.js');
  await mod.default();
  return mod;
}

function getTypeset() {
  if (!typesetPromise) typesetPromise = initTypeset();
  return typesetPromise;
}

/** Compile a Typst document (from `sheet_typst`) to PDF bytes. Throws on failure. */
export async function compilePdf(main, filesJson) {
  const mod = await getTypeset();
  try {
    return mod.compile_pdf(main, filesJson);
  } catch (e) {
    typesetPromise = null;
    throw e;
  }
}

export function errorText(e) {
  if (typeof e === 'string') return e;
  if (e && e.message) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
