const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { getTxReceipt } = require("../utils/getTxReceipt");

const PERC_DENOMIDATOR = ethers.BigNumber.from("100")
const VALIDATORS_PERC = ethers.BigNumber.from("15");
const BROKER_PERC = ethers.BigNumber.from("80");
const PROTOCOL_PERC = PERC_DENOMIDATOR.sub(VALIDATORS_PERC).sub(BROKER_PERC);
const FEE_NOMINATOR = ethers.BigNumber.from("2");
const FEE_DENOMINATOR = ethers.BigNumber.from("1000");
const PENALTY_PERC = 10;
const DEPOSIT_TOKEN_DECIMALS = 6
const DEPOSIT_AMOUNT = "83.1"

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

describe("YandaMultitokenProtocolV1 Test", function () {
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
    // Deploy Deposit Token
    const DepositToken = await ethers.getContractFactory("DepositableERC20");
    depositToken = await DepositToken.deploy();
    await depositToken.deployed();
    // Deploy YandaProtocol
    const Protocol = await ethers.getContractFactory("YandaMultitokenProtocolV1");
    protocol = await Protocol.deploy(PENALTY_PERC, 51840, token.address);
    await protocol.deployed();

    // Add new service with the admin address of accounts[1] and as validators accounts[2,3,4]
    await protocol.addService(accounts[1].address, accounts.map(x => x.address).slice(2, 5));

    // Transfer 10 Deposit Token from token owner to customer account(accounts[5])
    await depositToken.transfer(accounts[5].address, ethers.utils.parseUnits(DEPOSIT_AMOUNT, DEPOSIT_TOKEN_DECIMALS));
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


  it("ERC20 Token - Create new service and product, declare actions and terminate", async function () {
    // Confirm account #5 balance is equal to DEPOSIT_AMOUNT of DTK
    let balance = await depositToken.balanceOf(accounts[5].address);
    expect(ethers.utils.formatUnits(balance, DEPOSIT_TOKEN_DECIMALS)).to.equal(DEPOSIT_AMOUNT);

    // Create process for account #5, deposit token addr is depositToken.address, service provider addr is accounts[1].addres, product id: 123 and data is {"a": 1, "b": 2, "c": 3}
    const newProcessTx = await protocol.connect(accounts[5])['createProcess(address,address,bytes32,string)'](depositToken.address, accounts[1].address, ethers.utils.id('123'), '{"a": 1, "b": 2, "c": 3}');

    // Retreive validators rand list from the logs
    var selectedValidator = await getValidatorFromTx(protocol, newProcessTx);
    var firstIndex = getValidatorIndex(accounts, selectedValidator);
    
    console.log(`Selected validator accounts[${firstIndex}]`)
    // First process cost setup
    var setCostTx = await protocol.connect(accounts[firstIndex]).setProcessCost(accounts[5].address, ethers.utils.id('123'), ethers.utils.parseUnits(DEPOSIT_AMOUNT, DEPOSIT_TOKEN_DECIMALS), accounts[6].address);
    console.log(`Calulated cost is ${DEPOSIT_AMOUNT} DTK`)

    // Retreive validators rand list from the logs
    selectedValidator = await getValidatorFromTx(protocol, setCostTx);
    var secondIndex = getValidatorIndex(accounts, selectedValidator);

    console.log(`Selected validator accounts[${secondIndex}]`)
    // Second(confirmation) process cost setup
    await protocol.connect(accounts[secondIndex]).setProcessCost(accounts[5].address, ethers.utils.id('123'), ethers.utils.parseUnits(DEPOSIT_AMOUNT, DEPOSIT_TOKEN_DECIMALS), accounts[6].address);
    console.log(`Calulated cost is ${DEPOSIT_AMOUNT} DTK`)

    const constracBalanceBefore = await depositToken.balanceOf(protocol.address);;
    const serviceBalanceBefore = await depositToken.balanceOf(accounts[1].address);
    const depositBalanceBefore = await depositToken.balanceOf(accounts[6].address);

    // Make smart contract deposit from account #5
    const depositAmount = ethers.utils.parseUnits(DEPOSIT_AMOUNT, DEPOSIT_TOKEN_DECIMALS);
    tx = await depositToken.connect(accounts[5]).approve(protocol.address, depositAmount);
    result = await getTxReceipt(tx);
    tx = await protocol.connect(accounts[5]).deposit(depositAmount);
    result = await getTxReceipt(tx);
    console.log('Customer made the deposit.');

    // Check service provider native asset balance after the deposit but before fee distribution (0.998 if deposit equals to 1 ETH)
    const depositBalanceAfter = await depositToken.balanceOf(accounts[6].address);
    expect(depositBalanceAfter.sub(depositBalanceBefore).amount).to.equal(depositAmount.mul(FEE_DENOMINATOR.sub(FEE_NOMINATOR)).div(FEE_DENOMINATOR).amount);

    // Check contract balance
    const constracBalanceAfter = await depositToken.balanceOf(protocol.address);
    expect(constracBalanceBefore.add(depositAmount.mul(FEE_NOMINATOR).div(FEE_DENOMINATOR)).amount).to.equal(constracBalanceAfter.amount);

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
    balance = await depositToken.balanceOf(accounts[1].address);
    // Default Broker reward share is 80% from 0.2% => DEPOSIT_AMOUNT * 0.002 * 0.8
    expect(ethers.utils.formatUnits(balance.sub(serviceBalanceBefore), DEPOSIT_TOKEN_DECIMALS)).to.equal((Number(DEPOSIT_AMOUNT) * Number('0.002') * Number('0.8')).toString());

    // Check protocol balance
    balance = await depositToken.balanceOf(protocol.address);
    expect(ethers.utils.formatUnits(balance, DEPOSIT_TOKEN_DECIMALS)).to.equal('0.0');
  });

  it("ERC20 Token - Penalize one of the validators", async function () {
    // Confirm account #5 balance is equal to DEPOSIT_AMOUNT of DTK
    let balance = await depositToken.balanceOf(accounts[5].address);
    expect(ethers.utils.formatUnits(balance, DEPOSIT_TOKEN_DECIMALS)).to.equal(DEPOSIT_AMOUNT);

    // Create process for account #5, deposit token addr is depositToken.address, service provider addr is accounts[1].addres, product id: 123 and data is {"a": 1, "b": 2, "c": 3}
    const newProcessTx = await protocol.connect(accounts[5])['createProcess(address,address,bytes32,string)'](depositToken.address, accounts[1].address, ethers.utils.id('123'), '{"a": 1, "b": 2, "c": 3}');

    // Retreive validators rand list from the logs
    var selectedValidator = await getValidatorFromTx(protocol, newProcessTx);
    var firstIndex = getValidatorIndex(accounts, selectedValidator);
    
    console.log(`Selected validator accounts[${firstIndex}]`)
    // First process cost setup
    var setCostTx = await protocol.connect(accounts[firstIndex]).setProcessCost(accounts[5].address, ethers.utils.id('123'), ethers.utils.parseUnits(DEPOSIT_AMOUNT, DEPOSIT_TOKEN_DECIMALS), accounts[6].address);
    console.log(`Calulated cost is ${DEPOSIT_AMOUNT} DTK`)

    // Retreive validators rand list from the logs
    selectedValidator = await getValidatorFromTx(protocol, setCostTx);
    var secondIndex = getValidatorIndex(accounts, selectedValidator);

    console.log(`Selected validator accounts[${secondIndex}]`)
    // Second(confirmation) process cost setup
    await protocol.connect(accounts[secondIndex]).setProcessCost(accounts[5].address, ethers.utils.id('123'), ethers.utils.parseUnits(DEPOSIT_AMOUNT, DEPOSIT_TOKEN_DECIMALS), accounts[6].address);
    console.log(`Calulated cost is ${DEPOSIT_AMOUNT} DTK`)

    const constracBalanceBefore = await depositToken.balanceOf(protocol.address);;
    const serviceBalanceBefore = await depositToken.balanceOf(accounts[1].address);
    const depositBalanceBefore = await depositToken.balanceOf(accounts[6].address);
    
    // Make smart contract deposit from account #5
    const depositAmount = ethers.utils.parseUnits(DEPOSIT_AMOUNT, DEPOSIT_TOKEN_DECIMALS);
    tx = await depositToken.connect(accounts[5]).approve(protocol.address, depositAmount);
    result = await getTxReceipt(tx);
    tx = await protocol.connect(accounts[5]).deposit(depositAmount);
    result = await getTxReceipt(tx);
    console.log('Customer made the deposit.');

    // Check service provider native asset balance after the deposit but before fee distribution (0.998 if deposit equals to 1 ETH)
    const depositBalanceAfter = await depositToken.balanceOf(accounts[6].address);
    expect(depositBalanceAfter.sub(depositBalanceBefore).amount).to.equal(depositAmount.mul(FEE_DENOMINATOR.sub(FEE_NOMINATOR)).div(FEE_DENOMINATOR).amount);

    // Check contract balance
    const constracBalanceAfter = await depositToken.balanceOf(protocol.address);
    expect(constracBalanceBefore.add(depositAmount.mul(FEE_NOMINATOR).div(FEE_DENOMINATOR)).amount).to.equal(constracBalanceAfter.amount);

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
    const calculatedPenalty = stakedBefore.amount.mul(ethers.BigNumber.from(PENALTY_PERC)).div(PERC_DENOMIDATOR);
    expect(stakeDiff.amount).to.equal(calculatedPenalty.amount);

    // Confirm that process state == COMPLETED
    result = await protocol.getProcess(accounts[5].address, ethers.utils.id('123'));
    expect(result.state).to.equal(4);

    // Check service balance after receiving service fee
    balance = await depositToken.balanceOf(accounts[1].address);
    // Default Broker reward share is 80% from 0.2% => DEPOSIT_AMOUNT * 0.002 * 0.8
    expect(ethers.utils.formatUnits(balance.sub(serviceBalanceBefore), DEPOSIT_TOKEN_DECIMALS)).to.equal((Number(DEPOSIT_AMOUNT) * Number('0.002') * Number('0.8')).toString());

    // Check protocol balance
    balance = await depositToken.balanceOf(protocol.address);
    expect(ethers.utils.formatUnits(balance, DEPOSIT_TOKEN_DECIMALS)).to.equal('0.0');
  });

  it("Native Coin - Create new service and product, declare actions and terminate", async function () {
    // Confirm account #5 balance is greater than 1 ETH
    let balance = await ethers.provider.getBalance(accounts[5].address);
    expect(Number(ethers.utils.formatEther(balance))).to.gt(Number('1'));

    // Create process for account #5, service provider addr is accounts[1].addres, product id: 123 and data is {"a": 1, "b": 2, "c": 3}
    const newProcessTx = await protocol.connect(accounts[5])['createProcess(address,bytes32,string)'](accounts[1].address, ethers.utils.id('123'), '{"a": 1, "b": 2, "c": 3}');

    // Retreive validators rand list from the logs
    var selectedValidator = await getValidatorFromTx(protocol, newProcessTx);
    var firstIndex = getValidatorIndex(accounts, selectedValidator);
    
    console.log(`Selected validator accounts[${firstIndex}]`)
    // First process cost setup
    var setCostTx = await protocol.connect(accounts[firstIndex]).setProcessCost(accounts[5].address, ethers.utils.id('123'), ethers.utils.parseEther('1'), accounts[6].address);
    console.log('Calulated cost is 1 ETH')

    // Retreive validators rand list from the logs
    selectedValidator = await getValidatorFromTx(protocol, setCostTx);
    var secondIndex = getValidatorIndex(accounts, selectedValidator);

    console.log(`Selected validator accounts[${secondIndex}]`)
    // Second(confirmation) process cost setup
    await protocol.connect(accounts[secondIndex]).setProcessCost(accounts[5].address, ethers.utils.id('123'), ethers.utils.parseEther('1'), accounts[6].address);
    console.log('Calulated cost is 1 ETH')

    const constracBalanceBefore = await ethers.provider.getBalance(protocol.address);
    const serviceBalanceBefore = await ethers.provider.getBalance(accounts[1].address);
    const depositBalanceBefore = await ethers.provider.getBalance(accounts[6].address);
    
    // Make smart contract deposit from account #5
    const depositAmount = ethers.utils.parseEther('1');
    let tx = await accounts[5].sendTransaction({to: protocol.address, value: depositAmount});
    await tx.wait();
    console.log('Customer made the deposit.');

    // Check contract native asset balance after the deposit (0.002 if deposit equals to 1 ETH)
    const contractBalanceAfter = await ethers.provider.getBalance(protocol.address);
    expect(contractBalanceAfter.sub(constracBalanceBefore).amount).to.equal(depositAmount.mul(FEE_NOMINATOR).div(FEE_DENOMINATOR).amount);

    // Check service provider native asset balance after the deposit but before fee distribution (0.998 if deposit equals to 1 ETH)
    const depositBalanceAfter = await ethers.provider.getBalance(accounts[6].address);
    expect(depositBalanceAfter.sub(depositBalanceBefore).amount).to.equal(depositAmount.mul(FEE_DENOMINATOR.sub(FEE_NOMINATOR)).div(FEE_DENOMINATOR).amount);

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
    const serviceBalanceAfter = await ethers.provider.getBalance(accounts[5].address);
    expect(serviceBalanceAfter.sub(serviceBalanceBefore).amount).to.equal(depositAmount.mul(BROKER_PERC).div(PERC_DENOMIDATOR).amount);

    // Check protocol balance
    balance = await await ethers.provider.getBalance(protocol.address);
    expect(balance.amount).to.equal(depositAmount.mul(PROTOCOL_PERC).div(PERC_DENOMIDATOR).amount);
  });

  it("Native Coin - Penalize one of the validators", async function () {
    // Confirm account #5 balance is greater than 1 ETH
    let balance = await ethers.provider.getBalance(accounts[5].address);
    expect(Number(ethers.utils.formatEther(balance))).to.gt(Number('1'));

    // Create process for account #5, service provider addr is accounts[1].addres, product id: 123 and data is {"a": 1, "b": 2, "c": 3}
    const newProcessTx = await protocol.connect(accounts[5])['createProcess(address,bytes32,string)'](accounts[1].address, ethers.utils.id('123'), '{"a": 1, "b": 2, "c": 3}');

    // Retreive validators rand list from the logs
    var selectedValidator = await getValidatorFromTx(protocol, newProcessTx);
    var firstIndex = getValidatorIndex(accounts, selectedValidator);
    
    console.log(`Selected validator accounts[${firstIndex}]`)
    // First process cost setup
    var setCostTx = await protocol.connect(accounts[firstIndex]).setProcessCost(accounts[5].address, ethers.utils.id('123'), ethers.utils.parseEther('2'), accounts[6].address);
    console.log('Calulated cost is 2 ETH')

    // Retreive validators rand list from the logs
    selectedValidator = await getValidatorFromTx(protocol, setCostTx);
    var secondIndex = getValidatorIndex(accounts, selectedValidator);

    console.log(`Selected validator accounts[${secondIndex}]`)
    // Second(confirmation) process cost setup
    setCostTx = await protocol.connect(accounts[secondIndex]).setProcessCost(accounts[5].address, ethers.utils.id('123'), ethers.utils.parseEther('1'), accounts[6].address);
    console.log('Calulated cost is 1 ETH')

    // Retreive validators rand list from the logs
    selectedValidator = await getValidatorFromTx(protocol, setCostTx);
    let thirdIndex = getValidatorIndex(accounts, selectedValidator);

    console.log(`Selected validator accounts[${thirdIndex}]`)
    // Third(confirmation) process cost setup
    await protocol.connect(accounts[thirdIndex]).setProcessCost(accounts[5].address, ethers.utils.id('123'), ethers.utils.parseEther('1'), accounts[6].address);
    console.log('Calulated cost is 1 ETH')

    const constracBalanceBefore = await ethers.provider.getBalance(protocol.address);
    const serviceBalanceBefore = await ethers.provider.getBalance(accounts[1].address);
    const depositBalanceBefore = await ethers.provider.getBalance(accounts[6].address);
    
    // Make smart contract deposit from account #5
    const depositAmount = ethers.utils.parseEther('1');
    let tx = await accounts[5].sendTransaction({to: protocol.address, value: depositAmount});
    await tx.wait();
    console.log('Customer made the deposit.');

    // Check contract native asset balance after the deposit (0.002 if deposit equals to 1 ETH)
    const contractBalanceAfter = await ethers.provider.getBalance(protocol.address);
    expect(contractBalanceAfter.sub(constracBalanceBefore).amount).to.equal(depositAmount.mul(FEE_NOMINATOR).div(FEE_DENOMINATOR).amount);

    // Check service provider native asset balance after the deposit but before fee distribution (0.998 if deposit equals to 1 ETH)
    const depositBalanceAfter = await ethers.provider.getBalance(accounts[6].address);
    expect(depositBalanceAfter.sub(depositBalanceBefore).amount).to.equal(depositAmount.mul(FEE_DENOMINATOR.sub(FEE_NOMINATOR)).div(FEE_DENOMINATOR).amount);

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
    const calculatedPenalty = stakedBefore.amount.mul(ethers.BigNumber.from(PENALTY_PERC)).div(PERC_DENOMIDATOR);
    expect(stakeDiff.amount).to.equal(calculatedPenalty.amount);

    // Confirm that process state == COMPLETED
    result = await protocol.getProcess(accounts[5].address, ethers.utils.id('123'));
    expect(result.state).to.equal(4);

    // Check service balance after receiving service fee
    const serviceBalanceAfter = await ethers.provider.getBalance(accounts[1].address);
    expect(serviceBalanceAfter.sub(serviceBalanceBefore).amount).to.equal(depositAmount.mul(BROKER_PERC).div(PERC_DENOMIDATOR).amount);

    // Check protocol balance
    balance = await await ethers.provider.getBalance(protocol.address);
    expect(balance.amount).to.equal(depositAmount.mul(PROTOCOL_PERC).div(PERC_DENOMIDATOR).amount);
  });

});
