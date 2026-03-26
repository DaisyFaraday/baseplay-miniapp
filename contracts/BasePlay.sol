// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface BasePlay {
    struct Pool {
        uint64 endTime;
        address token;
        uint128 totalSideA;
        uint128 totalSideB;
        uint8 result;
        bool settled;
    }

    struct BetInfo {
        bool side;
        uint128 amount;
        bool claimed;
    }

    function createPool(uint64 endTime, address token) external;

    function bet(uint256 id, bool side, uint128 amount) external payable;

    function submitResult(uint256 id, uint8 result) external;

    function claim(uint256 id) external;

    function getOdds(uint256 id) external view returns (uint256 sideAOdds, uint256 sideBOdds);

    function poolCount() external view returns (uint256);

    function pools(uint256 id) external view returns (Pool memory);

    function bets(uint256 id, address user) external view returns (BetInfo memory);

    function oracle() external view returns (address);
}
