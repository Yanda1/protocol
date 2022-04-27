const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { skipBlocks } = require("../utils/skipBlocks");
const { getTxReceipt } = require("../utils/getTxReceipt");


describe("YandaGovernor Test", function () {
  let accounts;
  let token;
  let protocol;
  let governor;

  beforeEach(async function () {
    // Get all accounts
    accounts = await ethers.getSigners();
    // Deploy YandaToken
    const Token = await ethers.getContractFactory("YandaTokenV2");
    token = await upgrades.deployProxy(Token);
    await token.deployed();
    // Deploy YandaProtocol
    const Protocol = await ethers.getContractFactory("YandaProtocol");
    protocol = await upgrades.deployProxy(Protocol, [10, 51840, token.address]);
    await protocol.deployed();
    // Deploy YandaGovernor with YandaToken address as argument
    const Governor = await ethers.getContractFactory("YandaGovernor");
    governor = await Governor.deploy(token.address, 5, 5, ethers.utils.parseEther('1000'), [4, 25, 50]);
    await governor.deployed();
    // Grant governor admin role in the protocol contract
    await protocol.grantRole('0x0000000000000000000000000000000000000000000000000000000000000000', governor.address);
  });

  it("Create proposal to add new service and fail to reach quorum", async function () {
    // Transfer 1000 YandaToken from token owner to the proposal account(accounts[5])
    var tx = await token.transfer(accounts[5].address, ethers.utils.parseEther('1000'));
    // Wait until the transaction is mined
    var result = await getTxReceipt(tx);
    // Delegate voting power to the same account
    await token.connect(accounts[5]).delegate(accounts[5].address);
    // Transfer 4% of the YandaToken total supply from token owner to the customer account(accounts[6])
    tx = await token.transfer(accounts[6].address, hre.ethers.utils.parseEther('40000000'));
    // Wait until the transaction is mined
    result = await getTxReceipt(tx);
    // Delegate voting power to the same account
    await token.connect(accounts[6]).delegate(accounts[6].address);
    // Create new blocks until delegated voting power will be available
    await skipBlocks(token, 3);
    // Confirm voting power balance is equal to 1000
    var votingPower = await token.getVotes(accounts[5].address);
    expect(ethers.utils.formatEther(votingPower)).to.equal('1000.0');
    // Make proposal for adding a new service
    const transferCalldata = protocol.interface.encodeFunctionData('addService', [accounts[1].address, accounts.map(x => x.address).slice(2, 5)]);
    const newProposalTx = await governor.connect(accounts[5]).propose([protocol.address], [0], [transferCalldata], "Proposal #1: Add new service provider.");
    // Wait until the transaction is mined
    result = await getTxReceipt(newProposalTx);
    // Get proposal ID from the log
    var events = await governor.queryFilter('ProposalCreated');
    const proposalId = events[0].args.proposalId;
    // Check that proposal rank is equal to 1
    expect(await governor.proposalRank(proposalId)).to.equal(1);
    // Create new blocks until proposal gets active
    await skipBlocks(token, 6);
    // Check that state of the proposal is "active"
    expect(await governor.state(proposalId)).to.equal(1);
    // Vote "For" from account 6
    await governor.connect(accounts[6]).castVote(proposalId, 1);
    // Create new blocks until voting period end
    await skipBlocks(token, 6);
    // Check that state of the proposal is "defeated"
    expect(await governor.state(proposalId)).to.equal(3);
  });

  it("Create proposal to add new service and reach quorum", async function () {
    // Transfer 1000 YandaToken from token owner to the proposal account(accounts[5])
    var tx = await token.transfer(accounts[5].address, ethers.utils.parseEther('1000'));
    // Wait until the transaction is mined
    var result = await getTxReceipt(tx);
    // Delegate voting power to the same account
    await token.connect(accounts[5]).delegate(accounts[5].address);
    // Transfer 25% of the YandaToken total supply from token owner to the customer account(accounts[6])
    tx = await token.transfer(accounts[6].address, hre.ethers.utils.parseEther('250000000'));
    // Wait until the transaction is mined
    result = await getTxReceipt(tx);
    // Delegate voting power to the same account
    await token.connect(accounts[6]).delegate(accounts[6].address);
    // Create new blocks until delegated voting power will be available
    await skipBlocks(token, 3);
    // Confirm voting power balance is equal to 1000
    const votingPower = await token.getVotes(accounts[5].address);
    expect(ethers.utils.formatEther(votingPower)).to.equal('1000.0');
    // Make proposal for adding a new service
    const transferCalldata = protocol.interface.encodeFunctionData('addService', [accounts[1].address, accounts.map(x => x.address).slice(2, 5)]);
    const newProposalTx = await governor.connect(accounts[5]).propose([protocol.address], [0], [transferCalldata], "Proposal #1: Add new service provider.");
    // wait until the transaction is mined
    result = await getTxReceipt(newProposalTx);
    // Get proposal ID from the log
    var events = await governor.queryFilter('ProposalCreated');
    const proposalId = events[0].args.proposalId;
    // Check that proposal rank is equal to 1
    expect(await governor.proposalRank(proposalId)).to.equal(1);
    // Create new blocks until proposal gets active
    await skipBlocks(token, 6);
    // Check state of the proposal
    expect(await governor.state(proposalId)).to.equal(1);
    // Vote "For" from account 6
    await governor.connect(accounts[6]).castVote(proposalId, 1);
    // Create new blocks until voting period end
    await skipBlocks(token, 6);
    // Check state of the proposal
    expect(await governor.state(proposalId)).to.equal(4);

  });
});
