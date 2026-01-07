from sqlalchemy import Column, Integer, String, Text, JSON, DateTime
from .database import Base
from datetime import datetime

class TaskResult(Base):
    __tablename__ = "task_results"

    id = Column(String, primary_key=True, index=True)
    status = Column(String, default="PENDING")
    created_at = Column(DateTime, default=datetime.utcnow)
    result = Column(JSON, nullable=True)
