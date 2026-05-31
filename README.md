# Recipe RAG

用图 RAG 做美食攻略：对话问吃什么、查步骤、看推荐。前后端分离，Docker 直接起。

![界面](./view.png)

 [GitHub](https://github.com/luboyan6/recipe-rag)

---

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | Next.js 14 · Tailwind · Zustand |
| 后端 | FastAPI · Uvicorn · Python 3.11 |
| 依赖 | [uv](https://docs.astral.sh/uv/) |
| 数据 | Neo4j · Milvus |
| 部署 | Docker Compose · Nginx |

---

## 启动

```bash
git clone https://github.com/luboyan6/recipe-rag.git
cd recipe-rag
cp .env.example .env        # 配置 OPENAI_API_KEY 等

docker compose up -d --build
docker compose ps           # 确认服务状态
```

| 地址 | 说明 |
|---|---|
| http://localhost | 主入口 |
| http://localhost:3000 | 前端 |
| http://localhost:8000/docs | API 文档 |
| http://localhost:7474 | Neo4j（`neo4j` / `recipe-rag`） |


---

## 本地开发

**后端**

```bash
uv sync
cp .env.example .env
docker compose up -d neo4j milvus-standalone   # 仅数据库
uv run python main.py
```

**前端**

```bash
cd frontend && npm install && npm run dev
```
---

## 环境变量

```env
OPENAI_API_KEY= 
OPENAI_BASE_URL= 
OPENAI_MODEL= 

```


## API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| POST | `/api/chat/stream` | 流式对话 |
| POST | `/api/recipes/recommendations` | 美食推荐 |
| GET | `/api/recipes/{id}` | 美食详情 |

---

菜谱数据来自 [HowToCook](https://github.com/Anduin2017/HowToCook) · MIT © 2026  
