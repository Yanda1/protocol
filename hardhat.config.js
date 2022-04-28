/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require('@openzeppelin/hardhat-upgrades');
require("@nomiclabs/hardhat-ethers");
require('dotenv').config({path: '.env'});
require('hardhat-contract-sizer');

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more


// Import your private key from your pre-funded Moonbase Alpha testing accounts
const { privateKeys } = require('./dev_secrets.json');

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  networks: {
    moonbeam_dev: {
      url: 'http://127.0.0.1:9933',
      chainId: 1281, // (hex: 0x501),
      accounts: privateKeys
    },
    moonbase: {
      url: 'https://rpc.api.moonbase.moonbeam.network',
      chainId: 1287, // (hex: 0x507),
      accounts: [process.env.PRIVATE_KEY]
    },
    // moonriver: {
    //   url: 'RPC-API-ENDPOINT-HERE', // Insert your RPC URL here
    //   chainId: 1285, // (hex: 0x505),
    //   accounts: [process.env.PRIVATE_KEY]
    // },
    // moonbeam: {
    //   url: 'RPC-API-ENDPOINT-HERE', // Insert your RPC URL here
    //   chainId: 1284, // (hex: 0x504),
    //   accounts: [process.env.PRIVATE_KEY]
    // },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.3",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1,
          },
        },
      },
    ],
  },
  mocha: {
    timeout: 60000
  }
};
