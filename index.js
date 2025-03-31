const template = require("@babel/template").default;

// Pre-compile the import statement template once
const importDeclaration = template(`import 'twin.macro';`)();

// Cache for compiled regular expressions
const regexCache = new Map();

// Cache for file processing results (memoization)
const fileCache = new Map();

function importTwinMacroPlugin(babel) {
  return {
    visitor: {
      Program: {
        enter(path, state) {
          const filename = state.file.opts.filename;
          
          // Early return for cached files
          if (fileCache.has(filename)) {
            return fileCache.get(filename);
          }
          
          const hasDebug = state.opts.debug === true;
          
          // Check exclude patterns first for early return
          const excludePatterns = state.opts.exclude ?? [];
          if (excludePatterns.length > 0) {
            // Optimize: Check all patterns in one pass if possible
            if (excludePatterns.length === 1) {
              // Single pattern optimization
              let regex = regexCache.get(excludePatterns[0]);
              if (!regex) {
                regex = new RegExp(excludePatterns[0]);
                regexCache.set(excludePatterns[0], regex);
              }
              
              if (regex.test(filename)) {
                hasDebug && logDebug(`Matched exclude pattern "${excludePatterns[0]}" on "${filename}"`);
                fileCache.set(filename, false);
                return;
              }
            } else {
              // Multiple patterns
              const matchedExclude = excludePatterns.find((pattern) => {
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
          }
          
          // Fast check: Direct access to body[0] for common import-first patterns
          const body = path.node.body;
          if (body.length > 0 && 
              body[0].type === 'ImportDeclaration' && 
              body[0].source.value === 'twin.macro') {
            hasDebug && logDebug(`Skipped injection in "${filename}"`);
            fileCache.set(filename, false);
            return;
          }
          
          // Optimize: Check for existing twin.macro import with array.some
          // Only look at top-level import declarations
          let index = 0;
          const bodyLen = body.length;
          while (index < bodyLen) {
            const node = body[index];
            if (node.type === 'ImportDeclaration' && 
                node.source.value === 'twin.macro') {
              hasDebug && logDebug(`Skipped injection in "${filename}"`);
              fileCache.set(filename, false);
              return;
            }
            index++;
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
