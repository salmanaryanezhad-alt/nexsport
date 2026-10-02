import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const isServerExport = process.env.NEXT_EXPORT === "true";
  const sitemap = `${process.env.NEXT_PUBLIC_SITE_URL || "https://nexsport.ir"}/sitemap.xml`;

  if (!isServerExport) {
    return {
      rules: {
        userAgent: "*",
        disallow: ["/", "/t/", "/r/", "/teams/", "/api/"],
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/planner", "/planner/"],
      disallow: ["/t/", "/r/", "/teams/", "/teams", "/api/"],
    },
    sitemap,
  };
}
