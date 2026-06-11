---
name: Sidebar context pattern
description: How the collapsible sidebar state is shared across layout components without breaking Fast Refresh
---

The sidebar collapse state is managed via React Context split across two files:

- `SidebarContext.tsx` — exports `SidebarProvider` (provider component) and `useSidebar` (hook). No default export.
- `LayoutClient.tsx` — default export only; wraps children in `SidebarProvider`. Imported in the server `layout.tsx`.
- `Sidebar.tsx` and `MainContent.tsx` — import `useSidebar` from `SidebarContext.tsx` only.

**Why:** Next.js Fast Refresh breaks when a file exports both a React component (default) and a non-component value (hook) that is consumed by another module outside the React tree. Keeping the hook/context in its own file (no default export) prevents this.

**How to apply:** Any time you add a shared state to the layout, put the context + hook in a dedicated `*Context.tsx` file with no default export, and import the hook from there, never from the component file.
