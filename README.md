# EarlySupport DApp — Setup & Testing Guide

## Prerequisites
- [Ganache](https://trufflesuite.com/ganache/) running on `http://127.0.0.1:7545`
- [Metamask](https://metamask.io/) browser extension installed
- [Remix IDE](https://remix.ethereum.org/) for deploying the contract

---

## Step 1 — Deploy the Contract

1. Open Remix IDE → paste `EarlySupporterReward.sol` into a new file
2. Compile with Solidity `^0.8.0`
3. In the **Deploy** tab, set environment to **Injected Provider - Metamask**
4. Make sure Metamask is connected to Ganache (see Step 2)
5. Click **Deploy** → confirm in Metamask
6. Copy the deployed **contract address**

---

## Step 2 — Connect Metamask to Ganache

1. Open Metamask → Add Network → Custom RPC
   - Network Name: `Ganache Local`
   - RPC URL: `http://127.0.0.1:7545`
   - Chain ID: `1337`
   - Currency: `ETH`
2. Import at least 3 Ganache accounts using their private keys
   - Account 1 = creator
   - Accounts 2 onwards = potential supporters 

---

## Step 3 — Configure app.js

Open `frontend/app.js` and update line 2:
```js
const CONTRACT_ADDRESS = "PASTE_YOUR_CONTRACT_ADDRESS";
```
---

## Step 4 — Run the Frontend

Open `frontend/index.html` directly in your browser (no server needed).  
Or use VS Code Live Server for auto-reload.

---

## Edge Case Test Checklist

| Test | Expected Result |
|------|----------------|
| Register content with empty title | Contract rejects with error |
| Support with wrong ETH amount | Contract rejects — exact 0.01 ETH required |
| Same wallet supports twice | Rejects: "You have already supported this content" |
| 4st wallet tries to support | Rejects: "Max supporters reached" |
| Non-creator calls markViral | Rejects: "Only the creator can mark content as viral" |
| Creator marks viral twice | Rejects: "Content has already been marked viral" |
| Creator marks viral with 3 supporters | All 3 wallets each receive 0.01 ETH back |
| Check supporter count in UI | Displays X / 3 with filled squares |

---

## Contract Address (after deployment)
```
CONTRACT_ADDRESS = "COPY_FROM_REMIX_AFTER_DEPLOYMENT"
```
## Network Info
```
RPC URL   : http://127.0.0.1:7545
Chain ID  : 1337
```
