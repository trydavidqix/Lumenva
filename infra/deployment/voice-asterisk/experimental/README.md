# Experimental Twilio outbound templates

These examples preserve the useful outbound configuration from frozen branch `voz` (`c40cc4eca955384d504bcc710eec9cae7f77f76a`), files introduced by commits `b929b5b6` and `19b7f74d`.

They are **templates only**. The `.disabled.conf.example` names are intentional; do not copy them into an active Asterisk configuration or originate calls based on them. Production use requires separate review of the Twilio trunk/DID, destination allowlist, network/security configuration, tenant authorization, and live-call gates. Credentials must come from the approved secret store and must never be committed here.

The current implementation has not been validated for live Twilio outbound calling. See the archived `voz` plan and runbook for historical design context; they are not current deployment instructions or architecture authority.
