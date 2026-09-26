# PATCH LOCAL — DeskcommCRM
#
# Este arquivo é uma cópia de `graph_service/zep_graphiti.py` de dentro da
# imagem oficial `zepai/graphiti:0.22.0`, com UMA linha adicionada em
# `get_graphiti()` (marcada abaixo com "PATCH"). É montado por cima do
# arquivo original via `volumes:` no compose — não precisa rebuildar a
# imagem. Ver docs/runbooks/graphiti.md "Patch local: embedder ignorado
# pelo upstream" para o achado completo e o procedimento de reaplicar/
# revalidar este patch ao trocar a versão da imagem.
#
# BUG UPSTREAM: `get_graphiti()` aplica `openai_base_url`/`openai_api_key`/
# `model_name` só no `llm_client` (o "cérebro de conversa"), nunca no
# `embedder` (o "cérebro de tradução pra número"). `base_url`/`api_key` do
# embedder já chegam certos por fallback automático do SDK da OpenAI lendo
# `OPENAI_BASE_URL`/`OPENAI_API_KEY` do ambiente na hora de construir o
# client — confirmado ao vivo (o erro 404 veio do endpoint do Google, não
# da OpenAI real, provando que a URL/chave já estavam certas). O que NUNCA
# é aplicado é o NOME do modelo — `OpenAIEmbedderConfig.embedding_model`
# fica travado no default `'text-embedding-3-small'` da OpenAI porque nada
# em nenhum lugar lê `settings.embedding_model_name`. Isso trava qualquer
# provider que não reconheça esse nome de modelo (Gemini, e provavelmente
# qualquer outro compatível com o formato OpenAI que não seja a OpenAI
# real). Confirmado contra o `main` branch upstream em 2026-08-21: o bug
# ainda existe na versão mais recente do código, não é algo que passou
# despercebido numa versão antiga.
#
# A correção é ler `OpenAIEmbedder.create()`/`create_batch()` em
# `graphiti_core/embedder/openai.py`: ambos leem `self.config.embedding_model`
# NA HORA da chamada (não é fixado na construção do client), então mutar
# `client.embedder.config.embedding_model` depois de criar o client — igual
# já é feito pro `model_name` do `llm_client` duas linhas acima — resolve
# sem precisar reconstruir nada.
#
# SEGUNDO BUG, MESMA FAMÍLIA (achado ao vivo em 2026-08-21, testando com
# NVIDIA NIM depois de trocar o Gemini): `openai_base_client.py` tem
# `_get_model_for_size()`, que escolhe entre DOIS modelos conforme a tarefa —
# `self.model` (tarefas normais) ou `self.small_model` (tarefas mais simples/
# baratas, ex.: alguns passos de dedup). `get_graphiti()` só configura
# `client.llm_client.model`; nunca `client.llm_client.small_model`. Sem
# override, cai no default hardcoded `DEFAULT_SMALL_MODEL = 'gpt-4.1-nano'`
# (`openai_base_client.py`), que só existe na OpenAI real — em qualquer outro
# provider vira erro 404 bem no meio do processamento de um episódio, sem
# nenhum log até a fila travar. Como a `Settings` deste app não tem um campo
# separado pra "modelo pequeno", a correção é reaproveitar o mesmo
# `model_name` configurado pros dois tamanhos — mais simples que o modelo
# principal ficar sem controle nenhum.

import logging
from typing import Annotated

from fastapi import Depends, HTTPException
from graphiti_core import Graphiti  # type: ignore
from graphiti_core.edges import EntityEdge  # type: ignore
from graphiti_core.errors import EdgeNotFoundError, GroupsEdgesNotFoundError, NodeNotFoundError
from graphiti_core.llm_client import LLMClient  # type: ignore
from graphiti_core.nodes import EntityNode, EpisodicNode  # type: ignore

from graph_service.config import ZepEnvDep
from graph_service.dto import FactResult

logger = logging.getLogger(__name__)


class ZepGraphiti(Graphiti):
    def __init__(self, uri: str, user: str, password: str, llm_client: LLMClient | None = None):
        super().__init__(uri, user, password, llm_client)

    async def save_entity_node(self, name: str, uuid: str, group_id: str, summary: str = ''):
        new_node = EntityNode(
            name=name,
            uuid=uuid,
            group_id=group_id,
            summary=summary,
        )
        await new_node.generate_name_embedding(self.embedder)
        await new_node.save(self.driver)
        return new_node

    async def get_entity_edge(self, uuid: str):
        try:
            edge = await EntityEdge.get_by_uuid(self.driver, uuid)
            return edge
        except EdgeNotFoundError as e:
            raise HTTPException(status_code=404, detail=e.message) from e

    async def delete_group(self, group_id: str):
        try:
            edges = await EntityEdge.get_by_group_ids(self.driver, [group_id])
        except GroupsEdgesNotFoundError:
            logger.warning(f'No edges found for group {group_id}')
            edges = []

        nodes = await EntityNode.get_by_group_ids(self.driver, [group_id])

        episodes = await EpisodicNode.get_by_group_ids(self.driver, [group_id])

        for edge in edges:
            await edge.delete(self.driver)

        for node in nodes:
            await node.delete(self.driver)

        for episode in episodes:
            await episode.delete(self.driver)

    async def delete_entity_edge(self, uuid: str):
        try:
            edge = await EntityEdge.get_by_uuid(self.driver, uuid)
            await edge.delete(self.driver)
        except EdgeNotFoundError as e:
            raise HTTPException(status_code=404, detail=e.message) from e

    async def delete_episodic_node(self, uuid: str):
        try:
            episode = await EpisodicNode.get_by_uuid(self.driver, uuid)
            await episode.delete(self.driver)
        except NodeNotFoundError as e:
            raise HTTPException(status_code=404, detail=e.message) from e


async def get_graphiti(settings: ZepEnvDep):
    client = ZepGraphiti(
        uri=settings.neo4j_uri,
        user=settings.neo4j_user,
        password=settings.neo4j_password,
    )
    if settings.openai_base_url is not None:
        client.llm_client.config.base_url = settings.openai_base_url
    if settings.openai_api_key is not None:
        client.llm_client.config.api_key = settings.openai_api_key
    if settings.model_name is not None:
        client.llm_client.model = settings.model_name
        # PATCH DeskcommCRM: sem isso, tarefas "small" (ModelSize.small) caem
        # no default hardcoded 'gpt-4.1-nano' — ver bloco de comentário no
        # topo do arquivo ("SEGUNDO BUG"). Reaproveita o mesmo modelo
        # configurado; a Settings deste app não expõe um "modelo pequeno"
        # separado.
        client.llm_client.small_model = settings.model_name
    # PATCH DeskcommCRM: única linha abaixo. Upstream nunca faz esta
    # atribuição — ver bloco de comentário no topo do arquivo.
    if settings.embedding_model_name is not None:
        client.embedder.config.embedding_model = settings.embedding_model_name

    try:
        yield client
    finally:
        await client.close()


async def initialize_graphiti(settings: ZepEnvDep):
    client = ZepGraphiti(
        uri=settings.neo4j_uri,
        user=settings.neo4j_user,
        password=settings.neo4j_password,
    )
    await client.build_indices_and_constraints()


def get_fact_result_from_edge(edge: EntityEdge):
    return FactResult(
        uuid=edge.uuid,
        name=edge.name,
        fact=edge.fact,
        valid_at=edge.valid_at,
        invalid_at=edge.invalid_at,
        created_at=edge.created_at,
        expired_at=edge.expired_at,
    )


ZepGraphitiDep = Annotated[ZepGraphiti, Depends(get_graphiti)]
