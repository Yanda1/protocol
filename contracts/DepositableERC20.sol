// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract DepositableERC20 is ERC20, ERC20Permit {
    constructor()
        ERC20("DepositableERC20", "DTK")
        ERC20Permit("DepositableERC20")
    {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
}
