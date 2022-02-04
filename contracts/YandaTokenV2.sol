// SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.3;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./celo_randomness/IRandom.sol";
import "./celo_randomness/IRegistry.sol";



/// @custom:security-contact mariostumpo@bmybit.com
contract YandaTokenV2 is Initializable, ERC20Upgradeable, AccessControlUpgradeable, ERC20PermitUpgradeable, ERC20VotesUpgradeable {

    using SafeMath for uint256;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint public constant TIME_FRAME_SIZE = 2;
    uint internal _penaltyPerc;
    uint internal _lockingPeriod;
    uint256 internal _totalStaked;

    enum State { AWAITING_COST, AWAITING_TRANSFER, AWAITING_TERMINATION, AWAITING_VALIDATION, COMPLETED }
    struct Process {
        State state;
        uint256 cost;
        uint256 costConf;
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

    modifier onlyService() {
        require(_services[msg.sender].validators.length > 0, "Only service can call this method");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function initialize() initializer public {
        __ERC20_init("YandaTokenV2", "YND");
        __AccessControl_init();
        __ERC20Permit_init("YandaTokenV2");
        _mint(msg.sender, 1000000000 * 10 ** decimals());
        _penaltyPerc = 10;
        _lockingPeriod = 51840; // 3 days in 5 sec block's amount
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        super._beforeTokenTransfer(from, to, amount);
    }

    function _afterTokenTransfer(address from, address to, uint256 amount) internal override(ERC20Upgradeable, ERC20VotesUpgradeable) {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal override(ERC20Upgradeable, ERC20VotesUpgradeable) {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount) internal override(ERC20Upgradeable, ERC20VotesUpgradeable) {
        super._burn(account, amount);
    }
    
    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        if(recipient == address(this)) {
            require(_processes[msg.sender][_depositingProducts[msg.sender]].state == State.AWAITING_TRANSFER, "You don't have a deposit awaiting process, please create it first");
            require(_processes[msg.sender][_depositingProducts[msg.sender]].cost == amount, "Deposit amount doesn't match with the requested cost");
            _transfer(_msgSender(), recipient, amount);
            _processes[msg.sender][_depositingProducts[msg.sender]].state = State.AWAITING_TERMINATION;

            emit Deposit(_msgSender(), _processes[msg.sender][_depositingProducts[msg.sender]].service, _processes[msg.sender][_depositingProducts[msg.sender]].productId, amount);
        } else {
            _transfer(_msgSender(), recipient, amount);
        }
        return true;
    }

    function addService(address service, address[] memory vList, uint vPerc, uint cPerc, uint vVer) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _services[service] = Service({validators: vList, validationPerc: vPerc, commissionPerc: cPerc, validatorVersion: vVer});
    }

    function setValidators(address[] memory vList) public onlyService {
        _services[msg.sender].validators = vList;
    }

    function setValidatorVer(uint vVer) public onlyService {
        _services[msg.sender].validatorVersion = vVer;
    }

    function getPenaltyPerc() public view returns(uint) {
        return _penaltyPerc;
    }

    function setPenaltyPerc(uint newPenaltyPerc) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _penaltyPerc = newPenaltyPerc;
    }

    function getLockingPeriod() public view returns(uint256) {
        return _lockingPeriod;
    }

    function setLockingPeriod(uint256 newLockingPeriod) public onlyRole(DEFAULT_ADMIN_ROLE) {
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

    function containsAddress(address[] memory array, address search) internal pure returns(bool) {
        for(uint x=0; x < array.length; x++) {
            if (array[x] == search) {
                return true;
            }
        }
        return false;
    }

    function random() internal view returns(uint256) {
        bytes32 randomness = IRandom(
            IRegistry(0x000000000000000000000000000000000000ce10)
                .getAddressFor(keccak256(abi.encodePacked("Random")))
        ).random();
        return uint256(randomness);
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
                    if (containsAddress(result, _services[service].validators[y]) == false) {
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

        _processes[msg.sender][productId] = Process({state: State.AWAITING_COST,cost: 0,costConf: 0,service: service,productId: productId,productData: data,startBlock: block.number,validatorsList: _randValidatorsList(service, address(0), address(0)),firstValidator: address(0),firstResult: false,secondValidator: address(0),secondResult: false});
        emit CostRequest(msg.sender, service, productId, _processes[msg.sender][productId].validatorsList, data);

        if(_depositingProducts[msg.sender].length > 0) {
            if(_processes[msg.sender][_depositingProducts[msg.sender]].state == State.AWAITING_TRANSFER) {
                delete _processes[msg.sender][_depositingProducts[msg.sender]];
            }
        }
        _depositingProducts[msg.sender] = productId;
    }

    function _rewardingLoop(address validator, uint256 reward) internal returns(uint256) {
        uint256 transfersSum = 0;
        for (uint256 i = 0; i < _validatorStakers[validator].length; i++) {
            address staker = _validatorStakers[validator][i];
        
            uint256 transferAmount = reward.mul(_stakes[staker][validator].amount.mul(100).div(_stakesByValidators[validator])).div(100);
            _stakes[staker][validator].amount = _stakes[staker][validator].amount.add(transferAmount);
            transfersSum += transferAmount;
        }
        return transfersSum;
    }

    function _rewardStakers(address firstValidator, address secondValidator, uint256 rewardAmount) internal returns(uint256) {
        uint256 firstReward = rewardAmount.mul(_stakesByValidators[firstValidator].mul(100).div(_stakesByValidators[firstValidator].add(_stakesByValidators[secondValidator]))).div(100);
        uint256 secondReward = rewardAmount - firstReward;
        uint256 firstTransfersSum = _rewardingLoop(firstValidator, firstReward);
        uint256 secondTransfersSum = _rewardingLoop(secondValidator, secondReward);
        _stakesByValidators[firstValidator] = _stakesByValidators[firstValidator].add(firstTransfersSum);
        _stakesByValidators[secondValidator] = _stakesByValidators[secondValidator].add(secondTransfersSum);

        return firstTransfersSum + secondTransfersSum;
    }

    function _makePayouts(address customer, bytes32 productId, bool needRefund, uint256 bonus) internal {
        uint256 reward_amount = (_processes[customer][productId].cost.mul(_services[_processes[customer][productId].service].validationPerc)).div(100);
        uint256 transfers_sum = _rewardStakers(_processes[customer][productId].firstValidator, _processes[customer][productId].secondValidator, reward_amount.add(bonus));
        _totalStaked = _totalStaked.add(transfers_sum);
        transfers_sum -= bonus;

        if(needRefund == false) {
            uint256 commission_amount = (_processes[customer][productId].cost.mul(_services[_processes[customer][productId].service].commissionPerc)).div(100);
            this.transfer(payable(_processes[customer][productId].service), commission_amount);
            _burn(address(this), _processes[customer][productId].cost - transfers_sum - commission_amount);
        } else {
            this.transfer(payable(customer), _processes[customer][productId].cost - transfers_sum);
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

    function setProcessCost(address customer, bytes32 productId, uint256 cost) public {
        require(_stakesByValidators[msg.sender] > 0, "Only validator with stakes can call this method");
        require(containsAddress(_services[_processes[customer][productId].service].validators, msg.sender), "Your address is not whitelisted in the product service settings");
        require(_processes[customer][productId].state == State.AWAITING_COST, "Cost is already set, check the state");
        require(
            inTimeFrame(
                _processes[customer][productId].validatorsList,
                msg.sender,
                _processes[customer][productId].startBlock,
                TIME_FRAME_SIZE
            ),
            "Cannot accept validation, you are out of time"
        );

        if(_processes[customer][productId].firstValidator == address(0)) {
            _processes[customer][productId].firstValidator = msg.sender;
            _processes[customer][productId].cost = cost;
            _processes[customer][productId].startBlock = block.number;
            _processes[customer][productId].validatorsList = _randValidatorsList(_processes[customer][productId].service, _processes[customer][productId].firstValidator, address(0));
            emit CostRequest(customer, _processes[customer][productId].service, productId, _processes[customer][productId].validatorsList, _processes[customer][productId].productData);
        } else if(_processes[customer][productId].secondValidator == address(0)) {
            _processes[customer][productId].secondValidator = msg.sender;
            _processes[customer][productId].costConf = cost;
            if(_processes[customer][productId].cost == _processes[customer][productId].costConf) {
                _processes[customer][productId].state = State.AWAITING_TRANSFER;
                emit CostResponse(customer, _processes[customer][productId].service, productId, cost);
            } else {
                _processes[customer][productId].startBlock = block.number;
                _processes[customer][productId].validatorsList = _randValidatorsList(_processes[customer][productId].service, _processes[customer][productId].firstValidator, _processes[customer][productId].secondValidator);
                emit CostRequest(customer, _processes[customer][productId].service, productId, _processes[customer][productId].validatorsList, _processes[customer][productId].productData);
            }
        } else {
            if(_processes[customer][productId].cost == cost) {
                _processes[customer][productId].secondValidator = msg.sender;
                _processes[customer][productId].costConf = cost;
            } else {
                _processes[customer][productId].firstValidator = msg.sender;
                _processes[customer][productId].cost = cost;
            }
            _processes[customer][productId].cost = cost;
            _processes[customer][productId].state = State.AWAITING_TRANSFER;
            emit CostResponse(customer, _processes[customer][productId].service, productId, cost);
        }
    }

    function declareAction(address customer, bytes32 productId, string calldata data) public onlyService {
        emit Action(customer, msg.sender, productId, data);
    }

    function startTermination(address customer, bytes32 productId) public {
        require((_services[msg.sender].validationPerc > 0) || (msg.sender == customer), "Only service or product customer can call this method");
        require(_processes[customer][productId].state == State.AWAITING_TERMINATION, "Cannot start termination, check the state");
        _processes[customer][productId].state = State.AWAITING_VALIDATION;
        _processes[customer][productId].startBlock = block.number;
        _processes[customer][productId].validatorsList = _randValidatorsList(_processes[customer][productId].service, address(0), address(0));
        _processes[customer][productId].firstValidator = address(0);
        _processes[customer][productId].firstResult = false;
        _processes[customer][productId].secondValidator = address(0);
        _processes[customer][productId].secondResult = false;
        emit Terminate(customer, msg.sender, productId, _processes[customer][productId].validatorsList);
    }

    function validateTermination(address customer, bytes32 productId, bool result) public {
        require(_stakesByValidators[msg.sender] > 0, "Only validator with stakes can call this method");
        require(containsAddress(_services[_processes[customer][productId].service].validators, msg.sender), "Your address is not whitelisted in the product service settings");
        require(_processes[customer][productId].state == State.AWAITING_VALIDATION, "Cannot accept validation, check the state");
        require(
            inTimeFrame(
                _processes[customer][productId].validatorsList,
                msg.sender,
                _processes[customer][productId].startBlock,
                TIME_FRAME_SIZE
            ),
            "Cannot accept validation, you are out of time"
        );

        if(_processes[customer][productId].firstValidator == address(0)) {
            _processes[customer][productId].firstValidator = msg.sender;
            _processes[customer][productId].firstResult = result;
            _processes[customer][productId].startBlock = block.number;
            _processes[customer][productId].validatorsList = _randValidatorsList(_processes[customer][productId].service, _processes[customer][productId].firstValidator, address(0));
            emit Terminate(customer, _processes[customer][productId].service, productId, _processes[customer][productId].validatorsList);
        } else if(_processes[customer][productId].secondValidator == address(0)) {
            _processes[customer][productId].secondValidator = msg.sender;
            _processes[customer][productId].secondResult = result;
            if(_processes[customer][productId].firstResult == _processes[customer][productId].secondResult) {
                _makePayouts(customer, productId, !_processes[customer][productId].firstResult, 0);
                _processes[customer][productId].state = State.COMPLETED;
                emit Complete(customer, _processes[customer][productId].service, productId, _processes[customer][productId].firstResult);
            } else {
                _processes[customer][productId].startBlock = block.number;
                _processes[customer][productId].validatorsList = _randValidatorsList(_processes[customer][productId].service, _processes[customer][productId].firstValidator, _processes[customer][productId].secondValidator);
                emit Terminate(customer, _processes[customer][productId].service, productId, _processes[customer][productId].validatorsList);
            }
        } else {
            if(_processes[customer][productId].firstResult == result) {
                uint256 penalty = _stakesByValidators[_processes[customer][productId].secondValidator].mul(_penaltyPerc).div(100);
                uint256 appliedPenalty = _penalizeLoop(_processes[customer][productId].secondValidator, penalty);
                _processes[customer][productId].secondValidator = msg.sender;
                _processes[customer][productId].secondResult = result;
                _makePayouts(customer, productId, !_processes[customer][productId].firstResult, appliedPenalty);
            } else {
                uint256 penalty = _stakesByValidators[_processes[customer][productId].firstValidator].mul(_penaltyPerc).div(100);
                uint256 appliedPenalty = _penalizeLoop(_processes[customer][productId].firstValidator, penalty);
                _processes[customer][productId].firstValidator = msg.sender;
                _processes[customer][productId].firstResult = result;
                _makePayouts(customer, productId, !_processes[customer][productId].firstResult, appliedPenalty);
            }
            _processes[customer][productId].state = State.COMPLETED;
            emit Complete(customer, _processes[customer][productId].service, productId, _processes[customer][productId].firstResult);
        }
    }

    function stake(uint256 amount, address validator) external {
        require(amount > 0, "Cannot stake 0");
        require(balanceOf(msg.sender) >= amount, "Your balance is lower than the amount of tokens you want to stake");
        _transfer(msg.sender, address(this), amount);
        _totalStaked = _totalStaked.add(amount);
        bool alreadyStaked = false;
        if (_stakes[msg.sender][validator].amount > 0) {
            alreadyStaked = true;
        }
        _stakes[msg.sender][validator].amount = _stakes[msg.sender][validator].amount.add(amount);
        _stakes[msg.sender][validator].unlockingBlock = block.number + _lockingPeriod;
        _stakesByValidators[validator] = _stakesByValidators[validator].add(amount);
        if (alreadyStaked == false && containsAddress(_validatorStakers[validator], msg.sender) == false) {
            _validatorStakers[validator].push(msg.sender);
        }
        emit Staked(msg.sender, validator, amount, _stakes[msg.sender][validator].unlockingBlock);
    }

    function unStake(uint256 amount, address validator) external {
        require(amount > 0, "Cannot unstake 0");
        require(_stakes[msg.sender][validator].amount >= amount, "Your balance is lower than the amount of tokens you want to unstake");
        // Check locking period
        require(_stakes[msg.sender][validator].unlockingBlock <= block.number, "The locking period didn't pass, you cannot unstake");
        // This will transfer the amount of token from contract into the sender wallet
        _transfer(address(this), msg.sender, amount);
        _totalStaked -= amount;
        _stakes[msg.sender][validator].amount = _stakes[msg.sender][validator].amount - amount;
        _stakesByValidators[validator] = _stakesByValidators[validator] - amount;
        emit UnStaked(msg.sender, validator, amount);
    }

    function getProcess(address customer, bytes32 productId) public view returns(Process memory) {
        return _processes[customer][productId];
    }

    function stakeOf(address staker, address validator) public view returns (Stake memory) {
        return _stakes[staker][validator];
    }

    function totalStaked() public view returns (uint256) {
        return _totalStaked;
    }

}
