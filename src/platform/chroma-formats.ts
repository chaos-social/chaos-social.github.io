/*
 * Native builds keep chroma-js's side-effect imports, so this only re-exports
 * the barrel. Import chroma from here everywhere so the web variant is picked
 * up automatically; see ./chroma-formats.web.ts.
 */
export {default as chroma} from 'chroma-js'
