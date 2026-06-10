import os
import sys
import unittest
import asyncio
from unittest.mock import MagicMock, AsyncMock

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.llm.langchain_provider import clean_and_parse_json, DemoProvider, LangChainProvider
from app.services.llm.provider_factory import get_llm_service, get_llm_status, create_provider


class TestLangChainIntegration(unittest.TestCase):

    def test_json_parsing_clean(self):
        # Plain valid JSON
        self.assertEqual(clean_and_parse_json('{"key": "value"}'), {"key": "value"})
        # Strips surrounding space
        self.assertEqual(clean_and_parse_json('   {"key": "value"}  '), {"key": "value"})

    def test_json_parsing_markdown_blocks(self):
        # With json label
        self.assertEqual(clean_and_parse_json('```json\n{"key": "value"}\n```'), {"key": "value"})
        # Without json label
        self.assertEqual(clean_and_parse_json('```\n{"key": "value"}\n```'), {"key": "value"})

    def test_json_parsing_conversational_wrapping(self):
        # Conversation before and after JSON
        raw_text = "Here is the response you wanted:\n```json\n{\"items\": [1, 2, 3]}\n```\nHope this helps!"
        self.assertEqual(clean_and_parse_json(raw_text), {"items": [1, 2, 3]})

    def test_json_parsing_trailing_comma_repair(self):
        # Trailing comma in dictionary
        self.assertEqual(clean_and_parse_json('{"key": "value",}'), {"key": "value"})
        # Trailing comma in list
        self.assertEqual(clean_and_parse_json('{"key": [1, 2, 3,]}'), {"key": [1, 2, 3]})

    def test_demo_provider(self):
        provider = DemoProvider()
        self.assertEqual(provider.name, "demo")
        self.assertEqual(provider.model, "local-demo")
        self.assertTrue(provider.is_demo)

        # Test async generation response
        loop = asyncio.get_event_loop()
        res_summary = loop.run_until_complete(
            provider.generate_json("Return a concise business summary", "test user prompt")
        )
        self.assertIn("Business Focus", res_summary)

        res_exec = loop.run_until_complete(
            provider.generate_json("Return a JSON object with 'summary_text'", "test user prompt")
        )
        self.assertIn("summary_text", res_exec)

        res_generic = loop.run_until_complete(
            provider.generate_json("Some system prompt", "test user prompt")
        )
        self.assertIn("summary", res_generic)

    def test_factory_status(self):
        # Set to demo provider
        os.environ["LLM_PROVIDER"] = "demo"
        provider = create_provider()
        self.assertTrue(provider.is_demo)
        self.assertEqual(provider.name, "demo")

        status = get_llm_status()
        self.assertEqual(status["provider"], "demo")
        self.assertFalse(status["uses_real_llm"])


if __name__ == "__main__":
    unittest.main()
