# SDK V3 Architecture Decision

## Context
The DEVUP AI SDK must be upgraded from the V2.1.3 baseline to match the authoritative OpenAPI V1 contract. The goal is to provide a robust, contract-compliant, and secure V3 SDK without leaking internal orchestration details.

## Evaluation
1. **Fully handwritten architecture:**
   *Pros:* Complete ergonomic control.
   *Cons:* High risk of contract drift, requires manual replication of complex OpenAPI types.
2. **Generated internal types (OpenAPI Generator / openapi-typescript):**
   *Pros:* Perfect structural typing of requests/responses; fully automatic.
   *Cons:* Unfiltered generated classes (e.g. `DefaultApi`) expose raw REST mechanics and provide poor ergonomics.
3. **Hybrid architecture:**
   *Pros:* Hand-written resource classes (`client.chat.completions`) provide excellent, V2-compatible ergonomics and clean encapsulation. Underlying API types are strictly derived (or validated) from the OpenAPI specification to enforce correctness and prevent drift.

## Decision: Hybrid Architecture
We will adopt the **Hybrid architecture**.

### Implementation Rules:
- The main entry point (`DevupAI`) and its nested resources (`chat`, `embeddings`, `images`, `speech`, `video`, `inference`, `models`, `balance`) will be handwritten.
- Network requests will continue to use a generic, robust `safeFetch` abstraction.
- Public typescript interfaces for request parameters and return structures will map exactly to the schema requirements of the OpenAPI contract.
- We will NOT expose raw generated REST classes to the consumer.
- We will use exact contract typing to ensure endpoints like Speech and Video correctly reflect V3 structures, explicitly diverging from V2 where the OpenAPI contract dictates.
