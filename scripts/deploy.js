const { ethers, upgrades } = require("hardhat");

async function main() {
  // Deploy YandaToken
  const Token = await ethers.getContractFactory("YandaTokenV2");
  const token = await upgrades.deployProxy(Token);
  await token.deployed();
  // Protocol contract args: penaltyPerc=10, lockingPeriod=51840 (3 days in 5 sec block's amount)
  const Protocol = await ethers.getContractFactory("YandaProtocol");
  const protocol = await upgrades.deployProxy(Protocol, [10, 51840, token.address]);
  await token.deployed();
  // Deploy YandaGovernor with YandaToken address as argument
  const Governor = await ethers.getContractFactory("YandaGovernor");
  const governor = await Governor.deploy(token.address, 5, 5, ethers.utils.parseEther('1000'), [4, 25, 50]);
  // const governor = await Governor.deploy(token.address, 17280 /* 1 day */, 17280 /* 1 day */, ethers.utils.parseEther('5000000'), [4, 25, 50]);
  await governor.deployed();
  // Grant governor admin role in the protocol contract
  await protocol.grantRole('0x0000000000000000000000000000000000000000000000000000000000000000', governor.address);

  console.log("YandaToken deployed at:", token.address);
  console.log("YandaProtocol deployed at:", protocol.address);
  console.log("YandaGovernor deployed at:", governor.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
