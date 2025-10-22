# zCoin Upgrade System

## Overview

The zCoin program includes a comprehensive upgrade system that allows for program upgrades while ensuring all tokens and liquidity can be migrated to new versions. This system is designed for public repositories with security and transparency in mind.

## Key Features

### 🔒 **Multisig Governance**
- Upgrade authority can be a multisig wallet or external wallet
- All upgrade actions require upgrade authority signature
- Timelock mechanism prevents immediate execution

### ⏰ **Timelock Protection**
- Upgrades must be proposed with a timelock period (default: 7 days)
- Community has time to review and respond to upgrade proposals
- Upgrades can be cancelled before timelock expires

### 🔄 **Token Migration**
- Users can migrate their tokens from old to new program versions
- Maintains same conversion ratio during upgrades
- Automatic burning of old tokens and minting of new tokens

### 💧 **Liquidity Migration**
- Liquidity can be migrated to new program versions
- Upgrade authority controls liquidity migration
- Preserves liquidity for new program version

## Upgrade Process

### 1. **Propose Upgrade**
```bash
# Set environment variables
export UPGRADE_AUTHORITY=/path/to/upgrade-authority.json
export TARGET_PROGRAM=NewProgram1111111111111111111111111111111111
export TIMELOCK_DAYS=7

# Propose upgrade
npx ts-node ts/scripts/10_propose_upgrade.ts
```

### 2. **Wait for Timelock**
- Community has time to review the upgrade proposal
- Timelock period is configurable (default: 7 days)
- Upgrade can be cancelled during this period

### 3. **Execute Upgrade**
```bash
# Execute upgrade after timelock expires
npx ts-node ts/scripts/11_execute_upgrade.ts
```

### 4. **Migrate Tokens**
```bash
# Users migrate their tokens
export USER_WALLET=/path/to/user-wallet.json
export AMOUNT_OLD=1000000000

npx ts-node ts/scripts/13_migrate_tokens.ts
```

### 5. **Migrate Liquidity**
```bash
# Upgrade authority migrates liquidity
export LIQUIDITY_AMOUNT=10000000000
export NEW_LIQUIDITY_ATA=NewLiquidityATA1111111111111111111111111111111111

npx ts-node ts/scripts/14_migrate_liquidity.ts
```

## Security Considerations

### **Upgrade Authority**
- Should be a multisig wallet for maximum security
- Can be changed through governance if needed
- All upgrade actions require this authority

### **Timelock Mechanism**
- Prevents immediate execution of upgrades
- Gives community time to review and respond
- Can be cancelled if issues are discovered

### **Token Migration**
- Users maintain control of their tokens
- Migration is voluntary during upgrade window
- Same conversion ratio maintained

### **Liquidity Protection**
- Liquidity migration controlled by upgrade authority
- Preserves liquidity for new program version
- Transparent migration process

## Program Structure

### **Config Account Updates**
```rust
pub struct Config {
    pub version: u8,                    // Program version
    pub upgrade_authority: Pubkey,      // Multisig or external wallet
    pub upgrade_pending: bool,          // Flag for pending upgrades
    pub upgrade_target: Pubkey,         // Target program for upgrade
    pub upgrade_timelock: i64,          // Timelock for upgrade execution
    // ... other fields
}
```

### **New Instructions**
- `propose_upgrade` - Propose a program upgrade
- `execute_upgrade` - Execute upgrade after timelock
- `cancel_upgrade` - Cancel pending upgrade
- `migrate_tokens` - Migrate user tokens
- `migrate_liquidity` - Migrate liquidity

### **Events**
- `UpgradeProposed` - Upgrade proposal created
- `UpgradeExecuted` - Upgrade executed
- `UpgradeCancelled` - Upgrade cancelled
- `TokensMigrated` - User tokens migrated
- `LiquidityMigrated` - Liquidity migrated

## Environment Variables

### **Upgrade Controls**
```bash
UPGRADE_AUTHORITY=/path/to/upgrade-authority.json
TARGET_PROGRAM=NewProgram1111111111111111111111111111111111
TIMELOCK_DAYS=7
```

### **Migration Controls**
```bash
USER_WALLET=/path/to/user-wallet.json
AMOUNT_OLD=1000000000
LIQUIDITY_AMOUNT=10000000000
NEW_LIQUIDITY_ATA=NewLiquidityATA1111111111111111111111111111111111
```

## Best Practices

### **For Upgrade Authority**
1. Use multisig wallets for maximum security
2. Set appropriate timelock periods (7+ days)
3. Communicate upgrades to community
4. Test upgrades on devnet first

### **For Users**
1. Monitor upgrade proposals
2. Migrate tokens during upgrade window
3. Verify new program version
4. Keep tokens in compatible wallets

### **For Developers**
1. Maintain backward compatibility when possible
2. Document all changes
3. Provide migration tools
4. Test thoroughly before proposing upgrades

## Error Handling

### **Common Errors**
- `NotUpgradeAuthority` - Wrong upgrade authority
- `UpgradeAlreadyPending` - Upgrade already proposed
- `NoUpgradePending` - No upgrade to execute
- `UpgradeTimelockNotExpired` - Timelock not expired

### **Recovery**
- Cancel upgrade if issues discovered
- Extend timelock if needed
- Communicate with community

## Monitoring

### **Upgrade Status**
```bash
# Check upgrade status
npx ts-node ts/scripts/08_check_status.ts
```

### **Migration Stats**
```bash
# Check migration statistics
npx ts-node ts/scripts/09_migration_stats.ts
```

## Conclusion

The zCoin upgrade system provides a secure, transparent, and community-friendly way to upgrade the program while ensuring all tokens and liquidity can be migrated to new versions. The multisig governance and timelock mechanisms provide security, while the migration system ensures continuity for users and liquidity providers.
