const { ethers } = require("hardhat");
require('dotenv').config({path: '.env'});

async function main() {
  const ExtProtocol = await ethers.getContractFactory("YandaExtendedProtocolV3");
  // Default args is: 10, 20736 (3 days in 12.5s blocks), <address of the YND token>
  const ext_protocol = await ExtProtocol.deploy(process.env.PENALTY_PERC, process.env.LOCKING_PERIOD, process.env.TOKEN_ADDR);
  await ext_protocol.deployed();

  console.log("YandaExtendedProtocolV3 deployed at:", ext_protocol.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
