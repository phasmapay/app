use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("AGXRYordHf4s632jNueAbfFXpt6jb3oGeQ6ispnbzxxY");

#[program]
pub mod phasma_escrow {
    use super::*;

    pub fn create_escrow(ctx: Context<CreateEscrow>, amount: u64, expiry: i64) -> Result<()> {
        require!(amount > 0, EscrowError::ZeroAmount);
        require!(
            expiry > Clock::get()?.unix_timestamp,
            EscrowError::ExpiryInPast
        );

        let escrow = &mut ctx.accounts.escrow;
        escrow.sender = ctx.accounts.sender.key();
        escrow.recipient = ctx.accounts.recipient.key();
        escrow.mint = ctx.accounts.mint.key();
        escrow.amount = amount;
        escrow.expiry = expiry;
        escrow.bump = ctx.bumps.escrow;
        escrow.vault_bump = ctx.bumps.vault;
        escrow.claimed = false;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.sender_ata.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.sender.to_account_info(),
                },
            ),
            amount,
        )?;

        emit!(EscrowCreated {
            escrow: escrow.key(),
            sender: escrow.sender,
            recipient: escrow.recipient,
            amount,
            expiry,
        });

        Ok(())
    }

    pub fn claim_escrow(ctx: Context<ClaimEscrow>) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        require!(!escrow.claimed, EscrowError::AlreadyClaimed);

        let amount = escrow.amount;
        let sender = escrow.sender;
        let recipient = escrow.recipient;
        let expiry_bytes = escrow.expiry.to_le_bytes();

        let seeds: &[&[u8]] = &[
            b"escrow",
            sender.as_ref(),
            recipient.as_ref(),
            &expiry_bytes,
            &[escrow.bump],
        ];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.recipient_ata.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                &[seeds],
            ),
            amount,
        )?;

        let escrow = &mut ctx.accounts.escrow;
        escrow.claimed = true;

        emit!(EscrowClaimed {
            escrow: escrow.key(),
            recipient,
            amount,
        });

        Ok(())
    }

    pub fn refund_escrow(ctx: Context<RefundEscrow>) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        require!(!escrow.claimed, EscrowError::AlreadyClaimed);
        require!(
            Clock::get()?.unix_timestamp >= escrow.expiry,
            EscrowError::NotExpired
        );

        let amount = escrow.amount;
        let sender = escrow.sender;
        let recipient = escrow.recipient;
        let expiry_bytes = escrow.expiry.to_le_bytes();

        let seeds: &[&[u8]] = &[
            b"escrow",
            sender.as_ref(),
            recipient.as_ref(),
            &expiry_bytes,
            &[escrow.bump],
        ];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.sender_ata.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                &[seeds],
            ),
            amount,
        )?;

        emit!(EscrowRefunded {
            escrow: escrow.key(),
            sender,
            amount,
        });

        Ok(())
    }
}

// --- Accounts ---

#[derive(Accounts)]
#[instruction(amount: u64, expiry: i64)]
pub struct CreateEscrow<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    /// CHECK: recipient is just a pubkey, no signing required at creation
    pub recipient: UncheckedAccount<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = sender,
        space = 8 + Escrow::INIT_SPACE,
        seeds = [b"escrow", sender.key().as_ref(), recipient.key().as_ref(), &expiry.to_le_bytes()],
        bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        init,
        payer = sender,
        token::mint = mint,
        token::authority = escrow,
        seeds = [b"vault", escrow.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = sender,
    )]
    pub sender_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ClaimEscrow<'info> {
    #[account(mut)]
    pub recipient: Signer<'info>,

    #[account(
        mut,
        constraint = escrow.recipient == recipient.key() @ EscrowError::WrongRecipient,
        seeds = [b"escrow", escrow.sender.as_ref(), escrow.recipient.as_ref(), &escrow.expiry.to_le_bytes()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        seeds = [b"vault", escrow.key().as_ref()],
        bump = escrow.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = recipient,
        associated_token::mint = mint,
        associated_token::authority = recipient,
    )]
    pub recipient_ata: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, anchor_spl::associated_token::AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RefundEscrow<'info> {
    /// CHECK: permissionless crank, anyone can call after expiry
    #[account(mut)]
    pub cranker: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.sender.as_ref(), escrow.recipient.as_ref(), &escrow.expiry.to_le_bytes()],
        bump = escrow.bump,
        close = sender,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        seeds = [b"vault", escrow.key().as_ref()],
        bump = escrow.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// CHECK: validated by address constraint
    #[account(mut, address = escrow.sender)]
    pub sender: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = sender,
    )]
    pub sender_ata: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// --- State ---

#[account]
#[derive(InitSpace)]
pub struct Escrow {
    pub sender: Pubkey,     // 32
    pub recipient: Pubkey,  // 32
    pub mint: Pubkey,       // 32
    pub amount: u64,        // 8
    pub expiry: i64,        // 8
    pub bump: u8,           // 1
    pub vault_bump: u8,     // 1
    pub claimed: bool,      // 1
}

// --- Events ---

#[event]
pub struct EscrowCreated {
    pub escrow: Pubkey,
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub expiry: i64,
}

#[event]
pub struct EscrowClaimed {
    pub escrow: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
}

#[event]
pub struct EscrowRefunded {
    pub escrow: Pubkey,
    pub sender: Pubkey,
    pub amount: u64,
}

// --- Errors ---

#[error_code]
pub enum EscrowError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Expiry must be in the future")]
    ExpiryInPast,
    #[msg("Escrow already claimed")]
    AlreadyClaimed,
    #[msg("Escrow not yet expired")]
    NotExpired,
    #[msg("Wrong recipient")]
    WrongRecipient,
}
