const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { getTxReceipt } = require("../utils/getTxReceipt");


async function getValidatorFromTx(contract, tx) {
  const receipt = await getTxReceipt(tx);
  const costRequestEvents = receipt.logs.map((log) => contract.interface.parseLog(log));
  const selectedValidator = costRequestEvents[costRequestEvents.length-1].args.validatorsList[0];
  return selectedValidator;
}

function getValidatorIndex(accounts, selectedAddr) {
  for (let i = 2; i < 5; i++) {
    if (accounts[i].address == selectedAddr) {
      return i;
    }
  }
}

describe("YandaProtocol Test", function () {
  let accounts;
  let token;
  let protocol;

  beforeEach(async function () {
    // Get all accounts
    accounts = await ethers.getSigners();
    // Deploy YandaToken
    const Token = await ethers.getContractFactory("YandaToken");
    token = await upgrades.deployProxy(Token);
    await token.deployed();
    // Deploy YandaProtocol
    const Protocol = await ethers.getContractFactory("YandaProtocol");
    protocol = await upgrades.deployProxy(Protocol, [10, 51840, token.address]);
    await protocol.deployed();

    // Add new service with the admin address of accounts[1] and as validators accounts[2,3,4]
    await protocol.addService(accounts[1].address, accounts.map(x => x.address).slice(2, 5));

    // Transfer 1 YandaToken from token owner to customer account(accounts[5])
    await token.transfer(accounts[5].address, ethers.utils.parseEther('1'));
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
    console.log('');
  });


  it("Create new service and product, declare actions and terminate", async function () {
    // Confirm account #5 balance is equal to 1 YND
    let balance = await token.balanceOf(accounts[5].address);
    expect(ethers.utils.formatEther(balance)).to.equal('1.0');

    // Create process for account #5, cost amount is 1 YandaToken, product id: 123 and data is {"a": 1, "b": 2, "c": 3}
    const newProcessTx = await protocol.connect(accounts[5]).createProcess(accounts[1].address, ethers.utils.id('123'), '{"a": 1, "b": 2, "c": 3}');

    // Retreive validators rand list from the logs
    var selectedValidator = await getValidatorFromTx(protocol, newProcessTx);
    var firstIndex = getValidatorIndex(accounts, selectedValidator);
    
    console.log(`Selected validator accounts[${firstIndex}]`)
    // First process cost setup
    var setCostTx = await protocol.connect(accounts[firstIndex]).setProcessCost(accounts[5].address, ethers.utils.id('123'), ethers.utils.parseEther('1'));
    console.log('Calulated cost is 1 YND')

    // Retreive validators rand list from the logs
    selectedValidator = await getValidatorFromTx(protocol, setCostTx);
    var secondIndex = getValidatorIndex(accounts, selectedValidator);

    console.log(`Selected validator accounts[${secondIndex}]`)
    // Second(confirmation) process cost setup
    await protocol.connect(accounts[secondIndex]).setProcessCost(accounts[5].address, ethers.utils.id('123'), ethers.utils.parseEther('1'));
    console.log('Calulated cost is 1 YND')

    const balanceBefore = await token.balanceOf(protocol.address);
    
    // Make smart contract deposit from account #5
    const depositAmount = ethers.utils.parseEther('1');
    tx = await token.connect(accounts[5]).approve(protocol.address, depositAmount);
    result = await getTxReceipt(tx);
    tx = await protocol.connect(accounts[5]).deposit(depositAmount);
    result = await getTxReceipt(tx);

    // Check contract balance
    const balanceAfter = await token.balanceOf(protocol.address);
    expect(ethers.utils.formatEther(balanceAfter.sub(balanceBefore))).to.equal('1.0');

    // Declare few service produced actions
    await protocol.connect(accounts[1]).declareAction(accounts[5].address, ethers.utils.id('123'), 'First order data');
    await protocol.connect(accounts[1]).declareAction(accounts[5].address, ethers.utils.id('123'), 'Second order data');

    // Customer driven termination process starting for the productId '123'
    const terminateTx = await protocol.connect(accounts[5]).startTermination(accounts[5].address, ethers.utils.id('123'));

    // Retreive validators rand list from the logs
    selectedValidator = await getValidatorFromTx(protocol, terminateTx);
    firstIndex = getValidatorIndex(accounts, selectedValidator);
    
    console.log(`Selected validator accounts[${firstIndex}]`)
    // First validation of the productId "123" for client accounts[5]
    const validateTerminationTx = await protocol.connect(accounts[firstIndex]).validateTermination(accounts[5].address, ethers.utils.id('123'), true);
    console.log('Validated with "true"');

    // Retreive validators rand list from the logs
    selectedValidator = await getValidatorFromTx(protocol, validateTerminationTx);
    secondIndex = getValidatorIndex(accounts, selectedValidator);

    console.log(`Selected validator accounts[${secondIndex}]`)
    // Second validation of the productId "123" for client accounts[5]
    tx = await protocol.connect(accounts[secondIndex]).validateTermination(accounts[5].address, ethers.utils.id('123'), true);
    console.log('Validated with "true"');
    // Confirm that transaction was minted
    var result = await getTxReceipt(tx);

    // Confirm that process state == COMPLETED
    result = await protocol.getProcess(accounts[5].address, ethers.utils.id('123'));
    expect(result.state).to.equal(4);

    // Check service balance after receiving service fee
    balance = await token.balanceOf(accounts[1].address);
    expect(ethers.utils.formatEther(balance)).to.equal('0.8');

    // Check protocol balance
    balance = await token.balanceOf(protocol.address);
    const totalStaked = await protocol.totalStaked();
    expect(ethers.utils.formatEther(balance.sub(totalStaked))).to.equal('0.05');
  });

  it("Penalize one of the validators", async function () {
    // Confirm account #5 balance is equal to 1 YND
    let balance = await token.balanceOf(accounts[5].address);
    expect(ethers.utils.formatEther(balance)).to.equal('1.0');

    // Create process for account #5, cost amount is 1 YandaToken, product id: 123 and data is {"a": 1, "b": 2, "c": 3}
    const newProcessTx = await protocol.connect(accounts[5]).createProcess(accounts[1].address, ethers.utils.id('123'), '{"a": 1, "b": 2, "c": 3}');

    // Retreive validators rand list from the logs
    var selectedValidator = await getValidatorFromTx(protocol, newProcessTx);
    var firstIndex = getValidatorIndex(accounts, selectedValidator);
    
    console.log(`Selected validator accounts[${firstIndex}]`)
    // First process cost setup
    var setCostTx = await protocol.connect(accounts[firstIndex]).setProcessCost(accounts[5].address, ethers.utils.id('123'), ethers.utils.parseEther('2'));
    console.log('Calulated cost is 2 YND')

    // Retreive validators rand list from the logs
    selectedValidator = await getValidatorFromTx(protocol, setCostTx);
    var secondIndex = getValidatorIndex(accounts, selectedValidator);

    console.log(`Selected validator accounts[${secondIndex}]`)
    // Second(confirmation) process cost setup
    setCostTx = await protocol.connect(accounts[secondIndex]).setProcessCost(accounts[5].address, ethers.utils.id('123'), ethers.utils.parseEther('1'));
    console.log('Calulated cost is 1 YND')

    // Retreive validators rand list from the logs
    selectedValidator = await getValidatorFromTx(protocol, setCostTx);
    var thirdIndex = getValidatorIndex(accounts, selectedValidator);

    console.log(`Selected validator accounts[${thirdIndex}]`)
    // Third(confirmation) process cost setup
    await protocol.connect(accounts[thirdIndex]).setProcessCost(accounts[5].address, ethers.utils.id('123'), ethers.utils.parseEther('1'));
    console.log('Calulated cost is 1 YND')
    
    // Make smart contract deposit from account #5
    const depositAmount = ethers.utils.parseEther('1');
    var tx = await token.connect(accounts[5]).approve(protocol.address, depositAmount);
    // Wait until the transaction is mined
    var result = await getTxReceipt(tx);
    await protocol.connect(accounts[5]).deposit(depositAmount);

    // Declare few service produced actions
    await protocol.connect(accounts[1]).declareAction(accounts[5].address, ethers.utils.id('123'), 'First order data');
    await protocol.connect(accounts[1]).declareAction(accounts[5].address, ethers.utils.id('123'), 'Second order data');

    // Customer driven termination process starting for the productId '123'
    const terminateTx = await protocol.connect(accounts[5]).startTermination(accounts[5].address, ethers.utils.id('123'));

    // Retreive validators rand list from the logs
    selectedValidator = await getValidatorFromTx(protocol, terminateTx);
    firstIndex = getValidatorIndex(accounts, selectedValidator);
    
    let stakedBefore = await protocol.stakeOf(accounts[firstIndex].address, accounts[firstIndex].address);

    console.log(`Selected validator accounts[${firstIndex}]`)
    // First validation of the productId "123" for client accounts[5]
    var validateTerminationTx = await protocol.connect(accounts[firstIndex]).validateTermination(accounts[5].address, ethers.utils.id('123'), false);
    console.log('Validated with false');

    // Retreive validators rand list from the logs
    selectedValidator = await getValidatorFromTx(protocol, validateTerminationTx);
    secondIndex = getValidatorIndex(accounts, selectedValidator);

    console.log(`Selected validator accounts[${secondIndex}]`)
    // Second validation of the productId "123" for client accounts[5]
    validateTerminationTx = await protocol.connect(accounts[secondIndex]).validateTermination(accounts[5].address, ethers.utils.id('123'), true);
    console.log('Validated with "true"');

    // Retreive validators rand list from the logs
    selectedValidator = await getValidatorFromTx(protocol, validateTerminationTx);
    thirdIndex = getValidatorIndex(accounts, selectedValidator);

    console.log(`Selected validator accounts[${thirdIndex}]`)
    // Third validation of the productId "123" for client accounts[5]
    tx = await protocol.connect(accounts[thirdIndex]).validateTermination(accounts[5].address, ethers.utils.id('123'), true);
    console.log('Validated with "true"');
    // Wait until the transaction is mined
    result = await getTxReceipt(tx);

    // Check penilized validator balance, is should be 10% less than it was before
    let stakedAfter = await protocol.stakeOf(accounts[firstIndex].address, accounts[firstIndex].address);
    const stakeDiff = stakedBefore.amount.sub(stakedAfter.amount);
    const calculatedPenalty = stakedBefore.amount.div(ethers.BigNumber.from("10"));
    expect(stakeDiff.amount).to.equal(calculatedPenalty.amount);

    // Confirm that process state == COMPLETED
    result = await protocol.getProcess(accounts[5].address, ethers.utils.id('123'));
    expect(result.state).to.equal(4);

    // Check service balance after receiving service fee
    balance = await token.balanceOf(accounts[1].address);
    expect(ethers.utils.formatEther(balance)).to.equal('0.8');
  });

});
