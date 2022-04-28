const { ethers, upgrades } = require("hardhat");
const DEPLOYED_ADDR = process.env.DEPLOYED_ADDR;

async function main() {
  if(!DEPLOYED_ADDR) {
    console.log('DEPLOYED_ADDR not found in the current env.')
    return;
  }
  console.log("Upgrading at:", DEPLOYED_ADDR);
  // Upgrade YandaTokenV2
  const Token = await ethers.getContractFactory("YandaTokenV2");
  const token = await upgrades.upgradeProxy(DEPLOYED_ADDR, Token);
  await token.deployed();
  
  console.log("YandaTokenV2 successfully upgraded!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
