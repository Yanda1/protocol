const { ethers } = require("hardhat");


async function getTxReceipt(tx) {
  var receipt = null;
  while(receipt==null) {
    receipt = await ethers.provider.getTransactionReceipt(tx.hash);
  }
  return receipt;
}

module.exports = { getTxReceipt };
