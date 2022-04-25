const { ethers } = require("hardhat");


async function skipBlocks (token, n) {
  const accounts = await ethers.getSigners();
  const startBlock = await ethers.provider.getBlock();
  let currentBlock = startBlock;

  while (currentBlock.number - startBlock.number < n) {
    await token.connect(accounts[0]).delegate(accounts[0].address);
    currentBlock = await ethers.provider.getBlock();
  }
};

module.exports = { skipBlocks };
