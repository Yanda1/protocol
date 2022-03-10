const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("YandaGovernor Test", function () {
  it("Create proposal to add new service and fail to reach quorum", async function () {
    // Deploy YandaToken
    const Token = await ethers.getContractFactory("YandaTokenV2");
    const token = await upgrades.deployProxy(Token);
    await token.deployed();
    // Deploy YandaGovernor with YandaToken address as argument
    const Governor = await ethers.getContractFactory("YandaGovernor");
    const governor = await Governor.deploy(token.address, 5, 5, hre.ethers.utils.parseEther('1000'), [4, 25, 50]);
    await governor.deployed();
    // Grant admin rights to the governor
    await token.grantRole('0x0000000000000000000000000000000000000000000000000000000000000000', governor.address);
    // Get all accounts
    const accounts = await ethers.getSigners();
    // Transfer 1000 YandaToken from token owner to the proposal account(accounts[5])
    await token.transfer(accounts[5].address, ethers.utils.parseEther('1000'));
    // Delegate voting power to the same account
    await token.connect(accounts[5]).delegate(accounts[5].address);
    // Confirm voting power balance is equal to 1000
    const votingPower = await token.getVotes(accounts[5].address);
    expect(ethers.utils.formatEther(votingPower)).to.equal('1000.0');
    // Make proposal for adding a new service
    const transferCalldata = token.interface.encodeFunctionData('addService', [accounts[1].address, accounts.map(x => x.address).slice(2, 5), 33, 33, 9]);
    const newProposalTx = await governor.connect(accounts[5]).propose([token.address], [0], [transferCalldata], "Proposal #1: Add new service provider.");
    // wait until the transaction is mined
    await newProposalTx.wait();
    // Get proposal ID from the log
    let events = await governor.queryFilter('ProposalCreated');
    const proposalId = events[0].args.proposalId;
    // Check that proposal rank is equal to 1
    expect(await governor.proposalRank(proposalId)).to.equal(1);
    // Transfer 4% of the YandaToken total supply from token owner to the customer account(accounts[6])
    await token.transfer(accounts[6].address, hre.ethers.utils.parseEther('40000000'));
    // Delegate voting power to the same account
    await token.connect(accounts[6]).delegate(accounts[6].address);
    // Create new blocks until proposal gets active
    for (let idx = 0; idx < 4; idx++) {
      await token.connect(accounts[7]).delegate(accounts[7].address);
    }
    // Check state of the proposal
    expect(await governor.state(proposalId)).to.equal(1);
    // Vote "For" from account 6
    await governor.connect(accounts[6]).castVote(proposalId, 1);
    // Create new blocks until voting period end
    for (let idx = 0; idx < 4; idx++) {
      await token.connect(accounts[7]).delegate(accounts[7].address);
    }
    // Check state of the proposal
    expect(await governor.state(proposalId)).to.equal(3);

  });

  it("Create proposal to add new service and reach quorum", async function () {
    // Deploy YandaToken
    const Token = await ethers.getContractFactory("YandaTokenV2");
    const token = await upgrades.deployProxy(Token);
    await token.deployed();
    // Deploy YandaGovernor with YandaToken address as argument
    const Governor = await ethers.getContractFactory("YandaGovernor");
    const governor = await Governor.deploy(token.address, 5, 5, hre.ethers.utils.parseEther('1000'), [4, 25, 50]);
    await governor.deployed();
    // Grant admin rights to the governor
    await token.grantRole('0x0000000000000000000000000000000000000000000000000000000000000000', governor.address);
    // Get all accounts
    const accounts = await ethers.getSigners();
    // Transfer 1000 YandaToken from token owner to the proposal account(accounts[5])
    await token.transfer(accounts[5].address, ethers.utils.parseEther('1000'));
    // Delegate voting power to the same account
    await token.connect(accounts[5]).delegate(accounts[5].address);
    // Confirm voting power balance is equal to 1000
    const votingPower = await token.getVotes(accounts[5].address);
    expect(ethers.utils.formatEther(votingPower)).to.equal('1000.0');
    // Make proposal for adding a new service
    const transferCalldata = token.interface.encodeFunctionData('addService', [accounts[1].address, accounts.map(x => x.address).slice(2, 5), 33, 33, 9]);
    const newProposalTx = await governor.connect(accounts[5]).propose([token.address], [0], [transferCalldata], "Proposal #1: Add new service provider.");
    // wait until the transaction is mined
    await newProposalTx.wait();
    // Get proposal ID from the log
    let events = await governor.queryFilter('ProposalCreated');
    const proposalId = events[0].args.proposalId;
    // Check that proposal rank is equal to 1
    expect(await governor.proposalRank(proposalId)).to.equal(1);
    // Transfer 25% of the YandaToken total supply from token owner to the customer account(accounts[6])
    await token.transfer(accounts[6].address, hre.ethers.utils.parseEther('250000000'));
    // Delegate voting power to the same account
    await token.connect(accounts[6]).delegate(accounts[6].address);
    // Create new blocks until proposal gets active
    for (let idx = 0; idx < 4; idx++) {
      await token.connect(accounts[7]).delegate(accounts[7].address);
    }
    // Check state of the proposal
    expect(await governor.state(proposalId)).to.equal(1);
    // Vote "For" from account 6
    await governor.connect(accounts[6]).castVote(proposalId, 1);
    // Create new blocks until voting period end
    for (let idx = 0; idx < 4; idx++) {
      await token.connect(accounts[7]).delegate(accounts[7].address);
    }
    // Check state of the proposal
    expect(await governor.state(proposalId)).to.equal(4);

  });
});
