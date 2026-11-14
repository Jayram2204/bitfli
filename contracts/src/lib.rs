use near_sdk::store::IterableSet;
use near_sdk::{env, near, AccountId, PanicOnDefault};
use serde::Serialize;

/// NEP-297 Structured Event Log Wrapper (`EVENT_JSON:{...}`)
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct Nep297Event<'a, T: Serialize> {
    standard: &'a str,
    version: &'a str,
    event: &'a str,
    data: Vec<T>,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ProcurementVerifiedEventData {
    pub pod_account_id: String,
    pub vendor: String,
    pub amount_usd_cents: u64,
    pub daily_spent_usd_cents: u64,
    pub verdict: String,
    pub tee_receipt: String,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ProfitSplitExecutedEventData {
    pub pod_account_id: String,
    pub total_amount_usd_cents: u64,
    pub lead_dev_wallet: AccountId,
    pub lead_dev_usd_cents: u64,
    pub design_partner_wallet: String,
    pub design_partner_usd_cents: u64,
    pub tax_reserve_usd_cents: u64,
    pub tee_receipt: String,
}

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct ProfitSplitRatio {
    pub lead_dev_pct: u8,
    pub design_partner_pct: u8,
    pub tax_reserve_pct: u8,
}

/// On-chain policy guardrails and profit-split verifier for a `bitfli.xyz` autonomous agency pod.
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct BitfliPodVaultContract {
    pub owner_id: AccountId,
    pub enclave_signer_id: AccountId,
    pub max_tx_usd_cents: u64,
    pub daily_cap_usd_cents: u64,
    pub daily_spent_usd_cents: u64,
    pub profit_lock_pct: u8,
    pub frozen: bool,
    pub approved_vendors: IterableSet<String>,
    pub split_ratio: ProfitSplitRatio,
    pub lead_dev_wallet: AccountId,
    pub design_partner_wallet: String,
    pub tax_reserve_wallet: AccountId,
}

fn emit_nep297<T: Serialize>(event: &str, item: T) {
    let payload = Nep297Event {
        standard: "bitfli-pod-vault",
        version: "1.0.0",
        event,
        data: vec![item],
    };
    if let Ok(serialized) = serde_json::to_string(&payload) {
        env::log_str(&format!("EVENT_JSON:{}", serialized));
    }
}

#[near]
impl BitfliPodVaultContract {
    #[init]
    pub fn new(
        owner_id: AccountId,
        enclave_signer_id: AccountId,
        max_tx_usd_cents: u64,
        daily_cap_usd_cents: u64,
        lead_dev_wallet: AccountId,
        design_partner_wallet: String,
        tax_reserve_wallet: AccountId,
    ) -> Self {
        let mut vendors = IterableSet::new(b"v");
        vendors.insert("Anthropic API".to_string());
        vendors.insert("AWS Cloud".to_string());
        vendors.insert("Figma Team".to_string());
        vendors.insert("Vercel Pro".to_string());

        Self {
            owner_id,
            enclave_signer_id,
            max_tx_usd_cents,
            daily_cap_usd_cents,
            daily_spent_usd_cents: 0,
            profit_lock_pct: 70,
            frozen: false,
            approved_vendors: vendors,
            split_ratio: ProfitSplitRatio {
                lead_dev_pct: 55,
                design_partner_pct: 30,
                tax_reserve_pct: 15,
            },
            lead_dev_wallet,
            design_partner_wallet,
            tax_reserve_wallet,
        }
    }

    #[init]
    pub fn init(
        owner_id: AccountId,
        enclave_signer_id: AccountId,
        max_tx_usd_cents: u64,
        daily_cap_usd_cents: u64,
        lead_dev_wallet: AccountId,
        design_partner_wallet: String,
        tax_reserve_wallet: AccountId,
    ) -> Self {
        Self::new(
            owner_id,
            enclave_signer_id,
            max_tx_usd_cents,
            daily_cap_usd_cents,
            lead_dev_wallet,
            design_partner_wallet,
            tax_reserve_wallet,
        )
    }

    /// Updates the human-controlled spending guardrails and emergency kill switch.
    pub fn record_policy(
        &mut self,
        max_tx_usd_cents: u64,
        daily_cap_usd_cents: u64,
        frozen: bool,
        lead_dev_pct: u8,
        design_partner_pct: u8,
        tax_reserve_pct: u8,
    ) {
        self.update_policy(
            max_tx_usd_cents,
            daily_cap_usd_cents,
            frozen,
            lead_dev_pct,
            design_partner_pct,
            tax_reserve_pct,
        );
    }

    pub fn verify_procurement(
        &mut self,
        vendor: String,
        amount_usd_cents: u64,
        available_opex_usd_cents: u64,
        tee_receipt: String,
    ) -> bool {
        self.verify_and_record_procurement(
            vendor,
            amount_usd_cents,
            available_opex_usd_cents,
            tee_receipt,
        )
    }

    /// Updates the human-controlled spending guardrails and emergency kill switch.
    pub fn update_policy(
        &mut self,
        max_tx_usd_cents: u64,
        daily_cap_usd_cents: u64,
        frozen: bool,
        lead_dev_pct: u8,
        design_partner_pct: u8,
        tax_reserve_pct: u8,
    ) {
        self.assert_owner();
        assert_eq!(
            lead_dev_pct as u16 + design_partner_pct as u16 + tax_reserve_pct as u16,
            100,
            "RULE_INVALID_SPLIT_SUM: Profit split percentages must sum to 100"
        );
        self.max_tx_usd_cents = max_tx_usd_cents;
        self.daily_cap_usd_cents = daily_cap_usd_cents;
        self.frozen = frozen;
        self.split_ratio = ProfitSplitRatio {
            lead_dev_pct,
            design_partner_pct,
            tax_reserve_pct,
        };
    }

    pub fn set_frozen(&mut self, frozen: bool) {
        self.assert_owner();
        self.frozen = frozen;
    }

    pub fn add_approved_vendor(&mut self, vendor: String) {
        self.assert_owner();
        self.approved_vendors.insert(vendor);
    }

    pub fn remove_approved_vendor(&mut self, vendor: String) {
        self.assert_owner();
        self.approved_vendors.remove(&vendor);
    }

    /// Verifies and records an OutLayer TEE-attested agent procurement spend on-chain.
    /// Emits NEP-297 `EVENT_JSON` with `event: "procurement_verified"`.
    pub fn verify_and_record_procurement(
        &mut self,
        vendor: String,
        amount_usd_cents: u64,
        available_opex_usd_cents: u64,
        tee_receipt: String,
    ) -> bool {
        self.assert_owner_or_enclave();

        assert!(
            !self.frozen,
            "RULE_EMERGENCY_FREEZE_ACTIVE: Pod operations are frozen by human lock"
        );
        assert!(
            amount_usd_cents <= self.max_tx_usd_cents,
            "RULE_MAX_SINGLE_TX_EXCEEDED: Spend exceeds per-transaction cap"
        );
        assert!(
            self.daily_spent_usd_cents + amount_usd_cents <= self.daily_cap_usd_cents,
            "RULE_DAILY_SPEND_CAP_EXCEEDED: Spend exceeds daily cap"
        );
        assert!(
            amount_usd_cents <= available_opex_usd_cents,
            "RULE_AVAILABLE_OPEX_EXCEEDED: Spend exceeds unlocked OpEx margin buffer"
        );
        assert!(
            self.approved_vendors.contains(&vendor),
            "RULE_VENDOR_NOT_ALLOWLISTED: Target vendor is not in approved_vendors"
        );

        self.daily_spent_usd_cents += amount_usd_cents;

        emit_nep297(
            "procurement_verified",
            ProcurementVerifiedEventData {
                pod_account_id: env::current_account_id().to_string(),
                vendor,
                amount_usd_cents,
                daily_spent_usd_cents: self.daily_spent_usd_cents,
                verdict: "ALLOW".to_string(),
                tee_receipt,
            },
        );

        true
    }

    /// Executes the partner profit-split waterfall and emits NEP-297 `profit_split_executed`.
    pub fn execute_profit_split(
        &mut self,
        total_amount_usd_cents: u64,
        tee_receipt: String,
    ) -> (u64, u64, u64) {
        self.assert_owner_or_enclave();
        assert!(
            !self.frozen,
            "RULE_EMERGENCY_FREEZE_ACTIVE: Profit split paused while human lock is active"
        );
        assert!(
            total_amount_usd_cents > 0,
            "RULE_ZERO_DISTRIBUTION: Distribution amount must be greater than zero"
        );

        let lead_dev_usd_cents =
            (total_amount_usd_cents * self.split_ratio.lead_dev_pct as u64) / 100;
        let design_partner_usd_cents =
            (total_amount_usd_cents * self.split_ratio.design_partner_pct as u64) / 100;
        let tax_reserve_usd_cents =
            total_amount_usd_cents - lead_dev_usd_cents - design_partner_usd_cents;

        emit_nep297(
            "profit_split_executed",
            ProfitSplitExecutedEventData {
                pod_account_id: env::current_account_id().to_string(),
                total_amount_usd_cents,
                lead_dev_wallet: self.lead_dev_wallet.clone(),
                lead_dev_usd_cents,
                design_partner_wallet: self.design_partner_wallet.clone(),
                design_partner_usd_cents,
                tax_reserve_usd_cents,
                tee_receipt,
            },
        );

        (
            lead_dev_usd_cents,
            design_partner_usd_cents,
            tax_reserve_usd_cents,
        )
    }

    pub fn get_policy_summary(&self) -> (u64, u64, u64, bool, ProfitSplitRatio) {
        (
            self.max_tx_usd_cents,
            self.daily_cap_usd_cents,
            self.daily_spent_usd_cents,
            self.frozen,
            self.split_ratio.clone(),
        )
    }

    fn assert_owner(&self) {
        assert_eq!(
            env::predecessor_account_id(),
            self.owner_id,
            "Only the pod owner can update policy guardrails"
        );
    }

    fn assert_owner_or_enclave(&self) {
        let caller = env::predecessor_account_id();
        assert!(
            caller == self.owner_id || caller == self.enclave_signer_id,
            "Caller must be pod owner or attested OutLayer TEE enclave signer"
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn setup_contract() -> BitfliPodVaultContract {
        let owner: AccountId = "maya-dev.near".parse().unwrap();
        let enclave: AccountId = "enclave.outlayer.near".parse().unwrap();
        let reserve: AccountId = "ops-vault.bitfli.near".parse().unwrap();

        let context = VMContextBuilder::new()
            .predecessor_account_id(owner.clone())
            .build();
        testing_env!(context);

        BitfliPodVaultContract::new(
            owner,
            enclave,
            15_000, // $150.00
            50_000, // $500.00
            "maya-dev.near".parse().unwrap(),
            "sora-design.sol".to_string(),
            reserve,
        )
    }

    #[test]
    fn test_valid_procurement_passes() {
        let mut contract = setup_contract();
        let ok = contract.verify_and_record_procurement(
            "Anthropic API".to_string(),
            6_500, // $65.00
            555_000,
            "audit_sha256_71d04c9a90fa".to_string(),
        );
        assert!(ok);
        assert_eq!(contract.daily_spent_usd_cents, 6_500);
    }

    #[test]
    #[should_panic(expected = "RULE_MAX_SINGLE_TX_EXCEEDED")]
    fn test_rogue_spend_exceeds_single_cap() {
        let mut contract = setup_contract();
        contract.verify_and_record_procurement(
            "Anthropic API".to_string(),
            85_000, // $850.00 > $150.00
            555_000,
            "tee_deny_850".to_string(),
        );
    }

    #[test]
    fn test_profit_split_math() {
        let mut contract = setup_contract();
        let (lead, design, tax) =
            contract.execute_profit_split(400_000, "1click_split_2a19f73e".to_string());
        assert_eq!(lead, 220_000);   // 55% of $4,000.00 = $2,200.00
        assert_eq!(design, 120_000); // 30% of $4,000.00 = $1,200.00
        assert_eq!(tax, 60_000);     // 15% of $4,000.00 = $600.00
    }
}
