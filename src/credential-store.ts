/*
Copyright 2026 Expedia Group, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { randomBytes } from "node:crypto";
import type { StoredCredential } from "./types.js";

const CREDENTIAL_DIR = join(homedir(), ".oc", "credentials");
const CREDENTIAL_PATH = join(CREDENTIAL_DIR, "eg-travel.json");

export function readCredential(): StoredCredential | null {
  let raw: string;
  try {
    raw = readFileSync(CREDENTIAL_PATH, "utf-8");
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `Credential file at ${CREDENTIAL_PATH} is corrupted. Delete it and re-authenticate.`,
    );
  }

  const cred = parsed as Record<string, unknown>;
  if (typeof cred.token !== "string" || typeof cred.tenant_id !== "string") {
    throw new Error(
      `Credential file at ${CREDENTIAL_PATH} has an invalid schema. Delete it and re-authenticate.`,
    );
  }

  return cred as unknown as StoredCredential;
}

export function writeCredential(credential: StoredCredential): void {
  mkdirSync(CREDENTIAL_DIR, { recursive: true, mode: 0o700 });

  const tmpSuffix = randomBytes(4).toString("hex");
  const tmpPath = join(dirname(CREDENTIAL_PATH), `.eg-travel.tmp.${tmpSuffix}`);
  const json = JSON.stringify(credential, null, 2) + "\n";

  writeFileSync(tmpPath, json, { mode: 0o600 });
  renameSync(tmpPath, CREDENTIAL_PATH);
}
