# zCoin

Long Live Zerebro

A Solana program for migrating pump.fun tokens to new tokenomics with precise decimal math, cap enforcement, and administrative controls. Designed specifically for pump.fun token migrations with 10:1 ratio (10 old → 1 new).

## Features

- ✅ **Deterministic config PDA** (seeded by new_mint) so no misbinding
- ✅ **Correct cross-decimals math** (u128, no truncation bugs)
- ✅ **Strict account checks** (mint/owner matching, authority assertions)
- ✅ **Cap + window enforcement** (robust)
- ✅ **On-chain finalize** that revokes mint authority to None (supply can't inflate)
- ✅ **Emergency pause** and clean events for transparency
- ✅ **Freeze authority** (standard SPL) retained by governance multisig for sanctioned/bad actors
- ✅ **TypeScript scripts** fixed to avoid BigInt→Number precision loss

## Project Structure

```
zCoin/
├─ Anchor.toml
├─ Cargo.toml
├─ programs/
│  └─ zcoin/
│     ├─ Cargo.toml
│     └─ src/lib.rs
├─ ts/
│  ├─ package.json
│  ├─ tsconfig.json
│  └─ scripts/
│     ├─ 01_create_new_mint.ts
│     ├─ 02_initialize_redeemer.ts
│     ├─ 03_redeem.ts
│     └─ 04_freeze_unfreeze.ts
└─ env.example
```

## Prerequisites

1. **Install toolchain:**
   ```bash
   cargo --version
   anchor --version         # should be 0.29.x
   solana --version         # 1.18.x or later recommended
   ```

2. **Install dependencies:**
   ```bash
   cd ts && yarn install
   ```

## Setup & Deployment

### 1. Set Program ID

```bash
anchor keys list
# Replace the program id in Anchor.toml and lib.rs declare_id!
```

### 2. Build & Deploy

```bash
# Start local validator (in new terminal)
solana-test-validator -r

# Build and deploy
anchor build
anchor deploy
```

### 3. Configure Environment

```bash
cp env.example .env
# Fill in your values in .env
```

## Pump.fun Migration Workflow

### 0. Verify Pump.fun Token (CRITICAL FIRST STEP)

```bash
yarn ts-node ./ts/scripts/00_verify_burn_authority.ts
# Verifies the pump.fun token can be burned and has correct decimals (6)
```

**This step is CRITICAL** - it checks:
- Token has 6 decimals (pump.fun standard)
- Mint authority is renounced (allows user burns)
- Token appears to be a graduated pump.fun token

### 1. Create New Mint

```bash
yarn ts-node ./ts/scripts/01_create_new_mint.ts
# Export NEW_MINT and MINT_AUTH_PDA output into .env
```

### 2. Initialize Migration Program

```bash
yarn ts-node ./ts/scripts/02_initialize_redeemer.ts
# Mints 20%/10%/10% fixed allocations and sets 180-day migration window
```

### 3. Users Redeem Tokens

```bash
yarn ts-node ./ts/scripts/03_redeem.ts
# Users burn pump.fun tokens and receive new tokens at 10:1 ratio
```

### 4. Admin Controls (if needed)

```bash
# Freeze/thaw specific accounts
yarn ts-node ./ts/scripts/04_freeze_unfreeze.ts

# Pause migration (emergency)
# Add pause script here
```

### 5. Finalize Migration

```bash
yarn ts-node ./ts/scripts/05_finalize.ts
# After 180 days, revoke mint authority permanently
```

## Security Features

- **No custody or escrow**: The program never holds tokens; it only burns (OLD) and mints (NEW)
- **Precise math**: u128 rational with decimal scaling (no lossy integer divisions)
- **Hard caps**: Cannot mint above the 60% migration cap; fixed allocations minted exactly once at initialize
- **Lifecycle lock-down**: Finalize revokes mint authority on-chain; no further minting possible
- **Admin model**: Only pause/window changes require admin signer; all actions emit events
- **Freeze authority**: SPL native; keep it behind a multisig + timelock

## Environment Variables

See `env.example` for required configuration:

- `RPC`: Solana RPC endpoint
- `WALLET`: Path to deployer keypair
- `GOV_WALLET`: Path to governance keypair
- `USER_WALLET`: Path to user keypair
- `ZCOIN_PROGRAM`: Program ID
- `OLD_MINT`: Pump.fun token mint address (6 decimals)
- `OLD_DECIMALS`: Pump.fun token decimals (typically 6)
- `NEW_DECIMALS`: New token decimals (typically 9)
- `GOVERNANCE`: Governance multisig pubkey (freeze authority)
- `TREASURY_OWNER`, `LIQUIDITY_OWNER`, `CONTRIBUTORS_OWNER`: Fixed allocation recipients
- `TOTAL_CAP`: Total supply in base units (e.g., 100M * 10^9 = 1e17)

## Program Functions

- `initialize`: Set up migration with fixed allocations and migration window
- `redeem`: Burn OLD tokens and mint NEW tokens at specified ratio
- `set_pause`: Admin function to pause/unpause redemptions
- `update_window`: Admin function to update migration window times
- `finalize`: Revoke mint authority after migration window ends

## Error Handling

The program includes comprehensive error handling for:
- Math overflow protection
- Invalid allocation math
- Cap exceeded scenarios
- Outside migration window
- Wrong mint/owner validation
- Slippage protection
- Dust amount prevention

## Pump.fun Token Migration Guide

### Understanding Pump.fun Tokens

Pump.fun tokens have specific characteristics:
- **Total Supply**: 1,000,000,000 tokens (1B)
- **Decimals**: 6 (not 9 like most SPL tokens)
- **Bonding Curve**: ~800M tokens sold on bonding curve
- **Graduation**: When curve completes, token graduates to PumpSwap
- **Authorities**: Mint authority is renounced after graduation (allows burns)

### Migration Strategy

This program implements a **burn-to-mint** migration:
1. **10:1 Ratio**: 10 pump.fun tokens → 1 new token
2. **Supply Reduction**: 1B → 100M total supply
3. **180-Day Window**: Migration open for 6 months
4. **Fixed Allocations**: 20% treasury, 10% liquidity, 10% contributors
5. **Migration Pool**: 60% available for user migration

### Getting Your Pump.fun Token Address

1. Go to [pump.fun](https://pump.fun)
2. Find your token's page
3. Copy the mint address from the URL or token info
4. Verify it's graduated (has liquidity on PumpSwap)

### Migration Math Example

```
Pump.fun Token: 1,000,000,000 supply @ 6 decimals
New Token: 100,000,000 supply @ 9 decimals

User has: 1,000,000 pump.fun tokens (1M)
Conversion: 1,000,000 ÷ 10 = 100,000 new tokens
```

### Pre-Migration Checklist

- [ ] Verify pump.fun token is graduated (has DEX liquidity)
- [ ] Confirm token has 6 decimals
- [ ] Check mint authority is renounced
- [ ] Set up governance multisig for freeze authority
- [ ] Prepare fixed allocation recipients
- [ ] Calculate total supply and migration cap

### Post-Migration

- [ ] Monitor migration progress
- [ ] Communicate with community
- [ ] Set up new token liquidity
- [ ] Finalize after 180 days
- [ ] Burn unredeemed allocation

## License

This project is provided as-is for educational and development purposes.
