"""
Web 服务处理模块
基于 FastAPI 提供 REST 与 SSE 接口
"""

import json
import logging
import time
import concurrent.futures
from datetime import datetime
from typing import Any, Dict, Generator, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    message: str
    session_id: str = ""
    stream: bool = False


class RecommendationRequest(BaseModel):
    preferences: Dict[str, Any] = Field(default_factory=dict)


class HttpApiGateway:
    """FastAPI 路由与 RAG 业务编排"""

    def __init__(self, rag_system):
        self.rag_system = rag_system
        self.app: Optional[FastAPI] = None

    def setup_fastapi_app(self) -> FastAPI:
        self.app = FastAPI(
            title="Recipe RAG API",
            description="美食攻略 RAG 后端服务",
            version="0.1.0",
        )
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        self._register_routes()
        return self.app

    def _register_routes(self) -> None:
        @self.app.get("/health")
        @self.app.get("/api/health")
        def health_check():
            return {
                "status": "healthy",
                "timestamp": datetime.now().isoformat(),
                "service": "Recipe RAG",
            }

        @self.app.post("/api/chat")
        def chat(body: ChatRequest):
            return self._handle_chat_request(body.message, body.session_id)

        @self.app.post("/api/chat/stream")
        def chat_stream(body: ChatRequest):
            return StreamingResponse(
                self._stream_chat(body.message, body.session_id),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "Access-Control-Allow-Origin": "*",
                },
            )

        @self.app.post("/api/recipes/recommendations")
        def get_recommendations(body: RecommendationRequest):
            return self._handle_recommendations_request(body.preferences)

        @self.app.get("/api/recipes/{recipe_id}")
        def get_recipe_detail(recipe_id: str):
            return self._handle_recipe_detail_request(recipe_id)

        @self.app.get("/api/stats")
        def get_stats():
            return self._handle_stats_request()

    def _handle_chat_request(self, query: str, session_id: str) -> Dict[str, Any]:
        if not query:
            raise HTTPException(status_code=400, detail="消息不能为空")

        try:
            cached_response = None
            enhanced_query = query

            def check_cache():
                nonlocal cached_response
                cached_response = self.rag_system.cache_manager.check_semantic_cache(
                    query, session_id
                )

            def prepare_query():
                nonlocal enhanced_query
                enhanced_query = self.rag_system.cache_manager.get_context_for_query(
                    session_id, query
                )

            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                future_cache = executor.submit(check_cache)
                future_query = executor.submit(prepare_query)
                concurrent.futures.wait([future_cache], timeout=1)

                if cached_response:
                    future_query.cancel()
                    self.rag_system.cache_manager.add_to_context(
                        session_id, query, cached_response
                    )
                    return {
                        "response": cached_response,
                        "query": query,
                        "session_id": session_id,
                        "timestamp": datetime.now().isoformat(),
                        "from_cache": True,
                    }

                concurrent.futures.wait([future_query], timeout=2)

            documents, _ = self.rag_system.query_router.route_query(
                query=enhanced_query,
                top_k=self.rag_system.config.top_k,
            )
            response = self.rag_system.generation_module.generate_adaptive_answer(
                enhanced_query, documents
            )

            self.rag_system.cache_manager.add_to_semantic_cache(
                query, response, session_id
            )
            self.rag_system.cache_manager.add_to_context(session_id, query, response)

            return {
                "response": response,
                "query": query,
                "timestamp": datetime.now().isoformat(),
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error("Chat API 错误: %s", e)
            raise HTTPException(status_code=500, detail=str(e)) from e

    def _stream_chat(self, query: str, session_id: str) -> Generator[str, None, None]:
        if not query:
            yield self._sse({"error": "消息不能为空"})
            yield "data: [DONE]\n\n"
            return

        try:
            cached_response = None
            enhanced_query = query

            def check_cache():
                nonlocal cached_response
                cached_response = self.rag_system.cache_manager.check_semantic_cache(
                    query, session_id
                )

            def prepare_query():
                nonlocal enhanced_query
                enhanced_query = self.rag_system.cache_manager.get_context_for_query(
                    session_id, query
                )

            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                future_cache = executor.submit(check_cache)
                future_query = executor.submit(prepare_query)
                concurrent.futures.wait([future_cache], timeout=1)

                if cached_response:
                    future_query.cancel()
                    self.rag_system.cache_manager.add_to_context(
                        session_id, query, cached_response
                    )
                    chunk_size = 3
                    for i in range(0, len(cached_response), chunk_size):
                        chunk = cached_response[i : i + chunk_size]
                        yield self._sse({"chunk": chunk, "from_cache": True})
                        time.sleep(0.02)
                    yield "data: [DONE]\n\n"
                    return

                concurrent.futures.wait([future_query], timeout=2)

            documents, _ = self.rag_system.query_router.route_query(
                query=enhanced_query,
                top_k=self.rag_system.config.top_k,
            )

            full_response = ""
            for chunk in self.rag_system.generation_module.generate_adaptive_answer_stream(
                enhanced_query, documents
            ):
                full_response += chunk
                yield self._sse({"chunk": chunk})

            self.rag_system.cache_manager.add_to_semantic_cache(
                query, full_response, session_id
            )
            self.rag_system.cache_manager.add_to_context(
                session_id, query, full_response
            )
            yield "data: [DONE]\n\n"

        except Exception as e:
            logger.error("Stream API 错误: %s", e)
            error_msg = f"抱歉，处理您的问题时出现错误：{str(e)}"
            yield self._sse({"chunk": error_msg})
            yield "data: [DONE]\n\n"

    @staticmethod
    def _sse(payload: Dict[str, Any]) -> str:
        return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

    def _handle_recommendations_request(
        self, preferences: Dict[str, Any]
    ) -> Dict[str, Any]:
        try:
            _ = preferences
            recipes = self.rag_system.dish_service.get_random_recipes_with_images(
                limit=3
            )
            return {"success": True, "data": recipes, "message": "推荐获取成功"}
        except Exception as e:
            logger.error("推荐 API 错误: %s", e)
            raise HTTPException(status_code=500, detail=str(e)) from e

    def _handle_recipe_detail_request(self, recipe_id: str) -> Dict[str, Any]:
        try:
            recipe = self.rag_system.dish_service.get_recipe_by_id(recipe_id)
            if recipe:
                return {"success": True, "data": recipe}
            raise HTTPException(status_code=404, detail="菜谱不存在")
        except HTTPException:
            raise
        except Exception as e:
            logger.error("菜谱详情 API 错误: %s", e)
            raise HTTPException(status_code=500, detail=str(e)) from e

    def _handle_stats_request(self) -> Dict[str, Any]:
        try:
            return {
                "cache_stats": self.rag_system.cache_manager.get_session_stats(),
                "route_stats": self.rag_system.query_router.get_route_statistics(),
                "system_info": {
                    "timestamp": datetime.now().isoformat(),
                    "status": "running",
                },
            }
        except Exception as e:
            logger.error("统计 API 错误: %s", e)
            raise HTTPException(status_code=500, detail=str(e)) from e
