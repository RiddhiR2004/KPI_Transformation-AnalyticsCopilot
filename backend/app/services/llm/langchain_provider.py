import asyncio
import json
import logging
import re
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from datetime import datetime

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.prompts import ChatPromptTemplate
from app.services.llm.models import LLMCallDetails

logger = logging.getLogger("app.services.llm.langchain_provider")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s"))
    logger.addHandler(handler)


def clean_and_parse_json(text: str) -> dict[str, Any]:
    text_clean = text.strip()
    
    # 1. Strip potential Markdown code blocks wrapping the JSON
    if text_clean.startswith("```"):
        first_newline = text_clean.find("\n")
        if first_newline != -1:
            text_clean = text_clean[first_newline:].strip()
        if text_clean.endswith("```"):
            text_clean = text_clean[:-3].strip()

    # 2. Try parsing directly
    try:
        return json.loads(text_clean)
    except json.JSONDecodeError:
        pass

    # 3. Attempt extraction of JSON object using Regex (finding matched '{' ... '}' or '[' ... ']')
    match = re.search(r"(\{.*\}|\[.*\])", text_clean, re.DOTALL)
    if match:
        extracted = match.group(1)
        try:
            return json.loads(extracted)
        except json.JSONDecodeError:
            repaired = extracted
            # Remove trailing commas from objects/arrays
            repaired = re.sub(r",\s*([\}\]])", r"\1", repaired)
            try:
                return json.loads(repaired)
            except json.JSONDecodeError as exc:
                logger.error(f"Failed to parse cleaned JSON block. Extracted text:\n{extracted}\nError: {exc}")
                raise exc
    else:
        logger.error(f"No JSON structure found in raw output. Raw text:\n{text}")
        raise ValueError("No JSON object could be extracted from response")


def save_usage_log(
    provider: str,
    model: str,
    workflow_step: str,
    input_tokens: Optional[int],
    output_tokens: Optional[int],
    total_tokens: Optional[int],
    duration_ms: int,
    success: bool,
    error_message: Optional[str]
) -> None:
    try:
        from app.database import SessionLocal, LLMUsageLog
        with SessionLocal() as session:
            log_entry = LLMUsageLog(
                provider=provider,
                model=model,
                workflow_step=workflow_step,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=total_tokens,
                duration_ms=duration_ms,
                success=success,
                error_message=error_message
            )
            session.add(log_entry)
            session.commit()
    except Exception as e:
        logger.error(f"Failed to persist LLM usage log to SQLite: {e}", exc_info=True)


class BaseLLMProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @property
    @abstractmethod
    def model(self) -> str:
        pass

    @property
    @abstractmethod
    def is_demo(self) -> bool:
        pass

    @abstractmethod
    async def generate_json(self, system_prompt: str, user_prompt: str, step_name: str = "generic", images: Optional[list[dict]] = None) -> dict[str, Any]:
        pass



class LangChainProvider(BaseLLMProvider):
    def __init__(self, chat_model: BaseChatModel, provider_name: str, model_name: str) -> None:
        self._chat_model = chat_model
        self._name = provider_name
        self._model = model_name

    @property
    def name(self) -> str:
        return self._name

    @property
    def model(self) -> str:
        return self._model

    @property
    def is_demo(self) -> bool:
        return False

    async def generate_json(self, system_prompt: str, user_prompt: str, step_name: str = "generic", images: Optional[list[dict]] = None) -> dict[str, Any]:
        start_time = time.time()
        success = False
        error_msg = None
        parse_err_msg = None
        prompt_tokens = None
        completion_tokens = None
        total_tokens = None
        payload = {}

        max_retries = 3
        base_delay = 2.0

        try:
            for attempt in range(max_retries):
                try:
                    from langchain_core.messages import SystemMessage, HumanMessage

                    if images:
                        # Construct messages manually with multimodal inputs
                        content = [{"type": "text", "text": user_prompt}]
                        for img in images:
                            content.append({
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{img['mime_type']};base64,{img['data']}"
                                }
                            })
                        formatted_messages = [
                            SystemMessage(content=system_prompt),
                            HumanMessage(content=content)
                        ]
                    else:
                        chat_template = ChatPromptTemplate.from_messages([
                            ("system", "{system_instruction}"),
                            ("user", "{user_instruction}")
                        ])
                        formatted_messages = chat_template.format_messages(
                            system_instruction=system_prompt,
                            user_instruction=user_prompt
                        )
                    
                    response = await self._chat_model.ainvoke(formatted_messages)
                    
                    # Extract token details if available
                    if hasattr(response, "usage_metadata") and response.usage_metadata:
                        prompt_tokens = response.usage_metadata.get("input_tokens")
                        completion_tokens = response.usage_metadata.get("output_tokens")
                        total_tokens = response.usage_metadata.get("total_tokens")
                    elif "token_usage" in response.response_metadata:
                        usage = response.response_metadata["token_usage"]
                        if isinstance(usage, dict):
                            prompt_tokens = usage.get("prompt_tokens")
                            completion_tokens = usage.get("completion_tokens")
                            total_tokens = usage.get("total_tokens")

                    # Parse JSON
                    raw_text = response.content
                    if not isinstance(raw_text, str):
                        raw_text = str(raw_text)

                    payload = clean_and_parse_json(raw_text)
                    success = True
                    error_msg = None
                    parse_err_msg = None
                    break

                except json.JSONDecodeError as parse_exc:
                    parse_err_msg = str(parse_exc)
                    logger.warning(f"JSON parsing error for step {step_name} (Attempt {attempt + 1}/{max_retries}): {parse_err_msg}")
                    if attempt == max_retries - 1:
                        logger.error(f"Failed to parse JSON after {max_retries} attempts.")
                        raise parse_exc
                except ValueError as val_exc:
                    parse_err_msg = str(val_exc)
                    logger.warning(f"JSON extraction error for step {step_name} (Attempt {attempt + 1}/{max_retries}): {parse_err_msg}")
                    if attempt == max_retries - 1:
                        logger.error(f"Failed to extract JSON after {max_retries} attempts.")
                        raise val_exc
                except Exception as exc:
                    error_msg = str(exc)
                    logger.warning(f"LLM generate_json failed for step {step_name} (Attempt {attempt + 1}/{max_retries}): {error_msg}")
                    if attempt == max_retries - 1:
                        logger.error(f"LLM request failed after {max_retries} attempts.")
                        raise exc
                
                # Wait before retrying
                await asyncio.sleep(base_delay * (2 ** attempt))
        finally:
            duration = time.time() - start_time
            # Construct and log metrics
            call_details = LLMCallDetails(
                provider=self.name,
                model=self.model,
                step_name=step_name,
                duration_seconds=duration,
                success=success,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                error_message=error_msg,
                parsing_error=parse_err_msg
            )
            
            log_metrics = (
                f"[LLM Observability] Provider: {call_details.provider} | Model: {call_details.model} | "
                f"Step: {call_details.step_name} | Duration: {call_details.duration_seconds:.3f}s | "
                f"Success: {call_details.success} | Tokens: (P: {call_details.prompt_tokens}, "
                f"C: {call_details.completion_tokens}, T: {call_details.total_tokens}) | "
                f"Error: {call_details.error_message} | ParseError: {call_details.parsing_error}"
            )
            if success:
                logger.info(log_metrics)
            else:
                logger.error(log_metrics)
                
            # Persist to SQLite usage log table
            duration_ms = int(duration * 1000)
            try:
                await asyncio.to_thread(
                    save_usage_log,
                    provider=self.name,
                    model=self.model,
                    workflow_step=step_name,
                    input_tokens=prompt_tokens,
                    output_tokens=completion_tokens,
                    total_tokens=total_tokens,
                    duration_ms=duration_ms,
                    success=success,
                    error_message=error_msg or parse_err_msg
                )
            except Exception as db_exc:
                logger.error(f"Error invoking save_usage_log: {db_exc}")
        
        return payload


class DemoProvider(BaseLLMProvider):
    @property
    def name(self) -> str:
        return "demo"

    @property
    def model(self) -> str:
        return "local-demo"

    @property
    def is_demo(self) -> bool:
        return True

    async def generate_json(self, system_prompt: str, user_prompt: str, step_name: str = "generic", images: Optional[list[dict]] = None) -> dict[str, Any]:
        start_time = time.time()
        # Return mock JSON matching various workflows
        if "concise business summary" in system_prompt.lower() or "concise business summary" in user_prompt.lower():
            payload = {
                "Business Focus": "Demo Business Focus",
                "Primary Challenges": ["Demo Challenge 1"],
                "Recommended KPI Areas": ["Finance"],
                "Executive Summary": "Demo summary."
            }
        elif "summary_text" in system_prompt.lower() or "summary_text" in user_prompt.lower():
            payload = {
                "summary_text": "This is a demo/mock executive summary generated in demo mode."
            }
        elif step_name in ("generate_prompt", "refine_prompt"):
            mock_prompt_text = (
                "**Objective / Purpose**\n"
                "The core intent of this KPI engagement is to optimize asset productivity and operational excellence.\n\n"
                "**Business Context**\n"
                "Operating context: Automotive manufacturing sector under high downtime and supply chain pressure.\n\n"
                "**KPI Definitions & KPI Themes**\n"
                "Recommended KPIs will focus on manufacturing line capacity utilization, OEE, and scrap rates.\n\n"
                "**Calculation Logic & Measurement Principles**\n"
                "OEE is calculated as Availability * Performance * Quality.\n\n"
                "**Assumptions & Governance Requirements**\n"
                "Assumes real-time data is loaded from SAP PM/PP modules.\n\n"
                "**Expected Output Format & KPI Generation Instructions**\n"
                "Output exactly 7 KPIs matching standard curated catalog names in the specified JSON schema format."
            )
            payload = {
                "prompt": mock_prompt_text
            }
        else:
            payload = {"summary": "Demo provider generated structured content.", "prompt": user_prompt[:500]}

        duration = time.time() - start_time
        duration_ms = int(duration * 1000)
        
        try:
            await asyncio.to_thread(
                save_usage_log,
                provider=self.name,
                model=self.model,
                workflow_step=step_name,
                input_tokens=0,
                output_tokens=0,
                total_tokens=0,
                duration_ms=duration_ms,
                success=True,
                error_message=None
            )
        except Exception as db_exc:
            logger.error(f"Error invoking save_usage_log in DemoProvider: {db_exc}")

        return payload
