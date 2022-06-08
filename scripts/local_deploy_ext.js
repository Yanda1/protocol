const { ethers, upgrades } = require("hardhat");
const { getTxReceipt } = require("../utils/getTxReceipt");
const { EvmRpcProvider } = require("@acala-network/eth-providers");

async function main() {
    const accounts = await ethers.getSigners();
    // Wrap the provider so we can override fee data.
    const provider = EvmRpcProvider.from('ws://localhost:9944');
    await provider.isReady();
    provider.getFeeData = provider._getEthGas;

    // Create the signer for the deployment, connected to the provider with custom fee data func
    const signer = ethers.Wallet.fromMnemonic(process.env.LOCAL_MNEMONIC).connect(provider);

    // Deploy YandaToken
    const Token = await ethers.getContractFactory("YandaToken", signer);
    token = await upgrades.deployProxy(Token);
    await token.deployed();
    // Deploy YandaProtocol
    const Protocol = await ethers.getContractFactory("YandaExtendedProtocol", signer);
    protocol = await upgrades.deployProxy(Protocol, [10, 50, token.address]);
    await protocol.deployed();

    console.log("YandaToken deployed at:", token.address);
    console.log("YandaExtendedProtocol deployed at:", protocol.address);

    // Add new service with the admin address of accounts[1] and as validators accounts[2,3,4]
    await protocol.addService(accounts[1].address, accounts[0].address, accounts.map(x => x.address).slice(2, 5));

    // Transfer 10 YandaToken from token owner to the first validator(accounts[2])
    await token.transfer(accounts[2].address, ethers.utils.parseEther('10'));
    // Transfer 20 YandaToken from token owner to the second validator(accounts[3])
    await token.transfer(accounts[3].address, ethers.utils.parseEther('20'));
    // Transfer 30 YandaToken from token owner to the third validator(accounts[4])
    await token.transfer(accounts[4].address, ethers.utils.parseEther('30'));

    var stakeAmount = ethers.utils.parseEther('10');
    var tx = await token.connect(accounts[2]).approve(protocol.address, stakeAmount);
    // Wait until the transaction is mined
    var result = await getTxReceipt(tx);
    // Stake 10 YandaToken from the first validator(accounts[2])
    await protocol.connect(accounts[2]).stake(accounts[2].address, stakeAmount);
    stakeAmount = ethers.utils.parseEther('20');
    tx = await token.connect(accounts[3]).approve(protocol.address, stakeAmount);
    // Wait until the transaction is mined
    result = await getTxReceipt(tx);
    // Stake 20 YandaToken from the second validator(accounts[3])
    await protocol.connect(accounts[3]).stake(accounts[3].address, stakeAmount);
    stakeAmount = ethers.utils.parseEther('30');
    tx = await token.connect(accounts[4]).approve(protocol.address, stakeAmount);
    // Wait until the transaction is mined
    result = await getTxReceipt(tx);
    // Stake 30 YandaToken from the third validator(accounts[4])
    await protocol.connect(accounts[4]).stake(accounts[4].address, stakeAmount);
    result = await getTxReceipt(tx);

    await provider.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
