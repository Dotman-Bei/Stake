// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title STAKE — short-duration YES/NO prediction markets settled in native BOT.
/// @notice Pari-mutuel binary markets. Authorized creators open markets, users stake BOT on
///         YES or NO before the close time, an authorized resolver records the outcome after
///         close, and winners claim a proportional share of the pool. All financial state lives
///         here; off-chain indexes are read caches only.
/// @dev Fee model: `feeBps` (snapshotted per market, capped at MAX_FEE_BPS) is charged on the
///      LOSING pool only, so a winner never receives less than their own stake.
///      payout = stake * (totalPool - fee) / winningPool, rounded down.
///      Rounding dust (at most a few wei per winner) stays in the contract.
contract StakeMarkets is Ownable2Step, ReentrancyGuard, Pausable {
    // ─────────────────────────────────────────────── types

    enum MarketType {
        BotPrice,
        CryptoPrice,
        EcosystemMetric,
        EcosystemEvent
    }

    enum Side {
        None,
        Yes,
        No
    }

    enum Outcome {
        Unresolved,
        Yes,
        No,
        Invalid
    }

    /// @notice Derived lifecycle state. `Closed` means past close time, awaiting resolution.
    enum Status {
        Upcoming,
        Open,
        Closed,
        Resolved,
        Invalid
    }

    struct Market {
        uint128 totalYes;
        uint128 totalNo;
        uint128 minStake;
        uint128 maxStake;
        uint64 openTime;
        uint64 closeTime;
        uint64 createdAt;
        uint64 resolvedAt;
        uint32 yesCount;
        uint32 noCount;
        uint16 feeBps;
        MarketType marketType;
        Outcome outcome;
        address creator;
        address resolvedBy;
        uint128 fee;
        string question;
        string description;
        string resolutionSource;
        string resolutionParams;
        string resolutionEvidence;
    }

    struct CreateParams {
        MarketType marketType;
        string question;
        string description;
        string resolutionSource;
        string resolutionParams;
        uint64 openTime; // 0 = open immediately
        uint64 closeTime;
        uint128 minStake;
        uint128 maxStake;
    }

    struct Position {
        Side side;
        bool claimed;
        uint128 amount;
    }

    // ─────────────────────────────────────────────── constants

    uint16 public constant MAX_FEE_BPS = 500; // 5%
    uint256 private constant BPS = 10_000;
    uint64 public constant MIN_DURATION = 1 minutes;
    uint64 public constant MAX_DURATION = 30 days;
    uint64 public constant MAX_OPEN_DELAY = 30 days;
    /// @notice After closeTime + RESOLUTION_GRACE an unresolved market can be voided by anyone.
    uint64 public constant RESOLUTION_GRACE = 3 days;
    uint256 public constant MAX_PAGE = 50;

    uint256 private constant MAX_QUESTION = 200;
    uint256 private constant MAX_DESCRIPTION = 1_000;
    uint256 private constant MAX_SOURCE = 200;
    uint256 private constant MAX_PARAMS = 500;
    uint256 private constant MAX_EVIDENCE = 500;

    // ─────────────────────────────────────────────── storage

    Market[] private _markets;
    mapping(uint256 marketId => mapping(address user => Position)) private _positions;

    mapping(address => bool) public isCreator;
    mapping(address => bool) public isResolver;

    uint16 public feeBps;
    address public treasury;
    uint256 public accruedFees;

    // ─────────────────────────────────────────────── events

    event MarketCreated(
        uint256 indexed marketId,
        address indexed creator,
        MarketType marketType,
        string question,
        uint64 openTime,
        uint64 closeTime,
        uint128 minStake,
        uint128 maxStake,
        uint16 feeBps
    );
    event PositionTaken(
        uint256 indexed marketId,
        address indexed user,
        Side side,
        uint256 amount,
        uint256 positionTotal,
        uint256 totalYes,
        uint256 totalNo
    );
    event MarketResolved(
        uint256 indexed marketId, Outcome outcome, address indexed resolver, uint256 fee, string evidence
    );
    event MarketVoided(uint256 indexed marketId, address indexed by, string reason);
    event Claimed(uint256 indexed marketId, address indexed user, uint256 amount, bool refund);
    event CreatorUpdated(address indexed account, bool allowed);
    event ResolverUpdated(address indexed account, bool allowed);
    event FeeUpdated(uint16 feeBps);
    event TreasuryUpdated(address indexed treasury);
    event FeesWithdrawn(address indexed to, uint256 amount);

    // ─────────────────────────────────────────────── errors

    error NotCreator();
    error NotResolver();
    error ZeroAddress();
    error FeeTooHigh();
    error InvalidTimes();
    error InvalidStakeLimits();
    error InvalidText();
    error UnknownMarket();
    error MarketNotOpen();
    error InvalidSide();
    error SideLocked();
    error StakeTooSmall();
    error StakeTooLarge();
    error AlreadySettled();
    error MarketNotClosed();
    error ResolutionWindowOver();
    error ResolutionWindowActive();
    error InvalidOutcome();
    error NotSettled();
    error NothingToClaim();
    error AlreadyClaimed();
    error NotAWinner();
    error TransferFailed();
    error InvalidPage();

    // ─────────────────────────────────────────────── modifiers

    modifier onlyCreator() {
        if (!isCreator[msg.sender]) revert NotCreator();
        _;
    }

    modifier onlyResolver() {
        if (!isResolver[msg.sender]) revert NotResolver();
        _;
    }

    modifier exists(uint256 marketId) {
        if (marketId >= _markets.length) revert UnknownMarket();
        _;
    }

    // ─────────────────────────────────────────────── constructor

    constructor(address owner_, address creator_, address resolver_, address treasury_, uint16 feeBps_)
        Ownable(owner_)
    {
        if (creator_ == address(0) || resolver_ == address(0) || treasury_ == address(0)) revert ZeroAddress();
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        isCreator[creator_] = true;
        isResolver[resolver_] = true;
        treasury = treasury_;
        feeBps = feeBps_;
        emit CreatorUpdated(creator_, true);
        emit ResolverUpdated(resolver_, true);
        emit TreasuryUpdated(treasury_);
        emit FeeUpdated(feeBps_);
    }

    // ─────────────────────────────────────────────── market creation

    /// @notice Create a market. Restricted to authorized creators (PRD §8).
    function createMarket(CreateParams calldata p) external onlyCreator whenNotPaused returns (uint256 marketId) {
        uint64 nowTs = uint64(block.timestamp);
        uint64 openTime = p.openTime == 0 ? nowTs : p.openTime;

        if (openTime < nowTs || openTime > nowTs + MAX_OPEN_DELAY) revert InvalidTimes();
        if (p.closeTime < openTime + MIN_DURATION || p.closeTime > openTime + MAX_DURATION) revert InvalidTimes();
        if (p.minStake == 0 || p.maxStake < p.minStake) revert InvalidStakeLimits();
        _checkText(p.question, MAX_QUESTION, true);
        _checkText(p.description, MAX_DESCRIPTION, false);
        _checkText(p.resolutionSource, MAX_SOURCE, true);
        _checkText(p.resolutionParams, MAX_PARAMS, true);

        marketId = _markets.length;
        Market storage m = _markets.push();
        m.marketType = p.marketType;
        m.question = p.question;
        m.description = p.description;
        m.resolutionSource = p.resolutionSource;
        m.resolutionParams = p.resolutionParams;
        m.openTime = openTime;
        m.closeTime = p.closeTime;
        m.minStake = p.minStake;
        m.maxStake = p.maxStake;
        m.createdAt = nowTs;
        m.feeBps = feeBps;
        m.creator = msg.sender;

        emit MarketCreated(
            marketId, msg.sender, p.marketType, p.question, openTime, p.closeTime, p.minStake, p.maxStake, feeBps
        );
    }

    // ─────────────────────────────────────────────── staking

    /// @notice Stake native BOT on one side. A wallet holds one side per market and may top it up.
    /// @dev `minStake` applies to each deposit, `maxStake` to the wallet's cumulative position.
    function stake(uint256 marketId, Side side) external payable exists(marketId) whenNotPaused nonReentrant {
        Market storage m = _markets[marketId];
        if (m.outcome != Outcome.Unresolved) revert MarketNotOpen();
        if (block.timestamp < m.openTime || block.timestamp >= m.closeTime) revert MarketNotOpen();
        if (side != Side.Yes && side != Side.No) revert InvalidSide();
        if (msg.value < m.minStake) revert StakeTooSmall();

        Position storage pos = _positions[marketId][msg.sender];
        if (pos.side != Side.None && pos.side != side) revert SideLocked();

        uint256 newAmount = uint256(pos.amount) + msg.value;
        if (newAmount > m.maxStake) revert StakeTooLarge();

        bool firstEntry = pos.side == Side.None;
        pos.side = side;
        pos.amount = uint128(newAmount);

        if (side == Side.Yes) {
            m.totalYes += uint128(msg.value);
            if (firstEntry) m.yesCount++;
        } else {
            m.totalNo += uint128(msg.value);
            if (firstEntry) m.noCount++;
        }

        emit PositionTaken(marketId, msg.sender, side, msg.value, newAmount, m.totalYes, m.totalNo);
    }

    // ─────────────────────────────────────────────── settlement

    /// @notice Record the final outcome. Only once, only after close, only within the grace window.
    /// @dev A YES/NO result whose winning pool is empty is recorded as Invalid so every staker is refunded.
    function resolve(uint256 marketId, Outcome outcome, string calldata evidence)
        external
        exists(marketId)
        onlyResolver
    {
        Market storage m = _markets[marketId];
        if (m.outcome != Outcome.Unresolved) revert AlreadySettled();
        if (block.timestamp < m.closeTime) revert MarketNotClosed();
        if (block.timestamp > uint256(m.closeTime) + RESOLUTION_GRACE) revert ResolutionWindowOver();
        if (outcome == Outcome.Unresolved) revert InvalidOutcome();
        _checkText(evidence, MAX_EVIDENCE, false);

        uint256 fee;
        if (outcome == Outcome.Yes || outcome == Outcome.No) {
            uint256 winning = outcome == Outcome.Yes ? m.totalYes : m.totalNo;
            uint256 losing = outcome == Outcome.Yes ? m.totalNo : m.totalYes;
            if (winning == 0) {
                outcome = Outcome.Invalid;
            } else {
                fee = (losing * m.feeBps) / BPS;
            }
        }

        m.outcome = outcome;
        m.resolvedAt = uint64(block.timestamp);
        m.resolvedBy = msg.sender;
        m.fee = uint128(fee);
        m.resolutionEvidence = evidence;
        accruedFees += fee;

        emit MarketResolved(marketId, outcome, msg.sender, fee, evidence);
    }

    /// @notice Liveness fallback: if the resolver never acts, anyone can void the market after the grace window.
    function voidStaleMarket(uint256 marketId) external exists(marketId) {
        Market storage m = _markets[marketId];
        if (m.outcome != Outcome.Unresolved) revert AlreadySettled();
        if (block.timestamp <= uint256(m.closeTime) + RESOLUTION_GRACE) revert ResolutionWindowActive();
        _void(m, marketId, "resolution window expired");
    }

    /// @notice Admin safety valve (bad parameters, broken data source, compromised resolver). Only refunds.
    function cancelMarket(uint256 marketId, string calldata reason) external exists(marketId) onlyOwner {
        Market storage m = _markets[marketId];
        if (m.outcome != Outcome.Unresolved) revert AlreadySettled();
        _checkText(reason, MAX_EVIDENCE, false);
        _void(m, marketId, reason);
    }

    function _void(Market storage m, uint256 marketId, string memory reason) private {
        m.outcome = Outcome.Invalid;
        m.resolvedAt = uint64(block.timestamp);
        m.resolvedBy = msg.sender;
        m.resolutionEvidence = reason;
        emit MarketVoided(marketId, msg.sender, reason);
    }

    // ─────────────────────────────────────────────── claims

    /// @notice Claim winnings (resolved market) or a refund (invalid market). Exactly once per position.
    function claim(uint256 marketId) external exists(marketId) nonReentrant returns (uint256 amount) {
        Market storage m = _markets[marketId];
        Position storage pos = _positions[marketId][msg.sender];

        if (m.outcome == Outcome.Unresolved) revert NotSettled();
        if (pos.amount == 0) revert NothingToClaim();
        if (pos.claimed) revert AlreadyClaimed();

        bool refund = m.outcome == Outcome.Invalid;
        if (!refund && !_isWinner(m.outcome, pos.side)) revert NotAWinner();
        amount = refund ? pos.amount : _payout(m, pos.amount);

        // effects before interaction
        pos.claimed = true;
        emit Claimed(marketId, msg.sender, amount, refund);

        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    // ─────────────────────────────────────────────── admin

    function setCreator(address account, bool allowed) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        isCreator[account] = allowed;
        emit CreatorUpdated(account, allowed);
    }

    function setResolver(address account, bool allowed) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        isResolver[account] = allowed;
        emit ResolverUpdated(account, allowed);
    }

    /// @notice Applies to markets created afterwards; existing markets keep their snapshot.
    function setFeeBps(uint16 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    /// @notice Sends accrued protocol fees to the treasury. Never touches user stakes.
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 amount = accruedFees;
        if (amount == 0) revert NothingToClaim();
        accruedFees = 0;
        emit FeesWithdrawn(treasury, amount);
        (bool ok,) = treasury.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    /// @notice Pauses market creation and new stakes. Resolution, voiding and claims stay available.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ─────────────────────────────────────────────── views

    function marketCount() external view returns (uint256) {
        return _markets.length;
    }

    function getMarket(uint256 marketId) external view exists(marketId) returns (Market memory) {
        return _markets[marketId];
    }

    /// @notice Paginated market read (bounded, MAX_PAGE per call).
    function getMarkets(uint256 start, uint256 count) external view returns (Market[] memory page) {
        uint256 total = _markets.length;
        if (count == 0 || count > MAX_PAGE) revert InvalidPage();
        if (start >= total) return new Market[](0);
        uint256 end = start + count > total ? total : start + count;
        page = new Market[](end - start);
        for (uint256 i = start; i < end; i++) {
            page[i - start] = _markets[i];
        }
    }

    function getPosition(uint256 marketId, address user) external view exists(marketId) returns (Position memory) {
        return _positions[marketId][user];
    }

    function status(uint256 marketId) external view exists(marketId) returns (Status) {
        Market storage m = _markets[marketId];
        if (m.outcome == Outcome.Invalid) return Status.Invalid;
        if (m.outcome != Outcome.Unresolved) return Status.Resolved;
        if (block.timestamp < m.openTime) return Status.Upcoming;
        if (block.timestamp < m.closeTime) return Status.Open;
        return Status.Closed;
    }

    /// @notice Amount `user` can claim right now (0 if nothing, already claimed, or losing).
    function claimable(uint256 marketId, address user) external view exists(marketId) returns (uint256) {
        Market storage m = _markets[marketId];
        Position storage pos = _positions[marketId][user];
        if (m.outcome == Outcome.Unresolved || pos.amount == 0 || pos.claimed) return 0;
        if (m.outcome == Outcome.Invalid) return pos.amount;
        return _isWinner(m.outcome, pos.side) ? _payout(m, pos.amount) : 0;
    }

    // ─────────────────────────────────────────────── internals

    function _isWinner(Outcome outcome, Side side) private pure returns (bool) {
        return (outcome == Outcome.Yes && side == Side.Yes) || (outcome == Outcome.No && side == Side.No);
    }

    function _payout(Market storage m, uint256 stakeAmount) private view returns (uint256) {
        uint256 total = uint256(m.totalYes) + m.totalNo;
        uint256 winning = m.outcome == Outcome.Yes ? m.totalYes : m.totalNo;
        return (stakeAmount * (total - m.fee)) / winning;
    }

    function _checkText(string calldata s, uint256 maxLen, bool required) private pure {
        uint256 len = bytes(s).length;
        if ((required && len == 0) || len > maxLen) revert InvalidText();
    }
}
