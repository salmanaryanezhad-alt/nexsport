/** @type {import('next').NextConfig} */
const isExport = process.env.NEXT_EXPORT === "true";

const nextConfig = {
  ...(isExport ? { output: "export" } : {}),
  reactStrictMode: true,
  trailingSlash: true,
};

export default nextConfig;
