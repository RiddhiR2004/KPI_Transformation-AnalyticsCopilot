import os
import sys
import unittest
import asyncio

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.llm.langchain_provider import DemoProvider
from app.services.prompting import PROMPT_GENERATION_SYSTEM_PROMPT, PROMPT_REFINEMENT_SYSTEM_PROMPT


class TestHybridPromptFramework(unittest.TestCase):

    def test_templates_contain_sections(self):
        sections = [
            "Objective / Purpose",
            "Business Context",
            "KPI Definitions & KPI Themes",
            "Calculation Logic & Measurement Principles",
            "Assumptions & Governance Requirements",
            "Expected Output Format & KPI Generation Instructions"
        ]
        
        for section in sections:
            self.assertIn(section, PROMPT_GENERATION_SYSTEM_PROMPT, f"Missing section '{section}' in PROMPT_GENERATION_SYSTEM_PROMPT")
            self.assertIn(section, PROMPT_REFINEMENT_SYSTEM_PROMPT, f"Missing section '{section}' in PROMPT_REFINEMENT_SYSTEM_PROMPT")

    def test_templates_specify_json_schema(self):
        # Asserts downstream schema instructions exist in the templates
        self.assertIn('"kpi_name":', PROMPT_GENERATION_SYSTEM_PROMPT)
        self.assertIn('"business_purpose":', PROMPT_GENERATION_SYSTEM_PROMPT)
        self.assertIn('"formula":', PROMPT_GENERATION_SYSTEM_PROMPT)
        self.assertIn('"numerator":', PROMPT_GENERATION_SYSTEM_PROMPT)
        self.assertIn('"denominator":', PROMPT_GENERATION_SYSTEM_PROMPT)
        self.assertIn('"business_owner":', PROMPT_GENERATION_SYSTEM_PROMPT)
        self.assertIn('"data_owner":', PROMPT_GENERATION_SYSTEM_PROMPT)

    def test_demo_provider_returns_hybrid_mock_prompt(self):
        provider = DemoProvider()
        loop = asyncio.get_event_loop()
        
        payload = loop.run_until_complete(
            provider.generate_json(
                system_prompt="sys",
                user_prompt="usr",
                step_name="generate_prompt"
            )
        )
        
        prompt_text = payload.get("prompt", "")
        self.assertTrue(prompt_text)
        
        sections = [
            "Objective / Purpose",
            "Business Context",
            "KPI Definitions & KPI Themes",
            "Calculation Logic & Measurement Principles",
            "Assumptions & Governance Requirements",
            "Expected Output Format & KPI Generation Instructions"
        ]
        
        for section in sections:
            self.assertIn(section, prompt_text, f"Missing section '{section}' in mock prompt")


if __name__ == "__main__":
    unittest.main()
