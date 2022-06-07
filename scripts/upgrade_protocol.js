const { ethers, upgrades } = require("hardhat");
const DEPLOYED_ADDR = process.env.DEPLOYED_ADDR;

async function main() {
  if(!DEPLOYED_ADDR) {
    console.log('DEPLOYED_ADDR not found in the current env.')
    return;
  }
  console.log("Upgrading at:", DEPLOYED_ADDR);
  // Upgrade YandaProtocol
  const Protocol = await ethers.getContractFactory("YandaProtocol");
  const protocol = await upgrades.upgradeProxy(DEPLOYED_ADDR, Protocol);
  await protocol.deployed();
  
  console.log("YandaProtocol successfully upgraded!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
