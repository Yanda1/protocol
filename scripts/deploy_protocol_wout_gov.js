const { ethers, upgrades } = require("hardhat");
require('dotenv').config({path: '.env'});

async function main() {
  if (!process.env.PENALTY_PERC) {
    console.log('PENALTY_PERC env var is required, exiting...');
    return;
  }
  if (!process.env.LOCKING_PERIOD) {
    console.log('LOCKING_PERIOD env var is required, exiting...');
    return;
  }

  // Deploy YandaToken
  const Token = await ethers.getContractFactory("YandaToken");
  const token = await upgrades.deployProxy(Token);
  await token.deployed();

  console.log("YandaToken deployed at:", token.address);

  const Protocol = await ethers.getContractFactory("YandaMultitokenProtocolV1");
  // Default args is: 10, 20736 (3 days in 12.5s blocks), <address of the YND token>
  console.log('Deploying Protocol with args:', process.env.PENALTY_PERC, process.env.LOCKING_PERIOD, token.address);
  const protocol = await Protocol.deploy(process.env.PENALTY_PERC, process.env.LOCKING_PERIOD, token.address);
  await protocol.deployed();

  console.log("YandaMultitokenProtocolV1 deployed at:", protocol.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
