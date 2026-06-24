from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path

from sqlalchemy import Boolean, DateTime, Integer, String, Text, create_engine, ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
import contextvars

active_engagement_id_ctx = contextvars.ContextVar("active_engagement_id", default=None)


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
DEFAULT_DATABASE_URL = f"sqlite:///{ROOT / 'kpi.db'}"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

from sqlalchemy import event
from sqlalchemy.engine import Engine

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if DATABASE_URL.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


class Base(DeclarativeBase):
    pass


class BusinessContext(Base):
    __tablename__ = "business_context"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    engagement_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    industry: Mapped[str] = mapped_column(String(200), default="")
    organization_level: Mapped[str] = mapped_column(String(200), default="")
    kpi_count: Mapped[int] = mapped_column(Integer, default=8)
    business_priorities: Mapped[str] = mapped_column(Text, default="[]")  # JSON string
    business_challenges: Mapped[str] = mapped_column(Text, default="[]")  # JSON string
    top_kras: Mapped[str] = mapped_column(Text, default="[]")  # JSON string
    functional_areas: Mapped[str] = mapped_column(Text, default="[]")  # JSON string
    additional_business_priorities: Mapped[str] = mapped_column(Text, default="[]")  # JSON string
    additional_business_challenges: Mapped[str] = mapped_column(Text, default="[]")  # JSON string
    additional_kras: Mapped[str] = mapped_column(Text, default="[]")  # JSON string
    additional_functional_areas: Mapped[str] = mapped_column(Text, default="[]")  # JSON string
    custom_fields: Mapped[str] = mapped_column(Text, default="[]")  # JSON string representing list of {label, value}
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class Prompt(Base):
    __tablename__ = "prompt"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    engagement_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    prompt: Mapped[str] = mapped_column(Text, default="")
    original_prompt: Mapped[str] = mapped_column(Text, default="")
    user_instructions: Mapped[str] = mapped_column(Text, default="")
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_summary: Mapped[str] = mapped_column(Text, default="{}")  # JSON string
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class KPILibrary(Base):
    __tablename__ = "kpi_library"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    engagement_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    items: Mapped[str] = mapped_column(Text, default="[]")  # JSON string
    quality: Mapped[str] = mapped_column(Text, default="{}")  # JSON string
    recommendations: Mapped[str] = mapped_column(Text, default="{}")  # JSON string
    executive_summary: Mapped[str] = mapped_column(Text, default="{}")  # JSON string
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class KPITree(Base):
    __tablename__ = "kpi_tree"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    client_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    engagement_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    name: Mapped[str] = mapped_column(String(100), default="Default Tree")
    data: Mapped[str] = mapped_column(Text, default="{}")  # JSON string
    tree_json: Mapped[str] = mapped_column(Text, default="{}")  # Complete tree structure JSON string
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(50), default="draft")  # draft / approved
    created_by: Mapped[str] = mapped_column(String(255), default="")
    updated_by: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class ActivityLog(Base):
    __tablename__ = "activity_log"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    label: Mapped[str] = mapped_column(String(200), default="")
    detail: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    user_name: Mapped[str] = mapped_column(String(255), default="")
    user_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    action_type: Mapped[str] = mapped_column(String(100), default="")
    entity_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    entity_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    previous_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    client_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    client_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    engagement_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    engagement_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    module: Mapped[str] = mapped_column(String(100), default="")
    action: Mapped[str] = mapped_column(String(100), default="")
    status: Mapped[str] = mapped_column(String(50), default="Success")


class FunctionalSpecification(Base):
    __tablename__ = "functional_specification"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    engagement_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    items: Mapped[str] = mapped_column(Text, default="[]")  # JSON string
    executive_summary: Mapped[str] = mapped_column(Text, default="")
    draft_items: Mapped[str] = mapped_column(Text, default="[]")  # JSON string
    approved_items: Mapped[str] = mapped_column(Text, default="[]")  # JSON string
    status: Mapped[str] = mapped_column(String(50), default="draft")  # "draft" or "approved"
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class ApprovedKPIs(Base):
    __tablename__ = "approved_kpis"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    engagement_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    items: Mapped[str] = mapped_column(Text, default="[]")  # JSON string
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class TranscriptAnalysis(Base):
    __tablename__ = "transcript_analysis"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String(255), default="")
    raw_text: Mapped[str] = mapped_column(Text, default="")
    extracted_insights: Mapped[str] = mapped_column(Text, default="{}")  # JSON string
    status: Mapped[str] = mapped_column(String(50), default="draft")  # "draft", "approved", "rejected"
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class ClientProfile(Base):
    __tablename__ = "client_profile"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    client_name: Mapped[str] = mapped_column(String(255), default="")
    industry: Mapped[str] = mapped_column(String(255), default="")
    sub_industry: Mapped[str] = mapped_column(String(255), default="")
    country: Mapped[str] = mapped_column(String(255), default="")
    region: Mapped[str] = mapped_column(String(255), default="")
    company_size: Mapped[str] = mapped_column(String(255), default="")
    organization_description: Mapped[str] = mapped_column(Text, default="")
    erp_platform: Mapped[str] = mapped_column(String(255), default="")
    crm_platform: Mapped[str] = mapped_column(String(255), default="")
    mes_platform: Mapped[str] = mapped_column(String(255), default="")
    bi_tool: Mapped[str] = mapped_column(String(255), default="")
    data_warehouse: Mapped[str] = mapped_column(String(255), default="")
    cloud_platform: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class ClientInsight(Base):
    __tablename__ = "client_insights"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    client_profile_id: Mapped[int] = mapped_column(ForeignKey("client_profile.id", ondelete="CASCADE"), nullable=False)
    category: Mapped[str] = mapped_column(String(255), default="")
    content_json: Mapped[str] = mapped_column(Text, default="[]")  # JSON string array
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class Engagement(Base):
    __tablename__ = "engagements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    client_profile_id: Mapped[int] = mapped_column(ForeignKey("client_profile.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), default="")          # e.g. "Phase 1 Rollout"
    engagement_id: Mapped[str] = mapped_column(String(100), default="") # e.g. "ENG-001"
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(50), default="active")   # active / archived
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class LLMUsageLog(Base):
    __tablename__ = "llm_usage_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    provider: Mapped[str] = mapped_column(String(100), default="")
    model: Mapped[str] = mapped_column(String(100), default="")
    workflow_step: Mapped[str] = mapped_column(String(100), default="")
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=True)
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    success: Mapped[bool] = mapped_column(Boolean, default=False)
    error_message: Mapped[str] = mapped_column(Text, nullable=True)


class IndustryMetadata(Base):
    __tablename__ = "metadata_industries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class OrgLevelMetadata(Base):
    __tablename__ = "metadata_org_levels"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class FunctionalAreaMetadata(Base):
    __tablename__ = "metadata_functional_areas"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class BusinessPriorityMetadata(Base):
    __tablename__ = "metadata_business_priorities"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class BusinessChallengeMetadata(Base):
    __tablename__ = "metadata_business_challenges"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class KRAMetadata(Base):
    __tablename__ = "metadata_kras"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class KPICategoryMetadata(Base):
    __tablename__ = "metadata_kpi_categories"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class KPIQualityRatingMetadata(Base):
    __tablename__ = "metadata_kpi_quality_ratings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


def seed_metadata() -> None:
    from sqlalchemy import select
    with SessionLocal() as session:
        # Check if industries are empty
        if not session.scalar(select(IndustryMetadata).limit(1)):
            for name in [
                "Manufacturing", "Retail", "Technology", "Telecom", "Healthcare", 
                "FMCG", "Automotive", "Energy", "Chemicals", "Banking", 
                "Consumer Electronics", "Public Sector", "Logistics", "Financial Services"
            ]:
                session.add(IndustryMetadata(name=name))
        
        # Check if organization levels are empty
        if not session.scalar(select(OrgLevelMetadata).limit(1)):
            for name in ["Board", "CXO", "Business Unit", "Function Head", "Regional Leadership"]:
                session.add(OrgLevelMetadata(name=name))

        # Check if functional areas are empty
        if not session.scalar(select(FunctionalAreaMetadata).limit(1)):
            for name in ["Sales", "Production", "Supply Chain", "Finance", "Quality", "Customer Service", "Procurement", "Operations"]:
                session.add(FunctionalAreaMetadata(name=name))

        # Check if business priorities are empty
        if not session.scalar(select(BusinessPriorityMetadata).limit(1)):
            for name in [
                "Improve Gross Margin", "Improve Cash Flow", "Accelerate Revenue Growth", 
                "Reduce Operating Cost", "Improve Customer Retention", "Increase Asset Productivity", 
                "Strengthen Forecast Accuracy", "Improve Working Capital", "Enhance Process Automation", 
                "Reduce Defect Rates", "Minimize ESG Carbon Intensity", "Improve Workplace Safety"
            ]:
                session.add(BusinessPriorityMetadata(name=name))

        # Check if business challenges are empty
        if not session.scalar(select(BusinessChallengeMetadata).limit(1)):
            for name in [
                "High Operational Cost", "Supply Chain Delays", "Demand Volatility", 
                "Manual Data Collection", "Low Inventory Turn Velocity", "Margin Leakage from Discounting", 
                "Customer Churn and Complaints", "High Defect and Scrap Rates", "Safety Compliance Risks", 
                "Excess Working Capital Lock-up"
            ]:
                session.add(BusinessChallengeMetadata(name=name))

        # Check if KRAs are empty
        if not session.scalar(select(KRAMetadata).limit(1)):
            for name in ["Revenue Growth", "Profitability", "Customer Growth", "Operational Excellence", "Cost Reduction", "Asset Productivity", "Cash Flow", "Risk Management"]:
                session.add(KRAMetadata(name=name))

        # Check if KPI categories are empty
        if not session.scalar(select(KPICategoryMetadata).limit(1)):
            for name in ["Operational", "Financial", "Supply Chain", "Risk", "Customer", "Quality", "ESG"]:
                session.add(KPICategoryMetadata(name=name))

        # Check if KPI quality ratings are empty
        if not session.scalar(select(KPIQualityRatingMetadata).limit(1)):
            for name in ["Bronze", "Silver", "Gold", "Platinum"]:
                session.add(KPIQualityRatingMetadata(name=name))

        session.commit()


def init_db() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    Base.metadata.create_all(bind=engine)
    
    # Run dynamic column migrations for existing SQLite databases
    try:
        with engine.connect() as conn:
            # business_context migration
            cursor = conn.exec_driver_sql("PRAGMA table_info(business_context)")
            existing_cols = [row[1] for row in cursor.fetchall()]
            new_cols = [
                ("additional_business_priorities", "TEXT DEFAULT '[]'"),
                ("additional_business_challenges", "TEXT DEFAULT '[]'"),
                ("additional_kras", "TEXT DEFAULT '[]'"),
                ("additional_functional_areas", "TEXT DEFAULT '[]'"),
                ("custom_fields", "TEXT DEFAULT '[]'")
            ]
            for col_name, col_def in new_cols:
                if col_name not in existing_cols:
                    conn.exec_driver_sql(f"ALTER TABLE business_context ADD COLUMN {col_name} {col_def}")

            # functional_specification migration
            cursor_fs = conn.exec_driver_sql("PRAGMA table_info(functional_specification)")
            existing_cols_fs = [row[1] for row in cursor_fs.fetchall()]
            new_cols_fs = [
                ("executive_summary", "TEXT DEFAULT ''"),
                ("draft_items", "TEXT DEFAULT '[]'"),
                ("approved_items", "TEXT DEFAULT '[]'"),
                ("status", "VARCHAR(50) DEFAULT 'draft'")
            ]
            for col_name, col_def in new_cols_fs:
                if col_name not in existing_cols_fs:
                    conn.exec_driver_sql(f"ALTER TABLE functional_specification ADD COLUMN {col_name} {col_def}")
            
            # engagements table migration — add table if it doesn't exist
            conn.exec_driver_sql(
                """
                CREATE TABLE IF NOT EXISTS engagements (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    client_profile_id INTEGER NOT NULL
                        REFERENCES client_profile(id) ON DELETE CASCADE,
                    name VARCHAR(255) DEFAULT '',
                    engagement_id VARCHAR(100) DEFAULT '',
                    description TEXT DEFAULT '',
                    status VARCHAR(50) DEFAULT 'active',
                    created_at DATETIME,
                    updated_at DATETIME
                )
                """
            )

            # audit_logs table migration — add table if it doesn't exist
            conn.exec_driver_sql(
                """
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME,
                    user_name VARCHAR(255) DEFAULT '',
                    user_email VARCHAR(255),
                    action_type VARCHAR(100) DEFAULT '',
                    entity_type VARCHAR(100),
                    entity_name VARCHAR(255),
                    previous_value TEXT,
                    new_value TEXT,
                    client_id INTEGER,
                    client_name VARCHAR(255),
                    engagement_id INTEGER,
                    engagement_name VARCHAR(255),
                    module VARCHAR(100) DEFAULT '',
                    action VARCHAR(100) DEFAULT '',
                    status VARCHAR(50) DEFAULT 'Success'
                )
                """
            )

            # kpi_tree table migration for new columns
            cursor_tree = conn.exec_driver_sql("PRAGMA table_info(kpi_tree)")
            existing_cols_tree = [row[1] for row in cursor_tree.fetchall()]
            new_cols_tree = [
                ("client_id", "INTEGER"),
                ("tree_json", "TEXT DEFAULT '{}'"),
                ("version", "INTEGER DEFAULT 1"),
                ("status", "VARCHAR(50) DEFAULT 'draft'"),
                ("created_by", "VARCHAR(255) DEFAULT ''"),
                ("updated_by", "VARCHAR(255) DEFAULT ''")
            ]
            for col_name, col_def in new_cols_tree:
                if col_name not in existing_cols_tree:
                    conn.exec_driver_sql(f"ALTER TABLE kpi_tree ADD COLUMN {col_name} {col_def}")

            # Dynamic engagement_id column migration for step tables
            tables_to_migrate = [
                "business_context",
                "prompt",
                "kpi_library",
                "kpi_tree",
                "functional_specification",
                "approved_kpis"
            ]
            for table_name in tables_to_migrate:
                cursor_table = conn.exec_driver_sql(f"PRAGMA table_info({table_name})")
                cols = [row[1] for row in cursor_table.fetchall()]
                if "engagement_id" not in cols:
                    conn.exec_driver_sql(f"ALTER TABLE {table_name} ADD COLUMN engagement_id INTEGER")
    except Exception as e:
        print(f"Error performing SQLite migrations: {e}")
        
    seed_metadata()
