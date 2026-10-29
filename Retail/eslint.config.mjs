import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  // build output is not source: without this, `npm run lint` fails as soon as `next dev` or `next build` has run
  { ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals"),
];

export default eslintConfig;
