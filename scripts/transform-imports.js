const {Project} = require('ts-morph')
const path = require('path')
const fg = require('fast-glob')
const fs = require('fs')

const aliasMap = {
  '@screens': 'src/screens',
  '@components': 'src/components',
  '@constants': 'src/constants',
  '@services': 'src/services',
  '@types': 'src/types',
  '@theme': 'src/styles',
  '@store': 'src/store',
  '@data': 'src/data',
  '@service': 'src/service'
}

const isLocalRelative = importPath => importPath.startsWith('./')
const isDeepRelative = importPath => importPath.startsWith('../')
const isThirdPartyImport = importPath => !importPath.startsWith('.') && !importPath.startsWith('@')

function getAliasPath(importPath, sourceFilePath) {
  if (!importPath.startsWith('..')) return null
  const absPath = path.resolve(path.dirname(sourceFilePath), importPath)

  for (const [alias, target] of Object.entries(aliasMap)) {
    const absTarget = path.resolve(target)
    if (absPath.startsWith(absTarget)) {
      const relative = path.relative(absTarget, absPath)
      return `${alias}/${relative.replace(/\\/g, '/')}`
    }
  }

  return null
}

function formatImportStructure(struct) {
  const namedImports = struct.namedImports || []
  const defaultImport = struct.defaultImport
  const namespaceImport = struct.namespaceImport
  const moduleSpecifier = `'${struct.moduleSpecifier}'`

  if (namespaceImport) {
    return `import * as ${namespaceImport} from ${moduleSpecifier}`
  }

  if (namedImports.length === 0) {
    return `import ${defaultImport} from ${moduleSpecifier}`
  }

  const names = namedImports.map(i => i.name)
  const named = `{${names.join(',')}}`

  if (defaultImport) {
    return `import ${defaultImport}, ${named} from ${moduleSpecifier}`
  }

  return `import ${named} from ${moduleSpecifier}`
}

const targetDirArg = process.argv[2]

if (!targetDirArg) {
  console.error('❌ Please provide a directory name, e.g., node script.js screens')
  process.exit(1)
}

const resolvedTarget = fg.sync([`**/${targetDirArg}`], {
  onlyDirectories: true,
  cwd: process.cwd(),
  absolute: true
})[0]

if (!resolvedTarget || !fs.existsSync(resolvedTarget)) {
  console.error(`❌ Could not find directory matching "${targetDirArg}"`)
  process.exit(1)
}

;(async () => {
  const files = await fg([`${resolvedTarget}/**/*.{ts,tsx,js,jsx}`], {dot: true})
  const project = new Project()

  files.forEach(file => project.addSourceFileAtPath(file))
  const sourceFiles = project.getSourceFiles()

  for (const file of sourceFiles) {
    const imports = file.getImportDeclarations()
    if (imports.length === 0) continue

    const reactImports = []
    const thirdPartyImports = []
    const aliasedImports = []
    const deepRelativeImports = []
    const localRelativeImports = []

    for (const imp of imports) {
      const module = imp.getModuleSpecifierValue()

      if (module === 'react') {
        reactImports.push(imp)
      } else if (isLocalRelative(module)) {
        localRelativeImports.push(imp)
      } else if (isDeepRelative(module)) {
        const alias = getAliasPath(module, file.getFilePath())
        if (alias) {
          imp.setModuleSpecifier(alias)
          aliasedImports.push(imp)
        } else {
          deepRelativeImports.push(imp)
        }
      } else if (isThirdPartyImport(module)) {
        thirdPartyImports.push(imp)
      } else {
        aliasedImports.push(imp)
      }
    }

    const sortByModule = (a, b) => a.getModuleSpecifierValue().localeCompare(b.getModuleSpecifierValue())

    const sortedGroups = [
      reactImports,
      thirdPartyImports.sort(sortByModule),
      aliasedImports.sort(sortByModule),
      deepRelativeImports.sort(sortByModule),
      localRelativeImports.sort(sortByModule)
    ]

    const formattedGroupStrings = sortedGroups
      .filter(group => group.length > 0)
      .map(group => group.map(imp => formatImportStructure(imp.getStructure())).join('\n'))

    const finalImportBlock = formattedGroupStrings.join('\n\n')
    const finalImportBlockTrimmed = finalImportBlock.trimEnd()

    const firstImport = imports[0]
    const lastImport = imports[imports.length - 1]
    const start = firstImport.getFullStart()
    const end = lastImport.getEnd()

    const fullText = file.getFullText()
    let remainingText = fullText.slice(end)

    const remainingLines = remainingText.split('\n')
    const firstLine = remainingLines.find(line => line.trim().length > 0)
    const isCodeLine = firstLine && /^[a-zA-Z0-9_]/.test(firstLine.trim())
    const spacer = isCodeLine && !remainingText.startsWith('\n') ? '\n' : ''

    const newText = fullText.slice(0, start) + finalImportBlockTrimmed + spacer + remainingText

    file.replaceWithText(newText)
    await file.save()
  }

  console.log(`✅ Imports reformatted in ${sourceFiles.length} files in directory "${targetDirArg}"`)
})()
