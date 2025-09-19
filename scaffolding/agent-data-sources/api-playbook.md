# API Playbook

## Description
This playbook documents the reference architecture for wrapping existing RESTful APIs with an MCP-compliant facade. It standardises schemas, tooling, and governance to keep the MCP server predictable and evolution-friendly.

## Platform / Framework Details
- Core framework or platform: Express + TypeScript with a lightweight middleware stack tailored for MCP tool routing.
- Standard request/response patterns: JSON body with camelCase fields externally, transformed to snake_case internally; idempotent `POST` for tool calls; 202 with callback token for long-running jobs.
- Authentication & authorization rules: None in the base template; add org-specific auth when promoting beyond sandbox usage.
- Versioning strategy: Semantic versioning tied to MCP schema (`v1alpha`, `v1beta`, `v1`); deprecations flagged 90 days before removal via changelog and webhook notifications.
- Error handling conventions: Structured errors `{ "code": "TOOL_VALIDATION_ERROR", "message": "...", "details": {} }`; retryable errors explicitly tagged; correlation IDs propagated via `X-Request-ID`.

## Key References
- Schema templates: `scaffolding/agents/schemas/tool_call.schema.json` (baseline contract), plus JSON Schema snippets for tool payloads.
- Contract guidelines: API review checklist in `scaffolding/agents/docs/api-governance.md`; require examples and automated schema tests.
- Compliance requirements: None prescribed for the template; teams can extend with SOC 2, GDPR, or other controls as needed.

## Implementation Notes
Follow this ADR workflow whenever proposing a major pattern change (transport, schema style, or tooling dependency):
1. Draft an ADR in `docs/adr/` using the template `docs/adr/_template.md` and describe the problem, options considered, and decision criteria.
2. Attach proof-of-concept code or experiments in a separate branch and link them in the ADR so reviewers can validate assumptions.
3. Circulate the ADR in `#mcp-architecture` for a 48-hour comment period; capture feedback and update the decision record before merging.
4. Once approved, update the API checklist, schema templates, and example tool handlers to reflect the new pattern, then tag the next minor release.

## Last Reviewed
- Date: 2024-04-02
- Reviewer: Lena Park (API Platform Lead)
