# GitHub Push Checklist

Upload the repository contents exactly as they appear in this package.

Before push:

```bash
npm install
npm run build
```

Do not upload:

```text
node_modules/
dist/
.env
.env.local
.vercel/
*.zip
```

Recommended GitHub root:

```text
api/
contract/
public/
src/
.env.example
.gitignore
index.html
package.json
README.md
TESTING.md
BUILD_STATUS.md
PROJECT_SUBMISSION_NOTE.txt
tsconfig.app.json
tsconfig.json
tsconfig.node.json
vite.config.ts
```

After GitHub push:

1. Import the repository into Vercel.
2. Deploy with the default Vite settings.
3. Open the live site.
4. Connect a wallet.
5. Load Workspace #1 and Change #1.
6. Confirm the finalized demo state still renders:
   `HIGH`, `2/2`, `EXECUTED`.
