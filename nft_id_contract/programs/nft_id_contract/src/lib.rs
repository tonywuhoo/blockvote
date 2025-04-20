use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_metadata_accounts_v3,
        mpl_token_metadata::types::DataV2,
        CreateMetadataAccountsV3,
        Metadata as Metaplex,
    },
    token::{set_authority, Mint, Token, TokenAccount},
};
use anchor_spl::token::spl_token as spl_token_3_5;
use solana_program::hash::hash;

declare_id!("GgLTHPo25XiFsQJAkotD3KPiyMFeypJhUSx4UVcxfjcj");

const DEFAULT_SYMBOL: &str = "BVID";
const DEFAULT_URI: &str = "https://app.ardrive.io/soulbound_example.json";
const DECIMALS: u8 = 0;

#[program]
pub mod nft_id_contract {
    use super::*;


    pub fn initiate_token(
        ctx: Context<InitiateToken>,
        name: String,
        dob: String,
        gender: String,
    ) -> Result<()> {
        // Combine user info into a single name string (optional).
        let combined_name = format!("{} | DOB: {} | {}", name, dob, gender);

        // If metadata is empty, create it
        if ctx.accounts.metadata.to_account_info().data_is_empty() {
            let token_metadata = DataV2 {
                name: combined_name,
                symbol: DEFAULT_SYMBOL.to_string(),
                uri: DEFAULT_URI.to_string(),
                seller_fee_basis_points: 0,
                creators: None,
                collection: None,
                uses: None,
            };

            let bump = ctx.bumps.mint;
            let payer_key = ctx.accounts.payer.key();

            let seeds: &[&[u8]] = &[
                b"mint",
                payer_key.as_ref(),
                &[bump],
            ];
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
            msg!("Metadata already exists; skipping creation.");
        }

        // Remove mint authority so no new tokens can be minted.
        let bump = ctx.bumps.mint;
        let payer_key = ctx.accounts.payer.key();

        let seeds: &[&[u8]] = &[
            b"mint",
            payer_key.as_ref(),
            &[bump],
        ];
        let signer = &[&seeds[..]];
        let cpi_program = ctx.accounts.token_program.to_account_info();

        // Only remove the mint authority. Keep the user as the ATA owner to avoid "Invalid instruction" errors.
        let mint_auth_ctx = CpiContext::new_with_signer(
            cpi_program,
            anchor_spl::token::SetAuthority {
                current_authority: ctx.accounts.mint.to_account_info(),
                account_or_mint: ctx.accounts.mint.to_account_info(),
            },
            signer,
        );
        set_authority(
            mint_auth_ctx,
            spl_token_3_5::instruction::AuthorityType::MintTokens,
            None,
        )?;

        msg!("NFT minted for wallet: {} (mint authority removed)", ctx.accounts.payer.key());
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(name: String, dob: String, gender: String)]
pub struct InitiateToken<'info> {
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        seeds = [b"mint", payer.key().as_ref()],
        bump,
        mint::decimals = DECIMALS,
        mint::authority = mint,
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer,
    )]
    pub destination: Account<'info, TokenAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,

    // Not mutable
    pub rent: Sysvar<'info, Rent>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metaplex>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("You have already minted an NFT.")]
    AlreadyMinted,
}
