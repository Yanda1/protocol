// SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.3;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract YandaExtendedProtocol is Initializable, AccessControlUpgradeable {

    using SafeMath for uint256;

    uint public constant TIME_FRAME_SIZE = 2;
    uint internal VALIDATORS_PERC;
    uint internal BROKER_PERC;
    uint internal FEE_NOMINATOR;
    uint internal FEE_DENOMINATOR;
    uint internal _penaltyPerc;
    uint internal _lockingPeriod;
    uint256 internal _totalStaked;
    IERC20 internal _tokenContract;

    enum State { AWAITING_COST, AWAITING_TRANSFER, AWAITING_TERMINATION, AWAITING_VALIDATION, COMPLETED }
    struct Process {
        State state;
        uint256 cost;
        uint256 costConf;
        uint256 fee;
        address service;
        bytes32 productId;
        string productData;
        uint256 startBlock;
        address[] validatorsList;
        address firstValidator;
        bool firstResult;
        address secondValidator;
        bool secondResult;
    }
    struct Service {
        address payable deposit;
        address[] validators;
        uint validationPerc;
        uint commissionPerc;
        uint validatorVersion;
    }
    struct Stake {
        uint256 amount;
        uint256 unlockingBlock;
    }
    mapping(address => mapping(bytes32 => Process)) internal _processes;
    mapping(address => bytes32) internal _depositingProducts;
    mapping(address => Service) internal _services;
    mapping(address => uint256) internal _stakesByValidators;
    mapping(address => address[]) internal _validatorStakers;
    mapping(address => mapping(address => Stake)) internal _stakes;

    event Deposit(
        address indexed customer,
        address indexed service,
        bytes32 indexed productId,
        uint256 weiAmount
    );
    event Action(
        address indexed customer,
        address indexed service,
        bytes32 indexed productId,
        string data
    );
    event Terminate(
        address indexed customer,
        address indexed service,
        bytes32 indexed productId,
        address[] validatorsList
    );
    event Complete(
        address indexed customer,
        address indexed service, 
        bytes32 indexed productId,
        bool success
    );
    event CostRequest(
        address indexed customer,
        address indexed service,
        bytes32 indexed productId,
        address[] validatorsList,
        string data
    );
    event CostResponse(
        address indexed customer,
        address indexed service,
        bytes32 indexed productId,
        uint cost
    );
    event Staked(
        address indexed staker,
        address indexed validator,
        uint256 amount,
        uint256 unlockingBlock
    );
    event UnStaked(
        address indexed staker,
        address indexed validator,
        uint256 amount
    );

    modifier onlyService() {
        require(_services[msg.sender].validators.length > 0, "Only service can call this method");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function initialize(uint penaltyPerc, uint lockingPeriod, address token) initializer public {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        _penaltyPerc = penaltyPerc;
        _lockingPeriod = lockingPeriod;
        _tokenContract = IERC20(token);

        VALIDATORS_PERC = 15;
        BROKER_PERC = 80;
        FEE_NOMINATOR = 2;
        FEE_DENOMINATOR = 1000;
    }

    function _containsAddress(address[] memory array, address search) internal pure returns(bool) {
        for(uint x=0; x < array.length; x++) {
            if (array[x] == search) {
                return true;
            }
        }
        return false;
    }

    function setToken(address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _tokenContract = IERC20(token);
    }

    function setDefaultPerc(uint vPerc, uint bPerc) external onlyRole(DEFAULT_ADMIN_ROLE) {
        VALIDATORS_PERC = vPerc;
        BROKER_PERC = bPerc;
    }

    function setProtocolFee(uint nominator, uint denominator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        FEE_NOMINATOR = nominator;
        FEE_DENOMINATOR = denominator;
    }

    function depositToken() external view returns(address) {
        return address(_tokenContract);
    }

    receive() external payable {
        address sender = _msgSender();
        Process storage process = _processes[sender][_depositingProducts[sender]];
        require(process.state == State.AWAITING_TRANSFER, "You don't have a deposit awaiting process, please create it first");
        require(process.cost == msg.value, "Deposit amount doesn't match with the requested deposit");
        Service storage service = _services[process.service];
        // Transfer main payment from customer to the broker(subtracting the fee)
        service.deposit.transfer(msg.value.sub(process.fee));

        // Update process state and emit an event
        process.state = State.AWAITING_TERMINATION;
        emit Deposit(sender, process.service, process.productId, msg.value);
    }

    function addService(address service, address payable depositAddr, address[] memory vList) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(vList.length > 2, "Validators minimum quantity is 3");
        _services[service] = Service({deposit: depositAddr, validators: vList, validationPerc: VALIDATORS_PERC, commissionPerc: BROKER_PERC, validatorVersion: 1});
    }

    function setServicePerc(address service, uint vPerc, uint bPerc) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Service storage instance = _services[service];
        instance.validationPerc = vPerc;
        instance.commissionPerc = bPerc;
    }

    function setDepositAddr(address payable depositAddr) external onlyService {
        _services[msg.sender].deposit = depositAddr;
    }

    function setValidators(address[] memory vList) external onlyService {
        _services[msg.sender].validators = vList;
    }

    function getValidatorVer(address service) external view returns(uint) {
        return _services[service].validatorVersion;
    }

    function setValidatorVer(uint vVer) external onlyService {
        _services[msg.sender].validatorVersion = vVer;
    }

    function getPenaltyPerc() external view returns(uint) {
        return _penaltyPerc;
    }

    function setPenaltyPerc(uint newPenaltyPerc) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _penaltyPerc = newPenaltyPerc;
    }

    function getLockingPeriod() external view returns(uint256) {
        return _lockingPeriod;
    }

    function setLockingPeriod(uint256 newLockingPeriod) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _lockingPeriod = newLockingPeriod;
    }

    function inTimeFrame(address[] memory list, address search, uint256 startBlock, uint intSize) internal view returns(bool) {
        for(uint x=0; x < list.length; x++) {
            if(list[x] == search) {
                return (
                    (x * intSize) <= (block.number - startBlock) && 
                    (block.number - startBlock) < (x * intSize + intSize)
                );
            }
        }
        return false;
    }

    function random() internal view returns(uint256) {
        // Temp solution with fake random
        // TODO resolve with real randomness
        return uint256(keccak256(abi.encodePacked(block.difficulty, block.timestamp)));
    }

    function _randValidatorsList(address service, address exclude1, address exclude2) internal view returns(address[] memory) {
        uint256 localTotalStaked = _totalStaked - _stakesByValidators[exclude1] - _stakesByValidators[exclude2];
        uint256 index = 0;
        uint resultLength = _services[service].validators.length;
        if (exclude1 != address(0)) {
            resultLength -= 1;
        }
        if (exclude2 != address(0)) {
            resultLength -= 1;
        }
        address[] memory result = new address[](resultLength);

        for(uint x=0; x < result.length; x++) {
            index = random() % localTotalStaked;
            for(uint y=0; y < _services[service].validators.length; y++) {
                if (_services[service].validators[y] != exclude1 && _services[service].validators[y] != exclude2) {
                    if (_containsAddress(result, _services[service].validators[y]) == false) {
                        if (index <= _stakesByValidators[_services[service].validators[y]]) {
                            result[x] = _services[service].validators[y];
                            localTotalStaked -= _stakesByValidators[_services[service].validators[y]];
                            break;
                        }
                        index -= _stakesByValidators[_services[service].validators[y]];
                    }
                }
            }
        }
        return result;
    }

    function createProcess(address service, bytes32 productId, string memory data) public {
        require(_services[service].validationPerc > 0, 'Requested service address not found');
        require(_processes[msg.sender][productId].service == address(0), 'Process with specified productId already exist');

        _processes[msg.sender][productId] = Process({state: State.AWAITING_COST,cost: 0,costConf: 0,fee: 0,service: service,productId: productId,productData: data,startBlock: block.number,validatorsList: _randValidatorsList(service, address(0), address(0)),firstValidator: address(0),firstResult: false,secondValidator: address(0),secondResult: false});
        emit CostRequest(msg.sender, service, productId, _processes[msg.sender][productId].validatorsList, data);

        if(_depositingProducts[msg.sender].length > 0) {
            if(_processes[msg.sender][_depositingProducts[msg.sender]].state == State.AWAITING_TRANSFER) {
                delete _processes[msg.sender][_depositingProducts[msg.sender]];
            }
        }
        _depositingProducts[msg.sender] = productId;
    }

    function _rewardLoop(address validator, uint256 reward) internal returns(uint256) {
        uint256 transfersSum = 0;
        for (uint256 i = 0; i < _validatorStakers[validator].length; i++) {
            address staker = _validatorStakers[validator][i];
            // Calc reward share according to the staked amount
            uint256 transferAmount = reward.mul(_stakes[staker][validator].amount.mul(100).div(_stakesByValidators[validator])).div(100);
            // Transfer reward to the staker
            payable(staker).transfer(transferAmount);
            transfersSum += transferAmount;
        }
        return transfersSum;
    }

    function _bonusLoop(address validator, uint256 bonus) internal returns(uint256) {
        uint256 transfersSum = 0;
        for (uint256 i = 0; i < _validatorStakers[validator].length; i++) {
            address staker = _validatorStakers[validator][i];
            // Calc bonus share according to the staked amount
            uint256 transferAmount = bonus.mul(_stakes[staker][validator].amount.mul(100).div(_stakesByValidators[validator])).div(100);
            // Increase stake with bonus
            _stakes[staker][validator].amount = _stakes[staker][validator].amount.add(transferAmount);
            transfersSum += transferAmount;
        }
        return transfersSum;
    }

    function _rewardStakers(address firstValidator, address secondValidator, uint256 rewardAmount) internal returns(uint256) {
        uint256 firstReward = rewardAmount.mul(_stakesByValidators[firstValidator].mul(100).div(_stakesByValidators[firstValidator].add(_stakesByValidators[secondValidator]))).div(100);
        uint256 secondReward = rewardAmount - firstReward;
        uint256 firstRewardTsSum = _rewardLoop(firstValidator, firstReward);
        uint256 secondRewardTsSum = _rewardLoop(secondValidator, secondReward);

        return firstRewardTsSum + secondRewardTsSum;
    }

    function _rewardBonus(address firstValidator, address secondValidator, uint256 bonus) internal {
        uint256 firstBonus = bonus.mul(_stakesByValidators[firstValidator].mul(100).div(_stakesByValidators[firstValidator].add(_stakesByValidators[secondValidator]))).div(100);
        uint256 secondBonus = bonus - firstBonus;
        uint256 firstBonusTsSum = _bonusLoop(firstValidator, firstBonus);
        uint256 secondBonusTsSum = _bonusLoop(secondValidator, secondBonus);

        _stakesByValidators[firstValidator] += firstBonusTsSum;
        _stakesByValidators[secondValidator] += secondBonusTsSum;
    }

    function _makePayouts(address customer, bytes32 productId, bool needRefund, uint256 bonus) internal {
        Process storage process = _processes[customer][productId];
        uint256 reward_amount = process.fee.mul(_services[process.service].validationPerc).div(100);
        uint256 transfers_sum = _rewardStakers(process.firstValidator, process.secondValidator, reward_amount);
        if(bonus > 0) {
            _rewardBonus(process.firstValidator, process.secondValidator, bonus);
        }

        if(needRefund == false) {
            uint256 commission_amount = process.fee.mul(_services[process.service].commissionPerc).div(100);
            payable(process.service).transfer(commission_amount);
        } else {
            payable(customer).transfer(process.fee - transfers_sum);
        }
    }

    function _penalizeLoop(address validator, uint256 penalty) internal returns(uint256) {
        uint256 transfersSum = 0;
        for (uint256 i = 0; i < _validatorStakers[validator].length; i++) {
            address staker = _validatorStakers[validator][i];
            uint256 transferAmount = penalty.mul(_stakes[staker][validator].amount.mul(100).div(_stakesByValidators[validator])).div(100);
            _stakes[staker][validator].amount = _stakes[staker][validator].amount - transferAmount;
            transfersSum += transferAmount;
        }
        
        return transfersSum;
    }

    function setProcessCost(address customer, bytes32 productId, uint256 cost) external {
        require(_stakesByValidators[msg.sender] > 0, "Only validator with stakes can call this method");
        Process storage process = _processes[customer][productId];
        require(_containsAddress(_services[process.service].validators, msg.sender), "Your address is not whitelisted in the product service settings");
        require(process.state == State.AWAITING_COST, "Cost is already set, check the state");
        require(
            inTimeFrame(
                process.validatorsList,
                msg.sender,
                process.startBlock,
                TIME_FRAME_SIZE
            ),
            "Cannot accept validation, you are out of time"
        );

        if(process.firstValidator == address(0)) {
            process.firstValidator = msg.sender;
            process.cost = cost;
            process.startBlock = block.number;
            process.validatorsList = _randValidatorsList(process.service, process.firstValidator, address(0));
            emit CostRequest(customer, process.service, productId, process.validatorsList, process.productData);
        } else if(process.secondValidator == address(0)) {
            process.secondValidator = msg.sender;
            process.costConf = cost;
            if(process.cost == process.costConf) {
                process.fee = cost.mul(FEE_NOMINATOR).div(FEE_DENOMINATOR);
                process.state = State.AWAITING_TRANSFER;
                emit CostResponse(customer, process.service, productId, cost);
            } else {
                process.startBlock = block.number;
                process.validatorsList = _randValidatorsList(process.service, process.firstValidator, process.secondValidator);
                emit CostRequest(customer, process.service, productId, process.validatorsList, process.productData);
            }
        } else {
            if(process.cost == cost) {
                process.secondValidator = msg.sender;
                process.costConf = cost;
            } else {
                process.firstValidator = msg.sender;
                process.cost = cost;
            }
            process.cost = cost;
            process.fee = cost.mul(FEE_NOMINATOR).div(FEE_DENOMINATOR);
            process.state = State.AWAITING_TRANSFER;
            emit CostResponse(customer, process.service, productId, cost);
        }
    }

    function declareAction(address customer, bytes32 productId, string calldata data) external onlyService {
        emit Action(customer, msg.sender, productId, data);
    }

    function startTermination(address customer, bytes32 productId) external {
        require((_services[msg.sender].validationPerc > 0) || (msg.sender == customer), "Only service or product customer can call this method");
        Process storage process = _processes[customer][productId];
        require(process.state == State.AWAITING_TERMINATION, "Cannot start termination, check the state");

        process.state = State.AWAITING_VALIDATION;
        process.startBlock = block.number;
        process.validatorsList = _randValidatorsList(process.service, address(0), address(0));
        process.firstValidator = address(0);
        process.firstResult = false;
        process.secondValidator = address(0);
        process.secondResult = false;
        emit Terminate(customer, msg.sender, productId, process.validatorsList);
    }

    function validateTermination(address customer, bytes32 productId, bool result) external {
        require(_stakesByValidators[msg.sender] > 0, "Only validator with stakes can call this method");
        Process storage process = _processes[customer][productId];
        require(_containsAddress(_services[process.service].validators, msg.sender), "Your address is not whitelisted in the product service settings");
        require(process.state == State.AWAITING_VALIDATION, "Cannot accept validation, check the state");
        require(
            inTimeFrame(
                process.validatorsList,
                msg.sender,
                process.startBlock,
                TIME_FRAME_SIZE
            ),
            "Cannot accept validation, you are out of time"
        );

        if(process.firstValidator == address(0)) {
            process.firstValidator = msg.sender;
            process.firstResult = result;
            process.startBlock = block.number;
            process.validatorsList = _randValidatorsList(process.service, process.firstValidator, address(0));
            emit Terminate(customer, process.service, productId, process.validatorsList);
        } else if(process.secondValidator == address(0)) {
            process.secondValidator = msg.sender;
            process.secondResult = result;
            if(process.firstResult == process.secondResult) {
                _makePayouts(customer, productId, !process.firstResult, 0);
                process.state = State.COMPLETED;
                emit Complete(customer, process.service, productId, process.firstResult);
            } else {
                process.startBlock = block.number;
                process.validatorsList = _randValidatorsList(process.service, process.firstValidator, process.secondValidator);
                emit Terminate(customer, process.service, productId, process.validatorsList);
            }
        } else {
            if(process.firstResult == result) {
                uint256 penalty = _stakesByValidators[process.secondValidator].mul(_penaltyPerc).div(100);
                uint256 appliedPenalty = _penalizeLoop(process.secondValidator, penalty);
                process.secondValidator = msg.sender;
                process.secondResult = result;
                _makePayouts(customer, productId, !process.firstResult, appliedPenalty);
            } else {
                uint256 penalty = _stakesByValidators[process.firstValidator].mul(_penaltyPerc).div(100);
                uint256 appliedPenalty = _penalizeLoop(process.firstValidator, penalty);
                process.firstValidator = msg.sender;
                process.firstResult = result;
                _makePayouts(customer, productId, !process.firstResult, appliedPenalty);
            }
            process.state = State.COMPLETED;
            emit Complete(customer, process.service, productId, process.firstResult);
        }
    }

    function getProcess(address customer, bytes32 productId) external view returns(Process memory) {
        return _processes[customer][productId];
    }

    function stake(address validator, uint256 amount) external {
        require(validator != address(0), "Validator address cannot be 0");
        require(amount > 0, "Cannot stake 0");

        bool success = _tokenContract.transferFrom(msg.sender, address(this), amount);
        if(success) {
            _totalStaked = _totalStaked.add(amount);
            bool alreadyStaked = false;
            if (_stakes[msg.sender][validator].amount > 0) {
                alreadyStaked = true;
            }
            _stakes[msg.sender][validator].amount = _stakes[msg.sender][validator].amount.add(amount);
            _stakes[msg.sender][validator].unlockingBlock = block.number + _lockingPeriod;
            _stakesByValidators[validator] = _stakesByValidators[validator].add(amount);
            if (alreadyStaked == false && _containsAddress(_validatorStakers[validator], msg.sender) == false) {
                _validatorStakers[validator].push(msg.sender);
            }
            emit Staked(msg.sender, validator, amount, _stakes[msg.sender][validator].unlockingBlock);
        } else {
            revert("Wasn't able to transfer your token");
        }
    }

    function unStake(address validator, uint256 amount) external {
        require(amount > 0, "Cannot unstake 0");
        require(_stakes[msg.sender][validator].amount >= amount, "Your balance is lower than the amount of tokens you want to unstake");
        // Check locking period
        require(_stakes[msg.sender][validator].unlockingBlock <= block.number, "The locking period didn't pass, you cannot unstake");
        // This will transfer the amount of token from contract to the sender balance
        bool success = _tokenContract.transfer(msg.sender, amount);
        if(success) {
            _totalStaked -= amount;
            _stakes[msg.sender][validator].amount = _stakes[msg.sender][validator].amount - amount;
            _stakesByValidators[validator] = _stakesByValidators[validator] - amount;
            emit UnStaked(msg.sender, validator, amount);
        } else {
            revert("Wasn't able to execute transfer of your tokens");
        }
    }

    function stakeOf(address staker, address validator) external view returns (Stake memory) {
        return _stakes[staker][validator];
    }

    function totalStaked() external view returns (uint256) {
        return _totalStaked;
    }
}
