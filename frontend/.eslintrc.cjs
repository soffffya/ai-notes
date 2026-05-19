module.exports = {
  root: true,
  extends: ['eslint:recommended', 'prettier'],
  parserOptions: {
    ecmaVersion: 'latest'
  },
  env: {
    browser: true,
    es2022: true,
    node: true
  }
};
