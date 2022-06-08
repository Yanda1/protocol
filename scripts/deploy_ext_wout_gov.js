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
  const ExtProtocol = await ethers.getContractFactory("YandaExtendedProtocol", signer);
  // Default args is: 10, 20736 (3 days in 12.5s blocks), <address of the YND token>
  const ext_protocol = await upgrades.deployProxy(ExtProtocol, [process.env.PENALTY_PERC, process.env.LOCKING_PERIOD, token.address]);
  await ext_protocol.deployed();

  console.log("YandaToken deployed at:", token.address);
  console.log("YandaExtendedProtocol deployed at:", ext_protocol.address);

  await provider.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
