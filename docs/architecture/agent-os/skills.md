# Skills

## Definition

A Skill is versioned procedural knowledge that teaches an agent how to perform a class of task. Skills are not executable permissions and cannot bypass Tool/Policy controls.

## Canonical lifecycle

```text
DRAFT
EVALUATING
APPROVED
SHADOW
CANARY
ACTIVE
DEPRECATED
```

No direct `DRAFT -> ACTIVE` promotion is allowed.

## Canonical fields

```text
name
version
description
domain
owner
risk
goal
when_to_use
when_not_to_use
required_context
procedure
allowed_tools
forbidden_actions
output_schema
verification
failure_handling
escalation
examples
counterexamples
evals
```

## Progressive disclosure

Skills are loaded in stages:

1. compact name + description;
2. full skill instructions only after selection;
3. specific references/resources only when required.

The runtime enforces `maxSkillLoads` and `maxSkillContextTokens` to prevent a skill catalog from recreating a mega-prompt.

## Promotion

A skill version is immutable once evaluated. Promotion changes pointers/activation state, not historical content. Rollback moves the active pointer to a previously verified version.

Agents may propose skill candidates but cannot self-promote them into production.

## Relationship to repo engineering skills

`.claude/skills` and `.agents/skills` govern coding-assistant behavior in the repository. Product/runtime skills for CRM agents are a separate domain, though both follow the same principles of focused scope, progressive disclosure, references and verification.
