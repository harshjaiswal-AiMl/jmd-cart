import fs from 'node:fs';
import path from 'node:path';

// Fix Windows EPERM issue when tracing symlinks during standalone output build
if (process.platform === 'win32') {
  const origSymlink = fs.promises.symlink;
  fs.promises.symlink = async function (target, destPath, type) {
    try {
      return await origSymlink.call(this, target, destPath, type);
    } catch (err) {
      if (err.code === 'EPERM') {
        const absoluteTarget = path.isAbsolute(target)
          ? target
          : path.resolve(path.dirname(destPath), target);
        try {
          const stat = await fs.promises.stat(absoluteTarget);
          if (stat.isDirectory()) {
            return await origSymlink.call(this, absoluteTarget, destPath, 'junction');
          } else {
            return await fs.promises.copyFile(absoluteTarget, destPath);
          }
        } catch {
          try {
            return await fs.promises.copyFile(absoluteTarget, destPath);
          } catch {
            return;
          }
        }
      }
      if (err.code === 'EEXIST') {
        return;
      }
      throw err;
    }
  };

  const origSymlinkSync = fs.symlinkSync;
  fs.symlinkSync = function (target, destPath, type) {
    try {
      return origSymlinkSync.call(this, target, destPath, type);
    } catch (err) {
      if (err.code === 'EPERM') {
        const absoluteTarget = path.isAbsolute(target)
          ? target
          : path.resolve(path.dirname(destPath), target);
        try {
          const stat = fs.statSync(absoluteTarget);
          if (stat.isDirectory()) {
            return origSymlinkSync.call(this, absoluteTarget, destPath, 'junction');
          } else {
            return fs.copyFileSync(absoluteTarget, destPath);
          }
        } catch {
          try {
            return fs.copyFileSync(absoluteTarget, destPath);
          } catch {
            return;
          }
        }
      }
      if (err.code === 'EEXIST') {
        return;
      }
      throw err;
    }
  };
}

/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

function safeHost(url) {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
  {
    key: 'Content-Security-Policy',
    value:
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' ws: wss:; frame-ancestors 'none';",
  },
  ...(isProd
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
    : []),
];

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        'jmdcart.localhost:3000',
        'management.jmdcart.localhost:3000',
        safeHost(process.env.APP_URL),
        safeHost(process.env.MANAGEMENT_URL),
      ].filter(Boolean),
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
