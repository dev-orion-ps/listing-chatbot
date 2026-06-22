// Next.js 16 dropped the `next lint` command in favor of the ESLint CLI with a
// flat config. `eslint-config-next` ships ready-made flat-config arrays.
import next from "eslint-config-next/core-web-vitals";

const config = [
  ...next,
  {
    ignores: [".next/**", "node_modules/**", "coverage/**"],
  },
];

export default config;
