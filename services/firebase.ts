00:18:30.222 Running build in Washington, D.C., USA (East) – iad1
00:18:30.223 Build machine configuration: 2 cores, 8 GB
00:18:30.378 Cloning github.com/durvesh-thorat/retriva (Branch: main, Commit: e06cf20)
00:18:30.779 Cloning completed: 399.000ms
00:18:30.994 Restored build cache from previous deployment (7oFuVP1Za7X9wj3NMUBgZu9JNjAG)
00:18:31.472 Running "vercel build"
00:18:31.962 Vercel CLI 50.1.3
00:18:32.574 Installing dependencies...
00:18:36.074 
00:18:36.075 up to date in 3s
00:18:36.076 
00:18:36.076 28 packages are looking for funding
00:18:36.076   run `npm fund` for details
00:18:36.110 Running "npm run build"
00:18:36.229 
00:18:36.229 > retriva@0.0.0 build
00:18:36.229 > vite build
00:18:36.229 
00:18:36.730 [36mvite v6.4.1 [32mbuilding for production...[36m[39m
00:18:36.810 transforming...
00:18:39.561 [32m✓[39m 1733 modules transformed.
00:18:39.564 [31m✗[39m Build failed in 2.80s
00:18:39.564 [31merror during build:
00:18:39.565 [31mservices/firebase.ts (2:7): "default" is not exported by "node_modules/firebase/app/dist/esm/index.esm.js", imported by "services/firebase.ts".[31m
00:18:39.565 file: [36m/vercel/path0/services/firebase.ts:2:7[31m
00:18:39.565 [33m
00:18:39.565 1: 
00:18:39.565 2: import firebase from 'firebase/app';
00:18:39.566           ^
00:18:39.566 3: import 'firebase/auth';
00:18:39.566 4: import 'firebase/firestore';
00:18:39.566 [31m
00:18:39.567     at getRollupError (file:///vercel/path0/node_modules/rollup/dist/es/shared/parseAst.js:401:41)
00:18:39.567     at error (file:///vercel/path0/node_modules/rollup/dist/es/shared/parseAst.js:397:42)
00:18:39.567     at Module.error (file:///vercel/path0/node_modules/rollup/dist/es/shared/node-entry.js:17022:16)
00:18:39.567     at Module.traceVariable (file:///vercel/path0/node_modules/rollup/dist/es/shared/node-entry.js:17478:29)
00:18:39.567     at ModuleScope.findVariable (file:///vercel/path0/node_modules/rollup/dist/es/shared/node-entry.js:15141:39)
00:18:39.568     at MemberExpression.bind (file:///vercel/path0/node_modules/rollup/dist/es/shared/node-entry.js:7406:49)
00:18:39.568     at UnaryExpression.bind (file:///vercel/path0/node_modules/rollup/dist/es/shared/node-entry.js:2829:23)
00:18:39.568     at IfStatement.bind (file:///vercel/path0/node_modules/rollup/dist/es/shared/node-entry.js:2829:23)
00:18:39.568     at Program.bind (file:///vercel/path0/node_modules/rollup/dist/es/shared/node-entry.js:2825:28)
00:18:39.569     at Module.bindReferences (file:///vercel/path0/node_modules/rollup/dist/es/shared/node-entry.js:17001:18)[39m
00:18:39.600 Error: Command "npm run build" exited with 1