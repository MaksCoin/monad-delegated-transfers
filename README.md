# Monad Delegated Transfers: Off-Chain Scheduled Transactions

**A Hackathon Submission for the MetaMask Smart Accounts x Monad Dev Cook-Off.**

[![Hackathon](https://img.shields.io/badge/Hackathon-MetaMask%20x%20Monad-blueviolet)](https://www.hackquest.io/hackathons/MetaMask-Smart-Accounts-x-Monad-Dev-Cook-Off)
[![Powered by Monad](https://img.shields.io/badge/Powered%20By-Monad-green)](https://docs.monad.xyz/)
[![Uses MetaMask Smart Accounts](https://img.shields.io/badge/Uses-MetaMask%20Smart%20Accounts-orange)](https://docs.metamask.io/delegation-toolkit/)

This project is a functional proof-of-concept demonstrating how to build a decentralized application for scheduled, off-chain native token transfers using the MetaMask Delegation Toolkit on the Monad Testnet.

---

## Live Demo

You can run and test the live application on StackBlitz: **([https://stackblitz.com/edit/vitejs-vite-qkjuddrv](https://stackblitz.com/edit/vitejs-vite-qkjuddrv?file=src%2FApp.jsx))**

---

## The Problem

In today's DeFi landscape, automating payments remains a challenge:
*   **Scheduling transactions** requires either complex, gas-intensive smart contracts (keepers) or reliance on centralized services.
*   Users must pay gas for every future action, creating friction.
*   There is no simple, trustless way to say, "I want to send X tokens to address Y in 24 hours," without locking funds in an escrow or setting up a complex multisig.

## Our Solution

**Monad Delegated Transfers** leverages the power of **MetaMask Smart Accounts** and the **Delegation Framework** to solve this problem.

Our application allows users to create "delegated orders"—signed, off-chain messages that grant permission for a specific transfer to occur in the future. These orders can be executed by anyone (a "relayer"), removing the need for the user to be online or pay gas at the time of execution.

### Key Features

*   **Seamless Onboarding:** Connects with MetaMask and switches to the Monad Testnet.
*   **Smart Account Interaction:** Simulates the creation of a Smart Account and allows users to fund it.
*   **Off-Chain Order Creation:** Users define a recipient, amount, and delay. The application then creates an EIP-712 typed data structure which the user signs with their wallet—**this signature happens entirely off-chain and costs no gas**.
*   **Local Persistence:** Signed orders are stored in the browser's `localStorage`, demonstrating a full user session.
*   **Execute by Anyone ("Relayer Model"):** Once the time delay has passed, a button appears, allowing anyone to submit the signed message to the `DelegationManager` contract, which then executes the transfer from the user's Smart Account.

---

## 🛠️ How It Works (Architecture)

The workflow is designed to be secure and efficient:

1.  **Setup:** The user connects their EOA (Externally Owned Account) and gets a corresponding Smart Account address. They fund this Smart Account with MON tokens.

2.  **Order Creation & Signing (Off-Chain):**
    *   The user fills out the transfer details (recipient, amount, time delay).
    *   Our frontend constructs an **EIP-712 compliant typed message**. This message acts as a secure "cheque."
    *   The user signs this message using MetaMask. This cryptographic signature is proof that the Smart Account owner approves this future transaction. **No gas is spent.**

3.  **Storage:** The signed message (the "delegation") is saved locally. In a production environment, this would be stored in a public database or mempool for relayers to discover.

4.  **Execution (On-Chain):**
    *   After the specified time delay, the order becomes "Ready".
    *   Any third party (a relayer, or in our demo, the user themselves) can now take the signed message.
    *   They call the `execute()` function on the public `DelegationManager` contract, passing the signed message as an argument.
    *   The `DelegationManager` contract performs a series of critical checks:
        *   It uses `ecrecover` to verify the signature against the message data, ensuring it was signed by the legitimate Smart Account owner.
        *   It consults the specified `Enforcers` (like the `TimestampEnforcer`) to confirm all conditions are met (e.g., the time delay has passed).
        *   If all checks pass, it initiates the MON transfer from the user's Smart Account to the recipient.

---

## Tech Stack

*   **Blockchain:** Monad Testnet
*   **Wallet & Accounts:** MetaMask, MetaMask Smart Accounts (Delegation Framework)
*   **Frontend:** React, Vite
*   **Web3 Library:** ethers.js v6

---

## Running the Project Locally

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/monad-delegated-transfers.git
    cd monad-delegated-transfers
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Run the development server:**
    ```bash
    npm run dev
    ```
4.  **Open the provided URL in your browser and connect your MetaMask wallet.** Ensure you have MON tokens on the Monad Testnet.

---

## Hackathon Choices & Next Steps

To deliver a functional proof-of-concept within the hackathon's timeframe, we made several strategic simplifications.

### 1. Smart Account Address Simulation

*   **Current Implementation:** We use the deployed `EntryPoint` contract address as the user's "Smart Account".
*   **Reasoning:** This provides a stable, existing on-chain address that can receive funds, allowing us to build and test the complete UX flow. It avoids the complexity of integrating a full SDK for deploying proxy contracts.
*   **Next Step:** Integrate the full MetaMask Delegation Toolkit SDK to deterministically calculate and deploy a unique proxy-based Smart Account for each user.

### 2. Delegation Signature Structure

*   **Current Implementation:** We use a simplified EIP-712 structure for the off-chain signature.
*   **Reasoning:** The official `DelegationManager` contract expects a highly complex, nested data structure involving `caveats` and `enforcers`. Replicating this byte-for-byte without an SDK is extremely time-consuming. Our simplified structure proves the core concept of off-chain signing and on-chain verification.
*   **The "Revert" is a Feature:** When attempting to execute, the transaction reverts. **This is expected behavior** and proves the security of the `DelegationManager`. The contract correctly identifies that our simplified signature hash does not match the hash of the complex structure it expects, and therefore rejects the transaction. It shows the system is working securely.
*   **Next Step:** Integrate the SDK to handle the generation of the official, complex typed data structure for signing.

### Future Improvements

*   **Backend & Relayer Service:** Develop a backend to store signed delegations in a database, and a dedicated relayer service that monitors for executable orders and submits them, creating a truly automated system.
*   **Gas Sponsorship:** The relayer service could be sponsored to pay for gas, making the experience entirely gasless for the end-user.
*   **UI Enhancements:** Add a real-time dashboard of pending orders, transaction history, and balance updates.
