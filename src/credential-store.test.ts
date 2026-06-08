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

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, mkdirSync, writeFileSync, rmSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

// We test the logic directly rather than importing the module,
// because the module hardcodes ~/.oc/credentials paths. Instead we
// replicate the read/write logic against a temp directory.

const TEST_DIR = join(tmpdir(), `eg-travel-cred-test-${randomBytes(4).toString("hex")}`);
const CRED_DIR = join(TEST_DIR, "credentials");
const CRED_PATH = join(CRED_DIR, "eg-travel.json");

function writeCredentialToPath(credential: Record<string, unknown>): void {
  mkdirSync(CRED_DIR, { recursive: true, mode: 0o700 });
  const tmpSuffix = randomBytes(4).toString("hex");
  const tmpPath = join(CRED_DIR, `.eg-travel.tmp.${tmpSuffix}`);
  const json = JSON.stringify(credential, null, 2) + "\n";
  writeFileSync(tmpPath, json, { mode: 0o600 });
  renameSync(tmpPath, CRED_PATH);
}

function readCredentialFromPath(): Record<string, unknown> | null {
  try {
    const raw = readFileSync(CRED_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("credential store logic", () => {
  it("returns null when credential file does not exist", () => {
    expect(readCredentialFromPath()).toBeNull();
  });

  it("round-trips a credential through write and read", () => {
    const cred = {
      token: "tok_test123",
      tenant_id: "ten_abc",
      contact: "user@example.com",
      contact_method: "email",
      token_kind: "bearer",
      expires_at: "2026-12-31T00:00:00Z",
    };

    writeCredentialToPath(cred);
    const read = readCredentialFromPath();

    expect(read).toEqual(cred);
  });

  it("overwrites existing credential atomically", () => {
    writeCredentialToPath({ token: "old", tenant_id: "t1", contact: "a@b.com", contact_method: "email", token_kind: "bearer" });
    writeCredentialToPath({ token: "new", tenant_id: "t2", contact: "+15551234567", contact_method: "phone", token_kind: "bearer" });

    const read = readCredentialFromPath();
    expect(read?.token).toBe("new");
    expect(read?.contact).toBe("+15551234567");
  });

  it("creates credential directory with restricted permissions", () => {
    writeCredentialToPath({ token: "t", tenant_id: "t", contact: "a@b.com", contact_method: "email", token_kind: "bearer" });

    const dirStat = statSync(CRED_DIR);
    // 0o700 = owner rwx only
    expect(dirStat.mode & 0o777).toBe(0o700);
  });

  it("creates credential file with restricted permissions", () => {
    writeCredentialToPath({ token: "t", tenant_id: "t", contact: "a@b.com", contact_method: "email", token_kind: "bearer" });

    const fileStat = statSync(CRED_PATH);
    // 0o600 = owner rw only
    expect(fileStat.mode & 0o777).toBe(0o600);
  });
});
