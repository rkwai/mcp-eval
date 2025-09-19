# Experience Blueprint

## Data Flow Reference
Summarise the relevant sections from `agent-artifacts/product/prd-data-flow.md` that this user flow depends on (e.g., API endpoints, events, data stores).

## Entry Points
| URL | Capability | Audience | Notes |
|-----|------------|----------|-------|

## Key User Flows (Mermaid C3)
```mermaid
flowchart LR
    classDef addition fill:#e6ffed,stroke:#047857,stroke-width:2px;
    classDef deprecation fill:#fee2e2,stroke:#c53030,stroke-width:2px;
    classDef baseline fill:#edf2f7,stroke:#4a5568,stroke-width:1px;

    %% Mark new touchpoints/components with `addition`, retiring ones with `deprecation`,
    %% and keep untouched steps as `baseline`.

    subgraph UI
        Entry[Entry Point]
        View[UI Component]
    end
    subgraph Service
        API[(API / Service)]
    end
    Entry --> View
    View --> API
    API --> Outcome[Outcome]
    View --> Recovery[Recovery Flow]

    class Entry baseline;
    class View baseline;
    class API baseline;
    class Outcome baseline;
    class Recovery baseline;
```
- Success criteria:
- Error / recovery paths:

## Interface Components
| Component | Purpose | Linked Flow | Status |
|-----------|---------|-------------|--------|

## Content & States
- Copy highlights:
- Empty / loading state expectations:
- Accessibility considerations:

## Handoff Notes
- Analytics events to fire:
- Backend capability dependencies:
- Launch checklist:

_Last updated: YYYY-MM-DD_
