const { ethers, upgrades } = require("hardhat");
const { getTxReceipt } = require("../utils/getTxReceipt");

async function main() {
    accounts = await ethers.getSigners();
    // // Deploy YandaToken
    const Token = await ethers.getContractFactory("YandaToken");
    token = await Token.attach('0x3ed62137c5DB927cb137c26455969116BF0c23Cb');
    // await token.deployed();
    // Deploy YandaProtocol
    const Protocol = await ethers.getContractFactory("YandaExtendedProtocolV3");
    protocol = await Protocol.deploy(10, 20736, token.address)
    await protocol.deployed();

    // console.log("YandaToken deployed at:", token.address);
    console.log("YandaExtendedProtocol deployed at:", protocol.address);

    // Add new service with the admin address of accounts[1] and as validators accounts[2,3,4]
    await protocol.addService(accounts[1].address, accounts.map(x => x.address).slice(2, 5));

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
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
