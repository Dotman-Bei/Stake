// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {StakeMarkets} from "../StakeMarkets.sol";

/// @dev Test-only attacker: re-enters `claim` from its receive hook.
contract ReentrantClaimer {
    StakeMarkets public immutable target;
    uint256 public marketId;
    uint256 public reentryAttempts;
    bool public reentrySucceeded;

    constructor(StakeMarkets target_) {
        target = target_;
    }

    function enter(uint256 id, StakeMarkets.Side side) external payable {
        marketId = id;
        target.stake{value: msg.value}(id, side);
    }

    function attack() external {
        target.claim(marketId);
    }

    receive() external payable {
        if (reentryAttempts == 0) {
            reentryAttempts++;
            try target.claim(marketId) {
                reentrySucceeded = true;
            } catch {}
        }
    }
}

/// @dev Test-only receiver that rejects native transfers.
contract RejectingReceiver {
    function enter(StakeMarkets target, uint256 id, StakeMarkets.Side side) external payable {
        target.stake{value: msg.value}(id, side);
    }

    function claim(StakeMarkets target, uint256 id) external {
        target.claim(id);
    }
}
