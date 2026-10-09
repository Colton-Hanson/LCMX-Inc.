from fastapi import FastAPI

from app.api.routes.users import router as users_router
from app.api.routes.health import router as health_router
from app.api.routes.auth import router as auth_router
from app.api.routes.profile import router as profile_router



app = FastAPI(
    title="Shared Expense Management API",
    version="0.1.0",
)

app.include_router(health_router)
app.include_router(users_router)
app.include_router(auth_router)
app.include_router(profile_router)

@app.get("/")
def root():
    return {
        "message": "Shared Expense Management API"
    }

