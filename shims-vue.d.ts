// Lets the TypeScript language server resolve `*.vue` imports. `vue-tsc` derives
// precise per-component types itself; this fallback keeps the plain IDE tsserver
// (without Volar take-over) from flagging SFC imports as unresolved.
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}
