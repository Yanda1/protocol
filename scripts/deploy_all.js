const { ethers, upgrades } = require("hardhat");
const { missingEnvVar } = require("../utils/missingEnvVar");

async function main() {
  var isEnvVarMissing = false;
  [
    'PENALTY_PERC', 'LOCKING_PERIOD', 'VOTING_DELAY', 'VOTING_PERIOD', 'PROTOSAL_TRESHOLD',
    'QUORUM_1', 'QUORUM_2', 'QUORUM_3'
  ].forEach((item) => {if(missingEnvVar(item)) isEnvVarMissing = true });
  if (isEnvVarMissing) {
    return 0;
  }

  // Deploy YandaToken
  const Token = await ethers.getContractFactory("YandaToken");
  const token = await upgrades.deployProxy(Token);
  await token.deployed();
  const Protocol = await ethers.getContractFactory("YandaMultitokenProtocolV1");

  // Default args is: 10, 20736 (3 days in 12.5s blocks), <address of the YND token>
  console.log('Deploying Protocol with args:', process.env.PENALTY_PERC, process.env.LOCKING_PERIOD, token.address);
  const protocol = await Protocol.deploy(process.env.PENALTY_PERC, process.env.LOCKING_PERIOD, token.address);
  await protocol.deployed();
  const Governor = await ethers.getContractFactory("YandaGovernor");
  // Default args is: <address of the YND token>, 5, 5, 1000, [4, 25, 50]
  const governor = await Governor.deploy(
    token.address,
    process.env.VOTING_DELAY,
    process.env.VOTING_PERIOD,
    ethers.utils.parseEther(process.env.PROTOSAL_TRESHOLD),
    [process.env.QUORUM_1, process.env.QUORUM_2, process.env.QUORUM_3]
  );
  
  // const governor = await Governor.deploy(token.address, 17280 /* 1 day */, 17280 /* 1 day */, ethers.utils.parseEther('5000000'), [4, 25, 50]);
  await governor.deployed();
  // Grant governor admin role in the protocol contract
  await protocol.grantRole('0x0000000000000000000000000000000000000000000000000000000000000000', governor.address);

  console.log("YandaToken deployed at:", token.address);
  console.log("YandaMultitokenProtocolV1 deployed at:", protocol.address);
  console.log("YandaGovernor deployed at:", governor.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
