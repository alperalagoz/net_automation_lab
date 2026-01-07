from fastapi import FastAPI, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc
import uuid
from datetime import datetime

from .database import engine, Base, get_db
from .models import TaskResult
from .worker import process_config_task


Base.metadata.create_all(bind=engine)

app = FastAPI()

class RouterConfig(BaseModel):
    router_ips: List[str]
    commands: List[str]
    username: str
    password: str
    device_type: str = "cisco_ios"

@app.post("/configure")
async def configure_routers(config: RouterConfig, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    task_id = str(uuid.uuid4())
    
    
    new_task = TaskResult(
        id=task_id, 
        status="PENDING", 
        result={}, 
        created_at=datetime.utcnow()
    )
    db.add(new_task)
    db.commit()


    from .database import SessionLocal
    thread_db = SessionLocal()
    
    background_tasks.add_task(process_config_task, task_id, config.dict(), thread_db)
    
    return {"message": "Configuration task submitted", "task_id": task_id}

@app.get("/tasks/{task_id}")
def get_status(task_id: str, db: Session = Depends(get_db)):
    task = db.query(TaskResult).filter(TaskResult.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {
        "task_id": task.id,
        "task_status": task.status,
        "task_result": task.result,
        "created_at": task.created_at
    }

@app.get("/tasks")
def list_tasks(limit: int = 20, db: Session = Depends(get_db)):
    """List recent tasks, ordered by creation time desc."""
    tasks = db.query(TaskResult).order_by(desc(TaskResult.created_at)).limit(limit).all()
    return [
        {
            "task_id": t.id,
            "task_status": t.status,
            "created_at": t.created_at,
            # We don't return the full result here to keep it light
        }
        for t in tasks
    ]
