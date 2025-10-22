# zCoin Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the zCoin program to both testnet and mainnet. The deployment system includes safety checks, validation, and comprehensive reporting.

## Prerequisites

### **Required Software**
- Node.js 18+ and npm/yarn
- Solana CLI 1.18+
- Anchor CLI 0.29+
- Git

### **Required Accounts**
- Solana wallet with sufficient SOL
- Keypairs for all required roles
- RPC endpoint access

### **Environment Setup**
1. Clone the repository
2. Install dependencies: `cd ts && npm install`
3. Copy environment files: `cp testnet.env.example .env.testnet`
4. Fill in your configuration values

## Testnet Deployment

### **Step 1: Prepare Environment**
```bash
# Copy testnet configuration
cp testnet.env.example .env.testnet

# Edit configuration
nano .env.testnet
```

### **Step 2: Validate Configuration**
```bash
# Check environment variables
npm run validate
```

### **Step 3: Deploy to Testnet**
```bash
# Deploy with safety checks
npm run deploy:testnet:safe
```

### **Step 4: Verify Deployment**
```bash
# Run validation script
npm run validate
```

### **Expected Output**
- Program deployed successfully
- Config account created
- Mints created and configured
- PDAs generated
- Deployment report generated

## Mainnet Deployment

### **⚠️ CRITICAL WARNING**
Mainnet deployment is **IRREVERSIBLE**. Ensure you have:
- Tested thoroughly on testnet
- Used hardware wallets for all keypairs
- Set up multisig for upgrade authority
- Verified all configurations

### **Step 1: Prepare Environment**
```bash
# Copy mainnet configuration
cp mainnet.env.example .env.mainnet

# Edit configuration
nano .env.mainnet
```

### **Step 2: Safety Checks**
```bash
# Validate configuration
npm run validate

# Check mainnet requirements
# - Hardware wallets configured
# - Multisig setup complete
# - Sufficient SOL balance (5+ SOL)
# - Old mint exists on mainnet
```

### **Step 3: Deploy to Mainnet**
```bash
# Deploy with safety checks
npm run deploy:mainnet:safe
```

### **Step 4: Verify Deployment**
```bash
# Run validation script
npm run validate
```

### **Expected Output**
- Program deployed successfully
- Config account created
- New mint created
- PDAs generated
- Deployment report generated

## Deployment Scripts

### **Available Scripts**
- `deploy:testnet` - Deploy to testnet
- `deploy:mainnet` - Deploy to mainnet
- `validate` - Validate deployment
- `deploy:testnet:safe` - Deploy with safety warnings
- `deploy:mainnet:safe` - Deploy with safety warnings

### **Script Features**
- Environment validation
- Keypair verification
- Connection testing
- Safety checks
- Progress monitoring
- Error handling
- Deployment reports

## Configuration Files

### **testnet.env.example**
- Testnet RPC endpoint
- Testnet-specific settings
- Lower SOL requirements
- Test keypairs

### **mainnet.env.example**
- Mainnet RPC endpoint
- Mainnet-specific settings
- Higher SOL requirements
- Production keypairs

## Safety Features

### **Pre-Deployment Checks**
- Environment variable validation
- Keypair verification
- Connection testing
- Balance verification
- Program existence checks

### **During Deployment**
- Progress monitoring
- Error handling
- Transaction verification
- Account validation

### **Post-Deployment**
- Comprehensive validation
- Report generation
- Status verification
- Error reporting

## Validation System

### **Program Validation**
- Program deployment verification
- Account existence checks
- Authority verification
- Configuration validation

### **Mint Validation**
- Mint creation verification
- Authority checks
- Supply validation
- Decimal verification

### **PDA Validation**
- PDA generation verification
- Account existence checks
- Authority validation
- Configuration verification

### **Token Account Validation**
- ATA creation verification
- Owner validation
- Mint association checks
- Balance verification

## Deployment Reports

### **Report Contents**
- Deployment timestamp
- Network information
- Program ID
- Mint addresses
- PDA addresses
- Configuration details
- Environment information

### **Report Usage**
- Audit trail
- Troubleshooting
- Documentation
- Verification

## Troubleshooting

### **Common Issues**
- Insufficient SOL balance
- Invalid keypairs
- RPC connection issues
- Program build failures
- Account creation failures

### **Solutions**
- Check SOL balance
- Verify keypair paths
- Test RPC connection
- Rebuild program
- Check account creation

### **Error Codes**
- `InsufficientBalance` - Not enough SOL
- `InvalidKeypair` - Keypair file issue
- `ConnectionFailed` - RPC connection issue
- `BuildFailed` - Program build issue
- `DeploymentFailed` - Deployment issue

## Security Considerations

### **Keypair Security**
- Use hardware wallets
- Never commit private keys
- Use separate keypairs
- Backup securely

### **Multisig Setup**
- Use multisig for upgrade authority
- Minimum 3 signers for mainnet
- Hardware wallet signers
- Test multisig functionality

### **Environment Security**
- Secure environment files
- Use production RPC endpoints
- Validate all configurations
- Monitor deployments

## Monitoring and Maintenance

### **Post-Deployment Monitoring**
- Program account monitoring
- Config account monitoring
- Mint authority monitoring
- Token supply monitoring

### **Regular Maintenance**
- Update dependencies
- Monitor security updates
- Review configurations
- Test functionality

## Emergency Procedures

### **If Deployment Fails**
1. Stop deployment immediately
2. Check error logs
3. Verify environment setup
4. Fix issues and retry
5. Never retry without understanding

### **If Program Deployed Incorrectly**
1. **DO NOT** attempt to fix on mainnet
2. Deploy new program with correct configuration
3. Migrate users to new program
4. Document the issue

### **If Upgrade Authority Compromised**
1. Immediately pause migration
2. Deploy new program version
3. Migrate all tokens and liquidity
4. Update community

## Best Practices

### **Before Deployment**
- Test thoroughly on testnet
- Use hardware wallets
- Set up multisig
- Validate all configurations
- Have recovery procedures ready

### **During Deployment**
- Monitor progress closely
- Verify each step
- Check for errors
- Maintain documentation

### **After Deployment**
- Run validation scripts
- Test all functionality
- Generate reports
- Notify community
- Monitor system

## Support and Resources

### **Documentation**
- [Deployment Safety Guidelines](./DEPLOYMENT_SAFETY.md)
- [Upgrade System Guide](./UPGRADE_SYSTEM.md)
- [Main README](./README.md)

### **Community**
- GitHub Issues
- Discord Community
- Telegram Group
- Documentation Site

### **Technical Support**
- Development Team
- Security Team
- Community Moderators
- Technical Documentation

---

**Remember: Security is paramount. When in doubt, ask for help. Never rush a mainnet deployment.**
