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

export interface ToolTextContent {
  type: "text";
  text: string;
}

export interface ToolResult {
  content: ToolTextContent[];
  details?: unknown;
}

export function toolTextResult(text: string, details?: unknown): ToolResult {
  return {
    content: [{ type: "text", text }],
    ...(details !== undefined && { details }),
  };
}

export function toolJsonResult(payload: unknown): ToolResult {
  const json = JSON.stringify(payload, null, 2);
  return {
    content: [{ type: "text", text: json }],
    details: payload,
  };
}
