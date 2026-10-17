from fastapi import FastAPI

from app.api.routes.users import router as users_router
from app.api.routes.health import router as health_router
from app.api.routes.auth import router as auth_router
from app.api.routes.profile import router as profile_router
from app.api.routes.groups import router as groups_router
from app.api.routes.invitations import router as invitations_router
from app.api.routes.memberships import router as memberships_router
from app.api.routes.events import router as events_router


app = FastAPI(
    title="Shared Expense Management API",
    version="0.1.0",
)

app.include_router(health_router)
app.include_router(users_router)
app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(groups_router)
app.include_router(invitations_router)
app.include_router(memberships_router)
app.include_router(events_router)

@app.get("/")
def root():
    return {
        "message": "Shared Expense Management API"
    }

