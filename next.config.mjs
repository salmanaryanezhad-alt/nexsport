/** @type {import('next').NextConfig} */
const isExport = process.env.NEXT_EXPORT === "true";

const nextConfig = {
  ...(isExport
    ? { output: "export" }
    : {
        async headers() {
          return [
            {
              source: "/:path*",
              headers: [
                {
                  key: "X-Robots-Tag",
                  value: "noindex, nofollow, noarchive",
                },
              ],
            },
          ];
        },
      }),
  reactStrictMode: true,
  trailingSlash: true,
};

export default nextConfig;
