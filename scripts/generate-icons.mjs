import sharp from 'sharp'
import { readFile, mkdir } from 'node:fs/promises'

await mkdir('public/icons', { recursive: true })
const icon = await readFile('public/favicon.svg')
for (const size of [192, 512]) {
  await sharp(icon).resize(size, size).png().toFile(`public/icons/icon-${size}.png`)
}
await sharp(icon).resize(180, 180).png().toFile('public/icons/apple-touch-icon.png')
const maskable = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#c5f277"/><path d="m145 294 58-125h88l-50 100h145l-62 75H157" stroke="#293919" stroke-width="37" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
)
await sharp(maskable).resize(512, 512).png().toFile('public/icons/maskable-512.png')
