// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract EarlySupporterReward {

    // ─── Constants ────────────────────────────────────────────────
    uint256 public constant MAX_SUPPORTERS = 20;
    uint256 public constant SUPPORT_AMOUNT = 0.01 ether; // fixed ETH per support

    // ─── Data Structures ──────────────────────────────────────────
    struct Content {
        string  title;
        string  descriptionHash;   // store a hash, not the full text
        address creator;
        address[] supporters;      // ordered by arrival (max 20)
        uint256 pool;              // total ETH collected
        bool    isViral;           // true once creator triggers viral
    }

    // ─── State ────────────────────────────────────────────────────
    uint256 public contentCount;

    // contentId => Content
    mapping(uint256 => Content) private contents;

    // contentId => supporterAddress => hasSupportedAlready
    mapping(uint256 => mapping(address => bool)) private hasSupported;

    // ─── Events ───────────────────────────────────────────────────
    event ContentRegistered(uint256 indexed contentId, address indexed creator, string title);
    event ContentSupported(uint256 indexed contentId, address indexed supporter, uint256 supporterIndex);
    event ContentWentViral(uint256 indexed contentId, uint256 rewardPerSupporter);


    // ──────────────────────────────────────────────────────────────
    // 1. registerContent
    //    Anyone can call this to register a new piece of content.
    // ──────────────────────────────────────────────────────────────
    function registerContent(
        string calldata _title,
        string calldata _descriptionHash
    ) external returns (uint256 contentId) {

        // Basic validation
        require(bytes(_title).length > 0,           "Title cannot be empty");
        require(bytes(_descriptionHash).length > 0, "Description hash cannot be empty");

        // Assign a new ID (start from 1)
        contentCount++;
        contentId = contentCount;

        // Write to storage
        Content storage c = contents[contentId];
        c.title           = _title;
        c.descriptionHash = _descriptionHash;
        c.creator         = msg.sender;
        c.pool            = 0;
        c.isViral         = false;
        // c.supporters is an empty dynamic array by default

        emit ContentRegistered(contentId, msg.sender, _title);
    }


    // ──────────────────────────────────────────────────────────────
    // 2. supportContent
    //    Users send exactly SUPPORT_AMOUNT ETH to early-support a
    //    piece of content.  Order is strictly recorded.
    // ──────────────────────────────────────────────────────────────
    function supportContent(uint256 _contentId) external payable {

        // ── Validate content exists ──
        require(_contentId > 0 && _contentId <= contentCount, "Content does not exist");

        Content storage c = contents[_contentId];

        // ── Validate content hasn't gone viral yet ──
        require(!c.isViral, "Content has already gone viral");

        // ── Validate exact ETH amount ──
        require(msg.value == SUPPORT_AMOUNT, "Must send exactly 0.01 ETH");

        // ── Reject if already at max supporters ──
        require(c.supporters.length < MAX_SUPPORTERS, "Max supporters reached, you are too late!");

        // ── Reject duplicate support from the same wallet ──
        require(!hasSupported[_contentId][msg.sender], "You have already supported this content");

        // ── Record the supporter ──
        hasSupported[_contentId][msg.sender] = true;
        c.supporters.push(msg.sender);
        c.pool += msg.value;

        emit ContentSupported(_contentId, msg.sender, c.supporters.length);
    }


    // ──────────────────────────────────────────────────────────────
    // 3. markViral
    //    Only the creator can call this.
    //    Distributes the entire ETH pool equally among all supporters.
    // ──────────────────────────────────────────────────────────────
    function markViral(uint256 _contentId) external {

        // ── Validate content exists ──
        require(_contentId > 0 && _contentId <= contentCount, "Content does not exist");

        Content storage c = contents[_contentId];

        // ── Only the original creator can trigger viral ──
        require(msg.sender == c.creator, "Only the creator can mark content as viral");

        // ── Prevent double-triggering ──
        require(!c.isViral, "Content has already been marked viral");

        // ── Need at least 1 supporter to distribute rewards ──
        require(c.supporters.length > 0, "No supporters to reward");

        // ── Mark viral BEFORE sending ETH (re-entrancy protection) ──
        c.isViral = true;

        uint256 totalPool        = c.pool;
        uint256 supporterCount   = c.supporters.length;
        uint256 rewardPerSupporter = totalPool / supporterCount;
        // Note: any dust from integer division stays in the contract
        // (for 20 supporters and 0.2 ETH pool, each gets exactly 0.01 ETH — no dust)

        // ── Distribute rewards ──
        for (uint256 i = 0; i < supporterCount; i++) {
            address supporter = c.supporters[i];
            (bool success, ) = payable(supporter).call{value: rewardPerSupporter}("");
            require(success, "ETH transfer failed");
        }

        emit ContentWentViral(_contentId, rewardPerSupporter);
    }


    // ─── View / Helper Functions ──────────────────────────────────

    function getSupporterCount(uint256 _contentId) external view returns (uint256) {
        return contents[_contentId].supporters.length;
    }

    function getPoolSize(uint256 _contentId) external view returns (uint256) {
        return contents[_contentId].pool;
    }

    function getSupporters(uint256 _contentId) external view returns (address[] memory) {
        return contents[_contentId].supporters;
    }

    function getContentDetails(uint256 _contentId) external view returns (
        string memory title,
        address creator,
        uint256 supporterCount,
        uint256 pool,
        bool isViral
    ) {
        Content storage c = contents[_contentId];
        return (c.title, c.creator, c.supporters.length, c.pool, c.isViral);
    }
}
