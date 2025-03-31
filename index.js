const template = require("@babel/template").default;

// Pre-compile the import statement template once
const importDeclaration = template(`import 'twin.macro';`)();

// Cache for compiled regular expressions
const regexCache = new Map();

// Cache for file processing results (memoization)
const fileCache = new Map();

// Relevant file patterns that might use twin.macro
const RELEVANT_EXTENSIONS = ['.tsx', '.jsx', '.js', '.ts'];

// Default directories to exclude (ultra-fast preliminary check)
const DEFAULT_EXCLUDES = [
  '/node_modules/',
  '/.cache/',
  '/.tmp/',
  '/tmp/',
  '/cache/',
  '/typings/',
  '/.next/',
  '.d.ts'
];

function importTwinMacroPlugin(babel) {
  return {
    visitor: {
      Program: {
        enter(path, state) {
          const filename = state.file.opts.filename || '';
          
          // Early return for cached files
          if (fileCache.has(filename)) {
            return fileCache.get(filename);
          }
          
          const hasDebug = state.opts.debug === true;
          
          // Quick check for default exclusions (ultra-fast preliminary check)
          for (let i = 0; i < DEFAULT_EXCLUDES.length; i++) {
            if (filename.includes(DEFAULT_EXCLUDES[i])) {
              fileCache.set(filename, false);
              return;
            }
          }
          
          // Quick extension check (super fast)
          const isRelevantFile = RELEVANT_EXTENSIONS.some(ext => filename.endsWith(ext));
          if (!isRelevantFile) {
            fileCache.set(filename, false);
            return;
          }
          
          // Check include/exclude patterns
          const includePatterns = state.opts.include ?? [];
          const excludePatterns = state.opts.exclude ?? [];
          
          // Include patterns - if specified, file must match one
          if (includePatterns.length > 0) {
            const matchesInclude = includePatterns.some(pattern => {
              let regex = regexCache.get(pattern);
              if (!regex) {
                regex = new RegExp(pattern);
                regexCache.set(pattern, regex);
              }
              return regex.test(filename);
            });
            
            if (!matchesInclude) {
              hasDebug && logDebug(`Skipped non-included file "${filename}"`);
              fileCache.set(filename, false);
              return;
            }
          }
          
          // Custom exclude patterns
          if (excludePatterns.length > 0) {
            const matchedExclude = excludePatterns.find(pattern => {
              let regex = regexCache.get(pattern);
              if (!regex) {
                regex = new RegExp(pattern);
                regexCache.set(pattern, regex);
              }
              return regex.test(filename);
            });
            
            if (matchedExclude) {
              hasDebug && logDebug(`Matched exclude pattern "${matchedExclude}" on "${filename}"`);
              fileCache.set(filename, false);
              return;
            }
          }
          
          // Fast check for existing twin.macro import
          const body = path.node.body;
          
          // Check first import for common pattern
          if (body.length > 0 && 
              body[0].type === 'ImportDeclaration' && 
              body[0].source.value === 'twin.macro') {
            hasDebug && logDebug(`Skipped injection in "${filename}"`);
            fileCache.set(filename, false);
            return;
          }
          
          // Check remaining imports in a fast loop
          for (let i = 0; i < body.length; i++) {
            const node = body[i];
            // Skip once we're past import section for speed
            if (node.type !== 'ImportDeclaration') break;
            
            if (node.source.value === 'twin.macro') {
              hasDebug && logDebug(`Skipped injection in "${filename}"`);
              fileCache.set(filename, false);
              return;
            }
          }
          
          // Add the import
          hasDebug && logDebug(`Injected import in "${filename}"`);
          
          path.unshiftContainer("body", importDeclaration);
          fileCache.set(filename, true);
        }
      }
    }
  };
}

// Avoid string concatenation when debug is off
function logDebug(message) {
  console.log(`babel-plugin-twin: ${message}`);
}

module.exports = importTwinMacroPlugin;
