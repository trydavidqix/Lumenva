import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { createMobileComplianceReadModel } from "@/lib/product-factory/mobile-compliance/read-model";
import { createSupabaseMobileComplianceRepository } from "@/lib/product-factory/mobile-compliance/supabase-read-repository";

export const dynamic = "force-dynamic";

function verdictLabel(verdict: string): string {
  if (verdict === "PASS") return "Aprovado";
  if (verdict === "PASS_WITH_WARNINGS") return "Aprovado com avisos";
  if (verdict === "BLOCK") return "Bloqueado";
  return "Revisão necessária";
}

export default async function MobileReleasesPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (!user.is_platform_admin && ROLE_RANK[activeOrg.role] < ROLE_RANK.manager) {
    redirect("/403");
  }

  const readModel = createMobileComplianceReadModel(
    createSupabaseMobileComplianceRepository(),
  );
  const reports = await readModel.listReports(activeOrg.orgId, { limit: 100 });
  const blocked = reports.filter((report) => report.verdict === "BLOCK").length;
  const review = reports.filter((report) => report.verdict === "NEEDS_REVIEW").length;
  const ready = reports.length - blocked - review;

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Mobile Releases</h1>
        <p className="text-sm text-muted-foreground">
          Evidências de conformidade ligadas ao build antes de publicar na App Store ou Play Store.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-3" aria-label="Resumo das releases móveis">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Prontas</p>
          <p className="mt-1 text-2xl font-semibold">{ready}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Revisão necessária</p>
          <p className="mt-1 text-2xl font-semibold">{review}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Bloqueadas</p>
          <p className="mt-1 text-2xl font-semibold">{blocked}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border">
        <div className="border-b px-4 py-3">
          <h2 className="font-medium">Relatórios recentes</h2>
        </div>
        {reports.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            Nenhuma auditoria mobile foi registrada ainda. O primeiro release-check aparecerá aqui.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Projeto</th>
                  <th className="px-4 py-3 font-medium">Store</th>
                  <th className="px-4 py-3 font-medium">Build</th>
                  <th className="px-4 py-3 font-medium">Resultado</th>
                  <th className="px-4 py-3 font-medium">Achados</th>
                  <th className="px-4 py-3 font-medium">Criado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reports.map((report) => (
                  <tr key={report.reportId}>
                    <td className="px-4 py-3 font-medium">
                      <Link className="hover:underline" href={`/app/mobile-releases/${encodeURIComponent(report.reportId)}`}>
                        {report.projectId}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{report.store}</td>
                    <td className="px-4 py-3 font-mono text-xs">{report.buildRef}</td>
                    <td className="px-4 py-3">{verdictLabel(report.verdict)}</td>
                    <td className="px-4 py-3">
                      {report.criticalCount + report.highCount + report.mediumCount + report.lowCount}
                    </td>
                    <td className="px-4 py-3">{new Date(report.createdAt).toLocaleString("pt-PT")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
