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
from pipecat.frames.frames import LLMRunFrame, TTSSpeakFrame
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
                "content": (
                    "Responda de forma breve em português europeu. "
                    "Ao iniciar uma nova ligação, cumprimente o utilizador primeiro."
                ),
            },
            {"role": "user", "content": "A ligação está a começar."},
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
    fallback_sent = False
    monitor_task: asyncio.Task | None = None

    async def queue_fallback(reason: str) -> None:
        nonlocal fallback_sent
        if fallback_sent:
            return
        fallback_sent = True
        logger.warning("openai_fallback_queued reason={}", reason)
        await task.queue_frame(TTSSpeakFrame("Desculpe, não posso ajudar com isso agora."))

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client) -> None:
        nonlocal monitor_task
        logger.info("pipeline_client_connected")
        await task.queue_frames([LLMRunFrame()])
        async def monitor_openai() -> None:
            while True:
                await asyncio.sleep(0.25)
                receive_task = llm._receive_task
                if receive_task is not None and receive_task.done():
                    await queue_fallback("realtime_disconnected")
                    return
        monitor_task = asyncio.create_task(monitor_openai())

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client) -> None:
        nonlocal monitor_task
        logger.info("pipeline_client_disconnected")
        # Stop the output sender before cancelling the pipeline.  Cancellation
        # is asynchronous, so already queued audio frames can otherwise still
        # reach AsteriskWebsocketOutputTransport.write_audio_frame(), which
        # logs one warning for every frame after the client has disconnected.
        transport._output._params.audio_out_enabled = False
        if monitor_task is not None:
            monitor_task.cancel()
            monitor_task = None
        await task.cancel()

    # OpenAI errors are surfaced by the Realtime receive task.  Queue the same
    # short recovery utterance used by the legacy worker; a TTS service can
    # consume TTSSpeakFrame without coupling fallback logic to the transport.
    original_error = llm._handle_evt_error

    async def handle_openai_error(event) -> None:
        logger.error("openai_realtime_error code={} message={}", event.error.code, event.error.message)
        await queue_fallback("realtime_error")
        await original_error(event)

    llm._handle_evt_error = handle_openai_error

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
