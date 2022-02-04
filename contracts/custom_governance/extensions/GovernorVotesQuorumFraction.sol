// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts v4.4.1 (governance/extensions/GovernorVotesQuorumFraction.sol)

pragma solidity ^0.8.0;

import "./GovernorVotes.sol";

/**
 * @dev Extension of {Governor} for voting weight extraction from an {ERC20Votes} token and a quorum expressed as a
 * fraction of the total supply.
 *
 * _Available since v4.3._
 */
abstract contract GovernorVotesQuorumFraction is GovernorVotes {
    uint256[] private _quorumNumerator;

    event QuorumNumeratorUpdated(
        uint256[] oldQuorumNumerator,
        uint256[] newQuorumNumerator
    );

    constructor(uint256[] memory quorumNumeratorValues) {
        _updateQuorumNumerator(quorumNumeratorValues);
    }

    function quorumNumerator() public view virtual returns (uint256[] memory) {
        return _quorumNumerator;
    }

    function quorumDenominator() public view virtual returns (uint256) {
        return 100;
    }

    function quorum(uint256 blockNumber) public view virtual override returns (uint256[] memory) {
        uint256[] memory result = new uint256[](_quorumNumerator.length);
        uint256 totalSupply = token.getPastTotalSupply(blockNumber);
        uint256 denominator = quorumDenominator();
        
        for(uint i=0; i < _quorumNumerator.length; i++) { 
            result[i] = (totalSupply * _quorumNumerator[i]) / denominator;
        }

        return result;
    }

    function updateQuorumNumerator(uint256[] memory newQuorumNumerator) external virtual onlyGovernance {
        _updateQuorumNumerator(newQuorumNumerator);
    }

    function _updateQuorumNumerator(uint256[] memory newQuorumNumerator) internal virtual {
        for(uint i=0; i < newQuorumNumerator.length; i++) { 
            require(
                newQuorumNumerator[i] <= quorumDenominator(),
                "GovernorVotesQuorumFraction: quorumNumerator over quorumDenominator"
            );
        }

        // Copy old values into oldQuorumNumerator
        uint256[] memory oldQuorumNumerator = new uint256[](_quorumNumerator.length);
        for(uint i=0; i < _quorumNumerator.length; i++) {
            oldQuorumNumerator[i] = _quorumNumerator[i];
        }
        // Replace old values with the new ones
        _quorumNumerator = newQuorumNumerator;

        emit QuorumNumeratorUpdated(
            oldQuorumNumerator,
            newQuorumNumerator
        );
    }
}
