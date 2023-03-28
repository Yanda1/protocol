const { ethers } = require("hardhat");
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
  console.log('done!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
