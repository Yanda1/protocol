const { ethers, upgrades } = require("hardhat");
const { EvmRpcProvider } = require("@acala-network/eth-providers");

async function main() {
  /* -------------------------------------------------------------------------------------- */
  // https://github.com/OpenZeppelin/openzeppelin-upgrades/issues/85#issuecomment-1028435049

  // Wrap the provider so we can override fee data.
  const provider = EvmRpcProvider.from('wss://mandala-tc7-rpcnode.aca-dev.network/ws');
  await provider.isReady();
  provider.getFeeData = provider._getEthGas;
  
  // Create the signer for the deployment, connected to the provider with custom fee data func
  const signer = ethers.Wallet.fromMnemonic(process.env.MNEMONIC).connect(provider);
  
  /* -------------------------------------------------------------------------------------- */

  // Deploy YandaToken
  const Token = await ethers.getContractFactory("YandaToken", signer);
  const token = await upgrades.deployProxy(Token);
  await token.deployed();
  console.log('Token deployed')

  // Protocol contract args: penaltyPerc=10, lockingPeriod=51840 (3 days in 5 sec block's amount)
  const Protocol = await ethers.getContractFactory("YandaProtocol", signer);
  const protocol = await upgrades.deployProxy(Protocol, [10, 51840, token.address]);
  await protocol.deployed();
  console.log('Protocol deployed')

  // Deploy YandaGovernor with YandaToken address as argument
  const Governor = await ethers.getContractFactory("YandaGovernor", signer);
  const governor = await Governor.deploy(token.address, 5, 5, ethers.utils.parseEther('1000'), [4, 25, 50]);
  // const governor = await Governor.deploy(token.address, 17280 /* 1 day */, 17280 /* 1 day */, ethers.utils.parseEther('5000000'), [4, 25, 50]);
  await governor.deployed();
  console.log('Governor deployed')

  // Grant governor admin role in the protocol contract
  await protocol.grantRole('0x0000000000000000000000000000000000000000000000000000000000000000', governor.address);

  console.log("YandaToken deployed at:", token.address);
  console.log("YandaProtocol deployed at:", protocol.address);
  console.log("YandaGovernor deployed at:", governor.address);

  await provider.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
