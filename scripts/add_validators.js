const { ethers } = require("hardhat");
const { getTxReceipt } = require("../utils/getTxReceipt");
require('dotenv').config({path: '.env'});

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
  if (accounts.length < 10) {
    console.log('This script requires at least 10 accounts, exiting...');
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

  // Transfer 1000 YandaToken from token owner to the new validator(accounts[6])
  await token.transfer(accounts[6].address, ethers.utils.parseEther('1000'));
  // Transfer 2000 YandaToken from token owner to the new validator(accounts[7])
  await token.transfer(accounts[7].address, ethers.utils.parseEther('2000'));
  // Transfer 3000 YandaToken from token owner to the new validator(accounts[8])
  await token.transfer(accounts[8].address, ethers.utils.parseEther('3000'));
  // Transfer 2000 YandaToken from token owner to the new validator(accounts[9])
  await token.transfer(accounts[9].address, ethers.utils.parseEther('2000'));

  // Update validator list (accounts[1] is the service provider e.g. Broker wallet)
  await protocol.connect(accounts[1]).setValidators(accounts.map(x => x.address).slice(3, 10));

  // Stake to activate new validators
  const stakeAmount1 = ethers.utils.parseEther('1000');
  const tx1 = await token.connect(accounts[6]).approve(protocol.address, stakeAmount1);
  // Wait until the transaction is mined
  await getTxReceipt(tx1);
  // Stake 1000 YandaToken from the new validator(accounts[6])
  await protocol.connect(accounts[6]).stake(accounts[6].address, stakeAmount1);

  const stakeAmount2 = ethers.utils.parseEther('2000');
  const tx2 = await token.connect(accounts[7]).approve(protocol.address, stakeAmount2);
  // Wait until the transaction is mined
  await getTxReceipt(tx2);
  // Stake 2000 YandaToken from the new validator(accounts[7])
  await protocol.connect(accounts[7]).stake(accounts[7].address, stakeAmount2);

  const stakeAmount3 = ethers.utils.parseEther('3000');
  const tx3 = await token.connect(accounts[8]).approve(protocol.address, stakeAmount3);
  // Wait until the transaction is mined
  await getTxReceipt(tx3);
  // Stake 3000 YandaToken from the new validator(accounts[8])
  await protocol.connect(accounts[8]).stake(accounts[8].address, stakeAmount3);
    
  const stakeAmount4 = ethers.utils.parseEther('2000');
  const tx4 = await token.connect(accounts[9]).approve(protocol.address, stakeAmount4);
  // Wait until the transaction is mined
  await getTxReceipt(tx4);
  // Stake 2000 YandaToken from the new validator(accounts[9])
  await protocol.connect(accounts[9]).stake(accounts[9].address, stakeAmount4);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
