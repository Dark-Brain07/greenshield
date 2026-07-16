# v0.1.0
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
import base64
import hashlib
from genlayer import *

# GreenShield ESG Protocol Constants
MINIMUM_STAKE = 10_000_000_000_000_000 # 0.01 GEN minimum to deter spam
SCORE_MULTIPLIER = 10 # Normalize 0-100 to 0-1000 basis points
MAX_URLS = 3

@allow_storage
class GreenShieldCore(gl.Contract):
    admin: Address
    epoch_counter: u256
    total_staked: u256
    bond_store: TreeMap[str, str] # Stores ESG JSON metadata
    bond_list: DynArray[str]
    domain_registry: TreeMap[str, DynArray[str]]

    def __init__(self):
        self.admin = gl.message.sender_address
        self.epoch_counter = u256(0)
        self.total_staked = u256(0)

    def _generate_id(self, author: str, claim: str) -> str:
        """Deterministically generate a bond ID."""
        raw = f"{author}:{claim}:{self.epoch_counter}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    @gl.public.write.payable
    def mint_green_bond(self, claim_raw: str, domain_tags: list, citation_urls: list, maturity_epochs: int) -> str:
        stake = int(str(gl.message.value))
        if stake < MINIMUM_STAKE:
            raise Exception("Insufficient stake for a green bond.")
            
        claim_clean = claim_raw.strip()
        bond_id = self._generate_id(str(gl.message.sender_address), claim_clean)
        
        # Initial AI analysis of the ESG claim (Equivalence Principle)
        audit_result = self._perform_esg_audit(claim_clean, list(citation_urls))
        
        score = int(audit_result["authenticity_score"]) * SCORE_MULTIPLIER
        status = "ACTIVE"
        
        bond_data = {
            "bond_id": bond_id,
            "claim_encoded": base64.b64encode(claim_clean.encode()).decode(),
            "author": str(gl.message.sender_address),
            "stake_wei": str(stake),
            "status": status,
            "current_score": score,
            "created_epoch": int(str(self.epoch_counter)),
            "maturity_epoch": int(str(self.epoch_counter)) + maturity_epochs,
            "domain_tags": list(domain_tags),
            "citation_urls": list(citation_urls)
        }
        
        self.bond_store[bond_id] = json.dumps(bond_data)
        self.bond_list.append(bond_id)
        
        for tag in domain_tags:
            if tag not in self.domain_registry:
                self.domain_registry[tag] = DynArray()
            self.domain_registry[tag].append(bond_id)
            
        self.total_staked = u256(int(str(self.total_staked)) + stake)
        return bond_id
        
    def _perform_esg_audit(self, claim: str, urls: list) -> dict:
        """Run non-deterministic evaluation on corporate ESG claims."""
        def leader():
            evidence_text = ""
            for url in urls[:MAX_URLS]:
                try:
                    resp = gl.nondet.web.get(url)
                    if resp.status_code == 200:
                        evidence_text += resp.body.decode("utf-8", "ignore")[:2000] + "\n"
                except:
                    pass
            
            prompt = f"""You are a strict Environmental, Social, and Governance (ESG) auditor.
Analyze the following corporate sustainability claim against the provided web evidence.
Identify any signs of corporate "greenwashing" (using vague terms like 'eco-friendly' or 'sustainable' without concrete metrics or proof).

Corporate Claim: {claim}
Evidence: {evidence_text}

Rate the authenticity and verifiability from 0 to 100.
Respond strictly in JSON format: {{"authenticity_score": <int>}}"""
            
            result = gl.nondet.exec_prompt(prompt, response_format="json")
            score = 0
            if isinstance(result, dict) and "authenticity_score" in result:
                try:
                    score = int(result["authenticity_score"])
                except:
                    pass
            return {"authenticity_score": max(0, min(100, score))}

        def validator(leader_res):
            my_res = leader()
            if not isinstance(leader_res, gl.vm.Return):
                return False
            l_score = int(leader_res.calldata.get("authenticity_score", 0))
            m_score = int(my_res.get("authenticity_score", 0))
            # 15 point tolerance for LLM subjectivity on ESG audits
            return abs(l_score - m_score) <= 15

        return gl.vm.run_nondet_unsafe(leader, validator)

    @gl.public.write
    def evolve_bond_epoch(self, bond_id: str) -> dict:
        """Continuously re-evaluate active bonds with fresh evidence."""
        if bond_id not in self.bond_store:
            raise Exception("Bond not found")
            
        data = json.loads(self.bond_store[bond_id])
        if data["status"] != "ACTIVE":
            raise Exception(f"Cannot evolve bond in {data['status']} state.")
            
        claim = base64.b64decode(data["claim_encoded"]).decode()
        
        # We perform a new audit every epoch
        audit = self._perform_esg_audit(claim, data.get("citation_urls", []))
        new_score = int(audit["authenticity_score"]) * SCORE_MULTIPLIER
        
        # Smooth the score drift over time
        old_score = data["current_score"]
        smoothed_score = (old_score + new_score) // 2
        data["current_score"] = smoothed_score
        
        # State transitions
        if smoothed_score < 250:
            data["status"] = "GREENWASHING"
        elif smoothed_score >= 850 and int(str(self.epoch_counter)) >= data["maturity_epoch"]:
            data["status"] = "VERIFIED"
            
        self.bond_store[bond_id] = json.dumps(data)
        return {"bond_id": bond_id, "new_score": smoothed_score, "status": data["status"]}

    @gl.public.write
    def slash_bond(self, bond_id: str) -> dict:
        if bond_id not in self.bond_store:
            raise Exception("Bond not found")
        data = json.loads(self.bond_store[bond_id])
        if data["status"] != "GREENWASHING":
            raise Exception("Only greenwashing claims can be slashed.")
            
        stake = int(data["stake_wei"])
        data["stake_wei"] = "0"
        data["status"] = "SLASHED"
        
        if stake > 0:
            gl.get_contract_at(self.admin).emit_transfer(value=u256(stake))
            self.total_staked = u256(int(str(self.total_staked)) - stake)
            
        self.bond_store[bond_id] = json.dumps(data)
        return {"slashed": True}

    @gl.public.write
    def release_bond(self, bond_id: str) -> dict:
        if bond_id not in self.bond_store:
            raise Exception("Bond not found")
        data = json.loads(self.bond_store[bond_id])
        if data["status"] != "VERIFIED":
            raise Exception("Only verified claims can be released.")
            
        stake = int(data["stake_wei"])
        data["stake_wei"] = "0"
        data["status"] = "RELEASED"
        
        if stake > 0:
            gl.get_contract_at(Address(data["author"])).emit_transfer(value=u256(stake))
            self.total_staked = u256(int(str(self.total_staked)) - stake)
            
        self.bond_store[bond_id] = json.dumps(data)
        return {"released": True}
        
    @gl.public.write
    def advance_epoch(self) -> int:
        """Administrative method to advance global time."""
        if gl.message.sender_address != self.admin:
            raise Exception("Only admin can advance epoch.")
        self.epoch_counter = u256(int(str(self.epoch_counter)) + 1)
        return int(str(self.epoch_counter))

    @gl.public.view
    def get_bond(self, bond_id: str) -> dict:
        if bond_id not in self.bond_store:
            raise Exception("Not found")
        return json.loads(self.bond_store[bond_id])

    @gl.public.view
    def list_bonds(self) -> list:
        return [b for b in self.bond_list]

    @gl.public.view
    def get_network_state(self) -> dict:
        total = 0
        count = 0
        for bid in self.bond_list:
            data = json.loads(self.bond_store[bid])
            if data["status"] == "ACTIVE":
                total += int(data["current_score"])
                count += 1
                
        return {
            "current_epoch": int(str(self.epoch_counter)),
            "total_bonds": len(self.bond_list),
            "total_staked_wei": str(int(str(self.total_staked))),
            "network_score_mean": (total // count) if count > 0 else 0
        }
