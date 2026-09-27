/* tslint:disable */
/* eslint-disable */

/**
 * Compile a Typst document to PDF bytes.
 *
 * `main` is the Typst source of the main file. `files_json` is a JSON
 * object mapping virtual file path to UTF-8 string content, e.g.
 * `{"qr/1.svg": "<svg ...>"}`, which the source can reference (e.g. via
 * `image("qr/1.svg")`).
 *
 * Returns the PDF bytes (a `Uint8Array` in JS) or throws a JS string error.
 */
export function compile_pdf(main: string, files_json: string): Uint8Array;

/**
 * Forces font loading and standard-library initialization, so a page can
 * pre-warm the compiler (e.g. right after the wasm module is instantiated)
 * instead of paying that cost on the first real compile.
 */
export function warm_up(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly compile_pdf: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly warm_up: () => void;
    readonly __wbindgen_export: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export2: (a: number, b: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
