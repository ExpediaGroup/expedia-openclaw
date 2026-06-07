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

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "./logger.js";

describe("logger", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    delete process.env.EG_TRAVEL_LOG_LEVEL;
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    delete process.env.EG_TRAVEL_LOG_LEVEL;
  });

  it("emits structured JSON to stdout for info", () => {
    logger.info("test message", { foo: "bar" });

    expect(stdoutSpy).toHaveBeenCalledOnce();
    const line = stdoutSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line.trim());
    expect(parsed.level).toBe("info");
    expect(parsed.msg).toBe("test message");
    expect(parsed.plugin).toBe("eg-travel");
    expect(parsed.foo).toBe("bar");
    expect(parsed.ts).toBeTruthy();
  });

  it("emits to stderr for error level", () => {
    logger.error("bad thing");

    expect(stderrSpy).toHaveBeenCalledOnce();
    const parsed = JSON.parse((stderrSpy.mock.calls[0][0] as string).trim());
    expect(parsed.level).toBe("error");
  });

  it("respects EG_TRAVEL_LOG_LEVEL=warn", () => {
    process.env.EG_TRAVEL_LOG_LEVEL = "warn";

    logger.info("should be suppressed");
    logger.warn("should appear");

    expect(stdoutSpy).toHaveBeenCalledOnce();
    const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
    expect(parsed.level).toBe("warn");
  });

  it("suppresses debug by default", () => {
    logger.debug("hidden");
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it("shows debug when level is debug", () => {
    process.env.EG_TRAVEL_LOG_LEVEL = "debug";

    logger.debug("visible");

    expect(stdoutSpy).toHaveBeenCalledOnce();
    const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
    expect(parsed.level).toBe("debug");
  });
});
