use anchor_lang::prelude::*;
use anchor_spl::token::{
    self, Burn, Mint, MintTo, SetAuthority, Token, TokenAccount,
};
use anchor_spl::token::spl_token::instruction::AuthorityType;

declare_id!("ZerEbRoPRoGrAm11111111111111111111111111111"); // REPLACE AFTER DEPLOY

const MINT_AUTH_SEED: &[u8] = b"mint_auth";
const CONFIG_SEED: &[u8] = b"config";

#[program]
pub mod zcoin {
    use super::*;

    /// Initialize config, verify mint authorities, and mint the fixed allocations.
    pub fn initialize(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
        let cfg = &mut ctx.accounts.config;

        // Store constants
        cfg.bump = *ctx.bumps.get("config").unwrap();
        cfg.mint_auth_bump = *ctx.bumps.get("mint_authority").unwrap();
        cfg.admin = params.admin;
        cfg.old_mint = ctx.accounts.old_mint.key();
        cfg.new_mint = ctx.accounts.new_mint.key();
        cfg.ratio_num = params.ratio_num;
        cfg.ratio_den = params.ratio_den;
        require!(cfg.ratio_den > 0, ErrorCode::InvalidRatio);

        // Read decimals from chain (avoid param mismatch)
        cfg.old_decimals = ctx.accounts.old_mint.decimals;
        cfg.new_decimals = ctx.accounts.new_mint.decimals;

        cfg.total_cap = params.total_cap;
        cfg.migration_cap = params.migration_cap;
        cfg.migration_minted = 0;
        cfg.paused = false;
        cfg.start_ts = params.start_ts;
        cfg.end_ts = params.end_ts;
        cfg.finalized = false;

        // Cap sanity
        require!(cfg.migration_cap <= cfg.total_cap, ErrorCode::InvalidCap);

        // Verify NEW mint authority is the program PDA; freeze authority is admin (governance)
        let mint_auth_should = ctx.accounts.mint_authority.key();
        require!(
            ctx.accounts.new_mint.mint_authority
                == anchor_spl::token::spl_token::state::COption::Some(mint_auth_should),
            ErrorCode::WrongMintAuthority
        );
        require!(
            ctx.accounts.new_mint.freeze_authority
                == anchor_spl::token::spl_token::state::COption::Some(cfg.admin),
            ErrorCode::WrongFreezeAuthority
        );

        // Compute fixed allocations must equal TOTAL - MIGRATION
        let fixed_sum = params.treasury_amount as u128
            + params.liquidity_amount as u128
            + params.contributors_amount as u128;
        let expected_fixed = (cfg.total_cap as u128)
            .checked_sub(cfg.migration_cap as u128)
            .ok_or(ErrorCode::MathOverflow)?;
        require!(fixed_sum == expected_fixed, ErrorCode::BadAllocationMath);

        // Verify destination ATAs are for the NEW mint
        require_keys_eq!(ctx.accounts.treasury_ata.mint, cfg.new_mint, ErrorCode::WrongMint);
        require_keys_eq!(ctx.accounts.liquidity_ata.mint, cfg.new_mint, ErrorCode::WrongMint);
        require_keys_eq!(ctx.accounts.contributors_ata.mint, cfg.new_mint, ErrorCode::WrongMint);

        // Mint fixed allocations from PDA
        mint_to_pda(
            &ctx,
            &ctx.accounts.treasury_ata,
            params.treasury_amount
        )?;
        mint_to_pda(
            &ctx,
            &ctx.accounts.liquidity_ata,
            params.liquidity_amount
        )?;
        mint_to_pda(
            &ctx,
            &ctx.accounts.contributors_ata,
            params.contributors_amount
        )?;

        emit!(Initialized {
            admin: cfg.admin,
            old_mint: cfg.old_mint,
            new_mint: cfg.new_mint,
            total_cap: cfg.total_cap,
            migration_cap: cfg.migration_cap,
            start_ts: cfg.start_ts,
            end_ts: cfg.end_ts,
        });

        Ok(())
    }

    /// Admin pause/unpause
    pub fn set_pause(ctx: Context<AdminOnly>, paused: bool) -> Result<()> {
        ctx.accounts.config.paused = paused;
        emit!(Paused { paused });
        Ok(())
    }

    /// Update migration window times
    pub fn update_window(ctx: Context<AdminOnly>, start_ts: i64, end_ts: i64) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        cfg.start_ts = start_ts;
        cfg.end_ts = end_ts;
        emit!(WindowUpdated { start_ts, end_ts });
        Ok(())
    }

    /// Finalize: revoke mint authority to None (program signs as current mint authority).
    pub fn finalize(ctx: Context<Finalize>) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        require!(!cfg.finalized, ErrorCode::AlreadyFinalized);
        require!(Clock::get()?.unix_timestamp > cfg.end_ts, ErrorCode::TooEarly);

        let seeds: &[&[u8]] = &[
            MINT_AUTH_SEED,
            cfg.new_mint.as_ref(),
            &[cfg.mint_auth_bump],
        ];
        token::set_authority(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                SetAuthority {
                    account_or_mint: ctx.accounts.new_mint.to_account_info(),
                    current_authority: ctx.accounts.mint_authority.to_account_info(),
                },
                &[seeds],
            ),
            AuthorityType::MintTokens,
            None,
        )?;

        cfg.finalized = true;
        emit!(Finalized {});
        Ok(())
    }

    /// Burn OLD from caller and mint NEW at ratio, enforcing caps and window.
    pub fn redeem(ctx: Context<Redeem>, amount_old: u64, min_new_out: u64) -> Result<()> {
        let cfg = &mut ctx.accounts.config;

        require!(!cfg.paused, ErrorCode::Paused);
        let now = Clock::get()?.unix_timestamp;
        require!(now >= cfg.start_ts && now <= cfg.end_ts, ErrorCode::OutsideWindow);
        require!(!cfg.finalized, ErrorCode::AlreadyFinalized);

        // Validate accounts wiring
        require_keys_eq!(ctx.accounts.old_mint.key(), cfg.old_mint, ErrorCode::WrongMint);
        require_keys_eq!(ctx.accounts.new_mint.key(), cfg.new_mint, ErrorCode::WrongMint);
        require_keys_eq!(ctx.accounts.user_old_ata.mint, cfg.old_mint, ErrorCode::WrongMint);
        require_keys_eq!(ctx.accounts.user_new_ata.mint, cfg.new_mint, ErrorCode::WrongMint);
        require_keys_eq!(ctx.accounts.user_old_ata.owner, ctx.accounts.user.key(), ErrorCode::WrongOwner);
        require_keys_eq!(ctx.accounts.user_new_ata.owner, ctx.accounts.user.key(), ErrorCode::WrongOwner);

        // Burn OLD from user
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.old_mint.to_account_info(),
                    from: ctx.accounts.user_old_ata.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount_old,
        )?;

        // Compute NEW in base units with full rational scaling:
        // new_units = floor( amount_old * ratio_num * 10^new_decimals / (ratio_den * 10^old_decimals) )
        let num = (amount_old as u128)
            .checked_mul(cfg.ratio_num as u128).ok_or(ErrorCode::MathOverflow)?
            .checked_mul(pow10_u128(cfg.new_decimals)).ok_or(ErrorCode::MathOverflow)?;
        let den = (cfg.ratio_den as u128)
            .checked_mul(pow10_u128(cfg.old_decimals)).ok_or(ErrorCode::MathOverflow)?;
        let new_amt_u128 = num.checked_div(den).ok_or(ErrorCode::MathOverflow)?;
        let new_amt: u64 = u64::try_from(new_amt_u128).map_err(|_| ErrorCode::MathOverflow)?;

        require!(new_amt >= min_new_out, ErrorCode::Slippage);
        require!(new_amt > 0, ErrorCode::DustTooSmall);

        // Enforce migration cap
        let remaining = cfg.migration_cap.checked_sub(cfg.migration_minted).ok_or(ErrorCode::CapExceeded)?;
        require!(new_amt <= remaining, ErrorCode::CapExceeded);

        // Mint NEW to user (PDA signs)
        let seeds: &[&[u8]] = &[
            MINT_AUTH_SEED,
            cfg.new_mint.as_ref(),
            &[cfg.mint_auth_bump],
        ];
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.new_mint.to_account_info(),
                    to: ctx.accounts.user_new_ata.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
                &[seeds],
            ),
            new_amt,
        )?;

        // Bookkeeping
        cfg.migration_minted = cfg.migration_minted.checked_add(new_amt).ok_or(ErrorCode::MathOverflow)?;

        emit!(Redeemed {
            user: ctx.accounts.user.key(),
            burned_old: amount_old,
            minted_new: new_amt,
        });

        Ok(())
    }
}

// ---------- helpers ----------

fn mint_to_pda(ctx: &Context<Initialize>, to: &Account<TokenAccount>, amount: u64) -> Result<()> {
    let cfg = &ctx.accounts.config;
    let seeds: &[&[u8]] = &[
        MINT_AUTH_SEED,
        cfg.new_mint.as_ref(),
        &[cfg.mint_auth_bump],
    ];
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.new_mint.to_account_info(),
                to: to.to_account_info(),
                authority: ctx.accounts.mint_authority.to_account_info(),
            },
            &[seeds],
        ),
        amount,
    )
}

fn pow10_u128(d: u8) -> u128 {
    // supports up to 38 safely (u128 range); SPL decimals are <= 9
    let mut x: u128 = 1;
    for _ in 0..d {
        x = x.saturating_mul(10);
    }
    x
}

// ---------- accounts & params ----------

#[derive(Accounts)]
#[instruction(params: InitializeParams)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: governance/admin key stored in config; must sign admin ops later
    pub admin: UncheckedAccount<'info>,

    pub old_mint: Account<'info, Mint>,
    #[account(mut)]
    pub new_mint: Account<'info, Mint>,

    /// PDA that must currently be the new_mint's MintTokens authority
    /// Seeds: ["mint_auth", new_mint]
    /// CHECK: PDA signer only
    #[account(
        seeds = [MINT_AUTH_SEED, new_mint.key().as_ref()],
        bump
    )]
    pub mint_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + Config::SIZE,
        seeds = [CONFIG_SEED, new_mint.key().as_ref()],
        bump
    )]
    pub config: Account<'info, Config>,

    // ATAs for fixed allocations (must be NEW mint)
    #[account(mut)]
    pub treasury_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub liquidity_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub contributors_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeParams {
    pub admin: Pubkey,
    pub ratio_num: u64,      // e.g., 1
    pub ratio_den: u64,      // e.g., 10 => 10 old : 1 new
    pub total_cap: u64,      // NEW base units, fits u64 for typical 100M*1e9
    pub migration_cap: u64,  // 60% of total
    pub treasury_amount: u64,     // 20% of total
    pub liquidity_amount: u64,    // 10% of total
    pub contributors_amount: u64, // 10% of total
    pub start_ts: i64,
    pub end_ts: i64,
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(
        mut,
        seeds = [CONFIG_SEED, new_mint.key().as_ref()],
        bump = config.bump,
        has_one = admin
    )]
    pub config: Account<'info, Config>,
    /// CHECK: must equal config.admin and be a signer
    pub admin: Signer<'info>,
    pub new_mint: Account<'info, Mint>,
}

#[derive(Accounts)]
pub struct Finalize<'info> {
    #[account(
        mut,
        seeds = [CONFIG_SEED, new_mint.key().as_ref()],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub new_mint: Account<'info, Mint>,

    /// CHECK: PDA signer for mint authority
    #[account(
        seeds = [MINT_AUTH_SEED, new_mint.key().as_ref()],
        bump = config.mint_auth_bump
    )]
    pub mint_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Redeem<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED, new_mint.key().as_ref()],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    pub token_program: Program<'info, Token>,

    // OLD side
    pub old_mint: Account<'info, Mint>,
    #[account(mut)]
    pub user_old_ata: Account<'info, TokenAccount>,

    // NEW side
    #[account(mut)]
    pub new_mint: Account<'info, Mint>,
    #[account(mut)]
    pub user_new_ata: Account<'info, TokenAccount>,

    /// CHECK: PDA signer (["mint_auth", new_mint])
    #[account(
        seeds = [MINT_AUTH_SEED, new_mint.key().as_ref()],
        bump = config.mint_auth_bump
    )]
    pub mint_authority: UncheckedAccount<'info>,
}

#[account]
pub struct Config {
    pub bump: u8,
    pub mint_auth_bump: u8,
    pub admin: Pubkey,
    pub old_mint: Pubkey,
    pub new_mint: Pubkey,
    pub ratio_num: u64,
    pub ratio_den: u64,
    pub old_decimals: u8,
    pub new_decimals: u8,
    pub total_cap: u64,
    pub migration_cap: u64,
    pub migration_minted: u64,
    pub paused: bool,
    pub start_ts: i64,
    pub end_ts: i64,
    pub finalized: bool,
    pub _reserved: [u8; 63], // align to 8
}
impl Config {
    pub const SIZE: usize =
        1 + 1 + 32 + 32 + 32 + 8 + 8 + 1 + 1 + 8 + 8 + 8 + 1 + 8 + 8 + 1 + 63;
}

// ---------- events & errors ----------

#[event]
pub struct Initialized {
    pub admin: Pubkey,
    pub old_mint: Pubkey,
    pub new_mint: Pubkey,
    pub total_cap: u64,
    pub migration_cap: u64,
    pub start_ts: i64,
    pub end_ts: i64,
}

#[event]
pub struct Redeemed {
    #[index]
    pub user: Pubkey,
    pub burned_old: u64,
    pub minted_new: u64,
}

#[event]
pub struct Paused { pub paused: bool }
#[event]
pub struct WindowUpdated { pub start_ts: i64, pub end_ts: i64 }
#[event]
pub struct Finalized {}

#[error_code]
pub enum ErrorCode {
    #[msg("Caller is not admin")] NotAdmin,
    #[msg("Math overflow")] MathOverflow,
    #[msg("Invalid allocation math")] BadAllocationMath,
    #[msg("Migration cap exceeded")] CapExceeded,
    #[msg("Program is paused")] Paused,
    #[msg("Outside migration window")] OutsideWindow,
    #[msg("Wrong mint provided")] WrongMint,
    #[msg("Wrong owner for token account")] WrongOwner,
    #[msg("Minimum out not satisfied")] Slippage,
    #[msg("Invalid cap config")] InvalidCap,
    #[msg("Finalize called too early")] TooEarly,
    #[msg("Already finalized")] AlreadyFinalized,
    #[msg("Invalid ratio")] InvalidRatio,
    #[msg("Dust too small after conversion")] DustTooSmall,
    #[msg("New mint authority isn't the program PDA")] WrongMintAuthority,
    #[msg("Freeze authority isn't the admin key")] WrongFreezeAuthority,
}
