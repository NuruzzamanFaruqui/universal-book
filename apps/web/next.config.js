/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  transpilePackages: [
    '@tiptap/react',
    '@tiptap/pm',
    '@tiptap/starter-kit',
    '@tiptap/core',
    '@tiptap/extension-underline',
    '@tiptap/extension-text-align',
    '@tiptap/extension-placeholder',
    '@tiptap/extension-character-count',
    '@tiptap/extension-mathematics',
  ],
}

module.exports = nextConfig
