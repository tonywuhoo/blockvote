import * as anchor from "@coral-xyz/anchor";
import * as web3 from "@solana/web3.js";
import assert from "assert";
import BN from "bn.js";
import { NftIdContract } from "../target/types/nft_id_contract";
import { associatedAddress } from "@coral-xyz/anchor/dist/cjs/utils/token";
import {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  createInitializeMintInstruction,
} from "@solana/spl-token";

describe("NFT ID Minting", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.NftIdContract as anchor.Program<NftIdContract>;

  // Generate a random keypair that will represent our token
  const mintKey: anchor.web3.Keypair = anchor.web3.Keypair.generate();

  const key = anchor.AnchorProvider.env().wallet.publicKey;

  let associatedTokenAccount = undefined;

  const METADATA_SEED = "metadata";
  const TOKEN_METADATA_PROGRAM_ID = new web3.PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
  );

  const MINT_SEED = "mint";
  const payer = program.provider.publicKey;
  const metadata = {
    name: "BlockVote NFT ID Token",
    symbol: "BVID",
    uri: "https://app.ardrive.io/#/file/c23a694e-a621-47fb-a61b-76496089db11/view",
    decimals: 9
  }
  const mintAmount = 1;

  const [mint] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from(MINT_SEED)],
    program.programId
  );

  const [metadataAddress] = web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from(METADATA_SEED),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  

  it("Initialize", async () => {

    

    const info = await program.provider.connection.getAccountInfo(mint);
    if (info) {
      return; // Do not attempt to initialize if already initialized
    }
    console.log(" Mint not found. Initializing Program...");

    const context = {
      metadata: metadataAddress,
      mint,
      payer,
      rent: web3.SYSVAR_RENT_PUBKEY,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
    };


    const txHash = await program.methods
      .initiateToken(metadata)
      .accounts(context)
      .rpc();

    await program.provider.connection.confirmTransaction(txHash, "finalized");
    console.log(`  https://explorer.solana.com/tx/${txHash}?cluster=devnet`);
    const newInfo = await program.provider.connection.getAccountInfo(mint);
    assert(newInfo, "  Mint should be initialized.");
  });

  it("mint tokens", async () => {
    const destination = await anchor.utils.token.associatedAddress({
      mint: mint,
      owner: payer,
    });

    let initialBalance: number;

    try {
      const balance = await program.provider.connection.getTokenAccountBalance(destination);
      initialBalance = balance.value.uiAmount;
    } catch {
      // Token account not yet initiated has 0 balance
      initialBalance = 0;
    }

    const context = {
      mint,
      destination,
      payer,
      rent: web3.SYSVAR_RENT_PUBKEY,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
    };

    const txHash = await program.methods
      .mintTokens(new BN(mintAmount * 10 ** metadata.decimals))
      .accounts(context)
      .rpc();
    await program.provider.connection.confirmTransaction(txHash);
    console.log(`  https://explorer.solana.com/tx/${txHash}?cluster=devnet`);

    const postBalance = (
      await program.provider.connection.getTokenAccountBalance(destination)
    ).value.uiAmount;
    assert.equal(
      initialBalance + mintAmount,
      postBalance,
      "Compare balances, it must be equal"
    );

    // Get the ATA for a token and the account that we want to own the ATA (but it might not existing on the SOL network yet)
    associatedTokenAccount = await getAssociatedTokenAddress(
      mintKey.publicKey,
      key
    );
  });
  it("Burn token", async () => {

    
    const from = await getAssociatedTokenAddress(mint, key);
    // Get anchor's wallet's public key
    const balance =  1;
    console.log("balance-", balance)

    const context = {
      mint: mintKey.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      from: associatedTokenAccount,
      authority: key,
    }

    const txBurn = await program.methods.burnToken(new anchor.BN(mintAmount * 10 ** metadata.decimals)).accounts(
      context).rpc();

    await program.provider.connection.confirmTransaction(txBurn);
    console.log(`  https://explorer.solana.com/tx/${txBurn}?cluster=devnet`);
    const postBalance = (
      await program.provider.connection.getTokenAccountBalance(from)
    ).value.uiAmount;
    console.log("Burn Successful", postBalance);
  });

});


