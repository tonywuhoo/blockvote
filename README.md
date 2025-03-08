# BlockVote NFT ID Contract - Developer Guide

## 🔹 How to Verify You’re Using the Same Program ID & Deployment Wallet  

### Check If You’re Using the Correct Program ID  

# Run the following command:

solana address -k .anchor/nft_id_contract-keypair.json

# If the output matches the expected Program ID:
# 7LwZn7j96YeNkTot1FuLorL6Js7uM6ma4Z3nNWL6H9QJ
# Then you are using the correct contract.

---

### Check If You’re Using the Shared Deployment Wallet  
# Verify your active Solana wallet:
solana address

# ✅ If the output matches the expected Developer Wallet:
# 6SRJLj1E8eDZ78iXcMoHB25mWAWZaCDHxMqKwsNZ9Gti
# Then you are using the correct wallet.

# If not, set it manually:
solana config set --keypair .anchor/deployer-wallet.json

---

## 🔹 How Program ID & Deployment Wallet Are Connected
# - The **Program ID (7LwZn...)** is tied to the **initial deployment**.
# - The **Developer Wallet (6SRJL...)** is the **upgrade authority** for the contract.
# - If a different wallet deploys, **a new Program ID is created**, which creates a new contract. 
# - Using the same **wallet & keypair** ensures all team members interact with the **same contract**.

