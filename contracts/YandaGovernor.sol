// SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.2;

import "./custom_governance/Governor.sol";
import "./custom_governance/extensions/GovernorSettings.sol";
import "./custom_governance/extensions/GovernorCountingRanked.sol";
import "./custom_governance/extensions/GovernorVotes.sol";
import "./custom_governance/extensions/GovernorVotesQuorumFraction.sol";


/// @custom:security-contact mariostumpo@bmybit.com
contract YandaGovernor is Governor, GovernorSettings, GovernorCountingRanked, GovernorVotes, GovernorVotesQuorumFraction {
    mapping(bytes => uint8) private _functionRankBySig;

    constructor(IVotes _token,uint256 _votingDelay, uint256 _votingPeriod, uint256 _proposalThreshold, uint256[] memory _quorums)
        Governor("YandaGovernor")
        GovernorSettings(_votingDelay, _votingPeriod, _proposalThreshold)
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(_quorums)
    {
        super.setFunctionRank(bytes(hex'2f2ff15d'), 2);  // grantRole
        super.setFunctionRank(bytes(hex'd547741f'), 2);  // revokeRole
        super.setFunctionRank(bytes(hex'3ac8a356'), 2);  // updateQuorumNumerator
        super.setFunctionRank(bytes(hex'c0f99d67'), 1);  // addService
    }

    // The following functions are overrides required by Solidity.

    function votingDelay()
        public
        view
        override(IGovernor, GovernorSettings)
        returns (uint256)
    {
        return super.votingDelay();
    }

    function votingPeriod()
        public
        view
        override(IGovernor, GovernorSettings)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    function quorum(uint256 blockNumber)
        public
        view
        override(IGovernor, GovernorVotesQuorumFraction)
        returns (uint256[] memory)
    {
        return super.quorum(blockNumber);
    }

    function getVotes(address account, uint256 blockNumber)
        public
        view
        override(IGovernor, GovernorVotes)
        returns (uint256)
    {
        return super.getVotes(account, blockNumber);
    }

    function proposalThreshold()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

}
