// ESLint flat config applying the Google JavaScript style guide to this
// Google Apps Script project.
//
// Deliberately CommonJS (.cjs) rather than ESM. The dependencies below are
// supplied by `additional_dependencies` of the eslint hook in
// .pre-commit-config.yaml, which pre-commit exposes through NODE_PATH.
// ESM `import` ignores NODE_PATH, so an .mjs config cannot resolve them and
// the hook fails unless a local node_modules happens to exist. `require`
// honors NODE_PATH, so this file works with no `npm install` at all.
//
// Two pieces of glue are required:
//
//  1. `eslint-config-google` still ships in the legacy eslintrc format, so it
//     is bridged into flat config with FlatCompat.
//  2. That config references `valid-jsdoc` and `require-jsdoc`, which were
//     deprecated in ESLint 5 and removed from core in ESLint 9. Flat config
//     hard-errors on unknown rule names, so any rule no longer present in
//     ESLint's builtin registry is dropped below. Computing that set (rather
//     than naming those two) keeps this working across future removals.
//
// `eslint-plugin-googleappsscript` is used only for its list of Apps Script
// service globals (GmailApp, Utilities, Session, ...) so they are not
// reported as undefined.

const js = require('@eslint/js');
const {FlatCompat} = require('@eslint/eslintrc');
const {builtinRules} = require('eslint/use-at-your-own-risk');
const gasPlugin = require('eslint-plugin-googleappsscript');

const compat = new FlatCompat({baseDirectory: __dirname});

/**
 * Removes rules that ESLint core no longer defines from a config block.
 * @param {!Object} config A flat config object, possibly carrying `rules`.
 * @return {!Object} The config with unknown core rules stripped out.
 */
function dropRemovedCoreRules(config) {
  if (!config.rules) return config;
  const rules = Object.fromEntries(
      Object.entries(config.rules).filter(
          ([name]) => name.includes('/') || builtinRules.has(name),
      ),
  );
  return {...config, rules};
}

// The plugin's globals are eslintrc-style, where `false` means read-only.
const appsScriptGlobals = Object.fromEntries(
    Object.keys(gasPlugin.environments.googleappsscript.globals)
        .map((name) => [name, 'readonly']),
);

module.exports = [
  // Correctness rules first: eslint-config-google covers formatting and
  // naming only, so on its own it would not catch a typo'd global or an
  // unreachable branch.
  js.configs.recommended,
  ...compat.extends('google').map(dropRemovedCoreRules),
  {
    files: ['**/*.js', '**/*.gs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...appsScriptGlobals,
        // The V8 runtime exposes console for Cloud Logging.
        console: 'readonly',
      },
    },
    rules: {
      // Apps Script entry points are invoked by triggers rather than by other
      // code, so top-level functions are intentionally never referenced.
      'no-unused-vars': ['error', {vars: 'local', args: 'after-used'}],
    },
  },
  {
    // This config file itself runs in Node, not in Apps Script.
    files: ['eslint.config.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
      },
    },
  },
];
