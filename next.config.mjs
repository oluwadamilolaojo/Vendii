/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // The blank registrar PDFs are read from disk at request time, so ship them with the functions.
    outputFileTracingIncludes: {
      "/api/forms": ["./lib/forms/pdf/**"],
      "/api/forms/filing/[id]": ["./lib/forms/pdf/**"],
    },
  },
};
export default nextConfig;
