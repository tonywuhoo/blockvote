import { 
    getAssociatedTokenAddress, 
    TOKEN_PROGRAM_ID, 
    burn, 
    closeAccount, 
    getAccount 
} from "@solana/spl-token";
import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import * as fs from "fs";

const walletPath = "../.anchor/deployer-wallet.json";
const walletJSON = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
const payer = Keypair.fromSecretKey(new Uint8Array(walletJSON));

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

async function burnAndRemoveNFT(mintAddress: string) {
    const owner = payer.publicKey;
    const mint = new PublicKey(mintAddress);

    const tokenAccount = await getAssociatedTokenAddress(mint, owner);

    try {
        const tokenAccountInfo = await getAccount(connection, tokenAccount);
        const balance = tokenAccountInfo.amount;

        if (balance > BigInt(0)) {
            console.log(`🔥 Burning ${balance} tokens from ${mintAddress}...`);

            await burn(
                connection,
                payer,
                tokenAccount,
                mint,
                owner, 
                balance 
            );

            console.log(`✅ Successfully burned NFT: ${mintAddress}`);
        }

        console.log(`🗑 Checking if token account ${tokenAccount.toBase58()} is empty...`);
        
        const updatedAccountInfo = await getAccount(connection, tokenAccount);
        if (updatedAccountInfo.amount == BigInt(0)) {
            console.log(`🗑 Token account is empty. Removing it...`);

            await closeAccount(
                connection,
                payer,
                tokenAccount,
                owner, 
                owner 
            );

            console.log(`✅ Token account ${tokenAccount.toBase58()} successfully removed.`);
        }
    } catch (error) {
        console.log(`⚠️ Token account ${tokenAccount.toBase58()} not found or already removed.`);
    }
}

(async () => {
    console.log("🔥 Starting NFT burn and cleanup process...");
    await burnAndRemoveNFT("5guvxnn2rnaUVffyEPECNCpTfmr5Tz1rRCYywFmjofas");
    await burnAndRemoveNFT("5qhmY8ZKmghgzhrKiQwppmBER9jEP1dGFPBFpjEPDWfR");
    await burnAndRemoveNFT("GgLTHPo25XiFsQJAkotD3KPiyMFeypJhUSx4UVcxfjcj");
    console.log("✅ All NFTs processed.");
})();
