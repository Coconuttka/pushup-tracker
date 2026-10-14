import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { build, preview } from 'vite'

process.env.VITE_BASE_PATH = '/Pushups/'
await build({ build: { outDir: '.e2e-dist' } })
const server = await preview({
  build: { outDir: '.e2e-dist' },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
})
try {
  const child = spawn(
    process.execPath,
    [
      fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url)),
      'test',
      ...process.argv.slice(2),
    ],
    { stdio: 'inherit' },
  )
  const code = await new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('exit', resolve)
  })
  process.exitCode = typeof code === 'number' ? code : 1
} finally {
  server.httpServer.closeAllConnections()
  await new Promise((resolve, reject) =>
    server.httpServer.close((error) => (error ? reject(error) : resolve())),
  )
}
