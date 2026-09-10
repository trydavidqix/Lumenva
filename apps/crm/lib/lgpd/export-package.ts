import { createHash } from "node:crypto";

export interface ExportPackageFile {
  path: string;
  content: Uint8Array | string;
}

export interface ExportPackageInput {
  requestId: string;
  organizationId: string;
  generatedAt: string;
  files: ExportPackageFile[];
  signedPades?: boolean;
}

export interface ExportManifest {
  format_version: 1;
  request_id: string;
  organization_id: string;
  generated_at: string;
  provenance: {
    generator: "lumenva-lgpd-export";
    signed_pades: boolean;
    manifest_sha256: string;
  };
  files: Array<{ path: string; size: number; sha256: string }>;
}

export interface ExportPackageResult {
  zip: Buffer;
  manifest: ExportManifest;
  sha256: string;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number): Buffer {
  const out = Buffer.alloc(2);
  out.writeUInt16LE(value, 0);
  return out;
}

function u32(value: number): Buffer {
  const out = Buffer.alloc(4);
  out.writeUInt32LE(value >>> 0, 0);
  return out;
}

/** Builds a dependency-free ZIP (stored entries) with a self-describing manifest. */
export function buildExportPackage(input: ExportPackageInput): ExportPackageResult {
  const files = [...input.files].sort((a, b) => a.path.localeCompare(b.path));
  if (files.some((file) => !file.path || file.path.includes("..") || file.path.startsWith("/"))) {
    throw new Error("Export package paths must be relative and traversal-free");
  }
  const entries = files.map((file) => {
    const content = Buffer.from(file.content);
    return { path: file.path, content, sha256: createHash("sha256").update(content).digest("hex") };
  });
  const manifestBase = {
    format_version: 1 as const,
    request_id: input.requestId,
    organization_id: input.organizationId,
    generated_at: input.generatedAt,
    files: entries.map(({ path, content, sha256 }) => ({ path, size: content.length, sha256 })),
  };
  const manifestHash = createHash("sha256").update(JSON.stringify(manifestBase)).digest("hex");
  const manifest: ExportManifest = {
    ...manifestBase,
    provenance: {
      generator: "lumenva-lgpd-export",
      signed_pades: input.signedPades === true,
      manifest_sha256: manifestHash,
    },
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  entries.push({ path: "manifest.json", content: manifestBytes, sha256: createHash("sha256").update(manifestBytes).digest("hex") });

  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.path);
    const crc = crc32(entry.content);
    const header = Buffer.concat([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(entry.content.length), u32(entry.content.length), u16(name.length), u16(0), name]);
    local.push(header, entry.content);
    central.push(Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(entry.content.length), u32(entry.content.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
    offset += header.length + entry.content.length;
  }
  const centralBytes = Buffer.concat(central);
  const zip = Buffer.concat([...local, centralBytes, Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(centralBytes.length), u32(offset), u16(0)])]);
  return { zip, manifest, sha256: createHash("sha256").update(zip).digest("hex") };
}
