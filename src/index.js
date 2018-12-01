const path_ = require('path');
const chalk = require('chalk');

const Utils = require('./utils');

const BAILOUT = {
  HAS_EXPORTS_BY_OBJECT_DEFINE_PROPERTY: 'Object.defineProperty(exports or module.exports, ...)',
  HAS_NON_TOPLEVEL_REQUIRE: 'has non-toplevel require',
  HAS_NON_TOPLEVEL_EXPORTS: 'has non-toplevel exports',
  HAS_NON_TOPLEVEL_MODULE_EXPORTS: 'has non-toplevel module.exports',
  HAS_NO_EXPORTS: 'has no exports'
};

module.exports = function cjs2esmSafety({ types: t }) {

  let state;
  return {
    visitor: {

      Program: {
        enter(path, _) {
          state = {
            esModuleTrue: [],
            bailouts: [],
            imports: [],
            defaultExports: [],
            namedExports: [],
            bailout: false,
            filepath: _.file.opts.filename,
            opts: Object.assign({
              verbose: false,
              ignoreFilenameMatches: [/events.js$/],
              ignoreRequireNameMatches: []
            }, _.opts || {})
          };
        },

        exit(path) {
          !(state.defaultExports.length || state.namedExports.length) && state.bailouts.push(BAILOUT.HAS_NO_EXPORTS);
          state.opts.ignoreFilenameMatches.some(r => {
            state.bailouts = state.bailouts.concat(r.test(state.filepath) ? [r] : []);
          });

          if (
            !state.bailouts.includes(BAILOUT.HAS_EXPORTS_BY_OBJECT_DEFINE_PROPERTY)
            && !state.bailouts.includes(BAILOUT.HAS_NON_TOPLEVEL_REQUIRE)
            && !state.bailouts.includes(BAILOUT.HAS_NON_TOPLEVEL_EXPORTS)
            && !state.bailouts.includes(BAILOUT.HAS_NON_TOPLEVEL_MODULE_EXPORTS)
            && !state.bailouts.includes(BAILOUT.HAS_NO_EXPORTS)
          ) {
            state.imports.forEach(p => {
              path.node.body.unshift(Utils.imports(t, p));
            });
          }

          if (state.bailouts.length) {
            state.imports.forEach(i => !i.removed && i.remove());
            console.log(chalk.yellow(` [bailout] ${path_.relative(process.cwd(), state.filepath)} (${state.bailouts.join(', ')})`));
            return;
          }

          state.defaultExports.some(p => {
            Utils.defaultExports(t, p).forEach(p => {
              path.node.body.push(p);
            });
            return true;
          });

          const normalizedNamedExports = Utils.normalizeNamedExports(t, state.namedExports);
          normalizedNamedExports.forEach(p => {            const e = Utils.namedExports(t, p);
            if (e) {
              path.node.body.push(e);
            }
          });
          if (!state.defaultExports.length && normalizedNamedExports.length) {
            path.node.body.push(Utils.defaultExportsByNamed(t, normalizedNamedExports));
          }

          []
            .concat(state.esModuleTrue)
            .concat(state.imports)
            .concat(state.defaultExports)
            .concat(state.namedExports)
            .forEach(p => !p.removed && p.remove());
        }
      },

      VariableDeclarator(path) {
        if (Utils.isTopLevel(t, path)) {
          if (Utils.isRequireDeclaration(t, path)) {
            if (state.opts.ignoreRequireNameMatches.some(r => r.test(path.node.init.arguments[0].value))) {
              return;
            }
            state.imports.push(path);
            return;
          }
        } else {
          if (Utils.isRequireDeclaration(t, path)) {
            state.bailouts.push(BAILOUT.HAS_NON_TOPLEVEL_REQUIRE);
            return;
          }
        }
      },

      AssignmentExpression(path) {
        if (Utils.isTopLevel(t, path)) {
          if (Utils.isModuleExportsAssignment(t, path)) {
            state.defaultExports.push(path);
            return;
          }
          if (Utils.isExportsDefaultAssignment(t, path)) {
            state.defaultExports.push(path);
            return;
          }
          if (Utils.isExportsAssignment(t, path)) {
            state.namedExports.push(path);
            return;
          }
        } else {
          if (Utils.isModuleExportsAssignment(t, path)) {
            state.bailouts.push(BAILOUT.HAS_NON_TOPLEVEL_MODULE_EXPORTS);
            return;
          }
          if (Utils.isExportsDefaultAssignment(t, path)) {
            state.bailouts.push(BAILOUT.HAS_NON_TOPLEVEL_EXPORTS);
            return;
          }
          if (Utils.isExportsAssignment(t, path)) {
            state.bailouts.push(BAILOUT.HAS_NON_TOPLEVEL_EXPORTS);
            return;
          }
        }

        if (Utils.isEsModuleTrue(t, path)) {
          state.esModuleTrue.push(path);
        }
      },

      CallExpression(path) {
        if (Utils.isEsModuleTrue(t, path)) {
          state.esModuleTrue.push(path);
          return;
        }
        if (Utils.isObjectDefinePropertyForModules(t, path)) {
          state.bailouts.push(BAILOUT.HAS_EXPORTS_BY_OBJECT_DEFINE_PROPERTY);
          return;
        }
      }

    }
  };
};

function getReAssignVariableName(t, path) {
  return t.isAssignmentExpression(path.node)
    && t.isIdentifier(path.node.right)
      ? path.node.right.name
      : null;
}

