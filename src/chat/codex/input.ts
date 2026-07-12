import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ChatAttachment, ImageAttachment } from "../driver.js";

export interface PreparedCodexInput {
  prompt: string;
  imagePaths: string[];
  cleanup(): void;
}

function sanitizeAttachmentName(name: string): string {
  const base = path.basename(name).trim();
  return base.replace(/[^A-Za-z0-9._-]+/g, "-") || "attachment";
}

function imageExt(mediaType: ImageAttachment["mediaType"]): string {
  if (mediaType === "image/jpeg") return ".jpg";
  if (mediaType === "image/gif") return ".gif";
  if (mediaType === "image/webp") return ".webp";
  return ".png";
}

function appendBlock(prompt: string, lines: string[]): string {
  const block = lines.join("\n");
  return prompt ? `${prompt}\n\n${block}` : block;
}

/** Materialize Attend attachments into inputs accepted by both Codex transports. */
export function prepareCodexInput(
  promptText: string,
  attachments: ChatAttachment[] = [],
): PreparedCodexInput {
  let prompt = promptText;
  const imagePaths: string[] = [];
  let tempDir: string | null = null;
  let fileCount = 0;
  const cleanup = () => {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  };

  for (const attachment of attachments) {
    if (attachment.kind === "text") {
      prompt = appendBlock(prompt, [`[Attached text: ${attachment.name}]`, attachment.text]);
      continue;
    }
    if (attachment.kind === "document") {
      cleanup();
      throw new Error("Codex chat does not support PDF attachments");
    }
    if (!tempDir) tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-codex-"));
    fileCount++;
    if (attachment.kind === "file") {
      const file = path.join(
        tempDir,
        `${String(fileCount).padStart(2, "0")}-${sanitizeAttachmentName(attachment.name)}`,
      );
      fs.writeFileSync(file, Buffer.from(attachment.data, "base64"));
      prompt = appendBlock(prompt, [
        `[Attached file: ${attachment.name}]`,
        `MIME type: ${attachment.mediaType}`,
        `Local path: ${file}`,
        "Read this file from the local path when you need its contents.",
      ]);
      continue;
    }
    const file = path.join(
      tempDir,
      `${String(fileCount).padStart(2, "0")}-${sanitizeAttachmentName(attachment.name)}${imageExt(attachment.mediaType)}`,
    );
    fs.writeFileSync(file, Buffer.from(attachment.data, "base64"));
    imagePaths.push(file);
  }

  return { prompt, imagePaths, cleanup };
}
