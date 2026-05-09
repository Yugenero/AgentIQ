ENGINEERING STANDARDS — Claude Code must read this before appling any changes or feature updates to the application:

CODE QUALITY
- Follow SOLID principles. Single responsibility per component and service function. Open for extension, closed for modification — no component should need its internals rewritten to add a feature.
- Write modular, reusable code. If the same logic appears twice, extract it. Shared utilities go in utils/, shared types/constants go in lib/.
- Function and variable names must be self-documenting. getName(), formatKD(), buildPlayerSnapshot() are good. data2(), fn(), temp are not. Only add comments for functions with complex math or non-obvious multi-step logic.

TYPESCRIPT / JAVASCRIPT
- Use TypeScript where it adds real value: services, store, utils, and any function that passes structured data between layers. Use plain JS for simple presentational components with no data logic.
- Do not use TypeScript just to add types for the sake of it. Do not use plain JS just to avoid types. Make the call per-file based on complexity and data flow.
- If TypeScript is used in a file, name it .ts or .tsx accordingly.

EXTENSIBILITY
- Design every component, service, and store slice assuming new features will be added later without rewrites. Use props interfaces that can be extended. Keep API service functions thin and composable. Do not hardcode assumptions about the number of players, stats, or views.
- Phase 2 features (comparison, synergy, history) should be addable by dropping in new components and store slices — not by modifying existing ones.

CHANGELOG
- After completing all phases, create CHANGES.md in the project root.
- Format: one section per phase, bullet points only, plain language. What was built, what decisions were made and why (e.g. "used tool_use over structured outputs beta for stability"), any caveats or known limitations.
- This file is the source of truth for the current state of the codebase. Keep it short. No marketing language, no fluff.