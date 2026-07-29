/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Ensure the verbatim soul file ships inside the serverless bundle.
    outputFileTracingIncludes: {
      "/api/chat": ["./soul/**"],
    },
  },
  headers: async () => [
    {
      source: "/:path*",
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    },
  ],
};

export default nextConfig;
