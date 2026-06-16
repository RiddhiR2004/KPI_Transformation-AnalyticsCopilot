import os
import sys
import unittest
import json
from datetime import datetime
from pathlib import Path

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import init_db, SessionLocal, FunctionalSpecification as DBFunctionalSpecification
from app.models import FunctionalSpecification, FunctionalSpecItem, BusinessContext, KPI
from app.services.doc_generators import generate_docx_spec, generate_pdf_spec
from app.main import FILES, write_json

class TestFunctionalSpecStudio(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Ensure database is initialized
        init_db()

    def setUp(self):
        # Clear out existing functional specifications in DB
        with SessionLocal() as session:
            session.query(DBFunctionalSpecification).delete()
            session.commit()

        # Seed default business context and approved KPIs in JSON files for endpoints to read
        self.temp_context = {
            "industry": "Manufacturing",
            "organization_level": "CXO",
            "kpi_count": 2,
            "business_priorities": ["Improve Gross Margin"],
            "business_challenges": ["High Operational Cost"],
            "top_kras": ["Operational Excellence"],
            "functional_areas": ["Operations"],
            "additional_business_priorities": [],
            "additional_business_challenges": [],
            "additional_kras": [],
            "additional_functional_areas": []
        }
        write_json(FILES["business_context"], self.temp_context)

        self.temp_approved_kpis = {
            "items": [
                {
                    "id": "kpi_01",
                    "kpi_name": "Cost Per Unit",
                    "functional_area": "Operations",
                    "kra": "Operational Excellence",
                    "kpi_category": "Operational",
                    "business_definition": "Total manufacturing cost divided by number of units produced.",
                    "kpi_description": "Tracks production efficiency and unit economics.",
                    "formula": "Total Cost / Total Units",
                    "numerator": "Total Cost",
                    "denominator": "Total Units",
                    "source_system": "SAP",
                    "sap_module": "CO",
                    "business_owner": "Director of Operations",
                    "data_owner": "Finance Manager",
                    "refresh_cadence": "Monthly",
                    "recommended_target_range": "$10 - $12",
                    "recommended_threshold_range": "> $15",
                    "notes": "Include direct labor and overhead.",
                    "strategic_focus_area": "Cost Efficiency",
                    "standard_driver": "Overhead Optimization",
                    "sector_driver": "Material Sourcing",
                    "value_drivers": [],
                    "industry_tags": [],
                    "recommendation_score": 100,
                    "status": "approved"
                }
            ]
        }
        write_json(FILES["approved_kpis"], self.temp_approved_kpis)

    def test_database_persistence_and_states(self):
        # Test direct SQLite saving and retrieving of Draft vs Approved states
        with SessionLocal() as session:
            db_spec = DBFunctionalSpecification()
            db_spec.draft_items = json.dumps([{
                "id": "kpi_01",
                "kpi_name": "Cost Per Unit",
                "formula": "Total Cost / Total Units",
                "kpi_category": "Operational",
                "business_purpose_relevance": "Key efficiency indicator"
            }])
            db_spec.executive_summary = "Advisory Executive Summary"
            db_spec.status = "draft"
            db_spec.updated_at = datetime.now()
            session.add(db_spec)
            session.commit()

        # Load spec from DB
        with SessionLocal() as session:
            spec_from_db = session.query(DBFunctionalSpecification).order_by(DBFunctionalSpecification.id.desc()).first()
            self.assertIsNotNone(spec_from_db)
            self.assertEqual(spec_from_db.status, "draft")
            self.assertEqual(spec_from_db.executive_summary, "Advisory Executive Summary")
            
            items = json.loads(spec_from_db.draft_items)
            self.assertEqual(len(items), 1)
            self.assertEqual(items[0]["kpi_name"], "Cost Per Unit")

            # Simulate Approval Action
            spec_from_db.approved_items = spec_from_db.draft_items
            spec_from_db.status = "approved"
            session.commit()

        # Load again to verify approved status
        with SessionLocal() as session:
            spec_approved = session.query(DBFunctionalSpecification).order_by(DBFunctionalSpecification.id.desc()).first()
            self.assertEqual(spec_approved.status, "approved")
            approved_items = json.loads(spec_approved.approved_items)
            self.assertEqual(len(approved_items), 1)
            self.assertEqual(approved_items[0]["kpi_name"], "Cost Per Unit")

    def test_docx_pdf_exporters(self):
        # Verify document generators run correctly and produce output files
        spec_items = [
            FunctionalSpecItem(
                id="kpi_01",
                kpi_name="Cost Per Unit",
                kpi_category="Operational",
                functional_area="Operations",
                related_kra="Operational Excellence",
                strategic_objective_supported="Reduce Overhead",
                business_challenge_addressed="High Operational Cost",
                business_owner="Director of Operations",
                data_owner="Finance Manager",
                business_purpose_relevance="Key efficiency indicator",
                kpi_definition="Total manufacturing cost divided by number of units produced.",
                formula="Total Cost / Total Units",
                numerator="Total Cost",
                denominator="Total Units",
                calculation_methodology="Calculated monthly based on CO-PA module extraction.",
                inclusion_rules="All direct production costs",
                exclusion_rules="Corporate SG&A allocation",
                sample_calculation="Total Cost: $1,000,000 / Total Units: 100,000 = $10.00",
                business_rules="Must update monthly.",
                data_validation_rules="Must be positive",
                exception_handling_rules="Default to zero if denominator is zero",
                data_quality_expectations="99.9% accuracy",
                source_systems_lineage="SAP ERP / CO module",
                ownership_governance="Governed by Operations Control committee.",
                assumptions_constraints="Assumes currency conversions are fixed.",
                reporting_requirements="Bar chart on CXO Dashboard",
                dashboard_recommendations="Strategic Ops view",
                threshold_guidance="Yellow: $12, Red: $15",
                implementation_guidance="Standard database view"
            )
        ]
        
        spec = FunctionalSpecification(
            items=spec_items,
            executive_summary="Executive Summary Text",
            status="draft",
            updated_at=datetime.now()
        )
        
        context = BusinessContext(**self.temp_context)
        
        docx_path = Path(__file__).parent / "data" / "test_spec_export.docx"
        pdf_path = Path(__file__).parent / "data" / "test_spec_export.pdf"
        
        # Clean up existing files
        if docx_path.exists():
            os.remove(docx_path)
        if pdf_path.exists():
            os.remove(pdf_path)
            
        # Run generators
        generate_docx_spec(docx_path, spec, context)
        generate_pdf_spec(pdf_path, spec, context)
        
        # Verify file existence and non-zero size
        self.assertTrue(docx_path.exists(), "DOCX specification was not generated")
        self.assertTrue(docx_path.stat().st_size > 0, "DOCX specification is empty")
        
        self.assertTrue(pdf_path.exists(), "PDF specification was not generated")
        self.assertTrue(pdf_path.stat().st_size > 0, "PDF specification is empty")
        
        # Clean up files after validation
        if docx_path.exists():
            os.remove(docx_path)
        if pdf_path.exists():
            os.remove(pdf_path)

    def test_traceability_string_parsing_logic(self):
        # Verify that docx and pdf generators can process different traceability arrow formats
        spec_items = [
            FunctionalSpecItem(
                id="kpi_01",
                kpi_name="Cost Per Unit",
                kpi_category="Operational",
                functional_area="Operations",
                related_kra="Operational Excellence",
                strategic_objective_supported="Objective &rarr; Challenge &rarr; KRA &rarr; Area &rarr; KPI",
                business_challenge_addressed="High Operational Cost"
            ),
            FunctionalSpecItem(
                id="kpi_02",
                kpi_name="Gross Margin",
                kpi_category="Financial",
                functional_area="Finance",
                related_kra="Profitability",
                strategic_objective_supported="Strategic Objective → Business Challenge → KRA → Functional Area → KPI",
                business_challenge_addressed="Margin Compression"
            ),
            FunctionalSpecItem(
                id="kpi_03",
                kpi_name="OEE",
                kpi_category="Operational",
                functional_area="Production",
                related_kra="Asset Productivity",
                strategic_objective_supported="Maximize Asset Performance",
                business_challenge_addressed="Equipment Downtime"
            )
        ]
        spec = FunctionalSpecification(
            items=spec_items,
            executive_summary="Summary",
            status="draft",
            updated_at=datetime.now()
        )
        context = BusinessContext(**self.temp_context)
        
        docx_path = Path(__file__).parent / "data" / "test_spec_trace.docx"
        pdf_path = Path(__file__).parent / "data" / "test_spec_trace.pdf"
        
        # Verify it generates without errors under various formatting options
        generate_docx_spec(docx_path, spec, context)
        generate_pdf_spec(pdf_path, spec, context)
        
        self.assertTrue(docx_path.exists())
        self.assertTrue(pdf_path.exists())
        
        if docx_path.exists():
            os.remove(docx_path)
        if pdf_path.exists():
            os.remove(pdf_path)

    def test_validator_logic(self):
        from app.services.spec_validator import validate_spec_item
        
        # 1. Correct KPI Spec (should have zero or minimal warnings)
        kpi = KPI(
            id="kpi_02",
            kpi_name="Overall Equipment Effectiveness",
            functional_area="Operations",
            kra="Asset Productivity",
            kpi_description="Tracks equipment productivity.",
            formula="Availability * Performance * Quality",
            source_system="SCADA",
            refresh_cadence="Daily"
        )
        good_item = FunctionalSpecItem(
            id="kpi_02",
            kpi_name="Overall Equipment Effectiveness",
            formula="Availability * Performance * Quality",
            sample_calculation="Availability: 0.90 * Performance: 0.90 * Quality: 0.95 = 0.7695",
            threshold_guidance="Green > 85%, Amber 75-85%, Red < 75%",
            kpi_definition="Measures daily equipment productivity.",
            business_rules="Refreshed daily at 06:00 AM."
        )
        
        warnings_good = validate_spec_item(good_item, kpi)
        # Should be clean of core validation errors
        self.assertEqual(len(warnings_good), 0, f"Expected no warnings, but got: {warnings_good}")

        # 2. Bad KPI Spec (should trigger warnings)
        bad_item = FunctionalSpecItem(
            id="kpi_02",
            kpi_name="Overall Equipment Effectiveness",
            formula="Total Output / Total Input",
            numerator="Total Output count",
            denominator="Total Input count",
            sample_calculation="Total Output: 100 / Total Input: 200 = 0.25", # Math mismatch: 100/200 is 0.50, not 0.25
            threshold_guidance="Green > 85%, Amber 70-75%, Red < 90%", # Non-monotonic thresholds
            kpi_definition="Measures weekly equipment productivity.", # Cadence contradiction (definition has 'weekly')
            business_rules="Must update daily." # Cadence contradiction (rules have 'daily')
        )
        
        warnings_bad = validate_spec_item(bad_item, kpi)
        
        # Verify that the warnings are triggered
        has_threshold_warn = any("Inconsistent thresholds" in w for w in warnings_bad)
        has_cadence_warn = any("Cadence contradiction" in w for w in warnings_bad)
        
        self.assertTrue(has_threshold_warn, f"Expected threshold warning in: {warnings_bad}")
        self.assertTrue(has_cadence_warn, f"Expected cadence warning in: {warnings_bad}")

if __name__ == "__main__":
    unittest.main()
