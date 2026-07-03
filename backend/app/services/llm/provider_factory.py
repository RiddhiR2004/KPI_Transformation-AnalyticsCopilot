import os
import logging
from typing import Any, Dict, Optional

from app.services.llm.langchain_provider import BaseLLMProvider, LangChainProvider, DemoProvider

logger = logging.getLogger("app.services.llm.provider_factory")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s"))
    logger.addHandler(handler)

# Global cached provider instance
_cached_provider: Optional[BaseLLMProvider] = None


def create_provider() -> BaseLLMProvider:
    provider_type = os.getenv("LLM_PROVIDER", "gemini").lower()
    model_name = os.getenv("LLM_MODEL", "").strip()

    if provider_type in ("gemini", "google"):
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
        if not api_key:
            logger.warning("No Google/Gemini API key found (GEMINI_API_KEY/GOOGLE_API_KEY). Using DemoProvider.")
            return DemoProvider()
        
        if not model_name:
            # Fallback to model in GEMINI_MODEL env var or default lite model
            model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
            
        try:
            from app.services.llm.langchain_provider import GeminiSDKProvider
            logger.info(f"Initialized GeminiSDKProvider with model: {model_name}")
            return GeminiSDKProvider(model_name=model_name, api_key=api_key)
        except Exception as exc:
            logger.error(f"Failed to initialize GeminiSDKProvider: {exc}. Using DemoProvider.")
            return DemoProvider()

    elif provider_type == "openai":
        api_key = os.getenv("OPENAI_API_KEY", "")
        if not api_key:
            logger.warning("No OPENAI_API_KEY found. Using DemoProvider.")
            return DemoProvider()
            
        if not model_name:
            model_name = "gpt-4o-mini"
            
        try:
            from langchain_openai import ChatOpenAI
            chat_model = ChatOpenAI(
                model=model_name,
                api_key=api_key,
                temperature=0.2
            )
            logger.info(f"Initialized ChatOpenAI with model: {model_name}")
            return LangChainProvider(chat_model, provider_name="openai", model_name=model_name)
        except Exception as exc:
            logger.error(f"Failed to initialize ChatOpenAI: {exc}. Using DemoProvider.")
            return DemoProvider()

    elif provider_type == "openrouter":
        api_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY") or ""
        if not api_key:
            logger.warning("No API key for OpenRouter (OPENROUTER_API_KEY/OPENAI_API_KEY). Using DemoProvider.")
            return DemoProvider()
            
        if not model_name:
            model_name = "google/gemini-2.5-flash"
            
        try:
            from langchain_openai import ChatOpenAI
            default_headers = {
                "HTTP-Referer": os.getenv("OPENROUTER_SITE_URL", "http://localhost:5173"),
                "X-Title": "KPI Transformation & Analytics Copilot",
            }
            base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
            chat_model = ChatOpenAI(
                model=model_name,
                api_key=api_key,
                base_url=base_url,
                default_headers=default_headers,
                temperature=0.2
            )
            logger.info(f"Initialized OpenRouter ChatOpenAI wrapper with model: {model_name}")
            return LangChainProvider(chat_model, provider_name="openrouter", model_name=model_name)
        except Exception as exc:
            logger.error(f"Failed to initialize OpenRouter ChatOpenAI wrapper: {exc}. Using DemoProvider.")
            return DemoProvider()

    elif provider_type == "demo":
        logger.info("Using DemoProvider mode.")
        return DemoProvider()
        
    else:
        logger.warning(f"Unsupported LLM_PROVIDER '{provider_type}'. Falling back to DemoProvider.")
        return DemoProvider()


def get_llm_service(force_reload: bool = False) -> BaseLLMProvider:
    global _cached_provider
    if _cached_provider is None or force_reload:
        _cached_provider = create_provider()
    return _cached_provider


def get_llm_status() -> dict[str, Any]:
    provider = get_llm_service()
    
    if provider.name in ("google", "gemini"):
        key_name = "GEMINI_API_KEY"
        if not os.getenv("GEMINI_API_KEY"):
            key_name = "GOOGLE_API_KEY"
    elif provider.name == "openai":
        key_name = "OPENAI_API_KEY"
    elif provider.name == "openrouter":
        key_name = "OPENROUTER_API_KEY"
    else:
        key_name = ""
        
    api_key_configured = True
    if key_name:
        api_key_configured = bool(os.getenv(key_name))
        
    return {
        "provider": provider.name,
        "model": provider.model,
        "uses_real_llm": not provider.is_demo,
        "api_key_configured": api_key_configured,
        "api_key_env": key_name,
    }
