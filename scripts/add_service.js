const { ethers } = require("hardhat");
require('dotenv').config({path: '.env'});
const { getTxReceipt } = require("../utils/getTxReceipt");

async function main() {
  if (!process.env.TOKEN_ADDR) {
    console.log('TOKEN_ADDR env var is required, exiting...');
    return;
  }
  if (!process.env.PROTOCOL_ADDR) {
    console.log('PROTOCOL_ADDR env var is required, exiting...');
    return;
  }

  accounts = await ethers.getSigners();
  if (accounts.length < 6) {
    console.log('This script requires at least 6 accounts, exiting...');
    return;
  }

  // Get YandaToken
  const Token = await ethers.getContractFactory("YandaToken");
  const token = await Token.attach(process.env.TOKEN_ADDR);
  // Get Protocol
  const Protocol = await ethers.getContractFactory("YandaMultitokenProtocolV1");
  const protocol = await Protocol.attach(process.env.PROTOCOL_ADDR);

  console.log("YandaToken at:", token.address);
  console.log("YandaMultitokenProtocolV1 at:", protocol.address);

  // Add new service with the admin address of accounts[1] and as validators accounts[3,4,5], fee nominator is 1 and fee denominator is 1
  console.log('Adding new service with args:', accounts[1].address, accounts.map(x => x.address).slice(3, 6));
  await protocol.addService(accounts[1].address, accounts.map(x => x.address).slice(3, 6));
  
  // Transfer 1000 YandaToken from token owner to the new validator(accounts[3])
  await token.transfer(accounts[3].address, ethers.utils.parseEther('1000'));
  // Transfer 2000 YandaToken from token owner to the new validator(accounts[4])
  await token.transfer(accounts[4].address, ethers.utils.parseEther('2000'));
  // Transfer 3000 YandaToken from token owner to the new validator(accounts[5])
  await token.transfer(accounts[5].address, ethers.utils.parseEther('3000'));

  // Stake to activate new validators
  const stakeAmount1 = ethers.utils.parseEther('1000');
  const tx1 = await token.connect(accounts[3]).approve(protocol.address, stakeAmount1);
  // Wait until the transaction is mined
  await getTxReceipt(tx1);
  // Stake 1000 YandaToken from the new validator(accounts[3])
  await protocol.connect(accounts[3]).stake(accounts[3].address, stakeAmount1);

  const stakeAmount2 = ethers.utils.parseEther('2000');
  const tx2 = await token.connect(accounts[4]).approve(protocol.address, stakeAmount2);
  // Wait until the transaction is mined
  await getTxReceipt(tx2);
  // Stake 2000 YandaToken from the new validator(accounts[4])
  await protocol.connect(accounts[4]).stake(accounts[4].address, stakeAmount2);

  const stakeAmount3 = ethers.utils.parseEther('3000');
  const tx3 = await token.connect(accounts[5]).approve(protocol.address, stakeAmount3);
  // Wait until the transaction is mined
  await getTxReceipt(tx3);
  // Stake 3000 YandaToken from the new validator(accounts[5])
  await protocol.connect(accounts[5]).stake(accounts[5].address, stakeAmount3);

  console.log('done!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
