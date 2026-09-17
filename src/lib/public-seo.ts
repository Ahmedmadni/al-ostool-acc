export const PUBLIC_SITE_URL = "https://al-ostool-acc.lovable.app";
export const PUBLIC_OG_IMAGE = `${PUBLIC_SITE_URL}/images/group/holding-hero-v1.webp`;

type PublicSeoOptions = {
  title: string;
  description: string;
  path?: string;
  type?: "website" | "article";
  schema?: Record<string, unknown>;
};

export function publicSeo({ title, description, path = "/", type = "website", schema }: PublicSeoOptions) {
  const canonical = `${PUBLIC_SITE_URL}${path === "/" ? "" : path}`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: type },
      { property: "og:url", content: canonical },
      { property: "og:site_name", content: "Al-Ostool Al-Ali Group" },
      { property: "og:locale", content: "en_SA" },
      { property: "og:locale:alternate", content: "ar_SA" },
      { property: "og:image", content: PUBLIC_OG_IMAGE },
      { property: "og:image:width", content: "1600" },
      { property: "og:image:height", content: "900" },
      { property: "og:image:alt", content: "Al-Ostool Al-Ali Group field operations" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: PUBLIC_OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: canonical }],
    scripts: schema ? [{ type: "application/ld+json", children: JSON.stringify({ "@context": "https://schema.org", ...schema }) }] : [],
  };
}
