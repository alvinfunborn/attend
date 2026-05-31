const sid = process.argv[2];
const base = process.argv[3] || "http://127.0.0.1:5099";
const res = await fetch(`${base}/chat/stream?session=${encodeURIComponent(sid)}`);
const reader = res.body.getReader();
const dec = new TextDecoder();
const timer = setTimeout(() => {
  console.log("-- timeout (stream still open) --");
  process.exit(0);
}, 10000);
let buf = "";
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buf += dec.decode(value, { stream: true });
  process.stdout.write(dec.decode(value, { stream: true }));
}
clearTimeout(timer);
console.log("\n-- stream ended --");
void buf;
