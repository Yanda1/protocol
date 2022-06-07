const { ethers, upgrades } = require("hardhat");
require('dotenv').config({path: '.env'});

async function main() {
  // Deploy YandaToken
  const Token = await ethers.getContractFactory("YandaToken");
  const token = await upgrades.deployProxy(Token);
  await token.deployed();
  const ExtProtocol = await ethers.getContractFactory("YandaExtendedProtocol");
  // Default args is: 10, 20736 (3 days in 12.5s blocks), <address of the YND token>
  const ext_protocol = await upgrades.deployProxy(ExtProtocol, [process.env.PENALTY_PERC, process.env.LOCKING_PERIOD, token.address]);
  await ext_protocol.deployed();

  console.log("YandaToken deployed at:", token.address);
  console.log("YandaExtendedProtocol deployed at:", ext_protocol.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
