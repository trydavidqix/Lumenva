# WAHA webhook signature

## Protection modes

WAHA Core does not sign webhook requests. With
`WAHA_WEBHOOK_REQUIRE_SIGNATURE=false`, the webhook URL's secret token is the
only request authentication. Keep that URL private, deliver it only to the WAHA
instance, and rotate it immediately if exposed. Unsigned accepted requests emit
a throttled structured warning; their event log records `valid_signature=false`.

WAHA Plus must use `WAHA_WEBHOOK_REQUIRE_SIGNATURE=true` and a strong
`WAHA_HMAC_SECRET` shared with the WAHA webhook signer. The app verifies the
HMAC-SHA512 signature against the raw request body before accepting the event.
New installations should start with signature enforcement enabled. Set it to
`false` deliberately only when operating WAHA Core, which cannot provide the
signature.

## Migration

1. Confirm which WAHA edition sends events. Core requires unsigned mode; Plus
   can use signed mode.
2. For Plus, configure a fresh random `WAHA_HMAC_SECRET` in both the app and
   WAHA, enable `WAHA_WEBHOOK_REQUIRE_SIGNATURE=true`, and deploy.
3. Send a test webhook and confirm it is accepted with a valid signature. A
   missing signature must return `signature_required`.
4. For Core, set `WAHA_WEBHOOK_REQUIRE_SIGNATURE=false` explicitly. Keep the
   per-session webhook URL token secret and rotate it after any exposure.
5. Review structured unsigned-webhook warnings before and after migration; the
   warning contains only the organization and session identifiers, never the
   token, signature, or body.
