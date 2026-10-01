import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const isServerExport = process.env.NEXT_EXPORT === "true";
  const sitemap = `${process.env.NEXT_PUBLIC_SITE_URL || "https://nexsport.ir"}/sitemap.xml`;

  if (!isServerExport) {
    return {
      rules: {
        userAgent: "*",
        disallow: ["/", "/t/", "/api/"],
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/t/", "/api/"],
    },
    sitemap,
  };
}
