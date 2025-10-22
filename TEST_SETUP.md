# Test Setup Instructions

## Prerequisites

1. **Install Solana CLI**
   ```bash
   sh -c "$(curl -sSfL https://release.solana.com/v1.18.0/install)"
   export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
   ```

2. **Install Anchor**
   ```bash
   npm install -g @coral-xyz/anchor-cli
   ```

3. **Install Dependencies**
   ```bash
   cd ts && yarn install
   ```

## Test Setup

### 1. Generate Test Keypairs
```bash
# Generate test keypairs
solana-keygen new --outfile test-deployer.json --no-bip39-passphrase
solana-keygen new --outfile test-governance.json --no-bip39-passphrase
solana-keygen new --outfile test-user.json --no-bip39-passphrase

# Set as default for testing
solana config set --keypair test-deployer.json
```

### 2. Start Local Test Validator
```bash
# Start validator in background
solana-test-validator --reset &

# Wait for validator to start
sleep 5

# Check cluster info
solana cluster-version
solana balance
```

### 3. Deploy Program
```bash
# Build and deploy
anchor build
anchor deploy

# Get program ID
anchor keys list
```

### 4. Configure Test Environment
```bash
# Copy test environment template
cp test.env.example test.env

# Edit test.env with your values:
# - Update keypair paths
# - Update program ID from anchor keys list
# - Update RPC endpoint if needed
```

## Running Tests

### Unit Tests (Rust/Anchor)
```bash
anchor test
```

### Integration Tests
```bash
yarn test:integration
```

### Mock Pump.fun Token Creation
```bash
yarn test:mock
```

### End-to-End Test Suite
```bash
yarn test:e2e
```

### Run All Tests
```bash
yarn test:all
```

### Automated Local Testing
```bash
yarn test:local
```

## Test Scenarios

### 1. Basic Migration Flow
- Create mock pump.fun token
- Initialize migration
- Redeem tokens
- Verify balances

### 2. Admin Controls
- Test pause/unpause
- Test window updates
- Test status checks

### 3. Error Handling
- Test invalid parameters
- Test unauthorized access
- Test edge cases

### 4. Security Tests
- Test authority validation
- Test account validation
- Test cap enforcement

## Test Data

### Mock Pump.fun Token
- **Supply**: 1,000,000,000 tokens
- **Decimals**: 6
- **Mint Authority**: Renounced (simulates graduation)
- **Freeze Authority**: None

### Migration Configuration
- **Total Supply**: 100,000,000 new tokens
- **Decimals**: 9
- **Migration Ratio**: 10:1 (10 old → 1 new)
- **Migration Window**: 180 days
- **Fixed Allocations**: 40% (20% treasury, 10% liquidity, 10% contributors)
- **Migration Pool**: 60%

## Troubleshooting

### Common Issues

1. **Validator Not Running**
   ```bash
   solana-test-validator --reset
   ```

2. **Program Not Deployed**
   ```bash
   anchor deploy
   ```

3. **Keypair Issues**
   ```bash
   solana config set --keypair test-deployer.json
   ```

4. **RPC Connection Issues**
   ```bash
   solana config set --url http://127.0.0.1:8899
   ```

### Debug Commands
```bash
# Check cluster status
solana cluster-version

# Check account balance
solana balance

# Check program accounts
solana program show <PROGRAM_ID>

# Check token accounts
spl-token accounts
```

## Test Coverage

- ✅ Program initialization
- ✅ Token redemption
- ✅ Admin controls
- ✅ Window validation
- ✅ Cap enforcement
- ✅ Error handling
- ✅ Decimal math precision
- ✅ Authority validation
- ✅ Account validation
- ✅ Event emission
