// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BaseQuestMerkle {
    struct Quest {
        uint64 reward;
        uint32 startTime;
        uint32 endTime;
        bytes32 merkleRoot;
        bool active;
    }

    address public owner;
    bool public paused;

    uint256 public questCount;

    mapping(uint256 => Quest) public quests;
    mapping(uint256 => mapping(address => bool)) public claimed;
    mapping(address => uint128) public points;

    event QuestCreated(uint256 indexed id);
    event Claimed(address indexed user, uint256 indexed questId);
    event Paused(bool status);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    modifier notPaused() {
        require(!paused, "PAUSED");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    function createQuest(
        uint64 reward,
        uint32 startTime,
        uint32 endTime,
        bytes32 merkleRoot
    ) external onlyOwner {
        require(endTime > startTime, "INVALID_TIME");

        quests[questCount] = Quest({
            reward: reward,
            startTime: startTime,
            endTime: endTime,
            merkleRoot: merkleRoot,
            active: true
        });

        emit QuestCreated(questCount);

        unchecked {
            questCount++;
        }
    }

    function setQuestActive(uint256 id, bool active) external onlyOwner {
        quests[id].active = active;
    }

    function claim(
        uint256 questId,
        bytes32[] calldata proof
    ) external notPaused {
        Quest memory q = quests[questId];

        require(q.active, "INACTIVE");
        require(block.timestamp >= q.startTime, "NOT_STARTED");
        require(block.timestamp <= q.endTime, "ENDED");
        require(!claimed[questId][msg.sender], "ALREADY");

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        require(_verify(proof, q.merkleRoot, leaf), "INVALID_PROOF");

        claimed[questId][msg.sender] = true;

        unchecked {
            points[msg.sender] += q.reward;
        }

        emit Claimed(msg.sender, questId);
    }

    function _verify(
        bytes32[] calldata proof,
        bytes32 root,
        bytes32 leaf
    ) internal pure returns (bool) {
        bytes32 hash = leaf;

        for (uint256 i; i < proof.length; ) {
            bytes32 p = proof[i];

            hash = hash < p
                ? keccak256(abi.encodePacked(hash, p))
                : keccak256(abi.encodePacked(p, hash));

            unchecked {
                ++i;
            }
        }

        return hash == root;
    }

    function claimPoints() external {
        uint128 amount = points[msg.sender];
        require(amount > 0, "NO_POINTS");
        points[msg.sender] = 0;
    }

    function getQuest(
        uint256 id
    )
        external
        view
        returns (
            uint64,
            uint32,
            uint32,
            bytes32,
            bool
        )
    {
        Quest memory q = quests[id];
        return (
            q.reward,
            q.startTime,
            q.endTime,
            q.merkleRoot,
            q.active
        );
    }
}
