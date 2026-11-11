import { createHash } from "node:crypto";

/** DNS namespace from RFC 4122. Demo ids are namespaced under "kir.ai:" so they don't collide with other names. */
const UUID_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

function bytesFromUuid(uuid: string): Buffer {
  const hex = uuid.replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(hex)) {
    throw new Error(`Not a UUID: ${uuid}`);
  }
  return Buffer.from(hex, "hex");
}

/** UUID version 5 (SHA-1) for `name` in `namespace`. */
export function uuidV5(name: string, namespace: string): string {
  const hash = createHash("sha1").update(bytesFromUuid(namespace)).update(name).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Stable primary key for one sample-data slug, such as "prop-lakeview". */
export function demoId(name: string): string {
  return uuidV5(`kir.ai:${name}`, UUID_NAMESPACE);
}
