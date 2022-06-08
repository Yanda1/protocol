/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require("@nomiclabs/hardhat-waffle");
require('@openzeppelin/hardhat-upgrades');
require('hardhat-contract-sizer');
require('dotenv').config({ path: '.env' });

module.exports = {
  defaultNetwork: "mandala",
  networks: {
    mandala: {
      url: 'http://127.0.0.1:8545',
      accounts: {
        mnemonic: process.env.LOCAL_MNEMONIC,
        path: "m/44'/60'/0'/0",
      },
      chainId: 595
    },
  },
  mocha: {
    timeout: 100000
  },
  solidity: {
    compilers: [
      {
        version: "0.8.4",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
};
