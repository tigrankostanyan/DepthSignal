export interface NextConfig {
  reactStrictMode?: boolean;
  rewrites?: () => Promise<Array<{ source: string; destination: string }>>;
  [key: string]: any;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*'
      }
    ];
  }
};

export default nextConfig;
