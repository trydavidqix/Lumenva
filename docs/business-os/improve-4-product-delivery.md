# IMPROVE — PLANE 4: PRODUCT DELIVERY

**Scope:** Blueprint sections 4.63–4.81, 8.6–8.7, Waves 6–10 (section 17), Studio roadmap V0–V8 (section 18).
**Status:** This document does NOT question the blueprint. It only makes it buildable. Every gap below is closed with a decision.
**Current real state:** monorepo `apps/crm` + `apps/site` (Next.js + Supabase/Postgres/Auth/Storage + `event_log` + workers). `organization_id` is the canonical tenant. RLS already enforced on core tables. This plan **adds `apps/client-portal`** and the `packages/studio-*`, `packages/asset-engine`, `packages/project-generator` packages already named in blueprint section 16. An "M3E" prompt-oriented visual editor exists in the ecosystem — we extract a canvas engine from it (section ML-CANVAS below).

---

## 0. MODULE MAP + EFFORT + WAVE + DEPENDENCIES

Effort unit = **engineer-day (ed)** for one mid-senior full-stack engineer. Ranges assume the WAVE 1–5 Operating Core / Agent Runtime / Command Center already exist (they are prerequisites, not counted here).

| # | Module | Wave | Studio V | Effort (ed) | Hard deps |
|---|--------|------|----------|-------------|-----------|
| M1 | `studio-spec` package: ProjectSpec type + JSON Schema + validators + Stable ID registry | 6 | V0 | 8 | none |
| M2 | Studio Domain SQL (studio_projects … studio_deployments) + RLS + repository layer | 6 | V0 | 6 | M1 |
| M3 | ProjectSpec patch engine (RFC-6902 ops + schema-validate + policy + diff + version pipeline) | 6 | V0 | 7 | M1, M2 |
| M4 | Briefing intake + Briefing→BaseProjectSpec compiler | 6 | V1 | 6 | M1, CRM Contact 360 |
| M5 | Template Registry + Component Registry + Template Matcher | 6 | V1 | 9 | M1, `design-system` |
| M6 | Preview Renderer (`studio-renderer`): ProjectSpec → static preview site (SSR) | 6 | V1 | 12 | M1, M5 |
| M7 | A/B/C Proposal Engine (Design Strategy Generator + 3-variant materialization) | 6 | V2 | 11 | M4, M5, M6 |
| M8 | `apps/client-portal` app shell + opaque-token auth + routes | 6 | V3 | 9 | M2, M6 |
| M9 | Client Portal state machine (approve/comment/request-changes/edit/create-own/mix) | 6 | V3 | 10 | M3, M7, M8 |
| M10 | Contact 360 ↔ Studio integration (lead→briefing→project, approval events back to CRM) | 6 | V3 | 4 | M2, M4, M9 |
| M11 | M3E extraction → `studio-canvas` UI Canvas engine (render + select + inspector) | 7 | V4 | 18 | M1, M6 |
| M12 | UI Canvas editing → ProjectSpec patches + undo/redo + responsive editing | 7 | V4 | 10 | M3, M11 |
| M13 | AI Visual Editing (NL instruction → validated patch) | 7 | V5 | 7 | M3, M12, model-router |
| M14 | Create My Own + Variant Mixing (component-level variant merge) | 7 | V5 | 6 | M7, M12 |
| M15 | Asset Canvas engine (`studio-canvas` raster/vector mode) | 8 | V6 | 14 | M11 |
| M16 | Magic Layers Pipeline + LayerManifest (decompose/OCR/vectorize/occlusion) | 8 | V6 | 16 | M15, asset-worker |
| M17 | Reverse Design Engine (screenshot → ProjectSpec, inference-marked) | 8 | V6 | 13 | M1, M16 |
| M18 | Asset Factory ops (bg removal, recolor, brand apply, crop/resize, export) | 8 | V6 | 8 | M15, M16 |
| M19 | `project-generator`: BuildPlan schema + Product Architect Agent + Requirement Resolver | 9 | V7 | 10 | M1 (approved spec), agent-runtime |
| M20 | Deterministic Generators (DB, auth, API scaffold, project skeleton, testing scaffold) | 9 | V7 | 20 | M19 |
| M21 | Coding Agent Task runner + Repair Loop + gate chain (install…visual QA) | 9 | V7 | 14 | M19, M20, BrowserMesh |
| M22 | Git Project Factory + Customer Project Isolation (repo/env/domain/db/secrets provisioning) | 9 | V7 | 12 | M21, integrations (github, deploy provider) |
| M23 | Customer Delivery Domain SQL (customer_projects … project_health_checks) + RLS | 9 | V7 | 5 | M2 pattern |
| M24 | Mobile Generator (Expo / React Native) added to Product Factory | 10 | V8 | 16 | M20, M21 |
| M25 | Production deploy + domains + monitoring + release management + maintenance loop | 10 | V8 | 14 | M22, M23 |

**Total Product Delivery plane: ~326 ed** (~65 engineer-weeks; with 2–3 builders in parallel per blueprint section 6.3, ~22–33 calendar weeks).

**Critical path:** M1 → M2 → M3 → M6 → M7 → M9 (Studio Alpha) → M11 → M12 (Studio Beta editor) → M15 → M16 → M17 (Asset/Reverse) → M19 → M20 → M21 → M22 (Product Factory Gamma) → M24 → M25.

---

## 1. ProjectSpec — FULL TYPE (blueprint 4.65)

### 1.1 Design decisions (gaps closed)

- **Decision:** ProjectSpec is a single JSON document, stored as `jsonb` in `studio_versions.spec`, never split across tables. Tables hold *pointers and metadata*; the spec is the source of truth (ADR-019).
- **Decision:** Every addressable node carries a `stable_id` (grammar in §2). Arrays of nodes are addressed by `stable_id`, never by array index, so patches survive reordering.
- **Decision:** The spec is versioned with an integer `spec_version` (monotonic per project) plus `schema_version` (the ProjectSpec schema semver, currently `1.0.0`).
- **Decision:** Any value that was inferred (Reverse Design Engine, AI) rather than stated by the customer carries an inline `_meta` object with `confidence` and `status: "inferred" | "validated" | "stated"`. The JSON Schema *requires* `status` on inference-eligible nodes (§8).
- **Decision:** Copy/text lives in a single `content` dictionary keyed by stable id, so A/B/C variants can share it by reference (blueprint 4.68 "shared copy").
- **Decision:** Brand tokens are W3C Design Tokens Community Group format (`$value` / `$type`) so they export cleanly to CSS vars, Tailwind config, and Style Dictionary.

### 1.2 TypeScript type (`packages/studio-spec/src/types.ts`)

```typescript
// ===== primitives =====
export type StableId = string; // see §2 grammar; validated by isStableId()
export type SchemaVersion = `${number}.${number}.${number}`;
export type ISODate = string;
export type Url = string;

export type InferenceStatus = "stated" | "inferred" | "validated";
export interface NodeMeta {
  status: InferenceStatus;
  confidence?: number;            // 0..1, required when status === "inferred"
  source?: "customer" | "briefing" | "reverse_design" | "ai_edit" | "template" | "agent";
  note?: string;
  last_touched_by?: string;       // user id or agent id
  last_touched_at?: ISODate;
}
export interface Inferable { _meta?: NodeMeta; }

// ===== root =====
export interface ProjectSpec extends Inferable {
  schema_version: SchemaVersion;         // "1.0.0"
  spec_version: number;                   // monotonic per project
  project: ProjectInfo;
  customer: CustomerInfo;
  business: BusinessInfo;
  goals: Goal[];
  brand: Brand;
  platforms: Platforms;
  content: Record<StableId, LocalizedText>; // shared copy pool
  ui: Ui;
  assets: AssetRef[];
  data: DataModelGraph;
  auth: AuthSpec;
  roles: Role[];
  permissions: Permission[];
  actions: ActionSpec[];
  workflows: WorkflowSpec[];
  apis: ApiSpec[];
  integrations: IntegrationSpec[];
  seo: SeoSpec;
  analytics: AnalyticsSpec;
  infrastructure: InfrastructureSpec;
  deployment: DeploymentSpec;
  x_variant?: VariantMeta;               // present only on A/B/C variant specs
}

// ===== project / customer / business / goals =====
export interface ProjectInfo extends Inferable {
  stable_id: StableId;                   // "project.root"
  name: string;
  slug: string;
  product_type: ProductType;             // blueprint 4.78
  description: string;
  primary_locale: string;                // "pt-PT"
  locales: string[];
  timezone: string;                      // "Europe/Lisbon"
  status: "briefing" | "proposing" | "in_review" | "approved" | "building" | "delivered";
}
export type ProductType =
  | "landing_page" | "marketing_website" | "business_website" | "web_application"
  | "saas" | "dashboard" | "internal_tool" | "customer_portal"
  | "mobile_application" | "website_plus_app";

export interface CustomerInfo extends Inferable {
  stable_id: StableId;                   // "customer.root"
  crm_contact_id: string | null;         // FK into CRM contacts
  organization_id: string;               // tenant of the STUDIO owner (Lumenva org)
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  industry: string;
  locale_preference: string;
}
export interface BusinessInfo extends Inferable {
  stable_id: StableId;                   // "business.root"
  legal_name?: string;
  tagline?: string;
  value_proposition: string;
  services: BusinessService[];
  service_area: string[];                // ["Lisboa", "Cascais"]
  hours: OpeningHours[];
  locations: BusinessLocation[];
  social_profiles: { network: string; url: Url }[];
  differentiators: string[];
  compliance: string[];                  // ["RGPD", "healthcare-PT"]
}
export interface BusinessService extends Inferable {
  stable_id: StableId; name: string; description: string;
  price_from?: number; currency?: string; duration_minutes?: number; bookable: boolean;
}
export interface BusinessLocation extends Inferable {
  stable_id: StableId; label: string; address: string; city: string; postal_code: string;
  country: string; lat?: number; lng?: number; phone?: string;
}
export interface OpeningHours { day: 0|1|2|3|4|5|6; opens: string; closes: string; closed?: boolean; }
export interface Goal extends Inferable {
  stable_id: StableId;                   // "goal.<slug>"
  kind: "primary" | "secondary";
  statement: string;                     // "Get visitors to book an appointment"
  metric: string;                        // "appointment_bookings"
  target?: string;                       // "+30% in 90 days"
  maps_to_action?: StableId;             // action.appointment.create
}

// ===== brand (W3C design tokens) =====
export interface Brand extends Inferable {
  stable_id: StableId;                   // "brand.root"
  logo: BrandLogo;
  colors: TokenGroup;                    // { primary: {$type:"color",$value:"#0EA5A0"}, ... }
  typography: Typography;
  spacing: TokenGroup;                   // scale tokens
  radius: TokenGroup;
  shadow: TokenGroup;
  motion: MotionTokens;
  voice_tone?: string;                   // "warm, reassuring, professional"
}
export interface BrandLogo {
  primary_asset_id: StableId | null; mark_asset_id?: StableId | null;
  wordmark_asset_id?: StableId | null; min_width_px?: number; clearspace_ratio?: number;
  on_dark_asset_id?: StableId | null;
}
export interface DesignToken { $type: "color"|"dimension"|"fontFamily"|"fontWeight"|"duration"|"cubicBezier"|"number"|"shadow"; $value: unknown; $description?: string; }
export type TokenGroup = Record<string, DesignToken | TokenGroup>;
export interface Typography extends Inferable {
  families: { heading: string; body: string; mono?: string };
  imports: { family: string; source: "google_fonts"|"self_host"|"system"; url?: Url; weights: number[] }[];
  scale: { step: string; size: string; line_height: string; weight: number; letter_spacing?: string }[];
  base_size_px: number;
}
export interface MotionTokens extends Inferable {
  durations: TokenGroup; easings: TokenGroup;
  presets: { stable_id: StableId; name: string; description: string; reduced_motion_fallback: "none"|"fade" }[];
  respect_prefers_reduced_motion: boolean;
}

// ===== platforms =====
export interface Platforms {
  website?: { enabled: true; render_mode: "ssg"|"ssr"|"isr"; framework: "next" };
  web_app?: { enabled: true; render_mode: "ssr"|"spa"; framework: "next"; needs_offline?: boolean };
  mobile?: { enabled: true; framework: "expo"; platforms: ("ios"|"android")[]; distribution: "store"|"internal" };
}

// ===== ui =====
export interface Ui {
  pages: Page[];                         // routed, public/site
  screens: Screen[];                     // authed app screens
  components: ComponentInstance[];       // reusable instances referenced by pages/screens
  layouts: Layout[];
  responsive_constraints: ResponsiveConstraints;
  navigation: NavModel[];
}
export interface Page extends Inferable {
  stable_id: StableId;                   // "page.home"
  path: string;                          // "/"
  title_content_id: StableId;            // key into spec.content
  layout_id: StableId;                   // layout.marketing
  sections: SectionRef[];                // ordered
  seo_override?: Partial<SeoSpec>;
  auth_required: boolean;
}
export interface Screen extends Inferable {
  stable_id: StableId;                   // "screen.customers"
  path: string;                          // "/app/customers"
  title_content_id: StableId;
  layout_id: StableId;
  sections: SectionRef[];
  requires_permissions: StableId[];      // permission.customer.read
  data_source?: StableId;                // model.customer (list view binding)
}
export interface SectionRef { stable_id: StableId; component_id: StableId; order: number; visible_when?: string; }
export interface ComponentInstance extends Inferable {
  stable_id: StableId;                   // "component.hero.main"
  component_type: string;                // "hero" | "feature_grid" | "booking_form" | "pricing_table" | ...
  variant: string;                       // "premium" | "minimal" | "split" — from Component Registry
  props: Record<string, unknown>;        // typed against Component Registry schema
  content_bindings: Record<string, StableId>; // prop -> spec.content key
  action_bindings?: Record<string, StableId>; // prop -> action.*
  data_bindings?: Record<string, StableId>;   // prop -> model.* / api.*
  style_overrides?: TokenGroup;
  visual_style?: string;                 // coarse handle used by AI edits ("premium")
  children?: StableId[];                 // nested component instances
  responsive?: Partial<Record<Breakpoint, Partial<ComponentInstance>>>;
}
export interface Layout extends Inferable {
  stable_id: StableId;                   // "layout.marketing"
  kind: "marketing"|"app_shell"|"auth"|"bare";
  regions: { name: "header"|"sidebar"|"footer"|"main"|"aside"; component_id?: StableId }[];
  max_width?: string; grid?: { columns: number; gutter: string };
}
export type Breakpoint = "base"|"sm"|"md"|"lg"|"xl"|"2xl";
export interface ResponsiveConstraints {
  breakpoints: Record<Breakpoint, number>;       // px
  container_max: Record<Breakpoint, string>;
  fluid_typography: boolean;
  min_tap_target_px: number;                      // a11y: 44
  never_horizontal_scroll: boolean;              // true
}
export interface NavModel extends Inferable {
  stable_id: StableId; placement: "primary"|"footer"|"app_sidebar"|"mobile_drawer";
  items: { label_content_id: StableId; target: StableId | Url; children?: NavModel["items"] }[];
}

// ===== assets / data / auth / rbac =====
export interface AssetRef extends Inferable {
  stable_id: StableId;                   // "asset.hero.primary"
  studio_asset_id: string;               // FK studio_assets.id
  role: "logo"|"hero"|"gallery"|"icon"|"illustration"|"og_image"|"favicon"|"background";
  alt_content_id?: StableId;
  focal_point?: { x: number; y: number };
  variants?: { w: number; format: "webp"|"avif"|"png"|"jpg"; url: Url }[];
}
export interface DataModelGraph {
  models: DataModel[];
  relationships: Relationship[];
  seed_strategy?: "none"|"demo"|"import";
}
export interface DataModel extends Inferable {
  stable_id: StableId;                   // "model.customer"
  name: string; table_name: string;
  fields: DataField[];
  soft_delete: boolean; timestamps: boolean; tenant_scoped: boolean; // -> organization_id column + RLS
  rls: "tenant"|"owner"|"public_read"|"custom";
  indexes?: { fields: string[]; unique?: boolean }[];
}
export interface DataField {
  stable_id: StableId;                   // "field.customer.email"
  name: string; column: string;
  type: "text"|"varchar"|"int"|"bigint"|"numeric"|"boolean"|"date"|"timestamptz"|"jsonb"|"uuid"|"enum"|"citext";
  enum_values?: string[];
  required: boolean; unique?: boolean; default?: unknown;
  pii?: boolean; encrypted?: boolean;
  validation?: { min?: number; max?: number; pattern?: string; format?: "email"|"phone"|"url" };
}
export interface Relationship {
  stable_id: StableId;                   // "rel.appointment.customer"
  from: StableId; to: StableId;          // model ids
  kind: "one_to_many"|"many_to_one"|"one_to_one"|"many_to_many";
  fk_field?: StableId; join_table?: string; on_delete: "cascade"|"restrict"|"set_null";
}
export interface AuthSpec extends Inferable {
  stable_id: StableId;                   // "auth.root"
  required: boolean;
  providers: ("email_password"|"magic_link"|"google_oauth"|"apple_oauth"|"otp_sms")[];
  registration: "open"|"invite_only"|"admin_creates"|"none";
  session: { strategy: "cookie"|"jwt"; ttl_minutes: number; refresh: boolean };
  mfa?: "off"|"optional"|"required";
  password_policy?: { min_length: number; require_symbols: boolean };
  supabase_auth: boolean;               // true = reuse Supabase Auth
}
export interface Role extends Inferable {
  stable_id: StableId;                   // "role.admin"
  name: string; description: string; is_default_signup_role?: boolean;
}
export interface Permission extends Inferable {
  stable_id: StableId;                   // "permission.customer.read"
  resource: StableId;                    // model.customer OR action.*
  operation: "create"|"read"|"update"|"delete"|"list"|"execute";
  scope: "own"|"tenant"|"any";
  granted_to: StableId[];                // role ids
}

// ===== actions / workflows / apis / integrations =====
export interface ActionSpec extends Inferable {
  stable_id: StableId;                   // "action.appointment.create"
  name: string; kind: "mutation"|"query"|"command";
  input_schema: JsonSchema; output_schema: JsonSchema;
  writes: StableId[];                    // model ids touched
  reads: StableId[];
  side_effects: ("email"|"sms"|"payment"|"calendar"|"webhook"|"file")[];
  idempotent: boolean; requires_permission: StableId;
  triggers_workflow?: StableId;
  rate_limit?: { window_s: number; max: number };
}
export interface WorkflowSpec extends Inferable {
  stable_id: StableId;                   // "workflow.booking"
  name: string; trigger: { type: "action"|"schedule"|"webhook"|"event"; ref: string };
  steps: WorkflowStep[];
  on_error: "abort"|"compensate"|"continue";
}
export interface WorkflowStep {
  stable_id: StableId; name: string;
  type: "call_action"|"send_email"|"send_sms"|"http"|"delay"|"branch"|"create_record"|"update_record"|"payment";
  config: Record<string, unknown>; depends_on?: StableId[];
}
export interface ApiSpec extends Inferable {
  stable_id: StableId;                   // "api.appointments"
  base_path: string;                     // "/api/appointments"
  auth: "public"|"session"|"api_key"|"service";
  endpoints: {
    stable_id: StableId; method: "GET"|"POST"|"PATCH"|"PUT"|"DELETE"; path: string;
    handler_action: StableId; request_schema?: JsonSchema; response_schema?: JsonSchema;
    pagination?: "cursor"|"page"|"none";
  }[];
}
export interface IntegrationSpec extends Inferable {
  stable_id: StableId;                   // "integration.calendar.google"
  provider: string;                      // "google_calendar" | "stripe" | "resend" | "twilio" | "waha"
  purpose: string;
  scopes: string[];
  secrets_required: string[];            // names only, never values (blueprint 12.6)
  config: Record<string, unknown>;
  mode: "oauth"|"api_key"|"webhook";
}

// ===== seo / analytics / infra / deploy =====
export interface SeoSpec extends Inferable {
  stable_id: StableId;                   // "seo.root"
  title_template: string;                // "%s | Clínica X"
  default_description_content_id: StableId;
  canonical_host: string;
  robots: "index,follow"|"noindex,nofollow";
  sitemap: boolean; open_graph: boolean; twitter_card: boolean;
  json_ld: { type: string; data: Record<string, unknown> }[]; // LocalBusiness, Dentist, FAQPage...
  hreflang?: { locale: string; href: Url }[];
}
export interface AnalyticsSpec extends Inferable {
  stable_id: StableId;                   // "analytics.root"
  providers: ("plausible"|"ga4"|"posthog"|"none")[];
  consent_mode: "opt_in"|"opt_out"|"none";  // RGPD default: opt_in
  events: { stable_id: StableId; name: string; when: string; maps_to_goal?: StableId }[];
}
export interface InfrastructureSpec extends Inferable {
  stable_id: StableId;                   // "infra.root"
  profile: "product_factory_default";   // frozen profile, see §7.7
  database: "neon_postgres"|"supabase";
  hosting: "cloudflare"|"vercel";
  storage: "r2"|"supabase_storage";
  region: string;                        // "eu"
  needs: { realtime: boolean; background_jobs: boolean; file_uploads: boolean; email: boolean; payments: boolean };
}
export interface DeploymentSpec extends Inferable {
  stable_id: StableId;                   // "deploy.root"
  environments: ("preview"|"staging"|"production")[];
  domains: { env: "preview"|"staging"|"production"; host: string; managed_by: "lumenva"|"customer" }[];
  auto_deploy_branch: string;            // "main"
  requires_client_approval_for_prod: true;
  rollback_strategy: "app_rollback"|"forward_fix";
}

// ===== variant metadata =====
export interface VariantMeta {
  variant_key: "A"|"B"|"C"|"D"; parent_project_id: string;
  strategy: DesignStrategy;              // §3
  shares_content_with: ("A"|"B"|"C")[];  // ["A","B","C"] — all share copy
  mixed_from?: { region: string; source_variant: "A"|"B"|"C" }[]; // present on D
}

export interface LocalizedText { [locale: string]: string; }
export type JsonSchema = Record<string, unknown>;
```

### 1.3 JSON Schema

Generate the JSON Schema from the TypeScript types with `ts-json-schema-generator` at build time; commit the output at `packages/studio-spec/schema/project-spec.schema.json`. Runtime validation uses **Ajv 8** (`allErrors: true`, `strict: true`, custom keyword `stableId`, custom keyword `requireConfidenceWhenInferred`). Decision: the schema is the contract; the TS type is derived — CI fails if they drift (`ts-json-schema-generator` + `git diff --exit-code`).

Custom Ajv keyword `requireConfidenceWhenInferred`:

```typescript
ajv.addKeyword({
  keyword: "requireConfidenceWhenInferred",
  validate(_schema: true, data: { _meta?: NodeMeta }) {
    if (!data?._meta) return true;
    if (data._meta.status === "inferred") {
      return typeof data._meta.confidence === "number"
        && data._meta.confidence >= 0 && data._meta.confidence <= 1;
    }
    return true;
  },
  errors: false,
});
```

Every `Inferable` object type in the schema gets `"requireConfidenceWhenInferred": true`. This enforces blueprint 4.77 ("inference stays marked until validated") **structurally**.

### 1.4 Populated example — dentist booking website

`packages/studio-spec/examples/dentist-booking.projectspec.json` (abridged to the load-bearing parts; full file in repo):

```jsonc
{
  "schema_version": "1.0.0",
  "spec_version": 4,
  "project": {
    "stable_id": "project.root", "name": "Clínica Dentária Sorriso", "slug": "clinica-sorriso",
    "product_type": "business_website", "primary_locale": "pt-PT", "locales": ["pt-PT"],
    "timezone": "Europe/Lisbon", "status": "in_review",
    "description": "Website institucional com marcação de consultas online para clínica dentária em Cascais.",
    "_meta": { "status": "stated", "source": "briefing" }
  },
  "customer": {
    "stable_id": "customer.root", "crm_contact_id": "ct_01H...", "organization_id": "org_lumenva",
    "company_name": "Clínica Dentária Sorriso Lda", "contact_name": "Dra. Marta Nunes",
    "contact_email": "marta@clinicasorriso.pt", "industry": "healthcare_dental", "locale_preference": "pt-PT"
  },
  "business": {
    "stable_id": "business.root", "legal_name": "Clínica Dentária Sorriso Lda",
    "tagline": "O seu sorriso em boas mãos",
    "value_proposition": "Consultas de dentária geral, ortodontia e implantologia com marcação online 24/7.",
    "services": [
      { "stable_id": "business.service.checkup", "name": "Consulta de avaliação", "description": "Exame completo + plano de tratamento", "price_from": 40, "currency": "EUR", "duration_minutes": 30, "bookable": true },
      { "stable_id": "business.service.hygiene", "name": "Destartarização", "description": "Limpeza profissional", "price_from": 55, "currency": "EUR", "duration_minutes": 45, "bookable": true },
      { "stable_id": "business.service.ortho", "name": "Consulta de ortodontia", "description": "Avaliação para aparelho fixo ou alinhadores", "price_from": 60, "currency": "EUR", "duration_minutes": 40, "bookable": true }
    ],
    "service_area": ["Cascais", "Estoril", "Oeiras"],
    "hours": [
      { "day": 1, "opens": "09:00", "closes": "19:00" }, { "day": 2, "opens": "09:00", "closes": "19:00" },
      { "day": 3, "opens": "09:00", "closes": "19:00" }, { "day": 4, "opens": "09:00", "closes": "19:00" },
      { "day": 5, "opens": "09:00", "closes": "18:00" }, { "day": 6, "opens": "09:00", "closes": "13:00" },
      { "day": 0, "opens": "00:00", "closes": "00:00", "closed": true }
    ],
    "locations": [
      { "stable_id": "business.loc.cascais", "label": "Cascais", "address": "Av. Marginal 123", "city": "Cascais",
        "postal_code": "2750-374", "country": "PT", "lat": 38.6979, "lng": -9.4215, "phone": "+351214000000" }
    ],
    "social_profiles": [{ "network": "instagram", "url": "https://instagram.com/clinicasorriso" }],
    "differentiators": ["Marcação online 24/7", "Estacionamento próprio", "Primeira consulta em 48h"],
    "compliance": ["RGPD", "Ordem dos Médicos Dentistas"]
  },
  "goals": [
    { "stable_id": "goal.bookings", "kind": "primary", "statement": "Converter visitantes em marcações online",
      "metric": "appointment_bookings", "target": "+40% em 90 dias", "maps_to_action": "action.appointment.create" },
    { "stable_id": "goal.calls", "kind": "secondary", "statement": "Aumentar chamadas telefónicas", "metric": "phone_clicks" }
  ],
  "brand": {
    "stable_id": "brand.root",
    "logo": { "primary_asset_id": "asset.logo.primary", "on_dark_asset_id": "asset.logo.white", "min_width_px": 120, "clearspace_ratio": 0.5 },
    "colors": {
      "primary":   { "$type": "color", "$value": "#0E7C86" },
      "primary_fg":{ "$type": "color", "$value": "#FFFFFF" },
      "accent":    { "$type": "color", "$value": "#F2B705" },
      "bg":        { "$type": "color", "$value": "#FFFFFF" },
      "surface":   { "$type": "color", "$value": "#F4F7F7" },
      "text":      { "$type": "color", "$value": "#12303A" },
      "muted":     { "$type": "color", "$value": "#5B7078" }
    },
    "typography": {
      "families": { "heading": "Fraunces", "body": "Inter" },
      "imports": [
        { "family": "Fraunces", "source": "google_fonts", "weights": [500, 600] },
        { "family": "Inter", "source": "google_fonts", "weights": [400, 500, 600] }
      ],
      "base_size_px": 16,
      "scale": [
        { "step": "display", "size": "3rem", "line_height": "1.05", "weight": 600 },
        { "step": "h1", "size": "2.25rem", "line_height": "1.1", "weight": 600 },
        { "step": "h2", "size": "1.5rem", "line_height": "1.2", "weight": 600 },
        { "step": "body", "size": "1rem", "line_height": "1.6", "weight": 400 },
        { "step": "small", "size": "0.875rem", "line_height": "1.5", "weight": 400 }
      ],
      "_meta": { "status": "inferred", "confidence": 0.55, "source": "template",
        "note": "Cliente não indicou tipografia; proposta do template Care-Modern." }
    },
    "spacing": { "xs": {"$type":"dimension","$value":"4px"}, "sm": {"$type":"dimension","$value":"8px"},
      "md": {"$type":"dimension","$value":"16px"}, "lg": {"$type":"dimension","$value":"32px"},
      "xl": {"$type":"dimension","$value":"64px"} },
    "radius": { "sm": {"$type":"dimension","$value":"6px"}, "md": {"$type":"dimension","$value":"12px"}, "pill": {"$type":"dimension","$value":"999px"} },
    "shadow": { "card": {"$type":"shadow","$value":"0 1px 3px rgba(18,48,58,.12)"} },
    "motion": {
      "durations": { "fast": {"$type":"duration","$value":"150ms"}, "base": {"$type":"duration","$value":"250ms"} },
      "easings": { "standard": {"$type":"cubicBezier","$value":[0.2,0,0,1]} },
      "presets": [{ "stable_id": "brand.motion.reveal", "name": "Section reveal", "description": "fade+rise 12px on scroll", "reduced_motion_fallback": "fade" }],
      "respect_prefers_reduced_motion": true
    },
    "voice_tone": "acolhedor, tranquilizador, profissional"
  },
  "platforms": { "website": { "enabled": true, "render_mode": "ssg", "framework": "next" } },
  "content": {
    "content.home.title": { "pt-PT": "Clínica Dentária Sorriso — Marcações online em Cascais" },
    "content.hero.heading": { "pt-PT": "O seu sorriso em boas mãos" },
    "content.hero.sub": { "pt-PT": "Marque a sua consulta de dentária online, 24 horas por dia. Primeira consulta em 48h." },
    "content.hero.cta": { "pt-PT": "Marcar consulta" },
    "content.services.heading": { "pt-PT": "Tratamentos" },
    "content.booking.heading": { "pt-PT": "Marque a sua consulta" },
    "content.seo.description": { "pt-PT": "Clínica dentária em Cascais com marcação online. Dentária geral, ortodontia e implantologia." }
  },
  "ui": {
    "layouts": [
      { "stable_id": "layout.marketing", "kind": "marketing", "max_width": "1200px",
        "regions": [ { "name": "header", "component_id": "component.nav.primary" },
                     { "name": "main" }, { "name": "footer", "component_id": "component.footer.main" } ] }
    ],
    "pages": [
      { "stable_id": "page.home", "path": "/", "title_content_id": "content.home.title",
        "layout_id": "layout.marketing", "auth_required": false,
        "sections": [
          { "stable_id": "sec.home.hero", "component_id": "component.hero.main", "order": 1 },
          { "stable_id": "sec.home.services", "component_id": "component.services.grid", "order": 2 },
          { "stable_id": "sec.home.booking", "component_id": "component.booking.form", "order": 3 },
          { "stable_id": "sec.home.map", "component_id": "component.location.map", "order": 4 }
        ] },
      { "stable_id": "page.services", "path": "/tratamentos", "title_content_id": "content.services.heading",
        "layout_id": "layout.marketing", "auth_required": false,
        "sections": [ { "stable_id": "sec.services.list", "component_id": "component.services.grid", "order": 1 } ] },
      { "stable_id": "page.booking", "path": "/marcar", "title_content_id": "content.booking.heading",
        "layout_id": "layout.marketing", "auth_required": false,
        "sections": [ { "stable_id": "sec.booking.form", "component_id": "component.booking.form", "order": 1 } ] }
    ],
    "screens": [],
    "components": [
      { "stable_id": "component.nav.primary", "component_type": "navbar", "variant": "solid",
        "props": { "sticky": true }, "content_bindings": {},
        "action_bindings": { "cta": "action.appointment.create" } },
      { "stable_id": "component.hero.main", "component_type": "hero", "variant": "split-image",
        "visual_style": "premium",
        "props": { "layout": "text-left", "media_asset_id": "asset.hero.primary" },
        "content_bindings": { "heading": "content.hero.heading", "subheading": "content.hero.sub", "cta_label": "content.hero.cta" },
        "action_bindings": { "cta": "action.appointment.create" },
        "responsive": { "base": { "props": { "layout": "stacked" } } } },
      { "stable_id": "component.services.grid", "component_type": "feature_grid", "variant": "cards-3col",
        "props": { "columns": 3 }, "content_bindings": { "heading": "content.services.heading" },
        "data_bindings": { "items": "model.service" } },
      { "stable_id": "component.booking.form", "component_type": "booking_form", "variant": "stepper",
        "props": { "steps": ["service", "slot", "details", "confirm"], "show_price": true },
        "content_bindings": { "heading": "content.booking.heading" },
        "action_bindings": { "submit": "action.appointment.create" },
        "data_bindings": { "services": "model.service", "availability": "api.availability" } },
      { "stable_id": "component.location.map", "component_type": "map", "variant": "embed",
        "props": { "lat": 38.6979, "lng": -9.4215, "zoom": 15 }, "content_bindings": {} },
      { "stable_id": "component.footer.main", "component_type": "footer", "variant": "columns",
        "props": {}, "content_bindings": {} }
    ],
    "navigation": [
      { "stable_id": "nav.primary", "placement": "primary",
        "items": [ { "label_content_id": "content.services.heading", "target": "page.services" },
                   { "label_content_id": "content.booking.heading", "target": "page.booking" } ] }
    ],
    "responsive_constraints": {
      "breakpoints": { "base": 0, "sm": 640, "md": 768, "lg": 1024, "xl": 1280, "2xl": 1536 },
      "container_max": { "base": "100%", "sm": "640px", "md": "768px", "lg": "1024px", "xl": "1200px", "2xl": "1200px" },
      "fluid_typography": true, "min_tap_target_px": 44, "never_horizontal_scroll": true
    }
  },
  "assets": [
    { "stable_id": "asset.logo.primary", "studio_asset_id": "sa_01H...", "role": "logo" },
    { "stable_id": "asset.logo.white", "studio_asset_id": "sa_02H...", "role": "logo" },
    { "stable_id": "asset.hero.primary", "studio_asset_id": "sa_03H...", "role": "hero",
      "alt_content_id": "content.hero.heading", "focal_point": { "x": 0.4, "y": 0.35 },
      "_meta": { "status": "inferred", "confidence": 0.4, "source": "template", "note": "Imagem stock provisória — substituir por foto real da clínica." } }
  ],
  "data": {
    "models": [
      { "stable_id": "model.service", "name": "Service", "table_name": "services", "tenant_scoped": true, "rls": "tenant",
        "soft_delete": true, "timestamps": true,
        "fields": [
          { "stable_id": "field.service.name", "name": "name", "column": "name", "type": "text", "required": true },
          { "stable_id": "field.service.slug", "name": "slug", "column": "slug", "type": "citext", "required": true, "unique": true },
          { "stable_id": "field.service.price_from", "name": "priceFrom", "column": "price_from", "type": "numeric", "required": false },
          { "stable_id": "field.service.duration", "name": "durationMinutes", "column": "duration_minutes", "type": "int", "required": true },
          { "stable_id": "field.service.bookable", "name": "bookable", "column": "bookable", "type": "boolean", "required": true, "default": true }
        ] },
      { "stable_id": "model.appointment", "name": "Appointment", "table_name": "appointments", "tenant_scoped": true, "rls": "tenant",
        "soft_delete": false, "timestamps": true,
        "fields": [
          { "stable_id": "field.appointment.patient_name", "name": "patientName", "column": "patient_name", "type": "text", "required": true, "pii": true },
          { "stable_id": "field.appointment.patient_email", "name": "patientEmail", "column": "patient_email", "type": "citext", "required": true, "pii": true, "validation": { "format": "email" } },
          { "stable_id": "field.appointment.patient_phone", "name": "patientPhone", "column": "patient_phone", "type": "varchar", "required": true, "pii": true, "validation": { "format": "phone" } },
          { "stable_id": "field.appointment.service_id", "name": "serviceId", "column": "service_id", "type": "uuid", "required": true },
          { "stable_id": "field.appointment.starts_at", "name": "startsAt", "column": "starts_at", "type": "timestamptz", "required": true },
          { "stable_id": "field.appointment.status", "name": "status", "column": "status", "type": "enum", "enum_values": ["pending","confirmed","cancelled","completed"], "required": true, "default": "pending" },
          { "stable_id": "field.appointment.consent_rgpd", "name": "consentRgpd", "column": "consent_rgpd", "type": "boolean", "required": true }
        ],
        "indexes": [ { "fields": ["starts_at"] }, { "fields": ["service_id","starts_at"], "unique": true } ] }
    ],
    "relationships": [
      { "stable_id": "rel.appointment.service", "from": "model.appointment", "to": "model.service",
        "kind": "many_to_one", "fk_field": "field.appointment.service_id", "on_delete": "restrict" }
    ],
    "seed_strategy": "demo"
  },
  "auth": {
    "stable_id": "auth.root", "required": false, "providers": ["email_password"], "registration": "admin_creates",
    "session": { "strategy": "cookie", "ttl_minutes": 480, "refresh": true }, "mfa": "optional",
    "supabase_auth": true,
    "_meta": { "status": "inferred", "confidence": 0.7, "note": "Staff-only admin para gerir marcações; público não autentica." }
  },
  "roles": [
    { "stable_id": "role.admin", "name": "Administrador", "description": "Acesso total à gestão da clínica" },
    { "stable_id": "role.reception", "name": "Receção", "description": "Gere marcações e pacientes", "is_default_signup_role": true }
  ],
  "permissions": [
    { "stable_id": "permission.appointment.read", "resource": "model.appointment", "operation": "list", "scope": "tenant", "granted_to": ["role.admin","role.reception"] },
    { "stable_id": "permission.appointment.update", "resource": "model.appointment", "operation": "update", "scope": "tenant", "granted_to": ["role.admin","role.reception"] },
    { "stable_id": "permission.service.manage", "resource": "model.service", "operation": "update", "scope": "tenant", "granted_to": ["role.admin"] }
  ],
  "actions": [
    { "stable_id": "action.appointment.create", "name": "Criar marcação", "kind": "mutation",
      "input_schema": { "type": "object", "required": ["serviceId","startsAt","patientName","patientEmail","patientPhone","consentRgpd"],
        "properties": { "serviceId": {"type":"string"}, "startsAt": {"type":"string","format":"date-time"},
          "patientName": {"type":"string"}, "patientEmail": {"type":"string","format":"email"},
          "patientPhone": {"type":"string"}, "consentRgpd": {"type":"boolean","const": true} } },
      "output_schema": { "type": "object", "properties": { "appointmentId": {"type":"string"}, "status": {"type":"string"} } },
      "writes": ["model.appointment"], "reads": ["model.service","api.availability"],
      "side_effects": ["email","calendar"], "idempotent": true, "requires_permission": "permission.appointment.read",
      "triggers_workflow": "workflow.booking", "rate_limit": { "window_s": 3600, "max": 10 } }
  ],
  "workflows": [
    { "stable_id": "workflow.booking", "name": "Confirmação de marcação",
      "trigger": { "type": "action", "ref": "action.appointment.create" }, "on_error": "compensate",
      "steps": [
        { "stable_id": "wf.booking.hold", "name": "Reservar slot no calendário", "type": "http",
          "config": { "integration": "integration.calendar.google", "op": "create_tentative_event" } },
        { "stable_id": "wf.booking.email_patient", "name": "Email ao paciente", "type": "send_email",
          "config": { "template": "appointment_pending", "to_field": "field.appointment.patient_email" }, "depends_on": ["wf.booking.hold"] },
        { "stable_id": "wf.booking.notify_clinic", "name": "Email à clínica", "type": "send_email",
          "config": { "template": "appointment_new_internal", "to": "marta@clinicasorriso.pt" }, "depends_on": ["wf.booking.hold"] }
      ] }
  ],
  "apis": [
    { "stable_id": "api.availability", "base_path": "/api/availability", "auth": "public",
      "endpoints": [ { "stable_id": "api.availability.get", "method": "GET", "path": "/", "handler_action": "action.appointment.create", "pagination": "none" } ] },
    { "stable_id": "api.appointments", "base_path": "/api/appointments", "auth": "session",
      "endpoints": [
        { "stable_id": "api.appointments.list", "method": "GET", "path": "/", "handler_action": "action.appointment.create", "pagination": "cursor" },
        { "stable_id": "api.appointments.create", "method": "POST", "path": "/", "handler_action": "action.appointment.create" }
      ] }
  ],
  "integrations": [
    { "stable_id": "integration.calendar.google", "provider": "google_calendar", "purpose": "Reservar slots de consulta",
      "scopes": ["https://www.googleapis.com/auth/calendar.events"], "secrets_required": ["GOOGLE_OAUTH_CLIENT_ID","GOOGLE_OAUTH_CLIENT_SECRET","GOOGLE_CALENDAR_ID"], "mode": "oauth", "config": { "calendar_id_env": "GOOGLE_CALENDAR_ID" } },
    { "stable_id": "integration.email.resend", "provider": "resend", "purpose": "Emails transacionais",
      "scopes": [], "secrets_required": ["RESEND_API_KEY"], "mode": "api_key", "config": { "from": "marcacoes@clinicasorriso.pt" } }
  ],
  "seo": {
    "stable_id": "seo.root", "title_template": "%s | Clínica Dentária Sorriso", "canonical_host": "www.clinicasorriso.pt",
    "default_description_content_id": "content.seo.description", "robots": "index,follow",
    "sitemap": true, "open_graph": true, "twitter_card": true,
    "json_ld": [ { "type": "Dentist", "data": { "name": "Clínica Dentária Sorriso", "areaServed": ["Cascais","Estoril","Oeiras"],
      "address": { "@type": "PostalAddress", "streetAddress": "Av. Marginal 123", "postalCode": "2750-374", "addressLocality": "Cascais", "addressCountry": "PT" },
      "openingHours": ["Mo-Th 09:00-19:00","Fr 09:00-18:00","Sa 09:00-13:00"] } } ]
  },
  "analytics": {
    "stable_id": "analytics.root", "providers": ["plausible"], "consent_mode": "opt_in",
    "events": [ { "stable_id": "an.booking_completed", "name": "booking_completed", "when": "action.appointment.create succeeds", "maps_to_goal": "goal.bookings" },
                { "stable_id": "an.phone_click", "name": "phone_click", "when": "tel: link clicked", "maps_to_goal": "goal.calls" } ]
  },
  "infrastructure": {
    "stable_id": "infra.root", "profile": "product_factory_default", "database": "neon_postgres", "hosting": "cloudflare",
    "storage": "r2", "region": "eu",
    "needs": { "realtime": false, "background_jobs": true, "file_uploads": false, "email": true, "payments": false }
  },
  "deployment": {
    "stable_id": "deploy.root", "environments": ["preview","production"],
    "domains": [ { "env": "preview", "host": "clinica-sorriso.preview.lumenva.app", "managed_by": "lumenva" },
                 { "env": "production", "host": "www.clinicasorriso.pt", "managed_by": "customer" } ],
    "auto_deploy_branch": "main", "requires_client_approval_for_prod": true, "rollback_strategy": "app_rollback"
  }
}
```

---

## 2. STABLE ID GRAMMAR + PATCH FORMAT (blueprint 4.66, 4.67)

### 2.1 Stable ID grammar

```
stable_id   := namespace "." segment ("." segment)*
namespace   := "project" | "customer" | "business" | "goal" | "brand" | "content"
             | "page" | "screen" | "component" | "layout" | "nav" | "sec"
             | "asset" | "model" | "field" | "rel" | "auth" | "role" | "permission"
             | "action" | "workflow" | "wf" | "api" | "integration" | "seo" | "analytics" | "an"
             | "infra" | "deploy"
segment     := [a-z0-9] [a-z0-9-]* [a-z0-9]      // lowercase kebab, no leading/trailing dash
             | [a-z0-9]                          // single char allowed
```

- **Allowed chars:** `a-z`, `0-9`, `-` inside a segment, `.` as separator only. No uppercase, no underscore, no unicode. Regex: `^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)+$` **and** first segment ∈ namespace set.
- **Max length:** 128 chars total; max 8 segments.
- **Uniqueness scope:** unique **within one ProjectSpec document**, across ALL namespaces (a flat index is built on load: `Map<stable_id, {json_pointer, node_type}>`). A/B/C variants of the same project reuse the same stable ids for shared nodes (that is how variant mixing and shared copy work).
- **Reserved roots:** `project.root`, `customer.root`, `business.root`, `brand.root`, `auth.root`, `seo.root`, `analytics.root`, `infra.root`, `deploy.root` — exactly one of each per spec.
- **Generation:** deterministic. `component.<type>.<disambiguator>` where disambiguator is the first free of: semantic slug from content, `main`/`secondary`/`alt`, then `-2`, `-3`. Never random. Generated by `mintStableId(namespace, hint, existingIndex)`.
- **Renames:** a stable id is never mutated in place. To rename, emit a `move`-style spec op (`{op:"rename_id", from, to}`, §2.2) that rewrites the id and every reference to it atomically; old id goes into `studio_projects.id_aliases` jsonb so external links (Client Portal comments) still resolve.

### 2.2 ProjectSpec patch format

Patches are **RFC-6902 JSON Patch** operations addressed by **JSON Pointer built from stable ids**, not array indices. The patch engine translates `stable_id` → JSON Pointer via the flat index before applying. Two custom ops extend RFC-6902: `rename_id` and `reorder` (stable-id array reorder).

```typescript
// packages/studio-spec/src/patch/types.ts
export type SpecOp =
  | { op: "add";     target: StableId | RootPointer; field?: string; value: unknown }
  | { op: "replace"; target: StableId; field?: string; value: unknown }
  | { op: "remove";  target: StableId; field?: string }
  | { op: "rename_id"; from: StableId; to: StableId }
  | { op: "reorder"; container: StableId; field: string; order: StableId[] }
  | { op: "mark_validated"; target: StableId }; // flips _meta.status inferred -> validated

export interface SpecPatch {
  patch_id: string;                 // uuid
  project_id: string;
  base_spec_version: number;        // optimistic concurrency
  origin: "ai_edit" | "canvas_edit" | "client_portal" | "reverse_design" | "template" | "system";
  actor: { type: "user" | "agent"; id: string };
  ops: SpecOp[];
  intent?: string;                  // NL description ("make hero more premium")
  created_at: ISODate;
}
```

### 2.3 The apply pipeline (as code)

```typescript
// packages/studio-spec/src/patch/apply.ts
import { applyPatch as rfc6902 } from "fast-json-patch";

export interface ApplyResult {
  ok: boolean;
  new_spec?: ProjectSpec;
  new_version?: number;
  diff?: SpecDiff;
  errors?: PatchError[];
  policy?: PolicyDecision;
}

export async function applySpecPatch(
  ctx: StudioCtx,                 // { db, organizationId, policyEngine, logger }
  current: ProjectSpec,
  patch: SpecPatch,
): Promise<ApplyResult> {
  // 1. OPTIMISTIC CONCURRENCY
  if (patch.base_spec_version !== current.spec_version) {
    return { ok: false, errors: [{ code: "stale_base", message: `base ${patch.base_spec_version} != current ${current.spec_version}` }] };
  }

  // 2. RESOLVE stable ids -> JSON Pointers; reject unknown ids (except add/rename targets)
  const index = buildStableIdIndex(current);
  const rfcOps: RfcOp[] = [];
  for (const op of patch.ops) {
    const resolved = resolveOp(op, index, current);   // throws PatchError on unknown id / bad namespace
    rfcOps.push(...resolved);
  }

  // 3. STRUCTURAL APPLY on a deep clone
  const draft = structuredClone(current);
  let mutated: ProjectSpec;
  try {
    mutated = rfc6902(draft, rfcOps, /*validate*/ true, /*mutate*/ true).newDocument as ProjectSpec;
  } catch (e) {
    return { ok: false, errors: [{ code: "rfc6902_failed", message: String(e) }] };
  }

  // 4. SCHEMA VALIDATION (Ajv) — includes requireConfidenceWhenInferred + stableId keywords
  const schemaErrors = validateProjectSpec(mutated);
  if (schemaErrors.length) return { ok: false, errors: schemaErrors.map(toPatchError) };

  // 5. INVARIANTS beyond schema
  const invariantErrors = checkInvariants(mutated); // §2.4
  if (invariantErrors.length) return { ok: false, errors: invariantErrors };

  // 6. POLICY (blueprint 4.67 "policy" step) — R-level per op via Policy Engine
  const policy = await ctx.policyEngine.evaluate({
    organizationId: ctx.organizationId,
    actor: patch.actor,
    action: "studio.projectspec.mutate",
    risk: classifyPatchRisk(patch, mutated),   // R0..R2; R3+ only if patch changes deployment/domain
    context: { project_id: patch.project_id, ops: patch.ops.map(o => o.op) },
  });
  if (policy.decision === "deny") return { ok: false, policy };
  if (policy.decision === "needs_approval") {
    await ctx.db.approvals.create({ ...toApprovalRequest(patch, policy) });
    return { ok: false, policy };   // caller shows "pending approval"
  }

  // 7. DIFF (semantic, not textual) — feeds Client Portal + Command Center activity
  const diff = computeSpecDiff(current, mutated);

  // 8. VERSION — append-only
  mutated.spec_version = current.spec_version + 1;
  await ctx.db.transaction(async tx => {
    await tx.studio_versions.insert({
      project_id: patch.project_id, organization_id: ctx.organizationId,
      spec_version: mutated.spec_version, spec: mutated, patch: patch, diff,
      origin: patch.origin, actor: patch.actor, created_at: new Date().toISOString(),
    });
    await tx.studio_projects.update(patch.project_id, {
      current_spec_version: mutated.spec_version, updated_at: new Date().toISOString(),
      id_aliases: mergeAliases(patch),
    });
    await tx.event_log.append({
      organization_id: ctx.organizationId, type: "studio.spec.mutated",
      subject_id: patch.project_id, data: { patch_id: patch.patch_id, ops: patch.ops.length, version: mutated.spec_version },
    });
  });

  return { ok: true, new_spec: mutated, new_version: mutated.spec_version, diff, policy };
}
```

### 2.4 Invariants (`checkInvariants`)

1. Exactly one node per reserved root id.
2. Every `content_bindings` / `title_content_id` / `*_content_id` value exists as a key in `spec.content`.
3. Every `action_bindings` value resolves to an `action.*` id; every `data_bindings` value resolves to `model.*` or `api.*`.
4. Every `page.layout_id` / `screen.layout_id` resolves to a `layout.*`.
5. Every `permission.granted_to[]` resolves to a `role.*`; every `permission.resource` resolves to `model.*` or `action.*`.
6. Every `relationship.from`/`to` resolves to a `model.*`; `fk_field` resolves to a `field.*` of the `many` side.
7. No `component.children[]` cycle (DFS).
8. `integrations[].secrets_required[]` are names matching `^[A-Z][A-Z0-9_]+$` — reject if a value looks like a secret (`checkInvariants` runs `looksLikeSecret()`).
9. Every `goal.maps_to_action` (if set) resolves to an `action.*`.
10. `responsive_constraints.never_horizontal_scroll === true` (hard requirement, cannot be patched off).

### 2.5 SpecDiff shape

```typescript
export interface SpecDiff {
  added: { stable_id: StableId; node_type: string }[];
  removed: { stable_id: StableId; node_type: string }[];
  changed: { stable_id: StableId; field: string; before: unknown; after: unknown }[];
  reordered: { container: StableId; field: string }[];
  renamed: { from: StableId; to: StableId }[];
  inference_resolved: StableId[];        // nodes moved inferred -> validated
  risk: "R0" | "R1" | "R2" | "R3" | "R4";
  human_summary: string;                 // generated: "Hero heading changed; services grid switched 3col->2col"
}
```

---

## 3. A/B/C PROPOSAL ENGINE (blueprint 4.68)

### 3.1 Pipeline (inputs → outputs)

```
INPUT: Briefing (structured) + CRM Contact 360 + brand assets (if any)
  |
  v
[STEP 1] Briefing Compiler  ->  BaseProjectSpec (spec_version 1, status "proposing")
         - business facts, services, hours, locations, compliance  -> business.*
         - goals -> goals[]  (primary goal -> maps_to_action)
         - product_type inference -> project.product_type
         - required pages inferred from product_type + goals (page set)
         - data models inferred from bookable services / lead capture / etc.
         - content pool: copywriting agent fills spec.content for every *_content_id
         - brand: use provided tokens; else leave brand.* with _meta.status="inferred"
  |
  v
[STEP 2] Template Matcher   ->  ranked list of TemplateCandidate (top 6)
         score = w1*industry_match + w2*product_type_match + w3*goal_pattern_match
               + w4*section_coverage - w5*complexity_penalty
         (BM25 over template tags + embedding cosine over template description vs briefing summary)
  |
  v
[STEP 3] Design Strategy Generator  ->  exactly 3 DesignStrategy objects {A,B,C}
         Deterministic constraint solver, NOT an LLM free-for-all. It picks 3 points
         in DESIGN-SPACE that are mutually distant (max-min pairwise distance) and each
         individually valid for the brand + industry + a11y rules.
  |
  v
[STEP 4] Variant Materializer (x3)  ->  ProjectSpec A, B, C
         Each = deep clone of BaseProjectSpec with ONLY these fields overridden:
           brand.colors, brand.typography, brand.spacing, brand.radius, brand.shadow, brand.motion
           ui.layouts[*].grid / max_width / regions
           ui.components[*].variant, .props(layout only), .style_overrides, .visual_style
           ui.pages[*].sections order (composition)
         NEVER overridden (shared, blueprint 4.68):
           business.*, goals[], spec.content (copy), data.*, auth, roles, permissions,
           actions, workflows, apis, integrations, seo (except og image), analytics
  |
  v
[STEP 5] Render + Screenshot  ->  studio-renderer builds 3 static previews;
         BrowserMesh screenshots desktop/tablet/mobile per variant -> studio_assets (role "preview")
  |
  v
[STEP 6] Persist  ->  studio_variants rows (A,B,C) each -> studio_versions row (spec_version 1 of the variant)
OUTPUT: 3 variant specs + 9 screenshots + 1 comparison record, linked to studio_project
```

### 3.2 DesignStrategy type + the 3-axis design space

```typescript
export interface DesignStrategy {
  key: "A" | "B" | "C";
  name: string;                    // "Clean Clinical" | "Warm Editorial" | "Bold Confident"
  rationale: string;
  axes: {
    layout_density: "airy" | "balanced" | "compact";
    type_personality: "geometric_sans" | "humanist_sans" | "serif_display_mix";
    color_temperature: "cool" | "neutral" | "warm";
    color_contrast: "soft" | "medium" | "high";
    corner_style: "sharp" | "rounded" | "pill";
    motion_level: "none" | "subtle" | "expressive";
    hero_composition: "centered" | "split-image" | "full-bleed";
    imagery_treatment: "photo" | "illustration" | "abstract";
  };
  token_overrides: Partial<Brand>;
  component_variant_map: Record<string /*component_type*/, string /*variant*/>;
  section_order_overrides: Record<StableId /*page*/, StableId[] /*section ids*/>;
}
```

**Design-space selection (STEP 3) as an algorithm:**

1. Build the feasible set: for each axis, drop values disallowed by (a) brand voice_tone keywords, (b) industry rules (`healthcare_dental` ⇒ `motion_level ≠ expressive`, `color_contrast ≥ medium` for a11y), (c) provided brand tokens (if the customer gave a serif logo wordmark, keep `serif_display_mix` in the pool).
2. Candidate strategies = Cartesian product of feasible axis values, filtered to those a template in the STEP 2 top-6 can express (`component_variant_map` must be satisfiable).
3. Pick 3 by farthest-point sampling on Hamming distance over the 8 axes, seeded with the top-ranked template's natural strategy as A. Guarantees A/B/C are visibly different.
4. Name + rationale generated by a copy agent from the axis tuple (cosmetic only).

**Determinism:** given the same Briefing + template registry version, STEP 3 returns the same 3 strategies (seeded RNG). This is required for reproducible proposals.

### 3.3 Variant Materializer (STEP 4) as code

```typescript
export function materializeVariant(base: ProjectSpec, s: DesignStrategy): ProjectSpec {
  const v = structuredClone(base);
  v.x_variant = { variant_key: s.key, parent_project_id: base.project.stable_id === "project.root" ? base.customer.crm_contact_id! : "", strategy: s, shares_content_with: ["A","B","C"] };

  // brand overrides only
  v.brand = deepMergeTokens(v.brand, s.token_overrides);

  // layout overrides
  for (const layout of v.ui.layouts) {
    if (s.axes.layout_density === "airy")   layout.max_width = "1120px";
    if (s.axes.layout_density === "compact") layout.max_width = "1320px";
  }

  // component variant + coarse style, NEVER content or bindings
  for (const c of v.ui.components) {
    const mapped = s.component_variant_map[c.component_type];
    if (mapped) c.variant = mapped;
    c.visual_style = styleFromAxes(s.axes);          // "premium" | "minimal" | ...
    c.style_overrides = tokenOverridesForComponent(c.component_type, s);
    if (c.component_type === "hero") c.props = { ...c.props, layout: heroLayout(s.axes.hero_composition) };
  }

  // composition: reorder sections per page
  for (const [pageId, order] of Object.entries(s.section_order_overrides)) {
    const page = v.ui.pages.find(p => p.stable_id === pageId);
    if (page) page.sections = reorderByStableId(page.sections, order);
  }

  // og image can differ per variant (visual), nothing else in seo
  v.spec_version = 1;
  return validateOrThrow(v);
}
```

### 3.4 "Create My Own" and Variant Mixing (blueprint 4.71, 4.72)

- **Mix (D):** client picks, per layout region / per page section, which of A/B/C to take. Engine builds strategy D by copying, for each `component_type`/`section`, the `component_variant_map` entry and `style_overrides` from the chosen source variant; brand tokens for D default to the client's most-picked source, editable after. `x_variant.mixed_from` records provenance. Output is a real 4th `studio_variants` row.
- **Create My Own:** starts from D (or from the client's chosen base) and drops the client into the Client Portal editor (a reduced UI Canvas, M12) which emits normal `SpecPatch` with `origin:"client_portal"`. Same apply pipeline, same policy gate (client actor ⇒ R0/R1 only; anything R2+ ⇒ `needs_approval` routed to the Lumenva account manager).

---

## 4. CLIENT PORTAL (blueprint 4.69, 8.6 studio_share_links, 12.7)

### 4.1 Opaque-token scheme

- **Generation:** `token = base64url(randomBytes(32))` → 43-char URL-safe string. No structure, no tenant id, no project id encoded (opaque per blueprint 12.7).
- **Hashing:** store `sha256(token)` hex in `studio_share_links.token_hash` (unique index). Raw token is returned **once** at creation and never stored or logged. Add a 4-char non-secret `token_prefix` (first 4 chars of the raw token) stored in clear for support/debug lookup ("which link is this") without enabling access.
- **Storage:** `studio_share_links` (DDL in §6). Columns: `id, organization_id, project_id, token_hash, token_prefix, scope, variant_scope, expires_at, revoked_at, max_uses, use_count, created_by, last_used_at, last_used_ip_hash`.
- **Scope enum:** `view` (see proposals only), `comment` (view + comment + request-changes), `approve` (comment scope + approve/select variant), `edit` (approve scope + Create My Own / mix / spec patches). One link = one scope.
- **`variant_scope`:** `all` or a specific `variant_key` (share just variant B for a targeted review).
- **Expiry:** default 14 days, max 90. `expires_at` enforced server-side on every request.
- **Revocation:** set `revoked_at`; middleware rejects. "Revoke all links for project" is one UPDATE. Revoking is R1 (reversible-ish: you mint a new one), logged to `event_log`.
- **Rate limit:** per `token_hash`: 60 req/min sliding window (Upstash/Redis or Postgres `studio_share_link_hits` bucket). Per source IP hash: 600 req/min across all links. Exceed ⇒ 429 + `Retry-After`. Failed-token attempts (hash miss) are rate-limited harder: 20/min/IP then temp block, logged as a security event.
- **Audit:** every request → `event_log` append `{type:"studio.portal.access", data:{link_id, scope, route, method, ip_hash, ua_hash, result}}`. Every state-machine transition (§4.3) → `studio_feedback` row + `event_log`.
- **No login, no cookies with PII.** A short-lived signed session cookie (`portal_sid`, HMAC of `link_id + issued_at`, 30-min idle TTL) is set after first valid token hit so the token isn't in every subsequent URL. Cookie is `HttpOnly, Secure, SameSite=Lax`.

### 4.2 Routes (`apps/client-portal`, host `studio.lumenva.app`)

| Route | Method | Min scope | Purpose |
|-------|--------|-----------|---------|
| `/p/:token` | GET | view | Bootstrap: validate token, set `portal_sid`, redirect to `/s/overview` |
| `/s/overview` | GET | view | Project summary + the A/B/C cards |
| `/s/variant/:key` | GET | view | One variant, responsive preview (desktop/tablet/mobile toggle) |
| `/s/variant/:key/preview` | GET | view | Full-bleed iframe of `studio-renderer` output (sandboxed) |
| `/s/compare` | GET | view | Side-by-side A/B/C |
| `/s/variant/:key/comment` | POST | comment | Add a pinned comment `{anchor_stable_id?, x?, y?, body}` |
| `/s/variant/:key/request-changes` | POST | comment | Submit a change request (free text + optional anchors) |
| `/s/variant/:key/approve` | POST | approve | Select this variant as the chosen one |
| `/s/mix` | POST | edit | Create variant D from region→source picks |
| `/s/variant/:key/fork` | POST | edit | "Create My Own" from this variant → opens editor |
| `/s/editor` | GET | edit | Reduced UI Canvas (M12) bound to the client's fork |
| `/s/editor/patch` | POST | edit | Apply a `SpecPatch` (origin `client_portal`) |
| `/s/activity` | GET | view | Timeline of comments/decisions (this link's project) |
| `/s/decision` | GET | view | Final decision receipt once approved |

All `/s/*` require a valid `portal_sid` OR `?t=` token fallback; middleware resolves link → project → `organization_id` and pins it (never trust anything client-sent for tenant, blueprint 12.2).

### 4.3 State machine

States of a **project's client-review**: `AWAITING_REVIEW → IN_DISCUSSION → CHANGES_REQUESTED → REVISED → APPROVED → HANDED_OFF` plus terminal `CANCELLED`.

```
AWAITING_REVIEW
  --comment-->            IN_DISCUSSION
  --request-changes-->    CHANGES_REQUESTED
  --approve(key)-->       APPROVED

IN_DISCUSSION
  --request-changes-->    CHANGES_REQUESTED
  --approve(key)-->       APPROVED
  --comment-->            IN_DISCUSSION (self)

CHANGES_REQUESTED
  --(Lumenva applies patch / new variant)-->  REVISED         [system/agent transition]
  --approve(key)-->       APPROVED            (client may approve despite open requests; requests logged as waived)

REVISED
  --comment-->            IN_DISCUSSION
  --request-changes-->    CHANGES_REQUESTED
  --approve(key)-->       APPROVED

edit / fork / mix  (scope "edit"):
  allowed from AWAITING_REVIEW, IN_DISCUSSION, CHANGES_REQUESTED, REVISED
  produces a client-owned variant (D or fork); does NOT change project state by itself
  approving a client-owned variant is a normal --approve(key) with key = "D" or the fork key

APPROVED
  --(Lumenva confirms + commercial proposal accepted + payment)-->  HANDED_OFF   [system]
  --reopen (Lumenva only)-->  IN_DISCUSSION

any non-terminal --cancel (Lumenva only)--> CANCELLED
```

- Transitions triggered by the client: `comment`, `request-changes`, `approve`, `fork`, `mix`, `edit/patch`. Server validates scope ≥ required for each.
- Transitions triggered by system/agent: `REVISED` (after a `SpecPatch` with origin ≠ `client_portal` lands), `HANDED_OFF`, `reopen`, `cancel`.
- `approve` is idempotent per `(link, variant_key)`; changing the approved variant before `HANDED_OFF` is allowed and emits `studio.variant.approval_changed`.
- On `approve` → CRM: `event_log` `studio.project.approved` → CRM Contact 360 shows "Design approved: Variant B" and unblocks the commercial-proposal step (M10).
- Every transition writes a `studio_feedback` row `{type, variant_key, state_from, state_to, body, anchors, actor:"client", link_id}`.

### 4.4 Comment anchoring

A comment optionally anchors to `anchor_stable_id` (from the rendered preview: every rendered node carries `data-sid`) and/or a normalized `{x,y}` (0..1) on a named screenshot. Anchors survive spec patches because they key on stable id; if the node is later removed, the comment shows "(element removed in v12)".

---

## 5. TWO CANVAS ENGINES (blueprint 4.70, 4.73) + M3E EXTRACTION

### 5.1 UI Canvas vs Asset Canvas

| Aspect | UI Canvas (`studio-canvas/ui`) | Asset Canvas (`studio-canvas/asset`) |
|--------|-------------------------------|--------------------------------------|
| Model | ProjectSpec `ui.*` tree | LayerManifest (§6.x) |
| Geometry | Flow + responsive (CSS grid/flex, breakpoints) | Absolute (x,y,w,h,rotation,transform) in a fixed art-board |
| Unit | rem / % / fr / breakpoint | px on art-board, DPI-aware export |
| Edit primitive | `SpecOp` patch (add/replace/reorder component) | `LayerOp` (move/scale/recolor/mask/text-edit/z-order) |
| Selection | node = `component`/`section`/`page` | node = `layer`/`group` |
| Rendering | `studio-renderer` (real React components from `studio-components`) inside a sandboxed iframe; canvas overlays selection chrome | Konva/`<canvas>` 2D scene graph + optional SVG layer for vectors |
| Responsive | first-class: edit per breakpoint, preview at any width | none (single art-board; multiple art-boards = multiple assets) |
| Output | mutated ProjectSpec version | mutated LayerManifest + rasterized/vector export → `studio_assets` |
| Undo/redo | patch stack (inverse ops) | LayerOp stack |
| Shared | project id, version store (`studio_versions`), comment anchoring, brand tokens | same |

### 5.2 How the UI Canvas renders + edits ProjectSpec responsively (M11/M12)

1. **Render:** `studio-renderer` takes `ProjectSpec` + a target width, resolves each `page`/`screen` → `layout` → ordered `sections` → `ComponentInstance`. Each instance maps `component_type`+`variant` to a real component in `packages/studio-components` (registry-driven). Content resolved from `spec.content[binding][locale]`. Bindings for actions/data are rendered as inert (preview) or mock. Output DOM: every node wrapped with `data-sid="<stable_id>"`, `data-node-type`.
2. **Iframe isolation:** renderer runs in a sandboxed same-origin iframe (`sandbox="allow-scripts allow-same-origin"`, CSP locked). The canvas shell (parent) draws selection boxes, spacing handles, the inspector — it reads geometry via `postMessage` (`{sid, rect, computedStyle subset}`), never manipulates the iframe DOM directly.
3. **Select:** click in iframe → `postMessage({type:"select", sid})` → parent opens Inspector for that stable id, showing schema-driven fields (props from Component Registry schema, `style_overrides` token pickers, content editors for bound `spec.content` keys, responsive tab per breakpoint).
4. **Edit → patch:** every inspector change builds a `SpecOp` (`replace /ui/components/<sid>/props/<field>`, or `replace /content/<key>/<locale>`, or `reorder` on section drag). Ops batch into one `SpecPatch` per "interaction" (debounced 400 ms), sent to `/studio/patch` → `applySpecPatch` (§2.3) → new version → renderer re-renders. Optimistic local apply with rollback on server reject.
5. **Responsive editing:** the breakpoint switcher sets the renderer width AND scopes edits: editing while "md" is active writes to `component.responsive.md.<field>` instead of the base field. Base (`base`) edits cascade; overrides shown with a "modified at md" badge; "reset to base" removes the responsive key.
6. **Undo/redo:** client keeps a stack of `{patch, inverse}` where inverse is computed by `invertOps(before, ops)`. Undo = apply inverse as a new patch (history is append-only; no rewind of `studio_versions`).

### 5.3 M3E extraction plan

**What M3E is here:** an existing prompt-oriented visual editor in the Lumenva ecosystem. We do **not** fork it wholesale. We extract the parts that are ProjectSpec-agnostic and rebuild the spec binding.

**PULL OUT of M3E into `packages/studio-canvas`:**
- The **canvas viewport**: pan/zoom, ruler, snapping, marquee selection, multi-select, keyboard nudge, alignment guides, the selection/resize/rotate handle widgets.
- The **overlay renderer** (draws chrome over an arbitrary rendered surface via rects) — this is engine-neutral and serves both UI and Asset canvas.
- The **inspector shell**: collapsible sections, token pickers (color/spacing/type), responsive tab strip, undo/redo UI, the diff/"modified" badges.
- The **command palette + NL input box** and its "instruction → structured intent" plumbing (we swap its output target to `SpecOp`/`LayerOp`).
- **Konva/2D scene-graph wrapper** and export (PNG/SVG/PDF) — becomes the Asset Canvas core.
- Asset ingestion (drag-drop image, paste) and the crop/resize UI.

**LEAVE in M3E / DROP:**
- Its own document model / storage layer (we use `studio_versions` + ProjectSpec/LayerManifest).
- Its direct React/JSX-mutation editing path (blueprint 4.71 explicitly forbids "uncontrolled React edits").
- Its prompt/runtime coupling to whatever model it calls — routing goes through `model-router`.
- Any auth/session/tenant code — Studio owns that.
- Its component library, if any — we use `studio-components` + Component Registry.

**Extraction steps:**
1. Vendor M3E into `packages/_vendor/m3e` read-only; run `depcruise`/`madge` to map modules.
2. Identify the viewport + overlay + inspector modules with **zero** imports from M3E's document/model/runtime layers; move those to `studio-canvas/core`, add a thin `CanvasHost` interface (`getNodeRects()`, `applyOp(op)`, `onSelect(cb)`).
3. Write two `CanvasHost` implementations: `UiCanvasHost` (iframe + `studio-renderer` + `SpecOp`) and `AssetCanvasHost` (Konva + `LayerOp`).
4. Re-skin the inspector with `design-system` tokens.
5. Delete `_vendor/m3e` once nothing imports it; keep a `SOURCE_PROVENANCE.md` entry (blueprint 2.4).

**Effort:** M11 (18 ed) assumes ~40% of the viewport/overlay/inspector is reusable; if extraction yields <20% reusable, M11 → 26 ed (rebuild viewport from `@dnd-kit` + custom overlay). Decision gate at step 2: measure reusable LOC, pick path, record ADR.

---

## 6. STUDIO DOMAIN SQL (blueprint 8.6) + CUSTOMER DELIVERY SQL (blueprint 8.7)

All tables: `organization_id uuid not null` referencing `organizations(id)`, RLS enabled, tenant policy. Migrations go in `supabase/migrations/` as new files (never edit applied ones, ADR-023). Baseline pattern below; `updated_at` via existing `set_updated_at()` trigger.

### 6.1 Studio Domain

```sql
-- supabase/migrations/20260910_0001_studio_domain.sql

create table studio_projects (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  crm_contact_id        uuid references contacts(id) on delete set null,
  name                  text not null,
  slug                  text not null,
  product_type          text not null check (product_type in
    ('landing_page','marketing_website','business_website','web_application','saas',
     'dashboard','internal_tool','customer_portal','mobile_application','website_plus_app')),
  status                text not null default 'briefing' check (status in
    ('briefing','proposing','in_review','approved','building','delivered','cancelled')),
  review_state          text not null default 'awaiting_review' check (review_state in
    ('awaiting_review','in_discussion','changes_requested','revised','approved','handed_off','cancelled')),
  current_spec_version  integer not null default 0,
  approved_variant_key  text check (approved_variant_key in ('A','B','C','D') or approved_variant_key ~ '^fork-[a-z0-9]{6}$'),
  id_aliases            jsonb not null default '{}'::jsonb,      -- {old_stable_id: new_stable_id}
  primary_locale        text not null default 'pt-PT',
  created_by            uuid references users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (organization_id, slug)
);
create index on studio_projects (organization_id, status);
create index on studio_projects (crm_contact_id);

create table studio_briefings (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  project_id        uuid not null references studio_projects(id) on delete cascade,
  source            text not null default 'form' check (source in ('form','conversation','import','agent')),
  raw               jsonb not null,                              -- as captured
  normalized        jsonb not null default '{}'::jsonb,          -- BriefingCompiler output
  base_spec_version integer,                                     -- version produced from this briefing
  completeness      numeric not null default 0 check (completeness between 0 and 1),
  created_by        uuid references users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on studio_briefings (project_id);

create table studio_templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,   -- null = global/system template
  key             text not null,
  version         text not null default '1.0.0',
  name            text not null,
  description     text not null default '',
  product_types   text[] not null default '{}',
  industries      text[] not null default '{}',
  tags            text[] not null default '{}',
  section_kinds   text[] not null default '{}',
  spec_fragment   jsonb not null,                                 -- partial ProjectSpec (pages/components/layouts)
  natural_strategy jsonb,                                         -- default DesignStrategy for this template
  embedding       vector(1536),                                   -- pgvector; description embedding
  status          text not null default 'active' check (status in ('draft','active','deprecated')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), key, version)
);
create index on studio_templates using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create table studio_variants (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  project_id        uuid not null references studio_projects(id) on delete cascade,
  variant_key       text not null,                               -- 'A'|'B'|'C'|'D'|'fork-xxxxxx'
  origin            text not null check (origin in ('proposal','mix','client_fork')),
  strategy          jsonb not null default '{}'::jsonb,           -- DesignStrategy
  mixed_from        jsonb,                                        -- [{region, source_variant}]
  current_spec_version integer not null default 1,
  preview_desktop_asset_id uuid,
  preview_tablet_asset_id  uuid,
  preview_mobile_asset_id  uuid,
  is_approved       boolean not null default false,
  created_by_actor  jsonb not null default '{"type":"agent","id":"proposal-engine"}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (project_id, variant_key)
);
create index on studio_variants (project_id);

create table studio_versions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id      uuid not null references studio_projects(id) on delete cascade,
  variant_key     text,                                          -- null = project-level base spec
  spec_version    integer not null,
  spec            jsonb not null,                                -- full ProjectSpec snapshot (source of truth)
  patch           jsonb,                                         -- the SpecPatch that produced this version
  diff            jsonb,                                         -- SpecDiff
  origin          text not null default 'system',
  actor           jsonb not null default '{}'::jsonb,
  spec_hash       text not null,                                 -- sha256 of canonicalized spec
  created_at      timestamptz not null default now(),
  unique (project_id, variant_key, spec_version)
);
create index on studio_versions (project_id, variant_key, spec_version desc);

create table studio_assets (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id      uuid references studio_projects(id) on delete cascade,   -- null = org asset library
  kind            text not null check (kind in ('upload','generated','preview','export','layer_source')),
  role            text,                                          -- logo|hero|og_image|preview|...
  storage_bucket  text not null default 'studio-assets',
  storage_path    text not null,
  mime            text not null,
  width           integer, height integer, bytes bigint,
  layer_manifest  jsonb,                                         -- present when Magic Layers ran
  derived_from    uuid references studio_assets(id),
  checksum        text,
  created_by_actor jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on studio_assets (project_id, role);

create table studio_feedback (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id      uuid not null references studio_projects(id) on delete cascade,
  variant_key     text,
  share_link_id   uuid references studio_share_links(id) on delete set null,
  type            text not null check (type in
    ('comment','request_changes','approve','state_transition','mix','fork','waived')),
  state_from      text, state_to text,
  body            text,
  anchors         jsonb not null default '[]'::jsonb,            -- [{stable_id?, x?, y?, screenshot?}]
  actor           text not null default 'client' check (actor in ('client','account_manager','agent','system')),
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index on studio_feedback (project_id, created_at desc);

create table studio_share_links (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  project_id        uuid not null references studio_projects(id) on delete cascade,
  token_hash        text not null unique,                        -- sha256 hex of raw token
  token_prefix      text not null,                               -- first 4 chars, non-secret
  scope             text not null check (scope in ('view','comment','approve','edit')),
  variant_scope     text not null default 'all',                 -- 'all' | 'A'|'B'|'C'|'D'|fork key
  expires_at        timestamptz not null,
  revoked_at        timestamptz,
  max_uses          integer,
  use_count         integer not null default 0,
  last_used_at      timestamptz,
  last_used_ip_hash text,
  created_by        uuid references users(id),
  created_at        timestamptz not null default now()
);
create index on studio_share_links (project_id) where revoked_at is null;

create table studio_share_link_hits (               -- rate-limit + audit bucket
  id             bigserial primary key,
  link_id        uuid references studio_share_links(id) on delete cascade,
  ip_hash        text not null,
  route          text not null,
  method         text not null,
  result         text not null,                                  -- ok|denied|rate_limited|expired|revoked
  at             timestamptz not null default now()
);
create index on studio_share_link_hits (link_id, at desc);
create index on studio_share_link_hits (ip_hash, at desc);

create table studio_deployments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  project_id       uuid not null references studio_projects(id) on delete cascade,
  customer_project_id uuid,                                       -- FK to customer_projects once handed off
  environment      text not null check (environment in ('preview','staging','production')),
  status           text not null default 'queued' check (status in
    ('queued','building','deployed','failed','rolled_back')),
  spec_version     integer,
  commit_sha       text,
  url              text,
  build_job_id     uuid,                                          -- agent_jobs.id
  health           jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on studio_deployments (project_id, environment);

-- RLS (apply to every table above)
alter table studio_projects enable row level security;
create policy studio_projects_tenant on studio_projects
  using (organization_id = (auth.jwt() ->> 'organization_id')::uuid)
  with check (organization_id = (auth.jwt() ->> 'organization_id')::uuid);
-- ... identical policy on studio_briefings, studio_variants, studio_versions,
--     studio_assets, studio_feedback, studio_share_links, studio_deployments.
-- studio_templates: SELECT allowed when organization_id is null OR matches; write requires match.
create policy studio_templates_read on studio_templates for select
  using (organization_id is null or organization_id = (auth.jwt() ->> 'organization_id')::uuid);
create policy studio_templates_write on studio_templates for all
  using (organization_id = (auth.jwt() ->> 'organization_id')::uuid)
  with check (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

-- Client Portal path uses a SERVICE-ROLE server that sets
--   set_config('request.jwt.claims', json_build_object('organization_id', <resolved org>)::text, true)
-- AFTER resolving the share link, so RLS still applies with the correct tenant.
```

### 6.2 Customer Delivery Domain

```sql
-- supabase/migrations/20260910_0002_customer_delivery_domain.sql

create table customer_projects (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,   -- Lumenva tenant that owns the engagement
  studio_project_id uuid not null references studio_projects(id) on delete restrict,
  crm_contact_id    uuid references contacts(id) on delete set null,
  name              text not null,
  slug              text not null,
  product_type      text not null,
  approved_spec_version integer not null,
  approved_variant_key  text not null,
  lifecycle         text not null default 'provisioning' check (lifecycle in
    ('provisioning','building','qa','preview','client_approval','deploying','live','maintenance','archived')),
  isolation_profile text not null default 'product_factory_default',
  metadata_only     boolean not null default true,                -- Lumenva stores metadata only (ADR-021)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, slug)
);

create table project_repositories (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  customer_project_id uuid not null references customer_projects(id) on delete cascade,
  provider          text not null default 'github' check (provider in ('github')),
  owner             text not null,                                -- e.g. 'lumenva-customers'
  repo              text not null,
  default_branch    text not null default 'main',
  visibility        text not null default 'private',
  install_id        text,                                         -- GitHub App installation id (ref, not secret)
  created_at        timestamptz not null default now(),
  unique (provider, owner, repo)
);

create table project_environments (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  customer_project_id uuid not null references customer_projects(id) on delete cascade,
  env               text not null check (env in ('preview','staging','production')),
  hosting_provider  text not null,                                -- 'cloudflare' | 'vercel'
  project_ref       text,                                         -- provider project id
  db_provider       text not null,                                -- 'neon' | 'supabase'
  db_project_ref    text,
  db_branch         text,
  secret_scope      text not null,                                -- name of secret bundle in secret manager
  status            text not null default 'pending' check (status in ('pending','ready','error','destroyed')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (customer_project_id, env)
);

create table project_resources (                                 -- realtime/jobs/storage/payments toggles actually provisioned
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  customer_project_id uuid not null references customer_projects(id) on delete cascade,
  kind              text not null check (kind in ('database','auth','storage','realtime','jobs','email','payments','cdn','queue')),
  provider          text not null,
  config            jsonb not null default '{}'::jsonb,           -- non-secret config only
  secrets_required  text[] not null default '{}',                 -- names only
  status            text not null default 'pending',
  created_at        timestamptz not null default now(),
  unique (customer_project_id, kind)
);

create table project_releases (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  customer_project_id uuid not null references customer_projects(id) on delete cascade,
  release_version   text not null,                                -- semver or date-seq
  environment       text not null check (environment in ('preview','staging','production')),
  commit_sha        text not null,
  previous_commit_sha text,
  spec_version      integer not null,
  migration_state   jsonb not null default '{}'::jsonb,           -- {applied:[...], pending:[...]}
  artifacts         jsonb not null default '[]'::jsonb,
  tests_passed      boolean not null default false,
  security_status   text not null default 'unknown' check (security_status in ('unknown','pass','fail','waived')),
  preview_url       text,
  rollback_target   text,                                         -- commit_sha to roll back to
  approved_by       uuid references users(id),
  client_approved_at timestamptz,
  deployed_at       timestamptz,
  status            text not null default 'pending' check (status in
    ('pending','preview','approved','deployed','failed','rolled_back')),
  created_at        timestamptz not null default now(),
  unique (customer_project_id, environment, release_version)
);

create table project_domains (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  customer_project_id uuid not null references customer_projects(id) on delete cascade,
  host              text not null,
  env               text not null check (env in ('preview','staging','production')),
  managed_by        text not null check (managed_by in ('lumenva','customer')),
  dns_status        text not null default 'pending' check (dns_status in ('pending','verifying','active','error')),
  tls_status        text not null default 'pending' check (tls_status in ('pending','issued','error')),
  verification_record text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (host)
);

create table project_health_checks (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  customer_project_id uuid not null references customer_projects(id) on delete cascade,
  environment       text not null,
  kind              text not null check (kind in ('http','ssl','db','build','uptime','lighthouse')),
  target            text not null,
  status            text not null check (status in ('pass','warn','fail')),
  latency_ms        integer,
  detail            jsonb not null default '{}'::jsonb,
  checked_at        timestamptz not null default now()
);
create index on project_health_checks (customer_project_id, environment, checked_at desc);

-- RLS: every table -> tenant policy on organization_id, same shape as §6.1.
-- NOTE (ADR-021): connection strings, API keys, deploy tokens for customer infra
-- live ONLY in the secret manager (Infisical), referenced by name via secret_scope /
-- secrets_required. They are never columns here.
```

---

## 7. PRODUCT FACTORY PIPELINE (blueprint 4.78–4.81, Wave 9)

### 7.1 Pipeline overview

```
APPROVED PROJECTSPEC (studio_versions row, is_approved variant)
  -> [handoff] create customer_projects row (lifecycle=provisioning)
  -> Product Architect Agent  => BuildPlan  (§7.2)
  -> Requirement Resolver      => ResolvedRequirements (§7.4)
  -> Generation Graph (DAG):
       deterministic generators (§7.5)  ||  coding agent tasks (§7.6)
  -> Repository assembled + committed (Git Project Factory, §7.8)
  -> GATE CHAIN (§7.3):  install -> typecheck -> lint -> unit -> db -> integration
       -> e2e -> accessibility -> security -> visual QA
  -> PASS? --no--> Repair Loop (§7.7) --(<= N iters)--> re-run failed gates
           --yes--> Preview deploy -> project_releases(status=preview)
  -> Client approval -> Production approval -> deploy -> health checks -> lifecycle=live
```

Orchestrated by an `agent_jobs` namespace `build.*`; runs on BrowserMesh (Linux), never on the Mac. Each gate is its own job with evidence bundle (blueprint 4.18).

### 7.2 BuildPlan schema (`packages/project-generator/src/buildplan.ts`)

```typescript
export interface BuildPlan {
  build_plan_id: string;
  customer_project_id: string;
  source_spec: { project_id: string; variant_key: string; spec_version: number; spec_hash: string };
  target: {
    product_type: ProductType;
    stack: {
      framework: "next"; runtime: "node20"; package_manager: "pnpm";
      db: "neon_postgres" | "supabase"; orm: "drizzle";
      hosting: "cloudflare" | "vercel"; storage: "r2" | "supabase_storage";
      styling: "tailwind"; ui_kit: "studio-components";
    };
    monorepo: false;                      // customer repo is single-app
  };
  modules: BuildModule[];                  // ordered, with deps
  generation_graph: { node_id: string; kind: "deterministic" | "agent"; depends_on: string[] }[];
  gates: GateSpec[];                       // ordered gate chain, §7.3
  repair_policy: { max_iterations: number; per_gate_max: number; escalate_after: number };
  isolation: {
    repo: { owner: string; repo: string };
    environments: ("preview" | "production")[];
    db_isolation: "separate_project" | "separate_branch";
    secret_scope: string;
    domain_plan: { env: string; host: string; managed_by: "lumenva" | "customer" }[];
  };
  acceptance: AcceptanceCriterion[];       // derived from goals + spec (§9)
  estimated: { deterministic_minutes: number; agent_tasks: number; agent_minutes: number };
}

export interface BuildModule {
  module_id: string;                      // "db", "auth", "api.appointments", "ui.page.home", "workflow.booking"
  kind: "deterministic" | "agent" | "hybrid";
  spec_refs: StableId[];
  outputs: string[];                      // file globs it will create
  generator?: string;                     // deterministic generator name
  agent_task?: AgentTaskSpec;             // §7.6
  verification: string[];                 // gate ids that must cover this module
}

export interface GateSpec {
  gate_id: "install"|"typecheck"|"lint"|"unit"|"db"|"integration"|"e2e"|"accessibility"|"security"|"visual_qa";
  command: string;
  required: boolean;
  blocking: boolean;
  timeout_s: number;
  evidence: ("stdout"|"junit"|"coverage"|"screenshots"|"axe_report"|"sarif")[];
}
```

### 7.3 Gate chain (concrete commands)

| Gate | Command | Pass criteria | Evidence |
|------|---------|---------------|----------|
| install | `pnpm install --frozen-lockfile` | exit 0 | stdout |
| typecheck | `pnpm tsc --noEmit` | 0 errors | stdout |
| lint | `pnpm eslint . --max-warnings=0` | exit 0 | stdout |
| unit | `pnpm vitest run --coverage` | all pass, coverage ≥ 70% lines on generated `lib/` | junit + coverage |
| db | `pnpm drizzle-kit push --dry-run` then apply to ephemeral DB + `pnpm test:db` | migrations apply clean, RLS tests pass | stdout + junit |
| integration | `pnpm vitest run --dir tests/integration` | all pass | junit |
| e2e | `pnpm playwright test` against preview build | all pass | screenshots + trace |
| accessibility | `pnpm playwright test tests/a11y` (axe-core per page) | 0 serious/critical violations | axe_report |
| security | `pnpm audit --audit-level=high` + `semgrep --config auto` + secret scan (`gitleaks`) | no high/critical, no secrets | sarif |
| visual_qa | screenshot every page/screen at 3 widths; VLM compares against approved variant preview + checks: no overflow-x, contrast ≥ 4.5, tap targets ≥ 44px | VLM verdict "match" + rule checks pass | screenshots + report |

`db`, `security`, `accessibility`, `visual_qa` are `required: true, blocking: true`. Any git-shelling test runs where `.git` exists (BrowserMesh worktree), per the CLAUDE.md caveat.

### 7.4 Requirement Resolver (blueprint 4.80)

```typescript
export interface ResolvedRequirements {
  database:   { needed: boolean; models: number; needs_rls: boolean; needs_migrations: boolean };
  auth:       { needed: boolean; providers: string[]; needs_rbac: boolean; supabase_auth: boolean };
  storage:    { needed: boolean; buckets: string[] };
  api:        { needed: boolean; routes: number; public_routes: number };
  realtime:   { needed: boolean; channels: string[] };
  payments:   { needed: boolean; provider?: string };
  background_jobs: { needed: boolean; workflows: number };
  email:      { needed: boolean; provider?: string; templates: string[] };
  mobile:     { needed: boolean; platforms: string[] };
  i18n:       { needed: boolean; locales: string[] };
}

export function resolveRequirements(spec: ProjectSpec): ResolvedRequirements {
  return {
    database: { needed: spec.data.models.length > 0, models: spec.data.models.length,
      needs_rls: spec.data.models.some(m => m.tenant_scoped), needs_migrations: spec.data.models.length > 0 },
    auth: { needed: spec.auth.required, providers: spec.auth.providers,
      needs_rbac: spec.roles.length > 1 || spec.permissions.length > 0, supabase_auth: spec.auth.supabase_auth },
    storage: { needed: spec.infrastructure.needs.file_uploads || spec.assets.some(a => a.role === "gallery"),
      buckets: spec.infrastructure.needs.file_uploads ? ["uploads"] : [] },
    api: { needed: spec.apis.length > 0, routes: spec.apis.flatMap(a => a.endpoints).length,
      public_routes: spec.apis.filter(a => a.auth === "public").flatMap(a => a.endpoints).length },
    realtime: { needed: spec.infrastructure.needs.realtime, channels: [] },
    payments: { needed: spec.infrastructure.needs.payments,
      provider: spec.integrations.find(i => /stripe|mollie/.test(i.provider))?.provider },
    background_jobs: { needed: spec.workflows.length > 0, workflows: spec.workflows.length },
    email: { needed: spec.infrastructure.needs.email,
      provider: spec.integrations.find(i => /resend|sendgrid|ses/.test(i.provider))?.provider,
      templates: spec.workflows.flatMap(w => w.steps.filter(s => s.type === "send_email").map(s => String(s.config.template))) },
    mobile: { needed: !!spec.platforms.mobile, platforms: spec.platforms.mobile?.platforms ?? [] },
    i18n: { needed: spec.project.locales.length > 1, locales: spec.project.locales },
  };
}
```

The resolver output drives which `BuildModule`s and generators run. **YAGNI (blueprint 2.18):** if `payments.needed === false`, no payment code, no Stripe dep, no webhook route.

### 7.5 Deterministic generators (blueprint: DB, auth, API scaffolding)

| Generator | Input | Output | Deterministic because |
|-----------|-------|--------|----------------------|
| `project-skeleton` | stack | `package.json`, `tsconfig`, `next.config`, `tailwind.config` (brand tokens injected), `.env.example` (names only), CI config off (per CLAUDE.md), `README` | pure template + token substitution |
| `db-generator` | `spec.data` | Drizzle schema (`db/schema.ts`), migration SQL, RLS policies for tenant-scoped models, `db/seed.ts` (if `seed_strategy != none`) | 1:1 mapping from `DataModel`/`DataField`/`Relationship` |
| `auth-generator` | `spec.auth`, `spec.roles`, `spec.permissions` | Supabase Auth wiring OR NextAuth config, middleware, `lib/rbac.ts` (permission checks from `permissions[]`), protected-route guards | rule-based from RBAC spec |
| `api-generator` | `spec.apis`, `spec.actions` | Route handlers (`app/api/**/route.ts`) with zod schemas from `input_schema`/`output_schema`, pagination helpers, rate-limit middleware from `action.rate_limit` | schema → zod → handler stub is mechanical |
| `action-generator` | `spec.actions` | `lib/actions/<id>.ts` typed function signatures + permission assertion + idempotency key handling + side-effect stubs | signature + guards mechanical; **body may be `hybrid`** (agent fills business logic) |
| `workflow-generator` | `spec.workflows` | Job definitions in `workers/`, step runner scaffolding, email template files | step graph → code is mechanical |
| `ui-scaffold-generator` | `spec.ui` | `app/**/page.tsx` / `screen` routes, layout components, imports from `studio-components`, content JSON from `spec.content`, `data-sid` attributes | page→layout→sections→component render is the same resolver as `studio-renderer` |
| `seo-generator` | `spec.seo` | `app/sitemap.ts`, `robots.txt`, `<head>` metadata, JSON-LD components | direct field mapping |
| `analytics-generator` | `spec.analytics` | consent banner (opt-in default), event dispatch helpers | direct mapping |
| `test-scaffold-generator` | modules + acceptance | Vitest unit stubs per `lib/` file, Playwright e2e per page/goal, axe a11y spec per page, `test:db` RLS tests per tenant model | derived from other generators' outputs |

**Agent-driven modules:** business logic inside `action-generator` `hybrid` bodies (e.g. availability computation for the dentist booking), non-trivial workflow step logic, any component variant that `studio-components` doesn't already provide (must be added to the registry, reviewed), copy polish, edge-case handling flagged by failing gates.

### 7.6 Coding Agent Task + Repair Loop

```typescript
export interface AgentTaskSpec {
  task_id: string;
  module_id: string;
  goal: string;                           // "Implement availability computation for action.appointment.create"
  spec_context: StableId[];               // relevant spec nodes to include
  files_allowed: string[];                // write boundary (blueprint 12.8 sandbox)
  files_readonly: string[];
  must_satisfy: string[];                  // gate ids / specific test files
  forbidden: string[];                     // ["no new deps without approval", "no changes outside files_allowed"]
  max_turns: number;
  handoff_from?: string;
}
```

**Repair Loop:**

```
for gate in gate_chain:
  run gate
  if pass: continue
  if fail:
    repair_iteration = 0
    while repair_iteration < repair_policy.per_gate_max:
      repair_iteration++
      build RepairTask {
        goal: "Fix <gate> failures",
        evidence: gate.evidence (junit/sarif/axe/screenshots),
        files_allowed: union(modules whose verification includes this gate),
        must_satisfy: [gate.gate_id],
        max_turns: 12
      }
      run coding agent (BrowserMesh, model via model-router, DEEP reasoning)
      re-run ONLY this gate + any earlier non-blocking gate it could regress (typecheck, lint, unit)
      if pass: break
    if still failing after per_gate_max:
      total_repairs += repair_iteration
      if total_repairs >= repair_policy.escalate_after (default 8):
        mark customer_project lifecycle blocked
        create approval/incident -> human engineer (Command Center)
        STOP
```

Defaults: `max_iterations: 15` total, `per_gate_max: 3`, `escalate_after: 8`. Every repair attempt writes an `evidence` row and an `event_log` `build.repair.attempt`. The loop never edits migrations already applied to a persistent DB (ADR-023) — DB gate uses ephemeral DBs.

### 7.7 Customer Project Isolation + frozen infra profile

- **`product_factory_default` profile (freeze before Wave 9, blueprint section 28):** Cloudflare Pages/Workers + Neon Postgres + R2 storage + Resend email. Alternative profile `vercel_supabase` selectable per project but not default. The profile lives in `packages/project-generator/profiles/*.json`; deployment adapters (`integrations/cloudflare`, `integrations/vercel`) hold all provider specifics. ProjectSpec `infrastructure.hosting`/`database` carry the choice but no provider credentials or business semantics (ADR-021).
- **Per customer project:** its own GitHub repo (`lumenva-customers/<slug>`), its own Neon project (or branch), its own env var / secret bundle in Infisical (`secret_scope = cp_<id>`), its own domains, its own deploy tokens. **Lumenva DB stores only metadata** (the `customer_*` / `project_*` tables in §6.2) — never a connection string, never an API key.
- **Runtime sandbox (blueprint 12.8):** the coding agent for a customer build gets filesystem write access only to that repo's worktree, network access only to the package registry + the customer's own preview infra, and only the tools in `AgentTaskSpec.files_allowed` scope.

### 7.8 Git Project Factory

1. Create repo from `lumenva-customers/_template` (empty, license, `.gitignore`, CODEOWNERS = Lumenva release team).
2. Generators write into a BrowserMesh worktree; commit in logical chunks with Conventional Commits (per CLAUDE.md rule): `feat(db): generate schema from ProjectSpec v<n>`, `feat(auth): rbac from spec`, `feat(ui): pages from approved variant B`, etc. One commit = one module.
3. Push to `main`; open no PR (customer repo has no review flow) but tag `spec-v<spec_version>`.
4. Register `project_repositories` row; wire preview deploy hook.
5. Every subsequent spec change post-handoff → new branch `spec-v<n+1>` → generators re-run in "update" mode (diff-aware) → gate chain → PR into `main` (now reviewed by Release Manager agent) → preview → client approval → merge → `project_releases` row.

---

## 8. REVERSE DESIGN ENGINE (blueprint 4.77) + MAGIC LAYERS (4.75, 4.76)

### 8.1 LayerManifest data structure

```typescript
export interface LayerManifest {
  manifest_id: string;
  source_asset_id: string;
  artboard: { width: number; height: number; dpi: number; background?: string };
  color_space: "srgb";
  layers: Layer[];                        // z-index order, ascending
  fonts_detected: { family: string; confidence: number; fallback: string }[];
  palette: { hex: string; ratio: number }[];
  created_at: ISODate;
  pipeline_version: string;
}

export interface Layer {
  id: StableId;                           // "layer.<n>" or semantic when known
  type: "background" | "image" | "text" | "shape" | "vector" | "group";
  bbox: { x: number; y: number; w: number; h: number };
  transform: { rotation: number; scale_x: number; scale_y: number; skew_x: number; skew_y: number };
  z_index: number;
  opacity: number;
  blend_mode: "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten";
  visible: boolean;
  locked: boolean;
  mask?: { type: "alpha" | "clip"; layer_id?: StableId; path?: string };
  source: { kind: "raster" | "svg" | "text"; storage_path?: string; svg?: string; text_runs?: TextRun[] };
  confidence: number;                     // 0..1 for the extraction of THIS layer
  provenance: "ml_decomposition" | "ocr" | "vectorization" | "occlusion_fill" | "manual";
  editable_metadata: {
    recolorable?: boolean;
    text_editable?: boolean;
    font_locked?: boolean;
    is_occlusion_reconstructed?: boolean;
  };
  children?: StableId[];                  // for groups
}

export interface TextRun {
  text: string;
  font_family: string; font_size: number; font_weight: number;
  color: string; letter_spacing?: number; line_height?: number;
  align: "left" | "center" | "right" | "justify";
  bbox: { x: number; y: number; w: number; h: number };
  confidence: number;
}
```

### 8.2 Magic Layers Pipeline — ML steps, models, fallbacks

| Step | Primary tool/model | Fallback | Output |
|------|--------------------|----------|--------|
| 1. Preprocess | sharp: normalize to sRGB, cap 4096px long edge, EXIF strip | — | working raster |
| 2. Instance/layer decomposition | SAM 2 (Segment Anything 2) for masks + a layer-order model (e.g. "LayerDiffuse"/Qwen-style decomposition as blueprint says) served on Linux GPU worker | Grid + connected-components + saliency (OpenCV) for a coarse 3-layer split (bg/mid/fg) | per-object masks + z-order guess |
| 3. Classify each segment | CLIP zero-shot into {text, photo, icon, illustration, solid shape, gradient} | heuristic: aspect + edge density + color count | `Layer.type` + `confidence` |
| 4. OCR on text segments | PaddleOCR (multilingual, good pt-PT) → `TextRun[]` with bbox/size/color | Tesseract 5 | native editable text layers |
| 5. Font identification | `fontdetect` / typeface-classifier model; match against Google Fonts metrics | nearest by x-height/weight class → generic family + `font_locked:true` | `fonts_detected`, `TextRun.font_family` |
| 6. Vectorization of shapes/icons | `vtracer` (raster→SVG) for flat regions; potrace for monochrome | keep as raster `image` layer with `recolorable:false` | `source.svg` |
| 7. Background removal / matting | `rembg` (u2net) or BiRefNet for hero subjects | GrabCut with the SAM mask as seed | clean subject + separate bg layer |
| 8. Occlusion reconstruction | LaMa (inpainting) to fill regions hidden behind removed foreground layers | leave hole + `is_occlusion_reconstructed:false` + low confidence + `locked:true` | completed lower layers |
| 9. Palette + recolorability | k-means (k=6) in LAB; a layer is `recolorable` if ≤3 dominant colors and flat | mark `recolorable:false` | `palette`, `editable_metadata.recolorable` |
| 10. Assemble + validate | build `LayerManifest`; re-composite layers and SSIM-compare to original (≥0.92 pass) | if SSIM < 0.92, mark manifest `low_fidelity`, keep original as flattened fallback layer | `LayerManifest` |

All GPU steps run on the Linux heavy-execution host via BrowserMesh adapters (blueprint section 11), dispatched as `studio.asset.*` jobs. Each step's model name + version is recorded in `pipeline_version` and `SOURCE_PROVENANCE.md`.

### 8.3 Reverse Design Engine — screenshot → ProjectSpec, step by step

```
INPUT: one or more screenshots (desktop, ideally + mobile) of a site/app the customer likes
  |
  v
[R1] Magic Layers on each screenshot (§8.2)  -> LayerManifest per screenshot
  |
  v
[R2] Layout Inference:
     - cluster layers into horizontal bands (sections) by y-gaps
     - detect a top band with logo+nav  -> navbar
     - detect repeated sibling structures (cards) -> grid/list components
     - detect a large first band with headline+cta+media -> hero
     - detect footer band (links, small text, bottom)  -> footer
     - infer container max-width from content bbox vs artboard
     - infer grid columns from card bbox rhythm
     Output: LayoutTree {bands[], each with role + child blocks + geometry}
  |
  v
[R3] Semantic UI Mapper:
     - map each band role -> component_type + best-fit variant from Component Registry
       (nearest by structural signature: has_image, text_blocks, cta_count, columns)
     - map OCR TextRuns -> spec.content entries (heading/sub/cta/body by size rank + position)
     - map detected images -> asset.* placeholders (role by band: hero/gallery/logo)
     - extract brand tokens: colors from palette (primary = most saturated non-bg accent used on CTAs),
       typography from fonts_detected (heading = largest family, body = most frequent),
       radius from measured corner radii, spacing from measured gaps, shadow from detected soft edges
  |
  v
[R4] ProjectSpec Assembly:
     - project: product_type inferred from structure (landing_page if single long page, etc.)
     - build ui.pages[0] with sections in detected order
     - build ui.components[] with mapped types/variants and content_bindings
     - build brand.* from R3 tokens
     - data/auth/actions/workflows/apis/integrations: EMPTY unless a form is detected
       (a detected form -> one action.* + one model.* stub, both fully inference-marked)
  |
  v
[R5] Inference Marking (ENFORCED):
     EVERY node produced by R2-R4 gets _meta = { status:"inferred", confidence:<from pipeline>,
       source:"reverse_design" }.
     The ProjectSpec JSON Schema rejects the doc if any reverse-design-originated node
     lacks _meta or has confidence outside [0,1]  (requireConfidenceWhenInferred keyword, §1.3).
     Nodes are ONLY flipped to "validated" by an explicit {op:"mark_validated", target} patch,
     which only a Lumenva user (not the client, not an agent) may issue for reverse-design nodes.
  |
  v
OUTPUT: a draft ProjectSpec loaded into the UI Canvas with every inferred node visually flagged
        (amber outline + confidence %); it enters the normal A/B/C or editor flow.
```

**Rule enforcement summary:** inference status is a *schema-required field*, not a convention. `applySpecPatch` refuses to move a node to `status:"validated"` unless the op is `mark_validated` and `actor.type === "user"` and (for `source:"reverse_design"` or `"ai_edit"`) the user has Studio-editor role. A build (Product Factory) **refuses to start** if the approved spec still contains any `status:"inferred"` node (gate in M19: `assertNoUnvalidatedInference(spec)`).

---

## 9. ACCEPTANCE TESTS (given/when/then)

### 9.1 Studio Alpha (blueprint Wave 6 / "Studio Alpha")

```
Feature: Lead to approved design

Scenario: A1 - CRM lead becomes an A/B/C proposal the client approves
  Given a CRM contact "Clínica Sorriso" with a completed briefing (business, 3 services, goal=bookings)
  When the account manager clicks "Generate proposals" in Studio
  Then a studio_projects row is created with status "proposing"
  And within 5 minutes 3 studio_variants (A,B,C) exist, each with a studio_versions spec_version=1
  And all 3 variant specs have byte-identical business.*, goals[], spec.content, data.*, actions[]
  And the 3 variant specs differ in brand.colors AND at least 2 of {typography, spacing, component variants}
  And 9 preview screenshots (3 variants x 3 widths) are stored in studio_assets

Scenario: A2 - Client opens portal and approves variant B
  Given a studio_share_links row scope="approve", not expired, not revoked
  When the client GETs /p/<token>
  Then a portal_sid cookie is set and they land on /s/overview showing 3 cards
  When the client POSTs /s/variant/B/approve
  Then studio_projects.review_state moves awaiting_review -> approved
  And studio_projects.approved_variant_key = "B"
  And an event_log "studio.project.approved" is appended for the right organization_id
  And the CRM Contact 360 timeline shows "Design approved: Variant B"

Scenario: A3 - Tenant isolation on the portal
  Given a valid token for project P in organization O1
  When any /s/* request is made
  Then every DB read/write is executed with request.jwt.claims.organization_id = O1
  And a crafted body field organization_id=O2 is ignored
  And attempting /s/variant/B/approve with a scope="view" link returns 403

Scenario: A4 - Expired / revoked link
  Given a token whose studio_share_links.expires_at is in the past
  When GET /p/<token>
  Then response is 410 Gone, no cookie set, a studio_share_link_hits row result="expired" is written
```

### 9.2 Studio Beta (blueprint "Studio Beta")

```
Feature: Visual + AI editing produces a valid ProjectSpec

Scenario: B1 - Inspector edit emits a valid patch and new version
  Given variant B open in the UI Canvas at spec_version 1
  When the user changes hero heading text in the inspector
  Then a SpecPatch origin="canvas_edit" with one replace op on /content/content.hero.heading/pt-PT is sent
  And applySpecPatch returns ok with new_version 2
  And studio_versions has a row spec_version=2 with a diff.human_summary mentioning the hero heading

Scenario: B2 - AI visual edit becomes a structured patch, not React changes
  Given variant B open
  When the user types "deixa esse hero mais premium" targeting component.hero.main
  Then the model returns ops = [{op:"replace", target:"component.hero.main", field:"visual_style", value:"premium"}, ...token overrides]
  And no file outside the ProjectSpec is modified
  And applySpecPatch returns ok and the preview re-renders with the premium variant

Scenario: B3 - Variant mixing creates D
  Given variants A, B, C exist
  When the client picks navbar=A, hero=C, services=B, footer=A and submits /s/mix
  Then a studio_variants row variant_key="D" origin="mix" is created
  And its spec has component variants/styles copied per-region from A/C/B/A
  And its spec passes checkInvariants and schema validation
  And x_variant.mixed_from records the 4 region->source choices

Scenario: B4 - Responsive override
  Given the canvas breakpoint switcher set to "md"
  When the user changes services grid from 3 to 2 columns
  Then the patch writes /ui/components/component.services.grid/responsive/md/props/columns = 2
  And the base props.columns stays 3
  And previewing at width 1280 shows 3 columns, at 800 shows 2

Scenario: B5 - Concurrency guard
  Given two editors both loaded spec_version 5
  When editor 1's patch (base_spec_version 5) applies -> version 6
  And editor 2 submits a patch with base_spec_version 5
  Then editor 2 gets ok=false errors[0].code="stale_base" and is prompted to reload
```

### 9.3 Product Factory Gamma (blueprint "Product Factory Gamma")

```
Feature: Approved ProjectSpec becomes a running preview

Scenario: G1 - Refuse to build on unvalidated inference
  Given an approved spec containing one node with _meta.status="inferred"
  When the Product Factory build is requested
  Then it fails immediately with "unvalidated inference: <stable_id>" and no repo is created

Scenario: G2 - Full build to preview (dentist booking)
  Given the approved dentist-booking ProjectSpec (variant B, spec_version 7, no inferred nodes)
  When the Product Factory pipeline runs
  Then a customer_projects row (lifecycle=provisioning) and a GitHub repo lumenva-customers/clinica-sorriso are created
  And a BuildPlan is produced with modules covering db, auth(off/public), api.availability, api.appointments, ui pages home/tratamentos/marcar, workflow.booking, seo, analytics
  And the db-generator emits a Drizzle schema with tables services, appointments and an RLS-less public-read policy on services
  And the api-generator emits app/api/availability/route.ts and app/api/appointments/route.ts with zod schemas matching action.appointment.create input_schema
  And the gate chain runs install->typecheck->lint->unit->db->integration->e2e->accessibility->security->visual_qa
  And every blocking gate passes (with <= 15 total repair iterations)
  And a preview URL is deployed and project_releases has a row status="preview"
  And the visual_qa gate confirms the preview matches variant B's approved screenshots and has no horizontal scroll at 375px

Scenario: G3 - Repair loop escalation
  Given a build where the security gate keeps failing (introduced vulnerable dep)
  When repair iterations for the security gate reach per_gate_max (3) and total repairs reach escalate_after (8)
  Then customer_projects.lifecycle = "blocked"
  And an approval/incident is created in Command Center assigned to a human engineer
  And the pipeline stops without deploying

Scenario: G4 - Isolation
  Given a completed Gamma build
  Then the Lumenva DB contains only metadata rows (customer_projects, project_repositories, project_environments, project_resources, project_releases)
  And no column in any of those tables contains a connection string or API key
  And the customer repo, Neon project, and Infisical secret_scope cp_<id> exist and are separate from Lumenva's
```

---

## 10. STUDIO ROADMAP V0–V8 — CONCRETE CONTENTS (blueprint section 18)

| V | Blueprint label | Modules | Ships | Exit gate |
|---|-----------------|---------|-------|-----------|
| V0 | domain | M1, M2 | `studio-spec` package, ProjectSpec type + schema + validators, Stable ID registry, Studio Domain SQL + RLS, repository layer, `event_log` events | `studio_projects` CRUD via API with RLS tests green; ProjectSpec example validates |
| V1 | preview/template | M3, M4, M5, M6 | Patch engine, Briefing intake + compiler, Template + Component Registry + Matcher, `studio-renderer` (ProjectSpec → static preview, responsive) | briefing → BaseProjectSpec → single rendered preview at 3 widths, no console errors, a11y clean |
| V2 | A/B/C | M7 | Design Strategy Generator, Variant Materializer, screenshot pipeline, `studio_variants` | one briefing → 3 variants sharing facts/copy, differing in design; 9 screenshots stored; determinism test passes |
| V3 | client portal | M8, M9, M10 | `apps/client-portal`, opaque-token auth, routes, review state machine, Contact 360 integration | Studio Alpha acceptance (§9.1) all green |
| V4 | editor | M11, M12 | M3E extraction → `studio-canvas` UI Canvas, Inspector, ProjectSpec patches from canvas, undo/redo, responsive editing | B1, B4, B5 (§9.2) green; edit round-trips to a new `studio_versions` row |
| V5 | AI / Create My Own | M13, M14 | NL instruction → validated patch, Create My Own, Variant Mixing | Studio Beta acceptance (§9.2) all green |
| V6 | Magic Layers / Reverse Design | M15, M16, M17, M18 | Asset Canvas, Magic Layers Pipeline + LayerManifest, Reverse Design Engine, Asset Factory ops | screenshot → inference-marked ProjectSpec in canvas; PNG → editable LayerManifest with native text; SSIM ≥ 0.92 recomposite |
| V7 | Product Factory | M19, M20, M21, M22, M23 | BuildPlan + Product Architect Agent, Requirement Resolver, deterministic generators, coding agent tasks + Repair Loop + gate chain, Git Project Factory + isolation, Customer Delivery SQL | Product Factory Gamma acceptance (§9.3) all green |
| V8 | Mobile / Delivery | M24, M25 | Expo/React Native generator, production deploy, domains, monitoring, release management, maintenance loop | approved `website_plus_app` spec → web preview + Expo build artifact; production deploy with health checks + a `project_releases` production row + rollback target recorded |

---

## 11. WAVE MAPPING (blueprint section 17)

- **Wave 6 — Studio Commercial MVP** = V0 + V1 + V2 + V3 = M1–M10. Alpha acceptance §9.1. ~86 ed.
- **Wave 7 — Studio Editor** = V4 + V5 = M11–M14. Beta acceptance §9.2. ~41 ed.
- **Wave 8 — Asset Intelligence** = V6 = M15–M18. ~51 ed.
- **Wave 9 — Product Factory Web** = V7 = M19–M23. Gamma acceptance §9.3. ~61 ed.
- **Wave 10 — Mobile + Delivery** = V8 = M24–M25. ~30 ed.

Cross-wave dependencies already encoded in the §0 table. Wave 6 depends on Wave 1–5 (Operating Core, Agent Runtime, Command Center). Wave 9 additionally depends on Wave 4 (BrowserMesh) for build execution and on the integrations packages (`integrations/github`, `integrations/cloudflare`|`vercel`, `integrations/payments` only if any spec needs it).

---

## 12. DECISIONS LOG (every gap → a decision)

1. ProjectSpec stored as one `jsonb`, versioned append-only in `studio_versions`; tables hold metadata only.
2. Stable IDs: namespaced lowercase-kebab, unique per document across namespaces, deterministically minted, never mutated in place (rename op + alias map).
3. Patch format: RFC-6902 addressed by stable-id→JSON-Pointer, plus `rename_id`, `reorder`, `mark_validated` custom ops.
4. Patch pipeline: optimistic-concurrency → resolve → structural apply → Ajv schema → invariants → Policy Engine (R-level) → semantic diff → append version + event. Coded in §2.3.
5. Inference marking is schema-enforced (`requireConfidenceWhenInferred`), not convention; only a Studio-editor user can validate reverse-design/AI nodes; Product Factory refuses any unvalidated inference.
6. A/B/C: deterministic Design Strategy Generator picks 3 mutually-distant points in an 8-axis design space; Variant Materializer overrides only brand/layout/composition/component-variant fields; everything factual/copy/logic is shared by clone-identity.
7. Client Portal: 32-byte opaque token, sha256-hashed at rest, 4-char non-secret prefix for support, scope enum {view,comment,approve,edit}, 14-day default expiry, per-token + per-IP rate limits, full `event_log` audit, short-lived HMAC session cookie after first hit, service-role server that pins `organization_id` from the resolved link so RLS still applies.
8. Review state machine: `AWAITING_REVIEW→IN_DISCUSSION→CHANGES_REQUESTED→REVISED→APPROVED→HANDED_OFF` (+CANCELLED); client transitions gated by link scope; system/agent own REVISED/HANDED_OFF/reopen/cancel.
9. Two canvases: UI Canvas = sandboxed-iframe `studio-renderer` + overlay + `SpecOp` patches, responsive-first; Asset Canvas = Konva/2D scene graph + `LayerOp`, absolute geometry. Shared version store and comment anchoring.
10. M3E extraction: vendor read-only, `madge`/`depcruise` to isolate model/runtime-free viewport+overlay+inspector, move to `studio-canvas/core` behind a `CanvasHost` interface, two host impls, decision gate on reusable-LOC % (fallback: rebuild from `@dnd-kit`).
11. Magic Layers: SAM 2 + layer-order model → CLIP classify → PaddleOCR → font-id → vtracer/potrace → rembg/BiRefNet → LaMa occlusion → k-means palette → SSIM validate. All named tools have named fallbacks; low-fidelity manifests keep a flattened fallback layer.
12. Reverse Design: Magic Layers → band/layout inference → Semantic UI Mapper (structural nearest-variant) → ProjectSpec assembly with empty data/auth unless a form is detected → every node inference-marked at schema level.
13. Product Factory: Product Architect Agent → BuildPlan (schema in §7.2) → Requirement Resolver (§7.4) → deterministic generators (§7.5, the mechanical 90%) + coding agent tasks (business logic + missing component variants) → Git Project Factory → 10-gate chain → Repair Loop (15 total / 3 per gate / escalate at 8) → preview.
14. Deterministic vs agent: DB, auth, API/route scaffolding, RBAC, SEO, analytics, UI page scaffolding, test scaffolding = deterministic. Business-logic bodies, non-trivial workflow steps, new component variants, gate-failure repairs = agent.
15. Customer Project Isolation: separate GitHub repo, separate Neon project/branch, separate Infisical `secret_scope=cp_<id>`, separate domains/deploy tokens. Lumenva DB = metadata only; no secrets as columns (ADR-021). Frozen `product_factory_default` = Cloudflare + Neon + R2 + Resend; `vercel_supabase` alternative, opt-in.
16. New app `apps/client-portal`; new packages `studio-spec`, `studio-canvas`, `studio-renderer`, `studio-components`, `studio-templates`, `asset-engine`, `project-generator` per blueprint section 16.
17. All Studio/Delivery tables carry `organization_id` + tenant RLS; migrations are new files only (ADR-023).
18. Effort ~326 ed across Waves 6–10; critical path M1→M2→M3→M6→M7→M9→M11→M12→M15→M16→M17→M19→M20→M21→M22→M24→M25.

---

## 13. OPEN ITEMS RESOLVED HERE (from blueprint section 28)

- **Default customer infra profile:** frozen now as `product_factory_default` = Cloudflare Pages/Workers + Neon Postgres + R2 + Resend, decided before Wave 9 as blueprint requires. `vercel_supabase` kept as a selectable non-default profile. Choice lives in `infrastructure.hosting`/`database` (no business semantics, no credentials); adapters in `integrations/{cloudflare,vercel}` hold provider detail.
- **AgentDefinition persistence split:** out of this plane's scope, but Studio's own versioned entities follow the same recommended pattern — keep identity records (`studio_projects`) stable, put the mutable contract (the spec) in versioned rows (`studio_versions`) with FK.
- **Framework boundary:** `studio-renderer` and `studio-canvas` are custom (Lumenva owns spec→UI mapping and canvas editing). Only the coding agents inside Product Factory use provider SDKs, behind BrowserMesh adapters; they never own spec, version, or isolation state.
