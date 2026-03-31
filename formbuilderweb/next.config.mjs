/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8080/api/:path*',
      },
      {
        source: '/admin/api/:path*',
        destination: 'http://localhost:8080/admin/api/:path*',
      },
      {
        source: '/publish/:id/:path(status|published|rules|submit|submissions|fields|draft)/:extra*',
        destination: 'http://localhost:8080/publish/:id/:path/:extra*',
      }
    ];
  },
};

export default nextConfig;
