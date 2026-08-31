"""Isolated Asterisk-v2 Pipecat prototype.

This is the exact application used for the 2026-08-31 proof of concept. It is not
the production voice worker; hardening and failure fallback are tracked in Phase 2.
"""

import asyncio
import os
import sys

import uvicorn
from fastapi import FastAPI, WebSocket
from loguru import logger
from pipecat.frames.frames import LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.services.openai.realtime.llm import OpenAIRealtimeLLMService
from pipecat_asterisk import AsteriskWebsocketTransport


logger.remove()
logger.add(sys.stderr, level=os.getenv("PIPECAT_LOG_LEVEL", "INFO"))
app = FastAPI()


async def run_bot(websocket: WebSocket) -> None:
    transport = AsteriskWebsocketTransport(websocket=websocket)
    llm = OpenAIRealtimeLLMService(
        api_key=os.environ["OPENAI_API_KEY"],
        model=os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime"),
    )
    context = LLMContext(
        [
            {
                "role": "system",
                "content": "Responda de forma breve em português europeu.",
            },
            {"role": "user", "content": "Diga apenas: teste concluído."},
        ]
    )
    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(),
    )
    pipeline = Pipeline(
        [transport.input(), user_aggregator, llm, transport.output(), assistant_aggregator]
    )
    task = PipelineTask(
        pipeline,
        params=PipelineParams(audio_in_sample_rate=16000, audio_out_sample_rate=16000),
    )

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client) -> None:
        logger.info("pipeline_client_connected")
        await task.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client) -> None:
        logger.info("pipeline_client_disconnected")
        await task.cancel()

    await PipelineRunner().run(task)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    logger.info("pipeline_ws_accepted")
    try:
        await run_bot(websocket)
    except Exception as exc:
        logger.error("pipeline_error type={} message={}", type(exc).__name__, str(exc))


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=7860, log_level="warning")
