"""Isolated Asterisk-v2 Pipecat prototype.

This is the exact application used for the 2026-08-31 proof of concept. It is not
the production voice worker; hardening and failure fallback are tracked in Phase 2.
"""

import asyncio
import audioop
import os
import sys
from collections.abc import AsyncGenerator, AsyncIterator

import aiohttp
import uvicorn
from fastapi import FastAPI, WebSocket
from loguru import logger
from pipecat.frames.frames import (
    Frame,
    InputAudioRawFrame,
    LLMRunFrame,
    TTSAudioRawFrame,
    TTSSpeakFrame,
    TTSStartedFrame,
    TTSStoppedFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.services.openai.realtime.llm import OpenAIRealtimeLLMService
from pipecat.services.openai.realtime import events
from pipecat.turns.user_mute import AlwaysUserMuteStrategy
from pipecat_asterisk import AsteriskWebsocketTransport
from pipecat_asterisk.transport.flow_controller import FlowController


logger.remove()
logger.add(sys.stderr, level=os.getenv("PIPECAT_LOG_LEVEL", "INFO"))
app = FastAPI()


class EchoSuppressor(FrameProcessor):
    """Drop microphone frames while response audio can still echo back."""

    def __init__(self, grace_ms: int = 800) -> None:
        super().__init__()
        self._mute_until = 0.0
        self._grace_seconds = grace_ms / 1000

    def bot_audio_started(self) -> None:
        self._mute_until = float("inf")

    def bot_audio_finished(self) -> None:
        self._mute_until = asyncio.get_running_loop().time() + self._grace_seconds

    async def process_frame(self, frame: Frame, direction: FrameDirection) -> None:
        await super().process_frame(frame, direction)
        if isinstance(frame, InputAudioRawFrame) and asyncio.get_running_loop().time() < self._mute_until:
            logger.debug("echo_suppressor_drop_audio bytes={}", len(frame.audio))
            return
        await self.push_frame(frame, direction)


class SidecarPiperFallbackProcessor(FrameProcessor):
    """Synthesize only fallback frames through the already-running Piper sidecar."""

    def __init__(self, base_url: str) -> None:
        super().__init__()
        self.base_url = base_url.rstrip("/")

    async def synthesize(self, text: str) -> bytes:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/speak",
                data=text.encode("utf-8"),
                timeout=aiohttp.ClientTimeout(total=15),
            ) as response:
                response.raise_for_status()
                ulaw = await response.read()
        pcm8 = audioop.ulaw2lin(ulaw, 2)
        pcm16, _ = audioop.ratecv(pcm8, 2, 1, 8000, 16000, None)
        return pcm16

    async def process_frame(self, frame: Frame, direction: FrameDirection) -> None:
        # Preserve FrameProcessor lifecycle handling (especially StartFrame and
        # interruption/cancel state) before forwarding ordinary pipeline frames.
        await super().process_frame(frame, direction)
        logger.debug("fallback_processor_frame type={}", type(frame).__name__)
        if not isinstance(frame, TTSSpeakFrame):
            await self.push_frame(frame, direction)
            return
        try:
            pcm16 = await self.synthesize(frame.text)
            await self.push_frame(TTSStartedFrame(), direction)
            await self.push_frame(
                TTSAudioRawFrame(audio=pcm16, sample_rate=16000, num_channels=1), direction
            )
            await self.push_frame(TTSStoppedFrame(), direction)
            logger.info("sidecar_piper_fallback_audio bytes={}", len(pcm16))
        except Exception as exc:
            logger.error("sidecar_piper_error type={} message={}", type(exc).__name__, str(exc))
            await self.push_frame(frame, direction)


async def run_bot(websocket: WebSocket) -> None:
    transport = AsteriskWebsocketTransport(websocket=websocket)
    turn_detection = events.TurnDetection(
        threshold=0.68,
        prefix_padding_ms=300,
        silence_duration_ms=750,
    )
    llm = OpenAIRealtimeLLMService(
        api_key=os.environ["OPENAI_API_KEY"],
        model=os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime"),
        session_properties=events.SessionProperties(
            audio=events.AudioConfiguration(
                input=events.AudioInput(turn_detection=turn_detection)
            )
        ),
    )
    echo_suppressor = EchoSuppressor(grace_ms=800)

    # Keep an auditable, secret-free trace of the Realtime protocol while
    # diagnosing turn-taking.  Payload bodies/audio are intentionally omitted.
    original_ws_send = llm._ws_send

    async def traced_ws_send(message):
        logger.info("OPENAI_SEND type={}", message.get("type"))
        return await original_ws_send(message)

    llm._ws_send = traced_ws_send
    greeting_text = "Boa tarde! Em que posso te ajudar?"
    greeting_pending = True
    original_send_client_event = llm.send_client_event

    async def send_client_event_with_greeting(event):
        nonlocal greeting_pending
        if greeting_pending and isinstance(event, events.ResponseCreateEvent):
            greeting_pending = False
            event.response = events.ResponseProperties(
                output_modalities=["audio"],
                instructions=(
                    "Diga exatamente, palavra por palavra, sem adicionar nada: "
                    f"{greeting_text}"
                ),
            )
        return await original_send_client_event(event)

    llm.send_client_event = send_client_event_with_greeting
    for handler_name in (
        "_handle_evt_session_created",
        "_handle_evt_session_updated",
        "_handle_evt_audio_delta",
        "_handle_evt_audio_done",
        "_handle_evt_conversation_item_added",
        "_handle_evt_conversation_item_done",
        "_handle_evt_input_audio_transcription_delta",
        "_handle_evt_response_done",
        "_handle_evt_speech_started",
        "_handle_evt_speech_stopped",
        "_handle_evt_text_delta",
        "_handle_evt_audio_transcript_delta",
        "_handle_evt_error",
    ):
        original_handler = getattr(llm, handler_name)

        async def traced_handler(event, _handler=original_handler, _name=handler_name):
            if event.type == "response.output_audio.delta":
                echo_suppressor.bot_audio_started()
            elif event.type == "response.output_audio.done":
                echo_suppressor.bot_audio_finished()
            detail = ""
            if event.type in {
                "response.output_text.delta",
                "response.output_audio_transcript.delta",
                "conversation.item.input_audio_transcription.completed",
            }:
                detail = str(getattr(event, "delta", None) or getattr(event, "transcript", None))[:120]
            logger.info("OPENAI_RECV type={} handler={} detail={}", event.type, _name, detail)
            return await _handler(event)

        setattr(llm, handler_name, traced_handler)
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
        user_params=LLMUserAggregatorParams(
            user_mute_strategies=[AlwaysUserMuteStrategy()]
        ),
    )
    fallback_tts = SidecarPiperFallbackProcessor(
        os.getenv("PIPER_SIDECAR_URL", "http://127.0.0.1:8500")
    )
    pipeline = Pipeline(
        [
            transport.input(),
            echo_suppressor,
            user_aggregator,
            llm,
            fallback_tts,
            transport.output(),
            assistant_aggregator,
        ]
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
        # Let the ErrorFrame finish propagating before injecting the fallback
        # into the task's downstream queue; this keeps normal transport ordering.
        async def inject() -> None:
            await asyncio.sleep(0.1)
            # AsteriskWebsocketOutputTransport creates its flow controller only
            # after MEDIA_START has been consumed.  Realtime failures can arrive
            # first (for example, an invalid model error), so wait briefly for
            # that negotiated media state before emitting audio.
            deadline = asyncio.get_running_loop().time() + 3.0
            while transport._output._flow_controller is None:
                if asyncio.get_running_loop().time() >= deadline:
                    transport._output._flow_controller = FlowController(
                        20, 640, transport._output._client
                    )
                    logger.warning("sidecar_piper_fallback_output_default_media")
                    break
                await asyncio.sleep(0.05)
            fallback_frame = TTSSpeakFrame(
                text="Desculpe, não posso ajudar com isso agora."
            )
            pcm16 = await fallback_tts.synthesize(fallback_frame.text)
            await transport._output.write_audio_frame(
                TTSAudioRawFrame(
                    audio=pcm16, sample_rate=16000, num_channels=1
                )
            )
            logger.info("sidecar_piper_fallback_audio bytes={}", len(pcm16))

        asyncio.create_task(inject())

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
    async def handle_openai_error(event) -> None:
        logger.info("OPENAI_RECV type=error handler=handle_openai_error")
        logger.error("openai_realtime_error code={} message={}", event.error.code, event.error.message)
        await queue_fallback("realtime_error")

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
