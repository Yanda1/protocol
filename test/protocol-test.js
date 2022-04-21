const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

function getValidatorIndex(accounts, selectedAddr) {
  for (let i = 2; i < 5; i++) {
    if (accounts[i].address == selectedAddr) {
      return i;
    }
  }
}

describe("YandaTokenV2 Test", function () {
  let accounts;
  let token;
  let protocol;

  beforeEach(async function () {
    // Get all accounts
    accounts = await ethers.getSigners();
    // Deploy YandaToken
    const Token = await ethers.getContractFactory("YandaTokenV2");
    const token = await upgrades.deployProxy(Token);
    await token.deployed();
    // Deploy YandaProtocol
    const Protocol = await ethers.getContractFactory("YandaProtocol");
    const protocol = await upgrades.deployProxy(Protocol, [10, 51840, token.address]);
    await protocol.deployed();
    // Add new service with the admin address of accounts[1] and as validators accounts[2,3,4]
    await protocol.addService(accounts[1].address, accounts.map(x => x.address).slice(2, 5), 33, 33, 9);
  });

  it("Create new service and product, declare actions and terminate", async function () {
    // Transfer 10 YandaToken from token owner to the first validator(accounts[2])
    await token.transfer(accounts[2].address, ethers.utils.parseEther('10'));
    // Transfer 20 YandaToken from token owner to the second validator(accounts[3])
    await token.transfer(accounts[3].address, ethers.utils.parseEther('20'));
    // Transfer 30 YandaToken from token owner to the third validator(accounts[4])
    await token.transfer(accounts[4].address, ethers.utils.parseEther('30'));
    // Transfer 1 YandaToken from token owner to customer account(accounts[5])
    await token.transfer(accounts[5].address, ethers.utils.parseEther('1'));

    // Stake 10 YandaToken from the first validator(accounts[2])
    var stakeAmount = ethers.utils.parseEther('10');
    await token.connect(accounts[2]).approve(protocol.address, stakeAmount);
    await protocol.connect(accounts[2]).stake(accounts[2].address, stakeAmount);
    // Stake 20 YandaToken from the second validator(accounts[3])
    stakeAmount = ethers.utils.parseEther('20');
    await token.connect(accounts[3]).approve(protocol.address, stakeAmount);
    await protocol.connect(accounts[3]).stake(accounts[3].address, stakeAmount);
    // Stake 30 YandaToken from the third validator(accounts[4])
    stakeAmount = ethers.utils.parseEther('30');
    await token.connect(accounts[4]).approve(protocol.address, stakeAmount);
    await protocol.connect(accounts[4]).stake(accounts[4].address, stakeAmount);

    // Confirm account #5 balance is equal to 1 YND
    let balance = await token.balanceOf(accounts[5].address);
    expect(ethers.utils.formatEther(balance)).to.equal('1.0');

    // Create process for account #5, cost amount is 1 YandaToken, product id: 123 and data is {"a": 1, "b": 2, "c": 3}
    const newProcessTx = await protocol.connect(accounts[5]).createProcess(accounts[1].address, ethers.utils.id('123'), '{"a": 1, "b": 2, "c": 3}');

    // Retreive validators rand list from the logs
    let costRequestEvents = await protocol.queryFilter('CostRequest');
    var selectedValidator = costRequestEvents[costRequestEvents.length-1].args.validatorsList[0];
    var firstIndex = getValidatorIndex(accounts, selectedValidator);
    
    console.log(`Selected validator accounts[${firstIndex}]`)
    // First process cost setup
    var setCostTx = await protocol.connect(accounts[firstIndex]).setProcessCost(accounts[5].address, ethers.utils.id('123'), ethers.utils.parseEther('1'));
    console.log('Calulated cost is 1 YND')

    // Retreive validators rand list from the logs
    costRequestEvents = await protocol.queryFilter('CostRequest');
    selectedValidator = costRequestEvents[costRequestEvents.length-1].args.validatorsList[0];
    var secondIndex = getValidatorIndex(accounts, selectedValidator);

    console.log(`Selected validator accounts[${secondIndex}]`)
    // Second(confirmation) process cost setup
    await protocol.connect(accounts[secondIndex]).setProcessCost(accounts[5].address, ethers.utils.id('123'), ethers.utils.parseEther('1'));
    console.log('Calulated cost is 1 YND')

    const balanceBefore = await token.balanceOf(protocol.address);
    
    // Make smart contract deposit from account #5
    const depositAmount = ethers.utils.parseEther('1');
    await token.connect(accounts[5]).approve(protocol.address, depositAmount);
    await protocol.connect(accounts[5]).deposit(depositAmount);

    // Check contract balance
    const balanceAfter = await token.balanceOf(protocol.address);
    expect(ethers.utils.formatEther(balanceAfter.sub(balanceBefore))).to.equal('1.0');

    // Declare few service produced actions
    await protocol.connect(accounts[1]).declareAction(accounts[5].address, ethers.utils.id('123'), 'First order data');
    await protocol.connect(accounts[1]).declareAction(accounts[5].address, ethers.utils.id('123'), 'Second order data');

    // Customer driven termination process starting for the productId '123'
    const terminateTx = await protocol.connect(accounts[5]).startTermination(accounts[5].address, ethers.utils.id('123'));

    // Retreive validators rand list from the logs
    let terminateEvents = await protocol.queryFilter('Terminate');
    selectedValidator = terminateEvents[terminateEvents.length-1].args.validatorsList[0];
    firstIndex = getValidatorIndex(accounts, selectedValidator);
    
    console.log(`Selected validator accounts[${firstIndex}]`)
    // First validation of the productId "123" for client accounts[5]
    const validateTerminationTx = await protocol.connect(accounts[firstIndex]).validateTermination(accounts[5].address, ethers.utils.id('123'), true);
    console.log('Validated with "true"');

    // Retreive validators rand list from the logs
    terminateEvents = await protocol.queryFilter('Terminate');
    selectedValidator = terminateEvents[terminateEvents.length-1].args.validatorsList[0];
    secondIndex = getValidatorIndex(accounts, selectedValidator);

    console.log(`Selected validator accounts[${secondIndex}]`)
    // Second validation of the productId "123" for client accounts[5]
    await protocol.connect(accounts[secondIndex]).validateTermination(accounts[5].address, ethers.utils.id('123'), true);
    console.log('Validated with "true"');

    // Confirm that process state == COMPLETED
    result = await protocol.getProcess(accounts[5].address, ethers.utils.id('123'));
    expect(result.state).to.equal(4);

    // Check service balance after receiving service fee
    balance = await token.balanceOf(accounts[1].address);
    expect(ethers.utils.formatEther(balance)).to.equal('0.33');

    // Check protocol balance
    balance = await token.balanceOf(protocol.address);
    const totalStaked = await protocol.totalStaked();
    expect(ethers.utils.formatEther(balance.sub(totalStaked))).to.equal('0.34');
  });

  it("Penalize one of the validators", async function () {
    // Transfer 10 YandaToken from token owner to the first validator(accounts[2])
    await token.transfer(accounts[2].address, ethers.utils.parseEther('10'));
    // Transfer 20 YandaToken from token owner to the second validator(accounts[3])
    await token.transfer(accounts[3].address, ethers.utils.parseEther('20'));
    // Transfer 30 YandaToken from token owner to the third validator(accounts[4])
    await token.transfer(accounts[4].address, ethers.utils.parseEther('30'));
    // Transfer 1 YandaToken from token owner to customer account(accounts[5])
    await token.transfer(accounts[5].address, ethers.utils.parseEther('1'));

    // Stake 10 YandaToken from the first validator(accounts[2])
    var stakeAmount = ethers.utils.parseEther('10');
    await token.connect(accounts[2]).approve(protocol.address, stakeAmount);
    await protocol.connect(accounts[2]).stake(accounts[2].address, stakeAmount);
    // Stake 20 YandaToken from the second validator(accounts[3])
    stakeAmount = ethers.utils.parseEther('20');
    await token.connect(accounts[3]).approve(protocol.address, stakeAmount);
    await protocol.connect(accounts[3]).stake(accounts[3].address, stakeAmount);
    // Stake 30 YandaToken from the third validator(accounts[4])
    stakeAmount = ethers.utils.parseEther('30');
    await token.connect(accounts[4]).approve(protocol.address, stakeAmount);
    await protocol.connect(accounts[4]).stake(accounts[4].address, stakeAmount);

    // Confirm account #5 balance is equal to 1 YND
    let balance = await token.balanceOf(accounts[5].address);
    expect(ethers.utils.formatEther(balance)).to.equal('1.0');

    // Create process for account #5, cost amount is 1 YandaToken, product id: 123 and data is {"a": 1, "b": 2, "c": 3}
    const newProcessTx = await protocol.connect(accounts[5]).createProcess(accounts[1].address, ethers.utils.id('123'), '{"a": 1, "b": 2, "c": 3}');

    // Retreive validators rand list from the logs
    let costRequestEvents = await protocol.queryFilter('CostRequest');
    var selectedValidator = costRequestEvents[costRequestEvents.length-1].args.validatorsList[0];
    var firstIndex = getValidatorIndex(accounts, selectedValidator);
    
    console.log(`Selected validator accounts[${firstIndex}]`)
    // First process cost setup
    var setCostTx = await protocol.connect(accounts[firstIndex]).setProcessCost(accounts[5].address, ethers.utils.id('123'), ethers.utils.parseEther('2'));
    console.log('Calulated cost is 2 YND')

    // Retreive validators rand list from the logs
    costRequestEvents = await protocol.queryFilter('CostRequest');
    selectedValidator = costRequestEvents[costRequestEvents.length-1].args.validatorsList[0];
    var secondIndex = getValidatorIndex(accounts, selectedValidator);

    console.log(`Selected validator accounts[${secondIndex}]`)
    // Second(confirmation) process cost setup
    setCostTx = await protocol.connect(accounts[secondIndex]).setProcessCost(accounts[5].address, ethers.utils.id('123'), ethers.utils.parseEther('1'));
    console.log('Calulated cost is 1 YND')

    // Retreive validators rand list from the logs
    costRequestEvents = await protocol.queryFilter('CostRequest');
    selectedValidator = costRequestEvents[costRequestEvents.length-1].args.validatorsList[0];
    var thirdIndex = getValidatorIndex(accounts, selectedValidator);

    console.log(`Selected validator accounts[${thirdIndex}]`)
    // Third(confirmation) process cost setup
    await protocol.connect(accounts[thirdIndex]).setProcessCost(accounts[5].address, ethers.utils.id('123'), ethers.utils.parseEther('1'));
    console.log('Calulated cost is 1 YND')
    
    // Make smart contract deposit from account #5
    const depositAmount = ethers.utils.parseEther('1');
    await token.connect(accounts[5]).approve(protocol.address, depositAmount);
    await protocol.connect(accounts[5]).deposit(depositAmount);

    // Declare few service produced actions
    await protocol.connect(accounts[1]).declareAction(accounts[5].address, ethers.utils.id('123'), 'First order data');
    await protocol.connect(accounts[1]).declareAction(accounts[5].address, ethers.utils.id('123'), 'Second order data');

    // Customer driven termination process starting for the productId '123'
    const terminateTx = await protocol.connect(accounts[5]).startTermination(accounts[5].address, ethers.utils.id('123'));

    // Retreive validators rand list from the logs
    let terminateEvents = await protocol.queryFilter('Terminate');
    selectedValidator = terminateEvents[terminateEvents.length-1].args.validatorsList[0];
    firstIndex = getValidatorIndex(accounts, selectedValidator);
    
    let stakedBefore = await protocol.stakeOf(accounts[firstIndex].address, accounts[firstIndex].address);

    console.log(`Selected validator accounts[${firstIndex}]`)
    // First validation of the productId "123" for client accounts[5]
    var validateTerminationTx = await protocol.connect(accounts[firstIndex]).validateTermination(accounts[5].address, ethers.utils.id('123'), false);
    console.log('Validated with false');

    // Retreive validators rand list from the logs
    terminateEvents = await protocol.queryFilter('Terminate');
    selectedValidator = terminateEvents[terminateEvents.length-1].args.validatorsList[0];
    secondIndex = getValidatorIndex(accounts, selectedValidator);

    console.log(`Selected validator accounts[${secondIndex}]`)
    // Second validation of the productId "123" for client accounts[5]
    validateTerminationTx = await protocol.connect(accounts[secondIndex]).validateTermination(accounts[5].address, ethers.utils.id('123'), true);
    console.log('Validated with "true"');

    // Retreive validators rand list from the logs
    terminateEvents = await protocol.queryFilter('Terminate');
    selectedValidator = terminateEvents[terminateEvents.length-1].args.validatorsList[0];
    thirdIndex = getValidatorIndex(accounts, selectedValidator);

    console.log(`Selected validator accounts[${thirdIndex}]`)
    // Third validation of the productId "123" for client accounts[5]
    await protocol.connect(accounts[thirdIndex]).validateTermination(accounts[5].address, ethers.utils.id('123'), true);
    console.log('Validated with "true"');

    // Check penilized validator balance
    let stakedAfter = await protocol.stakeOf(accounts[firstIndex].address, accounts[firstIndex].address);
    expect(stakedBefore.amount.sub(stakedAfter.amount)).to.equal(stakedBefore.amount.div(ethers.BigNumber.from("10")));

    // Confirm that process state == COMPLETED
    result = await protocol.getProcess(accounts[5].address, ethers.utils.id('123'));
    expect(result.state).to.equal(4);

    // Check service balance after receiving service fee
    balance = await token.balanceOf(accounts[1].address);
    expect(ethers.utils.formatEther(balance)).to.equal('0.33');
  });

});
