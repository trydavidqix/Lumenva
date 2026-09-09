import type { DistributionProvider } from "@/lib/content-os/providers/distribution";
import {
  executePublicationJob,
  type PublicationDb,
  type PublicationJob,
} from "@/lib/content-os/distribution/publication-service";

/** Provider-agnostic worker step; queue claiming stays with the existing worker. */
export async function processPublicationJob(
  db: PublicationDb,
  provider: DistributionProvider,
  job: PublicationJob,
): Promise<PublicationJob> {
  return executePublicationJob(db, provider, job);
}
