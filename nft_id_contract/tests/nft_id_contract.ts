import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { NftIdContract } from "../target/types/nft_id_contract";

describe("Minimal NFT Contract", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.NftIdContract as anchor.Program<NftIdContract>;
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const payer = provider.wallet as anchor.Wallet;

  let mint: PublicKey;
  let metadata: PublicKey;
  let destination: PublicKey;
  const metadataProgramId = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

  it("Mints a soulbound NFT with name/dob/gender", async () => {
    // Derive the mint PDA => seeds = [b"mint", payer.publicKey]
    [mint] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint"), payer.publicKey.toBuffer()],
      program.programId
    );

    // Derive metadata => seeds = [b"metadata", token_metadata_program, mint]
    [metadata] = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), metadataProgramId.toBuffer(), mint.toBuffer()],
      metadataProgramId
    );

    // Associated Token Account for this user
    destination = await anchor.utils.token.associatedAddress({
      mint,
      owner: payer.publicKey,
    });

    console.log("Mint PDA:", mint.toBase58());
    console.log("Metadata PDA:", metadata.toBase58());
    console.log("Destination ATA:", destination.toBase58());

    // Just call mint_nft with some dummy info
    const name = "Alice";
    const dob = "2000-01-01";
    const gender = "Female";

    const txSig = await program.methods
      .initiateToken(name, dob, gender)
      .accounts({
        metadata,
        mint,
        destination,
        payer: payer.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        tokenMetadataProgram: metadataProgramId,
      })
      .rpc();

    console.log("Mint NFT Tx Sig:", txSig);

    // Optionally, confirm we can fetch the minted account
    // or just trust that no error = success
    // anchor test automatically logs any errors

    // If you want to check metadata existence,
    // you can getAccountInfo of the metadata address
    // or do an anchor-spl cpi check. But not strictly needed.
  });
});
