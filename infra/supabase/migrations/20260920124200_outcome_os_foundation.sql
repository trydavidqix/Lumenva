-- Migration: Outcome OS Foundation
-- Date: 2026-09-20

-- 1. outcome_definitions
CREATE TABLE public.outcome_definitions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL, -- references public.organizations(id) if exists
    name text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.outcome_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read for users in org" ON public.outcome_definitions FOR SELECT USING (true); -- Placeholder RLS
CREATE POLICY "Enable all for users in org" ON public.outcome_definitions FOR ALL USING (true);

-- 2. result_contracts
CREATE TABLE public.result_contracts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL,
    outcome_definition_id uuid NOT NULL REFERENCES public.outcome_definitions(id),
    terms jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.result_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for users in org" ON public.result_contracts FOR ALL USING (true);

-- 3. work_items
CREATE TABLE public.work_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL,
    result_contract_id uuid REFERENCES public.result_contracts(id),
    status text NOT NULL DEFAULT 'pending',
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for users in org" ON public.work_items FOR ALL USING (true);

-- 4. outcome_instances
CREATE TABLE public.outcome_instances (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL,
    outcome_definition_id uuid NOT NULL REFERENCES public.outcome_definitions(id),
    status text NOT NULL DEFAULT 'initiated',
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.outcome_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for users in org" ON public.outcome_instances FOR ALL USING (true);

-- 5. outcome_evidence
CREATE TABLE public.outcome_evidence (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL,
    outcome_instance_id uuid NOT NULL REFERENCES public.outcome_instances(id),
    evidence_type text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.outcome_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for users in org" ON public.outcome_evidence FOR ALL USING (true);

-- 6. outcome_verifications
CREATE TABLE public.outcome_verifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL,
    outcome_instance_id uuid NOT NULL REFERENCES public.outcome_instances(id),
    verifier_name text NOT NULL,
    status text NOT NULL, -- 'verified', 'rejected', 'needs_human'
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.outcome_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for users in org" ON public.outcome_verifications FOR ALL USING (true);

-- 7. cost_ledger
CREATE TABLE public.cost_ledger (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL,
    outcome_instance_id uuid REFERENCES public.outcome_instances(id),
    amount numeric NOT NULL,
    currency text NOT NULL DEFAULT 'USD',
    description text,
    created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.cost_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for users in org" ON public.cost_ledger FOR ALL USING (true);

-- 8. outcome_prices
CREATE TABLE public.outcome_prices (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL,
    outcome_definition_id uuid NOT NULL REFERENCES public.outcome_definitions(id),
    price numeric NOT NULL,
    currency text NOT NULL DEFAULT 'USD',
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.outcome_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for users in org" ON public.outcome_prices FOR ALL USING (true);

-- 9. billing_ledger
CREATE TABLE public.billing_ledger (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL,
    outcome_instance_id uuid REFERENCES public.outcome_instances(id),
    amount numeric NOT NULL,
    currency text NOT NULL DEFAULT 'USD',
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.billing_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for users in org" ON public.billing_ledger FOR ALL USING (true);

-- 10. outcome_reversals
CREATE TABLE public.outcome_reversals (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL,
    outcome_instance_id uuid NOT NULL REFERENCES public.outcome_instances(id),
    reason text NOT NULL,
    status text NOT NULL DEFAULT 'requested',
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.outcome_reversals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for users in org" ON public.outcome_reversals FOR ALL USING (true);

-- 11. outcome_disputes
CREATE TABLE public.outcome_disputes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL,
    outcome_instance_id uuid NOT NULL REFERENCES public.outcome_instances(id),
    reason text NOT NULL,
    status text NOT NULL DEFAULT 'open',
    resolution text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.outcome_disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for users in org" ON public.outcome_disputes FOR ALL USING (true);
