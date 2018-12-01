exports.isTopLevel = isTopLevel;
function isTopLevel(t, path) {
  return !path.scope.parent;
}

exports.imports = imports;
function imports(t, path) {
  const names = (() => {
    switch (path.node.id.type) {
      case 'Identifier':
        return [path.node.id.name];
      case 'ObjectPattern':
        return path.node.id.properties.map(p => p.key.name);
    }
  })()
  return t.importDeclaration(
    names.map(name => {
      if (names.length === 1) {
        return t.importDefaultSpecifier(t.identifier(name));
      }
      return t.importSpecifier(t.identifier(name), t.identifier(name));
    }),
    t.stringLiteral(path.node.init.arguments[0].value)
  );
}

exports.defaultExports = defaultExports;
function defaultExports(t, path) {
  const defaults = t.exportDefaultDeclaration(path.node.right);
  if (path.node.right.type !== 'ObjectExpression') {
    return [defaults];
  }

  return [
    defaults,
    ...path.node.right.properties.map(property => {
      const name = getName(t, property.value);
      if (name) {
        path.scope.rename(name);
      }
      return t.exportNamedDeclaration(
        t.variableDeclaration(
          'const',
          [
            t.variableDeclarator(
              t.identifier(property.key.name),
              property.value
            )
          ]
        ),
        []
      );
    })
  ];
}

exports.defaultExportsByNamed = defaultExportsByNamed;
function defaultExportsByNamed(t, paths) {
  return t.exportDefaultDeclaration(t.objectExpression(
    paths.map(path => t.objectProperty(
      path.node.left.property,
      path.node.left.property
    ))
  ));
}

exports.namedExports = namedExports;
function namedExports(t, path) {
  const names = Object.keys(path.scope.bindings);
  if (names.includes(path.node.right.name)) {
    return t.exportNamedDeclaration(null, [
      t.exportSpecifier(
        t.identifier(path.node.right.name),
        t.identifier(path.node.left.property.name)
      )]
    );
  }

  path.scope.rename(getName(t, path.node.right));
  return t.exportNamedDeclaration(
    t.variableDeclaration(
      'const',
      [
        t.variableDeclarator(
          t.identifier(path.node.left.property.name),
          path.node.right
        )
      ]
    ),
    []
  );
}

exports.normalizeNamedExports = normalizeNamedExports;
function normalizeNamedExports(t, paths) {
  return Object.values(
    paths.reduce((paths, path) => {
      if (
        (
          t.isMemberExpression(path.node.left)
          && ['__esModule'].includes(path.node.left.property.name)
        ) || (
          t.isIdentifier(path.node.right)
          && ['undefined'].includes(path.node.right.name)
        )
      ) {
        return paths;
      }

      paths[path.node.left.property.name] = path;
      return paths;
    }, {})
  );
}

exports.isEsModuleTrue = isEsModuleTrue;
function isEsModuleTrue(t, path) {
  const isObjectDefineProperty = t.isCallExpression(path.node)
    && t.isMemberExpression(path.node.callee)
    && path.node.callee.object.name === 'Object'
    && path.node.callee.property.name === 'defineProperty'
    && path.node.arguments.length === 3
    && path.node.arguments[0].name === 'exports'
    && path.node.arguments[1].value === '__esModule'
    && t.isObjectExpression(path.node.arguments[2])
    && path.node.arguments[2].properties.length === 1
    && path.node.arguments[2].properties[0].key.name === 'value'
    && path.node.arguments[2].properties[0].value.value === true;
  const isExportsEsModuleAssignment = t.isAssignmentExpression(path.node)
    && t.isIdentifier(path.node.left.object)
    && path.node.left.object.name === 'exports'
    && t.isIdentifier(path.node.left.property)
    && path.node.left.property.name === '__esModule'
    && t.isBooleanLiteral(path.node.right)
    && path.node.right.value === true;
  return isObjectDefineProperty || isExportsEsModuleAssignment;
}

exports.isObjectDefinePropertyForModules = isObjectDefinePropertyForModules;
function isObjectDefinePropertyForModules(t, path) {
  return !isEsModuleTrue(t, path) && t.isCallExpression(path.node)
    && t.isMemberExpression(path.node.callee)
    && path.node.callee.object.name === 'Object'
    && path.node.callee.property.name === 'defineProperty'
    && (
      path.node.arguments[0].name === 'exports'
      || path.node.arguments[0].name === 'exports'
    );
}

exports.isRequireDeclaration = isRequireDeclaration;
function isRequireDeclaration(t, path) {
    return t.isVariableDeclarator(path.node)
      && t.isCallExpression(path.node.init)
      && t.isIdentifier(path.node.init.callee)
      && path.node.init.callee.name === 'require';
}

/**
 * module.exports = ...;
 */
exports.isModuleExportsAssignment = isModuleExportsAssignment;
function isModuleExportsAssignment(t, path) {
  return t.isAssignmentExpression(path.node)
    && t.isMemberExpression(path.node.left)
    && path.node.left.object.name === 'module'
    && path.node.left.property.name === 'exports';
}

/**
 * exports.default = ...;
 */
exports.isExportsDefaultAssignment = isExportsDefaultAssignment;
function isExportsDefaultAssignment(t, path) {
  return path.scope.parent === null
    && t.isAssignmentExpression(path.node)
    && t.isMemberExpression(path.node.left)
    && path.node.left.object.name === 'exports'
    && path.node.left.property.name === 'default';
}

/**
 * exports.!default = ...;
 */
exports.isExportsAssignment = isExportsAssignment;
function isExportsAssignment(t, path) {
  return path.scope.parent === null
    && t.isAssignmentExpression(path.node)
    && t.isMemberExpression(path.node.left)
    && path.node.left.object.name === 'exports'
    && path.node.left.property.name !== 'default';
}

/**
 * class *** {}
 * function ***() {}
 * const *** = ...;
 * var *** = ...;
 */
exports.getName = getName;
function getName(t, pathOrNode) {
  const node = pathOrNode.node || pathOrNode;
  switch (node.type) {
    case 'VariableDeclarator':
      return node.id.name;
    case 'ClassDeclaration':
      return node.id.name;
    case 'FunctionDeclaration':
      return node.id.name;
    case 'FunctionExpression':
      return node.id ? node.id.name : null;
    case 'MemberExpression':
      return node.object.name;
    case 'CallExpression':
      return node.callee.name;
    case 'Identifier':
      return node.name;
  }
  return null;
}

