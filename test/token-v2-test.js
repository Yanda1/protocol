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
  it("Create new service and product, declare actions and terminate", async function () {
    // Deploy YandaToken
    const Token = await ethers.getContractFactory("YandaTokenV2");
    const token = await upgrades.deployProxy(Token);
    await token.deployed();
    // Get all accounts
    const accounts = await ethers.getSigners();
    // Add service from account 1, validator accounts is [2,3,4], validators will get 1/3 and the service 1/3, and the rest will burn
    await token.addService(accounts[1].address, [accounts[2].address, accounts[3].address, accounts[4].address], 33, 33, 9);

    // Transfer 10 YandaToken from token owner to the first validator(accounts[2])
    await token.transfer(accounts[2].address, ethers.utils.parseEther('10'));
    // Transfer 20 YandaToken from token owner to the second validator(accounts[3])
    await token.transfer(accounts[3].address, ethers.utils.parseEther('20'));
    // Transfer 30 YandaToken from token owner to the third validator(accounts[4])
    await token.transfer(accounts[4].address, ethers.utils.parseEther('30'));
    // Transfer 1 YandaToken from token owner to customer account(accounts[5])
    await token.transfer(accounts[5].address, ethers.utils.parseEther('1'));

    // Stake 10 YandaToken from the first validator(accounts[2])
    await token.connect(accounts[2]).stake(ethers.utils.parseEther('10'), accounts[2].address);
    // Stake 20 YandaToken from the second validator(accounts[3])
    await token.connect(accounts[3]).stake(ethers.utils.parseEther('20'), accounts[3].address);
    // Stake 30 YandaToken from the third validator(accounts[4])
    await token.connect(accounts[4]).stake(ethers.utils.parseEther('30'), accounts[4].address);

    // Confirm account #5 balance is equal to 1 YND
    let balance = await token.balanceOf(accounts[5].address);
    expect(ethers.utils.formatEther(balance)).to.equal('1.0');

    // Create process for account #5, cost amount is 1 YandaToken, product id: 123 and data is {"a": 1, "b": 2, "c": 3}
    await token.connect(accounts[5]).createProcess(accounts[1].address, ethers.utils.id('123'), '{"a": 1, "b": 2, "c": 3}');

    // Retreive validators rand list from the logs
    let costRequestEvents = await token.queryFilter('CostRequest');
    let selectedValidator = costRequestEvents[costRequestEvents.length-1].args.validatorsList[0];
    let firstIndex = getValidatorIndex(accounts, selectedValidator);
    
    console.log(`Selected validator accounts[${firstIndex}]`)
    // First process cost setup
    await token.connect(accounts[firstIndex]).setProcessCost(accounts[5].address, ethers.utils.id('123'), ethers.utils.parseEther('1'));
    console.log('Calulated cost 1')

    // Retreive validators rand list from the logs
    costRequestEvents = await token.queryFilter('CostRequest');
    selectedValidator = costRequestEvents[costRequestEvents.length-1].args.validatorsList[0];
    let secondIndex = getValidatorIndex(accounts, selectedValidator);

    console.log(`Selected validator accounts[${secondIndex}]`)
    // Second(confirmation) process cost setup
    await token.connect(accounts[secondIndex]).setProcessCost(accounts[5].address, ethers.utils.id('123'), ethers.utils.parseEther('1'));
    console.log('Calulated cost 1')

    let balanceBefore = await token.balanceOf(token.address);
    
    // Make smart contract deposit from account #5
    await token.connect(accounts[5]).transfer(token.address, ethers.utils.parseEther('1'));

    // Check contract balance
    let balanceAfter = await token.balanceOf(token.address);
    expect(ethers.utils.formatEther(balanceAfter.sub(balanceBefore))).to.equal('1.0');

    // Declare few service produced actions
    await token.connect(accounts[1]).declareAction(accounts[5].address, ethers.utils.id('123'), 'First order data');
    await token.connect(accounts[1]).declareAction(accounts[5].address, ethers.utils.id('123'), 'Second order data');

    // Customer driven termination process starting for the productId '123'
    await token.connect(accounts[5]).startTermination(accounts[5].address, ethers.utils.id('123'));

    // Retreive validators rand list from the logs
    let terminateEvents = await token.queryFilter('Terminate');
    selectedValidator = terminateEvents[terminateEvents.length-1].args.validatorsList[0];
    firstIndex = getValidatorIndex(accounts, selectedValidator);
    
    console.log(`Selected validator accounts[${firstIndex}]`)
    // First validation of the productId "123" for client accounts[5]
    await token.connect(accounts[firstIndex]).validateTermination(accounts[5].address, ethers.utils.id('123'), true);
    console.log('Validated with true');

    // Retreive validators rand list from the logs
    terminateEvents = await token.queryFilter('Terminate');
    selectedValidator = terminateEvents[terminateEvents.length-1].args.validatorsList[0];
    secondIndex = getValidatorIndex(accounts, selectedValidator);

    console.log(`Selected validator accounts[${secondIndex}]`)
    // Second validation of the productId "123" for client accounts[5]
    await token.connect(accounts[secondIndex]).validateTermination(accounts[5].address, ethers.utils.id('123'), true);
    console.log('Validated with true');

    // Confirm that process state == COMPLETED
    result = await token.getProcess(accounts[5].address, ethers.utils.id('123'));
    expect(result.state).to.equal(4);

    // Check service balance after receiving service fee
    balance = await token.balanceOf(accounts[1].address);
    expect(ethers.utils.formatEther(balance)).to.equal('0.33');

    // Check token total supply after burning 34% of the product cost
    let supply = await token.totalSupply();
    expect(ethers.utils.formatEther(supply)).to.equal('999999999.66');
  });
  it("Penalize one of the validators", async function () {
    // Deploy YandaToken
    const Token = await ethers.getContractFactory("YandaTokenV2");
    const token = await upgrades.deployProxy(Token);
    await token.deployed();
    // Get all accounts
    const accounts = await ethers.getSigners();
    // Add service from account 1, validator accounts is [2,3,4], validators will get 1/3 and the service 1/3, and the rest will burn
    await token.addService(accounts[1].address, [accounts[2].address, accounts[3].address, accounts[4].address], 33, 33, 9);

    // Transfer 10 YandaToken from token owner to the first validator(accounts[2])
    await token.transfer(accounts[2].address, ethers.utils.parseEther('10'));
    // Transfer 20 YandaToken from token owner to the second validator(accounts[3])
    await token.transfer(accounts[3].address, ethers.utils.parseEther('20'));
    // Transfer 30 YandaToken from token owner to the third validator(accounts[4])
    await token.transfer(accounts[4].address, ethers.utils.parseEther('30'));
    // Transfer 1 YandaToken from token owner to customer account(accounts[5])
    await token.transfer(accounts[5].address, ethers.utils.parseEther('1'));

    // Stake 10 YandaToken from the first validator(accounts[2])
    await token.connect(accounts[2]).stake(ethers.utils.parseEther('10'), accounts[2].address);
    // Stake 20 YandaToken from the second validator(accounts[3])
    await token.connect(accounts[3]).stake(ethers.utils.parseEther('20'), accounts[3].address);
    // Stake 30 YandaToken from the third validator(accounts[4])
    await token.connect(accounts[4]).stake(ethers.utils.parseEther('30'), accounts[4].address);

    // Confirm account #5 balance is equal to 1 YND
    let balance = await token.balanceOf(accounts[5].address);
    expect(ethers.utils.formatEther(balance)).to.equal('1.0');

    // Create process for account #5, cost amount is 1 YandaToken, product id: 123 and data is {"a": 1, "b": 2, "c": 3}
    await token.connect(accounts[5]).createProcess(accounts[1].address, ethers.utils.id('123'), '{"a": 1, "b": 2, "c": 3}');

    // Retreive validators rand list from the logs
    let costRequestEvents = await token.queryFilter('CostRequest');
    let selectedValidator = costRequestEvents[costRequestEvents.length-1].args.validatorsList[0];
    let firstIndex = getValidatorIndex(accounts, selectedValidator);
    
    console.log(`Selected validator accounts[${firstIndex}]`)
    // First process cost setup
    await token.connect(accounts[firstIndex]).setProcessCost(accounts[5].address, ethers.utils.id('123'), ethers.utils.parseEther('2'));
    console.log('Calulated cost 2')

    // Retreive validators rand list from the logs
    costRequestEvents = await token.queryFilter('CostRequest');
    selectedValidator = costRequestEvents[costRequestEvents.length-1].args.validatorsList[0];
    let secondIndex = getValidatorIndex(accounts, selectedValidator);

    console.log(`Selected validator accounts[${secondIndex}]`)
    // Second(confirmation) process cost setup
    await token.connect(accounts[secondIndex]).setProcessCost(accounts[5].address, ethers.utils.id('123'), ethers.utils.parseEther('1'));
    console.log('Calulated cost 1')

    // Retreive validators rand list from the logs
    costRequestEvents = await token.queryFilter('CostRequest');
    selectedValidator = costRequestEvents[costRequestEvents.length-1].args.validatorsList[0];
    let thirdIndex = getValidatorIndex(accounts, selectedValidator);

    console.log(`Selected validator accounts[${thirdIndex}]`)
    // Second(confirmation) process cost setup
    await token.connect(accounts[thirdIndex]).setProcessCost(accounts[5].address, ethers.utils.id('123'), ethers.utils.parseEther('1'));
    console.log('Calulated cost 1')
    
    // Make smart contract deposit from account #5
    await token.connect(accounts[5]).transfer(token.address, ethers.utils.parseEther('1'));

    // Declare few service produced actions
    await token.connect(accounts[1]).declareAction(accounts[5].address, ethers.utils.id('123'), 'First order data');
    await token.connect(accounts[1]).declareAction(accounts[5].address, ethers.utils.id('123'), 'Second order data');

    // Customer driven termination process starting for the productId '123'
    await token.connect(accounts[5]).startTermination(accounts[5].address, ethers.utils.id('123'));

    // Retreive validators rand list from the logs
    let terminateEvents = await token.queryFilter('Terminate');
    selectedValidator = terminateEvents[terminateEvents.length-1].args.validatorsList[0];
    firstIndex = getValidatorIndex(accounts, selectedValidator);
    
    let stakedBefore = await token.stakeOf(accounts[firstIndex].address, accounts[firstIndex].address);

    console.log(`Selected validator accounts[${firstIndex}]`)
    // First validation of the productId "123" for client accounts[5]
    await token.connect(accounts[firstIndex]).validateTermination(accounts[5].address, ethers.utils.id('123'), false);
    console.log('Validated with false');

    // Retreive validators rand list from the logs
    terminateEvents = await token.queryFilter('Terminate');
    selectedValidator = terminateEvents[terminateEvents.length-1].args.validatorsList[0];
    secondIndex = getValidatorIndex(accounts, selectedValidator);

    console.log(`Selected validator accounts[${secondIndex}]`)
    // Second validation of the productId "123" for client accounts[5]
    await token.connect(accounts[secondIndex]).validateTermination(accounts[5].address, ethers.utils.id('123'), true);
    console.log('Validated with true');

    // Retreive validators rand list from the logs
    terminateEvents = await token.queryFilter('Terminate');
    selectedValidator = terminateEvents[terminateEvents.length-1].args.validatorsList[0];
    thirdIndex = getValidatorIndex(accounts, selectedValidator);

    console.log(`Selected validator accounts[${thirdIndex}]`)
    // Third validation of the productId "123" for client accounts[5]
    await token.connect(accounts[thirdIndex]).validateTermination(accounts[5].address, ethers.utils.id('123'), true);
    console.log('Validated with true');

    // Check penilized validator balance
    let stakedAfter = await token.stakeOf(accounts[firstIndex].address, accounts[firstIndex].address);
    expect(stakedBefore.amount.sub(stakedAfter.amount)).to.equal(stakedBefore.amount.div(ethers.BigNumber.from("10")));

    // Confirm that process state == COMPLETED
    result = await token.getProcess(accounts[5].address, ethers.utils.id('123'));
    expect(result.state).to.equal(4);

    // Check service balance after receiving service fee
    balance = await token.balanceOf(accounts[1].address);
    expect(ethers.utils.formatEther(balance)).to.equal('0.33');

    // Check token total supply after burning 34% of the product cost
    let supply = await token.totalSupply();
    expect(ethers.utils.formatEther(supply)).to.equal('999999999.66');
  });

});
