import re
import logging
from typing import List
from app.models import FunctionalSpecItem, KPI

logger = logging.getLogger("app.services.spec_validator")
logger.setLevel(logging.INFO)

def clean_number(s: str) -> float:
    """Removes commas, percentage signs, currency symbols, and converts to float."""
    cleaned = re.sub(r"[^\d\.-]", "", s)
    return float(cleaned) if cleaned else 0.0

def validate_spec_item(item: FunctionalSpecItem, kpi: KPI) -> List[str]:
    warnings = []

    # 1. Verify worked examples match the KPI formula (Bypassed per request)
    pass

    # 2. Verify numerator and denominator definitions align with the formula
    formula_text = item.formula or kpi.formula or ""
    num_def = item.numerator or kpi.numerator or ""
    den_def = item.denominator or kpi.denominator or ""
    
    is_fraction = "/" in formula_text or "divided" in formula_text.lower() or "ratio" in formula_text.lower() or "percentage" in formula_text.lower()
    
    if is_fraction:
        if not num_def:
            warnings.append("KPI formula implies a fraction/percentage, but Numerator definition is empty.")
        if not den_def:
            warnings.append("KPI formula implies a fraction/percentage, but Denominator definition is empty.")
            
        # Check keyword overlaps to see if they align
        # Extract alphanumeric words of length >= 4
        formula_words = set(re.findall(r"\b[a-zA-Z]{4,}\b", formula_text.lower()))
        num_words = set(re.findall(r"\b[a-zA-Z]{4,}\b", num_def.lower()))
        den_words = set(re.findall(r"\b[a-zA-Z]{4,}\b", den_def.lower()))
        
        # If formula mentions specific terms, check if those terms appear in numerator or denominator definitions
        unmatched_formula_terms = []
        for term in formula_words:
            # Skip common formula words like 'total', 'average', 'divided', 'ratio'
            if term in ("total", "average", "divided", "ratio", "percentage", "formula", "multiplied", "times", "value"):
                continue
            if term not in num_words and term not in den_words:
                unmatched_formula_terms.append(term)
                
        if unmatched_formula_terms:
            warnings.append(
                f"Formula terms {unmatched_formula_terms} do not appear in numerator or denominator definitions."
            )

    # 3. Verify threshold ranges are logically consistent
    threshold_text = item.threshold_guidance or item.reporting_requirements or ""
    # Look for numbers associated with Red, Amber, Green
    # E.g. "Red < 10%", "Amber 10-15%", "Green > 15%"
    red_match = re.search(r"red\s*(?:<|>|<=|>=|equals|is|:|under|over)?\s*(-?\d+(?:\.\d+)?%?)", threshold_text, re.IGNORECASE)
    green_match = re.search(r"green\s*(?:<|>|<=|>=|equals|is|:|under|over)?\s*(-?\d+(?:\.\d+)?%?)", threshold_text, re.IGNORECASE)
    amber_match = re.search(r"amber\s*(?:[a-zA-Z\s\:-]*)(-?\d+(?:\.\d+)?%?)", threshold_text, re.IGNORECASE)
    
    if red_match and green_match:
        try:
            red_val = clean_number(red_match.group(1))
            green_val = clean_number(green_match.group(1))
            
            # If both are valid non-zero thresholds
            if red_val > 0 and green_val > 0:
                # Check if Amber is also found
                amber_val = clean_number(amber_match.group(1)) if amber_match else None
                
                # Check for maximizing or minimizing KPI
                is_maximizing = green_val > red_val
                
                if is_maximizing:
                    if red_val >= green_val:
                        warnings.append(f"Inconsistent thresholds: Red value ({red_val}) should be less than Green value ({green_val}) for maximizing KPI.")
                    if amber_val and not (red_val <= amber_val <= green_val):
                        warnings.append(f"Inconsistent thresholds: Amber value ({amber_val}) should be between Red ({red_val}) and Green ({green_val}).")
                else:
                    if red_val <= green_val:
                        warnings.append(f"Inconsistent thresholds: Red value ({red_val}) should be greater than Green value ({green_val}) for minimizing KPI.")
                    if amber_val and not (green_val <= amber_val <= red_val):
                        warnings.append(f"Inconsistent thresholds: Amber value ({amber_val}) should be between Green ({green_val}) and Red ({red_val}).")
        except Exception as e:
            logger.error(f"Error parsing threshold boundaries: {e}")

    # 4. Verify business rules do not contradict KPI definitions
    rules_text = item.business_rules or ""
    def_text = item.kpi_definition or ""
    
    # Check for cadence conflicts
    cadences = ["weekly", "monthly", "daily", "hourly", "quarterly", "yearly", "annual"]
    def_cadence = next((c for c in cadences if c in def_text.lower()), None)
    rules_cadence = next((c for c in cadences if c in rules_text.lower()), None)
    
    if def_cadence and rules_cadence and def_cadence != rules_cadence:
        warnings.append(
            f"Cadence contradiction: KPI definition implies '{def_cadence}' refresh, but business rules mention '{rules_cadence}' refresh."
        )
        
    # Check for inclusion/exclusion contradictions
    inc_text = item.inclusion_rules or ""
    exc_text = item.exclusion_rules or ""
    
    # E.g., if a term is listed in both inclusion and exclusion rules
    if inc_text and exc_text:
        # Extract capitalized terms or phrases of interest
        terms_to_check = ["intercompany", "internal", "sample", "test", "cancelled", "returns", "discounts"]
        for term in terms_to_check:
            if term in inc_text.lower() and term in exc_text.lower():
                warnings.append(f"Inconsistency: Term '{term}' appears in both inclusion and exclusion rules.")

    return warnings
