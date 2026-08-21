"""
DreamPilot Backend - Main Application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from contextlib import asynccontextmanager

from core.config import settings
from core.database import init_db
from routes import (
    health_router, auth_router, credentials_router, videos_router, media_router,
)


def _sync_schema():
    """Lightweight startup migration: ensure columns expected by the models exist."""
    from sqlalchemy import inspect, text
    from core.database import engine, Base
    insp = inspect(engine)
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if not insp.has_table(table.name):
                continue  # created by create_all
            existing = {c["name"] for c in insp.get_columns(table.name)}
            for col in table.columns:
                if col.name in existing:
                    continue
                coltype = col.type.compile(engine.dialect)
                conn.execute(text(f'ALTER TABLE {table.name} ADD COLUMN "{col.name}" {coltype}'))
                print(f"✓ Added {table.name}.{col.name}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🔧 Initializing database...")
    init_db()
    _sync_schema()
    print("✓ Database tables created")
    print(f"🚀 {settings.PROJECT_NAME} is ready!")
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(credentials_router)
app.include_router(videos_router)
app.include_router(media_router)


@app.get("/swagger", include_in_schema=False)
async def swagger_redirect():
    return RedirectResponse(url="/docs")


@app.get("/")
async def root():
    return {
        "message": "DreamPilot API",
        "project": settings.PROJECT_NAME,
        "swagger": "/swagger",
        "docs": "/docs",
        "redoc": "/redoc",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.HOST, port=settings.PORT)
