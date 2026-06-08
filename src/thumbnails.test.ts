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

import { describe, expect, it } from "vitest";
import { upgradeThumbnailUrl } from "./thumbnails.js";

describe("upgradeThumbnailUrl", () => {
  it("upgrades _t.jpg to _y.jpg by default", () => {
    const url = "https://images.trvl-media.com/lodging/12345678/abc123_t.jpg";
    expect(upgradeThumbnailUrl(url)).toBe(
      "https://images.trvl-media.com/lodging/12345678/abc123_y.jpg",
    );
  });

  it("upgrades _t.jpeg to _y.jpeg", () => {
    const url = "https://images.trvl-media.com/lodging/12345678/abc123_t.jpeg";
    expect(upgradeThumbnailUrl(url)).toBe(
      "https://images.trvl-media.com/lodging/12345678/abc123_y.jpeg",
    );
  });

  it("upgrades _t.png to _y.png", () => {
    const url = "https://images.trvl-media.com/lodging/12345678/abc123_t.png";
    expect(upgradeThumbnailUrl(url)).toBe(
      "https://images.trvl-media.com/lodging/12345678/abc123_y.png",
    );
  });

  it("upgrades _t.webp to _y.webp", () => {
    const url = "https://images.trvl-media.com/lodging/12345678/abc123_t.webp";
    expect(upgradeThumbnailUrl(url)).toBe(
      "https://images.trvl-media.com/lodging/12345678/abc123_y.webp",
    );
  });

  it("accepts a custom target suffix", () => {
    const url = "https://images.trvl-media.com/lodging/12345678/abc123_t.jpg";
    expect(upgradeThumbnailUrl(url, "_z")).toBe(
      "https://images.trvl-media.com/lodging/12345678/abc123_z.jpg",
    );
  });

  it("upgrades _s suffix as well", () => {
    const url = "https://images.trvl-media.com/lodging/12345678/abc123_s.jpg";
    expect(upgradeThumbnailUrl(url)).toBe(
      "https://images.trvl-media.com/lodging/12345678/abc123_y.jpg",
    );
  });

  it("returns the URL unchanged if suffix does not match the pattern", () => {
    const url = "https://images.trvl-media.com/lodging/12345678/abc123.jpg";
    expect(upgradeThumbnailUrl(url)).toBe(url);
  });

  it("returns a non-CDN URL unchanged", () => {
    const url = "https://example.com/photo.jpg";
    expect(upgradeThumbnailUrl(url)).toBe(url);
  });

  it("is case-insensitive on the suffix", () => {
    const url = "https://images.trvl-media.com/lodging/12345678/abc123_T.JPG";
    expect(upgradeThumbnailUrl(url)).toBe(
      "https://images.trvl-media.com/lodging/12345678/abc123_y.JPG",
    );
  });
});
