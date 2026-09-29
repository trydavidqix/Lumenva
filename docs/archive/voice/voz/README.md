# Archived voice/Twilio planning from `voz`

The adjacent plan and runbook are preserved from frozen source branch `voz` at `c40cc4eca955384d504bcc710eec9cae7f77f76a` (planning commits `5473f97e` and `245f937b`). They record useful requirements, architecture decisions, and rollout gates that would otherwise disappear when source branches are eventually cleaned up.

**Status:** historical and experimental, not an approved implementation plan. The docs describe an initial planned state and several future Twilio/Asterisk tasks that have not been proven complete. Do not use them alone to configure services, deploy, originate calls, or contact a real phone. Validate against the current Voice Core and obtain a separate operational approval first.

The two outbound Asterisk templates are preserved separately under `infra/deployment/voice-asterisk/experimental/` and remain disabled examples. Existing equivalent voice configurations remain in the canonical deployment directory; older inbound variants were not copied over them.
