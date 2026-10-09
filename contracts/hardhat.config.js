require('@nomicfoundation/hardhat-toolbox');
const path = require('path');
const { subtask } = require('hardhat/config');
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require('hardhat/builtin-tasks/task-names');

/**
 * Compiles and tests the $PALLADIUM contracts. Deployment does NOT happen from here: the owner deploys from their own
 * wallet through the store's admin (Admin > Token), so no private key is ever stored in this project.
 */
const SOLC = '0.8.28';

// Use the official solc-js build from npm (package "solc") instead of downloading a compiler at build time.
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args, _hre, runSuper) => {
  if (args.solcVersion === SOLC) {
    const solc = require('solc');
    return { compilerPath: path.join(path.dirname(require.resolve('solc')), 'soljson.js'), isSolcJs: true, version: SOLC, longVersion: solc.version().replace('.Emscripten.clang', '') };
  }
  return runSuper();
});

module.exports = {
  solidity: { version: SOLC, settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun' } },
};
