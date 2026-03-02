import json
import re
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ResolveRequest(BaseModel):
    url: str


class ResolveResponse(BaseModel):
    success: bool
    audio_url: str | None = None
    source: str | None = None
    message: str | None = None


class ProcessRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    url: str
    openai_api_key: str = Field(alias="openaiApiKey", min_length=1)
    conversation_id: str | None = Field(default=None, alias="conversationId")


class ProcessResponse(BaseModel):
    success: bool
    task_id: str
    status: str
    message: str


class TaskStatusResponse(BaseModel):
    success: bool
    task_id: str
    conversation_id: str | None = None
    status: str
    message: str
    audio_url: str | None = None
    transcript: str | None = None
    title: str | None = None
    summary: str | None = None
    takeaways: list[str] | None = None
    error: str | None = None


class SaveBrainRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    task_id: str = Field(alias="taskId", min_length=1)
    takeaways: list[str]
    openai_api_key: str = Field(alias="openaiApiKey", min_length=1)


class SaveBrainResponse(BaseModel):
    success: bool
    task_id: str
    saved_count: int
    item_ids: list[str] | None = None
    message: str


class ChatRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    question: str = Field(min_length=1)
    task_id: str | None = Field(default=None, alias="taskId")
    conversation_id: str | None = Field(default=None, alias="conversationId")
    top_k: int = Field(default=4, alias="topK", ge=1, le=8)
    openai_api_key: str = Field(alias="openaiApiKey", min_length=1)


class ChatResponse(BaseModel):
    success: bool
    answer: str
    contexts: list[str]
    context_count: int


class ConversationCreateRequest(BaseModel):
    title: str | None = None


class ConversationSummary(BaseModel):
    id: str
    title: str
    message_count: int
    podcast_count: int
    created_at: str
    updated_at: str


class ConversationMessage(BaseModel):
    id: str
    role: str
    content: str
    created_at: str


class ConversationCreateResponse(BaseModel):
    success: bool
    conversation: ConversationSummary


class ConversationListResponse(BaseModel):
    success: bool
    conversations: list[ConversationSummary]


class ConversationDetailResponse(BaseModel):
    success: bool
    conversation: ConversationSummary
    messages: list[ConversationMessage]


class ConversationMessageCreateRequest(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1)


class ConversationMessageCreateResponse(BaseModel):
    success: bool
    conversation: ConversationSummary
    message: ConversationMessage


class BrainItemResponse(BaseModel):
    id: str
    task_id: str
    podcast_title: str
    podcast_url: str
    text: str
    enabled: bool
    created_at: str
    updated_at: str


class BrainItemsResponse(BaseModel):
    success: bool
    items: list[BrainItemResponse]


class BrainItemUpdateRequest(BaseModel):
    enabled: bool


class BrainItemUpdateResponse(BaseModel):
    success: bool
    item: BrainItemResponse


XIAOYUZHOU_HOST_KEYWORDS = ("xiaoyuzhou", "xyzcdn", "xiaoyuzhoufm")
DB_PATH = Path("./podbrain.db")
AUDIO_DIR = Path("./tmp_audio")
CHROMA_DIR = Path("./chroma_db")
CHROMA_COLLECTION = "podbrain_takeaways"

STATUS_QUEUED = "queued"
STATUS_DOWNLOADING = "downloading"
STATUS_TRANSCRIBING = "transcribing"
STATUS_EXTRACTING = "extracting"
STATUS_COMPLETED = "completed"
STATUS_FAILED = "failed"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_db_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def has_column(conn: sqlite3.Connection, table_name: str, column_name: str) -> bool:
    rows = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    return any(row["name"] == column_name for row in rows)


def ensure_column(conn: sqlite3.Connection, table_name: str, column_ddl: str, column_name: str) -> None:
    if not has_column(conn, table_name, column_name):
        conn.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_ddl}")


def init_db() -> None:
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    with get_db_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                input_url TEXT NOT NULL,
                audio_url TEXT,
                source TEXT,
                conversation_id TEXT,
                status TEXT NOT NULL,
                message TEXT NOT NULL,
                title TEXT,
                transcript TEXT,
                summary TEXT,
                takeaways_json TEXT,
                error TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        ensure_column(conn, "tasks", "conversation_id TEXT", "conversation_id")

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS conversation_messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id)
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS brain_items (
                id TEXT PRIMARY KEY,
                chroma_id TEXT NOT NULL,
                task_id TEXT NOT NULL,
                podcast_title TEXT NOT NULL,
                podcast_url TEXT NOT NULL,
                text TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                deleted INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def create_task(task_id: str, input_url: str, audio_url: str, source: str, conversation_id: str | None = None) -> None:
    now = utc_now_iso()
    with get_db_conn() as conn:
        conn.execute(
            """
            INSERT INTO tasks (id, input_url, audio_url, source, conversation_id, status, message, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (task_id, input_url, audio_url, source, conversation_id, STATUS_QUEUED, "Queued...", now, now),
        )
        conn.commit()


def update_task(
    task_id: str,
    *,
    status: str | None = None,
    message: str | None = None,
    title: str | None = None,
    transcript: str | None = None,
    summary: str | None = None,
    takeaways: list[str] | None = None,
    error: str | None = None,
) -> None:
    fields: list[str] = []
    values: list[object] = []
    if status is not None:
        fields.append("status = ?")
        values.append(status)
    if message is not None:
        fields.append("message = ?")
        values.append(message)
    if title is not None:
        fields.append("title = ?")
        values.append(title)
    if transcript is not None:
        fields.append("transcript = ?")
        values.append(transcript)
    if summary is not None:
        fields.append("summary = ?")
        values.append(summary)
    if takeaways is not None:
        fields.append("takeaways_json = ?")
        values.append(json.dumps(takeaways, ensure_ascii=True))
    if error is not None:
        fields.append("error = ?")
        values.append(error)

    fields.append("updated_at = ?")
    values.append(utc_now_iso())

    values.append(task_id)
    with get_db_conn() as conn:
        conn.execute(f"UPDATE tasks SET {', '.join(fields)} WHERE id = ?", tuple(values))
        conn.commit()


def get_task_or_404(task_id: str) -> sqlite3.Row:
    with get_db_conn() as conn:
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Task not found")
    return row


def get_conversation_or_404(conversation_id: str) -> sqlite3.Row:
    with get_db_conn() as conn:
        row = conn.execute("SELECT * FROM conversations WHERE id = ?", (conversation_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return row


def summarize_title_text(raw: str) -> str:
    cleaned = " ".join(raw.strip().split())
    if not cleaned:
        return "New Chat"
    cap = 18 if any("\u4e00" <= c <= "\u9fff" for c in cleaned) else 36
    if len(cleaned) <= cap:
        return cleaned
    return f"{cleaned[:cap]}..."


def create_conversation(title: str | None = None) -> sqlite3.Row:
    conversation_id = str(uuid.uuid4())
    now = utc_now_iso()
    resolved_title = summarize_title_text(title or "New Chat")
    with get_db_conn() as conn:
        conn.execute(
            "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (conversation_id, resolved_title, now, now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM conversations WHERE id = ?", (conversation_id,)).fetchone()
    return row


def get_conversation_summary(conversation_id: str) -> ConversationSummary:
    with get_db_conn() as conn:
        row = conn.execute("SELECT * FROM conversations WHERE id = ?", (conversation_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Conversation not found")

        message_count = conn.execute(
            "SELECT COUNT(*) AS c FROM conversation_messages WHERE conversation_id = ?",
            (conversation_id,),
        ).fetchone()["c"]
        podcast_count = conn.execute(
            "SELECT COUNT(DISTINCT id) AS c FROM tasks WHERE conversation_id = ?",
            (conversation_id,),
        ).fetchone()["c"]

    return ConversationSummary(
        id=row["id"],
        title=row["title"],
        message_count=int(message_count),
        podcast_count=int(podcast_count),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def list_conversation_summaries() -> list[ConversationSummary]:
    with get_db_conn() as conn:
        rows = conn.execute("SELECT id FROM conversations ORDER BY updated_at DESC").fetchall()
    return [get_conversation_summary(row["id"]) for row in rows]


def list_conversation_messages(conversation_id: str) -> list[ConversationMessage]:
    with get_db_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, role, content, created_at
            FROM conversation_messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC
            """,
            (conversation_id,),
        ).fetchall()
    return [
        ConversationMessage(id=row["id"], role=row["role"], content=row["content"], created_at=row["created_at"])
        for row in rows
    ]


def refresh_conversation_title(conversation_id: str) -> None:
    with get_db_conn() as conn:
        first_user = conn.execute(
            """
            SELECT content
            FROM conversation_messages
            WHERE conversation_id = ? AND role = 'user'
            ORDER BY created_at ASC
            LIMIT 1
            """,
            (conversation_id,),
        ).fetchone()

        if first_user and first_user["content"]:
            new_title = summarize_title_text(first_user["content"])
            conn.execute(
                "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
                (new_title, utc_now_iso(), conversation_id),
            )
            conn.commit()


def add_conversation_message(conversation_id: str, role: str, content: str) -> ConversationMessage:
    if role not in {"user", "assistant"}:
        raise HTTPException(status_code=400, detail="Invalid role")
    content = content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message content cannot be empty")

    get_conversation_or_404(conversation_id)
    message_id = str(uuid.uuid4())
    now = utc_now_iso()
    with get_db_conn() as conn:
        conn.execute(
            """
            INSERT INTO conversation_messages (id, conversation_id, role, content, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (message_id, conversation_id, role, content, now),
        )
        conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (now, conversation_id))
        conn.commit()

    refresh_conversation_title(conversation_id)
    return ConversationMessage(id=message_id, role=role, content=content, created_at=now)


def set_conversation_title_if_default(conversation_id: str, candidate_title: str | None) -> None:
    candidate = (candidate_title or "").strip()
    if not candidate:
        return
    with get_db_conn() as conn:
        row = conn.execute("SELECT title FROM conversations WHERE id = ?", (conversation_id,)).fetchone()
        if not row:
            return
        current = (row["title"] or "").strip().lower()
        if current in {"", "new chat"}:
            conn.execute(
                "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
                (summarize_title_text(candidate), utc_now_iso(), conversation_id),
            )
            conn.commit()


def row_to_brain_item(row: sqlite3.Row) -> BrainItemResponse:
    return BrainItemResponse(
        id=row["id"],
        task_id=row["task_id"],
        podcast_title=row["podcast_title"],
        podcast_url=row["podcast_url"],
        text=row["text"],
        enabled=bool(row["enabled"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def get_brain_item_or_404(item_id: str) -> sqlite3.Row:
    with get_db_conn() as conn:
        row = conn.execute(
            "SELECT * FROM brain_items WHERE id = ? AND deleted = 0",
            (item_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Brain item not found")
    return row


def normalize_takeaways(raw_takeaways: object) -> list[str]:
    if not isinstance(raw_takeaways, list):
        return []
    normalized: list[str] = []
    for item in raw_takeaways:
        if not isinstance(item, str):
            continue
        cleaned = item.strip()
        if cleaned:
            normalized.append(cleaned)
    return normalized[:20]


def normalize_api_key(raw_api_key: str) -> str:
    return raw_api_key.strip()


def get_chroma_collection():
    try:
        import chromadb
    except Exception as ex:
        raise RuntimeError("ChromaDB dependency missing. Install with `pip install chromadb`.") from ex

    CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    return client.get_or_create_collection(name=CHROMA_COLLECTION)


async def create_embeddings(texts: list[str], api_key: str) -> list[list[float]]:
    if not texts:
        return []

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    body = {"model": "text-embedding-3-small", "input": texts}
    timeout = httpx.Timeout(120.0, connect=30.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post("https://api.openai.com/v1/embeddings", headers=headers, json=body)
        resp.raise_for_status()
        payload = resp.json()

    data = payload.get("data", [])
    if not isinstance(data, list) or len(data) != len(texts):
        raise RuntimeError("Embedding response size mismatch")

    sorted_items = sorted(data, key=lambda item: item.get("index", 0))
    embeddings: list[list[float]] = []
    for item in sorted_items:
        emb = item.get("embedding")
        if not isinstance(emb, list):
            raise RuntimeError("Invalid embedding payload")
        embeddings.append(emb)
    return embeddings


def save_takeaways_to_chroma(
    task_id: str,
    takeaways: list[str],
    embeddings: list[list[float]],
    brain_item_ids: list[str],
) -> list[str]:
    collection = get_chroma_collection()
    if len(brain_item_ids) != len(takeaways):
        raise RuntimeError("brain_item_ids mismatch")

    chroma_ids: list[str] = []
    metadatas: list[dict[str, Any]] = []
    now = utc_now_iso()
    for i, brain_item_id in enumerate(brain_item_ids):
        chroma_id = f"{task_id}-{i}-{uuid.uuid4()}"
        chroma_ids.append(chroma_id)
        metadatas.append(
            {
                "task_id": task_id,
                "type": "takeaway",
                "created_at": now,
                "index": i,
                "brain_item_id": brain_item_id,
            }
        )

    collection.add(ids=chroma_ids, documents=takeaways, embeddings=embeddings, metadatas=metadatas)
    return chroma_ids


def get_enabled_brain_item_ids(task_id: str | None = None) -> set[str]:
    with get_db_conn() as conn:
        if task_id:
            rows = conn.execute(
                """
                SELECT id
                FROM brain_items
                WHERE deleted = 0 AND enabled = 1 AND task_id = ?
                """,
                (task_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id
                FROM brain_items
                WHERE deleted = 0 AND enabled = 1
                """
            ).fetchall()
    return {row["id"] for row in rows}


def query_chroma_contexts(query_embedding: list[float], task_id: str | None, top_k: int) -> list[str]:
    collection = get_chroma_collection()
    if collection.count() <= 0:
        return []

    enabled_ids = get_enabled_brain_item_ids(task_id=task_id)
    if not enabled_ids:
        return []

    query_kwargs: dict[str, Any] = {"query_embeddings": [query_embedding], "n_results": max(top_k * 5, top_k)}
    if task_id:
        query_kwargs["where"] = {"task_id": task_id}

    result = collection.query(**query_kwargs)
    docs = result.get("documents", [[]])
    metadatas = result.get("metadatas", [[]])
    if not docs or not docs[0] or not metadatas or not metadatas[0]:
        return []

    normalized: list[str] = []
    for doc, meta in zip(docs[0], metadatas[0]):
        brain_item_id = (meta or {}).get("brain_item_id")
        if brain_item_id not in enabled_ids:
            continue
        if isinstance(doc, str) and doc.strip():
            normalized.append(doc.strip())
        if len(normalized) >= top_k:
            break
    return normalized


def save_brain_items(
    task_row: sqlite3.Row,
    takeaways: list[str],
    brain_item_ids: list[str],
    chroma_ids: list[str],
) -> list[str]:
    now = utc_now_iso()
    podcast_title = (task_row["title"] or "Untitled Episode").strip()
    podcast_url = (task_row["input_url"] or "").strip()
    if len(brain_item_ids) != len(chroma_ids) or len(brain_item_ids) != len(takeaways):
        raise RuntimeError("save_brain_items input length mismatch")

    with get_db_conn() as conn:
        for item_id, takeaway, chroma_id in zip(brain_item_ids, takeaways, chroma_ids):
            conn.execute(
                """
                INSERT INTO brain_items (id, chroma_id, task_id, podcast_title, podcast_url, text, enabled, deleted, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)
                """,
                (item_id, chroma_id, task_row["id"], podcast_title, podcast_url, takeaway, now, now),
            )
        conn.commit()
    return brain_item_ids


def list_brain_items(task_id: str | None = None) -> list[BrainItemResponse]:
    with get_db_conn() as conn:
        if task_id:
            rows = conn.execute(
                """
                SELECT *
                FROM brain_items
                WHERE deleted = 0 AND task_id = ?
                ORDER BY updated_at DESC
                """,
                (task_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT *
                FROM brain_items
                WHERE deleted = 0
                ORDER BY updated_at DESC
                """
            ).fetchall()
    return [row_to_brain_item(row) for row in rows]


def set_brain_item_enabled(item_id: str, enabled: bool) -> BrainItemResponse:
    row = get_brain_item_or_404(item_id)
    now = utc_now_iso()
    with get_db_conn() as conn:
        conn.execute(
            "UPDATE brain_items SET enabled = ?, updated_at = ? WHERE id = ?",
            (1 if enabled else 0, now, item_id),
        )
        conn.commit()
        updated = conn.execute("SELECT * FROM brain_items WHERE id = ?", (item_id,)).fetchone()
    return row_to_brain_item(updated)


def delete_brain_item(item_id: str) -> None:
    row = get_brain_item_or_404(item_id)
    with get_db_conn() as conn:
        conn.execute(
            "UPDATE brain_items SET deleted = 1, enabled = 0, updated_at = ? WHERE id = ?",
            (utc_now_iso(), item_id),
        )
        conn.commit()
    try:
        collection = get_chroma_collection()
        collection.delete(ids=[row["chroma_id"]])
    except Exception:
        pass


async def generate_rag_answer(question: str, contexts: list[str], api_key: str) -> str:
    if not contexts:
        return "I don't know based on your saved takeaways."

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    context_block = "\n\n".join([f"[{i + 1}] {c}" for i, c in enumerate(contexts)])
    system_prompt = (
        "You are PodBrain. Answer ONLY from provided context. "
        "If context does not contain the answer, respond: "
        "\"I don't know based on your saved takeaways.\" "
        "Do not use external knowledge."
    )
    body = {
        "model": "gpt-4o-mini",
        "temperature": 0.1,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Context:\n{context_block}\n\nQuestion:\n{question.strip()}"},
        ],
    }
    timeout = httpx.Timeout(120.0, connect=30.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=body)
        resp.raise_for_status()
        payload = resp.json()

    content = payload.get("choices", [{}])[0].get("message", {}).get("content", "")
    if not isinstance(content, str) or not content.strip():
        return "I don't know based on your saved takeaways."
    return content.strip()


async def download_audio(audio_url: str, task_id: str) -> str:
    target = AUDIO_DIR / f"{task_id}.mp3"
    timeout = httpx.Timeout(120.0, connect=30.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        async with client.stream("GET", audio_url) as resp:
            resp.raise_for_status()
            with target.open("wb") as f:
                async for chunk in resp.aiter_bytes():
                    if chunk:
                        f.write(chunk)
    return str(target)


async def transcribe_with_whisper(audio_path: str, api_key: str) -> str:
    headers = {"Authorization": f"Bearer {api_key}"}
    timeout = httpx.Timeout(600.0, connect=30.0)
    with open(audio_path, "rb") as f:
        files = {"file": (Path(audio_path).name, f, "audio/mpeg")}
        data = {"model": "whisper-1", "response_format": "verbose_json"}
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers=headers,
                data=data,
                files=files,
            )
            resp.raise_for_status()
            payload = resp.json()

    text = payload.get("text", "")
    if not isinstance(text, str) or not text.strip():
        raise RuntimeError("Whisper returned empty transcript")
    return text.strip()


async def extract_insights(transcript: str, api_key: str) -> tuple[str, str, list[str]]:
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    system_prompt = (
        "You extract concise podcast insights. Return strict JSON only. "
        'Schema: {"title": string, "summary": string, "takeaways": string[]}. '
        "Takeaways should be clear, non-redundant, and actionable."
    )
    user_prompt = f"Transcript:\n{transcript[:120000]}"
    body = {
        "model": "gpt-4o-mini",
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    timeout = httpx.Timeout(180.0, connect=30.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=body)
        resp.raise_for_status()
        payload = resp.json()

    content = payload["choices"][0]["message"]["content"]
    parsed = json.loads(content)

    title = parsed.get("title", "Untitled Episode")
    summary = parsed.get("summary", "")
    takeaways = normalize_takeaways(parsed.get("takeaways"))
    if not takeaways:
        takeaways = ["No key takeaways extracted. Please edit manually."]
    if not isinstance(title, str) or not title.strip():
        title = "Untitled Episode"
    if not isinstance(summary, str) or not summary.strip():
        summary = transcript[:500]

    return title.strip(), summary.strip(), takeaways


async def run_pipeline_task(task_id: str, audio_url: str, api_key: str) -> None:
    audio_path: str | None = None
    try:
        update_task(task_id, status=STATUS_DOWNLOADING, message="Downloading Audio...")
        audio_path = await download_audio(audio_url, task_id)

        update_task(task_id, status=STATUS_TRANSCRIBING, message="Transcribing...")
        transcript = await transcribe_with_whisper(audio_path, api_key)

        update_task(task_id, status=STATUS_EXTRACTING, message="Extracting Insights...", transcript=transcript)
        title, summary, takeaways = await extract_insights(transcript, api_key)

        update_task(
            task_id,
            status=STATUS_COMPLETED,
            message="Completed",
            title=title,
            summary=summary,
            takeaways=takeaways,
        )
        task_row = get_task_or_404(task_id)
        conversation_id = task_row["conversation_id"]
        if conversation_id:
            set_conversation_title_if_default(conversation_id, title)
            add_conversation_message(
                conversation_id,
                "assistant",
                f"Parsed podcast completed: {title}. Review takeaways in your global RAG Builder.",
            )
    except Exception as ex:
        update_task(task_id, status=STATUS_FAILED, message="Failed", error=str(ex))
    finally:
        if audio_path:
            try:
                Path(audio_path).unlink(missing_ok=True)
            except Exception:
                pass


@app.on_event("startup")
def on_startup() -> None:
    init_db()


# Fallback for environments where startup lifecycle hooks are not triggered.
init_db()


async def fetch_html(url: str) -> str | None:
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    }
    timeout = httpx.Timeout(10.0, connect=10.0)
    async with httpx.AsyncClient(follow_redirects=True, timeout=timeout, headers=headers) as client:
        try:
            resp = await client.get(url)
            if resp.status_code == 200:
                return resp.text
            return None
        except Exception:
            return None


def pick_first_valid(*values: str | None) -> str | None:
    for v in values:
        if v and isinstance(v, str) and v.strip():
            return v.strip()
    return None


def is_mp3_url(url: str) -> bool:
    if not url:
        return False
    u = url.lower()
    if ".mp3" in u:
        return True
    return False


def is_xiaoyuzhou_url(url: str) -> bool:
    try:
        hostname = urlparse(url).hostname or ""
    except Exception:
        return False
    hostname = hostname.lower()
    return any(keyword in hostname for keyword in XIAOYUZHOU_HOST_KEYWORDS)


def extract_from_meta(soup: BeautifulSoup) -> str | None:
    m1 = soup.find("meta", attrs={"property": "og:audio"})
    m2 = soup.find("meta", attrs={"name": "og:audio"})
    m3 = soup.find("meta", attrs={"property": "og:audio:secure_url"})
    m4 = soup.find("meta", attrs={"name": "og:audio:secure_url"})
    return pick_first_valid(
        m1["content"] if m1 and m1.has_attr("content") else None,
        m2["content"] if m2 and m2.has_attr("content") else None,
        m3["content"] if m3 and m3.has_attr("content") else None,
        m4["content"] if m4 and m4.has_attr("content") else None,
    )


def extract_from_audio_tag(soup: BeautifulSoup) -> str | None:
    audio = soup.find("audio")
    if audio and audio.has_attr("src"):
        return audio["src"]
    source = soup.find("source")
    if source and source.has_attr("src"):
        return source["src"]
    return None


def extract_from_inline_json(html: str) -> str | None:
    patterns = [
        r'"audio"\s*:\s*"(?P<u>https?://[^"]+\.mp3[^"]*)"',
        r'"src"\s*:\s*"(?P<u>https?://[^"]+\.mp3[^"]*)"',
        r'content="(?P<u>https?://[^"]+\.mp3[^"]*)"',
    ]
    for pat in patterns:
        m = re.search(pat, html, flags=re.IGNORECASE)
        if m:
            u = m.group("u")
            if u:
                return u
    return None


async def resolve_audio_url(input_url: str) -> tuple[bool, str | None, str | None, str | None]:
    if is_mp3_url(input_url):
        return True, input_url, "direct", None

    html = await fetch_html(input_url)
    if not html:
        return False, None, None, "Failed to load page. Please provide a direct .mp3 URL."

    soup = BeautifulSoup(html, "html.parser")
    meta_url = extract_from_meta(soup)
    if meta_url and is_mp3_url(meta_url):
        if is_xiaoyuzhou_url(input_url):
            return True, meta_url, "xiaoyuzhou:og:audio", None
        return True, meta_url, "meta", None

    tag_url = extract_from_audio_tag(soup)
    if tag_url and is_mp3_url(tag_url):
        return True, tag_url, "audio_tag", None

    json_url = extract_from_inline_json(html)
    if json_url and is_mp3_url(json_url):
        return True, json_url, "inline_json", None

    return False, None, None, "No audio link found. Please provide a direct .mp3 URL."


@app.post("/api/resolve-audio", response_model=ResolveResponse)
async def resolve_endpoint(payload: ResolveRequest):
    ok, audio, source, msg = await resolve_audio_url(payload.url)
    if not ok:
        raise HTTPException(status_code=400, detail=msg or "Unable to resolve audio link")
    return ResolveResponse(success=True, audio_url=audio, source=source)


@app.post("/api/conversations", response_model=ConversationCreateResponse)
async def create_conversation_endpoint(payload: ConversationCreateRequest):
    row = create_conversation(payload.title)
    summary = get_conversation_summary(row["id"])
    return ConversationCreateResponse(success=True, conversation=summary)


@app.get("/api/conversations", response_model=ConversationListResponse)
async def list_conversations_endpoint():
    return ConversationListResponse(success=True, conversations=list_conversation_summaries())


@app.get("/api/conversations/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation_endpoint(conversation_id: str):
    get_conversation_or_404(conversation_id)
    summary = get_conversation_summary(conversation_id)
    messages = list_conversation_messages(conversation_id)
    return ConversationDetailResponse(success=True, conversation=summary, messages=messages)


@app.post("/api/conversations/{conversation_id}/messages", response_model=ConversationMessageCreateResponse)
async def add_conversation_message_endpoint(conversation_id: str, payload: ConversationMessageCreateRequest):
    message = add_conversation_message(conversation_id, payload.role, payload.content)
    summary = get_conversation_summary(conversation_id)
    return ConversationMessageCreateResponse(success=True, conversation=summary, message=message)


@app.post("/api/process", response_model=ProcessResponse)
async def create_process_task(payload: ProcessRequest, background_tasks: BackgroundTasks):
    api_key = payload.openai_api_key.strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="OpenAI API key is required")

    conversation_id = payload.conversation_id.strip() if payload.conversation_id else None
    if conversation_id:
        get_conversation_or_404(conversation_id)

    ok, audio_url, source, msg = await resolve_audio_url(payload.url)
    if not ok or not audio_url:
        raise HTTPException(status_code=400, detail=msg or "Unable to resolve audio link")

    task_id = str(uuid.uuid4())
    create_task(task_id, payload.url, audio_url, source or "unknown", conversation_id=conversation_id)
    # BYOK: key is passed only to this in-memory background task and never persisted.
    background_tasks.add_task(run_pipeline_task, task_id, audio_url, api_key)
    return ProcessResponse(success=True, task_id=task_id, status=STATUS_QUEUED, message="Queued...")


@app.get("/api/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(task_id: str):
    row = get_task_or_404(task_id)
    takeaways: list[str] | None = None
    if row["takeaways_json"]:
        try:
            takeaways = normalize_takeaways(json.loads(row["takeaways_json"]))
        except Exception:
            takeaways = []

    return TaskStatusResponse(
        success=True,
        task_id=row["id"],
        conversation_id=row["conversation_id"],
        status=row["status"],
        message=row["message"],
        audio_url=row["audio_url"],
        transcript=row["transcript"],
        title=row["title"],
        summary=row["summary"],
        takeaways=takeaways,
        error=row["error"],
    )


@app.post("/api/brain/save", response_model=SaveBrainResponse)
async def save_selected_takeaways(payload: SaveBrainRequest):
    task_id = payload.task_id.strip()
    api_key = normalize_api_key(payload.openai_api_key)
    if not api_key:
        raise HTTPException(status_code=400, detail="OpenAI API key is required")

    task_row = get_task_or_404(task_id)
    if task_row["status"] != STATUS_COMPLETED:
        raise HTTPException(status_code=400, detail="Task is not completed yet")

    takeaways = normalize_takeaways(payload.takeaways)
    if not takeaways:
        raise HTTPException(status_code=400, detail="No valid takeaways selected")

    try:
        brain_item_ids = [str(uuid.uuid4()) for _ in takeaways]
        embeddings = await create_embeddings(takeaways, api_key)
        chroma_ids = save_takeaways_to_chroma(task_id, takeaways, embeddings, brain_item_ids)
        item_ids = save_brain_items(task_row, takeaways, brain_item_ids, chroma_ids)
        saved_count = len(item_ids)
    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Failed to save to vector database: {ex}") from ex

    return SaveBrainResponse(
        success=True,
        task_id=task_id,
        saved_count=saved_count,
        item_ids=item_ids,
        message=f"Saved {saved_count} takeaway(s) to your brain.",
    )


@app.get("/api/brain/items", response_model=BrainItemsResponse)
async def list_brain_items_endpoint(task_id: str | None = Query(default=None, alias="taskId")):
    resolved_task_id = task_id.strip() if task_id else None
    if resolved_task_id:
        get_task_or_404(resolved_task_id)
    return BrainItemsResponse(success=True, items=list_brain_items(task_id=resolved_task_id))


@app.patch("/api/brain/items/{item_id}", response_model=BrainItemUpdateResponse)
async def update_brain_item_endpoint(item_id: str, payload: BrainItemUpdateRequest):
    item = set_brain_item_enabled(item_id, payload.enabled)
    return BrainItemUpdateResponse(success=True, item=item)


@app.delete("/api/brain/items/{item_id}")
async def delete_brain_item_endpoint(item_id: str):
    delete_brain_item(item_id)
    return {"success": True}


@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_brain(payload: ChatRequest):
    api_key = normalize_api_key(payload.openai_api_key)
    if not api_key:
        raise HTTPException(status_code=400, detail="OpenAI API key is required")

    task_id = payload.task_id.strip() if payload.task_id else None
    if task_id:
        get_task_or_404(task_id)

    conversation_id = payload.conversation_id.strip() if payload.conversation_id else None
    if conversation_id:
        get_conversation_or_404(conversation_id)

    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")

    try:
        question_embedding = (await create_embeddings([question], api_key))[0]
        contexts = query_chroma_contexts(question_embedding, task_id, payload.top_k)
        answer = await generate_rag_answer(question, contexts, api_key)
        if conversation_id:
            add_conversation_message(conversation_id, "user", question)
            add_conversation_message(conversation_id, "assistant", answer)
    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Chat request failed: {ex}") from ex

    return ChatResponse(success=True, answer=answer, contexts=contexts, context_count=len(contexts))
