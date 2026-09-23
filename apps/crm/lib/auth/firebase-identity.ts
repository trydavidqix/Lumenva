/**
 * Firebase session -> canonical internal identity.
 *
 * Firebase is the authentication authority. The service-role client is used
 * only for this server-side identity lookup because the mapping table is not
 * exposed to end users. Every lookup is constrained by the verified Firebase
 * UID; this client must not be reused for tenant business data.
 */
import { getServerSession } from "@/lib/firebase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export interface FirebaseIdentity {
  firebaseUid: string;
  userId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  userMetadata: Record<string, unknown>;
  appMetadata: Record<string, unknown>;
}

/**
 * Returns null for both absent and unmapped sessions: callers must not reveal
 * whether a Firebase UID exists in the internal mapping table.
 */
export async function resolveFirebaseIdentity(): Promise<FirebaseIdentity | null> {
  const session = await getServerSession();
  if (!session?.uid) return null;

  const { data, error } = await createAdminClient()
    .from("identity_user_mappings")
    .select("user_id, active")
    .eq("firebase_uid", session.uid)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    logger.error("[auth] Firebase identity mapping failed", {
      code: error.code,
      message: error.message,
    });
    throw new Error("auth_permissions_unavailable: identidade não pôde ser resolvida.");
  }

  if (!data?.user_id) return null;

  const fullName = typeof session.name === "string" ? session.name : null;
  const avatarUrl = typeof session.picture === "string" ? session.picture : null;

  return {
    firebaseUid: session.uid,
    userId: data.user_id,
    email: typeof session.email === "string" ? session.email : "",
    fullName,
    avatarUrl,
    userMetadata: { full_name: fullName, avatar_url: avatarUrl },
    appMetadata: {},
  };
}
