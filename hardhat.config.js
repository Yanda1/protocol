/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require('@openzeppelin/hardhat-upgrades');
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
// utils
require('dotenv').config({path: '.env'});
require('hardhat-contract-sizer');
require('hardhat-storage-layout');
require("hardhat-gas-reporter");

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more


// Import your private key from your pre-funded Moonbase Alpha testing accounts
const { moonbeam_dev_keys, localhost_keys } = require('./dev_secrets.json');

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  networks: {
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
      accounts: localhost_keys
    },
    moonbeam_dev: {
      url: 'http://127.0.0.1:9933',
      chainId: 1281, // (hex: 0x501),
      accounts: moonbeam_dev_keys
    },
    moonbase: {
      url: 'https://rpc.api.moonbase.moonbeam.network',
      chainId: 1287, // (hex: 0x507),
      accounts: [process.env.PRIVATE_KEY, process.env.V1_PRIVATE_KEY, process.env.V2_PRIVATE_KEY, process.env.V3_PRIVATE_KEY]
    },
    // moonriver: {
    //   url: 'https://rpc.api.moonriver.moonbeam.network', // Insert your RPC URL here
    //   chainId: 1285, // (hex: 0x505),
    //   accounts: [process.env.PRIVATE_KEY]
    // },
    moonbeam: {
      url: 'https://rpc.api.moonbeam.network',
      chainId: 1284, // (hex: 0x504),
      accounts: [process.env.PRIVATE_KEY, process.env.SERVICE_PRIVATE_KEY, process.env.CLIENT_PRIVATE_KEY, process.env.V1_PRIVATE_KEY, process.env.V2_PRIVATE_KEY, process.env.V3_PRIVATE_KEY, process.env.V4_PRIVATE_KEY, process.env.V5_PRIVATE_KEY, process.env.V6_PRIVATE_KEY, process.env.V7_PRIVATE_KEY]
    },
    sepolia: {
      url: 'https://ethereum-sepolia.blockpi.network/v1/rpc/public',
      chainId: 11155111,
      networkCheckTimeout: 999999,
      timeoutBlocks: 600,
      accounts: [process.env.PRIVATE_KEY, process.env.SERVICE_PRIVATE_KEY, process.env.CLIENT_PRIVATE_KEY, process.env.V1_PRIVATE_KEY, process.env.V2_PRIVATE_KEY, process.env.V3_PRIVATE_KEY]
    },
    ethereum: {
      url: 'https://ethereum.publicnode.com',
      chainId: 1,
      networkCheckTimeout: 999999,
      timeoutBlocks: 600,
      accounts: [process.env.PRIVATE_KEY, process.env.SERVICE_PRIVATE_KEY, process.env.CLIENT_PRIVATE_KEY, process.env.V1_PRIVATE_KEY, process.env.V2_PRIVATE_KEY, process.env.V3_PRIVATE_KEY, process.env.V4_PRIVATE_KEY, process.env.V5_PRIVATE_KEY, process.env.V6_PRIVATE_KEY, process.env.V7_PRIVATE_KEY]
    },
    bsc: {
      url: 'https://bsc.publicnode.com',
      chainId: 56,
      networkCheckTimeout: 999999,
      timeoutBlocks: 600,
      accounts: [process.env.PRIVATE_KEY, process.env.SERVICE_PRIVATE_KEY, process.env.CLIENT_PRIVATE_KEY, process.env.V1_PRIVATE_KEY, process.env.V2_PRIVATE_KEY, process.env.V3_PRIVATE_KEY, process.env.V4_PRIVATE_KEY, process.env.V5_PRIVATE_KEY, process.env.V6_PRIVATE_KEY, process.env.V7_PRIVATE_KEY]
    },
    bsc_testnet: {
      url: 'https://data-seed-prebsc-1-s1.binance.org:8545',
      chainId: 97,
      networkCheckTimeout: 999999,
      timeoutBlocks: 600,
      accounts: [process.env.PRIVATE_KEY, process.env.SERVICE_PRIVATE_KEY, process.env.CLIENT_PRIVATE_KEY, process.env.V1_PRIVATE_KEY, process.env.V2_PRIVATE_KEY, process.env.V3_PRIVATE_KEY, process.env.V4_PRIVATE_KEY, process.env.V5_PRIVATE_KEY, process.env.V6_PRIVATE_KEY, process.env.V7_PRIVATE_KEY]
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_KEY
  },
  solidity: {
    compilers: [
      {
        version: "0.8.3",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.2",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  mocha: {
    timeout: 100000000
  }
};
