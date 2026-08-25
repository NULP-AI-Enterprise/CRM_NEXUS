import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: { ignoreBuildErrors: true },
  // OAuth discovery (RFC 8414 / RFC 9728) requires these exact paths.
  // Routed through normally-named handlers under src/app/api/well-known/
  // rather than a literal `app/.well-known/` directory, since dot-prefixed
  // route segments aren't a documented, confirmed-safe App Router pattern.
  async rewrites() {
    return [
      {
        source: "/.well-known/oauth-authorization-server",
        destination: "/api/well-known/oauth-authorization-server",
      },
      {
        source: "/.well-known/oauth-protected-resource",
        destination: "/api/well-known/oauth-protected-resource",
      },
    ];
  },
};

export default nextConfig;
