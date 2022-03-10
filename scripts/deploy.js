const { ethers, upgrades } = require("hardhat");

async function main() {
  // Deploy YandaToken
  const Token = await ethers.getContractFactory("YandaTokenV2");
  const token = await upgrades.deployProxy(Token);
  await token.deployed();
  // Deploy YandaGovernor with YandaToken address as argument
  const Governor = await ethers.getContractFactory("YandaGovernor");
  const governor = await Governor.deploy(token.address, 5, 5, ethers.utils.parseEther('1000'), [4, 25, 50]);
  // const governor = await Governor.deploy(token.address, 17280 /* 1 day */, 17280 /* 1 day */, ethers.utils.parseEther('5000000'), [4, 25, 50]);

  console.log("YandaToken deployed at:", token.address);
  console.log("YandaGovernor deployed at:", governor.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
