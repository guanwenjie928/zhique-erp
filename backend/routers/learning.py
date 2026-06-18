"""学习模式路由"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from decimal import Decimal
import json

from database import get_db
from models import (
    LearningProgress, LearningScenario,
    ScenarioResult, OperationLog, OperationScore,
)

router = APIRouter()


# ============================================================
# Pydantic Schemas
# ============================================================

class CourseInfo(BaseModel):
    course_id: str
    course_name: str
    status: str = "not_started"
    progress: int = 0
    score: Optional[int] = None


class LearningProgressBase(BaseModel):
    user_id: Optional[int] = 1
    course_id: str
    course_name: Optional[str] = None
    status: Optional[str] = "not_started"
    progress: Optional[int] = 0
    score: Optional[int] = None


class LearningProgressUpdate(BaseModel):
    status: Optional[str] = None
    progress: Optional[int] = None
    score: Optional[int] = None


class LearningProgressOut(LearningProgressBase):
    id: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ScenarioBase(BaseModel):
    code: str
    name: str
    difficulty: Optional[int] = 1
    background: Optional[str] = None
    role: Optional[str] = None
    objectives: Optional[str] = None
    constraints: Optional[str] = None
    checkpoints: Optional[str] = None
    modules: Optional[str] = None
    estimated_time: Optional[int] = None
    status: Optional[str] = "active"


class ScenarioCreate(ScenarioBase):
    pass


class ScenarioOut(ScenarioBase):
    id: int

    class Config:
        from_attributes = True


class ScenarioResultBase(BaseModel):
    user_id: Optional[int] = 1
    scenario_code: str
    total_score: Optional[Decimal] = None
    accuracy_score: Optional[Decimal] = None
    completeness_score: Optional[Decimal] = None
    compliance_score: Optional[Decimal] = None
    efficiency_score: Optional[Decimal] = None
    feedback: Optional[str] = None
    status: Optional[str] = "in_progress"


class ScenarioResultCreate(ScenarioResultBase):
    pass


class ScenarioResultOut(ScenarioResultBase):
    id: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class OperationLogBase(BaseModel):
    user_id: Optional[int] = 1
    module: Optional[str] = None
    action: Optional[str] = None
    target_bill_type: Optional[str] = None
    target_bill_no: Optional[str] = None
    detail: Optional[str] = None
    scenario_code: Optional[str] = None


class OperationLogCreate(OperationLogBase):
    pass


class OperationLogOut(OperationLogBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class OperationScoreBase(BaseModel):
    user_id: Optional[int] = 1
    module: Optional[str] = None
    action: Optional[str] = None
    target_bill_no: Optional[str] = None
    accuracy_score: Optional[Decimal] = None
    completeness_score: Optional[Decimal] = None
    compliance_score: Optional[Decimal] = None
    efficiency_score: Optional[Decimal] = None
    total_score: Optional[Decimal] = None
    feedback: Optional[str] = None


class OperationScoreCreate(OperationScoreBase):
    pass


class OperationScoreOut(OperationScoreBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================================
# Course Definitions (inline)
# ============================================================

COURSES = [
    {"course_id": "tour_01", "course_name": "认识ERP系统界面"},
    {"course_id": "tour_02", "course_name": "物料档案管理"},
    {"course_id": "tour_03", "course_name": "供应商与客户管理"},
    {"course_id": "tour_04", "course_name": "采购申请流程"},
    {"course_id": "tour_05", "course_name": "采购订单管理"},
    {"course_id": "tour_06", "course_name": "采购入库与退货"},
    {"course_id": "tour_07", "course_name": "销售订单管理"},
    {"course_id": "tour_08", "course_name": "销售出库与退货"},
    {"course_id": "tour_09", "course_name": "库存管理与盘点"},
    {"course_id": "tour_10", "course_name": "应付账款与付款"},
    {"course_id": "tour_11", "course_name": "应收账款与收款"},
    {"course_id": "tour_12", "course_name": "仪表盘与报表分析"},
]


# ============================================================
# Endpoints - Courses
# ============================================================

@router.get("/courses", response_model=List[CourseInfo])
def list_courses(
    user_id: int = Query(1, description="用户ID"),
    db: Session = Depends(get_db),
):
    """课程列表（含学习进度）"""
    result = []
    for course in COURSES:
        progress = db.query(LearningProgress).filter(
            LearningProgress.user_id == user_id,
            LearningProgress.course_id == course["course_id"],
        ).first()
        if progress:
            result.append(CourseInfo(
                course_id=course["course_id"],
                course_name=course["course_name"],
                status=progress.status or "not_started",
                progress=progress.progress or 0,
                score=progress.score,
            ))
        else:
            result.append(CourseInfo(
                course_id=course["course_id"],
                course_name=course["course_name"],
            ))
    return result


@router.put("/courses/{course_id}/progress", response_model=LearningProgressOut)
def update_course_progress(
    course_id: str,
    data: LearningProgressUpdate,
    user_id: int = Query(1),
    db: Session = Depends(get_db),
):
    """更新课程学习进度"""
    course = next((c for c in COURSES if c["course_id"] == course_id), None)
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")

    progress = db.query(LearningProgress).filter(
        LearningProgress.user_id == user_id,
        LearningProgress.course_id == course_id,
    ).first()

    if not progress:
        progress = LearningProgress(
            user_id=user_id,
            course_id=course_id,
            course_name=course["course_name"],
            status="not_started",
            progress=0,
            started_at=datetime.now(),
        )
        db.add(progress)

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(progress, key, value)

    # 自动更新状态
    if progress.progress is not None:
        if progress.progress >= 100:
            progress.status = "completed"
            progress.completed_at = datetime.now()
        elif progress.progress > 0:
            progress.status = "in_progress"
            if not progress.started_at:
                progress.started_at = datetime.now()

    db.commit()
    db.refresh(progress)
    return progress


# ============================================================
# Endpoints - Scenarios
# ============================================================

@router.get("/scenarios", response_model=List[ScenarioOut])
def list_scenarios(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    difficulty: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """实战场景列表"""
    query = db.query(LearningScenario)
    if difficulty:
        query = query.filter(LearningScenario.difficulty == difficulty)
    if status:
        query = query.filter(LearningScenario.status == status)
    query = query.order_by(LearningScenario.code)
    return query.offset(skip).limit(limit).all()


@router.get("/scenarios/{scenario_code}", response_model=ScenarioOut)
def get_scenario(scenario_code: str, db: Session = Depends(get_db)):
    """获取场景详情"""
    scenario = db.query(LearningScenario).filter(
        LearningScenario.code == scenario_code
    ).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="场景不存在")
    return scenario


@router.post("/scenarios", response_model=ScenarioOut)
def create_scenario(data: ScenarioCreate, db: Session = Depends(get_db)):
    """新增场景"""
    exists = db.query(LearningScenario).filter(
        LearningScenario.code == data.code
    ).first()
    if exists:
        raise HTTPException(status_code=400, detail="场景编码已存在")
    scenario = LearningScenario(**data.model_dump())
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return scenario


# ============================================================
# Endpoints - Scenario Results
# ============================================================

@router.get("/scenario-results", response_model=List[ScenarioResultOut])
def list_scenario_results(
    user_id: int = Query(1),
    scenario_code: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """场景完成结果列表"""
    query = db.query(ScenarioResult).filter(ScenarioResult.user_id == user_id)
    if scenario_code:
        query = query.filter(ScenarioResult.scenario_code == scenario_code)
    query = query.order_by(ScenarioResult.id.desc())
    return query.offset(skip).limit(limit).all()


@router.post("/scenario-results", response_model=ScenarioResultOut)
def create_scenario_result(data: ScenarioResultCreate, db: Session = Depends(get_db)):
    """提交场景完成结果"""
    result = ScenarioResult(**data.model_dump())
    if result.status == "completed":
        result.completed_at = datetime.now()
    db.add(result)
    db.commit()
    db.refresh(result)
    return result


# ============================================================
# Endpoints - Operation Logs
# ============================================================

@router.get("/operation-logs", response_model=List[OperationLogOut])
def list_operation_logs(
    user_id: int = Query(1),
    module: Optional[str] = Query(None),
    scenario_code: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """操作日志列表"""
    query = db.query(OperationLog).filter(OperationLog.user_id == user_id)
    if module:
        query = query.filter(OperationLog.module == module)
    if scenario_code:
        query = query.filter(OperationLog.scenario_code == scenario_code)
    query = query.order_by(OperationLog.id.desc())
    return query.offset(skip).limit(limit).all()


@router.post("/operation-logs", response_model=OperationLogOut)
def create_operation_log(data: OperationLogCreate, db: Session = Depends(get_db)):
    """记录操作日志"""
    log = OperationLog(**data.model_dump())
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


# ============================================================
# Endpoints - Operation Scores
# ============================================================

@router.get("/operation-scores", response_model=List[OperationScoreOut])
def list_operation_scores(
    user_id: int = Query(1),
    module: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """操作评分记录列表"""
    query = db.query(OperationScore).filter(OperationScore.user_id == user_id)
    if module:
        query = query.filter(OperationScore.module == module)
    query = query.order_by(OperationScore.id.desc())
    return query.offset(skip).limit(limit).all()


@router.post("/operation-scores", response_model=OperationScoreOut)
def create_operation_score(data: OperationScoreCreate, db: Session = Depends(get_db)):
    """记录操作评分"""
    score = OperationScore(**data.model_dump())
    db.add(score)
    db.commit()
    db.refresh(score)
    return score


@router.get("/scores/summary")
def get_scores_summary(
    user_id: int = Query(1),
    db: Session = Depends(get_db),
):
    """获取评分汇总"""
    scores = db.query(OperationScore).filter(
        OperationScore.user_id == user_id
    ).all()
    if not scores:
        return {
            "total_count": 0,
            "avg_total_score": 0,
            "avg_accuracy_score": 0,
            "avg_completeness_score": 0,
            "avg_compliance_score": 0,
            "avg_efficiency_score": 0,
        }
    count = len(scores)
    return {
        "total_count": count,
        "avg_total_score": sum(s.total_score or Decimal("0") for s in scores) / count,
        "avg_accuracy_score": sum(s.accuracy_score or Decimal("0") for s in scores) / count,
        "avg_completeness_score": sum(s.completeness_score or Decimal("0") for s in scores) / count,
        "avg_compliance_score": sum(s.compliance_score or Decimal("0") for s in scores) / count,
        "avg_efficiency_score": sum(s.efficiency_score or Decimal("0") for s in scores) / count,
    }
