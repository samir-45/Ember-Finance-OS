---
name: Headers iterable typing
description: TypeScript library support needed when generated API clients iterate request headers.
---

Keep `DOM.Iterable` enabled in the TypeScript `lib` options wherever generated client code uses `Headers.entries()`.

**Why:** The browser API works at runtime, but TypeScript reports that `Headers.entries()` is missing unless iterable DOM declarations are included.

**How to apply:** If generated request code or TypeScript configuration changes, confirm the client still typechecks with its header iteration intact.
