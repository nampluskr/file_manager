// Enforces SPEC.md §11.4: src/main/filesystem/* must never import electron.
// A pure Node script (no new dependency) so the boundary is enforced
// automatically instead of by convention alone. Run before the test suite.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'

const targetDir = join(process.cwd(), 'src', 'main', 'filesystem')
const electronImportPattern = /from\s+['"]electron['"]|require\(\s*['"]electron['"]\s*\)/

function collectSourceFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    const entryPath = join(dir, entry)
    if (statSync(entryPath).isDirectory()) {
      files.push(...collectSourceFiles(entryPath))
    } else if (extname(entry) === '.ts') {
      files.push(entryPath)
    }
  }
  return files
}

const violations = collectSourceFiles(targetDir)
  .filter((filePath) => electronImportPattern.test(readFileSync(filePath, 'utf8')))

if (violations.length > 0) {
  console.error('src/main/filesystem/* must not import electron (SPEC.md §11.4):')
  for (const filePath of violations) console.error(`  ${filePath}`)
  process.exit(1)
}
