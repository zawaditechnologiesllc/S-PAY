import { useEffect } from "react";

/**
 * Per-page SEO for the SPA: title, meta description, canonical, robots and an
 * optional JSON-LD block, restored on unmount. Crawlers also get a
 * server-rendered twin of public pages (see api-server routes/ssr.ts); this
 * keeps the client render identical for JS-executing crawlers and link previews.
 */
export function usePageMeta(opts: {
  title: string;
  description: string;
  canonical?: string;
  noindex?: boolean;
  jsonLd?: object[];
}): void {
  const { title, description, canonical, noindex, jsonLd } = opts;
  const ld = jsonLd ? JSON.stringify(jsonLd) : "";

  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    const upsert = (selector: string, create: () => HTMLElement): HTMLElement =>
      (document.head.querySelector(selector) as HTMLElement | null) ?? (() => {
        const el = create();
        el.dataset.pageMeta = "1";
        document.head.appendChild(el);
        return el;
      })();
    const attr = (el: HTMLElement, name: string, value: string) => {
      const prev = el.getAttribute(name);
      el.setAttribute(name, value);
      return () => { if (el.dataset.pageMeta) el.remove(); else if (prev !== null) el.setAttribute(name, prev); };
    };

    const restores: (() => void)[] = [];
    const meta = (name: string) => upsert(`meta[name="${name}"]`, () => { const m = document.createElement("meta"); m.setAttribute("name", name); return m; });
    const og = (prop: string) => upsert(`meta[property="${prop}"]`, () => { const m = document.createElement("meta"); m.setAttribute("property", prop); return m; });

    restores.push(attr(meta("description"), "content", description));
    restores.push(attr(og("og:title"), "content", title));
    restores.push(attr(og("og:description"), "content", description));
    restores.push(attr(meta("robots"), "content", noindex ? "noindex, nofollow" : "index, follow"));
    if (canonical) {
      const link = upsert('link[rel="canonical"]', () => { const l = document.createElement("link"); l.setAttribute("rel", "canonical"); return l; });
      restores.push(attr(link, "href", canonical));
      restores.push(attr(og("og:url"), "content", canonical));
    }
    let script: HTMLScriptElement | null = null;
    if (ld) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.textContent = ld;
      document.head.appendChild(script);
    }
    return () => {
      document.title = prevTitle;
      restores.reverse().forEach((r) => r());
      script?.remove();
    };
  }, [title, description, canonical, noindex, ld]);
}
