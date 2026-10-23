import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(fileURLToPath(new URL("../_site/", import.meta.url)));
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".xml": "application/xml",
  ".txt": "text/plain",
};
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (!url.pathname.startsWith("/attend/")) {
        res.writeHead(302, { Location: "/attend/" });
        res.end();
        return;
      }
      let relative = decodeURIComponent(url.pathname.slice("/attend/".length));
      if (!relative || relative.endsWith("/")) relative += "index.html";
      const target = path.resolve(root, relative);
      if (!target.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const buffer = await fs.readFile(target);
      res.writeHead(200, {
        "Content-Type": types[path.extname(target)] || "application/octet-stream",
      });
      res.end(buffer);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(5187, "127.0.0.1", () => console.log("Preview: http://127.0.0.1:5187/attend/"));
