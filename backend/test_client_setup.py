import os
import sys
import unittest
import json
import shutil
from datetime import datetime
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import init_db, SessionLocal, ClientProfile, ClientInsight, LLMUsageLog, ActivityLog
from app.services.llm.langchain_provider import DemoProvider
from app.main import app, ROOT

class TestClientSetup(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Ensure database is initialized
        init_db()
        cls.client = TestClient(app)

    def setUp(self):
        # Patch get_provider to return DemoProvider in main module
        self.main_provider_patcher = patch('app.main.get_provider', return_value=DemoProvider())
        self.main_provider_patcher.start()

        # Clear out Client Setup tables
        with SessionLocal() as session:
            session.query(ClientInsight).delete()
            session.query(ClientProfile).delete()
            session.query(LLMUsageLog).delete()
            session.query(ActivityLog).delete()
            session.commit()

    def tearDown(self):
        self.main_provider_patcher.stop()

    def test_get_empty_client_profile(self):
        # When database has no profile, it should return an empty dict/object
        response = self.client.get("/client-profile")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {})

    def test_save_client_profile_validation(self):
        # 1. Missing client_name
        payload = {
            "profile": {
                "client_name": "",
                "industry": "Manufacturing",
                "country": "Germany"
            },
            "insights": []
        }
        response = self.client.post("/client-profile", json=payload)
        self.assertEqual(response.status_code, 400)

        # 2. Missing industry
        payload = {
            "profile": {
                "client_name": "Test Client",
                "industry": "",
                "country": "Germany"
            },
            "insights": []
        }
        response = self.client.post("/client-profile", json=payload)
        self.assertEqual(response.status_code, 400)

        # 3. Missing country
        payload = {
            "profile": {
                "client_name": "Test Client",
                "industry": "Manufacturing",
                "country": ""
            },
            "insights": []
        }
        response = self.client.post("/client-profile", json=payload)
        self.assertEqual(response.status_code, 400)

    def test_save_and_retrieve_client_profile_success(self):
        # Create a valid profile + insights
        payload = {
            "profile": {
                "client_name": "Acme Corp",
                "industry": "Manufacturing",
                "sub_industry": "Automotive Parts",
                "country": "United States",
                "region": "North America",
                "company_size": "1000 - 5000",
                "organization_description": "Leading manufacturer of high precision brake pads.",
                "erp_platform": "SAP S/4HANA",
                "crm_platform": "Salesforce",
                "mes_platform": "Rockwell FactoryTalk",
                "bi_tool": "Microsoft Power BI",
                "data_warehouse": "Snowflake",
                "cloud_platform": "Microsoft Azure"
            },
            "insights": [
                {
                    "category": "Strategic Objectives",
                    "insights": ["Expand output by 20% in Q4", "Reduce scrap rate to under 1.5%"]
                },
                {
                    "category": "IT Bottlenecks",
                    "insights": ["ERP data latency issues", "Manual inventory tracking sheets"]
                }
            ]
        }

        # Save profile
        response = self.client.post("/client-profile", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Verify returned data
        self.assertIn("id", data)
        self.assertEqual(data["client_name"], "Acme Corp")
        self.assertEqual(data["industry"], "Manufacturing")
        self.assertEqual(data["sub_industry"], "Automotive Parts")
        self.assertEqual(data["erp_platform"], "SAP S/4HANA")
        self.assertEqual(len(data["insights"]), 2)
        self.assertEqual(data["insights"][0]["category"], "Strategic Objectives")
        self.assertEqual(data["insights"][0]["insights"], ["Expand output by 20% in Q4", "Reduce scrap rate to under 1.5%"])

        # Fetch profile
        get_response = self.client.get("/client-profile")
        self.assertEqual(get_response.status_code, 200)
        get_data = get_response.json()
        self.assertEqual(get_data["id"], data["id"])
        self.assertEqual(get_data["client_name"], "Acme Corp")
        self.assertEqual(len(get_data["insights"]), 2)

        # Check database rows directly to verify foreign key relationship
        with SessionLocal() as session:
            db_profile = session.query(ClientProfile).filter_by(client_name="Acme Corp").first()
            self.assertIsNotNone(db_profile)
            
            db_insights = session.query(ClientInsight).filter_by(client_profile_id=db_profile.id).all()
            self.assertEqual(len(db_insights), 2)
            categories = [ins.category for ins in db_insights]
            self.assertIn("Strategic Objectives", categories)
            self.assertIn("IT Bottlenecks", categories)

            # Check Activity Log
            activities = session.query(ActivityLog).all()
            self.assertTrue(len(activities) > 0)
            self.assertEqual(activities[0].label, "Client Setup Completed")

    def test_cascade_delete_insights(self):
        # Save a profile + insights first
        payload = {
            "profile": {
                "client_name": "Cascade Corp",
                "industry": "Retail",
                "country": "Canada"
            },
            "insights": [
                {
                    "category": "Directives",
                    "insights": ["Directive 1"]
                }
            ]
        }
        response = self.client.post("/client-profile", json=payload)
        self.assertEqual(response.status_code, 200)
        profile_id = response.json()["id"]

        with SessionLocal() as session:
            db_profile = session.get(ClientProfile, profile_id)
            self.assertIsNotNone(db_profile)
            db_insights = session.query(ClientInsight).filter_by(client_profile_id=profile_id).all()
            self.assertEqual(len(db_insights), 1)

            # Delete profile and verify cascading deletion of insights
            session.delete(db_profile)
            session.commit()

            db_insights_after = session.query(ClientInsight).filter_by(client_profile_id=profile_id).all()
            self.assertEqual(len(db_insights_after), 0)

    def test_asset_upload_and_analyze(self):
        session_id = "test_session_123"
        temp_dir = ROOT / "data" / "temp_uploads" / session_id
        if temp_dir.exists():
            shutil.rmtree(temp_dir)

        # 1. Upload/Stage files
        # Stage txt file
        file_content = b"Strategic priority: digitize the shop floor."
        response = self.client.post(
            f"/client-profile/upload?session_id={session_id}",
            files={"file": ("strategy.txt", file_content, "text/plain")}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["filename"], "strategy.txt")
        self.assertEqual(response.json()["size"], len(file_content))

        # Check that file exists on disk
        file_path = temp_dir / "strategy.txt"
        self.assertTrue(file_path.exists())

        # 2. Analyze staged files
        analyze_response = self.client.post(f"/client-profile/analyze?session_id={session_id}")
        self.assertEqual(analyze_response.status_code, 200)
        
        insights = analyze_response.json()
        self.assertIn("Strategic Priorities", insights)
        self.assertIn("Operational Challenges", insights)
        
        # Verify that staged files are deleted immediately after reading/analysis
        self.assertFalse(temp_dir.exists())

if __name__ == "__main__":
    unittest.main()
