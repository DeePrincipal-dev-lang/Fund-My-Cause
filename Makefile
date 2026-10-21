.PHONY: contracts-size contracts\:coverage help test-contract deploy-testnet dev-frontend test-frontend lint install-deps clean format fmt-check build size test docs docs-open docs-check

# Default target - show help
help: ## Show this help
	@echo "Fund-My-Cause - Common Developer Commands"
	@echo ""
	@echo "Available targets:"
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z0-9_-]+:.*## / {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "Example workflow:"
	@echo "  make install-deps       # One-time setup"
	@echo "  make build"
	@echo "  make test"
	@echo "  make lint"
	@echo "  make dev-frontend"

# Build Rust contracts to WebAssembly
build: ## Build Rust contracts to WebAssembly
	@echo "Building Rust contracts..."
	cargo build --release --target wasm32-unknown-unknown

# Report WASM binary sizes
size: ## Build contracts and report WASM binary sizes
	@echo "Building contracts and checking sizes..."
	cargo build --release --target wasm32-unknown-unknown
	@echo ""
	@echo "=== WASM Binary Sizes ==="
	@ls -lh target/wasm32-unknown-unknown/release/*.wasm
	@echo ""
	@echo "=== Size Budget ($$(cat contracts/crowdfund/WASM_BUDGET_BYTES) bytes per contract, see contracts/crowdfund/README.md) ==="
	@python3 scripts/check_wasm_size.py --budget $$(cat contracts/crowdfund/WASM_BUDGET_BYTES) target/wasm32-unknown-unknown/release/*.wasm

# Same check as `size`, under the name the contracts docs use. Fails when any WASM exceeds the budget.
contracts-size: size ## Alias for `size`: fail if any contract WASM is over the budget

# Run all tests
test: test-contract test-frontend ## Run all tests (contracts + frontend)
	@echo "All tests complete"

# Run all Rust contract tests
test-contract: ## Run all Rust contract tests
	@echo "Testing Rust contracts..."
	cargo test --workspace

# Deploy contract to Stellar testnet
# Usage: make deploy-testnet CREATOR=<account> TOKEN=<token_id> GOAL=<amount> DEADLINE=<unix_timestamp>
deploy-testnet: ## Deploy contract to Stellar testnet
	@if [ -z "$(CREATOR)" ] || [ -z "$(TOKEN)" ] || [ -z "$(GOAL)" ] || [ -z "$(DEADLINE)" ]; then \
		echo "Error: Required parameters missing"; \
		echo "Usage: make deploy-testnet CREATOR=<account> TOKEN=<token_id> GOAL=<amount> DEADLINE=<unix_timestamp>"; \
		echo ""; \
		echo "Optional parameters:"; \
		echo "  MIN_CONTRIBUTION=<amount>   (default: 1)"; \
		echo "  TITLE=<string>              (default: 'Default Title')"; \
		echo "  DESCRIPTION=<string>        (default: 'Default Description')"; \
		echo "  SOCIAL_LINKS=<json>         (default: null)"; \
		echo "  REGISTRY_ID=<contract_id>   (deploys new registry if not provided)"; \
		exit 1; \
	fi
	@./scripts/deploy.sh \
		"$(CREATOR)" \
		"$(TOKEN)" \
		"$(GOAL)" \
		"$(DEADLINE)" \
		"$(MIN_CONTRIBUTION)" \
		"$(TITLE)" \
		"$(DESCRIPTION)" \
		"$(SOCIAL_LINKS)" \
		"$(REGISTRY_ID)"

# Start frontend development server
dev-frontend: ## Start frontend development server
	@echo "Starting frontend development server..."
	cd apps/interface && npm run dev

# Run frontend tests
test-frontend: ## Run frontend tests
	@echo "Running frontend tests..."
	cd apps/interface && npm test

# Run linters (Rust clippy + ESLint)
lint: ## Run linters (Rust clippy + ESLint)
	@echo "Running Rust clippy..."
	cargo clippy --workspace --all-targets
	@echo "Running ESLint on frontend..."
	cd apps/interface && npm run lint

# Install all dependencies
install-deps: ## Install all dependencies
	@echo "Installing Rust dependencies..."
	cargo fetch
	@echo "Installing frontend dependencies..."
	cd apps/interface && npm install

# Clean build artifacts
clean: ## Clean build artifacts
	@echo "Cleaning build artifacts..."
	cargo clean
	cd apps/interface && rm -rf .next out

# Format code (Rust + JavaScript)
format: ## Format code (Rust + JavaScript)
	@echo "Formatting Rust code..."
	cargo fmt --all
	cargo fmt --manifest-path contracts/benchmarks/Cargo.toml
	@echo "Formatting JavaScript/TypeScript code..."
	cd apps/interface && npm run format 2>/dev/null || npx prettier --write "src/**/*.{ts,tsx,js,jsx}" || true

# Verify Rust formatting without modifying files
fmt-check: ## Verify Rust formatting without modifying files
	@echo "Checking Rust workspace formatting..."
	cargo fmt --all -- --check
	@echo "Checking benchmarks formatting..."
	cargo fmt --manifest-path contracts/benchmarks/Cargo.toml -- --check
	@echo "Formatting check passed."

# ── Coverage ──────────────────────────────────────────────────────────────────

# Measure line coverage for the crowdfund contract and enforce a 90% floor.
#
# Requirements:
#   cargo install cargo-llvm-cov
#
# The target produces an LCOV report in coverage/ and exits non-zero when the
# measured line coverage for src/ falls below 90%.
contracts\:coverage: ## Measure crowdfund contract coverage and fail if below 90%
	@echo "Measuring coverage for contracts/crowdfund..."
	@mkdir -p coverage
	cargo llvm-cov \
		--package crowdfund \
		--features testutils \
		--lcov \
		--output-path coverage/crowdfund.lcov
	@echo ""
	@LINE_COV=$$(cargo llvm-cov \
		--package crowdfund \
		--features testutils \
		--summary-only \
		2>/dev/null \
		| grep "^TOTAL" | awk '{print $$NF}' | tr -d '%' | cut -d. -f1); \
	echo "Line coverage: $${LINE_COV}%"; \
	if [ "$${LINE_COV}" -lt 90 ]; then \
		echo "ERROR: coverage $${LINE_COV}% is below the 90% floor (issue #1531)."; \
		exit 1; \
	else \
		echo "Coverage OK ($${LINE_COV}% >= 90%)."; \
	fi

# ── Documentation ─────────────────────────────────────────────────────────────

# Build rustdoc for all contracts (excludes benchmarks and third-party deps)
docs: ## Build rustdoc for all contracts
	@echo "Building contract documentation..."
	cargo doc --workspace --exclude benchmarks --no-deps --document-private-items
	@echo "Docs written to target/doc/"
	@echo "Entry point: target/doc/crowdfund/index.html"

# Build docs and open in the default browser
docs-open: docs ## Build rustdoc and open in browser
	@echo "Opening docs in browser..."
	@if command -v xdg-open > /dev/null 2>&1; then \
		xdg-open target/doc/crowdfund/index.html; \
	elif command -v open > /dev/null 2>&1; then \
		open target/doc/crowdfund/index.html; \
	else \
		start target/doc/crowdfund/index.html 2>/dev/null || \
		echo "Open target/doc/crowdfund/index.html in your browser"; \
	fi

# Build docs with warnings-as-errors — mirrors the CI docs workflow
docs-check: ## Build rustdoc with warnings-as-errors (mirrors CI)
	@echo "Checking contract documentation (warnings as errors)..."
	RUSTDOCFLAGS="--default-theme=ayu --cfg docsrs -D warnings" \
		cargo doc --workspace --exclude benchmarks --no-deps --document-private-items
	@echo "Documentation check passed."
