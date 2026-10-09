# Data & Capabilities Authority

| Domain | Authority & Source of Truth |
|---|---|
| **Contact** | CRM (`apps/crm`) - Primary profile, tracking, and lifetime ownership. |
| **Conversation** | CRM (`apps/crm`) - Interaction log and agent handling. |
| **External Social Identity** | Social Brain (`packages/core/social-brain`) - Maps to CRM contact via ID without full data duplication. |
| **Social Account** | Social Brain (`packages/core/social-brain`) - Connection setup and OAuth token storage. |
| **Content** | Social Brain (`packages/core/social-brain`) - Calendar, drafts, and publisher configuration. |
| **Asset** | CRM Storage/Social Brain - Central asset storage with provable hashes. |
| **Product** | Store Adapter / Dropshipping Domain (`packages/core/dropshipping` / `apps/crm`) - Read-only catalog cache. |
| **Store** | Dropshipping Domain / Provider - External source of truth mapped internally as read-only. |
| **Order** | Dropshipping Domain (`packages/core/dropshipping`) - Centralized state machine for order approval/fulfillment. |
| **Supplier** | Dropshipping Domain / Sourcing Services - Provider definitions and sourcing API states. |
| **Price / Cost** | Dropshipping Unit Economics Engine - Calculates margins natively without defaulting external unknowns. |
| **Job** | Lumenva Execution Engine (`packages/core/operating-core` / CRM workers). |
| **Audit** | CRM Audit log (`lib/audit`) - Records actions like `authz.denied` and manual snapshot approvals. |
