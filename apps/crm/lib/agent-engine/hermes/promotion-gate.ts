export type HermesPromotionActor =
  | { kind: 'human'; userId: string }
  | { kind: 'system'; authority: 'promotion_engine'; policyEvidenceRef: string }
  | { kind: 'model'; modelId: string };

export function assertHermesPromotionAuthority(actor: HermesPromotionActor): void {
  if (actor.kind === 'model') throw new Error('hermes_model_cannot_promote');
  if (actor.kind === 'human' && !actor.userId.trim()) throw new Error('hermes_promotion_actor_invalid');
  if (actor.kind === 'system' && (!actor.policyEvidenceRef.trim() || actor.authority !== 'promotion_engine')) {
    throw new Error('hermes_promotion_actor_invalid');
  }
}

export function canHermesActivateCandidate(actor: HermesPromotionActor): boolean {
  assertHermesPromotionAuthority(actor);
  return actor.kind === 'human' || actor.kind === 'system';
}
