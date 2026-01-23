import fs from 'fs'
import path from 'path'

const inputDir = process.argv[2] ?? 'tests/corpus/official'
const corpusDir = path.resolve(inputDir)

const stripComment = (lineText) => {
  const commentIndex = lineText.indexOf(';')
  return commentIndex === -1 ? lineText : lineText.slice(0, commentIndex)
}

const isValidLine = (lineText) => {
  const trimmed = stripComment(lineText).trim()
  if (!trimmed || trimmed.startsWith(';')) return true
  if (/^[A-Za-z_][A-Za-z0-9_]*:\s*$/.test(trimmed)) return true
  if (/^(equ|mem)\s+[A-Za-z_][A-Za-z0-9_]*\s+.+$/i.test(trimmed)) return true
  if (/^org\s+.+$/i.test(trimmed)) return true
  if (/^[A-Za-z_][A-Za-z0-9_]*\b(\s+[A-Za-z0-9_#^|.+\-*/\s,]+)?$/.test(trimmed)) return true
  return false
}

const scanFile = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split(/\r?\n/)
  const errors = []

  lines.forEach((line, index) => {
    if (!isValidLine(line)) {
      errors.push({ line: index + 1, text: line })
    }
  })

  return errors
}

if (!fs.existsSync(corpusDir)) {
  console.error(`Corpus directory not found: ${corpusDir}`)
  process.exit(1)
}

const files = fs.readdirSync(corpusDir).filter((file) => file.endsWith('.spn'))

if (files.length === 0) {
  console.log(`No .spn files found in ${inputDir}`)
  process.exit(0)
}

let hasErrors = false

files.forEach((file) => {
  const filePath = path.join(corpusDir, file)
  const errors = scanFile(filePath)
  if (errors.length > 0) {
    hasErrors = true
    console.log(`\n${file}`)
    errors.slice(0, 5).forEach((error) => {
      console.log(`  Line ${error.line}: ${error.text.trim()}`)
    })
    if (errors.length > 5) {
      console.log(`  ... ${errors.length - 5} more`)
    }
  }
})

if (!hasErrors) {
  console.log(`All corpus files in ${inputDir} passed the basic syntax screen.`)
}
