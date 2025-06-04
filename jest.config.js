module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'], // Only run tests from the 'test' directory (source .ts files)
  // Optional: If your test files are not in a directory named 'test' or '__tests__' at the root,
  // or if they have a different naming convention, you might need to specify testMatch or roots.
  // For example, if tests are in 'src/tests' and end with '.spec.ts':
  // roots: ['<rootDir>/src'],
  // testMatch: ['**/tests/**/*.spec.ts'],

  // If you have other assets or modules that Jest needs to handle (e.g., CSS, images),
  // you might need moduleNameMapper or transformIgnorePatterns.
  // moduleNameMapper: {
  //   '\\.(css|less)$': 'identity-obj-proxy', // Example for CSS Modules
  // },
};
