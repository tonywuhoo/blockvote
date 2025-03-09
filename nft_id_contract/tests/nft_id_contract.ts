import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { NftIdContract } from "../target/types/nft_id_contract";
import { assert } from "chai";

describe("NFT ID Contract", () => {
  // Set the provider from the environment
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.NftIdContract as anchor.Program<NftIdContract>;
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const payer = provider.wallet as anchor.Wallet;

  // PDAs and bump
  let mint: PublicKey;
  let metadata: PublicKey;
  let tokenData: PublicKey;
  let registry: PublicKey;
  let destination: PublicKey;
  let mintBump: number;

  // Metaplex metadata program ID (standard)
  const metadataProgramId = new PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
  );

  // Identity parameters for minting
  const name = "John Doe";
  const dob = "1990-01-01";
  const gender = "Male";

  before(async () => {
    // Derive PDAs for mint, metadata, tokenData, and registry.
    [mint, mintBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint")],
      program.programId
    );
    [metadata] = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), metadataProgramId.toBuffer(), mint.toBuffer()],
      metadataProgramId
    );
    [tokenData] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_data"), mint.toBuffer()],
      program.programId
    );
    [registry] = PublicKey.findProgramAddressSync(
      [Buffer.from("registry")],
      program.programId
    );

    // Derive the associated token account for the destination.
    destination = await anchor.utils.token.associatedAddress({
      mint,
      owner: payer.publicKey,
    });

    console.log("Mint:", mint.toBase58());
    console.log("Metadata:", metadata.toBase58());
    console.log("Token Data:", tokenData.toBase58());
    console.log("Registry:", registry.toBase58());
    console.log("Destination ATA:", destination.toBase58());

    // Initialize the registry if it doesn't already exist.
    const initRegistryTx = await program.methods
      .initializeRegistry()
      .accounts({
        tokenRegistry: registry,
        payer: payer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("Registry Initialized:", initRegistryTx);
  });

  it("Mints an NFT identity", async () => {
    const accounts = {
      metadata,
      mint,
      tokenData,
      destination,
      payer: payer.publicKey,
      tokenRegistry: registry,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      systemProgram: SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      tokenMetadataProgram: metadataProgramId,
    } as any; // Bypass excess property checks

    const tx = await program.methods
      .initiateToken({ name, dob, gender })
      .accounts(accounts)
      .rpc();

    console.log("NFT Minted Tx:", tx);
    const tokenDataAccount = await program.account.tokenData.fetch(tokenData);
    // Check that the on-chain identity record is marked active.
    assert(tokenDataAccount.is_active === true, "NFT should be active.");
  });

  it("Burns and closes the NFT identity then re-mints", async () => {
    // Call the burn_token instruction to burn the NFT and mark token_data inactive.
    const burnTx = await program.methods
      .burnToken()
      .accounts({
        tokenData,
        destination,
        mint,
        payer: payer.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .rpc();
    console.log("Burn Tx:", burnTx);

    // Call close_identity to remove the identity record and close token_data.
    const closeTx = await program.methods
      .closeIdentity()
      .accounts({
        tokenData,
        tokenRegistry: registry,
        payer: payer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("Close Identity Tx:", closeTx);

    // Re‑mint a new NFT identity with updated parameters.
    const newName = "John Smith";
    const newDob = "1990-01-01"; // Example: same DOB for testing
    const newGender = "Male";

    const accounts = {
      metadata,
      mint,
      tokenData,
      destination,
      payer: payer.publicKey,
      tokenRegistry: registry,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      systemProgram: SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      tokenMetadataProgram: metadataProgramId,
    } as any;

    const remintTx = await program.methods
      .initiateToken({ name: newName, dob: newDob, gender: newGender })
      .accounts(accounts)
      .rpc();
    console.log("Re-mint Tx:", remintTx);

    const tokenDataAccountAfter = await program.account.tokenData.fetch(tokenData);
    assert(tokenDataAccountAfter.is_active === true, "Re-minted NFT should be active.");
  });
});
