export type StripeListObject = { lookup_key?: unknown; currency?: unknown; unit_amount?: unknown; recurring?: { interval?: unknown } | null };
export type StripeCatalogExpectation = { planSlug: string; productLookupKey: string; priceLookupKey: string; amountCents: number; currency: string; interval: string };
export function parseStripeListJson(raw: string, kind: string): StripeListObject[] {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("Stripe CLI " + kind + " output is not valid JSON"); }
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { data?: unknown }).data)) throw new Error("Stripe CLI " + kind + " output has no data array");
  return (parsed as { data: unknown[] }).data.filter((v): v is StripeListObject => !!v && typeof v === "object");
}
export function verifyStripeCatalog(a: string, b: string, e: readonly StripeCatalogExpectation[]) {
  const ps=parseStripeListJson(a,"products"), qs=parseStripeListJson(b,"prices"), errors:string[]=[];
  const plans=e.map(x=>{ const productFound=ps.some(p=>p.lookup_key===x.productLookupKey); const price=qs.find(p=>p.lookup_key===x.priceLookupKey); const priceFound=!!price; if(!productFound) errors.push(x.planSlug+": Product lookup_key ausente"); if(!priceFound) errors.push(x.planSlug+": Price lookup_key ausente"); if(price&&price.currency!==x.currency) errors.push(x.planSlug+": currency divergente"); if(price&&price.unit_amount!==x.amountCents) errors.push(x.planSlug+": amount divergente"); if(price&&price.recurring?.interval!==x.interval) errors.push(x.planSlug+": interval divergente"); return {planSlug:x.planSlug,productFound,priceFound,amountCents:price?.unit_amount as number|undefined}; });
  return {ok:errors.length===0,plans,errors};
}
