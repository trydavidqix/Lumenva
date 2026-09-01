# Models and Providers

## Principle

Agents request capabilities/quality constraints; they should not hard-code a provider unless a domain requirement explicitly demands one. The Model Router selects only models/providers certified for the required capability set.

## Initial capability vocabulary

```text
tool_calling
structured_output
vision
reasoning
parallel_tools
long_context
streaming
```

Additional capabilities may be added only with clear semantics and tests.

## Certification states

```text
EXPERIMENTAL
CERTIFIED
DISABLED
```

A production run cannot use an EXPERIMENTAL/DISABLED model for a capability that requires certification unless a separate explicit experiment policy allows it in SHADOW.

## Routing order

Conceptually:

```text
required capabilities
 -> tenant/provider availability
 -> certification
 -> policy/privacy constraints
 -> quality tier
 -> latency/cost ranking
```

Cost alone never overrides capability or policy requirements.

## Fallback

Fallback is explicit and observable. Provider failure, fallback start, fallback success/failure and resumed attempt identity are persisted. Silent provider switching is prohibited.

## Provider portability

Provider-specific request/response types stay behind adapters. Public Agent Kernel contracts use Deskcomm-owned types.
