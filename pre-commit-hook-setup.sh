#!/bin/bash

# Step 1: Install husky and lint-staged
pnpm add -D husky lint-staged prettier

# Step 2: Initialize husky
pnpm exec husky init

# Step 3: Create a pre-commit hook
cat > .husky/pre-commit << 'EOF'
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm exec lint-staged
EOF

# Step 4: Make sure the pre-commit hook is executable
chmod +x .husky/pre-commit

# Step 5: Configure lint-staged in package.json
cat > lint-staged.config.js << 'EOF'
module.exports = {
  "**/*.{js,jsx,ts,tsx,json,css,scss,md}": ["prettier --write"]
}
EOF

# Step 6: Add Prettier configuration (if you don't have one already)
cat > .prettierrc << 'EOF'
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
EOF

echo "Prettier pre-commit hook has been set up successfully!"
