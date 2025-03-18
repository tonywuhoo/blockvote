// import * as anchor from "@coral-xyz/anchor";
// import { PublicKey, SystemProgram } from "@solana/web3.js";
// import { NftIdContract } from "../target/types/nft_id_contract";
// import { assert } from "chai";

// describe("NFT ID Contract", () => {
//   // Set the provider from the environment
//   anchor.setProvider(anchor.AnchorProvider.env());
//   const program = anchor.workspace.NftIdContract as anchor.Program<NftIdContract>;
//   const provider = anchor.getProvider() as anchor.AnchorProvider;
//   const payer = provider.wallet as anchor.Wallet;

//   // PDAs and bump
//   let mint: PublicKey;
//   let metadata: PublicKey;
//   let tokenData: PublicKey;
//   let registry: PublicKey;
//   let destination: PublicKey;
//   let mintBump: number;

//   // Metaplex metadata program ID (standard)
//   const metadataProgramId = new PublicKey(
//     "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
//   );

//   // Identity parameters for minting
//   const name = "John Doe";
//   const dob = "1990-01-01";
//   const gender = "Male";

//   before(async () => {
//     // Derive PDAs for mint, metadata, tokenData, and registry.
//     [mint, mintBump] = PublicKey.findProgramAddressSync(
//       [Buffer.from("mint")],
//       program.programId
//     );
//     [metadata] = PublicKey.findProgramAddressSync(
//       [Buffer.from("metadata"), metadataProgramId.toBuffer(), mint.toBuffer()],
//       metadataProgramId
//     );
//     [tokenData] = PublicKey.findProgramAddressSync(
//       [Buffer.from("token_data"), mint.toBuffer()],
//       program.programId
//     );
//     [registry] = PublicKey.findProgramAddressSync(
//       [Buffer.from("registry")],
//       program.programId
//     );

//     // Derive the associated token account for the destination.
//     destination = await anchor.utils.token.associatedAddress({
//       mint,
//       owner: payer.publicKey,
//     });

//     console.log("Mint:", mint.toBase58());
//     console.log("Metadata:", metadata.toBase58());
//     console.log("Token Data:", tokenData.toBase58());
//     console.log("Registry:", registry.toBase58());
//     console.log("Destination ATA:", destination.toBase58());

//     // Initialize the registry if it doesn't already exist.
//     const initRegistryTx = await program.methods
//       .initializeRegistry()
//       .accounts({
//         tokenRegistry: registry,
//         payer: payer.publicKey,
//         systemProgram: SystemProgram.programId,
//       })
//       .rpc();
//     console.log("Registry Initialized:", initRegistryTx);
//   });

//   it("Mints an NFT identity", async () => {
//     const accounts = {
//       metadata,
//       mint,
//       tokenData,
//       destination,
//       payer: payer.publicKey,
//       tokenRegistry: registry,
//       rent: anchor.web3.SYSVAR_RENT_PUBKEY,
//       systemProgram: SystemProgram.programId,
//       tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
//       associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
//       tokenMetadataProgram: metadataProgramId,
//     } as any; // Bypass excess property checks

//     const tx = await program.methods
//       .initiateToken({ name, dob, gender })
//       .accounts(accounts)
//       .rpc();

//     console.log("NFT Minted Tx:", tx);
//     const tokenDataAccount = await program.account.tokenData.fetch(tokenData);
//     // Check that the on-chain identity record is marked active.
//     assert(tokenDataAccount.isActive === true, "NFT should be active.");
//   });

//   it("Burns and closes the NFT identity then re-mints", async () => {
//     // Call the burn_token instruction to burn the NFT and mark token_data inactive.
//     const burnTx = await program.methods
//       .burnToken()
//       .accounts({
//         tokenData,
//         destination,
//         mint,
//         payer: payer.publicKey,
//         tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
//       })
//       .rpc();
//     console.log("Burn Tx:", burnTx);

//     // Call close_identity to remove the identity record and close token_data.
//     const closeTx = await program.methods
//       .closeIdentity()
//       .accounts({
//         tokenData,
//         tokenRegistry: registry,
//         payer: payer.publicKey,
//         systemProgram: SystemProgram.programId,
//       })
//       .rpc();
//     console.log("Close Identity Tx:", closeTx);

//     // Re‑mint a new NFT identity with updated parameters.
//     const newName = "John Smith";
//     const newDob = "1990-01-01"; // Example: same DOB for testing
//     const newGender = "Male";

//     const accounts = {
//       metadata,
//       mint,
//       tokenData,
//       destination,
//       payer: payer.publicKey,
//       tokenRegistry: registry,
//       rent: anchor.web3.SYSVAR_RENT_PUBKEY,
//       systemProgram: SystemProgram.programId,
//       tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
//       associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
//       tokenMetadataProgram: metadataProgramId,
//     } as any;

//     const remintTx = await program.methods
//       .initiateToken({ name: newName, dob: newDob, gender: newGender })
//       .accounts(accounts)
//       .rpc();
//     console.log("Re-mint Tx:", remintTx);

//     const tokenDataAccountAfter = await program.account.tokenData.fetch(tokenData);
//     assert(tokenDataAccountAfter.isActive === true, "Re-minted NFT should be active.");
//   });
// });


import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { NftIdContract } from '../target/types/nft_id_contract';
import { PublicKey } from '@solana/web3.js';

describe('Voting', () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.NftIdContract as Program<NftIdContract>;

  it('initializePoll', async () => {

    const [pollAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("poll"), new anchor.BN(1).toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const tx = await program.methods.initializePoll(
        new anchor.BN(1),
        new anchor.BN(0),
        new anchor.BN(1759508293),
        "test-poll",
        "description",
    )
    .rpc();

    console.log('Your transaction signature', tx);
  });

  it('initialize candidates', async () => {
    const pollIdBuffer = new anchor.BN(1).toArrayLike(Buffer, "le", 8)

    const [pollAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("poll"), pollIdBuffer],
      program.programId
    );

    const batmanTx = await program.methods.initializeCandidate(
      new anchor.BN(1), 
      "batman",
    ).accounts({
      pollAccount: pollAddress
    })
    .rpc();

    const supermanTx = await program.methods.initializeCandidate(
      new anchor.BN(1), 
      "superman",
    ).accounts({
      pollAccount: pollAddress
    })
    .rpc();

    console.log('Your transaction signature', batmanTx);
  });

  it('vote', async () => {

    const voteTx = await program.methods.vote(
      new anchor.BN(1),
      "superman",
    )
    .rpc();

    console.log('Your transaction signature', voteTx);
  });
});