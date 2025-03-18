use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_metadata_accounts_v3, mpl_token_metadata::types::DataV2, CreateMetadataAccountsV3,
        Metadata as Metaplex,
    },
    token::{set_authority, burn, Mint, Token, TokenAccount},
};
use anchor_spl::token::spl_token as spl_token_3_5;
use solana_program::hash::hash;

declare_id!("G1AMtv7feMb51dTC2i2JhTMfBfBKc5HUomGj1szPaE74");

const BLOCKVOTE_NAME: &str = "BlockVote ID";
const BLOCKVOTE_SYMBOL: &str = "BVID";
const BLOCKVOTE_URI: &str = "https://app.ardrive.io/#/file/c23a694e-a621-47fb-a61b-76496089db11/view";
const DECIMALS: u8 = 9;

#[program]
pub mod nft_id_contract {
    use super::*;

    /// Initializes the registry PDA for storing token records.
    pub fn initialize_registry(ctx: Context<InitializeRegistry>) -> Result<()> {
        let registry = &mut ctx.accounts.token_registry;
        registry.records = Vec::new();
        msg!("Token registry initialized.");
        Ok(())
    }

    /// Mints an NFT identity.
    /// If the token_data account exists and is inactive, it will be re‑initialized.
    pub fn initiate_token(ctx: Context<InitToken>, params: InitTokenParams) -> Result<()> {
        // If the token_data account exists and is active, prevent a new mint.
        if ctx.accounts.token_data.is_active {
            return Err(ErrorCode::AlreadyMinted.into());
        }

        // Compute identity hashes.
        let hashed_name = hash(params.name.as_bytes()).to_bytes();
        let hashed_dob = hash(params.dob.as_bytes()).to_bytes();
        let hashed_gender = hash(params.gender.as_bytes()).to_bytes();

        // Check for duplicate identity in the registry.
        if ctx.accounts.token_registry.records.iter().any(|record| {
            record.hashed_name == hashed_name &&
            record.hashed_dob == hashed_dob &&
            record.hashed_gender == hashed_gender
        }) {
            return Err(ErrorCode::DuplicateIdentity.into());
        }

        // Create metadata only if the metadata account is empty.
        if ctx.accounts.metadata.to_account_info().data_is_empty() {
            let token_metadata: DataV2 = DataV2 {
                name: BLOCKVOTE_NAME.to_string(),
                symbol: BLOCKVOTE_SYMBOL.to_string(),
                uri: BLOCKVOTE_URI.to_string(),
                seller_fee_basis_points: 0,
                creators: None,
                collection: None,
                uses: None,
            };

            let bump = ctx.bumps.mint;
            let seeds: &[&[u8]] = &[b"mint", &[bump]];
            let signer = &[&seeds[..]];

            let metadata_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMetadataAccountsV3 {
                    payer: ctx.accounts.payer.to_account_info(),
                    update_authority: ctx.accounts.mint.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    metadata: ctx.accounts.metadata.to_account_info(),
                    mint_authority: ctx.accounts.mint.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
                signer,
            );
            create_metadata_accounts_v3(metadata_ctx, token_metadata, false, true, None)?;
        } else {
            msg!("Metadata account already exists. Skipping metadata creation.");
        }

        // Update token_data with the new identity info and mark it active.
        let token_data = &mut ctx.accounts.token_data;
        token_data.hashed_name = hashed_name;
        token_data.hashed_dob = hashed_dob;
        token_data.hashed_gender = hashed_gender;
        token_data.is_active = true;

        // Manually copy the inner data into the registry.
        ctx.accounts.token_registry.records.push(TokenData {
            hashed_name: token_data.hashed_name,
            hashed_dob: token_data.hashed_dob,
            hashed_gender: token_data.hashed_gender,
            is_active: token_data.is_active,
        });

        // Set authorities as in the soulbound mechanism.
        let bump = ctx.bumps.mint;
        let seeds: &[&[u8]] = &[b"mint", &[bump]];
        let signer = &[&seeds[..]];

        let cpi_program = ctx.accounts.token_program.to_account_info();

        let mint_authority_ctx = CpiContext::new_with_signer(
            cpi_program.clone(),
            anchor_spl::token::SetAuthority {
                current_authority: ctx.accounts.mint.to_account_info(),
                account_or_mint: ctx.accounts.mint.to_account_info(),
            },
            signer,
        );
        set_authority(
            mint_authority_ctx,
            spl_token_3_5::instruction::AuthorityType::MintTokens,
            None,
        )?;

        let ata_authority_ctx = CpiContext::new_with_signer(
            cpi_program,
            anchor_spl::token::SetAuthority {
                current_authority: ctx.accounts.destination.to_account_info(),
                account_or_mint: ctx.accounts.destination.to_account_info(),
            },
            signer,
        );
        set_authority(
            ata_authority_ctx,
            spl_token_3_5::instruction::AuthorityType::AccountOwner,
            None,
        )?;

        msg!("✅ Token minted successfully & is soulbound.");
        Ok(())
    }

    /// Burns the NFT token and marks the token_data record as inactive.
    pub fn burn_token(ctx: Context<BurnToken>) -> Result<()> {
        let cpi_accounts = anchor_spl::token::Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.destination.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        burn(cpi_ctx, 1)?;

        let token_data = &mut ctx.accounts.token_data;
        token_data.is_active = false;

        msg!("🔥 NFT burned and marked as inactive.");
        Ok(())
    }

    /// Closes the identity record (token_data) and removes its record from the registry.
    /// This “wipes” the on-chain identity record so that a new mint can be initialized.
    pub fn close_identity(ctx: Context<CloseIdentity>) -> Result<()> {
        let identity = &ctx.accounts.token_data;
        let registry = &mut ctx.accounts.token_registry;
        registry.records.retain(|record| {
            record.hashed_name != identity.hashed_name ||
            record.hashed_dob != identity.hashed_dob ||
            record.hashed_gender != identity.hashed_gender
        });
        msg!("Identity record removed from registry. token_data will be closed.");
        Ok(())
    }

    /// Expires the NFT without burning tokens (sets token_data inactive).
    pub fn expire_token(ctx: Context<ExpireToken>) -> Result<()> {
        let token_data = &mut ctx.accounts.token_data;
        token_data.is_active = false;
        msg!("⏳ Token expired.");
        Ok(())
    }

    //************ VOTING CONTRACT ************//

    pub fn initialize_poll(ctx: Context<InitializePoll>, 
                _poll_id: u64, 
                start_time: u64, 
                end_time: u64,
                name: String,
                description: String) -> Result<()> {
            ctx.accounts.poll_account.poll_name = name;
            ctx.accounts.poll_account.poll_description = description;
            ctx.accounts.poll_account.poll_voting_start = start_time;
            ctx.accounts.poll_account.poll_voting_end = end_time;
            Ok(())
    }

    pub fn initialize_candidate(ctx: Context<InitializeCandidate>, 
                _poll_id: u64, 
                candidate: String) -> Result<()> {
            ctx.accounts.candidate_account.candidate_name = candidate;
            ctx.accounts.poll_account.poll_option_index += 1;
            Ok(())
    }

    pub fn vote(ctx: Context<Vote>, _poll_id: u64, _candidate: String) -> Result<()> {
        let candidate_account = &mut ctx.accounts.candidate_account;
        let current_time = Clock::get()?.unix_timestamp;

        if current_time > (ctx.accounts.poll_account.poll_voting_end as i64) {
            return Err(ErrorCode::VotingEnded.into());
        }

        if current_time <= (ctx.accounts.poll_account.poll_voting_start as i64) {
            return Err(ErrorCode::VotingNotStarted.into());
        }

        candidate_account.candidate_votes += 1;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(params: InitTokenParams)]
pub struct InitToken<'info> {
    /// CHECK: Unchecked metadata account; validated via downstream CPI.
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        seeds = [b"mint"],
        bump,
        payer = payer,
        mint::decimals = DECIMALS,
        mint::authority = mint,
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = payer,
        seeds = [b"token_data", mint.key().as_ref()],
        bump,
        space = 8 + std::mem::size_of::<TokenData>(),
    )]
    pub token_data: Account<'info, TokenData>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer,
    )]
    pub destination: Account<'info, TokenAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// This account must be initialized beforehand via `initialize_registry`.
    #[account(mut, seeds = [b"registry"], bump)]
    pub token_registry: Account<'info, TokenRegistry>,

    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metaplex>,
}

#[derive(Accounts)]
pub struct ExpireToken<'info> {
    #[account(mut)]
    pub token_data: Account<'info, TokenData>,
    #[account(mut)]
    pub payer: Signer<'info>,
}

#[derive(Accounts)]
pub struct BurnToken<'info> {
    #[account(mut)]
    pub token_data: Account<'info, TokenData>,
    #[account(mut)]
    pub destination: Account<'info, TokenAccount>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CloseIdentity<'info> {
    #[account(mut, close = payer)]
    pub token_data: Account<'info, TokenData>,
    #[account(mut)]
    pub token_registry: Account<'info, TokenRegistry>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeRegistry<'info> {
    #[account(
        init_if_needed,
        seeds = [b"registry"],
        bump,
        payer = payer,
        space = 8 + 4 + 10 * std::mem::size_of::<TokenData>(),
    )]
    pub token_registry: Account<'info, TokenRegistry>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct TokenData {
    pub hashed_name: [u8; 32],
    pub hashed_dob: [u8; 32],
    pub hashed_gender: [u8; 32],
    pub is_active: bool,
}

#[account]
pub struct TokenRegistry {
    pub records: Vec<TokenData>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct InitTokenParams {
    pub name: String,
    pub dob: String,
    pub gender: String,
}

#[error_code]
pub enum ErrorCode {
    #[msg("You have already minted an NFT.")]
    AlreadyMinted,
    #[msg("This identity has already been registered.")]
    DuplicateIdentity,
    #[msg("Voting has not started yet")]
    VotingNotStarted,
    #[msg("Voting has ended")]
    VotingEnded,
}






//************************** VOTING CONTRACT **************************//
#[derive(Accounts)]
#[instruction(poll_id: u64)]
pub struct InitializePoll<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + PollAccount::INIT_SPACE,
        seeds = [b"poll".as_ref(), poll_id.to_le_bytes().as_ref()],
        bump
    )]
    pub poll_account: Account<'info, PollAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(poll_id: u64, candidate: String)]
pub struct InitializeCandidate<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    pub poll_account: Account<'info, PollAccount>,

    #[account(
        init,
        payer = signer,
        space = 8 + CandidateAccount::INIT_SPACE,
        seeds = [poll_id.to_le_bytes().as_ref(), candidate.as_ref()],
        bump
    )]
    pub candidate_account: Account<'info, CandidateAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(poll_id: u64, candidate: String)]
pub struct Vote<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"poll".as_ref(), poll_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub poll_account: Account<'info, PollAccount>,

    #[account(
        mut,
        seeds = [poll_id.to_le_bytes().as_ref(), candidate.as_ref()],
        bump)]
    pub candidate_account: Account<'info, CandidateAccount>,
}

#[account]
#[derive(InitSpace)]
pub struct CandidateAccount {
    #[max_len(32)]
    pub candidate_name: String,
    pub candidate_votes: u64,
}

#[account]
#[derive(InitSpace)]
pub struct PollAccount{
    #[max_len(32)]
    pub poll_name: String,
    #[max_len(280)]
    pub poll_description: String,
    pub poll_voting_start: u64,
    pub poll_voting_end: u64,
    pub poll_option_index: u64,
}

