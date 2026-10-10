/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output standalone server bundle for Linux/Docker production containers.
  // In local Windows dev/build, Windows symlink permission restrictions (EPERM)
  // are skipped unless explicitly triggered with DOCKER_BUILD=1.
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
