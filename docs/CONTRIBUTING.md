# Contributing to Fund-My-Cause

Thank you for your interest in contributing to Fund-My-Cause! This guide will help you get started with development, testing, and submitting pull requests.

## Table of Contents

- [Setup Process](#setup-process)
- [Development Workflow](#development-workflow)
- [Testing Procedures](#testing-procedures)
- [PR Guidelines](#pr-guidelines)
- [Code Style Guide](#code-style-guide)

---

## Setup Process

Follow the single setup guide, **[docs/SETUP.md](./SETUP.md)**. It covers prerequisites, npm workspaces, the pinned Rust toolchain, Docker Compose, environment files, contract builds, and testnet seeding. Do not duplicate setup commands here.

## Development Workflow

### 1. Create a Feature Branch

Always create a new branch for your work:

```bash
git checkout -b feat/your-feature-name
# or for bug fixes:
git checkout -b fix/issue-description
# or for documentation:
git checkout -b docs/topic-name
```

Branch naming convention:
- `feat/` — new features
- `fix/` — bug fixes
- `docs/` — documentation
- `refactor/` — code refactoring
- `test/` — test improvements
- `chore/` — maintenance tasks

### 2. Make Your Changes

#### For Smart Contracts

Edit files in `contracts/crowdfund/src/` or `contracts/registry/src/`:

```bash
# Build and test locally
cargo build --release --target wasm32-unknown-unknown
cargo test --workspace

# Run clippy for linting
cargo clippy --all-targets --target wasm32-unknown-unknown -- -D warnings
```

#### For Frontend

Edit files in `apps/interface/src/`:

```bash
cd apps/interface

# Start dev server
npm run dev

# Run linter
npm run lint

# Run type checker
npm run type-check

# Run tests
npm run test
```

### 3. Commit Your Changes

Use conventional commits:

```bash
git add <files>
git commit -m "feat: add new campaign feature"
git commit -m "fix: resolve refund calculation bug"
git commit -m "docs: update API documentation"
git commit -m "test: add integration tests for withdraw"
```

Commit message format:
```
<type>(<scope>): <subject>

<body>

<footer>
```

- **type**: feat, fix, docs, test, refactor, chore
- **scope**: contract, frontend, ci, docs (optional)
- **subject**: imperative, lowercase, no period, max 50 chars
- **body**: explain what and why, not how (optional)
- **footer**: reference issues: `Closes #123` (optional)

Example:
```
feat(contract): add recurring contribution support

Implement setup_recurring and execute_recurring functions
to allow contributors to set up automatic periodic contributions.

Closes #456
```

### 4. Push and Create a Pull Request

```bash
git push -u origin feat/your-feature-name
```

Then open a PR on GitHub. See [PR Guidelines](#pr-guidelines) for details.

---

## Testing Procedures

### Smart Contract Tests

#### Unit Tests

```bash
# Run all tests
cargo test --workspace

# Run tests for a specific crate
cargo test -p crowdfund

# Run a specific test
cargo test test_initialize -- --nocapture

# Run with output
cargo test -- --nocapture --test-threads=1
```

#### Test Structure

Tests are located in `contracts/crowdfund/src/lib.rs` and use Soroban's test utilities:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_initialize() {
        let env = Env::default();
        env.mock_all_auths();

        let creator = Address::generate(&env);
        let token = Address::generate(&env);

        // Test initialization
        let contract = CrowdfundContract;
        contract.initialize(
            env.clone(), creator, token,
            1_000_000_000, env.ledger().timestamp() + 86400,
            10_000_000, 0,
            String::from_str(&env, "Test"),
            String::from_str(&env, "Test campaign"),
            None, None, None, Category::Charity, None, None,
        ).unwrap();

        // Verify state
        assert_eq!(contract.goal(env), 1_000_000_000);
    }
}
```

#### Coverage Requirements

- Minimum **80% coverage** across all metrics (statements, branches, functions, lines)
- Run coverage locally:
  ```bash
  cd apps/interface
  npm run test:coverage
  ```

### Frontend Tests

#### Unit & Integration Tests

```bash
cd apps/interface

# Run all tests
npm run test

# Run tests in watch mode
npm run test -- --watch

# Run specific test file
npm run test -- WalletContext.test.ts

# Run with coverage
npm run test:coverage
```

#### E2E Tests (Playwright)

```bash
cd apps/interface

# Run E2E tests
npm run test:e2e

# Run in headed mode (see browser)
npm run test:e2e -- --headed

# Run specific test
npm run test:e2e -- contribute.spec.ts
```

#### Test Structure

Tests use Jest and React Testing Library:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { PledgeModal } from '@/components/PledgeModal';

describe('PledgeModal', () => {
  it('should submit a contribution', async () => {
    render(<PledgeModal />);
    
    const input = screen.getByPlaceholderText('Amount');
    fireEvent.change(input, { target: { value: '100' } });
    
    const button = screen.getByRole('button', { name: /contribute/i });
    fireEvent.click(button);
    
    expect(screen.getByText(/success/i)).toBeInTheDocument();
  });
});
```

### Manual Testing

#### Testnet Deployment

```bash
# Set environment variables
export CREATOR_ADDRESS="GXXXXXX..."
export TOKEN_ADDRESS="GXXXXXX..."
export DEADLINE=$(date -d "+30 days" +%s)

# Deploy to testnet
./scripts/deploy.sh $CREATOR_ADDRESS $TOKEN_ADDRESS 1000 $DEADLINE 10 \
  "Test Campaign" "Testing Fund-My-Cause" null

# Save the printed Contract ID and Registry ID
```

#### Frontend Testing

1. Install Freighter wallet extension
2. Switch to testnet in Freighter
3. Run frontend: `npm run dev`
4. Test wallet connection and contribution flow

---

## PR Guidelines

### Before Submitting

1. **Ensure tests pass**
   ```bash
   cargo test --workspace
   cd apps/interface && npm run test && npm run test:coverage
   ```

2. **Run linters**
   ```bash
   cargo clippy --all-targets --target wasm32-unknown-unknown -- -D warnings
   cd apps/interface && npm run lint
   ```

3. **Update documentation** if needed
   - Update README.md for user-facing changes
   - Update docs/ for architecture/API changes
   - Add rustdoc comments for new functions

4. **Rebase on main**
   ```bash
   git fetch origin
   git rebase origin/main
   ```

### PR Title

Keep titles concise (under 70 characters):

```
feat: add recurring contribution support
fix: resolve refund calculation overflow
docs: update deployment guide
test: add integration tests for withdraw
```

### PR Description

Use this template:

```markdown
## Description
Brief summary of changes.

## Type of Change
- [ ] New feature
- [ ] Bug fix
- [ ] Documentation update
- [ ] Breaking change

## Related Issues
Closes #123

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] No new warnings from linters
- [ ] Commit messages follow conventions
```

### Review Process

1. **Automated checks** — CI/CD pipeline runs:
   - Rust build and tests
   - Frontend linting and tests
   - Code coverage validation

2. **Code review** — At least one maintainer reviews:
   - Code quality and correctness
   - Test coverage
   - Documentation completeness
   - Security considerations

3. **Approval and merge** — After approval:
   - Squash and merge (for single logical change)
   - Or rebase and merge (for multiple commits)

---

## Code Style Guide

### Rust

#### Formatting

Use `rustfmt` (automatic):

```bash
cargo fmt --all
```

#### Naming Conventions

- **Functions**: `snake_case`
  ```rust
  pub fn initialize_campaign() {}
  pub fn calculate_fee() {}
  ```

- **Types/Structs**: `PascalCase`
  ```rust
  pub struct CampaignInfo {}
  pub enum Status {}
  ```

- **Constants**: `SCREAMING_SNAKE_CASE`
  ```rust
  const MAX_TITLE_LENGTH: usize = 64;
  const MIN_CONTRIBUTION: i128 = 1_000_000;
  ```

- **Private items**: prefix with `_` if unused
  ```rust
  fn _helper_function() {}
  ```

#### Documentation

Add rustdoc comments to all public items:

```rust
/// Initializes a new crowdfunding campaign.
///
/// # Arguments
/// * `creator` - The campaign creator's address
/// * `goal` - Funding goal in stroops
/// * `deadline` - Unix timestamp deadline
///
/// # Errors
/// Returns `ContractError::AlreadyInitialized` if called twice.
///
/// # Example
/// ```ignore
/// contract.initialize(env, creator, token, 1_000_000_000, deadline, ...)?;
/// ```
pub fn initialize(
    env: Env,
    creator: Address,
    token: Address,
    goal: i128,
    deadline: u64,
    // ...
) -> Result<(), ContractError> {
    // implementation
}
```

#### Error Handling

Use `Result<T, ContractError>` for fallible operations:

```rust
pub fn contribute(env: Env, amount: i128) -> Result<(), ContractError> {
    if amount < self.min_contribution {
        return Err(ContractError::BelowMinimum);
    }
    // ...
    Ok(())
}
```

#### Testing

- Test names describe what is being tested
- Use `#[test]` attribute
- Mock external dependencies

```rust
#[test]
fn test_contribute_below_minimum_fails() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract = CrowdfundContract;
    let result = contract.contribute(env, 1_000); // below minimum
    
    assert!(result.is_err());
}
```

### TypeScript/React

#### Formatting

Use Prettier (automatic):

```bash
cd apps/interface
npm run format
```

#### Naming Conventions

- **Components**: `PascalCase`
  ```typescript
  export function PledgeModal() {}
  export const ProgressBar = () => {};
  ```

- **Functions/variables**: `camelCase`
  ```typescript
  const calculateProgress = () => {};
  const totalRaised = 1_000_000;
  ```

- **Constants**: `SCREAMING_SNAKE_CASE`
  ```typescript
  const MAX_TITLE_LENGTH = 64;
  const API_TIMEOUT_MS = 5000;
  ```

- **Types/Interfaces**: `PascalCase`
  ```typescript
  interface CampaignInfo {}
  type Status = 'active' | 'successful' | 'refunded';
  ```

#### Documentation

Add JSDoc comments to functions:

```typescript
/**
 * Calculates the funding progress as a percentage.
 * @param raised - Amount raised in stroops
 * @param goal - Funding goal in stroops
 * @returns Progress as a percentage (0-100)
 */
export function calculateProgress(raised: i128, goal: i128): number {
  return (raised / goal) * 100;
}
```

#### Component Structure

```typescript
import { FC, useState } from 'react';

interface PledgeModalProps {
  campaignId: string;
  onSuccess?: () => void;
}

/**
 * Modal for submitting a contribution pledge.
 */
export const PledgeModal: FC<PledgeModalProps> = ({ campaignId, onSuccess }) => {
  const [amount, setAmount] = useState('');

  const handleSubmit = async () => {
    // implementation
  };

  return (
    <div>
      {/* JSX */}
    </div>
  );
};
```

#### Error Handling

Use try-catch for async operations:

```typescript
try {
  const result = await contract.contribute(amount);
  onSuccess?.();
} catch (error) {
  if (error instanceof ContractError) {
    setError(error.message);
  } else {
    setError('Unknown error occurred');
  }
}
```

#### Testing

- Test names describe behavior
- Use React Testing Library for component tests
- Mock external dependencies

```typescript
describe('PledgeModal', () => {
  it('should display error when amount is below minimum', () => {
    render(<PledgeModal campaignId="123" />);
    
    const input = screen.getByPlaceholderText('Amount');
    fireEvent.change(input, { target: { value: '1' } });
    
    expect(screen.getByText(/below minimum/i)).toBeInTheDocument();
  });
});
```

### General Guidelines

1. **Keep functions small** — Single responsibility principle
2. **Use meaningful names** — Code should be self-documenting
3. **Add comments for "why"** — Not "what" (code shows that)
4. **DRY principle** — Don't repeat yourself
5. **Error handling** — Always handle errors explicitly
6. **Security** — Validate inputs, use safe operations
7. **Performance** — Consider gas costs (contracts) and render performance (frontend)

---

## Getting Help

- **Questions?** Open a [Discussion](https://github.com/Fund-My-Cause/Fund-My-Cause/discussions)
- **Found a bug?** Open an [Issue](https://github.com/Fund-My-Cause/Fund-My-Cause/issues)
- **Need help?** Check [existing issues](https://github.com/Fund-My-Cause/Fund-My-Cause/issues) first

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing to Fund-My-Cause! 🚀
