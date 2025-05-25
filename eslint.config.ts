import eslintConfig from '@billoneta/config/eslint-config';
import { defineConfig } from 'eslint/config';

export default defineConfig([
 // prettier
 eslintConfig.base,
 eslintConfig.node,
 eslintConfig.typescript,
 eslintConfig.prettier,
 {
  name: 'Override',
  rules: {
   camelcase: 'off',
   'require-await': 'off',
   'import-x/order': 'off',
   'prefer-destructuring': 'off',
   'no-empty': 'off',
   'no-undef': 'off',
  },
 },
]);
