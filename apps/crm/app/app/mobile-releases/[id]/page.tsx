import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { createMobileComplianceReadModel } from "@/lib/product-factory/mobile-compliance/read-model";
import { createSupabaseMobileComplianceRepository } from "@/lib/product-factory/mobile-compliance/supabase-read-repository";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function MobileReleaseDetailPage({ params }: PageProps) {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (!user.is_platform_admin && ROLE_RANK[activeOrg.role] < ROLE_RANK.manager) {
    redirect("/403");
  }

  const reportId = decodeURIComponent((await params).id);
  const readModel = createMobileComplianceReadModel(
    createSupabaseMobileComplianceRepository(),
  );
  const result = await readModel.getReport(activeOrg.orgId, reportId);
  if (!result) notFound();

  const { report, findings } = result;

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header className="space-y-2">
        <Link className="text-sm text-muted-foreground hover:underline" href="/app/mobile-releases">
          ← Mobile Releases
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{report.projectId}</h1>
          <p className="text-sm text-muted-foreground">
            {report.store} · {report.platform} · build {report.buildRef}
          </p>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4" aria-label="Proveniência do relatório">
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Resultado</p>
          <p className="mt-1 font-medium">{report.verdict}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Policy</p>
          <p className="mt-1 font-mono text-xs break-all">{report.policyVersion}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Artifact hash</p>
          <p className="mt-1 font-mono text-xs break-all">{report.artifactHash}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Evidências</p>
          <p className="mt-1 font-medium">{report.evidenceRefs.length}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border">
        <div className="border-b px-4 py-3">
          <h2 className="font-medium">Achados normalizados</h2>
        </div>
        {findings.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Nenhum achado para este build.</div>
        ) : (
          <div className="divide-y">
            {findings.map((finding) => (
              <article className="space-y-2 p-4" key={finding.fingerprint}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{finding.title}</span>
                  <span className="rounded border px-2 py-0.5 text-xs">{finding.severity}</span>
                  <span className="rounded border px-2 py-0.5 text-xs">{finding.verification}</span>
                  <span className="rounded border px-2 py-0.5 text-xs">{finding.source}</span>
                </div>
                <p className="text-sm text-muted-foreground">{finding.description}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {finding.ruleId} · {finding.resource}{finding.line ? `:${finding.line}` : ""}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
