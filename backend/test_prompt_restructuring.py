import os
import sys
import unittest
import asyncio

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.llm.langchain_provider import DemoProvider
from app.services.prompting import PROMPT_GENERATION_SYSTEM_PROMPT, PROMPT_REFINEMENT_SYSTEM_PROMPT


class TestPromptRestructuring(unittest.TestCase):

    def test_new_prompt_templates_contain_sections(self):
        # Verify the raw templates contain the 6 required sections
        sections = [
            "Objective / Purpose",
            "Business Context",
            "KPI Definitions",
            "Calculation Logic",
            "Assumptions",
            "Expected Output Format"
        ]
        
        for section in sections:
            self.assertIn(section, PROMPT_GENERATION_SYSTEM_PROMPT, f"Missing section '{section}' in PROMPT_GENERATION_SYSTEM_PROMPT")
            self.assertIn(section, PROMPT_REFINEMENT_SYSTEM_PROMPT, f"Missing section '{section}' in PROMPT_REFINEMENT_SYSTEM_PROMPT")

    def test_demo_provider_restructured_prompt(self):
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
        
        # Verify all 6 sections are in the returned mock prompt
        sections = [
            "Objective / Purpose",
            "Business Context",
            "KPI Definitions",
            "Calculation Logic",
            "Assumptions",
            "Expected Output Format"
        ]
        
        for section in sections:
            self.assertIn(section, prompt_text, f"Missing section '{section}' in mock prompt")


if __name__ == "__main__":
    unittest.main()
