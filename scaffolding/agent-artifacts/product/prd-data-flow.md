# Product Requirements Document (Money & Data Focus)

## Opportunity
- Customer problem:
- Business impact:
- Success metric:

## Money Flow Summary
- Revenue sources:
- Cost structure:
- Guardrails / compliance:

## Data Flow Diagram (C3 Mermaid)
```mermaid
flowchart LR
    classDef ok fill:#e6ffed,stroke:#047857,stroke-width:2px;
    classDef caution fill:#fffbea,stroke:#b7791f,stroke-width:2px;
    classDef risky fill:#fee2e2,stroke:#c53030,stroke-width:2px;
    classDef neutral fill:#edf2f7,stroke:#4a5568,stroke-width:1px;

    %% Update the containers/services and apply classes to show change risk.
    %% Example: class ServiceNew ok;  linkStyle 0 stroke:#047857,stroke-width:2px;

    subgraph Container_A[Container A]
        ServiceA[Service A]
        ServiceB[Service B]
    end
    subgraph Container_B[Container B]
        ServiceC[Service C]
    end
    ServiceA -->|Event| ServiceC
    ServiceB -->|API| ServiceC
    ServiceC --> DataStore[(Data Store)]

    class Container_A neutral;
    class Container_B neutral;
    class ServiceA neutral;
    class ServiceB neutral;
    class ServiceC neutral;
    class DataStore neutral;
```
- Apply classes: `ok` (green) for safe/minor changes, `caution` (yellow) for significant work, and `risky` (red) for high-risk additions.
- Use `neutral` for existing elements that remain untouched this cycle. Update `linkStyle` directives for edges when risk varies by connection.
- API capabilities (name, purpose, status):
- Data contracts (schemas, retention, privacy):

## Release Scope
| Capability | API Endpoint | Owner | Notes |
|------------|--------------|-------|-------|

## Implementation Notes
- Dependencies:
- Open questions:
- Rollout strategy:

_Last updated: YYYY-MM-DD_
