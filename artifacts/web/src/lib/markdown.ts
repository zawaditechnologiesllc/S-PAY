/**
 * Minimal, safe Markdown → HTML for blog bodies. All HTML is escaped first, then
 * only a known tag set is emitted; links are restricted to http(s) or
 * same-origin relative paths (protocol-relative "//host" links are rejected) — so
 * AI-generated content can never inject scripts, styles, or event handlers. The
 * result is safe to pass to dangerouslySetInnerHTML. (Mirrors the server-side
 * renderer in routes/ssr.ts so SSR and SPA output match.)
 */
export function mdToHtml(md: string): string {
  const escAll = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    escAll(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/(?!\/)[^\s)]*)\)/g, '<a href="$2" rel="noopener">$1</a>');
  const lines = (md ?? "").replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  let para: string[] = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushPara(); closeList(); continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flushPara(); closeList(); const lvl = Math.min(h[1].length, 6); out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { flushPara(); closeList(); out.push("<hr/>"); continue; }
    const ul = line.match(/^[-*]\s+(.*)$/);
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ul) { flushPara(); if (list !== "ul") { closeList(); out.push("<ul>"); list = "ul"; } out.push(`<li>${inline(ul[1])}</li>`); continue; }
    if (ol) { flushPara(); if (list !== "ol") { closeList(); out.push("<ol>"); list = "ol"; } out.push(`<li>${inline(ol[1])}</li>`); continue; }
    const bq = line.match(/^>\s?(.*)$/);
    if (bq) { flushPara(); closeList(); out.push(`<blockquote>${inline(bq[1])}</blockquote>`); continue; }
    closeList(); para.push(line);
  }
  flushPara(); closeList();
  return out.join("\n");
}
