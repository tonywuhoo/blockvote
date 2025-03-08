import { 
    getAssociatedTokenAddress, 
    TOKEN_PROGRAM_ID, 
    burn, 
    getAccount 
  } from "@solana/spl-token";
  import { PublicKey, Connection, Keypair } from "@solana/web3.js";
  import * as fs from "fs";
  
  const walletPath = "../.anchor/deployer-wallet.json";
  const walletJSON = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const payer = Keypair.fromSecretKey(new Uint8Array(walletJSON));
  
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  async function burnNFT(mintAddress: string) {
    const owner = payer.publicKey;
    const mint = new PublicKey(mintAddress);
  
    const tokenAccount = await getAssociatedTokenAddress(mint, owner);
  
    const tokenAccountInfo = await getAccount(connection, tokenAccount);
    const balance = tokenAccountInfo.amount;
  
    if (balance == BigInt(0)) {
      console.log(`No balance found for NFT: ${mintAddress}. Skipping...`);
      return;
    }
  
    console.log(`🔥 Burning ${balance} tokens from ${mintAddress}...`);
  
    const tx = await burn(
      connection,
      payer,
      tokenAccount,
      mint,
      owner, 
      balance 
    );
  
    console.log(`✅ Successfully burned NFT: ${mintAddress}`);
  }
  
  (async () => {
    console.log("🔥 Starting NFT burn process...");
    //Add in
    await burnNFT("5guvxnn2rnaUVffyEPECNCpTfmr5Tz1rRCYywFmjofas");
    await burnNFT("5qhmY8ZKmghgzhrKiQwppmBER9jEP1dGFPBFpjEPDWfR");
    console.log("All NFTs burned");
  })();
  