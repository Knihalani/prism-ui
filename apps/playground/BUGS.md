# Chat demo verification notes

The previous workbench identity and table-fallback findings were fixed on `playground` before this redesign. Its editor, metrics, and inspector drawers have been replaced with a chat interface.

Production verification covers all sidebar examples, including both chart modes, all four mockup formats, grouped A/B mockups, and all five artifact formats. The mockup image example uses an embedded SVG: the mockup renderer intentionally accepts only HTTPS or image data URLs, not relative asset URLs.

The chat is a local scripted demo. It has no LLM/backend connection, and only component state (not the thread text) persists across reloads. React artifacts use the artifact package’s pinned external compiler/import map and therefore require network access on first load.
