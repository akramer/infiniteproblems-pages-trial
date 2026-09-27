/* tslint:disable */
/* eslint-disable */

/**
 * The curricula, their skills, and the standalone skill list (for the home page).
 */
export function catalog(): string;

/**
 * Rebuild the sheet a (forgivingly typed) sheet code names. Returns
 * `{ok:true, code, code_raw, title, subtitle, notice, count, answers, sections, pool}` or
 * `{ok:false, error}`. Every problem carries its answer and steps whatever the code's answer
 * mode (the on-screen sheet reveals any problem's steps); the problems themselves never
 * depend on the mode.
 */
export function make_sheet(code: string): string;

/**
 * The same question type and variant, with a new (given) seed. "More like this".
 */
export function more_like(code: string, seed: number): string;

/**
 * Decode a (forgivingly typed) problem code and generate its problem, its answer, and its
 * worked solution. Returns `{ok:true, code, code_raw, skill_hint, problem}` or
 * `{ok:false, error}`; if the code is a sheet code, also `sheet_code_raw` so the page can
 * go to the sheet instead.
 */
export function problem(code: string): string;

/**
 * The same sheet settings with a new seed ("New sheet"). Returns `{ok, code, code_raw}`.
 */
export function reseed_sheet(code: string, seed: number): string;

/**
 * A sample problem for a skill's card, at a fixed seed so it's stable across reloads.
 */
export function sample(skill_id: string, level: string): string;

/**
 * The sheet code for a choice on a lesson or skill page. Request:
 * `{curriculum?, lesson?, skills:[{id, level}], count, answers, seed}`.
 * Returns `{ok:true, code, code_raw}` or `{ok:false, error}`.
 */
export function sheet_code(req_json: string): string;

/**
 * Rebuild the sheet a sheet code names and lay it out for print, returning
 * `{ok:true, main, files: {path: content}}` (a Typst document plus its virtual files, e.g.
 * QR SVGs), or `{ok:false, error}`. `sheet_url` is what the header QR opens (the site's
 * `#/s/<code>` page).
 */
export function sheet_typst(code: string, sheet_url: string, problem_url_prefix: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly catalog: (a: number) => void;
    readonly make_sheet: (a: number, b: number, c: number) => void;
    readonly more_like: (a: number, b: number, c: number, d: number) => void;
    readonly problem: (a: number, b: number, c: number) => void;
    readonly reseed_sheet: (a: number, b: number, c: number, d: number) => void;
    readonly sample: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly sheet_code: (a: number, b: number, c: number) => void;
    readonly sheet_typst: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
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
