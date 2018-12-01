# babel-plugin-transform-cjs2esm-safety(WIP)
cjs to esm if possible.

# implemented
- `const * = require('*')` to `import * from *`
- `const { *, * } = require('*')` to `import { *, * } from *`
- `exports.* = *` to `export const * = *`
- `module.exports = *` to `export default *`

# todo
- more test case from production usage.
- refactor for more use `scope` and `bindings`.

