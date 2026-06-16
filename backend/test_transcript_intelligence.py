import os
import sys
import unittest
import json
import asyncio
from datetime import datetime
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import init_db, SessionLocal, TranscriptAnalysis, LLMUsageLog, FunctionalSpecification as DBFunctionalSpecification
from app.models import TranscriptInsights, TranscriptAnalysisRecord
from app.services.transcript import extract_text_from_bytes, chunk_text, analyze_transcript_text
from app.services.llm.langchain_provider import DemoProvider
from app.main import app, FILES, write_json

class TestTranscriptIntelligence(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Ensure database is initialized
        init_db()
        cls.client = TestClient(app)

    def setUp(self):
        # Patch get_provider to return DemoProvider in llm_providers, main, and transcript modules
        self.provider_patcher = patch('app.services.llm_providers.get_provider', return_value=DemoProvider())
        self.main_provider_patcher = patch('app.main.get_provider', return_value=DemoProvider())
        self.transcript_provider_patcher = patch('app.services.transcript.get_provider', return_value=DemoProvider())
        
        self.provider_patcher.start()
        self.main_provider_patcher.start()
        self.transcript_provider_patcher.start()

        # Clear out transcripts and spec tables in DB
        with SessionLocal() as session:
            session.query(TranscriptAnalysis).delete()
            session.query(DBFunctionalSpecification).delete()
            session.query(LLMUsageLog).delete()
            session.commit()

        # Seed standard files
        self.temp_context = {
            "industry": "Manufacturing",
            "organization_level": "CXO",
            "kpi_count": 2,
            "business_priorities": ["Reduce machine downtime"],
            "business_challenges": ["High setup times"],
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
                    "id": "kpi_1",
                    "kpi_name": "Machine Downtime",
                    "functional_area": "Operations",
                    "kra": "Operational Excellence",
                    "kpi_category": "Operational",
                    "business_definition": "Time machines are inactive.",
                    "kpi_description": "Tracks inactive hours.",
                    "formula": "Downtime / Total Hours",
                    "numerator": "Downtime Hours",
                    "denominator": "Total Hours",
                    "source_system": "SAP",
                    "sap_module": "PM",
                    "business_owner": "COO",
                    "data_owner": "Data Lead",
                    "refresh_cadence": "Weekly",
                    "recommended_target_range": "0-5%",
                    "recommended_threshold_range": "Red > 5%",
                    "notes": "",
                    "status": "approved"
                }
            ]
        }
        write_json(FILES["approved_kpis"], self.temp_approved_kpis)

        # Clear prompts draft
        write_json(FILES["prompts"], {})

    def tearDown(self):
        self.provider_patcher.stop()
        self.main_provider_patcher.stop()
        self.transcript_provider_patcher.stop()

    def test_text_extraction_txt(self):
        content = b"Hello, this is a sample transcript file."
        extracted = extract_text_from_bytes("transcript.txt", content)
        self.assertEqual(extracted.strip(), "Hello, this is a sample transcript file.")

    def test_text_extraction_invalid_format(self):
        with self.assertRaises(ValueError):
            extract_text_from_bytes("transcript.exe", b"invalid content")

    def test_chunking_logic(self):
        # Test short text doesn't chunk (chunk_size=20 > len=11)
        text = "Hello world"
        chunks = chunk_text(text, chunk_size=20, overlap=2)
        self.assertEqual(chunks, ["Hello world"])

        # Test long text chunking
        long_text = "abcdefghijklmnop"
        chunks = chunk_text(long_text, chunk_size=5, overlap=1)
        self.assertTrue(len(chunks) > 1)
        self.assertEqual("".join(chunks[:2]), "abcdeefghi")

    def test_analyze_transcript_text_demo_provider(self):
        # In demo provider mode, it should return mock insights structure
        raw_text = "This is a brief operational meeting transcript."
        loop = asyncio.get_event_loop()
        insights = loop.run_until_complete(analyze_transcript_text(raw_text))

        self.assertIn("executive_summary", insights)
        self.assertIn("strategic_priorities", insights)
        self.assertIn("business_challenges", insights)
        self.assertIn("key_decisions", insights)
        self.assertIn("action_items", insights)
        self.assertIn("risks_dependencies", insights)
        self.assertIn("mentioned_metrics", insights)

    def test_endpoint_lifecycle(self):
        # 1. Upload a transcript
        content = "Executive alignment session. Decisions: approved budget for pilot, implement downtime monitoring."
        files = {"file": ("meeting.txt", content, "text/plain")}
        
        response = self.client.post("/transcript/upload", files=files)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertEqual(data["filename"], "meeting.txt")
        self.assertEqual(data["status"], "draft")
        self.assertEqual(data["raw_text"], content)
        record_id = data["id"]
        
        # Verify it was saved in DB
        with SessionLocal() as session:
            db_record = session.query(TranscriptAnalysis).filter(TranscriptAnalysis.id == record_id).first()
            self.assertIsNotNone(db_record)
            self.assertEqual(db_record.status, "draft")

        # 2. Get list of transcripts
        list_response = self.client.get("/transcript/list")
        self.assertEqual(list_response.status_code, 200)
        self.assertTrue(len(list_response.json()) >= 1)

        # 3. Update insights
        updated_insights = data["extracted_insights"]
        updated_insights["executive_summary"] = "Newly updated executive summary!"
        updated_insights["key_decisions"] = ["Decision A", "Decision B"]
        
        update_response = self.client.post(
            f"/transcript/{record_id}/insights",
            json={"extracted_insights": updated_insights}
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.json()["extracted_insights"]["executive_summary"], "Newly updated executive summary!")
        self.assertEqual(update_response.json()["extracted_insights"]["key_decisions"], ["Decision A", "Decision B"])

        # 4. Approve the status
        status_response = self.client.post(
            f"/transcript/{record_id}/status",
            json={"status": "approved"}
        )
        self.assertEqual(status_response.status_code, 200)
        self.assertEqual(status_response.json()["status"], "approved")

        # 5. Verify deleting works
        delete_response = self.client.delete(f"/transcript/{record_id}")
        self.assertEqual(delete_response.status_code, 200)
        self.assertEqual(delete_response.json()["status"], "success")

        with SessionLocal() as session:
            db_record = session.query(TranscriptAnalysis).filter(TranscriptAnalysis.id == record_id).first()
            self.assertIsNone(db_record)

    def test_downstream_injections(self):
        # 1. Upload & Approve a transcript
        content = "Executive alignment session.\nDecisions: approved budget for pilot, implement downtime monitoring.\nAction: start vendor trial by Monday."
        files = {"file": ("meeting_minutes.txt", content, "text/plain")}
        upload_resp = self.client.post("/transcript/upload", files=files)
        self.assertEqual(upload_resp.status_code, 200)
        record_id = upload_resp.json()["id"]

        # Approve it
        self.client.post(f"/transcript/{record_id}/status", json={"status": "approved"})

        # 2. Check generate-prompt injection
        prompt_resp = self.client.post("/generate-prompt", json={"user_instructions": "prioritize safety"})
        self.assertEqual(prompt_resp.status_code, 200)
        prompt_data = prompt_resp.json()
        self.assertIn("prompt", prompt_data)
        
        # Verify the transcript context header is inside the prompt
        prompt_text = prompt_data["prompt"]
        self.assertIn("=== APPROVED TRANSCRIPT ANALYSIS INSIGHTS ===", prompt_text)
        self.assertIn("meeting_minutes.txt", prompt_text)

        # 3. Check refine-prompt injection
        refine_resp = self.client.post("/refine-prompt", json={
            "prompt": prompt_text,
            "refinement_instructions": "make it more concise"
        })
        self.assertEqual(refine_resp.status_code, 200)

        # 4. Check generate-kpis injection
        kpi_resp = self.client.post("/generate-kpis")
        self.assertEqual(kpi_resp.status_code, 200)
        
        kpi_library_data = kpi_resp.json()
        kpi_items = kpi_library_data.get("items") or []
        self.assertTrue(len(kpi_items) > 0)
        
        # Approve generated KPIs to satisfy generate-spec requirements
        kpi_ids = [k["id"] for k in kpi_items]
        approve_resp = self.client.post("/approve-kpis", json={"ids": kpi_ids, "status": "approved"})
        self.assertEqual(approve_resp.status_code, 200)

        # 5. Check generate-spec injection (with mock trace verification)
        spec_resp = self.client.post("/generate-spec")
        self.assertEqual(spec_resp.status_code, 200)
        spec_data = spec_resp.json()
        
        # We look at draft items or spec items
        with SessionLocal() as session:
            from app.database import FunctionalSpecification as DBFunctionalSpecification
            db_spec = session.query(DBFunctionalSpecification).order_by(DBFunctionalSpecification.id.desc()).first()
            self.assertIsNotNone(db_spec)
            items = json.loads(db_spec.draft_items)
            self.assertTrue(len(items) >= 1)
            
            # Verify the transcript trace note is inside the fields
            item = items[0]
            self.assertIn("Traceable to meeting decision", item["business_purpose_relevance"])
            self.assertIn("Traceable to meeting decision", item["assumptions_constraints"])
            self.assertIn("Traceable to meeting decision", item["implementation_guidance"])


if __name__ == "__main__":
    unittest.main()
