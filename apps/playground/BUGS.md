# Browser verification notes

## Existing streaming bug: provisional component state namespaces

Reproduce: finish the kitchen sink, open State, Reset the shared store, then replay at 4 characters every 8 ms. Before replay, the snapshot contains only `rent`, `launch-plan`, `launch-budget`, `milestones`, and `launch-review`. After replay, it also contains numeric block keys (`7`, `9`, `10`) and truncated IDs. One observed replay added `laun`, `launch-budge`, `mil`, `launch-`, and `launch-revi`; exact prefixes depend on frame/chunk timing. These contain leftover estimate totals, table sort state, or summary completion state.

The reset-before-replay check rules out fixture initialization or leftovers from editing as the source. In `packages/react/src/Prism.tsx`, `Directive` chooses `props.id ?? raw.id ?? node.key` even for incomplete nodes, so its context ID changes as tolerant JSON yields partial string values. `useComponentState` in `packages/react/src/hooks.ts` persists initial values under each current context ID. Estimate's `useEstimate` layout effect also writes totals before `ctx.complete`; only item initialization is completion-gated. Old namespaces remain after the full ID arrives.

No fix was attempted: stable streaming IDs/state migration require a renderer/hooks decision outside the playground, not a trivial component styling correction. The live State drawer intentionally exposes the real snapshot without filtering these keys.

## Existing component gap: data-table fallback

At base commit `6561d5b`, `ui:table` delegates to `dataTable` only when that directive is registered. Otherwise it uses the sortable Markdown-table fallback. The kitchen-sink fixture's `columns[].type: "currency"` and `pageSize` are preserved but not implemented by that fallback: budgets appear as `350`, not localized currency, and there is no pagination. Sorting works.

Reproduce: select Kitchen sink, stream to completion, scroll to “03 / A clear path forward.” Changing currency affects Num/Calc/Estimate but not the fallback table cells.

Relevant upstream implementation: `packages/components/src/table/table.tsx`, `TableDispatcher` and `fallbackRows`. This is a component-catalogue feature gap, not a playground parsing failure. No component files were changed; registering a future dataTable implementation will make the same fixture exercise it automatically.

No component crashes were encountered while streaming the kitchen sink in light/dark themes, choosing an option, changing estimate quantities, and submitting the estimate.
