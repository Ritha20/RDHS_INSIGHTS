import json
import asyncio
import requests
import logging
import uuid
import time
from fastapi import APIRouter, HTTPException, Query, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from asgiref.sync import sync_to_async

from indicators.models import Indicator, IndicatorValue
from rdhs_viz.db_queries import build_indicator_response

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/report-builder",
    tags=["AI Agentic Report Builder"],
)

# NVIDIA Integrate API configuration keys
FLASH_KEY = "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"
PRO_KEY = "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"
MINIMAX_KEY = "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"

FLASH_MODEL = "deepseek-ai/deepseek-v4-flash"
PRO_MODEL = "deepseek-ai/deepseek-v4-pro"
MINIMAX_MODEL = "minimaxai/minimax-m3"

# Block types the canvas understands — used to validate LLM-generated layouts
VALID_BLOCK_TYPES = {
    "heading", "paragraph", "chart", "table", "callout", "insight",
    "recommendation", "executive_summary", "methodology", "references",
}
VALID_CHART_TYPES = {"bar", "map", "line", "pie", "kpi", "table"}

# Direct DB lookup helper mapping common indicator keys to database names
INDICATOR_DB_NAME_MAP = {
    "electricity": ("1.1 Electricity coverage", "Total"),
    "mobile": ("1.2 Household durable goods", "Mobile Phone"),
    "radio": ("1.2 Household durable goods", "Radio"),
    "tv": ("1.2 Household durable goods", "Television"),
    "computer": ("1.2 Household durable goods", "Computer"),
    "refrigerator": ("1.2 Household durable goods", "Refrigerator"),
    "bicycle": ("1.2 Household durable goods", "Bicycle"),
    "motorcycle": ("1.2 Household durable goods", "Motorcycle"),
    "handwashing": ("1.3 Hand washing place", "Fixed place"),
    "birth-registration": ("2.2 Birth Registration", "Total"),
    "orphanhood": ("2.3 Orphanhood", "Total"),
    "insurance": ("2.4 Health Insurance", "Women"),
    "education-secondary": ("2.1 Education (Women)", "Secondary"),
    "education-higher": ("2.1 Education (Women)", "Higher"),
    "media-exposure": ("2.5 Media Exposure", "Radio (Women)"),
    "marital-status": ("2.6 Marital Status (Women)", "Married"),
    # --- Chapters 3-10 below were audited against the live DB on 2026-07-06:
    # 31 of these entries pointed at indicator names/labels that don't exist
    # (the DB's naming/numbering had drifted from this hardcoded map), so
    # every report about fertility, family planning, maternal health, child
    # illness, malaria, HIV/AIDS, or gender empowerment was silently citing
    # "no data available" instead of real DHS figures. Entries below are
    # corrected to match the DB exactly; a few were removed outright where no
    # honest equivalent exists (see comments) rather than pointed at a
    # differently-scoped indicator that could misrepresent the real figure.
    "fertility-rate": ("3.5 Fertility (Mean Children Ever Born)", "Observed TFR (15-49)"),
    "median-age-first-birth": ("3.3 Median Age at First Birth", "Total"),
    "median-age-first-marriage": ("3.1 Median Age at First Marriage", "Total"),
    "contraception-use": ("4.1 Current Contraception", "Any Method"),
    # "unmet-need" / "demand-satisfied" removed: the DB only computes one
    # combined "4.2 Demand for FP" "Total" figure, not unmet-need vs.
    # satisfied-demand separately — these are usually very different
    # percentages in real DHS data, so guessing would misrepresent it.
    "fp-exposure": ("4.3 Exposure to Messages", "Radio"),
    "antenatal-care": ("5.1 Antenatal Care (Skilled)", "Total"),
    "delivery-place": ("5.3 Place of Delivery", "Total"),
    "delivery-assistance": ("5.4 Assistance at Delivery", "Total"),
    "postnatal-care": ("5.5 Postnatal Checkups", "Total"),
    "tetanus-protection": ("5.2 Tetanus Protection", "Total"),
    "diarrhea": ("6.1-6.3 Illness Prevalence (ARI/Fever/Diarrhea)", "Diarrhea"),
    "fever": ("6.1-6.3 Illness Prevalence (ARI/Fever/Diarrhea)", "Fever"),
    "ari": ("6.1-6.3 Illness Prevalence (ARI/Fever/Diarrhea)", "ARI"),
    # "diarrhea-treatment" removed: no treatment-seeking indicator exists in the DB.
    "anemia-children": ("6.4 Anemia (Children)", "Total"),
    "stunting": ("7.1 Child Nutrition Status", "Stunting (Height-for-Age)"),
    "wasting": ("7.1 Child Nutrition Status", "Wasting (Weight-for-Height)"),
    "underweight": ("7.1 Child Nutrition Status", "Underweight (Weight-for-Age)"),
    # "overweight-children" removed: it was silently duplicating "stunting"'s
    # label (a copy-paste bug) — no childhood-overweight metric is computed;
    # this previously made real generated reports cite stunting figures under
    # an "Overweight (Children)" chart.
    "women-bmi": ("7.2 Women's BMI", "Overweight"),
    "anemia-women": ("7.3 Women's Anemia", "Total"),
    # "itn-ownership" removed: the DB only computed ITN *use*, not ownership.
    "itn-usage-population": ("8.1 ITN Use (Total HH Pop)", "Total"),
    "itn-usage-children": ("8.2 ITN Use (Children)", "Total"),
    # "itn-usage-pregnant" removed: no pregnant-women-specific ITN metric exists.
    "malaria-prevalence": ("8.3/8.4 Malaria Prevalence", "Children 6-59m"),
    # "fever-treatment" removed: no treatment-seeking indicator exists in the DB.
    "hiv-knowledge": ("9.2 HIV Knowledge (Comprehensive)", "Total"),
    # "hiv-testing" removed: no HIV-testing-uptake indicator is computed in the DB.
    "multiple-partners": ("9.3 Multiple Partners (Men)", "Total"),
    # "condom-use" removed: no condom-use indicator exists in the DB — "9.4" is
    # a different behavior (paid sex), so substituting it would be actively wrong.
    "sti-symptoms": ("9.5 STI Prevalence (Women)", "Total"),
    "circumcision": ("9.6 Circumcision (Men)", "Total"),
    "decision-making": ("10.3 Decision Making", "Total"),
    "attitude-violence": ("10.4 Wife Beating Justified", "Total"),
}


# Per-model HTTP timeouts, tuned to observed latency (see memory: MiniMax
# ~10-30s, DeepSeek pro ~110s even for trivial prompts, flash unusable).
# MiniMax gets a tight bail-out so an abnormal hang fails fast into the
# fallback; pro gets real headroom above its normal ~110s so the fallback
# path isn't a coin-flip timeout right when the primary already failed.
MODEL_TIMEOUTS = {
    MINIMAX_MODEL: 60,
    PRO_MODEL: 150,
    FLASH_MODEL: 60,
}


# ---------------------------------------------------------------------------
# Task-based model routing. Every generation task names a model here instead of
# hardcoding one, so the routing policy is tunable in a single place. The MVP
# runs everything on MiniMax M3 (~10-30s/call) to keep the whole report under
# ~90s and every interactive action snappy; the stronger DeepSeek pro reasoning
# model stays as the automatic cross-model fallback in call_llm(). To trade
# latency for max-depth insights, set "insights" (and/or "planning") to
# PRO_MODEL — routing + per-task keys already handle it, and the SSE heartbeat
# keeps a slow pro call from tripping the client's stalled-stream watchdog.
TASK_MODELS = {
    "planning": MINIMAX_MODEL,
    "section": MINIMAX_MODEL,
    "viz": MINIMAX_MODEL,
    "insights": MINIMAX_MODEL,
    "action": MINIMAX_MODEL,
    "refine": MINIMAX_MODEL,
}

# Reusable system prompts. Splitting persona + hard rules out of the per-call
# user prompt gives the model consistent steering and keeps task prompts lean.
PLANNER_SYSTEM = (
    "You are a senior report planner at the National Institute of Statistics of Rwanda (NISR), "
    "expert in Demographic and Health Survey (DHS) data and in structuring evidence-based policy reports. "
    "You return only valid, compact JSON exactly matching the requested schema — no prose, no markdown fences."
)
WRITER_SYSTEM = (
    "You are an expert DHS policy report writer for NISR. You write in a precise, formal, authoritative "
    "official statistical-agency tone (comparable to NISR and World Bank publications). "
    "You cite only the exact figures you are given — national and provincial values, naming the highest and lowest "
    "provinces where relevant — and you NEVER invent, extrapolate, or round beyond the given precision. "
    "You write cohesive analytical prose: no markdown, no headings, no bullet lists."
)
VIZ_SYSTEM = (
    "You are a data-visualization designer for statistical reports. You pick the single most effective chart type "
    "for each indicator and return only valid JSON exactly matching the requested schema — no prose, no markdown."
)
INSIGHTS_SYSTEM = (
    "You are an executive DHS strategist advising Rwandan policymakers. You reason carefully over survey statistics "
    "to surface the most decision-relevant findings and concrete, evidence-based policy actions. Every insight and "
    "recommendation is grounded in a specific figure or disparity you were given — never invent numbers. "
    "You return only valid JSON exactly matching the requested schema."
)
REFINE_SYSTEM = (
    "You are an editor maintaining a structured DHS report. You apply the user's requested change as a minimal, "
    "precise patch to the existing blocks and return only valid JSON matching the requested patch schema. "
    "You never invent statistics and never rewrite blocks the user did not ask you to change."
)
ACTION_SYSTEM = (
    "You are an AI writing and analysis assistant embedded in a DHS report editor. You perform the requested "
    "single-block edit precisely, keep NISR's formal statistical-agency tone, never invent numbers, and return "
    "output in exactly the format requested (raw text or raw JSON, with no markdown fences)."
)


def call_nvidia_api(model: str, key: str, messages: List[Dict[str, str]], thinking: bool = False, response_json: bool = False, max_tokens: int = 4096, timeout: Optional[int] = None, system: Optional[str] = None) -> Any:
    """Helper function to execute calls to NVIDIA Integrate API.
    Keep max_tokens tight — MiniMax M3 occasionally stalls on very large
    generations, so small requests are both faster and more reliable."""
    if timeout is None:
        timeout = MODEL_TIMEOUTS.get(model, 110)
    # A system message (persona + hard rules) steers the model far better than
    # burying the persona in the user prompt; prepend it when supplied.
    if system:
        messages = [{"role": "system", "content": system}, *messages]
    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.2 if response_json else 0.7,
        "top_p": 0.95,
    }

    # NOTE: over raw REST, chat_template_kwargs must sit at the payload top level.
    # ("extra_body" is an OpenAI-SDK concept that the SDK flattens; sending it
    # literally makes NVIDIA return 400 Unsupported parameter.)
    if "deepseek-v4-flash" in model:
        payload["chat_template_kwargs"] = {
            "thinking": thinking,
            "reasoning_effort": "high" if thinking else "low"
        }
    elif "deepseek-v4-pro" in model:
        payload["chat_template_kwargs"] = {
            "thinking": thinking
        }

    try:
        # Round 2 fires several concurrent calls on the same key (one per
        # section, plus viz and insights), which can trip NVIDIA's per-key
        # rate limit even though each individual call is well within quota.
        # A 429 is transient and usually clears within a couple seconds as
        # sibling calls finish — retry the SAME model/key briefly before
        # falling through to the (much slower) cross-model fallback in
        # call_llm(), which a 429 doesn't actually need.
        max_429_retries = 2
        backoff = 1.5
        response = None
        for attempt in range(max_429_retries + 1):
            response = requests.post(url, headers=headers, json=payload, timeout=timeout)
            if response.status_code != 429 or attempt == max_429_retries:
                break
            logger.warning(f"NVIDIA API rate-limited {model} (attempt {attempt + 1}/{max_429_retries}); retrying in {backoff}s.")
            time.sleep(backoff)
            backoff *= 2

        if response.status_code != 200:
            raise HTTPException(status_code=502, detail=f"NVIDIA API request failed: {response.text}")

        res_data = response.json()
        content = res_data["choices"][0]["message"]["content"]

        if response_json:
            clean_content = content.strip()
            if clean_content.startswith("```json"):
                clean_content = clean_content.split("```json", 1)[1]
                if "```" in clean_content:
                    clean_content = clean_content.split("```", 1)[0]
            elif clean_content.startswith("```"):
                clean_content = clean_content.split("```", 1)[1]
                if "```" in clean_content:
                    clean_content = clean_content.split("```", 1)[0]
            clean_content = clean_content.strip()
            
            try:
                return json.loads(clean_content)
            except json.JSONDecodeError:
                start = clean_content.find("{")
                end = clean_content.rfind("}")
                if start != -1 and end != -1:
                    try:
                        return json.loads(clean_content[start:end+1])
                    except Exception:
                        pass
                # Try finding array if array is expected
                start_arr = clean_content.find("[")
                end_arr = clean_content.rfind("]")
                if start_arr != -1 and end_arr != -1:
                    try:
                        return json.loads(clean_content[start_arr:end_arr+1])
                    except Exception:
                        pass
                raise HTTPException(status_code=500, detail=f"LLM did not return parseable JSON. Output: {content}")
        return content
    except Exception as e:
        logger.error(f"Error calling NVIDIA API: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"API connection error: {str(e)}")


DEFAULT_KEYS = {FLASH_MODEL: FLASH_KEY, PRO_MODEL: PRO_KEY, MINIMAX_MODEL: MINIMAX_KEY}


def key_for(model: str, user_key: str) -> str:
    """Picks the auth key for a model. A user-supplied NVIDIA integrate key works
    across every hosted model; otherwise each model uses its own default key —
    important now that different tasks route to different models."""
    return user_key or DEFAULT_KEYS.get(model, MINIMAX_KEY)


def call_llm(model: str, key: str, messages: List[Dict[str, str]], thinking: bool = False, response_json: bool = False, max_tokens: int = 4096, system: Optional[str] = None) -> Any:
    """Calls the requested model, falling back to a different NVIDIA-hosted model
    if the primary fails (rate limit, timeout, or unparseable output)."""
    try:
        return call_nvidia_api(model, key, messages, thinking=thinking, response_json=response_json, max_tokens=max_tokens, system=system)
    except Exception as primary_err:
        fb_model = PRO_MODEL if model == MINIMAX_MODEL else MINIMAX_MODEL
        # A user-supplied NVIDIA integrate key works across all hosted models;
        # otherwise use the fallback model's own default key.
        fb_key = key if key not in DEFAULT_KEYS.values() else DEFAULT_KEYS[fb_model]
        logger.warning(f"Primary model {model} failed ({primary_err}); retrying with {fb_model} fallback.")
        return call_nvidia_api(fb_model, fb_key, messages, thinking=False, response_json=response_json, max_tokens=max_tokens, system=system)


async def acall_llm(model: str, key: str, messages: List[Dict[str, str]], thinking: bool = False, response_json: bool = False, max_tokens: int = 4096, system: Optional[str] = None) -> Any:
    """Async wrapper so long LLM calls don't block the event loop (keeps SSE flushing)."""
    return await asyncio.to_thread(call_llm, model, key, messages, thinking, response_json, max_tokens, system)


def validate_blocks(candidate: Any, fallback: List[Dict[str, Any]], known_indicator_ids: set) -> List[Dict[str, Any]]:
    """Ensures an LLM-produced block list is still renderable by the canvas.
    Returns the exact `fallback` object (identity-comparable) if the output is broken."""
    if not isinstance(candidate, list) or not candidate:
        return fallback

    cleaned = []
    for i, blk in enumerate(candidate):
        if not isinstance(blk, dict):
            return fallback
        if blk.get("type") not in VALID_BLOCK_TYPES:
            continue
        if not blk.get("id"):
            blk["id"] = f"block-refine-{i}"
        if blk["type"] in ("chart", "table"):
            if blk.get("indicatorId") not in known_indicator_ids:
                continue
            if blk["type"] == "chart" and blk.get("chartType") not in VALID_CHART_TYPES:
                blk["chartType"] = "bar"
        if blk["type"] in ("insight", "recommendation") and not isinstance(blk.get("points"), list):
            continue
        cleaned.append(blk)

    # Too much dropped means the model mangled the layout — keep what we had.
    if len(cleaned) < max(3, len(fallback) // 2):
        return fallback
    return cleaned


def compact_stats(db_stats: Dict[str, Any]) -> Dict[str, Any]:
    """Province-level view of the fetched statistics — keeps LLM prompts small
    (districts are only needed by the analyst agent for outlier detection)."""
    return {
        ind_id: {k: v for k, v in stats.items() if k != "districts"}
        for ind_id, stats in db_stats.items()
    }


async def fetch_indicator_data_helper(indicator_id: str, fixed_params: Dict[str, str] = None) -> Dict[str, Any]:
    """Queries statistical values from the database for the given indicator id."""
    db_mapping = INDICATOR_DB_NAME_MAP.get(indicator_id)
    if not db_mapping:
        return {}
    
    indicator_name, default_label = db_mapping
    
    # Resolve label override if provided in parameters (e.g. asset, severity, etc.)
    resolved_label = default_label
    if fixed_params:
        # Check standard parameters
        for key in ["asset", "method", "provider", "severity", "category", "treatment", "need_type", "rate_type", "decision_type"]:
            if key in fixed_params:
                val = fixed_params[key]
                # Map specific value labels
                if val == "electricity": resolved_label = "Total"
                elif val == "mobile": resolved_label = "Mobile Phone"
                elif val == "radio": resolved_label = "Radio"
                elif val == "tv": resolved_label = "Television"
                elif val == "computer": resolved_label = "Computer"
                elif val == "refrigerator": resolved_label = "Refrigerator"
                elif val == "bicycle": resolved_label = "Bicycle"
                elif val == "motorcycle": resolved_label = "Motorcycle"
                elif val == "modern": resolved_label = "Modern Methods"
                elif val == "traditional": resolved_label = "Traditional Methods"
                elif val == "any": resolved_label = "Total"
                elif val == "spacing": resolved_label = "For Spacing"
                elif val == "limiting": resolved_label = "For Limiting"
                elif val == "observed": resolved_label = "Observed TFR"
                elif val == "wanted": resolved_label = "Wanted TFR"
                elif val == "hospital": resolved_label = "Hospital"
                elif val == "health_center": resolved_label = "Health Center"
                elif val == "home": resolved_label = "Home"
                elif val == "health_facility": resolved_label = "Health Facility"
                elif val == "skilled": resolved_label = "Skilled Provider"
                elif val == "doctor": resolved_label = "Doctor"
                elif val == "nurse": resolved_label = "Nurse/Midwife"
                elif val == "ors": resolved_label = "ORS"
                elif val == "zinc": resolved_label = "Zinc"
                elif val == "ors_and_zinc": resolved_label = "ORS + Zinc"
                elif val == "underweight": resolved_label = "Thin"
                elif val == "normal": resolved_label = "Normal"
                elif val == "overweight": resolved_label = "Overweight"
                elif val == "obese": resolved_label = "Overweight"
                
    try:
        # Call build_indicator_response directly in Python
        resp = await build_indicator_response(indicator_name=indicator_name, data_label=resolved_label)
        return {
            "indicator": resp.indicator,
            "unit": resp.unit,
            "year": resp.year,
            "national": resp.national.value,
            "provinces": [{"name": p.province_name, "value": p.value} for p in resp.provinces],
            "districts": [{"name": d.district_name, "value": d.value} for d in resp.districts[:5]] # Top 5 districts as outlier examples
        }
    except Exception as e:
        logger.error(f"Error fetching DB data for {indicator_id}: {str(e)}")
        return {}


# Request Models
class ReportRequest(BaseModel):
    # New chat-driven input; legacy structured fields kept for backward compatibility.
    message: Optional[str] = ""
    objective: Optional[str] = ""
    audience: Optional[str] = ""
    focus: Optional[str] = ""
    length: Optional[str] = ""
    instructions: Optional[str] = ""
    availableIndicators: List[Dict[str, Any]]
    apiKey: Optional[str] = ""

    def brief(self) -> str:
        """A single natural-language brief for the planning agent."""
        if self.message and self.message.strip():
            return self.message.strip()
        parts = []
        if self.objective:
            parts.append(self.objective)
        if self.audience:
            parts.append(f"Audience: {self.audience}")
        if self.focus:
            parts.append(f"Focus: {self.focus}")
        if self.length:
            parts.append(f"Length: {self.length}")
        if self.instructions:
            parts.append(f"Instructions: {self.instructions}")
        return "\n".join(parts) or "Create a general DHS statistical report for Rwanda."


class RefineRequest(BaseModel):
    message: str
    currentBlocks: List[Dict[str, Any]]
    availableIndicators: List[Dict[str, Any]]
    apiKey: Optional[str] = ""


class BlockActionRequest(BaseModel):
    action: str
    block: Dict[str, Any]
    allBlocks: List[Dict[str, Any]]
    availableIndicators: List[Dict[str, Any]]
    additionalInstructions: Optional[str] = ""
    apiKey: Optional[str] = ""


def _build_header_block(outline: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": "block-header",
        "type": "heading",
        "title": outline.get("title", "DHS Report"),
        "content": outline.get("subtitle", "Rwanda Demographic and Health Survey Analysis"),
        "layoutClass": "border-b pb-4 mb-6",
    }


def _build_exec_summary_block(narratives: Dict[str, str]) -> Dict[str, Any]:
    exec_summary_text = (
        narratives.get("sec-intro")
        or narratives.get("executive_summary")
        or "This report provides an analytical evaluation of Demographic and Health Survey findings, highlighting disparities across the provinces of Rwanda."
    )
    return {
        "id": "block-exec-summary",
        "type": "executive_summary",
        "title": "Executive Summary",
        "content": exec_summary_text,
        "layoutClass": "bg-slate-50 border border-slate-200 p-5 rounded-xl my-4",
    }


def _build_section_blocks(
    section: Dict[str, Any],
    sec_inds: List[str],
    db_stats: Dict[str, Any],
    narrative_text: Optional[str],
    viz_decisions: Dict[str, str],
    charted_indicators: set,
) -> List[Dict[str, Any]]:
    """Builds the heading + narrative + chart/table blocks for one section.
    Shared by the progressive streamer and the final deterministic assembly
    so both paths always produce byte-identical block ids."""
    sec_id = section.get("id", "sec")
    blocks: List[Dict[str, Any]] = [{
        "id": f"block-sec-title-{sec_id}",
        "type": "heading",
        "title": section.get("title", "Section"),
        "content": section.get("description", ""),
        "layoutClass": "text-lg font-bold text-slate-800 mt-6 mb-2 border-b border-slate-100 pb-1",
    }]

    if narrative_text:
        blocks.append({
            "id": f"block-sec-text-{sec_id}",
            "type": "paragraph",
            "content": narrative_text,
            "layoutClass": "text-sm text-slate-600 leading-relaxed mb-4",
        })

    # Each indicator is visualized only once across the whole report.
    for ind_id in sec_inds:
        if ind_id not in db_stats or ind_id in charted_indicators:
            continue
        charted_indicators.add(ind_id)
        stats = db_stats[ind_id]

        chart_type = viz_decisions.get(ind_id, "bar")
        if chart_type not in VALID_CHART_TYPES:
            chart_type = "bar"

        if chart_type == "table":
            blocks.append({
                "id": f"block-table-{ind_id}",
                "type": "table",
                "title": f"Data Breakdown: {stats['indicator']}",
                "indicatorId": ind_id,
                "stats": stats,
                "layoutClass": "my-4",
            })
        else:
            blocks.append({
                "id": f"block-chart-{ind_id}",
                "type": "chart",
                "title": f"{stats['indicator']} ({stats['year']})",
                "indicatorId": ind_id,
                "chartType": chart_type,
                "stats": stats,
                "layoutClass": "my-6 p-4 border border-slate-100 rounded-xl shadow-sm bg-white",
            })
    return blocks


def _build_insights_block(insights_recs: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": "block-insights",
        "type": "insight",
        "title": "Key Insights & Trends",
        "points": insights_recs.get("insights") or ["Household access is unevenly distributed across provinces."],
        "layoutClass": "bg-blue-50/50 border border-blue-100 p-5 rounded-xl my-6",
    }


def _build_recommendations_block(insights_recs: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": "block-recommendations",
        "type": "recommendation",
        "title": "Evidence-Based Recommendations",
        "points": insights_recs.get("recommendations") or ["Expand infrastructure access to under-served provinces."],
        "layoutClass": "bg-emerald-50/50 border border-emerald-100 p-5 rounded-xl my-6",
    }


def _build_methodology_block() -> Dict[str, Any]:
    return {
        "id": "block-methodology",
        "type": "methodology",
        "title": "Methodology & Technical Notes",
        "content": (
            "Data is drawn from the Rwanda Demographic and Health Survey 2019-20 (RDHS-2020), conducted by the "
            "National Institute of Statistics of Rwanda (NISR). Indicator values are computed at the district level "
            "and cover Rwanda's 5 provinces and 30 districts; the provincial and national figures shown here are the "
            "unweighted means of their constituent district values. Because these are simple district averages rather "
            "than population- or sampling-weighted estimates, the figures are intended for comparative and illustrative "
            "use and may differ from the official survey-weighted estimates published in the RDHS-2020 final report."
        ),
        "layoutClass": "text-xs border-t pt-4 text-slate-500 mt-8",
    }


def _assemble_report_blocks(outline, discovered, db_stats, narratives, viz_decisions, insights_recs):
    """Deterministically rebuilds the full canvas block list from all agent outputs.
    Runs in Python (no LLM) so the final canvas is always internally consistent,
    even though individual blocks were already streamed to the client as they landed."""
    blocks = [_build_header_block(outline), _build_exec_summary_block(narratives)]

    charted_indicators: set = set()
    for section in outline.get("sections", []):
        sec_id = section.get("id", "sec")
        if sec_id == "sec-intro" or "summary" in sec_id.lower():
            continue
        sec_inds = discovered.get(sec_id, [])
        blocks.extend(_build_section_blocks(section, sec_inds, db_stats, narratives.get(sec_id), viz_decisions, charted_indicators))

    blocks.append(_build_insights_block(insights_recs))
    blocks.append(_build_recommendations_block(insights_recs))
    blocks.append(_build_methodology_block())
    return blocks


@router.post("/generate")
async def generate_report(request: ReportRequest):
    """
    Fast multi-agent report pipeline. Only two LLM rounds sit on the critical path:
      Round 1 (1 call):  Planning + Indicator Discovery combined.
      Round 2 (parallel): every section narrative, the visualization pass, and the
        insights/recommendations pass all run concurrently. Each piece is streamed
        to the client as a "block" SSE event the instant it's ready, so the canvas
        fills in live instead of staring at a spinner for the whole pipeline.
    Models are routed per task (see TASK_MODELS): MiniMax M3 (~10-30s/call) on the
    critical/interactive path, and the stronger DeepSeek pro reasoning model for the
    insights/recommendations synthesis. So a report lands in well under a couple of
    minutes and the first blocks appear within seconds. A final "completed" event
    resends the full, deterministically-assembled block list as the single source of
    truth (in case any client missed a stream event).
    """
    user_key = request.apiKey or ""
    brief = request.brief()
    indicator_choices = [
        {"id": ind["id"], "name": ind["name"], "description": ind.get("description", "")}
        for ind in request.availableIndicators
    ]

    def sse(status: str, message: str, **extra) -> str:
        return "data: " + json.dumps({"status": status, "message": message, **extra}) + "\n\n"

    async def event_generator():
        try:
            # ===== ROUND 1: Planning + Indicator Discovery (single combined call) =====
            yield sse("planning", "Planning Agent: Designing report structure and selecting indicators...")

            plan_prompt = f"""Design a professional DHS report outline for this request, and choose the indicators for each section in ONE step.

User request:
{brief}

Available indicators in our database:
{json.dumps(indicator_choices, indent=2)}

Return a JSON object:
{{
  "title": "professional report title",
  "subtitle": "descriptive subtitle",
  "sections": [
    {{
      "id": "sec-intro",
      "title": "Section title",
      "description": "1-sentence goal of the section",
      "indicators": ["indicator_id", ...]   // 0-2 relevant indicator ids from the list above
    }}
  ]
}}
Rules:
- Keep it compact: 4-6 sections. The first section id MUST be "sec-intro" (used as the executive summary).
- Only use indicator ids that appear in the list. Never assign the same indicator id to more than one section.
- Pick indicators that genuinely match the user request.
- sec-intro is prose-only and never gets a chart: every indicator central to the user's request must ALSO appear in at least one non-intro section, or it will never be visualized.
Return ONLY the raw JSON object. No markdown."""

            plan_model = TASK_MODELS["planning"]
            outline = await acall_llm(plan_model, key_for(plan_model, user_key), [{"role": "user", "content": plan_prompt}], response_json=True, max_tokens=1500, system=PLANNER_SYSTEM)
            sections = outline.get("sections", []) if isinstance(outline, dict) else []
            content_sections = [s for s in sections if s.get("id") != "sec-intro" and "summary" not in s.get("id", "").lower()]

            # Build section->indicators map + fetch all DB stats concurrently
            discovered = {}
            wanted_ids = []
            for sec in sections:
                ids = [i for i in (sec.get("indicators") or []) if isinstance(i, str)]
                discovered[sec.get("id")] = ids
                for i in ids:
                    if i not in wanted_ids:
                        wanted_ids.append(i)

            # Safety net for when the planning agent ignores the "chart it
            # somewhere outside sec-intro" rule: an indicator assigned only to
            # sec-intro would otherwise be fetched from the DB and cited in
            # prose but never actually charted anywhere. Spread orphans across
            # content sections round-robin so every fetched indicator is
            # visualized at least once.
            charted_elsewhere = {i for sid, ids in discovered.items() if sid != "sec-intro" for i in ids}
            orphan_ids = [i for i in discovered.get("sec-intro", []) if i not in charted_elsewhere]
            for n, ind_id in enumerate(orphan_ids):
                if not content_sections:
                    break
                target_id = content_sections[n % len(content_sections)].get("id")
                discovered[target_id] = discovered.get(target_id, []) + [ind_id]

            yield sse("discovery", f"Planning Agent: Built '{outline.get('title', 'report')}' with {len(sections)} sections; selected {len(wanted_ids)} indicators.")
            yield sse("block", "", block=_build_header_block(outline))
            yield sse("analysis", "Statistical Analyst Agent: Querying the DHS database for provincial values...")

            async def fetch(ind_id):
                config = next((ind for ind in request.availableIndicators if ind["id"] == ind_id), None)
                fixed_params = config.get("fixedParams") if config else None
                return ind_id, await fetch_indicator_data_helper(ind_id, fixed_params)

            db_stats = {}
            if wanted_ids:
                for ind_id, stats in await asyncio.gather(*[fetch(i) for i in wanted_ids]):
                    if stats:
                        db_stats[ind_id] = stats

            compact = compact_stats(db_stats)

            # Whole-report context injected into every section writer so the
            # sections read as one coherent document (shared theme, transitions,
            # no cross-section repetition) rather than isolated paragraphs. This
            # adds no extra LLM calls — only richer prompts.
            def _ind_name(i):
                return (compact.get(i) or {}).get("indicator") or next((c["name"] for c in indicator_choices if c["id"] == i), i)

            outline_lines = []
            for s in sections:
                sid = s.get("id")
                s_inds = discovered.get(sid, [])
                data_note = f" [data: {', '.join(_ind_name(i) for i in s_inds)}]" if s_inds else ""
                tag = " (executive summary)" if (sid == "sec-intro" or "summary" in sid.lower()) else ""
                outline_lines.append(f"  {len(outline_lines) + 1}. {s.get('title')}{tag}: {s.get('description', '')}{data_note}")
            report_context = (
                f"REPORT: \"{outline.get('title')}\" — {outline.get('subtitle', '')}\n"
                "Full section outline, in order:\n" + "\n".join(outline_lines)
            )

            section_model = TASK_MODELS["section"]
            section_key = key_for(section_model, user_key)

            # ===== ROUND 2: every writer runs concurrently =====
            # Each section paragraph is its own small, fast call. Firing them all
            # (plus viz + insights) at once means Round 2 takes as long as the
            # single slowest call, not the sum — the key latency win.
            yield sse("visualization", "Visualization & Narrative Agents: Writing every section in parallel...")

            async def write_section(sec):
                sec_id = sec.get("id", "sec")
                sec_inds = discovered.get(sec_id, [])
                sec_stats = {i: compact[i] for i in sec_inds if i in compact}
                is_summary = sec_id == "sec-intro" or "summary" in sec_id.lower()
                if is_summary:
                    # The executive summary synthesizes the WHOLE report, so give
                    # it every indicator's stats — not sec-intro's (usually empty) set.
                    stat_block = json.dumps(compact) if compact else "No indicator data was available; write a brief qualitative overview and do NOT invent numbers."
                    prompt = f"""Write the EXECUTIVE SUMMARY for this report: a single cohesive paragraph (4-6 sentences) that synthesizes the whole report — its purpose, the most striking findings, and the overall regional picture.

{report_context}

Ground it in these real statistics (cite 2-4 of the most striking exact figures — national values and the highest/lowest provinces; never invent numbers):
{stat_block}

Plain text only: no markdown, no heading, no bullet list."""
                else:
                    stat_block = json.dumps(sec_stats) if sec_stats else "No specific indicator data for this section — write a short contextual paragraph and do NOT invent numbers."
                    prompt = f"""Write ONE analysis paragraph (3-6 sentences) for the section titled "{sec.get('title')}" ({sec.get('description', '')}).

This section is one chapter of a larger report — write it so it fits that whole. Open with a brief link to the report's theme, do NOT restate what other sections cover, and where natural transition toward the following topic. Full outline for context:
{report_context}

Use ONLY these real statistics for THIS section, citing exact national and province values and naming the highest/lowest provinces where relevant. Never invent numbers:
{stat_block}

Plain text only: no markdown, no heading."""
                try:
                    text = await acall_llm(section_model, section_key, [{"role": "user", "content": prompt}], max_tokens=700, system=WRITER_SYSTEM)
                    return sec_id, text.strip()
                except Exception as se:
                    logger.warning(f"Section '{sec_id}' failed: {se}")
                    return sec_id, ""

            viz_prompt = f"""For each indicator id below, choose the single most effective chart type from: 'bar', 'map', 'line', 'pie', 'kpi', 'table'. Use 'map' for regional spread, 'bar' for province comparisons, 'kpi' for a single national figure. Vary the choices across indicators.
Indicators: {json.dumps({k: {'name': v.get('indicator'), 'national': v.get('national')} for k, v in compact.items()})}
Return ONLY a raw JSON object mapping indicator id to chart type."""

            insights_prompt = f"""Report topic: {outline.get('title')}
Real statistics (national + provincial values):
{json.dumps(compact)}

Based ONLY on these statistics, produce:
1. 3-4 key high-level insights — each must reference a real figure or a specific provincial disparity.
2. 3-4 evidence-based, actionable policy recommendations that follow from those insights.
Return ONLY a raw JSON object: {{"insights": ["..."], "recommendations": ["..."]}}"""

            async def safe_json_call(prompt: str, max_tokens: int, label: str, model: str, akey: str, system: Optional[str] = None) -> Dict[str, Any]:
                # Isolated so one failing side-call (viz/insights) can never sink
                # section narratives that already succeeded.
                try:
                    result = await acall_llm(model, akey, [{"role": "user", "content": prompt}], response_json=True, max_tokens=max_tokens, system=system)
                    return result if isinstance(result, dict) else {}
                except Exception as e:
                    logger.warning(f"{label} failed, continuing without it: {e}")
                    return {}

            viz_model = TASK_MODELS["viz"]
            insights_model = TASK_MODELS["insights"]
            viz_task = asyncio.create_task(safe_json_call(viz_prompt, 400, "Visualization agent", viz_model, key_for(viz_model, user_key), VIZ_SYSTEM))
            insights_task = asyncio.create_task(safe_json_call(insights_prompt, 1200, "Insights agent", insights_model, key_for(insights_model, user_key), INSIGHTS_SYSTEM))
            section_tasks = {asyncio.create_task(write_section(s)): s for s in sections}

            narratives: Dict[str, str] = {}
            viz_decisions: Dict[str, str] = {}
            insights_recs: Dict[str, Any] = {}
            charted_indicators: set = set()
            pending_sections: List[Dict[str, Any]] = []
            viz_ready = False
            sections_done = 0

            pending_tasks = set(section_tasks.keys()) | {viz_task, insights_task}
            while pending_tasks:
                done, pending_tasks = await asyncio.wait(pending_tasks, return_when=asyncio.FIRST_COMPLETED)
                for task in done:
                    if task is viz_task:
                        viz_decisions = task.result()
                        viz_ready = True
                        yield sse("visualization", "Visualization Specialist: Chart types selected for every indicator.")
                        for sec in pending_sections:
                            sec_id = sec.get("id")
                            sec_inds = discovered.get(sec_id, [])
                            for blk in _build_section_blocks(sec, sec_inds, db_stats, narratives.get(sec_id), viz_decisions, charted_indicators):
                                yield sse("block", "", block=blk)
                        pending_sections = []
                    elif task is insights_task:
                        insights_recs = task.result()
                        yield sse("insights", "Insight Agent: Key findings extracted.")
                        yield sse("block", "", block=_build_insights_block(insights_recs))
                        yield sse("recommendation", "Policy Advisory Agent: Recommendations drafted.")
                        yield sse("block", "", block=_build_recommendations_block(insights_recs))
                    else:
                        sec = section_tasks[task]
                        sec_id, text = task.result()
                        if text:
                            narratives[sec_id] = text
                        if sec_id == "sec-intro" or "summary" in sec_id.lower():
                            yield sse("narrative", "Narrative Agent: Executive summary drafted.")
                            yield sse("block", "", block=_build_exec_summary_block(narratives))
                        else:
                            sections_done += 1
                            yield sse("narrative", f"Narrative Agent: Drafted '{sec.get('title', sec_id)}' ({sections_done}/{len(content_sections)} sections).")
                            if viz_ready:
                                sec_inds = discovered.get(sec_id, [])
                                for blk in _build_section_blocks(sec, sec_inds, db_stats, text, viz_decisions, charted_indicators):
                                    yield sse("block", "", block=blk)
                            else:
                                pending_sections.append(sec)

            yield sse("qa", "Report Designer Agent: Assembling the publication-ready canvas...")
            yield sse("block", "", block=_build_methodology_block())

            blocks = _assemble_report_blocks(outline, discovered, db_stats, narratives, viz_decisions, insights_recs)

            yield sse("completed", "Report canvas successfully populated!", blocks=blocks)

        except Exception as e:
            logger.error(f"Streaming error: {str(e)}")
            yield sse("error", f"Error during generation: {str(e)}")

    async def with_heartbeat(agen, interval: float = 15.0):
        """Emit a `ping` event whenever the pipeline goes quiet for `interval`s.
        Round 2 can sit on a single slow model call (e.g. insights on the pro
        model, ~110s) with no blocks to stream; without a heartbeat the client's
        stalled-stream watchdog would wrongly flag a healthy-but-slow run."""
        ait = agen.__aiter__()
        pending = None
        try:
            while True:
                pending = asyncio.ensure_future(ait.__anext__())
                while True:
                    done, _ = await asyncio.wait({pending}, timeout=interval)
                    if pending in done:
                        break
                    yield sse("ping", "")
                try:
                    item = pending.result()
                except StopAsyncIteration:
                    pending = None
                    break
                yield item
        finally:
            if pending is not None and not pending.done():
                pending.cancel()

    return StreamingResponse(with_heartbeat(event_generator()), media_type="text/event-stream")


def _apply_refine_patch(patch: Any, current_blocks: List[Dict[str, Any]], known_ids: set) -> tuple:
    """Applies a small, targeted patch (updates/deletes/inserts) to the current
    block list — deterministic Python, so the LLM only ever has to describe
    *what* changed instead of re-emitting every block. On a long report,
    asking the model to echo the whole array back pushes it into large-output
    territory where it stalls or blows the timeout; a patch keeps the typical
    completion tiny regardless of report length.
    Falls back to treating `patch` as a legacy full-array replacement if the
    model ignores the patch contract, so older behavior still degrades safely.
    Returns (blocks, changed)."""
    if isinstance(patch, list):
        valid = validate_blocks(patch, current_blocks, known_ids)
        return valid, valid is not current_blocks

    if not isinstance(patch, dict):
        return current_blocks, False

    blocks = [dict(b) for b in current_blocks]
    changed = False

    updates = patch.get("updates")
    if isinstance(updates, list):
        by_id = {b.get("id"): i for i, b in enumerate(blocks)}
        for upd in updates:
            if not isinstance(upd, dict) or upd.get("id") not in by_id:
                continue
            fields = {k: v for k, v in upd.items() if k != "id"}
            if not fields:
                continue
            idx = by_id[upd["id"]]
            merged = {**blocks[idx], **fields}
            if merged.get("type") not in VALID_BLOCK_TYPES:
                continue
            if merged["type"] in ("chart", "table") and merged.get("indicatorId") not in known_ids:
                continue
            if merged["type"] == "chart" and merged.get("chartType") not in VALID_CHART_TYPES:
                merged["chartType"] = blocks[idx].get("chartType", "bar")
            blocks[idx] = merged
            changed = True

    deletes = patch.get("deletes")
    if isinstance(deletes, list):
        delete_ids = {d for d in deletes if isinstance(d, str)}
        remaining = [b for b in blocks if b.get("id") not in delete_ids]
        if remaining and len(remaining) != len(blocks):
            blocks = remaining
            changed = True

    inserts = patch.get("inserts")
    if isinstance(inserts, list):
        for ins in inserts:
            if not isinstance(ins, dict):
                continue
            blk = ins.get("block")
            if not isinstance(blk, dict) or blk.get("type") not in VALID_BLOCK_TYPES:
                continue
            if blk["type"] in ("chart", "table") and blk.get("indicatorId") not in known_ids:
                continue
            blk = dict(blk)
            if blk["type"] == "chart" and blk.get("chartType") not in VALID_CHART_TYPES:
                blk["chartType"] = "bar"
            blk["id"] = f"block-refine-{uuid.uuid4().hex[:8]}"
            by_id = {b.get("id"): i for i, b in enumerate(blocks)}
            after_id = ins.get("afterId")
            pos = by_id[after_id] + 1 if after_id in by_id else len(blocks)
            blocks.insert(pos, blk)
            changed = True

    # Never let a bad patch wipe the whole report.
    if not blocks and current_blocks:
        return current_blocks, False

    return blocks, changed


@router.post("/refine")
async def refine_report(request: RefineRequest):
    """
    Conversational follow-up: takes the user's chat instruction plus the current
    canvas blocks and returns the revised block list in a single fast call. The
    model only has to describe the change (patch), not the whole report, so
    refine stays fast even as the report grows. Patch application is
    deterministic Python — validated field-by-field so a bad response can
    never corrupt the canvas.
    """
    user_key = request.apiKey or ""
    known_ids = {i["id"] for i in request.availableIndicators}
    indicator_choices = [
        {"id": i["id"], "name": i["name"], "description": i.get("description", "")}
        for i in request.availableIndicators
    ]

    prompt = f"""Current report blocks (JSON array):
{json.dumps(request.currentBlocks, indent=2)}

Available indicators (for any new chart/table blocks):
{json.dumps(indicator_choices, indent=2)}

User instruction:
{request.message}

Apply ONLY the change(s) the user asked for. Return a small JSON PATCH object —
never the whole report — describing exactly what changed:
{{
  "updates": [{{"id": "<existing block id>", "<field>": "<new value>"}}],
  "deletes": ["<existing block id>"],
  "inserts": [{{"afterId": "<existing block id, or null for end of report>", "block": {{"id": "<new id>", "type": "...", ...}}}}]
}}
Rules:
- List ONLY blocks you are changing, deleting, or adding. Never repeat unmodified blocks.
- In "updates", include the block's "id" plus ONLY the fields that actually changed (e.g. just "content", or just "points").
- Block fields: "id", "type", "title", "content", "points", "indicatorId", "chartType", "layoutClass".
- Valid "type": {sorted(VALID_BLOCK_TYPES)}. Valid "chartType": {sorted(VALID_CHART_TYPES)}.
- Any chart/table block MUST use an "indicatorId" from the available indicators list.
- Never invent statistics in text.
- If the instruction touches many/most blocks (e.g. "translate the whole report"), include an update for each one — that's fine, just don't include blocks you left unchanged.
- If the instruction doesn't apply to anything on the canvas, return {{"updates": [], "deletes": [], "inserts": []}}.
Return ONLY the raw JSON object. No markdown."""

    try:
        refine_model = TASK_MODELS["refine"]
        revised = await acall_llm(refine_model, key_for(refine_model, user_key), [{"role": "user", "content": prompt}], response_json=True, system=REFINE_SYSTEM)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Refine failed: {e}")

    blocks, changed = _apply_refine_patch(revised, request.currentBlocks, known_ids)
    return {"blocks": blocks, "changed": changed}


def _nearest_indicator_id(block: Dict[str, Any], all_blocks: List[Dict[str, Any]]) -> Optional[str]:
    """Finds the indicator tied to this block, or the closest chart/table block around it."""
    if block.get("indicatorId"):
        return block["indicatorId"]
    ids = [b.get("id") for b in all_blocks]
    try:
        pos = ids.index(block.get("id"))
    except ValueError:
        pos = 0
    # Scan outward from the block position for the nearest chart/table
    for offset in range(1, len(all_blocks)):
        for idx in (pos - offset, pos + offset):
            if 0 <= idx < len(all_blocks) and all_blocks[idx].get("indicatorId"):
                return all_blocks[idx]["indicatorId"]
    return None


async def _stats_for(indicator_id: Optional[str], available: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not indicator_id:
        return {}
    config = next((ind for ind in available if ind.get("id") == indicator_id), None)
    fixed_params = config.get("fixedParams") if config else None
    return await fetch_indicator_data_helper(indicator_id, fixed_params)


# Safe preset layout classes the Improve Layout action may choose from
LAYOUT_PRESETS = {
    "plain": "my-4",
    "narrative": "text-sm text-slate-600 leading-relaxed mb-4",
    "card": "my-6 p-4 border border-slate-100 rounded-xl shadow-sm bg-white",
    "summary_panel": "bg-slate-50 border border-slate-200 p-5 rounded-xl my-4",
    "insight_panel": "bg-blue-50/50 border border-blue-100 p-5 rounded-xl my-6",
    "recommendation_panel": "bg-emerald-50/50 border border-emerald-100 p-5 rounded-xl my-6",
    "section_heading": "text-lg font-bold text-slate-800 mt-6 mb-2 border-b border-slate-100 pb-1",
    "footnote": "text-xs border-t pt-4 text-slate-400 mt-8",
}


@router.post("/action")
async def edit_block_action(request: BlockActionRequest):
    """
    Performs context-aware AI operations on report blocks in the editor canvas.
    Responses may include:
      - "result": text / JSON payload applied to the selected block
      - "insertBlocks": new canvas blocks to insert right after the selected block
      - "updates": partial fields to merge into the selected block
    """
    user_key = request.apiKey or ""
    action = request.action.lower()
    block = request.block
    all_blocks = request.allBlocks
    instructions = request.additionalInstructions
    # Interactive edits stay on the fast model; routed via the same policy as the
    # rest of the pipeline so model choice lives in one place.
    action_model = TASK_MODELS["action"]
    action_key = key_for(action_model, user_key)

    # Context of surrounding blocks
    surrounding_context = []
    for b in all_blocks[:5]:
        if b.get("id") != block.get("id"):
            surrounding_context.append({
                "type": b.get("type"),
                "title": b.get("title", ""),
                "content": (b.get("content") or "")[:200]
            })

    # --- Data-grounded and block-inserting actions ---
    if action == "compare":
        ind_id = _nearest_indicator_id(block, all_blocks)
        stats = await _stats_for(ind_id, request.availableIndicators)
        if not stats:
            raise HTTPException(status_code=400, detail="No indicator data found near this block to compare.")
        prompt = f"""You are a DHS statistician. Using ONLY these real statistics from the Rwanda DHS database:
{json.dumps(stats, indent=2)}

Write one professional comparison paragraph (3-5 sentences) contrasting each province against the national average ({stats.get('national')}). Name the best and worst performing provinces with their exact values. {instructions or ''}
Return plain text only."""
        text = await acall_llm(action_model, action_key, [{"role": "user", "content": prompt}], system=ACTION_SYSTEM)
        return {"insertBlocks": [{
            "id": f"block-compare-{ind_id}-{int(asyncio.get_event_loop().time() * 1000)}",
            "type": "paragraph",
            "content": text.strip(),
            "layoutClass": LAYOUT_PRESETS["narrative"],
        }]}

    if action == "add_supporting":
        used_ids = {b.get("indicatorId") for b in all_blocks if b.get("indicatorId")}
        choices = [{"id": i["id"], "name": i["name"], "description": i.get("description", "")}
                   for i in request.availableIndicators if i["id"] not in used_ids]
        prompt = f"""You are a DHS indicator discovery agent. The user is working on this report block:
{json.dumps({k: block.get(k) for k in ('type', 'title', 'content', 'indicatorId')})}
Report context: {json.dumps(surrounding_context)}

From the available indicators below, choose 1 or 2 that best SUPPORT this block statistically (related determinants or outcomes):
{json.dumps(choices, indent=2)}

Return a JSON array: [{{"id": "<indicator id>", "chartType": "bar|map|line|pie|kpi", "reason": "<short reason>"}}]
Return ONLY raw JSON."""
        picks = await acall_llm(action_model, action_key, [{"role": "user", "content": prompt}], system=ACTION_SYSTEM, response_json=True)
        if isinstance(picks, dict):
            picks = [picks]
        valid_ids = {c["id"] for c in choices}
        insert_blocks = []
        for n, pick in enumerate(picks if isinstance(picks, list) else []):
            if not isinstance(pick, dict) or pick.get("id") not in valid_ids:
                continue
            name = next((c["name"] for c in choices if c["id"] == pick["id"]), pick["id"])
            chart_type = pick.get("chartType") if pick.get("chartType") in VALID_CHART_TYPES else "bar"
            insert_blocks.append({
                "id": f"block-support-{pick['id']}-{n}",
                "type": "chart",
                "title": f"Supporting Indicator: {name}",
                "indicatorId": pick["id"],
                "chartType": chart_type,
                "layoutClass": LAYOUT_PRESETS["card"],
            })
        if not insert_blocks:
            raise HTTPException(status_code=502, detail="The AI could not find a relevant supporting indicator.")
        return {"insertBlocks": insert_blocks}

    if action == "find_related":
        choices = [{"id": i["id"], "name": i["name"], "description": i.get("description", "")}
                   for i in request.availableIndicators]
        prompt = f"""You are a DHS statistician. Given this report block:
{json.dumps({k: block.get(k) for k in ('type', 'title', 'content', 'indicatorId')})}

List the 3-4 most statistically related indicators from this catalogue and why each is related:
{json.dumps(choices, indent=2)}

Return a JSON array: [{{"name": "<indicator name>", "reason": "<one short sentence>"}}]
Return ONLY raw JSON."""
        related = await acall_llm(action_model, action_key, [{"role": "user", "content": prompt}], system=ACTION_SYSTEM, response_json=True)
        points = []
        for item in related if isinstance(related, list) else []:
            if isinstance(item, dict) and item.get("name"):
                points.append(f"{item['name']} — {item.get('reason', '')}".strip(" —"))
        if not points:
            raise HTTPException(status_code=502, detail="The AI returned no related indicators.")
        return {"insertBlocks": [{
            "id": f"block-related-{block.get('id', 'x')}",
            "type": "callout",
            "title": "Related Indicators",
            "content": "\n".join(f"• {p}" for p in points),
            "layoutClass": LAYOUT_PRESETS["summary_panel"],
        }]}

    if action == "regenerate":
        ind_id = _nearest_indicator_id(block, all_blocks)
        stats = await _stats_for(ind_id, request.availableIndicators)
        prompt = f"""You are an expert DHS policy report writer. Rewrite this report block's text from scratch.
Block: {json.dumps({k: block.get(k) for k in ('type', 'title', 'content', 'points')})}
Surrounding report context: {json.dumps(surrounding_context)}
Real statistics from the DHS database for the nearest indicator: {json.dumps(stats) if stats else 'None available — do not invent numbers.'}
User instructions: {instructions or 'None'}

Cite the actual statistics when available. Keep an official NISR/World Bank tone.
Return plain text only (for list-type blocks, return one bullet per line prefixed with '- ')."""
        text = await acall_llm(action_model, action_key, [{"role": "user", "content": prompt}], system=ACTION_SYSTEM)
        return {"result": text.strip()}

    if action == "improve_layout":
        prompt = f"""You are a publication layout designer. For this report block:
{json.dumps({k: block.get(k) for k in ('type', 'title', 'content')})}
Pick the most appropriate layout preset name from: {json.dumps(list(LAYOUT_PRESETS.keys()))}
Return a JSON object: {{"preset": "<name>"}}. Return ONLY raw JSON."""
        decision = await acall_llm(action_model, action_key, [{"role": "user", "content": prompt}], system=ACTION_SYSTEM, response_json=True)
        preset = decision.get("preset") if isinstance(decision, dict) else None
        if preset not in LAYOUT_PRESETS:
            raise HTTPException(status_code=502, detail="The AI returned an unknown layout preset.")
        return {"updates": {"layoutClass": LAYOUT_PRESETS[preset]}}

    # Prepare prompts
    if action == "explain":
        prompt = f"""Explain and analyze the statistics shown in this report block. 
Block: {json.dumps(block)}
Surrounding Report Context: {json.dumps(surrounding_context)}
User Instructions: {instructions}

Write a clear, detailed, policy-relevant explanation (3-4 sentences) that highlights what these statistics mean. Keep a professional tone. Return plain text."""
        
    elif action == "improve":
        prompt = f"""Improve the writing quality of this block's content. Make it flow better, sound more formal and academic, and maintain exact factual data.
Block: {json.dumps(block)}
User Instructions: {instructions}

Return the improved text content only. Do not include quotes or surrounding text."""

    elif action == "summarize":
        prompt = f"""Summarize the text of this block into a concise executive summary.
Block: {json.dumps(block)}
Return a short summary paragraph (1-2 sentences)."""

    elif action == "expand":
        prompt = f"""Expand the analysis in this block. Add context, implications, or theoretical background while keeping it aligned with the survey data.
Block: {json.dumps(block)}
User Instructions: {instructions}
Return the expanded paragraph. Plain text only."""

    elif action == "shorten":
        prompt = f"""Shorten this block to make it more concise and punchy. Keep the key statistics.
Block: {json.dumps(block)}
Return the shortened text. Plain text only."""

    elif action == "insight":
        prompt = f"""Identify 2-3 key insights based on this block's statistics and text.
Block: {json.dumps(block)}
Return a JSON array of insight strings. Example: ["Kigali records the highest access...", "Western Province lagging behind..."]"""

    elif action == "recommend_viz":
        prompt = f"""Look at this block: {json.dumps(block)}
Recommend the best chart type. Options: 'bar', 'map', 'line', 'pie', 'table'.
Return a JSON object: {{"chartType": "map", "reason": "why"}}"""

    elif action == "translate":
        prompt = f"""Translate the content of this block.
Block: {json.dumps(block)}
Target instructions: {instructions or 'Translate to Kinyarwanda'}
Return the translated text only."""

    elif action == "cite_source":
        prompt = f"""Generate a formal data citation for the indicators in this block.
Block: {json.dumps(block)}
Return a formal citation string (e.g. 'National Institute of Statistics of Rwanda (NISR), Demographic and Health Survey 2019-20...')."""

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported action: {action}")

    messages = [{"role": "user", "content": prompt}]

    # MiniMax M3 keeps in-editor actions fast (~10s); call_llm falls back
    # to DeepSeek v4 pro automatically if it fails.
    is_json = action in ["insight", "recommend_viz"]
    result = await acall_llm(action_model, action_key, messages, response_json=is_json, system=ACTION_SYSTEM)

    return {"result": result}
