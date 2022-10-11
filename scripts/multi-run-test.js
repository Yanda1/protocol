const { expect } = require("chai");
const { ethers } = require("hardhat");
const { getTxReceipt } = require("../utils/getTxReceipt");


function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

function makeId(length) {
	let result = '';
	const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	const charactersLength = characters.length;
	for (let i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}

	return result;
}

async function getValidatorFromTx(contract, tx) {
  const receipt = await getTxReceipt(tx);
  const events = receipt.logs.map((log) => contract.interface.parseLog(log));
  if (events.length === 0 && tx.confirmations === 0) {
    console.log('events 0, tx.confirmations == 0 => wait')
    return await getValidatorFromTx(contract, tx)
  } else if (events.length === 0) {
    console.log('events 0, tx.confirmations > 0')
    console.log('receipt', receipt)
  }
  const selectedValidator = events[events.length-1].args.validatorsList[0];
  return selectedValidator;
}

function getValidatorIndex(accounts, selectedAddr) {
  for (let i = 2; i < 5; i++) {
    if (accounts[i].address == selectedAddr) {
      return i;
    }
  }
}

let accounts;
let Token;
let token;
let Protocol;
let protocol;


async function createProcessTx(customer, processId, data) {
  const tx = await protocol.connect(customer).createProcess(accounts[1].address, processId, data);
  // tx.wait();
  // Confirm that tx is successful
  let receipt = await getTxReceipt(tx);
  if (receipt.status === 0) {
    console.log('Retry createProcessTx')
    return createProcessTx(customer, processId, data)
  }
  return tx;
}


async function setProcessCostTx(validator, customer, processId, depositAmount) {
  let tx;
  try {
    tx = await protocol.connect(validator).setProcessCost(customer.address, processId, ethers.utils.parseEther(depositAmount), accounts[6].address);
    // tx.wait();
  } catch (error) {
    console.log('Error in setProcessCost tx', error)
    return setProcessCostTx(validator, customer, processId, depositAmount)
  }

  // Confirm that tx is successful
  let receipt = await getTxReceipt(tx);
  if (receipt.status === 0) {
    console.log('Retry setProcessCostTx')
    return setProcessCostTx(validator, customer, processId, depositAmount)
  }
  return tx;
}

async function startTerminationTx(customer, processId) {
  const tx = await protocol.connect(accounts[1]).startTermination(customer.address, processId);
  // tx.wait();
  // Confirm that tx is successful
  let receipt = await getTxReceipt(tx);
  if (receipt.status === 0) {
    console.log('Retry startTerminationTx')
    return startTerminationTx(customer, processId)
  }
  return tx;
}


async function validateTerminationTx(validator, customer, processId) {
  const tx = await protocol.connect(validator).validateTermination(customer.address, processId, true);
  // tx.wait();
  // Confirm that tx is successful
  let receipt = await getTxReceipt(tx);
  if (receipt.status === 0) {
    console.log('Retry validateTerminationTx')
    return validateTerminationTx(validator, customer, processId)
  }
  return tx;
}


async function test_once(account) {
  const depositAmount = getRandomInt(100).toString();
  const processId = ethers.utils.id(makeId(32));
  // Confirm account balance is greater than random amount of ETH
  let balance = await ethers.provider.getBalance(accounts[5].address);
  expect(Number(ethers.utils.formatEther(balance))).to.gt(Number(depositAmount));

  // Create process for account #5, cost amount is 1 YandaToken, product id: 123 and data is {"a": 1, "b": 2, "c": 3}
  const processConfig = '{"scoin":"GLMR", "samt":"25000000000000000000", "fcoin":"BUSD", "net":"BSC", "daddr":"0x563c2A466cf09A4a58C59f6Fb3165514a6117fDE", "tag":""}'
  let newProcessTx = await createProcessTx(account, processId, processConfig);

  // Retreive validators rand list from the logs
  let selectedValidator = await getValidatorFromTx(protocol, newProcessTx);
  let firstIndex = getValidatorIndex(accounts, selectedValidator);
  
  console.log(`Selected validator accounts[${firstIndex}]`)
  // First process cost setup
  let setCostTx = await setProcessCostTx(accounts[firstIndex], account, processId, depositAmount);

  // Retreive validators rand list from the logs
  selectedValidator = await getValidatorFromTx(protocol, setCostTx);
  let secondIndex = getValidatorIndex(accounts, selectedValidator);

  console.log(`Selected validator accounts[${secondIndex}]`)
  // Second(confirmation) process cost setup
  setCostTx = await setProcessCostTx(accounts[secondIndex], account, processId, depositAmount);

  let tx;
  // Make smart contract deposit from account
  try {
    tx = await account.sendTransaction({to: protocol.address, value: ethers.BigNumber.from(ethers.utils.parseEther(depositAmount))});
    // await tx.wait();
  } catch (error) {
    console.log('Error in sendTransaction tx', error)
  }

  // Declare few service produced actions
  await protocol.connect(accounts[1]).declareAction(account.address, processId, 'First order data');
  await protocol.connect(accounts[1]).declareAction(account.address, processId, 'Second order data');

  // Broker driven termination process starting for the productId '123'
  const terminateTx = await startTerminationTx(account, processId)

  // Retreive validators rand list from the logs
  selectedValidator = await getValidatorFromTx(protocol, terminateTx);
  firstIndex = getValidatorIndex(accounts, selectedValidator);
  
  console.log(`Selected validator accounts[${firstIndex}]`)
  // First validation of the productId for client account
  let terminationTx = await validateTerminationTx(accounts[firstIndex], account, processId) 
  console.log('Validated with "true"');

  // Retreive validators rand list from the logs
  selectedValidator = await getValidatorFromTx(protocol, terminationTx);
  secondIndex = getValidatorIndex(accounts, selectedValidator);

  console.log(`Selected validator accounts[${secondIndex}]`)
  // Second validation of the productId for client account
  terminationTx = await await validateTerminationTx(accounts[secondIndex], account, processId) 
  console.log('Validated with "true"');

  // Confirm that process state == COMPLETED
  const result = await protocol.getProcess(account.address, processId);
  expect(result.state).to.equal(4);

}

async function main() {
  let counter = 0
  accounts = await ethers.getSigners();
  Token = await ethers.getContractFactory("YandaToken");
  token = await Token.attach("0x3ed62137c5DB927cb137c26455969116BF0c23Cb");
  Protocol = await ethers.getContractFactory("YandaExtendedProtocolV3");
  protocol = await Protocol.attach("0x962c0940d72E7Db6c9a5F81f1cA87D8DB2B82A23");

  while (true) {
    counter += 1;
    console.log('Swap #', counter, '\n')

    await test_once(accounts[5])

    console.log('\n')   
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
