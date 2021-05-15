// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract BonkCoin is ERC20PresetMinterPauser("Bonk Coin", "DSTN") {
    constructor() {
        console.log("token deployed");
    }
}
