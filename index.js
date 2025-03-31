const template = require("@babel/template").default;

// Pre-compile the import statement template
const buildImport = template(`import 'twin.macro';`);

// Cache for compiled regular expressions
const regexCache = new Map();

function importTwinMacroPlugin(babel) {
  const importDeclaration = buildImport();
  
  return {
    visitor: {
      Program: {
        enter(path, state) {
          const hasDebug = state.opts.debug === true;
          const filename = state.file.opts.filename;
          
          // Check exclude patterns first for early return
          const excludePatterns = state.opts.exclude ?? [];
          if (excludePatterns.length > 0) {
            const matchedExclude = excludePatterns.find((pattern) => {
              // Use cached regex to avoid recompiling
              let regex = regexCache.get(pattern);
              if (!regex) {
                regex = new RegExp(pattern);
                regexCache.set(pattern, regex);
              }
              return regex.test(filename);
            });
            
            if (matchedExclude) {
              hasDebug && console.log(
                `babel-plugin-twin: Matched exclude pattern "${matchedExclude}" on "${filename}"`
              );
              return; // Skip this file entirely
            }
          }
          
          // Check for existing twin.macro import more efficiently
          // Only look at top-level import declarations
          let hasTwinImport = false;
          
          for (const childPath of path.get('body')) {
            if (
              childPath.isImportDeclaration() && 
              childPath.node.source.value === 'twin.macro'
            ) {
              hasTwinImport = true;
              break;
            }
          }
          
          if (hasTwinImport) {
            hasDebug && console.log(
              `babel-plugin-twin: Skipped injection in "${filename}"`
            );
            return;
          }
          
          // Add the import
          hasDebug && console.log(
            `babel-plugin-twin: Injected import in "${filename}"`
          );
          
          path.unshiftContainer("body", importDeclaration);
        }
      }
    }
  };
}

module.exports = importTwinMacroPlugin;
