import os
import sys
import unittest
import asyncio
from datetime import datetime

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import init_db, SessionLocal, LLMUsageLog
from app.services.llm.langchain_provider import DemoProvider


class TestTokenMonitoring(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Initialize DB to ensure table exists
        init_db()

    def setUp(self):
        # Clean up usage logs before each test
        with SessionLocal() as session:
            session.query(LLMUsageLog).delete()
            session.commit()

    def test_demo_provider_logs_to_sqlite(self):
        provider = DemoProvider()
        
        loop = asyncio.get_event_loop()
        # Trigger an LLM interaction mock
        loop.run_until_complete(
            provider.generate_json(
                system_prompt="Return a concise business summary",
                user_prompt="mock user prompt",
                step_name="test_prompt_generation"
            )
        )
        
        # Verify the database entry
        with SessionLocal() as session:
            logs = session.query(LLMUsageLog).all()
            self.assertEqual(len(logs), 1)
            
            log = logs[0]
            self.assertEqual(log.provider, "demo")
            self.assertEqual(log.model, "local-demo")
            self.assertEqual(log.workflow_step, "test_prompt_generation")
            self.assertEqual(log.input_tokens, 0)
            self.assertEqual(log.output_tokens, 0)
            self.assertEqual(log.total_tokens, 0)
            self.assertTrue(log.duration_ms >= 0)
            self.assertTrue(log.success)
            self.assertIsNone(log.error_message)
            self.assertTrue(isinstance(log.timestamp, datetime))

    def test_langchain_provider_success_and_failure_logging(self):
        from unittest.mock import AsyncMock, MagicMock
        from langchain_core.messages import AIMessage
        from app.services.llm.langchain_provider import LangChainProvider

        loop = asyncio.get_event_loop()

        # 1. Success case with token usage
        mock_chat_model = MagicMock()
        
        mock_response = AIMessage(
            content='{"key": "success_value"}',
            response_metadata={"token_usage": {"prompt_tokens": 12, "completion_tokens": 34, "total_tokens": 46}}
        )
        mock_response.usage_metadata = {"input_tokens": 12, "output_tokens": 34, "total_tokens": 46}
        
        mock_chat_model.ainvoke = AsyncMock(return_value=mock_response)

        provider = LangChainProvider(mock_chat_model, provider_name="mock_openai", model_name="mock-gpt")
        
        res = loop.run_until_complete(
            provider.generate_json(
                system_prompt="sys",
                user_prompt="usr",
                step_name="success_step"
            )
        )
        self.assertEqual(res, {"key": "success_value"})

        with SessionLocal() as session:
            logs = session.query(LLMUsageLog).filter_by(workflow_step="success_step").all()
            self.assertEqual(len(logs), 1)
            log = logs[0]
            self.assertEqual(log.provider, "mock_openai")
            self.assertEqual(log.model, "mock-gpt")
            self.assertEqual(log.input_tokens, 12)
            self.assertEqual(log.output_tokens, 34)
            self.assertEqual(log.total_tokens, 46)
            self.assertTrue(log.success)
            self.assertIsNone(log.error_message)

        # 2. Failure case (model invocation throws exception)
        mock_chat_model_fail = MagicMock()
        mock_chat_model_fail.ainvoke = AsyncMock(side_effect=ValueError("Connection timed out"))

        provider_fail = LangChainProvider(mock_chat_model_fail, provider_name="mock_google", model_name="mock-gemini")
        
        with self.assertRaises(ValueError):
            loop.run_until_complete(
                provider_fail.generate_json(
                    system_prompt="sys",
                    user_prompt="usr",
                    step_name="fail_step"
                )
            )

        with SessionLocal() as session:
            logs = session.query(LLMUsageLog).filter_by(workflow_step="fail_step").all()
            self.assertEqual(len(logs), 1)
            log = logs[0]
            self.assertEqual(log.provider, "mock_google")
            self.assertEqual(log.model, "mock-gemini")
            self.assertFalse(log.success)
            self.assertIn("Connection timed out", log.error_message)



if __name__ == "__main__":
    unittest.main()
