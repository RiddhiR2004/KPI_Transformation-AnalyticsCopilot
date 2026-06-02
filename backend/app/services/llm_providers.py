from __future__ import annotations

import json
import os
from abc import ABC, abstractmethod
from typing import Any

import httpx

from app.models import BusinessContext, KPI, KPIStatus


class LLMProvider(ABC):
    name = "base"
    model = ""

    @abstractmethod
    async def generate_json(self, system: str, prompt: str) -> dict[str, Any]:
        raise NotImplementedError


class OpenRouterProvider(LLMProvider):
    name = "openrouter"

    def __init__(self) -> None:
        self.api_key = os.getenv("OPENROUTER_API_KEY", "")
        self.model = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
        self.base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

    async def generate_json(self, system: str, prompt: str) -> dict[str, Any]:
        if not self.api_key:
            raise RuntimeError("OPENROUTER_API_KEY is not configured.")
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": os.getenv("OPENROUTER_SITE_URL", "http://localhost:5173"),
                    "X-Title": "KPI Transformation & Analytics Copilot",
                },
                json={
                    "model": self.model,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt},
                    ],
                },
            )
            response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        return json.loads(content)


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self) -> None:
        self.api_key = os.getenv("GEMINI_API_KEY", "")
        self.model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    async def generate_json(self, system: str, prompt: str) -> dict[str, Any]:
        if not self.api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured.")
        
        models_to_try = [self.model]
        fallbacks = ["gemini-2.5-flash-lite", "gemini-flash-latest", "gemini-2.0-flash-lite"]
        for f in fallbacks:
            if f not in models_to_try:
                models_to_try.append(f)
                
        last_exception = None
        for attempt_model in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{attempt_model}:generateContent"
            try:
                async with httpx.AsyncClient(timeout=60) as client:
                    response = await client.post(
                        url,
                        params={"key": self.api_key},
                        json={
                            "systemInstruction": {"parts": [{"text": system}]},
                            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                            "generationConfig": {
                                "responseMimeType": "application/json",
                                "temperature": 0.2,
                            },
                        },
                    )
                    response.raise_for_status()
                text = response.json()["candidates"][0]["content"]["parts"][0]["text"]
                return json.loads(text)
            except Exception as exc:
                last_exception = exc
                # Print fallback details to stdout/stderr
                print(f"GeminiProvider: Model '{attempt_model}' call failed: {exc}. Trying next model...")
                
        if last_exception:
            raise last_exception


class DemoProvider(LLMProvider):
    name = "demo"
    model = "local-demo"

    async def generate_json(self, system: str, prompt: str) -> dict[str, Any]:
        return {"summary": "Demo provider generated structured content.", "prompt": prompt[:500]}


def get_provider() -> LLMProvider:
    provider = os.getenv("LLM_PROVIDER", "gemini").lower()
    if provider == "demo":
        return DemoProvider()
    if provider == "openrouter":
        return OpenRouterProvider()
    if provider == "gemini":
        return GeminiProvider()
    raise RuntimeError(f"Unsupported LLM_PROVIDER: {provider}")


def llm_status() -> dict[str, Any]:
    provider = get_provider()
    key_name = "GEMINI_API_KEY" if provider.name == "gemini" else "OPENROUTER_API_KEY"
    if provider.name == "demo":
        key_name = ""
    return {
        "provider": provider.name,
        "model": provider.model,
        "uses_real_llm": provider.name != "demo",
        "api_key_configured": True if provider.name == "demo" else bool(os.getenv(key_name)),
        "api_key_env": key_name,
    }


def demo_kpis(context: BusinessContext) -> list[KPI]:
    from app.services.kpi_engine import load_catalog, calculate_recommendation_score
    catalog = load_catalog()
    
    # Calculate scores and sort
    items_with_score = []
    for item in catalog:
        score = calculate_recommendation_score(item, context)
        items_with_score.append((score, item))
        
    # Sort descending by score
    items_with_score.sort(key=lambda x: x[0], reverse=True)
    
    # Filter by selected functional areas
    filtered = []
    selected_areas = {a.lower() for a in context.functional_areas} if context.functional_areas else set()
    
    if selected_areas:
        for score, item in items_with_score:
            if item["functional_area"].lower() in selected_areas:
                filtered.append((score, item))
        
        # Fill remaining slots with other areas if count is less
        if len(filtered) < context.kpi_count:
            for score, item in items_with_score:
                if item["functional_area"].lower() not in selected_areas:
                    filtered.append((score, item))
    else:
        filtered = items_with_score

    # Slice to kpi_count and convert to KPI models
    kpis = []
    for idx, (score, item) in enumerate(filtered[:context.kpi_count]):
        kpis.append(
            KPI(
                id=f"kpi-{idx + 1}",
                kpi_name=item["kpi_name"],
                functional_area=item["functional_area"],
                kra=item["kra"],
                kpi_category=item["kpi_category"],
                business_definition=item["business_definition"],
                kpi_description=item["kpi_description"],
                formula=item["formula"],
                numerator=item["numerator"],
                denominator=item["denominator"],
                source_system=item["source_system"],
                sap_module=item["sap_module"],
                business_owner=item["business_owner"],
                data_owner=item["data_owner"],
                refresh_cadence=item["refresh_cadence"],
                recommended_target_range=item["recommended_target_range"],
                recommended_threshold_range=item["recommended_threshold_range"],
                strategic_focus_area=item["strategic_focus_area"],
                standard_driver=item["standard_driver"],
                sector_driver=item["sector_driver"],
                value_drivers=item["value_drivers"],
                industry_tags=item["industry_tags"],
                recommendation_score=score,
                status=KPIStatus.recommended,
                notes=item["notes"] or ""
            )
        )
    return kpis
