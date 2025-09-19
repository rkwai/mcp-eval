# Design System Reference

## Description
Because the MCP Evaluation Template exposes functionality purely through the Model Context Protocol, there is no end-user UI to style. This reference instead catalogs the conversational and artifact patterns that keep tool-call transcripts, eval specs, and documentation consistent across teams.

## Design Patterns & Frameworks
- Component framework (e.g., React, Vue): Not applicable; interactions occur via MCP messages and tool payloads only.
- Pattern library or style guide: Conversational tone guide and tool schema conventions maintained in `scaffolding/agents/docs/mcp-style.md`.
- Naming conventions: Tool names use `verb_object` (e.g., `fetch_metric`); eval scenarios prefixed with `journey_` plus intent (e.g., `journey_provisioning_happy_path`).
- Accessibility standards: Text transcripts stored in Markdown with code blocks for payloads; ensure machine-readable formatting for screen readers and diff tooling.

## Key Assets
| Asset | Location | Usage Notes |
|-------|----------|-------------|
| Golden eval transcripts | scaffolding/agent-artifacts/evals/golden/ | Baseline conversations that verify correct tool selection |
| Tool schema catalog | scaffolding/agents/schemas/ | JSON Schemas that define arguments and response payloads |
| Conversational tone guide | scaffolding/agents/docs/mcp-style.md | Keeps assistant prompts consistent during evals |
| Eval runbook | scaffolding/agents/docs/eval-runbook.md | Step-by-step instructions for prepping and executing eval suites |

## Implementation Notes
When adding new tools or eval journeys, update the schema catalog and produce a golden transcript showing expected tool invocations. Keep Markdown formatting consistent (`json` code fences for payloads, timestamp annotations optional). Store diffs from regressions in `agent-artifacts/evals/regressions` so they can be referenced during incident reviews.

## Last Reviewed
- Date: 2024-04-09
- Reviewer: Elise Tan (Knowledge Steward)
